/**
 * Engine-owned tables (prefix apprv_) — created by migrations/170_approval_engine_tables.sql,
 * NO_SYNC, one set per tenant DB. Deliberately NOT in shared/schema.ts: the engine folder is
 * self-contained (import boundary) and the engine owns only its own tables.
 */
import { pgTable, text, integer, boolean, timestamp, json } from 'drizzle-orm/pg-core';

export const apprvWorkflows = pgTable('apprv_workflows', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  wfuuid: text('wfuuid').notNull().unique(),
  moduleId: text('module_id').notNull(),
  screenId: text('screen_id').notNull(),
  actionId: text('action_id').notNull().default(''),
  classification: text('classification').notNull(),
  mode: text('mode').notNull().default('simple'),            // 'simple' | 'advanced'
  version: integer('version').notNull(),
  status: text('status').notNull(),                          // 'draft' | 'active' | 'superseded'
  label: text('label').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export const apprvWorkflowNodes = pgTable('apprv_workflow_nodes', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  workflowWfuuid: text('workflow_wfuuid').notNull(),
  nodeKey: text('node_key').notNull(),
  type: text('type').notNull(),                              // approval-step | condition | parallel-fork | parallel-join | end
  ordinal: integer('ordinal').notNull().default(0),
  quorumRule: text('quorum_rule'),                           // all | any | nOfM (approval-step only)
  quorumN: integer('quorum_n'),
  label: text('label').notNull().default(''),
});

export const apprvNodeEdges = pgTable('apprv_node_edges', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  workflowWfuuid: text('workflow_wfuuid').notNull(),
  fromKey: text('from_key').notNull(),
  toKey: text('to_key').notNull(),
});

export const apprvNodeSlots = pgTable('apprv_node_slots', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  workflowWfuuid: text('workflow_wfuuid').notNull(),
  nodeKey: text('node_key').notNull(),
  slotOrdinal: integer('slot_ordinal').notNull(),
  roleId: text('role_id').notNull(),                         // stable id, never a display name
  roleLabel: text('role_label').notNull(),                   // display snapshot
});

export const apprvRequests = pgTable('apprv_requests', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  requuid: text('requuid').notNull().unique(),
  moduleId: text('module_id').notNull(),
  screenId: text('screen_id').notNull(),
  actionId: text('action_id').notNull().default(''),
  classification: text('classification').notNull(),
  subjectRef: text('subject_ref').notNull(),
  vesselId: text('vessel_id'),
  snapshotJson: json('snapshot_json').notNull(),             // full workflow graph at submit time
  status: text('status').notNull().default('pending'),       // pending | approved | returned
  currentNodeKey: text('current_node_key'),
  submittedBy: text('submitted_by').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  workflowWfuuid: text('workflow_wfuuid').notNull(),
  workflowVersion: integer('workflow_version').notNull(),
});

export const apprvRequestSlots = pgTable('apprv_request_slots', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  requuid: text('requuid').notNull(),
  nodeKey: text('node_key').notNull(),
  slotOrdinal: integer('slot_ordinal').notNull(),
  roleId: text('role_id').notNull(),
  roleLabel: text('role_label').notNull(),
  status: text('status').notNull().default('pending'),       // pending | active | approved | rejected | superseded
  resolvedApproverIdsJson: json('resolved_approver_ids_json'),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  remarks: text('remarks'),
});

export const apprvScopeSettings = pgTable('apprv_scope_settings', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  moduleId: text('module_id').notNull(),
  screenId: text('screen_id').notNull(),
  actionId: text('action_id').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
