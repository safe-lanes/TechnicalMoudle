import { storage } from '../../../storage';
import { getDb } from '../../../db';
import { runningHoursAudit, componentMaintenanceHistory } from '@shared/schema';
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

// A master component identified by BOTH its primary id and its cuuid. Audit rows
// may be keyed by either (legacy rows can use the non-cuuid id), mirroring the
// dual-identifier lookup in storage.getRunningHoursAtDate
// (component_id = resolvedId OR component_id = originalId).
export interface MasterRef {
  id: string;
  cuuid: string;
}

// Build the union of distinct identifiers to query plus a reverse map from each
// identifier back to the owning master cuuid (so results collapse onto cuuid).
function buildIdentifierIndex(masters: MasterRef[]): {
  identifiers: string[];
  idToCuuid: Map<string, string>;
} {
  const idToCuuid = new Map<string, string>();
  for (const m of masters) {
    if (m.cuuid) idToCuuid.set(m.cuuid, m.cuuid);
    if (m.id) idToCuuid.set(String(m.id), m.cuuid);
  }
  return { identifiers: Array.from(idToCuuid.keys()), idToCuuid };
}

// Mirrors storage.getRunningHoursAtDate (latest entry at/before target, else
// earliest entry after target as fallback) but resolves ALL components in one
// or two round-trips instead of one query per component. Accepts dual
// identifiers per master and returns a Map keyed by master cuuid.
export async function getRunningHoursAtDateBatch(
  masters: MasterRef[],
  targetDate: Date
): Promise<Map<string, RHAtDate>> {
  const result = new Map<string, RHAtDate>();
  if (masters.length === 0) return result;
  const db = await getDb();
  const { identifiers, idToCuuid } = buildIdentifierIndex(masters);
  if (identifiers.length === 0) return result;

  // NOTE: use [0-9] not \d — inside a JS sql`` template literal, "\d" is cooked to
  // "d", producing a regex that never matches ISO dates and crashes TO_TIMESTAMP on
  // the DD-Mon-YYYY branch ("invalid value ... for Mon"). [0-9] survives intact.
  const parsedDateExpr = sql`CASE 
    WHEN ${runningHoursAudit.dateUpdatedLocal} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
      THEN TO_TIMESTAMP(${runningHoursAudit.dateUpdatedLocal}, 'YYYY-MM-DD')
    ELSE TO_TIMESTAMP(REPLACE(${runningHoursAudit.dateUpdatedLocal}, ' ', '-'), 'DD-Mon-YYYY-HH24:MI')
  END`;

  // Per-cuuid reducer: keep the row with the latest (primary) / earliest (fallback)
  // parsed date, so audits split across legacy id + cuuid still collapse correctly.
  const parsedTimes = new Map<string, number>();
  const apply = (
    cuuid: string,
    runningHours: number,
    enteredAtUTC: Date,
    parsedMs: number,
    isFallback: boolean,
    preferLatest: boolean
  ) => {
    const existing = parsedTimes.get(cuuid);
    if (existing === undefined || (preferLatest ? parsedMs > existing : parsedMs < existing)) {
      parsedTimes.set(cuuid, parsedMs);
      result.set(cuuid, { runningHours, enteredAtUTC, isFallback });
    }
  };

  // Primary: latest entry at or before targetDate, one row per audit identifier.
  const primary = await db
    .selectDistinctOn([runningHoursAudit.componentId], {
      componentId: runningHoursAudit.componentId,
      runningHours: runningHoursAudit.cumulativeRH,
      enteredAtUTC: runningHoursAudit.enteredAtUTC,
      parsedAt: sql<string>`${parsedDateExpr}`,
    })
    .from(runningHoursAudit)
    .where(and(
      inArray(runningHoursAudit.componentId, identifiers),
      sql`${parsedDateExpr} <= ${targetDate}`
    ))
    .orderBy(runningHoursAudit.componentId, sql`${parsedDateExpr} DESC`);

  for (const row of primary) {
    const cuuid = idToCuuid.get(row.componentId);
    if (!cuuid) continue;
    apply(cuuid, parseFloat(row.runningHours || '0'), row.enteredAtUTC,
      new Date(row.parsedAt).getTime(), false, true);
  }

  // Fallback: earliest entry after targetDate, only for masters with no primary hit.
  const missing = masters.filter((m) => !result.has(m.cuuid));
  if (missing.length > 0) {
    const { identifiers: missingIds } = buildIdentifierIndex(missing);
    const fallback = await db
      .selectDistinctOn([runningHoursAudit.componentId], {
        componentId: runningHoursAudit.componentId,
        runningHours: runningHoursAudit.cumulativeRH,
        enteredAtUTC: runningHoursAudit.enteredAtUTC,
        parsedAt: sql<string>`${parsedDateExpr}`,
      })
      .from(runningHoursAudit)
      .where(and(
        inArray(runningHoursAudit.componentId, missingIds),
        sql`${parsedDateExpr} > ${targetDate}`
      ))
      .orderBy(runningHoursAudit.componentId, sql`${parsedDateExpr} ASC`);

    for (const row of fallback) {
      const cuuid = idToCuuid.get(row.componentId);
      if (!cuuid) continue;
      apply(cuuid, parseFloat(row.runningHours || '0'), row.enteredAtUTC,
        new Date(row.parsedAt).getTime(), true, false);
    }
  }

  return result;
}

// Latest audit userId per component (mirrors storage.getRunningHoursAudits(id, 1)
// reading audits[0].userId) in a single round-trip. Accepts dual identifiers per
// master and returns a Map keyed by master cuuid.
export interface AuditUserEntry {
  userId: string | null;
  auditDate: string | null;
}

export async function getLatestAuditUserBatch(
  masters: MasterRef[]
): Promise<Map<string, AuditUserEntry>> {
  const result = new Map<string, AuditUserEntry>();
  if (masters.length === 0) return result;
  const db = await getDb();
  const { identifiers, idToCuuid } = buildIdentifierIndex(masters);
  if (identifiers.length === 0) return result;

  const rows = await db
    .selectDistinctOn([runningHoursAudit.componentId], {
      componentId: runningHoursAudit.componentId,
      userId: runningHoursAudit.userId,
      enteredAtUTC: runningHoursAudit.enteredAtUTC,
      dateUpdatedLocal: runningHoursAudit.dateUpdatedLocal,
    })
    .from(runningHoursAudit)
    .where(inArray(runningHoursAudit.componentId, identifiers))
    .orderBy(runningHoursAudit.componentId, desc(runningHoursAudit.enteredAtUTC));

  // Collapse onto master cuuid, keeping the most recent audit when rows are split
  // across legacy id + cuuid.
  const latestTimes = new Map<string, number>();
  for (const row of rows) {
    const cuuid = idToCuuid.get(row.componentId);
    if (!cuuid) continue;
    const t = row.enteredAtUTC ? new Date(row.enteredAtUTC).getTime() : 0;
    const existing = latestTimes.get(cuuid);
    if (existing === undefined || t >= existing) {
      latestTimes.set(cuuid, t);
      result.set(cuuid, {
        userId: row.userId || null,
        auditDate: row.dateUpdatedLocal || null,
      });
    }
  }

  return result;
}

// Latest APPROVED completion date per master component, from
// component_maintenance_history. component_maintenance_history.component_id is
// always a cuuid (FK → components.cuuid), so no dual-identifier resolution is
// needed here. dateCompleted is text ISO (YYYY-MM-DD), so lexicographic DESC =
// most recent. Returns a Map keyed by master cuuid → ISO date string.
export async function getLatestCompletedDateBatch(
  masters: MasterRef[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (masters.length === 0) return result;
  const db = await getDb();
  const cuuids = Array.from(new Set(masters.map((m) => m.cuuid).filter(Boolean)));
  if (cuuids.length === 0) return result;

  const rows = await db
    .selectDistinctOn([componentMaintenanceHistory.componentId], {
      componentId: componentMaintenanceHistory.componentId,
      dateCompleted: componentMaintenanceHistory.dateCompleted,
    })
    .from(componentMaintenanceHistory)
    .where(and(
      inArray(componentMaintenanceHistory.componentId, cuuids),
      eq(componentMaintenanceHistory.status, 'Approved'),
      sql`coalesce(${componentMaintenanceHistory.isDeleted}, false) = false`
    ))
    .orderBy(componentMaintenanceHistory.componentId, desc(componentMaintenanceHistory.dateCompleted));

  for (const row of rows) {
    if (row.dateCompleted) result.set(row.componentId, row.dateCompleted);
  }
  return result;
}

export async function createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
  return storage.createRunningHoursAudit(audit);
}

export interface MeterReplacementEvent {
  id: number;
  enteredAtUTC: Date | null;
  dateUpdatedLocal: string;
  renewalActionType: string | null;
  renewalReason: string | null;
  renewalReference: string | null;
  oldMeterFinal: string | null;
  newMeterStart: string | null;
  userId: string;
  notes: string | null;
}

export async function getMeterReplacementHistory(componentId: string): Promise<MeterReplacementEvent[]> {
  const db = await getDb();
  // Resolve componentId to cuuid so legacy rows stored by non-cuuid id are found too
  const comp = await storage.getComponent(componentId);
  const resolvedId = comp?.cuuid || componentId;

  const rows = await db
    .select({
      id: runningHoursAudit.id,
      enteredAtUTC: runningHoursAudit.enteredAtUTC,
      dateUpdatedLocal: runningHoursAudit.dateUpdatedLocal,
      renewalActionType: runningHoursAudit.renewalActionType,
      renewalReason: runningHoursAudit.renewalReason,
      renewalReference: runningHoursAudit.renewalReference,
      oldMeterFinal: runningHoursAudit.oldMeterFinal,
      newMeterStart: runningHoursAudit.newMeterStart,
      userId: runningHoursAudit.userId,
      notes: runningHoursAudit.notes,
    })
    .from(runningHoursAudit)
    .where(
      and(
        or(
          eq(runningHoursAudit.componentId, resolvedId),
          eq(runningHoursAudit.componentId, componentId)
        ),
        or(
          eq(runningHoursAudit.meterReplaced, true),
          eq(runningHoursAudit.isRenewalReset, true)
        )
      )
    )
    .orderBy(desc(runningHoursAudit.enteredAtUTC));

  return rows.map(r => ({
    id: r.id,
    enteredAtUTC: r.enteredAtUTC,
    dateUpdatedLocal: r.dateUpdatedLocal,
    renewalActionType: r.renewalActionType,
    renewalReason: r.renewalReason,
    renewalReference: r.renewalReference,
    oldMeterFinal: r.oldMeterFinal ? String(r.oldMeterFinal) : null,
    newMeterStart: r.newMeterStart ? String(r.newMeterStart) : null,
    userId: r.userId,
    notes: r.notes,
  }));
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
  dateUpdated?: string;
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
