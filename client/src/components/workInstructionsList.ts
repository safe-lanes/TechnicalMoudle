/**
 * Work Instructions dialog — pure list helpers (no React), unit-tested in tests/components.
 *
 * 28-Oct-2026 (QA WI-13 / SH-06, Jeevan "Issue 02"): the "Show removed" link never appeared because the
 * dialog only requested removed links AFTER the link was clicked, while the link itself was only rendered
 * once removed links were present — a chicken-and-egg. The Job list now always includes removed links
 * (`includeRemoved=1`); the dialog splits them client-side and offers the toggle whenever there are any.
 */
export interface WorkInstructionLinkRow {
  jwluuid: string;
  jobId: string;
  vesselId: string;
  isDeleted: boolean;
  attachedAt: string;
  /** Set on removed links only: when the link was removed (server: the link's last update). */
  removedAt?: string | null;
  file: { jwfuuid: string; fileName: string; fileSize: number | null; revisionRemarks: string | null; uploadedAt: string; isDeleted: boolean } | null;
}

/** The list endpoint for the dialog: a Job's list always carries removed links; a Work Order's list is current-only. */
export function workInstructionsListUrl(jobId: string | null | undefined, workOrderId: string | null | undefined): string | null {
  if (jobId) return `/technical/api/jobs/${encodeURIComponent(jobId)}/work-instructions?includeRemoved=1`;
  if (workOrderId) return `/technical/api/work-orders/${encodeURIComponent(workOrderId)}/work-instructions`;
  return null;
}

/** Active links first (as returned), removed links separately. */
export function splitWorkInstructionRows<T extends { isDeleted: boolean }>(rows: readonly T[] | null | undefined): { active: T[]; removed: T[] } {
  const active: T[] = [];
  const removed: T[] = [];
  for (const r of rows ?? []) (r.isDeleted ? removed : active).push(r);
  return { active, removed };
}

/** The toggle is offered as soon as there is something to show; it is never hidden while it is "on". */
export function showRemovedToggle(removedCount: number, showRemoved: boolean): boolean {
  return removedCount > 0 || showRemoved;
}

export function removedToggleLabel(removedCount: number, showRemoved: boolean): string {
  return showRemoved ? "Hide removed" : `Show removed (${removedCount})`;
}

/** Secondary line of a row: size · uploaded <date> · remarks · removed <date>. */
export function workInstructionRowMeta(
  r: WorkInstructionLinkRow,
  fmtSize: (n: number | null | undefined) => string,
  fmtDate: (s: string | null | undefined) => string,
): string {
  const parts: string[] = [];
  const size = fmtSize(r.file?.fileSize);
  if (size) parts.push(size);
  if (r.file?.uploadedAt) parts.push(`uploaded ${fmtDate(r.file.uploadedAt)}`);
  if (r.file?.revisionRemarks) parts.push(r.file.revisionRemarks);
  if (r.isDeleted) parts.push(r.removedAt ? `removed ${fmtDate(r.removedAt)}` : "removed");
  return parts.join(" · ");
}
