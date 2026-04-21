
import { pgTable, text, integer, boolean, timestamp, decimal, index, uniqueIndex, json, jsonb, numeric, primaryKey, unique, pgEnum, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { updatedAtColumn, updatedAtColumnTz } from "./schemaHelpers";

// User roles enum - Ship (vessel-based user), Office (shore-based user), PMS Admin (full system access)
export const userRoleEnum = pgEnum("user_role", ["Ship", "Office", "PMS Admin", "Sail Admin"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: userRoleEnum("role").notNull().default("Ship"),
  vesselId: text("vessel_id").references(() => vessels.vuuid), // Required for Ship role, null for Office/PMS Admin
  department: text("department"), // Rule #19: User's department for approver validation (e.g., 'Deck', 'Engine', 'Electrical')
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserRole = "Ship" | "Office" | "PMS Admin" | "Sail Admin" | "Super Admin" | "Vessel Admin" | "Vessel User" | "External 10";

export type PublicUser = Omit<User, "password" | "role"> & {
  role: UserRole;
  crewDesignation?: string;
  rankId?: string;
  rank_name?: string;
  userType?: "Office" | "Ship";
  userUuid?: string;
  firstname?: string;
  lastname?: string;
};

// Fleets Table - Fleet registry for grouping vessels
export const fleets = pgTable("fleets", {
  id: text("id").primaryKey(), // Fleet code like FLT001, FLT002
  fuuid: text("fuuid").notNull().unique(), // Canonical UUID identity — FK target for child tables
  code: text("code").notNull().unique(), // Unique fleet code
  name: text("name").notNull(), // Fleet display name
  description: text("description"), // Optional description
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertFleetSchema = createInsertSchema(fleets).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertFleet = z.infer<typeof insertFleetSchema>;
export type Fleet = typeof fleets.$inferSelect;

// Vessels Table - Core vessel registry
export const vessels = pgTable("vessels", {
  id: text("id").primaryKey(), // Vessel code like V001, V002
  vuuid: text("vuuid").notNull().unique(), // Canonical UUID identity — FK target for all child tables
  name: text("name").notNull(), // Vessel display name
  code: text("code").notNull(), // Same as id for compatibility
  fleetId: text("fleet_id"), // Optional reference to fleet
  imoNumber: text("imo_number"), // IMO number if applicable
  vesselType: text("vessel_type"), // e.g., Tanker, Bulk Carrier, Container
  flag: text("flag"), // Flag state
  vesselSequence: integer("vessel_sequence"), // Numeric sequence for vessel (1, 2, 3... for defect IDs)
  classId: text("class_id"), // FK to fleet_classes.fcuuid — vessel class/group within a fleet
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertVesselSchema = createInsertSchema(vessels).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type Vessel = typeof vessels.$inferSelect;

// Fleet Classes Table - Logical grouping of vessels within a fleet
export const fleetClasses = pgTable("fleet_classes", {
  id: serial("id").primaryKey(),
  fcuuid: text("fcuuid").notNull().unique(),
  fleetId: text("fleet_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  fleetIdIdx: index("idx_fleet_classes_fleet_id").on(table.fleetId),
}));

export const insertFleetClassSchema = createInsertSchema(fleetClasses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFleetClass = z.infer<typeof insertFleetClassSchema>;
export type FleetClass = typeof fleetClasses.$inferSelect;

// Defect Sequences Table - Tracks defect ID counters per vessel per year
export const defectSequences = pgTable("defect_sequences", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  year: integer("year").notNull(), // 2-digit year stored as 4-digit (e.g., 2026)
  lastSequence: integer("last_sequence").notNull().default(0), // Last used sequence number,
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  uniqueVesselYear: unique("unique_defect_seq_vessel_year").on(table.vesselId, table.year),
}));

export const insertDefectSequenceSchema = createInsertSchema(defectSequences).omit({
  id: true,
});

export type InsertDefectSequence = z.infer<typeof insertDefectSequenceSchema>;
export type DefectSequence = typeof defectSequences.$inferSelect;

// Running Hours Audit Table
export const runningHoursAudit = pgTable("running_hours_audit", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  componentId: text("component_id").notNull().references(() => components.cuuid),
  previousRH: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
  newRH: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
  cumulativeRH: decimal("cumulative_rh", { precision: 10, scale: 2 }).notNull(),
  dateUpdatedLocal: text("date_updated_local").notNull(), // DD-MMM-YYYY HH:mm
  dateUpdatedTZ: text("date_updated_tz").notNull(), // e.g., Asia/Kolkata
  enteredAtUTC: timestamp("entered_at_utc").notNull(),
  userId: text("user_id").notNull(),
  source: text("source").notNull(), // 'single' | 'bulk' | 'cascade' | 'inherited_cascade'
  notes: text("notes"),
  meterReplaced: boolean("meter_replaced").notNull().default(false),
  oldMeterFinal: decimal("old_meter_final", { precision: 10, scale: 2 }),
  newMeterStart: decimal("new_meter_start", { precision: 10, scale: 2 }),
  version: integer("version").notNull().default(1),
  // Renewal/Replacement fields (populated when RH is reset to 0)
  isRenewalReset: boolean("is_renewal_reset").notNull().default(false), // True when RH reset to 0 via renewal/replacement
  renewalActionType: text("renewal_action_type"), // 'Renewed' | 'Replaced' | 'Overhauled'
  renewalReason: text("renewal_reason"), // Mandatory reason when isRenewalReset = true
  renewalReference: text("renewal_reference"), // Optional work order / job ID reference
  renewalEvidenceUrls: json("renewal_evidence_urls"), // Optional array of uploaded file URLs
  componentCode: text("component_code"),
  componentName: text("component_name"),
  updatedByUuid: text("updated_by_uuid"),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  componentIdIdx: index("idx_component_entered").on(table.componentId, table.enteredAtUTC),
  componentDateIdx: index("idx_component_date").on(table.componentId, table.dateUpdatedLocal),
  renewalResetIdx: index("idx_renewal_reset").on(table.isRenewalReset, table.vesselId),
}));

export const insertRunningHoursAuditSchema = createInsertSchema(runningHoursAudit).omit({
  id: true,
});

export type InsertRunningHoursAudit = z.infer<typeof insertRunningHoursAuditSchema>;
export type RunningHoursAudit = typeof runningHoursAudit.$inferSelect;

// Renewal Action Types for RH reset to 0
export const RENEWAL_ACTION_TYPES = ['Renewed', 'Replaced', 'Overhauled'] as const;
export type RenewalActionType = typeof RENEWAL_ACTION_TYPES[number];

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
  userId: z.string().default('admin'),
  userUuid: z.string().optional(),
  userRole: z.string().optional().default('Ship'),
  adminOverride: z.boolean().optional().default(false),
  // Renewal/Replacement fields (required when value = 0)
  isRenewalReset: z.boolean().optional().default(false),
  renewalActionType: z.enum(RENEWAL_ACTION_TYPES).optional(),
  renewalReason: z.string().optional(),
  renewalReference: z.string().optional(),
  renewalEvidenceUrls: z.array(z.string()).optional(),
}).refine(data => data.mode === 'setTotal' || data.value > 0, {
  message: "addDelta mode requires value > 0",
  path: ["value"]
}).refine(data => {
  // When value is 0 in setTotal mode, isRenewalReset must be true with required fields
  if (data.mode === 'setTotal' && data.value === 0) {
    return data.isRenewalReset === true && 
           !!data.renewalActionType && 
           !!data.renewalReason && 
           data.renewalReason.trim().length > 0;
  }
  return true;
}, {
  message: "When setting RH to 0, renewal confirmation with action type and reason is required",
  path: ["renewalReason"]
}).refine(data => {
  // When meterReplaced is true, oldMeterFinal is mandatory
  if (data.meterReplaced === true) {
    return !!data.oldMeterFinal && data.oldMeterFinal.trim().length > 0;
  }
  return true;
}, {
  message: "Old Meter Final reading is required when meter is replaced",
  path: ["oldMeterFinal"]
});

export type CascadeRunningHoursRequest = z.infer<typeof cascadeRunningHoursSchema>;

// Running Hour Parent Response - parent component with child summary
export type RunningHourParent = Component & {
  childCount: number;
  latestUpdate?: string;
};

// === RH Counter Type Enums and Schemas (B7.B) ===
export const RH_COUNTER_TYPES = ['MASTER', 'INHERITED', 'NOT_RH_DRIVEN'] as const;
export const RH_UPDATE_SOURCES = ['MANUAL', 'IMPORT', 'AUTOMATION'] as const;

export type RHCounterType = typeof RH_COUNTER_TYPES[number];
export type RHUpdateSource = typeof RH_UPDATE_SOURCES[number];

// Schema for updating RH counter configuration
export const updateRHConfigSchema = z.object({
  componentId: z.string(),
  rhCounterType: z.enum(RH_COUNTER_TYPES),
  rhMasterComponentId: z.string().nullable().optional(), // Required for INHERITED type
});

export type UpdateRHConfigRequest = z.infer<typeof updateRHConfigSchema>;

// Schema for updating MASTER running hours (with cascade to INHERITED)
export const updateMasterRHSchema = z.object({
  componentId: z.string(),
  newRHValue: z.number().nonnegative(),
  updateSource: z.enum(RH_UPDATE_SOURCES).default('MANUAL'),
  userId: z.string(),
  userUuid: z.string().optional(),
  comments: z.string().optional(),
});

export type UpdateMasterRHRequest = z.infer<typeof updateMasterRHSchema>;

// Response type for RH configuration with source info
export type RHConfigResponse = {
  componentId: string;
  componentName: string;
  rhCounterType: RHCounterType;
  rhMasterComponentId: string | null;
  rhMasterComponentName: string | null; // Name of the master component (for display)
  rhCurrentValue: string | null; // Current RH value (master or inherited cached)
  rhLastUpdated: Date | null;
  rhUpdateSource: RHUpdateSource | null;
};

// Components Table (for storing current cumulative RH)
// Column order matches UI form field order (Section A: Component Information)
export const components = pgTable("components", {
  id: text("id").primaryKey(),
  cuuid: text("cuuid").notNull().unique(), // Canonical UUID identity — FK target for all 15 child tables
  // === UI Row 1: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Component Code ===
  fleetEquipmentCode: text("fleet_equipment_code"), // Fleet equipment code (XXX.XXX.XX format) - NOT unique, multiple components can share same code
  fleetEquipmentName: text("fleet_equipment_name"), // General name from SFI booklet
  parentId: text("parent_id"),
  componentCode: text("component_code"),
  // === UI Row 2: Component Name, Component Category, Maker, Maker Code ===
  name: text("name"), // Nullable - only required when dataScope='vessel'
  componentCategory: text("component_category"),
  maker: text("maker"), // Manufacturer name from manual
  makerCode: text("maker_code"), // Unique code for maker
  // === UI Row 3: Model, Model Code, Serial No, Drawing No ===
  model: text("model"), // Equipment model from manual
  modelCode: text("model_code"), // Combination of Maker Code + Model
  serialNo: text("serial_no"), // Serial number from manual
  drawingNo: text("drawing_no"), // Drawing/diagram number
  // === UI Row 4: Location, Critical, Condition Based, Installation Date ===
  location: text("location"),
  critical: boolean("critical").default(false), // Critical equipment (Yes/No)
  conditionBased: boolean("condition_based").default(false), // Condition Based maintenance (Yes/No)
  installationDate: text("installation_date"), // DD-MM-YYYY format
  // === UI Row 5: Commissioned Date, Rating, Equipment/System Department ===
  commissionedDate: text("commissioned_date"), // DD-MM-YYYY format
  rating: text("rating"), // Capacity or rating from manual
  eqptSystemDept: text("eqpt_system_dept"), // Equipment/System Department
  // === UI Row 6: IS Active, Vessel Code, IS Parent ===
  isActive: boolean("is_active").default(true), // IS Active (Yes/No)
  vesselCode: text("vessel_code"), // Vessel identification code
  isParent: boolean("is_parent").default(false), // IS Parent (Yes/No) - indicates if component has children
  // === UI Row 7: Notes ===
  notes: text("notes"), // Specifications or additional information
  // === Non-UI Fields (Internal/System Fields) ===
  vesselId: text("vessel_id").references(() => vessels.vuuid), // Nullable - only required when dataScope='vessel'
  dataScope: text("data_scope").notNull().default("vessel"), // 'fleet' | 'vessel' - discriminator for fleet vs vessel data
  parentFleetEquipmentCode: text("parent_fleet_equipment_code"), // For fleet hierarchy
  modelNumber: text("model_number"), // Model number (stored separately from model)
  department: text("department"),
  deptCategory: text("dept_category"),
  category: text("category"), // Nullable - only required when dataScope='vessel'
  classItem: boolean("class_item").default(false),
  noOfUnits: text("no_of_units"),
  parentComponent: text("parent_component"),
  dimensionsSize: text("dimensions_size"),
  runningHours: decimal("running_hours", { precision: 10, scale: 2 }), // For storing template running hours value
  currentCumulativeRH: decimal("current_cumulative_rh", { precision: 10, scale: 2 }).notNull().default("0"),
  lastUpdated: text("last_updated"),
  applicableVesselIds: text("applicable_vessel_ids").array(), // Array of vessel codes that can use this fleet equipment
  scopeNotes: text("scope_notes"), // Notes about scope applicability
  
  // === Section B7.B: Running Hours & Condition Monitoring ===
  // RH Counter Type: MASTER | INHERITED | NOT_RH_DRIVEN
  rhCounterType: text("rh_counter_type").notNull().default("NOT_RH_DRIVEN"),
  // RH Counter Source: Source of running hours data (e.g., MAIN_ENGINE, GENERATOR, MANUAL)
  rhCounterSource: text("rh_counter_source"),
  // For INHERITED components: references the MASTER component
  rhMasterComponentId: text("rh_master_component_id"),
  // For MASTER components: the actual running hours value
  rhCurrentMaster: decimal("rh_current_master", { precision: 10, scale: 2 }),
  rhMasterUpdatedAt: timestamp("rh_master_updated_at"),
  rhMasterUpdatedBy: text("rh_master_updated_by"),
  rhMasterUpdateSource: text("rh_master_update_source"), // MANUAL | IMPORT | AUTOMATION
  // For INHERITED components: cached copy of MASTER RH (system-maintained, read-only)
  rhCurrentInheritedCached: decimal("rh_current_inherited_cached", { precision: 10, scale: 2 }),
  rhInheritedUpdatedAt: timestamp("rh_inherited_updated_at"),
  
  // === Meter Replacement Tracking ===
  // When meter is replaced, stores the cumulative total RH at time of replacement
  // Total RH = meterReplacedLastRh + currentCumulativeRH (new meter reading)
  meterReplacedDate: timestamp("meter_replaced_date"),
  meterReplacedLastRh: decimal("meter_replaced_last_rh", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  dataScopeIdx: index("idx_comp_data_scope").on(table.dataScope),
  fleetTreeIdx: index("idx_comp_fleet_tree").on(table.dataScope, table.parentFleetEquipmentCode),
  vesselTreeIdx: index("idx_comp_vessel_tree").on(table.dataScope, table.vesselId, table.parentId),
  // NOTE: fleetEquipmentCode is NOT unique - multiple components can share the same fleet equipment code/name
  fleetEquipmentCodeIdx: index("idx_comp_fleet_equipment_code").on(table.fleetEquipmentCode),
  rhMasterIdx: index("idx_comp_rh_master").on(table.rhCounterType, table.vesselId),
  rhInheritedIdx: index("idx_comp_rh_inherited").on(table.rhMasterComponentId),
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
  fduuid: text("fduuid").notNull().unique(), // Canonical UUID identity — FK target for form_versions
  name: text("name").notNull().unique(), // ADD_COMPONENT, WO_PLANNED, WO_UNPLANNED
  subgroup: text("subgroup"),
  isSync: boolean("is_sync").default(false),
});

export const insertFormDefinitionSchema = createInsertSchema(formDefinitions).omit({
  id: true,
  fduuid: true,
});

export type InsertFormDefinition = z.infer<typeof insertFormDefinitionSchema>;
export type FormDefinition = typeof formDefinitions.$inferSelect;

// Form Versions Table
export const formVersions = pgTable("form_versions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fvuuid: text("fvuuid").notNull().unique(), // Canonical UUID identity — FK target for form_version_usage
  formId: integer("form_id").notNull(), // Legacy integer reference — kept during transition
  formDefinitionUuid: text("form_definition_uuid").notNull()
    .references(() => formDefinitions.fduuid), // FK → form_definitions.fduuid
  versionNo: integer("version_no").notNull(),
  versionDate: timestamp("version_date").notNull(),
  status: text("status").notNull(), // DRAFT, PUBLISHED, ARCHIVED
  authorUserId: text("author_user_id").notNull(),
  changelog: text("changelog"),
  schemaJson: text("schema_json").notNull(), // JSON string,
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  formIdIdx: index("idx_form_id").on(table.formId),
  statusIdx: index("idx_form_version_status").on(table.status),
}));

export const insertFormVersionSchema = createInsertSchema(formVersions).omit({
  id: true,
  fvuuid: true,
});

export type InsertFormVersion = z.infer<typeof insertFormVersionSchema>;
export type FormVersion = typeof formVersions.$inferSelect;

// Form Version Usage Table (Audit)
export const formVersionUsage = pgTable("form_version_usage", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  formVersionId: integer("form_version_id").notNull(), // Legacy integer reference — kept during transition
  formVersionUuid: text("form_version_uuid").notNull()
    .references(() => formVersions.fvuuid), // FK → form_versions.fvuuid
  usedInModule: text("used_in_module").notNull(),
  usedAt: timestamp("used_at").notNull(),
  isSync: boolean("is_sync").default(false),
});

export const insertFormVersionUsageSchema = createInsertSchema(formVersionUsage).omit({
  id: true,
});

export type InsertFormVersionUsage = z.infer<typeof insertFormVersionUsageSchema>;
export type FormVersionUsage = typeof formVersionUsage.$inferSelect;

// IHM (Inventory of Hazardous Materials) Tables
export const ihmItems = pgTable("ihm_items", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull().references(() => components.cuuid),
  spareId: text("spare_id"),
  presence: text("presence").notNull(), // Unknown | Present | Not Present
  materials: text("materials").array(), // Asbestos, PCB, PFOS, etc.
  evidenceType: text("evidence_type"), // MD | SDoC | Test | None
  evidenceFileName: text("evidence_file_name"),
  verifiedDate: text("verified_date"),
  supplier: text("supplier"),
  remarks: text("remarks"),
  vesselId: text("vessel_id").notNull().default("V001").references(() => vessels.vuuid),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
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
  workOrderId: text("work_order_id").notNull().references(() => workOrders.wouuid), // FK → work_orders.wouuid
  action: text("action").notNull(), // Installed | Removed | Replaced
  targetComponent: text("target_component"),
  targetSpare: text("target_spare"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  location: text("location"),
  materials: text("materials").array(),
  remarks: text("remarks"),
  vesselId: text("vessel_id").notNull().default("V001").references(() => vessels.vuuid),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userId: text("user_id").notNull(),
  isSync: boolean("is_sync").default(false),
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
  suuid: text("suuid").notNull().unique(), // Canonical UUID identity — FK target for all 4 child tables
  partCode: text("part_code").notNull(),
  partName: text("part_name").notNull(),
  componentId: text("component_id").references(() => components.cuuid), // Nullable for fleet spares
  componentCode: text("component_code"),
  componentName: text("component_name").notNull(),
  componentSpareCode: text("component_spare_code"), // Format: SP-<ComponentCode>-<NNN>
  critical: text("critical").notNull(), // 'Critical' | 'Non-Critical' | 'Yes' | 'No'
  rob: integer("rob").notNull().default(0), // Remaining on Board (total = robLocationA + robLocationB)
  robLocationA: integer("rob_location_a").notNull().default(0), // ROB in Location A
  robLocationB: integer("rob_location_b").notNull().default(0), // ROB in Location B
  min: integer("min").notNull().default(0), // Minimum stock
  max: integer("max"), // Maximum stock level
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // Cost per unit
  stockingNumber: text("stocking_number"), // Internal stocking reference
  leadTime: text("lead_time"), // Procurement lead time
  supplier: text("supplier"), // Supplier name
  lastOrderDate: text("last_order_date"), // Last procurement date (DD-MMM-YYYY format)
  location: text("location"),
  vesselId: text("vessel_id").references(() => vessels.vuuid), // Nullable - only required when dataScope='vessel'
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
  ihm: text("ihm"), // IHM related text/number (legacy)
  ihmPresence: text("ihm_presence").default("UNKNOWN"), // YES | NO | UNKNOWN
  evidenceType: text("evidence_type"), // NONE | DOC | CERT | MSDS | OTHER
  partCategory: text("part_category"), // Category from master data
  applicableVesselIds: text("applicable_vessel_ids").array(), // Vessels that can use this fleet spare
  scopeNotes: text("scope_notes"), // Notes about scope applicability
  isRotationItem: boolean("is_rotation_item").notNull().default(false), // Rotation spare flag
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"), // User who created the spare
  updatedAt: updatedAtColumn(),
  updatedBy: text("updated_by"), // User who last updated the spare,
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  componentIdIdx: index("idx_spare_component").on(table.componentId),
  vesselIdIdx: index("idx_spare_vessel").on(table.vesselId),
  componentSpareCodeIdx: index("idx_spare_code").on(table.vesselId, table.componentSpareCode),
  dataScopeIdx: index("idx_spare_data_scope").on(table.dataScope),
  fleetEquipmentCodeIdx: index("idx_spare_fleet_equipment").on(table.dataScope, table.fleetEquipmentCode),
  fleetPartCodeUniqueIdx: unique("unique_fleet_part_code_vessel").on(table.fleetPartCode, table.dataScope, table.vesselId),
}));

export const insertSpareSchema = createInsertSchema(spares).omit({
  id: true,
  suuid: true,
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
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  spareId: integer("spare_id").notNull(), // Legacy integer FK — kept during transition
  spareUuid: text("spare_uuid").references(() => spares.suuid), // FK → spares.suuid (nullable for spares_history since table was empty)
  partCode: text("part_code").notNull(),
  partName: text("part_name").notNull(),
  componentId: text("component_id").notNull().references(() => components.cuuid),
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
  place: text("place"), // Port/Location for receive/consume,
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  timestampIdx: index("idx_history_timestamp").on(table.timestampUTC),
  spareIdIdx: index("idx_history_spare").on(table.spareId),
  eventTypeIdx: index("idx_history_event").on(table.eventType),
}));

export const insertSpareHistorySchema = createInsertSchema(sparesHistory).omit({
  id: true,
});

export type InsertSpareHistory = z.infer<typeof insertSpareHistorySchema>;
export type SpareHistory = typeof sparesHistory.$inferSelect & {
  partNumber?: string | null;
};

// Stores Ledger Table (for Stores module history)
export const storesLedger = pgTable("stores_ledger", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  section: text("section").notNull(), // 'stores' | 'lubes' | 'chemicals' | 'others'
  itemId: integer("item_id").notNull(), // Legacy integer FK — kept during transition
  storeUuid: text("store_uuid").notNull().references(() => storesItems.stuuid), // FK → stores_items.stuuid
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
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselSectionDateIdx: index("idx_vessel_section_date").on(table.vesselId, table.section, table.dateLocal),
  itemDateIdx: index("idx_item_date").on(table.itemId, table.dateLocal),
}));

export const insertStoresLedgerSchema = createInsertSchema(storesLedger).omit({
  id: true,
});

export type InsertStoresLedger = z.infer<typeof insertStoresLedgerSchema>;
export type StoresLedger = typeof storesLedger.$inferSelect;

// Stores Items Table - ZERO PMS LINKAGES (no componentId, workOrderId, jobId)
// Stores module is completely isolated from Components/Jobs/Work Orders per Global Business Rule Section 7.2
export const storesItems = pgTable("stores_items", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  stuuid: text("stuuid").notNull().unique(), // Canonical UUID identity — FK target for stores_ledger
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  itemType: text("item_type").notNull(), // 'stores' | 'lubricants' | 'chemicals' | 'others'
  itemCode: text("item_code").notNull(), // Unique item identifier (Part Code)
  impaCode: text("impa_code"), // IMPA Code - standardization code for stores
  itemName: text("item_name").notNull(), // Item Name
  category: text("category"), // Category (General Stores, Electrical, Mechanical, Safety, etc.)
  specification: text("specification"), // Technical specs (size, dimensions, material)
  uom: text("uom"), // Unit of measurement
  rob: decimal("rob", { precision: 10, scale: 2 }).notNull().default("0"), // Remaining on Board (total)
  robLocationA: decimal("rob_location_a", { precision: 10, scale: 2 }).notNull().default("0"), // ROB at Location A
  robLocationB: decimal("rob_location_b", { precision: 10, scale: 2 }).notNull().default("0"), // ROB at Location B
  locationA: text("location_a"), // Primary storage location name (Location A)
  locationB: text("location_b"), // Secondary storage location name (Location B)
  min: decimal("min", { precision: 10, scale: 2 }).notNull().default("0"), // Minimum stock level
  max: decimal("max", { precision: 10, scale: 2 }), // Maximum stock level
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // Cost per unit
  supplier: text("supplier"), // Supplier name
  lastOrderDate: text("last_order_date"), // Last procurement date (DD-MMM-YYYY)
  leadTime: text("lead_time"), // Procurement lead time
  ihm: boolean("ihm").notNull().default(false), // Inventory of Hazardous Materials flag
  ihmDetails: text("ihm_details"), // IHM related information
  ihmPresence: text("ihm_presence").default("Unknown"), // Unknown | Present | Not Present
  ihmEvidenceType: text("ihm_evidence_type").default("None"), // None | MD | SDoC | Test
  manufactureDate: text("manufacture_date"), // DD-MMM-YYYY format
  expiryDate: text("expiry_date"), // DD-MMM-YYYY format
  batchNumber: text("batch_number"),
  lotNumber: text("lot_number"),
  shelfLifeMonths: integer("shelf_life_months"),
  sdsReference: text("sds_reference"),
  sdsDocumentUrl: text("sds_document_url"),
  sdsLastUpdated: text("sds_last_updated"), // DD-MMM-YYYY format
  hazardClassification: text("hazard_classification"), // None | Flammable | Toxic | Corrosive | Oxidizer | Compressed Gas | Other
  unNumber: text("un_number"),
  flashPoint: text("flash_point"),
  storageTempMin: decimal("storage_temp_min", { precision: 5, scale: 2 }),
  storageTempMax: decimal("storage_temp_max", { precision: 5, scale: 2 }),
  disposalInstructions: text("disposal_instructions"),
  ppeRequirements: text("ppe_requirements"),
  emergencyContact: text("emergency_contact"),
  remarks: text("remarks"), // User notes
  deleted: boolean("deleted").notNull().default(false), // Soft delete flag
  isActive: boolean("is_active").notNull().default(true), // Active status
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdIdx: index("idx_stores_vessel").on(table.vesselId),
  itemTypeIdx: index("idx_stores_item_type").on(table.itemType),
  itemCodeIdx: index("idx_stores_item_code").on(table.vesselId, table.itemCode),
  impaCodeIdx: index("idx_stores_impa_code").on(table.impaCode),
  deletedIdx: index("idx_stores_deleted").on(table.deleted),
  expiryDateIdx: index("idx_stores_expiry_date").on(table.expiryDate),
  hazardClassIdx: index("idx_stores_hazard_class").on(table.hazardClassification),
  batchNumberIdx: index("idx_stores_batch_number").on(table.batchNumber),
}));

export const insertStoresItemSchema = createInsertSchema(storesItems).omit({
  id: true,
  stuuid: true,
  deleted: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStoresItem = z.infer<typeof insertStoresItemSchema>;
export type StoresItem = typeof storesItems.$inferSelect;

// Change Request Tables for Modify PMS module
export const changeRequest = pgTable("change_request", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
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
  // Rule #17: Revision tracking for Modify PMS
  revisionNumber: integer("revision_number").notNull().default(0), // Incremented on each approval
  revisionHistory: json("revision_history").$type<Array<{
    revisionNumber: number;
    approvedBy: string;
    approvedAt: string;
    appliedChanges: any[];
    comments?: string;
    // Applied status tracking (added for complete workflow)
    appliedStatus?: 'success' | 'failed' | 'pending';
    appliedAt?: string;
    appliedFieldCount?: number;
    appliedError?: string;
  }>>().default([]), // History of all revisions
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
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
  isSync: boolean("is_sync").default(false),
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
  isSync: boolean("is_sync").default(false),
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
  apuuid: text("apuuid").notNull().unique(), // Canonical UUID identity — FK target for alert_events
  alertType: text("alert_type").notNull(), // 'maintenance_due' | 'running_hours' | 'critical_inventory' | 'certificate_expiration' | 'system_backup'
  enabled: boolean("enabled").notNull().default(true),
  priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high'
  emailEnabled: boolean("email_enabled").notNull().default(false),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  thresholds: text("thresholds").notNull().default("{}"), // JSON string for type-specific thresholds
  scopeFilters: text("scope_filters").notNull().default("{}"), // JSON string for filters
  recipients: text("recipients").notNull().default("{}"), // JSON string for recipient configuration
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  isSync: boolean("is_sync").default(false),
});

export const insertAlertPolicySchema = createInsertSchema(alertPolicies).omit({
  id: true,
  apuuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAlertPolicy = z.infer<typeof insertAlertPolicySchema>;
export type AlertPolicy = typeof alertPolicies.$inferSelect;

// Alert Events Table
export const alertEvents = pgTable("alert_events", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  aeuuid: text("aeuuid").notNull().unique(), // Canonical UUID identity — FK target for alert_deliveries
  policyId: integer("policy_id").notNull(), // Legacy integer reference — kept during transition
  policyUuid: text("policy_uuid").notNull().references(() => alertPolicies.apuuid), // FK → alert_policies.apuuid
  alertType: text("alert_type").notNull(),
  priority: text("priority").notNull(),
  objectType: text("object_type"), // 'work_order' | 'component' | 'spare' | 'certificate' | 'system'
  objectId: text("object_id"),
  vesselId: text("vessel_id").references(() => vessels.vuuid),
  dedupeKey: text("dedupe_key").notNull(),
  state: text("state"), // 'due' | 'overdue' | 'low' | 'critical' | 'expired' | 'failed' etc
  payload: text("payload").notNull(), // JSON string with all event details
  ackBy: text("ack_by"),
  ackAt: timestamp("ack_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  dedupeKeyIdx: index("idx_dedupe_key").on(table.dedupeKey, table.createdAt),
  policyIdx: index("idx_policy_events").on(table.policyId, table.createdAt),
}));

export const insertAlertEventSchema = createInsertSchema(alertEvents).omit({
  id: true,
  aeuuid: true,
  createdAt: true,
});

export type InsertAlertEvent = z.infer<typeof insertAlertEventSchema>;
export type AlertEvent = typeof alertEvents.$inferSelect;

// Alert Deliveries Table
export const alertDeliveries = pgTable("alert_deliveries", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  eventId: integer("event_id").notNull(), // Legacy integer reference — kept during transition
  eventUuid: text("event_uuid").notNull().references(() => alertEvents.aeuuid), // FK → alert_events.aeuuid
  channel: text("channel").notNull(), // 'email' | 'in_app' | 'sms' | 'slack'
  recipient: text("recipient").notNull(), // email address, user ID, phone number, etc
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed' | 'acknowledged'
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isSync: boolean("is_sync").default(false),
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
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
  quietHoursStart: text("quiet_hours_start"), // HH:mm format
  quietHoursEnd: text("quiet_hours_end"), // HH:mm format
  escalationEnabled: boolean("escalation_enabled").notNull().default(false),
  escalationHours: integer("escalation_hours").notNull().default(4),
  escalationRecipients: text("escalation_recipients").notNull().default("[]"), // JSON array of recipients
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  updatedBy: text("updated_by").notNull(),
  isSync: boolean("is_sync").default(false),
});

export const insertAlertConfigSchema = createInsertSchema(alertConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAlertConfig = z.infer<typeof insertAlertConfigSchema>;
export type AlertConfig = typeof alertConfig.$inferSelect;

// Alert Acknowledgements Table (co-acknowledgement for UC3 skipped cycles)
export const alertAcknowledgements = pgTable("alert_acknowledgements", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  aauuid: text("aauuid").notNull().unique(),
  eventUuid: text("event_uuid").notNull().references(() => alertEvents.aeuuid),
  userId: text("user_id").notNull(),
  userRole: text("user_role").notNull(),
  comments: text("comments").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAlertAcknowledgementSchema = createInsertSchema(alertAcknowledgements).omit({
  id: true,
  aauuid: true,
  createdAt: true,
});

export type InsertAlertAcknowledgement = z.infer<typeof insertAlertAcknowledgementSchema>;
export type AlertAcknowledgement = typeof alertAcknowledgements.$inferSelect;

// Jobs Table - Templates/Blueprints for maintenance jobs linked to components
// NOTE: componentId/componentCode/componentName are DEPRECATED - use jobComponentLinks table for many-to-many relationships
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  juuid: text("juuid").notNull().unique(), // Canonical UUID identity — FK target for all 4 child tables
  vesselId: text("vessel_id").references(() => vessels.vuuid),
  componentId: text("component_id").references(() => components.cuuid), // DEPRECATED: Use jobComponentLinks for many-to-many. Nullable for backward compatibility
  componentCode: text("component_code"), // DEPRECATED: Use jobComponentLinks for many-to-many
  componentName: text("component_name"), // DEPRECATED: Use jobComponentLinks for many-to-many
  jobNo: text("job_no").notNull(), // Auto-generated JOB-XXXXXXX (not globally unique - same job_no can exist across vessels/components)
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to"),
  assignedToRankId: text("assigned_to_rank_id"),
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
  jobDescription: text("job_description"), // Detailed job description
  approver: text("approver"), // Rank who approves the job
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
  estimatedManHours: decimal("estimated_man_hours", { precision: 6, scale: 2 }), // Estimated man-hours for workload planning
  
  createdBy: text("created_by"), // User who created the job
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: text("updated_by"), // User who last updated the job
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdIdx: index("idx_job_vessel").on(table.vesselId),
  componentIdIdx: index("idx_job_component").on(table.componentId),
  componentCodeIdx: index("idx_job_component_code").on(table.componentCode),
  dataScopeIdx: index("idx_job_data_scope").on(table.dataScope),
  nextDueDateIdx: index("idx_job_next_due").on(table.nextDueDate),
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
  wouuid: text("wouuid").notNull().unique(), // Canonical UUID identity — FK target for all 5 child tables
  vesselId: text("vessel_id").references(() => vessels.vuuid), // Nullable - only required when dataScope='vessel'
  component: text("component").notNull(),
  componentCode: text("component_code"),
  jobId: text("job_id").references(() => jobs.juuid), // FK → jobs.juuid for reliable lead time hydration
  workOrderNo: text("work_order_no").notNull(),
  workOrderType: text("work_order_type").notNull().default("Planned"), // 'Planned' | 'Unplanned'
  templateCode: text("template_code"),
  executionId: text("execution_id"),
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to").notNull(),
  assignedToRankId: text("assigned_to_rank_id"),
  dueDate: text("due_date"), // ISO date string, nullable for fleet jobs
  status: text("status").notNull().default("Active"), // 'Completed' | 'Due' | 'Due (Grace P)' | 'Overdue' | 'Postponed' | 'Pending Approval' | 'Active'
  dateCompleted: text("date_completed"),
  submittedDate: text("submitted_date"),
  formData: json("form_data"), // Form submission data
  taskType: text("task_type"), // 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
  maintenanceType: text("maintenance_type"), // 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
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
  // Postponement fields (Rule #5 - Postponed WO Reappearance)
  postponementEndDate: text("postponement_end_date"), // When postponement expires, WO should revert to Due status
  postponementReason: text("postponement_reason"), // Reason for postponement (structured dropdown value)
  postponementRemarks: text("postponement_remarks"), // Optional additional remarks for postponement
  postponementAuthorizedBy: text("postponement_authorized_by"), // Who authorized the postponement
  // Overdue Reason fields
  overdueReason: text("overdue_reason"), // Selected master-list value or 'Other Reason'
  overdueReasonDetails: text("overdue_reason_details"), // Free-text custom reason or additional remarks
  // On-demand WO generation fields (Rule #4)
  onDemandReason: text("on_demand_reason"), // 'Planning' | 'Breakdown' | 'Other' - for WOs generated before frequency reached
  // Work Order Form Arrays (Part A - Template)
  requiredSpareParts: json("required_spare_parts").notNull().default([]), // [{partNo, description, quantityRequired, remarks}]
  requiredTools: json("required_tools").notNull().default([]), // [{toolName, quantity, remarks}]
  safetyRequirements: json("safety_requirements").notNull().default({ppeRequirements: [], permitRequirements: [], otherRequirements: []}), // {ppeRequirements: [], permitRequirements: [], otherRequirements: []}
  // Work Order Form Arrays (Part B - Execution)
  uploadedDocuments: json("uploaded_documents").notNull().default([]), // [{type: 'riskAssessment'|'safetyChecklist'|'operationalForm', fileName, fileKey, uploadedAt, uploadedBy}]
  consumedSpareParts: json("consumed_spare_parts").notNull().default([]), // [{partNo, description, quantityConsumed, comments, location: 'A'|'B'}]
  // Part B Execution Fields (B1 - Risk Assessment, Checklists & Records)
  riskAssessmentStatus: text("risk_assessment_status"), // 'Yes' | 'No' | 'NA'
  safetyChecklistsStatus: text("safety_checklists_status"), // 'Yes' | 'No' | 'NA'
  operationalFormsStatus: text("operational_forms_status"), // 'Yes' | 'No' | 'NA'
  // Part B Execution Fields (B2 - Work Duration)
  startDateTime: text("start_date_time"), // ISO datetime string
  completionDateTime: text("completion_date_time"), // ISO datetime string
  executionAssignedTo: text("execution_assigned_to"), // Rank assigned during execution
  performedBy: text("performed_by"), // Rank who performed the work
  noOfPersons: text("no_of_persons"), // Number of persons in team
  totalTimeHours: text("total_time_hours"), // Total time taken in hours
  manhours: text("manhours"), // Manhours calculation
  workCarriedOut: text("work_carried_out"), // Description of work performed
  jobExperienceNotes: text("job_experience_notes"), // Job experience/notes
  // Part B Execution Fields (B3 - Running Hours)
  previousReading: text("previous_reading"), // Previous RH reading
  runningHours: text("running_hours"), // Current RH at completion
  runningHoursDifference: text("running_hours_difference"), // Difference between current and previous reading
  readingDate: text("reading_date"), // Date of running hours reading
  // Part B Execution Metadata
  woExecutionId: text("wo_execution_id"), // Unique execution ID (WOE-XXXXXXX)
  remarks: text("remarks"), // General remarks
  completionRemarks: text("completion_remarks"), // Remarks upon completion
  // Approval workflow fields
  rejectionComments: text("rejection_comments"), // Comments when work order is rejected by approver
  approvalAction: text("approval_action"), // 'approved' | 'rejected' - action taken by approver
  wasRejected: boolean("was_rejected").notNull().default(false), // Tracks if WO was previously rejected (for red font display)
  missedCycles: integer("missed_cycles").default(0),
  originalDueDate: text("original_due_date"),
  skippedCyclesJustification: text("skipped_cycles_justification"),

  // === Layer 5: Approval Workflow Hardening ===
  daysLate: integer("days_late").default(0),
  approvalTier: text("approval_tier").default("standard"),
  superintendentAcknowledged: boolean("superintendent_acknowledged").default(false),
  superintendentAcknowledgedAt: text("superintendent_acknowledged_at"),
  superintendentNotifiedAt: text("superintendent_notified_at"),
  ceApprovalRemarks: text("ce_approval_remarks"),
  approvalBlockReason: text("approval_block_reason"),

  // === Layer 7: Running Hours Validation & Isolation ===
  completionRH: decimal("completion_rh", { precision: 10, scale: 2 }),
  completionRHValidated: boolean("completion_rh_validated"),
  completionRHSource: text("completion_rh_source"),
  completionRHValidationDetails: jsonb("completion_rh_validation_details"),
  rhJustification: text("rh_justification"),
  rhJustificationProvidedBy: text("rh_justification_provided_by"),
  rhJustificationDate: timestamp("rh_justification_date"),

  // === WO Generation Cycle Snapshots (for duplicate protection and audit) ===
  // Driver type determines which cycle fields apply
  driverType: text("driver_type"), // 'RH' | 'CALENDAR' - from job's maintenanceBasis
  
  // RH-based WO cycle snapshots (Trigger 1)
  cycleDueRhSnapshot: decimal("cycle_due_rh_snapshot", { precision: 10, scale: 2 }), // RH_due = RH_last_done + F
  generateRhSnapshot: decimal("generate_rh_snapshot", { precision: 10, scale: 2 }), // RH_generate = RH_due - LT
  dueRhSnapshot: decimal("due_rh_snapshot", { precision: 10, scale: 2 }), // RH_due (duplicated for clarity)
  effectiveRhAtGeneration: decimal("effective_rh_at_generation", { precision: 10, scale: 2 }), // RH_effective_current at WO creation
  rhLastDoneSnapshot: decimal("rh_last_done_snapshot", { precision: 10, scale: 2 }), // RH_last_done stored at WO creation
  
  // Calendar-based WO cycle snapshots (Trigger 2)
  cycleDueDateSnapshot: text("cycle_due_date_snapshot"), // DUE_DATE = last_done_date + F_days (ISO date)
  generateDateSnapshot: text("generate_date_snapshot"), // GENERATE_DATE = DUE_DATE - LT_days (ISO date)
  dueDateSnapshot: text("due_date_snapshot"), // DUE_DATE (duplicated for clarity)
  lastDoneDateSnapshot: text("last_done_date_snapshot"), // last_done_date stored at WO creation
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdIdx: index("idx_wo_vessel").on(table.vesselId),
  statusIdx: index("idx_wo_status").on(table.status),
  dueDateIdx: index("idx_wo_due_date").on(table.dueDate),
  componentCodeIdx: index("idx_wo_component").on(table.componentCode),
  templateCodeIdx: index("idx_wo_template").on(table.templateCode),
  dataScopeIdx: index("idx_wo_data_scope").on(table.dataScope),
  fleetEquipmentCodeIdx: index("idx_wo_fleet_equipment").on(table.dataScope, table.fleetEquipmentCode),
  fleetJobCodeUniqueIdx: unique("unique_fleet_job_code_vessel").on(table.fleetJobCode, table.dataScope, table.vesselId),
  // Index for cycle-based duplicate protection (job_id + cycle_due)
  jobIdCycleRhIdx: index("idx_wo_job_cycle_rh").on(table.jobId, table.cycleDueRhSnapshot),
  jobIdCycleDateIdx: index("idx_wo_job_cycle_date").on(table.jobId, table.cycleDueDateSnapshot),
}));

export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({
  id: true,
  wouuid: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Make workOrderNo optional since backend auto-generates it for unplanned WOs
  workOrderNo: z.string().optional(),
});

export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;

// Work Order with hydrated lead time fields from jobs table
// Used by backend API endpoints that enrich work orders with job metadata
export type WorkOrderWithLeadTime = WorkOrder & {
  leadTimeValue?: number | null;
  leadTimeUnit?: string | null;
};

// === Superintendent Notifications (Layer 5) ===
export const superintendentNotifications = pgTable("superintendent_notifications", {
  id: serial("id").primaryKey(),
  workOrderId: text("work_order_id").notNull(),
  workOrderCode: text("work_order_code"),
  jobTitle: text("job_title"),
  componentName: text("component_name"),
  vesselName: text("vessel_name"),
  daysLate: integer("days_late").default(0),
  missedCycles: integer("missed_cycles").default(0),
  backdatingDays: integer("backdating_days").default(0),
  approvalTier: text("approval_tier"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  isAcknowledged: boolean("is_acknowledged").default(false),
});

export const insertSuperintendentNotificationSchema = createInsertSchema(superintendentNotifications).omit({
  id: true,
  createdAt: true,
});

export type InsertSuperintendentNotification = z.infer<typeof insertSuperintendentNotificationSchema>;
export type SuperintendentNotification = typeof superintendentNotifications.$inferSelect;

// Work Order Executions Table - for tracking historical maintenance records
export const workOrderExecutions = pgTable("work_order_executions", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => workOrders.wouuid), // FK → work_orders.wouuid (template)
  componentId: text("component_id").notNull().references(() => components.cuuid), // Component this execution belongs to
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid), // Vessel identifier
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
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
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
  duuid: text("duuid").notNull().unique(), // Canonical UUID identity — FK target for child tables
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
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
  componentId: text("component_id").references(() => components.cuuid), // Link to PMS component
  purchaseOrderRef: text("purchase_order_ref"),
  responsibleDept: text("responsible_dept"), // Responsible Dept from screenshot
  verifiedDate: text("verified_date"), // ISO format YYYY-MM-DD
  defectCategory: text("defect_category"), // Additional defect category field
  viqVersion: text("viq_version"), // VIQ VER (VIQ 7 or SIRE 2.0)
  viqRef: text("viq_ref"), // VIQ REF (e.g., 1.1, 2.3, 5.12)
  viqChapter: text("viq_chapter"), // VIQ Chapter (e.g., General Information, Safety Management)
  viqSection: text("viq_section"), // VIQ Section (detailed section within chapter)
  sfiCodeRef: text("sfi_code_ref"), // SFI Code Reference (legacy)
  sireHardwareId: text("sire_hardware_id"), // SIRE Hardware Class unique ID (e.g., SHC001)
  sireHardwareLevel1: text("sire_hardware_level1"), // SIRE Hardware Class Level 1 (e.g., HULL, SHIP EQUIPMENT)
  sireHardwareLevel2: text("sire_hardware_level2"), // SIRE Hardware Class Level 2 (e.g., Tanks, Navigation Equipment)
  sireHardwareLevel3: text("sire_hardware_level3"), // SIRE Hardware Class Level 3 (user selection, e.g., Engine Room Tanks)
  componentHardwareId: text("component_hardware_id"), // Part A Component unique ID (temporary: same as SIRE Hardware until PMS integration)
  componentHardwareLevel1: text("component_hardware_level1"), // Part A Component Level 1 (temporary: same as SIRE Hardware until PMS integration)
  componentHardwareLevel2: text("component_hardware_level2"), // Part A Component Level 2
  componentHardwareLevel3: text("component_hardware_level3"), // Part A Component Level 3 (user selection)
  immediateCause: json("immediate_cause"), // Structured immediate cause with unsafe acts and conditions
  immediateCauseExplanation: text("immediate_cause_explanation"), // Further explanation
  rootCause: json("root_cause"), // Structured root cause with individual and system factors
  rootCauseExplanation: text("root_cause_explanation"), // Further explanation
  riskLevel: text("risk_level"), // 'Low' | 'Medium' | 'High' - Risk assessment
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
  
  // New date tracking fields
  dateReportedToOffice: text("date_reported_to_office"), // ISO format YYYY-MM-DD
  dateRegisteredInSystem: text("date_registered_in_system"), // ISO format YYYY-MM-DD (SAL)
  
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
  
  // C1 Closeout fields
  closedOutByName: text("closed_out_by_name"), // Name of person who closed out
  closedOutByRank: text("closed_out_by_rank"), // Rank of person who closed out
  confirmCompleted: boolean("confirm_completed").default(false), // Confirmation checkbox
  closedByName: text("closed_by_name"), // Name of person who closed (form field)
  closedByRank: text("closed_by_rank"), // Rank of person who closed (form field)
  
  // C2 Verification fields
  verified: boolean("verified").default(false), // Verification checkbox
  dateVerified: text("date_verified"), // ISO format YYYY-MM-DD
  verifiedByName: text("verified_by_name"), // Name of verifier
  verifiedByOfficePosition: text("verified_by_office_position"), // Office position of verifier
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
  // B5 Target Date Extensions (stored inline for form wizard)
  targetDateExtensions: json("target_date_extensions").$type<Array<{
    id: string;
    existingTargetDate: string;
    newTargetDate: string;
    reasonForExtension: string;
    submitForApprovalTo: string;
    submitForApprovalToName: string;
    status: 'Requested' | 'Approved' | 'Rejected';
    approved?: boolean;
    approvalDate: string;
    approverComments: string;
    electronicConfirmation?: string;
    requestedAt: string;
  }>>().default([]),
  // Part A Attachments (stored inline for form wizard)
  partAAttachments: json("part_a_attachments").$type<Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    data: string;
    uploadedAt: string;
  }>>().default([]),
  // Attachments (stored inline for form wizard)
  attachments: json("attachments").$type<Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    data: string;
    uploadedAt: string;
  }>>().default([]),
  // Audit trail
  auditTrail: json("audit_trail").$type<Array<{
    action: string;
    userId: string;
    userName: string;
    timestamp: string;
    details?: any;
  }>>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
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
  duuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defects.$inferSelect;

// Defect Actions Table for corrective/preventive actions
export const defectActions = pgTable("defect_actions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  defectId: text("defect_id").notNull().references(() => defects.duuid),
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
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
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
  defectId: text("defect_id").notNull().references(() => defects.duuid),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  attachmentType: text("attachment_type").notNull(), // 'photo' | 'document' | 'evidence'
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  isSync: boolean("is_sync").default(false),
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
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
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
  defectId: text("defect_id").notNull().references(() => defects.duuid, { onDelete: "cascade" }),
  isSync: boolean("is_sync").default(false),
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
  vesselId: text("vessel_id").references(() => vessels.vuuid),
  created: integer("created").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  archived: integer("archived").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull(), // 'complete' | 'failed' | 'undone' | 'undo_failed'
  originalName: text("original_name"), // Original uploaded filename
  fileSize: integer("file_size"), // File size in bytes
  storedFilePath: text("stored_file_path"), // Object storage path to the uploaded file
  undoneAt: timestamp("undone_at"), // Timestamp when import was undone
  errorMessage: text("error_message"), // Error message if import or undo failed,
  isSync: boolean("is_sync").default(false),
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
  isSync: boolean("is_sync").default(false),
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
  addressId: text("address_id"), // Address identifier code
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  makerCodeIdx: index("idx_maker_code").on(table.makerCode),
  makerNameIdx: index("idx_maker_name").on(table.makerName),
}));

export const insertMakerSchema = createInsertSchema(makers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  makerCode: z.string().optional(), // Optional - auto-generated if not provided
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
  isSync: boolean("is_sync").default(false),
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

// Master List Types Table (DB-backed registry of list types, replaces hardcoded LIST_TYPES constant)
// Each type is mapped to one of 3 Sections: Components / Jobs/WO / Spares.
// is_system=true rows (seeded) cannot be deleted and their key/section cannot be changed.
export const masterListTypes = pgTable("master_list_types", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  mltuuid: text("mltuuid").notNull().unique().default(sql`gen_random_uuid()::text`),
  listTypeKey: text("list_type_key").notNull().unique(),
  label: text("label").notNull(),
  section: text("section").notNull(), // 'Components' | 'Jobs/WO' | 'Spares'
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
}, (table) => [
  index("idx_mlt_section").on(table.section),
  index("idx_mlt_active").on(table.isActive),
]);

export const insertMasterListTypeSchema = createInsertSchema(masterListTypes).omit({
  id: true,
  mltuuid: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  isSync: true,
}).extend({
  section: z.enum(["Components", "Jobs/WO", "Spares"]),
});

export type InsertMasterListType = z.infer<typeof insertMasterListTypeSchema>;
export type MasterListType = typeof masterListTypes.$inferSelect;

// Component Running Hours Log - Detailed audit trail for all running hours updates
export const componentRunningHoursLog = pgTable("component_running_hours_log", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselCode: text("vessel_code").notNull(),
  componentCode: text("component_code").notNull(),
  componentId: text("component_id").notNull().references(() => components.cuuid),
  previousRh: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
  newRh: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
  deltaRh: decimal("delta_rh", { precision: 10, scale: 2 }).notNull(), // Change in running hours (can be negative for corrections)
  updatedBy: text("updated_by").notNull(), // User ID who made the change
  updatedAt: updatedAtColumn(),
  updateSource: text("update_source").notNull(), // 'manual' | 'cascade' | 'bulk_import' | 'work_order'
  notes: text("notes"), // Optional notes for the update
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isSync: boolean("is_sync").default(false),
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
  payload: json("payload"), // Additional context (e.g., full snapshot, metadata),
  isSync: boolean("is_sync").default(false),
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
  componentId: text("component_id").notNull().references(() => components.cuuid),
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
  storageBackend: text("storage_backend").default("object"), // 'object' for cloud storage, 'local' for filesystem,
  isSync: boolean("is_sync").default(false),
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
  componentId: text("component_id").notNull().references(() => components.cuuid),
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
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
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
  componentId: text("component_id").notNull().references(() => components.cuuid),
  componentCode: text("component_code").notNull(),
  vesselCode: text("vessel_code").notNull(),
  jobId: text("job_id").references(() => jobs.juuid), // FK → jobs.juuid for Jobs Form A5 history
  jobCode: text("job_code"), // Job number for querying (e.g., MKR-IN-00001)
  workOrderId: text("work_order_id").notNull().references(() => workOrders.wouuid), // FK → work_orders.wouuid
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
  missedCycles: integer("missed_cycles").default(0),
  originalDueDate: text("original_due_date"),
  isSkipped: boolean("is_skipped").default(false),
  skippedCycleDate: text("skipped_cycle_date"),
  sourceWorkOrderId: text("source_work_order_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(), // IMMUTABLE - no updates/deletes allowed,
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  componentIdIdx: index("idx_history_component_id").on(table.componentId),
  componentCodeIdx: index("idx_history_component_code").on(table.componentCode),
  vesselCodeIdx: index("idx_history_vessel_code").on(table.vesselCode),
  jobIdIdx: index("idx_history_job_id").on(table.jobId),
  jobCodeIdx: index("idx_history_job_code").on(table.jobCode),
  workOrderIdIdx: index("idx_history_work_order_id").on(table.workOrderId),
  dateCompletedIdx: index("idx_history_date_completed").on(table.dateCompleted),
}));

export const insertComponentMaintenanceHistorySchema = createInsertSchema(componentMaintenanceHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertComponentMaintenanceHistory = z.infer<typeof insertComponentMaintenanceHistorySchema>;
export type ComponentMaintenanceHistory = typeof componentMaintenanceHistory.$inferSelect;

// Component Requisitions Table - Purchase/service requisitions linked to components and spares
export const componentRequisitions = pgTable("component_requisitions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  requisitionNo: text("requisition_no").notNull().unique(), // REQ-V001-2024-001 format
  componentId: text("component_id").notNull().references(() => components.cuuid),
  componentCode: text("component_code").notNull(),
  vesselCode: text("vessel_code").notNull(),
  raisedOn: text("raised_on").notNull(), // DD-MMM-YYYY format
  itemOrService: text("item_or_service").notNull(), // Description of item or service requested
  relatedPartCode: text("related_part_code"), // Link to spare part code from Section E
  relatedPartName: text("related_part_name"), // Spare part name for display
  quantity: integer("quantity").notNull().default(1),
  uom: text("uom").default("EA"), // Unit of measure
  status: text("status").notNull().default("Draft"), // 'Draft' | 'Submitted' | 'RFQ Sent' | 'PO Raised' | 'Ordered' | 'Delivered On Board' | 'Cancelled'
  priority: text("priority").notNull().default("Normal"), // 'Normal' | 'Urgent' | 'Critical'
  requestedBy: text("requested_by").notNull(),
  approvedBy: text("approved_by"),
  approvalDate: text("approval_date"),
  purchaseOrderNo: text("purchase_order_no"), // PO reference once raised
  expectedDelivery: text("expected_delivery"), // Expected delivery date
  actualDelivery: text("actual_delivery"), // Actual delivery date
  supplier: text("supplier"), // Selected supplier
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  componentIdIdx: index("idx_req_component_id").on(table.componentId),
  componentCodeIdx: index("idx_req_component_code").on(table.componentCode),
  vesselCodeIdx: index("idx_req_vessel_code").on(table.vesselCode),
  statusIdx: index("idx_req_status").on(table.status),
  requisitionNoIdx: index("idx_req_no").on(table.requisitionNo),
}));

export const insertComponentRequisitionSchema = createInsertSchema(componentRequisitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComponentRequisition = z.infer<typeof insertComponentRequisitionSchema>;
export type ComponentRequisition = typeof componentRequisitions.$inferSelect;

// PMS Vessel Settings - Per-vessel Lead Time & Grace Period configuration
// Controls WO auto-generation timing and status transitions
export const pmsVesselSettings = pgTable("pms_vessel_settings", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().unique().references(() => vessels.vuuid),

  settingsMode: text("settings_mode").notNull().default("COMPANY_STANDARD"),

  calendarLeadDaysCritical: integer("calendar_lead_days_critical").notNull().default(7),
  calendarLeadDaysNonCritical: integer("calendar_lead_days_non_critical").notNull().default(14),
  calendarGraceMode: text("calendar_grace_mode").notNull().default("COMPANY_STANDARD"),
  calendarGraceDays: integer("calendar_grace_days").notNull().default(7),
  calendarGraceMethod: text("calendar_grace_method").notNull().default("FIXED_DAYS"),
  calendarGraceValue: integer("calendar_grace_value").notNull().default(7),
  calendarGraceScope: text("calendar_grace_scope").notNull().default("ALL_WORK_ORDERS"),
  calendarFallbackMethod: text("calendar_fallback_method"),
  calendarFallbackGraceDays: integer("calendar_fallback_grace_days"),

  rhLeadHoursCritical: integer("rh_lead_hours_critical").notNull().default(50),
  rhLeadHoursNonCritical: integer("rh_lead_hours_non_critical").notNull().default(100),
  rhGraceHours: integer("rh_grace_hours").notNull().default(168),
  rhGraceMethod: text("rh_grace_method").notNull().default("FIXED_HOURS"),
  rhGraceValue: integer("rh_grace_value").notNull().default(168),
  rhGraceScope: text("rh_grace_scope").notNull().default("ALL_WORK_ORDERS"),
  rhFallbackMethod: text("rh_fallback_method"),
  rhFallbackGraceHours: integer("rh_fallback_grace_hours"),

  locationAName: text("location_a_name").notNull().default("Location A"),
  locationBName: text("location_b_name").notNull().default("Location B"),

  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdIdx: index("idx_pms_settings_vessel_id").on(table.vesselId),
}));

export const insertPmsVesselSettingsSchema = createInsertSchema(pmsVesselSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPmsVesselSettings = z.infer<typeof insertPmsVesselSettingsSchema>;
export type PmsVesselSettings = typeof pmsVesselSettings.$inferSelect;

// =====================================================
// COMPANY STANDARD GRACE SETTINGS - Singleton company-wide grace rule
// Defines the default calendar-based grace period logic for all vessels
// using Company Standard mode. Only one active row allowed.
// =====================================================
export const companyStandardGraceSettings = pgTable("company_standard_grace_settings", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  singletonKey: text("singleton_key").notNull().unique().default("ACTIVE"),

  graceMethod: text("grace_method").notNull().default("FIXED_DAYS"),
  graceValue: integer("grace_value").default(7),
  scope: text("scope").notNull().default("LAST_WEEK_OF_MONTH"),
  fallbackGraceDays: integer("fallback_grace_days"),
  fallbackMethod: text("fallback_method").default("MONTH_END"),

  calendarLeadDaysCritical: integer("calendar_lead_days_critical").notNull().default(7),
  calendarLeadDaysNonCritical: integer("calendar_lead_days_non_critical").notNull().default(14),
  rhLeadHoursCritical: integer("rh_lead_hours_critical").notNull().default(720),
  rhLeadHoursNonCritical: integer("rh_lead_hours_non_critical").notNull().default(720),
  rhGraceHours: integer("rh_grace_hours").notNull().default(168),

  rhGraceMethod: text("rh_grace_method").notNull().default("FIXED_HOURS"),
  rhGraceValue: integer("rh_grace_value").notNull().default(168),
  rhGraceScope: text("rh_grace_scope").notNull().default("ALL_WORK_ORDERS"),
  rhFallbackMethod: text("rh_fallback_method"),
  rhFallbackGraceHours: integer("rh_fallback_grace_hours"),

  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
});

export const insertCompanyStandardGraceSettingsSchema = createInsertSchema(companyStandardGraceSettings).omit({
  id: true,
  singletonKey: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompanyStandardGraceSettings = z.infer<typeof insertCompanyStandardGraceSettingsSchema>;
export type CompanyStandardGraceSettings = typeof companyStandardGraceSettings.$inferSelect;

export type CompanyGraceMethod = 'FIXED_DAYS' | 'MONTH_END' | 'SPECIFIC_DATE_NEXT_MONTH';
export type CompanyGraceScope = 'ALL_WORK_ORDERS' | 'LAST_WEEK_OF_MONTH';

// =====================================================
// MAKER LIST - Master data for equipment manufacturers
// Linked with fleet components, vessel components, fleet spares, vessel spares
// =====================================================
export const makerList = pgTable("maker_list", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  makerListUuid: text("maker_list_uuid").default(sql`gen_random_uuid()`),
  makerCode: text("maker_code").notNull().unique(),
  makerName: text("maker_name").notNull(),
  address: text("address"),
  addressId: text("address_id"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  makerCodeIdx: index("idx_maker_list_code").on(table.makerCode),
  makerNameIdx: index("idx_maker_list_name").on(table.makerName),
  makerListUuidIdx: index("idx_maker_list_uuid").on(table.makerListUuid),
}));

export const insertMakerListSchema = createInsertSchema(makerList).omit({
  id: true,
  makerListUuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMakerList = z.infer<typeof insertMakerListSchema>;
export type MakerList = typeof makerList.$inferSelect;

// =====================================================
// FLEET COMPONENTS - Fleet Equipment Master Data
// Stores fleet-level component hierarchy for bulk import
// Excel Headers: Parent Fleet Equipment Code, Fleet Equipment Code, Fleet Equipment Name,
// Component Category, Maker Name, Maker Code, Model, Model Code, Location, Rating,
// Eqpt / System Department, Notes, IS Active
// =====================================================
export const fleetComponents = pgTable("fleet_components", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetComponentsUuid: text("fleet_components_uuid").default(sql`gen_random_uuid()`),
  parentFleetEquipmentCode: text("parent_fleet_equipment_code"),
  fleetEquipmentCode: text("fleet_equipment_code").notNull().unique(),
  fleetEquipmentName: text("fleet_equipment_name").notNull(),
  componentCategory: text("component_category"),
  makerName: text("maker_name"),
  makerCode: text("maker_code"),
  model: text("model"),
  modelCode: text("model_code"),
  location: text("location"),
  rating: text("rating"),
  eqptSystemDept: text("eqpt_system_dept"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  fleetEquipmentCodeIdx: index("idx_fleet_components_code").on(table.fleetEquipmentCode),
  parentCodeIdx: index("idx_fleet_components_parent").on(table.parentFleetEquipmentCode),
  fleetComponentsUuidIdx: uniqueIndex("idx_fleet_components_uuid").on(table.fleetComponentsUuid),
  makerCodeIdx: index("idx_fleet_components_maker").on(table.makerCode),
}));

export const insertFleetComponentsSchema = createInsertSchema(fleetComponents).omit({
  id: true,
  fleetComponentsUuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFleetComponents = z.infer<typeof insertFleetComponentsSchema>;
export type FleetComponents = typeof fleetComponents.$inferSelect;

// =====================================================
// FLEET JOBS - Fleet-level job master data
// Stores fleet-wide job templates imported via Bulk Data Import
// Distinct from vessel-level `jobs` table which holds vessel-specific instances
// =====================================================
export const fleetJobs = pgTable("fleet_jobs", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetJobsUuid: text("fleet_jobs_uuid").default(sql`gen_random_uuid()`),
  jobCode: text("job_code").notNull(),
  fleetComponentsUuid: text("fleet_components_uuid"),
  fleetEquipmentCode: text("fleet_equipment_code").notNull(),
  fleetEquipmentName: text("fleet_equipment_name").notNull(),
  woTitle: text("wo_title").notNull(),
  maintenanceBasis: text("maintenance_basis"),
  intervalValue: text("interval_value"),
  unit: text("unit"),
  taskType: text("task_type").notNull(),
  assignedTo: text("assigned_to").notNull(),
  approver: text("approver").notNull(),
  jobPriority: text("job_priority").notNull(),
  classRelated: text("class_related").notNull(),
  briefWorkDescription: text("brief_work_description").notNull(),
  department: text("department").notNull(),
  criticality: text("criticality").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  requiredSpareParts: json("required_spare_parts").default([]),
  requiredTools: json("required_tools").default([]),
  ppeRequirements: text("ppe_requirements"),
  permitRequirements: text("permit_requirements"),
  otherSafetyRequirements: text("other_safety_requirements"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  jobCodeIdx: index("idx_fleet_jobs_code").on(table.jobCode),
  fleetEquipmentCodeIdx: index("idx_fleet_jobs_equipment").on(table.fleetEquipmentCode),
  fleetJobsUuidIdx: uniqueIndex("idx_fleet_jobs_uuid").on(table.fleetJobsUuid),
  fleetComponentsUuidIdx: index("idx_fleet_jobs_component_uuid").on(table.fleetComponentsUuid),
}));

export const insertFleetJobsSchema = createInsertSchema(fleetJobs).omit({
  id: true,
  fleetJobsUuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFleetJobs = z.infer<typeof insertFleetJobsSchema>;
export type FleetJobs = typeof fleetJobs.$inferSelect;

// =====================================================
// FLEET SPARES - Fleet-level spare parts master data
// Stores fleet-wide spare part templates imported via Bulk Data Import
// Distinct from vessel-level `spares` table which holds vessel-specific instances
// =====================================================
export const fleetSpares = pgTable("fleet_spares", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetSparesUuid: text("fleet_spares_uuid").default(sql`gen_random_uuid()`),
  fleetComponentsUuid: text("fleet_components_uuid"),
  partCode: text("part_code").notNull(),
  fleetEquipmentCode: text("fleet_equipment_code").notNull(),
  fleetEquipmentName: text("fleet_equipment_name").notNull(),
  partName: text("part_name").notNull(),
  partNumber: text("part_number"),
  unitOfMeasurement: text("unit_of_measurement").notNull(),
  drawingNumber: text("drawing_number"),
  positionNumber: text("position_number"),
  note: text("note"),
  specification: text("specification"),
  maker: text("maker"),
  makerCode: text("maker_code"),
  manualName: text("manual_name"),
  pageNumber: text("page_number"),
  criticality: text("criticality"),
  isActive: boolean("is_active").notNull().default(true),
  ihm: text("ihm"),
  evidenceType: text("evidence_type"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  partCodeIdx: index("idx_fleet_spares_part_code").on(table.partCode),
  fleetEquipmentCodeIdx: index("idx_fleet_spares_equipment").on(table.fleetEquipmentCode),
  fleetSparesUuidIdx: uniqueIndex("idx_fleet_spares_uuid").on(table.fleetSparesUuid),
  fleetComponentsUuidIdx: index("idx_fleet_spares_component_uuid").on(table.fleetComponentsUuid),
}));

export const insertFleetSparesSchema = createInsertSchema(fleetSpares).omit({
  id: true,
  fleetSparesUuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFleetSpares = z.infer<typeof insertFleetSparesSchema>;
export type FleetSpares = typeof fleetSpares.$inferSelect;

// =====================================================
// SFI DETAILS - SFI Code lookup table
// Used for standardizing component codes across fleet
// =====================================================
export const sfiDetails = pgTable("sfi_details", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentCode: text("component_code").notNull().unique(), // SFI component code (e.g., 711.001)
  componentName: text("component_name").notNull(), // Standard SFI name
  description: text("description"), // Additional description
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  sfiCodeIdx: index("idx_sfi_component_code").on(table.componentCode),
}));

export const insertSfiDetailsSchema = createInsertSchema(sfiDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSfiDetails = z.infer<typeof insertSfiDetailsSchema>;
export type SfiDetails = typeof sfiDetails.$inferSelect;

// =====================================================
// MASTER DATA - Fleet Equipment Code generation and tracking
// Central sheet for generating Fleet Equipment Codes from Maker + Model + SFI
// =====================================================
export const masterData = pgTable("master_data", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  slNo: integer("sl_no"), // Serial number for tracking
  makerName: text("maker_name").notNull(), // Manufacturer name from Maker List
  makerCode: text("maker_code").notNull(), // Unique code from Maker List
  countMaker: integer("count_maker"), // Internal counter for maker grouping
  model: text("model").notNull(), // Model name/number from manufacturer
  modelCode: text("model_code").notNull(), // Combination of Maker Code + Model
  countSfiCode: integer("count_sfi_code"), // Counter for SFI codes
  fleetEquipmentCode: text("fleet_equipment_code").notNull().unique(), // System-generated: SFI.SEQ (e.g., 722.001.AA)
  sfiCode: text("sfi_code").notNull(), // 7-digit SFI classification code
  assignedSubCode: text("assigned_sub_code"), // Sub-code under SFI for finer grouping
  vesselName: text("vessel_name"), // Vessel where equipment was first created
  vesselCode: text("vessel_code"), // Vessel code
  equipmentName: text("equipment_name").notNull(), // Descriptive name of equipment
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  fleetEquipmentCodeIdx: index("idx_master_data_fleet_code").on(table.fleetEquipmentCode),
  sfiCodeIdx: index("idx_master_data_sfi").on(table.sfiCode),
  makerCodeIdx: index("idx_master_data_maker").on(table.makerCode),
  modelCodeIdx: index("idx_master_data_model").on(table.modelCode),
}));

export const insertMasterDataSchema = createInsertSchema(masterData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMasterData = z.infer<typeof insertMasterDataSchema>;
export type MasterData = typeof masterData.$inferSelect;


// =====================================================
// FLEET VESSEL MAPPING - Links Fleet Equipment Codes to Vessels
// Controls which vessels have access to which fleet equipment
// =====================================================
export const fleetVesselMapping = pgTable("fleet_vessel_mapping", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetEquipmentCode: text("fleet_equipment_code").notNull(), // From masterData or components
  vesselCode: text("vessel_code").notNull(), // Vessel identifier
  vesselName: text("vessel_name"), // Vessel display name
  mappedBy: text("mapped_by").notNull(), // User who created mapping
  mappedAt: timestamp("mapped_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  fleetCodeIdx: index("idx_fleet_vessel_mapping_fleet").on(table.fleetEquipmentCode),
  vesselCodeIdx: index("idx_fleet_vessel_mapping_vessel").on(table.vesselCode),
  uniqueMapping: unique("unique_fleet_vessel_mapping").on(table.fleetEquipmentCode, table.vesselCode),
}));

export const insertFleetVesselMappingSchema = createInsertSchema(fleetVesselMapping).omit({
  id: true,
  mappedAt: true,
});

export type InsertFleetVesselMapping = z.infer<typeof insertFleetVesselMappingSchema>;
export type FleetVesselMapping = typeof fleetVesselMapping.$inferSelect;

// =====================================================
// FLEET COMPONENT MAPPING - Links Fleet Equipment to Vessel Components
// Maps a Fleet Equipment Code to specific vessel component codes
// =====================================================
export const fleetComponentMapping = pgTable("fleet_component_mapping", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetEquipmentCode: text("fleet_equipment_code").notNull(), // Fleet equipment identifier
  vesselCode: text("vessel_code").notNull(), // Vessel identifier
  componentCode: text("component_code").notNull(), // Vessel-specific component code
  componentId: text("component_id").references(() => components.cuuid), // Reference to components table
  componentName: text("component_name"), // Display name
  mappedBy: text("mapped_by").notNull(), // User who created mapping
  mappedAt: timestamp("mapped_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  fleetCodeIdx: index("idx_fleet_comp_mapping_fleet").on(table.fleetEquipmentCode),
  vesselCodeIdx: index("idx_fleet_comp_mapping_vessel").on(table.vesselCode),
  componentCodeIdx: index("idx_fleet_comp_mapping_component").on(table.componentCode),
  uniqueMapping: unique("unique_fleet_comp_vessel_component").on(table.fleetEquipmentCode, table.vesselCode, table.componentCode),
}));

export const insertFleetComponentMappingSchema = createInsertSchema(fleetComponentMapping).omit({
  id: true,
  mappedAt: true,
});

export type InsertFleetComponentMapping = z.infer<typeof insertFleetComponentMappingSchema>;
export type FleetComponentMapping = typeof fleetComponentMapping.$inferSelect;

// =====================================================
// FLEET JOB VESSEL MAPPING - Links Fleet Jobs to Vessels
// Controls which vessels have access to which fleet jobs
// =====================================================
export const fleetJobVesselMapping = pgTable("fleet_job_vessel_mapping", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetEquipmentCode: text("fleet_equipment_code").notNull(), // Equipment the job belongs to
  jobCode: text("job_code").notNull(), // Fleet job code
  jobId: text("job_id").references(() => jobs.juuid), // FK → jobs.juuid
  vesselCode: text("vessel_code").notNull(), // Vessel identifier
  vesselName: text("vessel_name"), // Vessel display name
  mappedBy: text("mapped_by").notNull(), // User who created mapping
  mappedAt: timestamp("mapped_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  fleetCodeIdx: index("idx_fleet_job_mapping_fleet").on(table.fleetEquipmentCode),
  jobCodeIdx: index("idx_fleet_job_mapping_job").on(table.jobCode),
  vesselCodeIdx: index("idx_fleet_job_mapping_vessel").on(table.vesselCode),
}));

export const insertFleetJobVesselMappingSchema = createInsertSchema(fleetJobVesselMapping).omit({
  id: true,
  mappedAt: true,
});

export type InsertFleetJobVesselMapping = z.infer<typeof insertFleetJobVesselMappingSchema>;
export type FleetJobVesselMapping = typeof fleetJobVesselMapping.$inferSelect;

// =====================================================
// FLEET SPARE VESSEL MAPPING - Links Fleet Spares to Vessels
// Controls which vessels have access to which fleet spares
// =====================================================
export const fleetSpareVesselMapping = pgTable("fleet_spare_vessel_mapping", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fleetEquipmentCode: text("fleet_equipment_code").notNull(), // Equipment the spare belongs to
  partCode: text("part_code").notNull(), // Fleet spare part code
  spareId: text("spare_id"), // Reference to spares table
  vesselCode: text("vessel_code").notNull(), // Vessel identifier
  vesselName: text("vessel_name"), // Vessel display name
  mappedBy: text("mapped_by").notNull(), // User who created mapping
  mappedAt: timestamp("mapped_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  fleetCodeIdx: index("idx_fleet_spare_mapping_fleet").on(table.fleetEquipmentCode),
  partCodeIdx: index("idx_fleet_spare_mapping_part").on(table.partCode),
  vesselCodeIdx: index("idx_fleet_spare_mapping_vessel").on(table.vesselCode),
}));

export const insertFleetSpareVesselMappingSchema = createInsertSchema(fleetSpareVesselMapping).omit({
  id: true,
  mappedAt: true,
});

export type InsertFleetSpareVesselMapping = z.infer<typeof insertFleetSpareVesselMappingSchema>;
export type FleetSpareVesselMapping = typeof fleetSpareVesselMapping.$inferSelect;

// =====================================================
// BULK IMPORT HISTORY - Tracks all bulk import operations
// Audit trail for all Excel/CSV bulk imports
// =====================================================
export const bulkImportHistory = pgTable("bulk_import_history", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  biuuid: text("biuuid").notNull().unique(), // Canonical UUID identity — FK target for bulk_import_errors
  vesselCode: text("vessel_code"), // Null for fleet-level imports
  vesselName: text("vessel_name"),
  moduleType: text("module_type").notNull(), // 'Machinery' | 'Jobs' | 'Spares' | 'Stores' | 'Fleet_Component' | 'Fleet_Job' | 'Fleet_Spare'
  sheetName: text("sheet_name"), // Which sheet was imported (for multi-sheet templates)
  fileName: text("file_name").notNull(), // Original file name
  fileSize: integer("file_size"), // File size in bytes
  uploadedBy: text("uploaded_by").notNull(), // User who uploaded
  uploadedByName: text("uploaded_by_name"), // User display name
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  totalRows: integer("total_rows").notNull().default(0), // Total data rows in file
  successCount: integer("success_count").notNull().default(0), // Successfully imported
  failedCount: integer("failed_count").notNull().default(0), // Failed rows
  skippedCount: integer("skipped_count").notNull().default(0), // Skipped (duplicates, etc.)
  status: text("status").notNull().default("Processing"), // 'Processing' | 'Completed' | 'Failed' | 'Partial'
  errorSummary: text("error_summary"), // Brief summary of errors
  isFleetImport: boolean("is_fleet_import").notNull().default(false), // True if Fleet Data Import mode
  templateVersion: text("template_version"), // Version of template used
  processingTimeMs: integer("processing_time_ms"), // How long import took,
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselCodeIdx: index("idx_bulk_import_vessel").on(table.vesselCode),
  moduleTypeIdx: index("idx_bulk_import_module").on(table.moduleType),
  uploadedAtIdx: index("idx_bulk_import_date").on(table.uploadedAt),
  statusIdx: index("idx_bulk_import_status").on(table.status),
}));

export const insertBulkImportHistorySchema = createInsertSchema(bulkImportHistory).omit({
  id: true,
  biuuid: true,
  uploadedAt: true,
});

export type InsertBulkImportHistory = z.infer<typeof insertBulkImportHistorySchema>;
export type BulkImportHistory = typeof bulkImportHistory.$inferSelect;

// =====================================================
// BULK IMPORT ERRORS - Detailed error log for bulk imports
// Tracks each row-level error with recommended fixes
// =====================================================
export const bulkImportErrors = pgTable("bulk_import_errors", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  importId: integer("import_id").notNull(), // Legacy integer reference — kept during transition
  importUuid: text("import_uuid").notNull()
    .references(() => bulkImportHistory.biuuid), // FK → bulk_import_history.biuuid
  rowNumber: integer("row_number").notNull(), // Row number in Excel (1-indexed)
  fieldName: text("field_name"), // Which field had the error
  fieldValue: text("field_value"), // Value that caused error
  errorType: text("error_type").notNull(), // 'Required' | 'Format' | 'Duplicate' | 'Reference' | 'Validation'
  errorDescription: text("error_description").notNull(), // Human-readable error message
  recommendedFix: text("recommended_fix"), // Suggested solution
  severity: text("severity").notNull().default("Error"), // 'Error' | 'Warning' | 'Info'
  rawRowData: json("raw_row_data"), // Original row data for debugging
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  importIdIdx: index("idx_bulk_error_import").on(table.importId),
  rowNumberIdx: index("idx_bulk_error_row").on(table.importId, table.rowNumber),
  errorTypeIdx: index("idx_bulk_error_type").on(table.errorType),
}));

export const insertBulkImportErrorSchema = createInsertSchema(bulkImportErrors).omit({
  id: true,
  createdAt: true,
});

export type InsertBulkImportError = z.infer<typeof insertBulkImportErrorSchema>;
export type BulkImportError = typeof bulkImportErrors.$inferSelect;

// =====================================================
// CERTIFICATES - Vessel statutory and class certificates
// =====================================================
export const certificates = pgTable("certificates", {
  id: text("id").primaryKey(), // Certificate ID like C1, C2, etc.
  certificateName: text("certificate_name").notNull(),
  type: text("type").notNull(), // 'Flag' | 'Class' | 'Statutory'
  vessel: text("vessel").notNull(), // Vessel name
  vesselId: text("vessel_id").references(() => vessels.vuuid), // Optional vessel ID reference
  issueDate: text("issue_date"), // DD MMM YYYY format
  expiryDate: text("expiry_date"), // DD MMM YYYY format
  lastAnnual: text("last_annual"), // DD MMM YYYY format
  lastInterm: text("last_interm"), // DD MMM YYYY format (Interim)
  endorsementDate: text("endorsement_date"), // DD MMM YYYY format
  lastEditUpload: text("last_edit_upload"), // DD MMM YYYY format
  applicable: boolean("applicable").notNull().default(true),
  attachments: json("attachments").$type<any[]>().default([]), // Array of file attachments
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdx: index("idx_certificates_vessel").on(table.vessel),
  typeIdx: index("idx_certificates_type").on(table.type),
  expiryIdx: index("idx_certificates_expiry").on(table.expiryDate),
}));

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificates.$inferSelect;

// =====================================================
// SURVEYS - Vessel survey schedules and records
// =====================================================
export const surveys = pgTable("surveys", {
  id: text("id").primaryKey(), // Survey ID like S1, S2, etc.
  surveyName: text("survey_name").notNull(),
  type: text("type").notNull(), // 'Annual' | 'Int' (Intermediate) | 'Special' | 'Renewal'
  vessel: text("vessel").notNull(), // Vessel name
  vesselId: text("vessel_id").references(() => vessels.vuuid), // Optional vessel ID reference
  surveyDate: text("survey_date"), // DD MMM YYYY format - Last survey date
  dueDate: text("due_date"), // DD MMM YYYY format - Next due date
  firstRangeDate: text("first_range_date"), // DD MMM YYYY format - Window start
  secondRangeDate: text("second_range_date"), // DD MMM YYYY format - Window end
  postponed: text("postponed"), // DD MMM YYYY format - Postponed date if any
  lastEdit: text("last_edit"), // DD MMM YYYY format - Last modification date
  applicable: boolean("applicable").notNull().default(true),
  attachments: json("attachments").$type<any[]>().default([]), // Array of file attachments
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdx: index("idx_surveys_vessel").on(table.vessel),
  typeIdx: index("idx_surveys_type").on(table.type),
  dueDateIdx: index("idx_surveys_due").on(table.dueDate),
}));

export const insertSurveySchema = createInsertSchema(surveys).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type Survey = typeof surveys.$inferSelect;

// =====================================================
// WORK ORDER EXECUTIONS - Detailed execution records
// =====================================================
export const workOrderExecutionDetails = pgTable("work_order_execution_details", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.wouuid), // FK → work_orders.wouuid
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  executedBy: text("executed_by"), // User who performed the work
  executedDate: text("executed_date"), // DD-MMM-YYYY format
  completionNotes: text("completion_notes"),
  partsUsed: json("parts_used").$type<any[]>().default([]), // Array of parts consumed
  toolsUsed: json("tools_used").$type<any[]>().default([]), // Array of tools used
  laborHours: decimal("labor_hours", { precision: 6, scale: 2 }),
  findings: text("findings"), // Observations during execution
  recommendations: text("recommendations"),
  nextActionRequired: text("next_action_required"),
  qualityCheckBy: text("quality_check_by"),
  qualityCheckDate: text("quality_check_date"),
  qualityCheckNotes: text("quality_check_notes"),
  attachments: json("attachments").$type<any[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  workOrderIdx: index("idx_exec_details_wo").on(table.workOrderId),
  vesselIdx: index("idx_exec_details_vessel").on(table.vesselId),
  executedDateIdx: index("idx_exec_details_date").on(table.executedDate),
}));

export const insertWorkOrderExecutionDetailsSchema = createInsertSchema(workOrderExecutionDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrderExecutionDetails = z.infer<typeof insertWorkOrderExecutionDetailsSchema>;
export type WorkOrderExecutionDetails = typeof workOrderExecutionDetails.$inferSelect;

// =====================================================
// INVENTORY MANAGEMENT - Locations, Stock, Transactions
// =====================================================

// Inventory Event Types Enum
export const inventoryEventTypeEnum = pgEnum("inventory_event_type", [
  "RECEIVE",
  "CONSUME", 
  "ADJUST_OPENING_BALANCE",
  "ADJUST_CORRECTION"
]);

// Inventory Reference Types Enum
export const inventoryReferenceTypeEnum = pgEnum("inventory_reference_type", [
  "WORK_ORDER",
  "MANUAL",
  "EXCEL_IMPORT"
]);

// IHM Presence Enum
export const ihmPresenceEnum = pgEnum("ihm_presence", ["YES", "NO", "UNKNOWN"]);

// IHM Evidence Type Enum  
export const ihmEvidenceTypeEnum = pgEnum("ihm_evidence_type", ["NONE", "DOC", "CERT", "MSDS", "OTHER"]);

// B4) LOCATIONS - Location registry for SIRE mapping
export const locations = pgTable("locations", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  locationName: text("location_name").notNull(), // Unique per vessel, trimmed + case-normalized
  locationType: text("location_type"), // STORE/LOCKER/BOX/etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselLocationIdx: index("idx_location_vessel").on(table.vesselId),
  uniqueVesselLocation: unique("unique_vessel_location").on(table.vesselId, table.locationName),
}));

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// B3) SPARE_COMPONENT_LINKS - Many-to-many linking between spares and components
export const spareComponentLinks = pgTable("spare_component_links", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  spareId: integer("spare_id").notNull(), // Legacy integer FK — kept during transition
  spareUuid: text("spare_uuid").notNull().references(() => spares.suuid), // FK → spares.suuid
  componentId: text("component_id").notNull().references(() => components.cuuid), // FK → components.cuuid
  linkedBy: text("linked_by").notNull(),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  spareIdIdx: index("idx_spare_component_link_spare").on(table.spareId),
  componentIdIdx: index("idx_spare_component_link_component").on(table.componentId),
  vesselIdIdx: index("idx_spare_component_link_vessel").on(table.vesselId),
  uniqueSpareComponent: unique("unique_spare_component_link").on(table.spareId, table.componentId, table.vesselId),
}));

export const insertSpareComponentLinkSchema = createInsertSchema(spareComponentLinks).omit({
  id: true,
  linkedAt: true,
});

export type InsertSpareComponentLink = z.infer<typeof insertSpareComponentLinkSchema>;
export type SpareComponentLink = typeof spareComponentLinks.$inferSelect;

// B5) SPARE_LOCATION_STOCK - Current stock per spare per location
export const spareLocationStock = pgTable("spare_location_stock", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  spareId: integer("spare_id").notNull(), // Legacy integer FK — kept during transition
  spareUuid: text("spare_uuid").notNull().references(() => spares.suuid), // FK → spares.suuid
  locationId: integer("location_id").notNull(), // FK → locations.id
  qty: integer("qty").notNull().default(0), // Must never go negative,
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  spareIdIdx: index("idx_spare_location_stock_spare").on(table.spareId),
  locationIdIdx: index("idx_spare_location_stock_location").on(table.locationId),
  vesselIdIdx: index("idx_spare_location_stock_vessel").on(table.vesselId),
  uniqueSpareLocation: unique("unique_spare_location_stock").on(table.spareId, table.locationId),
}));

export const insertSpareLocationStockSchema = createInsertSchema(spareLocationStock).omit({
  id: true,
});

export type InsertSpareLocationStock = z.infer<typeof insertSpareLocationStockSchema>;
export type SpareLocationStock = typeof spareLocationStock.$inferSelect;

// B6) INVENTORY_TRANSACTIONS - Single source of truth for history
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  txnDatetime: timestamp("txn_datetime").notNull().defaultNow(),
  spareId: integer("spare_id").notNull(), // Legacy integer FK — kept during transition
  spareUuid: text("spare_uuid").notNull().references(() => spares.suuid), // FK → spares.suuid
  locationId: integer("location_id"), // Nullable only if non-location specific; for consume/receive MUST set
  eventType: text("event_type").notNull(), // RECEIVE | CONSUME | ADJUST_OPENING_BALANCE | ADJUST_CORRECTION
  qtyChange: integer("qty_change").notNull(), // Positive for receive, negative for consume
  robTotalBefore: integer("rob_total_before").notNull(),
  robTotalAfter: integer("rob_total_after").notNull(),
  robLocationBefore: integer("rob_location_before"), // Nullable if non-location specific
  robLocationAfter: integer("rob_location_after"), // Nullable if non-location specific
  referenceType: text("reference_type").notNull(), // WORK_ORDER | MANUAL | EXCEL_IMPORT
  referenceId: text("reference_id"), // WO number, import batch id, etc.
  referenceNote: text("reference_note"), // Free text
  userId: text("user_id").notNull(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdIdx: index("idx_inventory_txn_vessel").on(table.vesselId),
  spareIdIdx: index("idx_inventory_txn_spare").on(table.spareId),
  locationIdIdx: index("idx_inventory_txn_location").on(table.locationId),
  txnDatetimeIdx: index("idx_inventory_txn_datetime").on(table.txnDatetime),
  eventTypeIdx: index("idx_inventory_txn_event").on(table.eventType),
  referenceTypeIdx: index("idx_inventory_txn_ref_type").on(table.referenceType),
}));

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({
  id: true,
  txnDatetime: true,
});

export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;

// Event type constants for validation
export const INVENTORY_EVENT_TYPES = ["RECEIVE", "CONSUME", "ADJUST_OPENING_BALANCE", "ADJUST_CORRECTION"] as const;
export const INVENTORY_REFERENCE_TYPES = ["WORK_ORDER", "MANUAL", "EXCEL_IMPORT"] as const;
export const IHM_PRESENCE_VALUES = ["YES", "NO", "UNKNOWN"] as const;
export const IHM_EVIDENCE_TYPES = ["NONE", "DOC", "CERT", "MSDS", "OTHER"] as const;

export type InventoryEventType = typeof INVENTORY_EVENT_TYPES[number];
export type InventoryReferenceType = typeof INVENTORY_REFERENCE_TYPES[number];
export type IhmPresence = typeof IHM_PRESENCE_VALUES[number];
export type IhmEvidenceType = typeof IHM_EVIDENCE_TYPES[number];

// Zod schemas for validation
export const inventoryTransactionInputSchema = z.object({
  vesselId: z.string(),
  spareId: z.number(),
  locationId: z.number().optional(),
  eventType: z.enum(INVENTORY_EVENT_TYPES),
  qtyChange: z.number(),
  referenceType: z.enum(INVENTORY_REFERENCE_TYPES),
  referenceId: z.string().optional(),
  referenceNote: z.string().optional(),
  userId: z.string(),
});

export type InventoryTransactionInput = z.infer<typeof inventoryTransactionInputSchema>;

// Response type for spare with calculated ROB and stock status
export type SpareWithInventory = {
  spare: Spare;
  robTotal: number;
  stockStatus: "OK" | "At Min";
  locations: Array<{
    locationId: number;
    locationName: string;
    qty: number;
  }>;
  linkedComponents: Array<{
    componentId: string;
    componentCode: string;
    componentName: string;
  }>;
};

// B7) JOB_COMPONENT_LINKS - Many-to-many linking between jobs and components
// Allows same job to be shared across multiple components
// IMPORTANT: Contains component-specific tracking fields to prevent data mixing between components
export const jobComponentLinks = pgTable("job_component_links", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  jobId: text("job_id").notNull().references(() => jobs.juuid), // FK → jobs.juuid
  componentId: text("component_id").notNull().references(() => components.cuuid), // FK → components.cuuid
  componentCode: text("component_code"), // Denormalized for faster lookups
  linkedBy: text("linked_by").notNull(),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  // Component-specific tracking fields (isolated per component, not shared)
  lastDoneDate: text("last_done_date"), // Last completion date for THIS component (DD-MMM-YYYY format)
  nextDueDate: text("next_due_date"), // Calculated next due date for THIS component
  lastDoneRH: text("last_done_rh"), // Last completion running hours for THIS component
  nextDueRH: text("next_due_rh"), // Calculated next due RH for THIS component
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  jobIdIdx: index("idx_job_component_link_job").on(table.jobId),
  componentIdIdx: index("idx_job_component_link_component").on(table.componentId),
  vesselIdIdx: index("idx_job_component_link_vessel").on(table.vesselId),
  uniqueJobComponent: unique("unique_job_component_link").on(table.jobId, table.componentId),
}));

export const insertJobComponentLinkSchema = createInsertSchema(jobComponentLinks).omit({
  id: true,
  linkedAt: true,
  updatedAt: true,
});

export type InsertJobComponentLink = z.infer<typeof insertJobComponentLinkSchema>;
export type JobComponentLink = typeof jobComponentLinks.$inferSelect;

// Equipment Categories - Customizable master data for defect equipment classification
export const equipmentCategories = pgTable("equipment_categories", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertEquipmentCategorySchema = createInsertSchema(equipmentCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEquipmentCategory = z.infer<typeof insertEquipmentCategorySchema>;
export type EquipmentCategory = typeof equipmentCategories.$inferSelect;

// Defect Categories - Customizable master data for defect classification (type of defect)
export const defectCategories = pgTable("defect_categories", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertDefectCategorySchema = createInsertSchema(defectCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDefectCategory = z.infer<typeof insertDefectCategorySchema>;
export type DefectCategory = typeof defectCategories.$inferSelect;

// Defect Types - Customizable master data for specific defect type classification
export const defectTypes = pgTable("defect_types", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertDefectTypeSchema = createInsertSchema(defectTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDefectType = z.infer<typeof insertDefectTypeSchema>;
export type DefectType = typeof defectTypes.$inferSelect;

// Ship Certificates Admin - Master Certificate Definitions
// This is the admin configuration for what certificates exist and their properties
export const shipCertificatesMaster = pgTable("ship_certificates_master", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  sequence: integer("sequence").notNull(),
  masterId: text("master_id").notNull().unique(), // Format: CategoryLetter + GroupNumber + "-" + 3-digit sequence (e.g., A1-001)
  certificateName: text("certificate_name").notNull(),
  category: text("category").notNull(), // A-F category key
  group: text("group").notNull(), // 1-10 group key
  requirementRef: text("requirement_ref"), // Regulatory reference
  applicableToCompany: boolean("applicable_to_company").notNull().default(false),
  certificateLabel: text("certificate_label"), // Custom label when applicable to company
  isActive: boolean("is_active").notNull().default(true),
  isSystemDefined: boolean("is_system_defined").notNull().default(false),
  // Company-specific fields (only used when applicableToCompany is true)
  companyId: text("company_id"), // Default: "C" + masterId, but user-editable
  companyGroup: text("company_group"), // A-I company group key
  companySequence: integer("company_sequence"), // Sequence number for company tab ordering
  sortOrder: integer("sort_order").default(0),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  sequenceIdx: index("idx_ship_cert_master_sequence").on(table.sequence),
  categoryIdx: index("idx_ship_cert_master_category").on(table.category),
  groupIdx: index("idx_ship_cert_master_group").on(table.group),
}));

export const insertShipCertificateMasterSchema = createInsertSchema(shipCertificatesMaster).omit({
  id: true,
  isSystemDefined: true,
  sortOrder: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShipCertificateMaster = z.infer<typeof insertShipCertificateMasterSchema>;
export type ShipCertificateMaster = typeof shipCertificatesMaster.$inferSelect;

// Ship Certificates Labels Configuration (for Master tab category/group labels)
export const shipCertificatesLabelsConfig = pgTable("ship_certificates_labels_config", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  configType: text("config_type").notNull(), // 'master_category', 'master_group', 'company_group'
  key: text("key").notNull(), // A, B, C for categories or 1, 2, 3 for groups
  label: text("label").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertShipCertificatesLabelsConfigSchema = createInsertSchema(shipCertificatesLabelsConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShipCertificatesLabelsConfig = z.infer<typeof insertShipCertificatesLabelsConfigSchema>;
export type ShipCertificatesLabelsConfig = typeof shipCertificatesLabelsConfig.$inferSelect;

// Vessel Certificate Applicability - tracks which certificates are applicable for each vessel
export const vesselCertificateApplicability = pgTable("vessel_certificate_applicability", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid), // External vessel ID from Vessel Master API
  vesselName: text("vessel_name").notNull(), // Vessel name for display
  masterId: text("master_id").notNull(), // References ship_certificates_master.master_id
  isApplicable: boolean("is_applicable").notNull().default(true), // Whether this certificate is applicable to this vessel
  sortOrder: integer("sort_order").default(0),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  vesselMasterIdx: index("idx_vessel_cert_vessel_master").on(table.vesselId, table.masterId),
  vesselIdx: index("idx_vessel_cert_vessel").on(table.vesselId),
  masterIdx: index("idx_vessel_cert_master").on(table.masterId),
  uniqueLiveVesselMaster: uniqueIndex("uniq_vessel_certificate_applicability_live")
    .on(table.vesselId, table.masterId)
    .where(sql`${table.isDeleted} = false`),
}));

export const insertVesselCertificateApplicabilitySchema = createInsertSchema(vesselCertificateApplicability).omit({
  id: true,
  sortOrder: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselCertificateApplicability = z.infer<typeof insertVesselCertificateApplicabilitySchema>;
export type VesselCertificateApplicability = typeof vesselCertificateApplicability.$inferSelect;

// Vessel Certificate Data - stores vessel-specific certificate data (dates, attachments) for Cert & Surveys module
export const vesselCertificateData = pgTable("vessel_certificate_data", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid), // External vessel ID from Vessel Master API
  vesselName: text("vessel_name").notNull(), // Vessel name for display
  masterId: text("master_id").notNull(), // References ship_certificates_master.master_id
  issueDate: text("issue_date"), // Date certificate was issued
  expiryDate: text("expiry_date"), // Date certificate expires
  lastAnnual: text("last_annual"), // Date of last annual survey
  lastInterm: text("last_interm"), // Date of last intermediate survey
  endorsementDate: text("endorsement_date"), // Date of endorsement
  lastEditUpload: text("last_edit_upload"), // Date of last edit or file upload
  attachments: jsonb("attachments").$type<Array<{ name: string; size: number; key: string; uploadedAt: string }>>().default([]),
  sortOrder: integer("sort_order").default(0),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  vesselMasterIdx: index("idx_vessel_cert_data_vessel_master").on(table.vesselId, table.masterId),
  vesselIdx: index("idx_vessel_cert_data_vessel").on(table.vesselId),
  masterIdx: index("idx_vessel_cert_data_master").on(table.masterId),
  uniqueLiveVesselMaster: uniqueIndex("uniq_vessel_certificate_data_live")
    .on(table.vesselId, table.masterId)
    .where(sql`${table.isDeleted} = false`),
}));

export const insertVesselCertificateDataSchema = createInsertSchema(vesselCertificateData).omit({
  id: true,
  sortOrder: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselCertificateData = z.infer<typeof insertVesselCertificateDataSchema>;
export type VesselCertificateData = typeof vesselCertificateData.$inferSelect;

// ===========================
// Ship Surveys Admin Tables
// ===========================

// Ship Surveys Admin - Master Survey Definitions
// This is the admin configuration for what surveys exist and their properties
export const shipSurveysMaster = pgTable("ship_surveys_master", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  sequence: integer("sequence").notNull(),
  masterId: text("master_id").notNull().unique(), // Format: CategoryLetter + GroupNumber + "-" + 3-digit sequence (e.g., A1-001)
  surveyName: text("survey_name").notNull(),
  category: text("category").notNull(), // A-F category key
  group: text("group").notNull(), // 1-10 group key
  requirementRef: text("requirement_ref"), // Regulatory reference
  applicableToCompany: boolean("applicable_to_company").notNull().default(false),
  surveyLabel: text("survey_label"), // Custom label when applicable to company
  isActive: boolean("is_active").notNull().default(true),
  // Company-specific fields (only used when applicableToCompany is true)
  companyId: text("company_id"), // Default: "C" + masterId, but user-editable
  companyGroup: text("company_group"), // A-I company group key
  companySequence: integer("company_sequence"), // Sequence number for company tab ordering
  sortOrder: integer("sort_order").default(0),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  sequenceIdx: index("idx_ship_survey_master_sequence").on(table.sequence),
  categoryIdx: index("idx_ship_survey_master_category").on(table.category),
  groupIdx: index("idx_ship_survey_master_group").on(table.group),
}));

export const insertShipSurveyMasterSchema = createInsertSchema(shipSurveysMaster).omit({
  id: true,
  sortOrder: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShipSurveyMaster = z.infer<typeof insertShipSurveyMasterSchema>;
export type ShipSurveyMaster = typeof shipSurveysMaster.$inferSelect;

// Ship Surveys Labels Configuration (for Master tab category/group labels)
export const shipSurveysLabelsConfig = pgTable("ship_surveys_labels_config", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  configType: text("config_type").notNull(), // 'master_category', 'master_group', 'company_group'
  key: text("key").notNull(), // A, B, C for categories or 1, 2, 3 for groups
  label: text("label").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
});

export const insertShipSurveysLabelsConfigSchema = createInsertSchema(shipSurveysLabelsConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShipSurveysLabelsConfig = z.infer<typeof insertShipSurveysLabelsConfigSchema>;
export type ShipSurveysLabelsConfig = typeof shipSurveysLabelsConfig.$inferSelect;

// Vessel Survey Applicability - tracks which surveys are applicable for each vessel
export const vesselSurveyApplicability = pgTable("vessel_survey_applicability", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid), // External vessel ID from Vessel Master API
  vesselName: text("vessel_name").notNull(), // Vessel name for display
  masterId: text("master_id").notNull(), // References ship_surveys_master.master_id
  isApplicable: boolean("is_applicable").notNull().default(true), // Whether this survey is applicable to this vessel
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselMasterIdx: index("idx_vessel_survey_vessel_master").on(table.vesselId, table.masterId),
  vesselIdx: index("idx_vessel_survey_vessel").on(table.vesselId),
  masterIdx: index("idx_vessel_survey_master").on(table.masterId),
  uniqueLiveVesselMaster: uniqueIndex("uniq_vessel_survey_applicability_live")
    .on(table.vesselId, table.masterId)
    .where(sql`${table.isDeleted} = false`),
}));

export const insertVesselSurveyApplicabilitySchema = createInsertSchema(vesselSurveyApplicability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselSurveyApplicability = z.infer<typeof insertVesselSurveyApplicabilitySchema>;
export type VesselSurveyApplicability = typeof vesselSurveyApplicability.$inferSelect;

// Vessel Survey Data - stores vessel-specific survey data (dates, attachments) for Cert & Surveys module
export const vesselSurveyData = pgTable("vessel_survey_data", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid), // External vessel ID from Vessel Master API
  vesselName: text("vessel_name").notNull(), // Vessel name for display
  masterId: text("master_id").notNull(), // References ship_surveys_master.master_id
  surveyDate: text("survey_date"), // Date of survey
  dueDate: text("due_date"), // Due date for survey
  firstRangeDate: text("first_range_date"), // 1st range date
  secondRangeDate: text("second_range_date"), // 2nd range date
  postponed: text("postponed"), // Postponed date
  lastEditUpload: text("last_edit_upload"), // Last edit/upload date
  attachments: jsonb("attachments").$type<Array<{ name: string; size: number; key: string; uploadedAt: string }>>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselMasterIdx: index("idx_vessel_survey_data_vessel_master").on(table.vesselId, table.masterId),
  vesselIdx: index("idx_vessel_survey_data_vessel").on(table.vesselId),
  masterIdx: index("idx_vessel_survey_data_master").on(table.masterId),
  uniqueVesselMaster: uniqueIndex("uniq_vessel_survey_data_vessel_master")
    .on(table.vesselId, table.masterId),
}));

export const insertVesselSurveyDataSchema = createInsertSchema(vesselSurveyData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselSurveyData = z.infer<typeof insertVesselSurveyDataSchema>;
export type VesselSurveyData = typeof vesselSurveyData.$inferSelect;

// Work Order Postponements - History/Audit table to track multiple postponements over time
export const workOrderPostponements = pgTable("work_order_postponements", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.wouuid), // FK → work_orders.wouuid
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid), // References vessels.vuuid
  postponementNumber: integer("postponement_number").notNull().default(1), // 1st, 2nd, 3rd postponement, etc.
  originalDueDate: text("original_due_date"), // Original due date before postponement
  newDueDate: text("new_due_date"), // New due date after postponement
  postponementReason: text("postponement_reason"), // Reason for postponement (structured dropdown value)
  postponementRemarks: text("postponement_remarks"), // Optional additional remarks for postponement
  authorizedBy: text("authorized_by"), // Who authorized the postponement
  approvalRemarks: text("approval_remarks"), // Remarks from approver
  durationDays: integer("duration_days"), // Number of days postponed
  submittedDate: text("submitted_date"), // When postponement was submitted
  approvedDate: text("approved_date"), // When postponement was approved
  approvedBy: text("approved_by"), // Who approved the postponement
  status: text("status").notNull().default("Pending"), // 'Pending' | 'Approved' | 'Rejected'
  informOffice: boolean("inform_office").notNull().default(false), // Whether office was informed
  attachmentPath: text("attachment_path"), // Path to any attached documents
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  workOrderIdx: index("idx_postponement_work_order").on(table.workOrderId),
  vesselIdx: index("idx_postponement_vessel").on(table.vesselId),
  statusIdx: index("idx_postponement_status").on(table.status),
}));

export const insertWorkOrderPostponementSchema = createInsertSchema(workOrderPostponements).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrderPostponement = z.infer<typeof insertWorkOrderPostponementSchema>;
export type WorkOrderPostponement = typeof workOrderPostponements.$inferSelect;

export const reportSnapshots = pgTable("report_snapshots", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  reportType: text("report_type").notNull(),
  exportFormat: text("export_format").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  generatedBy: text("generated_by"),
  itemCount: integer("item_count").notNull().default(0),
  filtersApplied: jsonb("filters_applied"),
  summaryData: jsonb("summary_data").notNull(),
  itemsData: jsonb("items_data").notNull(),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  vesselIdx: index("idx_report_snapshots_vessel").on(table.vesselId),
  reportTypeIdx: index("idx_report_snapshots_type").on(table.reportType),
  generatedAtIdx: index("idx_report_snapshots_date").on(table.generatedAt),
}));

export const insertReportSnapshotSchema = createInsertSchema(reportSnapshots).omit({
  id: true,
  generatedAt: true,
});

export type InsertReportSnapshot = z.infer<typeof insertReportSnapshotSchema>;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;

export const workOrderDocuments = pgTable("work_order_documents", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.wouuid),
  executionId: text("execution_id"),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storageBackend: text("storage_backend").notNull().default("object"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => ({
  workOrderIdx: index("idx_wo_docs_work_order").on(table.workOrderId),
  vesselIdx: index("idx_wo_docs_vessel").on(table.vesselId),
  executionIdx: index("idx_wo_docs_execution").on(table.executionId),
  docTypeIdx: index("idx_wo_docs_type").on(table.documentType),
}));

export const insertWorkOrderDocumentSchema = createInsertSchema(workOrderDocuments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertWorkOrderDocument = z.infer<typeof insertWorkOrderDocumentSchema>;
export type WorkOrderDocument = typeof workOrderDocuments.$inferSelect;

// =====================================================
// MASTER DATA TABLES — Synced from External API
// These tables store master reference data fetched from
// the external crew master data service via /admin/sync-masters.
// =====================================================

export const vesselTypes = pgTable("vessel_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  classification: text("classification"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  nameIdx: index("idx_vessel_types_name").on(table.name),
}));

export const insertVesselTypeSchema = createInsertSchema(vesselTypes).omit({
  syncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselType = z.infer<typeof insertVesselTypeSchema>;
export type VesselType = typeof vesselTypes.$inferSelect;

export const additionalGroups = pgTable("additional_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  nameIdx: index("idx_additional_groups_name").on(table.name),
}));

export const insertAdditionalGroupSchema = createInsertSchema(additionalGroups).omit({
  syncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdditionalGroup = z.infer<typeof insertAdditionalGroupSchema>;
export type AdditionalGroup = typeof additionalGroups.$inferSelect;

export const ports = pgTable("ports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  nameIdx: index("idx_ports_name").on(table.name),
}));

export const insertPortSchema = createInsertSchema(ports).omit({
  syncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPort = z.infer<typeof insertPortSchema>;
export type Port = typeof ports.$inferSelect;

export const fleetGroups = pgTable("fleet_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  nameIdx: index("idx_fleet_groups_name").on(table.name),
}));

export const insertFleetGroupSchema = createInsertSchema(fleetGroups).omit({
  syncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFleetGroup = z.infer<typeof insertFleetGroupSchema>;
export type FleetGroup = typeof fleetGroups.$inferSelect;

export const masterUsers = pgTable("master_users", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  role: text("role"),
  designation: text("designation"),
  userType: text("user_type"),
  department: text("department"),
  email: text("email"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  fullNameIdx: index("idx_master_users_full_name").on(table.fullName),
  emailIdx: index("idx_master_users_email").on(table.email),
}));

export const insertMasterUserSchema = createInsertSchema(masterUsers).omit({
  syncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMasterUser = z.infer<typeof insertMasterUserSchema>;
export type MasterUser = typeof masterUsers.$inferSelect;

// === Work Order Anomalies (Layer 6 — Anomaly Detection System) ===
export const workOrderAnomalies = pgTable("work_order_anomalies", {
  id: serial("id").primaryKey(),
  workOrderId: text("work_order_id").notNull(),
  workOrderCode: text("work_order_code"),
  componentCode: text("component_code"),
  componentName: text("component_name"),
  jobTitle: text("job_title"),
  vesselId: text("vessel_id"),
  anomalyType: text("anomaly_type").notNull(),
  severity: text("severity").notNull(),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  completionDate: text("completion_date"),
  dueDate: text("due_date"),
  daysLate: integer("days_late").default(0),
  missedCycles: integer("missed_cycles").default(0),
  anomalyDetails: json("anomaly_details"),
  status: text("status").notNull().default("PENDING_REVIEW"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  justification: text("justification"),
  isResolved: boolean("is_resolved").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
});

export const insertWorkOrderAnomalySchema = createInsertSchema(workOrderAnomalies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrderAnomaly = z.infer<typeof insertWorkOrderAnomalySchema>;
export type WorkOrderAnomaly = typeof workOrderAnomalies.$inferSelect;

export const admnRoleMaster = pgTable("admn_role_master", {
  id: integer("id").primaryKey(),
  ruid: text("ruid").notNull().unique(),
  assignedRole: text("assigned_role").notNull(),
  roletype: text("roletype").notNull(),
  orderby: integer("orderby"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: updatedAtColumnTz(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
});

export const insertAdmnRoleMasterSchema = createInsertSchema(admnRoleMaster).omit({
  ruid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmnRoleMaster = z.infer<typeof insertAdmnRoleMasterSchema>;
export type AdmnRoleMaster = typeof admnRoleMaster.$inferSelect;

export const admMenumasterAc = pgTable("adm_menumaster_ac", {
  id: integer("id").primaryKey(),
  muid: text("muid").notNull().unique(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  route: text("route"),
  parentMenu: text("parent_menu"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: updatedAtColumnTz(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
});

export const insertAdmMenumasterAcSchema = createInsertSchema(admMenumasterAc).omit({
  muid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmMenumasterAc = z.infer<typeof insertAdmMenumasterAcSchema>;
export type AdmMenumasterAc = typeof admMenumasterAc.$inferSelect;

export const admRoleMenuAccess = pgTable("adm_role_menu_access", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  roleRuid: text("role_ruid").notNull().references(() => admnRoleMaster.ruid),
  menuMuid: text("menu_muid").notNull().references(() => admMenumasterAc.muid),
  canView: boolean("can_view").default(false),
  canCreate: boolean("can_create").default(false),
  canEdit: boolean("can_edit").default(false),
  canDelete: boolean("can_delete").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: updatedAtColumnTz(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
}, (table) => [
  unique().on(table.roleRuid, table.menuMuid),
]);

export const insertAdmRoleMenuAccessSchema = createInsertSchema(admRoleMenuAccess).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmRoleMenuAccess = z.infer<typeof insertAdmRoleMenuAccessSchema>;
export type AdmRoleMenuAccess = typeof admRoleMenuAccess.$inferSelect;

// ====== PLANNER DATES TABLE ======
export const plannerDates = pgTable("planner_dates", {
  id: serial("id").primaryKey(),
  pduuid: text("pduuid").notNull().unique(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  jobId: text("job_id").notNull().references(() => jobs.juuid),
  componentId: text("component_id").notNull().references(() => components.cuuid),
  plannedDate: text("planned_date"),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  uniqueJobComponent: unique("unique_planner_date_entry").on(table.vesselId, table.jobId, table.componentId),
}));

export const insertPlannerDateSchema = createInsertSchema(plannerDates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlannerDate = z.infer<typeof insertPlannerDateSchema>;
export type PlannerDate = typeof plannerDates.$inferSelect;

// ====== REPORT FAVORITES TABLE ======
export const reportFavorites = pgTable("report_favorites", {
  id: serial("id").primaryKey(),
  rfuuid: text("rfuuid").notNull().unique().default(sql`gen_random_uuid()::text`),
  reportId: text("report_id").notNull(),
  createdByUuid: text("created_by_uuid").notNull(),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: updatedAtColumn(),
}, (table) => ({
  uniqueUserReport: unique("unique_user_report_favorite").on(table.createdByUuid, table.reportId),
}));

export const insertReportFavoriteSchema = createInsertSchema(reportFavorites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReportFavorite = z.infer<typeof insertReportFavoriteSchema>;
export type ReportFavorite = typeof reportFavorites.$inferSelect;

// ====== AVAILABLE RANKS TABLE ======
export const admAvailableRanks = pgTable("adm_available_ranks", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  arUuid: text("ar_uuid").unique().default(sql`gen_random_uuid()::text`),
  name: text("name").notNull(),
  category: text("category"),
  rankId: text("rank_id").notNull().unique(),
  label: text("label"),
  applicableToCompany: boolean("applicable_to_company").default(true),
  isSystemRank: boolean("is_system_rank").default(true),
  sortOrder: integer("sort_order"),
  viewMode: text("view_mode"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: updatedAtColumnTz(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
});

export const insertAdmAvailableRanksSchema = createInsertSchema(admAvailableRanks).omit({
  id: true,
  arUuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmAvailableRanks = z.infer<typeof insertAdmAvailableRanksSchema>;
export type AdmAvailableRanks = typeof admAvailableRanks.$inferSelect;

// ====== VESSEL ORG CHART TABLE ======
export const admVesselOrgChart = pgTable("adm_vessel_org_chart", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  ocUuid: text("oc_uuid").unique().default(sql`gen_random_uuid()::text`),
  rank: text("rank"),
  rankId: text("rank_id").notNull().unique().references(() => admAvailableRanks.rankId),
  parentRankId: text("parent_rank_id").references(() => admAvailableRanks.rankId),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: updatedAtColumnTz(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
  rankView: text("rank_view"),
  department: text("department"),
});

export const insertAdmVesselOrgChartSchema = createInsertSchema(admVesselOrgChart).omit({
  id: true,
  ocUuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmVesselOrgChart = z.infer<typeof insertAdmVesselOrgChartSchema>;
export type AdmVesselOrgChart = typeof admVesselOrgChart.$inferSelect;

// ====== VESSEL ORG CHART NODES TABLE (vessel-specific hierarchy) ======
export const vesselOrgChartNodes = pgTable("vessel_org_chart_nodes", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  nodeUuid: text("node_uuid").unique().notNull().default(sql`gen_random_uuid()::text`),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  rankId: text("rank_id").notNull().references(() => admAvailableRanks.rankId),
  nodeLabel: text("node_label"),
  department: text("department"),
  parentNodeUuid: text("parent_node_uuid"),
  isHod: boolean("is_hod").default(false),
  isAssigned: boolean("is_assigned").default(false),
  viewMode: text("view_mode"),
  sortOrder: integer("sort_order").default(0),
  nodeLayer: text("node_layer").default("department").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: updatedAtColumnTz(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  roleRuid: text("role_ruid"),
  isDeleted: boolean("is_deleted").default(false),
});

export const insertVesselOrgChartNodeSchema = createInsertSchema(vesselOrgChartNodes).omit({
  id: true,
  nodeUuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselOrgChartNode = z.infer<typeof insertVesselOrgChartNodeSchema>;
export type VesselOrgChartNode = typeof vesselOrgChartNodes.$inferSelect;

export const vesselDepartmentConfig = pgTable("vessel_department_config", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  department: text("department").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: updatedAtColumnTz(),
}, (table) => ({
  vesselDeptUnique: unique("vessel_dept_config_unique").on(table.vesselId, table.department),
}));

export const insertVesselDepartmentConfigSchema = createInsertSchema(vesselDepartmentConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselDepartmentConfig = z.infer<typeof insertVesselDepartmentConfigSchema>;
export type VesselDepartmentConfig = typeof vesselDepartmentConfig.$inferSelect;

// ====== MONTHLY MAINTENANCE SNAPSHOTS ======
export const monthlySnapshots = pgTable("monthly_snapshots", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  snapshotMonth: text("snapshot_month").notNull(),
  snapshotType: text("snapshot_type").notNull(),
  snapshotTimestamp: timestamp("snapshot_timestamp").notNull(),
  category: text("category").notNull(),
  count: integer("count").notNull().default(0),
  workOrderIds: text("work_order_ids").array().notNull().default(sql`'{}'::text[]`),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (table) => ({
  vesselMonthIdx: index("idx_monthly_snap_vessel_month").on(table.vesselId, table.snapshotMonth),
  typeIdx: index("idx_monthly_snap_type").on(table.snapshotType),
  uniqueSnap: unique("unique_monthly_snapshot").on(table.vesselId, table.snapshotMonth, table.snapshotType, table.category),
}));

export const insertMonthlySnapshotSchema = createInsertSchema(monthlySnapshots).omit({
  id: true,
  generatedAt: true,
});

export type InsertMonthlySnapshot = z.infer<typeof insertMonthlySnapshotSchema>;
export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;

// ====== NOON REPORT MODULE SCHEMA — remove this line to disable ======
export * from './schema-noon-report';
