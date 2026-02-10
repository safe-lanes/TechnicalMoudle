import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { v2Components as bulkComponents, v2MakerList as bulkMakerList, v2ImportChangeLog as bulkImportChangeLog, v2ImportHistory as bulkImportHistory } from '@shared/v2/bulk/schema';
import { v2Jobs, v2JobComponentLinks } from '@shared/v2/components/schema';
import {
  v2Spares,
  v2SpareComponentLinks,
  v2Locations,
  v2SpareLocationStock,
  v2InventoryTransactions,
} from '@shared/v2/spares/schema';
import { v2StoresItems, v2StoresLedger } from '@shared/v2/stores/schema';

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

  async getJobs(vesselId: string) {
    const db = await getDb();
    return await db.select().from(v2Jobs)
      .where(eq(v2Jobs.vesselId, vesselId));
  }

  async getJobByCompositeKey(vesselId: string, componentCode: string, jobNo: string) {
    const db = await getDb();
    const results = await db.select().from(v2Jobs)
      .where(and(
        eq(v2Jobs.vesselId, vesselId),
        eq(v2Jobs.componentCode, componentCode),
        eq(v2Jobs.jobNo, jobNo)
      ));
    return results[0] || null;
  }

  async createJob(data: any) {
    const db = await getDb();
    const results = await db.insert(v2Jobs).values(data).returning();
    return results[0];
  }

  async updateJob(id: string, data: any) {
    const db = await getDb();
    const results = await db.update(v2Jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2Jobs.id, id))
      .returning();
    return results[0] || null;
  }

  async getAllJobs() {
    const db = await getDb();
    return await db.select().from(v2Jobs);
  }

  async createJobComponentLink(data: { vesselId: string; jobId: string; componentId: string; componentCode: string; linkedBy: string }) {
    const db = await getDb();
    const results = await db.insert(v2JobComponentLinks).values(data).returning();
    return results[0];
  }

  async getJobComponentLinksByJob(jobId: string) {
    const db = await getDb();
    return await db.select().from(v2JobComponentLinks)
      .where(eq(v2JobComponentLinks.jobId, jobId));
  }

  async getSpares(vesselId: string) {
    const db = await getDb();
    return await db.select().from(v2Spares)
      .where(eq(v2Spares.vesselId, vesselId));
  }

  async getSpareByPartCode(partCode: string, vesselId: string) {
    const db = await getDb();
    const results = await db.select().from(v2Spares)
      .where(and(
        eq(v2Spares.partCode, partCode),
        eq(v2Spares.vesselId, vesselId)
      ));
    return results[0] || null;
  }

  async createSpare(data: any) {
    const db = await getDb();
    const results = await db.insert(v2Spares).values(data).returning();
    return results[0];
  }

  async updateSpare(id: number, data: any) {
    const db = await getDb();
    const results = await db.update(v2Spares)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2Spares.id, id))
      .returning();
    return results[0] || null;
  }

  async getSpareComponentLinksBySpare(spareId: number) {
    const db = await getDb();
    return await db.select().from(v2SpareComponentLinks)
      .where(eq(v2SpareComponentLinks.spareId, spareId));
  }

  async createSpareComponentLink(data: { vesselId: string; spareId: number; componentId: string; linkedBy: string }) {
    const db = await getDb();
    const results = await db.insert(v2SpareComponentLinks).values(data).returning();
    return results[0];
  }

  async findOrCreateLocation(vesselId: string, locationName: string, createdBy: string) {
    const db = await getDb();
    const existing = await db.select().from(v2Locations)
      .where(and(
        eq(v2Locations.vesselId, vesselId),
        eq(v2Locations.locationName, locationName)
      ));
    if (existing[0]) return existing[0];

    const results = await db.insert(v2Locations)
      .values({ vesselId, locationName, createdBy })
      .returning();
    return results[0];
  }

  async getSpareLocationStock(spareId: number, locationId: number) {
    const db = await getDb();
    const results = await db.select().from(v2SpareLocationStock)
      .where(and(
        eq(v2SpareLocationStock.spareId, spareId),
        eq(v2SpareLocationStock.locationId, locationId)
      ));
    return results[0] || null;
  }

  async createSpareLocationStock(data: { vesselId: string; spareId: number; locationId: number; qty: number }) {
    const db = await getDb();
    const results = await db.insert(v2SpareLocationStock).values(data).returning();
    return results[0];
  }

  async updateSpareLocationStock(id: number, qty: number) {
    const db = await getDb();
    const results = await db.update(v2SpareLocationStock)
      .set({ qty })
      .where(eq(v2SpareLocationStock.id, id))
      .returning();
    return results[0] || null;
  }

  async createInventoryTransaction(data: any) {
    const db = await getDb();
    const results = await db.insert(v2InventoryTransactions).values(data).returning();
    return results[0];
  }

  async getStoresItems(vesselId: string, itemType?: string) {
    const db = await getDb();
    if (itemType) {
      return await db.select().from(v2StoresItems)
        .where(and(
          eq(v2StoresItems.vesselId, vesselId),
          eq(v2StoresItems.itemType, itemType),
          eq(v2StoresItems.deleted, false)
        ));
    }
    return await db.select().from(v2StoresItems)
      .where(and(
        eq(v2StoresItems.vesselId, vesselId),
        eq(v2StoresItems.deleted, false)
      ));
  }

  async getStoresItemByCode(itemCode: string, vesselId: string, itemType?: string) {
    const db = await getDb();
    const conditions = [
      eq(v2StoresItems.itemCode, itemCode),
      eq(v2StoresItems.vesselId, vesselId),
      eq(v2StoresItems.deleted, false),
    ];
    if (itemType) {
      conditions.push(eq(v2StoresItems.itemType, itemType));
    }
    const results = await db.select().from(v2StoresItems)
      .where(and(...conditions));
    return results[0] || null;
  }

  async getStoresItemsByCodes(codes: string[], vesselId: string): Promise<Map<string, any>> {
    const db = await getDb();
    if (codes.length === 0) return new Map();
    const results = await db.select().from(v2StoresItems)
      .where(and(
        inArray(v2StoresItems.itemCode, codes),
        eq(v2StoresItems.vesselId, vesselId),
        eq(v2StoresItems.deleted, false)
      ));
    const map = new Map<string, any>();
    for (const r of results) {
      map.set(r.itemCode, r);
    }
    return map;
  }

  async createStoresItem(data: any) {
    const db = await getDb();
    const results = await db.insert(v2StoresItems).values(data).returning();
    return results[0];
  }

  async updateStoresItem(id: number, data: any) {
    const db = await getDb();
    const results = await db.update(v2StoresItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2StoresItems.id, id))
      .returning();
    return results[0] || null;
  }

  async createStoresLedgerEntry(data: any) {
    const db = await getDb();
    const results = await db.insert(v2StoresLedger).values(data).returning();
    return results[0];
  }
}
