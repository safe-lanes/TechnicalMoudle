/** Presentation-only predicate. Internal retry checks and sync must retain skipped rows. */
export function isVisibleMaintenanceHistory(row: {
  isSkipped?: unknown;
  is_skipped?: unknown;
  status?: unknown;
}): boolean {
  return row.isSkipped !== true && row.isSkipped !== 'true'
    && row.is_skipped !== true && row.is_skipped !== 'true'
    && String(row.status ?? '').trim().toUpperCase() !== 'SKIPPED';
}
