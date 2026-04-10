import { getDb } from '../../../db';
import { monthlySnapshots } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as repo from '../repositories/reportRepository';
import { computeWorkOrderStatus, buildCompanyGraceConfig } from '@shared/workOrders/status';
import { storage } from '../../../storage';

const SNAPSHOT_CATEGORIES = ['Planned', 'Due', 'Overdue', 'Postponed', 'Unplanned', 'Pending Approval', 'Completed'] as const;
type SnapshotCategory = typeof SNAPSHOT_CATEGORIES[number];

function getMonthBoundaries(year: number, month: number) {
  const opening = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const closing = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
  return { opening, closing, monthKey: `${year}-${String(month).padStart(2, '0')}` };
}

function mapStatusToCategory(
  computedStatus: string,
  wo: any
): SnapshotCategory {
  if (wo.workOrderType === 'Unplanned') return 'Unplanned';

  if (wo.status === 'Postponed') return 'Postponed';

  if (wo.isExecution && wo.status === 'Pending Approval') return 'Pending Approval';
  if (wo.status === 'Pending Approval') return 'Pending Approval';

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

async function computeSnapshotAtTimestamp(
  vesselId: string,
  snapshotDate: Date
) {
  const allWorkOrders = await repo.getWorkOrders(vesselId);
  const jobs = await repo.getJobs(vesselId);
  const components = await repo.getComponents(vesselId);

  const jobsMap = new Map(jobs.map(j => [j.juuid, j]));
  const componentsByCodeMap = new Map(components.map(c => [c.componentCode, c]));
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));

  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);

  const categoryCounts: Record<SnapshotCategory, { count: number; woIds: string[] }> = {
    'Planned': { count: 0, woIds: [] },
    'Due': { count: 0, woIds: [] },
    'Overdue': { count: 0, woIds: [] },
    'Postponed': { count: 0, woIds: [] },
    'Unplanned': { count: 0, woIds: [] },
    'Pending Approval': { count: 0, woIds: [] },
    'Completed': { count: 0, woIds: [] },
  };

  const vesselWOs = allWorkOrders.filter((wo: any) => wo.dataScope === 'vessel');

  for (const wo of vesselWOs) {
    if (wo.isExecution && wo.status !== 'Pending Approval') continue;

    const job = wo.jobId ? jobsMap.get(wo.jobId) : undefined;
    const component = wo.componentCode
      ? componentsByCodeMap.get(wo.componentCode)
      : (wo.component ? componentsMap.get(wo.component) : undefined);

    const maintenanceBasis = wo.maintenanceBasis || (job as any)?.maintenanceBasis || 'Calendar';
    const dueDate = wo.dueDateSnapshot || wo.dueDate || null;
    const dueRH = parseRH((job as any)?.nextDueRH) ?? parseRH(wo.nextDueReading);
    const currentRH = parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading);

    const computedStatus = computeWorkOrderStatus({
      dueDate,
      dueRH,
      currentRH,
      isExecution: wo.isExecution,
      status: wo.status,
      completionDateTime: wo.completionDateTime,
      maintenanceBasis,
      companyGraceConfig,
    });

    const category = mapStatusToCategory(computedStatus, wo);
    categoryCounts[category].count++;
    categoryCounts[category].woIds.push(wo.wouuid || wo.id);
  }

  return categoryCounts;
}

function parseRH(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
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
  const { opening, closing, monthKey } = getMonthBoundaries(year, month);

  const allWorkOrders = await repo.getWorkOrders(vesselId);
  const vesselWOs = allWorkOrders.filter((wo: any) => wo.dataScope === 'vessel');

  const parseDateLocal = (dateStr: string | null | undefined): Date | null => {
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
      if (m !== undefined) return new Date(y, m, day);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

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

  for (const wo of vesselWOs) {
    const createdAt = wo.createdAt ? new Date(wo.createdAt) : null;
    const completionDate = parseDateLocal(wo.completionDateTime);
    const dueDate = parseDateLocal(wo.dueDateSnapshot || wo.dueDate);

    if (isInMonth(createdAt)) {
      newJobsEntered++;
      newJobsEnteredIds.push(wo.wouuid || wo.id);

      if (wo.workOrderType === 'Unplanned') {
        unplannedRaised++;
        unplannedRaisedIds.push(wo.wouuid || wo.id);
      }
    }

    if (wo.status === 'Completed' && isInMonth(completionDate)) {
      completedInMonth++;
      completedInMonthIds.push(wo.wouuid || wo.id);
    }

    if (wo.isExecution && wo.status === 'Pending Approval' && isInMonth(createdAt)) {
      sentToPendingApproval++;
      sentToPendingApprovalIds.push(wo.wouuid || wo.id);
    }

    if (dueDate && isInMonth(dueDate) && wo.status !== 'Completed') {
      newlyOverdue++;
      newlyOverdueIds.push(wo.wouuid || wo.id);
    }
  }

  let postponedInMonth = 0;
  const postponedInMonthIds: string[] = [];
  try {
    const postponements = await repo.getWorkOrderPostponements(vesselId);
    if (Array.isArray(postponements)) {
      for (const p of postponements) {
        const pDate = parseDateLocal(p.submittedDate || (p.createdAt ? new Date(p.createdAt).toISOString() : null));
        if (isInMonth(pDate)) {
          postponedInMonth++;
          postponedInMonthIds.push(p.workOrderId);
        }
      }
    }
  } catch (e) {
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

  const opening: Record<string, { count: number; woIds: string[] }> = {};
  const closing: Record<string, { count: number; woIds: string[] }> = {};

  for (const snap of snapshots) {
    const data = { count: snap.count, woIds: snap.workOrderIds || [] };
    if (snap.snapshotType === 'opening') {
      opening[snap.category] = data;
    } else {
      closing[snap.category] = data;
    }
  }

  const openingTotal = Object.values(opening).reduce((sum, v) => sum + v.count, 0);
  const closingTotal = Object.values(closing).reduce((sum, v) => sum + v.count, 0);
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
  const vessel = allVessels.find((v: any) => v.id === vesselId || v.vuuid === vesselId);
  const vesselName = vessel?.name || vesselId;

  const snapshotMeta = snapshots.map(s => ({
    id: s.id,
    type: s.snapshotType,
    category: s.category,
    count: s.count,
    generatedAt: s.generatedAt,
    timestamp: s.snapshotTimestamp,
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

export async function getSnapshotDrilldown(
  vesselId: string,
  year: number,
  month: number,
  snapshotType: string,
  category: string
) {
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

  const allWorkOrders = await repo.getWorkOrders(vesselId);
  const jobs = await repo.getJobs(vesselId);
  const components = await repo.getComponents(vesselId);
  const componentsByCodeMap = new Map(components.map(c => [c.componentCode, c]));
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));
  const jobsMap = new Map(jobs.map(j => [j.juuid, j]));

  const woIdSet = new Set(snapshot.workOrderIds);

  return allWorkOrders
    .filter((wo: any) => woIdSet.has(wo.wouuid) || woIdSet.has(wo.id))
    .map((wo: any) => {
      const job = wo.jobId ? jobsMap.get(wo.jobId) : undefined;
      const component = wo.componentCode
        ? componentsByCodeMap.get(wo.componentCode)
        : (wo.component ? componentsMap.get(wo.component) : undefined);
      return {
        workOrderNo: wo.workOrderNo || wo.id,
        jobTitle: wo.jobTitle || (job as any)?.jobTitle || '-',
        componentCode: wo.componentCode || '-',
        componentName: component?.name || wo.component || '-',
        dueDate: wo.dueDateSnapshot || wo.dueDate || '-',
        status: wo.status || '-',
        maintenanceBasis: wo.maintenanceBasis || '-',
        department: wo.department || '-',
      };
    });
}

export async function getMovementDrilldown(
  vesselId: string,
  year: number,
  month: number,
  movementType: string
) {
  const movement = await computeMonthlyMovement(vesselId, year, month);

  const movementMap: Record<string, { count: number; woIds: string[] }> = {
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

  const allWorkOrders = await repo.getWorkOrders(vesselId);
  const jobs = await repo.getJobs(vesselId);
  const components = await repo.getComponents(vesselId);
  const componentsByCodeMap = new Map(components.map(c => [c.componentCode, c]));
  const componentsMap = new Map(components.map(c => [c.cuuid, c]));
  const jobsMap = new Map(jobs.map(j => [j.juuid, j]));

  const woIdSet = new Set(movementData.woIds);

  return allWorkOrders
    .filter((wo: any) => woIdSet.has(wo.wouuid) || woIdSet.has(wo.id))
    .map((wo: any) => {
      const job = wo.jobId ? jobsMap.get(wo.jobId) : undefined;
      const component = wo.componentCode
        ? componentsByCodeMap.get(wo.componentCode)
        : (wo.component ? componentsMap.get(wo.component) : undefined);
      return {
        workOrderNo: wo.workOrderNo || wo.id,
        jobTitle: wo.jobTitle || (job as any)?.jobTitle || '-',
        componentCode: wo.componentCode || '-',
        componentName: component?.name || wo.component || '-',
        dueDate: wo.dueDateSnapshot || wo.dueDate || '-',
        status: wo.status || '-',
        maintenanceBasis: wo.maintenanceBasis || '-',
        department: wo.department || '-',
      };
    });
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
