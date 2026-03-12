import { storage } from '../../../storage';
import { getDb } from '../../../db';
import { runningHoursAudit } from '@shared/schema';
import { desc, asc, eq, and, gte, lte, or, ilike, sql } from 'drizzle-orm';
import type { InsertRunningHoursAudit, RunningHoursAudit, Component } from '@shared/schema';

// ── Component Queries ──

export async function getComponents(vesselId: string): Promise<Component[]> {
  return storage.getComponents(vesselId);
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
