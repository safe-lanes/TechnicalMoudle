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