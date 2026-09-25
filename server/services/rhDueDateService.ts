import { parseWorkOrderDate, formatWorkOrderCalendarDate } from '@shared/workOrders/dateParse';

export interface HistoricalRhPoint {
  cumulativeRH?: string | number | null;
  newRH?: string | number | null;
  previousRH?: string | number | null;
  dateUpdatedLocal?: string | null;
  meterReplaced?: boolean | null;
  isRenewalReset?: boolean | null;
  stampHolder?: string | null;
  enteredAtUTC?: Date | string | null;
  isDeleted?: boolean | null;
}

export interface RhEstimate {
  dueDate: string | null;
  averagePerDay: number | null;
  basis: string;
}

export const RH_ESTIMATE_BASIS_VERSION = 'RH_COMPLETION_FIRST_LATEST_V2';

export function isCurrentRhEstimateBasis(basis: string | null | undefined): boolean {
  return Boolean(basis?.startsWith(`${RH_ESTIMATE_BASIS_VERSION}_`));
}

export function rhEstimateBasis(reason: string): string {
  return `${RH_ESTIMATE_BASIS_VERSION}_${reason}`;
}

interface HistoricalRhUtilization {
  averagePerDay: number;
  latestDate: Date;
  latestRh: number;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function pointDate(point: HistoricalRhPoint): Date | null {
  return parseWorkOrderDate(point.dateUpdatedLocal);
}

function calculateHistoricalRhUtilization(points: HistoricalRhPoint[]): HistoricalRhUtilization | null {
  const ordered = points
    .map(point => ({
      point,
      date: pointDate(point),
      rh: numeric(point.cumulativeRH ?? point.newRH),
      stamp: point.stampHolder || null,
    }))
    .filter((item): item is { point: HistoricalRhPoint; date: Date; rh: number | null; stamp: string | null } =>
      item.date !== null && item.point.isDeleted !== true)
    .sort((a, b) => {
      const byDate = a.date.getTime() - b.date.getTime();
      if (byDate !== 0) return byDate;
      return String(a.point.enteredAtUTC || '').localeCompare(String(b.point.enteredAtUTC || ''));
    });

  // A reset/replacement reading is the first valid baseline of the new counter
  // epoch. Keep that boundary row and everything after it.
  let lastBoundary = -1;
  ordered.forEach((item, index) => {
    if (item.point.meterReplaced || item.point.isRenewalReset) lastBoundary = index;
  });
  const valid = ordered
    .slice(Math.max(0, lastBoundary))
    .filter((item): item is { point: HistoricalRhPoint; date: Date; rh: number; stamp: string | null } =>
      item.rh !== null);

  if (valid.length < 2) return null;
  const latest = valid[valid.length - 1];
  let latestStampStart = valid.length - 1;
  while (
    latestStampStart > 0
    && valid[latestStampStart - 1].stamp === latest.stamp
  ) {
    latestStampStart--;
  }

  // Use the full valid active history period: earliest valid increasing
  // reading in the latest contiguous stamp epoch through the latest reading.
  // The Job's completion date is intentionally irrelevant to utilization.
  for (let startIndex = latestStampStart; startIndex < valid.length - 1; startIndex++) {
    const start = valid[startIndex];

    const days = (latest.date.getTime() - start.date.getTime()) / 86400000;
    const delta = latest.rh - start.rh;
    if (!(days > 0) || !(delta > 0)) continue;
    return {
      averagePerDay: delta / days,
      latestDate: latest.date,
      latestRh: latest.rh,
    };
  }
  return null;
}

/** Calculate average RH/day across the full valid active counter epoch. */
export function calculateHistoricalRhAverage(points: HistoricalRhPoint[]): number | null {
  return calculateHistoricalRhUtilization(points)?.averagePerDay ?? null;
}

interface RhComponentRef {
  id?: string | number | null;
  cuuid?: string | null;
  vesselId?: string | null;
  rhCounterType?: string | null;
  rhMasterComponentId?: string | null;
  rhCounterSource?: string | null;
}

/**
 * Resolve the canonical counter that owns RH history. Both direct completion
 * and shore completion learning use this adapter so inherited jobs cannot
 * accidentally calculate from a child's cached counter.
 */
export async function resolveAuthoritativeRhComponent<T extends RhComponentRef>(
  component: T | null | undefined,
  findById: (id: string) => Promise<T | null | undefined>,
  findByCode: (code: string, vesselId: string) => Promise<T | null | undefined>,
  fallbackVesselId?: string | null,
): Promise<T | null> {
  if (!component) return null;
  const expectedVesselId = component.vesselId || fallbackVesselId || null;
  const isAuthoritativeMaster = (candidate: T | null | undefined): candidate is T =>
    Boolean(
      candidate
      && String(candidate.rhCounterType || '').toUpperCase() === 'MASTER'
      && (!expectedVesselId || candidate.vesselId === expectedVesselId),
    );

  if (String(component.rhCounterType || '').toUpperCase() !== 'INHERITED') {
    return isAuthoritativeMaster(component) ? component : null;
  }

  let master: T | null | undefined = null;
  if (component.rhMasterComponentId) {
    master = await findById(String(component.rhMasterComponentId));
  }
  if (!isAuthoritativeMaster(master) && component.rhCounterSource && expectedVesselId) {
    master = await findByCode(component.rhCounterSource, expectedVesselId);
  }
  return isAuthoritativeMaster(master) ? master : null;
}

export function estimateRhDueDate(
  completionDate: string | null | undefined,
  rhFrequency: string | number | null | undefined,
  points: HistoricalRhPoint[],
): RhEstimate {
  const utilization = calculateHistoricalRhUtilization(points);
  if (!utilization) {
    return { dueDate: null, averagePerDay: null, basis: rhEstimateBasis('INSUFFICIENT_HISTORY') };
  }
  const completion = parseWorkOrderDate(completionDate);
  if (!completion) {
    return {
      dueDate: null,
      averagePerDay: utilization.averagePerDay,
      basis: rhEstimateBasis('INVALID_COMPLETION_DATE'),
    };
  }
  const frequency = numeric(rhFrequency);
  if (frequency === null || frequency <= 0) {
    return {
      dueDate: null,
      averagePerDay: utilization.averagePerDay,
      basis: rhEstimateBasis('MISSING_RH_FREQUENCY'),
    };
  }

  const projectedDays = Math.max(0, Math.round(frequency / utilization.averagePerDay));
  const due = new Date(Date.UTC(
    completion.getUTCFullYear(),
    completion.getUTCMonth(),
    completion.getUTCDate() + projectedDays,
  ));
  return {
    dueDate: formatWorkOrderCalendarDate(due),
    averagePerDay: utilization.averagePerDay,
    basis: rhEstimateBasis('HISTORICAL'),
  };
}

export function effectiveDueDate(
  calendarDueDate: string | null | undefined,
  rhDueDate: string | null | undefined,
): { date: string | null; basis: string } {
  if (!calendarDueDate && !rhDueDate) return { date: null, basis: 'UNAVAILABLE' };
  if (!calendarDueDate) return { date: rhDueDate || null, basis: 'RUNNING_HOURS' };
  if (!rhDueDate) return { date: calendarDueDate, basis: 'CALENDAR' };
  const calendar = parseWorkOrderDate(calendarDueDate);
  const rh = parseWorkOrderDate(rhDueDate);
  if (!calendar || !rh) return { date: calendarDueDate, basis: 'CALENDAR' };
  if (calendar.getTime() === rh.getTime()) return { date: calendarDueDate, basis: 'CALENDAR_AND_RUNNING_HOURS' };
  return calendar < rh
    ? { date: calendarDueDate, basis: 'CALENDAR' }
    : { date: rhDueDate, basis: 'RUNNING_HOURS' };
}