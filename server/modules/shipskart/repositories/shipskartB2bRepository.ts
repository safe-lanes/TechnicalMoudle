/**
 * Shipskart b2b repository — DB access for the migration-149 tables:
 * shipskart_tenant_config (rotating token pair + flags), shipskart_user_links,
 * shipskart_vessel_links, master_user_vessels.
 *
 * All four are SHORE-ONLY / NO_SYNC (see shared/syncConfig.ts). getDb() is ALS-aware,
 * so multi-tenant routing works with zero extra plumbing (same as the role mappings).
 */
import { and, eq, notInArray } from 'drizzle-orm';
import { getDb } from '../../../db';
import {
  shipskartTenantConfig, type ShipskartTenantConfig,
  shipskartUserLinks, type ShipskartUserLink,
  shipskartVesselLinks, type ShipskartVesselLink,
  masterUserVessels, type MasterUserVessel,
} from '@shared/schema';

// ── tenant config / token state ──

export async function getTenantConfig(tenantId: string): Promise<ShipskartTenantConfig | undefined> {
  const db = await getDb();
  const rows = await db.select().from(shipskartTenantConfig)
    .where(eq(shipskartTenantConfig.tenantId, tenantId)).limit(1);
  return rows[0];
}

export async function upsertTokenState(tenantId: string, state: {
  accessToken: string; refreshToken: string;
  accessExpiresAt: Date | null; refreshExpiresAt: Date | null;
  isBootstrap?: boolean;
}): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db.insert(shipskartTenantConfig)
    .values({
      tenantId,
      enabled: true,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      accessExpiresAt: state.accessExpiresAt,
      refreshExpiresAt: state.refreshExpiresAt,
      lastBootstrapAt: state.isBootstrap ? now : null,
    })
    .onConflictDoUpdate({
      target: shipskartTenantConfig.tenantId,
      set: {
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        accessExpiresAt: state.accessExpiresAt,
        refreshExpiresAt: state.refreshExpiresAt,
        ...(state.isBootstrap ? { lastBootstrapAt: now } : {}),
        updatedAt: now,
      },
    });
}

// ── user links ──

export async function getUserLink(userUuid: string): Promise<ShipskartUserLink | undefined> {
  const db = await getDb();
  const rows = await db.select().from(shipskartUserLinks)
    .where(eq(shipskartUserLinks.userUuid, userUuid)).limit(1);
  return rows[0];
}

export async function upsertUserLink(userUuid: string, patch: {
  shipskartUserId?: string | null; pushStatus: string; lastError?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const pushedAt = patch.pushStatus === 'pushed' ? now : undefined;
  await db.insert(shipskartUserLinks)
    .values({
      userUuid,
      shipskartUserId: patch.shipskartUserId ?? null,
      pushStatus: patch.pushStatus,
      lastError: patch.lastError ?? null,
      pushedAt: pushedAt ?? null,
    })
    .onConflictDoUpdate({
      target: shipskartUserLinks.userUuid,
      set: {
        ...(patch.shipskartUserId !== undefined ? { shipskartUserId: patch.shipskartUserId } : {}),
        pushStatus: patch.pushStatus,
        lastError: patch.lastError ?? null,
        ...(pushedAt ? { pushedAt } : {}),
        updatedAt: now,
      },
    });
}

// ── vessel links ──

export async function getVesselLink(vesselVuuid: string): Promise<ShipskartVesselLink | undefined> {
  const db = await getDb();
  const rows = await db.select().from(shipskartVesselLinks)
    .where(eq(shipskartVesselLinks.vesselVuuid, vesselVuuid)).limit(1);
  return rows[0];
}

export async function upsertVesselLink(vesselVuuid: string, patch: {
  imoNumber?: string | null; shipskartVesselId?: string | null; pushStatus: string; lastError?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const pushedAt = patch.pushStatus === 'pushed' ? now : undefined;
  await db.insert(shipskartVesselLinks)
    .values({
      vesselVuuid,
      imoNumber: patch.imoNumber ?? null,
      shipskartVesselId: patch.shipskartVesselId ?? null,
      pushStatus: patch.pushStatus,
      lastError: patch.lastError ?? null,
      pushedAt: pushedAt ?? null,
    })
    .onConflictDoUpdate({
      target: shipskartVesselLinks.vesselVuuid,
      set: {
        ...(patch.imoNumber !== undefined ? { imoNumber: patch.imoNumber } : {}),
        ...(patch.shipskartVesselId !== undefined ? { shipskartVesselId: patch.shipskartVesselId } : {}),
        pushStatus: patch.pushStatus,
        lastError: patch.lastError ?? null,
        ...(pushedAt ? { pushedAt } : {}),
        updatedAt: now,
      },
    });
}

// ── user↔vessel assignments ──

export async function getAssignment(userUuid: string, vesselId: string): Promise<MasterUserVessel | undefined> {
  const db = await getDb();
  const rows = await db.select().from(masterUserVessels)
    .where(and(eq(masterUserVessels.userUuid, userUuid), eq(masterUserVessels.vesselId, vesselId))).limit(1);
  return rows[0];
}

export async function upsertAssignment(userUuid: string, vesselId: string, patch: {
  isActive?: boolean; shipskartMappingId?: string | null; mapStatus?: string; lastError?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const mappedAt = patch.mapStatus === 'mapped' ? now : undefined;
  await db.insert(masterUserVessels)
    .values({
      userUuid, vesselId,
      isActive: patch.isActive ?? true,
      shipskartMappingId: patch.shipskartMappingId ?? null,
      mapStatus: patch.mapStatus ?? 'pending',
      lastError: patch.lastError ?? null,
      mappedAt: mappedAt ?? null,
    })
    .onConflictDoUpdate({
      target: [masterUserVessels.userUuid, masterUserVessels.vesselId],
      set: {
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.shipskartMappingId !== undefined ? { shipskartMappingId: patch.shipskartMappingId } : {}),
        ...(patch.mapStatus !== undefined ? { mapStatus: patch.mapStatus } : {}),
        lastError: patch.lastError ?? null,
        ...(mappedAt ? { mappedAt } : {}),
        updatedAt: now,
      },
    });
}

/**
 * CAPTURE-AT-LOGIN replace-set. The assignments live in SAILERP's encrypted userProfile
 * (`myVessels`), which only the browser can read — so the frontend hands the array over
 * once per login and this is the whole server-side write path.
 *
 * REPLACE-SET, NOT ADD-ONLY: vessels no longer in the profile are DEACTIVATED
 * (is_active=false) rather than deleted, so a user moved off a vessel loses access here
 * too, while `shipskart_mapping_id` survives for a clean re-activation if they move back.
 * Deactivated rows are marked for re-push so the Shipskart mapping is updated as well.
 *
 * @returns counts { activated, deactivated }
 */
export async function replaceAssignmentsForUser(
  userUuid: string,
  vesselVuuids: string[],
): Promise<{ activated: number; deactivated: number }> {
  const db = await getDb();
  const now = new Date();
  let activated = 0;

  for (const vesselId of vesselVuuids) {
    const existing = await getAssignment(userUuid, vesselId);
    // Re-activating a previously deactivated row must re-open the mapping question, so a
    // row that was mapped-then-deactivated goes back to 'pending' for the reconciler.
    const mapStatus = existing?.shipskartMappingId && existing.isActive ? undefined : 'pending';
    await upsertAssignment(userUuid, vesselId, { isActive: true, ...(mapStatus ? { mapStatus } : {}) });
    activated++;
  }

  const keep = vesselVuuids.length > 0 ? vesselVuuids : ['__none__'];
  const deactivatedRows = await db.update(masterUserVessels)
    .set({ isActive: false, mapStatus: 'revoked', updatedAt: now })
    .where(and(
      eq(masterUserVessels.userUuid, userUuid),
      eq(masterUserVessels.isActive, true),
      notInArray(masterUserVessels.vesselId, keep),
    ))
    .returning({ id: masterUserVessels.id });

  return { activated, deactivated: deactivatedRows.length };
}

/** Active vessel vuuids for a user — used by the reconciler / JIT push. */
export async function getActiveVesselIdsForUser(userUuid: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ v: masterUserVessels.vesselId }).from(masterUserVessels)
    .where(and(eq(masterUserVessels.userUuid, userUuid), eq(masterUserVessels.isActive, true)));
  return rows.map((r) => r.v);
}

/** Status endpoint helper: counts per push status. */
export async function linkStatusCounts(): Promise<{ users: Record<string, number>; vessels: Record<string, number>; assignments: Record<string, number> }> {
  const db = await getDb();
  const count = (rows: Array<{ s: string }>) =>
    rows.reduce((acc: Record<string, number>, r) => { acc[r.s] = (acc[r.s] || 0) + 1; return acc; }, {});
  const u = await db.select({ s: shipskartUserLinks.pushStatus }).from(shipskartUserLinks);
  const v = await db.select({ s: shipskartVesselLinks.pushStatus }).from(shipskartVesselLinks);
  const a = await db.select({ s: masterUserVessels.mapStatus }).from(masterUserVessels);
  return { users: count(u), vessels: count(v), assignments: count(a) };
}
