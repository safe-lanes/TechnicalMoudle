
import { pgTable, text, integer, boolean, timestamp, decimal, index, json, numeric, primaryKey, unique, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum - Ship (vessel-based user), Office (shore-based user), PMS Admin (full system access)
export const userRoleEnum = pgEnum("user_role", ["Ship", "Office", "PMS Admin"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: userRoleEnum("role").notNull().default("Ship"),
  vesselId: text("vessel_id"), // Required for Ship role, null for Office/PMS Admin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserRole = "Ship" | "Office" | "PMS Admin";

export type PublicUser = Omit<User, "password">;

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

// Running Hours Cascade Schema - for updating parent and cascading to children
export const cascadeRunningHoursSchema = z.object({
  parentComponentId: z.string(),
  mode: z.enum(['setTotal', 'addDelta']),
  value: z.number().nonnegative(), // Allow zero for setTotal (meter replacement), but addDelta will be validated separately
  dateUpdated: z.string(), // DD-MMM-YYYY HH:mm format
  dateUpdatedTZ: z.string().default('UTC'),
  comments: z.string().optional(),
  meterReplaced: z.boolean().optional().default(false),
  oldMeterFinal: z.string().optional(),
  newMeterStart: z.string().optional(),
  userId: z.string().default('admin')
}).refine(data => data.mode === 'setTotal' || data.value > 0, {
  message: "addDelta mode requires value > 0",
  path: ["value"]
});

export type CascadeRunningHoursRequest = z.infer<typeof cascadeRunningHoursSchema>;

// Running Hour Parent Response - parent component with child summary
export type RunningHourParent = Component & {
  childCount: number;
  latestUpdate?: string;
};

// Components Table (for storing current cumulative RH)
export const components = pgTable("components", {
  id: text("id").primaryKey(),
  name: text("name"), // Nullable - only required when dataScope='vessel'
  componentCode: text("component_code"),
  parentId: text("parent_id"),
  category: text("category"), // Nullable - only required when dataScope='vessel'
  currentCumulativeRH: decimal("current_cumulative_rh", { precision: 10, scale: 2 }).notNull().default("0"),
  lastUpdated: text("last_updated"),
  vesselId: text("vessel_id"), // Nullable - only required when dataScope='vessel'
  vesselCode: text("vessel_code"), // Vessel identification code
  dataScope: text("data_scope").notNull().default("vessel"), // 'fleet' | 'vessel' - discriminator for fleet vs vessel data
  // Fleet Equipment fields (from Fleet_Component Sheet)
  fleetEquipmentCode: text("fleet_equipment_code"), // Unique identifier for fleet equipment (XXX.XXX.XX format)
  fleetEquipmentName: text("fleet_equipment_name"), // General name from SFI booklet
  parentFleetEquipmentCode: text("parent_fleet_equipment_code"), // For fleet hierarchy
  // Maker and Model fields
  maker: text("maker"), // Manufacturer name from manual
  makerCode: text("maker_code"), // Unique code for maker
  model: text("model"), // Equipment model from manual
  modelNumber: text("model_number"), // Model number (stored separately from model)
  modelCode: text("model_code"), // Combination of Maker Code + Model
  // Component specific fields
  serialNo: text("serial_no"), // Serial number from manual
  drawingNo: text("drawing_no"), // Drawing/diagram number
  // Department and categorization
  department: text("department"),
  deptCategory: text("dept_category"),
  componentCategory: text("component_category"),
  location: text("location"),
  eqptSystemDept: text("eqpt_system_dept"), // Equipment/System Department
  // Dates
  commissionedDate: text("commissioned_date"), // DD-MM-YYYY format
  installationDate: text("installation_date"), // DD-MM-YYYY format
  // Status and classification
  critical: boolean("critical").default(false), // Critical equipment (Yes/No)
  classItem: boolean("class_item").default(false),
  conditionBased: boolean("condition_based").default(false), // Condition Based maintenance (Yes/No)
  isActive: boolean("is_active").default(true), // IS Active (Yes/No)
  isParent: boolean("is_parent").default(false), // IS Parent (Yes/No) - indicates if component has children
  // Technical specifications
  rating: text("rating"), // Capacity or rating from manual
  noOfUnits: text("no_of_units"),
  parentComponent: text("parent_component"),
  dimensionsSize: text("dimensions_size"),
  notes: text("notes"), // Specifications or additional information
  // Running Hours (already has currentCumulativeRH)
  runningHours: decimal("running_hours", { precision: 10, scale: 2 }), // For storing template running hours value
  // Fleet-specific fields (when dataScope='fleet')
  applicableVesselIds: text("applicable_vessel_ids").array(), // Array of vessel codes that can use this fleet equipment
  scopeNotes: text("scope_notes"), // Notes about scope applicability
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  dataScopeIdx: index("idx_comp_data_scope").on(table.dataScope),
  fleetTreeIdx: index("idx_comp_fleet_tree").on(table.dataScope, table.parentFleetEquipmentCode),
  vesselTreeIdx: index("idx_comp_vessel_tree").on(table.dataScope, table.vesselId, table.parentId),
  fleetEquipmentCodeUniqueIdx: unique("unique_fleet_equipment_code").on(table.fleetEquipmentCode, table.dataScope),
}));

export const insertComponentSchema = createInsertSchema(components).omit({
  id: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
});

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
  statusIdx: index("idx_form_version_status").on(table.status),
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
  componentId: text("component_id"), // Nullable for fleet spares
  componentCode: text("component_code"),
  componentName: text("component_name").notNull(),
  componentSpareCode: text("component_spare_code"), // Format: SP-<ComponentCode>-<NNN>
  critical: text("critical").notNull(), // 'Critical' | 'Non-Critical' | 'Yes' | 'No'
  rob: integer("rob").notNull().default(0), // Remaining on Board
  min: integer("min").notNull().default(0), // Minimum stock
  max: integer("max"), // Maximum stock level
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // Cost per unit
  stockingNumber: text("stocking_number"), // Internal stocking reference
  leadTime: text("lead_time"), // Procurement lead time
  supplier: text("supplier"), // Supplier name
  lastOrderDate: text("last_order_date"), // Last procurement date (DD-MMM-YYYY format)
  location: text("location"),
  vesselId: text("vessel_id"), // Nullable - only required when dataScope='vessel'
  deleted: boolean("deleted").notNull().default(false),
  // Fleet-specific fields (when dataScope='fleet')
  dataScope: text("data_scope").notNull().default("vessel"), // 'fleet' | 'vessel'
  fleetEquipmentCode: text("fleet_equipment_code"), // Link to fleet component
  fleetPartCode: text("fleet_part_code"), // Auto-generated PT-XXXXXXX for fleet spares
  partNumber: text("part_number"), // Manufacturer's part number
  uom: text("uom"), // Unit of measurement
  drawingNumber: text("drawing_number"), // Drawing number from manual
  drawingNo: text("drawing_no"), // Drawing number reference from manual (user-specified)
  location2: text("location_2"), // Second storage location for spares stored in multiple locations
  remarks: text("remarks"), // User notes for spares
  unit: text("unit"), // Unit of measurement (user-specified)
  positionNumber: text("position_number"), // Position/reference number
  note: text("note"), // Additional information
  specification: text("specification"), // Technical specifications (size, dimensions, material)
  maker: text("maker"), // Manufacturer name
  makerCode: text("maker_code"), // Maker code reference
  model: text("model"), // Equipment model
  manualName: text("manual_name"), // Name of manual
  pageNumber: text("page_number"), // Page number in manual
  criticality: text("criticality"), // 'Yes' | 'No' for fleet spares
  isActive: boolean("is_active").default(true), // Active status for fleet spares
  ihm: text("ihm"), // IHM related text/number
  evidenceType: text("evidence_type"), // Supporting document reference
  partCategory: text("part_category"), // Category from master data
  applicableVesselIds: text("applicable_vessel_ids").array(), // Vessels that can use this fleet spare
  scopeNotes: text("scope_notes"), // Notes about scope applicability
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  componentIdIdx: index("idx_spare_component").on(table.componentId),
  vesselIdIdx: index("idx_spare_vessel").on(table.vesselId),
  componentSpareCodeIdx: index("idx_spare_code").on(table.vesselId, table.componentSpareCode),
  dataScopeIdx: index("idx_spare_data_scope").on(table.dataScope),
  fleetEquipmentCodeIdx: index("idx_spare_fleet_equipment").on(table.dataScope, table.fleetEquipmentCode),
  fleetPartCodeUniqueIdx: unique("unique_fleet_part_code").on(table.fleetPartCode, table.dataScope),
}));

export const insertSpareSchema = createInsertSchema(spares).omit({
  id: true,
  deleted: true,
  createdAt: true,
  updatedAt: true,
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
  statusIdx: index("idx_change_request_status").on(table.status),
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

// Jobs Table - Templates/Blueprints for maintenance jobs linked to components
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id"),
  componentId: text("component_id").notNull(), // Component this job belongs to
  componentCode: text("component_code").notNull(),
  componentName: text("component_name").notNull(),
  jobNo: text("job_no").notNull().unique(), // Auto-generated JOB-XXXXXXX
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to"),
  maintenanceType: text("maintenance_type"), // 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
  maintenanceBasis: text("maintenance_basis"), // 'Calendar' | 'Running Hours'
  frequencyType: text("frequency_type"), // Alias for maintenanceBasis for compliance
  frequencyValue: text("frequency_value"),
  frequencyUnit: text("frequency_unit"), // 'Months' | 'Years' | 'Weeks' | 'Days' | 'Hours'
  intervalRunningHour: integer("interval_running_hour"),
  leadTimeValue: integer("lead_time_value"), // Lead time before job becomes due
  leadTimeUnit: text("lead_time_unit"), // 'Days' | 'Weeks' | 'Months'
  initialNextDue: text("initial_next_due"), // Initial due date for calendar-based jobs
  lastDoneDate: text("last_done_date"), // Last completion date (DD-MMM-YYYY format)
  nextDueDate: text("next_due_date"), // Calculated: lastDoneDate + frequencyValue + frequencyUnit (for Calendar-based jobs)
  lastDoneRH: text("last_done_rh"), // Last completion running hours (for RH-based jobs)
  nextDueRH: text("next_due_rh"), // Calculated: lastDoneRH + frequencyValue (for RH-based jobs)
  jobPriority: text("job_priority"), // 'Low' | 'Medium' | 'High' | 'Critical'
  classRelated: text("class_related"), // 'Yes' | 'No'
  briefWorkDescription: text("brief_work_description"),
  department: text("department"),
  
  // Template data (Part A)
  requiredSpareParts: json("required_spare_parts").notNull().default([]),
  requiredTools: json("required_tools").notNull().default([]),
  safetyRequirements: json("safety_requirements").notNull().default({ppeRequirements: [], permitRequirements: [], otherRequirements: []}),
  
  // Fleet-specific fields
  dataScope: text("data_scope").notNull().default("vessel"), // 'fleet' | 'vessel'
  fleetEquipmentCode: text("fleet_equipment_code"),
  fleetJobCode: text("fleet_job_code"),
  sfiCode: text("sfi_code"),
  criticality: text("criticality"),
  isActive: boolean("is_active").default(true),
  
  createdBy: text("created_by"), // User who created the job
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: text("updated_by"), // User who last updated the job
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vesselIdIdx: index("idx_job_vessel").on(table.vesselId),
  componentIdIdx: index("idx_job_component").on(table.componentId),
  componentCodeIdx: index("idx_job_component_code").on(table.componentCode),
  dataScopeIdx: index("idx_job_data_scope").on(table.dataScope),
  nextDueDateIdx: index("idx_job_next_due").on(table.nextDueDate),
  jobNoUniqueIdx: unique("unique_job_no").on(table.jobNo),
}));

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Work Orders Table
export const workOrders = pgTable("work_orders", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id"), // Nullable - only required when dataScope='vessel'
  component: text("component").notNull(),
  componentCode: text("component_code"),
  jobId: text("job_id"), // Reference to jobs.id for reliable lead time hydration
  workOrderNo: text("work_order_no").notNull(),
  workOrderType: text("work_order_type").notNull().default("Planned"), // 'Planned' | 'Unplanned'
  templateCode: text("template_code"),
  executionId: text("execution_id"),
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to").notNull(),
  dueDate: text("due_date"), // ISO date string, nullable for fleet jobs
  status: text("status").notNull().default("Active"), // 'Completed' | 'Due' | 'Due (Grace P)' | 'Overdue' | 'Postponed' | 'Pending Approval' | 'Active'
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
  classRelated: text("class_related"), // 'Yes' | 'No'
  jobPriority: text("job_priority"), // 'Low' | 'Medium' | 'High' | 'Critical'
  briefWorkDescription: text("brief_work_description"),
  // Fleet-specific fields (when dataScope='fleet')
  dataScope: text("data_scope").notNull().default("vessel"), // 'fleet' | 'vessel'
  fleetEquipmentCode: text("fleet_equipment_code"), // Link to fleet component
  fleetJobCode: text("fleet_job_code"), // Auto-generated WO-XXXXXXX for fleet jobs
  jobGroup: text("job_group"), // Grouping/categorization for fleet jobs
  jobCategory: text("job_category"), // Category from master data
  sfiCode: text("sfi_code"), // SFI classification code
  maintenanceIntervalValue: integer("maintenance_interval_value"), // Numeric interval value
  maintenanceIntervalUnit: text("maintenance_interval_unit"), // Unit from master data
  intervalRunningHour: integer("interval_running_hour"), // Running hour interval
  department: text("department"), // Department from master data
  criticality: text("criticality"), // 'Yes' | 'No' for fleet jobs
  isActive: boolean("is_active").default(true), // Active status for fleet jobs
  applicableVesselIds: text("applicable_vessel_ids").array(), // Vessels that can use this fleet job
  scopeNotes: text("scope_notes"), // Notes about scope applicability
  // Work Order Form Arrays (Part A - Template)
  requiredSpareParts: json("required_spare_parts").notNull().default([]), // [{partNo, description, quantityRequired, remarks}]
  requiredTools: json("required_tools").notNull().default([]), // [{toolName, quantity, remarks}]
  safetyRequirements: json("safety_requirements").notNull().default({ppeRequirements: [], permitRequirements: [], otherRequirements: []}), // {ppeRequirements: [], permitRequirements: [], otherRequirements: []}
  // Work Order Form Arrays (Part B - Execution)
  uploadedDocuments: json("uploaded_documents").notNull().default([]), // [{type: 'riskAssessment'|'safetyChecklist'|'operationalForm', fileName, fileKey, uploadedAt, uploadedBy}]
  consumedSpareParts: json("consumed_spare_parts").notNull().default([]), // [{partNo, description, quantityConsumed, comments}]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vesselIdIdx: index("idx_wo_vessel").on(table.vesselId),
  statusIdx: index("idx_wo_status").on(table.status),
  dueDateIdx: index("idx_wo_due_date").on(table.dueDate),
  componentCodeIdx: index("idx_wo_component").on(table.componentCode),
  templateCodeIdx: index("idx_wo_template").on(table.templateCode),
  dataScopeIdx: index("idx_wo_data_scope").on(table.dataScope),
  fleetEquipmentCodeIdx: index("idx_wo_fleet_equipment").on(table.dataScope, table.fleetEquipmentCode),
  fleetJobCodeUniqueIdx: unique("unique_fleet_job_code").on(table.fleetJobCode, table.dataScope),
}));

export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;

// Work Order with hydrated lead time fields from jobs table
// Used by backend API endpoints that enrich work orders with job metadata
export type WorkOrderWithLeadTime = WorkOrder & {
  leadTimeValue?: number | null;
  leadTimeUnit?: string | null;
};

// Work Order Executions Table - for tracking historical maintenance records
export const workOrderExecutions = pgTable("work_order_executions", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(), // Reference to work_orders (template)
  componentId: text("component_id").notNull(), // Component this execution belongs to
  vesselId: text("vessel_id").notNull(), // Vessel identifier
  executionId: text("execution_id").notNull().unique(), // Unique execution code (WOE-XXXXXXX)
  
  // Execution tracking
  dateCompleted: text("date_completed"), // ISO date when work was completed (format: DD-MMM-YYYY HH:mm for consistency)
  runningHoursAtCompletion: decimal("running_hours_at_completion", { precision: 10, scale: 2 }), // Running hours when work was completed
  performedBy: text("performed_by"), // User who performed the work
  approvedBy: text("approved_by"), // User who approved the work
  status: text("status").notNull().default("In Progress"), // 'In Progress' | 'Completed' | 'Approved'
  
  // Execution data (Section B fields)
  uploadedDocuments: json("uploaded_documents").notNull().default([]), // [{type, fileName, fileKey, uploadedAt, uploadedBy}]
  consumedSpareParts: json("consumed_spare_parts").notNull().default([]), // [{partNo, description, quantityConsumed, comments}]
  
  // Additional execution details
  workDescription: text("work_description"), // What was actually done
  remarks: text("remarks"), // Any additional notes
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  templateIdIdx: index("idx_exec_template").on(table.templateId),
  componentIdIdx: index("idx_exec_component").on(table.componentId),
  vesselIdIdx: index("idx_exec_vessel").on(table.vesselId),
  statusIdx: index("idx_exec_status").on(table.status),
  dateCompletedIdx: index("idx_exec_date_completed").on(table.dateCompleted),
}));

export const insertWorkOrderExecutionSchema = createInsertSchema(workOrderExecutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrderExecution = z.infer<typeof insertWorkOrderExecutionSchema>;
export type WorkOrderExecution = typeof workOrderExecutions.$inferSelect;

// Defects Table for maritime defect tracking
export const defects = pgTable("defects", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  vesselName: text("vessel_name").notNull(),
  issueDate: text("issue_date").notNull(), // ISO format YYYY-MM-DD
  category: text("category").notNull(), // 'Defect' | 'COC' | 'Observation' | 'NCR'
  defectType: text("defect_type"), // 'Routine' | 'Corrective' | 'Emergency'
  description: text("description").notNull(),
  descriptionHtml: text("description_html"), // Rich text HTML version
  descriptionText: text("description_text"), // Plain text version for search
  actionTakenRequested: text("action_taken_requested"),
  // Renamed from targetDate to targetCloseDate
  targetCloseDate: text("target_close_date"), // ISO format YYYY-MM-DD
  dateCompleted: text("date_completed"), // ISO format YYYY-MM-DD
  status: text("status").notNull().default("Open"), // 'Open' | 'Pending' | 'In-Progress' | 'Awaiting Parts' | 'Deferred' | 'Closed' | 'Cancelled'
  priority: text("priority").default("Medium"), // 'Low' | 'Medium' | 'High'
  critical: boolean("critical").notNull().default(false),
  is_coc: boolean("is_coc").notNull().default(false), // Condition of Class flag
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
  verifiedDate: text("verified_date"), // ISO format YYYY-MM-DD
  defectCategory: text("defect_category"), // Additional defect category field
  viqVersion: text("viq_version"), // VIQ VER (VIQ 7 or SIRE 2.0)
  viqRef: text("viq_ref"), // VIQ REF (e.g., 1.1, 2.3, 5.12)
  viqChapter: text("viq_chapter"), // VIQ Chapter (e.g., General Information, Safety Management)
  viqSection: text("viq_section"), // VIQ Section (detailed section within chapter)
  sfiCodeRef: text("sfi_code_ref"), // SFI Code Reference
  immediateCause: json("immediate_cause"), // Structured immediate cause with unsafe acts and conditions
  immediateCauseExplanation: text("immediate_cause_explanation"), // Further explanation
  rootCause: json("root_cause"), // Structured root cause with individual and system factors
  rootCauseExplanation: text("root_cause_explanation"), // Further explanation
  holdReason: text("hold_reason"), // For On Hold status
  nextReviewDate: text("next_review_date"), // ISO format YYYY-MM-DD
  
  // NEW FIELDS FOR DEFECT MODULE ENHANCEMENTS
  
  // Seed tracking for dev/test data
  seedId: text("seed_id"), // For idempotent seeding of test data
  
  // Recurring Defects tracking
  equipment_key: text("equipment_key"), // Normalized key for tracking same equipment
  
  // 1. Raised By (Who Raised the Defect)
  raisedById: text("raised_by_id"),
  raisedByName: text("raised_by_name"),
  raisedByRank: text("raised_by_rank"),
  
  // 2. Operating Condition / Location
  operatingCondition: text("operating_condition"), // 'SAILING' | 'PORT' | 'ANCHOR'
  locationText: text("location_text"),
  
  // 3. Routine / Breakdown
  occurrenceType: text("occurrence_type"), // 'ROUTINE' | 'BREAKDOWN'
  
  // 4. Responsible Role
  responsibleRole: text("responsible_role"),
  responsibleRoleId: text("responsible_role_id"),
  
  // 6. Deferment Procedure
  isDeferred: boolean("is_deferred").notNull().default(false),
  deferReason: text("defer_reason"),
  deferNewTargetDate: text("defer_new_target_date"), // ISO format YYYY-MM-DD
  deferApprovalRequired: boolean("defer_approval_required").default(true),
  
  // 7. Third-Party Reporting
  reportToThirdParty: boolean("report_to_third_party").notNull().default(false),
  classReport: boolean("class_report").notNull().default(false),
  flagReport: boolean("flag_report").notNull().default(false),
  portReport: boolean("port_report").notNull().default(false),
  reportReferenceNo: text("report_reference_no"),
  reportDate: text("report_date"), // ISO format YYYY-MM-DD
  
  // 8. Vessel Location (At Port / At Sea)
  vesselLocationType: text("vessel_location_type"), // 'atPort' | 'atSea'
  portName: text("port_name"), // When vesselLocationType is 'atPort'
  latitude: text("latitude"), // When vesselLocationType is 'atSea'
  longitude: text("longitude"), // When vesselLocationType is 'atSea'
  vesselLocationDetail: text("vessel_location_detail"), // Additional location detail dropdown
  
  // Legacy fields (kept for backward compatibility)
  reportedBy: text("reported_by").notNull(),
  assignedTo: text("assigned_to"),
  reviewedBy: text("reviewed_by"),
  // Closure fields
  closedBy: text("closed_by"),
  closedOn: text("closed_on"), // ISO format YYYY-MM-DD HH:MM:SS
  closureComment: text("closure_comment"),
  closureFiles: text("closure_files").array(), // Array of file URLs
  // Linked defects
  linkedDefects: text("linked_defects").array(), // Array of defect IDs
  // Notes
  notes: json("notes").$type<Array<{
    noteId: string;
    noteText: string;
    attachments: string[];
    createdBy: string;
    createdOn: string;
  }>>().default([]),
  // Actions (stored inline for form wizard)
  actions: json("actions").$type<Array<{
    id: string;
    actionType: string;
    proposedBy?: string;
    actionDescription: string;
    responsibility?: string;
    email?: string;
    dueDate?: string;
    dateCompleted?: string;
    status: string;
  }>>(),
  // Attachments (stored inline for form wizard)
  attachments: json("attachments").$type<Array<{
    name: string;
    size: number;
    type: string;
  }>>(),
  // Audit trail
  auditTrail: json("audit_trail").$type<Array<{
    action: string;
    userId: string;
    userName: string;
    timestamp: string;
    details?: any;
  }>>().default([]),
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
  id: true,
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

// Recurring Defects Tables
export const recurringDefects = pgTable("recurring_defects", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  equipmentKey: text("equipment_key").notNull(),
  windowMonths: integer("window_months").notNull().default(12),
  occurrenceCount: integer("occurrence_count").notNull(),
  openCount: integer("open_count").notNull(),
  vesselsAffected: integer("vessels_affected").notNull(),
  lastOccurrenceDate: text("last_occurrence_date").notNull(), // DD-MM-YYYY format
  hasCoc: boolean("has_coc").notNull().default(false),
  mtbfDays: numeric("mtbf_days"), // Average days between occurrences
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (table) => ({
  equipmentKeyWindowIdx: index("idx_recurring_key_window").on(table.equipmentKey, table.windowMonths),
  updatedAtIdx: index("idx_recurring_updated").on(table.updatedAt),
}));

export const insertRecurringDefectSchema = createInsertSchema(recurringDefects).omit({
  id: true,
  updatedAt: true,
});

export type InsertRecurringDefect = z.infer<typeof insertRecurringDefectSchema>;
export type RecurringDefect = typeof recurringDefects.$inferSelect;

// Recurring Defect Links - links recurring groups to individual defects
export const recurringDefectLinks = pgTable("recurring_defect_links", {
  recurringId: integer("recurring_id").notNull().references(() => recurringDefects.id, { onDelete: "cascade" }),
  defectId: text("defect_id").notNull().references(() => defects.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.recurringId, table.defectId] }),
  recurringIdx: index("idx_link_recurring").on(table.recurringId),
  defectIdx: index("idx_link_defect").on(table.defectId),
}));

export const insertRecurringDefectLinkSchema = createInsertSchema(recurringDefectLinks);

export type InsertRecurringDefectLink = z.infer<typeof insertRecurringDefectLinkSchema>;
export type RecurringDefectLink = typeof recurringDefectLinks.$inferSelect;

// Import History Table
export const importHistory = pgTable("import_history", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'components' | 'spares' | 'stores' | 'jobs'
  mode: text("mode").notNull(), // 'add' | 'update' | 'upsert'
  archiveMissing: boolean("archive_missing").notNull().default(false),
  userId: text("user_id").notNull(),
  vesselId: text("vessel_id"),
  created: integer("created").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  archived: integer("archived").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull(), // 'complete' | 'failed' | 'undone' | 'undo_failed'
  originalName: text("original_name"), // Original uploaded filename
  fileSize: integer("file_size"), // File size in bytes
  undoneAt: timestamp("undone_at"), // Timestamp when import was undone
  errorMessage: text("error_message"), // Error message if import or undo failed
}, (table) => ({
  typeIdx: index("idx_import_history_type").on(table.type),
  startedAtIdx: index("idx_import_history_started").on(table.startedAt),
  vesselIdx: index("idx_import_history_vessel").on(table.vesselId),
}));

// Import Change Log Table - tracks individual record changes for undo functionality
export const importChangeLog = pgTable("import_change_log", {
  id: text("id").primaryKey(),
  importHistoryId: text("import_history_id").notNull().references(() => importHistory.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // 'component' | 'job' | 'spare' | 'store'
  entityId: text("entity_id").notNull(), // ID of the affected record
  operation: text("operation").notNull(), // 'created' | 'updated' | 'archived'
  previousData: json("previous_data"), // Full snapshot before change (for updated/archived)
  newData: json("new_data"), // Minimal snapshot after change
  checksum: text("checksum").notNull(), // Hash of the record at time of change for conflict detection
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  importHistoryIdx: index("idx_change_log_import").on(table.importHistoryId),
  entityIdx: index("idx_change_log_entity").on(table.entityType, table.entityId),
}));

export const insertImportHistorySchema = createInsertSchema(importHistory).omit({
  startedAt: true,
});

export type InsertImportHistory = z.infer<typeof insertImportHistorySchema>;
export type ImportHistory = typeof importHistory.$inferSelect;

export const insertImportChangeLogSchema = createInsertSchema(importChangeLog).omit({
  createdAt: true,
});

export type InsertImportChangeLog = z.infer<typeof insertImportChangeLogSchema>;
export type ImportChangeLog = typeof importChangeLog.$inferSelect;

// Makers Table (Fleet Admin - Equipment Manufacturers)
export const makers = pgTable("makers", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  makerCode: text("maker_code").notNull().unique(), // Auto-generated: MKR-000001
  makerName: text("maker_name").notNull(),
  address: text("address"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  makerCodeIdx: index("idx_maker_code").on(table.makerCode),
  makerNameIdx: index("idx_maker_name").on(table.makerName),
}));

export const insertMakerSchema = createInsertSchema(makers).omit({
  id: true,
  makerCode: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
});

export type InsertMaker = z.infer<typeof insertMakerSchema>;
export type Maker = typeof makers.$inferSelect;

// Master Lists Table (Fleet Admin - Dropdown Options Management)
export const masterLists = pgTable("master_lists", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  listType: text("list_type").notNull(), // 'department', 'rank', 'intervalUnit', etc.
  listKey: text("list_key").notNull(), // Unique key for the value
  listValue: text("list_value").notNull(), // Display value
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_master_list_type").on(table.listType),
  unique("unique_list_type_key").on(table.listType, table.listKey),
]);

export const insertMasterListSchema = createInsertSchema(masterLists).omit({
  id: true,
  createdAt: true,
});

export type InsertMasterList = z.infer<typeof insertMasterListSchema>;
export type MasterList = typeof masterLists.$inferSelect;

// Fleet Equipment Master Table - Normalized master data for fleet equipment
export const fleetEquipmentMaster = pgTable("fleet_equipment_master", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetEquipmentCode: text("fleet_equipment_code").notNull().unique(), // Unique identifier (XXX.XXX.XX format)
  fleetEquipmentName: text("fleet_equipment_name").notNull(), // General name from SFI booklet
  maker: text("maker"), // Manufacturer name
  makerCode: text("maker_code"), // Unique code for maker
  model: text("model"), // Equipment model
  modelCode: text("model_code"), // Combination of Maker Code + Model
  description: text("description"), // Additional description
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  fleetEquipmentCodeIdx: index("idx_fleet_equipment_code").on(table.fleetEquipmentCode),
  makerCodeIdx: index("idx_fleet_maker_code").on(table.makerCode),
  modelCodeIdx: index("idx_fleet_model_code").on(table.modelCode),
}));

export const insertFleetEquipmentMasterSchema = createInsertSchema(fleetEquipmentMaster).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFleetEquipmentMaster = z.infer<typeof insertFleetEquipmentMasterSchema>;
export type FleetEquipmentMaster = typeof fleetEquipmentMaster.$inferSelect;

// Component Running Hours Log - Detailed audit trail for all running hours updates
export const componentRunningHoursLog = pgTable("component_running_hours_log", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselCode: text("vessel_code").notNull(),
  componentCode: text("component_code").notNull(),
  componentId: text("component_id").notNull(),
  previousRh: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
  newRh: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
  deltaRh: decimal("delta_rh", { precision: 10, scale: 2 }).notNull(), // Change in running hours (can be negative for corrections)
  updatedBy: text("updated_by").notNull(), // User ID who made the change
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updateSource: text("update_source").notNull(), // 'manual' | 'cascade' | 'bulk_import' | 'work_order'
  notes: text("notes"), // Optional notes for the update
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  componentCodeIdx: index("idx_rh_log_component_code").on(table.componentCode),
  vesselCodeIdx: index("idx_rh_log_vessel_code").on(table.vesselCode),
  updatedAtIdx: index("idx_rh_log_updated_at").on(table.updatedAt),
  updateSourceIdx: index("idx_rh_log_update_source").on(table.updateSource),
}));

export const insertComponentRunningHoursLogSchema = createInsertSchema(componentRunningHoursLog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComponentRunningHoursLog = z.infer<typeof insertComponentRunningHoursLogSchema>;
export type ComponentRunningHoursLog = typeof componentRunningHoursLog.$inferSelect;

// Audit Log - System-wide audit trail for all data changes
export const auditLog = pgTable("audit_log", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userId: text("user_id").notNull(), // User who made the change
  vesselCode: text("vessel_code"), // Vessel context (nullable for fleet-level changes)
  componentCode: text("component_code"), // Component context (nullable)
  entityType: text("entity_type").notNull(), // 'component' | 'job' | 'work_order' | 'spare' | 'document' | 'survey' | 'maintenance_history'
  entityId: text("entity_id").notNull(), // ID of the affected entity
  actionType: text("action_type").notNull(), // 'create' | 'update' | 'delete' | 'approve' | 'reject'
  fieldName: text("field_name"), // Specific field changed (nullable for create/delete)
  oldValue: text("old_value"), // Previous value (JSON string for complex objects)
  newValue: text("new_value"), // New value (JSON string for complex objects)
  source: text("source").notNull(), // 'web_ui' | 'api' | 'bulk_import' | 'system' | 'modify_pms'
  payload: json("payload"), // Additional context (e.g., full snapshot, metadata)
}, (table) => ({
  timestampIdx: index("idx_audit_timestamp").on(table.timestamp),
  userIdIdx: index("idx_audit_user_id").on(table.userId),
  vesselCodeIdx: index("idx_audit_vessel_code").on(table.vesselCode),
  entityTypeIdx: index("idx_audit_entity_type").on(table.entityType),
  entityIdIdx: index("idx_audit_entity_id").on(table.entityId),
  actionTypeIdx: index("idx_audit_action_type").on(table.actionType),
}));

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

// Component Documents Table - Drawings, manuals, and technical documents
export const componentDocuments = pgTable("component_documents", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull(),
  componentCode: text("component_code").notNull(),
  vesselCode: text("vessel_code").notNull(),
  fleetEquipmentCode: text("fleet_equipment_code"), // Link to fleet equipment for auto-preloading
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(), // Object storage key
  fileType: text("file_type").notNull(), // 'Manual' | 'Drawing' | 'OEM Doc' | 'Catalogue' | 'Certificate' | 'Other'
  fileSize: integer("file_size"), // File size in bytes
  version: text("version").notNull().default("1.0"), // Document version for future versioning support
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  canShipView: boolean("can_ship_view").notNull().default(true), // Ship users can view
  canShipDownload: boolean("can_ship_download").notNull().default(false), // Ship users can download
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"), // Additional notes about the document
}, (table) => ({
  componentIdIdx: index("idx_doc_component_id").on(table.componentId),
  componentCodeIdx: index("idx_doc_component_code").on(table.componentCode),
  vesselCodeIdx: index("idx_doc_vessel_code").on(table.vesselCode),
  fleetEquipmentCodeIdx: index("idx_doc_fleet_equipment_code").on(table.fleetEquipmentCode),
  fileTypeIdx: index("idx_doc_file_type").on(table.fileType),
}));

export const insertComponentDocumentSchema = createInsertSchema(componentDocuments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertComponentDocument = z.infer<typeof insertComponentDocumentSchema>;
export type ComponentDocument = typeof componentDocuments.$inferSelect;

// Component Class Regulatory Table - Classification and regulatory survey data (multiple rows per component)
export const componentClassRegulatory = pgTable("component_class_regulatory", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull(),
  componentCode: text("component_code").notNull(),
  vesselCode: text("vessel_code").notNull(),
  classificationSociety: text("classification_society").notNull(), // 'DNV' | 'ABS' | 'Lloyd\'s Register' | 'ClassNK' | 'RINA' | 'IRS'
  surveyType: text("survey_type").notNull(), // 'Annual Survey' | '5-Year Survey' | 'Intermediate Survey' | 'Damage Survey' | 'OEM Test' | 'Statutory Requirement' | 'Internal Company Requirement'
  certificateNumber: text("certificate_number"),
  issueDate: text("issue_date"), // DD-MMM-YYYY format
  expiryDate: text("expiry_date"), // DD-MMM-YYYY format
  lastClassSurvey: text("last_class_survey"), // DD-MMM-YYYY format
  nextSurveyDue: text("next_survey_due"), // DD-MMM-YYYY format
  classRequirements: text("class_requirements"), // Text description of requirements
  surveyStatus: text("survey_status").notNull().default("Active"), // 'Active' | 'Expired' | 'Pending' | 'Cancelled'
  remarks: text("remarks"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  componentIdIdx: index("idx_class_component_id").on(table.componentId),
  componentCodeIdx: index("idx_class_component_code").on(table.componentCode),
  vesselCodeIdx: index("idx_class_vessel_code").on(table.vesselCode),
  surveyTypeIdx: index("idx_class_survey_type").on(table.surveyType),
  expiryDateIdx: index("idx_class_expiry_date").on(table.expiryDate),
}));

export const insertComponentClassRegulatorySchema = createInsertSchema(componentClassRegulatory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComponentClassRegulatory = z.infer<typeof insertComponentClassRegulatorySchema>;
export type ComponentClassRegulatory = typeof componentClassRegulatory.$inferSelect;

// Component Maintenance History Table - Immutable maintenance records (NO EDITS/DELETES ALLOWED)
export const componentMaintenanceHistory = pgTable("component_maintenance_history", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull(),
  componentCode: text("component_code").notNull(),
  vesselCode: text("vessel_code").notNull(),
  workOrderId: text("work_order_id").notNull(), // Link to completed work order
  workOrderNo: text("work_order_no").notNull(),
  jobTitle: text("job_title").notNull(),
  maintenanceType: text("maintenance_type").notNull(), // 'Inspection' | 'Overhaul' | 'Servicing' | 'Testing' | 'Cleaning' | 'Lubrication' | 'Replacement'
  dateCompleted: text("date_completed").notNull(), // Stored as ISO (YYYY-MM-DD) for sorting, displayed as DD-MMM-YYYY
  runningHoursAtCompletion: decimal("running_hours_at_completion", { precision: 10, scale: 2 }),
  performedBy: text("performed_by").notNull(),
  approvedBy: text("approved_by"),
  approvalDate: text("approval_date"), // Stored as ISO (YYYY-MM-DD) for sorting, displayed as DD-MMM-YYYY
  status: text("status").notNull().default("Approved"), // Only 'Approved' entries shown in history
  workDescription: text("work_description"),
  sparesUsed: json("spares_used"), // [{partCode, partName, quantity}]
  remarks: text("remarks"),
  isComponentReplaced: boolean("is_component_replaced").notNull().default(false), // Special flag for component replacement
  createdAt: timestamp("created_at").notNull().defaultNow(), // IMMUTABLE - no updates/deletes allowed
}, (table) => ({
  componentIdIdx: index("idx_history_component_id").on(table.componentId),
  componentCodeIdx: index("idx_history_component_code").on(table.componentCode),
  vesselCodeIdx: index("idx_history_vessel_code").on(table.vesselCode),
  workOrderIdIdx: index("idx_history_work_order_id").on(table.workOrderId),
  dateCompletedIdx: index("idx_history_date_completed").on(table.dateCompleted),
}));

export const insertComponentMaintenanceHistorySchema = createInsertSchema(componentMaintenanceHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertComponentMaintenanceHistory = z.infer<typeof insertComponentMaintenanceHistorySchema>;
export type ComponentMaintenanceHistory = typeof componentMaintenanceHistory.$inferSelect;
