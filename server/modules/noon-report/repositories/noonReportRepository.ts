import { getDb } from '../../../db';
import { nrNoonReports, nrFuelRob, nrVoyageLegs } from '@shared/schema';
import type { InsertNrNoonReport, InsertNrFuelRob, InsertNrVoyageLeg } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// ── Noon Reports ─────────────────────────────────────────────────────────────

export async function getNoonReports(filters: {
  vesselId?: string;
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  let query = db.select().from(nrNoonReports).orderBy(desc(nrNoonReports.reportDate));

  const conditions = [];
  if (filters.vesselId) conditions.push(eq(nrNoonReports.vesselId, filters.vesselId));
  if (filters.status) conditions.push(eq(nrNoonReports.status, filters.status));

  if (conditions.length > 0) {
    return db.select()
      .from(nrNoonReports)
      .where(and(...conditions))
      .orderBy(desc(nrNoonReports.reportDate))
      .limit(filters.limit || 100);
  }

  return db.select()
    .from(nrNoonReports)
    .orderBy(desc(nrNoonReports.reportDate))
    .limit(filters.limit || 100);
}

export async function getNoonReportById(id: number) {
  const db = await getDb();
  const result = await db.select().from(nrNoonReports).where(eq(nrNoonReports.id, id)).limit(1);
  return result[0] || null;
}

export async function createNoonReport(data: InsertNrNoonReport) {
  const db = await getDb();
  const result = await db.insert(nrNoonReports).values({
    ...data,
    draftSavedAt: new Date(),
  }).returning();
  return result[0];
}

export async function updateNoonReport(id: number, data: Partial<InsertNrNoonReport>) {
  const db = await getDb();
  const result = await db.update(nrNoonReports)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(nrNoonReports.id, id))
    .returning();
  return result[0];
}

export async function submitNoonReport(id: number, submittedBy: string) {
  const db = await getDb();
  const result = await db.update(nrNoonReports)
    .set({
      status: 'submitted',
      submittedAt: new Date(),
      submittedBy,
      updatedAt: new Date(),
    })
    .where(eq(nrNoonReports.id, id))
    .returning();
  return result[0];
}

export async function deleteNoonReport(id: number) {
  const db = await getDb();
  await db.delete(nrNoonReports).where(and(eq(nrNoonReports.id, id), eq(nrNoonReports.status, 'draft')));
}

export async function saveDraft(id: number, data: Partial<InsertNrNoonReport>) {
  const db = await getDb();
  const result = await db.update(nrNoonReports)
    .set({ ...data, draftSavedAt: new Date(), updatedAt: new Date() })
    .where(eq(nrNoonReports.id, id))
    .returning();
  return result[0];
}

// ── Fuel ROB ─────────────────────────────────────────────────────────────────

export async function getFuelRobByVessel(vesselId: string) {
  const db = await getDb();
  return db.select().from(nrFuelRob).where(eq(nrFuelRob.vesselId, vesselId));
}

export async function upsertFuelRob(vesselId: string, fuelType: string, currentRob: number, reportId: number) {
  const db = await getDb();
  const existing = await db.select().from(nrFuelRob)
    .where(and(eq(nrFuelRob.vesselId, vesselId), eq(nrFuelRob.fuelType, fuelType)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(nrFuelRob)
      .set({ currentRob: String(currentRob), updatedAt: new Date(), lastReportId: reportId })
      .where(and(eq(nrFuelRob.vesselId, vesselId), eq(nrFuelRob.fuelType, fuelType)));
  } else {
    await db.insert(nrFuelRob).values({
      vesselId,
      fuelType,
      currentRob: String(currentRob),
      lastReportId: reportId,
    });
  }
}

// ── Voyage Legs ───────────────────────────────────────────────────────────────

export async function getVoyageLegsByVessel(vesselId: string) {
  const db = await getDb();
  return db.select().from(nrVoyageLegs)
    .where(eq(nrVoyageLegs.vesselId, vesselId))
    .orderBy(desc(nrVoyageLegs.createdAt));
}

export async function upsertVoyageLeg(data: InsertNrVoyageLeg) {
  const db = await getDb();
  const existing = await db.select().from(nrVoyageLegs)
    .where(and(eq(nrVoyageLegs.vesselId, data.vesselId), eq(nrVoyageLegs.voyageNo, data.voyageNo!)))
    .limit(1);

  if (existing.length > 0) {
    const result = await db.update(nrVoyageLegs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(nrVoyageLegs.id, existing[0].id))
      .returning();
    return result[0];
  } else {
    const result = await db.insert(nrVoyageLegs).values(data).returning();
    return result[0];
  }
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

export async function getLastNReports(vesselId: string, n: number) {
  const db = await getDb();
  return db.select().from(nrNoonReports)
    .where(and(eq(nrNoonReports.vesselId, vesselId), eq(nrNoonReports.status, 'submitted')))
    .orderBy(desc(nrNoonReports.reportDate))
    .limit(n);
}
