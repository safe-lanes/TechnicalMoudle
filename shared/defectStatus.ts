// Raw database status values
export const DEFECT_STATUS = {
  OPEN: 'Open',
  PENDING: 'Pending',
  IN_PROGRESS: 'In-Progress',
  AWAITING_PARTS: 'Awaiting Parts',
  DEFERRED: 'Deferred',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled'
} as const;

export type DefectStatus = typeof DEFECT_STATUS[keyof typeof DEFECT_STATUS];

// Status groupings for filtering based on raw database status
export const ACTIVE_STATUSES: DefectStatus[] = [
  DEFECT_STATUS.OPEN, 
  DEFECT_STATUS.PENDING,
  DEFECT_STATUS.IN_PROGRESS,
  DEFECT_STATUS.AWAITING_PARTS,
  DEFECT_STATUS.DEFERRED
];

export const RESOLVED_STATUSES: DefectStatus[] = [
  DEFECT_STATUS.CLOSED,
  DEFECT_STATUS.CANCELLED
];

// Computed status labels (calculated from multiple fields, not raw status)
export const COMPUTED_STATUS = {
  REPORTED: 'Reported',
  IN_PROGRESS: 'In Progress',
  EXTENDED: 'Extended',
  OVERDUE: 'Overdue',
  CLOSED: 'Closed',
  VERIFIED: 'Verified'
} as const;

export type ComputedDefectStatus = typeof COMPUTED_STATUS[keyof typeof COMPUTED_STATUS];

// Computed status groupings
export const COMPUTED_ACTIVE_STATUSES: ComputedDefectStatus[] = [
  COMPUTED_STATUS.REPORTED,
  COMPUTED_STATUS.IN_PROGRESS,
  COMPUTED_STATUS.EXTENDED,
  COMPUTED_STATUS.OVERDUE
];

export const COMPUTED_RESOLVED_STATUSES: ComputedDefectStatus[] = [
  COMPUTED_STATUS.CLOSED,
  COMPUTED_STATUS.VERIFIED
];

// Helper function to check status type
export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as DefectStatus);
}

export function isResolvedStatus(status: string): boolean {
  return RESOLVED_STATUSES.includes(status as DefectStatus);
}
// ─────────────────────────────────────────────────────────────────────────────
// ONE defect status policy (25/28-Sep-2026, Sahil E1 / Q5: "overdue only against the extended
// date, everywhere; reports show Extended as its own group"). Used by the defect list and
// dashboard (client), the defect reports and list filter (server) and the overdue alert.
// When an extension is approved, targetCloseDate is ADVANCED to the new date and isDeferred is
// set — so the current targetCloseDate already is the extended date:
//   Verified → Closed (completed) → Overdue (today after the CURRENT target date) → Extended
//   (approved extension, not yet overdue) → In Progress (has actions) → Reported.
// Before this, an extended defect could never become Overdue on the list, even after the new
// date had passed.
// ─────────────────────────────────────────────────────────────────────────────
export interface DefectStatusInput {
  verified?: boolean | null;
  dateCompleted?: string | null;
  targetCloseDate?: string | null;
  isDeferred?: boolean | null;
  actions?: unknown;
}

/** Day-precision parse: YYYY-MM-DD…, DD-MM-YYYY, else Date.parse. Local midnight; null if invalid. */
export function parseDefectDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{2})-(\d{2})-(\d{4})/.exec(s);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeDefectStatus(defect: DefectStatusInput, now: Date = new Date()): ComputedDefectStatus {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (defect.verified === true) return COMPUTED_STATUS.VERIFIED;
  if (parseDefectDate(defect.dateCompleted)) return COMPUTED_STATUS.CLOSED;
  const target = parseDefectDate(defect.targetCloseDate);
  if (target && today > target) return COMPUTED_STATUS.OVERDUE;
  if (defect.isDeferred === true) return COMPUTED_STATUS.EXTENDED;
  if (Array.isArray(defect.actions) && defect.actions.length > 0) return COMPUTED_STATUS.IN_PROGRESS;
  return COMPUTED_STATUS.REPORTED;
}

export function isDefectOverdue(defect: DefectStatusInput, now: Date = new Date()): boolean {
  return computeDefectStatus(defect, now) === COMPUTED_STATUS.OVERDUE;
}
