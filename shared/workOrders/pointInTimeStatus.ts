import {
  computeWorkOrderStatus,
  type ComputedWorkOrderStatus,
  type VesselGraceSettings,
  type CompanyStandardGraceConfig,
} from './status';
import { parseWorkOrderDate } from './dateParse';

/**
 * Four-bucket point-in-time status used by the 6-Month Maintenance Trend chart.
 * Mutually exclusive: every (WO, month-end) lands in exactly one bucket.
 */
export type PointInTimeStatus = 'Completed' | 'Postponed' | 'Overdue' | 'Outstanding';

/**
 * Minimal shape of a work order needed for point-in-time evaluation.
 */
export interface PITWorkOrder {
  wouuid?: string;
  id?: string;
  isExecution?: boolean | null;
  status?: string | null;
  completionDateTime?: string | null;
  dueDate?: string | null;
  originalDueDate?: string | null;
  maintenanceBasis?: string | null;
  // RH inputs are optional; trend deliberately doesn't try to reconstruct
  // historical RH readings, so RH WOs use the current values as best-effort.
  nextDueReading?: string | number | null;
  currentReading?: string | number | null;
}

/**
 * Minimal shape of a postponement audit row.
 */
export interface PITPostponement {
  workOrderId: string;
  postponementNumber?: number | null;
  newDueDate?: string | null;
  status?: string | null;
  approvedDate?: string | null;
  submittedDate?: string | null;
  createdAt?: string | Date | null;
}

// Format-tolerant parsing now lives in the SHARED parser (dateParse.ts) — this
// file's earlier local implementation was the template for it. Kept as a thin
// alias so the call sites below stay unchanged.
function toDate(value: string | Date | null | undefined): Date | null {
  return parseWorkOrderDate(value);
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/**
 * Find the postponement that was in effect at `refDate` for a work order.
 * "In effect" = approved (status === 'Approved') AND approved on or before refDate.
 * Returns the most recent such postponement (highest postponementNumber, or
 * latest approvedDate as tie-breaker).
 */
export function findActivePostponementAt(
  postponements: PITPostponement[],
  refDate: Date,
): PITPostponement | null {
  if (!postponements || postponements.length === 0) return null;
  const eligible = postponements.filter((p) => {
    const normalizedStatus = (p.status || '').toLowerCase().trim();
    if (normalizedStatus !== 'approved') return false;
    const approved = toDate(p.approvedDate) || toDate(p.submittedDate) || toDate(p.createdAt);
    if (!approved) return false;
    return approved <= refDate;
  });
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const numDiff = (b.postponementNumber || 0) - (a.postponementNumber || 0);
    if (numDiff !== 0) return numDiff;
    const aDate = toDate(a.approvedDate) || toDate(a.submittedDate) || toDate(a.createdAt);
    const bDate = toDate(b.approvedDate) || toDate(b.submittedDate) || toDate(b.createdAt);
    const at = aDate ? aDate.getTime() : 0;
    const bt = bDate ? bDate.getTime() : 0;
    return bt - at;
  });
  return eligible[0];
}

export interface ComputePITStatusInput {
  wo: PITWorkOrder;
  postponements?: PITPostponement[];
  refDate: Date;
  vesselGraceSettings?: VesselGraceSettings;
  companyGraceConfig?: CompanyStandardGraceConfig;
  calendarLeadTimeDays?: number;
  rhLeadTimeHours?: number;
}

/**
 * Compute the point-in-time status of a work order as of `refDate`.
 *
 * Rules (Task #65):
 * - Completed → completionDateTime exists and ≤ refDate.
 * - Postponed → had an approved postponement on/before refDate AND its new due
 *   date + grace was NOT yet past at refDate. Postponed takes precedence over
 *   Outstanding for the open work orders bucket.
 * - Overdue → not completed and past (effective due date + grace) at refDate.
 *   Effective due date = latest postponement's newDueDate (if a postponement
 *   was in effect) else originalDueDate (else dueDate). Note: when a WO is
 *   postponed but its NEW due date is itself overdue at refDate, Overdue wins
 *   over Postponed (per user spec).
 * - Outstanding → everything else (open, not yet past due+grace at refDate,
 *   no postponement in effect).
 */
export function computePointInTimeStatus(input: ComputePITStatusInput): PointInTimeStatus {
  const { wo, postponements = [], refDate } = input;

  // 1) Completed by refDate?
  const completionDt = toDate(wo.completionDateTime);
  if (completionDt && completionDt <= refDate) {
    return 'Completed';
  }

  // 2) Find postponement in effect at refDate.
  const woId = wo.wouuid || wo.id;
  const woPostponements = woId
    ? postponements.filter((p) => p.workOrderId === woId)
    : [];
  const activePostponement = findActivePostponementAt(woPostponements, refDate);

  // 3) Resolve effective due date as of refDate.
  //    - If a postponement was in effect: use its newDueDate.
  //    - Otherwise: use originalDueDate when available (so we don't accidentally
  //      pick up a *later* postponement that wo.dueDate now reflects), else
  //      fall back to wo.dueDate.
  const effectiveDueDate = activePostponement?.newDueDate
    ?? (woPostponements.length > 0 ? (wo.originalDueDate ?? wo.dueDate ?? null) : (wo.dueDate ?? wo.originalDueDate ?? null));

  // 4) Compute Active/Due/Due(Grace P)/Overdue at refDate using the existing helper.
  //    We deliberately strip wo.status here — current `status === 'Postponed'`
  //    on the WO row reflects today, not refDate, and would otherwise short-
  //    circuit the calculation.
  const computed = computeWorkOrderStatus({
    // No pre-normalization needed: computeWorkOrderStatus now parses all
    // stored formats via the shared parser (dateParse.ts).
    dueDate: effectiveDueDate,
    dueRH: parseNumber(wo.nextDueReading),
    currentRH: parseNumber(wo.currentReading),
    isExecution: wo.isExecution ?? false,
    status: 'Active', // neutral — let the date math decide
    completionDateTime: null,
    maintenanceBasis: wo.maintenanceBasis || 'Calendar',
    vesselGraceSettings: input.vesselGraceSettings,
    companyGraceConfig: input.companyGraceConfig,
    calendarLeadTimeDays: input.calendarLeadTimeDays,
    rhLeadTimeHours: input.rhLeadTimeHours,
    referenceDate: refDate,
  });

  // 5) Map to the four trend buckets.
  if (computed === 'Overdue') return 'Overdue';
  if (activePostponement) return 'Postponed';
  return 'Outstanding';
}

/**
 * Return the "bucket month" (YYYY-MM in UTC) for a work order.
 *
 * Uses originalDueDate when available so historical buckets stay stable even
 * after postponements move the live dueDate forward. Falls back to dueDate.
 */
export function getWorkOrderBucketMonth(wo: PITWorkOrder): { year: number; month: number } | null {
  const raw = wo.originalDueDate || wo.dueDate || null;
  if (!raw) return null;
  const d = toDate(raw);
  if (!d) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/**
 * Map a JS Date status type back to the four-bucket PIT status for completeness.
 * Useful in tests and callers that already have a ComputedWorkOrderStatus.
 */
export function computedStatusToPIT(
  status: ComputedWorkOrderStatus,
  hadActivePostponement: boolean,
): PointInTimeStatus {
  if (status === 'Completed') return 'Completed';
  if (status === 'Overdue') return 'Overdue';
  if (hadActivePostponement) return 'Postponed';
  return 'Outstanding';
}
