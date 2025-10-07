// Canonical defect status definitions
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

// Status groupings for filtering
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

// Helper function to check status type
export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as DefectStatus);
}

export function isResolvedStatus(status: string): boolean {
  return RESOLVED_STATUSES.includes(status as DefectStatus);
}