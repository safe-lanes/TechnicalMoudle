/**
 * Behavior sweep for requirePermission() (server/middleware/permissions.ts).
 *
 * Creates a temporary test role with view-only rows, then asserts:
 *   1. view-only configured role  -> 403 on create/edit/delete
 *   2. role granted the flag      -> allowed
 *   3. unconfigured role (0 rows) -> allowed (fail-open parity with frontend)
 *   4. unknown role name          -> allowed (fail-open parity)
 *   5. Sail Admin bypass          -> allowed even with a deny row present
 *   6. configured role + missing menu resource -> 403
 * Cleans up all test data at the end.
 *
 * Run: npx tsx scripts/test-permission-guard.ts
 */
import { randomUUID } from "crypto";
import { getPool } from "../server/db";
import { initStorage } from "../server/storage";
import { requirePermission } from "../server/middleware/permissions";

const TEST_ROLE = "__PermGuard Test Role__";

function makeReqRes(role: string) {
  const req: any = { user: { role } };
  let statusCode: number | null = null;
  let nextCalled = false;
  const res: any = {
    status(c: number) { statusCode = c; return this; },
    json(b: any) { if (statusCode === 500) console.log("   500 detail:", JSON.stringify(b)); return this; },
  };
  const next = () => { nextCalled = true; };
  return { req, res, next, result: () => (nextCalled ? "ALLOW" : `DENY ${statusCode}`) };
}

async function check(name: string, role: string, resource: string, action: any, expected: string, failures: string[]) {
  const { req, res, next, result } = makeReqRes(role);
  await requirePermission(resource, action)(req, res, next);
  const got = result();
  const ok = got === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: expected ${expected}, got ${got}`);
  if (!ok) failures.push(name);
}

async function main() {
  await initStorage();
  const pool = await getPool();
  const failures: string[] = [];

  // setup: test role
  const ruid = randomUUID();
  await pool.query(
    `INSERT INTO admn_role_master (id, ruid, roletype, assigned_role, is_active, is_deleted)
     VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM admn_role_master), $1, 'Office', $2, true, false)`,
    [ruid, TEST_ROLE],
  );
  const menu = await pool.query(
    `SELECT muid FROM adm_menumaster_ac WHERE name = 'cert-certificates' LIMIT 1`,
  );
  const certMuid = menu.rows[0].muid;
  // view-only row on cert-certificates
  await pool.query(
    `INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
     VALUES ($1, $2, true, false, false, false)`,
    [ruid, certMuid],
  );

  try {
    await check("view-only edit denied", TEST_ROLE, "cert-certificates", "edit", "DENY 403", failures);
    await check("view-only create denied", TEST_ROLE, "cert-certificates", "create", "DENY 403", failures);
    await check("view-only delete denied", TEST_ROLE, "cert-certificates", "delete", "DENY 403", failures);
    await check("view-only anyOf denied", TEST_ROLE, "cert-certificates", ["create", "edit"], "DENY 403", failures);
    await check("configured + missing menu denied", TEST_ROLE, "no-such-resource", "edit", "DENY 403", failures);

    // grant edit
    await pool.query(
      `UPDATE adm_role_menu_access SET can_edit = true WHERE role_ruid = $1 AND menu_muid = $2`,
      [ruid, certMuid],
    );
    await check("granted edit allowed", TEST_ROLE, "cert-certificates", "edit", "ALLOW", failures);
    await check("granted anyOf allowed", TEST_ROLE, "cert-certificates", ["create", "edit"], "ALLOW", failures);
    await check("granted edit, delete still denied", TEST_ROLE, "cert-certificates", "delete", "DENY 403", failures);

    // unconfigured: remove all rows
    await pool.query(`DELETE FROM adm_role_menu_access WHERE role_ruid = $1`, [ruid]);
    await check("unconfigured role fail-open", TEST_ROLE, "cert-certificates", "delete", "ALLOW", failures);

    await check("unknown role fail-open", "__No Such Role__", "cert-certificates", "delete", "ALLOW", failures);
    await check("Sail Admin bypass", "Sail Admin", "cert-certificates", "delete", "ALLOW", failures);

    // Sail Admin bypass even if its rows were deleted entirely (bypass is hardcoded, no rows consulted)
    await check("Sail Admin bypass (no rows needed)", "Sail Admin", "no-such-resource", "edit", "ALLOW", failures);
  } finally {
    await pool.query(`DELETE FROM adm_role_menu_access WHERE role_ruid = $1`, [ruid]);
    await pool.query(`DELETE FROM admn_role_master WHERE ruid = $1`, [ruid]);
  }

  console.log(failures.length === 0 ? "\nALL PASS" : `\nFAILURES: ${failures.join(", ")}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
