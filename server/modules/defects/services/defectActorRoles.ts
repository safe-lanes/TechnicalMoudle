import { lookupAccountRoles } from '../../approvals/approvalHistoryRepository';

/**
 * Defect display enrichment only: these are available CURRENT account roles,
 * not reconstructed historical snapshots. No viewer identity or name matching.
 * Shore-local master data may be absent on a vessel; retain events without roles.
 */
export async function loadDefectActorRoles(ids: Array<string | null | undefined>): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id?.trim()) && id !== 'system')));
  if (!unique.length) return new Map();
  try {
    return await lookupAccountRoles(unique);
  } catch (error) {
    console.warn('[defect-approval-display] Account roles unavailable; retaining history without role enrichment.', error);
    return new Map();
  }
}
