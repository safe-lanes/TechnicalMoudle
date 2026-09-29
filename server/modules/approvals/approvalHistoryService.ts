/**
 * Approval history for Technical approvals (29-Sep-2026, Jeevan's "Approval process" request).
 *
 * Every submission / decision / acknowledgement is recorded as one approval_history row with the
 * actor's NAME and RANK/POSITION frozen at that moment, where it happens (vessel or office); the rows
 * sync both ways so the vessel sees the same history. The screens show it the Defects way: every
 * attempt in order (rejected attempts and resubmissions included), "Not Recorded" where an older
 * record never captured who or when.
 *
 * Recording never breaks the business action: failures are logged, not thrown.
 */
import { getRequestContext } from '../../middleware/requestContext';
import * as repo from './approvalHistoryRepository';
import type { ApprovalHistoryRow } from './approvalHistorySchema';

export type HistorySubjectType = 'wo-completion' | 'wo-postponement' | 'wo-re-postponement' | 'change-request';
export type HistoryEventType =
  | 'submitted' | 'approved' | 'rejected' | 'forwarded' | 'completed'
  | 'ts-acknowledged' | 'ts-rejected' | 'reopened'
  | 'withdrawal-requested' | 'withdrawn' | 'withdrawal-too-late';

export interface HistoryActor { uuid: string | null; name: string | null; position: string | null }

/** Name + rank/position of the current request's user (frozen into the event). */
export async function currentActor(): Promise<HistoryActor> {
  const a = getRequestContext()?.actor;
  if (!a || a.actorId === 'system') return { uuid: null, name: null, position: null };
  let name = a.actorName ?? (a.actorType !== 'Ship' ? a.actorLabel : null);
  let position = a.actorRank ?? (a.actorType === 'Ship' ? a.actorLabel : a.actorRole);
  if (!name || !position) {
    const u = await repo.lookupUser(a.actorId).catch(() => null);
    name = name ?? u?.name ?? null;
    position = position ?? u?.role ?? null;
  }
  return { uuid: a.actorId, name: name?.trim() || null, position: position?.trim() || null };
}

export async function recordApprovalEvent(input: {
  vesselId: string | null | undefined; subjectType: HistorySubjectType; subjectRef: string | null | undefined;
  eventType: HistoryEventType; stepLabel?: string | null; remarks?: string | null; actor?: HistoryActor;
}): Promise<void> {
  try {
    if (!input.vesselId || !input.subjectRef) return;
    const actor = input.actor ?? await currentActor();
    await repo.insertEvent({
      vesselId: input.vesselId, subjectType: input.subjectType, subjectRef: input.subjectRef, eventType: input.eventType,
      stepLabel: input.stepLabel ?? null, actorUuid: actor.uuid, actorName: actor.name, actorPosition: actor.position,
      remarks: input.remarks?.trim() || null,
    });
  } catch (e) {
    console.error(`[approval-history] could not record ${input.eventType} for ${input.subjectType} ${input.subjectRef} (action unaffected):`, e);
  }
}

// ── Display ────────────────────────────────────────────────────────────────────

export interface ProcessEvent {
  type: string; label: string;
  byName: string | null; byPosition: string | null; at: string | null; remarks: string | null;
}
export interface ProcessAttempt { number: number; events: ProcessEvent[] }
export interface ApprovalProcess { subjectType: string; attempts: ProcessAttempt[] }

/** An event from an older record (module fields) — who/when may be missing ("Not Recorded"). */
export interface LegacyEvent {
  type: HistoryEventType; at: string | null; byName?: string | null; byPosition?: string | null;
  remarks?: string | null; stepLabel?: string | null;
}

interface RawEvent { type: string; at: string | null; byName: string | null; byPosition: string | null; remarks: string | null; stepLabel: string | null }

const isPostponement = (t: string) => t === 'wo-postponement' || t === 'wo-re-postponement';

function labelFor(subjectType: string, e: RawEvent, attempt: number): string {
  const step = e.stepLabel ? ` — ${e.stepLabel}` : '';
  switch (e.type) {
    case 'submitted':
      return isPostponement(subjectType) ? (attempt > 1 ? 'Requested again' : 'Requested') : (attempt > 1 ? 'Resubmitted' : 'Submitted');
    case 'approved': return `Approved${step}`;
    case 'rejected': return `Rejected${step}`;
    case 'forwarded': return 'Approved — sent for office review';
    case 'completed': return 'Completed';
    case 'ts-acknowledged': return 'Acknowledged by Technical Superintendent';
    case 'ts-rejected': return 'Rejected by Technical Superintendent';
    case 'reopened': return 'Reopened';
    case 'withdrawal-requested': return 'Withdrawal requested';
    case 'withdrawn': return 'Withdrawn';
    case 'withdrawal-too-late': return 'Withdrawal too late — the decision stands';
    default: return e.type;
  }
}

const toMs = (at: string | null) => (at ? Date.parse(at) : NaN);

/** Pure: recorded rows + older-record events → attempts (a new attempt starts at every submission). */
export function buildApprovalProcess(subjectType: string, rows: Array<Pick<ApprovalHistoryRow, 'eventType' | 'occurredAt' | 'actorName' | 'actorPosition' | 'remarks' | 'stepLabel'>>, legacy: LegacyEvent[] = []): ApprovalProcess {
  const recorded: RawEvent[] = rows.map((r) => ({
    type: r.eventType, at: r.occurredAt ? new Date(r.occurredAt).toISOString() : null,
    byName: r.actorName ?? null, byPosition: r.actorPosition ?? null, remarks: r.remarks ?? null, stepLabel: r.stepLabel ?? null,
  }));
  // Older-record events only for the time before the first recorded event (never duplicated).
  const firstRecorded = recorded.length ? toMs(recorded[0].at) : NaN;
  const day = (at: string | null) => (at ? at.slice(0, 10) : '');
  const older: RawEvent[] = legacy
    .filter((l) => recorded.length === 0 || (!Number.isNaN(toMs(l.at)) && toMs(l.at) < firstRecorded))
    // A request that spans this change (sent before, decided after) must not show its decision twice.
    .filter((l) => !recorded.some((r) => r.type === l.type && day(r.at) === day(l.at)))
    .map((l) => ({ type: l.type, at: l.at, byName: l.byName ?? null, byPosition: l.byPosition ?? null, remarks: l.remarks ?? null, stepLabel: l.stepLabel ?? null }));
  const all = [...older, ...recorded];
  const attempts: ProcessAttempt[] = [];
  for (const e of all) {
    if (e.type === 'submitted' || attempts.length === 0) attempts.push({ number: attempts.length + 1, events: [] });
    const current = attempts[attempts.length - 1];
    current.events.push({ type: e.type, label: labelFor(subjectType, e, current.number), byName: e.byName, byPosition: e.byPosition, at: e.at, remarks: e.remarks });
  }
  return { subjectType, attempts };
}

export async function approvalProcess(subjectType: HistorySubjectType, subjectRef: string, legacy: LegacyEvent[] = []): Promise<ApprovalProcess> {
  return buildApprovalProcess(subjectType, await repo.listEvents(subjectRef, [subjectType]), legacy);
}

/** For older records: a user id → name + role from master data (office only; null when unknown). */
export async function legacyUser(userUuid: string | null | undefined): Promise<{ byName: string | null; byPosition: string | null }> {
  if (!userUuid) return { byName: null, byPosition: null };
  const u = await repo.lookupUser(userUuid).catch(() => null);
  return { byName: u?.name ?? null, byPosition: u?.role ?? null };
}
