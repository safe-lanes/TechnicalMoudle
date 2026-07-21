/**
 * View-mode repository — DB access for view_modes_master + role_view_mode_mapping
 * (Task #324, configurable role→view-mode mapping).
 *
 * IMPORTANT: admn_role_master.ruid is a UUID column in the live DB (schema.ts
 * types it as text), while role_view_mode_mapping.role_ruid is TEXT. Any join
 * between them MUST cast `ruid::text` — a bare equality raises
 * "operator does not exist: text = uuid".
 */
import { eq, and, asc, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import {
  viewModesMaster,
  roleViewModeMapping,
  admnRoleMaster,
  type ViewModesMaster,
  type RoleViewModeMapping,
} from '@shared/schema';

export async function getActiveViewModes(): Promise<ViewModesMaster[]> {
  const db = await getDb();
  return db
    .select()
    .from(viewModesMaster)
    .where(and(eq(viewModesMaster.isDeleted, false), eq(viewModesMaster.isActive, true)))
    .orderBy(asc(viewModesMaster.sortOrder), asc(viewModesMaster.code));
}

export interface RoleWithMapping {
  roleRuid: string;
  roleName: string;
  roletype: string;
  viewModeCode: string | null;
}

/** All active roles LEFT JOINed to their live (non-deleted) mapping. */
export async function getRolesWithMappings(): Promise<RoleWithMapping[]> {
  const db = await getDb();
  const rows = await db
    .select({
      roleRuid: sql<string>`${admnRoleMaster.ruid}::text`,
      roleName: admnRoleMaster.assignedRole,
      roletype: admnRoleMaster.roletype,
      viewModeCode: roleViewModeMapping.viewModeCode,
    })
    .from(admnRoleMaster)
    .leftJoin(
      roleViewModeMapping,
      and(
        sql`${roleViewModeMapping.roleRuid} = ${admnRoleMaster.ruid}::text`,
        eq(roleViewModeMapping.isDeleted, false),
      ),
    )
    .where(and(eq(admnRoleMaster.isActive, true), eq(admnRoleMaster.isDeleted, false)))
    .orderBy(asc(admnRoleMaster.roletype), asc(admnRoleMaster.assignedRole));
  return rows;
}

export interface RoleRow {
  ruid: string;
  assignedRole: string;
  roletype: string;
}

export async function getActiveRoleByTypeAndName(
  roletype: string,
  assignedRole: string,
): Promise<RoleRow | undefined> {
  const db = await getDb();
  const rows = await db
    .select({
      ruid: sql<string>`${admnRoleMaster.ruid}::text`,
      assignedRole: admnRoleMaster.assignedRole,
      roletype: admnRoleMaster.roletype,
    })
    .from(admnRoleMaster)
    .where(
      and(
        eq(admnRoleMaster.roletype, roletype),
        eq(admnRoleMaster.assignedRole, assignedRole),
        eq(admnRoleMaster.isActive, true),
        eq(admnRoleMaster.isDeleted, false),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function getActiveRoleByRuid(roleRuid: string): Promise<RoleRow | undefined> {
  const db = await getDb();
  const rows = await db
    .select({
      ruid: sql<string>`${admnRoleMaster.ruid}::text`,
      assignedRole: admnRoleMaster.assignedRole,
      roletype: admnRoleMaster.roletype,
    })
    .from(admnRoleMaster)
    .where(
      and(
        sql`${admnRoleMaster.ruid}::text = ${roleRuid}`,
        eq(admnRoleMaster.isActive, true),
        eq(admnRoleMaster.isDeleted, false),
      ),
    )
    .limit(1);
  return rows[0];
}

/** Live (non-deleted) mapping for a role, if any. */
export async function getMappingByRoleRuid(
  roleRuid: string,
): Promise<RoleViewModeMapping | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(roleViewModeMapping)
    .where(
      and(eq(roleViewModeMapping.roleRuid, roleRuid), eq(roleViewModeMapping.isDeleted, false)),
    )
    .limit(1);
  return rows[0];
}

/**
 * Map (or remap) a role. Revive-upsert: ON CONFLICT (role_ruid) clears any
 * soft-deleted row back to life. updatedAt is set EXPLICITLY — the
 * updatedAtColumn() $onUpdateFn hook does NOT fire inside onConflictDoUpdate
 * set-clauses, and a stale updated_at would drop the change from the sync delta.
 */
export async function upsertMapping(
  roleRuid: string,
  viewModeCode: string,
  updatedByUuid: string | null,
): Promise<void> {
  const db = await getDb();
  await db
    .insert(roleViewModeMapping)
    .values({ roleRuid, viewModeCode, createdByUuid: updatedByUuid, updatedByUuid })
    .onConflictDoUpdate({
      target: roleViewModeMapping.roleRuid,
      set: {
        viewModeCode,
        isDeleted: false,
        updatedByUuid,
        updatedAt: new Date(),
      },
    });
}

/**
 * Unmap a role = SOFT delete (is_deleted=true). A hard DELETE would never enter
 * the updated_at>checkpoint sync delta, so ships would keep the mapping forever.
 */
export async function softDeleteMapping(
  roleRuid: string,
  updatedByUuid: string | null,
): Promise<void> {
  const db = await getDb();
  await db
    .update(roleViewModeMapping)
    .set({ isDeleted: true, updatedByUuid, updatedAt: new Date() })
    .where(eq(roleViewModeMapping.roleRuid, roleRuid));
}
