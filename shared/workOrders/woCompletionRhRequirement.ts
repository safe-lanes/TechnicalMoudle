export function requiresWoCompletionRh(
  maintenanceBasis: string | null | undefined,
  rhCounterType: string | null | undefined,
): boolean {
  const normalizedBasis = String(maintenanceBasis || '').trim().toUpperCase();
  const normalizedCounterType = String(rhCounterType || '').trim().toUpperCase();

  return normalizedBasis === 'RUNNING HOURS' &&
    (normalizedCounterType === 'MASTER' || normalizedCounterType === 'INHERITED');
}