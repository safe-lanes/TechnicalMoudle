/**
 * Shipskart role-mapping repository — DB access for shipskart_role_mappings.
 *
 * Per-tenant by construction: getDb() is ALS-aware, so under multi-tenant the browser
 * request's tenant context (tenantMiddleware) routes reads/writes to that tenant's DB —
 * WK and Promeconav hold independent mappings with zero extra plumbing.
 *
 * This table will also serve the future Shipskart user-registration push (role assignment
 * at user creation); the SHIPSKART_USER_* env account layer is the temporary bridge until
 * per-user Shipskart accounts exist.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { shipskartRoleMappings, type ShipskartRoleMapping } from '@shared/schema';

export async function getAllMappings(): Promise<ShipskartRoleMapping[]> {
  const db = await getDb();
  return db.select().from(shipskartRoleMappings).orderBy(shipskartRoleMappings.sailRole);
}

export async function getMappingForSailRole(sailRole: string): Promise<ShipskartRoleMapping | undefined> {
  const db = await getDb();
  const rows = await db.select().from(shipskartRoleMappings)
    .where(eq(shipskartRoleMappings.sailRole, sailRole)).limit(1);
  return rows[0];
}

/** Upsert one mapping (UNIQUE sail_role → many-to-one is natural). */
export async function upsertMapping(sailRole: string, shipskartRole: string, updatedByUuid?: string | null): Promise<void> {
  const db = await getDb();
  await db.insert(shipskartRoleMappings)
    .values({ sailRole, shipskartRole, updatedByUuid: updatedByUuid ?? null })
    .onConflictDoUpdate({
      target: shipskartRoleMappings.sailRole,
      set: { shipskartRole, updatedByUuid: updatedByUuid ?? null, updatedAt: new Date() },
    });
}

/** Remove a mapping (the SAIL role becomes unmapped → SSO blocked with ROLE_NOT_MAPPED). */
export async function deleteMapping(sailRole: string): Promise<void> {
  const db = await getDb();
  await db.delete(shipskartRoleMappings).where(eq(shipskartRoleMappings.sailRole, sailRole));
}
