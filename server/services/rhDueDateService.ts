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

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function pointDate(point: HistoricalRhPoint): Date | null {
  return parseWorkOrderDate(point.dateUpdatedLocal);
}

/**
 * Calculate utilization from the two latest valid readings in the same counter
 * epoch. Sorting is chronological rather than insertion order because synced
 * audit rows can arrive out of order.
 */
export function calculateHistoricalRhAverage(points: HistoricalRhPoint[]): number | null {
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

  // A reset/replacement starts a new counter epoch. Keep only readings after
  // the latest boundary, rather than allowing a pre-reset value to become the
  // "previous" point for a post-reset value.
  let lastBoundary = -1;
  ordered.forEach((item, index) => {
    if (item.point.meterReplaced || item.point.isRenewalReset) lastBoundary = index;
  });
  const valid = ordered
    .slice(lastBoundary + 1)
    .filter((item): item is { point: HistoricalRhPoint; date: Date; rh: number; stamp: string | null } =>
      item.rh !== null);

  if (valid.length < 2) return null;
  const latest = valid[valid.length - 1];

  // Find the latest earlier, increasing reading in the same contiguous stamp
  // epoch. Multiple audit events can exist on one calendar day (for example a
  // WO snapshot after the RH-module update); those are not a utilization
  // period and must be skipped rather than making otherwise valid history
  // unavailable.
  for (let previousIndex = valid.length - 2; previousIndex >= 0; previousIndex--) {
    const previous = valid[previousIndex];
    if (previous.stamp !== latest.stamp) break;

    const days = (latest.date.getTime() - previous.date.getTime()) / 86400000;
    const delta = latest.rh - previous.rh;
    if (!(days > 0) || !(delta > 0)) continue;
    return delta / days;
  }
  return null;
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
  const completion = parseWorkOrderDate(completionDate);
  const historicalPoints = completion
    ? points.filter(point => {
        const readingDate = pointDate(point);
        return readingDate !== null && readingDate.getTime() <= completion.getTime();
      })
    : points;
  const averagePerDay = calculateHistoricalRhAverage(historicalPoints);
  const dueRH = numeric(rhFrequency);
  if (averagePerDay === null) return { dueDate: null, averagePerDay: null, basis: 'INSUFFICIENT_HISTORY' };
  if (!completion) return { dueDate: null, averagePerDay, basis: 'INVALID_COMPLETION_DATE' };
  if (dueRH === null || dueRH <= 0) return { dueDate: null, averagePerDay, basis: 'MISSING_RH_FREQUENCY' };

  // Keep the fractional day for the rate calculation, then round the
  // projected calendar-day count as required by the business rule.
  const projectedDays = Math.max(0, Math.round(dueRH / averagePerDay));
  const due = new Date(Date.UTC(
    completion.getUTCFullYear(),
    completion.getUTCMonth(),
    completion.getUTCDate() + projectedDays,
  ));
  return {
    dueDate: formatWorkOrderCalendarDate(due),
    averagePerDay,
    basis: 'HISTORICAL',
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