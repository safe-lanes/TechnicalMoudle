/**
 * Shipskart b2b repository — DB access for the migration-149 tables:
 * shipskart_tenant_config (rotating token pair + flags), shipskart_user_links,
 * shipskart_vessel_links, master_user_vessels.
 *
 * All four are SHORE-ONLY / NO_SYNC (see shared/syncConfig.ts). getDb() is ALS-aware,
 * so multi-tenant routing works with zero extra plumbing (same as the role mappings).
 */
import { and, eq, ne, notInArray } from 'drizzle-orm';
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

/**
 * The per-tenant automation master switch (default FALSE — a fresh deploy never pushes).
 * Row may not exist yet on a brand-new tenant, hence upsert.
 */
export async function setReconcilerEnabled(tenantId: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.insert(shipskartTenantConfig)
    .values({ tenantId, enabled: true, reconcilerEnabled: enabled })
    .onConflictDoUpdate({
      target: shipskartTenantConfig.tenantId,
      set: { reconcilerEnabled: enabled, updatedAt: new Date() },
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
  pushedRoleId?: string | null; pushedRoleName?: string | null;
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
      pushedRoleId: patch.pushedRoleId ?? null,
      pushedRoleName: patch.pushedRoleName ?? null,
    })
    .onConflictDoUpdate({
      target: shipskartUserLinks.userUuid,
      set: {
        ...(patch.shipskartUserId !== undefined ? { shipskartUserId: patch.shipskartUserId } : {}),
        pushStatus: patch.pushStatus,
        lastError: patch.lastError ?? null,
        ...(pushedAt ? { pushedAt } : {}),
        ...(patch.pushedRoleId !== undefined ? { pushedRoleId: patch.pushedRoleId } : {}),
        ...(patch.pushedRoleName !== undefined ? { pushedRoleName: patch.pushedRoleName } : {}),
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
  mapAttempts?: number; lastAttemptAt?: Date | null;
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
      mapAttempts: patch.mapAttempts ?? 0,
      lastAttemptAt: patch.lastAttemptAt ?? null,
      mappedAt: mappedAt ?? null,
    })
    .onConflictDoUpdate({
      target: [masterUserVessels.userUuid, masterUserVessels.vesselId],
      set: {
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.shipskartMappingId !== undefined ? { shipskartMappingId: patch.shipskartMappingId } : {}),
        ...(patch.mapStatus !== undefined ? { mapStatus: patch.mapStatus } : {}),
        ...(patch.mapAttempts !== undefined ? { mapAttempts: patch.mapAttempts } : {}),
        ...(patch.lastAttemptAt !== undefined ? { lastAttemptAt: patch.lastAttemptAt } : {}),
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
    // Going (back) to 'pending' is FRESH work — reset the retry ladder (migration 164)
    // so a row that previously climbed to a 24h backoff is retried immediately.
    await upsertAssignment(userUuid, vesselId, {
      isActive: true,
      ...(mapStatus ? { mapStatus, mapAttempts: 0, lastAttemptAt: null } : {}),
    });
    activated++;
  }

  const keep = vesselVuuids.length > 0 ? vesselVuuids : ['__none__'];
  // Revocation is fresh work too — reset the ladder so the unmap is tried straight away
  // even if the row had accumulated backoff from its mapping days.
  const deactivatedRows = await db.update(masterUserVessels)
    .set({ isActive: false, mapStatus: 'revoked', mapAttempts: 0, lastAttemptAt: null, updatedAt: now })
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

/**
 * ONE user's assignment work: vessels still to map, and mappings still to remove.
 * Crew rotation writes both at login (capture-at-login marks the dropped vessel 'revoked'
 * and adds the new one 'pending'), but until 06-Aug only the SWEEP acted on them — so with
 * the sweep off a reassignment never reached Shipskart and the user kept seeing the OLD
 * vessel. The click now settles its own user's changes with this.
 */
export async function getPendingAssignmentWork(userUuid: string): Promise<{
  toMap: string[];
  toUnmap: Array<{ vesselId: string; shipskartMappingId: string }>;
}> {
  const db = await getDb();
  const rows = await db.select().from(masterUserVessels)
    .where(eq(masterUserVessels.userUuid, userUuid));
  return {
    // 'error' is IN this list on purpose (migration 164): a transient failure — rate
    // limit, 5xx, network — used to strand the row forever, because NO retry path
    // selected 'error' (gurpreet's Gas Mia row, 11-Aug, needed a manual SQL reset).
    // Human-triggered paths (Purchasing click, Sync Vessels) retry immediately, no
    // backoff — a person acting IS the retry decision. 'blocked_duplicate' stays out:
    // retrying a duplicate reproduces the same 400 until someone fixes the data.
    toMap: rows
      .filter((r) => r.isActive && ['pending', 'awaiting_user', 'awaiting_vessel', 'error'].includes(r.mapStatus ?? ''))
      .map((r) => r.vesselId),
    toUnmap: rows
      .filter((r) => !r.isActive && r.mapStatus === 'revoked' && !!r.shipskartMappingId)
      .map((r) => ({ vesselId: r.vesselId, shipskartMappingId: r.shipskartMappingId as string })),
  };
}

/**
 * Console detail: rows that are NOT successfully pushed/mapped, with their errors —
 * the "what needs a human" list. Bounded so a broken tenant cannot return everything.
 */
export async function failingRows(limit = 100): Promise<{
  users: Array<{ userUuid: string; pushStatus: string; lastError: string | null }>;
  vessels: Array<{ vesselVuuid: string; imoNumber: string | null; pushStatus: string; lastError: string | null }>;
  assignments: Array<{ userUuid: string; vesselId: string; mapStatus: string; lastError: string | null }>;
}> {
  const db = await getDb();
  const users = await db.select({
    userUuid: shipskartUserLinks.userUuid, pushStatus: shipskartUserLinks.pushStatus, lastError: shipskartUserLinks.lastError,
  }).from(shipskartUserLinks).where(ne(shipskartUserLinks.pushStatus, 'pushed')).limit(limit);
  const vessels = await db.select({
    vesselVuuid: shipskartVesselLinks.vesselVuuid, imoNumber: shipskartVesselLinks.imoNumber,
    pushStatus: shipskartVesselLinks.pushStatus, lastError: shipskartVesselLinks.lastError,
  }).from(shipskartVesselLinks).where(ne(shipskartVesselLinks.pushStatus, 'pushed')).limit(limit);
  const assignments = await db.select({
    userUuid: masterUserVessels.userUuid, vesselId: masterUserVessels.vesselId,
    mapStatus: masterUserVessels.mapStatus, lastError: masterUserVessels.lastError,
  }).from(masterUserVessels)
    .where(and(eq(masterUserVessels.isActive, true), ne(masterUserVessels.mapStatus, 'mapped'))).limit(limit);
  return { users, vessels, assignments };
}

/**
 * Console retry: clear a stuck row back to 'pending' so the next reconciler pass re-tries
 * it. Deliberately does NOT touch a row that already carries a Shipskart id — re-pushing
 * that would create a duplicate on their side (they have no update endpoint).
 */
export async function resetForRetry(kind: 'user' | 'vessel', id: string): Promise<{ reset: boolean; reason?: string }> {
  const db = await getDb();
  if (kind === 'user') {
    const existing = await getUserLink(id);
    if (!existing) return { reset: false, reason: 'no link row' };
    if (existing.shipskartUserId) return { reset: false, reason: 'already has a Shipskart id — re-pushing would duplicate' };
    await db.update(shipskartUserLinks)
      .set({ pushStatus: 'pending', lastError: null, updatedAt: new Date() })
      .where(eq(shipskartUserLinks.userUuid, id));
    return { reset: true };
  }
  const existing = await getVesselLink(id);
  if (!existing) return { reset: false, reason: 'no link row' };
  if (existing.shipskartVesselId) return { reset: false, reason: 'already has a Shipskart id — re-pushing would duplicate' };
  await db.update(shipskartVesselLinks)
    .set({ pushStatus: 'pending', lastError: null, updatedAt: new Date() })
    .where(eq(shipskartVesselLinks.vesselVuuid, id));
  return { reset: true };
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
