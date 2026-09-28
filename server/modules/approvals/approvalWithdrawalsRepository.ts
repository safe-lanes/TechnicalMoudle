/**
 * approval_withdrawals (migration 178, 28-Sep-2026, Sahil E6) — sender withdrawals of pending approvals.
 * BOTH_EDITABLE with disjoint writers: the sender's side inserts, the shore writes the outcome.
 * Every write is field-logged so it travels ship ↔ shore.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { logFieldChanges } from '../sync/fieldLogger';
import { approvalWithdrawals, type ApprovalWithdrawal } from './withdrawalSchema';

const TABLE = 'approval_withdrawals';
const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

export type WithdrawalOutcome = 'withdrawn' | 'too-late' | 'refused';
export interface NewWithdrawal {
  vesselId: string; subjectType: string; subjectRef: string; extensionId: string | null;
  reason: string | null; requestedByUuid: string; requestedByName: string | null;
}

export async function insertWithdrawal(input: NewWithdrawal): Promise<ApprovalWithdrawal> {
  const [row] = await db().insert(approvalWithdrawals)
    .values({ ...input, createdByUuid: input.requestedByUuid, updatedByUuid: input.requestedByUuid })
    .returning();
  await logFieldChanges(TABLE, row.awuuid, row.vesselId, null, row, input.requestedByUuid);
  return row;
}

/** Record the outcome once (only while the row is still open). Returns null when already decided. */
export async function setWithdrawalOutcome(awuuid: string, outcome: WithdrawalOutcome, note: string | null, actor: string | null): Promise<ApprovalWithdrawal | null> {
  const [before] = await db().select().from(approvalWithdrawals).where(eq(approvalWithdrawals.awuuid, awuuid));
  if (!before || before.outcome) return null;
  const [after] = await db().update(approvalWithdrawals)
    .set({ outcome, outcomeNote: note, outcomeAt: new Date(), updatedAt: new Date(), updatedByUuid: actor })
    .where(and(eq(approvalWithdrawals.awuuid, awuuid), isNull(approvalWithdrawals.outcome)))
    .returning();
  if (!after) return null;
  await logFieldChanges(TABLE, awuuid, after.vesselId,
    { outcome: before.outcome, outcomeNote: before.outcomeNote, outcomeAt: before.outcomeAt, updatedAt: before.updatedAt, updatedByUuid: before.updatedByUuid },
    { outcome: after.outcome, outcomeNote: after.outcomeNote, outcomeAt: after.outcomeAt, updatedAt: after.updatedAt, updatedByUuid: after.updatedByUuid },
    actor);
  return after;
}

export async function listOpenWithdrawals(vesselId: string): Promise<ApprovalWithdrawal[]> {
  return db().select().from(approvalWithdrawals)
    .where(and(eq(approvalWithdrawals.vesselId, vesselId), isNull(approvalWithdrawals.outcome), eq(approvalWithdrawals.isDeleted, false)))
    .orderBy(asc(approvalWithdrawals.requestedAt));
}

export async function listWithdrawalsForSubject(subjectRef: string): Promise<ApprovalWithdrawal[]> {
  return db().select().from(approvalWithdrawals)
    .where(and(eq(approvalWithdrawals.subjectRef, subjectRef), eq(approvalWithdrawals.isDeleted, false)))
    .orderBy(desc(approvalWithdrawals.requestedAt));
}
