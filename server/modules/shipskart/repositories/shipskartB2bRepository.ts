/**
 * Shipskart b2b repository — DB access for the migration-149 tables:
 * shipskart_tenant_config (rotating token pair + flags), shipskart_user_links,
 * shipskart_vessel_links, master_user_vessels.
 *
 * All four are SHORE-ONLY / NO_SYNC (see shared/syncConfig.ts). getDb() is ALS-aware,
 * so multi-tenant routing works with zero extra plumbing (same as the role mappings).
 */
import { and, eq } from 'drizzle-orm';
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
