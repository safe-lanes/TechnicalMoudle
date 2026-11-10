/** Runs real tenant startup control flow against fakes; never opens a socket. */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  runMigrations: vi.fn(), runDrizzleMigrations: vi.fn(), initializeDatabase: vi.fn(),
  immutability: vi.fn(), identity: vi.fn(), drizzle: vi.fn(), query: vi.fn(),
  release: vi.fn(), end: vi.fn(), pools: [] as unknown[], events: [] as string[],
  seed: vi.fn(() => { throw new Error("Production startup must not seed"); }),
}));
vi.mock("pg", () => ({
  Pool: class OfflinePool {
    totalCount = 0;
    constructor() { fake.pools.push(this); }
    async connect() { return { query: fake.query, release: fake.release }; }
    end = fake.end;
  },
}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: fake.drizzle }));
vi.mock("../defaults/pmsFormsMasterSeeder", () => ({
  initializePmsFormsMasterTenant: fake.seed, seedPmsFormsMasterDefaults: fake.seed,
}));
vi.mock("../../../migrations", () => ({
  runMigrations: fake.runMigrations, runDrizzleMigrations: fake.runDrizzleMigrations,
}));
vi.mock("../../../initDb", () => ({
  initializeDatabase: fake.initializeDatabase, ensureMaintenanceHistoryImmutability: fake.immutability,
}));
vi.mock("../../../postgresClient", () => ({
  resolvePostgres: () => { throw new Error("Unexpected real database resolver"); },
}));
vi.mock("../../sync/syncRole", () => ({ getEffectiveInstanceId: fake.identity }));
import { tenantConnectionManager, TenantDatabaseError } from "../../../utils/tenantConnectionManager";
import { tenantStorage } from "../../../utils/asyncLocalStorage";

interface OfflineManager {
  masterDb: unknown;
  poolCache: Map<string, unknown>;
  migratedTenants: Set<string>;
  migrationFailures: Map<string, number>;
  circuitBreakers: Map<string, unknown>;
  pendingPoolCreations: Map<string, Promise<unknown>>;
  ensureTenantPool(tuid: string): Promise<unknown>;
}
// Only the test accesses private state to exercise the real, unexported startup path.
const manager = tenantConnectionManager as unknown as OfflineManager;
const tuid = "offline-fixture";
const db = { marker: "fake tenant database" };
const calls = [
  [fake.runMigrations, "legacy"], [fake.runDrizzleMigrations, "tracked"],
  [fake.initializeDatabase, "base"], [fake.immutability, "immutability"], [fake.identity, "identity"],
] as const;

beforeEach(() => {
  // Fixture-only URL; no credential or environment value is read by a real driver.
  vi.stubEnv("MASTER_DATABASE_URL", "postgresql://offline.invalid/registry");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  fake.events.length = 0; fake.pools.length = 0;
  fake.seed.mockClear(); fake.query.mockReset().mockResolvedValue({ rows: [] });
  fake.release.mockReset(); fake.end.mockReset().mockResolvedValue(undefined);
  fake.drizzle.mockReset().mockReturnValue(db);
  manager.poolCache.clear(); manager.migratedTenants.clear(); manager.migrationFailures.clear();
  manager.circuitBreakers.clear(); manager.pendingPoolCreations.clear();
  manager.masterDb = { select: () => ({ from: () => ({ where: () => ({
    limit: async () => [{ databaseName: "offline_fixture", isActive: true }],
  }) }) }) };
  for (const [fn, label] of calls) fn.mockReset().mockImplementation(async (pool?: unknown) => {
    const context = tenantStorage.getStore();
    expect(context?.tuid).toBe(tuid);
    expect(context?.db).toBe(db);
    expect(context?.pool).toBe(fake.pools[0]);
    if (label !== "identity") expect(pool).toBe(fake.pools[0]);
    expect(manager.poolCache.has(tuid)).toBe(false);
    expect(manager.migratedTenants.has(tuid)).toBe(false);
    fake.events.push(label);
    return label === "identity" ? " shore-fixture " : undefined;
  });
});
afterEach(() => {
  vi.unstubAllEnvs(); vi.restoreAllMocks();
  manager.poolCache.clear(); manager.masterDb = null;
});

describe("production seed detachment", () => {
  it("normal boot contains no seed import/call and still migrates before identity and routes", () => {
    const source = readFileSync("server/index.ts", "utf8");
    expect(source).not.toMatch(/seedPmsFormsMasterDefaults|pmsFormsMasterSeeder|seedDefaults/);
    const ordered = ["await initStorage()", "await runBackupAndMigrations()", "await initializeDatabase()",
      "await tenantConnectionManager.init()", "await initFieldLoggerInstanceId()", "await getEffectiveInstanceId()",
      "await registerRoutes(app)"];
    const positions = ordered.map(text => source.indexOf(text));
    expect(positions.every(index => index >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // Do not import index.ts: importing it would start the application.
  });
  it("lazy startup contains no reference to either legacy seed wrapper", () => {
    const source = readFileSync("server/utils/tenantConnectionManager.ts", "utf8");
    expect(source).not.toMatch(/initializePmsFormsMasterTenant|seedPmsFormsMasterDefaults|pmsFormsMasterSeeder|seedDefaults/);
    expect(source).toContain("await tenantStorage.run({ tuid, db, pool }, async () => {");
  });
});

describe("actual lazy tenant startup with capturing fakes", () => {
  it("preserves context, initialization order, cache publication and pool reuse without seeding", async () => {
    manager.migrationFailures.set(tuid, Date.now() - 60_000);
    const first = await manager.ensureTenantPool(tuid);
    expect(fake.events).toEqual(["legacy", "tracked", "base", "immutability", "identity"]);
    expect(tenantStorage.getStore()).toBeUndefined();
    expect(manager.migratedTenants.has(tuid)).toBe(true);
    expect(manager.migrationFailures.has(tuid)).toBe(false);
    expect(manager.poolCache.get(tuid)).toBe(first);
    expect(await manager.ensureTenantPool(tuid)).toBe(first);
    expect(fake.pools).toHaveLength(1); expect(fake.seed).not.toHaveBeenCalled();
    expect(fake.release).toHaveBeenCalledOnce(); expect(fake.end).not.toHaveBeenCalled();
  });
  it("deduplicates concurrent startup for the same tenant", async () => {
    const [first, second] = await Promise.all([manager.ensureTenantPool(tuid), manager.ensureTenantPool(tuid)]);
    expect(first).toBe(second);
    expect(fake.pools).toHaveLength(1); expect(fake.runDrizzleMigrations).toHaveBeenCalledOnce();
    expect(manager.pendingPoolCreations.size).toBe(0);
  });
  it.each(["", " unknown ", " ship-vesselname "])("keeps invalid identity %j fail-closed, before cache publication", async identity => {
    fake.identity.mockImplementation(async () => { fake.events.push("identity"); return identity; });
    await expect(manager.ensureTenantPool(tuid)).rejects.toBeInstanceOf(TenantDatabaseError);
    expect(fake.events).toEqual(["legacy", "tracked", "base", "immutability", "identity"]);
    expect(manager.poolCache.has(tuid)).toBe(false); expect(manager.migratedTenants.has(tuid)).toBe(false);
    expect(manager.migrationFailures.has(tuid)).toBe(true); expect(fake.end).toHaveBeenCalledOnce();
    expect(tenantStorage.getStore()).toBeUndefined(); expect(fake.seed).not.toHaveBeenCalled();
  });
  it.each(calls.map(([, label]) => label))("preserves failure cleanup/cooldown when %s fails", async label => {
    const [fn] = calls.find(([, name]) => name === label)!;
    fn.mockRejectedValueOnce(new Error(`offline ${label} failure`));
    await expect(manager.ensureTenantPool(tuid)).rejects.toThrow("Schema migration failed.");
    expect(manager.poolCache.has(tuid)).toBe(false);
    expect(manager.migratedTenants.has(tuid)).toBe(false);
    expect(manager.migrationFailures.has(tuid)).toBe(true);
    expect(fake.end).toHaveBeenCalledOnce();
    expect(manager.pendingPoolCreations.size).toBe(0); expect(fake.seed).not.toHaveBeenCalled();
    const count = fake.pools.length;
    await expect(manager.ensureTenantPool(tuid)).rejects.toThrow("Schema migration recently failed");
    expect(fake.pools.length).toBe(count);
    expect(tenantStorage.getStore()).toBeUndefined();
    const index = calls.findIndex(([, name]) => name === label);
    for (const [later] of calls.slice(index + 1)) expect(later).not.toHaveBeenCalled();
  });
});
