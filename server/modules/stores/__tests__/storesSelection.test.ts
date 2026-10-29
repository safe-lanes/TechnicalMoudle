import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "../../../db";
import { tenantStorage } from "../../../utils/asyncLocalStorage";
import * as controller from "../controllers/storesPagingController";
import * as service from "../services/storesService";
import { storeSelection, storeInactivateBody, storeChemicalBody } from "../../../../shared/storesPagination";
import type { PoolClient } from "pg";

vi.mock("../services/storesService", () => ({
  inactivateStoresItem: vi.fn(), updateStoresItem: vi.fn(), batchConsume: vi.fn(), batchReceive: vi.fn(),
}));
vi.mock("../repositories/storesRepository", () => ({ getStoresItem: vi.fn() }));

describe("Table-free Stores selection with actual SQL and trusted vessel resolution", () => {
  let client: PoolClient;
  let pool: Awaited<ReturnType<typeof getPool>>;
  let db: ReturnType<typeof drizzle>;
  beforeAll(async () => {
    pool = await getPool(); client = await pool.connect(); db = drizzle(client);
    await client.query(`CREATE TEMP TABLE stores_items (
      id int PRIMARY KEY,vessel_id text,item_type text,item_code text,item_name text,
      category text,rob numeric,rob_location_a numeric,rob_location_b numeric,min numeric,
      location_a text,location_b text,deleted boolean,is_active boolean
    )`);
    await client.query(`CREATE TEMP TABLE master_user_vessels(user_uuid text,vessel_id text,is_active boolean)`);
    await client.query(`INSERT INTO master_user_vessels VALUES('ship-user','v1',true)`);
    // Public tenant tables are deliberately invisible. Any legacy selection SQL fails.
    await client.query(`SET search_path=pg_temp`);
    expect((await client.query(`SELECT to_regclass('stores_operation_targets') AS table_name`)).rows[0].table_name).toBeNull();
  });
  afterAll(async () => {
    if (client) { await client.query(`DROP TABLE IF EXISTS pg_temp.stores_items,pg_temp.master_user_vessels; RESET search_path`); client.release(); }
    await pool?.end();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(service.inactivateStoresItem).mockResolvedValue(undefined);
    vi.mocked(service.updateStoresItem).mockResolvedValue({} as any);
    await client.query(`TRUNCATE stores_items`);
    await client.query(`INSERT INTO stores_items
      SELECT id,vessel,item_type,id::text,name,'Engine',10,5,5,1,'Bay','Rack',deleted,active
      FROM (VALUES
        (1,'v1','stores','First',false,true),(2,'v1','stores','Second',false,true),
        (3,'v1','chemicals','Chemical one',false,true),(4,'v1','chemicals','Chemical two',false,true),
        (5,'v2','stores','Other vessel',false,true),(6,'v1','stores','Deleted',true,true),
        (7,'v1','lubes','Lube',false,true),(8,'v1','stores','Inactive',false,false)
      ) AS f(id,vessel,item_type,name,deleted,active)`);
  });
  async function call(handler: any, body: any, query: any = {}, vesselId = "v1", userType = "Office") {
    const response = { statusCode: 200, body: undefined as any, destroyed: false,
      status(code: number) { this.statusCode = code; return this; },
      json(value: any) { this.body = value; return this; } };
    await tenantStorage.run({ tuid: "stores-selection-test", db, pool }, () => handler({
      body, query: { itemType: "stores", ...query }, params: { vesselId },
      user: { userUuid: "ship-user" }, rbac: { userType }, aborted: false,
    }, response));
    return response;
  }
  const target = (id: number, vesselId = "v1") => ({ id, vesselId });
  const selection = (targets: any[], extra: any = {}) => ({ version: 2, targets, ...extra });

  it("captures identifiers only with no selection table, ignoring navigation and optional grid filters", async () => {
    const res = await call(controller.capture, { version: 2 }, {
      page: 99, pageSize: 1, filters: JSON.stringify({ itemName: { filterType: "text", type: "equals", filter: "First" } }),
    });
    expect(res.statusCode).toBe(200);
    expect(storeSelection.parse(res.body.data).targets.map(t => t.id)).toEqual([1, 2, 8]);
    expect(Object.keys(res.body.data.targets[0]).sort()).toEqual(["id", "vesselId"]);
    expect(res.body.data).not.toHaveProperty("token");
  });
  it("distinguishes explicit empty capture from Select All", async () => {
    const res = await call(controller.capture, { version: 2, ids: [] });
    expect(res.body.data.targets).toEqual([]); expect(res.body.data.total).toBe(0);
  });
  it("intersects explicit capture IDs with scope and deduplicates", async () => {
    const res = await call(controller.capture, { version: 2, ids: [1, 1, 3, 5, 999] });
    expect(res.body.data.targets).toEqual([target(1)]);
  });
  it("uses server assignments for Ship capture and rejects a foreign vessel", async () => {
    const res = await call(controller.capture, { version: 2 }, { vesselIds: "v1,v2" }, "all", "Ship");
    expect(res.body.data.targets).toEqual([target(1), target(2)]);
    expect((await call(controller.capture, { version: 2 }, {}, "v2", "Ship")).statusCode).toBe(403);
  });
  it("an empty My Vessels request matches nothing, never every vessel", async () => {
    const res = await call(controller.capture, { version: 2 }, { scope: "my", vesselIds: "" }, "all");
    expect(res.body.data.total).toBe(0);
  });
  it("allows Office all-vessel capture without widening requested narrowing", async () => {
    const res = await call(controller.capture, { version: 2 }, { vesselIds: "v2" }, "all");
    expect(res.body.data.targets).toEqual([target(5, "v2")]);
  });
  it("rejects old capture/write/membership contracts explicitly without table access", async () => {
    expect((await call(controller.capture, {})).statusCode).toBe(409);
    expect((await call(controller.inactivateTargets, { token: "old" })).statusCode).toBe(409);
    expect((await call(controller.updateChemicals, { applied: [{ token: "old" }] }, { itemType: "chemicals" })).statusCode).toBe(409);
    expect((await call(controller.targetMembership, { token: "old" })).statusCode).toBe(409);
    expect(service.inactivateStoresItem).not.toHaveBeenCalled();
  });
  it("deduplicates targets, applies exclusions and includes only eligible additional IDs", async () => {
    const res = await call(controller.inactivateTargets, selection([target(1), target(1), target(2)], { exclude: [2], additionalIds: [8, 8] }));
    expect(res.body.data).toEqual({ succeeded: 2, failedIds: [] });
    expect(service.inactivateStoresItem).toHaveBeenNthCalledWith(1, "1", "v1");
    expect(service.inactivateStoresItem).toHaveBeenNthCalledWith(2, "8", "v1");
  });
  it("does not include a matching record added after capture", async () => {
    const res = await call(controller.inactivateTargets, selection([target(1)]));
    expect(res.body.data.succeeded).toBe(1);
    expect(service.inactivateStoresItem).toHaveBeenCalledTimes(1);
  });
  it("intersects captured membership with current search and skips disappeared/deleted IDs", async () => {
    const res = await call(controller.inactivateTargets, selection([target(1), target(2), target(6), target(999)]), { search: "Second" });
    expect(res.body.data.succeeded).toBe(1);
    expect(service.inactivateStoresItem).toHaveBeenCalledWith("2", "v1");
  });
  it.each([
    [target(5, "v2")], [target(3)], [target(1, "v2")],
  ])("rejects foreign vessel, wrong type and forged association %j", async (bad) => {
    const res = await call(controller.inactivateTargets, selection([bad]));
    expect(res.statusCode).toBe(403); expect(service.inactivateStoresItem).not.toHaveBeenCalled();
  });
  it("revalidates permissions for previously captured all-vessel targets", async () => {
    const res = await call(controller.inactivateTargets, selection([target(5, "v2")]), {}, "all", "Ship");
    expect(res.statusCode).toBe(403);
  });
  it("rejects unauthorized additions and conflicting duplicate associations", async () => {
    expect((await call(controller.inactivateTargets, selection([], { additionalIds: [5] }))).statusCode).toBe(403);
    expect((await call(controller.inactivateTargets, selection([target(1), target(1, "v2")]))).statusCode).toBe(403);
  });
  it("missing targets fail validation and an empty selection is a no-op", async () => {
    expect((await call(controller.inactivateTargets, { version: 2 })).statusCode).toBe(400);
    expect((await call(controller.inactivateTargets, selection([]))).body.data.succeeded).toBe(0);
    expect(service.inactivateStoresItem).not.toHaveBeenCalled();
  });
  it("reports partial inactivation failures without losing successes", async () => {
    vi.mocked(service.inactivateStoresItem).mockRejectedValueOnce(new Error("fixture failure")).mockResolvedValue(undefined);
    const res = await call(controller.inactivateTargets, selection([target(1), target(2)]));
    expect(res.body.data).toEqual({ succeeded: 1, failedIds: [1] });
  });
  it("keeps field memberships independent, common patch order and individual overrides", async () => {
    const res = await call(controller.updateChemicals, {
      version: 2, applied: [
        { targets: [target(3)], values: { batchNumber: "batch" } },
        { targets: [target(4)], values: { sdsReference: "sds" } },
      ], overrides: [{ id: 3, data: { batchNumber: "override" } }],
    }, { itemType: "chemicals", search: "not matching", category: "not matching" });
    expect(res.body.data.succeeded).toBe(2);
    expect(service.updateStoresItem).toHaveBeenCalledWith("3", { batchNumber: "override" });
    expect(service.updateStoresItem).toHaveBeenCalledWith("4", { sdsReference: "sds" });
  });
  it("returns exact failed patches for failure-only retries, not unrelated common fields", async () => {
    vi.mocked(service.updateStoresItem).mockImplementation(async id => {
      if (id === "3") throw new Error("fixture failure");
      return {} as any;
    });
    const res = await call(controller.updateChemicals, { version: 2, applied: [
      { targets: [target(3)], values: { batchNumber: "batch" } },
      { targets: [target(4)], values: { sdsReference: "sds" } },
    ], overrides: [] }, { itemType: "chemicals" });
    expect(res.body.data).toEqual({ succeeded: 1, succeededIds: [4], failedIds: [3], failedPatches: [{ id: 3, data: { batchNumber: "batch" } }] });
    vi.mocked(service.updateStoresItem).mockClear().mockResolvedValue({} as any);
    const retry = await call(controller.updateChemicals, { version: 2, applied: [], overrides: res.body.data.failedPatches }, { itemType: "chemicals" });
    expect(retry.body.data.succeeded).toBe(1); expect(service.updateStoresItem).toHaveBeenCalledTimes(1);
  });
  it("rejects unauthorized chemical overrides and invalid patch fields before any write", async () => {
    for (const data of [{ id: 5, data: { batchNumber: "bad" } }, { id: 3, data: { rob: "bad" } }]) {
      expect((await call(controller.updateChemicals, { version: 2, applied: [], overrides: [data] }, { itemType: "chemicals" })).statusCode).toBeGreaterThanOrEqual(400);
    }
    expect(service.updateStoresItem).not.toHaveBeenCalled();
  });
  it("preserves quantity success-side and failure-side retry responses", async () => {
    vi.mocked(service.batchConsume).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Stock changed"));
    const res = await call(controller.bulkQuantities, { mode: "consume", items: [
      { itemId: 1, quantity: 1, location: "A" }, { itemId: 1, quantity: 2, location: "B" },
    ] });
    expect(res.body.data.succeeded).toEqual([{ itemId: 1, location: "A" }]);
    expect(res.body.data.failures[0]).toMatchObject({ itemId: 1, location: "B", error: "Stock changed" });
  });
  it("captures 25,000 IDs without parameter-limit failures or complete-record hydration", async () => {
    await client.query(`TRUNCATE stores_items`);
    await client.query(`INSERT INTO stores_items SELECT g,'v1','stores',g::text,'Large fixture','Engine',10,5,5,1,'Bay','Rack',false,true FROM generate_series(1,25000) g`);
    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    const res = await call(controller.capture, { version: 2 });
    const captureMs = performance.now() - started;
    const captured = storeSelection.parse(res.body.data);
    expect(captured.total).toBe(25000);
    expect(captured.targets.every(t => Object.keys(t).length === 2)).toBe(true);
    const writeBody = selection(captured.targets, { exclude: captured.targets.map(t => t.id) });
    expect((await call(controller.inactivateTargets, writeBody)).body.data.succeeded).toBe(0);
    await client.query(`UPDATE stores_items SET item_type='chemicals'`);
    const chemicalBody = { version: 2, applied: [
      { targets: captured.targets.slice(0, 12500), values: { batchNumber: "large-batch" } },
      { targets: captured.targets.slice(12500), values: { expiryDate: "2027-01-01" } },
      { targets: captured.targets.filter(t => t.id % 3 === 0), values: { sdsReference: "large-sds" } },
    ], overrides: [] };
    expect((await call(controller.updateChemicals, chemicalBody, { itemType: "chemicals" })).body.data.succeeded).toBe(25000);
    console.log(JSON.stringify({ fixture: 25000, captureMs: Math.round(captureMs),
      responseBytes: Buffer.byteLength(JSON.stringify(res.body)), requestBytes: Buffer.byteLength(JSON.stringify(writeBody)),
      chemicalRequestBytes: Buffer.byteLength(JSON.stringify(chemicalBody)),
      sampledHeapDeltaBytes: process.memoryUsage().heapUsed - heapBefore }));
  });
  it("exports complete inventory/history results independently of navigation and optional grid criteria", async () => {
    const { PassThrough } = await import("node:stream");
    const XLSX = await import("xlsx");
    await client.query(`CREATE TEMP TABLE stores_ledger(
      id int,item_id int,vessel_id text,section text,item_name text,part_code text,event_type text,
      date_local text,timestamp_utc timestamp,qty_change_base numeric,rob_after_base numeric,
      uom text,place text,user_id text,remarks text,ref text)`);
    try {
      await client.query(`INSERT INTO stores_ledger SELECT g,g,'v1','stores','Export row '||g,g::text,'RECEIVE',
        '2026-10-29','2026-10-29'::timestamp,1,g,'pcs','Bay','Fixture','','' FROM generate_series(1,1001) g`);
      for (const kind of ["inventory", "history"]) {
        const stream = new PassThrough();
        const chunks: Buffer[] = [];
        stream.on("data", chunk => chunks.push(chunk));
        const finished = new Promise<void>((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
        Object.assign(stream, { setHeader() {} });
        await tenantStorage.run({ tuid: "stores-selection-test", db, pool }, () => controller.exportFile({
          params: { vesselId: "v1" }, query: { itemType: "stores", kind, page: 9,
            filters: JSON.stringify({ itemName: { filterType: "text", type: "equals", filter: "not matching" } }) },
          user: { userUuid: "ship-user" }, rbac: { userType: "Office" },
        } as any, stream as any));
        await finished;
        const workbook = XLSX.read(Buffer.concat(chunks), { type: "buffer" });
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[workbook.SheetNames[0]]);
        if (kind === "inventory") {
          expect(rows.map(row => row["Part Code"])).toEqual(["1", "2", "8"]);
        } else {
          expect(rows.map(row => row["Part Code"])).toEqual(Array.from({ length: 1001 }, (_, i) => String(1001 - i)));
        }
      }
    } finally { await client.query(`DROP TABLE pg_temp.stores_ledger`); }
  });
  it("can retry every failed patch when a captured Chemical set exceeds 10,000 items", async () => {
    await client.query(`TRUNCATE stores_items`);
    await client.query(`INSERT INTO stores_items SELECT g,'v1','chemicals',g::text,'Retry fixture','Engine',10,5,5,1,'Bay','Rack',false,true FROM generate_series(1,10001) g`);
    const targets = Array.from({ length: 10001 }, (_, i) => target(i + 1));
    vi.mocked(service.updateStoresItem).mockRejectedValue(new Error("fixture failure"));
    const first = await call(controller.updateChemicals, { version: 2, applied: [{ targets, values: { batchNumber: "retry" } }], overrides: [] }, { itemType: "chemicals" });
    expect(first.body.data.failedPatches).toHaveLength(10001);
    const retry = storeChemicalBody.parse({ version: 2, applied: [], overrides: first.body.data.failedPatches });
    vi.mocked(service.updateStoresItem).mockClear().mockResolvedValue({} as any);
    expect((await call(controller.updateChemicals, retry, { itemType: "chemicals" })).body.data.succeeded).toBe(10001);
    expect(service.updateStoresItem).toHaveBeenCalledTimes(10001);
  });
  it("shared schemas reject malformed, count-mismatched and ambiguous payloads", () => {
    expect(storeSelection.safeParse({ version: 2, total: 2, targets: [target(1)] }).success).toBe(false);
    expect(storeInactivateBody.safeParse({ version: 2, token: "old", targets: [] }).success).toBe(false);
    expect(storeChemicalBody.safeParse({ version: 2, overrides: [] }).success).toBe(false);
    expect(storeInactivateBody.safeParse(selection([{ id: -1, vesselId: "v1" }])).success).toBe(false);
  });
  it("retires migration discovery without erasing historical installation entries", async () => {
    const fs = await import("node:fs/promises");
    await expect(fs.access("migrations/184_stores_operation_targets.sql")).rejects.toThrow();
    expect(await fs.readFile("shared/schema.ts", "utf8")).not.toContain('pgTable("stores_operation_targets"');
    await client.query(`CREATE TEMP TABLE schema_migrations(id text PRIMARY KEY,name text,description text,applied_at timestamp DEFAULT now())`);
    try {
      const { getPendingMigrations } = await import("../../../migrations");
      const scopedPool = { query: client.query.bind(client) } as unknown as typeof pool;
      const fresh = await getPendingMigrations(scopedPool);
      expect(fresh).not.toContain("184_stores_operation_targets");
      expect(fresh).toContain("185_certificate_natural_sort");
      expect(fresh).toContain("186_survey_default_sort");
      await client.query(`INSERT INTO schema_migrations(id,name) VALUES('184_stores_operation_targets','Historical installation')`);
      expect(await getPendingMigrations(scopedPool)).toEqual(fresh);
      expect((await client.query(`SELECT count(*)::int AS n FROM schema_migrations WHERE id='184_stores_operation_targets'`)).rows[0].n).toBe(1);
    } finally { await client.query(`DROP TABLE pg_temp.schema_migrations`); }
  }, 45000);
});
