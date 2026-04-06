export const OVERDUE_REASONS = [
  "Crew workload / manpower limitation",
  "Waiting for spares or consumables",
  "Operational priority / equipment in continuous use",
  "Weather / sea conditions",
  "Port operations / cargo operations",
  "Permit / isolation / access constraints",
  "Machinery shutdown opportunity not available",
  "Riding squad / external technician required",
] as const;

export type OverdueReason = typeof OVERDUE_REASONS[number];
