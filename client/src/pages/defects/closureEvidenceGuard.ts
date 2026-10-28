/**
 * Closure-evidence protection, mirrored from the server rule so the Attachment(s) popup refuses at once
 * instead of showing "File Removed" and failing later on Save (QA round 3 DF-09, 28-Oct-2026).
 *
 * Server rule (server/modules/defects/services/defectsService.ts, protectedEvidenceIds / assertDefectEvidenceRules,
 * 25-Sep-2026 Sahil E10/E11): once a defect is CLOSED every file already on it is protected; and any file
 * referenced as closure evidence by a REJECTED closure attempt stays protected even after the reopen.
 * The server keeps enforcing it — this is the early, identical answer for the popup.
 */
export const CLOSURE_EVIDENCE_PROTECTED_MESSAGE =
  "Closure evidence cannot be removed once the defect is closed, or after a closure was rejected with it.";

export interface ClosureAttemptLike { closureFiles?: string[] | null }
export interface DefectLike {
  status?: string | null;
  confirmCompleted?: boolean | null;
  attachments?: unknown;
}

/** Same test as the server's isClosedDefect. */
export function isClosedDefect(d: DefectLike | null | undefined): boolean {
  if (!d) return false;
  if (d.confirmCompleted === true) return true;
  return ["closed", "resolved", "completed"].includes(String(d.status ?? "").trim().toLowerCase());
}

/** Attachment ids as the server reads them from the defect's saved `attachments` JSON. */
export function savedAttachmentIds(list: unknown): string[] {
  return Array.isArray(list)
    ? list.map((a: any) => a?.id).filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
    : [];
}

/** The ids the server will refuse to remove: all saved files of a closed defect + evidence of rejected closures. */
export function protectedClosureEvidenceIds(
  defect: DefectLike | null | undefined,
  closureHistory: readonly ClosureAttemptLike[] | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (isClosedDefect(defect)) for (const id of savedAttachmentIds(defect?.attachments)) ids.add(id);
  for (const h of closureHistory ?? []) for (const f of h.closureFiles ?? []) if (typeof f === "string" && f) ids.add(f);
  return ids;
}

/** The refusal message for removing `attachmentId`, or null when the removal is allowed. */
export function closureEvidenceRemovalRefusal(
  attachmentId: string,
  defect: DefectLike | null | undefined,
  closureHistory: readonly ClosureAttemptLike[] | null | undefined,
): string | null {
  return protectedClosureEvidenceIds(defect, closureHistory).has(attachmentId) ? CLOSURE_EVIDENCE_PROTECTED_MESSAGE : null;
}
