import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { bulkComponents, bulkMakerList, bulkImportChangeLog, bulkImportHistory } from '../schema';

export class BulkRepository {
  async getComponents(vesselId: string) {
    const db = await getDb();
    return await db.select().from(bulkComponents)
      .where(eq(bulkComponents.vesselId, vesselId));
  }

  async getComponentsByCodes(codes: string[], vesselId: string): Promise<Map<string, any>> {
    const db = await getDb();
    if (codes.length === 0) return new Map();
    const results = await db.select().from(bulkComponents)
      .where(and(
        inArray(bulkComponents.componentCode, codes),
        eq(bulkComponents.vesselId, vesselId)
      ));
    const map = new Map<string, any>();
    for (const r of results) {
      if (r.componentCode) {
        map.set(r.componentCode, r);
      }
    }
    return map;
  }

  async getComponentByCode(code: string, vesselId: string) {
    const db = await getDb();
    const results = await db.select().from(bulkComponents)
      .where(and(
        eq(bulkComponents.componentCode, code),
        eq(bulkComponents.vesselId, vesselId)
      ));
    return results[0] || null;
  }

  async getComponent(id: string) {
    const db = await getDb();
    const results = await db.select().from(bulkComponents)
      .where(eq(bulkComponents.id, id));
    return results[0] || null;
  }

  async createComponent(data: any) {
    const db = await getDb();
    const results = await db.insert(bulkComponents).values(data).returning();
    return results[0];
  }

  async updateComponent(id: string, data: any) {
    const db = await getDb();
    const results = await db.update(bulkComponents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bulkComponents.id, id))
      .returning();
    return results[0] || null;
  }

  async archiveComponent(id: string) {
    const db = await getDb();
    const results = await db.update(bulkComponents)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(bulkComponents.id, id))
      .returning();
    return results[0] || null;
  }

  async getMakerList() {
    const db = await getDb();
    return await db.select().from(bulkMakerList);
  }

  async getMakerListByCode(code: string) {
    const db = await getDb();
    const results = await db.select().from(bulkMakerList)
      .where(eq(bulkMakerList.makerCode, code));
    return results[0] || null;
  }

  async createMakerListItem(data: any) {
    const db = await getDb();
    const results = await db.insert(bulkMakerList).values(data).returning();
    return results[0];
  }

  async getImportHistoryById(id: string) {
    const db = await getDb();
    const results = await db.select().from(bulkImportHistory)
      .where(eq(bulkImportHistory.id, id));
    return results[0] || null;
  }

  async getImportHistoryList(type?: string, limit: number = 50, offset: number = 0) {
    const db = await getDb();
    const conditions = type ? eq(bulkImportHistory.type, type) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(bulkImportHistory)
      .where(conditions);
    const total = Number(countResult[0]?.count ?? 0);

    const items = await db.select().from(bulkImportHistory)
      .where(conditions)
      .orderBy(desc(bulkImportHistory.startedAt))
      .limit(limit)
      .offset(offset);

    return { items, total };
  }

  async createImportHistory(data: any) {
    const db = await getDb();
    const results = await db.insert(bulkImportHistory).values(data).returning();
    return results[0];
  }

  async updateImportHistory(id: string, data: any) {
    const db = await getDb();
    const results = await db.update(bulkImportHistory)
      .set(data)
      .where(eq(bulkImportHistory.id, id))
      .returning();
    return results[0] || null;
  }

  async createImportChangeLog(data: any) {
    const db = await getDb();
    const results = await db.insert(bulkImportChangeLog).values(data).returning();
    return results[0];
  }

  async getImportChangeLogs(importHistoryId: string) {
    const db = await getDb();
    return await db.select().from(bulkImportChangeLog)
      .where(eq(bulkImportChangeLog.importHistoryId, importHistoryId));
  }
}
