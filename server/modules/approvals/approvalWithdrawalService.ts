/**
 * Sender withdrawal of a pending approval (28-Sep-2026, Sahil E6 / Q8 — "only the sender may cancel").
 *
 *  - The SENDER presses Withdraw (ship or shore). A row is written in approval_withdrawals.
 *  - On shore it is processed at once; a ship row is processed when it arrives by sync (the arrival
 *    sweep calls processOpenWithdrawals BEFORE it starts new chains). The approver does nothing.
 *  - Processing: still waiting → the engine request (if any) is withdrawn — its approvers get a bell
 *    notification — and the record goes back: CR → draft; WO postponement → reverted exactly as on a
 *    rejection (decision row 'Withdrawn'); defect extension entry → 'Withdrawn', target date unchanged.
 *    Already decided → 'too-late', the decision stands. Not the sender → 'refused'.
 *  - Defect verification cannot be withdrawn (not a subject type here).
 */
import { AppError, NotFoundError, ValidationError } from '../shared/errors';
import { approvalRequestsInScopes, scopeFor, withdrawEngineRequest, isApprovalEngineAvailable } from './engineGateway';
import * as repo from './approvalWithdrawalsRepository';
import type { ApprovalWithdrawal } from './withdrawalSchema';
import type { Scope } from '../approval-engine';
import { changeRequestSender, withdrawChangeRequest } from '../change-requests/services/changeRequestsService';
import { postponementRequestSender, withdrawPostponementRequest } from '../work-orders/services/workOrderService';
import { extensionEntrySender, withdrawExtensionEntry } from '../defects/services/defectsService';
import { isShipInstance } from '../sync/syncRole';

export const SUBJECT_TYPES = ['change-request', 'wo-postponement', 'defect-extension'] as const;
export type WithdrawalSubjectType = typeof SUBJECT_TYPES[number];
const isSubjectType = (v: string): v is WithdrawalSubjectType => (SUBJECT_TYPES as readonly string[]).includes(v);

/** The subject as the module sees it now. */
interface SubjectState {
  /** Canonical reference (the engine's subjectRef): cruuid | wouuid | duuid. */
  ref: string;
  vesselId: string | null;
  sender: string | null;
  waiting: boolean;
  stateText: string;
  scopes: Scope[];
  reset: (actor: { userUuid: string; name: string | null }) => Promise<void>;
}

async function subjectState(type: WithdrawalSubjectType, subjectRef: string, extensionId: string | null): Promise<SubjectState | null> {
  if (type === 'change-request') {
    const cr = await changeRequestSender(subjectRef);
    if (!cr) return null;
    return {
      ref: subjectRef, vesselId: cr.vesselId, sender: cr.sender, waiting: cr.status === 'submitted', stateText: cr.status,
      scopes: cr.functionId ? [scopeFor('technical', cr.functionId)] : [],
      reset: () => withdrawChangeRequest(cr.id),
    };
  }
  if (type === 'wo-postponement') {
    const wo = await postponementRequestSender(subjectRef);
    if (!wo) return null;
    return {
      ref: wo.wouuid, vesselId: wo.vesselId, sender: wo.sender, waiting: wo.status === 'Awaiting Office Approval', stateText: wo.status ?? 'unknown',
      scopes: [scopeFor('technical', 'pms-wo-postponement'), scopeFor('technical', 'pms-wo-re-postponement')],
      reset: (actor) => withdrawPostponementRequest(wo.wouuid, actor),
    };
  }
  if (!extensionId) return null;
  const entry = await extensionEntrySender(subjectRef, extensionId);
  if (!entry) return null;
  return {
    ref: entry.duuid, vesselId: entry.vesselId, sender: entry.sender, waiting: entry.status === 'Requested', stateText: entry.status ?? 'unknown',
    scopes: [scopeFor('defects', 'defects-extension'), scopeFor('defects', 'defects-repeat-extension')],
    reset: () => withdrawExtensionEntry(entry.duuid, extensionId),
  };
}

function parseInput(input: { subjectType: string; subjectRef: string; extensionId?: string | null }): { type: WithdrawalSubjectType; extensionId: string | null } {
  if (!isSubjectType(input.subjectType)) {
    throw new ValidationError(`subjectType must be one of ${SUBJECT_TYPES.join(', ')} (a defect verification cannot be withdrawn)`);
  }
  if (!input.subjectRef) throw new ValidationError('subjectRef is required');
  if (input.subjectType === 'defect-extension' && !input.extensionId) throw new ValidationError('extensionId is required for a defect extension');
  return { type: input.subjectType, extensionId: input.subjectType === 'defect-extension' ? String(input.extensionId) : null };
}

/** Why this user cannot withdraw now (null = allowed). The same rules the POST enforces. */
async function blockedReason(state: SubjectState, extensionId: string | null, userUuid: string | null): Promise<{ status: number; code: string; message: string } | null> {
  if (!state.sender) return { status: 409, code: 'NO_SENDER', message: 'This request was sent before withdrawal was available — its sender is not recorded, so it cannot be withdrawn.' };
  if (!userUuid || state.sender !== userUuid) return { status: 403, code: 'NOT_SENDER', message: 'Only the person who sent this request can withdraw it.' };
  if (!state.waiting) return { status: 409, code: 'NOT_WAITING', message: `This request is no longer waiting for approval (${state.stateText}).` };
  if (!state.vesselId) return { status: 409, code: 'NO_VESSEL', message: 'The request has no vessel.' };
  const open = (await repo.listWithdrawalsForSubject(state.ref)).find((w) => !w.outcome && (w.extensionId ?? null) === extensionId);
  if (open) return { status: 409, code: 'ALREADY_ASKED', message: 'A withdrawal is already waiting for the office.' };
  return null;
}

/** For the screens: may the caller withdraw, plus the withdrawal history of this request. */
export async function withdrawalStatus(
  input: { subjectType: string; subjectRef: string; extensionId?: string | null }, userUuid: string | null,
): Promise<{ canWithdraw: boolean; blockedReason: string | null; withdrawals: ApprovalWithdrawal[] }> {
  const { type, extensionId } = parseInput(input);
  const state = await subjectState(type, input.subjectRef, extensionId);
  if (!state) return { canWithdraw: false, blockedReason: 'NOT_FOUND', withdrawals: [] };
  const blocked = await blockedReason(state, extensionId, userUuid);
  const withdrawals = (await repo.listWithdrawalsForSubject(state.ref)).filter((w) => (w.extensionId ?? null) === extensionId);
  return { canWithdraw: !blocked, blockedReason: blocked?.code ?? null, withdrawals };
}

/** The sender asks to withdraw. Validated where the sender is (ship or shore); processed on shore. */
export async function requestWithdrawal(
  input: { subjectType: string; subjectRef: string; extensionId?: string | null; reason?: string | null },
  actor: { userUuid: string; name: string | null },
): Promise<ApprovalWithdrawal> {
  const { type, extensionId } = parseInput(input);
  const state = await subjectState(type, input.subjectRef, extensionId);
  if (!state) throw new NotFoundError('The request to withdraw was not found.');
  const blocked = await blockedReason(state, extensionId, actor.userUuid);
  if (blocked || !state.vesselId) {
    throw new AppError(blocked?.status ?? 409, blocked?.message ?? 'The request has no vessel.', { code: blocked?.code ?? 'NO_VESSEL' });
  }
  const row = await repo.insertWithdrawal({
    vesselId: state.vesselId, subjectType: type, subjectRef: state.ref, extensionId,
    reason: input.reason?.trim() || null, requestedByUuid: actor.userUuid, requestedByName: actor.name,
  });
  if (await isShipInstance()) return row; // the office cancels it when it arrives
  return (await processWithdrawal(row)) ?? row;
}

/** Shore: settle one open withdrawal. Returns the updated row (null when already settled). */
export async function processWithdrawal(row: ApprovalWithdrawal): Promise<ApprovalWithdrawal | null> {
  if (row.outcome) return null;
  const settle = (outcome: repo.WithdrawalOutcome, note: string | null) => repo.setWithdrawalOutcome(row.awuuid, outcome, note, row.requestedByUuid);
  if (!isSubjectType(row.subjectType)) return settle('refused', `Unknown request type '${row.subjectType}'.`);
  const state = await subjectState(row.subjectType, row.subjectRef, row.extensionId ?? null);
  if (!state) return settle('refused', 'The request was not found in the office.');
  // Decided first: once decided, the request's sender record may be gone (a WO postponement's waiting
  // row is closed by the decision) and nobody can change the outcome anyway — the decision stands.
  if (!state.waiting) return settle('too-late', `Already decided before the withdrawal arrived (${state.stateText}) — the decision stands.`);
  if (!state.sender || state.sender !== row.requestedByUuid) return settle('refused', 'Only the person who sent the request can withdraw it.');

  const requests = state.scopes.length ? await approvalRequestsInScopes(state.scopes, row.subjectRef) : [];
  const latest = [...requests].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
  if (latest && (latest.status === 'approved' || latest.status === 'returned')) {
    // The office decided; only the record update is behind (diagnostics "Apply again" finishes it).
    return settle('too-late', `Already ${latest.status === 'approved' ? 'approved' : 'rejected'} before the withdrawal arrived — the decision stands.`);
  }
  if (latest?.status === 'pending') {
    try {
      await withdrawEngineRequest(latest.requuid, row.requestedByUuid, row.reason ?? null);
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 409) {
        return settle('too-late', 'Decided while the withdrawal was being processed — the decision stands.');
      }
      throw e;
    }
  }
  await state.reset({ userUuid: row.requestedByUuid, name: row.requestedByName ?? null });
  return settle('withdrawn', null);
}

/** Shore arrival sweep: settle every open withdrawal of a vessel (runs before new chains start). */
export async function processOpenWithdrawals(vesselId: string): Promise<number> {
  if (!isApprovalEngineAvailable()) return 0;
  let done = 0;
  for (const row of await repo.listOpenWithdrawals(vesselId)) {
    try {
      if (await processWithdrawal(row)) done++;
    } catch (e) {
      // Left open — retried on the next arrival sweep.
      console.error(`[approvals] withdrawal ${row.awuuid} (${row.subjectType} ${row.subjectRef}) failed (will retry):`, e);
    }
  }
  return done;
}

export async function listWithdrawals(subjectRef: string): Promise<ApprovalWithdrawal[]> {
  if (!subjectRef) throw new ValidationError('subjectRef is required');
  return repo.listWithdrawalsForSubject(subjectRef);
}
