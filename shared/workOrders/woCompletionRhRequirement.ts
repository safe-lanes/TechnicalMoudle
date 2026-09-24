import { normalizeRhCounterType } from '../workOrderPayload';

export function requiresWoCompletionRh(
  maintenanceBasis: string | null | undefined,
  rhCounterType: string | null | undefined,
): boolean {
  const normalizedBasis = String(maintenanceBasis || '').trim().toUpperCase();
  const normalizedCounterType = normalizeRhCounterType(rhCounterType);

  return normalizedBasis === 'RUNNING HOURS' &&
    (normalizedCounterType === 'MASTER' || normalizedCounterType === 'INHERITED');
}