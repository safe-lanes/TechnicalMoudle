
import { pgTable, text, integer, boolean, timestamp, decimal, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Running Hours Audit Table
export const runningHoursAudit = pgTable("running_hours_audit", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  componentId: text("component_id").notNull(),
  previousRH: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
  newRH: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
  cumulativeRH: decimal("cumulative_rh", { precision: 10, scale: 2 }).notNull(),
  dateUpdatedLocal: text("date_updated_local").notNull(), // DD-MMM-YYYY HH:mm
  dateUpdatedTZ: text("date_updated_tz").notNull(), // e.g., Asia/Kolkata
  enteredAtUTC: timestamp("entered_at_utc").notNull(),
  userId: text("user_id").notNull(),
  source: text("source").notNull(), // 'single' | 'bulk'
  notes: text("notes"),
  meterReplaced: boolean("meter_replaced").notNull().default(false),
  oldMeterFinal: decimal("old_meter_final", { precision: 10, scale: 2 }),
  newMeterStart: decimal("new_meter_start", { precision: 10, scale: 2 }),
  version: integer("version").notNull().default(1),
}, (table) => ({
  componentIdIdx: index("idx_component_entered").on(table.componentId, table.enteredAtUTC),
  componentDateIdx: index("idx_component_date").on(table.componentId, table.dateUpdatedLocal),
}));

export const insertRunningHoursAuditSchema = createInsertSchema(runningHoursAudit).omit({
  id: true,
});

export type InsertRunningHoursAudit = z.infer<typeof insertRunningHoursAuditSchema>;
export type RunningHoursAudit = typeof runningHoursAudit.$inferSelect;

// Components Table (for storing current cumulative RH)
export const components = pgTable("components", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  componentCode: text("component_code"),
  parentId: text("parent_id"),
  category: text("category").notNull(),
  currentCumulativeRH: decimal("current_cumulative_rh", { precision: 10, scale: 2 }).notNull().default("0"),
  lastUpdated: text("last_updated"),
  vesselId: text("vessel_id").notNull().default("V001"),
  // Additional fields for Component Information (Section A)
  maker: text("maker"),
  model: text("model"),
  serialNo: text("serial_no"),
  deptCategory: text("dept_category"),
  componentCategory: text("component_category"),
  location: text("location"),
  commissionedDate: text("commissioned_date"),
  critical: boolean("critical").default(false),
  classItem: boolean("class_item").default(false),
});

export const insertComponentSchema = createInsertSchema(components).omit({});

export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type Component = typeof components.$inferSelect;

// Form Definitions Table
export const formDefinitions = pgTable("form_definitions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull().unique(), // ADD_COMPONENT, WO_PLANNED, WO_UNPLANNED
  subgroup: text("subgroup"),
});

export const insertFormDefinitionSchema = createInsertSchema(formDefinitions).omit({
  id: true,
});

export type InsertFormDefinition = z.infer<typeof insertFormDefinitionSchema>;
export type FormDefinition = typeof formDefinitions.$inferSelect;

// Form Versions Table
export const formVersions = pgTable("form_versions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  formId: integer("form_id").notNull(),
  versionNo: integer("version_no").notNull(),
  versionDate: timestamp("version_date").notNull(),
  status: text("status").notNull(), // DRAFT, PUBLISHED, ARCHIVED
  authorUserId: text("author_user_id").notNull(),
  changelog: text("changelog"),
  schemaJson: text("schema_json").notNull(), // JSON string
}, (table) => ({
  formIdIdx: index("idx_form_id").on(table.formId),
  statusIdx: index("idx_status").on(table.status),
}));

export const insertFormVersionSchema = createInsertSchema(formVersions).omit({
  id: true,
});

export type InsertFormVersion = z.infer<typeof insertFormVersionSchema>;
export type FormVersion = typeof formVersions.$inferSelect;

// Form Version Usage Table (Audit)
export const formVersionUsage = pgTable("form_version_usage", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  formVersionId: integer("form_version_id").notNull(),
  usedInModule: text("used_in_module").notNull(),
  usedAt: timestamp("used_at").notNull(),
});

export const insertFormVersionUsageSchema = createInsertSchema(formVersionUsage).omit({
  id: true,
});

export type InsertFormVersionUsage = z.infer<typeof insertFormVersionUsageSchema>;
export type FormVersionUsage = typeof formVersionUsage.$inferSelect;

// IHM (Inventory of Hazardous Materials) Tables
export const ihmItems = pgTable("ihm_items", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull(),
  spareId: text("spare_id"),
  presence: text("presence").notNull(), // Unknown | Present | Not Present
  materials: text("materials").array(), // Asbestos, PCB, PFOS, etc.
  evidenceType: text("evidence_type"), // MD | SDoC | Test | None
  evidenceFileName: text("evidence_file_name"),
  verifiedDate: text("verified_date"),
  supplier: text("supplier"),
  remarks: text("remarks"),
  vesselId: text("vessel_id").notNull().default("V001"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  componentIdIdx: index("idx_ihm_component_id").on(table.componentId),
  spareIdIdx: index("idx_ihm_spare_id").on(table.spareId),
}));

export const insertIhmItemSchema = createInsertSchema(ihmItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIhmItem = z.infer<typeof insertIhmItemSchema>;
export type IhmItem = typeof ihmItems.$inferSelect;

// IHM Maintenance Log Table
export const ihmMaintenanceLog = pgTable("ihm_maintenance_log", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  workOrderId: text("work_order_id").notNull(),
  action: text("action").notNull(), // Installed | Removed | Replaced
  targetComponent: text("target_component"),
  targetSpare: text("target_spare"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  location: text("location"),
  materials: text("materials").array(),
  remarks: text("remarks"),
  vesselId: text("vessel_id").notNull().default("V001"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userId: text("user_id").notNull(),
}, (table) => ({
  workOrderIdIdx: index("idx_ihm_log_wo_id").on(table.workOrderId),
  createdAtIdx: index("idx_ihm_log_created").on(table.createdAt),
}));

export const insertIhmMaintenanceLogSchema = createInsertSchema(ihmMaintenanceLog).omit({
  id: true,
  createdAt: true,
});

export type InsertIhmMaintenanceLog = z.infer<typeof insertIhmMaintenanceLogSchema>;
export type IhmMaintenanceLog = typeof ihmMaintenanceLog.$inferSelect;

// Spares Table
export const spares = pgTable("spares", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  partCode: text("part_code").notNull(),
  partName: text("part_name").notNull(),
  componentId: text("component_id").notNull(),
  componentCode: text("component_code"),
  componentName: text("component_name").notNull(),
  componentSpareCode: text("component_spare_code"), // Format: SP-<ComponentCode>-<NNN>
  critical: text("critical").notNull(), // 'Critical' | 'Non-Critical' | 'Yes' | 'No'
  rob: integer("rob").notNull().default(0), // Remaining on Board
  min: integer("min").notNull().default(0), // Minimum stock
  location: text("location"),
  vesselId: text("vessel_id").notNull().default("V001"),
  deleted: boolean("deleted").notNull().default(false),
}, (table) => ({
  componentIdIdx: index("idx_spare_component").on(table.componentId),
  vesselIdIdx: index("idx_spare_vessel").on(table.vesselId),
  componentSpareCodeIdx: index("idx_spare_code").on(table.vesselId, table.componentSpareCode),
}));

export const insertSpareSchema = createInsertSchema(spares).omit({
  id: true,
  deleted: true,
});

export type InsertSpare = z.infer<typeof insertSpareSchema>;
export type Spare = typeof spares.$inferSelect;

// Spares History Table
export const sparesHistory = pgTable("spares_history", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  timestampUTC: timestamp("timestamp_utc").notNull(),
  vesselId: text("vessel_id").notNull(),
  spareId: integer("spare_id").notNull(),
  partCode: text("part_code").notNull(),
  partName: text("part_name").notNull(),
  componentId: text("component_id").notNull(),
  componentCode: text("component_code"),
  componentName: text("component_name").notNull(),
  componentSpareCode: text("component_spare_code"), // Component Spare Code at time of event
  eventType: text("event_type").notNull(), // 'CONSUME' | 'RECEIVE' | 'ADJUST' | 'CREATE' | 'EDIT' | 'LINK_CREATED' | 'CODE_RENUMBERED'
  qtyChange: integer("qty_change").notNull(), // positive for receive, negative for consume
  robAfter: integer("rob_after").notNull(),
  userId: text("user_id").notNull(),
  remarks: text("remarks"),
  reference: text("reference"), // Work Order or PO reference
  dateLocal: text("date_local"), // Local date of transaction
  tz: text("tz"), // Timezone
  place: text("place"), // Port/Location for receive/consume
}, (table) => ({
  timestampIdx: index("idx_history_timestamp").on(table.timestampUTC),
  spareIdIdx: index("idx_history_spare").on(table.spareId),
  eventTypeIdx: index("idx_history_event").on(table.eventType),
}));

export const insertSpareHistorySchema = createInsertSchema(sparesHistory).omit({
  id: true,
});

export type InsertSpareHistory = z.infer<typeof insertSpareHistorySchema>;
export type SpareHistory = typeof sparesHistory.$inferSelect;

// Stores Ledger Table (for Stores module history)
export const storesLedger = pgTable("stores_ledger", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  section: text("section").notNull(), // 'stores' | 'lubes' | 'chemicals' | 'others'
  itemId: integer("item_id").notNull(),
  partCode: text("part_code").notNull(),
  itemName: text("item_name").notNull(),
  uom: text("uom"), // Base unit of measure
  eventType: text("event_type").notNull(), // 'RECEIVE' | 'CONSUME' | 'ADJUST' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ARCHIVE'
  qtyChangeBase: decimal("qty_change_base", { precision: 10, scale: 2 }).notNull(), // Change in base UOM
  qtyDisplay: decimal("qty_display", { precision: 10, scale: 2 }).notNull(), // Change in display UOM
  uomDisplay: text("uom_display"), // Display UOM (could be different from base)
  robAfterBase: decimal("rob_after_base", { precision: 10, scale: 2 }).notNull(), // ROB after in base UOM
  dateLocal: text("date_local").notNull(), // DD-MMM-YYYY HH:mm
  tz: text("tz").notNull(), // Timezone
  timestampUTC: timestamp("timestamp_utc").notNull(),
  place: text("place"), // For receive events
  ref: text("ref"), // PO/WO reference
  userId: text("user_id").notNull(),
  remarks: text("remarks"),
}, (table) => ({
  vesselSectionDateIdx: index("idx_vessel_section_date").on(table.vesselId, table.section, table.dateLocal),
  itemDateIdx: index("idx_item_date").on(table.itemId, table.dateLocal),
}));

export const insertStoresLedgerSchema = createInsertSchema(storesLedger).omit({
  id: true,
});

export type InsertStoresLedger = z.infer<typeof insertStoresLedgerSchema>;
export type StoresLedger = typeof storesLedger.$inferSelect;

// Change Request Tables for Modify PMS module
export const changeRequest = pgTable("change_request", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  category: text("category").notNull(), // 'components' | 'work_orders' | 'spares' | 'stores'
  title: text("title").notNull(), // max 120 chars enforced in application
  reason: text("reason").notNull(),
  targetType: text("target_type"), // 'component' | 'work_order' | 'spare' | 'store'
  targetId: text("target_id"),
  snapshotBeforeJson: json("snapshot_before_json"),
  proposedChangesJson: json("proposed_changes_json"), // Array of change objects
  movePreviewJson: json("move_preview_json"), // Component move preview (nullable)
  status: text("status").notNull().default("draft"), // 'draft' | 'submitted' | 'returned' | 'approved' | 'rejected'
  requestedByUserId: text("requested_by_user_id").notNull(),
  submittedAt: timestamp("submitted_at"),
  reviewedByUserId: text("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (table) => ({
  vesselCategoryIdx: index("idx_vessel_category").on(table.vesselId, table.category),
  statusIdx: index("idx_status").on(table.status),
}));

export const insertChangeRequestSchema = createInsertSchema(changeRequest).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChangeRequest = z.infer<typeof insertChangeRequestSchema>;
export type ChangeRequest = typeof changeRequest.$inferSelect;

// Change Request Attachments
export const changeRequestAttachment = pgTable("change_request_attachment", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  changeRequestId: integer("change_request_id").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  uploadedByUserId: text("uploaded_by_user_id").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => ({
  changeRequestIdx: index("idx_change_request").on(table.changeRequestId),
}));

export const insertChangeRequestAttachmentSchema = createInsertSchema(changeRequestAttachment).omit({
  id: true,
  uploadedAt: true,
});

export type InsertChangeRequestAttachment = z.infer<typeof insertChangeRequestAttachmentSchema>;
export type ChangeRequestAttachment = typeof changeRequestAttachment.$inferSelect;

// Change Request Comments
export const changeRequestComment = pgTable("change_request_comment", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  changeRequestId: integer("change_request_id").notNull(),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  changeRequestIdx: index("idx_change_request_comment").on(table.changeRequestId),
}));

export const insertChangeRequestCommentSchema = createInsertSchema(changeRequestComment).omit({
  id: true,
  createdAt: true,
});

export type InsertChangeRequestComment = z.infer<typeof insertChangeRequestCommentSchema>;
export type ChangeRequestComment = typeof changeRequestComment.$inferSelect;

// Alert Policy Table
export const alertPolicies = pgTable("alert_policies", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  alertType: text("alert_type").notNull(), // 'maintenance_due' | 'running_hours' | 'critical_inventory' | 'certificate_expiration' | 'system_backup'
  enabled: boolean("enabled").notNull().default(true),
  priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high'
  emailEnabled: boolean("email_enabled").notNull().default(false),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  thresholds: text("thresholds").notNull().default("{}"), // JSON string for type-specific thresholds
  scopeFilters: text("scope_filters").notNull().default("{}"), // JSON string for filters
  recipients: text("recipients").notNull().default("{}"), // JSON string for recipient configuration
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const insertAlertPolicySchema = createInsertSchema(alertPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAlertPolicy = z.infer<typeof insertAlertPolicySchema>;
export type AlertPolicy = typeof alertPolicies.$inferSelect;

// Alert Events Table
export const alertEvents = pgTable("alert_events", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  policyId: integer("policy_id").notNull(),
  alertType: text("alert_type").notNull(),
  priority: text("priority").notNull(),
  objectType: text("object_type"), // 'work_order' | 'component' | 'spare' | 'certificate' | 'system'
  objectId: text("object_id"),
  vesselId: text("vessel_id"),
  dedupeKey: text("dedupe_key").notNull(),
  state: text("state"), // 'due' | 'overdue' | 'low' | 'critical' | 'expired' | 'failed' etc
  payload: text("payload").notNull(), // JSON string with all event details
  ackBy: text("ack_by"),
  ackAt: timestamp("ack_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  dedupeKeyIdx: index("idx_dedupe_key").on(table.dedupeKey, table.createdAt),
  policyIdx: index("idx_policy_events").on(table.policyId, table.createdAt),
}));

export const insertAlertEventSchema = createInsertSchema(alertEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAlertEvent = z.infer<typeof insertAlertEventSchema>;
export type AlertEvent = typeof alertEvents.$inferSelect;

// Alert Deliveries Table
export const alertDeliveries = pgTable("alert_deliveries", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  eventId: integer("event_id").notNull(),
  channel: text("channel").notNull(), // 'email' | 'in_app' | 'sms' | 'slack'
  recipient: text("recipient").notNull(), // email address, user ID, phone number, etc
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed' | 'acknowledged'
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  eventIdx: index("idx_event_deliveries").on(table.eventId, table.channel),
  recipientIdx: index("idx_recipient_deliveries").on(table.recipient, table.status),
}));

export const insertAlertDeliverySchema = createInsertSchema(alertDeliveries).omit({
  id: true,
  createdAt: true,
});

export type InsertAlertDelivery = z.infer<typeof insertAlertDeliverySchema>;
export type AlertDelivery = typeof alertDeliveries.$inferSelect;

// Alert Configuration Table (for quiet hours and escalation)
export const alertConfig = pgTable("alert_config", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
  quietHoursStart: text("quiet_hours_start"), // HH:mm format
  quietHoursEnd: text("quiet_hours_end"), // HH:mm format
  escalationEnabled: boolean("escalation_enabled").notNull().default(false),
  escalationHours: integer("escalation_hours").notNull().default(4),
  escalationRecipients: text("escalation_recipients").notNull().default("[]"), // JSON array of recipients
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").notNull(),
});

export const insertAlertConfigSchema = createInsertSchema(alertConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAlertConfig = z.infer<typeof insertAlertConfigSchema>;
export type AlertConfig = typeof alertConfig.$inferSelect;

// Work Orders Table
export const workOrders = pgTable("work_orders", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id").notNull().default("V001"),
  component: text("component").notNull(),
  componentCode: text("component_code"),
  workOrderNo: text("work_order_no").notNull(),
  templateCode: text("template_code"),
  executionId: text("execution_id"),
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to").notNull(),
  dueDate: text("due_date").notNull(), // ISO date string
  status: text("status").notNull(), // 'Completed' | 'Due' | 'Due (Grace P)' | 'Overdue' | 'Postponed' | 'Pending Approval'
  dateCompleted: text("date_completed"),
  submittedDate: text("submitted_date"),
  formData: json("form_data"), // Form submission data
  taskType: text("task_type"), // 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
  maintenanceBasis: text("maintenance_basis"), // 'Calendar' | 'Running Hours'
  frequencyValue: text("frequency_value"),
  frequencyUnit: text("frequency_unit"), // 'Months' | 'Years' | 'Weeks' | 'Days'
  approverRemarks: text("approver_remarks"),
  isExecution: boolean("is_execution").notNull().default(false),
  templateId: text("template_id"),
  approver: text("approver"),
  approvalDate: text("approval_date"),
  rejectionDate: text("rejection_date"),
  nextDueDate: text("next_due_date"),
  nextDueReading: text("next_due_reading"),
  currentReading: text("current_reading"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vesselIdIdx: index("idx_wo_vessel").on(table.vesselId),
  statusIdx: index("idx_wo_status").on(table.status),
  dueDateIdx: index("idx_wo_due_date").on(table.dueDate),
  componentCodeIdx: index("idx_wo_component").on(table.componentCode),
  templateCodeIdx: index("idx_wo_template").on(table.templateCode),
}));

export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;

// Defects Table for maritime defect tracking
export const defects = pgTable("defects", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  vesselName: text("vessel_name").notNull(),
  issueDate: text("issue_date").notNull(), // DD-MM-YYYY format
  category: text("category").notNull(), // 'Defect' | 'COC' | 'Observation' | 'NCR'
  defectType: text("defect_type"), // 'Routine' | 'Corrective' | 'Emergency'
  description: text("description").notNull(),
  actionTakenRequested: text("action_taken_requested"),
  targetDate: text("target_date"), // DD-MM-YYYY format
  dateCompleted: text("date_completed"), // DD-MM-YYYY format
  status: text("status").notNull().default("Open"), // 'Open' | 'In Progress' | 'On Hold' | 'Closed'
  priority: text("priority").default("Medium"), // 'Low' | 'Medium' | 'High'
  critical: boolean("critical").notNull().default(false),
  severity: integer("severity").default(1), // 1-Minor, 2-Moderate, 3-Major
  source: text("source"), // 'SIRE' | 'PSC' | 'Internal' | 'Class'
  equipmentCategory: text("equipment_category"), // 'Deck' | 'Navigation' | 'Machinery' | etc.
  equipmentType: text("equipment_type"),
  equipmentMake: text("equipment_make"),
  equipmentModel: text("equipment_model"),
  equipmentSerialNo: text("equipment_serial_no"), // Serial No field from screenshot
  equipmentLocation: text("equipment_location"), // Location field from screenshot
  equipmentSystem: text("equipment_system"), // System field from screenshot
  componentId: text("component_id"), // Link to PMS component
  purchaseOrderRef: text("purchase_order_ref"),
  responsibleDept: text("responsible_dept"), // Responsible Dept from screenshot
  verifiedDate: text("verified_date"), // Verified Date from screenshot
  defectCategory: text("defect_category"), // Additional defect category field
  viqVersion: text("viq_version"), // VIQ VER
  viqRef: text("viq_ref"), // VIQ REF
  sfiCodeRef: text("sfi_code_ref"), // SFI Code Reference
  immediateCause: text("immediate_cause"), // Single immediate cause
  immediateCauseExplanation: text("immediate_cause_explanation"), // Further explanation
  rootCause: text("root_cause"), // Single root cause
  rootCauseExplanation: text("root_cause_explanation"), // Further explanation
  holdReason: text("hold_reason"), // For On Hold status
  nextReviewDate: text("next_review_date"), // For On Hold items
  reportedBy: text("reported_by").notNull(),
  assignedTo: text("assigned_to"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (table) => ({
  vesselIdIdx: index("idx_defect_vessel").on(table.vesselId),
  statusIdx: index("idx_defect_status").on(table.status),
  issueDateIdx: index("idx_defect_issue_date").on(table.issueDate),
  categoryIdx: index("idx_defect_category").on(table.category),
  criticalIdx: index("idx_defect_critical").on(table.critical),
  componentIdIdx: index("idx_defect_component").on(table.componentId),
}));

export const insertDefectSchema = createInsertSchema(defects).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defects.$inferSelect;

// Defect Actions Table for corrective/preventive actions
export const defectActions = pgTable("defect_actions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  defectId: text("defect_id").notNull(),
  actionType: text("action_type").notNull(), // 'Corrective' | 'Preventive' | 'Containment' | 'Long-term fix'
  actionDescription: text("action_description").notNull(),
  proposedBy: text("proposed_by").notNull(),
  responsibility: text("responsibility").notNull(), // user/role responsible
  dueDate: text("due_date").notNull(), // DD-MM-YYYY format
  dateCompleted: text("date_completed"), // DD-MM-YYYY format
  status: text("status").notNull().default("Open"), // 'Open' | 'In Progress' | 'Closed'
  justification: text("justification"), // Required if due date is pushed after overdue
  attachmentUrls: text("attachment_urls").array(), // Evidence attachments
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (table) => ({
  defectIdIdx: index("idx_action_defect").on(table.defectId),
  statusIdx: index("idx_action_status").on(table.status),
  dueDateIdx: index("idx_action_due_date").on(table.dueDate),
  responsibilityIdx: index("idx_action_responsibility").on(table.responsibility),
}));

export const insertDefectActionSchema = createInsertSchema(defectActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDefectAction = z.infer<typeof insertDefectActionSchema>;
export type DefectAction = typeof defectActions.$inferSelect;

// Defect Attachments Table for photos and documents
export const defectAttachments = pgTable("defect_attachments", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  defectId: text("defect_id").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  attachmentType: text("attachment_type").notNull(), // 'photo' | 'document' | 'evidence'
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => ({
  defectIdIdx: index("idx_attachment_defect").on(table.defectId),
  typeIdx: index("idx_attachment_type").on(table.attachmentType),
}));

export const insertDefectAttachmentSchema = createInsertSchema(defectAttachments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertDefectAttachment = z.infer<typeof insertDefectAttachmentSchema>;
export type DefectAttachment = typeof defectAttachments.$inferSelect;
