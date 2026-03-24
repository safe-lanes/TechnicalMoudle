import { db } from '../../../db';
import { nrBunkerRecords } from '@shared/schema';
import type { InsertNrBunkerRecord, NrBunkerRecord } from '@shared/schema';
import { eq, and, desc, sum } from 'drizzle-orm';

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getBunkerRecords(filters: {
  vesselId: string;
  voyageNo?: string;
}): Promise<NrBunkerRecord[]> {
  const conditions = [eq(nrBunkerRecords.vesselId, filters.vesselId)];
  if (filters.voyageNo) conditions.push(eq(nrBunkerRecords.voyageNo, filters.voyageNo));
  return db.select()
    .from(nrBunkerRecords)
    .where(and(...conditions))
    .orderBy(desc(nrBunkerRecords.bunkeredDate));
}

export async function getBunkerRecordById(id: number): Promise<NrBunkerRecord | null> {
  const rows = await db.select().from(nrBunkerRecords).where(eq(nrBunkerRecords.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createBunkerRecord(data: InsertNrBunkerRecord): Promise<NrBunkerRecord> {
  const rows = await db.insert(nrBunkerRecords).values(data).returning();
  return rows[0];
}

export async function updateBunkerRecord(
  id: number,
  data: Partial<InsertNrBunkerRecord>,
): Promise<NrBunkerRecord | null> {
  const rows = await db.update(nrBunkerRecords)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(nrBunkerRecords.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteBunkerRecord(id: number): Promise<void> {
  await db.delete(nrBunkerRecords).where(eq(nrBunkerRecords.id, id));
}

// ── Cost summary ──────────────────────────────────────────────────────────────

export async function getBunkerCostSummary(vesselId: string, voyageNo?: string): Promise<
  Array<{ fuelType: string; totalQuantityMt: string; totalCost: string }>
> {
  const conditions = [eq(nrBunkerRecords.vesselId, vesselId)];
  if (voyageNo) conditions.push(eq(nrBunkerRecords.voyageNo, voyageNo));

  const rows = await db.select({
    fuelType: nrBunkerRecords.fuelType,
    totalQuantityMt: sum(nrBunkerRecords.quantityMt),
    totalCost: sum(nrBunkerRecords.totalCost),
  })
    .from(nrBunkerRecords)
    .where(and(...conditions))
    .groupBy(nrBunkerRecords.fuelType);

  return rows.map(r => ({
    fuelType: r.fuelType,
    totalQuantityMt: r.totalQuantityMt ?? '0',
    totalCost: r.totalCost ?? '0',
  }));
}
