import { storage } from '../../../storage';
import { getDb } from '../../../db';
import { reportSnapshots, storesLedger } from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

// ═══ Vessel lookups ═══
export async function getVessels() {
  return storage.getVessels();
}

// ═══ Components ═══
export async function getComponents(vesselId: string) {
  return storage.getComponents(vesselId);
}

// ═══ Jobs ═══
export async function getJobs(vesselId: string) {
  return storage.getJobs(vesselId);
}

export async function getJobComponentLinks(vesselId: string) {
  return storage.getJobComponentLinks(vesselId);
}

// ═══ Work Orders ═══
export async function getWorkOrders(vesselId: string) {
  return storage.getWorkOrders(vesselId);
}

// ═══ Spares ═══
export async function getSpares(vesselId: string) {
  return storage.getSpares(vesselId);
}

export async function updateSpare(id: string, data: any) {
  return storage.updateSpare(id, data);
}

// ═══ Stores ═══
export async function getStoresItems(vesselId: string) {
  return storage.getStoresItems(vesselId);
}

// ═══ Change Requests ═══
// NOTE: IStorage.getChangeRequests takes a filters object, not a plain vesselId.
// Wrapping here to accept vesselId and pass it as { vesselId }.
export async function getChangeRequests(vesselId?: string) {
  return storage.getChangeRequests(vesselId ? { vesselId } : undefined);
}

// ═══ IHM ═══
export async function getIhmStatusReport(vesselId: string) {
  return storage.getIhmStatusReport(vesselId);
}

// ═══ Running Hours ═══
// NOTE: storage.getRunningHoursLogs does NOT exist in IStorage.
// The closest method is getRunningHoursAudits(componentId, limit?).
// Commented out until a matching storage method is added.
// export async function getRunningHoursLogs(vesselId: string) {
//   return storage.getRunningHoursLogs(vesselId);
// }

// ═══ Report Snapshots (direct Drizzle) ═══
export async function getSnapshots(vesselId: string) {
  const db = await getDb();
  return db.select({
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
    .where(eq(reportSnapshots.vesselId, vesselId))
    .orderBy(desc(reportSnapshots.generatedAt));
}

export async function getSnapshotDetail(snapshotId: number) {
  const db = await getDb();
  const [snapshot] = await db.select()
    .from(reportSnapshots)
    .where(eq(reportSnapshots.id, snapshotId))
    .limit(1);
  return snapshot || null;
}

// ═══ Stores Ledger consumption data (direct Drizzle) ═══
export async function getStoresConsumptionData(vesselId: string, ninetyDaysAgo: Date) {
  const db = await getDb();
  return db.select({
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
}

// ═══ Spare History (consumption) ═══
export async function getSpareHistory(vesselId: string) {
  return storage.getSpareHistory(vesselId);
}

// ═══ Stores Ledger entries ═══
// NOTE: storage.getStoresLedger does NOT exist in IStorage.
// Commented out until a matching storage method is added.
// export async function getStoresLedger(vesselId: string) {
//   return storage.getStoresLedger(vesselId);
// }

// ═══ Stores Transaction History ═══
export async function getStoresTransactionHistory(vesselId: string) {
  return storage.getStoresTransactionHistory(vesselId);
}

// ═══ Stores Items (with optional filter) ═══
export async function getStoresItemsFiltered(vesselId: string, itemType?: string) {
  return storage.getStoresItems(vesselId, itemType);
}

// ═══ Change Request target lookups ═══
export async function getComponent(componentId: string) {
  return storage.getComponent(componentId);
}

export async function getJob(jobId: string) {
  return storage.getJob(jobId);
}

export async function getWorkOrder(workOrderId: string) {
  return storage.getWorkOrder(workOrderId);
}

export async function getSpare(spareId: string) {
  return storage.getSpare(spareId);
}

export async function getStoresItem(storesItemId: string) {
  return storage.getStoresItem(storesItemId);
}

// ═══ Users ═══
export async function getUsers() {
  return storage.getUsers();
}

// ═══ Work Order Postponements ═══
export async function getWorkOrderPostponements(vesselId: string, filters?: any) {
  return storage.getWorkOrderPostponements(vesselId, filters);
}

// ═══ PMS Vessel Settings ═══
export async function getPmsVesselSettings(vesselId: string) {
  return storage.getPmsVesselSettings(vesselId);
}

// ═══ Running Hours Audit ═══
export async function getRunningHoursAudits(componentId: string) {
  return storage.getRunningHoursAudits(componentId);
}
