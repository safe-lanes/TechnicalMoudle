import { getPostgresClient } from '../../postgresClient';
import { admAvailableRanks, admVesselOrgChart, vesselOrgChartNodes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

export async function getAllRanks() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(admAvailableRanks)
    .where(eq(admAvailableRanks.isDeleted, false))
    .orderBy(admAvailableRanks.sortOrder);
}

export async function getRankById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(admAvailableRanks)
    .where(and(eq(admAvailableRanks.id, id), eq(admAvailableRanks.isDeleted, false)))
    .limit(1);
  return rows[0] || null;
}

export async function getRankByRankId(rankId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(admAvailableRanks)
    .where(and(eq(admAvailableRanks.rankId, rankId), eq(admAvailableRanks.isDeleted, false)))
    .limit(1);
  return rows[0] || null;
}

export async function upsertRank(data: any) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(admAvailableRanks)
    .where(eq(admAvailableRanks.rankId, data.rankId))
    .limit(1);

  if (existing.length > 0) {
    return db.update(admAvailableRanks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(admAvailableRanks.rankId, data.rankId))
      .returning();
  }
  return db.insert(admAvailableRanks).values(data).returning();
}

export async function softDeleteRank(rankId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(admAvailableRanks)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(admAvailableRanks.rankId, rankId));
}

export async function getAllOrgChart() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(admVesselOrgChart)
    .where(eq(admVesselOrgChart.isDeleted, false))
    .orderBy(admVesselOrgChart.sortOrder);
}

export async function getOrgChartById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(admVesselOrgChart)
    .where(and(eq(admVesselOrgChart.id, id), eq(admVesselOrgChart.isDeleted, false)))
    .limit(1);
  return rows[0] || null;
}

export async function upsertOrgChartEntry(data: any) {
  const db = await getDb();
  if (!db) return null;

  if (data.id) {
    const existing = await db.select().from(admVesselOrgChart)
      .where(eq(admVesselOrgChart.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      const { id: _id, ...updateData } = data;
      return db.update(admVesselOrgChart)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(admVesselOrgChart.id, data.id))
        .returning();
    }
  }

  const { id: _id, ...insertData } = data;
  return db.insert(admVesselOrgChart).values(insertData).returning();
}

export async function softDeleteOrgChartEntry(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(admVesselOrgChart)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(admVesselOrgChart.id, id));
}

export async function getVesselOrgChartNodes(vesselId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselOrgChartNodes)
    .where(and(
      eq(vesselOrgChartNodes.vesselId, vesselId),
      eq(vesselOrgChartNodes.isDeleted, false)
    ))
    .orderBy(vesselOrgChartNodes.sortOrder);
}

export async function getVesselOrgChartNodeByUuid(nodeUuid: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vesselOrgChartNodes)
    .where(and(
      eq(vesselOrgChartNodes.nodeUuid, nodeUuid),
      eq(vesselOrgChartNodes.isDeleted, false)
    ))
    .limit(1);
  return rows[0] || null;
}

export async function createVesselOrgChartNode(data: typeof vesselOrgChartNodes.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(vesselOrgChartNodes).values(data).returning();
  return result[0] || null;
}

export async function updateVesselOrgChartNode(nodeUuid: string, data: Partial<typeof vesselOrgChartNodes.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.update(vesselOrgChartNodes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(vesselOrgChartNodes.nodeUuid, nodeUuid))
    .returning();
  return result[0] || null;
}

export async function softDeleteVesselOrgChartNode(nodeUuid: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(vesselOrgChartNodes)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(vesselOrgChartNodes.nodeUuid, nodeUuid));
}
