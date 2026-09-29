/**
 * Work Order approval history (29-Sep-2026, Jeevan's "Approval process" request).
 *
 * WO completion approval itself is unchanged (not on the approval engine — the approver is
 * pre-defined in the WO form). This file only RECORDS who did what and when, through the approvals
 * module's history service, and builds what the WO form shows:
 *   completion      — Submitted / Approved / Rejected / Tech. Sup. acknowledged / reopened, every attempt
 *   postponement    — Requested / Approved / Rejected / Withdrawn, every attempt
 *   re-postponement — the same for re-postponements
 * Older records (before this change) come from the WO / postponement fields with "Not Recorded" where
 * who or when was never captured.
 */
import * as repo from '../repositories/workOrderRepository';
import { NotFoundError } from '../../shared/errors';
import type {
  ApprovalProcess, HistoryEventType, HistorySubjectType, LegacyEvent,
} from '../../approvals/approvalHistoryService';

const history = () => import('../../approvals/approvalHistoryService');

type WoLike = { wouuid: string; vesselId?: string | null; status?: string | null; superintendentAcknowledged?: boolean | null };

export async function recordWoEvent(
  wo: Pick<WoLike, 'wouuid' | 'vesselId'>, subjectType: HistorySubjectType, eventType: HistoryEventType,
  extra: { remarks?: string | null; stepLabel?: string | null } = {},
): Promise<void> {
  const { recordApprovalEvent } = await history();
  await recordApprovalEvent({ vesselId: wo.vesselId, subjectType, subjectRef: wo.wouuid, eventType, ...extra });
}

const OFFICE_REVIEW = 'Office review';

/** Pure: which completion events a WO update represents (before → after). */
export function woCompletionEventsForUpdate(
  before: { status?: string | null; superintendentAcknowledged?: boolean | null },
  after: { status?: string | null; superintendentAcknowledged?: boolean | null },
  flags: { rejected: boolean; forwardedForOfficeReview: boolean },
  remarks: { approval?: string | null; rejection?: string | null } = {},
): Array<{ eventType: HistoryEventType; remarks: string | null; stepLabel: string | null }> {
  const out: Array<{ eventType: HistoryEventType; remarks: string | null; stepLabel: string | null }> = [];
  const was = before.status ?? null;
  const now = after.status ?? was;
  if (flags.rejected) {
    out.push({ eventType: 'rejected', remarks: remarks.rejection ?? null, stepLabel: was === 'Pending Office Review' ? OFFICE_REVIEW : null });
    return out;
  }
  if (now === 'Pending Approval' && was !== 'Pending Approval') out.push({ eventType: 'submitted', remarks: null, stepLabel: null });
  if (flags.forwardedForOfficeReview) {
    out.push({ eventType: 'forwarded', remarks: remarks.approval ?? null, stepLabel: null });
  } else if (now === 'Completed' && was !== 'Completed') {
    const approved = was === 'Pending Approval' || was === 'Pending Office Review';
    out.push({ eventType: approved ? 'approved' : 'completed', remarks: remarks.approval ?? null, stepLabel: was === 'Pending Office Review' ? OFFICE_REVIEW : null });
  }
  if (after.superintendentAcknowledged === true && before.superintendentAcknowledged !== true) {
    out.push({ eventType: 'ts-acknowledged', remarks: null, stepLabel: null });
  }
  return out;
}

/** Record the completion events of a WO update (never throws). */
export async function recordWoCompletionUpdate(
  before: WoLike, after: { status?: string | null; superintendentAcknowledged?: boolean | null },
  flags: { rejected: boolean; forwardedForOfficeReview: boolean },
  remarks: { approval?: string | null; rejection?: string | null } = {},
): Promise<void> {
  for (const e of woCompletionEventsForUpdate(before, after, flags, remarks)) {
    await recordWoEvent(before, 'wo-completion', e.eventType, { remarks: e.remarks, stepLabel: e.stepLabel });
  }
}

// ── What the WO form shows ────────────────────────────────────────────────────

/** Oldest first; an event whose time was never captured keeps its natural place at the end. */
const whenMs = (e: LegacyEvent) => { const t = Date.parse(e.at ?? ''); return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t; };
const byTime = (a: LegacyEvent, b: LegacyEvent) => whenMs(a) - whenMs(b);
const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Older completion record: only the latest cycle survives on the WO itself. */
function legacyCompletion(wo: any): LegacyEvent[] {
  const out: LegacyEvent[] = [];
  const submitted = nonEmpty(wo.submittedDate);
  if (submitted) out.push({ type: 'submitted', at: submitted });
  if (wo.wasRejected === true && nonEmpty(wo.rejectionDate)) {
    out.push({ type: 'rejected', at: wo.rejectionDate, remarks: wo.rejectionComments ?? null });
  }
  if (nonEmpty(wo.superintendentAcknowledgedAt)) out.push({ type: 'ts-acknowledged', at: wo.superintendentAcknowledgedAt });
  if (wo.status === 'Completed') {
    const approver = nonEmpty(wo.approver);
    out.push({ type: approver ? 'approved' : 'completed', at: nonEmpty(wo.approvalDate), byPosition: approver,
      remarks: wo.ceApprovalRemarks ?? wo.approverRemarks ?? null });
  }
  return out.sort(byTime);
}

/** Older postponement records: request rows and decision rows of work_order_postponements. */
async function legacyPostponements(rows: any[], rePostponement: boolean): Promise<LegacyEvent[]> {
  const { legacyUser } = await history();
  const out: LegacyEvent[] = [];
  const mine = rows.filter((r) => (r.requestType === 'Re-Postponement') === rePostponement)
    .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  for (const r of mine) {
    const created = r.createdAt ? new Date(r.createdAt).toISOString() : null;
    if (r.status === 'Awaiting Approval' || r.status === 'Pending') {
      out.push({ type: 'submitted', at: nonEmpty(r.submittedDate) ?? created, ...(await legacyUser(r.createdByUuid)) });
    } else if (r.status === 'Approved' || r.status === 'Rejected' || r.status === 'Withdrawn') {
      out.push({
        type: r.status === 'Approved' ? 'approved' : r.status === 'Rejected' ? 'rejected' : 'withdrawn',
        at: nonEmpty(r.approvedDate) ?? created, byName: nonEmpty(r.approvedBy), remarks: r.approvalRemarks ?? null,
      });
    }
  }
  return out;
}

export async function getWorkOrderApprovalProcess(woRef: string): Promise<{
  completion: ApprovalProcess; postponement: ApprovalProcess; rePostponement: ApprovalProcess;
}> {
  const wo = await repo.findById(woRef);
  if (!wo) throw new NotFoundError('Work order not found');
  const rows = (await repo.findPostponementsByWorkOrderId(wo.wouuid)) ?? [];
  const { approvalProcess } = await history();
  return {
    completion: await approvalProcess('wo-completion', wo.wouuid, legacyCompletion(wo)),
    postponement: await approvalProcess('wo-postponement', wo.wouuid, await legacyPostponements(rows, false)),
    rePostponement: await approvalProcess('wo-re-postponement', wo.wouuid, await legacyPostponements(rows, true)),
  };
}
