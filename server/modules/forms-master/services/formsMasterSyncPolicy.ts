import { isFormsMasterTable } from "@shared/syncConfig";
import type { Pool } from "pg";

/** Explicit context for retaining only role tombstones referenced by this feature. */
export function formsMasterReferencedRoles(batches: { tableName: string; rows: Record<string, unknown>[] }[]): ReadonlySet<string> {
  const roles = new Set<string>();
  for (const batch of batches) {
    if (batch.tableName !== "pms_forms_master") continue;
    for (const row of batch.rows) {
      const id = row.approver_role_ruid ?? row.approverRoleRuid;
      if (typeof id === "string") roles.add(id);
    }
  }
  return roles;
}
export async function requireFormsMasterReceiverSchema(pool: Pool) {
  const result = await pool.query(`SELECT to_regclass('pms_form_groups') AS groups,
    to_regclass('pms_form_categories') AS categories, to_regclass('pms_forms_master') AS forms`);
  if (!result.rows[0]?.groups || !result.rows[0]?.categories || !result.rows[0]?.forms)
    throw new Error("Forms Master receiver requires migration 192 before delivery; nothing may be acknowledged as delivered.");
}

/**
 * Provisioning-only predicates. Tombstones retain allocations and deterministic
 * defaults. Historic role references must exist even after a role is retired.
 * All other tables retain the existing active-only export policy.
 */
export function formsMasterProvisioningWhere(tableName: string): string {
  if (isFormsMasterTable(tableName)) return "";
  if (tableName === "admn_role_master")
    return `WHERE COALESCE(is_deleted, false) = false OR ruid IN
      (SELECT approver_role_ruid FROM pms_forms_master WHERE approver_role_ruid IS NOT NULL)`;
  return "WHERE COALESCE(is_deleted, false) = false";
}
