import { storage } from "../storage";
import { getDb } from "../db";
import { storesLedger, reportSnapshots } from "@shared/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

export interface LowStockItem {
  id: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  category: string;
  rob: number;
  minStock: number;
  maxStock: number;
  deficit: number;
  deficitPercent: number;
  uom: string;
  location: string;
  priority: string;
  lastConsumedDate: string | null;
  avgMonthlyConsumption: number;
  daysUntilStockout: number | null;
  estimatedCost: number | null;
  supplier: string | null;
  leadTime: string | null;
  lastOrderDate: string | null;
  unitCost: number | null;
}

export interface LowStockSummary {
  totalLowStock: number;
  criticalItems: number;
  highPriorityItems: number;
  mediumPriorityItems: number;
  storesCount: number;
  lubesCount: number;
  chemicalsCount: number;
  estimatedTotalCost: number;
}

export interface LowStockReportResult {
  summary: LowStockSummary;
  items: LowStockItem[];
  allItems: LowStockItem[];
}

export interface LowStockFilters {
  category?: string;
  priority?: string;
  location?: string;
}

class LowStockReportService {
  async computeReport(vesselId: string, filters?: LowStockFilters): Promise<LowStockReportResult> {
    const allItems = await storage.getStoresItems(vesselId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const db = await getDb();
    const consumptionData = await db.select({
      itemId: storesLedger.itemId,
      totalConsumed: sql<string>`COALESCE(SUM(ABS(${storesLedger.qtyChangeBase})), 0)`,
      eventCount: sql<number>`COUNT(*)`,
      lastConsumed: sql<string>`MAX(${storesLedger.timestampUTC})`,
    })
      .from(storesLedger)
      .where(and(
        eq(storesLedger.vesselId, vesselId),
        eq(storesLedger.eventType, 'CONSUME'),
        gte(storesLedger.timestampUTC, ninetyDaysAgo)
      ))
      .groupBy(storesLedger.itemId);

    const consumptionMap = new Map<number, { totalConsumed: number; eventCount: number; lastConsumed: string | null }>();
    for (const row of consumptionData) {
      consumptionMap.set(row.itemId, {
        totalConsumed: parseFloat(String(row.totalConsumed)) || 0,
        eventCount: row.eventCount,
        lastConsumed: row.lastConsumed,
      });
    }

    const lowStockItems: LowStockItem[] = allItems
      .filter((item: any) => {
        const rob = parseFloat(String(item.rob)) || 0;
        const min = parseFloat(String(item.min)) || 0;
        return min > 0 && rob <= min;
      })
      .map((item: any) => {
        const rob = parseFloat(String(item.rob)) || 0;
        const min = parseFloat(String(item.min)) || 0;
        const maxStock = parseFloat(String(item.max)) || 0;
        const unitCost = parseFloat(String(item.unitCost)) || 0;
        const deficit = Math.max(0, min - rob);

        let priorityLevel: string;
        if (rob === 0) {
          priorityLevel = 'Critical';
        } else if (rob < min * 0.5) {
          priorityLevel = 'High';
        } else {
          priorityLevel = 'Medium';
        }

        const consumption = consumptionMap.get(item.id);
        const avgMonthlyConsumption = consumption ? consumption.totalConsumed / 3 : 0;
        const avgDailyConsumption = avgMonthlyConsumption / 30;

        let daysUntilStockout: number | null = null;
        if (rob === 0) {
          daysUntilStockout = 0;
        } else if (avgDailyConsumption > 0) {
          daysUntilStockout = Math.round(rob / avgDailyConsumption);
        }

        const estimatedCost = unitCost > 0 ? Math.round(deficit * unitCost * 100) / 100 : null;
        const deficitPercent = min > 0 ? Math.round((deficit / min) * 100) : 0;

        const locationDisplay = [
          item.locationA ? `${item.locationA}: ${parseFloat(String(item.robLocationA)) || 0}` : null,
          item.locationB ? `${item.locationB}: ${parseFloat(String(item.robLocationB)) || 0}` : null,
        ].filter(Boolean).join(' / ') || '-';

        return {
          id: item.id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemType: item.itemType,
          category: item.category || 'Uncategorized',
          rob,
          minStock: min,
          maxStock,
          deficit,
          deficitPercent,
          uom: item.uom || '-',
          location: locationDisplay,
          priority: priorityLevel,
          lastConsumedDate: consumption?.lastConsumed || null,
          avgMonthlyConsumption: Math.round(avgMonthlyConsumption * 100) / 100,
          daysUntilStockout,
          estimatedCost,
          supplier: item.supplier || null,
          leadTime: item.leadTime || null,
          lastOrderDate: item.lastOrderDate || null,
          unitCost: unitCost > 0 ? unitCost : null,
        };
      });

    let filtered = [...lowStockItems];
    if (filters?.category && filters.category !== 'all') {
      if (filters.category === 'lubricants' || filters.category === 'lubes') {
        filtered = filtered.filter((i) => i.itemType === 'lubes' || i.itemType === 'lubricants');
      } else {
        filtered = filtered.filter((i) => i.itemType === filters.category);
      }
    }
    if (filters?.priority && filters.priority !== 'all') {
      const pStr = filters.priority.charAt(0).toUpperCase() + filters.priority.slice(1).toLowerCase();
      filtered = filtered.filter((i) => i.priority === pStr);
    }
    if (filters?.location && filters.location !== 'all') {
      filtered = filtered.filter((i) => i.location.toLowerCase().includes(filters.location!.toLowerCase()));
    }

    filtered.sort((a, b) => {
      const pOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2 };
      return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
    });

    const criticalItems = lowStockItems.filter((i) => i.priority === 'Critical');
    const highItems = lowStockItems.filter((i) => i.priority === 'High');
    const mediumItems = lowStockItems.filter((i) => i.priority === 'Medium');
    const totalEstimatedCost = lowStockItems.reduce((sum, i) => sum + (i.estimatedCost || 0), 0);

    const summary: LowStockSummary = {
      totalLowStock: lowStockItems.length,
      criticalItems: criticalItems.length,
      highPriorityItems: highItems.length,
      mediumPriorityItems: mediumItems.length,
      storesCount: lowStockItems.filter((i) => i.itemType === 'stores').length,
      lubesCount: lowStockItems.filter((i) => i.itemType === 'lubes' || i.itemType === 'lubricants').length,
      chemicalsCount: lowStockItems.filter((i) => i.itemType === 'chemicals').length,
      estimatedTotalCost: Math.round(totalEstimatedCost * 100) / 100,
    };

    return { summary, items: filtered, allItems: lowStockItems };
  }

  async saveSnapshot(
    vesselId: string,
    reportType: string,
    exportFormat: string,
    summary: LowStockSummary,
    items: LowStockItem[],
    filters?: LowStockFilters,
    generatedBy?: string
  ): Promise<number> {
    const db = await getDb();
    const [snapshot] = await db.insert(reportSnapshots).values({
      vesselId,
      reportType,
      exportFormat,
      generatedBy: generatedBy || 'System',
      itemCount: items.length,
      filtersApplied: filters ? JSON.parse(JSON.stringify(filters)) : null,
      summaryData: JSON.parse(JSON.stringify(summary)),
      itemsData: JSON.parse(JSON.stringify(items)),
    }).returning({ id: reportSnapshots.id });
    return snapshot.id;
  }

  async getSnapshots(vesselId: string, reportType?: string, startDate?: Date, endDate?: Date, limit: number = 50) {
    const db = await getDb();
    const conditions = [eq(reportSnapshots.vesselId, vesselId)];
    if (reportType) conditions.push(eq(reportSnapshots.reportType, reportType));
    if (startDate) conditions.push(gte(reportSnapshots.generatedAt, startDate));
    if (endDate) {
      const { lte } = await import("drizzle-orm");
      conditions.push(lte(reportSnapshots.generatedAt, endDate));
    }

    const results = await db.select({
      id: reportSnapshots.id,
      vesselId: reportSnapshots.vesselId,
      reportType: reportSnapshots.reportType,
      exportFormat: reportSnapshots.exportFormat,
      generatedAt: reportSnapshots.generatedAt,
      generatedBy: reportSnapshots.generatedBy,
      itemCount: reportSnapshots.itemCount,
      filtersApplied: reportSnapshots.filtersApplied,
      summaryData: reportSnapshots.summaryData,
    })
      .from(reportSnapshots)
      .where(and(...conditions))
      .orderBy(desc(reportSnapshots.generatedAt))
      .limit(limit);

    return results;
  }

  async getSnapshotDetail(snapshotId: number) {
    const db = await getDb();
    const [snapshot] = await db.select()
      .from(reportSnapshots)
      .where(eq(reportSnapshots.id, snapshotId))
      .limit(1);
    return snapshot || null;
  }
}

export const lowStockReportService = new LowStockReportService();
