/**
 * Phase 6 — WK promotion gate + tenant registration (adoption, not creation).
 *
 * Promotes the existing single-tenant DB to tenant #1 by writing ONE `tenants` row
 * (database_name = the existing DB name). The write happens ONLY if all three gate
 * checks pass; data integrity is verified BEFORE and AFTER. Idempotent.
 *
 *   DATABASE_URL        = the WK DB being adopted (gate runs against it)
 *   MASTER_DATABASE_URL = the master registry (the tenants row is written here)
 *
 * Usage:
 *   DATABASE_URL=... MASTER_DATABASE_URL=... \
 *     npx tsx scripts/promote-to-tenant.ts --domain <wk-domain> --tuid <wk-tuid>
 *
 * Precondition: run scripts/data-baseline-snapshot.ts first (verify-data-integrity
 * needs docs/data-snapshot-BASELINE.json).
 */
import { Pool } from "pg";
import { execSync } from "child_process";
import { getPendingMigrations } from "../server/migrations";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : undefined;
}
const abort = (m: string): never => { console.error(`\n❌ ABORT — ${m}`); process.exit(1); };

/** Run verify-data-integrity.ts against `dbUrl`; true iff it exits 0 + reports ALL INTACT. */
function integrityOk(dbUrl: string): boolean {
  try {
    const out = execSync("npx tsx scripts/verify-data-integrity.ts", {
      env: { ...process.env, DATABASE_URL: dbUrl },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return /ALL DATA INTACT/.test(out);
  } catch (e: any) {
    if (e?.stdout) console.error(String(e.stdout).trim().split("\n").slice(-4).join("\n"));
    return false;
  }
}

async function main() {
  const domain = arg("domain"), tuid = arg("tuid");
  if (!domain || !tuid) abort("usage: --domain <wk-domain> --tuid <wk-tuid>");
  const DB = process.env.DATABASE_URL, MASTER = process.env.MASTER_DATABASE_URL;
  if (!DB) abort("DATABASE_URL required (the WK DB to adopt)");
  if (!MASTER) abort("MASTER_DATABASE_URL required (the master registry)");

  const wk = new Pool({ connectionString: DB });
  const dbName = (await wk.query("SELECT current_database() AS d")).rows[0].d;
  console.log("═══════════ WK PROMOTION GATE ═══════════");
  console.log(`Adopting DB '${dbName}' as tenant — domain='${domain}', tuid='${tuid}'\n`);

  let gateOk = true;
  const check = (pass: boolean, label: string) => { console.log(`${pass ? "✅" : "❌"} ${label}`); if (!pass) gateOk = false; };

  // (a) the one-time defect-ID rewrite must not be pending to fire
  const def = (await wk.query(`SELECT count(*)::int AS c FROM defects WHERE id LIKE 'DEF-%'`)).rows[0].c;
  check(def === 0, `(a) defects with id LIKE 'DEF-%' = ${def} (must be 0)`);

  // (b) zero pending migrations (read-only dry-run)
  const pending = await getPendingMigrations(wk);
  check(pending.length === 0, `(b) pending migrations = ${pending.length}${pending.length ? ` [${pending.join(", ")}]` : ""} (must be 0)`);

  // (c) data integrity BEFORE
  check(integrityOk(DB), `(c) data integrity BEFORE = checked`);

  if (!gateOk) { await wk.end(); abort("gate failed — NO write performed"); }
  console.log("\n✅ GATE PASSED — registering tenant…\n");

  // Register ONE tenants row (idempotent). database_name = the existing DB (adoption).
  const master = new Pool({ connectionString: MASTER });
  const res = await master.query(
    `INSERT INTO tenants (domain, tuid, database_name) VALUES ($1,$2,$3)
       ON CONFLICT (domain) DO NOTHING RETURNING id`,
    [domain, tuid, dbName],
  );
  console.log(res.rowCount ? `✅ Registered tenants row (id=${res.rows[0].id})` : `✅ tenants row already present — idempotent no-op`);
  await master.end();

  // Integrity AFTER the write (the registration touched only the master DB; the WK DB must be untouched).
  const afterOk = integrityOk(DB);
  console.log(`${afterOk ? "✅" : "❌"} data integrity AFTER write = checked`);
  await wk.end();
  if (!afterOk) abort("CRITICAL — data integrity regressed after the registration write. Investigate.");

  console.log("\n✅ PROMOTE COMPLETE — DB adopted as tenant. Flip MASTER_DATABASE_URL env-by-env to enable.");
  process.exit(0);
}
main().catch((e) => { console.error("promote error:", e?.message || e); process.exit(1); });
