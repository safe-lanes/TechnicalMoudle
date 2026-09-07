export const SERVER_MANAGED_WORK_ORDER_RH_FIELDS = [
  'rhSyncedAt',
  'rhUpdateOutcome',
  'rhSkipReason',
  'rhSkipSubmittedRh',
  'rhSkipLatestRh',
  'rhSkipLatestRhDate',
] as const;

/**
 * Work Order context includes RH outcome metadata so completed approvals can
 * explain why live RH was not changed. That metadata is read-only and must
 * never be copied back into draft, submit, or resubmission payloads.
 */
export function stripServerManagedWorkOrderRhFields<T extends Record<string, unknown>>(input: T): T {
  const output = { ...input };
  for (const field of SERVER_MANAGED_WORK_ORDER_RH_FIELDS) {
    delete output[field];
  }
  return output;
}