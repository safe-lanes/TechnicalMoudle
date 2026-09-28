/**
 * approval_withdrawals (migration 178) — kept inside the approvals module like
 * approval_notifications (notificationSchema.ts), so shared/schema.ts is untouched.
 */
import { pgTable, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const approvalWithdrawals = pgTable('approval_withdrawals', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  awuuid: text('awuuid').notNull().unique().default(sql`gen_random_uuid()::text`),
  vesselId: text('vessel_id').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectRef: text('subject_ref').notNull(),
  extensionId: text('extension_id'),
  reason: text('reason'),
  requestedByUuid: text('requested_by_uuid').notNull(),
  requestedByName: text('requested_by_name'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  outcome: text('outcome'),
  outcomeAt: timestamp('outcome_at', { withTimezone: true }),
  outcomeNote: text('outcome_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdByUuid: text('created_by_uuid'),
  updatedByUuid: text('updated_by_uuid'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  isSync: boolean('is_sync').notNull().default(false),
});
export type ApprovalWithdrawal = typeof approvalWithdrawals.$inferSelect;
