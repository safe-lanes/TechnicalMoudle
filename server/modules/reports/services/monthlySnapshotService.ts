import { getDb } from '../../../db';
import { isUnplannedWorkOrderNo } from '../../../utils/workOrderStatus';
import { monthlySnapshots } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as repo from '../repositories/reportRepository';
import { computeWorkOrderStatus, buildCompanyGraceConfig } from '@shared/workOrders/status';
import type { CompanyStandardGraceConfig, VesselGraceSettings } from '@shared/workOrders/status';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import { storage } from '../../../storage';

function buildVesselGraceSettings(vesselSettings: Record<string, unknown> | null | undefined): VesselGraceSettings {
  if (!vesselSettings) {
    return {
      calendarGraceMode: 'COMPANY_STANDARD',
      calendarGraceDays: WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
      rhGraceHours: WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    };
  }
  return {
    calendarGraceMode: ((vesselSettings.calendarGraceMode as string) || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
    calendarGraceDays: (vesselSettings.calendarGraceDays as number) ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: (vesselSettings.rhGraceHours as number) ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: vesselSettings.rhLeadTimeHours as number | undefined,
  };
}

const SNAPSHOT_CATEGORIES = ['Planned', 'Due', 'Overdue', 'Postponed', 'Unplanned', 'Pending Approval', 'Completed'] as const;
type SnapshotCategory = typeof SNAPSHOT_CATEGORIES[number];

interface CategoryBucket {
  count: number;
  woIds: string[];
}

interface WorkOrderRecord {
  wouuid?: string;
  id: string;
  workOrderType?: string;
  taskType?: string | null;
  status?: string;
  isExecution?: boolean;
  dataScope?: string;
  jobId?: string;
  componentCode?: string | null;
  component?: string;
  maintenanceBasis?: string;
  dueDateSnapshot?: string | null;
  dueDate?: string | null;
  nextDueReading?: string | number | null;
  currentReading?: string | number | null;
  completionDateTime?: string | null;
  createdAt?: string | Date | null;
  department?: string | null;
  assignedDepartment?: string | null;
  workOrderNo?: string | null;
  jobTitle?: string | null;
  [key: string]: unknown;
}

interface JobRecord {
  juuid: string;
  maintenanceBasis?: string;
  nextDueRH?: string | number | null;
  jobTitle?: string | null;
  frequencyUnit?: string | null;
  frequencyValue?: string | number | null;
  [key: string]: unknown;
}

interface ComponentRecord {
  cuuid: string;
  componentCode: string;
  name?: string | null;
  currentCumulativeRH?: string | number | null;
  [key: string]: unknown;
}

interface PostponementRecord {
  workOrderId: string;
  submittedDate?: string | null;
  createdAt?: string | Date | null;
  [key: string]: unknown;
}

function getMonthBoundaries(year: number, month: number) {
  const opening = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const closing = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
  return { opening, closing, monthKey: `${year}-${String(month).padStart(2, '0')}` };
}

function isUnplannedWO(wo: WorkOrderRecord, hasLinkedJob: boolean): boolean {
  if (!hasLinkedJob) return true;
  if (wo.workOrderType === 'Unplanned') return true;
  if (wo.taskType && (
    wo.taskType.toLowerCase().includes('unplanned') ||
    wo.taskType.toLowerCase().includes('breakdown')
  )) return true;
  if (isUnplannedWorkOrderNo(wo.workOrderNo)) return true;
  return false;
}

function isPendingApprovalExecution(wo: WorkOrderRecord): boolean {
  const FINALIZED_STATUSES = new Set(['completed', 'approved', 'closed', 'cancelled']);
  const normalizedStatus = (wo.status || '').toLowerCase().trim();
  return wo.isExecution === true && !FINALIZED_STATUSES.has(normalizedStatus);
}

function mapStatusToCategory(
  computedStatus: string,
  wo: WorkOrderRecord,
  hasLinkedJob: boolean
): SnapshotCategory {
  if (isUnplannedWO(wo, hasLinkedJob)) return 'Unplanned';
  if (wo.status === 'Postponed') return 'Postponed';
  if (isPendingApprovalExecution(wo)) return 'Pending Approval';

  switch (computedStatus) {
    case 'Completed':
      return 'Completed';
    case 'Overdue':
      return 'Overdue';
    case 'Due':
    case 'Due (Grace P)':
      return 'Due';
    case 'Active':
    default:
      return 'Planned';
  }
}

function parseRH(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseDateAny(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const ddMmmYyyy = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMmmYyyy) {
    const months: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const day = parseInt(ddMmmYyyy[1], 10);
    const m = months[ddMmmYyyy[2]];
    const y = parseInt(ddMmmYyyy[3], 10);
    if (m !== undefined) return new Date(Date.UTC(y, m, day));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function computeSnapshotAtTimestamp(
  vesselId: string,
  snapshotDate: Date
): Promise<Record<SnapshotCategory, CategoryBucket>> {
  const allWorkOrders = await repo.getWorkOrders(vesselId) as unknown as WorkOrderRecord[];
  const jobs = await repo.getJobs(vesselId) as unknown as JobRecord[];
  const components = await repo.getComponents(vesselId) as unknown as ComponentRecord[];

  const jobsMap = new Map(jobs.map(j => [j.juuid, j]));
  const componentsByCodeMap = new Map(components.map(c => [c.componentCode, c]));
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));

  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig: CompanyStandardGraceConfig = buildCompanyGraceConfig(companyGraceRow);

  const vesselSettings = await repo.getPmsVesselSettings(vesselId);
  const vesselGraceSettings = buildVesselGraceSettings(vesselSettings);

  const categoryCounts: Record<SnapshotCategory, CategoryBucket> = {
    'Planned': { count: 0, woIds: [] },
    'Due': { count: 0, woIds: [] },
    'Overdue': { count: 0, woIds: [] },
    'Postponed': { count: 0, woIds: [] },
    'Unplanned': { count: 0, woIds: [] },
    'Pending Approval': { count: 0, woIds: [] },
    'Completed': { count: 0, woIds: [] },
  };

  const vesselWOs = allWorkOrders.filter(wo => {
    if (wo.dataScope !== 'vessel') return false;
    const woCreatedAt = wo.createdAt ? new Date(wo.createdAt as string | Date) : null;
    if (woCreatedAt && woCreatedAt > snapshotDate) return false;
    return true;
  });

  for (const wo of vesselWOs) {
    const FINALIZED = new Set(['completed', 'approved', 'closed', 'cancelled']);
    const normalizedStatus = (wo.status || '').toLowerCase().trim();

    const completionDt = wo.completionDateTime ? new Date(wo.completionDateTime) : null;
    const completedByBoundary = completionDt && !isNaN(completionDt.getTime()) && completionDt <= snapshotDate;

    if (wo.isExecution && FINALIZED.has(normalizedStatus) && completedByBoundary) continue;
    if (wo.isExecution && FINALIZED.has(normalizedStatus) && !completedByBoundary) {
    }

    const effectiveCompletionDateTime = completedByBoundary ? wo.completionDateTime : null;
    const effectiveStatus = (FINALIZED.has(normalizedStatus) && !completedByBoundary)
      ? (wo.isExecution ? 'In Progress' : 'Active')
      : wo.status;

    const job = wo.jobId ? jobsMap.get(wo.jobId) : undefined;
    const hasLinkedJob = !!(wo.jobId && job);
    const component = wo.componentCode
      ? componentsByCodeMap.get(wo.componentCode)
      : (wo.component ? componentsMap.get(wo.component) : undefined);

    const maintenanceBasis = wo.maintenanceBasis || job?.maintenanceBasis || 'Calendar';
    const dueDate = wo.dueDateSnapshot || wo.dueDate || null;
    const dueRH = parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading);
    const currentRH = parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading);

    const computedStatus = computeWorkOrderStatus({
      dueDate,
      dueRH,
      currentRH,
      isExecution: wo.isExecution,
      status: effectiveStatus,
      completionDateTime: effectiveCompletionDateTime,
      maintenanceBasis,
      vesselGraceSettings,
      companyGraceConfig,
      referenceDate: snapshotDate,
    });

    const category = mapStatusToCategory(computedStatus, wo, hasLinkedJob);
    categoryCounts[category].count++;
    categoryCounts[category].woIds.push(wo.wouuid || wo.id);
  }

  return categoryCounts;
}

export async function ensureSnapshotsExist(vesselId: string, year: number, month: number) {
  const db = await getDb();
  const { opening, closing, monthKey } = getMonthBoundaries(year, month);

  const existing = await db.select()
    .from(monthlySnapshots)
    .where(and(
      eq(monthlySnapshots.vesselId, vesselId),
      eq(monthlySnapshots.snapshotMonth, monthKey)
    ));

  const hasOpening = existing.some(s => s.snapshotType === 'opening');
  const hasClosing = existing.some(s => s.snapshotType === 'closing');

  if (hasOpening && hasClosing) {
    return existing;
  }

  if (!hasOpening) {
    const openingData = await computeSnapshotAtTimestamp(vesselId, opening);
    for (const cat of SNAPSHOT_CATEGORIES) {
      await db.insert(monthlySnapshots).values({
        vesselId,
        snapshotMonth: monthKey,
        snapshotType: 'opening',
        snapshotTimestamp: opening,
        category: cat,
        count: openingData[cat].count,
        workOrderIds: openingData[cat].woIds,
      }).onConflictDoUpdate({
        target: [monthlySnapshots.vesselId, monthlySnapshots.snapshotMonth, monthlySnapshots.snapshotType, monthlySnapshots.category],
        set: {
          count: sql`excluded.count`,
          workOrderIds: sql`excluded.work_order_ids`,
          generatedAt: sql`NOW()`,
        },
      });
    }
  }

  if (!hasClosing) {
    const closingData = await computeSnapshotAtTimestamp(vesselId, closing);
    for (const cat of SNAPSHOT_CATEGORIES) {
      await db.insert(monthlySnapshots).values({
        vesselId,
        snapshotMonth: monthKey,
        snapshotType: 'closing',
        snapshotTimestamp: closing,
        category: cat,
        count: closingData[cat].count,
        workOrderIds: closingData[cat].woIds,
      }).onConflictDoUpdate({
        target: [monthlySnapshots.vesselId, monthlySnapshots.snapshotMonth, monthlySnapshots.snapshotType, monthlySnapshots.category],
        set: {
          count: sql`excluded.count`,
          workOrderIds: sql`excluded.work_order_ids`,
          generatedAt: sql`NOW()`,
        },
      });
    }
  }

  return db.select()
    .from(monthlySnapshots)
    .where(and(
      eq(monthlySnapshots.vesselId, vesselId),
      eq(monthlySnapshots.snapshotMonth, monthKey)
    ));
}

export async function computeMonthlyMovement(vesselId: string, year: number, month: number) {
  const { opening, closing } = getMonthBoundaries(year, month);

  const allWorkOrders = await repo.getWorkOrders(vesselId) as unknown as WorkOrderRecord[];
  const vesselWOs = allWorkOrders.filter(wo => wo.dataScope === 'vessel');

  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig: CompanyStandardGraceConfig = buildCompanyGraceConfig(companyGraceRow);

  const vesselSettings = await repo.getPmsVesselSettings(vesselId);
  const vesselGraceSettings = buildVesselGraceSettings(vesselSettings);

  const isInMonth = (d: Date | null) => {
    if (!d) return false;
    return d >= opening && d <= closing;
  };

  let newJobsEntered = 0;
  const newJobsEnteredIds: string[] = [];
  let completedInMonth = 0;
  const completedInMonthIds: string[] = [];
  let unplannedRaised = 0;
  const unplannedRaisedIds: string[] = [];
  let sentToPendingApproval = 0;
  const sentToPendingApprovalIds: string[] = [];
  let newlyOverdue = 0;
  const newlyOverdueIds: string[] = [];

  const jobs = await repo.getJobs(vesselId) as unknown as JobRecord[];
  const jobsMap = new Map(jobs.map(j => [j.juuid, j]));

  for (const wo of vesselWOs) {
    const createdAt = wo.createdAt ? new Date(wo.createdAt as string | Date) : null;
    const completionDate = parseDateAny(wo.completionDateTime);
    const woId = wo.wouuid || wo.id;

    const job = wo.jobId ? jobsMap.get(wo.jobId) : undefined;
    const hasLinkedJob = !!(wo.jobId && job);

    if (isInMonth(createdAt)) {
      newJobsEntered++;
      newJobsEnteredIds.push(woId);

      if (isUnplannedWO(wo, hasLinkedJob)) {
        unplannedRaised++;
        unplannedRaisedIds.push(woId);
      }
    }

    const FINALIZED = new Set(['completed', 'approved', 'closed']);
    const normalizedStatus = (wo.status || '').toLowerCase().trim();
    if (FINALIZED.has(normalizedStatus) && isInMonth(completionDate)) {
      completedInMonth++;
      completedInMonthIds.push(woId);
    }

    if (wo.isExecution) {
      const execCreatedAt = wo.createdAt ? new Date(wo.createdAt as string | Date) : null;
      if (isInMonth(execCreatedAt)) {
        sentToPendingApproval++;
        sentToPendingApprovalIds.push(woId);
      }
    }

    const dueDate = wo.dueDateSnapshot || wo.dueDate || null;
    if (dueDate && !FINALIZED.has(normalizedStatus)) {
      const maintenanceBasis = wo.maintenanceBasis || job?.maintenanceBasis || 'Calendar';

      if (maintenanceBasis === 'Calendar') {
        const statusAtOpening = computeWorkOrderStatus({
          dueDate,
          isExecution: wo.isExecution,
          status: wo.status,
          completionDateTime: wo.completionDateTime,
          maintenanceBasis,
          vesselGraceSettings,
          companyGraceConfig,
          referenceDate: opening,
        });
        const statusAtClosing = computeWorkOrderStatus({
          dueDate,
          isExecution: wo.isExecution,
          status: wo.status,
          completionDateTime: wo.completionDateTime,
          maintenanceBasis,
          vesselGraceSettings,
          companyGraceConfig,
          referenceDate: closing,
        });

        if (statusAtOpening !== 'Overdue' && statusAtClosing === 'Overdue') {
          newlyOverdue++;
          newlyOverdueIds.push(woId);
        }
      }
    }
  }

  let postponedInMonth = 0;
  const postponedInMonthIds: string[] = [];
  try {
    const postponements = await repo.getWorkOrderPostponements(vesselId) as unknown as PostponementRecord[];
    if (Array.isArray(postponements)) {
      for (const p of postponements) {
        const pDateStr = p.submittedDate || (p.createdAt ? new Date(p.createdAt).toISOString() : null);
        const pDate = parseDateAny(pDateStr);
        if (isInMonth(pDate)) {
          postponedInMonth++;
          postponedInMonthIds.push(p.workOrderId);
        }
      }
    }
  } catch {
    console.log('[MONTHLY MOVEMENT] No postponement data available');
  }

  return {
    newJobsEntered: { count: newJobsEntered, woIds: newJobsEnteredIds },
    completedInMonth: { count: completedInMonth, woIds: completedInMonthIds },
    postponedInMonth: { count: postponedInMonth, woIds: postponedInMonthIds },
    newlyOverdue: { count: newlyOverdue, woIds: newlyOverdueIds },
    unplannedRaised: { count: unplannedRaised, woIds: unplannedRaisedIds },
    sentToPendingApproval: { count: sentToPendingApproval, woIds: sentToPendingApprovalIds },
  };
}

export async function getMonthlySummaryData(vesselId: string, year: number, month: number) {
  const snapshots = await ensureSnapshotsExist(vesselId, year, month);
  const movement = await computeMonthlyMovement(vesselId, year, month);

  const opening: Record<string, CategoryBucket> = {};
  const closing: Record<string, CategoryBucket> = {};

  for (const snap of snapshots) {
    const data: CategoryBucket = { count: snap.count, woIds: snap.workOrderIds || [] };
    if (snap.snapshotType === 'opening') {
      opening[snap.category] = data;
    } else {
      closing[snap.category] = data;
    }
  }

  const openingTotal = Object.values(opening).reduce((sum, v) => sum + v.count, 0);
  const openingOverdue = opening['Overdue']?.count || 0;
  const closingOverdue = closing['Overdue']?.count || 0;

  const indicators = {
    completionRate: movement.completedInMonth.count > 0 && openingTotal > 0
      ? Math.round((movement.completedInMonth.count / openingTotal) * 100) : 0,
    overdueChange: closingOverdue - openingOverdue,
    postponementCount: movement.postponedInMonth.count,
    unplannedCount: movement.unplannedRaised.count,
  };

  const allVessels = await repo.getVessels();
  const vessel = allVessels.find((v: { id: string; vuuid?: string; name?: string }) => v.id === vesselId || v.vuuid === vesselId);
  const vesselName = vessel?.name || vesselId;

  const snapshotMeta = snapshots.map(s => ({
    id: s.id,
    type: s.snapshotType,
    category: s.category,
    count: s.count,
    generatedAt: s.generatedAt,
    timestamp: s.snapshotTimestamp,
    workOrderIds: s.workOrderIds || [],
  }));

  return {
    vesselName,
    month: year + '-' + String(month).padStart(2, '0'),
    opening,
    movement,
    closing,
    indicators,
    snapshotMeta,
  };
}

interface DrilldownRow {
  workOrderNo: string;
  jobTitle: string;
  componentCode: string;
  componentName: string;
  dueDate: string;
  status: string;
  maintenanceBasis: string;
  department: string;
}

function buildDrilldownRows(
  woIds: string[],
  allWorkOrders: WorkOrderRecord[],
  jobsMap: Map<string, JobRecord>,
  componentsByCodeMap: Map<string, ComponentRecord>,
  componentsMap: Map<string, ComponentRecord>
): DrilldownRow[] {
  const woIdSet = new Set(woIds);
  return allWorkOrders
    .filter(wo => woIdSet.has(wo.wouuid || '') || woIdSet.has(wo.id))
    .map(wo => {
      const job = wo.jobId ? jobsMap.get(wo.jobId) : undefined;
      const component = wo.componentCode
        ? componentsByCodeMap.get(wo.componentCode)
        : (wo.component ? componentsMap.get(wo.component) : undefined);
      return {
        workOrderNo: wo.workOrderNo || wo.id,
        jobTitle: wo.jobTitle || job?.jobTitle || '-',
        componentCode: wo.componentCode || '-',
        componentName: component?.name || wo.component || '-',
        dueDate: wo.dueDateSnapshot || wo.dueDate || '-',
        status: wo.status || '-',
        maintenanceBasis: wo.maintenanceBasis || '-',
        department: wo.department || wo.assignedDepartment || '-',
      };
    });
}

export async function getSnapshotDetail(
  vesselId: string,
  year: number,
  month: number,
  snapshotType: string,
  category: string
): Promise<DrilldownRow[]> {
  const db = await getDb();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const [snapshot] = await db.select()
    .from(monthlySnapshots)
    .where(and(
      eq(monthlySnapshots.vesselId, vesselId),
      eq(monthlySnapshots.snapshotMonth, monthKey),
      eq(monthlySnapshots.snapshotType, snapshotType),
      eq(monthlySnapshots.category, category)
    ))
    .limit(1);

  if (!snapshot || !snapshot.workOrderIds || snapshot.workOrderIds.length === 0) {
    return [];
  }

  const allWorkOrders = await repo.getWorkOrders(vesselId) as unknown as WorkOrderRecord[];
  const jobs = await repo.getJobs(vesselId) as unknown as JobRecord[];
  const components = await repo.getComponents(vesselId) as unknown as ComponentRecord[];
  const componentsByCodeMap = new Map(components.map(c => [c.componentCode, c]));
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));
  const jobsMap = new Map(jobs.map(j => [j.juuid, j]));

  return buildDrilldownRows(snapshot.workOrderIds, allWorkOrders, jobsMap, componentsByCodeMap, componentsMap);
}

export async function getMovementDetail(
  vesselId: string,
  year: number,
  month: number,
  movementType: string
): Promise<DrilldownRow[]> {
  const movement = await computeMonthlyMovement(vesselId, year, month);

  const movementMap: Record<string, CategoryBucket> = {
    newJobsEntered: movement.newJobsEntered,
    completedInMonth: movement.completedInMonth,
    postponedInMonth: movement.postponedInMonth,
    newlyOverdue: movement.newlyOverdue,
    unplannedRaised: movement.unplannedRaised,
    sentToPendingApproval: movement.sentToPendingApproval,
  };

  const movementData = movementMap[movementType];
  if (!movementData || movementData.woIds.length === 0) {
    return [];
  }

  const allWorkOrders = await repo.getWorkOrders(vesselId) as unknown as WorkOrderRecord[];
  const jobs = await repo.getJobs(vesselId) as unknown as JobRecord[];
  const components = await repo.getComponents(vesselId) as unknown as ComponentRecord[];
  const componentsByCodeMap = new Map(components.map(c => [c.componentCode, c]));
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));
  const jobsMap = new Map(jobs.map(j => [j.juuid, j]));

  return buildDrilldownRows(movementData.woIds, allWorkOrders, jobsMap, componentsByCodeMap, componentsMap);
}

export async function regenerateSnapshots(vesselId: string, year: number, month: number) {
  const db = await getDb();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  await db.delete(monthlySnapshots)
    .where(and(
      eq(monthlySnapshots.vesselId, vesselId),
      eq(monthlySnapshots.snapshotMonth, monthKey)
    ));

  return ensureSnapshotsExist(vesselId, year, month);
}
