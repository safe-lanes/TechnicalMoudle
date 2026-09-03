/**
 * approval_notifications — Technical's in-app inbox rows for approval-engine events
 * (migration 171). Module-owned like the engine's own tables: defined here, NOT in
 * shared/schema.ts (frozen surface), NO_SYNC (shore-only writes; ships see subject
 * status through the existing synced tables per D-4).
 */
import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const approvalNotifications = pgTable('approval_notifications', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  anuuid: text('anuuid').notNull().unique().default(sql`gen_random_uuid()::text`),
  userUuid: text('user_uuid').notNull(),
  requuid: text('requuid').notNull(),
  moduleId: text('module_id').notNull(),
  screenId: text('screen_id').notNull(),
  actionId: text('action_id').notNull().default(''),
  subjectRef: text('subject_ref').notNull(),
  vesselId: text('vessel_id'),
  kind: text('kind').notNull(),                 // 'pending-approval' | 'approved' | 'returned'
  title: text('title').notNull(),
  message: text('message').notNull().default(''),
  readAt: timestamp('read_at', { withTimezone: true }),
  emailStatus: text('email_status'),            // 'sent' | 'skipped' (unconfigured/no address) | 'disabled' (admin toggle off, mig 172) | 'error' | null
  emailError: text('email_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
