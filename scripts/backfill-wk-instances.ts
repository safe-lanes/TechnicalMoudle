/**
 * Phase 6 — backfill the 3 existing WK ships into the master tenant_instances map
 * (shore-side; NO ship access needed). For each ship: writes instance_id -> { domain,
 * vessel_id, sync_api_key } and PRINTS the per-tenant key for the operator to apply
 * ship-side later via PUT /sync/settings {settings:{sync_api_key}}.
 *
 * The exact instance-ID strings are REQUIRED input and echoed back for confirmation —
 * a single-character mismatch fails closed at the guard (by design). Idempotent: the
 * key is REUSED if already set (re-run never rotates a live key).
 *
 *   MASTER_DATABASE_URL = the master registry (rows written here)
 *
 * Usage (repeat --ship once per ship; vesselId after '::'):
 *   MASTER_DATABASE_URL=... npx tsx scripts/backfill-wk-instances.ts \
 *     --domain <wk-domain> \
 *     --ship "SHIP-Pioneer Venture::<vuuid>" \
 *     --ship "SHIP-Frontier Venture::<vuuid>" \
 *     --ship "SHIP-Gas Mia::<vuuid>"
 */
import { Pool } from "pg";
import * as crypto from "crypto";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  return out;
}
const abort = (m: string): never => { console.error(`\n❌ ABORT — ${m}`); process.exit(1); };

async function main() {
  const domain = arg("domain");
  const shipSpecs = args("ship");
  if (!domain) abort("usage: --domain <wk-domain> --ship \"<instanceId>::<vesselId>\" (repeat per ship)");
  if (shipSpecs.length === 0) abort("at least one --ship \"<instanceId>::<vesselId>\" required");
  const MASTER = process.env.MASTER_DATABASE_URL;
  if (!MASTER) abort("MASTER_DATABASE_URL required (the master registry)");

  const ships = shipSpecs.map((s) => {
    const idx = s.indexOf("::");
    if (idx < 0) abort(`--ship must be "<instanceId>::<vesselId>" — got: ${s}`);
    return { instanceId: s.slice(0, idx).trim(), vesselId: s.slice(idx + 2).trim() };
  });

  // Echo back for confirmation — one char off here fails closed at the guard.
  console.log("═══════════ WK INSTANCE BACKFILL ═══════════");
  console.log(`domain = '${domain}'`);
  console.log("Ships to register (CONFIRM these EXACT instance IDs match sync_settings.instance_id on each ship):");
  ships.forEach((s) => console.log(`   instance_id='${s.instanceId}'  vessel_id='${s.vesselId}'`));
  console.log("");

  const master = new Pool({ connectionString: MASTER });
  const printed: Array<{ instanceId: string; key: string; reused: boolean }> = [];
  for (const s of ships) {
    // Reuse an existing key (idempotent — never rotate a live ship's key); else mint one.
    const existing = await master.query(`SELECT sync_api_key FROM tenant_instances WHERE instance_id = $1`, [s.instanceId]);
    const reused = !!existing.rows[0]?.sync_api_key;
    const key = reused ? existing.rows[0].sync_api_key : crypto.randomBytes(32).toString("hex");
    await master.query(
      `INSERT INTO tenant_instances (instance_id, vessel_id, domain, sync_api_key)
         VALUES ($1,$2,$3,$4)
       ON CONFLICT (instance_id) DO UPDATE
         SET vessel_id = EXCLUDED.vessel_id, domain = EXCLUDED.domain,
             sync_api_key = EXCLUDED.sync_api_key, updated_at = NOW()`,
      [s.instanceId, s.vesselId, domain, key],
    );
    printed.push({ instanceId: s.instanceId, key, reused });
  }
  await master.end();

  console.log("✅ tenant_instances rows written (idempotent ON CONFLICT DO UPDATE).\n");
  console.log("Per-tenant sync keys — apply each ship-side later via PUT /sync/settings {settings:{sync_api_key}}:");
  console.log("─".repeat(72));
  for (const p of printed) console.log(`  ${p.instanceId}\n      sync_api_key: ${p.key}${p.reused ? "   (reused existing — not rotated)" : "   (newly generated)"}`);
  console.log("─".repeat(72));
  console.log("Until each ship's key is applied, keep SYNC_LEGACY_KEY_TOLERANCE=true (ships sync on the legacy key).");
  process.exit(0);
}
main().catch((e) => { console.error("backfill error:", e?.message || e); process.exit(1); });
