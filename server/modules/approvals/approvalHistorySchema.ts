/**
 * approval_history (migration 179) — kept inside the approvals module like approval_withdrawals,
 * so shared/schema.ts is untouched.
 */
import { pgTable, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const approvalHistory = pgTable('approval_history', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  ahuuid: text('ahuuid').notNull().unique().default(sql`gen_random_uuid()::text`),
  vesselId: text('vessel_id').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectRef: text('subject_ref').notNull(),
  eventType: text('event_type').notNull(),
  stepLabel: text('step_label'),
  actorUuid: text('actor_uuid'),
  actorName: text('actor_name'),
  actorPosition: text('actor_position'),
  remarks: text('remarks'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdByUuid: text('created_by_uuid'),
  updatedByUuid: text('updated_by_uuid'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  isSync: boolean('is_sync').notNull().default(false),
});
export type ApprovalHistoryRow = typeof approvalHistory.$inferSelect;
