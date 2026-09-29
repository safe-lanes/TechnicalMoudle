/**
 * approval_history (migration 179) — insert-only event rows, field-logged so they travel
 * vessel ↔ office. Plus a read-only user lookup for older records (master data).
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { masterUsers } from '@shared/schema';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { logFieldChanges } from '../sync/fieldLogger';
import { approvalHistory, type ApprovalHistoryRow } from './approvalHistorySchema';

const TABLE = 'approval_history';
const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

export interface NewApprovalHistoryEvent {
  vesselId: string; subjectType: string; subjectRef: string; eventType: string;
  stepLabel: string | null; actorUuid: string | null; actorName: string | null; actorPosition: string | null;
  remarks: string | null; occurredAt?: Date;
}

export async function insertEvent(input: NewApprovalHistoryEvent): Promise<ApprovalHistoryRow> {
  const [row] = await db().insert(approvalHistory)
    .values({ ...input, occurredAt: input.occurredAt ?? new Date(), createdByUuid: input.actorUuid, updatedByUuid: input.actorUuid })
    .returning();
  await logFieldChanges(TABLE, row.ahuuid, row.vesselId, null, row, input.actorUuid ?? 'system');
  return row;
}

export async function listEvents(subjectRef: string, subjectTypes: string[]): Promise<ApprovalHistoryRow[]> {
  return db().select().from(approvalHistory)
    .where(and(eq(approvalHistory.subjectRef, subjectRef), inArray(approvalHistory.subjectType, subjectTypes), eq(approvalHistory.isDeleted, false)))
    .orderBy(asc(approvalHistory.occurredAt), asc(approvalHistory.id));
}

/** Name + role from master data (older records only; the table is not synced to vessels). */
export async function lookupUser(userUuid: string): Promise<{ name: string | null; role: string | null } | null> {
  const [u] = await db().select({ name: masterUsers.fullName, role: masterUsers.role })
    .from(masterUsers).where(eq(masterUsers.id, userUuid)).limit(1);
  return u ? { name: u.name?.trim() || null, role: u.role?.trim() || null } : null;
}
