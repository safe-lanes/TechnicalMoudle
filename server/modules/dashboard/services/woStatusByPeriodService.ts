import { storage } from '../../../storage';
import {
  buildCompanyGraceConfig,
  computeWorkOrderStatus,
  type CompanyStandardGraceConfig,
  type VesselGraceSettings,
} from '@shared/workOrders/status';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import {
  findActivePostponementAt,
  getWorkOrderBucketMonth,
  type PITWorkOrder,
  type PITPostponement,
} from '@shared/workOrders/pointInTimeStatus';

export type WoStatusSlice =
  | 'scheduled'
  | 'due'
  | 'overdue'
  | 'postponed'
  | 'completed'
  | 'pendingApproval';

export interface WoStatusBucket {
  count: number;
  woIds: string[];
}

export interface WoStatusByPeriodResult {
  all: Record<WoStatusSlice, WoStatusBucket>;
  critical: Record<WoStatusSlice, WoStatusBucket>;
}

export interface WoStatusByPeriodOptions {
  vesselId: string;          // 'all' or specific vessel UUID
  vesselIds?: string[];      // explicit allow-list for scope-restricted users
  from?: Date | null;        // inclusive window start; null = all-time
  to?: Date | null;          // inclusive window end; null = all-time
}

function buildVesselGraceSettings(
  vesselSettings: Record<string, unknown> | null | undefined,
): VesselGraceSettings {
  if (!vesselSettings) {
    return {
      calendarGraceMode: 'COMPANY_STANDARD',
      calendarGraceDays: WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
      rhGraceHours: WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    };
  }
  return {
    calendarGraceMode:
      ((vesselSettings.calendarGraceMode as string) || 'COMPANY_STANDARD') as
        | 'COMPANY_STANDARD'
        | 'CUSTOM_DAYS',
    calendarGraceDays:
      (vesselSettings.calendarGraceDays as number) ??
      WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours:
      (vesselSettings.rhGraceHours as number) ??
      WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: vesselSettings.rhLeadTimeHours as number | undefined,
  };
}

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
];
/**
 * Normalize an arbitrary date string into DD-MMM-YYYY, which is the format
 * understood by computeWorkOrderStatus. Mirrors the helper in
 * shared/workOrders/pointInTimeStatus.ts so ISO-dated WOs aren't silently
 * mis-classified as Active by this service.
 */
function normalizeDueDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return `${String(value.getUTCDate()).padStart(2, '0')}-${MONTH_NAMES[value.getUTCMonth()]}-${value.getUTCFullYear()}`;
  }
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTH_NAMES[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split('-').map(p => parseInt(p, 10));
    if (mm >= 1 && mm <= 12) {
      return `${String(dd).padStart(2, '0')}-${MONTH_NAMES[mm - 1]}-${yyyy}`;
    }
  }
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTH_NAMES[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
  }
  return null;
}

function toDateLoose(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  // DD-MMM-YYYY
  const m = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mIdx = MONTH_NAMES.findIndex(s => s.toLowerCase() === m[2].toLowerCase());
    const yyyy = parseInt(m[3], 10);
    if (mIdx >= 0) return new Date(Date.UTC(yyyy, mIdx, dd));
  }
  // DD-MM-YYYY
  const m2 = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) {
    const dd = parseInt(m2[1], 10);
    const mm = parseInt(m2[2], 10);
    const yyyy = parseInt(m2[3], 10);
    if (mm >= 1 && mm <= 12) return new Date(Date.UTC(yyyy, mm - 1, dd));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function emptyBuckets(): Record<WoStatusSlice, WoStatusBucket> {
  return {
    scheduled: { count: 0, woIds: [] },
    due: { count: 0, woIds: [] },
    overdue: { count: 0, woIds: [] },
    postponed: { count: 0, woIds: [] },
    completed: { count: 0, woIds: [] },
    pendingApproval: { count: 0, woIds: [] },
  };
}

function classifySlice(args: {
  wo: PITWorkOrder & { status?: string | null };
  postponements: PITPostponement[];
  from: Date;
  to: Date;
  vesselGrace: VesselGraceSettings | undefined;
  companyGrace: CompanyStandardGraceConfig;
}): WoStatusSlice {
  const { wo, postponements, vesselGrace, companyGrace } = args;
  const from = args.from;
  const to = args.to;
  const woId = wo.wouuid || wo.id;
  const woPostponements = woId
    ? postponements.filter(p => p.workOrderId === woId)
    : [];

  const today = new Date();
  const windowEnd = to < today ? to : today;
  // If the window is entirely in the future, we still evaluate at `from` only
  // (the earliest possible time within the window). Future evaluations would
  // project beyond "now", which we explicitly avoid.
  if (windowEnd < from) {
    // Whole window is in the past… not possible (windowEnd = to). Skip.
  }

  // Collect ref dates within [from, windowEnd]
  const refDates: Date[] = [];
  const pushIfInWindow = (d: Date | null) => {
    if (!d) return;
    if (d < from || d > windowEnd) return;
    refDates.push(d);
  };

  pushIfInWindow(from);
  pushIfInWindow(windowEnd);

  // Due date + due date + grace
  const dueDateObj = toDateLoose(wo.originalDueDate || wo.dueDate || null);
  if (dueDateObj) {
    pushIfInWindow(dueDateObj);
    // One day past grace boundary: dueDate + graceDays + 1 day (so the
    // computeWorkOrderStatus comparison `today > graceEndDate` flips to Overdue).
    const graceDays =
      vesselGrace?.calendarGraceMode === 'CUSTOM_DAYS'
        ? vesselGrace.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS
        : (companyGrace.graceValue ??
           WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS);
    const justOverdue = new Date(dueDateObj);
    justOverdue.setUTCDate(justOverdue.getUTCDate() + graceDays + 1);
    pushIfInWindow(justOverdue);
  }

  // Each postponement approved date in window + postponed newDueDate + grace
  for (const p of woPostponements) {
    pushIfInWindow(toDateLoose(p.approvedDate ?? p.submittedDate ?? (p.createdAt as string | null)));
    const nd = toDateLoose(p.newDueDate ?? null);
    if (nd) {
      pushIfInWindow(nd);
      const graceDays =
        vesselGrace?.calendarGraceMode === 'CUSTOM_DAYS'
          ? vesselGrace.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS
          : (companyGrace.graceValue ??
             WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS);
      const justOverdue = new Date(nd);
      justOverdue.setUTCDate(justOverdue.getUTCDate() + graceDays + 1);
      pushIfInWindow(justOverdue);
    }
  }

  // Completion date
  pushIfInWindow(toDateLoose(wo.completionDateTime ?? null));

  if (refDates.length === 0) {
    // Window is entirely in the future relative to today — classify by scheduled vs
    // current PA. Use today as the only ref date if it falls inside [from,to]; else
    // treat as Scheduled (the WO bucket lands in this period but nothing has
    // happened yet).
    refDates.push(today >= from && today <= to ? today : from);
  }

  let sawOverdue = false;
  let sawPostponed = false;
  let sawCompleted = false;
  let sawDue = false;
  let sawScheduled = false;

  for (const r of refDates) {
    const completion = toDateLoose(wo.completionDateTime ?? null);
    if (completion && completion <= r) {
      sawCompleted = true;
      continue;
    }
    const activePostp = findActivePostponementAt(woPostponements, r);
    const effectiveDue =
      activePostp?.newDueDate ??
      (woPostponements.length > 0
        ? (wo.originalDueDate ?? wo.dueDate ?? null)
        : (wo.dueDate ?? wo.originalDueDate ?? null));

    const computed = computeWorkOrderStatus({
      dueDate: normalizeDueDateString(effectiveDue ?? null),
      dueRH:
        wo.nextDueReading != null && wo.nextDueReading !== ''
          ? Number(wo.nextDueReading)
          : null,
      currentRH:
        wo.currentReading != null && wo.currentReading !== ''
          ? Number(wo.currentReading)
          : null,
      isExecution: wo.isExecution ?? false,
      status: 'Active',
      completionDateTime: null,
      maintenanceBasis: wo.maintenanceBasis || 'Calendar',
      vesselGraceSettings: vesselGrace,
      companyGraceConfig: companyGrace,
      referenceDate: r,
    });

    if (computed === 'Overdue') {
      sawOverdue = true;
    } else if (activePostp) {
      sawPostponed = true;
    } else if (computed === 'Due' || computed === 'Due (Grace P)') {
      sawDue = true;
    } else {
      sawScheduled = true;
    }
  }

  // Priority: Overdue > Postponed > (current Pending Approval) > Completed > Due > Scheduled
  // Per task #77 spec: Pending Approval is a transient signing state, not a
  // window-state. Classify a WO as PA only when its CURRENT status is PA AND
  // no higher-priority state (Overdue, Postponed) was hit during the window.
  // It still wins over Completed/Due/Scheduled so it doesn't get swallowed by
  // a 'Scheduled' observation at the window edges.
  if (sawOverdue) return 'overdue';
  if (sawPostponed) return 'postponed';
  if ((wo.status || '') === 'Pending Approval') return 'pendingApproval';
  if (sawCompleted) return 'completed';
  if (sawDue) return 'due';
  if (sawScheduled) return 'scheduled';

  return 'scheduled';
}

export async function getWoStatusByPeriod(
  options: WoStatusByPeriodOptions,
): Promise<WoStatusByPeriodResult> {
  // Cleared period -> all-time. Backend uses sentinel-wide bounds so the
  // shared classify/bucket helpers don't need conditional branches.
  // Documented per spec: clearing the dashboard Period filter shows the
  // donut counts across all WOs (no time-window restriction).
  const ALL_TIME_FROM = new Date(Date.UTC(1970, 0, 1));
  const ALL_TIME_TO = new Date(Date.UTC(9999, 11, 31, 23, 59, 59, 999));
  const from = options.from ?? ALL_TIME_FROM;
  const to = options.to ?? ALL_TIME_TO;
  const isAllTime = !options.from || !options.to;
  const isAll = !options.vesselId || options.vesselId === 'all';

  const workOrders = (await storage.getWorkOrders(
    isAll ? 'all' : options.vesselId,
    isAll ? options.vesselIds : undefined,
  )) as unknown as Array<
    PITWorkOrder & {
      dataScope?: string;
      vesselId?: string;
      criticality?: string | null;
      status?: string | null;
    }
  >;
  const postponements = (await storage.getWorkOrderPostponements(
    isAll ? 'all' : options.vesselId,
    undefined,
    isAll ? options.vesselIds : undefined,
  )) as unknown as PITPostponement[];

  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGrace: CompanyStandardGraceConfig = buildCompanyGraceConfig(
    companyGraceRow as any,
  );

  const vesselGraceCache = new Map<string, VesselGraceSettings>();
  const getVesselGrace = async (
    vid: string | undefined,
  ): Promise<VesselGraceSettings | undefined> => {
    if (!vid) return undefined;
    if (vesselGraceCache.has(vid)) return vesselGraceCache.get(vid);
    const settings = await storage.getPmsVesselSettings(vid);
    const built = buildVesselGraceSettings(
      settings as Record<string, unknown> | undefined,
    );
    vesselGraceCache.set(vid, built);
    return built;
  };

  const vesselWOs = workOrders.filter((wo) => {
    if ((wo as any).dataScope && (wo as any).dataScope !== 'vessel') return false;
    if (wo.isExecution) return false;
    return true;
  });

  // Restrict to WOs whose bucket month-end falls inside [from, to], per spec
  // (mirrors the 6-month trend selection criterion). All-time mode keeps
  // every WO with a valid bucket.
  const periodWOs = vesselWOs.filter((wo) => {
    const bucket = getWorkOrderBucketMonth(wo);
    if (!bucket) return false;
    if (isAllTime) return true;
    const monthEnd = new Date(
      Date.UTC(bucket.year, bucket.month + 1, 0, 23, 59, 59, 999),
    );
    return monthEnd >= from && monthEnd <= to;
  });

  const all = emptyBuckets();
  const critical = emptyBuckets();

  for (const wo of periodWOs) {
    const vesselGrace = await getVesselGrace(wo.vesselId);
    const slice = classifySlice({
      wo,
      postponements,
      from,
      to,
      vesselGrace,
      companyGrace,
    });
    const rawId = wo.wouuid ?? wo.id;
    const woId = rawId != null ? String(rawId) : '';
    all[slice].count += 1;
    if (woId) all[slice].woIds.push(woId);
    if ((wo.criticality ?? '').toLowerCase() === 'yes') {
      critical[slice].count += 1;
      if (woId) critical[slice].woIds.push(woId);
    }
  }

  return { all, critical };
}
