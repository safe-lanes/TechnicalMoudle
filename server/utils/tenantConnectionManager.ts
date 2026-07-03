import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as schema from "@shared/schema";
import { tenants, tenantInstances } from "@shared/master/schema";
import { tenantStorage, getCurrentTenantContext, type TenantContext } from "./asyncLocalStorage";
import { runMigrations, runDrizzleMigrations } from "../migrations";
import { initializeDatabase, ensureMaintenanceHistoryImmutability } from "../initDb";

/**
 * Tenant connection manager (multi-tenant mode). Mirrors the Crewing pattern,
 * adapted to the same-PostgreSQL `database_name` model:
 *   - master DB (MASTER_DATABASE_URL) holds the tenants registry,
 *   - every tenant pool reuses the master URL's host/user/password/port and only
 *     swaps the database to the registry's `database_name`,
 *   - per-tenant pool cache + lazy migration + circuit breaker + idle eviction.
 *
 * Flag: isMultiTenantEnabled = !!MASTER_DATABASE_URL. When unset, init() returns
 * immediately and nothing here is constructed/entered — the accessors take the
 * legacy single-pool path (byte-identical to today).
 */

export class TenantNotFoundError extends Error {
  constructor(domain: string) {
    super(`No active tenant for domain '${domain}'.`);
    this.name = "TenantNotFoundError";
  }
}
export class TenantInactiveError extends Error {
  constructor(domain: string) {
    super(`Tenant for domain '${domain}' is inactive.`);
    this.name = "TenantInactiveError";
  }
}
export class TenantDatabaseError extends Error {
  constructor(key: string, cause?: string) {
    super(`Unable to connect to the database for tenant '${key}'.${cause ? ` ${cause}` : ""}`);
    this.name = "TenantDatabaseError";
  }
}

type DrizzleInstance = ReturnType<typeof drizzle>;

interface TenantCacheEntry { tuid: string; databaseName: string; expiresAt: number; }
interface PoolCacheEntry { pool: Pool; db: DrizzleInstance; lastUsed: number; }
interface CircuitBreakerEntry { failures: number; openUntil: number; }

const CACHE_TTL_MS = 5 * 60 * 1000;
const IDLE_EVICTION_MS = 30 * 60 * 1000;
const EVICTION_CHECK_INTERVAL_MS = 60 * 1000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30 * 1000;

function maskTuid(tuid: string): string {
  return tuid.length <= 8 ? tuid.substring(0, 4) + "***" : tuid.substring(0, 8) + "***";
}

class TenantConnectionManager {
  private masterPool: Pool | null = null;
  private masterDb: DrizzleInstance | null = null;
  private tenantCache = new Map<string, TenantCacheEntry>();        // domain -> {tuid, databaseName}
  private poolCache = new Map<string, PoolCacheEntry>();            // tuid -> {pool, db}
  private migratedTenants = new Set<string>();
  private migrationFailures = new Map<string, number>();
  private circuitBreakers = new Map<string, CircuitBreakerEntry>();
  private pendingPoolCreations = new Map<string, Promise<PoolCacheEntry>>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  private _isMultiTenantEnabled = false;

  private tenantPoolMax = parseInt(process.env.TENANT_POOL_MAX || "5", 10);
  private globalMaxConnections = parseInt(process.env.GLOBAL_MAX_CONNECTIONS || "80", 10);

  get isMultiTenantEnabled(): boolean {
    return this._isMultiTenantEnabled;
  }

  /** Re-exported by the accessors via asyncLocalStorage; provided here for callers holding the manager. */
  getCurrentTenantContext(): TenantContext | undefined {
    return getCurrentTenantContext();
  }

  /** Boot hook. No-op + single-tenant when MASTER_DATABASE_URL is unset. */
  async init(): Promise<void> {
    const masterUrl = process.env.MASTER_DATABASE_URL;
    if (!masterUrl) {
      this._isMultiTenantEnabled = false;
      console.log("🏠 Single-tenant mode (MASTER_DATABASE_URL not set)");
      return;
    }
    try {
      this.masterPool = new Pool({
        connectionString: masterUrl,
        ssl: this.sslFor(masterUrl),
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      const client = await this.masterPool.connect();
      await client.query("SELECT 1");
      client.release();
      this.masterDb = drizzle(this.masterPool);

      await this.runMasterMigrations();

      this._isMultiTenantEnabled = true;
      this.evictionTimer = setInterval(() => this.evictIdlePools(), EVICTION_CHECK_INTERVAL_MS);
      console.log(
        `🏢 Multi-tenant mode ENABLED (per-tenant pool max ${this.tenantPoolMax}, global cap ${this.globalMaxConnections})`,
      );
    } catch (err: any) {
      console.error("❌ Master DB init failed — falling back to single-tenant mode:", err.message);
      this._isMultiTenantEnabled = false;
      if (this.masterPool) { await this.masterPool.end().catch(() => {}); this.masterPool = null; }
      this.masterDb = null;
    }
  }

  private sslFor(url: string): false | { rejectUnauthorized: boolean; checkServerIdentity: () => undefined } {
    return url.includes("sslmode=require") || url.includes("ssl=true")
      ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
      : false;
  }

  /** Apply migrations/master/*.sql against the master pool (idempotent). */
  private async runMasterMigrations(): Promise<void> {
    const dir = path.join(process.cwd(), "migrations", "master");
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const ddl = fs.readFileSync(path.join(dir, file), "utf8");
      await this.masterPool!.query(ddl);
    }
    if (files.length) console.log(`📋 Master migrations applied (${files.length} file(s)).`);
  }

  /** Resolve a domain (verified JWT claim) to its tenant identity. Cached. */
  async resolveTenant(domain: string): Promise<{ tuid: string; databaseName: string }> {
    if (!this._isMultiTenantEnabled || !this.masterDb) {
      throw new Error("Multi-tenant is not configured");
    }
    const cached = this.tenantCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return { tuid: cached.tuid, databaseName: cached.databaseName };
    }
    const rows = await this.masterDb
      .select({ tuid: tenants.tuid, databaseName: tenants.databaseName, isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.domain, domain))
      .limit(1);
    if (rows.length === 0) throw new TenantNotFoundError(domain);
    if (!rows[0].isActive) throw new TenantInactiveError(domain);
    const out = { tuid: rows[0].tuid, databaseName: rows[0].databaseName };
    this.tenantCache.set(domain, { ...out, expiresAt: Date.now() + CACHE_TTL_MS });
    return out;
  }

  /** True if the tuid maps to an active tenant (used by the optional x-tenant-id header path, Phase 2). */
  async validateTuid(tuid: string): Promise<boolean> {
    if (!this._isMultiTenantEnabled || !this.masterDb) return false;
    const rows = await this.masterDb
      .select({ tuid: tenants.tuid })
      .from(tenants)
      .where(and(eq(tenants.tuid, tuid), eq(tenants.isActive, true)))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Upsert the ship-instance -> { domain, syncApiKey } map row (master DB). Called at
   * onboarding/provisioning. Idempotent: re-provisioning updates vessel/domain/key.
   * No-op when multi-tenant is disabled (single-tenant deploys have no master DB).
   * `syncApiKey` is omitted (left unchanged) when undefined.
   */
  async upsertTenantInstance(
    instanceId: string,
    vesselId: string | null,
    domain: string,
    syncApiKey?: string | null,
  ): Promise<void> {
    if (!this._isMultiTenantEnabled || !this.masterDb) return;
    await this.masterDb
      .insert(tenantInstances)
      .values({ instanceId, vesselId, domain, syncApiKey: syncApiKey ?? null })
      .onConflictDoUpdate({
        target: tenantInstances.instanceId,
        set: {
          vesselId,
          domain,
          ...(syncApiKey !== undefined ? { syncApiKey } : {}),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Phase 4b — fail-closed front door. Resolve an incoming ship instance id to its
   * { domain, syncApiKey } from the master map, WITHOUT opening any tenant DB. Returns
   * null when the instance is not registered (=> shore rejects 403, never default-routes).
   */
  async resolveInstanceDomain(instanceId: string): Promise<{ domain: string; syncApiKey: string | null } | null> {
    if (!this._isMultiTenantEnabled || !this.masterDb) return null;
    const rows = await this.masterDb
      .select({ domain: tenantInstances.domain, syncApiKey: tenantInstances.syncApiKey })
      .from(tenantInstances)
      .where(eq(tenantInstances.instanceId, instanceId))
      .limit(1);
    if (rows.length === 0) return null;
    return { domain: rows[0].domain, syncApiKey: rows[0].syncApiKey ?? null };
  }

  async getActiveTenants(): Promise<Array<{ tuid: string; databaseName: string }>> {
    if (!this._isMultiTenantEnabled || !this.masterDb) return [];
    return this.masterDb
      .select({ tuid: tenants.tuid, databaseName: tenants.databaseName })
      .from(tenants)
      .where(eq(tenants.isActive, true));
  }

  /** Public: get the tenant's Drizzle db (creates + migrates the pool on first use). */
  async getTenantDb(tuid: string): Promise<DrizzleInstance> {
    return (await this.ensureTenantPool(tuid)).db;
  }

  /** Run a callback inside the tenant's ALS context so the accessors resolve to its db/pool. */
  async runInTenantContext<T>(tuid: string, callback: () => T | Promise<T>): Promise<T> {
    const entry = await this.ensureTenantPool(tuid);
    return tenantStorage.run({ tuid, db: entry.db, pool: entry.pool }, callback);
  }

  // ── pool creation (cached, deduped, lazy-migrated) ──
  private async ensureTenantPool(tuid: string): Promise<PoolCacheEntry> {
    const existing = this.poolCache.get(tuid);
    if (existing) { existing.lastUsed = Date.now(); return existing; }
    const pending = this.pendingPoolCreations.get(tuid);
    if (pending) return pending;
    const creation = this.createTenantPool(tuid);
    this.pendingPoolCreations.set(tuid, creation);
    try { return await creation; }
    finally { this.pendingPoolCreations.delete(tuid); }
  }

  private async createTenantPool(tuid: string): Promise<PoolCacheEntry> {
    if (this.isCircuitOpen(tuid)) {
      throw new TenantDatabaseError(tuid, "Temporarily unavailable after repeated failures.");
    }
    const failedAt = this.migrationFailures.get(tuid);
    if (failedAt && Date.now() - failedAt < CIRCUIT_BREAKER_COOLDOWN_MS) {
      throw new TenantDatabaseError(tuid, "Schema migration recently failed. Retrying shortly.");
    }
    if (this.getTotalPoolConnections() >= this.globalMaxConnections) {
      throw new TenantDatabaseError(tuid, "Global connection limit reached.");
    }
    if (!this.masterDb) throw new TenantDatabaseError(tuid, "Master DB not initialized.");

    // Resolve the physical database name for this tuid from the registry.
    const rows = await this.masterDb
      .select({ databaseName: tenants.databaseName, isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.tuid, tuid))
      .limit(1);
    if (rows.length === 0 || !rows[0].isActive) {
      throw new TenantDatabaseError(tuid, "Tenant not found or inactive.");
    }
    const databaseName = rows[0].databaseName;

    try {
      const masterUrl = process.env.MASTER_DATABASE_URL!;
      const url = new URL(masterUrl);
      url.pathname = `/${databaseName}`;
      const connectionString = url.toString();

      const pool = new Pool({
        connectionString,
        ssl: this.sslFor(masterUrl),
        max: this.tenantPoolMax,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      this.clearCircuitBreaker(tuid);

      // Lazy per-tenant migration (Part-E pool-arg runners), once per tuid.
      if (!this.migratedTenants.has(tuid)) {
        try {
          await runMigrations(pool);
          await runDrizzleMigrations(pool);
          await initializeDatabase(pool);
          await ensureMaintenanceHistoryImmutability(pool);
          this.migratedTenants.add(tuid);
          this.migrationFailures.delete(tuid);
        } catch (migErr: any) {
          console.error(`❌ Tenant migration failed for '${maskTuid(tuid)}':`, migErr.message);
          this.migrationFailures.set(tuid, Date.now());
          await pool.end().catch(() => {});
          throw new TenantDatabaseError(tuid, "Schema migration failed.");
        }
      }

      const db = drizzle(pool, { schema });
      const entry: PoolCacheEntry = { pool, db, lastUsed: Date.now() };
      this.poolCache.set(tuid, entry);
      console.log(`🔗 Tenant pool created for '${maskTuid(tuid)}' (active pools: ${this.poolCache.size})`);
      return entry;
    } catch (err: any) {
      if (err instanceof TenantDatabaseError) throw err;
      this.recordConnectionFailure(tuid);
      throw new TenantDatabaseError(tuid, err.message);
    }
  }

  private getTotalPoolConnections(): number {
    let total = 0;
    this.poolCache.forEach((e) => { total += e.pool.totalCount; });
    return total;
  }

  private isCircuitOpen(tuid: string): boolean {
    const cb = this.circuitBreakers.get(tuid);
    if (!cb) return false;
    if (cb.openUntil > Date.now()) return true;
    this.circuitBreakers.delete(tuid);
    return false;
  }
  private recordConnectionFailure(tuid: string): void {
    const cb = this.circuitBreakers.get(tuid) || { failures: 0, openUntil: 0 };
    cb.failures++;
    if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      cb.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      console.warn(`⚡ Circuit breaker OPEN for tenant '${maskTuid(tuid)}'`);
    }
    this.circuitBreakers.set(tuid, cb);
  }
  private clearCircuitBreaker(tuid: string): void {
    this.circuitBreakers.delete(tuid);
  }

  private evictIdlePools(): void {
    const now = Date.now();
    this.poolCache.forEach((entry, tuid) => {
      if (now - entry.lastUsed > IDLE_EVICTION_MS) {
        entry.pool.end().catch((e: any) => console.error(`Failed closing idle pool '${maskTuid(tuid)}':`, e.message));
        this.poolCache.delete(tuid);
        console.log(`♻️ Evicted idle tenant pool '${maskTuid(tuid)}'`);
      }
    });
    this.tenantCache.forEach((entry, domain) => {
      if (entry.expiresAt <= now) this.tenantCache.delete(domain);
    });
  }

  getPoolMetrics(): { activePools: number; totalConnections: number; globalMaxConnections: number; poolMaxPerTenant: number; migratedTenants: number } {
    return {
      activePools: this.poolCache.size,
      totalConnections: this.getTotalPoolConnections(),
      globalMaxConnections: this.globalMaxConnections,
      poolMaxPerTenant: this.tenantPoolMax,
      migratedTenants: this.migratedTenants.size,
    };
  }

  /** Graceful shutdown / tests. */
  async closeAll(): Promise<void> {
    if (this.evictionTimer) { clearInterval(this.evictionTimer); this.evictionTimer = null; }
    const closes: Promise<void>[] = [];
    this.poolCache.forEach((entry, tuid) => {
      closes.push(entry.pool.end().catch((e: any) => console.error(`Error closing pool '${maskTuid(tuid)}':`, e.message)));
    });
    this.poolCache.clear();
    this.tenantCache.clear();
    this.migratedTenants.clear();
    this.migrationFailures.clear();
    this.circuitBreakers.clear();
    if (this.masterPool) {
      closes.push(this.masterPool.end().catch((e: any) => console.error("Error closing master pool:", e.message)));
      this.masterPool = null;
      this.masterDb = null;
    }
    this._isMultiTenantEnabled = false;
    await Promise.all(closes);
  }
}

export const tenantConnectionManager = new TenantConnectionManager();

/**
 * Snapshot the current tenant (call WHERE context still exists — e.g. an SSE
 * handler's first line) and return a wrapper that RE-ENTERS that tenant's ALS
 * context for deferred/streamed work. AsyncLocalStorage survives inline awaits
 * but can be lost across streaming/response boundaries; wrapping the work in the
 * returned function forces getDb()/getPool() back onto the tenant DB.
 *
 * No-op in single-tenant mode (no tuid in context) → the wrapper runs fn
 * directly, byte-identical to today. Re-entry hits the already-cached tenant
 * pool, so it does not re-migrate or add latency.
 */
export function captureTenant(): <T>(fn: () => Promise<T>) => Promise<T> {
  const tuid = getCurrentTenantContext()?.tuid;
  return <T>(fn: () => Promise<T>): Promise<T> =>
    tuid ? tenantConnectionManager.runInTenantContext(tuid, fn) : fn();
}

/**
 * Re-enter the tenant context AFTER a body-parser (multer/busboy) has broken the
 * ALS chain — using the tuid stashed on req by tenantMiddleware (which set it
 * before next(), i.e. before any route-level multer). Use this in multipart
 * (upload.single) handlers where getCurrentTenantContext() is already undefined.
 *
 * No-op in single-tenant mode (no tenantTuid on req) → runs fn directly,
 * byte-identical to today.
 */
export function captureTenantFromReq(req: any): <T>(fn: () => Promise<T>) => Promise<T> {
  const tuid = req?.tenantTuid;
  return <T>(fn: () => Promise<T>): Promise<T> =>
    tuid ? tenantConnectionManager.runInTenantContext(tuid, fn) : fn();
}
