import { storage } from '../../../storage';
import { getDb } from '../../../db';
import { runningHoursAudit } from '@shared/schema';
import { desc, asc, eq, and, gte, lte, or, ilike, sql, inArray } from 'drizzle-orm';
import type { InsertRunningHoursAudit, RunningHoursAudit, Component } from '@shared/schema';

// ── Component Queries ──

export async function getComponents(vesselId: string, vesselIds?: string[]): Promise<Component[]> {
  return storage.getComponents(vesselId, vesselIds);
}

export async function getComponent(id: string): Promise<Component | undefined> {
  return storage.getComponent(id);
}

export async function updateComponent(id: string, data: Partial<Component>): Promise<Component> {
  return storage.updateComponent(id, data);
}

// ── Utilization Rate ──

export async function getEarliestAuditTimestamp(vesselId: string): Promise<Date | null> {
  return storage.getEarliestAuditTimestamp(vesselId);
}

export async function sumPositiveDeltasInPeriod(componentId: string, startDate: Date, endDate: Date): Promise<number> {
  return storage.sumPositiveDeltasInPeriod(componentId, startDate, endDate);
}

export async function getRunningHoursAtDate(componentId: string, targetDate: Date): Promise<{ runningHours: number; enteredAtUTC: Date; isFallback?: boolean } | null> {
  return storage.getRunningHoursAtDate(componentId, targetDate);
}

// ── Running Hours Audit ──

export async function getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
  return storage.getRunningHoursAudits(componentId, limit);
}

// ── Batched RH lookups (avoid per-component N+1 in listParents) ──

export interface RHAtDate {
  runningHours: number;
  enteredAtUTC: Date;
  isFallback: boolean;
}

// Mirrors storage.getRunningHoursAtDate (latest entry at/before target, else
// earliest entry after target as fallback) but resolves ALL components in one
// or two round-trips instead of one query per component. Keys are cuuids.
export async function getRunningHoursAtDateBatch(
  componentIds: string[],
  targetDate: Date
): Promise<Map<string, RHAtDate>> {
  const result = new Map<string, RHAtDate>();
  if (componentIds.length === 0) return result;
  const db = await getDb();

  // NOTE: use [0-9] not \d — inside a JS sql`` template literal, "\d" is cooked to
  // "d", producing a regex that never matches ISO dates and crashes TO_TIMESTAMP on
  // the DD-Mon-YYYY branch ("invalid value ... for Mon"). [0-9] survives intact.
  const parsedDateExpr = sql`CASE 
    WHEN ${runningHoursAudit.dateUpdatedLocal} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
      THEN TO_TIMESTAMP(${runningHoursAudit.dateUpdatedLocal}, 'YYYY-MM-DD')
    ELSE TO_TIMESTAMP(REPLACE(${runningHoursAudit.dateUpdatedLocal}, ' ', '-'), 'DD-Mon-YYYY-HH24:MI')
  END`;

  // Primary: latest entry at or before targetDate, one row per component.
  const primary = await db
    .selectDistinctOn([runningHoursAudit.componentId], {
      componentId: runningHoursAudit.componentId,
      runningHours: runningHoursAudit.cumulativeRH,
      enteredAtUTC: runningHoursAudit.enteredAtUTC,
    })
    .from(runningHoursAudit)
    .where(and(
      inArray(runningHoursAudit.componentId, componentIds),
      sql`${parsedDateExpr} <= ${targetDate}`
    ))
    .orderBy(runningHoursAudit.componentId, sql`${parsedDateExpr} DESC`);

  for (const row of primary) {
    result.set(row.componentId, {
      runningHours: parseFloat(row.runningHours || '0'),
      enteredAtUTC: row.enteredAtUTC,
      isFallback: false,
    });
  }

  // Fallback: earliest entry after targetDate, only for components with no primary hit.
  const missing = componentIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    const fallback = await db
      .selectDistinctOn([runningHoursAudit.componentId], {
        componentId: runningHoursAudit.componentId,
        runningHours: runningHoursAudit.cumulativeRH,
        enteredAtUTC: runningHoursAudit.enteredAtUTC,
      })
      .from(runningHoursAudit)
      .where(and(
        inArray(runningHoursAudit.componentId, missing),
        sql`${parsedDateExpr} > ${targetDate}`
      ))
      .orderBy(runningHoursAudit.componentId, sql`${parsedDateExpr} ASC`);

    for (const row of fallback) {
      result.set(row.componentId, {
        runningHours: parseFloat(row.runningHours || '0'),
        enteredAtUTC: row.enteredAtUTC,
        isFallback: true,
      });
    }
  }

  return result;
}

// Latest audit userId per component (mirrors storage.getRunningHoursAudits(id, 1)
// reading audits[0].userId) in a single round-trip. Keys are cuuids.
export async function getLatestAuditUserBatch(
  componentIds: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (componentIds.length === 0) return result;
  const db = await getDb();

  const rows = await db
    .selectDistinctOn([runningHoursAudit.componentId], {
      componentId: runningHoursAudit.componentId,
      userId: runningHoursAudit.userId,
    })
    .from(runningHoursAudit)
    .where(inArray(runningHoursAudit.componentId, componentIds))
    .orderBy(runningHoursAudit.componentId, desc(runningHoursAudit.enteredAtUTC));

  for (const row of rows) {
    result.set(row.componentId, row.userId || null);
  }

  return result;
}

export async function createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
  return storage.createRunningHoursAudit(audit);
}

// ── Cascade ──

export async function cascadeRunningHoursUpdate(params: {
  parentComponentId: string;
  mode: 'setTotal' | 'addDelta';
  value: number;
  dateUpdated: string;
  comments?: string;
  userId?: string;
  userUuid?: string;
  meterReplaced?: boolean;
  oldMeterFinal?: string;
  newMeterStart?: string;
}): Promise<{
  updatedComponents: number;
  auditsCreated: number;
  workOrdersGenerated: number;
  workOrders: any[];
}> {
  return storage.cascadeRunningHoursUpdate(params);
}

// ── RH Counter Type / Config ──

export async function getMasterComponents(vesselId: string): Promise<Component[]> {
  return storage.getMasterComponents(vesselId);
}

export async function getInheritedComponents(masterComponentId: string, vesselId?: string): Promise<Component[]> {
  return storage.getInheritedComponents(masterComponentId, vesselId);
}

export async function updateRHConfig(params: {
  componentId: string;
  rhCounterType: 'MASTER' | 'INHERITED' | 'NOT_RH_DRIVEN';
  rhMasterComponentId?: string | null;
  userId?: string;
}): Promise<Component> {
  return storage.updateRHConfig(params);
}

export async function updateMasterRunningHours(params: {
  componentId: string;
  newRHValue: number;
  updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION';
  userId: string;
  userUuid?: string;
  comments?: string;
}): Promise<{
  masterUpdated: Component;
  inheritedUpdated: number;
}> {
  return storage.updateMasterRunningHours(params);
}

// ── Running Hours History (from running_hours_audit) ──

export interface RHHistoryQuery {
  vesselId: string;
  componentId?: string;
  page: number;
  pageSize: number;
  sortOrder: 'asc' | 'desc';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RHHistoryRow {
  id: number;
  updatedAt: Date | null;
  componentCode: string | null;
  componentName: string | null;
  previousRh: string;
  newRh: string;
  deltaRh: string;
  updatedBy: string;
  updateSource: string;
  notes: string | null;
}

export interface RHHistoryResult {
  data: RHHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getRunningHoursHistory(query: RHHistoryQuery): Promise<RHHistoryResult> {
  const db = await getDb();

  const conditions: any[] = [];

  if (query.componentId) {
    conditions.push(eq(runningHoursAudit.componentId, query.componentId));
  } else if (query.vesselId) {
    conditions.push(eq(runningHoursAudit.vesselId, query.vesselId));
  }

  if (query.dateFrom) {
    conditions.push(gte(runningHoursAudit.enteredAtUTC, new Date(query.dateFrom)));
  }
  if (query.dateTo) {
    const endDate = new Date(query.dateTo);
    endDate.setHours(23, 59, 59, 999);
    conditions.push(lte(runningHoursAudit.enteredAtUTC, endDate));
  }

  if (query.search) {
    const searchPattern = `%${query.search}%`;
    conditions.push(
      or(
        ilike(runningHoursAudit.componentCode, searchPattern),
        ilike(runningHoursAudit.componentName, searchPattern),
        ilike(runningHoursAudit.userId, searchPattern),
        ilike(runningHoursAudit.source, searchPattern),
        ilike(runningHoursAudit.notes, searchPattern)
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(runningHoursAudit)
    .where(whereClause);

  const total = Number(countResult?.count || 0);
  const totalPages = Math.ceil(total / query.pageSize);
  const offset = (query.page - 1) * query.pageSize;

  const orderBy = query.sortOrder === 'asc'
    ? asc(runningHoursAudit.enteredAtUTC)
    : desc(runningHoursAudit.enteredAtUTC);

  const rows = await db
    .select()
    .from(runningHoursAudit)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(query.pageSize)
    .offset(offset);

  const data: RHHistoryRow[] = rows.map(row => {
    const prevRH = parseFloat(row.previousRH || '0');
    const newRH = parseFloat(row.newRH || '0');
    const delta = newRH - prevRH;
    return {
      id: row.id,
      updatedAt: row.enteredAtUTC,
      componentCode: row.componentCode,
      componentName: row.componentName,
      previousRh: row.previousRH,
      newRh: row.newRH,
      deltaRh: delta.toFixed(2),
      updatedBy: row.userId,
      updateSource: row.source,
      notes: row.notes,
    };
  });

  return {
    data,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
  };
}
