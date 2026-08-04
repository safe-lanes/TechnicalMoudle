import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { components, rotationalItems, type RotationalItem, type InsertRotationalItem } from '@shared/schema';

const notDeleted = eq(rotationalItems.isDeleted, false);

export async function listByVessel(vesselId: string, status?: string): Promise<RotationalItem[]> {
  const db = await getDb();
  const conditions = [eq(rotationalItems.vesselId, vesselId), notDeleted];
  if (status) conditions.push(eq(rotationalItems.status, status));
  return db.select().from(rotationalItems)
    .where(and(...conditions))
    .orderBy(rotationalItems.stamp);
}

/**
 * Master List screen listing: each item plus the component currently holding its
 * stamp (derived via components.current_stamp — no back-pointer column).
 */
export async function listByVesselWithHolder(
  vesselId: string,
  status?: string,
): Promise<Array<RotationalItem & { installedOnCuuid: string | null; installedOnCode: string | null; installedOnName: string | null }>> {
  const db = await getDb();
  const conditions = [eq(rotationalItems.vesselId, vesselId), notDeleted];
  if (status) conditions.push(eq(rotationalItems.status, status));
  const rows = await db.select({
    item: rotationalItems,
    holderCuuid: components.cuuid,
    holderCode: components.componentCode,
    holderName: components.name,
  }).from(rotationalItems)
    .leftJoin(components, and(
      eq(components.vesselId, rotationalItems.vesselId),
      eq(components.currentStamp, rotationalItems.stamp),
      eq(components.rotationalItem, true),
      eq(components.isDeleted, false),
    ))
    .where(and(...conditions))
    .orderBy(rotationalItems.stamp);
  return rows.map(r => ({
    ...r.item,
    installedOnCuuid: r.holderCuuid ?? null,
    installedOnCode: r.holderCode ?? null,
    installedOnName: r.holderName ?? null,
  }));
}

export async function getByRiuuid(riuuid: string): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.select().from(rotationalItems)
    .where(and(eq(rotationalItems.riuuid, riuuid), notDeleted)).limit(1);
  return rows[0];
}

export async function getByStamp(vesselId: string, stamp: string): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.select().from(rotationalItems)
    .where(and(
      eq(rotationalItems.vesselId, vesselId),
      // stamp comparison is case-preserving but whitespace-trimmed at the service layer
      eq(rotationalItems.stamp, stamp),
      notDeleted,
    )).limit(1);
  return rows[0];
}

/**
 * Pure-master derived link (Task #366): the registry has no component back-pointer.
 * "Installed on component X" = the registry row whose stamp equals the component's
 * current_stamp (same vessel), status Installed.
 */
export async function getInstalledByComponentCuuid(componentCuuid: string): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.select({ item: rotationalItems }).from(rotationalItems)
    .innerJoin(components, and(
      eq(components.cuuid, componentCuuid),
      eq(components.vesselId, rotationalItems.vesselId),
      eq(components.currentStamp, rotationalItems.stamp),
    ))
    .where(and(
      eq(rotationalItems.status, 'Installed'),
      notDeleted,
    )).limit(1);
  return rows[0]?.item;
}

/**
 * Reverse derived link: which live component currently holds this stamp?
 * Returns cuuid/code/name of the holder, or undefined when the stamp is not fitted.
 */
export async function getComponentHoldingStamp(
  vesselId: string,
  stamp: string,
): Promise<{ cuuid: string; componentCode: string | null; name: string | null } | undefined> {
  const db = await getDb();
  const rows = await db.select({
    cuuid: components.cuuid,
    componentCode: components.componentCode,
    name: components.name,
  }).from(components)
    .where(and(
      eq(components.vesselId, vesselId),
      eq(components.currentStamp, stamp),
      eq(components.rotationalItem, true),
      eq(components.isDeleted, false),
      isNotNull(components.currentStamp),
    )).limit(1);
  return rows[0];
}

/** All live components on the vessel currently holding a stamp (derived link, bulk-import validation). */
export async function getComponentsWithStamps(
  vesselId: string,
): Promise<Array<{ cuuid: string; componentCode: string | null; currentStamp: string | null }>> {
  const db = await getDb();
  return db.select({
    cuuid: components.cuuid,
    componentCode: components.componentCode,
    currentStamp: components.currentStamp,
  }).from(components)
    .where(and(
      eq(components.vesselId, vesselId),
      eq(components.rotationalItem, true),
      eq(components.isDeleted, false),
      isNotNull(components.currentStamp),
    ));
}

export async function create(data: InsertRotationalItem): Promise<RotationalItem> {
  const db = await getDb();
  const rows = await db.insert(rotationalItems).values(data).returning();
  return rows[0];
}

/**
 * Guarded claim: Spare/In Store → Installed. Returns undefined (0 rows) if the
 * item was concurrently claimed, retired, or deleted — callers must treat that
 * as a conflict, not fall back to an unguarded write.
 */
export async function claimStamp(riuuid: string, userUuid?: string | null): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.update(rotationalItems)
    .set({ status: 'Installed', updatedByUuid: userUuid ?? undefined, updatedAt: sql`NOW()` })
    .where(and(
      eq(rotationalItems.riuuid, riuuid),
      notDeleted,
      sql`${rotationalItems.status} IN ('Spare', 'In Store')`,
    ))
    .returning();
  return rows[0];
}

/**
 * Guarded release: Installed → Spare with RH snapshot. Returns undefined if the
 * item is no longer Installed (already released elsewhere).
 */
export async function releaseStamp(
  riuuid: string,
  rhSnapshot: { currentRh: string | null; rhLastUpdated: string | null },
  userUuid?: string | null,
): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.update(rotationalItems)
    .set({
      status: 'Spare',
      updatedByUuid: userUuid ?? undefined,
      ...(rhSnapshot.currentRh != null ? { currentRh: rhSnapshot.currentRh } : {}),
      ...(rhSnapshot.rhLastUpdated != null ? { rhLastUpdated: rhSnapshot.rhLastUpdated } : {}),
      updatedAt: sql`NOW()`,
    })
    .where(and(
      eq(rotationalItems.riuuid, riuuid),
      notDeleted,
      eq(rotationalItems.status, 'Installed'),
    ))
    .returning();
  return rows[0];
}

export async function update(riuuid: string, data: Partial<InsertRotationalItem>): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.update(rotationalItems)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(and(eq(rotationalItems.riuuid, riuuid), notDeleted))
    .returning();
  return rows[0];
}

export async function softDelete(riuuid: string, userUuid: string | null): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.update(rotationalItems)
    .set({ isDeleted: true, updatedByUuid: userUuid ?? undefined, updatedAt: sql`NOW()` })
    .where(and(eq(rotationalItems.riuuid, riuuid), notDeleted))
    .returning();
  return rows[0];
}
