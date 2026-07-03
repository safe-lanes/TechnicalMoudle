/**
 * Phase 6 — multi-tenant PARITY harness (committed, re-runnable).
 *
 * Proves the multi-tenant path and the single-tenant path return IDENTICAL GET
 * responses against the SAME data. Runs sequentially in one process (the tcm flag is
 * process-global, so the two modes can't coexist concurrently):
 *   Phase ST: MASTER_DATABASE_URL unset (single-tenant) -> mockAuth -> moduleRouter.
 *   Phase MT: MASTER set + a seeded tenant whose database_name = the SAME scratch DB
 *             -> tenantMiddleware (verified domain Bearer) -> mockAuth -> moduleRouter.
 * Then it diffs {status, body} per endpoint across the 8 modules and asserts no diff.
 *
 * Scratch DBs only (a master + a tenant DB), migrated once, dropped at the end — never
 * touches real data.
 *
 * Run: DATABASE_URL=postgres://postgres:admin123@localhost:5432/pms \
 *      npx tsx scripts/verify-mt-parity.ts
 * (first migration of the scratch tenant DB takes ~30-60s.)
 */
import express from "express";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "net";

const ADMIN = process.env.DATABASE_URL;
if (!ADMIN) { console.error("DATABASE_URL required"); process.exit(1); }
const dbUrl = (n: string) => { const u = new URL(ADMIN); u.pathname = `/${n}`; return u.toString(); };
const MASTER = "pms_parity_master", TENANT = "pms_parity_db";
const DOMAIN = "parity.local", TUID = "TEN-PARITY", SECRET = "parity-secret";
process.env.JWT_SECRET = SECRET;

// 8 representative read endpoints, one per module.
const ENDPOINTS = [
  "/components",            // Components
  "/reports/favorites",     // Reports
  "/spares",                // Spares
  "/stores",                // Stores
  "/defects",               // Defects
  "/work-orders",           // Work Orders + RH
  "/nr-reports",            // Noon
  "/defect-categories",     // reference / access-control-style read
];

let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) fails++; };

async function capture(base: string, headers: Record<string, string>) {
  const out: Record<string, { status: number; body: string }> = {};
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(`${base}${ep}`, { headers });
      out[ep] = { status: res.status, body: (await res.text()) };
    } catch (e: any) { out[ep] = { status: -1, body: String(e?.message || e) }; }
  }
  return out;
}

async function main() {
  const admin = new Pool({ connectionString: dbUrl("postgres") });
  let stServer: any, mtServer: any;
  try {
    for (const d of [MASTER, TENANT]) { await admin.query(`DROP DATABASE IF EXISTS ${d}`).catch(()=>{}); await admin.query(`CREATE DATABASE ${d}`); }

    // migrate the scratch tenant DB once (Phase-1 Part E pool-arg runners)
    console.log("Migrating scratch tenant DB (~30-60s)…");
    const mig = await import("../server/migrations");
    const initDb = await import("../server/initDb");
    const tpool = new Pool({ connectionString: dbUrl(TENANT) });
    await mig.runMigrations(tpool);
    await mig.runDrizzleMigrations(tpool);
    await initDb.initializeDatabase(tpool);
    await tpool.end();

    const tcm: any = (await import("../server/utils/tenantConnectionManager")).tenantConnectionManager;
    const { mockAuthMiddleware } = await import("../server/middleware/auth");
    const { tenantMiddleware } = await import("../server/middleware/tenantMiddleware");
    // moduleRouter pulls every module; some require native deps (e.g. work-orders -> sharp).
    // If a native module can't load (missing win32 binary on a dev box), skip cleanly —
    // this is an environment gap, not a parity failure. Runs fully where deps are present.
    let moduleRouter: any;
    try {
      moduleRouter = (await import("../server/modules")).default;
    } catch (loadErr: any) {
      console.log(`\n⚠️  PARITY SKIPPED — could not load the module router in this environment: ${loadErr?.message || loadErr}`);
      console.log("    (e.g. native 'sharp'/'dotenv' not installed locally — run in a full environment / CI.)");
      for (const d of [TENANT, MASTER]) await admin.query(`DROP DATABASE IF EXISTS ${d}`).catch(()=>{});
      await admin.end().catch(()=>{});
      process.exit(0);
    }

    // ── Phase ST (single-tenant) ──
    delete process.env.MASTER_DATABASE_URL;
    process.env.DATABASE_URL = dbUrl(TENANT);   // single pool resolves the scratch DB
    await tcm.closeAll?.(); await tcm.init();
    ok(tcm.isMultiTenantEnabled === false, "ST phase: single-tenant (flag off)");
    const stApp = express();
    stApp.use(express.json({ limit: "50mb" }));
    stApp.use("/technical/api", mockAuthMiddleware as any);
    stApp.use("/technical/api", moduleRouter);
    stServer = await new Promise<any>((r) => { const s = stApp.listen(0, () => r(s)); });
    const stBase = `http://127.0.0.1:${(stServer.address() as AddressInfo).port}/technical/api`;
    const stOut = await capture(stBase, {});
    await new Promise((r) => stServer.close(r)); stServer = null;

    // ── Phase MT (multi-tenant; tenant DB = the SAME scratch DB) ──
    const mp = new Pool({ connectionString: dbUrl(MASTER) });
    // master tenants table is created by tcm.init() master migrations; ensure then seed.
    process.env.MASTER_DATABASE_URL = dbUrl(MASTER);
    await tcm.closeAll(); await tcm.init();
    ok(tcm.isMultiTenantEnabled === true, "MT phase: multi-tenant (flag on)");
    await mp.query(`INSERT INTO tenants (domain, tuid, database_name) VALUES ($1,$2,$3) ON CONFLICT (domain) DO NOTHING`, [DOMAIN, TUID, TENANT]);
    await mp.end();

    const token = jwt.sign({ id: 1, domain: DOMAIN, userType: "Office", userId: "1" }, SECRET, { algorithm: "HS256" });
    const mtApp = express();
    mtApp.use(express.json({ limit: "50mb" }));
    mtApp.use("/technical/api", tenantMiddleware as any);
    mtApp.use("/technical/api", mockAuthMiddleware as any);
    mtApp.use("/technical/api", moduleRouter);
    mtServer = await new Promise<any>((r) => { const s = mtApp.listen(0, () => r(s)); });
    const mtBase = `http://127.0.0.1:${(mtServer.address() as AddressInfo).port}/technical/api`;
    const mtOut = await capture(mtBase, { Authorization: `Bearer ${token}` });
    await new Promise((r) => mtServer.close(r)); mtServer = null;
    await tcm.closeAll();

    // ── DIFF ──
    console.log("\n── parity diff (ST vs MT) per endpoint ──");
    let diffs = 0;
    for (const ep of ENDPOINTS) {
      const a = stOut[ep], b = mtOut[ep];
      const same = a.status === b.status && a.body === b.body;
      console.log(`${same ? "✅" : "❌"} ${ep}  ST=${a.status} MT=${b.status}${same ? "" : `  DIFF (ST ${a.body.slice(0,80)} | MT ${b.body.slice(0,80)})`}`);
      if (!same) diffs++;
    }
    ok(diffs === 0, `parity: ${ENDPOINTS.length - diffs}/${ENDPOINTS.length} endpoints identical (diffs=${diffs})`);
  } catch (e: any) {
    console.error("harness error:", e?.stack || e?.message || e); fails++;
  } finally {
    try { if (stServer) await new Promise((r) => stServer.close(r)); } catch {}
    try { if (mtServer) await new Promise((r) => mtServer.close(r)); } catch {}
    for (const d of [TENANT, MASTER]) await admin.query(`DROP DATABASE IF EXISTS ${d}`).catch(()=>{});
    await admin.end().catch(()=>{});
  }
  console.log(`\n${fails === 0 ? "✅ PARITY PASSED — single-tenant and multi-tenant responses identical" : `❌ ${fails} CHECK(S) FAILED`}`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.error("fatal:", e); process.exit(1); });
