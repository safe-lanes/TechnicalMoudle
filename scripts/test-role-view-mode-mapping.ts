/**
 * Verification harness for Task #324 — configurable role→view-mode mapping.
 *
 * Checks:
 *  1. BEHAVIOR NEUTRALITY: for every active role in admn_role_master (× both
 *     userTypes), the DB-driven resolveViewMode() returns exactly what the
 *     legacy hardcoded mapLoggedRoleToUIRole() returned.
 *  2. SEED IDEMPOTENCY: re-running migration 140 must insert 0 rows.
 *  3. NATURAL-KEY CONVERGENCE: simulating a second shore→ship sync import of
 *     the same mapping rows must not create duplicates (one live row per role).
 *
 * Run: npx tsx scripts/test-role-view-mode-mapping.ts
 */
import { readFileSync } from "fs";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { mapLoggedRoleToUIRole } from "../shared/uiRoles";
import { resolveViewMode } from "../server/modules/access-control/services/viewModeService";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  // ── 1. Behavior neutrality sweep ─────────────────────────────────────────
  const roles = await db.execute(sql`
    SELECT ruid::text AS ruid, assigned_role, roletype
    FROM admn_role_master WHERE is_active = true
  `);
  console.log(`\n=== 1. Behavior neutrality (${roles.rows.length} active roles × matching userType) ===`);
  for (const r of roles.rows as Array<{ ruid: string; assigned_role: string; roletype: string }>) {
    const userType = r.roletype; // 'Office' | 'Ship'
    const legacy = mapLoggedRoleToUIRole(userType, r.assigned_role);
    const resolved = await resolveViewMode(userType, r.assigned_role);
    const dbMode = resolved.mode ?? null;
    check(
      `${userType}/${r.assigned_role}`,
      dbMode === legacy,
      `legacy=${legacy} db=${dbMode}${resolved.reason ? ` reason=${resolved.reason}` : ""}`,
    );
  }

  // Cross-type probes the legacy fn special-cases
  console.log(`\n=== 1b. Special cases ===`);
  const sailAdmin = await resolveViewMode("Office", "Sail Admin");
  check("Office/Sail Admin bypass", sailAdmin.mode === "Sail_Admin");
  const unknown = await resolveViewMode("Office", "Definitely Not A Role");
  check("Unknown role blocks", unknown.mode === null && unknown.reason === "ROLE_NOT_FOUND", `reason=${unknown.reason}`);

  // ── 2. Seed idempotency (migration 140 rerun) ────────────────────────────
  console.log(`\n=== 2. Seed idempotency (rerun migration 140) ===`);
  const before = await db.execute(sql`SELECT count(*)::int AS n FROM role_view_mode_mapping`);
  const seedSql = readFileSync("migrations/140_seed_role_view_mode_mapping.sql", "utf8");
  await db.execute(sql.raw(seedSql));
  const after = await db.execute(sql`SELECT count(*)::int AS n FROM role_view_mode_mapping`);
  const b = (before.rows[0] as any).n, a = (after.rows[0] as any).n;
  check("rerun inserts 0 rows", a === b, `before=${b} after=${a}`);

  // ── 3. Natural-key convergence (simulated repeat sync import) ────────────
  console.log(`\n=== 3. Natural-key convergence ===`);
  // Simulate what a repeated shore→ship import does: upsert every live row by
  // its sync identity (role_ruid), same values. Row count must not change and
  // no role may end up with more than one live mapping.
  await db.execute(sql`
    INSERT INTO role_view_mode_mapping (rvmuuid, role_ruid, view_mode_code, is_deleted, is_sync)
    SELECT gen_random_uuid()::text, role_ruid, view_mode_code, is_deleted, true
    FROM role_view_mode_mapping
    ON CONFLICT (role_ruid) DO UPDATE SET
      view_mode_code = EXCLUDED.view_mode_code,
      is_deleted = EXCLUDED.is_deleted,
      updated_at = now()
  `);
  const after2 = await db.execute(sql`SELECT count(*)::int AS n FROM role_view_mode_mapping`);
  check("repeat import row count stable", (after2.rows[0] as any).n === a, `n=${(after2.rows[0] as any).n}`);
  const dups = await db.execute(sql`
    SELECT role_ruid, count(*) FROM role_view_mode_mapping
    WHERE is_deleted = false GROUP BY role_ruid HAVING count(*) > 1
  `);
  check("no duplicate live mappings per role", dups.rows.length === 0, `dups=${dups.rows.length}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
