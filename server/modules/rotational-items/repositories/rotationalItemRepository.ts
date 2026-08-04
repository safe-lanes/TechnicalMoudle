import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { rotationalItems, type RotationalItem, type InsertRotationalItem } from '@shared/schema';

const notDeleted = eq(rotationalItems.isDeleted, false);

export async function listByVessel(vesselId: string, status?: string): Promise<RotationalItem[]> {
  const db = await getDb();
  const conditions = [eq(rotationalItems.vesselId, vesselId), notDeleted];
  if (status) conditions.push(eq(rotationalItems.status, status));
  return db.select().from(rotationalItems)
    .where(and(...conditions))
    .orderBy(rotationalItems.stamp);
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

export async function getInstalledByComponentCuuid(componentCuuid: string): Promise<RotationalItem | undefined> {
  const db = await getDb();
  const rows = await db.select().from(rotationalItems)
    .where(and(
      eq(rotationalItems.componentCuuid, componentCuuid),
      eq(rotationalItems.status, 'Installed'),
      notDeleted,
    )).limit(1);
  return rows[0];
}

export async function create(data: InsertRotationalItem): Promise<RotationalItem> {
  const db = await getDb();
  const rows = await db.insert(rotationalItems).values(data).returning();
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
