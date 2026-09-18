export const SERVER_MANAGED_WORK_ORDER_RH_FIELDS = [
  'rhSyncedAt',
  'rhUpdateOutcome',
  'rhSkipReason',
  'rhSkipSubmittedRh',
  'rhSkipLatestRh',
  'rhSkipLatestRhDate',
] as const;

export const WORK_ORDER_B3_FIELDS = [
  'runningHours',
  'previousReading',
  'runningHoursDifference',
  'readingDate',
  'currentReadingDate',
  'currentReading',
] as const;

export function isWorkOrderB3Applicable(
  rhCounterType: string | null | undefined,
): boolean {
  const normalizedCounterType = String(rhCounterType || '').trim().toUpperCase();
  return normalizedCounterType === 'MASTER' || normalizedCounterType === 'INHERITED';
}

/**
 * Hidden Work Order fields must not leak stale form or database-context values
 * into draft, submit, resubmit, or completion payloads.
 */
export function sanitizeWorkOrderB3Fields<T extends Record<string, unknown>>(
  input: T,
  rhCounterType: string | null | undefined,
): T {
  const output = { ...input };
  if (!isWorkOrderB3Applicable(rhCounterType)) {
    for (const field of WORK_ORDER_B3_FIELDS) {
      delete output[field];
    }
  } else {
    // Previous Reading is no longer user-visible or submitted. Authoritative
    // timeline validation derives its baseline from stored RH history.
    delete output.previousReading;
  }
  return output;
}

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