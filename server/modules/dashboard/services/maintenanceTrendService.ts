import { storage } from '../../../storage';
import {
  buildCompanyGraceConfig,
  type CompanyStandardGraceConfig,
  type VesselGraceSettings,
} from '@shared/workOrders/status';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import {
  computePointInTimeStatus,
  getWorkOrderBucketMonth,
  type PITWorkOrder,
  type PITPostponement,
  type PointInTimeStatus,
} from '@shared/workOrders/pointInTimeStatus';

interface MonthDatum {
  month: string;        // "Feb 2026"
  monthShort: string;   // "Feb"
  year: number;
  monthIndex: number;   // 0-based
  totalPlanned: number;
  completed: number;
  outstanding: number;
  overdue: number;
  postponed: number;
  completedPercent: number;
  outstandingPercent: number;
  overduePercent: number;
  postponedPercent: number;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function monthEndUTC(year: number, monthIndex0: number): Date {
  // monthIndex0 is 0-based; last day of month in UTC.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999));
}

function emptyMonthDatum(year: number, monthIndex0: number): MonthDatum {
  return {
    month: `${MONTH_SHORT[monthIndex0]} ${year}`,
    monthShort: MONTH_SHORT[monthIndex0],
    year,
    monthIndex: monthIndex0,
    totalPlanned: 0,
    completed: 0,
    outstanding: 0,
    overdue: 0,
    postponed: 0,
    completedPercent: 0,
    outstandingPercent: 0,
    overduePercent: 0,
    postponedPercent: 0,
  };
}

function finalizePercentages(d: MonthDatum) {
  if (d.totalPlanned > 0) {
    d.completedPercent = Math.round((d.completed / d.totalPlanned) * 100);
    d.outstandingPercent = Math.round((d.outstanding / d.totalPlanned) * 100);
    d.overduePercent = Math.round((d.overdue / d.totalPlanned) * 100);
    d.postponedPercent = Math.round((d.postponed / d.totalPlanned) * 100);
  }
}

export interface MaintenanceTrendOptions {
  vesselId: string;            // 'all' for all vessels
  vesselIds?: string[];        // explicit allow-list (for scope-restricted users)
  endMonth?: { year: number; monthIndex0: number }; // defaults to current month
  monthsBack?: number;         // defaults to 6 (5 previous + current)
}

export interface MaintenanceTrendResult {
  months: MonthDatum[];
  delta: number; // change in outstanding% from previous month to current
}

export async function getMaintenanceTrend(options: MaintenanceTrendOptions): Promise<MaintenanceTrendResult> {
  const monthsBack = options.monthsBack ?? 6;
  const today = new Date();
  // Default end = current month (latest bucket evaluated at "today"). Callers
  // can override via options.endMonth.
  const endYear = options.endMonth?.year ?? today.getUTCFullYear();
  const endMonth0 = options.endMonth?.monthIndex0 ?? today.getUTCMonth();

  // Build the list of (year, month0) buckets ending at endMonth, going back monthsBack-1 months.
  const buckets: { year: number; monthIndex0: number; key: string }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(endYear, endMonth0 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    buckets.push({ year: y, monthIndex0: m, key: `${y}-${m}` });
  }

  // Load WOs + postponements (respect "all" + scope).
  const isAll = !options.vesselId || options.vesselId === 'all';
  const workOrders = await storage.getWorkOrders(
    isAll ? 'all' : options.vesselId,
    isAll ? options.vesselIds : undefined,
  ) as unknown as Array<PITWorkOrder & { dataScope?: string; vesselId?: string }>;
  const postponements = await storage.getWorkOrderPostponements(
    isAll ? 'all' : options.vesselId,
    undefined,
    isAll ? options.vesselIds : undefined,
  ) as unknown as PITPostponement[];

  // Grace config — currently uses CURRENT settings as a documented limitation
  // (no audit history for grace settings).
  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig: CompanyStandardGraceConfig = buildCompanyGraceConfig(companyGraceRow as any);

  // Per-vessel grace settings cache.
  const vesselGraceCache = new Map<string, VesselGraceSettings>();
  const getVesselGrace = async (vid: string | undefined): Promise<VesselGraceSettings | undefined> => {
    if (!vid) return undefined;
    if (vesselGraceCache.has(vid)) return vesselGraceCache.get(vid);
    const settings = await storage.getPmsVesselSettings(vid);
    const built = buildVesselGraceSettings(settings as Record<string, unknown> | undefined);
    vesselGraceCache.set(vid, built);
    return built;
  };

  // Index buckets for fast lookup.
  const bucketIndex = new Map<string, MonthDatum>();
  const months: MonthDatum[] = buckets.map((b) => {
    const datum = emptyMonthDatum(b.year, b.monthIndex0);
    bucketIndex.set(b.key, datum);
    return datum;
  });

  // Filter to real vessel WOs (exclude fleet templates and pure-execution rows).
  const vesselWOs = workOrders.filter((wo) => {
    if ((wo as any).dataScope && (wo as any).dataScope !== 'vessel') return false;
    if (wo.isExecution) return false;
    return true;
  });

  for (const wo of vesselWOs) {
    const bucket = getWorkOrderBucketMonth(wo);
    if (!bucket) continue;
    const key = `${bucket.year}-${bucket.month}`;
    const datum = bucketIndex.get(key);
    if (!datum) continue;

    datum.totalPlanned += 1;

    // For past month-ends: strict month-end UTC (stable history).
    // For the current/in-progress month: cap at "today" so we don't project
    // the dashboard's latest point into the future.
    const monthEnd = monthEndUTC(datum.year, datum.monthIndex);
    const evalDate = monthEnd > today ? today : monthEnd;

    const vesselGrace = await getVesselGrace((wo as any).vesselId);
    const status: PointInTimeStatus = computePointInTimeStatus({
      wo,
      postponements,
      refDate: evalDate,
      vesselGraceSettings: vesselGrace,
      companyGraceConfig,
    });

    if (status === 'Completed') datum.completed += 1;
    else if (status === 'Postponed') datum.postponed += 1;
    else if (status === 'Overdue') datum.overdue += 1;
    else datum.outstanding += 1;
  }

  months.forEach(finalizePercentages);

  const current = months[months.length - 1]?.outstandingPercent ?? 0;
  const prev = months[months.length - 2]?.outstandingPercent ?? 0;
  return { months, delta: current - prev };
}
