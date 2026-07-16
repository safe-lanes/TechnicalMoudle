/**
 * Approval queue (Phase 2 of the WK approval-flow streamlining).
 *
 * A "Review Queue" started from the Work Orders → Pending Approval tab stores
 * the ORDERED id-list of the currently filtered pending WOs in sessionStorage.
 * The WO form page shows "N of M" + Previous/Skip/Exit controls and, after an
 * approval or rejection, AUTO-ADVANCES to the next WO instead of returning to
 * the list — no pagination round-trips between approvals.
 *
 * sessionStorage (not React state) on purpose: the queue survives a form-page
 * reload and the per-WO remounts (App.tsx keys the form route by WO id so each
 * queue step gets a clean form). Clears when the browser tab closes.
 *
 * The queue NEVER weakens approval rules: it only navigates. The Approval
 * Section and the server-side Layer-5 gates are untouched — locked WOs appear
 * in the queue visibly locked (Approve disabled) and can only be skipped.
 */

const KEY = 'woApprovalQueue';

export interface ApprovalQueueState {
  /** Remaining WO ids, in the list order the officer saw. */
  ids: string[];
  /** Size of the queue when started (for "N of M"). */
  startedWith: number;
  /** Vessel scope label captured at start (display only). */
  vesselId: string | null;
}

function read(): ApprovalQueueState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.ids)) return null;
    return parsed as ApprovalQueueState;
  } catch {
    return null;
  }
}

function write(state: ApprovalQueueState | null) {
  try {
    if (state === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function startApprovalQueue(ids: string[], vesselId: string | null): void {
  write({ ids: [...ids], startedWith: ids.length, vesselId });
}

export function clearApprovalQueue(): void {
  write(null);
}

export function getApprovalQueue(): ApprovalQueueState | null {
  return read();
}

/**
 * Position of a WO in the active queue, or null when there is no queue or the
 * WO isn't part of it (e.g. the officer navigated somewhere else mid-queue).
 */
export function getQueuePosition(workOrderId: string | undefined): {
  index: number;        // 0-based position among the REMAINING ids
  remaining: number;    // ids still in the queue (including current)
  startedWith: number;  // original queue size
  done: number;         // processed so far (approved/rejected — skips don't count)
  prevId: string | null;
  nextId: string | null;
} | null {
  if (!workOrderId) return null;
  const q = read();
  if (!q) return null;
  const index = q.ids.indexOf(workOrderId);
  if (index === -1) return null;
  return {
    index,
    remaining: q.ids.length,
    startedWith: q.startedWith,
    done: q.startedWith - q.ids.length,
    prevId: index > 0 ? q.ids[index - 1] : null,
    nextId: index < q.ids.length - 1 ? q.ids[index + 1] : null,
  };
}

/**
 * Called after a WO is approved or rejected: remove it from the queue and
 * return the id to advance to (the element that took its slot), or null when
 * the queue is exhausted (queue is cleared) or wasn't active for this WO.
 */
export function advanceApprovalQueue(workOrderId: string | undefined): { nextId: string | null; queueWasActive: boolean } {
  if (!workOrderId) return { nextId: null, queueWasActive: false };
  const q = read();
  if (!q) return { nextId: null, queueWasActive: false };
  const index = q.ids.indexOf(workOrderId);
  if (index === -1) return { nextId: null, queueWasActive: false };

  q.ids.splice(index, 1);
  if (q.ids.length === 0) {
    write(null);
    return { nextId: null, queueWasActive: true };
  }
  write(q);
  // The next WO is the one now occupying the removed slot (or the new last).
  const nextId = q.ids[Math.min(index, q.ids.length - 1)];
  return { nextId, queueWasActive: true };
}
