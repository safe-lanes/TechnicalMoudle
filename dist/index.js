var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  IHM_EVIDENCE_TYPES: () => IHM_EVIDENCE_TYPES,
  IHM_PRESENCE_VALUES: () => IHM_PRESENCE_VALUES,
  INVENTORY_EVENT_TYPES: () => INVENTORY_EVENT_TYPES,
  INVENTORY_REFERENCE_TYPES: () => INVENTORY_REFERENCE_TYPES,
  RH_COUNTER_TYPES: () => RH_COUNTER_TYPES,
  RH_UPDATE_SOURCES: () => RH_UPDATE_SOURCES,
  alertConfig: () => alertConfig,
  alertDeliveries: () => alertDeliveries,
  alertEvents: () => alertEvents,
  alertPolicies: () => alertPolicies,
  auditLog: () => auditLog,
  bulkImportErrors: () => bulkImportErrors,
  bulkImportHistory: () => bulkImportHistory,
  cascadeRunningHoursSchema: () => cascadeRunningHoursSchema,
  certificates: () => certificates,
  changeRequest: () => changeRequest,
  changeRequestAttachment: () => changeRequestAttachment,
  changeRequestComment: () => changeRequestComment,
  componentClassRegulatory: () => componentClassRegulatory,
  componentDocuments: () => componentDocuments,
  componentMaintenanceHistory: () => componentMaintenanceHistory,
  componentRequisitions: () => componentRequisitions,
  componentRunningHoursLog: () => componentRunningHoursLog,
  components: () => components,
  defectActions: () => defectActions,
  defectAttachments: () => defectAttachments,
  defects: () => defects,
  fleetComponentMapping: () => fleetComponentMapping,
  fleetEquipmentMaster: () => fleetEquipmentMaster,
  fleetJobVesselMapping: () => fleetJobVesselMapping,
  fleetSpareVesselMapping: () => fleetSpareVesselMapping,
  fleetVesselMapping: () => fleetVesselMapping,
  fleets: () => fleets,
  formDefinitions: () => formDefinitions,
  formVersionUsage: () => formVersionUsage,
  formVersions: () => formVersions,
  ihmEvidenceTypeEnum: () => ihmEvidenceTypeEnum,
  ihmItems: () => ihmItems,
  ihmMaintenanceLog: () => ihmMaintenanceLog,
  ihmPresenceEnum: () => ihmPresenceEnum,
  importChangeLog: () => importChangeLog,
  importHistory: () => importHistory,
  insertAlertConfigSchema: () => insertAlertConfigSchema,
  insertAlertDeliverySchema: () => insertAlertDeliverySchema,
  insertAlertEventSchema: () => insertAlertEventSchema,
  insertAlertPolicySchema: () => insertAlertPolicySchema,
  insertAuditLogSchema: () => insertAuditLogSchema,
  insertBulkImportErrorSchema: () => insertBulkImportErrorSchema,
  insertBulkImportHistorySchema: () => insertBulkImportHistorySchema,
  insertCertificateSchema: () => insertCertificateSchema,
  insertChangeRequestAttachmentSchema: () => insertChangeRequestAttachmentSchema,
  insertChangeRequestCommentSchema: () => insertChangeRequestCommentSchema,
  insertChangeRequestSchema: () => insertChangeRequestSchema,
  insertComponentClassRegulatorySchema: () => insertComponentClassRegulatorySchema,
  insertComponentDocumentSchema: () => insertComponentDocumentSchema,
  insertComponentMaintenanceHistorySchema: () => insertComponentMaintenanceHistorySchema,
  insertComponentRequisitionSchema: () => insertComponentRequisitionSchema,
  insertComponentRunningHoursLogSchema: () => insertComponentRunningHoursLogSchema,
  insertComponentSchema: () => insertComponentSchema,
  insertDefectActionSchema: () => insertDefectActionSchema,
  insertDefectAttachmentSchema: () => insertDefectAttachmentSchema,
  insertDefectSchema: () => insertDefectSchema,
  insertFleetComponentMappingSchema: () => insertFleetComponentMappingSchema,
  insertFleetEquipmentMasterSchema: () => insertFleetEquipmentMasterSchema,
  insertFleetJobVesselMappingSchema: () => insertFleetJobVesselMappingSchema,
  insertFleetSchema: () => insertFleetSchema,
  insertFleetSpareVesselMappingSchema: () => insertFleetSpareVesselMappingSchema,
  insertFleetVesselMappingSchema: () => insertFleetVesselMappingSchema,
  insertFormDefinitionSchema: () => insertFormDefinitionSchema,
  insertFormVersionSchema: () => insertFormVersionSchema,
  insertFormVersionUsageSchema: () => insertFormVersionUsageSchema,
  insertIhmItemSchema: () => insertIhmItemSchema,
  insertIhmMaintenanceLogSchema: () => insertIhmMaintenanceLogSchema,
  insertImportChangeLogSchema: () => insertImportChangeLogSchema,
  insertImportHistorySchema: () => insertImportHistorySchema,
  insertInventoryTransactionSchema: () => insertInventoryTransactionSchema,
  insertJobComponentLinkSchema: () => insertJobComponentLinkSchema,
  insertJobSchema: () => insertJobSchema2,
  insertLocationSchema: () => insertLocationSchema,
  insertMakerListSchema: () => insertMakerListSchema,
  insertMakerSchema: () => insertMakerSchema,
  insertMasterDataSchema: () => insertMasterDataSchema,
  insertMasterListSchema: () => insertMasterListSchema,
  insertPmsVesselSettingsSchema: () => insertPmsVesselSettingsSchema,
  insertRecurringDefectLinkSchema: () => insertRecurringDefectLinkSchema,
  insertRecurringDefectSchema: () => insertRecurringDefectSchema,
  insertRunningHoursAuditSchema: () => insertRunningHoursAuditSchema,
  insertSfiDetailsSchema: () => insertSfiDetailsSchema,
  insertSpareComponentLinkSchema: () => insertSpareComponentLinkSchema,
  insertSpareHistorySchema: () => insertSpareHistorySchema,
  insertSpareLocationStockSchema: () => insertSpareLocationStockSchema,
  insertSpareSchema: () => insertSpareSchema,
  insertStoresItemSchema: () => insertStoresItemSchema,
  insertStoresLedgerSchema: () => insertStoresLedgerSchema,
  insertSurveySchema: () => insertSurveySchema,
  insertUserSchema: () => insertUserSchema,
  insertVesselSchema: () => insertVesselSchema,
  insertWorkOrderExecutionDetailsSchema: () => insertWorkOrderExecutionDetailsSchema,
  insertWorkOrderExecutionSchema: () => insertWorkOrderExecutionSchema,
  insertWorkOrderSchema: () => insertWorkOrderSchema,
  inventoryEventTypeEnum: () => inventoryEventTypeEnum,
  inventoryReferenceTypeEnum: () => inventoryReferenceTypeEnum,
  inventoryTransactionInputSchema: () => inventoryTransactionInputSchema,
  inventoryTransactions: () => inventoryTransactions,
  jobComponentLinks: () => jobComponentLinks,
  jobs: () => jobs,
  locations: () => locations,
  makerList: () => makerList,
  makers: () => makers,
  masterData: () => masterData,
  masterLists: () => masterLists,
  pmsVesselSettings: () => pmsVesselSettings,
  recurringDefectLinks: () => recurringDefectLinks,
  recurringDefects: () => recurringDefects,
  runningHoursAudit: () => runningHoursAudit,
  sfiDetails: () => sfiDetails,
  spareComponentLinks: () => spareComponentLinks,
  spareLocationStock: () => spareLocationStock,
  spares: () => spares,
  sparesHistory: () => sparesHistory,
  storesItems: () => storesItems,
  storesLedger: () => storesLedger,
  surveys: () => surveys,
  updateMasterRHSchema: () => updateMasterRHSchema,
  updateRHConfigSchema: () => updateRHConfigSchema,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  vessels: () => vessels,
  workOrderExecutionDetails: () => workOrderExecutionDetails,
  workOrderExecutions: () => workOrderExecutions,
  workOrders: () => workOrders
});
import { pgTable, text, integer, boolean, timestamp, decimal, index, json, numeric, primaryKey, unique, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var userRoleEnum, users, insertUserSchema, fleets, insertFleetSchema, vessels, insertVesselSchema, runningHoursAudit, insertRunningHoursAuditSchema, cascadeRunningHoursSchema, RH_COUNTER_TYPES, RH_UPDATE_SOURCES, updateRHConfigSchema, updateMasterRHSchema, components, insertComponentSchema, formDefinitions, insertFormDefinitionSchema, formVersions, insertFormVersionSchema, formVersionUsage, insertFormVersionUsageSchema, ihmItems, insertIhmItemSchema, ihmMaintenanceLog, insertIhmMaintenanceLogSchema, spares, insertSpareSchema, sparesHistory, insertSpareHistorySchema, storesLedger, insertStoresLedgerSchema, storesItems, insertStoresItemSchema, changeRequest, insertChangeRequestSchema, changeRequestAttachment, insertChangeRequestAttachmentSchema, changeRequestComment, insertChangeRequestCommentSchema, alertPolicies, insertAlertPolicySchema, alertEvents, insertAlertEventSchema, alertDeliveries, insertAlertDeliverySchema, alertConfig, insertAlertConfigSchema, jobs, insertJobSchema2, workOrders, insertWorkOrderSchema, workOrderExecutions, insertWorkOrderExecutionSchema, defects, insertDefectSchema, defectActions, insertDefectActionSchema, defectAttachments, insertDefectAttachmentSchema, recurringDefects, insertRecurringDefectSchema, recurringDefectLinks, insertRecurringDefectLinkSchema, importHistory, importChangeLog, insertImportHistorySchema, insertImportChangeLogSchema, makers, insertMakerSchema, masterLists, insertMasterListSchema, fleetEquipmentMaster, insertFleetEquipmentMasterSchema, componentRunningHoursLog, insertComponentRunningHoursLogSchema, auditLog, insertAuditLogSchema, componentDocuments, insertComponentDocumentSchema, componentClassRegulatory, insertComponentClassRegulatorySchema, componentMaintenanceHistory, insertComponentMaintenanceHistorySchema, componentRequisitions, insertComponentRequisitionSchema, pmsVesselSettings, insertPmsVesselSettingsSchema, makerList, insertMakerListSchema, sfiDetails, insertSfiDetailsSchema, masterData, insertMasterDataSchema, fleetVesselMapping, insertFleetVesselMappingSchema, fleetComponentMapping, insertFleetComponentMappingSchema, fleetJobVesselMapping, insertFleetJobVesselMappingSchema, fleetSpareVesselMapping, insertFleetSpareVesselMappingSchema, bulkImportHistory, insertBulkImportHistorySchema, bulkImportErrors, insertBulkImportErrorSchema, certificates, insertCertificateSchema, surveys, insertSurveySchema, workOrderExecutionDetails, insertWorkOrderExecutionDetailsSchema, inventoryEventTypeEnum, inventoryReferenceTypeEnum, ihmPresenceEnum, ihmEvidenceTypeEnum, locations, insertLocationSchema, spareComponentLinks, insertSpareComponentLinkSchema, spareLocationStock, insertSpareLocationStockSchema, inventoryTransactions, insertInventoryTransactionSchema, INVENTORY_EVENT_TYPES, INVENTORY_REFERENCE_TYPES, IHM_PRESENCE_VALUES, IHM_EVIDENCE_TYPES, inventoryTransactionInputSchema, jobComponentLinks, insertJobComponentLinkSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    userRoleEnum = pgEnum("user_role", ["Ship", "Office", "PMS Admin"]);
    users = pgTable("users", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      username: text("username").notNull().unique(),
      password: text("password").notNull(),
      fullName: text("full_name").notNull(),
      email: text("email"),
      role: userRoleEnum("role").notNull().default("Ship"),
      vesselId: text("vessel_id"),
      // Required for Ship role, null for Office/PMS Admin
      department: text("department"),
      // Rule #19: User's department for approver validation (e.g., 'Deck', 'Engine', 'Electrical')
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    fleets = pgTable("fleets", {
      id: text("id").primaryKey(),
      // Fleet code like FLT001, FLT002
      code: text("code").notNull().unique(),
      // Unique fleet code
      name: text("name").notNull(),
      // Fleet display name
      description: text("description"),
      // Optional description
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    insertFleetSchema = createInsertSchema(fleets).omit({
      createdAt: true,
      updatedAt: true
    });
    vessels = pgTable("vessels", {
      id: text("id").primaryKey(),
      // Vessel code like V001, V002
      name: text("name").notNull(),
      // Vessel display name
      code: text("code").notNull(),
      // Same as id for compatibility
      fleetId: text("fleet_id"),
      // Optional reference to fleet
      imoNumber: text("imo_number"),
      // IMO number if applicable
      vesselType: text("vessel_type"),
      // e.g., Tanker, Bulk Carrier, Container
      flag: text("flag"),
      // Flag state
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    insertVesselSchema = createInsertSchema(vessels).omit({
      createdAt: true,
      updatedAt: true
    });
    runningHoursAudit = pgTable("running_hours_audit", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      componentId: text("component_id").notNull(),
      previousRH: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
      newRH: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
      cumulativeRH: decimal("cumulative_rh", { precision: 10, scale: 2 }).notNull(),
      dateUpdatedLocal: text("date_updated_local").notNull(),
      // DD-MMM-YYYY HH:mm
      dateUpdatedTZ: text("date_updated_tz").notNull(),
      // e.g., Asia/Kolkata
      enteredAtUTC: timestamp("entered_at_utc").notNull(),
      userId: text("user_id").notNull(),
      source: text("source").notNull(),
      // 'single' | 'bulk'
      notes: text("notes"),
      meterReplaced: boolean("meter_replaced").notNull().default(false),
      oldMeterFinal: decimal("old_meter_final", { precision: 10, scale: 2 }),
      newMeterStart: decimal("new_meter_start", { precision: 10, scale: 2 }),
      version: integer("version").notNull().default(1)
    }, (table) => ({
      componentIdIdx: index("idx_component_entered").on(table.componentId, table.enteredAtUTC),
      componentDateIdx: index("idx_component_date").on(table.componentId, table.dateUpdatedLocal)
    }));
    insertRunningHoursAuditSchema = createInsertSchema(runningHoursAudit).omit({
      id: true
    });
    cascadeRunningHoursSchema = z.object({
      parentComponentId: z.string(),
      mode: z.enum(["setTotal", "addDelta"]),
      value: z.number().nonnegative(),
      // Allow zero for setTotal (meter replacement), but addDelta will be validated separately
      dateUpdated: z.string(),
      // DD-MMM-YYYY HH:mm format
      dateUpdatedTZ: z.string().default("UTC"),
      comments: z.string().optional(),
      meterReplaced: z.boolean().optional().default(false),
      oldMeterFinal: z.string().optional(),
      newMeterStart: z.string().optional(),
      userId: z.string().default("admin")
    }).refine((data) => data.mode === "setTotal" || data.value > 0, {
      message: "addDelta mode requires value > 0",
      path: ["value"]
    });
    RH_COUNTER_TYPES = ["MASTER", "INHERITED", "NOT_RH_DRIVEN"];
    RH_UPDATE_SOURCES = ["MANUAL", "IMPORT", "AUTOMATION"];
    updateRHConfigSchema = z.object({
      componentId: z.string(),
      rhCounterType: z.enum(RH_COUNTER_TYPES),
      rhMasterComponentId: z.string().nullable().optional()
      // Required for INHERITED type
    });
    updateMasterRHSchema = z.object({
      componentId: z.string(),
      newRHValue: z.number().nonnegative(),
      updateSource: z.enum(RH_UPDATE_SOURCES).default("MANUAL"),
      userId: z.string(),
      comments: z.string().optional()
    });
    components = pgTable("components", {
      id: text("id").primaryKey(),
      // === UI Row 1: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Component Code ===
      fleetEquipmentCode: text("fleet_equipment_code"),
      // Fleet equipment code (XXX.XXX.XX format) - NOT unique, multiple components can share same code
      fleetEquipmentName: text("fleet_equipment_name"),
      // General name from SFI booklet
      parentId: text("parent_id"),
      componentCode: text("component_code"),
      // === UI Row 2: Component Name, Component Category, Maker, Maker Code ===
      name: text("name"),
      // Nullable - only required when dataScope='vessel'
      componentCategory: text("component_category"),
      maker: text("maker"),
      // Manufacturer name from manual
      makerCode: text("maker_code"),
      // Unique code for maker
      // === UI Row 3: Model, Model Code, Serial No, Drawing No ===
      model: text("model"),
      // Equipment model from manual
      modelCode: text("model_code"),
      // Combination of Maker Code + Model
      serialNo: text("serial_no"),
      // Serial number from manual
      drawingNo: text("drawing_no"),
      // Drawing/diagram number
      // === UI Row 4: Location, Critical, Condition Based, Installation Date ===
      location: text("location"),
      critical: boolean("critical").default(false),
      // Critical equipment (Yes/No)
      conditionBased: boolean("condition_based").default(false),
      // Condition Based maintenance (Yes/No)
      installationDate: text("installation_date"),
      // DD-MM-YYYY format
      // === UI Row 5: Commissioned Date, Rating, Equipment/System Department ===
      commissionedDate: text("commissioned_date"),
      // DD-MM-YYYY format
      rating: text("rating"),
      // Capacity or rating from manual
      eqptSystemDept: text("eqpt_system_dept"),
      // Equipment/System Department
      // === UI Row 6: IS Active, Vessel Code, IS Parent ===
      isActive: boolean("is_active").default(true),
      // IS Active (Yes/No)
      vesselCode: text("vessel_code"),
      // Vessel identification code
      isParent: boolean("is_parent").default(false),
      // IS Parent (Yes/No) - indicates if component has children
      // === UI Row 7: Notes ===
      notes: text("notes"),
      // Specifications or additional information
      // === Non-UI Fields (Internal/System Fields) ===
      vesselId: text("vessel_id"),
      // Nullable - only required when dataScope='vessel'
      dataScope: text("data_scope").notNull().default("vessel"),
      // 'fleet' | 'vessel' - discriminator for fleet vs vessel data
      parentFleetEquipmentCode: text("parent_fleet_equipment_code"),
      // For fleet hierarchy
      modelNumber: text("model_number"),
      // Model number (stored separately from model)
      department: text("department"),
      deptCategory: text("dept_category"),
      category: text("category"),
      // Nullable - only required when dataScope='vessel'
      classItem: boolean("class_item").default(false),
      noOfUnits: text("no_of_units"),
      parentComponent: text("parent_component"),
      dimensionsSize: text("dimensions_size"),
      runningHours: decimal("running_hours", { precision: 10, scale: 2 }),
      // For storing template running hours value
      currentCumulativeRH: decimal("current_cumulative_rh", { precision: 10, scale: 2 }).notNull().default("0"),
      lastUpdated: text("last_updated"),
      applicableVesselIds: text("applicable_vessel_ids").array(),
      // Array of vessel codes that can use this fleet equipment
      scopeNotes: text("scope_notes"),
      // Notes about scope applicability
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
      rhMasterUpdateSource: text("rh_master_update_source"),
      // MANUAL | IMPORT | AUTOMATION
      // For INHERITED components: cached copy of MASTER RH (system-maintained, read-only)
      rhCurrentInheritedCached: decimal("rh_current_inherited_cached", { precision: 10, scale: 2 }),
      rhInheritedUpdatedAt: timestamp("rh_inherited_updated_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      dataScopeIdx: index("idx_comp_data_scope").on(table.dataScope),
      fleetTreeIdx: index("idx_comp_fleet_tree").on(table.dataScope, table.parentFleetEquipmentCode),
      vesselTreeIdx: index("idx_comp_vessel_tree").on(table.dataScope, table.vesselId, table.parentId),
      // NOTE: fleetEquipmentCode is NOT unique - multiple components can share the same fleet equipment code/name
      fleetEquipmentCodeIdx: index("idx_comp_fleet_equipment_code").on(table.fleetEquipmentCode),
      rhMasterIdx: index("idx_comp_rh_master").on(table.rhCounterType, table.vesselId),
      rhInheritedIdx: index("idx_comp_rh_inherited").on(table.rhMasterComponentId)
    }));
    insertComponentSchema = createInsertSchema(components).omit({
      id: true,
      // Auto-generated
      createdAt: true,
      updatedAt: true
    });
    formDefinitions = pgTable("form_definitions", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      name: text("name").notNull().unique(),
      // ADD_COMPONENT, WO_PLANNED, WO_UNPLANNED
      subgroup: text("subgroup")
    });
    insertFormDefinitionSchema = createInsertSchema(formDefinitions).omit({
      id: true
    });
    formVersions = pgTable("form_versions", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      formId: integer("form_id").notNull(),
      versionNo: integer("version_no").notNull(),
      versionDate: timestamp("version_date").notNull(),
      status: text("status").notNull(),
      // DRAFT, PUBLISHED, ARCHIVED
      authorUserId: text("author_user_id").notNull(),
      changelog: text("changelog"),
      schemaJson: text("schema_json").notNull()
      // JSON string
    }, (table) => ({
      formIdIdx: index("idx_form_id").on(table.formId),
      statusIdx: index("idx_form_version_status").on(table.status)
    }));
    insertFormVersionSchema = createInsertSchema(formVersions).omit({
      id: true
    });
    formVersionUsage = pgTable("form_version_usage", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      formVersionId: integer("form_version_id").notNull(),
      usedInModule: text("used_in_module").notNull(),
      usedAt: timestamp("used_at").notNull()
    });
    insertFormVersionUsageSchema = createInsertSchema(formVersionUsage).omit({
      id: true
    });
    ihmItems = pgTable("ihm_items", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      componentId: text("component_id").notNull(),
      spareId: text("spare_id"),
      presence: text("presence").notNull(),
      // Unknown | Present | Not Present
      materials: text("materials").array(),
      // Asbestos, PCB, PFOS, etc.
      evidenceType: text("evidence_type"),
      // MD | SDoC | Test | None
      evidenceFileName: text("evidence_file_name"),
      verifiedDate: text("verified_date"),
      supplier: text("supplier"),
      remarks: text("remarks"),
      vesselId: text("vessel_id").notNull().default("V001"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      componentIdIdx: index("idx_ihm_component_id").on(table.componentId),
      spareIdIdx: index("idx_ihm_spare_id").on(table.spareId)
    }));
    insertIhmItemSchema = createInsertSchema(ihmItems).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    ihmMaintenanceLog = pgTable("ihm_maintenance_log", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      workOrderId: text("work_order_id").notNull(),
      action: text("action").notNull(),
      // Installed | Removed | Replaced
      targetComponent: text("target_component"),
      targetSpare: text("target_spare"),
      quantity: decimal("quantity", { precision: 10, scale: 2 }),
      location: text("location"),
      materials: text("materials").array(),
      remarks: text("remarks"),
      vesselId: text("vessel_id").notNull().default("V001"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      userId: text("user_id").notNull()
    }, (table) => ({
      workOrderIdIdx: index("idx_ihm_log_wo_id").on(table.workOrderId),
      createdAtIdx: index("idx_ihm_log_created").on(table.createdAt)
    }));
    insertIhmMaintenanceLogSchema = createInsertSchema(ihmMaintenanceLog).omit({
      id: true,
      createdAt: true
    });
    spares = pgTable("spares", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      partCode: text("part_code").notNull(),
      partName: text("part_name").notNull(),
      componentId: text("component_id"),
      // Nullable for fleet spares
      componentCode: text("component_code"),
      componentName: text("component_name").notNull(),
      componentSpareCode: text("component_spare_code"),
      // Format: SP-<ComponentCode>-<NNN>
      critical: text("critical").notNull(),
      // 'Critical' | 'Non-Critical' | 'Yes' | 'No'
      rob: integer("rob").notNull().default(0),
      // Remaining on Board (total = robLocationA + robLocationB)
      robLocationA: integer("rob_location_a").notNull().default(0),
      // ROB in Location A
      robLocationB: integer("rob_location_b").notNull().default(0),
      // ROB in Location B
      min: integer("min").notNull().default(0),
      // Minimum stock
      max: integer("max"),
      // Maximum stock level
      unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
      // Cost per unit
      stockingNumber: text("stocking_number"),
      // Internal stocking reference
      leadTime: text("lead_time"),
      // Procurement lead time
      supplier: text("supplier"),
      // Supplier name
      lastOrderDate: text("last_order_date"),
      // Last procurement date (DD-MMM-YYYY format)
      location: text("location"),
      vesselId: text("vessel_id"),
      // Nullable - only required when dataScope='vessel'
      deleted: boolean("deleted").notNull().default(false),
      // Fleet-specific fields (when dataScope='fleet')
      dataScope: text("data_scope").notNull().default("vessel"),
      // 'fleet' | 'vessel'
      fleetEquipmentCode: text("fleet_equipment_code"),
      // Link to fleet component
      fleetPartCode: text("fleet_part_code"),
      // Auto-generated PT-XXXXXXX for fleet spares
      partNumber: text("part_number"),
      // Manufacturer's part number
      uom: text("uom"),
      // Unit of measurement
      drawingNumber: text("drawing_number"),
      // Drawing number from manual
      drawingNo: text("drawing_no"),
      // Drawing number reference from manual (user-specified)
      location2: text("location_2"),
      // Second storage location for spares stored in multiple locations
      remarks: text("remarks"),
      // User notes for spares
      unit: text("unit"),
      // Unit of measurement (user-specified)
      positionNumber: text("position_number"),
      // Position/reference number
      note: text("note"),
      // Additional information
      specification: text("specification"),
      // Technical specifications (size, dimensions, material)
      maker: text("maker"),
      // Manufacturer name
      makerCode: text("maker_code"),
      // Maker code reference
      model: text("model"),
      // Equipment model
      manualName: text("manual_name"),
      // Name of manual
      pageNumber: text("page_number"),
      // Page number in manual
      criticality: text("criticality"),
      // 'Yes' | 'No' for fleet spares
      isActive: boolean("is_active").default(true),
      // Active status for fleet spares
      ihm: text("ihm"),
      // IHM related text/number (legacy)
      ihmPresence: text("ihm_presence").default("UNKNOWN"),
      // YES | NO | UNKNOWN
      evidenceType: text("evidence_type"),
      // NONE | DOC | CERT | MSDS | OTHER
      partCategory: text("part_category"),
      // Category from master data
      applicableVesselIds: text("applicable_vessel_ids").array(),
      // Vessels that can use this fleet spare
      scopeNotes: text("scope_notes"),
      // Notes about scope applicability
      createdAt: timestamp("created_at").notNull().defaultNow(),
      createdBy: text("created_by"),
      // User who created the spare
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      updatedBy: text("updated_by")
      // User who last updated the spare
    }, (table) => ({
      componentIdIdx: index("idx_spare_component").on(table.componentId),
      vesselIdIdx: index("idx_spare_vessel").on(table.vesselId),
      componentSpareCodeIdx: index("idx_spare_code").on(table.vesselId, table.componentSpareCode),
      dataScopeIdx: index("idx_spare_data_scope").on(table.dataScope),
      fleetEquipmentCodeIdx: index("idx_spare_fleet_equipment").on(table.dataScope, table.fleetEquipmentCode),
      fleetPartCodeUniqueIdx: unique("unique_fleet_part_code").on(table.fleetPartCode, table.dataScope)
    }));
    insertSpareSchema = createInsertSchema(spares).omit({
      id: true,
      deleted: true,
      createdAt: true,
      updatedAt: true
    });
    sparesHistory = pgTable("spares_history", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      timestampUTC: timestamp("timestamp_utc").notNull(),
      vesselId: text("vessel_id").notNull(),
      spareId: integer("spare_id").notNull(),
      partCode: text("part_code").notNull(),
      partName: text("part_name").notNull(),
      componentId: text("component_id").notNull(),
      componentCode: text("component_code"),
      componentName: text("component_name").notNull(),
      componentSpareCode: text("component_spare_code"),
      // Component Spare Code at time of event
      eventType: text("event_type").notNull(),
      // 'CONSUME' | 'RECEIVE' | 'ADJUST' | 'CREATE' | 'EDIT' | 'LINK_CREATED' | 'CODE_RENUMBERED'
      qtyChange: integer("qty_change").notNull(),
      // positive for receive, negative for consume
      robAfter: integer("rob_after").notNull(),
      userId: text("user_id").notNull(),
      remarks: text("remarks"),
      reference: text("reference"),
      // Work Order or PO reference
      dateLocal: text("date_local"),
      // Local date of transaction
      tz: text("tz"),
      // Timezone
      place: text("place")
      // Port/Location for receive/consume
    }, (table) => ({
      timestampIdx: index("idx_history_timestamp").on(table.timestampUTC),
      spareIdIdx: index("idx_history_spare").on(table.spareId),
      eventTypeIdx: index("idx_history_event").on(table.eventType)
    }));
    insertSpareHistorySchema = createInsertSchema(sparesHistory).omit({
      id: true
    });
    storesLedger = pgTable("stores_ledger", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      section: text("section").notNull(),
      // 'stores' | 'lubes' | 'chemicals' | 'others'
      itemId: integer("item_id").notNull(),
      partCode: text("part_code").notNull(),
      itemName: text("item_name").notNull(),
      uom: text("uom"),
      // Base unit of measure
      eventType: text("event_type").notNull(),
      // 'RECEIVE' | 'CONSUME' | 'ADJUST' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ARCHIVE'
      qtyChangeBase: decimal("qty_change_base", { precision: 10, scale: 2 }).notNull(),
      // Change in base UOM
      qtyDisplay: decimal("qty_display", { precision: 10, scale: 2 }).notNull(),
      // Change in display UOM
      uomDisplay: text("uom_display"),
      // Display UOM (could be different from base)
      robAfterBase: decimal("rob_after_base", { precision: 10, scale: 2 }).notNull(),
      // ROB after in base UOM
      dateLocal: text("date_local").notNull(),
      // DD-MMM-YYYY HH:mm
      tz: text("tz").notNull(),
      // Timezone
      timestampUTC: timestamp("timestamp_utc").notNull(),
      place: text("place"),
      // For receive events
      ref: text("ref"),
      // PO/WO reference
      userId: text("user_id").notNull(),
      remarks: text("remarks")
    }, (table) => ({
      vesselSectionDateIdx: index("idx_vessel_section_date").on(table.vesselId, table.section, table.dateLocal),
      itemDateIdx: index("idx_item_date").on(table.itemId, table.dateLocal)
    }));
    insertStoresLedgerSchema = createInsertSchema(storesLedger).omit({
      id: true
    });
    storesItems = pgTable("stores_items", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      itemType: text("item_type").notNull(),
      // 'stores' | 'lubricants' | 'chemicals' | 'others'
      itemCode: text("item_code").notNull(),
      // Unique item identifier (Part Code)
      impaCode: text("impa_code"),
      // IMPA Code - standardization code for stores
      itemName: text("item_name").notNull(),
      // Item Name
      category: text("category"),
      // Category (General Stores, Electrical, Mechanical, Safety, etc.)
      specification: text("specification"),
      // Technical specs (size, dimensions, material)
      uom: text("uom"),
      // Unit of measurement
      rob: decimal("rob", { precision: 10, scale: 2 }).notNull().default("0"),
      // Remaining on Board (total)
      robLocationA: decimal("rob_location_a", { precision: 10, scale: 2 }).notNull().default("0"),
      // ROB at Location A
      robLocationB: decimal("rob_location_b", { precision: 10, scale: 2 }).notNull().default("0"),
      // ROB at Location B
      locationA: text("location_a"),
      // Primary storage location name (Location A)
      locationB: text("location_b"),
      // Secondary storage location name (Location B)
      min: decimal("min", { precision: 10, scale: 2 }).notNull().default("0"),
      // Minimum stock level
      max: decimal("max", { precision: 10, scale: 2 }),
      // Maximum stock level
      unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
      // Cost per unit
      supplier: text("supplier"),
      // Supplier name
      lastOrderDate: text("last_order_date"),
      // Last procurement date (DD-MMM-YYYY)
      leadTime: text("lead_time"),
      // Procurement lead time
      ihm: boolean("ihm").notNull().default(false),
      // Inventory of Hazardous Materials flag
      ihmDetails: text("ihm_details"),
      // IHM related information
      remarks: text("remarks"),
      // User notes
      deleted: boolean("deleted").notNull().default(false),
      // Soft delete flag
      isActive: boolean("is_active").notNull().default(true),
      // Active status
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      vesselIdIdx: index("idx_stores_vessel").on(table.vesselId),
      itemTypeIdx: index("idx_stores_item_type").on(table.itemType),
      itemCodeIdx: index("idx_stores_item_code").on(table.vesselId, table.itemCode),
      impaCodeIdx: index("idx_stores_impa_code").on(table.impaCode),
      deletedIdx: index("idx_stores_deleted").on(table.deleted)
    }));
    insertStoresItemSchema = createInsertSchema(storesItems).omit({
      id: true,
      deleted: true,
      createdAt: true,
      updatedAt: true
    });
    changeRequest = pgTable("change_request", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      category: text("category").notNull(),
      // 'components' | 'work_orders' | 'spares' | 'stores'
      title: text("title").notNull(),
      // max 120 chars enforced in application
      reason: text("reason").notNull(),
      targetType: text("target_type"),
      // 'component' | 'work_order' | 'spare' | 'store'
      targetId: text("target_id"),
      snapshotBeforeJson: json("snapshot_before_json"),
      proposedChangesJson: json("proposed_changes_json"),
      // Array of change objects
      movePreviewJson: json("move_preview_json"),
      // Component move preview (nullable)
      status: text("status").notNull().default("draft"),
      // 'draft' | 'submitted' | 'returned' | 'approved' | 'rejected'
      requestedByUserId: text("requested_by_user_id").notNull(),
      submittedAt: timestamp("submitted_at"),
      reviewedByUserId: text("reviewed_by_user_id"),
      reviewedAt: timestamp("reviewed_at"),
      // Rule #17: Revision tracking for Modify PMS
      revisionNumber: integer("revision_number").notNull().default(0),
      // Incremented on each approval
      revisionHistory: json("revision_history").$type().default([]),
      // History of all revisions
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      vesselCategoryIdx: index("idx_vessel_category").on(table.vesselId, table.category),
      statusIdx: index("idx_change_request_status").on(table.status)
    }));
    insertChangeRequestSchema = createInsertSchema(changeRequest).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    changeRequestAttachment = pgTable("change_request_attachment", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      changeRequestId: integer("change_request_id").notNull(),
      filename: text("filename").notNull(),
      url: text("url").notNull(),
      uploadedByUserId: text("uploaded_by_user_id").notNull(),
      uploadedAt: timestamp("uploaded_at").notNull().defaultNow()
    }, (table) => ({
      changeRequestIdx: index("idx_change_request").on(table.changeRequestId)
    }));
    insertChangeRequestAttachmentSchema = createInsertSchema(changeRequestAttachment).omit({
      id: true,
      uploadedAt: true
    });
    changeRequestComment = pgTable("change_request_comment", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      changeRequestId: integer("change_request_id").notNull(),
      userId: text("user_id").notNull(),
      message: text("message").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      changeRequestIdx: index("idx_change_request_comment").on(table.changeRequestId)
    }));
    insertChangeRequestCommentSchema = createInsertSchema(changeRequestComment).omit({
      id: true,
      createdAt: true
    });
    alertPolicies = pgTable("alert_policies", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      alertType: text("alert_type").notNull(),
      // 'maintenance_due' | 'running_hours' | 'critical_inventory' | 'certificate_expiration' | 'system_backup'
      enabled: boolean("enabled").notNull().default(true),
      priority: text("priority").notNull().default("medium"),
      // 'low' | 'medium' | 'high'
      emailEnabled: boolean("email_enabled").notNull().default(false),
      inAppEnabled: boolean("in_app_enabled").notNull().default(true),
      thresholds: text("thresholds").notNull().default("{}"),
      // JSON string for type-specific thresholds
      scopeFilters: text("scope_filters").notNull().default("{}"),
      // JSON string for filters
      recipients: text("recipients").notNull().default("{}"),
      // JSON string for recipient configuration
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: text("created_by").notNull(),
      updatedBy: text("updated_by").notNull()
    });
    insertAlertPolicySchema = createInsertSchema(alertPolicies).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    alertEvents = pgTable("alert_events", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      policyId: integer("policy_id").notNull(),
      alertType: text("alert_type").notNull(),
      priority: text("priority").notNull(),
      objectType: text("object_type"),
      // 'work_order' | 'component' | 'spare' | 'certificate' | 'system'
      objectId: text("object_id"),
      vesselId: text("vessel_id"),
      dedupeKey: text("dedupe_key").notNull(),
      state: text("state"),
      // 'due' | 'overdue' | 'low' | 'critical' | 'expired' | 'failed' etc
      payload: text("payload").notNull(),
      // JSON string with all event details
      ackBy: text("ack_by"),
      ackAt: timestamp("ack_at"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      dedupeKeyIdx: index("idx_dedupe_key").on(table.dedupeKey, table.createdAt),
      policyIdx: index("idx_policy_events").on(table.policyId, table.createdAt)
    }));
    insertAlertEventSchema = createInsertSchema(alertEvents).omit({
      id: true,
      createdAt: true
    });
    alertDeliveries = pgTable("alert_deliveries", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      eventId: integer("event_id").notNull(),
      channel: text("channel").notNull(),
      // 'email' | 'in_app' | 'sms' | 'slack'
      recipient: text("recipient").notNull(),
      // email address, user ID, phone number, etc
      status: text("status").notNull().default("pending"),
      // 'pending' | 'sent' | 'failed' | 'acknowledged'
      errorMessage: text("error_message"),
      sentAt: timestamp("sent_at"),
      acknowledgedAt: timestamp("acknowledged_at"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      eventIdx: index("idx_event_deliveries").on(table.eventId, table.channel),
      recipientIdx: index("idx_recipient_deliveries").on(table.recipient, table.status)
    }));
    insertAlertDeliverySchema = createInsertSchema(alertDeliveries).omit({
      id: true,
      createdAt: true
    });
    alertConfig = pgTable("alert_config", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
      quietHoursStart: text("quiet_hours_start"),
      // HH:mm format
      quietHoursEnd: text("quiet_hours_end"),
      // HH:mm format
      escalationEnabled: boolean("escalation_enabled").notNull().default(false),
      escalationHours: integer("escalation_hours").notNull().default(4),
      escalationRecipients: text("escalation_recipients").notNull().default("[]"),
      // JSON array of recipients
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      updatedBy: text("updated_by").notNull()
    });
    insertAlertConfigSchema = createInsertSchema(alertConfig).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    jobs = pgTable("jobs", {
      id: text("id").primaryKey(),
      vesselId: text("vessel_id"),
      componentId: text("component_id").notNull(),
      // Component this job belongs to
      componentCode: text("component_code").notNull(),
      componentName: text("component_name").notNull(),
      jobNo: text("job_no").notNull(),
      // Auto-generated JOB-XXXXXXX (not globally unique - same job_no can exist across vessels/components)
      jobTitle: text("job_title").notNull(),
      assignedTo: text("assigned_to"),
      maintenanceType: text("maintenance_type"),
      // 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
      maintenanceBasis: text("maintenance_basis"),
      // 'Calendar' | 'Running Hours'
      frequencyType: text("frequency_type"),
      // Alias for maintenanceBasis for compliance
      frequencyValue: text("frequency_value"),
      frequencyUnit: text("frequency_unit"),
      // 'Months' | 'Years' | 'Weeks' | 'Days' | 'Hours'
      intervalRunningHour: integer("interval_running_hour"),
      leadTimeValue: integer("lead_time_value"),
      // Lead time before job becomes due
      leadTimeUnit: text("lead_time_unit"),
      // 'Days' | 'Weeks' | 'Months'
      initialNextDue: text("initial_next_due"),
      // Initial due date for calendar-based jobs
      lastDoneDate: text("last_done_date"),
      // Last completion date (DD-MMM-YYYY format)
      nextDueDate: text("next_due_date"),
      // Calculated: lastDoneDate + frequencyValue + frequencyUnit (for Calendar-based jobs)
      lastDoneRH: text("last_done_rh"),
      // Last completion running hours (for RH-based jobs)
      nextDueRH: text("next_due_rh"),
      // Calculated: lastDoneRH + frequencyValue (for RH-based jobs)
      jobPriority: text("job_priority"),
      // 'Low' | 'Medium' | 'High' | 'Critical'
      classRelated: text("class_related"),
      // 'Yes' | 'No'
      briefWorkDescription: text("brief_work_description"),
      jobDescription: text("job_description"),
      // Detailed job description
      approver: text("approver"),
      // Rank who approves the job
      department: text("department"),
      // Template data (Part A)
      requiredSpareParts: json("required_spare_parts").notNull().default([]),
      requiredTools: json("required_tools").notNull().default([]),
      safetyRequirements: json("safety_requirements").notNull().default({ ppeRequirements: [], permitRequirements: [], otherRequirements: [] }),
      // Fleet-specific fields
      dataScope: text("data_scope").notNull().default("vessel"),
      // 'fleet' | 'vessel'
      fleetEquipmentCode: text("fleet_equipment_code"),
      fleetJobCode: text("fleet_job_code"),
      sfiCode: text("sfi_code"),
      criticality: text("criticality"),
      isActive: boolean("is_active").default(true),
      estimatedManHours: decimal("estimated_man_hours", { precision: 6, scale: 2 }),
      // Estimated man-hours for workload planning
      createdBy: text("created_by"),
      // User who created the job
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedBy: text("updated_by"),
      // User who last updated the job
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      vesselIdIdx: index("idx_job_vessel").on(table.vesselId),
      componentIdIdx: index("idx_job_component").on(table.componentId),
      componentCodeIdx: index("idx_job_component_code").on(table.componentCode),
      dataScopeIdx: index("idx_job_data_scope").on(table.dataScope),
      nextDueDateIdx: index("idx_job_next_due").on(table.nextDueDate)
    }));
    insertJobSchema2 = createInsertSchema(jobs).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    workOrders = pgTable("work_orders", {
      id: text("id").primaryKey(),
      vesselId: text("vessel_id"),
      // Nullable - only required when dataScope='vessel'
      component: text("component").notNull(),
      componentCode: text("component_code"),
      jobId: text("job_id"),
      // Reference to jobs.id for reliable lead time hydration
      workOrderNo: text("work_order_no").notNull(),
      workOrderType: text("work_order_type").notNull().default("Planned"),
      // 'Planned' | 'Unplanned'
      templateCode: text("template_code"),
      executionId: text("execution_id"),
      jobTitle: text("job_title").notNull(),
      assignedTo: text("assigned_to").notNull(),
      dueDate: text("due_date"),
      // ISO date string, nullable for fleet jobs
      status: text("status").notNull().default("Active"),
      // 'Completed' | 'Due' | 'Due (Grace P)' | 'Overdue' | 'Postponed' | 'Pending Approval' | 'Active'
      dateCompleted: text("date_completed"),
      submittedDate: text("submitted_date"),
      formData: json("form_data"),
      // Form submission data
      taskType: text("task_type"),
      // 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
      maintenanceType: text("maintenance_type"),
      // 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
      maintenanceBasis: text("maintenance_basis"),
      // 'Calendar' | 'Running Hours'
      frequencyValue: text("frequency_value"),
      frequencyUnit: text("frequency_unit"),
      // 'Months' | 'Years' | 'Weeks' | 'Days'
      approverRemarks: text("approver_remarks"),
      isExecution: boolean("is_execution").notNull().default(false),
      templateId: text("template_id"),
      approver: text("approver"),
      approvalDate: text("approval_date"),
      rejectionDate: text("rejection_date"),
      nextDueDate: text("next_due_date"),
      nextDueReading: text("next_due_reading"),
      currentReading: text("current_reading"),
      classRelated: text("class_related"),
      // 'Yes' | 'No'
      jobPriority: text("job_priority"),
      // 'Low' | 'Medium' | 'High' | 'Critical'
      briefWorkDescription: text("brief_work_description"),
      // Fleet-specific fields (when dataScope='fleet')
      dataScope: text("data_scope").notNull().default("vessel"),
      // 'fleet' | 'vessel'
      fleetEquipmentCode: text("fleet_equipment_code"),
      // Link to fleet component
      fleetJobCode: text("fleet_job_code"),
      // Auto-generated WO-XXXXXXX for fleet jobs
      jobGroup: text("job_group"),
      // Grouping/categorization for fleet jobs
      jobCategory: text("job_category"),
      // Category from master data
      sfiCode: text("sfi_code"),
      // SFI classification code
      maintenanceIntervalValue: integer("maintenance_interval_value"),
      // Numeric interval value
      maintenanceIntervalUnit: text("maintenance_interval_unit"),
      // Unit from master data
      intervalRunningHour: integer("interval_running_hour"),
      // Running hour interval
      department: text("department"),
      // Department from master data
      criticality: text("criticality"),
      // 'Yes' | 'No' for fleet jobs
      isActive: boolean("is_active").default(true),
      // Active status for fleet jobs
      applicableVesselIds: text("applicable_vessel_ids").array(),
      // Vessels that can use this fleet job
      scopeNotes: text("scope_notes"),
      // Notes about scope applicability
      // Postponement fields (Rule #5 - Postponed WO Reappearance)
      postponementEndDate: text("postponement_end_date"),
      // When postponement expires, WO should revert to Due status
      postponementReason: text("postponement_reason"),
      // Reason for postponement
      postponementAuthorizedBy: text("postponement_authorized_by"),
      // Who authorized the postponement
      // On-demand WO generation fields (Rule #4)
      onDemandReason: text("on_demand_reason"),
      // 'Planning' | 'Breakdown' | 'Other' - for WOs generated before frequency reached
      // Work Order Form Arrays (Part A - Template)
      requiredSpareParts: json("required_spare_parts").notNull().default([]),
      // [{partNo, description, quantityRequired, remarks}]
      requiredTools: json("required_tools").notNull().default([]),
      // [{toolName, quantity, remarks}]
      safetyRequirements: json("safety_requirements").notNull().default({ ppeRequirements: [], permitRequirements: [], otherRequirements: [] }),
      // {ppeRequirements: [], permitRequirements: [], otherRequirements: []}
      // Work Order Form Arrays (Part B - Execution)
      uploadedDocuments: json("uploaded_documents").notNull().default([]),
      // [{type: 'riskAssessment'|'safetyChecklist'|'operationalForm', fileName, fileKey, uploadedAt, uploadedBy}]
      consumedSpareParts: json("consumed_spare_parts").notNull().default([]),
      // [{partNo, description, quantityConsumed, comments, location: 'A'|'B'}]
      // Part B Execution Fields (B1 - Risk Assessment, Checklists & Records)
      riskAssessmentStatus: text("risk_assessment_status"),
      // 'Yes' | 'No' | 'NA'
      safetyChecklistsStatus: text("safety_checklists_status"),
      // 'Yes' | 'No' | 'NA'
      operationalFormsStatus: text("operational_forms_status"),
      // 'Yes' | 'No' | 'NA'
      // Part B Execution Fields (B2 - Work Duration)
      startDateTime: text("start_date_time"),
      // ISO datetime string
      completionDateTime: text("completion_date_time"),
      // ISO datetime string
      executionAssignedTo: text("execution_assigned_to"),
      // Rank assigned during execution
      performedBy: text("performed_by"),
      // Rank who performed the work
      noOfPersons: text("no_of_persons"),
      // Number of persons in team
      totalTimeHours: text("total_time_hours"),
      // Total time taken in hours
      manhours: text("manhours"),
      // Manhours calculation
      workCarriedOut: text("work_carried_out"),
      // Description of work performed
      jobExperienceNotes: text("job_experience_notes"),
      // Job experience/notes
      // Part B Execution Fields (B3 - Running Hours)
      previousReading: text("previous_reading"),
      // Previous RH reading
      runningHours: text("running_hours"),
      // Current RH at completion
      runningHoursDifference: text("running_hours_difference"),
      // Difference between current and previous reading
      readingDate: text("reading_date"),
      // Date of running hours reading
      // Part B Execution Metadata
      woExecutionId: text("wo_execution_id"),
      // Unique execution ID (WOE-XXXXXXX)
      remarks: text("remarks"),
      // General remarks
      completionRemarks: text("completion_remarks"),
      // Remarks upon completion
      // Approval workflow fields
      rejectionComments: text("rejection_comments"),
      // Comments when work order is rejected by approver
      approvalAction: text("approval_action"),
      // 'approved' | 'rejected' - action taken by approver
      // === WO Generation Cycle Snapshots (for duplicate protection and audit) ===
      // Driver type determines which cycle fields apply
      driverType: text("driver_type"),
      // 'RH' | 'CALENDAR' - from job's maintenanceBasis
      // RH-based WO cycle snapshots (Trigger 1)
      cycleDueRhSnapshot: decimal("cycle_due_rh_snapshot", { precision: 10, scale: 2 }),
      // RH_due = RH_last_done + F
      generateRhSnapshot: decimal("generate_rh_snapshot", { precision: 10, scale: 2 }),
      // RH_generate = RH_due - LT
      dueRhSnapshot: decimal("due_rh_snapshot", { precision: 10, scale: 2 }),
      // RH_due (duplicated for clarity)
      effectiveRhAtGeneration: decimal("effective_rh_at_generation", { precision: 10, scale: 2 }),
      // RH_effective_current at WO creation
      rhLastDoneSnapshot: decimal("rh_last_done_snapshot", { precision: 10, scale: 2 }),
      // RH_last_done stored at WO creation
      // Calendar-based WO cycle snapshots (Trigger 2)
      cycleDueDateSnapshot: text("cycle_due_date_snapshot"),
      // DUE_DATE = last_done_date + F_days (ISO date)
      generateDateSnapshot: text("generate_date_snapshot"),
      // GENERATE_DATE = DUE_DATE - LT_days (ISO date)
      dueDateSnapshot: text("due_date_snapshot"),
      // DUE_DATE (duplicated for clarity)
      lastDoneDateSnapshot: text("last_done_date_snapshot"),
      // last_done_date stored at WO creation
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      vesselIdIdx: index("idx_wo_vessel").on(table.vesselId),
      statusIdx: index("idx_wo_status").on(table.status),
      dueDateIdx: index("idx_wo_due_date").on(table.dueDate),
      componentCodeIdx: index("idx_wo_component").on(table.componentCode),
      templateCodeIdx: index("idx_wo_template").on(table.templateCode),
      dataScopeIdx: index("idx_wo_data_scope").on(table.dataScope),
      fleetEquipmentCodeIdx: index("idx_wo_fleet_equipment").on(table.dataScope, table.fleetEquipmentCode),
      fleetJobCodeUniqueIdx: unique("unique_fleet_job_code").on(table.fleetJobCode, table.dataScope),
      // Index for cycle-based duplicate protection (job_id + cycle_due)
      jobIdCycleRhIdx: index("idx_wo_job_cycle_rh").on(table.jobId, table.cycleDueRhSnapshot),
      jobIdCycleDateIdx: index("idx_wo_job_cycle_date").on(table.jobId, table.cycleDueDateSnapshot)
    }));
    insertWorkOrderSchema = createInsertSchema(workOrders).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      // Make workOrderNo optional since backend auto-generates it for unplanned WOs
      workOrderNo: z.string().optional()
    });
    workOrderExecutions = pgTable("work_order_executions", {
      id: text("id").primaryKey(),
      templateId: text("template_id").notNull(),
      // Reference to work_orders (template)
      componentId: text("component_id").notNull(),
      // Component this execution belongs to
      vesselId: text("vessel_id").notNull(),
      // Vessel identifier
      executionId: text("execution_id").notNull().unique(),
      // Unique execution code (WOE-XXXXXXX)
      // Execution tracking
      dateCompleted: text("date_completed"),
      // ISO date when work was completed (format: DD-MMM-YYYY HH:mm for consistency)
      runningHoursAtCompletion: decimal("running_hours_at_completion", { precision: 10, scale: 2 }),
      // Running hours when work was completed
      performedBy: text("performed_by"),
      // User who performed the work
      approvedBy: text("approved_by"),
      // User who approved the work
      status: text("status").notNull().default("In Progress"),
      // 'In Progress' | 'Completed' | 'Approved'
      // Execution data (Section B fields)
      uploadedDocuments: json("uploaded_documents").notNull().default([]),
      // [{type, fileName, fileKey, uploadedAt, uploadedBy}]
      consumedSpareParts: json("consumed_spare_parts").notNull().default([]),
      // [{partNo, description, quantityConsumed, comments}]
      // Additional execution details
      workDescription: text("work_description"),
      // What was actually done
      remarks: text("remarks"),
      // Any additional notes
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      templateIdIdx: index("idx_exec_template").on(table.templateId),
      componentIdIdx: index("idx_exec_component").on(table.componentId),
      vesselIdIdx: index("idx_exec_vessel").on(table.vesselId),
      statusIdx: index("idx_exec_status").on(table.status),
      dateCompletedIdx: index("idx_exec_date_completed").on(table.dateCompleted)
    }));
    insertWorkOrderExecutionSchema = createInsertSchema(workOrderExecutions).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    defects = pgTable("defects", {
      id: text("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      vesselName: text("vessel_name").notNull(),
      issueDate: text("issue_date").notNull(),
      // ISO format YYYY-MM-DD
      category: text("category").notNull(),
      // 'Defect' | 'COC' | 'Observation' | 'NCR'
      defectType: text("defect_type"),
      // 'Routine' | 'Corrective' | 'Emergency'
      description: text("description").notNull(),
      descriptionHtml: text("description_html"),
      // Rich text HTML version
      descriptionText: text("description_text"),
      // Plain text version for search
      actionTakenRequested: text("action_taken_requested"),
      // Renamed from targetDate to targetCloseDate
      targetCloseDate: text("target_close_date"),
      // ISO format YYYY-MM-DD
      dateCompleted: text("date_completed"),
      // ISO format YYYY-MM-DD
      status: text("status").notNull().default("Open"),
      // 'Open' | 'Pending' | 'In-Progress' | 'Awaiting Parts' | 'Deferred' | 'Closed' | 'Cancelled'
      priority: text("priority").default("Medium"),
      // 'Low' | 'Medium' | 'High'
      critical: boolean("critical").notNull().default(false),
      is_coc: boolean("is_coc").notNull().default(false),
      // Condition of Class flag
      severity: integer("severity").default(1),
      // 1-Minor, 2-Moderate, 3-Major
      source: text("source"),
      // 'SIRE' | 'PSC' | 'Internal' | 'Class'
      equipmentCategory: text("equipment_category"),
      // 'Deck' | 'Navigation' | 'Machinery' | etc.
      equipmentType: text("equipment_type"),
      equipmentMake: text("equipment_make"),
      equipmentModel: text("equipment_model"),
      equipmentSerialNo: text("equipment_serial_no"),
      // Serial No field from screenshot
      equipmentLocation: text("equipment_location"),
      // Location field from screenshot
      equipmentSystem: text("equipment_system"),
      // System field from screenshot
      componentId: text("component_id"),
      // Link to PMS component
      purchaseOrderRef: text("purchase_order_ref"),
      responsibleDept: text("responsible_dept"),
      // Responsible Dept from screenshot
      verifiedDate: text("verified_date"),
      // ISO format YYYY-MM-DD
      defectCategory: text("defect_category"),
      // Additional defect category field
      viqVersion: text("viq_version"),
      // VIQ VER (VIQ 7 or SIRE 2.0)
      viqRef: text("viq_ref"),
      // VIQ REF (e.g., 1.1, 2.3, 5.12)
      viqChapter: text("viq_chapter"),
      // VIQ Chapter (e.g., General Information, Safety Management)
      viqSection: text("viq_section"),
      // VIQ Section (detailed section within chapter)
      sfiCodeRef: text("sfi_code_ref"),
      // SFI Code Reference
      immediateCause: json("immediate_cause"),
      // Structured immediate cause with unsafe acts and conditions
      immediateCauseExplanation: text("immediate_cause_explanation"),
      // Further explanation
      rootCause: json("root_cause"),
      // Structured root cause with individual and system factors
      rootCauseExplanation: text("root_cause_explanation"),
      // Further explanation
      holdReason: text("hold_reason"),
      // For On Hold status
      nextReviewDate: text("next_review_date"),
      // ISO format YYYY-MM-DD
      // NEW FIELDS FOR DEFECT MODULE ENHANCEMENTS
      // Seed tracking for dev/test data
      seedId: text("seed_id"),
      // For idempotent seeding of test data
      // Recurring Defects tracking
      equipment_key: text("equipment_key"),
      // Normalized key for tracking same equipment
      // 1. Raised By (Who Raised the Defect)
      raisedById: text("raised_by_id"),
      raisedByName: text("raised_by_name"),
      raisedByRank: text("raised_by_rank"),
      // 2. Operating Condition / Location
      operatingCondition: text("operating_condition"),
      // 'SAILING' | 'PORT' | 'ANCHOR'
      locationText: text("location_text"),
      // 3. Routine / Breakdown
      occurrenceType: text("occurrence_type"),
      // 'ROUTINE' | 'BREAKDOWN'
      // 4. Responsible Role
      responsibleRole: text("responsible_role"),
      responsibleRoleId: text("responsible_role_id"),
      // 6. Deferment Procedure
      isDeferred: boolean("is_deferred").notNull().default(false),
      deferReason: text("defer_reason"),
      deferNewTargetDate: text("defer_new_target_date"),
      // ISO format YYYY-MM-DD
      deferApprovalRequired: boolean("defer_approval_required").default(true),
      // 7. Third-Party Reporting
      reportToThirdParty: boolean("report_to_third_party").notNull().default(false),
      classReport: boolean("class_report").notNull().default(false),
      flagReport: boolean("flag_report").notNull().default(false),
      portReport: boolean("port_report").notNull().default(false),
      reportReferenceNo: text("report_reference_no"),
      reportDate: text("report_date"),
      // ISO format YYYY-MM-DD
      // 8. Vessel Location (At Port / At Sea)
      vesselLocationType: text("vessel_location_type"),
      // 'atPort' | 'atSea'
      portName: text("port_name"),
      // When vesselLocationType is 'atPort'
      latitude: text("latitude"),
      // When vesselLocationType is 'atSea'
      longitude: text("longitude"),
      // When vesselLocationType is 'atSea'
      vesselLocationDetail: text("vessel_location_detail"),
      // Additional location detail dropdown
      // Legacy fields (kept for backward compatibility)
      reportedBy: text("reported_by").notNull(),
      assignedTo: text("assigned_to"),
      reviewedBy: text("reviewed_by"),
      // Closure fields
      closedBy: text("closed_by"),
      closedOn: text("closed_on"),
      // ISO format YYYY-MM-DD HH:MM:SS
      closureComment: text("closure_comment"),
      closureFiles: text("closure_files").array(),
      // Array of file URLs
      // Linked defects
      linkedDefects: text("linked_defects").array(),
      // Array of defect IDs
      // Notes
      notes: json("notes").$type().default([]),
      // Actions (stored inline for form wizard)
      actions: json("actions").$type(),
      // Attachments (stored inline for form wizard)
      attachments: json("attachments").$type(),
      // Audit trail
      auditTrail: json("audit_trail").$type().default([]),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      vesselIdIdx: index("idx_defect_vessel").on(table.vesselId),
      statusIdx: index("idx_defect_status").on(table.status),
      issueDateIdx: index("idx_defect_issue_date").on(table.issueDate),
      categoryIdx: index("idx_defect_category").on(table.category),
      criticalIdx: index("idx_defect_critical").on(table.critical),
      componentIdIdx: index("idx_defect_component").on(table.componentId)
    }));
    insertDefectSchema = createInsertSchema(defects).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    defectActions = pgTable("defect_actions", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      defectId: text("defect_id").notNull(),
      actionType: text("action_type").notNull(),
      // 'Corrective' | 'Preventive' | 'Containment' | 'Long-term fix'
      actionDescription: text("action_description").notNull(),
      proposedBy: text("proposed_by").notNull(),
      responsibility: text("responsibility").notNull(),
      // user/role responsible
      dueDate: text("due_date").notNull(),
      // DD-MM-YYYY format
      dateCompleted: text("date_completed"),
      // DD-MM-YYYY format
      status: text("status").notNull().default("Open"),
      // 'Open' | 'In Progress' | 'Closed'
      justification: text("justification"),
      // Required if due date is pushed after overdue
      attachmentUrls: text("attachment_urls").array(),
      // Evidence attachments
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      defectIdIdx: index("idx_action_defect").on(table.defectId),
      statusIdx: index("idx_action_status").on(table.status),
      dueDateIdx: index("idx_action_due_date").on(table.dueDate),
      responsibilityIdx: index("idx_action_responsibility").on(table.responsibility)
    }));
    insertDefectActionSchema = createInsertSchema(defectActions).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    defectAttachments = pgTable("defect_attachments", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      defectId: text("defect_id").notNull(),
      filename: text("filename").notNull(),
      url: text("url").notNull(),
      attachmentType: text("attachment_type").notNull(),
      // 'photo' | 'document' | 'evidence'
      uploadedBy: text("uploaded_by").notNull(),
      uploadedAt: timestamp("uploaded_at").notNull().defaultNow()
    }, (table) => ({
      defectIdIdx: index("idx_attachment_defect").on(table.defectId),
      typeIdx: index("idx_attachment_type").on(table.attachmentType)
    }));
    insertDefectAttachmentSchema = createInsertSchema(defectAttachments).omit({
      id: true,
      uploadedAt: true
    });
    recurringDefects = pgTable("recurring_defects", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      equipmentKey: text("equipment_key").notNull(),
      windowMonths: integer("window_months").notNull().default(12),
      occurrenceCount: integer("occurrence_count").notNull(),
      openCount: integer("open_count").notNull(),
      vesselsAffected: integer("vessels_affected").notNull(),
      lastOccurrenceDate: text("last_occurrence_date").notNull(),
      // DD-MM-YYYY format
      hasCoc: boolean("has_coc").notNull().default(false),
      mtbfDays: numeric("mtbf_days"),
      // Average days between occurrences
      updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      equipmentKeyWindowIdx: index("idx_recurring_key_window").on(table.equipmentKey, table.windowMonths),
      updatedAtIdx: index("idx_recurring_updated").on(table.updatedAt)
    }));
    insertRecurringDefectSchema = createInsertSchema(recurringDefects).omit({
      id: true,
      updatedAt: true
    });
    recurringDefectLinks = pgTable("recurring_defect_links", {
      recurringId: integer("recurring_id").notNull().references(() => recurringDefects.id, { onDelete: "cascade" }),
      defectId: text("defect_id").notNull().references(() => defects.id, { onDelete: "cascade" })
    }, (table) => ({
      pk: primaryKey({ columns: [table.recurringId, table.defectId] }),
      recurringIdx: index("idx_link_recurring").on(table.recurringId),
      defectIdx: index("idx_link_defect").on(table.defectId)
    }));
    insertRecurringDefectLinkSchema = createInsertSchema(recurringDefectLinks);
    importHistory = pgTable("import_history", {
      id: text("id").primaryKey(),
      type: text("type").notNull(),
      // 'components' | 'spares' | 'stores' | 'jobs'
      mode: text("mode").notNull(),
      // 'add' | 'update' | 'upsert'
      archiveMissing: boolean("archive_missing").notNull().default(false),
      userId: text("user_id").notNull(),
      vesselId: text("vessel_id"),
      created: integer("created").notNull().default(0),
      updated: integer("updated").notNull().default(0),
      skipped: integer("skipped").notNull().default(0),
      archived: integer("archived").notNull().default(0),
      startedAt: timestamp("started_at").notNull().defaultNow(),
      finishedAt: timestamp("finished_at"),
      status: text("status").notNull(),
      // 'complete' | 'failed' | 'undone' | 'undo_failed'
      originalName: text("original_name"),
      // Original uploaded filename
      fileSize: integer("file_size"),
      // File size in bytes
      storedFilePath: text("stored_file_path"),
      // Object storage path to the uploaded file
      undoneAt: timestamp("undone_at"),
      // Timestamp when import was undone
      errorMessage: text("error_message")
      // Error message if import or undo failed
    }, (table) => ({
      typeIdx: index("idx_import_history_type").on(table.type),
      startedAtIdx: index("idx_import_history_started").on(table.startedAt),
      vesselIdx: index("idx_import_history_vessel").on(table.vesselId)
    }));
    importChangeLog = pgTable("import_change_log", {
      id: text("id").primaryKey(),
      importHistoryId: text("import_history_id").notNull().references(() => importHistory.id, { onDelete: "cascade" }),
      entityType: text("entity_type").notNull(),
      // 'component' | 'job' | 'spare' | 'store'
      entityId: text("entity_id").notNull(),
      // ID of the affected record
      operation: text("operation").notNull(),
      // 'created' | 'updated' | 'archived'
      previousData: json("previous_data"),
      // Full snapshot before change (for updated/archived)
      newData: json("new_data"),
      // Minimal snapshot after change
      checksum: text("checksum").notNull(),
      // Hash of the record at time of change for conflict detection
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      importHistoryIdx: index("idx_change_log_import").on(table.importHistoryId),
      entityIdx: index("idx_change_log_entity").on(table.entityType, table.entityId)
    }));
    insertImportHistorySchema = createInsertSchema(importHistory).omit({
      startedAt: true
    });
    insertImportChangeLogSchema = createInsertSchema(importChangeLog).omit({
      createdAt: true
    });
    makers = pgTable("makers", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      makerCode: text("maker_code").notNull().unique(),
      // Auto-generated: MKR-000001
      makerName: text("maker_name").notNull(),
      address: text("address"),
      addressId: text("address_id"),
      // Address identifier code
      contactPerson: text("contact_person"),
      email: text("email"),
      phone: text("phone"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      makerCodeIdx: index("idx_maker_code").on(table.makerCode),
      makerNameIdx: index("idx_maker_name").on(table.makerName)
    }));
    insertMakerSchema = createInsertSchema(makers).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      makerCode: z.string().optional()
      // Optional - auto-generated if not provided
    });
    masterLists = pgTable("master_lists", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      listType: text("list_type").notNull(),
      // 'department', 'rank', 'intervalUnit', etc.
      listKey: text("list_key").notNull(),
      // Unique key for the value
      listValue: text("list_value").notNull(),
      // Display value
      displayOrder: integer("display_order").notNull().default(0),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => [
      index("idx_master_list_type").on(table.listType),
      unique("unique_list_type_key").on(table.listType, table.listKey)
    ]);
    insertMasterListSchema = createInsertSchema(masterLists).omit({
      id: true,
      createdAt: true
    });
    fleetEquipmentMaster = pgTable("fleet_equipment_master", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      fleetEquipmentCode: text("fleet_equipment_code").notNull().unique(),
      // Unique identifier (XXX.XXX.XX format)
      fleetEquipmentName: text("fleet_equipment_name").notNull(),
      // General name from SFI booklet
      maker: text("maker"),
      // Manufacturer name
      makerCode: text("maker_code"),
      // Unique code for maker
      model: text("model"),
      // Equipment model
      modelCode: text("model_code"),
      // Combination of Maker Code + Model
      description: text("description"),
      // Additional description
      isActive: boolean("is_active").notNull().default(true),
      createdBy: text("created_by").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedBy: text("updated_by"),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      fleetEquipmentCodeIdx: index("idx_fleet_equipment_code").on(table.fleetEquipmentCode),
      makerCodeIdx: index("idx_fleet_maker_code").on(table.makerCode),
      modelCodeIdx: index("idx_fleet_model_code").on(table.modelCode)
    }));
    insertFleetEquipmentMasterSchema = createInsertSchema(fleetEquipmentMaster).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    componentRunningHoursLog = pgTable("component_running_hours_log", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselCode: text("vessel_code").notNull(),
      componentCode: text("component_code").notNull(),
      componentId: text("component_id").notNull(),
      previousRh: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
      newRh: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
      deltaRh: decimal("delta_rh", { precision: 10, scale: 2 }).notNull(),
      // Change in running hours (can be negative for corrections)
      updatedBy: text("updated_by").notNull(),
      // User ID who made the change
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      updateSource: text("update_source").notNull(),
      // 'manual' | 'cascade' | 'bulk_import' | 'work_order'
      notes: text("notes"),
      // Optional notes for the update
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      componentCodeIdx: index("idx_rh_log_component_code").on(table.componentCode),
      vesselCodeIdx: index("idx_rh_log_vessel_code").on(table.vesselCode),
      updatedAtIdx: index("idx_rh_log_updated_at").on(table.updatedAt),
      updateSourceIdx: index("idx_rh_log_update_source").on(table.updateSource)
    }));
    insertComponentRunningHoursLogSchema = createInsertSchema(componentRunningHoursLog).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    auditLog = pgTable("audit_log", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      timestamp: timestamp("timestamp").notNull().defaultNow(),
      userId: text("user_id").notNull(),
      // User who made the change
      vesselCode: text("vessel_code"),
      // Vessel context (nullable for fleet-level changes)
      componentCode: text("component_code"),
      // Component context (nullable)
      entityType: text("entity_type").notNull(),
      // 'component' | 'job' | 'work_order' | 'spare' | 'document' | 'survey' | 'maintenance_history'
      entityId: text("entity_id").notNull(),
      // ID of the affected entity
      actionType: text("action_type").notNull(),
      // 'create' | 'update' | 'delete' | 'approve' | 'reject'
      fieldName: text("field_name"),
      // Specific field changed (nullable for create/delete)
      oldValue: text("old_value"),
      // Previous value (JSON string for complex objects)
      newValue: text("new_value"),
      // New value (JSON string for complex objects)
      source: text("source").notNull(),
      // 'web_ui' | 'api' | 'bulk_import' | 'system' | 'modify_pms'
      payload: json("payload")
      // Additional context (e.g., full snapshot, metadata)
    }, (table) => ({
      timestampIdx: index("idx_audit_timestamp").on(table.timestamp),
      userIdIdx: index("idx_audit_user_id").on(table.userId),
      vesselCodeIdx: index("idx_audit_vessel_code").on(table.vesselCode),
      entityTypeIdx: index("idx_audit_entity_type").on(table.entityType),
      entityIdIdx: index("idx_audit_entity_id").on(table.entityId),
      actionTypeIdx: index("idx_audit_action_type").on(table.actionType)
    }));
    insertAuditLogSchema = createInsertSchema(auditLog).omit({
      id: true,
      timestamp: true
    });
    componentDocuments = pgTable("component_documents", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      componentId: text("component_id").notNull(),
      componentCode: text("component_code").notNull(),
      vesselCode: text("vessel_code").notNull(),
      fleetEquipmentCode: text("fleet_equipment_code"),
      // Link to fleet equipment for auto-preloading
      fileName: text("file_name").notNull(),
      fileKey: text("file_key").notNull(),
      // Object storage key
      fileType: text("file_type").notNull(),
      // 'Manual' | 'Drawing' | 'OEM Doc' | 'Catalogue' | 'Certificate' | 'Other'
      fileSize: integer("file_size"),
      // File size in bytes
      version: text("version").notNull().default("1.0"),
      // Document version for future versioning support
      uploadedBy: text("uploaded_by").notNull(),
      uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
      canShipView: boolean("can_ship_view").notNull().default(true),
      // Ship users can view
      canShipDownload: boolean("can_ship_download").notNull().default(false),
      // Ship users can download
      isActive: boolean("is_active").notNull().default(true),
      notes: text("notes"),
      // Additional notes about the document
      storageBackend: text("storage_backend").default("object")
      // 'object' for cloud storage, 'local' for filesystem
    }, (table) => ({
      componentIdIdx: index("idx_doc_component_id").on(table.componentId),
      componentCodeIdx: index("idx_doc_component_code").on(table.componentCode),
      vesselCodeIdx: index("idx_doc_vessel_code").on(table.vesselCode),
      fleetEquipmentCodeIdx: index("idx_doc_fleet_equipment_code").on(table.fleetEquipmentCode),
      fileTypeIdx: index("idx_doc_file_type").on(table.fileType)
    }));
    insertComponentDocumentSchema = createInsertSchema(componentDocuments).omit({
      id: true,
      uploadedAt: true
    });
    componentClassRegulatory = pgTable("component_class_regulatory", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      componentId: text("component_id").notNull(),
      componentCode: text("component_code").notNull(),
      vesselCode: text("vessel_code").notNull(),
      classificationSociety: text("classification_society").notNull(),
      // 'DNV' | 'ABS' | 'Lloyd\'s Register' | 'ClassNK' | 'RINA' | 'IRS'
      surveyType: text("survey_type").notNull(),
      // 'Annual Survey' | '5-Year Survey' | 'Intermediate Survey' | 'Damage Survey' | 'OEM Test' | 'Statutory Requirement' | 'Internal Company Requirement'
      certificateNumber: text("certificate_number"),
      issueDate: text("issue_date"),
      // DD-MMM-YYYY format
      expiryDate: text("expiry_date"),
      // DD-MMM-YYYY format
      lastClassSurvey: text("last_class_survey"),
      // DD-MMM-YYYY format
      nextSurveyDue: text("next_survey_due"),
      // DD-MMM-YYYY format
      classRequirements: text("class_requirements"),
      // Text description of requirements
      surveyStatus: text("survey_status").notNull().default("Active"),
      // 'Active' | 'Expired' | 'Pending' | 'Cancelled'
      remarks: text("remarks"),
      createdBy: text("created_by").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedBy: text("updated_by"),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      componentIdIdx: index("idx_class_component_id").on(table.componentId),
      componentCodeIdx: index("idx_class_component_code").on(table.componentCode),
      vesselCodeIdx: index("idx_class_vessel_code").on(table.vesselCode),
      surveyTypeIdx: index("idx_class_survey_type").on(table.surveyType),
      expiryDateIdx: index("idx_class_expiry_date").on(table.expiryDate)
    }));
    insertComponentClassRegulatorySchema = createInsertSchema(componentClassRegulatory).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    componentMaintenanceHistory = pgTable("component_maintenance_history", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      componentId: text("component_id").notNull(),
      componentCode: text("component_code").notNull(),
      vesselCode: text("vessel_code").notNull(),
      workOrderId: text("work_order_id").notNull(),
      // Link to completed work order
      workOrderNo: text("work_order_no").notNull(),
      jobTitle: text("job_title").notNull(),
      maintenanceType: text("maintenance_type").notNull(),
      // 'Inspection' | 'Overhaul' | 'Servicing' | 'Testing' | 'Cleaning' | 'Lubrication' | 'Replacement'
      dateCompleted: text("date_completed").notNull(),
      // Stored as ISO (YYYY-MM-DD) for sorting, displayed as DD-MMM-YYYY
      runningHoursAtCompletion: decimal("running_hours_at_completion", { precision: 10, scale: 2 }),
      performedBy: text("performed_by").notNull(),
      approvedBy: text("approved_by"),
      approvalDate: text("approval_date"),
      // Stored as ISO (YYYY-MM-DD) for sorting, displayed as DD-MMM-YYYY
      status: text("status").notNull().default("Approved"),
      // Only 'Approved' entries shown in history
      workDescription: text("work_description"),
      sparesUsed: json("spares_used"),
      // [{partCode, partName, quantity}]
      remarks: text("remarks"),
      isComponentReplaced: boolean("is_component_replaced").notNull().default(false),
      // Special flag for component replacement
      createdAt: timestamp("created_at").notNull().defaultNow()
      // IMMUTABLE - no updates/deletes allowed
    }, (table) => ({
      componentIdIdx: index("idx_history_component_id").on(table.componentId),
      componentCodeIdx: index("idx_history_component_code").on(table.componentCode),
      vesselCodeIdx: index("idx_history_vessel_code").on(table.vesselCode),
      workOrderIdIdx: index("idx_history_work_order_id").on(table.workOrderId),
      dateCompletedIdx: index("idx_history_date_completed").on(table.dateCompleted)
    }));
    insertComponentMaintenanceHistorySchema = createInsertSchema(componentMaintenanceHistory).omit({
      id: true,
      createdAt: true
    });
    componentRequisitions = pgTable("component_requisitions", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      requisitionNo: text("requisition_no").notNull().unique(),
      // REQ-V001-2024-001 format
      componentId: text("component_id").notNull(),
      componentCode: text("component_code").notNull(),
      vesselCode: text("vessel_code").notNull(),
      raisedOn: text("raised_on").notNull(),
      // DD-MMM-YYYY format
      itemOrService: text("item_or_service").notNull(),
      // Description of item or service requested
      relatedPartCode: text("related_part_code"),
      // Link to spare part code from Section E
      relatedPartName: text("related_part_name"),
      // Spare part name for display
      quantity: integer("quantity").notNull().default(1),
      uom: text("uom").default("EA"),
      // Unit of measure
      status: text("status").notNull().default("Draft"),
      // 'Draft' | 'Submitted' | 'RFQ Sent' | 'PO Raised' | 'Ordered' | 'Delivered On Board' | 'Cancelled'
      priority: text("priority").notNull().default("Normal"),
      // 'Normal' | 'Urgent' | 'Critical'
      requestedBy: text("requested_by").notNull(),
      approvedBy: text("approved_by"),
      approvalDate: text("approval_date"),
      purchaseOrderNo: text("purchase_order_no"),
      // PO reference once raised
      expectedDelivery: text("expected_delivery"),
      // Expected delivery date
      actualDelivery: text("actual_delivery"),
      // Actual delivery date
      supplier: text("supplier"),
      // Selected supplier
      estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
      actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
      remarks: text("remarks"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      componentIdIdx: index("idx_req_component_id").on(table.componentId),
      componentCodeIdx: index("idx_req_component_code").on(table.componentCode),
      vesselCodeIdx: index("idx_req_vessel_code").on(table.vesselCode),
      statusIdx: index("idx_req_status").on(table.status),
      requisitionNoIdx: index("idx_req_no").on(table.requisitionNo)
    }));
    insertComponentRequisitionSchema = createInsertSchema(componentRequisitions).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    pmsVesselSettings = pgTable("pms_vessel_settings", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull().unique(),
      // Unique per vessel
      // Calendar-based jobs settings
      calendarLeadDaysCritical: integer("calendar_lead_days_critical").notNull().default(7),
      // Days before due for critical jobs
      calendarLeadDaysNonCritical: integer("calendar_lead_days_non_critical").notNull().default(14),
      // Days before due for non-critical jobs
      calendarGraceMode: text("calendar_grace_mode").notNull().default("COMPANY_STANDARD"),
      // 'COMPANY_STANDARD' | 'CUSTOM_DAYS'
      calendarGraceDays: integer("calendar_grace_days").notNull().default(7),
      // Custom grace period days (used when mode = CUSTOM_DAYS)
      // Running-hour based jobs settings  
      rhLeadHoursCritical: integer("rh_lead_hours_critical").notNull().default(50),
      // Hours before due for critical RH jobs
      rhLeadHoursNonCritical: integer("rh_lead_hours_non_critical").notNull().default(100),
      // Hours before due for non-critical RH jobs
      rhGraceHours: integer("rh_grace_hours").notNull().default(168),
      // Grace period hours for escalation (default 168 = 1 week)
      // Spare Parts Location Names (customizable per vessel)
      locationAName: text("location_a_name").notNull().default("Location A"),
      // Custom name for Location A
      locationBName: text("location_b_name").notNull().default("Location B"),
      // Custom name for Location B
      // Audit fields
      updatedBy: text("updated_by").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      vesselIdIdx: index("idx_pms_settings_vessel_id").on(table.vesselId)
    }));
    insertPmsVesselSettingsSchema = createInsertSchema(pmsVesselSettings).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    makerList = pgTable("maker_list", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      makerCode: text("maker_code").notNull().unique(),
      // Unique identifier for maker
      makerName: text("maker_name").notNull(),
      // Full manufacturer name
      address: text("address"),
      // Manufacturer address
      addressId: text("address_id"),
      // Address reference ID
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      makerCodeIdx: index("idx_maker_list_code").on(table.makerCode),
      makerNameIdx: index("idx_maker_list_name").on(table.makerName)
    }));
    insertMakerListSchema = createInsertSchema(makerList).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    sfiDetails = pgTable("sfi_details", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      componentCode: text("component_code").notNull().unique(),
      // SFI component code (e.g., 711.001)
      componentName: text("component_name").notNull(),
      // Standard SFI name
      description: text("description"),
      // Additional description
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      sfiCodeIdx: index("idx_sfi_component_code").on(table.componentCode)
    }));
    insertSfiDetailsSchema = createInsertSchema(sfiDetails).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    masterData = pgTable("master_data", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      slNo: integer("sl_no"),
      // Serial number for tracking
      makerName: text("maker_name").notNull(),
      // Manufacturer name from Maker List
      makerCode: text("maker_code").notNull(),
      // Unique code from Maker List
      countMaker: integer("count_maker"),
      // Internal counter for maker grouping
      model: text("model").notNull(),
      // Model name/number from manufacturer
      modelCode: text("model_code").notNull(),
      // Combination of Maker Code + Model
      countSfiCode: integer("count_sfi_code"),
      // Counter for SFI codes
      fleetEquipmentCode: text("fleet_equipment_code").notNull().unique(),
      // System-generated: SFI.SEQ (e.g., 722.001.AA)
      sfiCode: text("sfi_code").notNull(),
      // 7-digit SFI classification code
      assignedSubCode: text("assigned_sub_code"),
      // Sub-code under SFI for finer grouping
      vesselName: text("vessel_name"),
      // Vessel where equipment was first created
      vesselCode: text("vessel_code"),
      // Vessel code
      equipmentName: text("equipment_name").notNull(),
      // Descriptive name of equipment
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      fleetEquipmentCodeIdx: index("idx_master_data_fleet_code").on(table.fleetEquipmentCode),
      sfiCodeIdx: index("idx_master_data_sfi").on(table.sfiCode),
      makerCodeIdx: index("idx_master_data_maker").on(table.makerCode),
      modelCodeIdx: index("idx_master_data_model").on(table.modelCode)
    }));
    insertMasterDataSchema = createInsertSchema(masterData).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    fleetVesselMapping = pgTable("fleet_vessel_mapping", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      fleetEquipmentCode: text("fleet_equipment_code").notNull(),
      // From masterData or components
      vesselCode: text("vessel_code").notNull(),
      // Vessel identifier
      vesselName: text("vessel_name"),
      // Vessel display name
      mappedBy: text("mapped_by").notNull(),
      // User who created mapping
      mappedAt: timestamp("mapped_at").notNull().defaultNow(),
      isActive: boolean("is_active").notNull().default(true)
    }, (table) => ({
      fleetCodeIdx: index("idx_fleet_vessel_mapping_fleet").on(table.fleetEquipmentCode),
      vesselCodeIdx: index("idx_fleet_vessel_mapping_vessel").on(table.vesselCode),
      uniqueMapping: unique("unique_fleet_vessel_mapping").on(table.fleetEquipmentCode, table.vesselCode)
    }));
    insertFleetVesselMappingSchema = createInsertSchema(fleetVesselMapping).omit({
      id: true,
      mappedAt: true
    });
    fleetComponentMapping = pgTable("fleet_component_mapping", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      fleetEquipmentCode: text("fleet_equipment_code").notNull(),
      // Fleet equipment identifier
      vesselCode: text("vessel_code").notNull(),
      // Vessel identifier
      componentCode: text("component_code").notNull(),
      // Vessel-specific component code
      componentId: text("component_id"),
      // Reference to components table
      componentName: text("component_name"),
      // Display name
      mappedBy: text("mapped_by").notNull(),
      // User who created mapping
      mappedAt: timestamp("mapped_at").notNull().defaultNow(),
      isActive: boolean("is_active").notNull().default(true)
    }, (table) => ({
      fleetCodeIdx: index("idx_fleet_comp_mapping_fleet").on(table.fleetEquipmentCode),
      vesselCodeIdx: index("idx_fleet_comp_mapping_vessel").on(table.vesselCode),
      componentCodeIdx: index("idx_fleet_comp_mapping_component").on(table.componentCode),
      uniqueMapping: unique("unique_fleet_component_mapping").on(table.fleetEquipmentCode, table.vesselCode, table.componentCode)
    }));
    insertFleetComponentMappingSchema = createInsertSchema(fleetComponentMapping).omit({
      id: true,
      mappedAt: true
    });
    fleetJobVesselMapping = pgTable("fleet_job_vessel_mapping", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      fleetEquipmentCode: text("fleet_equipment_code").notNull(),
      // Equipment the job belongs to
      jobCode: text("job_code").notNull(),
      // Fleet job code
      jobId: text("job_id"),
      // Reference to jobs table
      vesselCode: text("vessel_code").notNull(),
      // Vessel identifier
      vesselName: text("vessel_name"),
      // Vessel display name
      mappedBy: text("mapped_by").notNull(),
      // User who created mapping
      mappedAt: timestamp("mapped_at").notNull().defaultNow(),
      isActive: boolean("is_active").notNull().default(true)
    }, (table) => ({
      fleetCodeIdx: index("idx_fleet_job_mapping_fleet").on(table.fleetEquipmentCode),
      jobCodeIdx: index("idx_fleet_job_mapping_job").on(table.jobCode),
      vesselCodeIdx: index("idx_fleet_job_mapping_vessel").on(table.vesselCode),
      uniqueMapping: unique("unique_fleet_job_vessel_mapping").on(table.jobCode, table.vesselCode)
    }));
    insertFleetJobVesselMappingSchema = createInsertSchema(fleetJobVesselMapping).omit({
      id: true,
      mappedAt: true
    });
    fleetSpareVesselMapping = pgTable("fleet_spare_vessel_mapping", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      fleetEquipmentCode: text("fleet_equipment_code").notNull(),
      // Equipment the spare belongs to
      partCode: text("part_code").notNull(),
      // Fleet spare part code
      spareId: text("spare_id"),
      // Reference to spares table
      vesselCode: text("vessel_code").notNull(),
      // Vessel identifier
      vesselName: text("vessel_name"),
      // Vessel display name
      mappedBy: text("mapped_by").notNull(),
      // User who created mapping
      mappedAt: timestamp("mapped_at").notNull().defaultNow(),
      isActive: boolean("is_active").notNull().default(true)
    }, (table) => ({
      fleetCodeIdx: index("idx_fleet_spare_mapping_fleet").on(table.fleetEquipmentCode),
      partCodeIdx: index("idx_fleet_spare_mapping_part").on(table.partCode),
      vesselCodeIdx: index("idx_fleet_spare_mapping_vessel").on(table.vesselCode),
      uniqueMapping: unique("unique_fleet_spare_vessel_mapping").on(table.partCode, table.vesselCode)
    }));
    insertFleetSpareVesselMappingSchema = createInsertSchema(fleetSpareVesselMapping).omit({
      id: true,
      mappedAt: true
    });
    bulkImportHistory = pgTable("bulk_import_history", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselCode: text("vessel_code"),
      // Null for fleet-level imports
      vesselName: text("vessel_name"),
      moduleType: text("module_type").notNull(),
      // 'Machinery' | 'Jobs' | 'Spares' | 'Stores' | 'Fleet_Component' | 'Fleet_Job' | 'Fleet_Spare'
      sheetName: text("sheet_name"),
      // Which sheet was imported (for multi-sheet templates)
      fileName: text("file_name").notNull(),
      // Original file name
      fileSize: integer("file_size"),
      // File size in bytes
      uploadedBy: text("uploaded_by").notNull(),
      // User who uploaded
      uploadedByName: text("uploaded_by_name"),
      // User display name
      uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
      totalRows: integer("total_rows").notNull().default(0),
      // Total data rows in file
      successCount: integer("success_count").notNull().default(0),
      // Successfully imported
      failedCount: integer("failed_count").notNull().default(0),
      // Failed rows
      skippedCount: integer("skipped_count").notNull().default(0),
      // Skipped (duplicates, etc.)
      status: text("status").notNull().default("Processing"),
      // 'Processing' | 'Completed' | 'Failed' | 'Partial'
      errorSummary: text("error_summary"),
      // Brief summary of errors
      isFleetImport: boolean("is_fleet_import").notNull().default(false),
      // True if Fleet Data Import mode
      templateVersion: text("template_version"),
      // Version of template used
      processingTimeMs: integer("processing_time_ms")
      // How long import took
    }, (table) => ({
      vesselCodeIdx: index("idx_bulk_import_vessel").on(table.vesselCode),
      moduleTypeIdx: index("idx_bulk_import_module").on(table.moduleType),
      uploadedAtIdx: index("idx_bulk_import_date").on(table.uploadedAt),
      statusIdx: index("idx_bulk_import_status").on(table.status)
    }));
    insertBulkImportHistorySchema = createInsertSchema(bulkImportHistory).omit({
      id: true,
      uploadedAt: true
    });
    bulkImportErrors = pgTable("bulk_import_errors", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      importId: integer("import_id").notNull(),
      // Reference to bulkImportHistory
      rowNumber: integer("row_number").notNull(),
      // Row number in Excel (1-indexed)
      fieldName: text("field_name"),
      // Which field had the error
      fieldValue: text("field_value"),
      // Value that caused error
      errorType: text("error_type").notNull(),
      // 'Required' | 'Format' | 'Duplicate' | 'Reference' | 'Validation'
      errorDescription: text("error_description").notNull(),
      // Human-readable error message
      recommendedFix: text("recommended_fix"),
      // Suggested solution
      severity: text("severity").notNull().default("Error"),
      // 'Error' | 'Warning' | 'Info'
      rawRowData: json("raw_row_data"),
      // Original row data for debugging
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      importIdIdx: index("idx_bulk_error_import").on(table.importId),
      rowNumberIdx: index("idx_bulk_error_row").on(table.importId, table.rowNumber),
      errorTypeIdx: index("idx_bulk_error_type").on(table.errorType)
    }));
    insertBulkImportErrorSchema = createInsertSchema(bulkImportErrors).omit({
      id: true,
      createdAt: true
    });
    certificates = pgTable("certificates", {
      id: text("id").primaryKey(),
      // Certificate ID like C1, C2, etc.
      certificateName: text("certificate_name").notNull(),
      type: text("type").notNull(),
      // 'Flag' | 'Class' | 'Statutory'
      vessel: text("vessel").notNull(),
      // Vessel name
      vesselId: text("vessel_id"),
      // Optional vessel ID reference
      issueDate: text("issue_date"),
      // DD MMM YYYY format
      expiryDate: text("expiry_date"),
      // DD MMM YYYY format
      lastAnnual: text("last_annual"),
      // DD MMM YYYY format
      lastInterm: text("last_interm"),
      // DD MMM YYYY format (Interim)
      endorsementDate: text("endorsement_date"),
      // DD MMM YYYY format
      lastEditUpload: text("last_edit_upload"),
      // DD MMM YYYY format
      applicable: boolean("applicable").notNull().default(true),
      attachments: json("attachments").$type().default([]),
      // Array of file attachments
      notes: text("notes"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      vesselIdx: index("idx_certificates_vessel").on(table.vessel),
      typeIdx: index("idx_certificates_type").on(table.type),
      expiryIdx: index("idx_certificates_expiry").on(table.expiryDate)
    }));
    insertCertificateSchema = createInsertSchema(certificates).omit({
      createdAt: true,
      updatedAt: true
    });
    surveys = pgTable("surveys", {
      id: text("id").primaryKey(),
      // Survey ID like S1, S2, etc.
      surveyName: text("survey_name").notNull(),
      type: text("type").notNull(),
      // 'Annual' | 'Int' (Intermediate) | 'Special' | 'Renewal'
      vessel: text("vessel").notNull(),
      // Vessel name
      vesselId: text("vessel_id"),
      // Optional vessel ID reference
      surveyDate: text("survey_date"),
      // DD MMM YYYY format - Last survey date
      dueDate: text("due_date"),
      // DD MMM YYYY format - Next due date
      firstRangeDate: text("first_range_date"),
      // DD MMM YYYY format - Window start
      secondRangeDate: text("second_range_date"),
      // DD MMM YYYY format - Window end
      postponed: text("postponed"),
      // DD MMM YYYY format - Postponed date if any
      lastEdit: text("last_edit"),
      // DD MMM YYYY format - Last modification date
      applicable: boolean("applicable").notNull().default(true),
      attachments: json("attachments").$type().default([]),
      // Array of file attachments
      notes: text("notes"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      vesselIdx: index("idx_surveys_vessel").on(table.vessel),
      typeIdx: index("idx_surveys_type").on(table.type),
      dueDateIdx: index("idx_surveys_due").on(table.dueDate)
    }));
    insertSurveySchema = createInsertSchema(surveys).omit({
      createdAt: true,
      updatedAt: true
    });
    workOrderExecutionDetails = pgTable("work_order_execution_details", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      workOrderId: text("work_order_id").notNull(),
      // Reference to work_orders
      vesselId: text("vessel_id").notNull(),
      executedBy: text("executed_by"),
      // User who performed the work
      executedDate: text("executed_date"),
      // DD-MMM-YYYY format
      completionNotes: text("completion_notes"),
      partsUsed: json("parts_used").$type().default([]),
      // Array of parts consumed
      toolsUsed: json("tools_used").$type().default([]),
      // Array of tools used
      laborHours: decimal("labor_hours", { precision: 6, scale: 2 }),
      findings: text("findings"),
      // Observations during execution
      recommendations: text("recommendations"),
      nextActionRequired: text("next_action_required"),
      qualityCheckBy: text("quality_check_by"),
      qualityCheckDate: text("quality_check_date"),
      qualityCheckNotes: text("quality_check_notes"),
      attachments: json("attachments").$type().default([]),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      workOrderIdx: index("idx_exec_details_wo").on(table.workOrderId),
      vesselIdx: index("idx_exec_details_vessel").on(table.vesselId),
      executedDateIdx: index("idx_exec_details_date").on(table.executedDate)
    }));
    insertWorkOrderExecutionDetailsSchema = createInsertSchema(workOrderExecutionDetails).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    inventoryEventTypeEnum = pgEnum("inventory_event_type", [
      "RECEIVE",
      "CONSUME",
      "ADJUST_OPENING_BALANCE",
      "ADJUST_CORRECTION"
    ]);
    inventoryReferenceTypeEnum = pgEnum("inventory_reference_type", [
      "WORK_ORDER",
      "MANUAL",
      "EXCEL_IMPORT"
    ]);
    ihmPresenceEnum = pgEnum("ihm_presence", ["YES", "NO", "UNKNOWN"]);
    ihmEvidenceTypeEnum = pgEnum("ihm_evidence_type", ["NONE", "DOC", "CERT", "MSDS", "OTHER"]);
    locations = pgTable("locations", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      locationName: text("location_name").notNull(),
      // Unique per vessel, trimmed + case-normalized
      locationType: text("location_type"),
      // STORE/LOCKER/BOX/etc.
      createdAt: timestamp("created_at").notNull().defaultNow(),
      createdBy: text("created_by").notNull()
    }, (table) => ({
      vesselLocationIdx: index("idx_location_vessel").on(table.vesselId),
      uniqueVesselLocation: unique("unique_vessel_location").on(table.vesselId, table.locationName)
    }));
    insertLocationSchema = createInsertSchema(locations).omit({
      id: true,
      createdAt: true
    });
    spareComponentLinks = pgTable("spare_component_links", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      spareId: integer("spare_id").notNull(),
      // FK → spares.id
      componentId: text("component_id").notNull(),
      // FK → components.id
      linkedBy: text("linked_by").notNull(),
      linkedAt: timestamp("linked_at").notNull().defaultNow()
    }, (table) => ({
      spareIdIdx: index("idx_spare_component_link_spare").on(table.spareId),
      componentIdIdx: index("idx_spare_component_link_component").on(table.componentId),
      vesselIdIdx: index("idx_spare_component_link_vessel").on(table.vesselId),
      uniqueSpareComponent: unique("unique_spare_component_link").on(table.spareId, table.componentId)
    }));
    insertSpareComponentLinkSchema = createInsertSchema(spareComponentLinks).omit({
      id: true,
      linkedAt: true
    });
    spareLocationStock = pgTable("spare_location_stock", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      spareId: integer("spare_id").notNull(),
      // FK → spares.id
      locationId: integer("location_id").notNull(),
      // FK → locations.id
      qty: integer("qty").notNull().default(0)
      // Must never go negative
    }, (table) => ({
      spareIdIdx: index("idx_spare_location_stock_spare").on(table.spareId),
      locationIdIdx: index("idx_spare_location_stock_location").on(table.locationId),
      vesselIdIdx: index("idx_spare_location_stock_vessel").on(table.vesselId),
      uniqueSpareLocation: unique("unique_spare_location_stock").on(table.spareId, table.locationId)
    }));
    insertSpareLocationStockSchema = createInsertSchema(spareLocationStock).omit({
      id: true
    });
    inventoryTransactions = pgTable("inventory_transactions", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      txnDatetime: timestamp("txn_datetime").notNull().defaultNow(),
      spareId: integer("spare_id").notNull(),
      // FK → spares.id
      locationId: integer("location_id"),
      // Nullable only if non-location specific; for consume/receive MUST set
      eventType: text("event_type").notNull(),
      // RECEIVE | CONSUME | ADJUST_OPENING_BALANCE | ADJUST_CORRECTION
      qtyChange: integer("qty_change").notNull(),
      // Positive for receive, negative for consume
      robTotalBefore: integer("rob_total_before").notNull(),
      robTotalAfter: integer("rob_total_after").notNull(),
      robLocationBefore: integer("rob_location_before"),
      // Nullable if non-location specific
      robLocationAfter: integer("rob_location_after"),
      // Nullable if non-location specific
      referenceType: text("reference_type").notNull(),
      // WORK_ORDER | MANUAL | EXCEL_IMPORT
      referenceId: text("reference_id"),
      // WO number, import batch id, etc.
      referenceNote: text("reference_note"),
      // Free text
      userId: text("user_id").notNull()
    }, (table) => ({
      vesselIdIdx: index("idx_inventory_txn_vessel").on(table.vesselId),
      spareIdIdx: index("idx_inventory_txn_spare").on(table.spareId),
      locationIdIdx: index("idx_inventory_txn_location").on(table.locationId),
      txnDatetimeIdx: index("idx_inventory_txn_datetime").on(table.txnDatetime),
      eventTypeIdx: index("idx_inventory_txn_event").on(table.eventType),
      referenceTypeIdx: index("idx_inventory_txn_ref_type").on(table.referenceType)
    }));
    insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({
      id: true,
      txnDatetime: true
    });
    INVENTORY_EVENT_TYPES = ["RECEIVE", "CONSUME", "ADJUST_OPENING_BALANCE", "ADJUST_CORRECTION"];
    INVENTORY_REFERENCE_TYPES = ["WORK_ORDER", "MANUAL", "EXCEL_IMPORT"];
    IHM_PRESENCE_VALUES = ["YES", "NO", "UNKNOWN"];
    IHM_EVIDENCE_TYPES = ["NONE", "DOC", "CERT", "MSDS", "OTHER"];
    inventoryTransactionInputSchema = z.object({
      vesselId: z.string(),
      spareId: z.number(),
      locationId: z.number().optional(),
      eventType: z.enum(INVENTORY_EVENT_TYPES),
      qtyChange: z.number(),
      referenceType: z.enum(INVENTORY_REFERENCE_TYPES),
      referenceId: z.string().optional(),
      referenceNote: z.string().optional(),
      userId: z.string()
    });
    jobComponentLinks = pgTable("job_component_links", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      vesselId: text("vessel_id").notNull(),
      jobId: text("job_id").notNull(),
      // FK → jobs.id (UUID)
      componentId: text("component_id").notNull(),
      // FK → components.id (UUID)
      componentCode: text("component_code"),
      // Denormalized for faster lookups
      linkedBy: text("linked_by").notNull(),
      linkedAt: timestamp("linked_at").notNull().defaultNow()
    }, (table) => ({
      jobIdIdx: index("idx_job_component_link_job").on(table.jobId),
      componentIdIdx: index("idx_job_component_link_component").on(table.componentId),
      vesselIdIdx: index("idx_job_component_link_vessel").on(table.vesselId),
      uniqueJobComponent: unique("unique_job_component_link").on(table.jobId, table.componentId)
    }));
    insertJobComponentLinkSchema = createInsertSchema(jobComponentLinks).omit({
      id: true,
      linkedAt: true
    });
  }
});

// server/postgresClient.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
async function resolvePostgres() {
  if (cacheInitialized) {
    return cachedPostgres || void 0;
  }
  if (!process.env.DATABASE_URL) {
    cacheInitialized = true;
    cachedPostgres = null;
    return void 0;
  }
  try {
    const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });
    const db2 = drizzle(pool2, { schema: schema_exports });
    await db2.execute(sql`SELECT 1`);
    cachedPostgres = { db: db2, pool: pool2 };
    cacheInitialized = true;
    return cachedPostgres;
  } catch (error) {
    cacheInitialized = true;
    cachedPostgres = null;
    throw new Error(
      `PostgreSQL connection failed despite DATABASE_URL being set: ${error.message}. Check database credentials and network connectivity.`
    );
  }
}
var cachedPostgres, cacheInitialized;
var init_postgresClient = __esm({
  "server/postgresClient.ts"() {
    "use strict";
    init_schema();
    cachedPostgres = null;
    cacheInitialized = false;
  }
});

// server/db.ts
import { Pool as Pool2 } from "pg";
import { drizzle as drizzle2 } from "drizzle-orm/node-postgres";
async function getDb() {
  const postgres = await resolvePostgres();
  if (!postgres) {
    throw new Error("PostgreSQL is not available (DATABASE_URL not configured)");
  }
  return postgres.db;
}
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_postgresClient();
    if (process.env.DATABASE_URL) {
      pool = new Pool2({ connectionString: process.env.DATABASE_URL });
      db = drizzle2(pool, { schema: schema_exports });
    }
  }
});

// server/postgresStorage.ts
import { eq, and, desc, sql as sql2, inArray, or, ilike, asc, gte, lte } from "drizzle-orm";
var PostgresStorage, postgresStorage;
var init_postgresStorage = __esm({
  "server/postgresStorage.ts"() {
    "use strict";
    init_db();
    init_schema();
    PostgresStorage = class {
      // ============= USERS (Module 1) =============
      async getUser(id) {
        const db2 = await getDb();
        const result = await db2.select().from(users).where(eq(users.id, id));
        return result[0];
      }
      async getUserByUsername(username) {
        const db2 = await getDb();
        const result = await db2.select().from(users).where(eq(users.username, username));
        return result[0];
      }
      async createUser(user) {
        const db2 = await getDb();
        const result = await db2.insert(users).values(user).returning();
        return result[0];
      }
      async getUsers() {
        const db2 = await getDb();
        return await db2.select().from(users);
      }
      async updateUser(id, data) {
        const db2 = await getDb();
        const result = await db2.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
        if (!result[0]) {
          throw new Error(`User ${id} not found`);
        }
        return result[0];
      }
      async deleteUser(id) {
        const db2 = await getDb();
        await db2.delete(users).where(eq(users.id, id));
      }
      // ============= FLEETS (Module 1) =============
      async getFleets() {
        const db2 = await getDb();
        return await db2.select().from(fleets);
      }
      async getFleet(id) {
        const db2 = await getDb();
        const result = await db2.select().from(fleets).where(eq(fleets.id, id));
        return result[0];
      }
      async getFleetByCode(code) {
        const db2 = await getDb();
        const result = await db2.select().from(fleets).where(eq(fleets.code, code));
        return result[0];
      }
      async createFleet(fleet) {
        const db2 = await getDb();
        const result = await db2.insert(fleets).values(fleet).returning();
        return result[0];
      }
      async updateFleet(id, data) {
        const db2 = await getDb();
        const result = await db2.update(fleets).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(fleets.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Fleet ${id} not found`);
        }
        return result[0];
      }
      async deleteFleet(id) {
        const db2 = await getDb();
        await db2.delete(fleets).where(eq(fleets.id, id));
      }
      // ============= VESSELS (Module 1) =============
      async getVessels() {
        const db2 = await getDb();
        const result = await db2.select().from(vessels);
        return result.map((v) => ({
          id: v.id,
          name: v.name,
          code: v.code
        }));
      }
      async getVessel(id) {
        const db2 = await getDb();
        const result = await db2.select().from(vessels).where(eq(vessels.id, id));
        return result[0];
      }
      async getVesselByCode(code) {
        const db2 = await getDb();
        const result = await db2.select().from(vessels).where(eq(vessels.code, code));
        return result[0];
      }
      async getVesselIdByName(vesselName) {
        const db2 = await getDb();
        const result = await db2.select().from(vessels).where(eq(vessels.name, vesselName));
        return result[0]?.id;
      }
      async createVessel(vessel) {
        const db2 = await getDb();
        const result = await db2.insert(vessels).values(vessel).returning();
        return result[0];
      }
      async updateVessel(id, data) {
        const db2 = await getDb();
        const result = await db2.update(vessels).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(vessels.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Vessel ${id} not found`);
        }
        return result[0];
      }
      async deleteVessel(id) {
        const db2 = await getDb();
        await db2.delete(vessels).where(eq(vessels.id, id));
      }
      // ============= PMS VESSEL SETTINGS (Module 1) =============
      async getPmsVesselSettings(vesselId) {
        const db2 = await getDb();
        const result = await db2.select().from(pmsVesselSettings).where(eq(pmsVesselSettings.vesselId, vesselId));
        return result[0];
      }
      async getAllPmsVesselSettings() {
        const db2 = await getDb();
        return await db2.select().from(pmsVesselSettings);
      }
      async createPmsVesselSettings(settings) {
        const db2 = await getDb();
        const result = await db2.insert(pmsVesselSettings).values(settings).returning();
        return result[0];
      }
      async updatePmsVesselSettings(id, data) {
        const db2 = await getDb();
        const result = await db2.update(pmsVesselSettings).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(pmsVesselSettings.id, id)).returning();
        if (!result[0]) {
          throw new Error(`PMS Vessel Settings ${id} not found`);
        }
        return result[0];
      }
      async upsertPmsVesselSettings(settings) {
        const existing = await this.getPmsVesselSettings(settings.vesselId);
        if (existing) {
          return await this.updatePmsVesselSettings(existing.id, settings);
        } else {
          return await this.createPmsVesselSettings(settings);
        }
      }
      async deletePmsVesselSettings(id) {
        const db2 = await getDb();
        await db2.delete(pmsVesselSettings).where(eq(pmsVesselSettings.id, id));
      }
      // ============= MODULE 2: MAKERS =============
      async getMakers(search) {
        const db2 = await getDb();
        if (search) {
          const searchPattern = `%${search}%`;
          const result = await db2.select().from(makers).where(or(
            ilike(makers.makerName, searchPattern),
            ilike(makers.makerCode, searchPattern)
          )).orderBy(asc(makers.makerName));
          return result;
        }
        return await db2.select().from(makers).orderBy(asc(makers.makerName));
      }
      async getMakerById(id) {
        const db2 = await getDb();
        const result = await db2.select().from(makers).where(eq(makers.id, id));
        return result[0];
      }
      async createMaker(maker) {
        const db2 = await getDb();
        let makerCode = maker.makerCode;
        if (!makerCode) {
          const allMakers = await db2.select({ id: makers.id }).from(makers);
          const nextId = allMakers.length > 0 ? Math.max(...allMakers.map((m) => m.id)) + 1 : 1;
          makerCode = `MKR-${String(nextId).padStart(6, "0")}`;
        }
        const result = await db2.insert(makers).values({
          ...maker,
          makerCode
        }).returning();
        return result[0];
      }
      async updateMaker(id, data) {
        const db2 = await getDb();
        const result = await db2.update(makers).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(makers.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Maker with id ${id} not found`);
        }
        return result[0];
      }
      async deleteMaker(id) {
        const db2 = await getDb();
        await db2.delete(makers).where(eq(makers.id, id));
      }
      // ============= MODULE 2: MASTER LISTS =============
      async getMasterLists(listType) {
        const db2 = await getDb();
        if (listType) {
          return await db2.select().from(masterLists).where(and(eq(masterLists.listType, listType), eq(masterLists.isActive, true))).orderBy(asc(masterLists.listType), asc(masterLists.displayOrder));
        }
        return await db2.select().from(masterLists).where(eq(masterLists.isActive, true)).orderBy(asc(masterLists.listType), asc(masterLists.displayOrder));
      }
      async getMasterListById(id) {
        const db2 = await getDb();
        const result = await db2.select().from(masterLists).where(eq(masterLists.id, id));
        return result[0];
      }
      async getMasterListsByType(listType) {
        return this.getMasterLists(listType);
      }
      async createMasterList(list) {
        const db2 = await getDb();
        const result = await db2.insert(masterLists).values(list).returning();
        return result[0];
      }
      async updateMasterList(id, data) {
        const db2 = await getDb();
        const result = await db2.update(masterLists).set(data).where(eq(masterLists.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Master list with id ${id} not found`);
        }
        return result[0];
      }
      async deleteMasterList(id) {
        const db2 = await getDb();
        await db2.delete(masterLists).where(eq(masterLists.id, id));
      }
      // ============= MODULE 2: MAKER LIST =============
      async getMakerList() {
        const db2 = await getDb();
        return await db2.select().from(makerList).where(eq(makerList.isActive, true));
      }
      async getMakerListItem(id) {
        const db2 = await getDb();
        const result = await db2.select().from(makerList).where(eq(makerList.id, id));
        return result[0];
      }
      async getMakerListByCode(makerCode) {
        const db2 = await getDb();
        const result = await db2.select().from(makerList).where(eq(makerList.makerCode, makerCode));
        return result[0];
      }
      async createMakerListItem(maker) {
        const db2 = await getDb();
        const result = await db2.insert(makerList).values({
          makerCode: maker.makerCode,
          makerName: maker.makerName,
          address: maker.address || null,
          addressId: maker.addressId || null,
          isActive: maker.isActive ?? true
        }).returning();
        return result[0];
      }
      async updateMakerListItem(id, data) {
        const db2 = await getDb();
        const result = await db2.update(makerList).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(makerList.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Maker list item with id ${id} not found`);
        }
        return result[0];
      }
      async deleteMakerListItem(id) {
        const db2 = await getDb();
        await db2.update(makerList).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(makerList.id, id));
      }
      // ============= MODULE 2: SFI DETAILS =============
      async getSfiDetails() {
        const db2 = await getDb();
        return await db2.select().from(sfiDetails).where(eq(sfiDetails.isActive, true));
      }
      async getSfiDetail(id) {
        const db2 = await getDb();
        const result = await db2.select().from(sfiDetails).where(eq(sfiDetails.id, id));
        return result[0];
      }
      async getSfiByCode(componentCode) {
        const db2 = await getDb();
        const result = await db2.select().from(sfiDetails).where(eq(sfiDetails.componentCode, componentCode));
        return result[0];
      }
      async createSfiDetail(sfi) {
        const db2 = await getDb();
        const result = await db2.insert(sfiDetails).values({
          componentCode: sfi.componentCode,
          componentName: sfi.componentName,
          description: sfi.description || null,
          isActive: sfi.isActive ?? true
        }).returning();
        return result[0];
      }
      async updateSfiDetail(id, data) {
        const db2 = await getDb();
        const result = await db2.update(sfiDetails).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(sfiDetails.id, id)).returning();
        if (!result[0]) {
          throw new Error(`SFI Detail with id ${id} not found`);
        }
        return result[0];
      }
      async deleteSfiDetail(id) {
        const db2 = await getDb();
        await db2.update(sfiDetails).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(sfiDetails.id, id));
      }
      // ============= MODULE 2: MASTER DATA =============
      async getMasterDataList() {
        const db2 = await getDb();
        return await db2.select().from(masterData).where(eq(masterData.isActive, true));
      }
      async getMasterDataItem(id) {
        const db2 = await getDb();
        const result = await db2.select().from(masterData).where(eq(masterData.id, id));
        return result[0];
      }
      async getMasterDataByFleetCode(fleetEquipmentCode) {
        const db2 = await getDb();
        const result = await db2.select().from(masterData).where(eq(masterData.fleetEquipmentCode, fleetEquipmentCode));
        return result[0];
      }
      async getMasterDataByMakerModel(makerCode, model) {
        const db2 = await getDb();
        const result = await db2.select().from(masterData).where(and(eq(masterData.makerCode, makerCode), eq(masterData.model, model)));
        return result[0];
      }
      async createMasterData(data) {
        const db2 = await getDb();
        const result = await db2.insert(masterData).values({
          slNo: data.slNo ?? null,
          makerName: data.makerName,
          makerCode: data.makerCode,
          countMaker: data.countMaker ?? null,
          model: data.model,
          modelCode: data.modelCode,
          countSfiCode: data.countSfiCode ?? null,
          fleetEquipmentCode: data.fleetEquipmentCode,
          sfiCode: data.sfiCode,
          assignedSubCode: data.assignedSubCode ?? null,
          vesselName: data.vesselName ?? null,
          vesselCode: data.vesselCode ?? null,
          equipmentName: data.equipmentName,
          isActive: data.isActive ?? true
        }).returning();
        return result[0];
      }
      async updateMasterData(id, data) {
        const db2 = await getDb();
        const result = await db2.update(masterData).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(masterData.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Master Data with id ${id} not found`);
        }
        return result[0];
      }
      async deleteMasterData(id) {
        const db2 = await getDb();
        await db2.update(masterData).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(masterData.id, id));
      }
      async generateFleetEquipmentCode(sfiCode) {
        const db2 = await getDb();
        const existingCodes = await db2.select({ fleetEquipmentCode: masterData.fleetEquipmentCode }).from(masterData).where(eq(masterData.sfiCode, sfiCode));
        const codes = existingCodes.map((r) => r.fleetEquipmentCode);
        const seqNumbers = codes.map((code) => {
          const parts = code.split(".");
          if (parts.length >= 2) {
            const seqPart = parts[1];
            return parseInt(seqPart, 10) || 0;
          }
          return 0;
        });
        const nextSeq = Math.max(0, ...seqNumbers) + 1;
        const seqStr = nextSeq.toString().padStart(3, "0");
        const subCodeIndex = codes.filter((c) => c.startsWith(`${sfiCode}.${seqStr}`)).length;
        const subCode = String.fromCharCode(65 + Math.floor(subCodeIndex / 26)) + String.fromCharCode(65 + subCodeIndex % 26);
        return `${sfiCode}.${seqStr}.${subCode}`;
      }
      // ============= MODULE 3: COMPONENTS =============
      async getComponents(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(components).where(and(
          eq(components.vesselId, vesselId),
          eq(components.dataScope, "vessel")
        ));
      }
      async getComponent(id) {
        const db2 = await getDb();
        const result = await db2.select().from(components).where(eq(components.id, id));
        return result[0];
      }
      async getComponentByCode(componentCode, vesselId) {
        const db2 = await getDb();
        const result = await db2.select().from(components).where(and(
          eq(components.componentCode, componentCode),
          eq(components.vesselId, vesselId)
        ));
        return result[0];
      }
      async createComponent(component) {
        const db2 = await getDb();
        const id = component.id || `COMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await db2.insert(components).values({
          ...component,
          id,
          dataScope: component.dataScope || "vessel"
        }).returning();
        return result[0];
      }
      async updateComponent(id, data) {
        const db2 = await getDb();
        const result = await db2.update(components).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(components.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Component ${id} not found`);
        }
        return result[0];
      }
      async deleteComponent(id) {
        const db2 = await getDb();
        await db2.delete(components).where(eq(components.id, id));
      }
      async inactivateComponent(id, userId, options) {
        const db2 = await getDb();
        const componentResult = await db2.select().from(components).where(eq(components.id, id)).limit(1);
        if (componentResult.length === 0) {
          return {
            success: false,
            message: `Component not found: ${id}`,
            componentsInactivated: 0,
            jobsInactivated: 0
          };
        }
        const component = componentResult[0];
        const activeChildren = await db2.select().from(components).where(and(
          eq(components.parentId, id),
          eq(components.isActive, true)
        ));
        if (!options?.cascadeInactivate && activeChildren.length > 0) {
          return {
            success: false,
            message: `Component has ${activeChildren.length} active children. Set cascadeInactivate to true to inactivate them all.`,
            componentsInactivated: 0,
            jobsInactivated: 0,
            activeChildrenCount: activeChildren.length
          };
        }
        let componentsInactivated = 0;
        let jobsInactivated = 0;
        if (options?.cascadeInactivate && activeChildren.length > 0) {
          const childIds = activeChildren.map((c) => c.id);
          await db2.update(components).set({ isActive: false }).where(inArray(components.id, childIds));
          componentsInactivated += childIds.length;
          for (const childId of childIds) {
            const linkedJobs2 = await db2.select().from(jobs).where(eq(jobs.componentId, childId));
            if (linkedJobs2.length > 0) {
              await db2.update(jobs).set({ isActive: false }).where(eq(jobs.componentId, childId));
              jobsInactivated += linkedJobs2.length;
            }
          }
        }
        await db2.update(components).set({ isActive: false }).where(eq(components.id, id));
        componentsInactivated++;
        const linkedJobs = await db2.select().from(jobs).where(eq(jobs.componentId, id));
        if (linkedJobs.length > 0) {
          await db2.update(jobs).set({ isActive: false }).where(eq(jobs.componentId, id));
          jobsInactivated += linkedJobs.length;
        }
        return {
          success: true,
          message: `Component and ${componentsInactivated - 1} children inactivated, along with ${jobsInactivated} linked jobs.`,
          componentsInactivated,
          jobsInactivated
        };
      }
      // Fleet Components
      async getFleetComponents() {
        const db2 = await getDb();
        return await db2.select().from(components).where(eq(components.dataScope, "fleet"));
      }
      async getFleetComponent(id) {
        const db2 = await getDb();
        const result = await db2.select().from(components).where(and(
          eq(components.id, id),
          eq(components.dataScope, "fleet")
        ));
        return result[0];
      }
      async createFleetComponent(component) {
        const db2 = await getDb();
        const id = component.id || `FC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await db2.insert(components).values({
          ...component,
          id,
          dataScope: "fleet"
        }).returning();
        return result[0];
      }
      async updateFleetComponent(id, data) {
        return this.updateComponent(id, data);
      }
      async deleteFleetComponent(id) {
        return this.deleteComponent(id);
      }
      // ============= RH COUNTER TYPE METHODS (B7.B) =============
      // Get all MASTER components for a vessel (for RH source selection dropdown)
      async getMasterComponents(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(components).where(and(
          eq(components.vesselId, vesselId),
          eq(components.rhCounterType, "MASTER"),
          eq(components.dataScope, "vessel")
        ));
      }
      // Get all INHERITED components linked to a specific MASTER
      async getInheritedComponents(masterComponentId) {
        const db2 = await getDb();
        let masterComponent = await this.getComponent(masterComponentId);
        if (!masterComponent) {
          const byCode = await db2.select().from(components).where(eq(components.componentCode, masterComponentId)).limit(1);
          masterComponent = byCode[0] || null;
        }
        const masterComponentCode = masterComponent?.componentCode || masterComponentId;
        const masterComponentFullId = masterComponent?.id || masterComponentId;
        return await db2.select().from(components).where(and(
          eq(components.rhCounterType, "INHERITED"),
          or(
            eq(components.rhMasterComponentId, masterComponentFullId),
            eq(components.rhMasterComponentId, masterComponentCode),
            eq(components.rhMasterComponentId, masterComponentId)
          )
        ));
      }
      // Update RH counter type configuration for a component
      async updateRHConfig(params) {
        const db2 = await getDb();
        const now = /* @__PURE__ */ new Date();
        const updateData = {
          rhCounterType: params.rhCounterType,
          updatedAt: now
        };
        if (params.rhCounterType === "MASTER") {
          updateData.rhMasterComponentId = null;
          updateData.rhCurrentInheritedCached = null;
          updateData.rhInheritedUpdatedAt = null;
          const existing = await this.getComponent(params.componentId);
          if (!existing?.rhCurrentMaster) {
            updateData.rhCurrentMaster = "0";
            updateData.rhMasterUpdatedAt = now;
            updateData.rhMasterUpdatedBy = params.userId || "system";
            updateData.rhMasterUpdateSource = "MANUAL";
          }
        } else if (params.rhCounterType === "INHERITED") {
          if (!params.rhMasterComponentId) {
            throw new Error("rhMasterComponentId is required for INHERITED counter type");
          }
          updateData.rhMasterComponentId = params.rhMasterComponentId;
          updateData.rhCurrentMaster = null;
          updateData.rhMasterUpdatedAt = null;
          updateData.rhMasterUpdatedBy = null;
          updateData.rhMasterUpdateSource = null;
          const masterComponent = await this.getComponent(params.rhMasterComponentId);
          if (masterComponent) {
            updateData.rhCurrentInheritedCached = masterComponent.rhCurrentMaster || "0";
            updateData.rhInheritedUpdatedAt = now;
          }
        } else {
          updateData.rhMasterComponentId = null;
          updateData.rhCurrentMaster = null;
          updateData.rhMasterUpdatedAt = null;
          updateData.rhMasterUpdatedBy = null;
          updateData.rhMasterUpdateSource = null;
          updateData.rhCurrentInheritedCached = null;
          updateData.rhInheritedUpdatedAt = null;
        }
        const result = await db2.update(components).set(updateData).where(eq(components.id, params.componentId)).returning();
        if (!result[0]) {
          throw new Error(`Component ${params.componentId} not found`);
        }
        return result[0];
      }
      // Update MASTER running hours with automatic cascade to INHERITED components
      async updateMasterRunningHours(params) {
        const db2 = await getDb();
        const now = /* @__PURE__ */ new Date();
        const component = await this.getComponent(params.componentId);
        if (!component) {
          throw new Error(`Component ${params.componentId} not found`);
        }
        if (component.rhCounterType !== "MASTER") {
          throw new Error(`Component ${params.componentId} is not a MASTER counter type. Cannot update RH directly.`);
        }
        const masterResult = await db2.update(components).set({
          rhCurrentMaster: params.newRHValue.toString(),
          currentCumulativeRH: params.newRHValue.toString(),
          rhMasterUpdatedAt: now,
          rhMasterUpdatedBy: params.userId,
          rhMasterUpdateSource: params.updateSource,
          lastUpdated: now.toISOString(),
          updatedAt: now
        }).where(eq(components.id, params.componentId)).returning();
        if (!masterResult[0]) {
          throw new Error(`Failed to update MASTER component ${params.componentId}`);
        }
        const inheritedResult = await db2.update(components).set({
          rhCurrentInheritedCached: params.newRHValue.toString(),
          currentCumulativeRH: params.newRHValue.toString(),
          rhInheritedUpdatedAt: now,
          lastUpdated: now.toISOString(),
          updatedAt: now
        }).where(and(
          eq(components.rhMasterComponentId, params.componentId),
          eq(components.rhCounterType, "INHERITED")
        )).returning();
        return {
          masterUpdated: masterResult[0],
          inheritedUpdated: inheritedResult.length
        };
      }
      // CENTRALIZED RH UPDATE: Set running hours for any component with automatic field sync
      // This is the SINGLE SOURCE OF TRUTH for all running hours updates
      async setComponentRunningHours(params) {
        const db2 = await getDb();
        const now = /* @__PURE__ */ new Date();
        const lastUpdatedValue = params.lastUpdatedDate || now.toISOString();
        const component = await this.getComponent(params.componentId);
        if (!component) {
          throw new Error(`Component ${params.componentId} not found`);
        }
        const rhValueStr = params.newRHValue.toString();
        let inheritedUpdated = 0;
        if (component.rhCounterType === "MASTER") {
          const result = await db2.update(components).set({
            rhCurrentMaster: rhValueStr,
            currentCumulativeRH: rhValueStr,
            rhMasterUpdatedAt: now,
            rhMasterUpdatedBy: params.userId,
            rhMasterUpdateSource: params.updateSource,
            lastUpdated: lastUpdatedValue,
            updatedAt: now
          }).where(eq(components.id, params.componentId)).returning();
          if (!result[0]) {
            throw new Error(`Failed to update MASTER component ${params.componentId}`);
          }
          const inheritedResult = await db2.update(components).set({
            rhCurrentInheritedCached: rhValueStr,
            currentCumulativeRH: rhValueStr,
            rhInheritedUpdatedAt: now,
            lastUpdated: lastUpdatedValue,
            updatedAt: now
          }).where(and(
            eq(components.rhMasterComponentId, params.componentId),
            eq(components.rhCounterType, "INHERITED")
          )).returning();
          inheritedUpdated = inheritedResult.length;
          return { component: result[0], inheritedUpdated };
        } else if (component.rhCounterType === "INHERITED") {
          const result = await db2.update(components).set({
            rhCurrentInheritedCached: rhValueStr,
            currentCumulativeRH: rhValueStr,
            rhInheritedUpdatedAt: now,
            lastUpdated: lastUpdatedValue,
            updatedAt: now
          }).where(eq(components.id, params.componentId)).returning();
          if (!result[0]) {
            throw new Error(`Failed to update INHERITED component ${params.componentId}`);
          }
          return { component: result[0], inheritedUpdated: 0 };
        } else {
          const result = await db2.update(components).set({
            currentCumulativeRH: rhValueStr,
            lastUpdated: lastUpdatedValue,
            updatedAt: now
          }).where(eq(components.id, params.componentId)).returning();
          if (!result[0]) {
            throw new Error(`Failed to update component ${params.componentId}`);
          }
          return { component: result[0], inheritedUpdated: 0 };
        }
      }
      // ============= MODULE 3: COMPONENT DOCUMENTS =============
      async getComponentDocuments(componentId) {
        const db2 = await getDb();
        return await db2.select().from(componentDocuments).where(eq(componentDocuments.componentId, componentId));
      }
      async getComponentDocument(id) {
        const db2 = await getDb();
        const result = await db2.select().from(componentDocuments).where(eq(componentDocuments.id, id));
        return result[0];
      }
      async createComponentDocument(doc) {
        const db2 = await getDb();
        const result = await db2.insert(componentDocuments).values(doc).returning();
        return result[0];
      }
      async updateComponentDocument(id, data) {
        const db2 = await getDb();
        const result = await db2.update(componentDocuments).set(data).where(eq(componentDocuments.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Component document ${id} not found`);
        }
        return result[0];
      }
      async deleteComponentDocument(id) {
        const db2 = await getDb();
        await db2.delete(componentDocuments).where(eq(componentDocuments.id, id));
      }
      // ============= MODULE 3: COMPONENT CLASS REGULATORY =============
      async getComponentClassRegulatory(componentId) {
        const db2 = await getDb();
        return await db2.select().from(componentClassRegulatory).where(eq(componentClassRegulatory.componentId, componentId));
      }
      async getComponentClassRegulatoryItem(id) {
        const db2 = await getDb();
        const result = await db2.select().from(componentClassRegulatory).where(eq(componentClassRegulatory.id, id));
        return result[0];
      }
      async createComponentClassRegulatory(item) {
        const db2 = await getDb();
        const result = await db2.insert(componentClassRegulatory).values(item).returning();
        return result[0];
      }
      async updateComponentClassRegulatory(id, data) {
        const db2 = await getDb();
        const result = await db2.update(componentClassRegulatory).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(componentClassRegulatory.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Component class regulatory ${id} not found`);
        }
        return result[0];
      }
      async deleteComponentClassRegulatory(id) {
        const db2 = await getDb();
        await db2.delete(componentClassRegulatory).where(eq(componentClassRegulatory.id, id));
      }
      // ============= MODULE 3: COMPONENT MAINTENANCE HISTORY (IMMUTABLE) =============
      async getAllComponentMaintenanceHistory(vesselCode) {
        const db2 = await getDb();
        if (vesselCode) {
          return await db2.select().from(componentMaintenanceHistory).where(eq(componentMaintenanceHistory.vesselCode, vesselCode)).orderBy(desc(componentMaintenanceHistory.createdAt));
        }
        return await db2.select().from(componentMaintenanceHistory).orderBy(desc(componentMaintenanceHistory.createdAt));
      }
      async getComponentMaintenanceHistory(componentId) {
        const db2 = await getDb();
        return await db2.select().from(componentMaintenanceHistory).where(eq(componentMaintenanceHistory.componentId, componentId)).orderBy(desc(componentMaintenanceHistory.dateCompleted));
      }
      async getComponentMaintenanceHistoryItem(id) {
        const db2 = await getDb();
        const result = await db2.select().from(componentMaintenanceHistory).where(eq(componentMaintenanceHistory.id, id));
        return result[0];
      }
      async getMaintenanceHistoryByWorkOrderId(workOrderId) {
        const db2 = await getDb();
        const result = await db2.select().from(componentMaintenanceHistory).where(eq(componentMaintenanceHistory.workOrderId, workOrderId));
        return result[0];
      }
      // INSERT ONLY - No update or delete methods per immutability requirement
      async createComponentMaintenanceHistory(history) {
        const db2 = await getDb();
        const result = await db2.insert(componentMaintenanceHistory).values(history).returning();
        return result[0];
      }
      // ============= MODULE 3: COMPONENT REQUISITIONS =============
      async getComponentRequisitions(componentId) {
        const db2 = await getDb();
        return await db2.select().from(componentRequisitions).where(eq(componentRequisitions.componentId, componentId)).orderBy(desc(componentRequisitions.createdAt));
      }
      async getAllComponentRequisitions(vesselCode) {
        const db2 = await getDb();
        if (vesselCode) {
          return await db2.select().from(componentRequisitions).where(eq(componentRequisitions.vesselCode, vesselCode)).orderBy(desc(componentRequisitions.createdAt));
        }
        return await db2.select().from(componentRequisitions).orderBy(desc(componentRequisitions.createdAt));
      }
      async getComponentRequisitionItem(id) {
        const db2 = await getDb();
        const result = await db2.select().from(componentRequisitions).where(eq(componentRequisitions.id, id));
        return result[0];
      }
      async createComponentRequisition(item) {
        const db2 = await getDb();
        const result = await db2.insert(componentRequisitions).values(item).returning();
        return result[0];
      }
      async updateComponentRequisition(id, data) {
        const db2 = await getDb();
        const result = await db2.update(componentRequisitions).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(componentRequisitions.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Component requisition ${id} not found`);
        }
        return result[0];
      }
      async deleteComponentRequisition(id) {
        const db2 = await getDb();
        await db2.delete(componentRequisitions).where(eq(componentRequisitions.id, id));
      }
      // ============= MODULE 3: RUNNING HOURS AUDIT =============
      async createRunningHoursAudit(audit) {
        const db2 = await getDb();
        const result = await db2.insert(runningHoursAudit).values(audit).returning();
        return result[0];
      }
      async getRunningHoursAudits(componentId, limit) {
        const db2 = await getDb();
        let query = db2.select().from(runningHoursAudit).where(eq(runningHoursAudit.componentId, componentId)).orderBy(desc(runningHoursAudit.enteredAtUTC));
        if (limit) {
          return await query.limit(limit);
        }
        return await query;
      }
      async getRunningHoursAuditsInDateRange(componentId, startDate, endDate) {
        const db2 = await getDb();
        return await db2.select().from(runningHoursAudit).where(and(
          eq(runningHoursAudit.componentId, componentId),
          gte(runningHoursAudit.enteredAtUTC, startDate),
          lte(runningHoursAudit.enteredAtUTC, endDate)
        )).orderBy(desc(runningHoursAudit.enteredAtUTC));
      }
      // ============= MODULE 4: JOBS =============
      async getJobs(vesselId, componentId) {
        const db2 = await getDb();
        if (vesselId && componentId) {
          const directJobs = await db2.select().from(jobs).where(and(
            eq(jobs.vesselId, vesselId),
            eq(jobs.componentId, componentId),
            eq(jobs.dataScope, "vessel")
          )).orderBy(asc(jobs.jobNo));
          const linkedJobIds = await this.getJobComponentLinksByComponent(componentId);
          const linkedJobs = [];
          for (const link of linkedJobIds) {
            const job = await this.getJob(link.jobId);
            if (job && job.vesselId === vesselId && job.dataScope === "vessel") {
              linkedJobs.push(job);
            }
          }
          const jobMap = /* @__PURE__ */ new Map();
          for (const job of directJobs) {
            jobMap.set(job.id, job);
          }
          for (const job of linkedJobs) {
            if (!jobMap.has(job.id)) {
              jobMap.set(job.id, job);
            }
          }
          return Array.from(jobMap.values()).sort(
            (a, b) => (a.jobNo || "").localeCompare(b.jobNo || "")
          );
        }
        if (vesselId) {
          return await db2.select().from(jobs).where(and(
            eq(jobs.vesselId, vesselId),
            eq(jobs.dataScope, "vessel")
          )).orderBy(asc(jobs.jobNo));
        }
        return await db2.select().from(jobs).where(eq(jobs.dataScope, "vessel")).orderBy(asc(jobs.jobNo));
      }
      async getJob(id) {
        const db2 = await getDb();
        const result = await db2.select().from(jobs).where(eq(jobs.id, id));
        return result[0];
      }
      async getJobByJobNo(jobNo) {
        const db2 = await getDb();
        const result = await db2.select().from(jobs).where(eq(jobs.jobNo, jobNo));
        return result[0];
      }
      async createJob(job) {
        const db2 = await getDb();
        const id = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await db2.insert(jobs).values({
          ...job,
          id,
          dataScope: job.dataScope || "vessel"
        }).returning();
        return result[0];
      }
      async updateJob(id, data) {
        const db2 = await getDb();
        const result = await db2.update(jobs).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(jobs.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Job ${id} not found`);
        }
        return result[0];
      }
      async deleteJob(id) {
        const db2 = await getDb();
        await db2.delete(jobs).where(eq(jobs.id, id));
      }
      async bulkCreateJobs(jobList) {
        if (jobList.length === 0) return [];
        const db2 = await getDb();
        const results = [];
        for (const job of jobList) {
          const id = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const result = await db2.insert(jobs).values({
            ...job,
            id,
            dataScope: job.dataScope || "vessel"
          }).returning();
          results.push(result[0]);
        }
        return results;
      }
      async bulkUpdateJobs(updates) {
        const db2 = await getDb();
        const results = [];
        for (const { jobNo, data } of updates) {
          const result = await db2.update(jobs).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(jobs.jobNo, jobNo)).returning();
          if (result[0]) {
            results.push(result[0]);
          }
        }
        return results;
      }
      async bulkUpsertJobs(jobList) {
        const db2 = await getDb();
        let created = 0;
        let updated = 0;
        for (const job of jobList) {
          const existing = job.jobNo ? await this.getJobByJobNo(job.jobNo) : null;
          if (existing) {
            await db2.update(jobs).set({ ...job, updatedAt: /* @__PURE__ */ new Date() }).where(eq(jobs.id, existing.id));
            updated++;
          } else {
            const id = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await db2.insert(jobs).values({
              ...job,
              id,
              dataScope: job.dataScope || "vessel"
            });
            created++;
          }
        }
        return { created, updated };
      }
      async getJobsByJobNos(jobNos, vesselId) {
        if (jobNos.length === 0) return /* @__PURE__ */ new Map();
        const db2 = await getDb();
        let result;
        if (vesselId) {
          result = await db2.select().from(jobs).where(and(
            inArray(jobs.jobNo, jobNos),
            eq(jobs.vesselId, vesselId)
          ));
        } else {
          result = await db2.select().from(jobs).where(inArray(jobs.jobNo, jobNos));
        }
        const map = /* @__PURE__ */ new Map();
        for (const job of result) {
          map.set(job.jobNo, job);
        }
        return map;
      }
      // Fleet Jobs
      async getFleetJobs() {
        const db2 = await getDb();
        return await db2.select().from(jobs).where(eq(jobs.dataScope, "fleet")).orderBy(asc(jobs.jobNo));
      }
      async getFleetJob(id) {
        const db2 = await getDb();
        const result = await db2.select().from(jobs).where(and(
          eq(jobs.id, id),
          eq(jobs.dataScope, "fleet")
        ));
        return result[0];
      }
      async createFleetJob(job) {
        const db2 = await getDb();
        const id = `FJ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await db2.insert(jobs).values({
          ...job,
          id,
          dataScope: "fleet"
        }).returning();
        return result[0];
      }
      async updateFleetJob(id, data) {
        return this.updateJob(id, data);
      }
      async deleteFleetJob(id) {
        return this.deleteJob(id);
      }
      // ============= MODULE 5: WORK ORDERS =============
      async getWorkOrders(vesselId) {
        const db2 = await getDb();
        if (vesselId) {
          return await db2.select().from(workOrders).where(and(
            eq(workOrders.vesselId, vesselId),
            eq(workOrders.dataScope, "vessel")
          )).orderBy(desc(workOrders.createdAt));
        }
        return await db2.select().from(workOrders).where(eq(workOrders.dataScope, "vessel")).orderBy(desc(workOrders.createdAt));
      }
      async getWorkOrder(id) {
        const db2 = await getDb();
        const result = await db2.select().from(workOrders).where(eq(workOrders.id, id));
        return result[0];
      }
      async getWorkOrderByWorkOrderNo(workOrderNo) {
        const db2 = await getDb();
        const result = await db2.select().from(workOrders).where(eq(workOrders.workOrderNo, workOrderNo));
        return result[0];
      }
      async getWorkOrdersByJobId(jobId) {
        const db2 = await getDb();
        return await db2.select().from(workOrders).where(eq(workOrders.jobId, jobId)).orderBy(desc(workOrders.createdAt));
      }
      async createWorkOrder(wo) {
        const db2 = await getDb();
        const id = wo.id || `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await db2.insert(workOrders).values({
          ...wo,
          id,
          dataScope: wo.dataScope || "vessel"
        }).returning();
        return result[0];
      }
      async updateWorkOrder(id, data) {
        const db2 = await getDb();
        const integerFields = ["maintenanceIntervalValue", "intervalRunningHour"];
        const sanitizedData = { ...data };
        for (const field of integerFields) {
          if (field in sanitizedData && sanitizedData[field] === "") {
            sanitizedData[field] = null;
          }
        }
        const result = await db2.update(workOrders).set({ ...sanitizedData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workOrders.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Work order ${id} not found`);
        }
        return result[0];
      }
      async deleteWorkOrder(id) {
        const db2 = await getDb();
        await db2.delete(workOrders).where(eq(workOrders.id, id));
      }
      async bulkCreateWorkOrders(woList) {
        if (woList.length === 0) return [];
        const db2 = await getDb();
        const results = [];
        for (const wo of woList) {
          const id = wo.id || `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const result = await db2.insert(workOrders).values({
            ...wo,
            id,
            dataScope: wo.dataScope || "vessel"
          }).returning();
          results.push(result[0]);
        }
        return results;
      }
      async bulkUpdateWorkOrders(updates) {
        const db2 = await getDb();
        const results = [];
        for (const { templateCode, data } of updates) {
          const result = await db2.update(workOrders).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workOrders.templateId, templateCode)).returning();
          if (result[0]) {
            results.push(result[0]);
          }
        }
        return results;
      }
      async bulkUpsertWorkOrders(woList) {
        const db2 = await getDb();
        let created = 0;
        let updated = 0;
        for (const wo of woList) {
          const existing = wo.workOrderNo ? await this.getWorkOrderByWorkOrderNo(wo.workOrderNo) : null;
          if (existing) {
            await db2.update(workOrders).set({ ...wo, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workOrders.id, existing.id));
            updated++;
          } else {
            const id = wo.id || `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await db2.insert(workOrders).values({
              ...wo,
              id,
              dataScope: wo.dataScope || "vessel"
            });
            created++;
          }
        }
        return { created, updated };
      }
      async getWorkOrdersByTemplateIds(templateIds, vesselId) {
        if (templateIds.length === 0) return /* @__PURE__ */ new Map();
        const db2 = await getDb();
        let results;
        if (vesselId) {
          results = await db2.select().from(workOrders).where(and(
            inArray(workOrders.templateId, templateIds),
            eq(workOrders.vesselId, vesselId)
          ));
        } else {
          results = await db2.select().from(workOrders).where(inArray(workOrders.templateId, templateIds));
        }
        const resultMap = /* @__PURE__ */ new Map();
        for (const wo of results) {
          if (wo.templateId) {
            resultMap.set(wo.templateId, wo);
          }
        }
        return resultMap;
      }
      // Fleet Work Orders
      async getFleetWorkOrders() {
        const db2 = await getDb();
        return await db2.select().from(workOrders).where(eq(workOrders.dataScope, "fleet")).orderBy(desc(workOrders.createdAt));
      }
      async getFleetWorkOrder(id) {
        const db2 = await getDb();
        const result = await db2.select().from(workOrders).where(and(
          eq(workOrders.id, id),
          eq(workOrders.dataScope, "fleet")
        ));
        return result[0];
      }
      async createFleetWorkOrder(wo) {
        const db2 = await getDb();
        const id = wo.id || `FWO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await db2.insert(workOrders).values({
          ...wo,
          id,
          dataScope: "fleet"
        }).returning();
        return result[0];
      }
      async updateFleetWorkOrder(id, data) {
        return this.updateWorkOrder(id, data);
      }
      async deleteFleetWorkOrder(id) {
        return this.deleteWorkOrder(id);
      }
      // ============= MODULE 7: SPARES =============
      async getAllSpares() {
        const db2 = await getDb();
        return await db2.select().from(spares).where(eq(spares.deleted, false));
      }
      async getSpares(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(spares).where(and(
          eq(spares.vesselId, vesselId),
          eq(spares.dataScope, "vessel"),
          eq(spares.deleted, false)
        ));
      }
      async getSpare(id) {
        const db2 = await getDb();
        const result = await db2.select().from(spares).where(eq(spares.id, id));
        return result[0];
      }
      async createSpare(spare) {
        const db2 = await getDb();
        const result = await db2.insert(spares).values({
          ...spare,
          dataScope: spare.dataScope || "vessel",
          rob: spare.rob ?? 0,
          robLocationA: spare.robLocationA ?? 0,
          robLocationB: spare.robLocationB ?? 0,
          min: spare.min ?? 0
        }).returning();
        return result[0];
      }
      async updateSpare(id, data) {
        const db2 = await getDb();
        const result = await db2.update(spares).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(spares.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Spare ${id} not found`);
        }
        return result[0];
      }
      async deleteSpare(id) {
        const db2 = await getDb();
        await db2.update(spares).set({ deleted: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(spares.id, id));
      }
      async consumeSpare(id, quantity, userId, remarks, place, dateLocal, tz) {
        const db2 = await getDb();
        const spare = await this.getSpare(id);
        if (!spare) {
          throw new Error(`Spare ${id} not found`);
        }
        const newRob = (spare.rob ?? 0) - quantity;
        const newRobA = (spare.robLocationA ?? 0) - quantity;
        const updated = await db2.update(spares).set({
          rob: newRob,
          robLocationA: newRobA < 0 ? 0 : newRobA,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(spares.id, id)).returning();
        await this.createSpareHistory({
          timestampUTC: /* @__PURE__ */ new Date(),
          vesselId: spare.vesselId || "V001",
          spareId: spare.id,
          partCode: spare.partCode,
          partName: spare.partName,
          componentId: spare.componentId || "",
          componentCode: spare.componentCode ?? null,
          componentName: spare.componentName,
          componentSpareCode: spare.componentSpareCode ?? null,
          eventType: "CONSUME",
          qtyChange: -quantity,
          robAfter: newRob,
          userId,
          remarks: remarks ?? null,
          reference: null,
          dateLocal: dateLocal ?? null,
          tz: tz ?? null,
          place: place ?? null
        });
        return updated[0];
      }
      async consumeSpareFromLocation(id, quantity, location, userId, remarks, workOrderRef) {
        const db2 = await getDb();
        const spare = await this.getSpare(id);
        if (!spare) {
          throw new Error(`Spare ${id} not found`);
        }
        const currentRobA = spare.robLocationA ?? 0;
        const currentRobB = spare.robLocationB ?? 0;
        const currentRob = spare.rob ?? 0;
        const availableInLocation = location === "A" ? currentRobA : currentRobB;
        const deducted = Math.min(quantity, availableInLocation);
        const shortageQty = Math.max(0, quantity - availableInLocation);
        let newRobA = currentRobA;
        let newRobB = currentRobB;
        if (location === "A") {
          newRobA = Math.max(0, currentRobA - deducted);
        } else {
          newRobB = Math.max(0, currentRobB - deducted);
        }
        const newRob = Math.max(0, currentRob - deducted);
        const updated = await db2.update(spares).set({
          rob: newRob,
          robLocationA: newRobA,
          robLocationB: newRobB,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(spares.id, id)).returning();
        await this.createSpareHistory({
          timestampUTC: /* @__PURE__ */ new Date(),
          vesselId: spare.vesselId || "V001",
          spareId: spare.id,
          partCode: spare.partCode,
          partName: spare.partName,
          componentId: spare.componentId || "",
          componentCode: spare.componentCode ?? null,
          componentName: spare.componentName,
          componentSpareCode: spare.componentSpareCode ?? null,
          eventType: "CONSUME",
          qtyChange: -deducted,
          robAfter: newRob,
          userId,
          remarks: remarks ? `${remarks} (Location ${location})${workOrderRef ? ` WO: ${workOrderRef}` : ""}` : `Location ${location}`,
          reference: workOrderRef ?? null,
          dateLocal: null,
          tz: null,
          place: null
        });
        return {
          spare: updated[0],
          deducted,
          requested: quantity,
          shortageQty
        };
      }
      async receiveSpare(id, quantity, userId, remarks, supplierPO, place, dateLocal, tz) {
        const db2 = await getDb();
        const spare = await this.getSpare(id);
        if (!spare) {
          throw new Error(`Spare ${id} not found`);
        }
        const newRob = (spare.rob ?? 0) + quantity;
        const newRobA = (spare.robLocationA ?? 0) + quantity;
        const updated = await db2.update(spares).set({
          rob: newRob,
          robLocationA: newRobA,
          lastOrderDate: dateLocal ?? null,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(spares.id, id)).returning();
        await this.createSpareHistory({
          timestampUTC: /* @__PURE__ */ new Date(),
          vesselId: spare.vesselId || "V001",
          spareId: spare.id,
          partCode: spare.partCode,
          partName: spare.partName,
          componentId: spare.componentId || "",
          componentCode: spare.componentCode ?? null,
          componentName: spare.componentName,
          componentSpareCode: spare.componentSpareCode ?? null,
          eventType: "RECEIVE",
          qtyChange: quantity,
          robAfter: newRob,
          userId,
          remarks: remarks ?? null,
          reference: supplierPO ?? null,
          dateLocal: dateLocal ?? null,
          tz: tz ?? null,
          place: place ?? null
        });
        return updated[0];
      }
      async adjustSpareQuantity(spareId, qtyChange, eventType, reference, notes) {
        const db2 = await getDb();
        const spare = await this.getSpare(spareId);
        if (!spare) {
          throw new Error(`Spare ${spareId} not found`);
        }
        const currentRob = spare.rob ?? 0;
        const currentRobA = spare.robLocationA ?? 0;
        const newRob = Math.max(0, currentRob + qtyChange);
        const newRobA = Math.max(0, currentRobA + qtyChange);
        const updated = await db2.update(spares).set({
          rob: newRob,
          robLocationA: newRobA,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(spares.id, spareId)).returning();
        await this.createSpareHistory({
          timestampUTC: /* @__PURE__ */ new Date(),
          vesselId: spare.vesselId || "V001",
          spareId: spare.id,
          partCode: spare.partCode,
          partName: spare.partName,
          componentId: spare.componentId || "",
          componentCode: spare.componentCode ?? null,
          componentName: spare.componentName,
          componentSpareCode: spare.componentSpareCode ?? null,
          eventType,
          qtyChange,
          robAfter: newRob,
          userId: "system",
          remarks: notes ?? null,
          reference: reference ?? null,
          dateLocal: null,
          tz: null,
          place: null
        });
        return updated[0];
      }
      async bulkUpdateSpares(updates, userId, remarks) {
        const results = [];
        for (const update of updates) {
          const spare = await this.getSpare(update.id);
          if (!spare) continue;
          if (update.consumed && update.consumed > 0) {
            const result = await this.consumeSpare(
              update.id,
              update.consumed,
              userId,
              remarks
            );
            results.push(result);
          } else if (update.received && update.received > 0) {
            const result = await this.receiveSpare(
              update.id,
              update.received,
              userId,
              remarks,
              void 0,
              update.receivedPlace,
              update.receivedDate
            );
            results.push(result);
          }
        }
        return results;
      }
      // Fleet Spares
      async getFleetSpares() {
        const db2 = await getDb();
        return await db2.select().from(spares).where(and(
          eq(spares.dataScope, "fleet"),
          eq(spares.deleted, false)
        ));
      }
      async getFleetSpare(id) {
        const db2 = await getDb();
        const result = await db2.select().from(spares).where(and(
          eq(spares.id, id),
          eq(spares.dataScope, "fleet")
        ));
        return result[0];
      }
      async createFleetSpare(spare) {
        const db2 = await getDb();
        const result = await db2.insert(spares).values({
          ...spare,
          dataScope: "fleet",
          rob: spare.rob ?? 0,
          robLocationA: spare.robLocationA ?? 0,
          robLocationB: spare.robLocationB ?? 0,
          min: spare.min ?? 0
        }).returning();
        return result[0];
      }
      async updateFleetSpare(id, data) {
        return this.updateSpare(id, data);
      }
      async deleteFleetSpare(id) {
        return this.deleteSpare(id);
      }
      async bulkCreateSpares(sparesList) {
        if (sparesList.length === 0) return [];
        const db2 = await getDb();
        const results = [];
        for (const spare of sparesList) {
          const result = await db2.insert(spares).values({
            ...spare,
            dataScope: spare.dataScope || "vessel",
            rob: spare.rob ?? 0,
            robLocationA: spare.robLocationA ?? 0,
            robLocationB: spare.robLocationB ?? 0,
            min: spare.min ?? 0
          }).returning();
          results.push(result[0]);
        }
        return results;
      }
      async bulkUpdateSparesByROB(updates) {
        const db2 = await getDb();
        const results = [];
        for (const { robId, data } of updates) {
          const id = parseInt(robId, 10);
          if (isNaN(id)) continue;
          const result = await db2.update(spares).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(spares.id, id)).returning();
          if (result[0]) {
            results.push(result[0]);
          }
        }
        return results;
      }
      async bulkUpsertSpares(sparesList) {
        const db2 = await getDb();
        let created = 0;
        let updated = 0;
        for (const spare of sparesList) {
          const existing = spare.partCode && spare.vesselId ? await db2.select().from(spares).where(and(
            eq(spares.partCode, spare.partCode),
            eq(spares.vesselId, spare.vesselId),
            eq(spares.deleted, false)
          )).then((r) => r[0]) : null;
          if (existing) {
            await db2.update(spares).set({ ...spare, updatedAt: /* @__PURE__ */ new Date() }).where(eq(spares.id, existing.id));
            updated++;
          } else {
            await db2.insert(spares).values({
              ...spare,
              dataScope: spare.dataScope || "vessel",
              rob: spare.rob ?? 0,
              robLocationA: spare.robLocationA ?? 0,
              robLocationB: spare.robLocationB ?? 0,
              min: spare.min ?? 0
            });
            created++;
          }
        }
        return { created, updated };
      }
      // ============= MODULE 7: SPARES HISTORY =============
      async getSpareHistory(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(sparesHistory).where(eq(sparesHistory.vesselId, vesselId)).orderBy(desc(sparesHistory.timestampUTC));
      }
      async getSpareHistoryBySpareId(spareId) {
        const db2 = await getDb();
        return await db2.select().from(sparesHistory).where(eq(sparesHistory.spareId, spareId)).orderBy(desc(sparesHistory.timestampUTC));
      }
      async createSpareHistory(history) {
        const db2 = await getDb();
        const result = await db2.insert(sparesHistory).values(history).returning();
        return result[0];
      }
      // ============= MODULE 8: STORES ITEMS =============
      async getStoresItems(vesselId, itemType) {
        const db2 = await getDb();
        if (itemType) {
          return await db2.select().from(storesItems).where(and(
            eq(storesItems.vesselId, vesselId),
            eq(storesItems.itemType, itemType),
            eq(storesItems.deleted, false)
          ));
        }
        return await db2.select().from(storesItems).where(and(
          eq(storesItems.vesselId, vesselId),
          eq(storesItems.deleted, false)
        ));
      }
      async getStoresItem(id) {
        const db2 = await getDb();
        const result = await db2.select().from(storesItems).where(eq(storesItems.id, id));
        return result[0];
      }
      async createStoresItem(item) {
        const db2 = await getDb();
        const result = await db2.insert(storesItems).values({
          ...item,
          rob: item.rob || "0",
          robLocationA: item.robLocationA || "0",
          robLocationB: item.robLocationB || "0",
          min: item.min || "0"
        }).returning();
        return result[0];
      }
      async updateStoresItem(id, data) {
        const db2 = await getDb();
        const result = await db2.update(storesItems).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(storesItems.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Stores item with id ${id} not found`);
        }
        return result[0];
      }
      async deleteStoresItem(id) {
        const db2 = await getDb();
        await db2.update(storesItems).set({ deleted: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(storesItems.id, id));
      }
      async consumeStoresItem(id, quantity, location, userId, remarks, place, dateLocal, tz) {
        const db2 = await getDb();
        const item = await this.getStoresItem(id);
        if (!item) {
          throw new Error(`Stores item with id ${id} not found`);
        }
        const qtyNum = Number(quantity);
        const locationRob = location === "A" ? Number(item.robLocationA || 0) : Number(item.robLocationB || 0);
        const actualConsumed = Math.min(qtyNum, locationRob);
        const newLocationRob = Math.max(0, locationRob - qtyNum);
        const newTotalRob = Math.max(0, Number(item.rob || 0) - actualConsumed);
        const updated = await db2.update(storesItems).set({
          rob: String(newTotalRob),
          ...location === "A" ? { robLocationA: String(newLocationRob) } : { robLocationB: String(newLocationRob) },
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(storesItems.id, id)).returning();
        await db2.insert(storesLedger).values({
          vesselId: item.vesselId,
          section: item.itemType,
          itemId: id,
          partCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          eventType: "CONSUME",
          qtyChangeBase: String(-actualConsumed),
          qtyDisplay: String(-actualConsumed),
          robAfterBase: String(newTotalRob),
          dateLocal: dateLocal || (/* @__PURE__ */ new Date()).toISOString(),
          tz: tz || "UTC",
          timestampUTC: /* @__PURE__ */ new Date(),
          place,
          userId,
          remarks
        });
        return updated[0];
      }
      async receiveStoresItem(id, quantity, location, userId, remarks, ref, place, dateLocal, tz) {
        const db2 = await getDb();
        const item = await this.getStoresItem(id);
        if (!item) {
          throw new Error(`Stores item with id ${id} not found`);
        }
        const qtyNum = Number(quantity);
        const locationRob = location === "A" ? Number(item.robLocationA || 0) : Number(item.robLocationB || 0);
        const newLocationRob = locationRob + qtyNum;
        const newTotalRob = Number(item.rob || 0) + qtyNum;
        const updated = await db2.update(storesItems).set({
          rob: String(newTotalRob),
          ...location === "A" ? { robLocationA: String(newLocationRob) } : { robLocationB: String(newLocationRob) },
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(storesItems.id, id)).returning();
        await db2.insert(storesLedger).values({
          vesselId: item.vesselId,
          section: item.itemType,
          itemId: id,
          partCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          eventType: "RECEIVE",
          qtyChangeBase: String(qtyNum),
          qtyDisplay: String(qtyNum),
          robAfterBase: String(newTotalRob),
          dateLocal: dateLocal || (/* @__PURE__ */ new Date()).toISOString(),
          tz: tz || "UTC",
          timestampUTC: /* @__PURE__ */ new Date(),
          place,
          ref,
          userId,
          remarks
        });
        return updated[0];
      }
      // ============= MODULE 8: STORES LEDGER =============
      async getStoresTransactionHistory(vesselId, itemType) {
        const db2 = await getDb();
        if (itemType) {
          return await db2.select().from(storesLedger).where(and(
            eq(storesLedger.vesselId, vesselId),
            eq(storesLedger.section, itemType)
          )).orderBy(desc(storesLedger.timestampUTC));
        }
        return await db2.select().from(storesLedger).where(eq(storesLedger.vesselId, vesselId)).orderBy(desc(storesLedger.timestampUTC));
      }
      async getStoresItemHistory(itemId) {
        const db2 = await getDb();
        return await db2.select().from(storesLedger).where(eq(storesLedger.itemId, itemId)).orderBy(desc(storesLedger.timestampUTC));
      }
      // ============= MODULE 9: DEFECTS =============
      async getDefects(filters) {
        const db2 = await getDb();
        const conditions = [];
        if (filters?.vesselId && filters.vesselId !== "all") {
          conditions.push(eq(defects.vesselId, filters.vesselId));
        }
        if (filters?.statusView === "active") {
          conditions.push(or(
            eq(defects.status, "Open"),
            eq(defects.status, "Pending"),
            eq(defects.status, "In-Progress"),
            eq(defects.status, "Awaiting Parts"),
            eq(defects.status, "Deferred")
          ));
        } else if (filters?.statusView === "resolved") {
          conditions.push(or(
            eq(defects.status, "Closed"),
            eq(defects.status, "Cancelled")
          ));
        }
        if (filters?.isCoC !== void 0) {
          conditions.push(eq(defects.is_coc, filters.isCoC));
        }
        if (filters?.category) {
          conditions.push(eq(defects.category, filters.category));
        }
        if (filters?.priority) {
          conditions.push(eq(defects.priority, filters.priority));
        }
        let query = db2.select().from(defects);
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        query = query.orderBy(desc(defects.issueDate));
        if (filters?.page !== void 0 && filters?.pageSize !== void 0) {
          const offset = (filters.page - 1) * filters.pageSize;
          query = query.limit(filters.pageSize).offset(offset);
        }
        return await query;
      }
      async getDefectsCount(filters) {
        const db2 = await getDb();
        const conditions = [];
        if (filters?.vesselId && filters.vesselId !== "all") {
          conditions.push(eq(defects.vesselId, filters.vesselId));
        }
        if (filters?.statusView === "active") {
          conditions.push(or(
            eq(defects.status, "Open"),
            eq(defects.status, "Pending"),
            eq(defects.status, "In-Progress"),
            eq(defects.status, "Awaiting Parts"),
            eq(defects.status, "Deferred")
          ));
        } else if (filters?.statusView === "resolved") {
          conditions.push(or(
            eq(defects.status, "Closed"),
            eq(defects.status, "Cancelled")
          ));
        }
        if (filters?.isCoC !== void 0) {
          conditions.push(eq(defects.is_coc, filters.isCoC));
        }
        let query = db2.select({ count: sql2`count(*)` }).from(defects);
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        const result = await query;
        return Number(result[0]?.count || 0);
      }
      async getDefect(id) {
        const db2 = await getDb();
        const result = await db2.select().from(defects).where(eq(defects.id, id));
        return result[0];
      }
      async getDefectBySeedId(seedId) {
        const db2 = await getDb();
        const result = await db2.select().from(defects).where(eq(defects.seedId, seedId));
        return result[0];
      }
      async createDefect(defect) {
        const db2 = await getDb();
        const id = `DEF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await db2.insert(defects).values({
          ...defect,
          id
        }).returning();
        return result[0];
      }
      async updateDefect(id, data) {
        const db2 = await getDb();
        const result = await db2.update(defects).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(defects.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Defect ${id} not found`);
        }
        return result[0];
      }
      async deleteDefect(id) {
        const db2 = await getDb();
        await db2.delete(defects).where(eq(defects.id, id));
      }
      async addDefectNote(defectId, note) {
        const db2 = await getDb();
        const defect = await this.getDefect(defectId);
        if (!defect) {
          throw new Error(`Defect ${defectId} not found`);
        }
        const newNote = {
          noteId: `NOTE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          noteText: note.noteText,
          attachments: note.attachments,
          createdBy: note.createdBy,
          createdOn: (/* @__PURE__ */ new Date()).toISOString()
        };
        const existingNotes = Array.isArray(defect.notes) ? defect.notes : [];
        const updatedNotes = [...existingNotes, newNote];
        const result = await db2.update(defects).set({ notes: updatedNotes, updatedAt: /* @__PURE__ */ new Date() }).where(eq(defects.id, defectId)).returning();
        return result[0];
      }
      async linkDefects(defectId, linkedDefectIds) {
        const db2 = await getDb();
        const defect = await this.getDefect(defectId);
        if (!defect) {
          throw new Error(`Defect ${defectId} not found`);
        }
        const existingLinks = Array.isArray(defect.linkedDefects) ? defect.linkedDefects : [];
        const mergedLinks = [.../* @__PURE__ */ new Set([...existingLinks, ...linkedDefectIds])];
        const result = await db2.update(defects).set({ linkedDefects: mergedLinks, updatedAt: /* @__PURE__ */ new Date() }).where(eq(defects.id, defectId)).returning();
        return result[0];
      }
      async closeDefect(defectId, closure) {
        const db2 = await getDb();
        const result = await db2.update(defects).set({
          status: "Closed",
          closedBy: closure.closedBy,
          closedOn: (/* @__PURE__ */ new Date()).toISOString(),
          closureComment: closure.closureComment,
          closureFiles: closure.closureFiles,
          dateCompleted: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(defects.id, defectId)).returning();
        if (!result[0]) {
          throw new Error(`Defect ${defectId} not found`);
        }
        return result[0];
      }
      // ============= MODULE 9: DEFECT ACTIONS =============
      async getDefectActions(defectId) {
        const db2 = await getDb();
        return await db2.select().from(defectActions).where(eq(defectActions.defectId, defectId)).orderBy(desc(defectActions.createdAt));
      }
      async createDefectAction(action) {
        const db2 = await getDb();
        const result = await db2.insert(defectActions).values(action).returning();
        return result[0];
      }
      async updateDefectAction(id, updates) {
        const db2 = await getDb();
        const result = await db2.update(defectActions).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(defectActions.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Defect action ${id} not found`);
        }
        return result[0];
      }
      async deleteDefectAction(id) {
        const db2 = await getDb();
        await db2.delete(defectActions).where(eq(defectActions.id, id));
      }
      // ============= MODULE 9: DEFECT ATTACHMENTS =============
      async getDefectAttachments(defectId) {
        const db2 = await getDb();
        return await db2.select().from(defectAttachments).where(eq(defectAttachments.defectId, defectId));
      }
      async createDefectAttachment(attachment) {
        const db2 = await getDb();
        const result = await db2.insert(defectAttachments).values(attachment).returning();
        return result[0];
      }
      async deleteDefectAttachment(id) {
        const db2 = await getDb();
        await db2.delete(defectAttachments).where(eq(defectAttachments.id, id));
      }
      // ============= MODULE 9: RECURRING DEFECTS =============
      async getRecurringDefects(filters) {
        const db2 = await getDb();
        const conditions = [];
        if (filters?.windowMonths !== void 0) {
          conditions.push(eq(recurringDefects.windowMonths, filters.windowMonths));
        }
        if (filters?.minOccurrences !== void 0) {
          conditions.push(gte(recurringDefects.occurrenceCount, filters.minOccurrences));
        }
        if (filters?.hasCoc !== void 0) {
          conditions.push(eq(recurringDefects.hasCoc, filters.hasCoc));
        }
        if (filters?.equipmentKey) {
          conditions.push(eq(recurringDefects.equipmentKey, filters.equipmentKey));
        }
        if (conditions.length > 0) {
          return await db2.select().from(recurringDefects).where(and(...conditions)).orderBy(desc(recurringDefects.occurrenceCount));
        }
        return await db2.select().from(recurringDefects).orderBy(desc(recurringDefects.occurrenceCount));
      }
      async getRecurringDefect(id) {
        const db2 = await getDb();
        const result = await db2.select().from(recurringDefects).where(eq(recurringDefects.id, id));
        return result[0];
      }
      async createRecurringDefect(recurring) {
        const db2 = await getDb();
        const result = await db2.insert(recurringDefects).values(recurring).returning();
        return result[0];
      }
      async updateRecurringDefect(id, data) {
        const db2 = await getDb();
        const result = await db2.update(recurringDefects).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(recurringDefects.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Recurring defect ${id} not found`);
        }
        return result[0];
      }
      async deleteRecurringDefect(id) {
        const db2 = await getDb();
        await db2.delete(recurringDefects).where(eq(recurringDefects.id, id));
      }
      // ============= MODULE 9: RECURRING DEFECT LINKS =============
      async getRecurringDefectLinks(recurringId) {
        const db2 = await getDb();
        return await db2.select().from(recurringDefectLinks).where(eq(recurringDefectLinks.recurringId, recurringId));
      }
      async getDefectsForRecurring(recurringId) {
        const db2 = await getDb();
        const links = await this.getRecurringDefectLinks(recurringId);
        if (links.length === 0) {
          return [];
        }
        const defectIds = links.map((l) => l.defectId);
        return await db2.select().from(defects).where(inArray(defects.id, defectIds)).orderBy(desc(defects.issueDate));
      }
      async createRecurringDefectLink(link) {
        const db2 = await getDb();
        const result = await db2.insert(recurringDefectLinks).values(link).returning();
        return result[0];
      }
      async deleteRecurringDefectLink(recurringId, defectId) {
        const db2 = await getDb();
        await db2.delete(recurringDefectLinks).where(and(
          eq(recurringDefectLinks.recurringId, recurringId),
          eq(recurringDefectLinks.defectId, defectId)
        ));
      }
      // ============= MODULE 10: ALERT POLICIES =============
      async getAlertPolicies() {
        const db2 = await getDb();
        return await db2.select().from(alertPolicies).orderBy(desc(alertPolicies.createdAt));
      }
      async getAlertPolicy(id) {
        const db2 = await getDb();
        const result = await db2.select().from(alertPolicies).where(eq(alertPolicies.id, id));
        return result[0];
      }
      async createAlertPolicy(policy) {
        const db2 = await getDb();
        const result = await db2.insert(alertPolicies).values(policy).returning();
        return result[0];
      }
      async updateAlertPolicy(id, data) {
        const db2 = await getDb();
        const result = await db2.update(alertPolicies).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(alertPolicies.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Alert policy ${id} not found`);
        }
        return result[0];
      }
      async deleteAlertPolicy(id) {
        const db2 = await getDb();
        await db2.delete(alertPolicies).where(eq(alertPolicies.id, id));
      }
      // ============= MODULE 10: ALERT EVENTS =============
      async getAlertEvents(filters) {
        const db2 = await getDb();
        const conditions = [];
        if (filters?.policyId !== void 0) {
          conditions.push(eq(alertEvents.policyId, filters.policyId));
        }
        if (filters?.alertType) {
          conditions.push(eq(alertEvents.alertType, filters.alertType));
        }
        if (filters?.vesselId) {
          conditions.push(eq(alertEvents.vesselId, filters.vesselId));
        }
        if (filters?.acknowledged !== void 0) {
          if (filters.acknowledged) {
            conditions.push(sql2`${alertEvents.ackBy} IS NOT NULL`);
          } else {
            conditions.push(sql2`${alertEvents.ackBy} IS NULL`);
          }
        }
        if (conditions.length > 0) {
          return await db2.select().from(alertEvents).where(and(...conditions)).orderBy(desc(alertEvents.createdAt));
        }
        return await db2.select().from(alertEvents).orderBy(desc(alertEvents.createdAt));
      }
      async getAlertEvent(id) {
        const db2 = await getDb();
        const result = await db2.select().from(alertEvents).where(eq(alertEvents.id, id));
        return result[0];
      }
      async createAlertEvent(event) {
        const db2 = await getDb();
        const result = await db2.insert(alertEvents).values(event).returning();
        return result[0];
      }
      async acknowledgeAlertEvent(id, userId) {
        const db2 = await getDb();
        const result = await db2.update(alertEvents).set({ ackBy: userId, ackAt: /* @__PURE__ */ new Date() }).where(eq(alertEvents.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Alert event ${id} not found`);
        }
        return result[0];
      }
      // ============= MODULE 10: ALERT DELIVERIES =============
      async getAlertDeliveries(eventId) {
        const db2 = await getDb();
        return await db2.select().from(alertDeliveries).where(eq(alertDeliveries.eventId, eventId)).orderBy(desc(alertDeliveries.createdAt));
      }
      async createAlertDelivery(delivery) {
        const db2 = await getDb();
        const result = await db2.insert(alertDeliveries).values(delivery).returning();
        return result[0];
      }
      async updateAlertDeliveryStatus(id, status, errorMessage) {
        const db2 = await getDb();
        const updateData = { status };
        if (status === "sent") {
          updateData.sentAt = /* @__PURE__ */ new Date();
        }
        if (status === "acknowledged") {
          updateData.acknowledgedAt = /* @__PURE__ */ new Date();
        }
        if (errorMessage !== void 0) {
          updateData.errorMessage = errorMessage;
        }
        const result = await db2.update(alertDeliveries).set(updateData).where(eq(alertDeliveries.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Alert delivery ${id} not found`);
        }
        return result[0];
      }
      // ============= MODULE 10: ALERT CONFIG =============
      async getAlertConfig(vesselId) {
        const db2 = await getDb();
        const result = await db2.select().from(alertConfig).where(eq(alertConfig.vesselId, vesselId));
        return result[0];
      }
      async createOrUpdateAlertConfig(config2) {
        const db2 = await getDb();
        const existing = await this.getAlertConfig(config2.vesselId);
        if (existing) {
          const result = await db2.update(alertConfig).set({ ...config2, updatedAt: /* @__PURE__ */ new Date() }).where(eq(alertConfig.id, existing.id)).returning();
          return result[0];
        } else {
          const result = await db2.insert(alertConfig).values(config2).returning();
          return result[0];
        }
      }
      // ============= MODULE 11: FORM DEFINITIONS =============
      async getFormDefinitions() {
        const db2 = await getDb();
        return await db2.select().from(formDefinitions);
      }
      async getFormDefinition(id) {
        const db2 = await getDb();
        const result = await db2.select().from(formDefinitions).where(eq(formDefinitions.id, id));
        return result[0];
      }
      async getFormDefinitionByName(name) {
        const db2 = await getDb();
        const result = await db2.select().from(formDefinitions).where(eq(formDefinitions.name, name));
        return result[0];
      }
      async createFormDefinition(form) {
        const db2 = await getDb();
        const result = await db2.insert(formDefinitions).values(form).returning();
        return result[0];
      }
      // ============= MODULE 11: FORM VERSIONS =============
      async getFormVersions(formId) {
        const db2 = await getDb();
        return await db2.select().from(formVersions).where(eq(formVersions.formId, formId)).orderBy(desc(formVersions.versionNo));
      }
      async getFormVersion(id) {
        const db2 = await getDb();
        const result = await db2.select().from(formVersions).where(eq(formVersions.id, id));
        return result[0];
      }
      async getLatestPublishedVersion(formId) {
        const db2 = await getDb();
        const result = await db2.select().from(formVersions).where(and(
          eq(formVersions.formId, formId),
          eq(formVersions.status, "PUBLISHED")
        )).orderBy(desc(formVersions.versionNo)).limit(1);
        return result[0];
      }
      async getLatestPublishedVersionByName(name) {
        const form = await this.getFormDefinitionByName(name);
        if (!form) return void 0;
        return this.getLatestPublishedVersion(form.id);
      }
      async createFormVersion(version) {
        const db2 = await getDb();
        const result = await db2.insert(formVersions).values(version).returning();
        return result[0];
      }
      async updateFormVersion(id, data) {
        const db2 = await getDb();
        const result = await db2.update(formVersions).set(data).where(eq(formVersions.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Form version ${id} not found`);
        }
        return result[0];
      }
      async publishFormVersion(id, userId, changelog) {
        const db2 = await getDb();
        const result = await db2.update(formVersions).set({
          status: "PUBLISHED",
          authorUserId: userId,
          changelog,
          versionDate: /* @__PURE__ */ new Date()
        }).where(eq(formVersions.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Form version ${id} not found`);
        }
        return result[0];
      }
      async discardFormVersion(id) {
        const db2 = await getDb();
        await db2.delete(formVersions).where(eq(formVersions.id, id));
      }
      // ============= MODULE 11: FORM VERSION USAGE =============
      async createFormVersionUsage(usage) {
        const db2 = await getDb();
        const result = await db2.insert(formVersionUsage).values(usage).returning();
        return result[0];
      }
      async getFormVersionUsage(formVersionId) {
        const db2 = await getDb();
        return await db2.select().from(formVersionUsage).where(eq(formVersionUsage.formVersionId, formVersionId));
      }
      async seedForms() {
        const existingForms = await this.getFormDefinitions();
        if (existingForms.length > 0) {
          return;
        }
        const defaultForms = [
          { name: "ADD_COMPONENT", subgroup: "components" },
          { name: "EDIT_COMPONENT", subgroup: "components" },
          { name: "WO_PLANNED", subgroup: "work_orders" },
          { name: "WO_UNPLANNED", subgroup: "work_orders" },
          { name: "ADD_JOB", subgroup: "jobs" },
          { name: "EDIT_JOB", subgroup: "jobs" }
        ];
        for (const form of defaultForms) {
          await this.createFormDefinition(form);
        }
      }
      // ============= MODULE 12: CHANGE REQUESTS =============
      async getChangeRequests(filters) {
        const db2 = await getDb();
        let conditions = [];
        if (filters?.category) {
          conditions.push(eq(changeRequest.category, filters.category));
        }
        if (filters?.status) {
          conditions.push(eq(changeRequest.status, filters.status));
        }
        if (filters?.vesselId) {
          conditions.push(eq(changeRequest.vesselId, filters.vesselId));
        }
        if (filters?.q) {
          conditions.push(ilike(changeRequest.title, `%${filters.q}%`));
        }
        if (conditions.length > 0) {
          return await db2.select().from(changeRequest).where(and(...conditions)).orderBy(desc(changeRequest.createdAt));
        }
        return await db2.select().from(changeRequest).orderBy(desc(changeRequest.createdAt));
      }
      async getChangeRequest(id) {
        const db2 = await getDb();
        const result = await db2.select().from(changeRequest).where(eq(changeRequest.id, id));
        return result[0];
      }
      async createChangeRequest(request) {
        const db2 = await getDb();
        const result = await db2.insert(changeRequest).values({
          ...request,
          targetType: request.targetType || null,
          targetId: request.targetId || null,
          snapshotBeforeJson: request.snapshotBeforeJson || null,
          proposedChangesJson: request.proposedChangesJson || null,
          movePreviewJson: request.movePreviewJson || null,
          submittedAt: request.submittedAt || null,
          reviewedByUserId: request.reviewedByUserId || null,
          reviewedAt: request.reviewedAt || null
        }).returning();
        return result[0];
      }
      async updateChangeRequest(id, data) {
        const db2 = await getDb();
        const result = await db2.update(changeRequest).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(changeRequest.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Change request ${id} not found`);
        }
        return result[0];
      }
      async updateChangeRequestTarget(id, targetType, targetId, snapshotBeforeJson) {
        return this.updateChangeRequest(id, { targetType, targetId, snapshotBeforeJson });
      }
      async updateChangeRequestProposed(id, proposedChangesJson, movePreviewJson) {
        return this.updateChangeRequest(id, { proposedChangesJson, movePreviewJson });
      }
      async deleteChangeRequest(id) {
        const db2 = await getDb();
        await db2.delete(changeRequest).where(eq(changeRequest.id, id));
      }
      async submitChangeRequest(id, userId) {
        return this.updateChangeRequest(id, {
          status: "submitted",
          submittedAt: /* @__PURE__ */ new Date(),
          requestedByUserId: userId
        });
      }
      async approveChangeRequest(id, reviewerId, comment) {
        const existing = await this.getChangeRequest(id);
        if (!existing) throw new Error("Change request not found");
        const now = /* @__PURE__ */ new Date();
        const newRevisionNumber = (existing.revisionNumber || 0) + 1;
        const revisionHistoryEntry = {
          revisionNumber: newRevisionNumber,
          approvedBy: reviewerId,
          approvedAt: now.toISOString(),
          appliedChanges: existing.proposedChangesJson || [],
          comments: comment
        };
        const updatedHistory = [...existing.revisionHistory || [], revisionHistoryEntry];
        return this.updateChangeRequest(id, {
          status: "approved",
          reviewedByUserId: reviewerId,
          reviewedAt: now,
          revisionNumber: newRevisionNumber,
          revisionHistory: updatedHistory
        });
      }
      async rejectChangeRequest(id, reviewerId, comment) {
        return this.updateChangeRequest(id, {
          status: "rejected",
          reviewedByUserId: reviewerId,
          reviewedAt: /* @__PURE__ */ new Date()
        });
      }
      async returnChangeRequest(id, reviewerId, comment) {
        return this.updateChangeRequest(id, {
          status: "returned",
          reviewedByUserId: reviewerId,
          reviewedAt: /* @__PURE__ */ new Date()
        });
      }
      // ============= MODULE 12: CHANGE REQUEST ATTACHMENTS =============
      async getChangeRequestAttachments(changeRequestId) {
        const db2 = await getDb();
        return await db2.select().from(changeRequestAttachment).where(eq(changeRequestAttachment.changeRequestId, changeRequestId));
      }
      async createChangeRequestAttachment(attachment) {
        const db2 = await getDb();
        const result = await db2.insert(changeRequestAttachment).values(attachment).returning();
        return result[0];
      }
      // ============= MODULE 12: CHANGE REQUEST COMMENTS =============
      async getChangeRequestComments(changeRequestId) {
        const db2 = await getDb();
        return await db2.select().from(changeRequestComment).where(eq(changeRequestComment.changeRequestId, changeRequestId)).orderBy(asc(changeRequestComment.createdAt));
      }
      async createChangeRequestComment(comment) {
        const db2 = await getDb();
        const result = await db2.insert(changeRequestComment).values(comment).returning();
        return result[0];
      }
      // ============= MODULE 13: IHM ITEMS =============
      async getIhmItem(id, type) {
        const db2 = await getDb();
        let result;
        if (type === "component") {
          result = await db2.select().from(ihmItems).where(eq(ihmItems.componentId, id));
        } else {
          result = await db2.select().from(ihmItems).where(eq(ihmItems.spareId, id));
        }
        return result[0];
      }
      async getIhmItems(vesselId) {
        const db2 = await getDb();
        if (vesselId) {
          return await db2.select().from(ihmItems).where(eq(ihmItems.vesselId, vesselId));
        }
        return await db2.select().from(ihmItems);
      }
      async upsertIhmItem(item) {
        const db2 = await getDb();
        let existing;
        if (item.componentId) {
          const results = await db2.select().from(ihmItems).where(eq(ihmItems.componentId, item.componentId));
          existing = results[0];
        } else if (item.spareId) {
          const results = await db2.select().from(ihmItems).where(eq(ihmItems.spareId, item.spareId));
          existing = results[0];
        }
        if (existing) {
          const result = await db2.update(ihmItems).set({ ...item, updatedAt: /* @__PURE__ */ new Date() }).where(eq(ihmItems.id, existing.id)).returning();
          return result[0];
        } else {
          const result = await db2.insert(ihmItems).values(item).returning();
          return result[0];
        }
      }
      async deleteIhmItem(id) {
        const db2 = await getDb();
        await db2.delete(ihmItems).where(eq(ihmItems.id, id));
      }
      // ============= MODULE 13: IHM MAINTENANCE LOG =============
      async getIhmMaintenanceLog(filters) {
        const db2 = await getDb();
        let conditions = [];
        if (filters.vesselId) {
          conditions.push(eq(ihmMaintenanceLog.vesselId, filters.vesselId));
        }
        if (filters.componentId) {
          conditions.push(eq(ihmMaintenanceLog.targetComponent, filters.componentId));
        }
        if (filters.spareId) {
          conditions.push(eq(ihmMaintenanceLog.targetSpare, filters.spareId));
        }
        if (filters.workOrderId) {
          conditions.push(eq(ihmMaintenanceLog.workOrderId, filters.workOrderId));
        }
        if (conditions.length > 0) {
          return await db2.select().from(ihmMaintenanceLog).where(and(...conditions)).orderBy(desc(ihmMaintenanceLog.createdAt));
        }
        return await db2.select().from(ihmMaintenanceLog).orderBy(desc(ihmMaintenanceLog.createdAt));
      }
      async createIhmMaintenanceLogEntry(entry) {
        const db2 = await getDb();
        const result = await db2.insert(ihmMaintenanceLog).values(entry).returning();
        return result[0];
      }
      async getIhmStatusReport(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(ihmItems).where(eq(ihmItems.vesselId, vesselId));
      }
      // ============= MODULE 14: FLEET VESSEL MAPPING =============
      async getFleetVesselMappings(fleetEquipmentCode) {
        const db2 = await getDb();
        if (fleetEquipmentCode) {
          return await db2.select().from(fleetVesselMapping).where(and(
            eq(fleetVesselMapping.fleetEquipmentCode, fleetEquipmentCode),
            eq(fleetVesselMapping.isActive, true)
          ));
        }
        return await db2.select().from(fleetVesselMapping).where(eq(fleetVesselMapping.isActive, true));
      }
      async getFleetVesselMappingsByVessel(vesselCode) {
        const db2 = await getDb();
        return await db2.select().from(fleetVesselMapping).where(and(
          eq(fleetVesselMapping.vesselCode, vesselCode),
          eq(fleetVesselMapping.isActive, true)
        ));
      }
      async createFleetVesselMappingRecord(mapping) {
        const db2 = await getDb();
        const result = await db2.insert(fleetVesselMapping).values({
          fleetEquipmentCode: mapping.fleetEquipmentCode,
          vesselCode: mapping.vesselCode,
          vesselName: mapping.vesselName ?? null,
          mappedBy: mapping.mappedBy,
          isActive: mapping.isActive ?? true
        }).returning();
        return result[0];
      }
      async removeFleetVesselMappingRecord(fleetEquipmentCode, vesselCode) {
        const db2 = await getDb();
        await db2.update(fleetVesselMapping).set({ isActive: false }).where(and(
          eq(fleetVesselMapping.fleetEquipmentCode, fleetEquipmentCode),
          eq(fleetVesselMapping.vesselCode, vesselCode)
        ));
      }
      // ============= MODULE 14: FLEET COMPONENT MAPPING =============
      async getFleetComponentMappings(fleetEquipmentCode) {
        const db2 = await getDb();
        return await db2.select().from(fleetComponentMapping).where(and(
          eq(fleetComponentMapping.fleetEquipmentCode, fleetEquipmentCode),
          eq(fleetComponentMapping.isActive, true)
        ));
      }
      async getFleetComponentMappingsByVessel(vesselCode) {
        const db2 = await getDb();
        return await db2.select().from(fleetComponentMapping).where(and(
          eq(fleetComponentMapping.vesselCode, vesselCode),
          eq(fleetComponentMapping.isActive, true)
        ));
      }
      async createFleetComponentMappingRecord(mapping) {
        const db2 = await getDb();
        const result = await db2.insert(fleetComponentMapping).values({
          fleetEquipmentCode: mapping.fleetEquipmentCode,
          vesselCode: mapping.vesselCode,
          componentCode: mapping.componentCode,
          componentId: mapping.componentId ?? null,
          componentName: mapping.componentName ?? null,
          mappedBy: mapping.mappedBy,
          isActive: mapping.isActive ?? true
        }).returning();
        return result[0];
      }
      async removeFleetComponentMappingRecord(fleetEquipmentCode, vesselCode, componentCode) {
        const db2 = await getDb();
        await db2.update(fleetComponentMapping).set({ isActive: false }).where(and(
          eq(fleetComponentMapping.fleetEquipmentCode, fleetEquipmentCode),
          eq(fleetComponentMapping.vesselCode, vesselCode),
          eq(fleetComponentMapping.componentCode, componentCode)
        ));
      }
      // ============= MODULE 14: FLEET JOB VESSEL MAPPING =============
      async getFleetJobVesselMappings(fleetEquipmentCode, jobCode) {
        const db2 = await getDb();
        let conditions = [eq(fleetJobVesselMapping.isActive, true)];
        if (fleetEquipmentCode) {
          conditions.push(eq(fleetJobVesselMapping.fleetEquipmentCode, fleetEquipmentCode));
        }
        if (jobCode) {
          conditions.push(eq(fleetJobVesselMapping.jobCode, jobCode));
        }
        return await db2.select().from(fleetJobVesselMapping).where(and(...conditions));
      }
      async createFleetJobVesselMappingRecord(mapping) {
        const db2 = await getDb();
        const result = await db2.insert(fleetJobVesselMapping).values({
          fleetEquipmentCode: mapping.fleetEquipmentCode,
          jobCode: mapping.jobCode,
          jobId: mapping.jobId ?? null,
          vesselCode: mapping.vesselCode,
          vesselName: mapping.vesselName ?? null,
          mappedBy: mapping.mappedBy,
          isActive: mapping.isActive ?? true
        }).returning();
        return result[0];
      }
      async removeFleetJobVesselMappingRecord(jobCode, vesselCode) {
        const db2 = await getDb();
        await db2.update(fleetJobVesselMapping).set({ isActive: false }).where(and(
          eq(fleetJobVesselMapping.jobCode, jobCode),
          eq(fleetJobVesselMapping.vesselCode, vesselCode)
        ));
      }
      // ============= MODULE 14: FLEET SPARE VESSEL MAPPING =============
      async getFleetSpareVesselMappings(fleetEquipmentCode, partCode) {
        const db2 = await getDb();
        let conditions = [eq(fleetSpareVesselMapping.isActive, true)];
        if (fleetEquipmentCode) {
          conditions.push(eq(fleetSpareVesselMapping.fleetEquipmentCode, fleetEquipmentCode));
        }
        if (partCode) {
          conditions.push(eq(fleetSpareVesselMapping.partCode, partCode));
        }
        return await db2.select().from(fleetSpareVesselMapping).where(and(...conditions));
      }
      async createFleetSpareVesselMappingRecord(mapping) {
        const db2 = await getDb();
        const result = await db2.insert(fleetSpareVesselMapping).values({
          fleetEquipmentCode: mapping.fleetEquipmentCode,
          partCode: mapping.partCode,
          spareId: mapping.spareId ?? null,
          vesselCode: mapping.vesselCode,
          vesselName: mapping.vesselName ?? null,
          mappedBy: mapping.mappedBy,
          isActive: mapping.isActive ?? true
        }).returning();
        return result[0];
      }
      async removeFleetSpareVesselMappingRecord(partCode, vesselCode) {
        const db2 = await getDb();
        await db2.update(fleetSpareVesselMapping).set({ isActive: false }).where(and(
          eq(fleetSpareVesselMapping.partCode, partCode),
          eq(fleetSpareVesselMapping.vesselCode, vesselCode)
        ));
      }
      // ============= MODULE 15: IMPORT ENGINE =============
      async createImportHistory(history) {
        const db2 = await getDb();
        const result = await db2.insert(importHistory).values({
          id: history.id,
          type: history.type,
          mode: history.mode,
          archiveMissing: history.archiveMissing ?? false,
          userId: history.userId,
          vesselId: history.vesselId ?? null,
          created: history.created ?? 0,
          updated: history.updated ?? 0,
          skipped: history.skipped ?? 0,
          archived: history.archived ?? 0,
          status: history.status,
          originalName: history.originalName ?? null,
          fileSize: history.fileSize ?? null,
          storedFilePath: history.storedFilePath ?? null,
          undoneAt: history.undoneAt ?? null,
          errorMessage: history.errorMessage ?? null
        }).returning();
        return result[0];
      }
      async getImportHistory(type, limit = 20, offset = 0) {
        const db2 = await getDb();
        let query = db2.select().from(importHistory);
        let countQuery = db2.select({ count: sql2`count(*)` }).from(importHistory);
        if (type) {
          query = query.where(eq(importHistory.type, type));
          countQuery = countQuery.where(eq(importHistory.type, type));
        }
        const items = await query.orderBy(desc(importHistory.startedAt)).limit(limit).offset(offset);
        const countResult = await countQuery;
        const total = Number(countResult[0]?.count ?? 0);
        return { items, total };
      }
      async getImportHistoryById(id) {
        const db2 = await getDb();
        const result = await db2.select().from(importHistory).where(eq(importHistory.id, id));
        return result[0];
      }
      async updateImportHistory(id, data) {
        const db2 = await getDb();
        const result = await db2.update(importHistory).set(data).where(eq(importHistory.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Import history with id ${id} not found`);
        }
        return result[0];
      }
      async createImportChangeLog(log2) {
        const db2 = await getDb();
        const result = await db2.insert(importChangeLog).values({
          id: log2.id,
          importHistoryId: log2.importHistoryId,
          entityType: log2.entityType,
          entityId: log2.entityId,
          operation: log2.operation,
          previousData: log2.previousData ?? null,
          newData: log2.newData ?? null,
          checksum: log2.checksum
        }).returning();
        return result[0];
      }
      async getImportChangeLogs(importHistoryId) {
        const db2 = await getDb();
        return await db2.select().from(importChangeLog).where(eq(importChangeLog.importHistoryId, importHistoryId)).orderBy(desc(importChangeLog.createdAt));
      }
      async deleteImportChangeLogs(importHistoryId) {
        const db2 = await getDb();
        await db2.delete(importChangeLog).where(eq(importChangeLog.importHistoryId, importHistoryId));
      }
      // ============= MODULE 16: BULK IMPORT =============
      async getBulkImportHistory(vesselCode, moduleType) {
        const db2 = await getDb();
        let conditions = [];
        if (vesselCode) {
          conditions.push(eq(bulkImportHistory.vesselCode, vesselCode));
        }
        if (moduleType) {
          conditions.push(eq(bulkImportHistory.moduleType, moduleType));
        }
        if (conditions.length > 0) {
          return await db2.select().from(bulkImportHistory).where(and(...conditions)).orderBy(desc(bulkImportHistory.uploadedAt));
        }
        return await db2.select().from(bulkImportHistory).orderBy(desc(bulkImportHistory.uploadedAt));
      }
      async getBulkImportHistoryItem(id) {
        const db2 = await getDb();
        const result = await db2.select().from(bulkImportHistory).where(eq(bulkImportHistory.id, id));
        return result[0];
      }
      async createBulkImportHistory(history) {
        const db2 = await getDb();
        const result = await db2.insert(bulkImportHistory).values({
          vesselCode: history.vesselCode ?? null,
          vesselName: history.vesselName ?? null,
          moduleType: history.moduleType,
          sheetName: history.sheetName ?? null,
          fileName: history.fileName,
          fileSize: history.fileSize ?? null,
          uploadedBy: history.uploadedBy,
          uploadedByName: history.uploadedByName ?? null,
          totalRows: history.totalRows ?? 0,
          successCount: history.successCount ?? 0,
          failedCount: history.failedCount ?? 0,
          skippedCount: history.skippedCount ?? 0,
          status: history.status ?? "Processing",
          errorSummary: history.errorSummary ?? null,
          isFleetImport: history.isFleetImport ?? false,
          templateVersion: history.templateVersion ?? null,
          processingTimeMs: history.processingTimeMs ?? null
        }).returning();
        return result[0];
      }
      async updateBulkImportHistory(id, data) {
        const db2 = await getDb();
        const result = await db2.update(bulkImportHistory).set(data).where(eq(bulkImportHistory.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Bulk Import History with id ${id} not found`);
        }
        return result[0];
      }
      async getBulkImportErrors(importId) {
        const db2 = await getDb();
        return await db2.select().from(bulkImportErrors).where(eq(bulkImportErrors.importId, importId)).orderBy(asc(bulkImportErrors.rowNumber));
      }
      async createBulkImportError(error) {
        const db2 = await getDb();
        const result = await db2.insert(bulkImportErrors).values({
          importId: error.importId,
          rowNumber: error.rowNumber,
          fieldName: error.fieldName ?? null,
          fieldValue: error.fieldValue ?? null,
          errorType: error.errorType,
          errorDescription: error.errorDescription,
          recommendedFix: error.recommendedFix ?? null,
          severity: error.severity ?? "Error",
          rawRowData: error.rawRowData ?? null
        }).returning();
        return result[0];
      }
      async createBulkImportErrors(errors) {
        if (errors.length === 0) return [];
        const db2 = await getDb();
        const results = [];
        for (const error of errors) {
          const result = await this.createBulkImportError(error);
          results.push(result);
        }
        return results;
      }
      // ============= MODULE 17: AUDIT LOG =============
      async createAuditLog(data) {
        const db2 = await getDb();
        const result = await db2.insert(auditLog).values({
          userId: data.userId,
          vesselCode: data.vesselCode ?? null,
          componentCode: data.componentCode ?? null,
          entityType: data.entityType,
          entityId: data.entityId,
          actionType: data.actionType,
          fieldName: data.fieldName ?? null,
          oldValue: data.oldValue ?? null,
          newValue: data.newValue ?? null,
          source: data.source,
          payload: data.payload ?? null
        }).returning();
        return result[0];
      }
      async getAuditLogs(filters) {
        const db2 = await getDb();
        let conditions = [];
        if (filters) {
          if (filters.vesselCode) {
            conditions.push(eq(auditLog.vesselCode, filters.vesselCode));
          }
          if (filters.componentCode) {
            conditions.push(eq(auditLog.componentCode, filters.componentCode));
          }
          if (filters.entityType) {
            conditions.push(eq(auditLog.entityType, filters.entityType));
          }
          if (filters.entityId) {
            conditions.push(eq(auditLog.entityId, filters.entityId));
          }
          if (filters.actionType) {
            conditions.push(eq(auditLog.actionType, filters.actionType));
          }
          if (filters.startDate) {
            conditions.push(gte(auditLog.timestamp, filters.startDate));
          }
          if (filters.endDate) {
            conditions.push(lte(auditLog.timestamp, filters.endDate));
          }
        }
        let query = db2.select().from(auditLog);
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        query = query.orderBy(desc(auditLog.timestamp));
        if (filters?.limit) {
          query = query.limit(filters.limit);
        }
        if (filters?.offset) {
          query = query.offset(filters.offset);
        }
        return await query;
      }
      async getAuditLogsByEntity(entityType, entityId) {
        const db2 = await getDb();
        return await db2.select().from(auditLog).where(and(
          eq(auditLog.entityType, entityType),
          eq(auditLog.entityId, entityId)
        )).orderBy(desc(auditLog.timestamp));
      }
      async getAuditLogsByUser(userId, limit = 100) {
        const db2 = await getDb();
        return await db2.select().from(auditLog).where(eq(auditLog.userId, userId)).orderBy(desc(auditLog.timestamp)).limit(limit);
      }
      // ============= WORK ORDER EXECUTIONS (Original) =============
      async getWorkOrderExecutions(componentId) {
        const db2 = await getDb();
        return await db2.select().from(workOrderExecutions).where(eq(workOrderExecutions.componentId, componentId)).orderBy(desc(workOrderExecutions.createdAt));
      }
      async getWorkOrderExecutionById(id) {
        const db2 = await getDb();
        const result = await db2.select().from(workOrderExecutions).where(eq(workOrderExecutions.id, id)).limit(1);
        return result[0] || null;
      }
      async createWorkOrderExecution(data) {
        const db2 = await getDb();
        const result = await db2.insert(workOrderExecutions).values(data).returning();
        return result[0];
      }
      async updateWorkOrderExecution(id, data) {
        const db2 = await getDb();
        const result = await db2.update(workOrderExecutions).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workOrderExecutions.id, id)).returning();
        if (result.length === 0) {
          throw new Error(`WorkOrderExecution not found: ${id}`);
        }
        return result[0];
      }
      // ============= CERTIFICATES =============
      async getCertificates() {
        const db2 = await getDb();
        return await db2.select().from(certificates).where(eq(certificates.isActive, true)).orderBy(asc(certificates.certificateName));
      }
      async getCertificate(id) {
        const db2 = await getDb();
        const result = await db2.select().from(certificates).where(eq(certificates.id, id)).limit(1);
        return result[0];
      }
      async createCertificate(certificate) {
        const db2 = await getDb();
        const result = await db2.insert(certificates).values({
          ...certificate,
          attachments: certificate.attachments || []
        }).returning();
        return result[0];
      }
      async updateCertificate(id, data) {
        const db2 = await getDb();
        const { id: _, createdAt: __, ...updateData } = data;
        const result = await db2.update(certificates).set({ ...updateData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(certificates.id, id)).returning();
        if (result.length === 0) {
          throw new Error(`Certificate not found: ${id}`);
        }
        return result[0];
      }
      async deleteCertificate(id) {
        const db2 = await getDb();
        await db2.update(certificates).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(certificates.id, id));
      }
      // ============= SURVEYS =============
      async getSurveys() {
        const db2 = await getDb();
        return await db2.select().from(surveys).where(eq(surveys.isActive, true)).orderBy(asc(surveys.surveyName));
      }
      async getSurvey(id) {
        const db2 = await getDb();
        const result = await db2.select().from(surveys).where(eq(surveys.id, id)).limit(1);
        return result[0];
      }
      async createSurvey(survey) {
        const db2 = await getDb();
        const result = await db2.insert(surveys).values({
          ...survey,
          attachments: survey.attachments || []
        }).returning();
        return result[0];
      }
      async updateSurvey(id, data) {
        const db2 = await getDb();
        const { id: _, createdAt: __, ...updateData } = data;
        const result = await db2.update(surveys).set({ ...updateData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(surveys.id, id)).returning();
        if (result.length === 0) {
          throw new Error(`Survey not found: ${id}`);
        }
        return result[0];
      }
      async deleteSurvey(id) {
        const db2 = await getDb();
        await db2.update(surveys).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(surveys.id, id));
      }
      // ============= WORK ORDER EXECUTION DETAILS =============
      async getWorkOrderExecutionDetails(workOrderId) {
        const db2 = await getDb();
        return await db2.select().from(workOrderExecutionDetails).where(eq(workOrderExecutionDetails.workOrderId, workOrderId)).orderBy(desc(workOrderExecutionDetails.createdAt));
      }
      async getWorkOrderExecutionDetailById(id) {
        const db2 = await getDb();
        const result = await db2.select().from(workOrderExecutionDetails).where(eq(workOrderExecutionDetails.id, id)).limit(1);
        return result[0];
      }
      async createWorkOrderExecutionDetail(detail) {
        const db2 = await getDb();
        const result = await db2.insert(workOrderExecutionDetails).values(detail).returning();
        return result[0];
      }
      async updateWorkOrderExecutionDetail(id, data) {
        const db2 = await getDb();
        const { id: _, createdAt: __, ...updateData } = data;
        const result = await db2.update(workOrderExecutionDetails).set({ ...updateData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(workOrderExecutionDetails.id, id)).returning();
        if (result.length === 0) {
          throw new Error(`WorkOrderExecutionDetail not found: ${id}`);
        }
        return result[0];
      }
      // ============= REMAINING FILE-BOUND METHODS =============
      async getRunningHourParents(vesselId) {
        const db2 = await getDb();
        const parents = await db2.select().from(components).where(and(
          eq(components.vesselId, vesselId),
          eq(components.isParent, true),
          eq(components.isActive, true)
        )).orderBy(asc(components.name));
        const result = [];
        for (const parent of parents) {
          const children = await db2.select().from(components).where(eq(components.parentId, parent.id));
          result.push({
            ...parent,
            childCount: children.length,
            latestUpdate: parent.lastUpdated || void 0
          });
        }
        return result;
      }
      async cascadeRunningHoursUpdate(params) {
        const db2 = await getDb();
        const { parentComponentId, mode, value, dateUpdated, comments } = params;
        const now = /* @__PURE__ */ new Date();
        const children = await db2.select().from(components).where(eq(components.parentId, parentComponentId));
        const parentResult = await db2.select().from(components).where(eq(components.id, parentComponentId)).limit(1);
        let updatedComponents = 0;
        let auditsCreated = 0;
        let newRH = 0;
        if (parentResult.length > 0) {
          const parent = parentResult[0];
          const currentRH = parseFloat(parent.currentCumulativeRH || parent.rhCurrentMaster || "0");
          newRH = mode === "addDelta" ? currentRH + value : value;
          const updateData = {
            currentCumulativeRH: newRH.toString(),
            lastUpdated: dateUpdated,
            updatedAt: now
          };
          if (parent.rhCounterType === "MASTER") {
            updateData.rhCurrentMaster = newRH.toString();
            updateData.rhMasterUpdatedAt = now;
            updateData.rhMasterUpdateSource = "MANUAL";
          }
          await db2.update(components).set(updateData).where(eq(components.id, parentComponentId));
          await db2.insert(runningHoursAudit).values({
            vesselId: parent.vesselId || "unknown",
            componentId: parentComponentId,
            previousRH: currentRH.toString(),
            newRH: newRH.toString(),
            cumulativeRH: newRH.toString(),
            dateUpdatedLocal: dateUpdated,
            dateUpdatedTZ: "UTC",
            enteredAtUTC: now,
            userId: "system",
            source: "cascade",
            comments
          });
          updatedComponents++;
          auditsCreated++;
          if (parent.rhCounterType === "MASTER") {
            const inheritedComponents = await db2.select().from(components).where(and(
              eq(components.rhMasterComponentId, parentComponentId),
              eq(components.rhCounterType, "INHERITED")
            ));
            const delta = newRH - currentRH;
            for (const inherited of inheritedComponents) {
              const inheritedCurrentRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || "0");
              const newInheritedRH = inheritedCurrentRH + delta;
              await db2.update(components).set({
                rhCurrentInheritedCached: newRH.toString(),
                // Cache master's absolute value for reference
                rhInheritedUpdatedAt: now,
                currentCumulativeRH: newInheritedRH.toString(),
                // Their individual RH + delta
                lastUpdated: dateUpdated,
                updatedAt: now
              }).where(eq(components.id, inherited.id));
              await db2.insert(runningHoursAudit).values({
                vesselId: inherited.vesselId || "unknown",
                componentId: inherited.id,
                previousRH: inheritedCurrentRH.toString(),
                newRH: newInheritedRH.toString(),
                cumulativeRH: newInheritedRH.toString(),
                dateUpdatedLocal: dateUpdated,
                dateUpdatedTZ: "UTC",
                enteredAtUTC: now,
                userId: "system",
                source: "inherited_cascade",
                comments: `Inherited delta ${delta} from MASTER ${parent.componentCode || parent.name}`
              });
              updatedComponents++;
              auditsCreated++;
            }
          }
        }
        const structuralDelta = mode === "addDelta" ? value : newRH - parseFloat(parentResult[0]?.currentCumulativeRH || "0");
        for (const child of children) {
          const childCurrentRH = parseFloat(child.currentCumulativeRH || "0");
          const childNewRH = childCurrentRH + structuralDelta;
          const childUpdateData = {
            currentCumulativeRH: childNewRH.toString(),
            lastUpdated: dateUpdated,
            updatedAt: now
          };
          if (child.rhCounterType === "MASTER") {
            childUpdateData.rhCurrentMaster = childNewRH.toString();
            childUpdateData.rhMasterUpdatedAt = now;
          }
          if (child.rhCounterType === "INHERITED" && child.rhMasterComponentId === parentComponentId) {
            childUpdateData.rhCurrentInheritedCached = newRH.toString();
            childUpdateData.rhInheritedUpdatedAt = now;
          }
          await db2.update(components).set(childUpdateData).where(eq(components.id, child.id));
          await db2.insert(runningHoursAudit).values({
            vesselId: child.vesselId || "unknown",
            componentId: child.id,
            previousRH: childCurrentRH.toString(),
            newRH: childNewRH.toString(),
            cumulativeRH: childNewRH.toString(),
            dateUpdatedLocal: dateUpdated,
            dateUpdatedTZ: "UTC",
            enteredAtUTC: now,
            userId: "system",
            source: "cascade",
            comments
          });
          updatedComponents++;
          auditsCreated++;
        }
        return {
          updatedComponents,
          auditsCreated,
          workOrdersGenerated: 0,
          workOrders: []
        };
      }
      async bulkCreateComponents(componentsData) {
        if (componentsData.length === 0) return [];
        const db2 = await getDb();
        const result = await db2.insert(components).values(componentsData).returning();
        return result;
      }
      async bulkUpdateComponents(updates) {
        const db2 = await getDb();
        const results = [];
        for (const update of updates) {
          const { id: _, ...updateData } = update.data;
          const result = await db2.update(components).set(updateData).where(eq(components.id, update.id)).returning();
          if (result.length > 0) {
            results.push(result[0]);
          }
        }
        return results;
      }
      async bulkUpsertComponents(componentsData) {
        const db2 = await getDb();
        let created = 0;
        let updated = 0;
        for (const comp of componentsData) {
          const existing = await db2.select().from(components).where(eq(components.id, comp.id)).limit(1);
          if (existing.length > 0) {
            await db2.update(components).set(comp).where(eq(components.id, comp.id));
            updated++;
          } else {
            await db2.insert(components).values(comp);
            created++;
          }
        }
        return { created, updated };
      }
      async archiveComponentsByIds(ids) {
        if (ids.length === 0) return 0;
        const db2 = await getDb();
        const result = await db2.update(components).set({ isActive: false }).where(inArray(components.id, ids)).returning();
        return result.length;
      }
      async archiveSparesByIds(ids) {
        if (ids.length === 0) return 0;
        const db2 = await getDb();
        const result = await db2.update(spares).set({ isActive: false }).where(inArray(spares.id, ids)).returning();
        return result.length;
      }
      async getComponentsByCodes(codes, vesselId) {
        if (codes.length === 0) return /* @__PURE__ */ new Map();
        const db2 = await getDb();
        let results;
        if (vesselId) {
          results = await db2.select().from(components).where(and(
            inArray(components.componentCode, codes),
            eq(components.vesselId, vesselId)
          ));
        } else {
          results = await db2.select().from(components).where(inArray(components.componentCode, codes));
        }
        const resultMap = /* @__PURE__ */ new Map();
        for (const comp of results) {
          if (comp.componentCode) {
            resultMap.set(comp.componentCode, comp);
          }
        }
        return resultMap;
      }
      async archiveComponent(id) {
        const db2 = await getDb();
        const result = await db2.update(components).set({ isActive: false }).where(eq(components.id, id)).returning();
        if (result.length === 0) {
          throw new Error(`Component not found: ${id}`);
        }
        return result[0];
      }
      async archiveJob(id) {
        const db2 = await getDb();
        const result = await db2.update(jobs).set({ isActive: false }).where(eq(jobs.id, id)).returning();
        if (result.length === 0) {
          throw new Error(`Job not found: ${id}`);
        }
        return result[0];
      }
      async archiveWorkOrder(id) {
        const db2 = await getDb();
        const result = await db2.update(workOrders).set({ isActive: false }).where(eq(workOrders.id, id)).returning();
        if (result.length === 0) {
          throw new Error(`WorkOrder not found: ${id}`);
        }
        return result[0];
      }
      async calculateAndUpdateRecurringDefects(vesselId) {
        const db2 = await getDb();
        const vesselDefects = await db2.select().from(defects).where(eq(defects.vesselId, vesselId));
        const defectGroups = /* @__PURE__ */ new Map();
        for (const defect of vesselDefects) {
          const key = `${defect.vesselId}-${defect.defectCategory || "uncategorized"}`;
          if (!defectGroups.has(key)) {
            defectGroups.set(key, []);
          }
          defectGroups.get(key).push(defect);
        }
        for (const [key, group] of defectGroups) {
          if (group.length >= 2) {
            for (const defect of group) {
              await db2.update(defects).set({ isRecurring: true }).where(eq(defects.id, defect.id));
            }
          }
        }
      }
      async recalculateAllRecurringDefects() {
        const db2 = await getDb();
        const allVessels = await db2.select().from(vessels);
        for (const vessel of allVessels) {
          await this.calculateAndUpdateRecurringDefects(vessel.id);
        }
      }
      async purgeJobsAndLinkedData(vesselId) {
        const db2 = await getDb();
        const vesselJobs = await db2.select().from(jobs).where(eq(jobs.vesselId, vesselId));
        const jobIds = vesselJobs.map((j) => j.id);
        let workOrdersDeleted = 0;
        if (jobIds.length > 0) {
          const woResult = await db2.delete(workOrders).where(inArray(workOrders.jobId, jobIds)).returning();
          workOrdersDeleted = woResult.length;
        }
        const jobResult = await db2.delete(jobs).where(eq(jobs.vesselId, vesselId)).returning();
        return { jobsDeleted: jobResult.length, workOrdersDeleted };
      }
      async getVesselsByFleet(fleetId) {
        const db2 = await getDb();
        return await db2.select().from(vessels).where(eq(vessels.fleetId, fleetId));
      }
      async getVesselsWithFleets() {
        const db2 = await getDb();
        const allVessels = await db2.select().from(vessels);
        const allFleets = await db2.select().from(fleets);
        const fleetMap = new Map(allFleets.map((f) => [f.id, f]));
        return allVessels.map((vessel) => {
          const fleet = vessel.fleetId ? fleetMap.get(vessel.fleetId) : void 0;
          return {
            ...vessel,
            fleetName: fleet?.name,
            fleetCode: fleet?.code
          };
        });
      }
      async getFleetAdminMetrics() {
        const db2 = await getDb();
        const makersResult = await db2.select({ count: sql2`count(*)` }).from(makers);
        const masterListsResult = await db2.select({ count: sql2`count(*)` }).from(masterLists);
        const fleetComponentsResult = await db2.select({ count: sql2`count(*)` }).from(components).where(eq(components.dataScope, "fleet"));
        const modelsResult = await db2.select({ count: sql2`count(distinct model)` }).from(components).where(sql2`model is not null`);
        return {
          totalMakers: Number(makersResult[0]?.count || 0),
          totalModels: Number(modelsResult[0]?.count || 0),
          totalFleetComponents: Number(fleetComponentsResult[0]?.count || 0),
          totalMasterLists: Number(masterListsResult[0]?.count || 0)
        };
      }
      // ============= FLEET VESSEL MAPPING (Rule #16) =============
      async createFleetVesselMappings(data) {
        const db2 = await getDb();
        const results = [];
        for (const fleetEntityId of data.fleetEntityIds) {
          const result = await db2.insert(fleetVesselMapping).values({
            fleetEquipmentCode: fleetEntityId,
            vesselCode: data.vesselId,
            vesselComponentCode: data.vesselEntityCode,
            createdBy: data.mappedBy
          }).returning();
          if (result.length > 0) results.push(result[0]);
        }
        return results;
      }
      async deleteFleetVesselMapping(id) {
        const db2 = await getDb();
        await db2.delete(fleetVesselMapping).where(eq(fleetVesselMapping.id, parseInt(id)));
      }
      // ============= ON-DEMAND WORK ORDER GENERATION (Rule #4) =============
      async generateOnDemandWorkOrder(jobId, reason) {
        const db2 = await getDb();
        const jobResult = await db2.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
        if (jobResult.length === 0) {
          throw new Error(`Job not found: ${jobId}`);
        }
        const job = jobResult[0];
        const today = /* @__PURE__ */ new Date();
        const year = today.getFullYear();
        const existingWOs = await db2.select().from(workOrders).where(eq(workOrders.jobId, jobId));
        const woCount = existingWOs.length + 1;
        const workOrderNo = `${job.jobNo}.WO-${year}-${String(woCount).padStart(3, "0")}`;
        const newWorkOrder = {
          id: `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          vesselId: job.vesselId,
          vesselName: job.vesselName || "",
          workOrderNo,
          templateCode: workOrderNo,
          jobId: job.id,
          jobTitle: job.jobTitle,
          componentId: job.componentId,
          component: job.componentName || "",
          componentCode: job.componentCode,
          status: "Active",
          dueDate: job.nextDueDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          remarks: `On-demand work order generated. Reason: ${reason}`,
          isActive: true,
          workOrderType: "Planned",
          maintenanceBasis: job.maintenanceBasis,
          taskType: job.maintenanceType,
          assignedTo: job.assignedTo || "Unassigned"
        };
        const result = await db2.insert(workOrders).values(newWorkOrder).returning();
        return result[0];
      }
      // ============= POSTPONED WO REAPPEARANCE (Rule #5) =============
      async checkAndRevertPostponedWorkOrders(vesselId) {
        const db2 = await getDb();
        const today = /* @__PURE__ */ new Date();
        const todayStr = today.toISOString().split("T")[0];
        let query = db2.select().from(workOrders).where(and(
          eq(workOrders.status, "Postponed"),
          eq(workOrders.isActive, true)
        ));
        const postponedWOs = await query;
        const revertedWorkOrders = [];
        for (const wo of postponedWOs) {
          if (vesselId && wo.vesselId !== vesselId) continue;
          if (wo.postponedDate && wo.postponedDate <= todayStr) {
            const result = await db2.update(workOrders).set({
              status: "Pending",
              postponedDate: null,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(workOrders.id, wo.id)).returning();
            if (result.length > 0) {
              revertedWorkOrders.push(result[0]);
            }
          }
        }
        return {
          revertedCount: revertedWorkOrders.length,
          revertedWorkOrders
        };
      }
      // ============= COMPONENT VESSEL MAPPING =============
      async getComponentVesselMappings() {
        const db2 = await getDb();
        return await db2.select().from(fleetComponentMapping);
      }
      async createComponentVesselMapping(data) {
        const db2 = await getDb();
        const result = await db2.insert(fleetComponentMapping).values({
          fleetEquipmentCode: data.fleetEquipmentCode,
          vesselCode: data.vesselCode,
          vesselComponentCode: data.componentCode
        }).returning();
        return result[0];
      }
      async deleteComponentVesselMapping(id) {
        const db2 = await getDb();
        await db2.delete(fleetComponentMapping).where(eq(fleetComponentMapping.id, id));
      }
      // ============= PMS VESSEL SETTINGS =============
      async createOrUpdatePmsVesselSettings(settings) {
        const db2 = await getDb();
        const existing = await db2.select().from(pmsVesselSettings).where(eq(pmsVesselSettings.vesselId, settings.vesselId)).limit(1);
        if (existing.length > 0) {
          const result = await db2.update(pmsVesselSettings).set({ ...settings, updatedAt: /* @__PURE__ */ new Date() }).where(eq(pmsVesselSettings.vesselId, settings.vesselId)).returning();
          return result[0];
        } else {
          const result = await db2.insert(pmsVesselSettings).values(settings).returning();
          return result[0];
        }
      }
      // ============= FLEET MANAGEMENT =============
      async getAllFleets() {
        const db2 = await getDb();
        return await db2.select().from(fleets).orderBy(asc(fleets.name));
      }
      async getFleetById(id) {
        const db2 = await getDb();
        const result = await db2.select().from(fleets).where(eq(fleets.id, id)).limit(1);
        return result[0];
      }
      async assignVesselToFleet(vesselId, fleetId) {
        const db2 = await getDb();
        const result = await db2.update(vessels).set({ fleetId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(vessels.id, vesselId)).returning();
        if (result.length === 0) {
          throw new Error(`Vessel not found: ${vesselId}`);
        }
        return result[0];
      }
      // ============= INVENTORY MANAGEMENT: LOCATIONS =============
      async getLocations(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(locations).where(eq(locations.vesselId, vesselId)).orderBy(asc(locations.locationName));
      }
      async getLocationById(id) {
        const db2 = await getDb();
        const result = await db2.select().from(locations).where(eq(locations.id, id));
        return result[0];
      }
      async getLocationByName(vesselId, locationName) {
        const db2 = await getDb();
        const normalizedName = locationName.trim().toUpperCase();
        const result = await db2.select().from(locations).where(and(
          eq(locations.vesselId, vesselId),
          sql2`UPPER(TRIM(${locations.locationName})) = ${normalizedName}`
        ));
        return result[0];
      }
      async createLocation(location) {
        const db2 = await getDb();
        const normalizedName = location.locationName.trim();
        const result = await db2.insert(locations).values({
          ...location,
          locationName: normalizedName
        }).returning();
        return result[0];
      }
      async findOrCreateLocation(vesselId, locationName, createdBy) {
        const existing = await this.getLocationByName(vesselId, locationName);
        if (existing) {
          return existing;
        }
        return await this.createLocation({
          vesselId,
          locationName: locationName.trim(),
          createdBy
        });
      }
      async updateLocation(id, data) {
        const db2 = await getDb();
        const result = await db2.update(locations).set(data).where(eq(locations.id, id)).returning();
        if (!result[0]) {
          throw new Error(`Location ${id} not found`);
        }
        return result[0];
      }
      // ============= INVENTORY MANAGEMENT: SPARE-COMPONENT LINKS =============
      async getSpareComponentLinks(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(spareComponentLinks).where(eq(spareComponentLinks.vesselId, vesselId));
      }
      async getSpareComponentLinksBySpare(spareId) {
        const db2 = await getDb();
        return await db2.select().from(spareComponentLinks).where(eq(spareComponentLinks.spareId, spareId));
      }
      async getSpareComponentLinksByComponent(componentId) {
        const db2 = await getDb();
        return await db2.select().from(spareComponentLinks).where(eq(spareComponentLinks.componentId, componentId));
      }
      async createSpareComponentLink(link) {
        const db2 = await getDb();
        const result = await db2.insert(spareComponentLinks).values(link).returning();
        return result[0];
      }
      async deleteSpareComponentLink(spareId, componentId) {
        const db2 = await getDb();
        await db2.delete(spareComponentLinks).where(and(
          eq(spareComponentLinks.spareId, spareId),
          eq(spareComponentLinks.componentId, componentId)
        ));
      }
      async getLinkedComponentsForSpare(spareId) {
        const db2 = await getDb();
        const links = await db2.select({
          componentId: spareComponentLinks.componentId,
          componentCode: components.componentCode,
          componentName: components.name
        }).from(spareComponentLinks).innerJoin(components, eq(spareComponentLinks.componentId, components.id)).where(eq(spareComponentLinks.spareId, spareId));
        return links.map((l) => ({
          componentId: l.componentId,
          componentCode: l.componentCode || "",
          componentName: l.componentName || ""
        }));
      }
      // ============= JOB-COMPONENT LINKS (Many-to-Many for Shared Jobs) =============
      async getJobComponentLinks(vesselId) {
        const db2 = await getDb();
        return await db2.select().from(jobComponentLinks).where(eq(jobComponentLinks.vesselId, vesselId));
      }
      async getJobComponentLinksByJob(jobId) {
        const db2 = await getDb();
        return await db2.select().from(jobComponentLinks).where(eq(jobComponentLinks.jobId, jobId));
      }
      async getJobComponentLinksByComponent(componentId) {
        const db2 = await getDb();
        return await db2.select().from(jobComponentLinks).where(eq(jobComponentLinks.componentId, componentId));
      }
      async createJobComponentLink(link) {
        const db2 = await getDb();
        const result = await db2.insert(jobComponentLinks).values(link).returning();
        return result[0];
      }
      async deleteJobComponentLink(jobId, componentId) {
        const db2 = await getDb();
        await db2.delete(jobComponentLinks).where(and(
          eq(jobComponentLinks.jobId, jobId),
          eq(jobComponentLinks.componentId, componentId)
        ));
      }
      async getLinkedComponentsForJob(jobId) {
        const db2 = await getDb();
        const links = await db2.select({
          componentId: jobComponentLinks.componentId,
          componentCode: components.componentCode,
          componentName: components.name
        }).from(jobComponentLinks).innerJoin(components, eq(jobComponentLinks.componentId, components.id)).where(eq(jobComponentLinks.jobId, jobId));
        return links.map((l) => ({
          componentId: l.componentId,
          componentCode: l.componentCode || "",
          componentName: l.componentName || ""
        }));
      }
      async getLinkedJobsForComponent(componentId) {
        const db2 = await getDb();
        const links = await db2.select({
          jobId: jobComponentLinks.jobId,
          jobNo: jobs.jobNo,
          jobTitle: jobs.jobTitle
        }).from(jobComponentLinks).innerJoin(jobs, eq(jobComponentLinks.jobId, jobs.id)).where(eq(jobComponentLinks.componentId, componentId));
        return links.map((l) => ({
          jobId: l.jobId,
          jobNo: l.jobNo || "",
          jobTitle: l.jobTitle || ""
        }));
      }
      // ============= INVENTORY MANAGEMENT: SPARE LOCATION STOCK =============
      async getSpareLocationStock(spareId) {
        const db2 = await getDb();
        return await db2.select().from(spareLocationStock).where(eq(spareLocationStock.spareId, spareId));
      }
      async getSpareLocationStockByLocation(locationId) {
        const db2 = await getDb();
        return await db2.select().from(spareLocationStock).where(eq(spareLocationStock.locationId, locationId));
      }
      async getSpareLocationStockItem(spareId, locationId) {
        const db2 = await getDb();
        const result = await db2.select().from(spareLocationStock).where(and(
          eq(spareLocationStock.spareId, spareId),
          eq(spareLocationStock.locationId, locationId)
        ));
        return result[0];
      }
      async upsertSpareLocationStock(data) {
        const db2 = await getDb();
        const existing = await this.getSpareLocationStockItem(data.spareId, data.locationId);
        if (existing) {
          const result = await db2.update(spareLocationStock).set({ qty: data.qty }).where(eq(spareLocationStock.id, existing.id)).returning();
          return result[0];
        } else {
          const result = await db2.insert(spareLocationStock).values(data).returning();
          return result[0];
        }
      }
      async updateSpareLocationStockQty(spareId, locationId, qtyChange) {
        const db2 = await getDb();
        const existing = await this.getSpareLocationStockItem(spareId, locationId);
        if (!existing) {
          throw new Error(`No stock record found for spare ${spareId} at location ${locationId}`);
        }
        const newQty = existing.qty + qtyChange;
        if (newQty < 0) {
          throw new Error(`Cannot reduce stock below zero. Current: ${existing.qty}, Requested change: ${qtyChange}`);
        }
        const result = await db2.update(spareLocationStock).set({ qty: newQty }).where(eq(spareLocationStock.id, existing.id)).returning();
        return result[0];
      }
      async getSpareRobTotal(spareId) {
        const stockRecords = await this.getSpareLocationStock(spareId);
        return stockRecords.reduce((sum, s) => sum + s.qty, 0);
      }
      async getSpareLocationsWithQty(spareId) {
        const db2 = await getDb();
        const result = await db2.select({
          locationId: spareLocationStock.locationId,
          locationName: locations.locationName,
          qty: spareLocationStock.qty
        }).from(spareLocationStock).innerJoin(locations, eq(spareLocationStock.locationId, locations.id)).where(eq(spareLocationStock.spareId, spareId));
        return result;
      }
      async getSparesAtLocation(locationId) {
        const db2 = await getDb();
        const result = await db2.select({
          spareId: spareLocationStock.spareId,
          partCode: spares.partCode,
          partName: spares.partName,
          qty: spareLocationStock.qty
        }).from(spareLocationStock).innerJoin(spares, eq(spareLocationStock.spareId, spares.id)).where(eq(spareLocationStock.locationId, locationId));
        return result;
      }
      // ============= INVENTORY MANAGEMENT: TRANSACTIONS =============
      async createInventoryTransaction(txn) {
        const db2 = await getDb();
        const result = await db2.insert(inventoryTransactions).values(txn).returning();
        return result[0];
      }
      async getInventoryTransactions(vesselId, options) {
        const db2 = await getDb();
        const conditions = [eq(inventoryTransactions.vesselId, vesselId)];
        if (options?.spareId) {
          conditions.push(eq(inventoryTransactions.spareId, options.spareId));
        }
        if (options?.locationId) {
          conditions.push(eq(inventoryTransactions.locationId, options.locationId));
        }
        if (options?.eventType) {
          conditions.push(eq(inventoryTransactions.eventType, options.eventType));
        }
        let query = db2.select().from(inventoryTransactions).where(and(...conditions)).orderBy(desc(inventoryTransactions.txnDatetime));
        if (options?.limit) {
          query = query.limit(options.limit);
        }
        return await query;
      }
      async performInventoryTransaction(input) {
        const db2 = await getDb();
        if (input.eventType === "CONSUME") {
          if (input.referenceType !== "WORK_ORDER") {
            throw new Error("CONSUME events require referenceType WORK_ORDER for traceability");
          }
          if (!input.referenceId) {
            throw new Error("CONSUME events require a valid work order reference ID");
          }
        }
        const location = await this.getLocationById(input.locationId);
        if (!location) {
          throw new Error(`Location ${input.locationId} not found`);
        }
        const currentLocationStock = await this.getSpareLocationStockItem(input.spareId, input.locationId);
        const currentLocationQty = currentLocationStock?.qty ?? 0;
        const currentTotalRob = await this.getSpareRobTotal(input.spareId);
        const newLocationQty = currentLocationQty + input.qtyChange;
        const newTotalRob = currentTotalRob + input.qtyChange;
        if (newLocationQty < 0) {
          throw new Error(`NEGATIVE_STOCK_PREVENTED: Cannot consume ${Math.abs(input.qtyChange)} from location. Current stock: ${currentLocationQty}`);
        }
        if (newTotalRob < 0) {
          throw new Error(`NEGATIVE_STOCK_PREVENTED: Transaction would result in negative total ROB. Current total: ${currentTotalRob}, Change: ${input.qtyChange}`);
        }
        if (input.eventType === "CONSUME") {
          const consumeQty = Math.abs(input.qtyChange);
          if (currentLocationQty < consumeQty) {
            throw new Error(`INSUFFICIENT_STOCK: Available at location: ${currentLocationQty}, Requested: ${consumeQty}`);
          }
        }
        const spare = await this.getSpare(input.spareId);
        if (!spare) {
          throw new Error(`Spare ${input.spareId} not found`);
        }
        await this.upsertSpareLocationStock({
          vesselId: input.vesselId,
          spareId: input.spareId,
          locationId: input.locationId,
          qty: newLocationQty
        });
        const transaction = await this.createInventoryTransaction({
          vesselId: input.vesselId,
          spareId: input.spareId,
          locationId: input.locationId,
          eventType: input.eventType,
          qtyChange: input.qtyChange,
          robTotalBefore: currentTotalRob,
          robTotalAfter: newTotalRob,
          robLocationBefore: currentLocationQty,
          robLocationAfter: newLocationQty,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          referenceNote: input.referenceNote,
          userId: input.userId
        });
        await db2.update(spares).set({ rob: newTotalRob, updatedAt: /* @__PURE__ */ new Date(), updatedBy: input.userId }).where(eq(spares.id, input.spareId));
        return {
          transaction,
          newLocationQty,
          newTotalRob
        };
      }
      async getSpareWithInventory(spareId) {
        const spare = await this.getSpare(spareId);
        if (!spare) return null;
        const robTotal = await this.getSpareRobTotal(spareId);
        const locationsWithQty = await this.getSpareLocationsWithQty(spareId);
        const linkedComponents = await this.getLinkedComponentsForSpare(spareId);
        const stockStatus = robTotal <= (spare.min ?? 0) ? "At Min" : "OK";
        return {
          spare,
          robTotal,
          stockStatus,
          locations: locationsWithQty,
          linkedComponents
        };
      }
      async getSparesWithInventoryByVessel(vesselId) {
        const sparesInVessel = await this.getSpares(vesselId);
        const results = [];
        for (const spare of sparesInVessel) {
          const withInventory = await this.getSpareWithInventory(spare.id);
          if (withInventory) {
            results.push(withInventory);
          }
        }
        return results;
      }
      async getSparesWithInventoryByComponent(componentId) {
        const db2 = await getDb();
        const directSpares = await db2.select().from(spares).where(eq(spares.componentId, componentId));
        const links = await this.getSpareComponentLinksByComponent(componentId);
        const spareIdSet = /* @__PURE__ */ new Set();
        const results = [];
        for (const spare of directSpares) {
          if (!spareIdSet.has(spare.id)) {
            spareIdSet.add(spare.id);
            const withInventory = await this.getSpareWithInventory(spare.id);
            if (withInventory) {
              results.push(withInventory);
            }
          }
        }
        for (const link of links) {
          if (!spareIdSet.has(link.spareId)) {
            spareIdSet.add(link.spareId);
            const withInventory = await this.getSpareWithInventory(link.spareId);
            if (withInventory) {
              results.push(withInventory);
            }
          }
        }
        return results;
      }
    };
    postgresStorage = new PostgresStorage();
  }
});

// server/memStorage.ts
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
function toArray(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return Object.values(obj);
}
var DATA_FILE, MemStorage, memStorage;
var init_memStorage = __esm({
  "server/memStorage.ts"() {
    "use strict";
    DATA_FILE = path.join(process.cwd(), "test-data.json");
    MemStorage = class {
      data = {};
      idCounters = /* @__PURE__ */ new Map();
      constructor() {
        this.loadData();
      }
      loadData() {
        try {
          if (fs.existsSync(DATA_FILE)) {
            const content = fs.readFileSync(DATA_FILE, "utf-8");
            this.data = JSON.parse(content);
            console.log("[MemStorage] Loaded data from test-data.json");
            this.initializeIdCounters();
          } else {
            console.log("[MemStorage] No test-data.json found, starting with empty data");
            this.data = {};
          }
        } catch (error) {
          console.error("[MemStorage] Error loading test-data.json:", error);
          this.data = {};
        }
      }
      initializeIdCounters() {
        const collections = ["users", "runningHoursAudits", "audits", "spares", "defects", "jobs", "workOrders", "storesItems"];
        for (const collection of collections) {
          const items = this.data[collection];
          if (items) {
            const itemsArray = Array.isArray(items) ? items : Object.values(items);
            const validItems = itemsArray.filter((item) => item != null);
            let maxId = 0;
            for (const item of validItems) {
              if (typeof item.id === "number" && item.id > maxId) {
                maxId = item.id;
              }
            }
            if (maxId > 0) {
              this.idCounters.set(collection, maxId);
            }
            if (Array.isArray(items)) {
              this.data[collection] = validItems;
            } else {
              const cleanedObj = {};
              for (const [key, value] of Object.entries(items)) {
                if (value != null) {
                  cleanedObj[key] = value;
                }
              }
              this.data[collection] = cleanedObj;
            }
          }
        }
      }
      saveData() {
        try {
          fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
        } catch (error) {
          console.error("[MemStorage] Error saving data:", error);
        }
      }
      getNextId(collection) {
        const current = this.idCounters.get(collection) || 0;
        const next = current + 1;
        this.idCounters.set(collection, next);
        return next;
      }
      // User methods
      async getUser(id) {
        const users2 = toArray(this.data.users);
        return users2.find((u) => u.id === id);
      }
      async getUserByUsername(username) {
        const users2 = toArray(this.data.users);
        return users2.find((u) => u.username === username);
      }
      async createUser(user) {
        if (!this.data.users) this.data.users = {};
        const newUser = { ...user, id: this.getNextId("users") };
        this.data.users[newUser.id] = newUser;
        this.saveData();
        return newUser;
      }
      async getUsers() {
        return toArray(this.data.users);
      }
      // Component methods
      async getComponents(vesselId) {
        return toArray(this.data.components).filter((c) => c.vesselId === vesselId);
      }
      async getComponent(id) {
        const components2 = toArray(this.data.components);
        return components2.find((c) => c.id === id);
      }
      async getComponentByCode(componentCode, vesselId) {
        return toArray(this.data.components).find(
          (c) => c.componentCode === componentCode && c.vesselId === vesselId
        );
      }
      async createComponent(component) {
        if (!this.data.components) this.data.components = {};
        const id = component.id || component.componentCode || randomUUID();
        const componentWithId = { ...component, id };
        this.data.components[id] = componentWithId;
        this.saveData();
        return componentWithId;
      }
      async updateComponent(id, data) {
        if (this.data.components && this.data.components[id]) {
          this.data.components[id] = { ...this.data.components[id], ...data };
          this.saveData();
          return this.data.components[id];
        }
        return void 0;
      }
      async deleteComponent(id) {
        if (this.data.components && this.data.components[id]) {
          delete this.data.components[id];
          this.saveData();
        }
      }
      async inactivateComponent(id, userId, options) {
        return { success: true, message: "Preview mode - operation simulated", componentsInactivated: 0, jobsInactivated: 0 };
      }
      async createRunningHoursAudit(audit) {
        return { ...audit, id: this.getNextId("audits") };
      }
      async getRunningHoursAudits(componentId, limit) {
        return [];
      }
      async getRunningHoursAuditsInDateRange(componentId, startDate, endDate) {
        return [];
      }
      async getRunningHourParents(vesselId) {
        return [];
      }
      /**
       * Cascade running hours update - updates the MASTER component and cascades to INHERITED children
       */
      async cascadeRunningHoursUpdate(params) {
        console.log("[MemStorage] cascadeRunningHoursUpdate called:", params);
        let component = await this.getComponent(params.parentComponentId);
        if (!component) {
          const allComponents = toArray(this.data.components);
          component = allComponents.find((c) => c.componentCode === params.parentComponentId);
        }
        if (!component) {
          console.error("[MemStorage] Component not found:", params.parentComponentId);
          throw new Error(`Component ${params.parentComponentId} not found`);
        }
        console.log("[MemStorage] Found component:", component.componentCode, "current RH:", component.rhCurrentMaster || component.currentCumulativeRH);
        const currentRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || "0");
        let newRHValue;
        if (params.mode === "setTotal") {
          newRHValue = params.value;
        } else {
          newRHValue = currentRH + params.value;
        }
        console.log("[MemStorage] Updating RH from", currentRH, "to", newRHValue);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const updatedComponents = [];
        const updateData = {
          rhCurrentMaster: newRHValue.toString(),
          currentCumulativeRH: newRHValue.toString(),
          rhMasterUpdatedAt: now,
          rhMasterUpdatedBy: params.userId || "admin",
          rhMasterUpdateSource: "MANUAL",
          lastUpdated: params.dateUpdated || now,
          updatedAt: now
        };
        if (params.meterReplaced) {
          updateData.meterReplaced = true;
          updateData.oldMeterFinal = params.oldMeterFinal;
          updateData.newMeterStart = params.newMeterStart;
        }
        const componentId = component.id || component.componentCode;
        await this.updateComponent(componentId, updateData);
        updatedComponents.push(componentId);
        console.log("[MemStorage] Master component updated:", componentId);
        const inheritedComponents = await this.getInheritedComponents(componentId);
        console.log("[MemStorage] Found", inheritedComponents.length, "inherited components to cascade");
        const delta = newRHValue - currentRH;
        for (const inherited of inheritedComponents) {
          const inheritedCurrentRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || "0");
          const newInheritedRH = inheritedCurrentRH + delta;
          await this.updateComponent(inherited.id, {
            rhCurrentInheritedCached: newRHValue.toString(),
            // Cache the master's value for reference
            currentCumulativeRH: newInheritedRH.toString(),
            // Their individual RH + delta
            rhInheritedUpdatedAt: now,
            lastUpdated: now,
            updatedAt: now
          });
          updatedComponents.push(inherited.id);
          console.log("[MemStorage] Inherited component updated:", inherited.id, "from", inheritedCurrentRH, "to", newInheritedRH, "(delta:", delta, ")");
        }
        if (!this.data.runningHoursAudits) this.data.runningHoursAudits = [];
        const auditRecord = {
          id: this.getNextId("runningHoursAudits"),
          componentId,
          previousValue: currentRH.toString(),
          newValue: newRHValue.toString(),
          delta: (newRHValue - currentRH).toString(),
          mode: params.mode,
          dateUpdated: params.dateUpdated,
          comments: params.comments,
          meterReplaced: params.meterReplaced || false,
          userId: params.userId || "admin",
          createdAt: now
        };
        this.data.runningHoursAudits.push(auditRecord);
        this.saveData();
        console.log("[MemStorage] cascadeRunningHoursUpdate complete. Updated", updatedComponents.length, "components");
        return {
          success: true,
          updatedComponents,
          newValue: newRHValue,
          previousValue: currentRH,
          auditId: auditRecord.id
        };
      }
      // RH Counter Type Methods (B7.B)
      async getMasterComponents(vesselId) {
        const components2 = toArray(this.data.components).filter(
          (c) => c.vesselId === vesselId && c.rhCounterType === "MASTER"
        );
        return components2;
      }
      async getInheritedComponents(masterComponentId) {
        let masterComponent = await this.getComponent(masterComponentId);
        if (!masterComponent) {
          const allComponents = toArray(this.data.components);
          masterComponent = allComponents.find((c) => c.componentCode === masterComponentId);
        }
        const masterComponentCode = masterComponent?.componentCode || masterComponentId;
        const masterComponentFullId = masterComponent?.id || masterComponentId;
        return toArray(this.data.components).filter(
          (c) => c.rhCounterType === "INHERITED" && (c.rhMasterComponentId === masterComponentFullId || c.rhMasterComponentId === masterComponentCode || c.rhMasterComponentId === masterComponentId)
        );
      }
      async updateRHConfig(params) {
        const component = await this.getComponent(params.componentId);
        if (!component) throw new Error(`Component ${params.componentId} not found`);
        const updateData = {
          rhCounterType: params.rhCounterType,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (params.rhCounterType === "MASTER") {
          updateData.rhMasterComponentId = null;
          updateData.rhCurrentInheritedCached = null;
          if (!component.rhCurrentMaster) {
            updateData.rhCurrentMaster = "0";
            updateData.rhMasterUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
          }
        } else if (params.rhCounterType === "INHERITED") {
          updateData.rhMasterComponentId = params.rhMasterComponentId;
          updateData.rhCurrentMaster = null;
          const master = await this.getComponent(params.rhMasterComponentId);
          if (master) {
            updateData.rhCurrentInheritedCached = master.rhCurrentMaster || "0";
            updateData.rhInheritedUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
          }
        } else {
          updateData.rhMasterComponentId = null;
          updateData.rhCurrentMaster = null;
          updateData.rhCurrentInheritedCached = null;
        }
        return this.updateComponent(params.componentId, updateData);
      }
      async updateMasterRunningHours(params) {
        const component = await this.getComponent(params.componentId);
        if (!component) throw new Error(`Component ${params.componentId} not found`);
        if (component.rhCounterType !== "MASTER") {
          throw new Error(`Component ${params.componentId} is not a MASTER counter type`);
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const masterUpdated = await this.updateComponent(params.componentId, {
          rhCurrentMaster: params.newRHValue.toString(),
          currentCumulativeRH: params.newRHValue.toString(),
          rhMasterUpdatedAt: now,
          rhMasterUpdatedBy: params.userId,
          rhMasterUpdateSource: params.updateSource,
          lastUpdated: now
        });
        const inheritedComponents = await this.getInheritedComponents(params.componentId);
        let inheritedUpdated = 0;
        for (const inherited of inheritedComponents) {
          await this.updateComponent(inherited.id, {
            rhCurrentInheritedCached: params.newRHValue.toString(),
            currentCumulativeRH: params.newRHValue.toString(),
            rhInheritedUpdatedAt: now,
            lastUpdated: now
          });
          inheritedUpdated++;
        }
        return { masterUpdated, inheritedUpdated };
      }
      // CENTRALIZED RH UPDATE: Set running hours for any component with automatic field sync
      // This is the SINGLE SOURCE OF TRUTH for all running hours updates
      async setComponentRunningHours(params) {
        const component = await this.getComponent(params.componentId);
        if (!component) {
          throw new Error(`Component ${params.componentId} not found`);
        }
        const rhValueStr = params.newRHValue.toString();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const lastUpdatedValue = params.lastUpdatedDate || now;
        let inheritedUpdated = 0;
        if (component.rhCounterType === "MASTER") {
          const updated = await this.updateComponent(params.componentId, {
            rhCurrentMaster: rhValueStr,
            currentCumulativeRH: rhValueStr,
            rhMasterUpdatedAt: now,
            rhMasterUpdatedBy: params.userId,
            rhMasterUpdateSource: params.updateSource,
            lastUpdated: lastUpdatedValue
          });
          const inheritedComponents = await this.getInheritedComponents(params.componentId);
          for (const inherited of inheritedComponents) {
            await this.updateComponent(inherited.id, {
              rhCurrentInheritedCached: rhValueStr,
              currentCumulativeRH: rhValueStr,
              rhInheritedUpdatedAt: now,
              lastUpdated: lastUpdatedValue
            });
            inheritedUpdated++;
          }
          return { component: updated, inheritedUpdated };
        } else if (component.rhCounterType === "INHERITED") {
          const updated = await this.updateComponent(params.componentId, {
            rhCurrentInheritedCached: rhValueStr,
            currentCumulativeRH: rhValueStr,
            rhInheritedUpdatedAt: now,
            lastUpdated: lastUpdatedValue
          });
          return { component: updated, inheritedUpdated: 0 };
        } else {
          const updated = await this.updateComponent(params.componentId, {
            currentCumulativeRH: rhValueStr,
            lastUpdated: lastUpdatedValue
          });
          return { component: updated, inheritedUpdated: 0 };
        }
      }
      // Fleet methods
      async getFleets() {
        return toArray(this.data.fleets);
      }
      async getFleet(id) {
        if (this.data.fleets && this.data.fleets[id]) return this.data.fleets[id];
        return toArray(this.data.fleets).find((f) => f.id === id);
      }
      async createFleet(fleet) {
        if (!this.data.fleets) this.data.fleets = {};
        const id = fleet.id || `fleet-${this.getNextId("fleets")}`;
        const newFleet = { ...fleet, id };
        this.data.fleets[id] = newFleet;
        this.saveData();
        return newFleet;
      }
      async updateFleet(id, data) {
        if (this.data.fleets && this.data.fleets[id]) {
          this.data.fleets[id] = { ...this.data.fleets[id], ...data };
          this.saveData();
          return this.data.fleets[id];
        }
        return void 0;
      }
      async deleteFleet(id) {
        if (this.data.fleets && this.data.fleets[id]) {
          delete this.data.fleets[id];
          this.saveData();
        }
      }
      // Vessel methods
      async getVessels() {
        return toArray(this.data.vessels);
      }
      async getVessel(id) {
        if (this.data.vessels && this.data.vessels[id]) return this.data.vessels[id];
        return toArray(this.data.vessels).find((v) => v.id === id);
      }
      async createVessel(vessel) {
        if (!this.data.vessels) this.data.vessels = {};
        const newVessel = { ...vessel, id: vessel.id || `V${String(this.getNextId("vessels")).padStart(3, "0")}` };
        this.data.vessels[newVessel.id] = newVessel;
        this.saveData();
        return newVessel;
      }
      async updateVessel(id, data) {
        if (this.data.vessels && this.data.vessels[id]) {
          this.data.vessels[id] = { ...this.data.vessels[id], ...data };
          this.saveData();
          return this.data.vessels[id];
        }
        return void 0;
      }
      async deleteVessel(id) {
        if (this.data.vessels && this.data.vessels[id]) {
          delete this.data.vessels[id];
          this.saveData();
        }
      }
      // Job methods
      async getJobs(vesselId, componentId) {
        let result = toArray(this.data.jobs);
        if (vesselId) {
          result = result.filter((j) => j.vesselId === vesselId);
        }
        if (componentId) {
          const directJobs = result.filter((j) => j.componentId === componentId);
          const links = toArray(this.data.jobComponentLinks).filter(
            (link) => link.componentId === componentId
          );
          const linkedJobIds = new Set(links.map((link) => link.jobId));
          const linkedJobs = result.filter((j) => linkedJobIds.has(j.id));
          const jobMap = /* @__PURE__ */ new Map();
          for (const job of directJobs) {
            jobMap.set(job.id, job);
          }
          for (const job of linkedJobs) {
            if (!jobMap.has(job.id)) {
              jobMap.set(job.id, job);
            }
          }
          return Array.from(jobMap.values()).sort(
            (a, b) => (a.jobNo || "").localeCompare(b.jobNo || "")
          );
        }
        return result;
      }
      async getJob(id) {
        if (this.data.jobs && this.data.jobs[id]) return this.data.jobs[id];
        return toArray(this.data.jobs).find((j) => j.id === id);
      }
      async createJob(job) {
        if (!this.data.jobs) this.data.jobs = {};
        const newJob = { ...job, id: job.id || this.getNextId("jobs") };
        this.data.jobs[newJob.id] = newJob;
        this.saveData();
        return newJob;
      }
      async updateJob(id, data) {
        if (this.data.jobs && this.data.jobs[id]) {
          this.data.jobs[id] = { ...this.data.jobs[id], ...data };
          this.saveData();
          return this.data.jobs[id];
        }
        return void 0;
      }
      async deleteJob(id) {
        if (this.data.jobs && this.data.jobs[id]) {
          delete this.data.jobs[id];
          this.saveData();
        }
      }
      // Work Order methods
      async getWorkOrders(vesselId) {
        const allWOs = toArray(this.data.workOrders);
        if (vesselId === void 0) {
          return allWOs;
        }
        return allWOs.filter((w) => w.vesselId === vesselId);
      }
      async getWorkOrder(id) {
        if (this.data.workOrders && this.data.workOrders[id]) return this.data.workOrders[id];
        return toArray(this.data.workOrders).find((w) => w.id === id);
      }
      async createWorkOrder(workOrder) {
        if (!this.data.workOrders) this.data.workOrders = {};
        const newWO = { ...workOrder, id: workOrder.id || this.getNextId("workOrders") };
        this.data.workOrders[newWO.id] = newWO;
        this.saveData();
        return newWO;
      }
      async updateWorkOrder(id, data) {
        if (this.data.workOrders && this.data.workOrders[id]) {
          this.data.workOrders[id] = { ...this.data.workOrders[id], ...data };
          this.saveData();
          return this.data.workOrders[id];
        }
        return void 0;
      }
      async deleteWorkOrder(id) {
        if (this.data.workOrders && this.data.workOrders[id]) {
          delete this.data.workOrders[id];
          this.saveData();
        }
      }
      async getWorkOrdersByJobId(jobId) {
        return toArray(this.data.workOrders).filter((w) => w.jobId === jobId);
      }
      // Spares methods
      async getSpares(vesselId) {
        return toArray(this.data.spares).filter((s) => s.vesselId === vesselId);
      }
      async getSpare(id) {
        if (this.data.spares && this.data.spares[id]) return this.data.spares[id];
        return toArray(this.data.spares).find((s) => s.id === id);
      }
      async createSpare(spare) {
        if (!this.data.spares) this.data.spares = {};
        const newSpare = { ...spare, id: spare.id || this.getNextId("spares") };
        this.data.spares[newSpare.id] = newSpare;
        this.saveData();
        return newSpare;
      }
      async updateSpare(id, data) {
        if (this.data.spares && this.data.spares[id]) {
          this.data.spares[id] = { ...this.data.spares[id], ...data };
          this.saveData();
          return this.data.spares[id];
        }
        return void 0;
      }
      async deleteSpare(id) {
        if (this.data.spares && this.data.spares[id]) {
          delete this.data.spares[id];
          this.saveData();
        }
      }
      // Defect methods
      async getDefects(vesselId) {
        return toArray(this.data.defects).filter((d) => d.vesselId === vesselId);
      }
      async getDefect(id) {
        if (this.data.defects && this.data.defects[id]) return this.data.defects[id];
        return toArray(this.data.defects).find((d) => d.id === id);
      }
      async createDefect(defect) {
        if (!this.data.defects) this.data.defects = {};
        const newDefect = { ...defect, id: defect.id || this.getNextId("defects") };
        this.data.defects[newDefect.id] = newDefect;
        this.saveData();
        return newDefect;
      }
      async updateDefect(id, data) {
        if (this.data.defects && this.data.defects[id]) {
          this.data.defects[id] = { ...this.data.defects[id], ...data };
          this.saveData();
          return this.data.defects[id];
        }
        return void 0;
      }
      async deleteDefect(id) {
        if (this.data.defects && this.data.defects[id]) {
          delete this.data.defects[id];
          this.saveData();
        }
      }
      // Stub implementations for remaining methods
      async getAllDefects() {
        return toArray(this.data.defects);
      }
      async getDefectActions(defectId) {
        return [];
      }
      async createDefectAction(action) {
        return { ...action, id: this.getNextId("defectActions") };
      }
      async updateDefectAction(id, data) {
        return data;
      }
      async deleteDefectAction(id) {
      }
      async getDefectAttachments(defectId) {
        return [];
      }
      async createDefectAttachment(attachment) {
        return { ...attachment, id: this.getNextId("defectAttachments") };
      }
      async deleteDefectAttachment(id) {
      }
      async getRecurringDefects(vesselId) {
        return [];
      }
      async getRecurringDefect(id) {
        return void 0;
      }
      async createRecurringDefect(defect) {
        return { ...defect, id: this.getNextId("recurringDefects") };
      }
      async updateRecurringDefect(id, data) {
        return data;
      }
      async deleteRecurringDefect(id) {
      }
      async getRecurringDefectLinks(recurringDefectId) {
        return [];
      }
      async createRecurringDefectLink(link) {
        return { ...link, id: this.getNextId("links") };
      }
      async deleteRecurringDefectLink(id) {
      }
      async calculateAndUpdateRecurringDefects(equipmentKey) {
        return null;
      }
      async recalculateAllRecurringDefects() {
        console.log("[MemStorage] recalculateAllRecurringDefects called - no-op in file mode");
      }
      // Alert methods
      async getAlertPolicies(vesselId) {
        return [];
      }
      async getAlertPolicy(id) {
        return void 0;
      }
      async createAlertPolicy(policy) {
        return { ...policy, id: this.getNextId("alertPolicies") };
      }
      async updateAlertPolicy(id, data) {
        return data;
      }
      async deleteAlertPolicy(id) {
      }
      async getAlertEvents(vesselId) {
        return [];
      }
      async getAlertEvent(id) {
        return void 0;
      }
      async createAlertEvent(event) {
        return { ...event, id: this.getNextId("alertEvents") };
      }
      async updateAlertEvent(id, data) {
        return data;
      }
      async getAlertDeliveries(eventId) {
        return [];
      }
      async createAlertDelivery(delivery) {
        return { ...delivery, id: this.getNextId("alertDeliveries") };
      }
      async updateAlertDelivery(id, data) {
        return data;
      }
      async getAlertConfig(vesselId) {
        return void 0;
      }
      async upsertAlertConfig(config2) {
        return { ...config2, id: this.getNextId("alertConfig") };
      }
      // Form methods
      async getFormDefinitions() {
        return [];
      }
      async getFormDefinition(id) {
        return void 0;
      }
      async createFormDefinition(form) {
        return { ...form, id: this.getNextId("forms") };
      }
      async updateFormDefinition(id, data) {
        return data;
      }
      async deleteFormDefinition(id) {
      }
      async getFormVersions(formId) {
        return [];
      }
      async getFormVersion(id) {
        return void 0;
      }
      async getLatestFormVersion(formId) {
        return void 0;
      }
      async createFormVersion(version) {
        return { ...version, id: this.getNextId("formVersions") };
      }
      async updateFormVersion(id, data) {
        return data;
      }
      async getFormVersionUsage(formId) {
        return [];
      }
      async createFormVersionUsage(usage) {
        return { ...usage, id: this.getNextId("formVersionUsage") };
      }
      // Change Request methods
      async getChangeRequests(vesselId) {
        return [];
      }
      async getChangeRequest(id) {
        return void 0;
      }
      async createChangeRequest(request) {
        return { ...request, id: `cr-${this.getNextId("changeRequests")}` };
      }
      async updateChangeRequest(id, data) {
        return data;
      }
      async deleteChangeRequest(id) {
      }
      async getChangeRequestAttachments(requestId) {
        return [];
      }
      async createChangeRequestAttachment(attachment) {
        return { ...attachment, id: this.getNextId("crAttachments") };
      }
      async deleteChangeRequestAttachment(id) {
      }
      async getChangeRequestComments(requestId) {
        return [];
      }
      async createChangeRequestComment(comment) {
        return { ...comment, id: this.getNextId("crComments") };
      }
      // IHM methods
      async getIhmItems(vesselId) {
        return [];
      }
      async getIhmItem(id) {
        return void 0;
      }
      async createIhmItem(item) {
        return { ...item };
      }
      async updateIhmItem(id, data) {
        return data;
      }
      async deleteIhmItem(id) {
      }
      async getIhmMaintenanceLogs(vesselId) {
        return [];
      }
      async createIhmMaintenanceLog(log2) {
        return { ...log2, id: this.getNextId("ihmLogs") };
      }
      // Fleet mapping methods
      async getFleetVesselMappings(fleetId) {
        return [];
      }
      async createFleetVesselMapping(mapping) {
        return { ...mapping, id: this.getNextId("fvm") };
      }
      async deleteFleetVesselMapping(id) {
      }
      async getFleetComponentMappings(fleetId) {
        return [];
      }
      async createFleetComponentMapping(mapping) {
        return { ...mapping, id: this.getNextId("fcm") };
      }
      async deleteFleetComponentMapping(id) {
      }
      async getFleetJobVesselMappings(fleetId) {
        return [];
      }
      async createFleetJobVesselMapping(mapping) {
        return { ...mapping, id: this.getNextId("fjvm") };
      }
      async deleteFleetJobVesselMapping(id) {
      }
      async getFleetSpareVesselMappings(fleetId) {
        return [];
      }
      async createFleetSpareVesselMapping(mapping) {
        return { ...mapping, id: this.getNextId("fsvm") };
      }
      async deleteFleetSpareVesselMapping(id) {
      }
      // Master data methods
      async getMakers() {
        return toArray(this.data.makers);
      }
      async getMaker(id) {
        if (this.data.makers && this.data.makers[id]) return this.data.makers[id];
        return toArray(this.data.makers).find((m) => m.id === id);
      }
      async createMaker(maker) {
        return { ...maker, id: this.getNextId("makers") };
      }
      async updateMaker(id, data) {
        return data;
      }
      async deleteMaker(id) {
      }
      async getMasterLists() {
        return toArray(this.data.masterLists);
      }
      async getMasterList(id) {
        return void 0;
      }
      async createMasterList(list) {
        return { ...list, id: this.getNextId("masterLists") };
      }
      async updateMasterList(id, data) {
        return data;
      }
      async deleteMasterList(id) {
      }
      async getMakerLists() {
        return [];
      }
      async getMakerList() {
        return toArray(this.data.makerLists || []);
      }
      async getMakerListItem(id) {
        return void 0;
      }
      async getMakerListByCode(makerCode) {
        return void 0;
      }
      async createMakerList(list) {
        return { ...list, id: this.getNextId("makerLists") };
      }
      async createMakerListItem(maker) {
        return { ...maker, id: this.getNextId("makerLists") };
      }
      async updateMakerList(id, data) {
        return data;
      }
      async deleteMakerList(id) {
      }
      async getSfiDetails() {
        return toArray(this.data.sfiDetails);
      }
      async getSfiDetail(id) {
        return void 0;
      }
      async createSfiDetail(detail) {
        return { ...detail, id: this.getNextId("sfiDetails") };
      }
      async updateSfiDetail(id, data) {
        return data;
      }
      async deleteSfiDetail(id) {
      }
      async getMasterDataItems() {
        return toArray(this.data.masterData);
      }
      async getMasterDataItem(id) {
        return void 0;
      }
      async createMasterDataItem(item) {
        return { ...item, id: this.getNextId("masterData") };
      }
      async updateMasterDataItem(id, data) {
        return data;
      }
      async deleteMasterDataItem(id) {
      }
      // Stores methods
      async getStoresItems(vesselId) {
        return toArray(this.data.storesItems).filter((s) => s.vesselId === vesselId);
      }
      async getStoresItem(id) {
        if (this.data.storesItems && this.data.storesItems[id]) return this.data.storesItems[id];
        return toArray(this.data.storesItems).find((s) => s.id === id);
      }
      async createStoresItem(item) {
        return { ...item };
      }
      async updateStoresItem(id, data) {
        return data;
      }
      async deleteStoresItem(id) {
      }
      async getStoresLedger(itemId) {
        return [];
      }
      async createStoresLedgerEntry(entry) {
        return { ...entry, id: this.getNextId("storesLedger") };
      }
      // Spares history
      async getSparesHistory(spareId) {
        return [];
      }
      async createSparesHistory(history) {
        return { ...history, id: this.getNextId("sparesHistory") };
      }
      // Certificate/Survey methods
      async getCertificates(vesselId) {
        return [];
      }
      async getCertificate(id) {
        return void 0;
      }
      async createCertificate(cert) {
        return { ...cert, id: this.getNextId("certificates") };
      }
      async updateCertificate(id, data) {
        return data;
      }
      async deleteCertificate(id) {
      }
      async getSurveys(vesselId) {
        return [];
      }
      async getSurvey(id) {
        return void 0;
      }
      async createSurvey(survey) {
        return { ...survey, id: this.getNextId("surveys") };
      }
      async updateSurvey(id, data) {
        return data;
      }
      async deleteSurvey(id) {
      }
      // PMS Vessel Settings
      async getPmsVesselSettings(vesselId) {
        if (!this.data.pmsVesselSettings) return void 0;
        const settings = toArray(this.data.pmsVesselSettings);
        return settings.find((s) => s.vesselId === vesselId);
      }
      async upsertPmsVesselSettings(settings) {
        return this.createOrUpdatePmsVesselSettings(settings);
      }
      async createOrUpdatePmsVesselSettings(settings) {
        if (!this.data.pmsVesselSettings) this.data.pmsVesselSettings = {};
        const existing = await this.getPmsVesselSettings(settings.vesselId);
        const updatedSettings = {
          ...settings,
          id: existing?.id || this.getNextId("pmsVesselSettings"),
          updatedBy: settings.updatedBy || "test",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.data.pmsVesselSettings[settings.vesselId] = updatedSettings;
        this.saveData();
        return updatedSettings;
      }
      async deletePmsVesselSettings(vesselId) {
        if (this.data.pmsVesselSettings && this.data.pmsVesselSettings[vesselId]) {
          delete this.data.pmsVesselSettings[vesselId];
          this.saveData();
        }
      }
      // Component Documents
      async getComponentDocuments(componentId) {
        return [];
      }
      async getComponentDocument(id) {
        return void 0;
      }
      async createComponentDocument(doc) {
        return { ...doc, id: this.getNextId("componentDocs") };
      }
      async updateComponentDocument(id, data) {
        return data;
      }
      async deleteComponentDocument(id) {
      }
      // Component Class Regulatory
      async getComponentClassRegulatory(componentId) {
        return [];
      }
      async createComponentClassRegulatory(item) {
        return { ...item, id: this.getNextId("classReg") };
      }
      async updateComponentClassRegulatory(id, data) {
        return data;
      }
      async deleteComponentClassRegulatory(id) {
      }
      // Component Maintenance History
      async getComponentMaintenanceHistory(componentId) {
        return [];
      }
      async getAllComponentMaintenanceHistory() {
        return [];
      }
      async getComponentMaintenanceHistoryItem(id) {
        return void 0;
      }
      async getMaintenanceHistoryByWorkOrderId(workOrderId) {
        return void 0;
      }
      async createComponentMaintenanceHistory(item) {
        return { ...item, id: this.getNextId("maintHistory") };
      }
      // Component Requisitions
      async getComponentRequisitions(componentId) {
        return [];
      }
      async createComponentRequisition(req) {
        return { ...req, id: this.getNextId("requisitions") };
      }
      async updateComponentRequisition(id, data) {
        return data;
      }
      async deleteComponentRequisition(id) {
      }
      // Work Order Execution Details
      async getWorkOrderExecutionDetails(workOrderId) {
        return [];
      }
      async createWorkOrderExecutionDetails(details) {
        return { ...details, id: this.getNextId("woDetails") };
      }
      async updateWorkOrderExecutionDetails(id, data) {
        return data;
      }
      // Import History
      async getImportHistory(type, limit, offset) {
        return { items: [], total: 0 };
      }
      async getImportHistoryById(id) {
        return void 0;
      }
      async getImportHistoryItem(id) {
        return void 0;
      }
      async createImportHistory(item) {
        return { ...item, id: this.getNextId("importHistory") };
      }
      async updateImportHistory(id, data) {
        return data;
      }
      async getImportChangeLogs(importId) {
        return [];
      }
      async createImportChangeLog(log2) {
        return { ...log2, id: this.getNextId("importChangeLogs") };
      }
      // Work Order Executions
      async getWorkOrderExecutions(workOrderId) {
        return [];
      }
      async getWorkOrderExecution(id) {
        return void 0;
      }
      async createWorkOrderExecution(execution) {
        return { ...execution };
      }
      async updateWorkOrderExecution(id, data) {
        return data;
      }
      async deleteWorkOrderExecution(id) {
      }
      // Additional methods
      async getJobByCode(jobCode, vesselId) {
        return toArray(this.data.jobs).find((j) => j.jobCode === jobCode && j.vesselId === vesselId);
      }
      async getSpareByCode(spareCode, vesselId) {
        return toArray(this.data.spares).find((s) => s.spareCode === spareCode && s.vesselId === vesselId);
      }
      async getWorkOrdersByJob(jobId) {
        return toArray(this.data.workOrders).filter((w) => w.jobId === jobId);
      }
      async getAllJobs() {
        return toArray(this.data.jobs);
      }
      async getAllWorkOrders() {
        return toArray(this.data.workOrders);
      }
      async getAllSpares() {
        return toArray(this.data.spares);
      }
      async getAllComponents() {
        return toArray(this.data.components);
      }
      // Bulk prefetch methods for performance
      async getComponentsByCodes(codes, vesselId) {
        const result = /* @__PURE__ */ new Map();
        const allComponents = toArray(this.data.components);
        for (const comp of allComponents) {
          if (codes.includes(comp.componentCode) && (!vesselId || comp.vesselId === vesselId)) {
            result.set(comp.componentCode, comp);
          }
        }
        return result;
      }
      async getJobsByJobNos(jobNos, vesselId) {
        const result = /* @__PURE__ */ new Map();
        const allJobs = toArray(this.data.jobs);
        for (const job of allJobs) {
          if (jobNos.includes(job.jobNo || job.jobCode) && (!vesselId || job.vesselId === vesselId)) {
            result.set(job.jobNo || job.jobCode, job);
          }
        }
        return result;
      }
      async getWorkOrdersByTemplateIds(templateIds, vesselId) {
        const result = /* @__PURE__ */ new Map();
        const allWorkOrders = toArray(this.data.workOrders);
        for (const wo of allWorkOrders) {
          if (templateIds.includes(wo.templateId || wo.jobId) && (!vesselId || wo.vesselId === vesselId)) {
            result.set(wo.templateId || wo.jobId, wo);
          }
        }
        return result;
      }
      // Fleet component methods
      async getFleetComponents(fleetId) {
        return [];
      }
      async getFleetComponent(id) {
        return void 0;
      }
      async createFleetComponent(component) {
        return { ...component, id: this.getNextId("fleetComponents") };
      }
      async updateFleetComponent(id, data) {
        return data;
      }
      async deleteFleetComponent(id) {
      }
      // Fleet job methods
      async getFleetJobs(fleetId) {
        return [];
      }
      async getFleetJob(id) {
        return void 0;
      }
      async createFleetJob(job) {
        return { ...job, id: this.getNextId("fleetJobs") };
      }
      async updateFleetJob(id, data) {
        return data;
      }
      async deleteFleetJob(id) {
      }
      // Fleet spare methods
      async getFleetSpares(fleetId) {
        return [];
      }
      async getFleetSpare(id) {
        return void 0;
      }
      async createFleetSpare(spare) {
        return { ...spare, id: this.getNextId("fleetSpares") };
      }
      async updateFleetSpare(id, data) {
        return data;
      }
      async deleteFleetSpare(id) {
      }
      // Postponed work orders check
      async checkAndRevertPostponedWorkOrders() {
        console.log("[MemStorage] checkAndRevertPostponedWorkOrders called - no-op in file mode");
        return { checked: 0, reverted: 0 };
      }
      // ============= INVENTORY MANAGEMENT: Stub implementations =============
      async getLocations(vesselId) {
        console.log("[MemStorage] getLocations called - stub in file mode");
        return [];
      }
      async getLocationById(id) {
        console.log("[MemStorage] getLocationById called - stub in file mode");
        return void 0;
      }
      async getLocationByName(vesselId, locationName) {
        console.log("[MemStorage] getLocationByName called - stub in file mode");
        return void 0;
      }
      async createLocation(location) {
        console.log("[MemStorage] createLocation called - stub in file mode");
        return { ...location, id: Date.now() };
      }
      async findOrCreateLocation(vesselId, locationName, createdBy) {
        console.log("[MemStorage] findOrCreateLocation called - stub in file mode");
        return { id: Date.now(), vesselId, locationName, createdBy, createdAt: /* @__PURE__ */ new Date() };
      }
      async updateLocation(id, data) {
        console.log("[MemStorage] updateLocation called - stub in file mode");
        return { ...data, id };
      }
      async getSpareComponentLinks(vesselId) {
        console.log("[MemStorage] getSpareComponentLinks called - stub in file mode");
        return [];
      }
      async getSpareComponentLinksBySpare(spareId) {
        console.log("[MemStorage] getSpareComponentLinksBySpare called - stub in file mode");
        return [];
      }
      async getSpareComponentLinksByComponent(componentId) {
        console.log("[MemStorage] getSpareComponentLinksByComponent called - stub in file mode");
        return [];
      }
      async createSpareComponentLink(link) {
        console.log("[MemStorage] createSpareComponentLink called - stub in file mode");
        return { ...link, id: Date.now(), createdAt: /* @__PURE__ */ new Date() };
      }
      async deleteSpareComponentLink(spareId, componentId) {
        console.log("[MemStorage] deleteSpareComponentLink called - stub in file mode");
      }
      async getLinkedComponentsForSpare(spareId) {
        console.log("[MemStorage] getLinkedComponentsForSpare called - stub in file mode");
        return [];
      }
      async getSpareLocationStock(spareId) {
        console.log("[MemStorage] getSpareLocationStock called - stub in file mode");
        return [];
      }
      async getSpareLocationStockByLocation(locationId) {
        console.log("[MemStorage] getSpareLocationStockByLocation called - stub in file mode");
        return [];
      }
      async getSpareLocationStockItem(spareId, locationId) {
        console.log("[MemStorage] getSpareLocationStockItem called - stub in file mode");
        return void 0;
      }
      async upsertSpareLocationStock(data) {
        console.log("[MemStorage] upsertSpareLocationStock called - stub in file mode");
        return { ...data, id: Date.now() };
      }
      async updateSpareLocationStockQty(spareId, locationId, qtyChange) {
        console.log("[MemStorage] updateSpareLocationStockQty called - stub in file mode");
        return { spareId, locationId, qty: qtyChange, id: Date.now() };
      }
      async getSpareRobTotal(spareId) {
        console.log("[MemStorage] getSpareRobTotal called - stub in file mode");
        return 0;
      }
      async getSpareLocationsWithQty(spareId) {
        console.log("[MemStorage] getSpareLocationsWithQty called - stub in file mode");
        return [];
      }
      async getSparesAtLocation(locationId) {
        console.log("[MemStorage] getSparesAtLocation called - stub in file mode");
        return [];
      }
      async createInventoryTransaction(txn) {
        console.log("[MemStorage] createInventoryTransaction called - stub in file mode");
        return { ...txn, id: Date.now(), txnDatetime: /* @__PURE__ */ new Date() };
      }
      async getInventoryTransactions(vesselId, options) {
        console.log("[MemStorage] getInventoryTransactions called - stub in file mode");
        return [];
      }
      async performInventoryTransaction(input) {
        console.log("[MemStorage] performInventoryTransaction called - stub in file mode");
        return {
          transaction: { id: Date.now(), ...input, txnDatetime: /* @__PURE__ */ new Date() },
          newLocationQty: 0,
          newTotalRob: 0
        };
      }
      async getSpareWithInventory(spareId) {
        console.log("[MemStorage] getSpareWithInventory called - stub in file mode");
        return null;
      }
      async getSparesWithInventoryByVessel(vesselId) {
        console.log("[MemStorage] getSparesWithInventoryByVessel called - stub in file mode");
        return [];
      }
      async getSparesWithInventoryByComponent(componentId) {
        const allSpares = toArray(this.data.spares);
        const directSpares = allSpares.filter((s) => s.componentId === componentId);
        const links = toArray(this.data.spareComponentLinks).filter(
          (link) => link.componentId === componentId
        );
        const linkedSpareIds = new Set(links.map((link) => link.spareId));
        const linkedSpares = allSpares.filter((s) => linkedSpareIds.has(s.id));
        const spareIdSet = /* @__PURE__ */ new Set();
        const results = [];
        for (const spare of directSpares) {
          if (!spareIdSet.has(spare.id)) {
            spareIdSet.add(spare.id);
            results.push({
              spare,
              robTotal: spare.rob || 0,
              stockStatus: (spare.rob || 0) <= (spare.min || 0) ? "At Min" : "OK",
              locations: [],
              linkedComponents: []
            });
          }
        }
        for (const spare of linkedSpares) {
          if (!spareIdSet.has(spare.id)) {
            spareIdSet.add(spare.id);
            results.push({
              spare,
              robTotal: spare.rob || 0,
              stockStatus: (spare.rob || 0) <= (spare.min || 0) ? "At Min" : "OK",
              locations: [],
              linkedComponents: []
            });
          }
        }
        return results;
      }
      async getMasterDataList() {
        console.log("[MemStorage] getMasterDataList called - stub in file mode");
        return [];
      }
      async getMasterDataByFleetCode(fleetEquipmentCode) {
        console.log("[MemStorage] getMasterDataByFleetCode called - stub in file mode");
        return void 0;
      }
      async getAllPmsVesselSettings() {
        if (!this.data.pmsVesselSettings) return [];
        return toArray(this.data.pmsVesselSettings);
      }
      // =====================================================
      // JOB-COMPONENT LINKS (Many-to-Many)
      // =====================================================
      async getJobComponentLinks(vesselId) {
        if (!this.data.jobComponentLinks) this.data.jobComponentLinks = [];
        const links = toArray(this.data.jobComponentLinks);
        const jobs2 = toArray(this.data.jobs).filter((j) => j.vesselId === vesselId);
        const jobIds = new Set(jobs2.map((j) => j.id));
        return links.filter((link) => jobIds.has(link.jobId));
      }
      async getJobComponentLinksByJob(jobId) {
        if (!this.data.jobComponentLinks) this.data.jobComponentLinks = [];
        return toArray(this.data.jobComponentLinks).filter((link) => link.jobId === jobId);
      }
      async getJobComponentLinksByComponent(componentId) {
        if (!this.data.jobComponentLinks) this.data.jobComponentLinks = [];
        return toArray(this.data.jobComponentLinks).filter((link) => link.componentId === componentId);
      }
      async createJobComponentLink(link) {
        if (!this.data.jobComponentLinks) this.data.jobComponentLinks = [];
        const existing = this.data.jobComponentLinks.find(
          (l) => l.jobId === link.jobId && l.componentId === link.componentId
        );
        if (existing) {
          return existing;
        }
        const newLink = {
          ...link,
          id: this.getNextId("jobComponentLinks"),
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.data.jobComponentLinks.push(newLink);
        this.saveData();
        return newLink;
      }
      async deleteJobComponentLink(jobId, componentId) {
        if (!this.data.jobComponentLinks) return;
        this.data.jobComponentLinks = this.data.jobComponentLinks.filter(
          (link) => !(link.jobId === jobId && link.componentId === componentId)
        );
        this.saveData();
      }
    };
    memStorage = new MemStorage();
  }
});

// server/storageFactory.ts
function isFileStorageForced() {
  if (process.env.USE_FILE_STORAGE === "true") {
    return true;
  }
  return false;
}
async function initializeStorage() {
  if (storageInitialized && storageInstance) {
    return storageInstance;
  }
  console.log("[StorageFactory] \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  if (isFileStorageForced()) {
    console.log("[StorageFactory] USE_FILE_STORAGE=true - using file-based storage");
    console.log("[StorageFactory] \u2713 Using file-based storage (test-data.json)");
    console.log("[StorageFactory] \u26A0 Data changes in this mode are for preview only");
    console.log("[StorageFactory] \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    storageInstance = memStorage;
    storageInitialized = true;
    currentStorageMode = "file";
    return storageInstance;
  }
  if (process.env.DATABASE_URL) {
    console.log("[StorageFactory] DATABASE_URL found - attempting PostgreSQL connection...");
    try {
      const postgres = await resolvePostgres();
      if (postgres) {
        console.log("[StorageFactory] \u2713 PostgreSQL connection verified");
        console.log("[StorageFactory] \u2713 Using PostgreSQL storage");
        console.log("[StorageFactory] \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        storageInstance = postgresStorage;
        storageInitialized = true;
        currentStorageMode = "postgres";
        return storageInstance;
      }
    } catch (error) {
      const errorMessage = `
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551                    POSTGRESQL CONNECTION FAILED                            \u2551
\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563
\u2551  DATABASE_URL is set but connection failed.                                \u2551
\u2551                                                                            \u2551
\u2551  Error: ${error.message?.substring(0, 60) || "Unknown error"}
\u2551                                                                            \u2551
\u2551  Check that:                                                               \u2551
\u2551  1. The PostgreSQL database is running                                     \u2551
\u2551  2. DATABASE_URL connection string is valid                                \u2551
\u2551  3. Network access to the database is permitted                            \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
`;
      console.error(errorMessage);
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  } else {
    console.log("[StorageFactory] DATABASE_URL not set");
  }
  console.log("[StorageFactory] \u2713 Using file-based storage (test-data.json)");
  console.log("[StorageFactory] \u26A0 Data changes in this mode are for preview only");
  console.log("[StorageFactory] \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  storageInstance = memStorage;
  storageInitialized = true;
  currentStorageMode = "file";
  return storageInstance;
}
var storageInitialized, storageInstance, currentStorageMode;
var init_storageFactory = __esm({
  "server/storageFactory.ts"() {
    "use strict";
    init_postgresStorage();
    init_memStorage();
    init_postgresClient();
    storageInitialized = false;
    storageInstance = null;
    currentStorageMode = "file";
  }
});

// server/storage.ts
import crypto from "crypto";
function sortObjectKeys(obj) {
  if (obj === null || obj === void 0) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (typeof obj === "object" && obj.constructor === Object) {
    const sorted = {};
    Object.keys(obj).sort().forEach((key) => {
      sorted[key] = sortObjectKeys(obj[key]);
    });
    return sorted;
  }
  return obj;
}
function calculateRecordChecksum(record) {
  try {
    const volatileFields = ["id", "createdAt", "updatedAt", "created_at", "updated_at"];
    const stableRecord = { ...record };
    for (const field of volatileFields) {
      delete stableRecord[field];
    }
    const sortedRecord = sortObjectKeys(stableRecord);
    const canonicalJson = JSON.stringify(sortedRecord, (key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === "function" || typeof value === "symbol") {
        return void 0;
      }
      return value;
    });
    return crypto.createHash("sha256").update(canonicalJson).digest("hex");
  } catch (error) {
    console.error("Error calculating checksum:", error);
    return crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
  }
}
function getStorageInstance() {
  if (!_storage) {
    throw new Error(
      "Storage not initialized. Call initStorage() before accessing storage. This error typically occurs when storage is accessed before server startup completes."
    );
  }
  return _storage;
}
async function initStorage() {
  if (_storage !== null) return;
  console.log("\u{1F527} Initializing storage...");
  console.log(`\u{1F50D} DATABASE_URL: ${process.env.DATABASE_URL ? "FOUND" : "NOT FOUND"}`);
  _storage = await initializeStorage();
  console.log("\u2705 Storage initialization complete");
}
var _storage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_storageFactory();
    _storage = null;
    storage = new Proxy({}, {
      get(_target, prop) {
        const instance = getStorageInstance();
        const value = instance[prop];
        return typeof value === "function" ? value.bind(instance) : value;
      }
    });
  }
});

// shared/utils/dateCalculations.ts
var dateCalculations_exports = {};
__export(dateCalculations_exports, {
  addInterval: () => addInterval,
  calculateDueDate: () => calculateDueDate,
  formatDDMMYYYY: () => formatDDMMYYYY,
  parseDDMMYYYY: () => parseDDMMYYYY
});
function parseDDMMYYYY(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}
function formatDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
function addInterval(startDate, intervalValue, intervalUnit) {
  const result = new Date(startDate);
  switch (intervalUnit?.toLowerCase()) {
    case "days":
      result.setDate(result.getDate() + intervalValue);
      break;
    case "weeks":
      result.setDate(result.getDate() + intervalValue * 7);
      break;
    case "months":
      result.setMonth(result.getMonth() + intervalValue);
      break;
    case "years":
      result.setFullYear(result.getFullYear() + intervalValue);
      break;
    default:
      result.setMonth(result.getMonth() + intervalValue);
  }
  return result;
}
function calculateDueDate(installationDate, frequencyValue, frequencyUnit) {
  const startDate = parseDDMMYYYY(installationDate);
  if (!startDate) return null;
  const intervalValue = typeof frequencyValue === "string" ? parseInt(frequencyValue, 10) : frequencyValue;
  if (!intervalValue || isNaN(intervalValue) || intervalValue <= 0) return null;
  if (!frequencyUnit) return null;
  const dueDate = addInterval(startDate, intervalValue, frequencyUnit);
  return formatDDMMYYYY(dueDate);
}
var init_dateCalculations = __esm({
  "shared/utils/dateCalculations.ts"() {
    "use strict";
  }
});

// shared/workOrders/constants.ts
var WORK_ORDER_THRESHOLDS;
var init_constants = __esm({
  "shared/workOrders/constants.ts"() {
    "use strict";
    WORK_ORDER_THRESHOLDS = {
      /**
       * Calendar Lead Time (in days)
       * Work orders become "Due" when within this many days of due date
       * Work orders are "Active" when more than this many days away
       */
      CALENDAR_LEAD_TIME_DAYS: 30,
      /**
       * Running Hours Lead Time (in hours)
       * Work orders become "Due" when within this many hours of due RH
       * Work orders are "Active" when more than this many hours away
       * 
       * IMPORTANT: This is 720 hours per specification, NOT 100!
       */
      RH_LEAD_TIME_HOURS: 720,
      /**
       * Running Hours Grace Period (in hours)
       * After due RH is exceeded, WO stays in "Grace P" for this many hours
       * Then transitions to "Overdue"
       * 168 hours = 7 days equivalent
       */
      RH_GRACE_PERIOD_HOURS: 168,
      /**
       * Calendar Grace Period (in days)
       * Minimum fixed grace period for calendar-based jobs
       * Used when due date is in last 7 days of month (COMPANY_STANDARD mode)
       */
      CALENDAR_GRACE_PERIOD_DAYS: 7,
      /**
       * Critical job RH lead time multiplier
       * Critical/High priority jobs may use different lead times
       * This is the default for critical jobs when vessel settings not configured
       */
      RH_LEAD_TIME_HOURS_CRITICAL: 720,
      /**
       * Non-critical job RH lead time
       * Same as standard RH_LEAD_TIME_HOURS for consistency
       */
      RH_LEAD_TIME_HOURS_NON_CRITICAL: 720,
      /**
       * Calendar Lead Time for Critical/High priority jobs (in days)
       * Work orders for critical jobs become "Due" when within this many days
       */
      CALENDAR_LEAD_TIME_DAYS_CRITICAL: 7,
      /**
       * Calendar Lead Time for Non-Critical jobs (in days)
       * Work orders for non-critical jobs become "Due" when within this many days
       */
      CALENDAR_LEAD_TIME_DAYS_NON_CRITICAL: 14
    };
  }
});

// shared/workOrders/status.ts
function parseDDMMMYYYY(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = MONTH_NAMES[parts[1]];
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || month === void 0 || isNaN(year)) return null;
  return new Date(year, month, day);
}
function parseDate(dateStr) {
  if (!dateStr) return null;
  const dmmyResult = parseDDMMMYYYY(dateStr);
  if (dmmyResult) return dmmyResult;
  return parseDDMMYYYY(dateStr);
}
function calculateCompanyStandardGraceEnd(dueDate) {
  const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);
  endOfMonth.setHours(0, 0, 0, 0);
  const daysUntilEndOfMonth = endOfMonth.getDate() - dueDate.getDate();
  if (daysUntilEndOfMonth <= 7) {
    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS);
    graceEnd.setHours(0, 0, 0, 0);
    return graceEnd;
  } else {
    return endOfMonth;
  }
}
function computeRHStatusCategory(dueRH, currentRH, leadTimeHours, graceHours = GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS) {
  const rhRemaining = dueRH - currentRH;
  if (rhRemaining < -graceHours) {
    return "OVERDUE";
  } else if (rhRemaining < 0) {
    return "DUE_GRACE";
  } else if (rhRemaining <= leadTimeHours) {
    return "DUE";
  } else {
    return "PLANNED";
  }
}
function rhCategoryToDisplayStatus(category) {
  switch (category) {
    case "OVERDUE":
      return "Overdue";
    case "DUE_GRACE":
      return "Due (Grace P)";
    case "DUE":
    case "DUE_SOON":
      return "Due";
    case "PLANNED":
    case "FUTURE":
      return "Active";
    default:
      return "Active";
  }
}
function computeWorkOrderStatus(input) {
  const {
    dueDate,
    dueRH,
    currentRH,
    isExecution,
    status,
    completionDateTime,
    maintenanceBasis,
    vesselGraceSettings,
    rhLeadTimeHours
  } = input;
  if (isExecution) {
    if (status === "Pending Approval") return "Pending Approval";
    if (status === "Rejected") return "Rejected";
    if (status === "Approved" || completionDateTime) return "Completed";
    return "Active";
  }
  if (status === "Pending Approval") return "Pending Approval";
  if (completionDateTime || status === "Completed") {
    return "Completed";
  }
  if (status === "Postponed") return "Postponed";
  if (status === "Rejected") return "Rejected";
  if (maintenanceBasis === "Running Hours") {
    if (dueRH == null || currentRH == null) return "Active";
    let leadTime;
    if (rhLeadTimeHours !== void 0 && rhLeadTimeHours !== null) {
      leadTime = rhLeadTimeHours;
    } else if (vesselGraceSettings?.rhLeadTimeHours !== void 0 && vesselGraceSettings?.rhLeadTimeHours !== null) {
      leadTime = vesselGraceSettings.rhLeadTimeHours;
    } else {
      leadTime = GRACE_PERIOD_CONSTANTS.DEFAULT_RH_LEAD_TIME;
    }
    const graceHours = vesselGraceSettings?.rhGraceHours ?? GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
    const category = computeRHStatusCategory(dueRH, currentRH, leadTime, graceHours);
    return rhCategoryToDisplayStatus(category);
  } else {
    if (!dueDate) return "Active";
    const dueDateObj = parseDate(dueDate);
    if (!dueDateObj) return "Active";
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const dueDateTime = new Date(dueDateObj);
    dueDateTime.setHours(0, 0, 0, 0);
    const diffTime = dueDateTime.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
    let graceEndDate;
    if (vesselGraceSettings?.calendarGraceMode === "CUSTOM_DAYS") {
      graceEndDate = new Date(dueDateTime);
      graceEndDate.setDate(graceEndDate.getDate() + (vesselGraceSettings.calendarGraceDays || GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS));
      graceEndDate.setHours(0, 0, 0, 0);
    } else {
      graceEndDate = calculateCompanyStandardGraceEnd(dueDateTime);
    }
    if (diffDays < 0) {
      if (today > graceEndDate) {
        return "Overdue";
      } else {
        return "Due (Grace P)";
      }
    } else if (diffDays <= GRACE_PERIOD_CONSTANTS.DUE_HORIZON_DAYS) {
      return "Due";
    } else {
      return "Active";
    }
  }
}
var MONTH_NAMES, GRACE_PERIOD_CONSTANTS;
var init_status = __esm({
  "shared/workOrders/status.ts"() {
    "use strict";
    init_dateCalculations();
    init_constants();
    MONTH_NAMES = {
      "Jan": 0,
      "Feb": 1,
      "Mar": 2,
      "Apr": 3,
      "May": 4,
      "Jun": 5,
      "Jul": 6,
      "Aug": 7,
      "Sep": 8,
      "Oct": 9,
      "Nov": 10,
      "Dec": 11
    };
    GRACE_PERIOD_CONSTANTS = {
      DUE_HORIZON_DAYS: WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS,
      GRACE_PERIOD_DAYS: WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
      RH_GRACE_HOURS: WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
      DEFAULT_RH_LEAD_TIME: WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
    };
  }
});

// shared/dateUtils.ts
var dateUtils_exports = {};
__export(dateUtils_exports, {
  calculateNextDueDate: () => calculateNextDueDate,
  normalizeDateToDDMMMYYYY: () => normalizeDateToDDMMMYYYY,
  shouldGenerateWorkOrder: () => shouldGenerateWorkOrder
});
import { format, parse, add, isValid } from "date-fns";
function normalizeDateToDDMMMYYYY(dateInput) {
  if (!dateInput) return null;
  try {
    let parsedDate;
    if (typeof dateInput === "number") {
      let adjustedSerial = dateInput;
      if (dateInput >= 60) {
        adjustedSerial = dateInput - 1;
      }
      const excelEpoch = new Date(1899, 11, 31);
      parsedDate = new Date(excelEpoch.getTime() + adjustedSerial * 24 * 60 * 60 * 1e3);
    } else if (dateInput instanceof Date) {
      parsedDate = dateInput;
    } else {
      const dateString = String(dateInput).trim();
      const numericValue = parseFloat(dateString);
      if (!isNaN(numericValue) && /^\d+(\.\d+)?$/.test(dateString) && numericValue > 1e3 && numericValue < 1e5) {
        let adjustedSerial = numericValue;
        if (numericValue >= 60) {
          adjustedSerial = numericValue - 1;
        }
        const excelEpoch = new Date(1899, 11, 31);
        parsedDate = new Date(excelEpoch.getTime() + adjustedSerial * 24 * 60 * 60 * 1e3);
      } else {
        parsedDate = parse(dateString, "dd-MMM-yyyy", /* @__PURE__ */ new Date());
        if (!isValid(parsedDate)) {
          parsedDate = parse(dateString, "dd/MM/yyyy", /* @__PURE__ */ new Date());
        }
        if (!isValid(parsedDate)) {
          parsedDate = parse(dateString, "dd-MM-yyyy", /* @__PURE__ */ new Date());
        }
        if (!isValid(parsedDate)) {
          parsedDate = parse(dateString, "yyyy-MM-dd", /* @__PURE__ */ new Date());
        }
        if (!isValid(parsedDate)) {
          parsedDate = new Date(dateString);
        }
      }
    }
    if (!isValid(parsedDate)) {
      return null;
    }
    const year = parsedDate.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`Invalid year ${year} in date, rejecting:`, dateInput);
      return null;
    }
    return format(parsedDate, "dd-MMM-yyyy");
  } catch (error) {
    console.error("Error normalizing date:", dateInput, error);
    return null;
  }
}
function calculateNextDueDate(lastDoneDate, intervalValue, intervalUnit) {
  if (!lastDoneDate || !intervalValue || !intervalUnit) {
    return null;
  }
  try {
    const normalizedDate = normalizeDateToDDMMMYYYY(lastDoneDate);
    if (!normalizedDate) {
      console.error("Failed to normalize lastDoneDate:", lastDoneDate);
      return null;
    }
    const parsedDate = parse(normalizedDate, "dd-MMM-yyyy", /* @__PURE__ */ new Date());
    if (!isValid(parsedDate)) {
      console.error("Failed to parse normalized date:", normalizedDate);
      return null;
    }
    const numericInterval = typeof intervalValue === "number" ? intervalValue : parseInt(String(intervalValue), 10);
    if (isNaN(numericInterval) || numericInterval <= 0) {
      console.error("Invalid interval value:", intervalValue);
      return null;
    }
    let durationKey;
    switch (intervalUnit.toLowerCase()) {
      case "days":
        durationKey = "days";
        break;
      case "weeks":
        durationKey = "weeks";
        break;
      case "months":
        durationKey = "months";
        break;
      case "years":
        durationKey = "years";
        break;
      default:
        console.error("Invalid interval unit:", intervalUnit);
        return null;
    }
    const nextDue = add(parsedDate, { [durationKey]: numericInterval });
    return format(nextDue, "dd-MMM-yyyy");
  } catch (error) {
    console.error("Error calculating next due date:", { lastDoneDate, intervalValue, intervalUnit, error });
    return null;
  }
}
function shouldGenerateWorkOrder(nextDueDate, currentDate = /* @__PURE__ */ new Date(), leadTimeDays = 0) {
  if (!nextDueDate) {
    return false;
  }
  try {
    const parsedDueDate = parse(nextDueDate, "dd-MMM-yyyy", /* @__PURE__ */ new Date());
    const normalizedCurrent = new Date(currentDate);
    normalizedCurrent.setHours(0, 0, 0, 0);
    const triggerDate = new Date(parsedDueDate);
    triggerDate.setDate(triggerDate.getDate() - leadTimeDays);
    triggerDate.setHours(0, 0, 0, 0);
    return normalizedCurrent >= triggerDate;
  } catch (error) {
    console.error("Error checking work order generation criteria:", error);
    return false;
  }
}
var init_dateUtils = __esm({
  "shared/dateUtils.ts"() {
    "use strict";
  }
});

// server/utils/workOrderNumbering.ts
var workOrderNumbering_exports = {};
__export(workOrderNumbering_exports, {
  determineWorkOrderType: () => determineWorkOrderType,
  generateJobNumber: () => generateJobNumber,
  generatePlannedWorkOrderNumber: () => generatePlannedWorkOrderNumber,
  generateUnplannedWorkOrderNumber: () => generateUnplannedWorkOrderNumber,
  isValidJobNumber: () => isValidJobNumber
});
async function generatePlannedWorkOrderNumber(storage2, jobCode, componentCode, vesselId) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  if (!componentCode || !componentCode.trim()) {
    throw new Error("Component code is required for planned work order numbering");
  }
  const safeJobCode = jobCode && jobCode.trim() ? jobCode.trim() : "UNKNOWN-JOB";
  const safeComponentCode = componentCode.trim();
  const allWorkOrders = await storage2.getWorkOrders(vesselId);
  const existingWOsForJobComponent = allWorkOrders.filter((wo) => {
    const plannedPattern = new RegExp(`^${escapeRegex(safeJobCode)}-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`);
    return plannedPattern.test(wo.workOrderNo);
  });
  let maxRunningNumber = 0;
  existingWOsForJobComponent.forEach((wo) => {
    const match = wo.workOrderNo.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) {
        maxRunningNumber = num;
      }
    }
  });
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, "0");
  return `${safeJobCode}-${safeComponentCode}-${currentYear}-${paddedNumber}`;
}
async function generateUnplannedWorkOrderNumber(storage2, vesselId) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const allWorkOrders = await storage2.getWorkOrders(vesselId);
  const existingUnplannedWOs = allWorkOrders.filter((wo) => {
    const unplannedPattern = new RegExp(`^UWO-${escapeRegex(vesselId)}-${currentYear}-(\\d+)$`);
    return unplannedPattern.test(wo.workOrderNo);
  });
  let maxRunningNumber = 0;
  existingUnplannedWOs.forEach((wo) => {
    const match = wo.workOrderNo.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) {
        maxRunningNumber = num;
      }
    }
  });
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, "0");
  return `UWO-${vesselId}-${currentYear}-${paddedNumber}`;
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function determineWorkOrderType(jobId, templateCode) {
  return jobId || templateCode ? "Planned" : "Unplanned";
}
async function generateJobNumber(storage2, taskType) {
  const typeCode = taskType && TASK_TYPE_CODES[taskType] ? TASK_TYPE_CODES[taskType] : "IN";
  const allJobs = await storage2.getJobs();
  let maxSequence = 0;
  allJobs.forEach((job) => {
    if (job.jobNo) {
      const match = job.jobNo.match(/^MKR-[A-Z]{2}-(\d{5})$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }
  });
  const nextSequence = maxSequence + 1;
  const paddedSequence = nextSequence.toString().padStart(5, "0");
  return `MKR-${typeCode}-${paddedSequence}`;
}
function isValidJobNumber(jobNo) {
  if (!jobNo || typeof jobNo !== "string") return false;
  return /^MKR-[A-Z]{2}-\d{5}$/.test(jobNo);
}
var TASK_TYPE_CODES;
var init_workOrderNumbering = __esm({
  "server/utils/workOrderNumbering.ts"() {
    "use strict";
    TASK_TYPE_CODES = {
      "Inspection": "IN",
      "Service": "SE",
      "Overhaul": "OV",
      "Calibration": "CA",
      "Test": "TE",
      "Replacement": "RE",
      "Cleaning": "CL",
      "Lubrication": "LU",
      "General": "GN"
    };
  }
});

// server/services/jobService.ts
var JobService, jobService;
var init_jobService = __esm({
  "server/services/jobService.ts"() {
    "use strict";
    init_storage();
    init_dateUtils();
    JobService = class {
      /**
       * Get all jobs for a vessel, optionally filtered by component
       */
      async getJobs(vesselId, componentId) {
        return storage.getJobs(vesselId, componentId);
      }
      /**
       * Get a single job by ID
       */
      async getJob(id) {
        return storage.getJob(id);
      }
      /**
       * Create a new job with validation and auto-generated fields
       */
      async createJob(jobData) {
        if (jobData.maintenanceBasis === "Calendar") {
          if (!jobData.frequencyValue || !jobData.frequencyUnit) {
            throw new Error("Calendar-based jobs require frequencyValue and frequencyUnit");
          }
        } else if (jobData.maintenanceBasis === "Running Hours") {
          if (!jobData.intervalRunningHour) {
            throw new Error("Running Hours-based jobs require intervalRunningHour");
          }
        }
        if (!jobData.jobNo) {
          const { generateJobNumber: generateJobNumber2 } = await Promise.resolve().then(() => (init_workOrderNumbering(), workOrderNumbering_exports));
          const taskType = jobData.taskType;
          jobData.jobNo = await generateJobNumber2(storage, taskType);
        }
        if (jobData.maintenanceBasis === "Calendar" && jobData.lastDoneDate) {
          const nextDue = calculateNextDueDate(
            jobData.lastDoneDate,
            jobData.frequencyValue,
            jobData.frequencyUnit
          );
          if (nextDue) {
            jobData.nextDueDate = nextDue;
          } else {
            console.error(`Failed to calculate nextDueDate for job`, {
              lastDoneDate: jobData.lastDoneDate,
              frequencyValue: jobData.frequencyValue,
              frequencyUnit: jobData.frequencyUnit
            });
          }
        }
        return storage.createJob(jobData);
      }
      /**
       * Update an existing job with Rule #15 - Job Frequency Change Impact
       * 
       * When frequency is changed:
       * - If active WO exists: keep current due date, apply new frequency from next cycle
       * - If no active WO: apply new frequency immediately for next WO generation
       */
      async updateJob(id, updates) {
        const existingJob = await this.getJob(id);
        if (!existingJob) {
          throw new Error(`Job ${id} not found`);
        }
        const isFrequencyChange = updates.frequencyValue !== void 0 && updates.frequencyValue !== existingJob.frequencyValue || updates.frequencyUnit !== void 0 && updates.frequencyUnit !== existingJob.frequencyUnit || updates.intervalRunningHour !== void 0 && updates.intervalRunningHour !== existingJob.intervalRunningHour;
        if (isFrequencyChange) {
          const activeWorkOrders = await storage.getWorkOrdersByJobId(id);
          const hasActiveWO = activeWorkOrders.some(
            (wo) => wo.status !== "Completed" && wo.status !== "Rejected"
          );
          if (hasActiveWO) {
            console.log(`[RULE #15] Job ${id} frequency changed with active WO - preserving current due date, new frequency takes effect on next cycle`);
            if (updates.lastDoneDate === void 0) {
              delete updates.lastDoneDate;
            }
            return storage.updateJob(id, updates);
          } else {
            console.log(`[RULE #15] Job ${id} frequency changed with no active WO - recalculating next due date immediately`);
          }
        }
        if ((updates.maintenanceBasis === "Calendar" || existingJob.maintenanceBasis === "Calendar") && (updates.lastDoneDate || updates.frequencyValue || updates.frequencyUnit)) {
          const lastDone = updates.lastDoneDate || existingJob.lastDoneDate;
          const freqValue = updates.frequencyValue || existingJob.frequencyValue;
          const freqUnit = updates.frequencyUnit || existingJob.frequencyUnit;
          if (lastDone && freqValue && freqUnit) {
            const nextDue = calculateNextDueDate(lastDone, freqValue, freqUnit);
            if (nextDue) {
              updates.nextDueDate = nextDue;
            } else {
              console.error(`Failed to recalculate nextDueDate for job ${id}`, {
                lastDone,
                freqValue,
                freqUnit,
                preservingExisting: existingJob.nextDueDate
              });
            }
          }
        }
        if ((updates.maintenanceBasis === "Running Hours" || existingJob.maintenanceBasis === "Running Hours") && updates.intervalRunningHour) {
          const lastDoneRH = parseFloat(existingJob.lastDoneRH || "0");
          const newInterval = updates.intervalRunningHour;
          if (lastDoneRH > 0 && newInterval > 0) {
            updates.nextDueRH = String(lastDoneRH + newInterval);
            console.log(`[RULE #15] Job ${id} RH interval changed - new nextDueRH: ${updates.nextDueRH}`);
          }
        }
        return storage.updateJob(id, updates);
      }
      /**
       * Delete a job (and optionally its associated work orders)
       */
      async deleteJob(id) {
        return storage.deleteJob(id);
      }
      /**
       * Bulk create jobs (used during upload/import)
       */
      async bulkCreateJobs(jobs2) {
        for (const job of jobs2) {
          if (job.maintenanceBasis === "Calendar") {
            if (!job.frequencyValue || !job.frequencyUnit) {
              throw new Error(`Job ${job.jobNo} is Calendar-based but missing frequency data`);
            }
          }
        }
        return storage.bulkCreateJobs(jobs2);
      }
      /**
       * Bulk update jobs (used during upload/import in update mode)
       */
      async bulkUpdateJobs(jobs2) {
        return storage.bulkUpdateJobs(jobs2);
      }
      /**
       * Bulk upsert jobs (create or update based on jobNo)
       */
      async bulkUpsertJobs(jobs2) {
        return storage.bulkUpsertJobs(jobs2);
      }
      /**
       * Get all Calendar-based jobs that are due for work order generation
       */
      async getDueCalendarJobs(vesselId) {
        const allJobs = await this.getJobs(vesselId);
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        return allJobs.filter((job) => {
          if (job.maintenanceBasis !== "Calendar") return false;
          if (!job.nextDueDate) return false;
          const parts = job.nextDueDate.split("-");
          if (parts.length !== 3) return false;
          const monthMap = {
            "Jan": 0,
            "Feb": 1,
            "Mar": 2,
            "Apr": 3,
            "May": 4,
            "Jun": 5,
            "Jul": 6,
            "Aug": 7,
            "Sep": 8,
            "Oct": 9,
            "Nov": 10,
            "Dec": 11
          };
          const day = parseInt(parts[0], 10);
          const month = monthMap[parts[1]];
          const year = parseInt(parts[2], 10);
          if (isNaN(day) || month === void 0 || isNaN(year)) return false;
          const dueDate = new Date(year, month, day);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate <= today;
        });
      }
      /**
       * Validate job data before creation/update
       */
      validateJobData(jobData) {
        const errors = [];
        if (!jobData.jobTitle) {
          errors.push("Job title is required");
        }
        if (!jobData.componentId) {
          errors.push("Component ID is required");
        }
        if (!jobData.maintenanceBasis) {
          errors.push("Maintenance basis is required");
        }
        if (jobData.maintenanceBasis === "Calendar") {
          if (!jobData.frequencyValue) {
            errors.push("Frequency value is required for Calendar-based jobs");
          } else if (typeof jobData.frequencyValue === "string") {
            const val = parseInt(jobData.frequencyValue, 10);
            if (isNaN(val) || val <= 0) {
              errors.push("Frequency value must be a positive integer");
            }
          }
          if (!jobData.frequencyUnit) {
            errors.push("Frequency unit is required for Calendar-based jobs");
          }
        }
        if (jobData.maintenanceBasis === "Running Hours") {
          if (!jobData.intervalRunningHour) {
            errors.push("Interval running hour is required for Running Hours-based jobs");
          } else if (jobData.intervalRunningHour <= 0) {
            errors.push("Interval running hour must be positive");
          }
        }
        return {
          valid: errors.length === 0,
          errors
        };
      }
    };
    jobService = new JobService();
  }
});

// server/utils/workOrderStatus.ts
var workOrderStatus_exports = {};
__export(workOrderStatus_exports, {
  buildCalendarCycleWOMap: () => buildCalendarCycleWOMap,
  buildJobsWithActiveWOSet: () => buildJobsWithActiveWOSet,
  buildRhCycleWOMap: () => buildRhCycleWOMap,
  extractJobNoFromWorkOrderNo: () => extractJobNoFromWorkOrderNo,
  findBlockingWOForJob: () => findBlockingWOForJob,
  isBlockingStatus: () => isBlockingStatus,
  isCompletedStatus: () => isCompletedStatus
});
function isBlockingStatus(status) {
  if (!status) return false;
  const normalizedStatus = status.toLowerCase().trim();
  return BLOCKING_STATUSES_EXACT.has(normalizedStatus);
}
function isCompletedStatus(status) {
  if (!status) return false;
  const normalizedStatus = status.toLowerCase().trim();
  return COMPLETED_STATUSES_EXACT.has(normalizedStatus);
}
function extractJobNoFromWorkOrderNo(workOrderNo) {
  if (!workOrderNo) return null;
  const newFormatMatch = workOrderNo.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
  if (newFormatMatch) {
    return newFormatMatch[1];
  }
  const woSuffixMatch = workOrderNo.match(/^(.+?)\.WO-\d{4}-\d+$/);
  if (woSuffixMatch) {
    return woSuffixMatch[1];
  }
  const oldFormatMatch = workOrderNo.match(/^(.+)-\d{4}-\d+$/);
  if (oldFormatMatch) {
    return oldFormatMatch[1];
  }
  return null;
}
function buildJobsWithActiveWOSet(workOrders2) {
  const jobsWithActiveWO = /* @__PURE__ */ new Set();
  workOrders2.forEach((wo) => {
    if (isBlockingStatus(wo.status)) {
      const jobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
      if (jobNo) {
        jobsWithActiveWO.add(jobNo);
      }
    }
  });
  return jobsWithActiveWO;
}
function buildRhCycleWOMap(workOrders2) {
  const cycleMap = /* @__PURE__ */ new Map();
  workOrders2.forEach((wo) => {
    const normalizedStatus = wo.status?.toLowerCase().trim() || "";
    if (normalizedStatus === "cancelled" || normalizedStatus === "canceled" || normalizedStatus === "rejected") {
      return;
    }
    if (wo.cycleDueRhSnapshot) {
      const jobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
      if (jobNo) {
        const cycleKey = `${jobNo}|${wo.cycleDueRhSnapshot}`;
        cycleMap.set(cycleKey, wo);
      }
    }
  });
  return cycleMap;
}
function buildCalendarCycleWOMap(workOrders2) {
  const cycleMap = /* @__PURE__ */ new Map();
  workOrders2.forEach((wo) => {
    const normalizedStatus = wo.status?.toLowerCase().trim() || "";
    if (normalizedStatus === "cancelled" || normalizedStatus === "canceled" || normalizedStatus === "rejected") {
      return;
    }
    if (wo.cycleDueDateSnapshot) {
      const jobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
      if (jobNo) {
        const cycleKey = `${jobNo}|${wo.cycleDueDateSnapshot}`;
        cycleMap.set(cycleKey, wo);
      }
    }
  });
  return cycleMap;
}
function findBlockingWOForJob(workOrders2, jobId, jobNo) {
  return workOrders2.find((wo) => {
    if (!isBlockingStatus(wo.status)) return false;
    if (wo.jobId === jobId) return true;
    const woJobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
    return woJobNo === jobNo;
  });
}
var BLOCKING_STATUSES_EXACT, COMPLETED_STATUSES_EXACT;
var init_workOrderStatus = __esm({
  "server/utils/workOrderStatus.ts"() {
    "use strict";
    BLOCKING_STATUSES_EXACT = /* @__PURE__ */ new Set([
      "active",
      "due",
      "due (grace p)",
      "due (grace)",
      "overdue",
      "pending approval",
      "pending_approval",
      "pendingapproval",
      "postponed",
      "in progress",
      "in_progress",
      "inprogress",
      "open"
    ]);
    COMPLETED_STATUSES_EXACT = /* @__PURE__ */ new Set([
      "completed",
      "closed",
      "approved",
      "rejected",
      "cancelled",
      "canceled"
    ]);
  }
});

// server/services/workOrderService.ts
function isJobCritical(job) {
  const priority = job.jobPriority?.toLowerCase() || "";
  return priority === "critical" || priority === "high";
}
function getCalendarLeadDays(job, settings) {
  if (!settings) return 0;
  return isJobCritical(job) ? settings.calendarLeadDaysCritical : settings.calendarLeadDaysNonCritical;
}
var WorkOrderService, workOrderService;
var init_workOrderService = __esm({
  "server/services/workOrderService.ts"() {
    "use strict";
    init_storage();
    init_status();
    init_constants();
    init_workOrderNumbering();
    init_jobService();
    init_workOrderStatus();
    WorkOrderService = class {
      /**
       * Get all work orders with optional vessel filter and computed status
       * Fetches component running hours for RH-based work orders and vessel grace settings
       */
      async getWorkOrders(vesselId) {
        const workOrders2 = await storage.getWorkOrders(vesselId);
        const rhWorkOrders = workOrders2.filter((wo) => wo.maintenanceBasis === "Running Hours" && wo.jobId);
        const jobIds = Array.from(new Set(rhWorkOrders.map((wo) => wo.jobId).filter((id) => id !== null)));
        const jobsMap = /* @__PURE__ */ new Map();
        for (const jobId of jobIds) {
          const job = await storage.getJob(jobId);
          if (job) {
            jobsMap.set(jobId, job);
          }
        }
        const componentIds = Array.from(new Set(
          Array.from(jobsMap.values()).map((job) => job.componentId).filter((id) => id !== null && id !== void 0)
        ));
        const componentsMap = /* @__PURE__ */ new Map();
        for (const componentId of componentIds) {
          const component = await storage.getComponent(componentId);
          if (component) {
            componentsMap.set(componentId, component);
          }
        }
        const vesselIds = Array.from(new Set(workOrders2.map((wo) => wo.vesselId).filter((id) => id !== null)));
        const vesselSettingsMap = /* @__PURE__ */ new Map();
        const graceSettingsMap = /* @__PURE__ */ new Map();
        for (const vId of vesselIds) {
          const settings = await storage.getPmsVesselSettings(vId);
          if (settings) {
            vesselSettingsMap.set(vId, settings);
            graceSettingsMap.set(vId, {
              calendarGraceMode: settings.calendarGraceMode || "COMPANY_STANDARD",
              calendarGraceDays: settings.calendarGraceDays || WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
              rhGraceHours: settings.rhGraceHours || WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
              rhLeadTimeHours: settings.rhLeadHoursNonCritical || WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
            });
          }
        }
        return workOrders2.map((wo) => {
          let currentRH = null;
          let dueRH = null;
          let job;
          if (wo.maintenanceBasis === "Running Hours") {
            if (wo.jobId) {
              job = jobsMap.get(wo.jobId);
              if (job?.componentId) {
                const component = componentsMap.get(job.componentId);
                if (component?.currentCumulativeRH != null) {
                  currentRH = parseFloat(String(component.currentCumulativeRH));
                }
              }
            }
            if (currentRH === null && wo.currentReading) {
              currentRH = parseFloat(wo.currentReading);
            }
            if (wo.nextDueReading) {
              dueRH = parseFloat(wo.nextDueReading);
            }
          }
          const vesselGraceSettings = wo.vesselId ? graceSettingsMap.get(wo.vesselId) : void 0;
          const vesselSettings = wo.vesselId ? vesselSettingsMap.get(wo.vesselId) : void 0;
          const isJobCritical3 = job?.jobPriority === "Critical" || job?.classRelated === "true" || String(job?.classRelated) === "true";
          const rhLeadTimeHours = wo.maintenanceBasis === "Running Hours" ? isJobCritical3 ? vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL : vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL : void 0;
          return {
            ...wo,
            computedStatus: computeWorkOrderStatus({
              dueDate: wo.dueDate,
              dueRH,
              currentRH,
              isExecution: wo.isExecution,
              status: wo.status,
              completionDateTime: wo.dateCompleted,
              maintenanceBasis: wo.maintenanceBasis || void 0,
              vesselGraceSettings,
              rhLeadTimeHours
            })
          };
        });
      }
      /**
       * Get a single work order by ID
       */
      async getWorkOrder(id) {
        return storage.getWorkOrder(id);
      }
      /**
       * Create a new work order
       */
      async createWorkOrder(workOrderData) {
        if (!workOrderData.vesselId) {
          throw new Error("Vessel ID is required");
        }
        if (!workOrderData.jobTitle) {
          throw new Error("Job title is required");
        }
        if (!workOrderData.workOrderNo) {
          workOrderData.workOrderNo = await generateUnplannedWorkOrderNumber(storage, workOrderData.vesselId);
          workOrderData.templateCode = workOrderData.workOrderNo;
        }
        return storage.createWorkOrder(workOrderData);
      }
      /**
       * Update an existing work order
       */
      async updateWorkOrder(id, updates) {
        return storage.updateWorkOrder(id, updates);
      }
      /**
       * Delete a work order
       */
      async deleteWorkOrder(id) {
        return storage.deleteWorkOrder(id);
      }
      /**
       * Get work order execution data
       * Note: This fetches executions by looking up via templateId (reference to work_orders.id)
       */
      async getWorkOrderExecution(workOrderId, componentId) {
        const executions = await storage.getWorkOrderExecutions(componentId);
        return executions.find((exec) => exec.templateId === workOrderId);
      }
      /**
       * Create work order execution record
       */
      async createWorkOrderExecution(executionData) {
        return storage.createWorkOrderExecution(executionData);
      }
      /**
       * Update work order execution record
       */
      async updateWorkOrderExecution(id, updates) {
        return storage.updateWorkOrderExecution(id, updates);
      }
      /**
       * Auto-generate work orders from due jobs (Calendar-based)
       * TRIGGER 2: Calendar-based auto-generation per new WO generation rules
       * 
       * Applicability:
       * - job.maintenanceBasis = 'Calendar'
       * - job.isActive = true
       * 
       * Calculations:
       * - last_done_date = date of last completed WO (job.lastDoneDate)
       * - F_days = frequency_days (frequencyValue in days)
       * - LT_days = lead_time_days
       * - DUE_DATE = last_done_date + F_days
       * - GENERATE_DATE = DUE_DATE - LT_days
       * 
       * Auto-generation condition:
       * - Today >= GENERATE_DATE
       * - AND no DUE/OVERDUE/PENDING APPROVAL/POSTPONED WO exists for same job + same DUE_DATE cycle
       */
      async autoGenerateWorkOrdersFromJobs(vesselId) {
        const allJobs = await jobService.getJobs(vesselId);
        const calendarJobs = allJobs.filter(
          (job) => job.maintenanceBasis === "Calendar" && job.isActive !== false && // Job must be active
          job.nextDueDate
          // Must have valid due date
        );
        const settingsCache = /* @__PURE__ */ new Map();
        const getSettingsForVessel = async (vId) => {
          if (!vId) return null;
          if (settingsCache.has(vId)) return settingsCache.get(vId) || null;
          const settings = await storage.getPmsVesselSettings(vId);
          settingsCache.set(vId, settings || null);
          return settings || null;
        };
        const allWorkOrders = await this.getWorkOrders(vesselId);
        const jobsWithActiveWO = buildJobsWithActiveWOSet(allWorkOrders);
        const existingCycleWOs = buildCalendarCycleWOMap(allWorkOrders);
        const results = {
          checked: calendarJobs.length,
          generated: 0,
          workOrders: []
        };
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        for (const job of calendarJobs) {
          const settings = await getSettingsForVessel(job.vesselId);
          const leadTimeDays = getCalendarLeadDays(job, settings);
          const dueDate = new Date(job.nextDueDate);
          dueDate.setHours(0, 0, 0, 0);
          const generateDate = new Date(dueDate);
          generateDate.setDate(generateDate.getDate() - leadTimeDays);
          if (today < generateDate) {
            continue;
          }
          if (jobsWithActiveWO.has(job.jobNo)) {
            continue;
          }
          const dueDateStr = dueDate.toISOString().split("T")[0];
          const cycleKey = `${job.jobNo}|${dueDateStr}`;
          if (existingCycleWOs.has(cycleKey)) {
            continue;
          }
          let componentCode = job.componentCode;
          if (!componentCode && job.componentId) {
            const component = await storage.getComponent(job.componentId);
            componentCode = component?.componentCode || "";
          }
          if (!componentCode) {
            console.warn(`\u26A0\uFE0F No component code for calendar job ${job.jobNo} - skipping WO generation`);
            continue;
          }
          const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || void 0);
          const generateDateStr = generateDate.toISOString().split("T")[0];
          const workOrderData = {
            vesselId: job.vesselId,
            component: job.componentName,
            componentCode,
            // Use resolved componentCode
            jobId: job.id,
            // Link to job for cycle tracking
            workOrderNo,
            templateCode: workOrderNo,
            jobTitle: job.jobTitle,
            assignedTo: job.assignedTo || "Unassigned",
            dueDate: job.nextDueDate,
            status: "Due",
            // Start as Due since trigger condition is met
            taskType: job.maintenanceType,
            maintenanceBasis: job.maintenanceBasis,
            frequencyValue: job.frequencyValue?.toString(),
            frequencyUnit: job.frequencyUnit,
            jobPriority: job.jobPriority,
            classRelated: job.classRelated,
            briefWorkDescription: job.briefWorkDescription,
            department: job.department,
            requiredSpareParts: job.requiredSpareParts || [],
            requiredTools: job.requiredTools || [],
            safetyRequirements: job.safetyRequirements || {
              ppeRequirements: [],
              permitRequirements: [],
              otherRequirements: []
            },
            // === CALENDAR CYCLE SNAPSHOTS (TRIGGER 2) ===
            driverType: "CALENDAR",
            cycleDueDateSnapshot: dueDateStr,
            generateDateSnapshot: generateDateStr,
            dueDateSnapshot: dueDateStr,
            lastDoneDateSnapshot: job.lastDoneDate || null
          };
          const createdWO = await this.createWorkOrder(workOrderData);
          results.generated++;
          results.workOrders.push(createdWO);
          existingCycleWOs.set(cycleKey, workOrderData);
          jobsWithActiveWO.add(job.jobNo);
          const priorityLabel = isJobCritical(job) ? "Critical" : "Non-Critical";
          console.log(`\u2705 [Calendar Trigger 2] Auto-generated WO ${workOrderNo} for ${priorityLabel} job ${job.jobNo}`);
          console.log(`   last_done=${job.lastDoneDate || "N/A"}, LT=${leadTimeDays} days`);
          console.log(`   DUE_DATE=${dueDateStr}, GENERATE_DATE=${generateDateStr}, Today=${today.toISOString().split("T")[0]}`);
        }
        if (settingsCache.size > 0) {
          Array.from(settingsCache.entries()).forEach(([vId, settings]) => {
            if (settings) {
              console.log(`\u{1F4CB} [Calendar WO Gen] Vessel ${vId} lead times: Critical=${settings.calendarLeadDaysCritical}d, Non-Critical=${settings.calendarLeadDaysNonCritical}d`);
            } else {
              console.log(`\u26A0\uFE0F [Calendar WO Gen] Vessel ${vId} has no PMS settings configured, using 0 day lead time`);
            }
          });
        }
        return results;
      }
      /**
       * Bulk create work orders
       */
      async bulkCreateWorkOrders(workOrders2) {
        return storage.bulkCreateWorkOrders(workOrders2);
      }
      /**
       * Bulk update work orders
       */
      async bulkUpdateWorkOrders(workOrders2) {
        return storage.bulkUpdateWorkOrders(workOrders2);
      }
      /**
       * Bulk upsert work orders
       */
      async bulkUpsertWorkOrders(workOrders2) {
        return storage.bulkUpsertWorkOrders(workOrders2);
      }
    };
    workOrderService = new WorkOrderService();
  }
});

// server/services/jobDueScanner.ts
var jobDueScanner_exports = {};
__export(jobDueScanner_exports, {
  JobDueScannerService: () => JobDueScannerService,
  jobDueScanner: () => jobDueScanner
});
function isJobCritical2(job) {
  const priority = job.jobPriority?.toLowerCase() || "";
  return priority === "critical" || priority === "high";
}
function getRhLeadHours(job, settings) {
  if (!settings) {
    return isJobCritical2(job) ? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL : WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL;
  }
  return isJobCritical2(job) ? settings.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL : settings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL;
}
var JobDueScannerService, jobDueScanner;
var init_jobDueScanner = __esm({
  "server/services/jobDueScanner.ts"() {
    "use strict";
    init_workOrderService();
    init_storage();
    init_workOrderNumbering();
    init_constants();
    init_workOrderStatus();
    JobDueScannerService = class {
      isRunning = false;
      intervalId = null;
      scanIntervalMs = 1 * 60 * 1e3;
      // 1 minute
      /**
       * Start the scheduler to run periodically
       */
      start(intervalMs) {
        if (this.isRunning) {
          console.log("[JobDueScanner] Already running");
          return;
        }
        if (intervalMs) {
          this.scanIntervalMs = intervalMs;
        }
        console.log(`[JobDueScanner] Starting scheduler (interval: ${this.scanIntervalMs / 1e3 / 60} minutes)`);
        this.runScan().catch((err) => {
          console.error("[JobDueScanner] Error during initial scan:", err);
        });
        this.intervalId = setInterval(() => {
          this.runScan().catch((err) => {
            console.error("[JobDueScanner] Error during scheduled scan:", err);
          });
        }, this.scanIntervalMs);
        this.isRunning = true;
      }
      /**
       * Stop the scheduler
       */
      stop() {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        this.isRunning = false;
        console.log("[JobDueScanner] Stopped");
      }
      /**
       * Run a full scan of all jobs and generate work orders as needed
       */
      async runScan() {
        console.log("[JobDueScanner] Starting job due scan...");
        const results = {
          calendarJobsChecked: 0,
          calendarWOsGenerated: 0,
          rhJobsChecked: 0,
          rhWOsGenerated: 0
        };
        try {
          const calendarResults = await workOrderService.autoGenerateWorkOrdersFromJobs();
          results.calendarJobsChecked = calendarResults.checked;
          results.calendarWOsGenerated = calendarResults.generated;
          const rhResults = await this.processRunningHoursJobs();
          results.rhJobsChecked = rhResults.checked;
          results.rhWOsGenerated = rhResults.generated;
          console.log(`[JobDueScanner] Scan complete: Calendar (${results.calendarWOsGenerated}/${results.calendarJobsChecked} WOs), RH (${results.rhWOsGenerated}/${results.rhJobsChecked} WOs)`);
        } catch (error) {
          console.error("[JobDueScanner] Scan failed:", error);
          throw error;
        }
        return results;
      }
      /**
       * Process Running Hours-based jobs and generate work orders when due
       * TRIGGER 1: RH-based auto-generation per new WO generation rules
       * 
       * Applicability:
       * - job.maintenanceBasis = 'Running Hours'
       * - Component RH Counter Type = MASTER or INHERITED
       * - job.isActive = true
       * 
       * Calculations:
       * - RH_last_done = job.lastDoneRH (stored at last WO completion)
       * - F = frequency_rh (intervalRunningHour)
       * - LT = lead_time_rh
       * - RH_effective_current = MASTER → rhCurrentMaster, INHERITED → rhCurrentInheritedCached
       * - RH_due = RH_last_done + F
       * - RH_generate = RH_due - LT
       * 
       * Auto-generation condition:
       * - RH_effective_current >= RH_generate
       * - AND no DUE/OVERDUE/PENDING APPROVAL/POSTPONED WO exists for same job + same RH_due cycle
       */
      async processRunningHoursJobs() {
        const allJobs = await storage.getJobs();
        const rhJobs = allJobs.filter(
          (job) => job.maintenanceBasis === "Running Hours" && job.isActive !== false && // Job must be active
          job.intervalRunningHour && job.intervalRunningHour > 0
          // Must have valid frequency
        );
        const settingsCache = /* @__PURE__ */ new Map();
        const getSettingsForVessel = async (vId) => {
          if (!vId) return null;
          if (settingsCache.has(vId)) return settingsCache.get(vId) || null;
          const settings = await storage.getPmsVesselSettings(vId);
          settingsCache.set(vId, settings || null);
          return settings || null;
        };
        const allWorkOrders = await storage.getWorkOrders();
        const jobsWithActiveWO = buildJobsWithActiveWOSet(allWorkOrders);
        const existingCycleWOs = buildRhCycleWOMap(allWorkOrders);
        const componentCache = /* @__PURE__ */ new Map();
        const vesselComponentsFetched = /* @__PURE__ */ new Set();
        const getComponentFromCache = async (componentId, vesselId) => {
          if (vesselId && !vesselComponentsFetched.has(vesselId)) {
            const vesselComponents = await storage.getComponents(vesselId);
            vesselComponents.forEach((c) => componentCache.set(c.id, c));
            vesselComponentsFetched.add(vesselId);
          }
          return componentCache.get(componentId);
        };
        let generated = 0;
        for (const job of rhJobs) {
          const component = await getComponentFromCache(job.componentId, job.vesselId);
          if (!component) continue;
          const rhCounterType = component.rhCounterType;
          if (rhCounterType !== "MASTER" && rhCounterType !== "INHERITED") {
            continue;
          }
          let rhEffectiveCurrent;
          if (rhCounterType === "MASTER") {
            rhEffectiveCurrent = parseFloat(component.rhCurrentMaster || "0");
          } else {
            rhEffectiveCurrent = parseFloat(component.rhCurrentInheritedCached || "0");
          }
          const rhLastDone = parseFloat(job.lastDoneRH || "0");
          const frequencyRH = job.intervalRunningHour || 0;
          if (frequencyRH <= 0) continue;
          const settings = await getSettingsForVessel(job.vesselId);
          const leadTimeRH = getRhLeadHours(job, settings);
          const rhDue = rhLastDone + frequencyRH;
          const rhGenerate = Math.max(0, rhDue - leadTimeRH);
          if (rhEffectiveCurrent < rhGenerate) {
            continue;
          }
          if (jobsWithActiveWO.has(job.jobNo)) {
            continue;
          }
          const cycleKey = `${job.jobNo}|${rhDue}`;
          if (existingCycleWOs.has(cycleKey)) {
            continue;
          }
          let componentCode = job.componentCode;
          if (!componentCode && job.componentId) {
            const component2 = await storage.getComponent(job.componentId);
            componentCode = component2?.componentCode || "";
          }
          if (!componentCode) {
            console.warn(`\u26A0\uFE0F No component code for RH job ${job.jobNo} - skipping WO generation`);
            continue;
          }
          const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || void 0);
          const workOrderData = {
            vesselId: job.vesselId,
            component: job.componentName,
            componentCode,
            // Use resolved componentCode
            jobId: job.id,
            // Link to job for cycle tracking
            workOrderNo,
            templateCode: workOrderNo,
            jobTitle: job.jobTitle,
            assignedTo: job.assignedTo || "Unassigned",
            dueDate: void 0,
            // RH-based jobs don't have calendar due date
            nextDueReading: String(rhDue),
            // Store the due RH value
            currentReading: String(rhEffectiveCurrent),
            // Store current RH at generation time
            status: "Due",
            // Start as Due since trigger condition is met
            taskType: job.maintenanceType,
            maintenanceBasis: job.maintenanceBasis,
            frequencyValue: job.frequencyValue?.toString(),
            frequencyUnit: job.frequencyUnit,
            intervalRunningHour: job.intervalRunningHour,
            jobPriority: job.jobPriority,
            classRelated: job.classRelated,
            briefWorkDescription: job.briefWorkDescription,
            department: job.department,
            requiredSpareParts: job.requiredSpareParts || [],
            requiredTools: job.requiredTools || [],
            safetyRequirements: job.safetyRequirements || {
              ppeRequirements: [],
              permitRequirements: [],
              otherRequirements: []
            },
            // === RH CYCLE SNAPSHOTS (TRIGGER 1) ===
            driverType: "RH",
            cycleDueRhSnapshot: String(rhDue),
            generateRhSnapshot: String(rhGenerate),
            dueRhSnapshot: String(rhDue),
            effectiveRhAtGeneration: String(rhEffectiveCurrent),
            rhLastDoneSnapshot: String(rhLastDone)
          };
          await workOrderService.createWorkOrder(workOrderData);
          generated++;
          existingCycleWOs.set(cycleKey, workOrderData);
          jobsWithActiveWO.add(job.jobNo);
          const priorityLabel = isJobCritical2(job) ? "Critical" : "Non-Critical";
          console.log(`\u2705 [RH Trigger 1] Auto-generated WO ${workOrderNo} for ${priorityLabel} job ${job.jobNo}`);
          console.log(`   RH_last_done=${rhLastDone}, F=${frequencyRH}, LT=${leadTimeRH}`);
          console.log(`   RH_due=${rhDue}, RH_generate=${rhGenerate}, RH_current=${rhEffectiveCurrent}`);
        }
        if (settingsCache.size > 0) {
          Array.from(settingsCache.entries()).forEach(([vId, settings]) => {
            if (settings) {
              console.log(`\u{1F4CB} [RH WO Gen] Vessel ${vId} lead times: Critical=${settings.rhLeadHoursCritical}hrs, Non-Critical=${settings.rhLeadHoursNonCritical}hrs`);
            } else {
              console.log(`\u26A0\uFE0F [RH WO Gen] Vessel ${vId} has no PMS settings configured, using 0 hour lead time`);
            }
          });
        }
        return { checked: rhJobs.length, generated };
      }
      /**
       * Generate a work order for a specific job on-demand (Manual Button)
       * TRIGGER 3: Manual "Generate WO" button per new WO generation rules
       * 
       * Manual generation rules (STRICT):
       * 1. Determine job type (RH or Calendar)
       * 2. Compute current cycle (RH_due or DUE_DATE)
       * 3. Duplicate protection (MANDATORY):
       *    - If any OPEN/IN_PROGRESS WO exists for same job + same cycle → DO NOT CREATE
       *    - If any OPEN/IN_PROGRESS WO exists for same job (older cycle) → DO NOT CREATE
       *    Show message: "Work Order already exists for this job cycle: <WO_NUMBER>"
       * 
       * Manual trigger can override timing (can generate before generate date/RH_generate)
       * but CANNOT bypass cycle uniqueness or open-WO restriction
       */
      async generateWorkOrderForJob(jobId) {
        const job = await storage.getJob(jobId);
        if (!job) {
          return { success: false, message: "Job not found" };
        }
        const allWorkOrders = await storage.getWorkOrders(job.vesselId || void 0);
        const existingActiveWO = findBlockingWOForJob(allWorkOrders, job.id, job.jobNo);
        if (existingActiveWO) {
          return {
            success: false,
            message: `Work Order already exists for this job: ${existingActiveWO.workOrderNo}`
          };
        }
        const isRHJob = job.maintenanceBasis === "Running Hours";
        let cycleSnapshots = {};
        let rhEffectiveCurrent;
        if (isRHJob) {
          const component = await storage.getComponent(job.componentId);
          if (!component) {
            return { success: false, message: "Component not found for job" };
          }
          const rhCounterType = component.rhCounterType;
          if (rhCounterType === "MASTER") {
            rhEffectiveCurrent = parseFloat(component.rhCurrentMaster || "0");
          } else if (rhCounterType === "INHERITED") {
            rhEffectiveCurrent = parseFloat(component.rhCurrentInheritedCached || "0");
          } else {
            rhEffectiveCurrent = parseFloat(component.runningHours || "0");
          }
          const rhLastDone = parseFloat(job.lastDoneRH || "0");
          const frequencyRH = job.intervalRunningHour || 0;
          const settings = job.vesselId ? await storage.getPmsVesselSettings(job.vesselId) : null;
          const leadTimeRH = getRhLeadHours(job, settings);
          const rhDue = rhLastDone + frequencyRH;
          const rhGenerate = Math.max(0, rhDue - leadTimeRH);
          const existingCycleWO = allWorkOrders.find(
            (wo) => wo.jobId === job.id && wo.cycleDueRhSnapshot === String(rhDue) && isBlockingStatus(wo.status)
          );
          if (existingCycleWO) {
            return {
              success: false,
              message: `Work Order already exists for this job cycle: ${existingCycleWO.workOrderNo}`
            };
          }
          cycleSnapshots = {
            driverType: "RH",
            cycleDueRhSnapshot: String(rhDue),
            generateRhSnapshot: String(rhGenerate),
            dueRhSnapshot: String(rhDue),
            effectiveRhAtGeneration: String(rhEffectiveCurrent),
            rhLastDoneSnapshot: String(rhLastDone),
            nextDueReading: String(rhDue),
            currentReading: String(rhEffectiveCurrent)
          };
          console.log(`[Manual Trigger 3] RH Job: RH_last_done=${rhLastDone}, F=${frequencyRH}, LT=${leadTimeRH}`);
          console.log(`   RH_due=${rhDue}, RH_generate=${rhGenerate}, RH_current=${rhEffectiveCurrent}`);
        } else {
          const dueDate = job.nextDueDate ? new Date(job.nextDueDate) : /* @__PURE__ */ new Date();
          dueDate.setHours(0, 0, 0, 0);
          const dueDateStr = dueDate.toISOString().split("T")[0];
          const settings = job.vesselId ? await storage.getPmsVesselSettings(job.vesselId) : null;
          const leadTimeDays = isJobCritical2(job) ? settings?.calendarLeadDaysCritical || 0 : settings?.calendarLeadDaysNonCritical || 0;
          const generateDate = new Date(dueDate);
          generateDate.setDate(generateDate.getDate() - leadTimeDays);
          const generateDateStr = generateDate.toISOString().split("T")[0];
          const existingCycleWO = allWorkOrders.find(
            (wo) => wo.jobId === job.id && wo.cycleDueDateSnapshot === dueDateStr && isBlockingStatus(wo.status)
          );
          if (existingCycleWO) {
            return {
              success: false,
              message: `Work Order already exists for this job cycle: ${existingCycleWO.workOrderNo}`
            };
          }
          cycleSnapshots = {
            driverType: "CALENDAR",
            cycleDueDateSnapshot: dueDateStr,
            generateDateSnapshot: generateDateStr,
            dueDateSnapshot: dueDateStr,
            lastDoneDateSnapshot: job.lastDoneDate || null,
            dueDate: job.nextDueDate
          };
          console.log(`[Manual Trigger 3] Calendar Job: last_done=${job.lastDoneDate || "N/A"}, LT=${leadTimeDays} days`);
          console.log(`   DUE_DATE=${dueDateStr}, GENERATE_DATE=${generateDateStr}`);
        }
        let componentCode = job.componentCode;
        if (!componentCode && job.componentId) {
          const component = await storage.getComponent(job.componentId);
          componentCode = component?.componentCode || "";
        }
        if (!componentCode) {
          return {
            success: false,
            message: `Component code is required for work order generation`
          };
        }
        const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || void 0);
        const workOrderData = {
          vesselId: job.vesselId,
          component: job.componentName,
          componentCode,
          // Use resolved componentCode
          jobId: job.id,
          // Link to job for cycle tracking
          workOrderNo,
          templateCode: workOrderNo,
          jobTitle: job.jobTitle,
          assignedTo: job.assignedTo || "Unassigned",
          status: "Due",
          // Manual generation starts as Due
          taskType: job.maintenanceType,
          maintenanceBasis: job.maintenanceBasis,
          frequencyValue: job.frequencyValue?.toString(),
          frequencyUnit: job.frequencyUnit,
          intervalRunningHour: job.intervalRunningHour,
          jobPriority: job.jobPriority,
          classRelated: job.classRelated,
          briefWorkDescription: job.briefWorkDescription,
          department: job.department,
          requiredSpareParts: job.requiredSpareParts || [],
          requiredTools: job.requiredTools || [],
          safetyRequirements: job.safetyRequirements || {
            ppeRequirements: [],
            permitRequirements: [],
            otherRequirements: []
          },
          // Spread cycle snapshots based on job type
          ...cycleSnapshots
        };
        const createdWO = await workOrderService.createWorkOrder(workOrderData);
        console.log(`\u2705 [Manual Trigger 3] On-demand work order ${workOrderNo} created for job ${job.jobNo}`);
        return {
          success: true,
          workOrder: createdWO,
          message: `Work order ${workOrderNo} created successfully`
        };
      }
    };
    jobDueScanner = new JobDueScannerService();
  }
});

// server/services/workOrderStatusRecalculator.ts
var workOrderStatusRecalculator_exports = {};
__export(workOrderStatusRecalculator_exports, {
  WorkOrderStatusRecalculatorService: () => WorkOrderStatusRecalculatorService,
  workOrderStatusRecalculator: () => workOrderStatusRecalculator
});
var WorkOrderStatusRecalculatorService, workOrderStatusRecalculator;
var init_workOrderStatusRecalculator = __esm({
  "server/services/workOrderStatusRecalculator.ts"() {
    "use strict";
    init_storage();
    init_status();
    init_constants();
    WorkOrderStatusRecalculatorService = class {
      isRunning = false;
      intervalId = null;
      scanIntervalMs = 1 * 60 * 1e3;
      // 1 minute
      /**
       * Start the scheduler to run periodically
       */
      start(intervalMs) {
        if (this.isRunning) {
          console.log("[StatusRecalculator] Already running");
          return;
        }
        if (intervalMs) {
          this.scanIntervalMs = intervalMs;
        }
        console.log(`[StatusRecalculator] Starting scheduler (interval: ${this.scanIntervalMs / 1e3 / 60} minutes)`);
        this.runRecalculation().catch((err) => {
          console.error("[StatusRecalculator] Error during initial recalculation:", err);
        });
        this.intervalId = setInterval(() => {
          this.runRecalculation().catch((err) => {
            console.error("[StatusRecalculator] Error during scheduled recalculation:", err);
          });
        }, this.scanIntervalMs);
        this.isRunning = true;
      }
      /**
       * Stop the scheduler
       */
      stop() {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        this.isRunning = false;
        console.log("[StatusRecalculator] Stopped");
      }
      /**
       * Terminal statuses that should NOT be recalculated
       * These represent work orders that are finalized
       */
      isTerminalStatus(status) {
        if (!status) return false;
        const normalizedStatus = status.toLowerCase().trim();
        return ["completed", "rejected", "closed", "cancelled", "canceled"].includes(normalizedStatus);
      }
      /**
       * Run a full recalculation of all work order statuses
       * Only recalculates non-terminal work orders
       */
      async runRecalculation() {
        console.log("[StatusRecalculator] Starting status recalculation...");
        const results = {
          workOrdersChecked: 0,
          statusesUpdated: 0
        };
        try {
          const allWorkOrders = await storage.getWorkOrders();
          const activeWorkOrders = allWorkOrders.filter((wo) => !this.isTerminalStatus(wo.status));
          results.workOrdersChecked = activeWorkOrders.length;
          if (activeWorkOrders.length === 0) {
            console.log("[StatusRecalculator] No active work orders to recalculate");
            return results;
          }
          const vesselSettingsCache = /* @__PURE__ */ new Map();
          const graceSettingsCache = /* @__PURE__ */ new Map();
          const jobsCache = /* @__PURE__ */ new Map();
          const componentsCache = /* @__PURE__ */ new Map();
          const jobIds = /* @__PURE__ */ new Set();
          activeWorkOrders.forEach((wo) => {
            if (wo.jobId) jobIds.add(wo.jobId);
          });
          for (const jobId of Array.from(jobIds)) {
            const job = await storage.getJob(jobId);
            if (job) jobsCache.set(jobId, job);
          }
          const componentIds = /* @__PURE__ */ new Set();
          jobsCache.forEach((job) => {
            if (job.componentId) componentIds.add(job.componentId);
          });
          for (const componentId of Array.from(componentIds)) {
            const component = await storage.getComponent(componentId);
            if (component) componentsCache.set(componentId, component);
          }
          const vesselIds = /* @__PURE__ */ new Set();
          activeWorkOrders.forEach((wo) => {
            if (wo.vesselId) vesselIds.add(wo.vesselId);
          });
          for (const vesselId of Array.from(vesselIds)) {
            const settings = await storage.getPmsVesselSettings(vesselId);
            vesselSettingsCache.set(vesselId, settings || null);
            if (settings) {
              graceSettingsCache.set(vesselId, {
                calendarGraceMode: settings.calendarGraceMode ?? "COMPANY_STANDARD",
                calendarGraceDays: settings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
                rhGraceHours: settings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
                rhLeadTimeHours: settings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
              });
            }
          }
          for (const wo of activeWorkOrders) {
            let currentRH = null;
            let dueRH = null;
            let job;
            if (wo.maintenanceBasis === "Running Hours") {
              if (wo.jobId) {
                job = jobsCache.get(wo.jobId);
                if (job?.componentId) {
                  const component = componentsCache.get(job.componentId);
                  if (component?.currentCumulativeRH != null) {
                    currentRH = parseFloat(String(component.currentCumulativeRH));
                  }
                }
              }
              if (currentRH === null && wo.currentReading) {
                currentRH = parseFloat(wo.currentReading);
              }
              if (wo.nextDueReading) {
                dueRH = parseFloat(wo.nextDueReading);
              }
            }
            const vesselGraceSettings = wo.vesselId ? graceSettingsCache.get(wo.vesselId) : void 0;
            const vesselSettings = wo.vesselId ? vesselSettingsCache.get(wo.vesselId) : null;
            const isJobCritical3 = job?.jobPriority === "Critical" || job?.classRelated === "true" || String(job?.classRelated) === "true";
            const rhLeadTimeHours = wo.maintenanceBasis === "Running Hours" ? isJobCritical3 ? vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL : vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL : void 0;
            const computedStatus = computeWorkOrderStatus({
              dueDate: wo.dueDate,
              dueRH,
              currentRH,
              isExecution: wo.isExecution,
              status: wo.status,
              completionDateTime: wo.dateCompleted,
              maintenanceBasis: wo.maintenanceBasis || void 0,
              vesselGraceSettings,
              rhLeadTimeHours
            });
            if (computedStatus !== wo.status) {
              await storage.updateWorkOrder(wo.id, { status: computedStatus });
              results.statusesUpdated++;
              console.log(`\u{1F4DD} [StatusRecalculator] Updated WO ${wo.workOrderNo}: ${wo.status} \u2192 ${computedStatus}`);
            }
          }
          console.log(`[StatusRecalculator] Recalculation complete: ${results.statusesUpdated}/${results.workOrdersChecked} statuses updated`);
        } catch (error) {
          console.error("[StatusRecalculator] Recalculation failed:", error);
          throw error;
        }
        return results;
      }
      /**
       * Force an immediate recalculation (for use when settings change)
       */
      async forceRecalculation() {
        console.log("[StatusRecalculator] Force recalculation triggered (settings changed)");
        return this.runRecalculation();
      }
    };
    workOrderStatusRecalculator = new WorkOrderStatusRecalculatorService();
  }
});

// server/utils/defectNumbering.ts
var defectNumbering_exports = {};
__export(defectNumbering_exports, {
  generateDefectNumber: () => generateDefectNumber,
  isValidDefectId: () => isValidDefectId,
  parseDefectId: () => parseDefectId
});
function escapeRegex2(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function generateDefectNumber(storage2, vesselId) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const safeVesselId = vesselId && vesselId.trim() ? vesselId.trim() : "UNKNOWN";
  const allDefects = await storage2.getDefects({ vesselId: safeVesselId });
  const existingDefectsForVessel = allDefects.filter((defect) => {
    const defectPattern = new RegExp(`^DEF-${escapeRegex2(safeVesselId)}-${currentYear}-(\\d+)$`);
    return defectPattern.test(defect.id);
  });
  let maxRunningNumber = 0;
  existingDefectsForVessel.forEach((defect) => {
    const match = defect.id.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) {
        maxRunningNumber = num;
      }
    }
  });
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, "0");
  return `DEF-${safeVesselId}-${currentYear}-${paddedNumber}`;
}
function isValidDefectId(defectId) {
  const pattern = /^DEF-[A-Z0-9]+-\d{4}-\d{3,}$/;
  return pattern.test(defectId);
}
function parseDefectId(defectId) {
  const match = defectId.match(/^DEF-([A-Z0-9]+)-(\d{4})-(\d+)$/);
  if (!match) return null;
  return {
    vesselId: match[1],
    year: parseInt(match[2], 10),
    runningNumber: parseInt(match[3], 10)
  };
}
var init_defectNumbering = __esm({
  "server/utils/defectNumbering.ts"() {
    "use strict";
  }
});

// server/index.ts
import * as dotenv from "dotenv";
import express2 from "express";

// server/routes.ts
init_storage();
init_schema();
init_status();
init_constants();
init_dateUtils();
import { createServer } from "http";
import * as fs3 from "fs";
import * as path5 from "path";
import { z as z5 } from "zod";
import multer2 from "multer";
import Papa2 from "papaparse";
import * as XLSX2 from "xlsx";

// server/routes/bulk.ts
init_storage();
import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import path4 from "path";
import { promises as fsPromises2 } from "fs";

// server/utils/sfiLookup.ts
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var sfiMap = null;
function loadSFIData() {
  const csvPath = path2.join(__dirname, "../../attached_assets/component tree_1761646533252.csv");
  try {
    const fileContent = fs2.readFileSync(csvPath, "utf-8");
    const lines = fileContent.split("\n");
    const map = /* @__PURE__ */ new Map();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const fields = [];
      let currentField = "";
      let insideQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          fields.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());
      if (fields.length >= 5) {
        const code = fields[0];
        const name = fields[1];
        const parentCode = fields[2];
        const mainGroup = fields[3];
        const subGroup = fields[4];
        if (code) {
          map.set(code, {
            code,
            name,
            parentCode,
            mainGroup,
            subGroup
          });
        }
      }
    }
    console.log(`\u2705 Loaded ${map.size} SFI code entries from component tree CSV`);
    return map;
  } catch (error) {
    console.warn("\u26A0\uFE0F  Could not load SFI component tree CSV, using fallback naming:", error);
    return /* @__PURE__ */ new Map();
  }
}
function getSFIName(code) {
  if (!sfiMap) {
    sfiMap = loadSFIData();
  }
  const entry = sfiMap.get(code);
  if (entry) {
    return entry.name || entry.subGroup;
  }
  return `SFI ${code}`;
}

// server/routes/bulk.ts
init_dateUtils();

// server/objectStorage.ts
import { Storage } from "@google-cloud/storage";
import { randomUUID as randomUUID2 } from "crypto";

// server/objectAcl.ts
var ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
function isPermissionAllowed(requested, granted) {
  if (requested === "read" /* READ */) {
    return ["read" /* READ */, "write" /* WRITE */].includes(granted);
  }
  return granted === "write" /* WRITE */;
}
function createObjectAccessGroup(group) {
  switch (group.type) {
    // Implement the case for each type of access group to instantiate.
    //
    // For example:
    // case "USER_LIST":
    //   return new UserListAccessGroup(group.id);
    // case "EMAIL_DOMAIN":
    //   return new EmailDomainAccessGroup(group.id);
    // case "GROUP_MEMBER":
    //   return new GroupMemberAccessGroup(group.id);
    // case "SUBSCRIBER":
    //   return new SubscriberAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}
async function setObjectAclPolicy(objectFile, aclPolicy) {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy)
    }
  });
}
async function getObjectAclPolicy(objectFile) {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy);
}
async function canAccessObject({
  userId,
  objectFile,
  requestedPermission
}) {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }
  if (aclPolicy.visibility === "public" && requestedPermission === "read" /* READ */) {
    return true;
  }
  if (!userId) {
    return false;
  }
  if (aclPolicy.owner === userId) {
    return true;
  }
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (await accessGroup.hasMember(userId) && isPermissionAllowed(requestedPermission, rule.permission)) {
      return true;
    }
  }
  return false;
}

// server/objectStorage.ts
var REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
var objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token"
      }
    },
    universe_domain: "googleapis.com"
  },
  projectId: ""
});
var ObjectNotFoundError = class _ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, _ObjectNotFoundError.prototype);
  }
};
function parseObjectPath(path8) {
  if (!path8.startsWith("/")) {
    path8 = `/${path8}`;
  }
  const pathParts = path8.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return {
    bucketName,
    objectName
  };
}
async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec
}) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1e3).toISOString()
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, make sure you're running on Replit`
    );
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
var ObjectStorageService = class {
  constructor() {
  }
  // Gets the public object search paths.
  getPublicObjectSearchPaths() {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr.split(",").map((path8) => path8.trim()).filter((path8) => path8.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }
  // Gets the private object directory.
  getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }
  // Search for a public object from the search paths.
  async searchPublicObject(filePath) {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    return null;
  }
  // Downloads an object to the response.
  async downloadObject(file, res, cacheTtlSec = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`
      });
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }
  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL() {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    const objectId = randomUUID2();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900
    });
  }
  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath) {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }
  normalizeObjectEntityPath(rawPath) {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }
  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(rawPath, aclPolicy) {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }
  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission
  }) {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? "read" /* READ */
    });
  }
  // Upload a buffer directly to object storage using signed URLs
  // Returns the object path that can be used for later retrieval
  async uploadBuffer(buffer, fileName, folder = "bulk-imports") {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    const timestamp2 = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const objectPath = `${privateObjectDir}/${folder}/${timestamp2}_${safeFileName}`;
    const { bucketName, objectName } = parseObjectPath(objectPath);
    const signedUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 300
      // 5 minutes to complete upload
    });
    const response = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": this.getContentType(fileName)
      },
      body: buffer
    });
    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.status} ${response.statusText}`);
    }
    console.log(`\u{1F4E4} File uploaded to object storage: ${objectPath}`);
    return objectPath;
  }
  // Get content type based on file extension
  getContentType(fileName) {
    const ext = fileName.toLowerCase().split(".").pop();
    switch (ext) {
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case "xls":
        return "application/vnd.ms-excel";
      case "csv":
        return "text/csv";
      default:
        return "application/octet-stream";
    }
  }
  // Download a file from object storage by path using signed URLs
  async downloadByPath(objectPath, res) {
    try {
      const { bucketName, objectName } = parseObjectPath(objectPath);
      const signedUrl = await signObjectURL({
        bucketName,
        objectName,
        method: "GET",
        ttlSec: 300
        // 5 minutes to complete download
      });
      const response = await fetch(signedUrl);
      if (!response.ok) {
        if (response.status === 404) {
          throw new ObjectNotFoundError();
        }
        throw new Error(`Failed to download file: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        throw error;
      }
      console.error("Error downloading file by path:", error);
      throw new Error("Error downloading file");
    }
  }
  // Check if a file exists in object storage using signed URL HEAD request
  async fileExists(objectPath) {
    try {
      const { bucketName, objectName } = parseObjectPath(objectPath);
      const signedUrl = await signObjectURL({
        bucketName,
        objectName,
        method: "HEAD",
        ttlSec: 60
      });
      const response = await fetch(signedUrl, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }
};

// server/routes/bulk.ts
init_workOrderNumbering();

// shared/sparesTemplateFields.ts
var SPARES_TEMPLATE_FIELDS = [
  { header: "Part Code", key: "partCode", width: 18, required: false, description: "Auto-generated PT-XXXXXX if not provided" },
  { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 20, required: false, description: "Links to fleet master equipment" },
  { header: "Fleet Equipment Name", key: "fleetEquipmentName", width: 28, required: false, description: "Fleet equipment reference name" },
  { header: "Component Code", key: "componentCode", width: 18, required: true, description: "Must exist in system" },
  { header: "Component Name", key: "componentName", width: 28, required: false, description: "Auto-filled from component" },
  { header: "Part Name", key: "partName", width: 32, required: true, description: "Spare part description" },
  { header: "Part Number", key: "partNumber", width: 18, required: false, description: "Manufacturer part number" },
  { header: "UOM", key: "uom", width: 12, required: false, description: "Unit of Measurement (PCS, KG, LTR, etc.)" },
  { header: "Drawing Number", key: "drawingNumber", width: 18, required: false, description: "Drawing reference" },
  { header: "Position Number", key: "positionNumber", width: 16, required: false, description: "Assembly position number" },
  { header: "Note", key: "note", width: 35, required: false, description: "Additional notes" },
  { header: "Specification", key: "specification", width: 35, required: false, description: "Technical specifications" },
  { header: "Maker", key: "maker", width: 22, required: false, description: "Manufacturer name" },
  { header: "Maker Code", key: "makerCode", width: 15, required: false, description: "Manufacturer code" },
  { header: "Manual Name", key: "manualName", width: 20, required: false, description: "Reference manual name" },
  { header: "Page Number", key: "pageNumber", width: 14, required: false, description: "Reference page number" },
  { header: "Criticality", key: "criticality", width: 14, required: false, description: "Yes or No - Critical spare flag" },
  { header: "Total ROB", key: "totalRob", width: 12, required: false, description: "Total remaining on board" },
  { header: "Location A", key: "locationA", width: 15, required: false, description: "Primary storage location" },
  { header: "Location A - ROB", key: "locationARob", width: 16, required: false, description: "ROB at Location A" },
  { header: "Location B", key: "locationB", width: 15, required: false, description: "Secondary storage location" },
  { header: "Location B - ROB", key: "locationBRob", width: 16, required: false, description: "ROB at Location B" },
  { header: "Minimum Stock", key: "minimumStock", width: 14, required: false, description: "Minimum stock level" },
  { header: "Is Active", key: "isActive", width: 12, required: false, description: "Yes or No - defaults to Yes" },
  { header: "IHM (Inventory of Hazardous Materials)", key: "ihm", width: 35, required: false, description: "Yes or No" },
  { header: "Evidence Type", key: "evidenceType", width: 16, required: false, description: "Type of evidence/remarks" },
  { header: "Vessel Code", key: "vesselCode", width: 12, required: true, description: "Vessel identifier (e.g., V001)" }
];
function getSparesExcelColumns() {
  return SPARES_TEMPLATE_FIELDS.map((f) => ({
    header: f.header,
    key: f.key,
    width: f.width
  }));
}

// server/services/fileBasedImportHistory.ts
import path3 from "path";
import { promises as fsPromises } from "fs";
var HISTORY_DIR = path3.join(process.cwd(), "uploads", "bulk-imports", "history");
async function ensureHistoryDir() {
  try {
    await fsPromises.mkdir(HISTORY_DIR, { recursive: true });
  } catch (err) {
  }
}
async function saveImportHistory(data) {
  await ensureHistoryDir();
  const record = {
    id: data.id,
    type: data.type,
    mode: data.mode,
    vesselId: data.vesselId,
    userId: data.userId,
    startedAt: data.startedAt || (/* @__PURE__ */ new Date()).toISOString(),
    completedAt: data.completedAt || (/* @__PURE__ */ new Date()).toISOString(),
    status: data.status,
    created: data.created || 0,
    updated: data.updated || 0,
    skipped: data.skipped || 0,
    archived: data.archived || 0,
    originalName: data.originalName,
    storedFilePath: data.storedFilePath,
    errorReport: data.errorReport || null
  };
  const filePath = path3.join(HISTORY_DIR, `${record.id}.json`);
  await fsPromises.writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
  console.log(`\u{1F4DD} Saved import history to ${filePath}`);
  return record;
}
async function getImportHistoryList(type, limit = 50, offset = 0) {
  await ensureHistoryDir();
  try {
    const files = await fsPromises.readdir(HISTORY_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const records = [];
    for (const file of jsonFiles) {
      try {
        const content = await fsPromises.readFile(path3.join(HISTORY_DIR, file), "utf8");
        const record = JSON.parse(content);
        if (!type || record.type === type) {
          records.push(record);
        }
      } catch (err) {
        console.error(`Failed to read history file ${file}:`, err);
      }
    }
    records.sort((a, b) => {
      const dateA = new Date(a.startedAt || a.completedAt).getTime();
      const dateB = new Date(b.startedAt || b.completedAt).getTime();
      return dateB - dateA;
    });
    const total = records.length;
    const paginatedItems = records.slice(offset, offset + limit);
    return { items: paginatedItems, total };
  } catch (err) {
    console.error("Failed to read import history directory:", err);
    return { items: [], total: 0 };
  }
}
async function getImportHistoryById(id) {
  await ensureHistoryDir();
  const filePath = path3.join(HISTORY_DIR, `${id}.json`);
  try {
    const content = await fsPromises.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}
async function updateImportHistory(id, updates) {
  const existing = await getImportHistoryById(id);
  if (!existing) {
    return null;
  }
  const updated = { ...existing, ...updates };
  const filePath = path3.join(HISTORY_DIR, `${id}.json`);
  await fsPromises.writeFile(filePath, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

// server/routes/bulk.ts
var router = Router();
var TEMPLATE_VERSION = "2.0.0";
var TEMPLATE_VERSION_DATE = "2025-11-28";
var TEMPLATE_VERSION_CELL = "_TEMPLATE_VERSION_";
function checkTemplateVersion(worksheet) {
  let versionValue = null;
  const cellsToCheck = ["AA1", "C1", "Z1"];
  for (const cellAddr of cellsToCheck) {
    const cell = worksheet[cellAddr];
    if (cell && cell.v && String(cell.v).startsWith(TEMPLATE_VERSION_CELL)) {
      versionValue = String(cell.v);
      break;
    }
  }
  if (!versionValue) {
    return { valid: true, message: "No version info found - legacy template accepted" };
  }
  const version = versionValue.replace(TEMPLATE_VERSION_CELL, "");
  if (version === TEMPLATE_VERSION) {
    return { valid: true, version };
  }
  const versionParts = version.split(".").map((p) => parseInt(p, 10));
  const currentParts = TEMPLATE_VERSION.split(".").map((p) => parseInt(p, 10));
  if (versionParts.some(isNaN) || currentParts.some(isNaN)) {
    return { valid: true, version, message: "Version format could not be parsed - accepting upload" };
  }
  const uploadMajor = versionParts[0] || 0;
  const currentMajor = currentParts[0] || 0;
  if (uploadMajor < currentMajor) {
    return {
      valid: false,
      version,
      message: `Template version ${version} is outdated. Please download the latest template (v${TEMPLATE_VERSION}).`
    };
  }
  return { valid: true, version };
}
function addVersionInfoToSheet(sheet) {
  sheet.getCell("AA1").value = `${TEMPLATE_VERSION_CELL}${TEMPLATE_VERSION}`;
  sheet.getColumn("AA").hidden = true;
}
async function processSpareInventory(params) {
  const { spareId, vesselId, componentId, locationAName, locationBName, robLocationA, robLocationB, isNewSpare, userId } = params;
  try {
    const existingLinks = await storage.getSpareComponentLinksBySpare(spareId);
    const alreadyLinked = existingLinks.some((link) => link.componentId === componentId);
    if (!alreadyLinked) {
      await storage.createSpareComponentLink({
        spareId,
        componentId,
        vesselId,
        linkedBy: userId
      });
      console.log(`\u{1F517} Linked spare ${spareId} to component ${componentId}`);
    }
    if (locationAName && locationAName.trim()) {
      const locationA = await storage.findOrCreateLocation(vesselId, locationAName.trim(), userId);
      const currentTotalRobA = await storage.getSpareRobTotal(spareId);
      const currentLocStockA = await storage.getSpareLocationStockItem(spareId, locationA.id);
      const currentLocQtyA = currentLocStockA?.qty ?? 0;
      if (robLocationA >= 0) {
        await storage.upsertSpareLocationStock({
          vesselId,
          spareId,
          locationId: locationA.id,
          qty: robLocationA
        });
        if (isNewSpare && robLocationA > 0) {
          const newTotalRobA = currentTotalRobA + robLocationA;
          await storage.createInventoryTransaction({
            vesselId,
            spareId,
            locationId: locationA.id,
            eventType: "ADJUST",
            qtyChange: robLocationA,
            robTotalBefore: currentTotalRobA,
            robTotalAfter: newTotalRobA,
            robLocationBefore: currentLocQtyA,
            robLocationAfter: robLocationA,
            referenceType: "OTHER",
            referenceNote: "Opening balance from Excel import",
            userId
          });
          console.log(`\u{1F4CA} Created opening balance for spare ${spareId} at ${locationAName}: ${robLocationA}`);
        }
      }
    }
    if (locationBName && locationBName.trim()) {
      const locationB = await storage.findOrCreateLocation(vesselId, locationBName.trim(), userId);
      const currentTotalRobB = await storage.getSpareRobTotal(spareId);
      const currentLocStockB = await storage.getSpareLocationStockItem(spareId, locationB.id);
      const currentLocQtyB = currentLocStockB?.qty ?? 0;
      if (robLocationB >= 0) {
        await storage.upsertSpareLocationStock({
          vesselId,
          spareId,
          locationId: locationB.id,
          qty: robLocationB
        });
        if (isNewSpare && robLocationB > 0) {
          const newTotalRobB = currentTotalRobB + robLocationB;
          await storage.createInventoryTransaction({
            vesselId,
            spareId,
            locationId: locationB.id,
            eventType: "ADJUST",
            qtyChange: robLocationB,
            robTotalBefore: currentTotalRobB,
            robTotalAfter: newTotalRobB,
            robLocationBefore: currentLocQtyB,
            robLocationAfter: robLocationB,
            referenceType: "OTHER",
            referenceNote: "Opening balance from Excel import",
            userId
          });
          console.log(`\u{1F4CA} Created opening balance for spare ${spareId} at ${locationBName}: ${robLocationB}`);
        }
      }
    }
  } catch (error) {
    console.error(`\u26A0\uFE0F Error processing inventory for spare ${spareId}:`, error.message);
  }
}
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
  // 20MB limit
});
var dryRunCache = /* @__PURE__ */ new Map();
function extractRawExcelData(worksheet) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  const data = [];
  const headers = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = worksheet[cellAddress];
    headers[col] = cell ? String(cell.v) : "";
  }
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const rowData = {};
    let hasData = false;
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      const header = headers[col];
      if (!header) continue;
      if (cell) {
        rowData[header] = cell.v;
        hasData = true;
      } else {
        rowData[header] = void 0;
      }
    }
    if (hasData) {
      data.push(rowData);
    }
  }
  return data;
}
var COLUMN_MAPPINGS = {
  stores: {
    // Item Code variations
    "itemcode": "Item Code",
    "item_code": "Item Code",
    "item code": "Item Code",
    "code": "Item Code",
    // IMPA Code variations
    "impacode": "IMPA Code",
    "impa_code": "IMPA Code",
    "impa code": "IMPA Code",
    "impa": "IMPA Code",
    // Item Name variations
    "itemname": "Item Name",
    "item_name": "Item Name",
    "item name": "Item Name",
    "name": "Item Name",
    "description": "Item Name",
    "item_description": "Item Name",
    // UOM variations
    "uom": "UOM",
    "unit": "UOM",
    "unit_of_measure": "UOM",
    "unit of measure": "UOM",
    // Category variations
    "category": "Category",
    "stores_category": "Category",
    "stores category": "Category",
    "storescategory": "Category",
    // Total ROB variations
    "totalrob": "Total ROB",
    "total_rob": "Total ROB",
    "total rob": "Total ROB",
    "rob": "Total ROB",
    "stock": "Total ROB",
    "quantity": "Total ROB",
    // Location A variations
    "locationa": "Location A",
    "location_a": "Location A",
    "location a": "Location A",
    "loc_a": "Location A",
    "loc a": "Location A",
    // Location A - ROB variations
    "locationa-rob": "Location A - ROB",
    "location_a_rob": "Location A - ROB",
    "location a - rob": "Location A - ROB",
    "loc_a_rob": "Location A - ROB",
    "loc a rob": "Location A - ROB",
    "location a rob": "Location A - ROB",
    // Location B variations
    "locationb": "Location B",
    "location_b": "Location B",
    "location b": "Location B",
    "loc_b": "Location B",
    "loc b": "Location B",
    // Location B - ROB variations
    "locationb-rob": "Location B - ROB",
    "location_b_rob": "Location B - ROB",
    "location b - rob": "Location B - ROB",
    "loc_b_rob": "Location B - ROB",
    "loc b rob": "Location B - ROB",
    "location b rob": "Location B - ROB",
    // Min variations
    "min": "Min",
    "minimum": "Min",
    "min_stock": "Min",
    "minimum_stock": "Min",
    "min stock": "Min",
    "minimum stock": "Min",
    "minstock": "Min",
    "minimumstock": "Min"
  },
  spares: {
    "partcode": "Part Code",
    "part_code": "Part Code",
    "part code": "Part Code",
    "componentcode": "Component Code",
    "component_code": "Component Code",
    "component code": "Component Code",
    "componentname": "Component Name",
    "component_name": "Component Name",
    "component name": "Component Name",
    "partname": "Part Name",
    "part_name": "Part Name",
    "part name": "Part Name",
    "partnumber": "Part Number",
    "part_number": "Part Number",
    "part number": "Part Number",
    "uom": "UOM",
    "totalrob": "Total ROB",
    "total_rob": "Total ROB",
    "total rob": "Total ROB"
  },
  components: {
    "componentcode": "Component Code",
    "component_code": "Component Code",
    "component code": "Component Code",
    "componentname": "Component Name",
    "component_name": "Component Name",
    "component name": "Component Name",
    "category": "Category",
    "maingroupcode": "Main Group Code",
    "main_group_code": "Main Group Code",
    "main group code": "Main Group Code"
  },
  jobs: {
    "componentcode": "Component Code",
    "component_code": "Component Code",
    "component code": "Component Code",
    "jobcode": "Job Code",
    "job_code": "Job Code",
    "job code": "Job Code",
    "jobtitle": "WO Title",
    "job_title": "WO Title",
    "job title": "WO Title",
    "wotitle": "WO Title",
    "wo_title": "WO Title",
    "wo title": "WO Title",
    // Multi-sheet template column mappings
    "scheduletype": "Maintenance Basis",
    "schedule_type": "Maintenance Basis",
    "schedule type": "Maintenance Basis",
    "calendarinterval": "Interval Value",
    "calendar_interval": "Interval Value",
    "calendar interval": "Interval Value",
    "intervalvalue": "Interval Value",
    "interval_value": "Interval Value",
    "interval value": "Interval Value",
    "intervalunit": "Unit",
    "interval_unit": "Unit",
    "interval unit": "Unit",
    "rhinterval": "Interval Running Hours",
    "rh_interval": "Interval Running Hours",
    "rh interval": "Interval Running Hours",
    "responsiblerank": "Assigned To",
    "responsible_rank": "Assigned To",
    "responsible rank": "Assigned To",
    "assignedto": "Assigned To",
    "assigned_to": "Assigned To",
    "assigned to": "Assigned To",
    "tasktype": "Task Type",
    "task_type": "Task Type",
    "task type": "Task Type",
    "maintenancebasis": "Maintenance Basis",
    "maintenance_basis": "Maintenance Basis",
    "maintenance basis": "Maintenance Basis",
    "lastdonedate": "Last Done Date",
    "last_done_date": "Last Done Date",
    "last done date": "Last Done Date",
    "lastdonerh": "Last Done RH",
    "last_done_rh": "Last Done RH",
    "last done rh": "Last Done RH",
    "jobdescription": "Brief Work Description",
    "job_description": "Brief Work Description",
    "job description": "Brief Work Description",
    "briefworkdescription": "Brief Work Description",
    "brief_work_description": "Brief Work Description",
    "brief work description": "Brief Work Description",
    "jobpriority": "Job Priority",
    "job_priority": "Job Priority",
    "job priority": "Job Priority",
    "classrelated": "Class Related",
    "class_related": "Class Related",
    "class related": "Class Related",
    "critical yes/no": "Criticality",
    "criticality": "Criticality",
    "isactive": "Is Active",
    "is_active": "Is Active",
    "is active": "Is Active",
    "vesselcode": "Vessel Code",
    "vessel_code": "Vessel Code",
    "vessel code": "Vessel Code",
    "fleetequipmentcode": "Fleet Equipment Code",
    "fleet_equipment_code": "Fleet Equipment Code",
    "fleet equipment code": "Fleet Equipment Code",
    "fleetequipmentname": "Fleet Equipment Name",
    "fleet_equipment_name": "Fleet Equipment Name",
    "fleet equipment name": "Fleet Equipment Name"
  }
};
function normalizeColumnNames(data, type) {
  const mappings = COLUMN_MAPPINGS[type];
  if (!mappings || data.length === 0) {
    return data;
  }
  const originalColumns = Object.keys(data[0] || {});
  const columnMap = {};
  for (const col of originalColumns) {
    const normalizedLookup = col.toLowerCase().trim();
    if (mappings[normalizedLookup]) {
      columnMap[col] = mappings[normalizedLookup];
    } else {
      columnMap[col] = col;
    }
  }
  return data.map((row) => {
    const normalizedRow = {};
    for (const [originalCol, value] of Object.entries(row)) {
      const normalizedCol = columnMap[originalCol] || originalCol;
      normalizedRow[normalizedCol] = value;
    }
    return normalizedRow;
  });
}
var COMPONENT_CATEGORIES = [
  "1 Ship General",
  "2 Hull",
  "3 Equipment for Cargo",
  "4 Ship Equipment",
  "5 Equipment for Crew and Passengers",
  "6 Machinery Main Components",
  "7 Systems for Machinery Main Components",
  "8 Ship Common Systems"
];
function getComponentCategory(mainGroupCode) {
  if (mainGroupCode >= 1 && mainGroupCode <= 8) {
    return COMPONENT_CATEGORIES[mainGroupCode - 1];
  }
  return null;
}
function getSubGroupCode(sfiCode) {
  const cleanCode = stripSFISuffix(sfiCode);
  const baseCode = cleanCode.split(".")[0];
  if (baseCode.length >= 2) {
    return baseCode.substring(0, 2);
  }
  return null;
}
function getSubGroupName(subGroupCode) {
  const subGroupNames = {
    // Group 7 - Systems for Machinery Main Components
    "71": "LUBE OIL SYSTEMS",
    "72": "COOLING SYSTEMS",
    "73": "FUEL OIL SYSTEMS",
    "74": "COMPRESSED AIR SYSTEMS",
    "75": "HYDRAULIC SYSTEMS",
    // Group 6 - Machinery Main Components
    "61": "DIESEL ENGINES",
    "62": "STEAM TURBINES",
    "63": "GAS TURBINES",
    // Group 2 - Hull
    "21": "SHELL PLATING",
    "22": "HULL",
    "23": "SHELL DOORS"
    // Add more mappings as needed
  };
  return subGroupNames[subGroupCode] || "UNKNOWN SUB GROUP";
}
function stripSFISuffix(sfiCode) {
  return sfiCode.replace(/\([^)]*\)$/, "").trim();
}
function getParentSFICode(sfiCode) {
  const cleanCode = stripSFISuffix(sfiCode);
  const parts = cleanCode.split(".");
  if (parts.length > 1) {
    parts.pop();
    return parts.join(".");
  }
  const baseCode = cleanCode;
  if (baseCode.length > 2) {
    return baseCode.substring(0, 2);
  } else if (baseCode.length === 2) {
    return baseCode.charAt(0);
  }
  return null;
}
function validateSFICode(sfiCode) {
  const cleanCode = stripSFISuffix(sfiCode);
  const pattern = /^\d{1,3}(\.\d{1,3})*$/;
  return pattern.test(cleanCode);
}
var UOM_LIST = ["pcs", "set", "ltr", "kg", "m", "box", "roll", "pack", "kit", "other"];
var STORES_CATEGORIES = [
  "General Stores",
  "Electrical",
  "Mechanical",
  "Safety",
  "Consumables"
];
var DEPARTMENTS = ["Engine", "Deck", "Electrical"];
var RESPONSIBLE_RANKS = [
  "Master",
  "Chief Officer",
  "2nd Officer",
  "3rd Officer",
  "Chief Engineer",
  "2nd Engineer",
  "3rd Engineer",
  "4th Engineer",
  "Electrician",
  "Bosun",
  "Fitter"
];
var SCHEDULE_TYPES = ["Running Hours", "Calendar", "Both"];
var INTERVAL_UNITS = ["Days", "Weeks", "Months", "Years"];
async function generateFleetMasterTemplate() {
  const workbook = new ExcelJS.Workbook();
  const masterSheet = workbook.addWorksheet("Master_Sheet");
  masterSheet.columns = [
    { header: "Section", key: "section", width: 25 },
    { header: "Instructions", key: "instructions", width: 80 }
  ];
  const instructions = [
    ["Template Version", `Version ${TEMPLATE_VERSION} (${TEMPLATE_VERSION_DATE}) - Do not modify version info`],
    ["Overview", "This workbook contains template sheets for importing Fleet Master Data and Vessel-specific data."],
    ["Fleet vs Vessel", "FLEET sheets define master templates applied at fleet level. VESSEL sheets contain vessel-specific instance data."],
    ["Fleet Equipment Code", "Links fleet and vessel data. Fleet_Component creates master equipment. Vessel_Component references via Fleet Equipment Code."],
    ["Data Entry Order", "1. Maker List (optional) \u2192 2. SFI Details (optional) \u2192 3. Fleet_Component \u2192 4. Fleet_Job \u2192 5. Fleet_Spare"],
    ["Vessel Data Order", "1. Vessel_Component \u2192 2. Vessel_Job \u2192 3. Vessel_Spare \u2192 4. Vessel_Stores"],
    ["Date Format", "Use DD-MMM-YYYY format (e.g., 15-NOV-2024). System will convert automatically."],
    ["Yes/No Fields", 'Use "Yes" or "No" (case-insensitive). Do not use TRUE/FALSE or 1/0.'],
    ["Required Fields", "Fields marked as Required must have values. Empty required fields will cause validation errors."],
    ["Parent Codes", "Parent Fleet Equipment Code in Fleet_Component establishes hierarchy. Parent Component Code in Vessel_Component is separate."],
    ["IS Parent Flag", "Only Fleet_Component has IS Parent field. Vessel_Component does NOT have IS Parent field."],
    ["Running Hours", "Running Hours (RH) are only entered at vessel level. Fleet templates define job intervals only."],
    ["Dual Frequency Jobs", "Jobs can have BOTH Calendar AND Running Hours intervals. Fill Calendar Interval OR RH Interval OR BOTH."],
    ["Spare Parts", "Fleet_Spare defines master parts. Vessel_Spare has ROB by Location (Deck/Engine/Store1/Store2)."],
    ["Stores vs Spares", "Vessel_Stores is for consumables (paint, chemicals). Spares are linked to equipment/components."],
    ["IMPA Code", "Vessel_Stores includes IMPA Code field for international maritime parts standardization."]
  ];
  masterSheet.getCell("C1").value = `${TEMPLATE_VERSION_CELL}${TEMPLATE_VERSION}`;
  masterSheet.getColumn("C").hidden = true;
  instructions.forEach(([section, text2]) => {
    masterSheet.addRow({ section, instructions: text2 });
  });
  masterSheet.getRow(1).font = { bold: true };
  masterSheet.getColumn(1).font = { bold: true };
  const makerSheet = workbook.addWorksheet("Maker List");
  makerSheet.columns = [
    { header: "Maker Code", key: "makerCode", width: 15 },
    { header: "Maker Name", key: "makerName", width: 35 },
    { header: "Address", key: "address", width: 50 }
  ];
  makerSheet.getRow(1).font = { bold: true };
  const sfiSheet = workbook.addWorksheet("SFI Details");
  sfiSheet.columns = [
    { header: "Component Code", key: "componentCode", width: 20 },
    { header: "Component Name", key: "componentName", width: 50 }
  ];
  sfiSheet.getRow(1).font = { bold: true };
  const fleetComponentSheet = workbook.addWorksheet("Fleet_Component");
  fleetComponentSheet.columns = [
    { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 20 },
    { header: "Fleet Equipment Name", key: "fleetEquipmentName", width: 35 },
    { header: "Parent Fleet Equipment Code", key: "parentFleetEquipmentCode", width: 25 },
    { header: "SFI System", key: "sfiSystem", width: 15 },
    { header: "Criticality", key: "criticality", width: 15 },
    { header: "Condition Based", key: "conditionBased", width: 20 },
    { header: "Location", key: "location", width: 20 },
    { header: "Rating", key: "rating", width: 20 },
    { header: "Equipment / System Department", key: "equipmentDepartment", width: 28 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "IS Parent", key: "isParent", width: 15 },
    { header: "IS Active", key: "isActive", width: 12 },
    { header: "Maker Code", key: "makerCode", width: 15 }
  ];
  fleetComponentSheet.getRow(1).font = { bold: true };
  const vesselComponentSheet = workbook.addWorksheet("Vessel_Component");
  vesselComponentSheet.columns = [
    { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 20 },
    { header: "Fleet Equipment Name", key: "fleetEquipmentName", width: 30 },
    { header: "Parent Component Code", key: "parentComponentCode", width: 22 },
    { header: "Component Code", key: "componentCode", width: 18 },
    { header: "Component Name", key: "componentName", width: 35 },
    { header: "Component Category", key: "componentCategory", width: 35 },
    { header: "Maker", key: "maker", width: 25 },
    { header: "Maker Code", key: "makerCode", width: 15 },
    { header: "Model", key: "model", width: 20 },
    { header: "Model Code", key: "modelCode", width: 20 },
    { header: "Serial No", key: "serialNo", width: 20 },
    { header: "Drawing No", key: "drawingNo", width: 18 },
    { header: "Location", key: "location", width: 20 },
    { header: "Criticality", key: "criticality", width: 15 },
    { header: "Condition Based", key: "conditionBased", width: 20 },
    { header: "Installation Date", key: "installationDate", width: 18 },
    { header: "Commissioned Date", key: "commissionedDate", width: 18 },
    { header: "Rating", key: "rating", width: 20 },
    { header: "Equipment / System Department", key: "equipmentDepartment", width: 28 },
    { header: "Class item", key: "classItem", width: 12 },
    { header: "IS Active", key: "isActive", width: 12 },
    { header: "Vessel Code", key: "vesselCode", width: 12 },
    { header: "IS Parent", key: "isParent", width: 12 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "RH Counter Type", key: "rhCounterType", width: 18 },
    { header: "RH Counter Source", key: "rhCounterSource", width: 18 },
    { header: "Running Hours", key: "runningHours", width: 15 },
    { header: "Last Updated", key: "lastUpdated", width: 18 }
  ];
  vesselComponentSheet.getRow(1).font = { bold: true };
  const fleetJobSheet = workbook.addWorksheet("Fleet_Job");
  fleetJobSheet.columns = [
    { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 20 },
    { header: "Fleet Equipment Name", key: "fleetEquipmentName", width: 30 },
    { header: "Job Code", key: "jobCode", width: 15 },
    { header: "Job Title", key: "jobTitle", width: 40 },
    { header: "Job Description", key: "jobDescription", width: 50 },
    { header: "Department", key: "department", width: 15 },
    { header: "Responsible Rank", key: "responsibleRank", width: 20 },
    { header: "Schedule Type", key: "scheduleType", width: 15 },
    { header: "Calendar Interval", key: "calendarInterval", width: 18 },
    { header: "Interval Unit", key: "intervalUnit", width: 15 },
    { header: "RH Interval", key: "rhInterval", width: 15 },
    { header: "Critical Yes/No", key: "critical", width: 15 },
    { header: "Estimated Hours", key: "estimatedHours", width: 15 },
    { header: "Spare Parts Required", key: "sparePartsRequired", width: 30 },
    { header: "Safety Procedure", key: "safetyProcedure", width: 25 },
    { header: "Checklist", key: "checklist", width: 40 },
    { header: "Reference Documents", key: "referenceDocuments", width: 30 },
    { header: "Tools Required", key: "toolsRequired", width: 30 },
    { header: "IS Active", key: "isActive", width: 12 },
    { header: "Maker Code", key: "makerCode", width: 15 },
    { header: "Class Survey Code", key: "classSurveyCode", width: 18 }
  ];
  fleetJobSheet.getRow(1).font = { bold: true };
  const vesselJobSheet = workbook.addWorksheet("Vessel_Job");
  vesselJobSheet.columns = [
    { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 20 },
    { header: "Component Code", key: "componentCode", width: 18 },
    { header: "Component Name", key: "componentName", width: 30 },
    { header: "Job Code", key: "jobCode", width: 15 },
    { header: "Job Title", key: "jobTitle", width: 40 },
    { header: "Job Description", key: "jobDescription", width: 50 },
    { header: "Department", key: "department", width: 15 },
    { header: "Responsible Rank", key: "responsibleRank", width: 20 },
    { header: "Schedule Type", key: "scheduleType", width: 15 },
    { header: "Calendar Interval", key: "calendarInterval", width: 18 },
    { header: "Interval Unit", key: "intervalUnit", width: 15 },
    { header: "RH Interval", key: "rhInterval", width: 15 },
    { header: "Last Done Date", key: "lastDoneDate", width: 15 },
    { header: "Last Done RH", key: "lastDoneRH", width: 15 },
    { header: "Critical Yes/No", key: "critical", width: 15 },
    { header: "Estimated Hours", key: "estimatedHours", width: 15 },
    { header: "Spare Parts Required", key: "sparePartsRequired", width: 30 },
    { header: "IS Active", key: "isActive", width: 12 },
    { header: "Vessel Code", key: "vesselCode", width: 12 },
    { header: "Maker Code", key: "makerCode", width: 15 },
    { header: "Class Survey Code", key: "classSurveyCode", width: 18 }
  ];
  vesselJobSheet.getRow(1).font = { bold: true };
  const fleetSpareSheet = workbook.addWorksheet("Fleet_Spare");
  fleetSpareSheet.columns = [
    { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 20 },
    { header: "Fleet Equipment Name", key: "fleetEquipmentName", width: 30 },
    { header: "Part Code", key: "partCode", width: 18 },
    { header: "Part Name", key: "partName", width: 35 },
    { header: "Part Number", key: "partNumber", width: 20 },
    { header: "Maker", key: "maker", width: 25 },
    { header: "Maker Code", key: "makerCode", width: 15 },
    { header: "Unit Of Measurement", key: "uom", width: 20 },
    { header: "Stocking Number", key: "stockingNumber", width: 18 },
    { header: "Specification", key: "specification", width: 40 },
    { header: "Drawing No", key: "drawingNo", width: 18 },
    { header: "Min Stock", key: "minStock", width: 12 },
    { header: "Max Stock", key: "maxStock", width: 12 },
    { header: "Unit Cost", key: "unitCost", width: 12 },
    { header: "Lead Time Days", key: "leadTimeDays", width: 15 },
    { header: "Supplier", key: "supplier", width: 30 },
    { header: "Critical Yes/No", key: "critical", width: 15 },
    { header: "IS Active", key: "isActive", width: 12 },
    { header: "Remarks", key: "remarks", width: 40 }
  ];
  fleetSpareSheet.getRow(1).font = { bold: true };
  const vesselSpareSheet = workbook.addWorksheet("Vessel_Spare");
  vesselSpareSheet.columns = getSparesExcelColumns();
  vesselSpareSheet.getRow(1).font = { bold: true };
  const vesselStoresSheet = workbook.addWorksheet("Vessel_Store");
  vesselStoresSheet.columns = [
    { header: "Item Code", key: "itemCode", width: 15 },
    { header: "IMPA Code", key: "impaCode", width: 15 },
    { header: "Item Name", key: "itemName", width: 35 },
    { header: "UOM", key: "uom", width: 12 },
    { header: "Category", key: "category", width: 20 },
    { header: "Total ROB", key: "totalRob", width: 12 },
    { header: "Location A", key: "locationA", width: 15 },
    { header: "Location A - ROB", key: "locationARob", width: 16 },
    { header: "Location B", key: "locationB", width: 15 },
    { header: "Location B - ROB", key: "locationBRob", width: 16 },
    { header: "Min", key: "min", width: 10 }
  ];
  vesselStoresSheet.getRow(1).font = { bold: true };
  const masterDataSheet = workbook.addWorksheet("Master Data");
  masterDataSheet.columns = [
    { header: "Departments", key: "departments", width: 18 },
    { header: "Responsible Ranks", key: "ranks", width: 20 },
    { header: "Schedule Types", key: "scheduleTypes", width: 18 },
    { header: "Interval Units", key: "intervalUnits", width: 15 },
    { header: "UOM", key: "uom", width: 12 },
    { header: "Store Types", key: "storeTypes", width: 15 },
    { header: "Yes/No", key: "yesNo", width: 10 },
    { header: "Categories", key: "categories", width: 40 }
  ];
  const maxRows = Math.max(
    DEPARTMENTS.length,
    RESPONSIBLE_RANKS.length,
    SCHEDULE_TYPES.length,
    INTERVAL_UNITS.length,
    UOM_LIST.length,
    4,
    // Store types
    2,
    // Yes/No
    COMPONENT_CATEGORIES.length
  );
  for (let i = 0; i < maxRows; i++) {
    masterDataSheet.addRow({
      departments: DEPARTMENTS[i] || "",
      ranks: RESPONSIBLE_RANKS[i] || "",
      scheduleTypes: SCHEDULE_TYPES[i] || "",
      intervalUnits: INTERVAL_UNITS[i] || "",
      uom: UOM_LIST[i]?.toUpperCase() || "",
      storeTypes: ["Stores", "Lubes", "Chemicals", "Others"][i] || "",
      yesNo: ["Yes", "No"][i] || "",
      categories: COMPONENT_CATEGORIES[i] || ""
    });
  }
  masterDataSheet.getRow(1).font = { bold: true };
  for (let row = 2; row <= 1e3; row++) {
    fleetComponentSheet.getCell(row, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    fleetComponentSheet.getCell(row, 6).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    fleetComponentSheet.getCell(row, 9).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    fleetComponentSheet.getCell(row, 11).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    fleetComponentSheet.getCell(row, 12).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  for (let row = 2; row <= 1e3; row++) {
    vesselComponentSheet.getCell(row, 14).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    vesselComponentSheet.getCell(row, 15).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    vesselComponentSheet.getCell(row, 19).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    vesselComponentSheet.getCell(row, 22).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  for (let row = 2; row <= 1e3; row++) {
    fleetJobSheet.getCell(row, 6).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    fleetJobSheet.getCell(row, 7).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$B$2:$B$12"]
    };
    fleetJobSheet.getCell(row, 8).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$C$2:$C$4"]
    };
    fleetJobSheet.getCell(row, 10).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$D$2:$D$5"]
    };
    fleetJobSheet.getCell(row, 12).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    fleetJobSheet.getCell(row, 19).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  for (let row = 2; row <= 1e3; row++) {
    vesselJobSheet.getCell(row, 7).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    vesselJobSheet.getCell(row, 8).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$B$2:$B$12"]
    };
    vesselJobSheet.getCell(row, 9).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$C$2:$C$4"]
    };
    vesselJobSheet.getCell(row, 11).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$D$2:$D$5"]
    };
    vesselJobSheet.getCell(row, 15).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    vesselJobSheet.getCell(row, 18).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  for (let row = 2; row <= 1e3; row++) {
    fleetSpareSheet.getCell(row, 8).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$E$2:$E$11"]
    };
    fleetSpareSheet.getCell(row, 17).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    fleetSpareSheet.getCell(row, 18).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  for (let row = 2; row <= 1e3; row++) {
    vesselSpareSheet.getCell(row, 10).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$E$2:$E$11"]
    };
    vesselSpareSheet.getCell(row, 24).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    vesselSpareSheet.getCell(row, 25).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  for (let row = 2; row <= 1e3; row++) {
    vesselStoresSheet.getCell(row, 4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$F$2:$F$5"]
    };
    vesselStoresSheet.getCell(row, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$H$2:$H$6"]
    };
    vesselStoresSheet.getCell(row, 6).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'Master Data'!$E$2:$E$11"]
    };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function generateWorkOrdersTemplate(vesselId) {
  const workbook = new ExcelJS.Workbook();
  const allComponents = await storage.getComponents(vesselId);
  console.log(`\u{1F4CB} Fetched ${allComponents.length} components for vessel ${vesselId}`);
  const validComponents = allComponents.filter((c) => c.componentCode && c.componentCode.trim() !== "");
  console.log(`\u2705 ${validComponents.length} components have valid codes`);
  const allCodes = validComponents.map((c) => c.componentCode);
  const parentCodes = /* @__PURE__ */ new Set();
  allCodes.forEach((code1) => {
    const cleanCode1 = stripSFISuffix(code1);
    allCodes.forEach((code2) => {
      if (code1 === code2) return;
      const cleanCode2 = stripSFISuffix(code2);
      if (cleanCode2.startsWith(cleanCode1 + ".")) {
        parentCodes.add(code1);
        return;
      }
      if (cleanCode2.startsWith(cleanCode1) && cleanCode2.length > cleanCode1.length && !cleanCode1.includes(".")) {
        parentCodes.add(code1);
        return;
      }
    });
  });
  const leafComponents = validComponents.filter((c) => !parentCodes.has(c.componentCode));
  console.log(`\u{1F33F} Filtered to ${leafComponents.length} leaf node components (actual equipment)`);
  console.log(`\u{1F6AB} Excluded ${validComponents.length - leafComponents.length} parent components from template`);
  if (parentCodes.size > 0) {
    console.log(`   Parent codes excluded: ${Array.from(parentCodes).sort().join(", ")}`);
  }
  const woSheet = workbook.addWorksheet("wo");
  woSheet.columns = [
    { header: "Generated_Component_Code", key: "componentCode", width: 25 },
    { header: "Component_Name", key: "componentName", width: 30 },
    { header: "Job_Code", key: "jobCode", width: 15 },
    { header: "Job_Title", key: "jobTitle", width: 35 },
    { header: "Job_Description", key: "jobDescription", width: 50 },
    { header: "Department", key: "department", width: 15 },
    { header: "Responsible_Rank", key: "responsibleRank", width: 20 },
    { header: "Schedule_Type", key: "scheduleType", width: 18 },
    { header: "Interval", key: "interval", width: 12 },
    { header: "Interval_Unit", key: "intervalUnit", width: 15 },
    { header: "Criticality", key: "criticality", width: 12 },
    { header: "Estimated_Hours", key: "estimatedHours", width: 18 },
    { header: "Spares_Required", key: "sparesRequired", width: 35 },
    { header: "Safety_Permit_Required", key: "safetyPermit", width: 30 }
  ];
  leafComponents.forEach((component) => {
    woSheet.addRow({
      componentCode: component.componentCode,
      componentName: component.name,
      jobCode: "",
      jobTitle: "",
      jobDescription: "",
      department: "",
      responsibleRank: "",
      scheduleType: "",
      interval: "",
      intervalUnit: "",
      criticality: "",
      estimatedHours: "",
      sparesRequired: "",
      safetyPermit: ""
    });
  });
  console.log(`\u{1F4DD} Pre-populated ${leafComponents.length} leaf node components in template`);
  const listsSheet = workbook.addWorksheet("Lists");
  listsSheet.columns = [
    { header: "Schedule_Type", key: "scheduleType", width: 18 },
    { header: "Interval_Unit", key: "intervalUnit", width: 15 },
    { header: "Department", key: "department", width: 15 },
    { header: "Responsible_Rank", key: "responsibleRank", width: 20 },
    { header: "Safety_Permit", key: "safetyPermit", width: 25 },
    { header: "Criticality", key: "criticality", width: 12 }
  ];
  const listValues = [
    { scheduleType: "Running Hours", intervalUnit: "Hours", department: "Engine", responsibleRank: "Chief Engineer", safetyPermit: "Hot Work", criticality: "yes" },
    { scheduleType: "Calendar", intervalUnit: "Days", department: "Deck", responsibleRank: "2nd Engineer", safetyPermit: "Enclosed Space Entry", criticality: "no" },
    { scheduleType: "", intervalUnit: "Weeks", department: "Electrical", responsibleRank: "3rd Engineer", safetyPermit: "Lockout-Tagout", criticality: "" },
    { scheduleType: "", intervalUnit: "Months", department: "", responsibleRank: "4th Engineer", safetyPermit: "Working Aloft", criticality: "" },
    { scheduleType: "", intervalUnit: "Years", department: "", responsibleRank: "Chief Officer", safetyPermit: "", criticality: "" },
    { scheduleType: "", intervalUnit: "", department: "", responsibleRank: "Electrician", safetyPermit: "", criticality: "" }
  ];
  listValues.forEach((row) => listsSheet.addRow(row));
  woSheet.getColumn(6).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$C$2:$C$4"]
      };
    }
  });
  woSheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$D$2:$D$7"]
      };
    }
  });
  woSheet.getColumn(8).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$A$2:$A$3"]
      };
    }
  });
  woSheet.getColumn(10).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$B$2:$B$6"]
      };
    }
  });
  woSheet.getColumn(11).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$F$2:$F$3"]
      };
    }
  });
  woSheet.getColumn(14).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$E$2:$E$5"]
      };
    }
  });
  addVersionInfoToSheet(woSheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function generateJobsTemplate(vesselId) {
  const workbook = new ExcelJS.Workbook();
  const allComponents = await storage.getComponents(vesselId);
  console.log(`\u{1F4CB} Fetched ${allComponents.length} components for vessel ${vesselId}`);
  const validComponents = allComponents.filter((c) => c.componentCode && c.componentCode.trim() !== "");
  console.log(`\u2705 ${validComponents.length} components have valid codes`);
  const sortedComponents = [...validComponents].sort((a, b) => {
    const codeA = a.componentCode || "";
    const codeB = b.componentCode || "";
    return codeA.localeCompare(codeB, void 0, { numeric: true });
  });
  console.log(`\u{1F4CA} Including all ${sortedComponents.length} components (all levels) in jobs template`);
  const jobsSheet = workbook.addWorksheet("Vessel_Job");
  jobsSheet.columns = [
    { header: "Job Code", key: "jobCode", width: 18 },
    { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 22 },
    { header: "Fleet Equipment Name", key: "fleetEquipmentName", width: 30 },
    { header: "WO Title", key: "woTitle", width: 35 },
    { header: "Component Code", key: "componentCode", width: 20 },
    { header: "Component Name", key: "componentName", width: 30 },
    { header: "Maintenance Basis", key: "maintenanceBasis", width: 18 },
    { header: "Interval Value", key: "intervalValue", width: 15 },
    { header: "Unit", key: "unit", width: 12 },
    { header: "Task Type", key: "taskType", width: 20 },
    { header: "Assigned To", key: "assignedTo", width: 20 },
    { header: "Approver", key: "approver", width: 20 },
    { header: "Job Priority", key: "jobPriority", width: 15 },
    { header: "Class Related", key: "classRelated", width: 15 },
    { header: "Last Done Date", key: "lastDoneDate", width: 15 },
    { header: "Brief Work Description", key: "briefWorkDescription", width: 50 },
    { header: "Department", key: "department", width: 20 },
    { header: "Criticality", key: "criticality", width: 15 },
    { header: "Is Active", key: "isActive", width: 12 },
    { header: "Vessel Code", key: "vesselCode", width: 15 },
    // Part A fields - Work Order Form fields (semicolon-separated lists)
    { header: "Required Spare Parts", key: "requiredSpareParts", width: 40 },
    { header: "Required Tools", key: "requiredTools", width: 40 },
    { header: "PPE Requirements", key: "ppeRequirements", width: 35 },
    { header: "Permit Requirements", key: "permitRequirements", width: 35 },
    { header: "Other Safety Requirements", key: "otherSafetyRequirements", width: 35 }
  ];
  sortedComponents.forEach((component) => {
    jobsSheet.addRow({
      jobCode: "",
      fleetEquipmentCode: component.fleetEquipmentCode || "",
      fleetEquipmentName: "",
      woTitle: "",
      componentCode: component.componentCode,
      componentName: component.name,
      maintenanceBasis: "",
      intervalValue: "",
      unit: "",
      taskType: "",
      assignedTo: "",
      approver: "",
      jobPriority: "",
      classRelated: "",
      lastDoneDate: "",
      briefWorkDescription: "",
      department: "",
      criticality: "",
      isActive: "Yes",
      vesselCode: vesselId,
      // Part A fields - empty by default, users fill with semicolon-separated lists
      requiredSpareParts: "",
      requiredTools: "",
      ppeRequirements: "",
      permitRequirements: "",
      otherSafetyRequirements: ""
    });
  });
  console.log(`\u{1F4DD} Pre-populated ${sortedComponents.length} components (all levels) in jobs template`);
  const listsSheet = workbook.addWorksheet("Lists");
  listsSheet.columns = [
    { header: "Maintenance_Basis", key: "maintenanceBasis", width: 18 },
    { header: "Interval_Unit", key: "intervalUnit", width: 15 },
    { header: "Task_Type", key: "taskType", width: 20 },
    { header: "Job_Priority", key: "jobPriority", width: 12 },
    { header: "Department", key: "department", width: 20 },
    { header: "Yes_No", key: "yesNo", width: 10 }
  ];
  const listValues = [
    { maintenanceBasis: "Calendar", intervalUnit: "Days", taskType: "Inspection", jobPriority: "Low", department: "Engine", yesNo: "Yes" },
    { maintenanceBasis: "Running Hours", intervalUnit: "Weeks", taskType: "Overhaul", jobPriority: "Medium", department: "Deck", yesNo: "No" },
    { maintenanceBasis: "", intervalUnit: "Months", taskType: "Service", jobPriority: "High", department: "Electrical", yesNo: "" },
    { maintenanceBasis: "", intervalUnit: "Years", taskType: "Testing", jobPriority: "Critical", department: "C/E", yesNo: "" },
    { maintenanceBasis: "", intervalUnit: "Hours", taskType: "Repair", jobPriority: "", department: "2/E", yesNo: "" },
    { maintenanceBasis: "", intervalUnit: "", taskType: "Replacement", jobPriority: "", department: "3/E", yesNo: "" },
    { maintenanceBasis: "", intervalUnit: "", taskType: "Cleaning", jobPriority: "", department: "4/E", yesNo: "" },
    { maintenanceBasis: "", intervalUnit: "", taskType: "Calibration", jobPriority: "", department: "ETO", yesNo: "" }
  ];
  listValues.forEach((row) => listsSheet.addRow(row));
  jobsSheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$A$2:$A$3"]
        // Only Calendar and Running Hours
      };
    }
  });
  jobsSheet.getColumn(9).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$B$2:$B$6"]
      };
    }
  });
  jobsSheet.getColumn(10).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$C$2:$C$9"]
      };
    }
  });
  jobsSheet.getColumn(13).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$D$2:$D$5"]
      };
    }
  });
  jobsSheet.getColumn(14).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$F$2:$F$3"]
      };
    }
  });
  jobsSheet.getColumn(17).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$E$2:$E$9"]
      };
    }
  });
  jobsSheet.getColumn(18).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$F$2:$F$3"]
      };
    }
  });
  jobsSheet.getColumn(19).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Lists!$F$2:$F$3"]
      };
    }
  });
  addVersionInfoToSheet(jobsSheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
async function generateSparesTemplate(vesselId) {
  const workbook = new ExcelJS.Workbook();
  const allComponents = await storage.getComponents(vesselId);
  console.log(`\u{1F4CB} Fetched ${allComponents.length} components for vessel ${vesselId}`);
  const validComponents = allComponents.filter((c) => c.componentCode && c.componentCode.trim() !== "" && c.name && c.name.trim() !== "");
  console.log(`\u2705 ${validComponents.length} components have valid codes and names`);
  const sparesSheet = workbook.addWorksheet("Spares");
  sparesSheet.columns = getSparesExcelColumns();
  sparesSheet.getRow(1).font = { bold: true };
  validComponents.forEach((component, index2) => {
    sparesSheet.addRow({
      partCode: "",
      // User fills this
      fleetEquipmentCode: component.fleetEquipmentCode || "",
      fleetEquipmentName: component.fleetEquipmentName || "",
      componentCode: component.componentCode,
      componentName: component.name,
      partName: "",
      // User fills this
      partNumber: "",
      // User fills this
      uom: "",
      // User selects from dropdown
      drawingNumber: "",
      positionNumber: "",
      note: "",
      specification: "",
      maker: component.maker || "",
      makerCode: component.makerCode || "",
      manualName: "",
      pageNumber: "",
      criticality: "",
      // User selects from dropdown
      totalRob: "",
      locationA: "",
      locationARob: "",
      locationB: "",
      locationBRob: "",
      minimumStock: "",
      isActive: "Yes",
      // Default to Yes
      ihm: "No",
      // Default to No
      evidenceType: "",
      vesselCode: vesselId
    });
  });
  console.log(`\u{1F4DD} Pre-filled ${validComponents.length} component rows in spares template`);
  const componentsSheet = workbook.addWorksheet("Components");
  componentsSheet.columns = [
    { header: "Component Code", key: "componentCode", width: 20 },
    { header: "Component Name", key: "componentName", width: 40 },
    { header: "Category", key: "category", width: 35 },
    { header: "Fleet Equipment Code", key: "fleetEquipmentCode", width: 20 },
    { header: "Fleet Equipment Name", key: "fleetEquipmentName", width: 30 }
  ];
  componentsSheet.getRow(1).font = { bold: true };
  validComponents.forEach((component) => {
    componentsSheet.addRow({
      componentCode: component.componentCode,
      componentName: component.name,
      category: component.category || "",
      fleetEquipmentCode: component.fleetEquipmentCode || "",
      fleetEquipmentName: component.fleetEquipmentName || ""
    });
  });
  console.log(`\u{1F4CB} Added ${validComponents.length} components to reference sheet`);
  const listsSheet = workbook.addWorksheet("Lists");
  listsSheet.columns = [
    { header: "UOM", key: "uom", width: 15 },
    { header: "Yes/No", key: "yesNo", width: 15 }
  ];
  UOM_LIST.forEach((uom, index2) => {
    listsSheet.getCell(index2 + 2, 1).value = uom.toUpperCase();
  });
  listsSheet.getCell("B2").value = "Yes";
  listsSheet.getCell("B3").value = "No";
  listsSheet.getRow(1).font = { bold: true };
  for (let row = 2; row <= 1e3; row++) {
    sparesSheet.getCell(row, 8).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=Lists!$A$2:$A$11"]
    };
    sparesSheet.getCell(row, 17).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=Lists!$B$2:$B$3"]
    };
    sparesSheet.getCell(row, 24).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=Lists!$B$2:$B$3"]
    };
    sparesSheet.getCell(row, 25).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=Lists!$B$2:$B$3"]
    };
  }
  addVersionInfoToSheet(sparesSheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
router.get("/template", async (req, res) => {
  const { type, vesselId } = req.query;
  if (type === "fleet-master-data") {
    try {
      console.log("\u{1F4CB} Generating Fleet Master Data template (multi-sheet)...");
      const buffer2 = await generateFleetMasterTemplate();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=Fleet_Master_Data_Template.xlsx");
      console.log("\u2705 Fleet Master Data template generated successfully");
      return res.send(buffer2);
    } catch (error) {
      console.error("\u274C Error generating fleet master data template:", error);
      return res.status(500).json({ error: "Failed to generate template" });
    }
  }
  if (!["components", "spares", "stores", "work-orders", "jobs"].includes(type)) {
    return res.status(400).json({ error: "Invalid template type. Valid types: components, spares, stores, work-orders, jobs, fleet-master-data" });
  }
  const defaultVesselId = vesselId || "V001";
  const workbook = XLSX.utils.book_new();
  let headers = [];
  let validValues = [];
  let example = [];
  switch (type) {
    case "components":
      headers = [
        // Vessel Component Sheet - 28 columns (exact order per user specification)
        "Fleet Equipment Code",
        "Fleet Equipment Name",
        "Parent Component Code",
        "Component Code",
        "Component Name",
        "Component Category",
        "Maker",
        "Maker Code",
        "Model",
        "Model Code",
        "Serial No",
        "Drawing No",
        "Location",
        "Criticality",
        "Condition Based",
        "Installation Date",
        "Commissioned Date",
        "Rating",
        "Equipment / System Department",
        "Class item",
        "IS Active",
        "Vessel Code",
        "IS Parent",
        "Notes",
        "RH Counter Type",
        "RH Counter Source",
        "Running Hours",
        "Last Updated"
      ];
      validValues = [
        "Text (XXX.XXX.XX format)",
        "Text (Equipment description)",
        "Text (Parent SFI code)",
        "Required (SFI Format XXX.XXX)",
        "Required (Equipment name)",
        "Text (SFI category name)",
        "Text (Manufacturer name)",
        "Text (Maker ID from Maker List)",
        "Text (Model name)",
        "Text (Model code)",
        "Text (Serial number)",
        "Text (Drawing reference)",
        "Text (Physical location)",
        "Yes/No",
        "Yes/No",
        "DD-MMM-YYYY",
        "DD-MMM-YYYY",
        "Text (Capacity/specification)",
        "Engine/Deck/Electrical",
        "Yes/No",
        "Yes/No",
        "Text (e.g., V001)",
        "Yes/No",
        "Text (Additional notes)",
        "MASTER/INHERITED/NOT_RH_DRIVEN",
        "Text (RH source)",
        "Number >= 0",
        "Text (Timestamp)"
      ];
      example = [];
      break;
    case "spares":
      headers = [
        // Vessel_Spare - 27 columns (per specification)
        "Part Code",
        "Fleet Equipment Code",
        "Fleet Equipment Name",
        "Component Code",
        "Component Name",
        "Part Name",
        "Part Number",
        "UOM",
        "Drawing Number",
        "Position Number",
        "Note",
        "Specification",
        "Maker",
        "Maker Code",
        "Manual Name",
        "Page Number",
        "Criticality",
        "Total ROB",
        "Location A",
        "Location A - ROB",
        "Location B",
        "Location B - ROB",
        "Minimum Stock",
        "Is Active",
        "IHM (Inventory of Hazardous Materials)",
        "Evidence Type",
        "Vessel Code"
      ];
      validValues = [
        "Text (Part ID)",
        "Text (Fleet ID)",
        "Text (Fleet description)",
        "Required (Must exist)",
        "Text (Component name)",
        "Required (Part name)",
        "Text (P/N)",
        UOM_LIST.join("/").toUpperCase(),
        "Text (Drawing ref)",
        "Text (Position)",
        "Text (Notes)",
        "Text (Specs)",
        "Text (Manufacturer)",
        "Text (Maker ID)",
        "Text (Manual name)",
        "Text (Page #)",
        "Yes/No",
        "Number >= 0",
        "Text (Location A)",
        "Number >= 0",
        "Text (Location B)",
        "Number >= 0",
        "Number >= 0",
        "Yes/No",
        "Yes/No",
        "Text (Evidence type)",
        "Text (e.g., V001)"
      ];
      example = [];
      break;
    case "stores":
      headers = [
        // Vessel_Store - 11 columns (per user specification)
        "Item Code",
        "IMPA Code",
        "Item Name",
        "UOM",
        "Category",
        "Total ROB",
        "Location A",
        "Location A - ROB",
        "Location B",
        "Location B - ROB",
        "Min"
      ];
      validValues = [
        "Required (Unique per vessel)",
        "Text (IMPA standard code)",
        "Required (Item description)",
        UOM_LIST.join("/").toUpperCase(),
        STORES_CATEGORIES.join("/"),
        "Number >= 0",
        "Text (Location A)",
        "Number >= 0",
        "Text (Location B)",
        "Number >= 0",
        "Number >= 0"
      ];
      example = [];
      break;
    case "work-orders":
      headers = [
        // Work Orders / Jobs template
        "Component Code",
        "Component Name",
        "Job Code",
        "Job Title",
        "Job Description",
        "Department",
        "Responsible Rank",
        "Schedule Type",
        "Calendar Interval",
        "Interval Unit",
        "RH Interval",
        "Critical Yes/No",
        "Estimated Hours",
        "Spare Parts Required",
        "Safety Procedure"
      ];
      validValues = [
        "Required (SFI Format)",
        "Text (Component name)",
        "Required (Job ID)",
        "Required (Job title)",
        "Text (Task description)",
        "Engine/Deck/Electrical",
        RESPONSIBLE_RANKS.join("/"),
        "Running Hours/Calendar/Both",
        "Number (for Calendar)",
        "Days/Weeks/Months/Years",
        "Number (for RH)",
        "Yes/No",
        "Number (hours)",
        "Text (Parts list)",
        "Hot Work/Enclosed Space Entry/Lockout-Tagout/Working Aloft"
      ];
      example = [];
      break;
  }
  const mainSheet = XLSX.utils.aoa_to_sheet([headers]);
  if (type === "components") {
    if (!mainSheet["!dataValidation"]) {
      mainSheet["!dataValidation"] = [];
    }
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "N2:N1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "O2:O1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "T2:T1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "U2:U1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "W2:W1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "Y2:Y1000",
      formulas: ['"MASTER,INHERITED,NOT_RH_DRIVEN"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select MASTER, INHERITED, or NOT_RH_DRIVEN"
    });
  }
  if (type === "spares") {
    if (!mainSheet["!dataValidation"]) {
      mainSheet["!dataValidation"] = [];
    }
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "H2:H1000",
      formulas: [`"${UOM_LIST.join(",")}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid UOM",
      error: `Please select from: ${UOM_LIST.join(", ")}`
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "Q2:Q1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "X2:X1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "Y2:Y1000",
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Please select Yes or No"
    });
  }
  if (type === "stores") {
    if (!mainSheet["!dataValidation"]) {
      mainSheet["!dataValidation"] = [];
    }
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "D2:D1000",
      formulas: [`"${UOM_LIST.join(",")}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid UOM",
      error: `Please select from: ${UOM_LIST.join(", ")}`
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "E2:E1000",
      formulas: [`"${STORES_CATEGORIES.join(",")}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Category",
      error: `Please select from: ${STORES_CATEGORIES.join(", ")}`
    });
  }
  if (type === "work-orders") {
    if (!mainSheet["!dataValidation"]) {
      mainSheet["!dataValidation"] = [];
    }
    const allComponents = await storage.getComponents(defaultVesselId);
    console.log(`\u{1F4CB} Fetched ${allComponents.length} components for vessel ${defaultVesselId}`);
    const validComponents = allComponents.filter((c) => c.componentCode && c.componentCode.trim() !== "");
    console.log(`\u2705 ${validComponents.length} components have valid codes`);
    const listsData = [
      ["Schedule_Type", "Interval_Unit", "Department", "Responsible_Rank", "Safety_Permit", "Criticality"],
      ["Running Hours", "Hours", "Engine", "Chief Engineer", "Hot Work", "yes"],
      ["Calendar", "Days", "Deck", "2nd Engineer", "Enclosed Space Entry", "no"],
      ["", "Weeks", "Electrical", "3rd Engineer", "Lockout-Tagout", ""],
      ["", "Months", "", "4th Engineer", "Working Aloft", ""],
      ["", "Years", "", "Chief Officer", "", ""],
      ["", "", "", "Electrician", "", ""]
    ];
    const listsSheet = XLSX.utils.aoa_to_sheet(listsData);
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "F2:F1000",
      formulas: ["=Lists!$C$2:$C$4"],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Department",
      error: "Please select from the dropdown"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "G2:G1000",
      formulas: ["=Lists!$D$2:$D$7"],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Rank",
      error: "Please select from the dropdown"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "H2:H1000",
      formulas: ["=Lists!$A$2:$A$3"],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Schedule Type",
      error: "Please select from the dropdown"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "J2:J1000",
      formulas: ["=Lists!$B$2:$B$6"],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Interval Unit",
      error: "Please select from the dropdown"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "K2:K1000",
      formulas: ["=Lists!$F$2:$F$3"],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Criticality",
      error: "Please select from the dropdown"
    });
    mainSheet["!dataValidation"].push({
      type: "list",
      operator: "equal",
      sqref: "N2:N1000",
      formulas: ["=Lists!$E$2:$E$5"],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid Safety Permit",
      error: "Please select from the dropdown"
    });
    XLSX.utils.book_append_sheet(workbook, mainSheet, "wo");
    XLSX.utils.book_append_sheet(workbook, listsSheet, "Lists");
  } else if (type === "stores") {
    XLSX.utils.book_append_sheet(workbook, mainSheet, "Vessel_Store");
  } else {
    XLSX.utils.book_append_sheet(workbook, mainSheet, "Data");
  }
  if (type === "work-orders") {
    try {
      const buffer2 = await generateWorkOrdersTemplate(defaultVesselId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${type}_template.xlsx"`);
      res.send(buffer2);
      return;
    } catch (error) {
      console.error("Error generating work-orders template:", error);
      return res.status(500).json({ error: "Failed to generate template" });
    }
  }
  if (type === "jobs") {
    try {
      const buffer2 = await generateJobsTemplate(defaultVesselId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${type}_template.xlsx"`);
      res.send(buffer2);
      return;
    } catch (error) {
      console.error("Error generating jobs template:", error);
      return res.status(500).json({ error: "Failed to generate template" });
    }
  }
  if (type === "spares") {
    try {
      const buffer2 = await generateSparesTemplate(defaultVesselId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${type}_template.xlsx"`);
      res.send(buffer2);
      return;
    } catch (error) {
      console.error("Error generating spares template:", error);
      return res.status(500).json({ error: "Failed to generate template" });
    }
  }
  const metaData = [
    ["Template Type", type],
    ["Template Version", "3.0"],
    ["Generated At", (/* @__PURE__ */ new Date()).toISOString()],
    [""],
    ["INSTRUCTIONS:"],
    ["1. Row 1 contains the column headers"],
    ["2. Row 2 contains example data (you can delete or replace it)"],
    ["3. Add your data starting from Row 2 or Row 3 onwards"],
    ["4. Use the dropdown menus in cells for category and Yes/No fields"],
    ["5. Save and upload this file when complete"],
    [""],
    ["FIELD REQUIREMENTS:"],
    ...validValues.map((val, idx) => [headers[idx], val]),
    [""],
    ["VALID VALUES:"],
    ["Component Categories", ...COMPONENT_CATEGORIES],
    ["UOM Options", ...UOM_LIST],
    ["Stores Categories", ...STORES_CATEGORIES],
    ["Type Options", "Stores, Lubes, Chemicals, Others"]
  ];
  const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(workbook, metaSheet, "Meta");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${type}_template.xlsx"`);
  res.send(buffer);
});
router.post("/sheets", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const ext = path4.extname(file.originalname).toLowerCase();
    if (ext === ".csv") {
      return res.json({ sheets: ["Sheet1"] });
    } else if ([".xlsx", ".xls"].includes(ext)) {
      const workbook = XLSX.read(file.buffer);
      return res.json({ sheets: workbook.SheetNames });
    } else {
      return res.status(400).json({ error: "Unsupported file format" });
    }
  } catch (error) {
    console.error("Error reading sheets:", error);
    res.status(500).json({ error: "Failed to read file sheets" });
  }
});
function getTypeFromSheetName(sheetName) {
  const normalizedName = sheetName.toLowerCase().trim();
  if (normalizedName === "spares" || normalizedName.includes("spare")) return "spares";
  if (normalizedName === "components" || normalizedName.includes("component") || normalizedName.includes("machinery")) return "components";
  if (normalizedName === "jobs" || normalizedName.includes("job")) return "jobs";
  if (normalizedName === "stores" || normalizedName.includes("store")) return "stores";
  if (normalizedName === "work-orders" || normalizedName.includes("work order") || normalizedName.includes("workorder")) return "work-orders";
  return null;
}
router.post("/dry-run", upload.single("file"), async (req, res) => {
  try {
    const { type: requestedType, mode, archiveMissing, vesselId, sheetName } = req.body;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const sheetBasedType = sheetName ? getTypeFromSheetName(sheetName) : null;
    const type = sheetBasedType || requestedType;
    console.log(`\u{1F4CB} Type determination: requested='${requestedType}', sheetName='${sheetName}', sheetBasedType='${sheetBasedType}', effective='${type}'`);
    if (!["components", "spares", "stores", "work-orders", "jobs"].includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }
    if (!["add", "update", "upsert"].includes(mode)) {
      return res.status(400).json({ error: "Invalid mode" });
    }
    let data = [];
    const ext = path4.extname(file.originalname).toLowerCase();
    if (ext === ".csv") {
      const csvText = file.buffer.toString("utf-8");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      data = parsed.data;
    } else if ([".xlsx", ".xls"].includes(ext)) {
      const workbook = XLSX.read(file.buffer);
      const targetSheetName = sheetName || workbook.SheetNames[0];
      const targetSheet = workbook.Sheets[targetSheetName];
      if (!targetSheet) {
        return res.status(400).json({
          error: `Sheet "${targetSheetName}" not found. Available sheets: ${workbook.SheetNames.join(", ")}`
        });
      }
      const versionCheck = checkTemplateVersion(targetSheet);
      if (!versionCheck.valid) {
        return res.status(400).json({
          error: versionCheck.message || "Template version is outdated. Please download the latest template.",
          outdatedTemplate: true,
          uploadedVersion: versionCheck.version,
          currentVersion: TEMPLATE_VERSION
        });
      }
      data = extractRawExcelData(targetSheet);
    } else {
      return res.status(400).json({ error: "Unsupported file format" });
    }
    console.log(`\u{1F4CA} [${type}] Raw data parsed: ${data.length} rows`);
    if (data.length > 0) {
      console.log(`\u{1F4CB} Original columns: ${Object.keys(data[0]).join(", ")}`);
      console.log(`\u{1F4CB} First row sample: ${JSON.stringify(data[0])}`);
    } else {
      console.log(`\u26A0\uFE0F NO DATA ROWS FOUND in file!`);
      console.log(`\u{1F4CB} Sheet may be empty or header row might be missing data rows`);
    }
    data = normalizeColumnNames(data, type);
    if (data.length > 0) {
      console.log(`\u{1F4CB} Normalized columns: ${Object.keys(data[0]).join(", ")}`);
    }
    const results = await validateData(type, data, mode, vesselId);
    console.log(`\u2705 Validation complete: ${results.summary.ok} valid, ${results.summary.errors} errors, ${results.rows.length} total rows`);
    const fileToken = uuidv4();
    dryRunCache.set(fileToken, {
      type,
      mode,
      archiveMissing: archiveMissing === "true",
      vesselId,
      data,
      // raw data
      normalizedData: results.rows.filter((r) => r.status !== "error").map((r) => r.normalized),
      // normalized data without errors
      results,
      file: file.buffer,
      originalName: file.originalname,
      timestamp: Date.now()
    });
    const oneHourAgo = Date.now() - 36e5;
    Array.from(dryRunCache.entries()).forEach(([key, value]) => {
      if (value.timestamp < oneHourAgo) {
        dryRunCache.delete(key);
      }
    });
    res.json({
      fileToken,
      columns: results.columns,
      summary: results.summary,
      rows: results.rows,
      // Return all rows for proper pagination and filtering
      totalRows: results.rows.length,
      errorReportUrl: results.summary.errors > 0 ? `/api/bulk/history/tmp/${fileToken}/errors.csv` : void 0
    });
  } catch (error) {
    console.error("Dry-run error:", error);
    res.status(500).json({ error: "Failed to process file" });
  }
});
router.post("/import", async (req, res) => {
  const historyId = uuidv4();
  const startedAt = /* @__PURE__ */ new Date();
  try {
    const { fileToken, type, mode, archiveMissing, vesselId, rowIndices, storeType } = req.body;
    const cachedData = dryRunCache.get(fileToken);
    if (!cachedData) {
      return res.status(400).json({ error: "Invalid or expired file token" });
    }
    let dataToImport = cachedData.normalizedData || cachedData.data;
    if (rowIndices && Array.isArray(rowIndices)) {
      console.log(`\u{1F4CB} Partial import: filtering ${rowIndices.length} rows out of ${dataToImport.length} total`);
      dataToImport = dataToImport.filter((_, index2) => {
        return rowIndices.includes(index2 + 1);
      });
      console.log(`\u2705 Filtered data: ${dataToImport.length} rows ready for import`);
    } else {
      if (cachedData.results.summary.errors > 0) {
        return res.status(400).json({ error: "Cannot import file with errors. Use rowIndices parameter to import only valid rows." });
      }
    }
    const effectiveType = cachedData.type || type;
    console.log(`\u{1F4E6} [BULK_IMPORT] Starting import:`);
    console.log(`   RequestType: ${type}`);
    console.log(`   EffectiveType: ${effectiveType}`);
    console.log(`   Mode: ${mode}`);
    console.log(`   VesselId: ${vesselId}`);
    console.log(`   Rows: ${dataToImport.length}`);
    await storeImportHistory({
      id: historyId,
      type: effectiveType,
      mode,
      archiveMissing: archiveMissing || false,
      userId: req.user?.id || "system",
      vesselId,
      originalName: cachedData.originalName,
      fileSize: cachedData.file.length,
      created: 0,
      updated: 0,
      skipped: 0,
      archived: 0,
      startedAt,
      finishedAt: null,
      status: "in_progress"
    });
    const importResult = await performImport(
      effectiveType,
      dataToImport,
      mode,
      archiveMissing,
      vesselId,
      req.user?.id || "system",
      void 0,
      // Disable database change tracking - using file-based storage only
      storeType
      // Pass store type for stores import (determines which tab: Stores, Lubes, Chemicals, Others)
    );
    let storedFilePath = null;
    try {
      const { Client } = await import("@replit/object-storage");
      const client = new Client();
      const timestamp2 = Date.now();
      const safeFileName = cachedData.originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const objectPath = `bulk-imports/${effectiveType}/${timestamp2}_${safeFileName}`;
      await client.uploadFromBytes(objectPath, cachedData.file);
      storedFilePath = `replit:${objectPath}`;
      console.log(`\u{1F4C1} File uploaded to Replit Object Storage: ${objectPath}`);
    } catch (uploadError) {
      console.warn("\u26A0\uFE0F Replit Object Storage failed, falling back to local storage:", uploadError.message);
      try {
        const uploadsDir = path4.join(process.cwd(), "uploads", "bulk-imports", effectiveType);
        await fsPromises2.mkdir(uploadsDir, { recursive: true });
        const timestamp2 = Date.now();
        const safeFileName = cachedData.originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const localFilePath = path4.join(uploadsDir, `${timestamp2}_${safeFileName}`);
        await fsPromises2.writeFile(localFilePath, cachedData.file);
        storedFilePath = `local:${localFilePath}`;
        console.log(`\u{1F4C1} File saved locally at: ${localFilePath}`);
      } catch (localError) {
        console.error("\u26A0\uFE0F Failed to store file locally:", localError);
      }
    }
    await updateImportHistory(historyId, {
      ...importResult,
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "complete",
      originalName: cachedData.originalName,
      storedFilePath
    });
    dryRunCache.delete(fileToken);
    res.json({
      ...importResult,
      historyId
    });
  } catch (error) {
    console.error("Import error:", error);
    try {
      await updateImportHistory(historyId, {
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "failed"
      });
    } catch (updateError) {
      console.error("Failed to update import history:", updateError);
    }
    res.status(500).json({
      error: "Failed to import data",
      message: error?.message || "Unknown error"
    });
  }
});
router.get("/history", async (req, res) => {
  try {
    const { type, limit = 20, offset = 0 } = req.query;
    const history = await getImportHistory(
      type,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(history);
  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});
router.get("/history/:id/download-original", async (req, res) => {
  try {
    const { id } = req.params;
    const history = await getImportHistoryById(id);
    if (!history) {
      return res.status(404).json({ error: "Import history not found" });
    }
    if (!history.storedFilePath) {
      return res.status(404).json({ error: "Original file not available for this import" });
    }
    const originalName = history.originalName || "import_file";
    res.setHeader("Content-Disposition", `attachment; filename="${originalName}"`);
    if (history.storedFilePath.startsWith("replit:")) {
      const objectPath = history.storedFilePath.slice(7);
      const { Client } = await import("@replit/object-storage");
      const client = new Client();
      try {
        const result = await client.downloadAsBytes(objectPath);
        if (!result.ok) {
          return res.status(404).json({ error: "File not found in storage" });
        }
        res.send(Buffer.from(result.value));
      } catch {
        return res.status(404).json({ error: "File not found in storage" });
      }
    } else if (history.storedFilePath.startsWith("local:")) {
      const localPath = history.storedFilePath.slice(6);
      try {
        await fsPromises2.access(localPath);
        const fileBuffer = await fsPromises2.readFile(localPath);
        res.send(fileBuffer);
      } catch {
        return res.status(404).json({ error: "File not found on server" });
      }
    } else {
      const objectStorage = new ObjectStorageService();
      await objectStorage.downloadByPath(history.storedFilePath, res);
    }
  } catch (error) {
    console.error("Original file download error:", error);
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    res.status(500).json({ error: "Failed to download file" });
  }
});
router.get("/history/:id/:fileType", async (req, res) => {
  try {
    const { id, fileType } = req.params;
    const file = await getHistoryFile(id, fileType);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.send(file.data);
  } catch (error) {
    console.error("File download error:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});
async function validateData(type, data, mode, vesselId) {
  const results = {
    columns: [],
    summary: { ok: 0, warnings: 0, errors: 0 },
    rows: []
  };
  if (data.length === 0) {
    results.summary.errors = 1;
    return results;
  }
  results.columns = Object.keys(data[0]);
  const filteredData = data.filter((row, index2) => {
    let primaryField;
    switch (type) {
      case "components":
        primaryField = "Component Code";
        break;
      case "jobs":
        primaryField = "Job Code";
        break;
      case "spares":
        primaryField = "Part Code";
        break;
      case "stores":
        primaryField = "Item Code";
        break;
      case "work-orders":
        primaryField = "Work Order Number";
        break;
      default:
        primaryField = "Component Code";
    }
    const fieldValue = row[primaryField];
    if (!fieldValue) {
      console.log(`[${type}] Row ${index2 + 2}: Skipping - no ${primaryField} value`);
      return false;
    }
    const valueStr = String(fieldValue).trim();
    if (!valueStr) {
      console.log(`[${type}] Row ${index2 + 2}: Skipping - empty ${primaryField} value`);
      return false;
    }
    if (type === "components") {
      const instructionKeywords = ["required", "unique", "text", "number", "yes/no", "dd-mm-yyyy", "maximum", "allowable"];
      const lowerCode = valueStr.toLowerCase();
      if (instructionKeywords.some((keyword) => lowerCode.includes(keyword))) {
        console.log(`Skipping instruction row ${index2 + 2}: ${valueStr}`);
        return false;
      }
    }
    return true;
  });
  console.log(`\u{1F4CB} Total rows in file: ${data.length}, Valid data rows after filtering: ${filteredData.length}`);
  const componentCodeOccurrences = /* @__PURE__ */ new Map();
  const existingDbComponentCodes = /* @__PURE__ */ new Set();
  if (type === "components") {
    if (vesselId) {
      try {
        const existingComponents = await storage.getComponents(vesselId);
        existingComponents.forEach((comp) => {
          if (comp.componentCode) {
            existingDbComponentCodes.add(comp.componentCode.toUpperCase());
          }
        });
        console.log(`\u{1F4CB} Loaded ${existingDbComponentCodes.size} existing component codes for vessel '${vesselId}'`);
      } catch (err) {
        console.error(`Failed to fetch existing components for vessel ${vesselId}:`, err);
      }
    }
    filteredData.forEach((row, index2) => {
      const componentCode = row["Component Code"];
      if (componentCode) {
        const code = String(componentCode).trim().toUpperCase();
        if (!componentCodeOccurrences.has(code)) {
          componentCodeOccurrences.set(code, []);
        }
        componentCodeOccurrences.get(code).push(index2 + 2);
      }
    });
  }
  for (let i = 0; i < filteredData.length; i++) {
    const row = filteredData[i];
    const rowNum = i + 2;
    const errors = [];
    const warnings = [];
    const normalized = {};
    const typesWithVesselCode = ["components", "jobs"];
    if (typesWithVesselCode.includes(type)) {
      if (vesselId && row["Vessel Code"]) {
        const rowVesselCode = String(row["Vessel Code"]).trim().toUpperCase();
        const selectedVessel = vesselId.trim().toUpperCase();
        if (rowVesselCode !== selectedVessel) {
          errors.push(`Row ${rowNum}: Vessel Code '${rowVesselCode}' does not match selected vessel '${vesselId}'. All rows must belong to the same vessel.`);
        }
      } else if (vesselId && !row["Vessel Code"]) {
        errors.push(`Row ${rowNum}: Vessel Code is required and must match selected vessel '${vesselId}'.`);
      }
    }
    if (type === "components") {
      const componentCode = row["Component Code"];
      if (!componentCode) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        const codeStr = String(componentCode).trim();
        if (!validateSFICode(codeStr)) {
          errors.push(`Row ${rowNum}: Invalid Component Code format. Expected SFI format: 6, 61, 612, 612.005, etc.`);
        } else {
          normalized["Component Code"] = codeStr;
          const codeUpperCase = codeStr.toUpperCase();
          const occurrences = componentCodeOccurrences.get(codeUpperCase);
          if (occurrences && occurrences.length > 1) {
            const firstOccurrence = occurrences[0];
            if (rowNum !== firstOccurrence) {
              errors.push(`Row ${rowNum}: Duplicate Component Code '${codeStr}' - this code already appears in row ${firstOccurrence}. Each Component Code must be unique within the vessel.`);
            }
          }
          if (mode === "add" && existingDbComponentCodes.has(codeUpperCase)) {
            errors.push(`Row ${rowNum}: Component Code '${codeStr}' already exists in vessel '${vesselId}'. Cannot add duplicate component.`);
          }
          const parentCode = getParentSFICode(codeStr);
          if (parentCode && !row["Parent Component Code"]) {
            normalized["Parent Component Code"] = parentCode;
          }
          const firstDigit = parseInt(codeStr.charAt(0));
          if (!isNaN(firstDigit) && firstDigit >= 1 && firstDigit <= 8) {
            const category = getComponentCategory(firstDigit);
            if (category && !row["Component Category"]) {
              normalized["Component Category"] = `${firstDigit} ${category}`;
            }
          }
        }
      }
      if (!row["Component Name"] || String(row["Component Name"]).trim() === "") {
        const sfiCode = normalized["Component Code"];
        if (sfiCode) {
          const firstDigit = parseInt(sfiCode.charAt(0));
          if (sfiCode.length === 1) {
            const category = getComponentCategory(firstDigit);
            normalized["Component Name"] = category ? category.replace(/^\d+\s+/, "") : `SFI ${sfiCode}`;
            warnings.push(`Row ${rowNum}: Component Name auto-generated from SFI code: "${normalized["Component Name"]}"`);
          } else if (sfiCode.length === 2) {
            normalized["Component Name"] = getSubGroupName(sfiCode);
            warnings.push(`Row ${rowNum}: Component Name auto-generated from SFI code: "${normalized["Component Name"]}"`);
          } else {
            errors.push(`Row ${rowNum}: Component Name is required for detailed component codes`);
          }
        } else {
          errors.push(`Row ${rowNum}: Component Name is required`);
        }
      } else {
        normalized["Component Name"] = String(row["Component Name"]).trim();
      }
      const yesNoFieldMappings = [
        { template: "Critical Yes/No", legacy: "Critical (Yes/No)" },
        { template: "Condition Based Yes/No", legacy: "Condition Based (Yes/No)" },
        { template: "IS Active", legacy: "IS Active" }
      ];
      yesNoFieldMappings.forEach(({ template, legacy }) => {
        const fieldValue = row[template] ?? row[legacy];
        if (fieldValue !== void 0 && fieldValue !== null && fieldValue !== "") {
          const value = String(fieldValue).toLowerCase().trim();
          if (!["yes", "no", "y", "n", "true", "false", "1", "0"].includes(value)) {
            errors.push(`Row ${rowNum}: ${template} must be Yes or No`);
          } else {
            const normalizedValue = ["yes", "y", "true", "1"].includes(value);
            normalized[template] = normalizedValue;
            normalized[legacy] = normalizedValue;
          }
        }
      });
      if (row["Running Hours"] !== void 0 && row["Running Hours"] !== null && row["Running Hours"] !== "") {
        const num = parseFloat(row["Running Hours"]);
        if (isNaN(num) || num < 0) {
          errors.push(`Row ${rowNum}: Running Hours must be a non-negative number`);
        } else {
          normalized["Running Hours"] = num;
        }
      }
      ["Installation Date", "Commissioned Date"].forEach((field) => {
        if (row[field]) {
          const dateStr = String(row[field]).trim();
          normalized[field] = dateStr;
        }
      });
      const textFields = [
        "Fleet Equipment Code",
        "Fleet Equipment Name",
        "Maker",
        "Maker Code",
        "Model",
        "Model Code",
        "Model Number",
        "Serial No",
        "Drawing No",
        "Location",
        "Rating",
        "Equipment / System Department",
        "Eqpt / System Department",
        "Notes",
        "Vessel Code",
        "IS Parent",
        "Class item",
        "Class Item",
        "Criticality",
        "RH Counter Type",
        "RH Counter Source",
        "Last Updated"
      ];
      textFields.forEach((field) => {
        if (row[field] !== void 0 && row[field] !== null && row[field] !== "") {
          normalized[field] = String(row[field]).trim();
        }
      });
      if (row["Parent Component Code"] && !normalized["Parent Component Code"]) {
        normalized["Parent Component Code"] = String(row["Parent Component Code"]).trim();
      }
      if (row["Component Category"] && !normalized["Component Category"]) {
        normalized["Component Category"] = String(row["Component Category"]).trim();
      }
    } else if (type === "spares") {
      if (vesselId && row["Vessel Code"]) {
        const rowVesselCode = String(row["Vessel Code"]).trim().toUpperCase();
        const selectedVessel = vesselId.trim().toUpperCase();
        if (rowVesselCode !== selectedVessel) {
          errors.push(`Row ${rowNum}: Vessel Code '${rowVesselCode}' does not match selected vessel '${vesselId}'. All rows must belong to the same vessel.`);
        } else {
          normalized["Vessel Code"] = rowVesselCode;
        }
      } else if (vesselId && !row["Vessel Code"]) {
        normalized["Vessel Code"] = vesselId;
      }
      if (!row["Component Code"]) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        const componentCode = String(row["Component Code"]).trim();
        normalized["Component Code"] = componentCode;
      }
      if (row["Component Name"]) {
        normalized["Component Name"] = String(row["Component Name"]).trim();
      }
      if (row["Part Code"] && String(row["Part Code"]).trim()) {
        normalized["Part Code"] = String(row["Part Code"]).trim();
      }
      if (!row["Part Name"]) {
        errors.push(`Row ${rowNum}: Part Name is required`);
      } else {
        normalized["Part Name"] = String(row["Part Name"]).trim();
      }
      if (row["Part Number"]) {
        normalized["Part Number"] = String(row["Part Number"]).trim();
      }
      const uomField = row["UOM"] || row["Unit Of Measurement"];
      if (uomField) {
        const uomValue = String(uomField).toLowerCase().trim();
        if (!UOM_LIST.includes(uomValue)) {
          errors.push(`Row ${rowNum}: Invalid UOM. Allowed: ${UOM_LIST.join(", ")}`);
        } else {
          normalized["UOM"] = uomValue.toUpperCase();
        }
      }
      const numericFieldMappings = [
        { source: "Total ROB", target: "Total ROB" },
        { source: "Location A - ROB", target: "Location A - ROB" },
        { source: "Location B - ROB", target: "Location B - ROB" },
        { source: "Minimum Stock", target: "Minimum Stock" }
      ];
      numericFieldMappings.forEach(({ source, target }) => {
        if (row[source] !== void 0 && row[source] !== null && row[source] !== "") {
          const num = parseInt(row[source]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${source} must be a non-negative integer`);
          } else {
            normalized[target] = num;
          }
        }
      });
      const criticalField = row["Criticality"] || row["Critical Yes/No"] || row["Criticality (Yes/No)"];
      if (criticalField) {
        const value = String(criticalField).toLowerCase().trim();
        if (!["yes", "no", "y", "n"].includes(value)) {
          errors.push(`Row ${rowNum}: Criticality must be Yes or No`);
        } else {
          const normalizedValue = ["yes", "y"].includes(value) ? "Yes" : "No";
          normalized["Criticality"] = normalizedValue;
        }
      }
      const isActiveField = row["Is Active"] || row["IS Active"];
      if (isActiveField) {
        const value = String(isActiveField).toLowerCase().trim();
        if (!["yes", "no", "y", "n"].includes(value)) {
          errors.push(`Row ${rowNum}: Is Active must be Yes or No`);
        } else {
          normalized["Is Active"] = ["yes", "y"].includes(value) ? "Yes" : "No";
        }
      }
      const ihmField = row["IHM (Inventory of Hazardous Materials)"];
      if (ihmField) {
        const value = String(ihmField).toLowerCase().trim();
        if (!["yes", "no", "y", "n"].includes(value)) {
          errors.push(`Row ${rowNum}: IHM must be Yes or No`);
        } else {
          normalized["IHM (Inventory of Hazardous Materials)"] = ["yes", "y"].includes(value) ? "Yes" : "No";
        }
      }
      if (row["Fleet Equipment Code"]) {
        const fleetCode = String(row["Fleet Equipment Code"]).trim();
        normalized["Fleet Equipment Code"] = fleetCode;
        const masterEntry = await storage.getMasterDataByFleetCode(fleetCode);
        if (!masterEntry) {
          warnings.push(`Row ${rowNum}: Fleet Equipment Code '${fleetCode}' not found in master data. Code will be accepted but not linked.`);
        }
      }
      const textFields = [
        "Fleet Equipment Name",
        "Drawing Number",
        "Position Number",
        "Note",
        "Specification",
        "Maker",
        "Maker Code",
        "Manual Name",
        "Page Number",
        "Location A",
        "Location B",
        "Evidence Type"
      ];
      textFields.forEach((field) => {
        if (row[field] !== void 0 && row[field] !== null && row[field] !== "") {
          normalized[field] = String(row[field]).trim();
        }
      });
    } else if (type === "stores") {
      if (!row["Item Code"]) {
        errors.push(`Row ${rowNum}: Item Code is required`);
      } else {
        normalized["Item Code"] = String(row["Item Code"]).trim();
      }
      if (row["IMPA Code"]) {
        normalized["IMPA Code"] = String(row["IMPA Code"]).trim();
      }
      if (!row["Item Name"]) {
        errors.push(`Row ${rowNum}: Item Name is required`);
      } else {
        normalized["Item Name"] = String(row["Item Name"]).trim();
      }
      if (row["UOM"] && !UOM_LIST.includes(row["UOM"].toLowerCase())) {
        errors.push(`Row ${rowNum}: Invalid UOM. Allowed: ${UOM_LIST.join(", ")}`);
      } else if (row["UOM"]) {
        normalized["UOM"] = row["UOM"].toLowerCase();
      }
      if (row["Category"] && !STORES_CATEGORIES.includes(row["Category"])) {
        warnings.push(`Row ${rowNum}: Category '${row["Category"]}' not in standard list`);
        normalized["Category"] = row["Category"];
      } else if (row["Category"]) {
        normalized["Category"] = row["Category"];
      }
      const numericFields = ["Total ROB", "Location A - ROB", "Location B - ROB", "Min"];
      numericFields.forEach((field) => {
        if (row[field] !== void 0 && row[field] !== null && row[field] !== "") {
          const num = parseFloat(row[field]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${field} must be a non-negative number`);
          } else {
            normalized[field] = num;
          }
        }
      });
      const textFields = ["Location A", "Location B"];
      textFields.forEach((field) => {
        if (row[field] !== void 0 && row[field] !== null && row[field] !== "") {
          normalized[field] = String(row[field]).trim();
        }
      });
      Object.keys(row).forEach((key) => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    } else if (type === "work-orders") {
      if (!row["Job_Title"] || String(row["Job_Title"]).trim() === "") {
        continue;
      }
      normalized["Job_Title"] = String(row["Job_Title"]).trim();
      if (!row["Generated_Component_Code"]) {
        errors.push(`Row ${rowNum}: Generated_Component_Code is required`);
      } else {
        normalized["Generated_Component_Code"] = String(row["Generated_Component_Code"]).trim();
      }
      if (row["Component_Name"]) {
        normalized["Component_Name"] = String(row["Component_Name"]).trim();
      }
      if (row["Job_Code"]) {
        normalized["Job_Code"] = String(row["Job_Code"]).trim();
      }
      if (row["Job_Description"]) {
        normalized["Job_Description"] = String(row["Job_Description"]).trim();
      }
      const validDepartments = ["Engine", "Deck", "Electrical"];
      if (row["Department"] && !validDepartments.includes(row["Department"])) {
        errors.push(`Row ${rowNum}: Invalid Department. Allowed: ${validDepartments.join(", ")}`);
      } else if (row["Department"]) {
        normalized["Department"] = row["Department"];
      }
      const validRanks = ["Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer", "Chief Officer", "Electrician"];
      if (row["Responsible_Rank"] && !validRanks.includes(row["Responsible_Rank"])) {
        errors.push(`Row ${rowNum}: Invalid Responsible_Rank. Allowed: ${validRanks.join(", ")}`);
      } else if (row["Responsible_Rank"]) {
        normalized["Responsible_Rank"] = row["Responsible_Rank"];
      }
      const validScheduleTypes = ["Calendar", "Running Hours"];
      if (row["Schedule_Type"] && !validScheduleTypes.includes(row["Schedule_Type"])) {
        errors.push(`Row ${rowNum}: Invalid Schedule_Type. Allowed: ${validScheduleTypes.join(", ")}`);
      } else if (row["Schedule_Type"]) {
        normalized["Schedule_Type"] = row["Schedule_Type"];
      }
      const scheduleType = row["Schedule_Type"];
      if (scheduleType === "Calendar" || scheduleType === "Running Hours") {
        if (!row["Interval"]) {
          errors.push(`Row ${rowNum}: Interval is required for ${scheduleType} schedule`);
        } else {
          const interval = parseFloat(row["Interval"]);
          if (isNaN(interval) || interval <= 0) {
            errors.push(`Row ${rowNum}: Interval must be a positive number`);
          } else {
            normalized["Interval"] = String(interval);
          }
        }
        if (scheduleType === "Calendar") {
          const validIntervalUnits = ["Hours", "Days", "Weeks", "Months", "Years"];
          if (!row["Interval_Unit"]) {
            errors.push(`Row ${rowNum}: Interval_Unit is required for Calendar schedule`);
          } else if (!validIntervalUnits.includes(row["Interval_Unit"])) {
            errors.push(`Row ${rowNum}: Invalid Interval_Unit. Allowed: ${validIntervalUnits.join(", ")}`);
          } else {
            normalized["Interval_Unit"] = row["Interval_Unit"];
          }
        } else {
          if (row["Interval_Unit"]) {
            if (row["Interval_Unit"] !== "Hours") {
              warnings.push(`Row ${rowNum}: Interval_Unit for Running Hours should be 'Hours' (will be set to Hours)`);
            }
          }
          normalized["Interval_Unit"] = "Hours";
        }
      }
      if (row["Criticality"]) {
        const value = row["Criticality"].toString().toLowerCase();
        if (!["yes", "no"].includes(value)) {
          errors.push(`Row ${rowNum}: Criticality must be yes or no`);
        } else {
          normalized["Criticality"] = value;
        }
      }
      if (row["Estimated_Hours"]) {
        const hours = parseFloat(row["Estimated_Hours"]);
        if (isNaN(hours) || hours < 0) {
          errors.push(`Row ${rowNum}: Estimated_Hours must be a non-negative number`);
        } else {
          normalized["Estimated_Hours"] = String(hours);
        }
      }
      if (row["Spares_Required"]) {
        normalized["Spares_Required"] = String(row["Spares_Required"]).trim();
      }
      const validSafetyPermits = ["Hot Work", "Enclosed Space Entry", "Lockout-Tagout", "Working Aloft"];
      if (row["Safety_Permit_Required"] && !validSafetyPermits.includes(row["Safety_Permit_Required"])) {
        errors.push(`Row ${rowNum}: Invalid Safety_Permit_Required. Allowed: ${validSafetyPermits.join(", ")}`);
      } else if (row["Safety_Permit_Required"]) {
        normalized["Safety_Permit_Required"] = row["Safety_Permit_Required"];
      }
      Object.keys(row).forEach((key) => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    } else if (type === "jobs") {
      if (!row["WO Title"] || String(row["WO Title"]).trim() === "") {
        continue;
      }
      normalized["WO Title"] = String(row["WO Title"]).trim();
      if (!row["Vessel Code"]) {
        errors.push(`Row ${rowNum}: Vessel Code is required`);
      } else {
        normalized["Vessel Code"] = String(row["Vessel Code"]).trim();
      }
      if (!row["Component Code"]) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        const componentCode = String(row["Component Code"]).trim();
        normalized["Component Code"] = componentCode;
        const vesselCode = row["Vessel Code"] ? String(row["Vessel Code"]).trim() : null;
        if (vesselCode) {
          const component = await storage.getComponentByCode(componentCode, vesselCode);
          if (!component) {
            errors.push(`Row ${rowNum}: Component Code '${componentCode}' not found in vessel '${vesselCode}'. Job cannot be linked.`);
          }
        }
      }
      if (row["Component Name"]) {
        normalized["Component Name"] = String(row["Component Name"]).trim();
      }
      if (row["Job Code"]) {
        normalized["Job Code"] = String(row["Job Code"]).trim();
      }
      if (row["Fleet Equipment Code"]) {
        normalized["Fleet Equipment Code"] = String(row["Fleet Equipment Code"]).trim();
      }
      if (row["Fleet Equipment Name"]) {
        normalized["Fleet Equipment Name"] = String(row["Fleet Equipment Name"]).trim();
      }
      const validMaintenanceBasis = ["Calendar", "Running Hours"];
      if (!row["Maintenance Basis"]) {
        errors.push(`Row ${rowNum}: Maintenance Basis is required (must be 'Calendar' or 'Running Hours')`);
      } else if (!validMaintenanceBasis.includes(row["Maintenance Basis"])) {
        errors.push(`Row ${rowNum}: Invalid Maintenance Basis '${row["Maintenance Basis"]}'. Must be 'Calendar' or 'Running Hours'`);
      } else {
        normalized["Maintenance Basis"] = row["Maintenance Basis"];
      }
      const maintenanceBasis = row["Maintenance Basis"];
      if (!row["Interval Value"]) {
        errors.push(`Row ${rowNum}: Interval Value is REQUIRED - this drives the entire PMS scheduling system`);
      } else {
        const interval = parseFloat(row["Interval Value"]);
        if (isNaN(interval) || interval <= 0) {
          errors.push(`Row ${rowNum}: Interval Value must be a positive number (got: '${row["Interval Value"]}')`);
        } else {
          normalized["Interval Value"] = String(interval);
        }
      }
      if (row["Interval Running Hours"]) {
        normalized["Interval Running Hours"] = String(row["Interval Running Hours"]).trim();
      }
      if (maintenanceBasis === "Calendar") {
        const validUnits = ["Hours", "Days", "Weeks", "Months", "Years"];
        if (!row["Unit"]) {
          errors.push(`Row ${rowNum}: Unit is REQUIRED for Calendar maintenance (allowed: ${validUnits.join(", ")})`);
        } else if (!validUnits.includes(row["Unit"])) {
          errors.push(`Row ${rowNum}: Invalid Unit '${row["Unit"]}'. Allowed: ${validUnits.join(", ")}`);
        } else {
          normalized["Unit"] = row["Unit"];
        }
      } else if (maintenanceBasis === "Running Hours") {
        if (row["Unit"]) {
          if (row["Unit"] !== "Hours") {
            warnings.push(`Row ${rowNum}: Unit for Running Hours should be 'Hours' (will be set to Hours)`);
          }
        }
        normalized["Unit"] = "Hours";
        if (!row["Interval Running Hours"] && row["Interval Value"]) {
          normalized["Interval Running Hours"] = String(row["Interval Value"]).trim();
        }
      }
      const validTaskTypes = ["Inspection", "Overhaul", "Service", "Testing", "Repair", "Replacement", "Cleaning", "Calibration"];
      if (!row["Task Type"]) {
        errors.push(`Row ${rowNum}: Task Type is required`);
      } else if (!validTaskTypes.includes(row["Task Type"])) {
        errors.push(`Row ${rowNum}: Invalid Task Type. Allowed: ${validTaskTypes.join(", ")}`);
      } else {
        normalized["Task Type"] = row["Task Type"];
      }
      if (row["Assigned To"]) {
        normalized["Assigned To"] = String(row["Assigned To"]).trim();
      }
      if (row["Approver"]) {
        normalized["Approver"] = String(row["Approver"]).trim();
      }
      const validJobPriorities = ["Low", "Medium", "High", "Critical"];
      if (row["Job Priority"] && !validJobPriorities.includes(row["Job Priority"])) {
        errors.push(`Row ${rowNum}: Invalid Job Priority. Allowed: ${validJobPriorities.join(", ")}`);
      } else if (row["Job Priority"]) {
        normalized["Job Priority"] = row["Job Priority"];
      }
      if (row["Class Related"]) {
        const value = row["Class Related"].toString().toLowerCase();
        if (!["yes", "no"].includes(value)) {
          errors.push(`Row ${rowNum}: Class Related must be Yes or No`);
        } else {
          normalized["Class Related"] = value;
        }
      }
      if (row["Last Done Date"]) {
        normalized["Last Done Date"] = String(row["Last Done Date"]).trim();
      }
      if (row["Brief Work Description"]) {
        normalized["Brief Work Description"] = String(row["Brief Work Description"]).trim();
      }
      const validDepartmentsJobs = ["Engine", "Deck", "Electrical", "C/E", "2/E", "3/E", "4/E", "ETO"];
      if (row["Department"] && !validDepartmentsJobs.includes(row["Department"])) {
        errors.push(`Row ${rowNum}: Invalid Department. Allowed: ${validDepartmentsJobs.join(", ")}`);
      } else if (row["Department"]) {
        normalized["Department"] = row["Department"];
      }
      const criticalJobField = row["Critical Yes/No"] ?? row["Criticality"];
      if (criticalJobField) {
        const value = criticalJobField.toString().toLowerCase();
        if (!["yes", "no", "y", "n"].includes(value)) {
          errors.push(`Row ${rowNum}: Critical must be Yes or No`);
        } else {
          const normalizedCritical = ["yes", "y"].includes(value) ? "yes" : "no";
          normalized["Critical Yes/No"] = normalizedCritical;
          normalized["Criticality"] = normalizedCritical;
        }
      }
      if (row["Is Active"]) {
        const value = row["Is Active"].toString().toLowerCase();
        if (!["yes", "no"].includes(value)) {
          errors.push(`Row ${rowNum}: Is Active must be Yes or No`);
        } else {
          normalized["Is Active"] = value;
        }
      } else {
        normalized["Is Active"] = "yes";
      }
      Object.keys(row).forEach((key) => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    }
    let status = "ok";
    if (errors.length > 0) {
      status = "error";
      results.summary.errors++;
      console.log(`\u274C Row ${rowNum} has ERRORS: ${JSON.stringify(errors)}`);
    } else if (warnings.length > 0) {
      status = "warning";
      results.summary.warnings++;
      results.summary.ok++;
      console.log(`\u26A0\uFE0F Row ${rowNum} has warnings (importable): ${JSON.stringify(warnings)}`);
    } else {
      results.summary.ok++;
      console.log(`\u2705 Row ${rowNum} is OK`);
    }
    results.rows.push({
      row: rowNum,
      status,
      errors: [...errors, ...warnings],
      normalized
    });
  }
  return results;
}
function createRecordSnapshot(record) {
  if (!record) {
    return { checksum: "", snapshot: null };
  }
  const sorted = sortObjectKeys(record);
  const snapshot = JSON.stringify(sorted, (key, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "function" || typeof value === "symbol") {
      return void 0;
    }
    return value;
  });
  const checksum = calculateRecordChecksum(sorted);
  return { checksum, snapshot };
}
async function trackChange(importHistoryId, operation, entityType, entityId, previousData, newData) {
  const previousSnapshot = createRecordSnapshot(previousData);
  const newSnapshot = createRecordSnapshot(newData);
  const checksum = newSnapshot.checksum || previousSnapshot.checksum;
  await storage.createImportChangeLog({
    id: uuidv4(),
    importHistoryId,
    operation,
    entityType,
    entityId,
    previousData: previousSnapshot.snapshot,
    newData: newSnapshot.snapshot,
    checksum
  });
}
async function performImport(type, data, mode, archiveMissing, vesselId, userId, importHistoryId, storeType) {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    archived: 0
  };
  if (type === "components") {
    console.log(`\u{1F680} Starting component import: ${data.length} rows, mode: ${mode}`);
    const existingMakers = await storage.getMakerList();
    const existingMakersByName = new Map(existingMakers.map((m) => [m.makerName.toLowerCase(), m]));
    const existingMakersByCode = new Map(existingMakers.map((m) => [m.makerCode, m]));
    let maxMakerNum = 0;
    for (const m of existingMakers) {
      const match = m.makerCode.match(/MKR-(\d+)/);
      if (match) {
        maxMakerNum = Math.max(maxMakerNum, parseInt(match[1], 10));
      }
    }
    const makersToCreate = /* @__PURE__ */ new Map();
    for (const row of data) {
      const makerName = row["Maker"] || row["Maker Name"];
      const makerCode = row["Maker Code"];
      if (makerName && makerName.toString().trim()) {
        const trimmedName = makerName.toString().trim();
        const trimmedCode = makerCode?.toString().trim();
        if (trimmedCode && existingMakersByCode.has(trimmedCode)) {
          continue;
        }
        if (existingMakersByName.has(trimmedName.toLowerCase())) {
          const existingMaker = existingMakersByName.get(trimmedName.toLowerCase());
          row["Maker Code"] = existingMaker.makerCode;
          continue;
        }
        if (!makersToCreate.has(trimmedName.toLowerCase())) {
          makersToCreate.set(trimmedName.toLowerCase(), {
            makerName: trimmedName,
            address: row["Address"]?.toString().trim() || void 0
          });
        }
      }
    }
    const newMakerCodes = /* @__PURE__ */ new Map();
    for (const [key, makerInfo] of Array.from(makersToCreate)) {
      maxMakerNum++;
      const newMakerCode = `MKR-${String(maxMakerNum).padStart(6, "0")}`;
      try {
        const newMaker = await storage.createMakerListItem({
          makerCode: newMakerCode,
          makerName: makerInfo.makerName,
          address: makerInfo.address || null
        });
        newMakerCodes.set(key, newMakerCode);
        existingMakersByName.set(key, newMaker);
        existingMakersByCode.set(newMakerCode, newMaker);
        console.log(`\u2705 Created new maker: ${makerInfo.makerName} -> ${newMakerCode}`);
      } catch (err) {
        console.error(`Failed to create maker ${makerInfo.makerName}:`, err);
      }
    }
    for (const row of data) {
      const makerName = row["Maker"] || row["Maker Name"];
      if (makerName && !row["Maker Code"]) {
        const resolvedCode = newMakerCodes.get(makerName.toString().trim().toLowerCase());
        if (resolvedCode) {
          row["Maker Code"] = resolvedCode;
        }
      }
    }
    console.log(`\u{1F4CB} Maker sync complete: ${newMakerCodes.size} new makers created`);
    const allCodes = data.map((row) => String(row["Component Code"] || row["Generated Code"] || row["Original SFI Code"]).trim());
    const existingComponentsMap = await storage.getComponentsByCodes(allCodes, vesselId);
    const parentsToCreate = /* @__PURE__ */ new Set();
    for (const row of data) {
      const componentCode = String(row["Component Code"] || row["Generated Code"] || row["Original SFI Code"]).trim();
      const originalSFICode = String(row["Original SFI Code"] || row["Component Code"] || row["Generated Code"]).trim();
      let currentCode = getParentSFICode(originalSFICode);
      while (currentCode && currentCode.length > 0) {
        const parentExists = existingComponentsMap.get(currentCode);
        if (!parentExists) {
          parentsToCreate.add(currentCode);
        }
        currentCode = getParentSFICode(currentCode);
      }
    }
    const sortedParents = Array.from(parentsToCreate).sort((a, b) => {
      const aDepth = (a.match(/\./g) || []).length;
      const bDepth = (b.match(/\./g) || []).length;
      return aDepth - bDepth;
    });
    console.log(`\u{1F4C1} Creating ${sortedParents.length} intermediate parent nodes...`);
    for (const parentCode of sortedParents) {
      const parentMainGroup = parseInt(parentCode.charAt(0));
      const parentSubGroup = getSubGroupCode(parentCode);
      let parentName = getSFIName(parentCode);
      if (parentName === `SFI ${parentCode}`) {
        if (parentCode.length === 1) {
          const category = getComponentCategory(parentMainGroup);
          parentName = category ? category.replace(/^\d+\s+/, "") : `SFI ${parentCode}`;
        } else if (parentCode.length === 2) {
          parentName = getSubGroupName(parentCode);
        }
      }
      const parentComponent = await storage.createComponent({
        componentCode: parentCode,
        name: parentName,
        category: getComponentCategory(parentMainGroup) || "",
        parentId: getParentSFICode(parentCode),
        vesselId: vesselId || "V001",
        currentCumulativeRH: "0",
        critical: false,
        classItem: false
      });
      existingComponentsMap.set(parentCode, parentComponent);
      console.log(`\u{1F4C1} Created parent node: ${parentCode} (${parentName})`);
      result.created++;
      if (importHistoryId) {
        await trackChange(importHistoryId, "created", "component", parentComponent.id, null, parentComponent);
      }
    }
    const sortedData = [...data].sort((a, b) => {
      const aCode = String(a["Component Code"] || a["Generated Code"] || a["Original SFI Code"] || "").trim();
      const bCode = String(b["Component Code"] || b["Generated Code"] || b["Original SFI Code"] || "").trim();
      const aDepth = (aCode.match(/\./g) || []).length;
      const bDepth = (bCode.match(/\./g) || []).length;
      return aDepth - bDepth;
    });
    for (const row of sortedData) {
      const componentCode = String(row["Component Code"] || row["Generated Code"] || row["Original SFI Code"]).trim();
      const existingComponent = existingComponentsMap.get(componentCode);
      if (mode === "add") {
        if (!existingComponent) {
          const newComponent = await createComponentFromRow(row, vesselId);
          existingComponentsMap.set(componentCode, newComponent);
          result.created++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "created", "component", newComponent.id, null, newComponent);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === "update") {
        if (existingComponent) {
          const previousSnapshot = createRecordSnapshot(existingComponent);
          const updatedComponent = await updateComponentFromRow(componentCode, row, vesselId, existingComponent);
          existingComponentsMap.set(componentCode, updatedComponent);
          result.updated++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "updated", "component", updatedComponent.id, existingComponent, updatedComponent);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === "upsert") {
        if (existingComponent && existingComponent.id) {
          console.log(`\u{1F504} Updating existing component: ${componentCode}`);
          const previousSnapshot = createRecordSnapshot(existingComponent);
          const updatedComponent = await updateComponentFromRow(componentCode, row, vesselId, existingComponent);
          existingComponentsMap.set(componentCode, updatedComponent);
          result.updated++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "updated", "component", updatedComponent.id, existingComponent, updatedComponent);
          }
        } else {
          const newComponent = await createComponentFromRow(row, vesselId);
          existingComponentsMap.set(componentCode, newComponent);
          result.created++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "created", "component", newComponent.id, null, newComponent);
          }
        }
      }
    }
    if (archiveMissing) {
      const importedCodes = new Set(data.map((row) => String(row["Component Code"] || row["Generated Code"] || row["Original SFI Code"]).trim()));
      const allVesselComponents = await storage.getComponents(vesselId || "V001");
      for (const component of allVesselComponents) {
        if (component.componentCode && !importedCodes.has(component.componentCode) && component.isActive !== false) {
          const previousSnapshot = createRecordSnapshot(component);
          const archivedComponent = await storage.archiveComponent(component.id);
          result.archived++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "archived", "component", component.id, component, archivedComponent);
          }
          console.log(`\u{1F4E6} Archived component: ${component.componentCode}`);
        }
      }
    }
    console.log(`\u2705 Component import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.archived} archived`);
  } else if (type === "spares") {
    const sparesVesselId = vesselId || "V001";
    console.log(`\u{1F680} Starting spares import: ${data.length} rows, mode: ${mode}, vesselId: ${sparesVesselId}`);
    const allComponents = await storage.getComponents(sparesVesselId);
    const componentsByCode = new Map(allComponents.map((c) => [c.componentCode, c]));
    console.log(`\u{1F4CB} Loaded ${allComponents.length} components for validation`);
    const existingSpares = await storage.getSpares(sparesVesselId);
    const sparesByPartCode = new Map(existingSpares.map((s) => [s.partCode, s]));
    let maxPartCodeNum = 0;
    existingSpares.forEach((spare) => {
      if (spare.partCode && spare.partCode.startsWith("PT-")) {
        const match = spare.partCode.match(/PT-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxPartCodeNum) maxPartCodeNum = num;
        }
      }
    });
    let nextPartCodeNum = maxPartCodeNum + 1;
    console.log(`\u{1F522} Next auto-generated Part Code will be: PT-${String(nextPartCodeNum).padStart(6, "0")}`);
    for (const row of data) {
      try {
        const componentCode = String(row["Component Code"]).trim();
        const component = componentsByCode.get(componentCode);
        if (!component) {
          console.warn(`\u26A0\uFE0F Component ${componentCode} not found in system, skipping spare`);
          result.skipped++;
          continue;
        }
        let partCode = row["Part Code"] ? String(row["Part Code"]).trim() : "";
        if (!partCode || partCode === "") {
          partCode = `PT-${String(nextPartCodeNum).padStart(6, "0")}`;
          nextPartCodeNum++;
          console.log(`\u2728 Auto-generated Part Code: ${partCode}`);
        }
        const existingSpare = sparesByPartCode.get(partCode);
        if (mode === "add") {
          if (existingSpare) {
            if (existingSpare.componentId !== component.id) {
              try {
                const existingLinks = await storage.getSpareComponentLinksBySpare(existingSpare.id);
                const linkAlreadyExists = existingLinks.some((link) => link.componentId === component.id);
                if (!linkAlreadyExists) {
                  await storage.createSpareComponentLink({
                    vesselId: sparesVesselId,
                    spareId: existingSpare.id,
                    componentId: component.id,
                    linkedBy: "system-bulk-import"
                  });
                  console.log(`\u{1F517} Linked spare ${partCode} to additional component ${componentCode}`);
                  result.updated++;
                } else {
                  console.log(`\u23ED\uFE0F Spare ${partCode} already linked to component ${componentCode}, skipping`);
                  result.skipped++;
                }
              } catch (linkError) {
                console.warn(`\u26A0\uFE0F Failed to create spare-component link for ${partCode} -> ${componentCode}: ${linkError.message}`);
                result.skipped++;
              }
            } else {
              console.log(`\u23ED\uFE0F Part Code ${partCode} already exists for same component, skipping`);
              result.skipped++;
            }
            continue;
          }
          const criticalVal = row["Criticality"] || row["Critical Yes/No"] || row["Criticality (Yes/No)"];
          const isActiveVal = row["Is Active"] || row["IS Active"];
          const ihmVal = row["IHM (Inventory of Hazardous Materials)"];
          let totalRob = 0;
          if (row["Total ROB"] !== void 0 && row["Total ROB"] !== null && row["Total ROB"] !== "") {
            totalRob = parseInt(row["Total ROB"]) || 0;
          } else {
            const locARob = parseInt(row["Location A - ROB"]) || 0;
            const locBRob = parseInt(row["Location B - ROB"]) || 0;
            totalRob = locARob + locBRob;
          }
          const robLocationAVal = parseInt(row["Location A - ROB"]) || 0;
          const robLocationBVal = parseInt(row["Location B - ROB"]) || 0;
          const newSpare = await storage.createSpare({
            partCode,
            partName: String(row["Part Name"]).trim(),
            componentId: component.id,
            componentCode,
            componentName: component.name || "",
            componentSpareCode: `SP-${componentCode}-${String(result.created + 1).padStart(3, "0")}`,
            critical: criticalVal === "Yes" || criticalVal === true ? "Yes" : "No",
            rob: totalRob,
            robLocationA: robLocationAVal,
            robLocationB: robLocationBVal,
            min: row["Minimum Stock"] ? parseInt(row["Minimum Stock"]) : 0,
            location: row["Location A"] ? String(row["Location A"]).trim() : null,
            location2: row["Location B"] ? String(row["Location B"]).trim() : null,
            vesselId: sparesVesselId,
            partNumber: row["Part Number"] ? String(row["Part Number"]).trim() : null,
            uom: row["UOM"] || row["Unit Of Measurement"] ? String(row["UOM"] || row["Unit Of Measurement"]).toUpperCase() : null,
            maker: row["Maker"] || row["Maker Name"] ? String(row["Maker"] || row["Maker Name"]).trim() : null,
            makerCode: row["Maker Code"] ? String(row["Maker Code"]).trim() : null,
            specification: row["Specification"] ? String(row["Specification"]).trim() : null,
            drawingNumber: row["Drawing Number"] || row["Drawing No"] ? String(row["Drawing Number"] || row["Drawing No"]).trim() : null,
            positionNumber: row["Position Number"] ? String(row["Position Number"]).trim() : null,
            note: row["Note"] ? String(row["Note"]).trim() : null,
            manualName: row["Manual Name"] ? String(row["Manual Name"]).trim() : null,
            pageNumber: row["Page Number"] ? String(row["Page Number"]).trim() : null,
            isActive: isActiveVal === "Yes" || isActiveVal === true ? true : isActiveVal === "No" ? false : true,
            ihm: ihmVal === "Yes" || ihmVal === true ? "Yes" : "No",
            remarks: row["Evidence Type"] ? String(row["Evidence Type"]).trim() : null,
            dataScope: "vessel"
          });
          sparesByPartCode.set(partCode, newSpare);
          result.created++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "created", "spare", String(newSpare.id), null, newSpare);
          }
          await processSpareInventory({
            spareId: newSpare.id,
            vesselId: sparesVesselId,
            componentId: component.id,
            locationAName: row["Location A"] ? String(row["Location A"]).trim() : null,
            locationBName: row["Location B"] ? String(row["Location B"]).trim() : null,
            robLocationA: robLocationAVal,
            robLocationB: robLocationBVal,
            isNewSpare: true,
            userId: "system-import"
          });
          console.log(`\u2705 Created spare: ${partCode} - ${newSpare.partName}`);
        } else if (mode === "update") {
          if (!existingSpare) {
            console.log(`\u23ED\uFE0F Part Code ${partCode} not found for update, skipping`);
            result.skipped++;
            continue;
          }
          const criticalValUpdate = row["Criticality"] || row["Critical Yes/No"] || row["Criticality (Yes/No)"];
          const isActiveValUpdate = row["Is Active"] || row["IS Active"];
          const ihmValUpdate = row["IHM (Inventory of Hazardous Materials)"];
          let totalRobUpdate = existingSpare.rob;
          if (row["Total ROB"] !== void 0 && row["Total ROB"] !== null && row["Total ROB"] !== "") {
            totalRobUpdate = parseInt(row["Total ROB"]) || 0;
          } else if (row["Location A - ROB"] !== void 0 || row["Location B - ROB"] !== void 0) {
            const locARob = parseInt(row["Location A - ROB"]) || 0;
            const locBRob = parseInt(row["Location B - ROB"]) || 0;
            totalRobUpdate = locARob + locBRob;
          }
          const robLocationAUpdate = row["Location A - ROB"] !== void 0 ? parseInt(row["Location A - ROB"]) || 0 : existingSpare.robLocationA;
          const robLocationBUpdate = row["Location B - ROB"] !== void 0 ? parseInt(row["Location B - ROB"]) || 0 : existingSpare.robLocationB;
          const updatedSpare = await storage.updateSpare(existingSpare.id, {
            partName: String(row["Part Name"]).trim(),
            componentId: component.id,
            componentCode,
            componentName: component.name || "",
            critical: criticalValUpdate === "Yes" || criticalValUpdate === true ? "Yes" : "No",
            rob: totalRobUpdate,
            robLocationA: robLocationAUpdate,
            robLocationB: robLocationBUpdate,
            min: row["Minimum Stock"] ? parseInt(row["Minimum Stock"]) : existingSpare.min,
            location: row["Location A"] ? String(row["Location A"]).trim() : existingSpare.location,
            location2: row["Location B"] ? String(row["Location B"]).trim() : existingSpare.location2,
            partNumber: row["Part Number"] ? String(row["Part Number"]).trim() : existingSpare.partNumber,
            uom: row["UOM"] || row["Unit Of Measurement"] ? String(row["UOM"] || row["Unit Of Measurement"]).toUpperCase() : existingSpare.uom,
            maker: row["Maker"] || row["Maker Name"] ? String(row["Maker"] || row["Maker Name"]).trim() : existingSpare.maker,
            makerCode: row["Maker Code"] ? String(row["Maker Code"]).trim() : existingSpare.makerCode,
            specification: row["Specification"] ? String(row["Specification"]).trim() : existingSpare.specification,
            drawingNumber: row["Drawing Number"] || row["Drawing No"] ? String(row["Drawing Number"] || row["Drawing No"]).trim() : existingSpare.drawingNumber,
            positionNumber: row["Position Number"] ? String(row["Position Number"]).trim() : existingSpare.positionNumber,
            note: row["Note"] ? String(row["Note"]).trim() : existingSpare.note,
            manualName: row["Manual Name"] ? String(row["Manual Name"]).trim() : existingSpare.manualName,
            pageNumber: row["Page Number"] ? String(row["Page Number"]).trim() : existingSpare.pageNumber,
            isActive: isActiveValUpdate === "Yes" || isActiveValUpdate === true ? true : isActiveValUpdate === "No" ? false : existingSpare.isActive,
            ihm: ihmValUpdate === "Yes" || ihmValUpdate === true ? "Yes" : ihmValUpdate === "No" ? "No" : existingSpare.ihm,
            remarks: row["Evidence Type"] ? String(row["Evidence Type"]).trim() : existingSpare.remarks
          });
          sparesByPartCode.set(partCode, updatedSpare);
          result.updated++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "updated", "spare", String(updatedSpare.id), existingSpare, updatedSpare);
          }
          await processSpareInventory({
            spareId: updatedSpare.id,
            vesselId: sparesVesselId,
            componentId: component.id,
            locationAName: row["Location A"] ? String(row["Location A"]).trim() : existingSpare.location,
            locationBName: row["Location B"] ? String(row["Location B"]).trim() : existingSpare.location2,
            robLocationA: robLocationAUpdate,
            robLocationB: robLocationBUpdate,
            isNewSpare: false,
            userId: "system-import"
          });
          console.log(`\u{1F504} Updated spare: ${partCode} - ${updatedSpare.partName}`);
        } else if (mode === "upsert") {
          const criticalValUpsert = row["Criticality"] || row["Critical Yes/No"] || row["Criticality (Yes/No)"];
          const isActiveValUpsert = row["Is Active"] || row["IS Active"];
          const ihmValUpsert = row["IHM (Inventory of Hazardous Materials)"];
          let totalRobUpsert = 0;
          if (row["Total ROB"] !== void 0 && row["Total ROB"] !== null && row["Total ROB"] !== "") {
            totalRobUpsert = parseInt(row["Total ROB"]) || 0;
          } else {
            const locARob = parseInt(row["Location A - ROB"]) || 0;
            const locBRob = parseInt(row["Location B - ROB"]) || 0;
            totalRobUpsert = locARob + locBRob;
          }
          const robLocationAUpsert = parseInt(row["Location A - ROB"]) || 0;
          const robLocationBUpsert = parseInt(row["Location B - ROB"]) || 0;
          if (existingSpare) {
            if (existingSpare.componentId !== component.id) {
              try {
                const existingLinks = await storage.getSpareComponentLinksBySpare(existingSpare.id);
                const linkAlreadyExists = existingLinks.some((link) => link.componentId === component.id);
                if (!linkAlreadyExists) {
                  await storage.createSpareComponentLink({
                    vesselId: sparesVesselId,
                    spareId: existingSpare.id,
                    componentId: component.id,
                    linkedBy: "system-bulk-import"
                  });
                  console.log(`\u{1F517} Linked spare ${partCode} to additional component ${componentCode} (upsert mode)`);
                  result.updated++;
                } else {
                  console.log(`\u23ED\uFE0F Spare ${partCode} already linked to component ${componentCode}, skipping`);
                  result.skipped++;
                }
              } catch (linkError) {
                console.warn(`\u26A0\uFE0F Failed to create spare-component link for ${partCode} -> ${componentCode}: ${linkError.message}`);
                result.skipped++;
              }
            } else {
              const updatedSpare = await storage.updateSpare(existingSpare.id, {
                partName: String(row["Part Name"]).trim(),
                componentId: component.id,
                componentCode,
                componentName: component.name || "",
                critical: criticalValUpsert === "Yes" || criticalValUpsert === true ? "Yes" : "No",
                rob: totalRobUpsert || existingSpare.rob,
                robLocationA: row["Location A - ROB"] !== void 0 ? robLocationAUpsert : existingSpare.robLocationA,
                robLocationB: row["Location B - ROB"] !== void 0 ? robLocationBUpsert : existingSpare.robLocationB,
                min: row["Minimum Stock"] ? parseInt(row["Minimum Stock"]) : existingSpare.min,
                location: row["Location A"] ? String(row["Location A"]).trim() : existingSpare.location,
                location2: row["Location B"] ? String(row["Location B"]).trim() : existingSpare.location2,
                partNumber: row["Part Number"] ? String(row["Part Number"]).trim() : existingSpare.partNumber,
                uom: row["UOM"] || row["Unit Of Measurement"] ? String(row["UOM"] || row["Unit Of Measurement"]).toUpperCase() : existingSpare.uom,
                maker: row["Maker"] || row["Maker Name"] ? String(row["Maker"] || row["Maker Name"]).trim() : existingSpare.maker,
                makerCode: row["Maker Code"] ? String(row["Maker Code"]).trim() : existingSpare.makerCode,
                specification: row["Specification"] ? String(row["Specification"]).trim() : existingSpare.specification,
                drawingNumber: row["Drawing Number"] || row["Drawing No"] ? String(row["Drawing Number"] || row["Drawing No"]).trim() : existingSpare.drawingNumber,
                positionNumber: row["Position Number"] ? String(row["Position Number"]).trim() : existingSpare.positionNumber,
                note: row["Note"] ? String(row["Note"]).trim() : existingSpare.note,
                manualName: row["Manual Name"] ? String(row["Manual Name"]).trim() : existingSpare.manualName,
                pageNumber: row["Page Number"] ? String(row["Page Number"]).trim() : existingSpare.pageNumber,
                isActive: isActiveValUpsert === "Yes" || isActiveValUpsert === true ? true : isActiveValUpsert === "No" ? false : existingSpare.isActive,
                ihm: ihmValUpsert === "Yes" || ihmValUpsert === true ? "Yes" : ihmValUpsert === "No" ? "No" : existingSpare.ihm,
                remarks: row["Evidence Type"] ? String(row["Evidence Type"]).trim() : existingSpare.remarks
              });
              sparesByPartCode.set(partCode, updatedSpare);
              result.updated++;
              if (importHistoryId) {
                await trackChange(importHistoryId, "updated", "spare", String(updatedSpare.id), existingSpare, updatedSpare);
              }
              await processSpareInventory({
                spareId: updatedSpare.id,
                vesselId: sparesVesselId,
                componentId: component.id,
                locationAName: row["Location A"] ? String(row["Location A"]).trim() : existingSpare.location,
                locationBName: row["Location B"] ? String(row["Location B"]).trim() : existingSpare.location2,
                robLocationA: row["Location A - ROB"] !== void 0 ? robLocationAUpsert : existingSpare.robLocationA,
                robLocationB: row["Location B - ROB"] !== void 0 ? robLocationBUpsert : existingSpare.robLocationB,
                isNewSpare: false,
                userId: "system-import"
              });
              console.log(`\u{1F504} Updated spare (upsert): ${partCode} - ${updatedSpare.partName}`);
            }
          } else {
            const newSpare = await storage.createSpare({
              partCode,
              partName: String(row["Part Name"]).trim(),
              componentId: component.id,
              componentCode,
              componentName: component.name || "",
              componentSpareCode: `SP-${componentCode}-${String(result.created + 1).padStart(3, "0")}`,
              critical: criticalValUpsert === "Yes" || criticalValUpsert === true ? "Yes" : "No",
              rob: totalRobUpsert,
              robLocationA: robLocationAUpsert,
              robLocationB: robLocationBUpsert,
              min: row["Minimum Stock"] ? parseInt(row["Minimum Stock"]) : 0,
              location: row["Location A"] ? String(row["Location A"]).trim() : null,
              location2: row["Location B"] ? String(row["Location B"]).trim() : null,
              vesselId: sparesVesselId,
              partNumber: row["Part Number"] ? String(row["Part Number"]).trim() : null,
              uom: row["UOM"] || row["Unit Of Measurement"] ? String(row["UOM"] || row["Unit Of Measurement"]).toUpperCase() : null,
              maker: row["Maker"] || row["Maker Name"] ? String(row["Maker"] || row["Maker Name"]).trim() : null,
              makerCode: row["Maker Code"] ? String(row["Maker Code"]).trim() : null,
              specification: row["Specification"] ? String(row["Specification"]).trim() : null,
              drawingNumber: row["Drawing Number"] || row["Drawing No"] ? String(row["Drawing Number"] || row["Drawing No"]).trim() : null,
              positionNumber: row["Position Number"] ? String(row["Position Number"]).trim() : null,
              note: row["Note"] ? String(row["Note"]).trim() : null,
              manualName: row["Manual Name"] ? String(row["Manual Name"]).trim() : null,
              pageNumber: row["Page Number"] ? String(row["Page Number"]).trim() : null,
              isActive: isActiveValUpsert === "Yes" || isActiveValUpsert === true ? true : isActiveValUpsert === "No" ? false : true,
              ihm: ihmValUpsert === "Yes" || ihmValUpsert === true ? "Yes" : "No",
              remarks: row["Evidence Type"] ? String(row["Evidence Type"]).trim() : null,
              dataScope: "vessel"
            });
            sparesByPartCode.set(partCode, newSpare);
            result.created++;
            if (importHistoryId) {
              await trackChange(importHistoryId, "created", "spare", String(newSpare.id), null, newSpare);
            }
            await processSpareInventory({
              spareId: newSpare.id,
              vesselId: sparesVesselId,
              componentId: component.id,
              locationAName: row["Location A"] ? String(row["Location A"]).trim() : null,
              locationBName: row["Location B"] ? String(row["Location B"]).trim() : null,
              robLocationA: robLocationAUpsert,
              robLocationB: robLocationBUpsert,
              isNewSpare: true,
              userId: "system-import"
            });
            console.log(`\u2705 Created spare (upsert): ${partCode} - ${newSpare.partName}`);
          }
        }
      } catch (error) {
        console.error(`\u274C Error processing spare row:`, error);
        result.skipped++;
      }
    }
    console.log(`\u2705 Spares import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } else if (type === "stores") {
    console.log(`\u{1F680} Starting stores import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}, storeType: ${storeType}`);
    const existingStoresItems = await storage.getStoresItems(vesselId || "");
    const storesByItemCode = new Map(existingStoresItems.map((s) => [s.itemCode, s]));
    const itemType = storeType || "stores";
    console.log(`\u{1F4CC} All imported items will be assigned to itemType: ${itemType}`);
    for (const row of data) {
      try {
        const itemCode = String(row["Item Code"] || "").trim();
        if (!itemCode) {
          console.log("\u23ED\uFE0F Skipping row with empty Item Code");
          result.skipped++;
          continue;
        }
        const itemName = String(row["Item Name"] || "").trim();
        if (!itemName) {
          console.log(`\u23ED\uFE0F Skipping row ${itemCode} with empty Item Name`);
          result.skipped++;
          continue;
        }
        const categoryRaw = String(row["Category"] || "").trim();
        const getTotalRob = () => row["Total ROB"] ?? row["ROB"] ?? 0;
        const getLocationARob = () => row["Location A - ROB"] ?? row["ROB Location A"] ?? 0;
        const getLocationBRob = () => row["Location B - ROB"] ?? row["ROB Location B"] ?? 0;
        const existingItem = storesByItemCode.get(itemCode);
        if (mode === "add") {
          if (existingItem) {
            result.skipped++;
            continue;
          }
          const newStoresItem = await storage.createStoresItem({
            vesselId: vesselId || "",
            itemCode,
            impaCode: row["IMPA Code"] ? String(row["IMPA Code"]).trim() : null,
            itemName,
            itemType,
            category: categoryRaw || null,
            specification: null,
            uom: row["UOM"] ? String(row["UOM"]).trim() : null,
            rob: String(getTotalRob()),
            robLocationA: String(getLocationARob()),
            robLocationB: String(getLocationBRob()),
            locationA: row["Location A"] ? String(row["Location A"]).trim() : null,
            locationB: row["Location B"] ? String(row["Location B"]).trim() : null,
            min: String(row["Min"] ?? 0),
            max: null,
            unitCost: null,
            supplier: null,
            lastOrderDate: null,
            leadTime: null,
            ihm: false,
            ihmDetails: null,
            remarks: null,
            isActive: true
          });
          storesByItemCode.set(itemCode, newStoresItem);
          result.created++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "created", "storesItem", String(newStoresItem.id), null, newStoresItem);
          }
          console.log(`\u2705 Created stores item: ${itemCode} - ${itemName}`);
        } else if (mode === "update") {
          if (!existingItem) {
            result.skipped++;
            continue;
          }
          const previousSnapshot = createRecordSnapshot(existingItem);
          const updated = await storage.updateStoresItem(existingItem.id, {
            impaCode: row["IMPA Code"] ? String(row["IMPA Code"]).trim() : existingItem.impaCode,
            itemName: itemName || existingItem.itemName,
            itemType,
            category: categoryRaw || existingItem.category,
            uom: row["UOM"] ? String(row["UOM"]).trim() : existingItem.uom,
            rob: row["Total ROB"] !== void 0 ? String(row["Total ROB"]) : existingItem.rob,
            robLocationA: row["Location A - ROB"] !== void 0 ? String(row["Location A - ROB"]) : existingItem.robLocationA,
            robLocationB: row["Location B - ROB"] !== void 0 ? String(row["Location B - ROB"]) : existingItem.robLocationB,
            locationA: row["Location A"] ? String(row["Location A"]).trim() : existingItem.locationA,
            locationB: row["Location B"] ? String(row["Location B"]).trim() : existingItem.locationB,
            min: row["Min"] !== void 0 ? String(row["Min"]) : existingItem.min
          });
          storesByItemCode.set(itemCode, updated);
          result.updated++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "updated", "storesItem", String(existingItem.id), previousSnapshot, updated);
          }
          console.log(`\u2705 Updated stores item: ${itemCode}`);
        } else {
          if (existingItem) {
            const previousSnapshot = createRecordSnapshot(existingItem);
            const updated = await storage.updateStoresItem(existingItem.id, {
              impaCode: row["IMPA Code"] ? String(row["IMPA Code"]).trim() : existingItem.impaCode,
              itemName: itemName || existingItem.itemName,
              itemType,
              category: categoryRaw || existingItem.category,
              uom: row["UOM"] ? String(row["UOM"]).trim() : existingItem.uom,
              rob: row["Total ROB"] !== void 0 ? String(row["Total ROB"]) : existingItem.rob,
              robLocationA: row["Location A - ROB"] !== void 0 ? String(row["Location A - ROB"]) : existingItem.robLocationA,
              robLocationB: row["Location B - ROB"] !== void 0 ? String(row["Location B - ROB"]) : existingItem.robLocationB,
              locationA: row["Location A"] ? String(row["Location A"]).trim() : existingItem.locationA,
              locationB: row["Location B"] ? String(row["Location B"]).trim() : existingItem.locationB,
              min: row["Min"] !== void 0 ? String(row["Min"]) : existingItem.min
            });
            storesByItemCode.set(itemCode, updated);
            result.updated++;
            if (importHistoryId) {
              await trackChange(importHistoryId, "updated", "storesItem", String(existingItem.id), previousSnapshot, updated);
            }
            console.log(`\u2705 Updated stores item (upsert): ${itemCode}`);
          } else {
            const newStoresItem = await storage.createStoresItem({
              vesselId: vesselId || "",
              itemCode,
              impaCode: row["IMPA Code"] ? String(row["IMPA Code"]).trim() : null,
              itemName,
              itemType,
              category: categoryRaw || null,
              specification: null,
              uom: row["UOM"] ? String(row["UOM"]).trim() : null,
              rob: String(getTotalRob()),
              robLocationA: String(getLocationARob()),
              robLocationB: String(getLocationBRob()),
              locationA: row["Location A"] ? String(row["Location A"]).trim() : null,
              locationB: row["Location B"] ? String(row["Location B"]).trim() : null,
              min: String(row["Min"] ?? 0),
              max: null,
              unitCost: null,
              supplier: null,
              lastOrderDate: null,
              leadTime: null,
              ihm: false,
              ihmDetails: null,
              remarks: null,
              isActive: true
            });
            storesByItemCode.set(itemCode, newStoresItem);
            result.created++;
            if (importHistoryId) {
              await trackChange(importHistoryId, "created", "storesItem", String(newStoresItem.id), null, newStoresItem);
            }
            console.log(`\u2705 Created stores item (upsert): ${itemCode} - ${itemName}`);
          }
        }
      } catch (error) {
        console.error(`\u274C Error processing stores item row:`, error);
        result.skipped++;
      }
    }
    console.log(`\u2705 Stores import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } else if (type === "work-orders") {
    console.log(`\u{1F680} Starting work-orders import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}`);
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear().toString();
    const woSequenceMap = /* @__PURE__ */ new Map();
    const allWorkOrders = await storage.getWorkOrders(vesselId);
    const allTemplateCodes = data.map((row) => {
      const componentCode = String(row["Generated_Component_Code"]).trim();
      const componentYearKey = `${componentCode}-${currentYear}`;
      if (!woSequenceMap.has(componentYearKey)) {
        const componentYearWOs = allWorkOrders.filter(
          (wo) => wo.templateCode?.startsWith(`WO-${componentCode}-${currentYear}-`)
        );
        const maxSeq = componentYearWOs.length > 0 ? Math.max(...componentYearWOs.map((wo) => {
          const match = wo.templateCode?.match(/-(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })) : 0;
        woSequenceMap.set(componentYearKey, maxSeq + 1);
      }
      const sequence = woSequenceMap.get(componentYearKey);
      return `WO-${componentCode}-${currentYear}-${String(sequence).padStart(2, "0")}`;
    });
    const workOrdersByTemplateCode = await storage.getWorkOrdersByTemplateIds(allTemplateCodes, vesselId);
    for (const row of data) {
      const componentCode = String(row["Generated_Component_Code"]).trim();
      const componentYearKey = `${componentCode}-${currentYear}`;
      const sequence = woSequenceMap.get(componentYearKey);
      const templateCode = `WO-${componentCode}-${currentYear}-${String(sequence).padStart(2, "0")}`;
      const existingWorkOrder = workOrdersByTemplateCode.get(templateCode);
      if (mode === "add") {
        if (!existingWorkOrder) {
          const newWorkOrder = await createWorkOrderFromRow(row, templateCode, vesselId);
          workOrdersByTemplateCode.set(templateCode, newWorkOrder);
          result.created++;
          woSequenceMap.set(componentYearKey, sequence + 1);
          if (importHistoryId) {
            await trackChange(importHistoryId, "created", "workOrder", newWorkOrder.id, null, newWorkOrder);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === "update") {
        if (existingWorkOrder) {
          const previousSnapshot = createRecordSnapshot(existingWorkOrder);
          const updatedWorkOrder = await updateWorkOrderFromRow(existingWorkOrder.id, row);
          workOrdersByTemplateCode.set(templateCode, updatedWorkOrder);
          result.updated++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "updated", "workOrder", updatedWorkOrder.id, existingWorkOrder, updatedWorkOrder);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === "upsert") {
        if (existingWorkOrder) {
          const previousSnapshot = createRecordSnapshot(existingWorkOrder);
          const updatedWorkOrder = await updateWorkOrderFromRow(existingWorkOrder.id, row);
          workOrdersByTemplateCode.set(templateCode, updatedWorkOrder);
          result.updated++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "updated", "workOrder", updatedWorkOrder.id, existingWorkOrder, updatedWorkOrder);
          }
        } else {
          const newWorkOrder = await createWorkOrderFromRow(row, templateCode, vesselId);
          workOrdersByTemplateCode.set(templateCode, newWorkOrder);
          result.created++;
          woSequenceMap.set(componentYearKey, sequence + 1);
          if (importHistoryId) {
            await trackChange(importHistoryId, "created", "workOrder", newWorkOrder.id, null, newWorkOrder);
          }
        }
      }
    }
    if (archiveMissing) {
      const importedTemplateCodes = new Set(allTemplateCodes);
      for (const workOrder of allWorkOrders) {
        if (workOrder.templateCode && !importedTemplateCodes.has(workOrder.templateCode)) {
          const previousSnapshot = createRecordSnapshot(workOrder);
          const archivedWorkOrder = await storage.archiveWorkOrder(workOrder.id);
          result.archived++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "archived", "workOrder", workOrder.id, workOrder, archivedWorkOrder);
          }
          console.log(`\u{1F4E6} Archived work order: ${workOrder.templateCode}`);
        }
      }
    }
    console.log(`\u2705 Work-orders import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.archived} archived`);
  } else if (type === "jobs") {
    console.log(`\u{1F680} Starting jobs import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}`);
    const allJobNos = data.map((row) => row["Job Code"] ? String(row["Job Code"]).trim() : null).filter(Boolean);
    const jobsByJobNo = await storage.getJobsByJobNos(allJobNos, vesselId);
    const allComponentCodes = data.map((row) => String(row["Component Code"]).trim());
    const componentsByCode = await storage.getComponentsByCodes(allComponentCodes, vesselId);
    for (const row of data) {
      const componentCode = String(row["Component Code"]).trim();
      const vesselCodeFromExcel = String(row["Vessel Code"]).trim();
      const component = componentsByCode.get(componentCode);
      if (!component) {
        console.error(`\u26A0\uFE0F Component not found: ${componentCode}, skipping job`);
        result.skipped++;
        continue;
      }
      const canonicalVesselId = vesselId || vesselCodeFromExcel;
      const rawLastDone = row["Last Done Date"];
      let lastDoneDate = rawLastDone ? normalizeDateToDDMMMYYYY(rawLastDone) : null;
      if (!lastDoneDate && component.installationDate) {
        try {
          lastDoneDate = normalizeDateToDDMMMYYYY(component.installationDate);
        } catch (error) {
          console.warn(`\u26A0\uFE0F Could not normalize installation date for component ${componentCode}: ${component.installationDate}`);
          lastDoneDate = null;
        }
      }
      const frequencyValue = row["Interval Value"] ? String(row["Interval Value"]).trim() : null;
      const frequencyUnit = row["Unit"] ? String(row["Unit"]).trim() : null;
      const maintenanceBasis = row["Maintenance Basis"];
      let nextDueDate = null;
      if (maintenanceBasis === "Calendar" && lastDoneDate && frequencyValue && frequencyUnit) {
        nextDueDate = calculateNextDueDate(lastDoneDate, frequencyValue, frequencyUnit);
      }
      let nextDueRH = null;
      let lastDoneRH = null;
      let intervalRH = null;
      const rawIntervalRH = row["Interval Running Hours"];
      const hasExplicitIntervalRH = rawIntervalRH !== void 0 && rawIntervalRH !== null && String(rawIntervalRH).trim() !== "";
      if (hasExplicitIntervalRH) {
        intervalRH = Number(String(rawIntervalRH).trim());
      } else if (maintenanceBasis === "Running Hours" && frequencyValue) {
        intervalRH = Number(frequencyValue);
      }
      if (maintenanceBasis === "Running Hours") {
        if (intervalRH === null || isNaN(intervalRH) || intervalRH <= 0) {
          result.skipped++;
          console.warn(`\u26A0\uFE0F Skipping RH job for component ${componentCode}: Invalid or missing Interval Running Hours (must be > 0)`);
          continue;
        }
        const rawLastDoneRH = row["Last Done RH"];
        if (rawLastDoneRH !== void 0 && rawLastDoneRH !== null && rawLastDoneRH !== "") {
          lastDoneRH = String(rawLastDoneRH).trim();
        } else if (component.runningHours !== void 0 && component.runningHours !== null) {
          lastDoneRH = String(component.runningHours);
        } else {
          lastDoneRH = "0";
          console.log(`\u2139\uFE0F Component ${componentCode} has no running hours - defaulting Last Done RH to 0`);
        }
        const lastRH = Number(lastDoneRH);
        if (isNaN(lastRH)) {
          result.skipped++;
          console.warn(`\u26A0\uFE0F Skipping RH job for component ${componentCode}: lastDoneRH is not a valid number`);
          continue;
        }
        nextDueRH = String(lastRH + intervalRH);
      }
      const parseStringList = (value) => {
        if (!value) return [];
        const str = String(value).trim();
        if (!str) return [];
        return str.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
      };
      const parseSpareParts = (value) => {
        const items = parseStringList(value);
        return items.map((item) => ({
          partNo: "",
          description: item,
          quantityRequired: "",
          remarks: ""
        }));
      };
      const parseTools = (value) => {
        const items = parseStringList(value);
        return items.map((item) => ({
          toolName: item,
          quantity: "",
          remarks: ""
        }));
      };
      const jobData = {
        vesselId: canonicalVesselId,
        // FK reference to vessel
        vesselCode: vesselCodeFromExcel,
        // Display/tracking field from Excel
        componentId: component.id,
        // FK reference to component (UUID)
        componentCode,
        // Display/tracking field (SFI code)
        componentName: row["Component Name"] || component.name || null,
        fleetEquipmentCode: row["Fleet Equipment Code"] || null,
        fleetEquipmentName: row["Fleet Equipment Name"] || null,
        jobTitle: row["WO Title"],
        // Job title from WO Title column
        maintenanceType: row["Task Type"],
        // maintenanceType from Task Type column
        maintenanceBasis,
        frequencyValue: frequencyValue ? parseFloat(frequencyValue) : null,
        frequencyUnit,
        // For Running Hours jobs: store interval in both fields for compatibility
        intervalRunningHour: intervalRH,
        internalRunningHourNumber: row["Interval Running Hours"] || null,
        jobDescription: row["Brief Work Description"] || null,
        briefWorkDescription: row["Brief Work Description"] || null,
        // Store in both fields for compatibility
        assignedTo: row["Assigned To"] || null,
        approver: row["Approver"] || null,
        jobPriority: row["Job Priority"] || null,
        // Schema expects text 'Yes'/'No', not boolean
        classRelated: row["Class Related"] ? row["Class Related"].toString().toLowerCase() === "yes" ? "Yes" : "No" : null,
        lastDoneDate,
        // Store Last Done date (for Calendar jobs)
        nextDueDate,
        // Calculated: lastDoneDate + frequencyValue + frequencyUnit (for Calendar jobs)
        lastDoneRH,
        // Store Last Done RH (for RH jobs)
        nextDueRH,
        // Calculated: lastDoneRH + intervalRunningHour (for RH jobs)
        department: row["Department"] || null,
        // Support both template format (Critical Yes/No) and legacy format (Criticality)
        // Schema expects text 'Yes'/'No', not boolean
        criticality: (() => {
          const critVal = row["Critical Yes/No"] ?? row["Criticality"];
          if (!critVal) return null;
          const isYes = critVal === true || critVal.toString().toLowerCase() === "yes" || critVal.toString().toLowerCase() === "y";
          return isYes ? "Yes" : "No";
        })(),
        isActive: row["Is Active"] ? row["Is Active"].toString().toLowerCase() === "yes" : true,
        // Part A fields - Required Spare Parts, Tools, and Safety Requirements
        // Spare parts and tools are parsed into structured objects matching schema
        requiredSpareParts: parseSpareParts(row["Required Spare Parts"]),
        requiredTools: parseTools(row["Required Tools"]),
        safetyRequirements: {
          ppeRequirements: parseStringList(row["PPE Requirements"]),
          permitRequirements: parseStringList(row["Permit Requirements"]),
          otherRequirements: parseStringList(row["Other Safety Requirements"])
        }
      };
      if (!row["Job Code"]) {
        const { generateJobNumber: generateJobNumber2 } = await Promise.resolve().then(() => (init_workOrderNumbering(), workOrderNumbering_exports));
        jobData.jobNo = await generateJobNumber2(storage, jobData.taskType);
      } else {
        jobData.jobNo = String(row["Job Code"]).trim();
      }
      const existingJob = jobsByJobNo.get(jobData.jobNo);
      if (mode === "add") {
        if (!existingJob) {
          const createdJob = await storage.createJob(jobData);
          jobsByJobNo.set(createdJob.jobNo, createdJob);
          result.created++;
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(createdJob.id);
            await trackChange(importHistoryId, "created", "job", createdJob.id, null, canonicalJob);
          }
        } else {
          if (existingJob.componentId !== component.id) {
            try {
              const existingLinks = await storage.getJobComponentLinksByJob(existingJob.id);
              const linkAlreadyExists = existingLinks.some((link) => link.componentId === component.id);
              if (!linkAlreadyExists) {
                await storage.createJobComponentLink({
                  vesselId: canonicalVesselId,
                  jobId: existingJob.id,
                  componentId: component.id,
                  linkedBy: "system-bulk-import"
                });
                console.log(`\u{1F517} Linked job ${jobData.jobNo} to additional component ${componentCode}`);
                result.updated++;
              } else {
                console.log(`\u23ED\uFE0F Job ${jobData.jobNo} already linked to component ${componentCode}, skipping`);
                result.skipped++;
              }
            } catch (linkError) {
              console.warn(`\u26A0\uFE0F Failed to create job-component link for ${jobData.jobNo} -> ${componentCode}: ${linkError.message}`);
              result.skipped++;
            }
          } else {
            console.log(`\u23ED\uFE0F Job ${jobData.jobNo} already exists for same component, skipping`);
            result.skipped++;
          }
        }
      } else if (mode === "update") {
        if (existingJob) {
          const previousSnapshot = createRecordSnapshot(existingJob);
          const updatedJob = await storage.updateJob(existingJob.id, jobData);
          jobsByJobNo.set(updatedJob.jobNo, updatedJob);
          result.updated++;
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(updatedJob.id);
            await trackChange(importHistoryId, "updated", "job", updatedJob.id, existingJob, canonicalJob);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === "upsert") {
        if (existingJob) {
          if (existingJob.componentId !== component.id) {
            try {
              const existingLinks = await storage.getJobComponentLinksByJob(existingJob.id);
              const linkAlreadyExists = existingLinks.some((link) => link.componentId === component.id);
              if (!linkAlreadyExists) {
                await storage.createJobComponentLink({
                  vesselId: canonicalVesselId,
                  jobId: existingJob.id,
                  componentId: component.id,
                  linkedBy: "system-bulk-import"
                });
                console.log(`\u{1F517} Linked job ${jobData.jobNo} to additional component ${componentCode} (upsert mode)`);
                result.updated++;
              } else {
                console.log(`\u23ED\uFE0F Job ${jobData.jobNo} already linked to component ${componentCode}, skipping`);
                result.skipped++;
              }
            } catch (linkError) {
              console.warn(`\u26A0\uFE0F Failed to create job-component link for ${jobData.jobNo} -> ${componentCode}: ${linkError.message}`);
              result.skipped++;
            }
          } else {
            const previousSnapshot = createRecordSnapshot(existingJob);
            const updatedJob = await storage.updateJob(existingJob.id, jobData);
            jobsByJobNo.set(updatedJob.jobNo, updatedJob);
            result.updated++;
            if (importHistoryId) {
              const canonicalJob = await storage.getJob(updatedJob.id);
              await trackChange(importHistoryId, "updated", "job", updatedJob.id, existingJob, canonicalJob);
            }
          }
        } else {
          const createdJob = await storage.createJob(jobData);
          jobsByJobNo.set(createdJob.jobNo, createdJob);
          result.created++;
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(createdJob.id);
            await trackChange(importHistoryId, "created", "job", createdJob.id, null, canonicalJob);
          }
        }
      }
    }
    if (archiveMissing) {
      const importedJobNos = new Set(
        data.map((row) => row["Job Code"] ? String(row["Job Code"]).trim() : null).filter(Boolean)
      );
      const allVesselJobs = await storage.getJobs(vesselId);
      for (const job of allVesselJobs) {
        if (job.jobNo && !importedJobNos.has(job.jobNo)) {
          const previousSnapshot = createRecordSnapshot(job);
          const archivedJob = await storage.archiveJob(job.id);
          result.archived++;
          if (importHistoryId) {
            await trackChange(importHistoryId, "archived", "job", job.id, job, archivedJob);
          }
          console.log(`\u{1F4E6} Archived job: ${job.jobNo}`);
        }
      }
    }
    console.log(`\u2705 Jobs import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.archived} archived`);
  }
  return result;
}
async function createComponentFromRow(row, vesselId) {
  const componentCode = String(row["Component Code"] || row["Generated Code"] || row["Original SFI Code"]).trim();
  let makerName = row["Maker"] || row["Maker Name"] || null;
  const makerCode = row["Maker Code"] || null;
  if (!makerName && makerCode) {
    const maker = await storage.getMakerListByCode(String(makerCode).trim());
    if (maker) {
      makerName = maker.makerName;
    }
  }
  const departmentValue = row["Equipment / System Department"] || row["Eqpt / System Department"] || null;
  const criticalValue = row["Criticality"] ?? row["Critical Yes/No"] ?? row["Critical (Yes/No)"];
  const isCritical = criticalValue === true || criticalValue === "Yes";
  const conditionBasedValue = row["Condition Based"] ?? row["Condition Based Yes/No"] ?? row["Condition Based (Yes/No)"];
  const isConditionBased = conditionBasedValue === true || conditionBasedValue === "Yes";
  const isParentValue = row["IS Parent"] ?? row["IS Parent Yes/No"];
  const isParent = isParentValue === true || isParentValue === "Yes";
  const classItemValue = row["Class Item"] ?? row["Class item"];
  const isClassItem = classItemValue === true || classItemValue === "Yes";
  const rhCounterType = (row["RH Counter Type"] || "NOT_RH_DRIVEN").toString().toUpperCase().trim();
  const rhCounterSource = row["RH Counter Source"] || null;
  const runningHoursValue = row["Running Hours"] ? String(row["Running Hours"]) : null;
  const lastUpdatedValue = row["Last Updated"] ? normalizeDateToDDMMMYYYY(row["Last Updated"]) : null;
  let rhCurrentMaster = null;
  let rhCurrentInheritedCached = null;
  let rhMasterComponentId = null;
  let rhMasterUpdatedAt = null;
  let rhInheritedUpdatedAt = null;
  let rhMasterUpdateSource = null;
  if (rhCounterType === "MASTER") {
    rhCurrentMaster = runningHoursValue;
    rhMasterUpdatedAt = /* @__PURE__ */ new Date();
    rhMasterUpdateSource = "IMPORT";
  } else if (rhCounterType === "INHERITED") {
    rhCurrentInheritedCached = runningHoursValue;
    rhInheritedUpdatedAt = /* @__PURE__ */ new Date();
    rhMasterComponentId = rhCounterSource && rhCounterSource !== "SELF" ? rhCounterSource : null;
  }
  const componentData = {
    componentCode,
    name: row["Component Name"] || "",
    category: row["Component Category"] || row["Main Group Name"] || "",
    // Use Parent Component Code (auto-calculated from SFI)
    parentId: row["Parent Component Code"] ? String(row["Parent Component Code"]).trim() : null,
    vesselId: vesselId || row["Vessel Code"] || "V001",
    // Vessel FK/reference (fallback to Vessel Code from Excel)
    vesselCode: row["Vessel Code"] || null,
    // CRITICAL: Vessel identification code for tracking/display
    // Fleet Equipment fields
    fleetEquipmentCode: row["Fleet Equipment Code"] || null,
    fleetEquipmentName: row["Fleet Equipment Name"] || null,
    parentFleetEquipmentCode: null,
    // Not in Excel template, can be added later
    // Maker and Model fields - resolve name from code if needed
    maker: makerName,
    makerCode,
    model: row["Model"] || null,
    modelCode: row["Model Code"] || row["Model Number"] || null,
    // Support both new and legacy headers
    // Component specific fields
    serialNo: row["Serial No"] || null,
    drawingNo: row["Drawing No"] || null,
    // Department and categorization - support both new and legacy headers
    department: departmentValue,
    deptCategory: departmentValue,
    componentCategory: row["Component Category"] || row["Main Group Name"] || null,
    location: row["Location"] || null,
    equipmentDepartment: departmentValue,
    // Dates - Convert Excel serial numbers to DD-MMM-YYYY format
    commissionedDate: row["Commissioned Date"] ? normalizeDateToDDMMMYYYY(row["Commissioned Date"]) : null,
    installationDate: row["Installation Date"] ? normalizeDateToDDMMMYYYY(row["Installation Date"]) : null,
    // Status and classification - Support both template format and legacy format
    critical: isCritical,
    criticality: isCritical ? "Yes" : "No",
    classItem: isClassItem,
    conditionBased: isConditionBased,
    isActive: row["IS Active"] !== false && row["IS Active"] !== "No",
    // Default to true
    isParent,
    // Technical specifications
    rating: row["Rating"] || null,
    parentComponent: row["Parent Component Code"] ? String(row["Parent Component Code"]).trim() : null,
    notes: row["Notes"] || null,
    // Running Hours (legacy field - kept for backward compatibility)
    runningHours: runningHoursValue,
    currentCumulativeRH: runningHoursValue || "0",
    // RH Counter fields - mapped based on Counter Type
    rhCounterType,
    rhCounterSource,
    // MASTER-specific fields
    rhCurrentMaster,
    rhMasterUpdatedAt,
    rhMasterUpdateSource,
    // INHERITED-specific fields
    rhMasterComponentId,
    rhCurrentInheritedCached,
    rhInheritedUpdatedAt,
    // Last Updated
    lastUpdated: lastUpdatedValue
  };
  console.log(`\u{1F4E6} Creating component: ${componentCode} - ${componentData.name}`);
  const result = await storage.createComponent(componentData);
  console.log(`\u2705 Component created: ${componentCode}`);
  return result;
}
async function updateComponentFromRow(componentCode, row, vesselId, existingComponent) {
  const updateData = {};
  if (row["Component Name"]) updateData.name = row["Component Name"];
  if (row["Component Category"] || row["Main Group Name"]) {
    updateData.category = row["Component Category"] || row["Main Group Name"];
  }
  if (row["Parent Component Code"]) {
    updateData.parentId = String(row["Parent Component Code"]).trim();
  }
  if (row["Fleet Equipment Code"]) updateData.fleetEquipmentCode = row["Fleet Equipment Code"];
  if (row["Fleet Equipment Name"]) updateData.fleetEquipmentName = row["Fleet Equipment Name"];
  const makerFromExcel = row["Maker"] || row["Maker Name"];
  if (makerFromExcel) {
    updateData.maker = makerFromExcel;
  } else if (row["Maker Code"]) {
    const maker = await storage.getMakerListByCode(String(row["Maker Code"]).trim());
    if (maker) {
      updateData.maker = maker.makerName;
    }
  }
  if (row["Maker Code"]) updateData.makerCode = row["Maker Code"];
  if (row["Model"]) updateData.model = row["Model"];
  const modelCodeValue = row["Model Code"] || row["Model Number"];
  if (modelCodeValue) updateData.modelCode = modelCodeValue;
  if (row["Serial No"]) updateData.serialNo = row["Serial No"];
  if (row["Drawing No"]) updateData.drawingNo = row["Drawing No"];
  const deptValue = row["Equipment / System Department"] || row["Eqpt / System Department"];
  if (deptValue) {
    updateData.department = deptValue;
    updateData.deptCategory = deptValue;
    updateData.equipmentDepartment = deptValue;
  }
  if (row["Component Category"] || row["Main Group Name"]) {
    updateData.componentCategory = row["Component Category"] || row["Main Group Name"];
  }
  if (row["Location"]) updateData.location = row["Location"];
  if (row["Commissioned Date"]) updateData.commissionedDate = normalizeDateToDDMMMYYYY(row["Commissioned Date"]);
  if (row["Installation Date"]) updateData.installationDate = normalizeDateToDDMMMYYYY(row["Installation Date"]);
  const criticalValue = row["Criticality"] ?? row["Critical Yes/No"] ?? row["Critical (Yes/No)"];
  if (criticalValue !== void 0) {
    const isCritical = criticalValue === true || criticalValue === "Yes";
    updateData.critical = isCritical;
    updateData.criticality = isCritical ? "Yes" : "No";
  }
  const conditionBasedValue = row["Condition Based"] ?? row["Condition Based Yes/No"] ?? row["Condition Based (Yes/No)"];
  if (conditionBasedValue !== void 0) {
    updateData.conditionBased = conditionBasedValue === true || conditionBasedValue === "Yes";
  }
  if (row["IS Active"] !== void 0) {
    updateData.isActive = row["IS Active"] !== false && row["IS Active"] !== "No";
  }
  const isParentValue = row["IS Parent"] ?? row["IS Parent Yes/No"];
  if (isParentValue !== void 0) {
    updateData.isParent = isParentValue === true || isParentValue === "Yes";
  }
  const classItemValue = row["Class Item"] ?? row["Class item"];
  if (classItemValue !== void 0) {
    updateData.classItem = classItemValue === true || classItemValue === "Yes";
  }
  if (row["Rating"]) updateData.rating = row["Rating"];
  if (row["Parent Component Code"]) updateData.parentComponent = String(row["Parent Component Code"]).trim();
  if (row["Notes"]) updateData.notes = row["Notes"];
  const rhCounterType = row["RH Counter Type"] ? row["RH Counter Type"].toString().toUpperCase().trim() : null;
  const rhCounterSource = row["RH Counter Source"] || null;
  const runningHoursValue = row["Running Hours"] ? String(row["Running Hours"]) : null;
  if (runningHoursValue !== null) {
    updateData.runningHours = runningHoursValue;
    updateData.currentCumulativeRH = runningHoursValue;
  }
  if (rhCounterType) {
    updateData.rhCounterType = rhCounterType;
    if (rhCounterType === "MASTER") {
      if (runningHoursValue !== null) {
        updateData.rhCurrentMaster = runningHoursValue;
        updateData.rhMasterUpdatedAt = /* @__PURE__ */ new Date();
        updateData.rhMasterUpdateSource = "IMPORT";
      }
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
    } else if (rhCounterType === "INHERITED") {
      if (runningHoursValue !== null) {
        updateData.rhCurrentInheritedCached = runningHoursValue;
        updateData.rhInheritedUpdatedAt = /* @__PURE__ */ new Date();
      }
      if (rhCounterSource && rhCounterSource !== "SELF") {
        updateData.rhMasterComponentId = rhCounterSource;
      }
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdateSource = null;
    } else if (rhCounterType === "NOT_RH_DRIVEN") {
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdateSource = null;
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
    }
  }
  if (rhCounterSource) updateData.rhCounterSource = rhCounterSource;
  if (row["Last Updated"]) updateData.lastUpdated = normalizeDateToDDMMMYYYY(row["Last Updated"]);
  if (row["Vessel Code"]) {
    updateData.vesselId = row["Vessel Code"];
    updateData.vesselCode = row["Vessel Code"];
  }
  let component = existingComponent;
  if (!component) {
    const lookupVesselId = row["Vessel Code"] || vesselId;
    if (!lookupVesselId) {
      throw new Error(`Cannot update component '${componentCode}': Vessel Code is required. Please ensure the 'Vessel Code' column is populated in your data.`);
    }
    component = await storage.getComponentByCode(componentCode, lookupVesselId);
    if (!component && componentCode.includes("-") && componentCode.length > 15) {
      try {
        const compById = await storage.getComponent(componentCode);
        if (compById && compById.vesselId === lookupVesselId) {
          component = compById;
          console.log(`\u2705 Component found by ID fallback: ${componentCode} (vessel: ${lookupVesselId})`);
        } else if (compById) {
          console.warn(`\u26A0\uFE0F Component ID ${componentCode} found but belongs to vessel ${compById.vesselId}, not ${lookupVesselId}`);
        }
      } catch (e) {
      }
    }
  }
  if (!component) {
    const lookupVesselId = row["Vessel Code"] || vesselId || "UNKNOWN";
    throw new Error(`Component code '${componentCode}' not found for vessel '${lookupVesselId}'. Verify that the component exists in this vessel and that the component_code matches exactly.`);
  }
  return await storage.updateComponent(component.id, updateData);
}
async function createWorkOrderFromRow(row, templateCode, vesselId) {
  const componentCode = String(row["Generated_Component_Code"]).trim();
  const component = await storage.getComponent(componentCode);
  let jobId = null;
  let matchingJob = null;
  const jobTitle = row["Job_Title"] || "";
  const effectiveVesselId = vesselId || "V001";
  if (component && jobTitle) {
    try {
      const jobs2 = await storage.getJobs(effectiveVesselId);
      matchingJob = jobs2.find(
        (j) => j.componentId === component.id && j.jobTitle === jobTitle
      );
      if (matchingJob) {
        jobId = matchingJob.id;
        console.log(`Auto-resolved jobId: ${matchingJob.id} for imported work order with component ${componentCode} and job "${jobTitle}"`);
      }
    } catch (error) {
      console.error("Failed to auto-resolve jobId during bulk import:", error);
    }
  }
  let workOrderNo;
  const jobCode = matchingJob?.jobNo || row["Job_Code"];
  if (jobCode) {
    if (!componentCode || !componentCode.trim()) {
      throw new Error(`Component code is required for planned work order generation. Row has Job_Code "${jobCode}" but no component code.`);
    }
    workOrderNo = await generatePlannedWorkOrderNumber(storage, jobCode, componentCode, effectiveVesselId);
  } else {
    workOrderNo = await generateUnplannedWorkOrderNumber(storage, effectiveVesselId);
  }
  const workOrderData = {
    vesselId: effectiveVesselId,
    component: component?.name || row["Component_Name"] || componentCode,
    componentCode,
    jobId,
    workOrderNo,
    templateCode,
    jobTitle,
    assignedTo: row["Responsible_Rank"] || "",
    approver: null,
    dueDate: (/* @__PURE__ */ new Date()).toISOString(),
    status: "Due",
    taskType: null,
    maintenanceBasis: row["Schedule_Type"] || null,
    frequencyValue: row["Interval"] ? String(row["Interval"]) : null,
    frequencyUnit: row["Interval_Unit"] || null,
    classRelated: row["Criticality"] || null,
    jobPriority: null,
    briefWorkDescription: row["Job_Description"] || null
  };
  return await storage.createWorkOrder(workOrderData);
}
async function updateWorkOrderFromRow(workOrderId, row) {
  const updateData = {};
  if (row["Job_Title"]) updateData.jobTitle = row["Job_Title"];
  if (row["Schedule_Type"]) updateData.maintenanceBasis = row["Schedule_Type"];
  if (row["Interval"]) updateData.frequencyValue = String(row["Interval"]);
  if (row["Interval_Unit"]) updateData.frequencyUnit = row["Interval_Unit"];
  if (row["Responsible_Rank"]) updateData.assignedTo = row["Responsible_Rank"];
  if (row["Criticality"]) updateData.classRelated = row["Criticality"];
  if (row["Job_Description"]) updateData.briefWorkDescription = row["Job_Description"];
  return await storage.updateWorkOrder(workOrderId, updateData);
}
async function storeImportHistory(data) {
  const result = await saveImportHistory({
    id: data.id,
    type: data.type,
    mode: data.mode,
    vesselId: data.vesselId,
    userId: data.userId,
    startedAt: data.startedAt || (/* @__PURE__ */ new Date()).toISOString(),
    completedAt: data.finishedAt || (/* @__PURE__ */ new Date()).toISOString(),
    status: data.status,
    created: data.created || 0,
    updated: data.updated || 0,
    skipped: data.skipped || 0,
    archived: data.archived || 0,
    originalName: data.originalName,
    storedFilePath: data.storedFilePath || null,
    errorReport: null
  });
  return result;
}
async function getImportHistory(type, limit, offset) {
  const result = await getImportHistoryList(type, limit, offset);
  return {
    items: result.items.map((h) => ({
      id: h.id,
      date: h.startedAt,
      user: h.userId,
      mode: h.mode,
      type: h.type,
      created: h.created,
      updated: h.updated,
      skipped: h.skipped,
      archived: h.archived,
      status: h.status,
      originalName: h.originalName,
      storedFilePath: h.storedFilePath
    })),
    total: result.total
  };
}
async function getHistoryFile(id, fileType) {
  const history = await getImportHistoryById(id);
  if (!history) return null;
  if (fileType === "file") {
    return null;
  }
  return null;
}
router.post("/undo/:historyId", async (req, res) => {
  const { historyId } = req.params;
  try {
    const history = await getImportHistoryById(historyId);
    if (!history) {
      return res.status(404).json({ error: "Import history not found" });
    }
    if (history.status === "undone") {
      return res.status(400).json({ error: "Import has already been undone" });
    }
    if (history.status !== "complete") {
      return res.status(400).json({
        error: `Cannot undo import with status '${history.status}'. Only completed imports can be undone.`
      });
    }
    const changeLogs = await storage.getImportChangeLogs(historyId);
    if (changeLogs.length === 0) {
      return res.status(400).json({ error: "No change logs found for this import" });
    }
    console.log(`\u{1F504} Starting undo for import ${historyId} with ${changeLogs.length} change logs`);
    const conflicts = [];
    for (const log2 of changeLogs) {
      if (log2.operation === "created" && !log2.newData) continue;
      let currentEntity;
      if (log2.entityType === "component") {
        currentEntity = await storage.getComponent(log2.entityId);
      } else if (log2.entityType === "job") {
        currentEntity = await storage.getJob(log2.entityId);
      } else if (log2.entityType === "workOrder") {
        currentEntity = await storage.getWorkOrder(log2.entityId);
      } else if (log2.entityType === "storesItem") {
        currentEntity = await storage.getStoresItem(parseInt(log2.entityId));
      } else if (log2.entityType === "spare") {
        currentEntity = await storage.getSpare(parseInt(log2.entityId));
      }
      if (!currentEntity && log2.operation !== "created") {
        conflicts.push({
          entityType: log2.entityType,
          entityId: log2.entityId,
          reason: "Entity no longer exists"
        });
        continue;
      }
      if (currentEntity) {
        const currentChecksum = calculateRecordChecksum(currentEntity);
        const expectedData = log2.newData;
        const parsedExpectedData = typeof expectedData === "string" ? JSON.parse(expectedData) : expectedData;
        const expectedChecksum = parsedExpectedData ? calculateRecordChecksum(parsedExpectedData) : "";
        if (currentChecksum !== expectedChecksum) {
          conflicts.push({
            entityType: log2.entityType,
            entityId: log2.entityId,
            reason: "Entity has been modified since import"
          });
        }
      }
    }
    if (conflicts.length > 0) {
      console.log(`\u274C Undo aborted due to ${conflicts.length} conflicts`);
      return res.status(409).json({
        error: "Cannot undo import due to conflicts",
        conflicts,
        message: `${conflicts.length} entities have been modified since import. Undo operation aborted.`
      });
    }
    console.log(`\u2705 No conflicts detected, proceeding with undo`);
    const result = {
      deleted: 0,
      restored: 0,
      unarchived: 0
    };
    const appliedChanges = [];
    try {
      const reversedLogs = [...changeLogs].reverse();
      for (const log2 of reversedLogs) {
        let currentState;
        if (log2.entityType === "component") {
          currentState = await storage.getComponent(log2.entityId);
        } else if (log2.entityType === "job") {
          currentState = await storage.getJob(log2.entityId);
        } else if (log2.entityType === "workOrder") {
          currentState = await storage.getWorkOrder(log2.entityId);
        } else if (log2.entityType === "storesItem") {
          currentState = await storage.getStoresItem(parseInt(log2.entityId));
        } else if (log2.entityType === "spare") {
          currentState = await storage.getSpare(parseInt(log2.entityId));
        }
        if (log2.entityType === "component") {
          if (log2.operation === "created") {
            await storage.archiveComponent(log2.entityId);
            result.deleted++;
            console.log(`  \u2713 Archived component ${log2.entityId}`);
          } else if (log2.operation === "updated") {
            const previousData = log2.previousData;
            await storage.updateComponent(log2.entityId, previousData);
            result.restored++;
            console.log(`  \u2713 Restored component ${log2.entityId}`);
          } else if (log2.operation === "archived") {
            await storage.updateComponent(log2.entityId, { isActive: true });
            result.unarchived++;
            console.log(`  \u2713 Unarchived component ${log2.entityId}`);
          }
        } else if (log2.entityType === "job") {
          if (log2.operation === "created") {
            await storage.archiveJob(log2.entityId);
            result.deleted++;
            console.log(`  \u2713 Archived job ${log2.entityId}`);
          } else if (log2.operation === "updated") {
            const previousData = log2.previousData;
            await storage.updateJob(log2.entityId, previousData);
            result.restored++;
            console.log(`  \u2713 Restored job ${log2.entityId}`);
          } else if (log2.operation === "archived") {
            await storage.updateJob(log2.entityId, { isActive: true });
            result.unarchived++;
            console.log(`  \u2713 Unarchived job ${log2.entityId}`);
          }
        } else if (log2.entityType === "workOrder") {
          if (log2.operation === "created") {
            await storage.archiveWorkOrder(log2.entityId);
            result.deleted++;
            console.log(`  \u2713 Archived work order ${log2.entityId}`);
          } else if (log2.operation === "updated") {
            const previousData = log2.previousData;
            await storage.updateWorkOrder(log2.entityId, previousData);
            result.restored++;
            console.log(`  \u2713 Restored work order ${log2.entityId}`);
          } else if (log2.operation === "archived") {
            await storage.updateWorkOrder(log2.entityId, { isActive: true });
            result.unarchived++;
            console.log(`  \u2713 Unarchived work order ${log2.entityId}`);
          }
        } else if (log2.entityType === "storesItem") {
          const storesItemId = parseInt(log2.entityId);
          if (log2.operation === "created") {
            await storage.deleteStoresItem(storesItemId);
            result.deleted++;
            console.log(`  \u2713 Deleted stores item ${log2.entityId}`);
          } else if (log2.operation === "updated") {
            const previousData = log2.previousData;
            await storage.updateStoresItem(storesItemId, previousData);
            result.restored++;
            console.log(`  \u2713 Restored stores item ${log2.entityId}`);
          } else if (log2.operation === "archived") {
            await storage.updateStoresItem(storesItemId, { isActive: true, deleted: false });
            result.unarchived++;
            console.log(`  \u2713 Unarchived stores item ${log2.entityId}`);
          }
        } else if (log2.entityType === "spare") {
          const spareId = parseInt(log2.entityId);
          if (log2.operation === "created") {
            await storage.deleteSpare(spareId);
            result.deleted++;
            console.log(`  \u2713 Deleted spare ${log2.entityId}`);
          } else if (log2.operation === "updated") {
            const previousData = log2.previousData;
            await storage.updateSpare(spareId, previousData);
            result.restored++;
            console.log(`  \u2713 Restored spare ${log2.entityId}`);
          } else if (log2.operation === "archived") {
            await storage.updateSpare(spareId, { isActive: true });
            result.unarchived++;
            console.log(`  \u2713 Unarchived spare ${log2.entityId}`);
          }
        }
        appliedChanges.push({ log: log2, previousState: currentState });
      }
      await updateImportHistory(historyId, {
        status: "undone"
      });
      console.log(`\u2705 Import ${historyId} successfully undone`);
      console.log(`   - Deleted: ${result.deleted}`);
      console.log(`   - Restored: ${result.restored}`);
      console.log(`   - Unarchived: ${result.unarchived}`);
      res.json({
        message: "Import successfully undone",
        ...result,
        historyId
      });
    } catch (undoError) {
      console.error("Undo operation failed, rolling back changes:", undoError);
      const rollbackErrors = [];
      for (const change of appliedChanges.reverse()) {
        try {
          if (change.previousState) {
            if (change.log.entityType === "component") {
              await storage.updateComponent(change.log.entityId, change.previousState);
              console.log(`  \u21A9\uFE0F Rolled back component ${change.log.entityId}`);
            } else if (change.log.entityType === "job") {
              await storage.updateJob(change.log.entityId, change.previousState);
              console.log(`  \u21A9\uFE0F Rolled back job ${change.log.entityId}`);
            } else if (change.log.entityType === "workOrder") {
              await storage.updateWorkOrder(change.log.entityId, change.previousState);
              console.log(`  \u21A9\uFE0F Rolled back work order ${change.log.entityId}`);
            } else if (change.log.entityType === "storesItem") {
              await storage.updateStoresItem(parseInt(change.log.entityId), change.previousState);
              console.log(`  \u21A9\uFE0F Rolled back stores item ${change.log.entityId}`);
            } else if (change.log.entityType === "spare") {
              await storage.updateSpare(parseInt(change.log.entityId), change.previousState);
              console.log(`  \u21A9\uFE0F Rolled back spare ${change.log.entityId}`);
            }
          }
        } catch (rollbackError) {
          rollbackErrors.push(`Failed to rollback ${change.log.entityType} ${change.log.entityId}: ${rollbackError.message}`);
          console.error(`  \u274C Rollback failed for ${change.log.entityType} ${change.log.entityId}:`, rollbackError);
        }
      }
      try {
        await updateImportHistory(historyId, {
          status: "undo_failed"
        });
      } catch (updateError) {
        console.error("Failed to update history status:", updateError);
      }
      console.log(`\u274C Import ${historyId} undo failed and rolled back`);
      console.log(`   - Applied changes before failure: ${appliedChanges.length}`);
      console.log(`   - Rollback status: ${rollbackErrors.length === 0 ? "success" : "partial"}`);
      return res.status(500).json({
        error: "Failed to undo import",
        details: undoError.message,
        rollbackStatus: rollbackErrors.length === 0 ? "success" : "partial",
        rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : void 0
      });
    }
  } catch (error) {
    console.error("Undo error:", error);
    try {
      await updateImportHistory(historyId, {
        status: "undo_failed"
      });
    } catch (updateError) {
      console.error("Failed to update history status:", updateError);
    }
    res.status(500).json({
      error: "Failed to undo import",
      details: error.message
    });
  }
});
router.get("/makers", async (req, res) => {
  try {
    const makers2 = await storage.getMakerList();
    res.json(makers2);
  } catch (error) {
    console.error("Error fetching makers:", error);
    res.status(500).json({ error: "Failed to fetch makers" });
  }
});
router.get("/makers/:id", async (req, res) => {
  try {
    const maker = await storage.getMakerListItem(parseInt(req.params.id));
    if (!maker) {
      return res.status(404).json({ error: "Maker not found" });
    }
    res.json(maker);
  } catch (error) {
    console.error("Error fetching maker:", error);
    res.status(500).json({ error: "Failed to fetch maker" });
  }
});
router.post("/makers", async (req, res) => {
  try {
    let { makerCode, makerName, address, addressId } = req.body;
    if (!makerName) {
      return res.status(400).json({ error: "Maker Name is required" });
    }
    if (!makerCode || makerCode.trim() === "") {
      const existingMakers = await storage.getMakerList();
      let maxNum = 0;
      for (const m of existingMakers) {
        const match = m.makerCode?.match(/MKR-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      makerCode = `MKR-${String(maxNum + 1).padStart(6, "0")}`;
    }
    const existing = await storage.getMakerListByCode(makerCode);
    if (existing) {
      return res.status(409).json({ error: `Maker Code '${makerCode}' already exists` });
    }
    const maker = await storage.createMakerListItem({
      makerCode,
      makerName,
      address: address || null,
      addressId: addressId || null
    });
    res.status(201).json(maker);
  } catch (error) {
    console.error("Error creating maker:", error);
    res.status(500).json({ error: "Failed to create maker" });
  }
});
router.patch("/makers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { makerCode, makerName, address, addressId } = req.body;
    const existing = await storage.getMakerListItem(id);
    if (!existing) {
      return res.status(404).json({ error: "Maker not found" });
    }
    if (makerCode && makerCode !== existing.makerCode) {
      const duplicate = await storage.getMakerListByCode(makerCode);
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ error: `Maker Code '${makerCode}' already exists` });
      }
    }
    const updated = await storage.updateMakerListItem(id, {
      makerCode: makerCode || existing.makerCode,
      makerName: makerName || existing.makerName,
      address: address !== void 0 ? address : existing.address,
      addressId: addressId !== void 0 ? addressId : existing.addressId
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating maker:", error);
    res.status(500).json({ error: "Failed to update maker" });
  }
});
router.delete("/makers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getMakerListItem(id);
    if (!existing) {
      return res.status(404).json({ error: "Maker not found" });
    }
    await storage.deleteMakerListItem(id);
    res.json({ message: "Maker deleted successfully" });
  } catch (error) {
    console.error("Error deleting maker:", error);
    res.status(500).json({ error: "Failed to delete maker" });
  }
});
router.post("/makers/import", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase().includes("maker") || name.toLowerCase() === "maker list"
    ) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      const makerCode = row["Maker Code"];
      const makerName = row["Maker Name"];
      const address = row["Address"] || null;
      if (!makerCode || !makerName) {
        results.errors.push(`Row ${rowNum}: Missing Maker Code or Maker Name`);
        results.skipped++;
        continue;
      }
      try {
        const existing = await storage.getMakerListByCode(String(makerCode).trim());
        if (existing) {
          await storage.updateMakerListItem(existing.id, {
            makerName: String(makerName).trim(),
            address: address ? String(address).trim() : null
          });
          results.updated++;
        } else {
          await storage.createMakerListItem({
            makerCode: String(makerCode).trim(),
            makerName: String(makerName).trim(),
            address: address ? String(address).trim() : null
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Row ${rowNum}: ${error.message}`);
        results.skipped++;
      }
    }
    console.log(`\u2705 Makers import complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);
    res.json(results);
  } catch (error) {
    console.error("Error importing makers:", error);
    res.status(500).json({ error: "Failed to import makers" });
  }
});
router.get("/sfi-details", async (req, res) => {
  try {
    const sfiDetails2 = await storage.getSfiDetails();
    res.json(sfiDetails2);
  } catch (error) {
    console.error("Error fetching SFI details:", error);
    res.status(500).json({ error: "Failed to fetch SFI details" });
  }
});
router.get("/sfi-details/:id", async (req, res) => {
  try {
    const sfi = await storage.getSfiDetail(parseInt(req.params.id));
    if (!sfi) {
      return res.status(404).json({ error: "SFI detail not found" });
    }
    res.json(sfi);
  } catch (error) {
    console.error("Error fetching SFI detail:", error);
    res.status(500).json({ error: "Failed to fetch SFI detail" });
  }
});
router.post("/sfi-details", async (req, res) => {
  try {
    const { componentCode, componentName, description } = req.body;
    if (!componentCode || !componentName) {
      return res.status(400).json({ error: "Component Code and Component Name are required" });
    }
    const existing = await storage.getSfiByCode(componentCode);
    if (existing) {
      return res.status(409).json({ error: `Component Code '${componentCode}' already exists` });
    }
    const sfi = await storage.createSfiDetail({
      componentCode,
      componentName,
      description: description || null
    });
    res.status(201).json(sfi);
  } catch (error) {
    console.error("Error creating SFI detail:", error);
    res.status(500).json({ error: "Failed to create SFI detail" });
  }
});
router.patch("/sfi-details/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { componentCode, componentName, description } = req.body;
    const existing = await storage.getSfiDetail(id);
    if (!existing) {
      return res.status(404).json({ error: "SFI detail not found" });
    }
    if (componentCode && componentCode !== existing.componentCode) {
      const duplicate = await storage.getSfiByCode(componentCode);
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ error: `Component Code '${componentCode}' already exists` });
      }
    }
    const updated = await storage.updateSfiDetail(id, {
      componentCode: componentCode || existing.componentCode,
      componentName: componentName || existing.componentName,
      description: description !== void 0 ? description : existing.description
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating SFI detail:", error);
    res.status(500).json({ error: "Failed to update SFI detail" });
  }
});
router.delete("/sfi-details/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getSfiDetail(id);
    if (!existing) {
      return res.status(404).json({ error: "SFI detail not found" });
    }
    await storage.deleteSfiDetail(id);
    res.json({ message: "SFI detail deleted successfully" });
  } catch (error) {
    console.error("Error deleting SFI detail:", error);
    res.status(500).json({ error: "Failed to delete SFI detail" });
  }
});
router.post("/sfi-details/import", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase().includes("sfi") || name.toLowerCase() === "sfi details"
    ) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      const componentCode = row["Component Code"];
      const componentName = row["Component Name"];
      const description = row["Description"] || null;
      if (!componentCode || !componentName) {
        results.errors.push(`Row ${rowNum}: Missing Component Code or Component Name`);
        results.skipped++;
        continue;
      }
      try {
        const existing = await storage.getSfiByCode(String(componentCode).trim());
        if (existing) {
          await storage.updateSfiDetail(existing.id, {
            componentName: String(componentName).trim(),
            description: description ? String(description).trim() : null
          });
          results.updated++;
        } else {
          await storage.createSfiDetail({
            componentCode: String(componentCode).trim(),
            componentName: String(componentName).trim(),
            description: description ? String(description).trim() : null
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Row ${rowNum}: ${error.message}`);
        results.skipped++;
      }
    }
    console.log(`\u2705 SFI details import complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);
    res.json(results);
  } catch (error) {
    console.error("Error importing SFI details:", error);
    res.status(500).json({ error: "Failed to import SFI details" });
  }
});
var bulk_default = router;

// server/routes/alerts.ts
init_storage();
import { Router as Router2 } from "express";
var router2 = Router2();
router2.get("/policies", async (req, res) => {
  try {
    const policies = await storage.getAlertPolicies();
    res.json(policies);
  } catch (error) {
    console.error("Error fetching alert policies:", error);
    res.status(500).json({ error: "Failed to fetch alert policies" });
  }
});
router2.get("/policies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const policy = await storage.getAlertPolicy(id);
    if (!policy) {
      return res.status(404).json({ error: "Alert policy not found" });
    }
    res.json(policy);
  } catch (error) {
    console.error("Error fetching alert policy:", error);
    res.status(500).json({ error: "Failed to fetch alert policy" });
  }
});
router2.patch("/policies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const policy = await storage.updateAlertPolicy(id, req.body);
    res.json(policy);
  } catch (error) {
    console.error("Error updating alert policy:", error);
    res.status(500).json({ error: "Failed to update alert policy" });
  }
});
router2.post("/policies/batch-update", async (req, res) => {
  try {
    const updates = req.body.policies;
    const results = [];
    for (const update of updates) {
      const policy = await storage.updateAlertPolicy(update.id, update);
      results.push(policy);
    }
    res.json({ success: true, policies: results });
  } catch (error) {
    console.error("Error batch updating alert policies:", error);
    res.status(500).json({ error: "Failed to batch update alert policies" });
  }
});
router2.get("/events", async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : void 0,
      endDate: req.query.endDate ? new Date(req.query.endDate) : void 0,
      alertType: req.query.alertType,
      priority: req.query.priority,
      status: req.query.status,
      vesselId: req.query.vesselId
    };
    const events = await storage.getAlertEvents(filters);
    res.json(events);
  } catch (error) {
    console.error("Error fetching alert events:", error);
    res.status(500).json({ error: "Failed to fetch alert events" });
  }
});
router2.get("/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await storage.getAlertEvent(id);
    if (!event) {
      return res.status(404).json({ error: "Alert event not found" });
    }
    const deliveries = await storage.getAlertDeliveries(id);
    res.json({ ...event, deliveries });
  } catch (error) {
    console.error("Error fetching alert event:", error);
    res.status(500).json({ error: "Failed to fetch alert event" });
  }
});
router2.post("/events/:id/acknowledge", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.body.userId || "user1";
    const event = await storage.acknowledgeAlertEvent(id, userId);
    res.json(event);
  } catch (error) {
    console.error("Error acknowledging alert event:", error);
    res.status(500).json({ error: "Failed to acknowledge alert event" });
  }
});
router2.post("/test", async (req, res) => {
  try {
    const { policyId, userId } = req.body;
    const policy = await storage.getAlertPolicy(policyId);
    if (!policy) {
      return res.status(404).json({ error: "Alert policy not found" });
    }
    const event = await storage.createAlertEvent({
      policyId,
      alertType: policy.alertType,
      priority: policy.priority,
      objectType: "test",
      objectId: "test-" + Date.now(),
      vesselId: "V001",
      dedupeKey: `test-${policyId}-${Date.now()}`,
      state: "test",
      payload: JSON.stringify({
        test: true,
        message: `This is a test alert for ${policy.alertType}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      })
    });
    if (policy.inAppEnabled) {
      await storage.createAlertDelivery({
        eventId: event.id,
        channel: "in_app",
        recipient: userId || "user1",
        status: "sent"
      });
    }
    if (policy.emailEnabled) {
      await storage.createAlertDelivery({
        eventId: event.id,
        channel: "email",
        recipient: userId || "user1@example.com",
        status: "sent"
      });
    }
    res.json({ success: true, event });
  } catch (error) {
    console.error("Error sending test alert:", error);
    res.status(500).json({ error: "Failed to send test alert" });
  }
});
router2.get("/config/:vesselId", async (req, res) => {
  try {
    const config2 = await storage.getAlertConfig(req.params.vesselId);
    res.json(config2 || {
      vesselId: req.params.vesselId,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      escalationEnabled: false,
      escalationHours: 4,
      escalationRecipients: "[]"
    });
  } catch (error) {
    console.error("Error fetching alert config:", error);
    res.status(500).json({ error: "Failed to fetch alert config" });
  }
});
router2.post("/config", async (req, res) => {
  try {
    const config2 = await storage.createOrUpdateAlertConfig({
      ...req.body,
      updatedBy: req.body.userId || "user1"
    });
    res.json(config2);
  } catch (error) {
    console.error("Error updating alert config:", error);
    res.status(500).json({ error: "Failed to update alert config" });
  }
});
var alerts_default = router2;

// server/routes/forms.ts
init_storage();
import { Router as Router3 } from "express";
var router3 = Router3();
router3.post("/admin/forms/seed-from-live", async (req, res) => {
  try {
    if (storage.seedForms) {
      await storage.seedForms();
    }
    res.json({ ok: true, message: "Forms seeded successfully" });
  } catch (error) {
    console.error("Error seeding forms:", error);
    res.status(500).json({ error: "Failed to seed forms" });
  }
});
router3.get("/admin/forms", async (req, res) => {
  try {
    let forms = await storage.getFormDefinitions();
    if (forms.length === 0) {
      await storage.seedForms();
      forms = await storage.getFormDefinitions();
    }
    const formsWithVersions = await Promise.all(
      forms.map(async (form) => {
        const latestVersion = await storage.getLatestPublishedVersion(form.id);
        return {
          ...form,
          versionNo: latestVersion?.versionNo || 0,
          versionDate: latestVersion?.versionDate || null,
          status: latestVersion?.status || "NO_VERSION"
        };
      })
    );
    res.json(formsWithVersions);
  } catch (error) {
    console.error("Error fetching forms:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.get("/admin/forms/:formId/versions", async (req, res) => {
  try {
    const formId = parseInt(req.params.formId);
    const versions = await storage.getFormVersions(formId);
    res.json(versions);
  } catch (error) {
    console.error("Error fetching form versions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.get("/admin/forms/:formId/versions/:versionId", async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const version = await storage.getFormVersion(versionId);
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }
    res.json(version);
  } catch (error) {
    console.error("Error fetching form version:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.post("/admin/forms/:formId/versions", async (req, res) => {
  try {
    const formId = parseInt(req.params.formId);
    const latestPublished = await storage.getLatestPublishedVersion(formId);
    if (!latestPublished) {
      return res.status(404).json({ error: "No published version found to clone" });
    }
    const existingVersions = await storage.getFormVersions(formId);
    const existingDraft = existingVersions.find((v) => v.status === "DRAFT");
    if (existingDraft) {
      return res.status(400).json({ error: "Draft version already exists" });
    }
    const newVersion = await storage.createFormVersion({
      formId,
      versionNo: latestPublished.versionNo + 1,
      versionDate: /* @__PURE__ */ new Date(),
      status: "DRAFT",
      authorUserId: req.body.userId || "user",
      changelog: null,
      schemaJson: latestPublished.schemaJson
    });
    res.json(newVersion);
  } catch (error) {
    console.error("Error creating draft version:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.put("/admin/forms/:formId/versions/:versionId/schema", async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const { schemaJson } = req.body;
    if (!schemaJson) {
      return res.status(400).json({ error: "Schema JSON is required" });
    }
    const updated = await storage.updateFormVersion(versionId, {
      schemaJson: typeof schemaJson === "string" ? schemaJson : JSON.stringify(schemaJson)
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating form schema:", error);
    if (error.message === "Can only update draft versions") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.post("/admin/forms/:formId/versions/:versionId/publish", async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const { userId, changelog } = req.body;
    if (!changelog) {
      return res.status(400).json({ error: "Changelog is required" });
    }
    const published = await storage.publishFormVersion(
      versionId,
      userId || "user",
      changelog
    );
    res.json(published);
  } catch (error) {
    console.error("Error publishing form version:", error);
    if (error.message.includes("Can only publish")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.post("/admin/forms/:formId/versions/:versionId/discard", async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    await storage.discardFormVersion(versionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error discarding form version:", error);
    if (error.message.includes("Can only discard")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.post("/admin/forms/:formId/versions/:versionId/rollback", async (req, res) => {
  try {
    const formId = parseInt(req.params.formId);
    const versionId = parseInt(req.params.versionId);
    const sourceVersion = await storage.getFormVersion(versionId);
    if (!sourceVersion) {
      return res.status(404).json({ error: "Version not found" });
    }
    const existingVersions = await storage.getFormVersions(formId);
    const existingDraft = existingVersions.find((v) => v.status === "DRAFT");
    if (existingDraft) {
      return res.status(400).json({ error: "Draft version already exists" });
    }
    const latestVersion = existingVersions[0];
    const newVersionNo = latestVersion ? latestVersion.versionNo + 1 : 1;
    const newDraft = await storage.createFormVersion({
      formId,
      versionNo: newVersionNo,
      versionDate: /* @__PURE__ */ new Date(),
      status: "DRAFT",
      authorUserId: req.body.userId || "user",
      changelog: `Rollback from version ${sourceVersion.versionNo}`,
      schemaJson: sourceVersion.schemaJson
    });
    res.json(newDraft);
  } catch (error) {
    console.error("Error rolling back form version:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.get("/forms/runtime/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const version = await storage.getLatestPublishedVersionByName(name);
    if (!version) {
      return res.status(404).json({ error: "No published version found" });
    }
    await storage.createFormVersionUsage({
      formVersionId: version.id,
      usedInModule: req.headers["x-module"] || "unknown",
      usedAt: /* @__PURE__ */ new Date()
    });
    res.json({
      versionId: version.id,
      versionNo: version.versionNo,
      schema: JSON.parse(version.schemaJson)
    });
  } catch (error) {
    console.error("Error fetching runtime form:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
var forms_default = router3;

// server/routes/fleetAdmin.ts
init_storage();
init_schema();
import { Router as Router4 } from "express";
import { z as z2 } from "zod";

// server/middleware/auth.ts
var requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized - Authentication required" });
  }
  next();
};
var requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized - Authentication required" });
    }
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden - Insufficient permissions",
        required: allowedRoles,
        current: req.user.role
      });
    }
    next();
  };
};
var requirePMSAdmin = requireRole("PMS Admin");
var requireOfficeOrAdmin = requireRole(["Office", "PMS Admin"]);
var requireShipUser = requireRole("Ship");
var mockAuthMiddleware = (req, res, next) => {
  req.user = {
    id: 1,
    username: "admin",
    fullName: "PMS Administrator",
    email: "admin@seafarer.com",
    role: "PMS Admin",
    vesselId: null,
    isActive: true,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  };
  next();
};

// server/routes/fleetAdmin.ts
var router4 = Router4();
router4.use(requireOfficeOrAdmin);
router4.get("/master-data", async (req, res) => {
  try {
    const { sfiCode, vesselName, modelCode, limit, offset } = req.query;
    let entries = await storage.getMasterDataList();
    if (sfiCode) {
      entries = entries.filter((e) => e.sfiCode === sfiCode);
    }
    if (vesselName) {
      entries = entries.filter((e) => e.vesselName === vesselName);
    }
    if (modelCode) {
      entries = entries.filter((e) => e.modelCode === modelCode);
    }
    const total = entries.length;
    const limitNum = limit ? parseInt(limit) : 100;
    const offsetNum = offset ? parseInt(offset) : 0;
    entries = entries.slice(offsetNum, offsetNum + limitNum);
    res.json({ items: entries, total, limit: limitNum, offset: offsetNum });
  } catch (error) {
    console.error("Error fetching master data:", error);
    res.status(500).json({ error: "Failed to fetch master data" });
  }
});
router4.get("/master-data/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getMasterDataItem(id);
    if (!entry) {
      return res.status(404).json({ error: "Master data entry not found" });
    }
    res.json(entry);
  } catch (error) {
    console.error("Error fetching master data entry:", error);
    res.status(500).json({ error: "Failed to fetch master data entry" });
  }
});
router4.get("/master-data/by-code/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const entry = await storage.getMasterDataByFleetCode(code);
    if (!entry) {
      return res.status(404).json({ error: "Master data entry not found" });
    }
    res.json(entry);
  } catch (error) {
    console.error("Error fetching master data by code:", error);
    res.status(500).json({ error: "Failed to fetch master data entry" });
  }
});
var createMasterDataSchema = insertMasterDataSchema.extend({
  fleetEquipmentCode: z2.string().optional()
});
router4.post("/master-data", async (req, res) => {
  try {
    const validatedData = createMasterDataSchema.parse(req.body);
    let fleetEquipmentCode = validatedData.fleetEquipmentCode;
    if (!fleetEquipmentCode && validatedData.makerCode && validatedData.model) {
      const existingEntry = await storage.getMasterDataByMakerModel(
        validatedData.makerCode,
        validatedData.model
      );
      if (existingEntry) {
        fleetEquipmentCode = existingEntry.fleetEquipmentCode;
        console.log(`Reusing Fleet Equipment Code ${fleetEquipmentCode} for existing Maker+Model: ${validatedData.makerCode}/${validatedData.model}`);
      }
    }
    if (!fleetEquipmentCode && validatedData.sfiCode) {
      fleetEquipmentCode = await storage.generateFleetEquipmentCode(validatedData.sfiCode);
      console.log(`Generated new Fleet Equipment Code ${fleetEquipmentCode} for new Maker+Model: ${validatedData.makerCode}/${validatedData.model}`);
    }
    const newEntry = await storage.createMasterData({
      ...validatedData,
      fleetEquipmentCode: fleetEquipmentCode || ""
    });
    res.status(201).json(newEntry);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating master data:", error);
    res.status(500).json({ error: "Failed to create master data entry" });
  }
});
router4.patch("/master-data/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getMasterDataItem(id);
    if (!existing) {
      return res.status(404).json({ error: "Master data entry not found" });
    }
    const updated = await storage.updateMasterData(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating master data:", error);
    res.status(500).json({ error: "Failed to update master data entry" });
  }
});
router4.delete("/master-data/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getMasterDataItem(id);
    if (!existing) {
      return res.status(404).json({ error: "Master data entry not found" });
    }
    await storage.deleteMasterData(id);
    res.json({ success: true, message: "Master data entry deleted" });
  } catch (error) {
    console.error("Error deleting master data:", error);
    res.status(500).json({ error: "Failed to delete master data entry" });
  }
});
router4.get("/generate-fleet-equipment-code/:sfiCode", async (req, res) => {
  try {
    const sfiCode = req.params.sfiCode;
    const nextCode = await storage.generateFleetEquipmentCode(sfiCode);
    res.json({ fleetEquipmentCode: nextCode, sfiCode });
  } catch (error) {
    console.error("Error generating fleet equipment code:", error);
    res.status(500).json({ error: "Failed to generate fleet equipment code" });
  }
});
router4.get("/fleet-vessel-mappings", async (req, res) => {
  try {
    const { fleetEquipmentCode, vesselCode } = req.query;
    let mappings = [];
    if (fleetEquipmentCode) {
      mappings = await storage.getFleetVesselMappings(fleetEquipmentCode);
    } else {
      mappings = await storage.getFleetVesselMappings();
    }
    if (vesselCode) {
      mappings = mappings.filter((m) => m.vesselCode === vesselCode);
    }
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching fleet-vessel mappings:", error);
    res.status(500).json({ error: "Failed to fetch fleet-vessel mappings" });
  }
});
router4.get("/fleet-vessel-mappings/by-equipment/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const mappings = await storage.getFleetVesselMappings(code);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching mappings by equipment:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.get("/fleet-vessel-mappings/by-vessel/:vesselCode", async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const mappings = await storage.getFleetVesselMappingsByVessel(vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching mappings by vessel:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.post("/fleet-vessel-mappings", async (req, res) => {
  try {
    const validatedData = insertFleetVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetVesselMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating fleet-vessel mapping:", error);
    res.status(500).json({ error: "Failed to create mapping" });
  }
});
router4.delete("/fleet-vessel-mappings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await storage.deleteFleetVesselMapping(id);
    res.json({ success: true, message: "Mapping deleted" });
  } catch (error) {
    console.error("Error deleting fleet-vessel mapping:", error);
    res.status(500).json({ error: "Failed to delete mapping" });
  }
});
router4.get("/component-vessel-mappings", async (req, res) => {
  try {
    const mappings = await storage.getComponentVesselMappings();
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching component-vessel mappings:", error);
    res.status(500).json({ error: "Failed to fetch component-vessel mappings" });
  }
});
var createComponentVesselMappingSchema = z2.object({
  fleetEquipmentCode: z2.string(),
  vesselCode: z2.string(),
  vesselName: z2.string(),
  componentCode: z2.string().optional(),
  componentName: z2.string().optional()
});
router4.post("/component-vessel-mappings", async (req, res) => {
  try {
    const validatedData = createComponentVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createComponentVesselMapping(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating component-vessel mapping:", error);
    res.status(500).json({ error: "Failed to create component-vessel mapping" });
  }
});
router4.delete("/component-vessel-mappings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteComponentVesselMapping(id);
    res.json({ success: true, message: "Component-vessel mapping deleted" });
  } catch (error) {
    console.error("Error deleting component-vessel mapping:", error);
    res.status(500).json({ error: "Failed to delete component-vessel mapping" });
  }
});
router4.get("/fleet-component-mappings", async (req, res) => {
  try {
    const { fleetEquipmentCode, vesselCode, componentCode } = req.query;
    let mappings = [];
    if (vesselCode) {
      mappings = await storage.getFleetComponentMappingsByVessel(vesselCode);
      if (fleetEquipmentCode) {
        mappings = mappings.filter((m) => m.fleetEquipmentCode === fleetEquipmentCode);
      }
    } else if (fleetEquipmentCode) {
      mappings = await storage.getFleetComponentMappings(fleetEquipmentCode);
    } else {
      mappings = await storage.getFleetComponentMappings();
    }
    if (componentCode) {
      mappings = mappings.filter((m) => m.componentCode === componentCode);
    }
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching fleet-component mappings:", error);
    res.status(500).json({ error: "Failed to fetch fleet-component mappings" });
  }
});
router4.get("/fleet-component-mappings/by-equipment/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const mappings = await storage.getFleetComponentMappings(code);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching component mappings by equipment:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.get("/fleet-component-mappings/by-vessel/:vesselCode", async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const mappings = await storage.getFleetComponentMappingsByVessel(vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching component mappings by vessel:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.post("/fleet-component-mappings", async (req, res) => {
  try {
    const validatedData = insertFleetComponentMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetComponentMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating fleet-component mapping:", error);
    res.status(500).json({ error: "Failed to create mapping" });
  }
});
router4.delete("/fleet-component-mappings", async (req, res) => {
  try {
    const { fleetEquipmentCode, vesselCode, componentCode } = req.query;
    if (!fleetEquipmentCode || !vesselCode || !componentCode) {
      return res.status(400).json({
        error: "Missing required parameters: fleetEquipmentCode, vesselCode, componentCode"
      });
    }
    await storage.removeFleetComponentMappingRecord(
      fleetEquipmentCode,
      vesselCode,
      componentCode
    );
    res.json({ success: true, message: "Mapping deleted" });
  } catch (error) {
    console.error("Error deleting fleet-component mapping:", error);
    res.status(500).json({ error: "Failed to delete mapping" });
  }
});
router4.get("/fleet-job-mappings", async (req, res) => {
  try {
    const { fleetEquipmentCode, jobCode, vesselCode } = req.query;
    let mappings = await storage.getFleetJobVesselMappings(
      fleetEquipmentCode,
      jobCode
    );
    if (vesselCode) {
      mappings = mappings.filter((m) => m.vesselCode === vesselCode);
    }
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching fleet-job-vessel mappings:", error);
    res.status(500).json({ error: "Failed to fetch fleet-job-vessel mappings" });
  }
});
router4.get("/fleet-job-mappings/by-job/:jobCode", async (req, res) => {
  try {
    const jobCode = req.params.jobCode;
    const mappings = await storage.getFleetJobVesselMappings(void 0, jobCode);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching job mappings by job code:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.get("/fleet-job-mappings/by-vessel/:vesselCode", async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const allMappings = await storage.getFleetJobVesselMappings();
    const mappings = allMappings.filter((m) => m.vesselCode === vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching job mappings by vessel:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.post("/fleet-job-mappings", async (req, res) => {
  try {
    const validatedData = insertFleetJobVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetJobVesselMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating fleet-job-vessel mapping:", error);
    res.status(500).json({ error: "Failed to create mapping" });
  }
});
router4.delete("/fleet-job-mappings", async (req, res) => {
  try {
    const { jobCode, vesselCode } = req.query;
    if (!jobCode || !vesselCode) {
      return res.status(400).json({
        error: "Missing required parameters: jobCode, vesselCode"
      });
    }
    await storage.removeFleetJobVesselMappingRecord(
      jobCode,
      vesselCode
    );
    res.json({ success: true, message: "Mapping deleted" });
  } catch (error) {
    console.error("Error deleting fleet-job-vessel mapping:", error);
    res.status(500).json({ error: "Failed to delete mapping" });
  }
});
router4.get("/fleet-spare-mappings", async (req, res) => {
  try {
    const { fleetEquipmentCode, partCode, vesselCode } = req.query;
    let mappings = await storage.getFleetSpareVesselMappings(
      fleetEquipmentCode,
      partCode
    );
    if (vesselCode) {
      mappings = mappings.filter((m) => m.vesselCode === vesselCode);
    }
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching fleet-spare-vessel mappings:", error);
    res.status(500).json({ error: "Failed to fetch fleet-spare-vessel mappings" });
  }
});
router4.get("/fleet-spare-mappings/by-spare/:partCode", async (req, res) => {
  try {
    const partCode = req.params.partCode;
    const mappings = await storage.getFleetSpareVesselMappings(void 0, partCode);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching spare mappings by part code:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.get("/fleet-spare-mappings/by-vessel/:vesselCode", async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const allMappings = await storage.getFleetSpareVesselMappings();
    const mappings = allMappings.filter((m) => m.vesselCode === vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching spare mappings by vessel:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router4.post("/fleet-spare-mappings", async (req, res) => {
  try {
    const validatedData = insertFleetSpareVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetSpareVesselMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating fleet-spare-vessel mapping:", error);
    res.status(500).json({ error: "Failed to create mapping" });
  }
});
router4.delete("/fleet-spare-mappings", async (req, res) => {
  try {
    const { partCode, vesselCode } = req.query;
    if (!partCode || !vesselCode) {
      return res.status(400).json({
        error: "Missing required parameters: partCode, vesselCode"
      });
    }
    await storage.removeFleetSpareVesselMappingRecord(
      partCode,
      vesselCode
    );
    res.json({ success: true, message: "Mapping deleted" });
  } catch (error) {
    console.error("Error deleting fleet-spare-vessel mapping:", error);
    res.status(500).json({ error: "Failed to delete mapping" });
  }
});
router4.get("/import-history", async (req, res) => {
  try {
    const { vesselCode, moduleType, status, limit, offset } = req.query;
    let history = await storage.getBulkImportHistory(
      vesselCode,
      moduleType
    );
    if (status) {
      history = history.filter((h) => h.status === status);
    }
    history.sort((a, b) => {
      const aTime = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : new Date(a.uploadedAt).getTime();
      const bTime = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : new Date(b.uploadedAt).getTime();
      return bTime - aTime;
    });
    const total = history.length;
    const limitNum = limit ? parseInt(limit) : 50;
    const offsetNum = offset ? parseInt(offset) : 0;
    history = history.slice(offsetNum, offsetNum + limitNum);
    res.json({ items: history, total, limit: limitNum, offset: offsetNum });
  } catch (error) {
    console.error("Error fetching import history:", error);
    res.status(500).json({ error: "Failed to fetch import history" });
  }
});
router4.get("/import-history/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getBulkImportHistoryItem(id);
    if (!entry) {
      return res.status(404).json({ error: "Import history entry not found" });
    }
    res.json(entry);
  } catch (error) {
    console.error("Error fetching import history entry:", error);
    res.status(500).json({ error: "Failed to fetch import history entry" });
  }
});
router4.get("/import-history/:id/errors", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const errors = await storage.getBulkImportErrors(id);
    res.json(errors);
  } catch (error) {
    console.error("Error fetching import errors:", error);
    res.status(500).json({ error: "Failed to fetch import errors" });
  }
});
router4.post("/import-history", async (req, res) => {
  try {
    const validatedData = insertBulkImportHistorySchema.parse(req.body);
    const newEntry = await storage.createBulkImportHistory(validatedData);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating import history:", error);
    res.status(500).json({ error: "Failed to create import history entry" });
  }
});
router4.patch("/import-history/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateBulkImportHistory(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating import history:", error);
    res.status(500).json({ error: "Failed to update import history entry" });
  }
});
router4.post("/import-errors", async (req, res) => {
  try {
    const { errors } = req.body;
    if (!Array.isArray(errors)) {
      return res.status(400).json({ error: "Errors must be an array" });
    }
    const validatedErrors = errors.map((e) => insertBulkImportErrorSchema.parse(e));
    await storage.createBulkImportErrors(validatedErrors);
    res.status(201).json({ success: true, count: validatedErrors.length });
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating import errors:", error);
    res.status(500).json({ error: "Failed to create import errors" });
  }
});
router4.get("/dashboard-metrics", async (req, res) => {
  try {
    const metrics = await storage.getFleetAdminMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
});
var fleetAdmin_default = router4;

// server/routes/changeRequests.ts
init_schema();
import { Router as Router5 } from "express";
import { z as z3 } from "zod";
function createChangeRequestsRouter(storage2) {
  const router5 = Router5();
  router5.get("/", async (req, res) => {
    try {
      const { vesselId, status, category, requestedBy } = req.query;
      let requests = await storage2.getChangeRequests({ vesselId });
      if (status) {
        requests = requests.filter((r) => r.status === status);
      }
      if (category) {
        requests = requests.filter((r) => r.category === category);
      }
      if (requestedBy) {
        requests = requests.filter((r) => r.requestedByUserId === requestedBy);
      }
      requests.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      res.json(requests);
    } catch (error) {
      console.error("Error fetching change requests:", error);
      res.status(500).json({ error: "Failed to fetch change requests" });
    }
  });
  router5.get("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage2.getChangeRequest(id);
      if (!request) {
        return res.status(404).json({ error: "Change request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error fetching change request:", error);
      res.status(500).json({ error: "Failed to fetch change request" });
    }
  });
  router5.post("/", async (req, res) => {
    try {
      const validatedData = insertChangeRequestSchema.parse(req.body);
      const requestData = {
        ...validatedData,
        vesselId: validatedData.vesselId || "V001",
        status: validatedData.status || "draft",
        requestedByUserId: validatedData.requestedByUserId || "system"
      };
      const newRequest = await storage2.createChangeRequest(requestData);
      res.status(201).json(newRequest);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating change request:", error);
      res.status(500).json({ error: "Failed to create change request" });
    }
  });
  router5.patch("/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, reviewedByUserId, reviewComments } = req.body;
      if (!["draft", "submitted", "returned", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updatedRequest = await storage2.updateChangeRequest(id, {
        status,
        reviewedByUserId,
        reviewedAt: /* @__PURE__ */ new Date()
      });
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error updating change request status:", error);
      res.status(500).json({ error: "Failed to update change request status" });
    }
  });
  router5.get("/:id/comments", async (req, res) => {
    try {
      const changeRequestId = parseInt(req.params.id);
      const comments = await storage2.getChangeRequestComments(changeRequestId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });
  router5.post("/:id/comments", async (req, res) => {
    try {
      const changeRequestId = parseInt(req.params.id);
      const commentData = {
        ...req.body,
        changeRequestId
      };
      const validatedData = insertChangeRequestCommentSchema.parse(commentData);
      const newComment = await storage2.createChangeRequestComment(validatedData);
      res.status(201).json(newComment);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });
  router5.get("/:id/attachments", async (req, res) => {
    try {
      const changeRequestId = parseInt(req.params.id);
      const attachments = await storage2.getChangeRequestAttachments(changeRequestId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });
  router5.post("/:id/attachments", async (req, res) => {
    try {
      const changeRequestId = parseInt(req.params.id);
      const attachmentData = {
        ...req.body,
        changeRequestId
      };
      const validatedData = insertChangeRequestAttachmentSchema.parse(attachmentData);
      const newAttachment = await storage2.createChangeRequestAttachment(validatedData);
      res.status(201).json(newAttachment);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating attachment:", error);
      res.status(500).json({ error: "Failed to create attachment" });
    }
  });
  router5.put("/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { comment, reviewerId } = req.body;
      console.log(`[CR_ROUTE] Approving change request ${id}`);
      console.log(`[CR_ROUTE] Request body:`, req.body);
      if (!comment) {
        return res.status(400).json({ error: "Comment is required for approval" });
      }
      const existing = await storage2.getChangeRequest(id);
      console.log(`[CR_ROUTE] Change request found:`, {
        id: existing?.id,
        targetType: existing?.targetType,
        targetId: existing?.targetId,
        proposedChangesCount: Array.isArray(existing?.proposedChangesJson) ? existing.proposedChangesJson.length : 0
      });
      const updated = await storage2.approveChangeRequest(
        id,
        reviewerId || "reviewer",
        comment
      );
      console.log(`[CR_ROUTE] Approval complete, status: ${updated.status}`);
      res.json(updated);
    } catch (error) {
      console.error("[CR_ROUTE] Error approving change request:", error);
      res.status(500).json({ error: error.message || "Failed to approve change request" });
    }
  });
  router5.put("/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { comment, reviewerId } = req.body;
      console.log("Rejecting change request:", id, "with comment:", comment);
      if (!comment) {
        return res.status(400).json({ error: "Comment is required for rejection" });
      }
      const updated = await storage2.rejectChangeRequest(
        id,
        reviewerId || "reviewer",
        comment
      );
      console.log("Successfully rejected request:", updated);
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting change request:", error);
      res.status(500).json({ error: error.message || "Failed to reject change request" });
    }
  });
  return router5;
}

// server/runningHoursRoutes.ts
init_storage();
init_jobDueScanner();
import { z as z4 } from "zod";
var updateRHConfigSchema2 = z4.object({
  rhCounterType: z4.enum(["MASTER", "INHERITED", "NOT_RH_DRIVEN"]),
  rhMasterComponentId: z4.string().nullable().optional(),
  userId: z4.string().optional()
});
var updateMasterRHSchema2 = z4.object({
  newRHValue: z4.number().nonnegative("Running hours must be non-negative"),
  updateSource: z4.enum(["MANUAL", "IMPORT", "AUTOMATION"]).optional().default("MANUAL"),
  userId: z4.string().optional().default("system"),
  comments: z4.string().optional()
});
function registerRunningHoursRoutes(app2) {
  app2.get("/api/running-hours/parents", async (req, res) => {
    try {
      const vesselId = req.query.vesselId || "V001";
      const allComponents = await storage.getComponents(vesselId);
      const masterComponents = allComponents.filter(
        (component) => component.rhCounterType === "MASTER"
      );
      const parents = masterComponents.map((component) => ({
        ...component,
        sfiCode: component.componentCode || "",
        latestUpdate: component.rhMasterUpdatedAt || component.lastUpdated || component.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
        currentCumulativeRH: component.rhCurrentMaster || component.currentCumulativeRH || "0.00"
      }));
      parents.sort((a, b) => (a.componentCode || "").localeCompare(b.componentCode || ""));
      res.json(parents);
    } catch (error) {
      console.error("Error fetching running hour parents:", error);
      res.status(500).json({
        error: "Failed to fetch running hour parents"
      });
    }
  });
  app2.get("/api/running-hours/children/:parentCode", async (req, res) => {
    try {
      const { parentCode } = req.params;
      const vesselId = req.query.vesselId || "V001";
      const allComponents = await storage.getComponents(vesselId);
      const parent = allComponents.find((c) => c.componentCode === parentCode);
      if (!parent) {
        return res.status(404).json({ error: "Parent component not found" });
      }
      const children = allComponents.filter((c) => c.parentId === parentCode);
      const childrenWithRH = children.map((child) => ({
        id: child.id,
        componentCode: child.componentCode || "",
        name: child.name || "",
        currentCumulativeRH: child.currentCumulativeRH || "0.00",
        lastUpdated: child.lastUpdated || child.updatedAt || "-"
      }));
      childrenWithRH.sort((a, b) => a.componentCode.localeCompare(b.componentCode));
      res.json({
        parent: {
          componentCode: parent.componentCode,
          name: parent.name,
          currentCumulativeRH: parent.currentCumulativeRH || "0.00"
        },
        children: childrenWithRH
      });
    } catch (error) {
      console.error("Error fetching children RH:", error);
      res.status(500).json({ error: "Failed to fetch children running hours" });
    }
  });
  app2.post("/api/running-hours/reset-child/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const { oldMeterFinal, userId, notes } = req.body;
      const component = await storage.getComponent(componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      const previousRH = component.currentCumulativeRH || "0.00";
      await storage.updateComponent(componentId, {
        currentCumulativeRH: "0.00",
        runningHours: "0.00",
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      }, userId || "system");
      await storage.createRunningHoursAudit({
        vesselId: component.vesselId || "",
        componentId,
        previousRH,
        newRH: "0.00",
        cumulativeRH: "0.00",
        dateUpdatedLocal: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        dateUpdatedTZ: "UTC",
        enteredAtUTC: /* @__PURE__ */ new Date(),
        userId: userId || "system",
        source: "reset",
        notes: notes || "Component replaced - RH reset to 0",
        meterReplaced: true,
        oldMeterFinal: oldMeterFinal || previousRH,
        newMeterStart: "0.00",
        version: 1
      });
      res.json({
        success: true,
        message: `Running hours reset to 0 for ${component.name}. Future parent deltas will be applied.`,
        previousRH,
        newRH: "0.00"
      });
    } catch (error) {
      console.error("Error resetting child RH:", error);
      res.status(500).json({ error: "Failed to reset child running hours" });
    }
  });
  app2.get("/api/rh-config/master-components/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const masterComponents = await storage.getMasterComponents(vesselId);
      res.json(masterComponents.map((c) => ({
        id: c.id,
        componentCode: c.componentCode,
        name: c.name,
        rhCurrentMaster: c.rhCurrentMaster || "0",
        rhMasterUpdatedAt: c.rhMasterUpdatedAt
      })));
    } catch (error) {
      console.error("Error fetching master components:", error);
      res.status(500).json({ error: "Failed to fetch master components" });
    }
  });
  app2.get("/api/rh-config/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const component = await storage.getComponent(componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      let rhMasterComponentName = null;
      let masterComponent = void 0;
      if (component.rhCounterType === "INHERITED" && component.rhMasterComponentId) {
        masterComponent = await storage.getComponent(component.rhMasterComponentId);
        rhMasterComponentName = masterComponent?.name || null;
      }
      let rhCurrentValue = null;
      let rhLastUpdated = null;
      if (component.rhCounterType === "MASTER") {
        rhCurrentValue = component.rhCurrentMaster;
        rhLastUpdated = component.rhMasterUpdatedAt;
      } else if (component.rhCounterType === "INHERITED") {
        if (masterComponent) {
          rhCurrentValue = masterComponent.rhCurrentMaster;
          rhLastUpdated = masterComponent.rhMasterUpdatedAt;
        } else {
          rhCurrentValue = component.rhCurrentInheritedCached;
          rhLastUpdated = component.rhInheritedUpdatedAt;
        }
      }
      res.json({
        componentId: component.id,
        componentName: component.name,
        rhCounterType: component.rhCounterType,
        rhMasterComponentId: component.rhMasterComponentId,
        rhMasterComponentName,
        rhCurrentValue,
        rhLastUpdated,
        rhUpdateSource: component.rhMasterUpdateSource
      });
    } catch (error) {
      console.error("Error fetching RH config:", error);
      res.status(500).json({ error: "Failed to fetch RH configuration" });
    }
  });
  app2.put("/api/rh-config/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const parseResult = updateRHConfigSchema2.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.format()
        });
      }
      const { rhCounterType, rhMasterComponentId, userId } = parseResult.data;
      const component = await storage.getComponent(componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      if (rhCounterType === "INHERITED" && rhMasterComponentId === componentId) {
        return res.status(400).json({
          error: "A component cannot inherit running hours from itself"
        });
      }
      if (rhCounterType === "INHERITED") {
        if (!rhMasterComponentId) {
          return res.status(400).json({
            error: "rhMasterComponentId is required for INHERITED counter type"
          });
        }
        const masterComponent = await storage.getComponent(rhMasterComponentId);
        if (!masterComponent) {
          return res.status(400).json({
            error: "Master component not found"
          });
        }
        if (masterComponent.vesselId !== component.vesselId) {
          return res.status(400).json({
            error: "Master component must be from the same vessel"
          });
        }
        if (masterComponent.rhCounterType !== "MASTER") {
          return res.status(400).json({
            error: "Selected component is not configured as a MASTER counter type"
          });
        }
      }
      if (component.rhCounterType === "MASTER" && rhCounterType !== "MASTER") {
        const dependents = await storage.getInheritedComponents(componentId);
        if (dependents.length > 0) {
          const dependentNames = dependents.slice(0, 3).map((d) => d.name).join(", ");
          const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : "";
          return res.status(400).json({
            error: `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
          });
        }
      }
      const updatedComponent = await storage.updateRHConfig({
        componentId,
        rhCounterType,
        rhMasterComponentId: rhCounterType === "INHERITED" ? rhMasterComponentId : null,
        userId
      });
      res.json({
        success: true,
        message: `RH counter type updated to ${rhCounterType}`,
        component: updatedComponent
      });
    } catch (error) {
      console.error("Error updating RH config:", error);
      res.status(500).json({ error: error.message || "Failed to update RH configuration" });
    }
  });
  app2.put("/api/rh-config/master/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const parseResult = updateMasterRHSchema2.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.format()
        });
      }
      const { newRHValue, updateSource, userId, comments } = parseResult.data;
      const component = await storage.getComponent(componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      if (component.rhCounterType !== "MASTER") {
        return res.status(400).json({
          error: "Running hours can only be updated for MASTER counter type components"
        });
      }
      const result = await storage.updateMasterRunningHours({
        componentId,
        newRHValue,
        updateSource,
        userId,
        comments
      });
      let woGenerationResult = { rhJobsChecked: 0, rhWOsGenerated: 0 };
      try {
        if (component.vesselId) {
          const scanResult = await jobDueScanner.runScan();
          woGenerationResult = {
            rhJobsChecked: scanResult.rhJobsChecked,
            rhWOsGenerated: scanResult.rhWOsGenerated
          };
          if (scanResult.rhWOsGenerated > 0) {
            console.log(`\u2705 [RH Update Trigger] Generated ${scanResult.rhWOsGenerated} WO(s) after MASTER RH update on ${component.name}`);
          }
        }
      } catch (scanError) {
        console.error("[RH Update Trigger] WO generation scan failed:", scanError);
      }
      res.json({
        success: true,
        message: `Master RH updated to ${newRHValue}. Cascaded to ${result.inheritedUpdated} inherited components.`,
        masterUpdated: result.masterUpdated,
        inheritedUpdated: result.inheritedUpdated,
        woGeneration: woGenerationResult
      });
    } catch (error) {
      console.error("Error updating master RH:", error);
      res.status(500).json({ error: error.message || "Failed to update master running hours" });
    }
  });
  app2.get("/api/rh-config/inherited/:masterComponentId", async (req, res) => {
    try {
      const { masterComponentId } = req.params;
      const inheritedComponents = await storage.getInheritedComponents(masterComponentId);
      res.json(inheritedComponents.map((c) => ({
        id: c.id,
        componentCode: c.componentCode,
        name: c.name,
        rhCurrentInheritedCached: c.rhCurrentInheritedCached || "0",
        rhInheritedUpdatedAt: c.rhInheritedUpdatedAt
      })));
    } catch (error) {
      console.error("Error fetching inherited components:", error);
      res.status(500).json({ error: "Failed to fetch inherited components" });
    }
  });
}

// server/initDb.ts
init_postgresClient();
init_storageFactory();
import { sql as sql3 } from "drizzle-orm";
async function ensureMaintenanceHistoryImmutability() {
  console.log("\u{1F512} Ensuring immutability trigger for component_maintenance_history...");
  if (isFileStorageForced()) {
    console.log("\u23ED\uFE0F  Skipping immutability trigger setup - file-based storage is active");
    return;
  }
  const postgres = await resolvePostgres();
  if (!postgres) {
    console.log("\u23ED\uFE0F  Skipping immutability trigger setup - DATABASE_URL not configured (using file-based storage)");
    return;
  }
  const { db: db2 } = postgres;
  try {
    await db2.execute(sql3`
      CREATE OR REPLACE FUNCTION prevent_maintenance_history_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Maintenance history records are immutable - cannot modify or delete existing records';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await db2.execute(sql3`
      DROP TRIGGER IF EXISTS prevent_maintenance_history_update ON component_maintenance_history;
    `);
    await db2.execute(sql3`
      CREATE TRIGGER prevent_maintenance_history_update
        BEFORE UPDATE ON component_maintenance_history
        FOR EACH ROW
        EXECUTE FUNCTION prevent_maintenance_history_modification();
    `);
    await db2.execute(sql3`
      DROP TRIGGER IF EXISTS prevent_maintenance_history_delete ON component_maintenance_history;
    `);
    await db2.execute(sql3`
      CREATE TRIGGER prevent_maintenance_history_delete
        BEFORE DELETE ON component_maintenance_history
        FOR EACH ROW
        EXECUTE FUNCTION prevent_maintenance_history_modification();
    `);
    const verifyResult = await db2.execute(sql3`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'component_maintenance_history'
      AND trigger_name IN ('prevent_maintenance_history_update', 'prevent_maintenance_history_delete')
    `);
    const triggerCount = verifyResult.rows.length;
    if (triggerCount !== 2) {
      throw new Error(
        `Immutability trigger verification failed: Expected 2 triggers, found ${triggerCount}. Triggers 'prevent_maintenance_history_update' and 'prevent_maintenance_history_delete' must exist.`
      );
    }
    console.log("\u2705 Immutability triggers verified: component_maintenance_history is now immutable (INSERT-only)");
  } catch (error) {
    throw new Error(
      `Failed to ensure maintenance history immutability: ${error.message}. Possible causes: Missing component_maintenance_history table, insufficient database permissions, or trigger creation error. Server cannot start without immutability enforcement.`
    );
  }
}

// server/routes.ts
async function registerRoutes(app2) {
  try {
    await ensureMaintenanceHistoryImmutability();
  } catch (error) {
    console.error("\u274C FATAL: Failed to ensure maintenance history immutability");
    console.error(error);
    console.error("Server cannot start without immutability enforcement for component_maintenance_history table");
    process.exit(1);
  }
  app2.use("/api", mockAuthMiddleware);
  console.log("\u{1F512} Mock authentication enabled for /api/* routes");
  app2.get("/download/docs/:filename", (req, res) => {
    const filename = req.params.filename;
    const allowedFiles = ["STORAGE_ANALYSIS.md", "LOCAL_DEVELOPMENT_SETUP.md"];
    if (!allowedFiles.includes(filename)) {
      return res.status(404).json({ error: "File not found" });
    }
    const filePath = path5.resolve(process.cwd(), filename);
    if (fs3.existsSync(filePath)) {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/markdown");
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });
  const { jobDueScanner: jobDueScanner2 } = await Promise.resolve().then(() => (init_jobDueScanner(), jobDueScanner_exports));
  jobDueScanner2.start(1 * 60 * 1e3);
  console.log("[JobDueScanner] Scheduler started - will auto-generate work orders for due jobs");
  const { workOrderStatusRecalculator: workOrderStatusRecalculator2 } = await Promise.resolve().then(() => (init_workOrderStatusRecalculator(), workOrderStatusRecalculator_exports));
  workOrderStatusRecalculator2.start(1 * 60 * 1e3);
  console.log("[StatusRecalculator] Scheduler started - will recalculate work order statuses based on current settings");
  registerRunningHoursRoutes(app2);
  const upload2 = multer2({
    storage: multer2.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
    // 10MB limit
  });
  app2.get("/api/components/:vesselId", async (req, res) => {
    try {
      const components2 = await storage.getComponents(req.params.vesselId);
      console.log(`\u{1F4CB} GET /api/components/${req.params.vesselId} returning ${components2.length} components`);
      components2.slice(0, 5).forEach((c) => {
        console.log(`  - code: ${c.componentCode}, name: ${c.name?.substring(0, 30)}, parentId: ${c.parentId || "none"}`);
      });
      res.json(components2);
    } catch (error) {
      console.error("Error fetching components:", error);
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });
  app2.get("/api/components/details/:id", async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(component);
    } catch (error) {
      console.error("Error fetching component:", error);
      res.status(500).json({ error: "Failed to fetch component" });
    }
  });
  app2.post("/api/components/upload", upload2.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const file = req.file;
      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf("."));
      let parsedData = [];
      let detectedHeaders = [];
      if (fileExtension === ".csv") {
        const csvContent = file.buffer.toString("utf-8");
        const parseResult = Papa2.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        });
        parsedData = parseResult.data;
        detectedHeaders = parseResult.meta.fields || [];
      } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
        const workbook = XLSX2.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX2.utils.decode_range(worksheet["!ref"] || "A1");
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX2.utils.encode_cell({ r: range.s.r, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            detectedHeaders.push(String(cell.v));
          }
        }
        parsedData = XLSX2.utils.sheet_to_json(worksheet);
      } else {
        return res.status(400).json({ error: "Unsupported file format. Please upload CSV, XLS, or XLSX file." });
      }
      const fieldMapping = {
        // Core identifiers
        "Component ID": "id",
        "Component Name": "name",
        "Component Code": "componentCode",
        "Parent ID": "parentId",
        "Parent Component Code": "parentId",
        "Parent Component": "parentId",
        // Category and classification
        "Category": "category",
        "Component Category": "componentCategory",
        "Department Category": "deptCategory",
        "Dept Category": "deptCategory",
        // Vessel identification
        "Vessel ID": "vesselId",
        "Vessel Code": "vesselCode",
        // Fleet equipment fields
        "Fleet Equipment Code": "fleetEquipmentCode",
        "Fleet Eqpt Code": "fleetEquipmentCode",
        "Fleet Equipment Name": "fleetEquipmentName",
        "Fleet Eqpt Name": "fleetEquipmentName",
        "Parent Fleet Equipment Code": "parentFleetEquipmentCode",
        "Parent Fleet Eqpt Code": "parentFleetEquipmentCode",
        // Maker and model information
        "Maker": "maker",
        "Maker Code": "makerCode",
        "MakerCode": "makerCode",
        "Maker No": "makerCode",
        "Model": "model",
        "Model Code": "modelCode",
        "ModelCode": "modelCode",
        "Model Number": "modelNumber",
        "Model No": "modelNumber",
        "Serial No": "serialNo",
        "SerialNo": "serialNo",
        "Serial Number": "serialNo",
        "Drawing No": "drawingNo",
        "DrawingNo": "drawingNo",
        "Drawing Number": "drawingNo",
        // Location and department
        "Location": "location",
        "Department": "department",
        "Dept": "department",
        "Eqpt System Dept": "eqptSystemDept",
        "Equip System Dept": "eqptSystemDept",
        "Equipment System Department": "eqptSystemDept",
        // Running hours and dates
        "Current Cumulative RH": "currentCumulativeRH",
        "Running Hours": "runningHours",
        "RH": "runningHours",
        "Last Updated": "lastUpdated",
        "Commissioned Date": "commissionedDate",
        "Commissioning Date": "commissionedDate",
        "Installation Date": "installationDate",
        // Boolean flags
        "Critical": "critical",
        "Critical (Yes/No)": "critical",
        "Is Critical": "critical",
        "Class Item": "classItem",
        "ClassItem": "classItem",
        "Is Class Item": "classItem",
        "Condition Based": "conditionBased",
        "Condition Based (Yes/No)": "conditionBased",
        "ConditionBased": "conditionBased",
        "Is Condition Based": "conditionBased",
        "Is Parent": "isParent",
        "IsParent": "isParent",
        "Is Active": "isActive",
        "IsActive": "isActive",
        "Active": "isActive",
        // Additional fields
        "Rating": "rating",
        "Notes": "notes",
        "Remarks": "notes",
        "No of Units": "noOfUnits",
        "Number of Units": "noOfUnits",
        "Dimensions Size": "dimensionsSize",
        "Dimensions": "dimensionsSize",
        "Size": "dimensionsSize",
        "Scope Notes": "scopeNotes"
      };
      const normalizeKey = (key) => key.toLowerCase().trim().replace(/[\s_-]+/g, "");
      const normalizedMapping = {};
      for (const [fileHeader, dbField] of Object.entries(fieldMapping)) {
        normalizedMapping[normalizeKey(fileHeader)] = dbField;
      }
      let columnInfo = null;
      if (detectedHeaders.length > 0) {
        const mappedColumns = detectedHeaders.map((col) => ({ original: col, mapped: normalizedMapping[normalizeKey(col)] })).filter((c) => c.mapped);
        const unmappedColumns = detectedHeaders.filter((col) => !normalizedMapping[normalizeKey(col)]);
        columnInfo = {
          detected: detectedHeaders,
          mapped: mappedColumns,
          // Return as objects, not strings
          unmapped: unmappedColumns
        };
        console.log("\u{1F4CA} Excel Import - Column Detection:");
        console.log("  Detected headers:", detectedHeaders.join(", "));
        console.log("  Successfully mapped columns:", mappedColumns.map((c) => `${c.original} \u2192 ${c.mapped}`).join(", "));
        if (unmappedColumns.length > 0) {
          console.log("  \u26A0\uFE0F  Unmapped columns (will be ignored):", unmappedColumns.join(", "));
        }
      }
      const errors = [];
      const processedComponents = [];
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const rowNum = i + 2;
        const component = {};
        for (const [originalHeader, value] of Object.entries(row)) {
          const normalizedHeader = normalizeKey(originalHeader);
          const dbField = normalizedMapping[normalizedHeader];
          if (dbField && value !== void 0 && value !== null && value !== "") {
            let processedValue = value;
            const booleanFields = ["critical", "classItem", "conditionBased", "isParent", "isActive"];
            if (booleanFields.includes(dbField)) {
              if (typeof processedValue === "string") {
                processedValue = processedValue.toLowerCase() === "true" || processedValue.toLowerCase() === "yes" || processedValue === "1";
              } else if (typeof processedValue === "boolean") {
              } else {
                processedValue = Boolean(processedValue);
              }
            }
            if ((dbField === "currentCumulativeRH" || dbField === "runningHours") && processedValue !== "") {
              const numValue = typeof processedValue === "number" ? processedValue : parseFloat(String(processedValue));
              if (!isNaN(numValue)) {
                processedValue = numValue.toString();
              }
            }
            component[dbField] = processedValue;
          }
        }
        if (!component.id) {
          errors.push({
            row: rowNum,
            field: "Component ID",
            message: "Component ID is required",
            data: row
          });
          continue;
        }
        if (!component.name) {
          errors.push({
            row: rowNum,
            field: "Component Name",
            message: "Component Name is required",
            data: row
          });
          continue;
        }
        if (!component.componentCategory) {
          errors.push({
            row: rowNum,
            field: "Component Category",
            message: "Component Category is required",
            data: row
          });
          continue;
        }
        if (!component.vesselCode) {
          errors.push({
            row: rowNum,
            field: "Vessel Code",
            message: "Vessel Code is required - critical for tracking which vessel components belong to",
            data: row
          });
          continue;
        }
        component.currentCumulativeRH = component.currentCumulativeRH || "0";
        component.critical = component.critical ?? false;
        component.classItem = component.classItem ?? false;
        processedComponents.push(component);
      }
      if (processedComponents.length === 0 && errors.length > 0) {
        return res.json({
          success: false,
          created: 0,
          updated: 0,
          failed: errors.length,
          errors,
          columnInfo
        });
      }
      const result = await storage.bulkUpsertComponents(processedComponents);
      res.json({
        success: errors.length === 0,
        created: result.created,
        updated: result.updated,
        failed: errors.length,
        errors,
        preview: processedComponents.slice(0, 5),
        // Show first 5 records as preview
        columnInfo
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process upload: " + error.message });
    }
  });
  app2.get("/api/jobs", async (req, res) => {
    try {
      const vesselId = req.query.vesselId;
      const componentId = req.query.componentId;
      const jobs2 = await storage.getJobs(vesselId, componentId);
      const hydratedJobs = await Promise.all(jobs2.map(async (job) => {
        if (job.maintenanceBasis === "Running Hours" && job.componentId) {
          const component = await storage.getComponent(job.componentId);
          if (component) {
            let currentRH = parseFloat(component.currentCumulativeRH || component.runningHours || "0");
            if (component.parentId) {
              const parentComponent = await storage.getComponentByCode(component.parentId, job.vesselId || "");
              if (parentComponent) {
                currentRH = parseFloat(parentComponent.currentCumulativeRH || parentComponent.runningHours || "0");
              }
            }
            return {
              ...job,
              componentCurrentRH: currentRH.toFixed(2)
            };
          }
        }
        return job;
      }));
      res.json(hydratedJobs);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  app2.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Failed to fetch job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });
  app2.get("/api/jobs/:id/context", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      const component = await storage.getComponent(job.componentId);
      let parentComponent = null;
      if (component?.parentId) {
        parentComponent = await storage.getComponent(component.parentId);
      }
      const convertToIsoDate = (dateStr) => {
        if (!dateStr) return "";
        const monthMap = {
          "Jan": "01",
          "Feb": "02",
          "Mar": "03",
          "Apr": "04",
          "May": "05",
          "Jun": "06",
          "Jul": "07",
          "Aug": "08",
          "Sep": "09",
          "Oct": "10",
          "Nov": "11",
          "Dec": "12"
        };
        const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          const monthNum = monthMap[month];
          if (monthNum) {
            return `${year}-${monthNum}-${day.padStart(2, "0")}`;
          }
        }
        return dateStr;
      };
      const allWorkOrdersForJob = await storage.getWorkOrdersByJobId(req.params.id);
      const completedWorkOrders = allWorkOrdersForJob.filter((wo) => wo.status === "Completed");
      const workHistory = completedWorkOrders.map((wo) => {
        const formDataRemarks = wo.formData?.sectionB2?.remarks || wo.formData?.remarks || "";
        return {
          woNo: wo.workOrderNo || wo.woExecutionId || wo.id || "-",
          assignedTo: wo.assignedTo || "-",
          performedBy: wo.performedBy || wo.assignedTo || "-",
          workDate: wo.startDateTime || wo.dueDate || "",
          runDate: wo.runningHours?.toString() || "",
          completionDate: wo.completionDateTime || wo.dateCompleted || "",
          status: wo.status || "Completed",
          description: wo.workCarriedOut || wo.jobTitle || "Maintenance completed",
          remarks: wo.completionRemarks || wo.remarks || wo.jobExperienceNotes || formDataRemarks || ""
        };
      });
      let dummySpareParts = job.requiredSpareParts || [];
      let dummyTools = job.requiredTools || [];
      let dummySafetyReqs = job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] };
      let dummyWorkHistory = workHistory;
      if (job.jobNo === "MKR-IN-00004") {
        dummySpareParts = [
          { partNo: "SP-00001", description: "Rudder Shaft Bearing", quantityRequired: "2", remarks: "For hydraulic pump replacement" },
          { partNo: "SP-00002", description: "Rudder Pintle Bush", quantityRequired: "1", remarks: "Spare for inspection" },
          { partNo: "SP-00003", description: "Rudder Carrier Bearing", quantityRequired: "1", remarks: "Preventive replacement" }
        ];
        dummyTools = [
          { toolName: "Hydraulic Jack 50T", quantity: "1", remarks: "For lifting rudder assembly" },
          { toolName: "Torque Wrench 100-500 Nm", quantity: "2", remarks: "For bolt tightening" },
          { toolName: "Dial Indicator Set", quantity: "1", remarks: "For alignment measurement" }
        ];
        dummySafetyReqs = {
          ppeRequirements: ["Safety Helmet", "Safety Shoes", "Safety Gloves"],
          permitRequirements: ["Hot Work Permit", "Confined Space Entry", "Lock Out Tag Out (LOTO)"],
          otherRequirements: ["Vessel at anchor or alongside", "Steering gear isolated", "Bridge informed"]
        };
        dummyWorkHistory = [
          { woNo: "MKR-IN-00004.WO-2025-001", assignedTo: "2nd Engineer", performedBy: "2nd Engineer", workDate: "2025-06-15", runDate: "", completionDate: "2025-06-15", status: "Completed", description: "Rudder inspection - hydraulic pump check", remarks: "No wear detected, pump in good condition" },
          { woNo: "MKR-IN-00004.WO-2024-003", assignedTo: "Chief Engineer", performedBy: "Chief Engineer", workDate: "2024-12-20", runDate: "", completionDate: "2024-12-20", status: "Completed", description: "Rudder bearing clearance check", remarks: "Clearance within limits" },
          { woNo: "MKR-IN-00004.WO-2024-001", assignedTo: "2nd Engineer", performedBy: "3rd Engineer", workDate: "2024-06-10", runDate: "", completionDate: "2024-06-12", status: "Completed", description: "Annual rudder system inspection", remarks: "Bearing replaced, alignment verified" }
        ];
      }
      const templateData = {
        woTitle: job.jobTitle,
        jobTitle: job.jobTitle,
        jobNo: job.jobNo,
        component: job.componentId,
        componentCode: job.componentCode,
        componentName: job.componentName,
        sfiCode: job.sfiCode || job.componentCode,
        maintenanceBasis: job.maintenanceBasis,
        maintenanceType: job.maintenanceType,
        frequencyValue: job.frequencyValue?.toString() || "",
        frequencyUnit: job.frequencyUnit || "Months",
        intervalRunningHour: job.intervalRunningHour?.toString() || "",
        assignedTo: job.assignedTo,
        approver: job.approver,
        department: job.department,
        jobPriority: job.jobPriority,
        classRelated: job.classRelated,
        criticality: job.criticality,
        lastDoneDate: convertToIsoDate(job.lastDoneDate),
        nextDueDate: convertToIsoDate(job.nextDueDate),
        lastDoneRH: job.lastDoneRH?.toString() || "",
        nextDueRH: job.nextDueRH?.toString() || "",
        briefWorkDescription: job.briefWorkDescription || job.jobDescription,
        jobDescription: job.jobDescription,
        requiredSpareParts: dummySpareParts,
        requiredTools: dummyTools,
        safetyRequirements: dummySafetyReqs,
        vesselId: job.vesselId,
        workHistory: dummyWorkHistory
      };
      res.json({
        job,
        templateData,
        component: component ? {
          id: component.id,
          componentCode: component.componentCode,
          name: component.name,
          parentId: component.parentId,
          currentCumulativeRH: component.currentCumulativeRH,
          lastUpdated: component.lastUpdated
        } : null,
        parentComponent: parentComponent ? {
          id: parentComponent.id,
          componentCode: parentComponent.componentCode,
          name: parentComponent.name,
          currentCumulativeRH: parentComponent.currentCumulativeRH
        } : null,
        maintenanceBasis: job.maintenanceBasis
      });
    } catch (error) {
      console.error("Failed to fetch job context:", error);
      res.status(500).json({ error: "Failed to fetch job context" });
    }
  });
  app2.post("/api/jobs", async (req, res) => {
    try {
      const { insertJobSchema: insertJobSchema3 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { calculateNextDueDate: calculateNextDueDate2 } = await Promise.resolve().then(() => (init_dateUtils(), dateUtils_exports));
      let jobData = insertJobSchema3.parse(req.body);
      let component = null;
      if (jobData.componentId) {
        component = await storage.getComponent(jobData.componentId);
        if (!component && jobData.componentCode && jobData.vesselId) {
          component = await storage.getComponentByCode(jobData.componentCode, jobData.vesselId);
          if (component) {
            jobData = { ...jobData, componentId: component.id };
          }
        }
        if (!component) {
          return res.status(400).json({
            error: "Component not found"
          });
        }
        if (!component.parentId) {
          return res.status(400).json({
            error: "Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component."
          });
        }
      }
      if (!jobData.jobNo) {
        const { generateJobNumber: generateJobNumber2 } = await Promise.resolve().then(() => (init_workOrderNumbering(), workOrderNumbering_exports));
        const taskType = jobData.taskType;
        const generatedJobNo = await generateJobNumber2(storage, taskType);
        jobData = {
          ...jobData,
          jobNo: generatedJobNo
        };
      }
      if (jobData.maintenanceBasis === "Calendar" && !jobData.nextDueDate) {
        const { normalizeDateToDDMMMYYYY: normalizeDateToDDMMMYYYY2 } = await Promise.resolve().then(() => (init_dateUtils(), dateUtils_exports));
        const rawLastDone = jobData.lastDoneDate || component?.installationDate;
        if (rawLastDone && jobData.frequencyValue && jobData.frequencyUnit) {
          const lastDone = normalizeDateToDDMMMYYYY2(rawLastDone);
          if (lastDone) {
            const calculatedNextDue = calculateNextDueDate2(lastDone, jobData.frequencyValue, jobData.frequencyUnit);
            if (calculatedNextDue) {
              jobData = { ...jobData, nextDueDate: calculatedNextDue };
            }
          }
        }
      }
      if (jobData.maintenanceBasis === "Running Hours") {
        const intervalRH = Number(jobData.intervalRunningHour);
        if (isNaN(intervalRH) || intervalRH <= 0) {
          return res.status(400).json({
            error: "Running Hours jobs require a valid numeric intervalRunningHour greater than 0"
          });
        }
        const rawLastDoneRH = jobData.lastDoneRH || (component?.runningHours ? String(component.runningHours) : null);
        if (!rawLastDoneRH) {
          return res.status(400).json({
            error: "Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH"
          });
        }
        const lastRH = Number(rawLastDoneRH);
        if (isNaN(lastRH)) {
          return res.status(400).json({
            error: "lastDoneRH must be a valid number"
          });
        }
        const calculatedNextDueRH = String(lastRH + intervalRH);
        jobData = {
          ...jobData,
          nextDueRH: calculatedNextDueRH,
          lastDoneRH: String(lastRH)
        };
      }
      const job = await storage.createJob(jobData);
      res.status(201).json(job);
    } catch (error) {
      console.error("Failed to create job:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create job" });
    }
  });
  app2.patch("/api/jobs/:id", async (req, res) => {
    try {
      const { calculateNextDueDate: calculateNextDueDate2 } = await Promise.resolve().then(() => (init_dateUtils(), dateUtils_exports));
      let updateData = { ...req.body };
      let component = null;
      if (req.body.componentId) {
        component = await storage.getComponent(req.body.componentId);
        if (!component) {
          return res.status(400).json({
            error: "Component not found"
          });
        }
        if (!component.parentId) {
          return res.status(400).json({
            error: "Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component."
          });
        }
      }
      const existingJob = await storage.getJob(req.params.id);
      if (!existingJob) {
        return res.status(404).json({ error: "Job not found" });
      }
      const mergedData = { ...existingJob, ...updateData };
      const calendarFieldsChanged = updateData.lastDoneDate !== void 0 || updateData.frequencyValue !== void 0 || updateData.frequencyUnit !== void 0 || updateData.maintenanceBasis !== void 0;
      if (mergedData.maintenanceBasis === "Calendar" && calendarFieldsChanged) {
        const { normalizeDateToDDMMMYYYY: normalizeDateToDDMMMYYYY2 } = await Promise.resolve().then(() => (init_dateUtils(), dateUtils_exports));
        if (!component && mergedData.componentId) {
          component = await storage.getComponent(mergedData.componentId);
        }
        const rawLastDone = mergedData.lastDoneDate || component?.installationDate;
        if (rawLastDone && mergedData.frequencyValue && mergedData.frequencyUnit) {
          const lastDone = normalizeDateToDDMMMYYYY2(rawLastDone);
          if (lastDone) {
            const calculatedNextDue = calculateNextDueDate2(lastDone, mergedData.frequencyValue, mergedData.frequencyUnit);
            if (calculatedNextDue) {
              updateData.nextDueDate = calculatedNextDue;
            }
          }
        }
      } else if (updateData.maintenanceBasis === "Running Hours" && existingJob.maintenanceBasis === "Calendar") {
        updateData.nextDueDate = null;
      }
      const rhFieldsChanged = updateData.lastDoneRH !== void 0 || updateData.intervalRunningHour !== void 0 || updateData.maintenanceBasis !== void 0;
      if (mergedData.maintenanceBasis === "Running Hours") {
        const intervalRH = Number(mergedData.intervalRunningHour);
        if (isNaN(intervalRH) || intervalRH <= 0) {
          return res.status(400).json({
            error: "Running Hours jobs require a valid numeric intervalRunningHour greater than 0"
          });
        }
        if (!component && mergedData.componentId) {
          component = await storage.getComponent(mergedData.componentId);
        }
        const rawLastDoneRH = mergedData.lastDoneRH || (component?.runningHours ? String(component.runningHours) : null);
        if (!rawLastDoneRH) {
          return res.status(400).json({
            error: "Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH"
          });
        }
        const lastRH = Number(rawLastDoneRH);
        if (isNaN(lastRH)) {
          return res.status(400).json({
            error: "lastDoneRH must be a valid number"
          });
        }
        if (rhFieldsChanged) {
          updateData.nextDueRH = String(lastRH + intervalRH);
          if (!mergedData.lastDoneRH) {
            updateData.lastDoneRH = String(lastRH);
          }
        }
      } else if (updateData.maintenanceBasis === "Calendar" && existingJob.maintenanceBasis === "Running Hours") {
        updateData.nextDueRH = null;
      }
      const job = await storage.updateJob(req.params.id, updateData);
      res.json(job);
    } catch (error) {
      console.error("Failed to update job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });
  app2.delete("/api/jobs/:id", async (req, res) => {
    try {
      await storage.deleteJob(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete job:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });
  app2.get("/api/maintenance-planner", async (req, res) => {
    try {
      const {
        vesselId,
        jobType,
        // 'CALENDAR' | 'RH' | 'BOTH'
        fromDate,
        // ISO date string for calendar jobs
        toDate,
        remainingHoursMin,
        // For RH jobs
        remainingHoursMax,
        includeOverdue,
        // boolean string
        ranks,
        // comma-separated ranks
        department,
        criticalOnly
        // boolean string
      } = req.query;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      const allJobs = await storage.getJobs(vesselId);
      const activeJobs = allJobs.filter((j) => j.isActive !== false && j.dataScope === "vessel");
      const components2 = await storage.getComponents(vesselId);
      const componentMap = new Map(components2.map((c) => [c.id, c]));
      const componentCodeMap = new Map(components2.map((c) => [c.componentCode, c]));
      const allWorkOrders = await storage.getWorkOrders(vesselId);
      const allSpares = await storage.getSpares(vesselId);
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const plannerItems = [];
      for (const job of activeJobs) {
        const component = componentMap.get(job.componentId) || componentCodeMap.get(job.componentCode);
        const isCalendarJob = job.maintenanceBasis === "Calendar" || job.frequencyType === "Calendar";
        const isRHJob = job.maintenanceBasis === "Running Hours" || job.frequencyType === "Running Hours";
        const jobTypeFilter = jobType?.toUpperCase();
        if (jobTypeFilter === "CALENDAR" && !isCalendarJob) continue;
        if (jobTypeFilter === "RH" && !isRHJob) continue;
        if (department && department !== "all" && job.department !== department) continue;
        if (ranks) {
          const rankList = ranks.split(",").map((r) => r.trim().toLowerCase());
          const assignedRank = (job.assignedTo || "").toLowerCase();
          if (rankList.length > 0 && !rankList.some((r) => assignedRank.includes(r))) continue;
        }
        if (criticalOnly === "true") {
          const isCritical = job.criticality === "Yes" || job.jobPriority === "Critical" || component?.critical;
          if (!isCritical) continue;
        }
        let nextDueDate = null;
        let remainingHours = null;
        let status = "FUTURE";
        let parentRH = null;
        if (isCalendarJob) {
          if (job.nextDueDate) {
            nextDueDate = new Date(job.nextDueDate);
          } else if (job.lastDoneDate && job.frequencyValue && job.frequencyUnit) {
            const lastDone = new Date(job.lastDoneDate);
            const freqVal = parseInt(job.frequencyValue) || 0;
            nextDueDate = new Date(lastDone);
            switch (job.frequencyUnit) {
              case "Days":
                nextDueDate.setDate(nextDueDate.getDate() + freqVal);
                break;
              case "Weeks":
                nextDueDate.setDate(nextDueDate.getDate() + freqVal * 7);
                break;
              case "Months":
                nextDueDate.setMonth(nextDueDate.getMonth() + freqVal);
                break;
              case "Years":
                nextDueDate.setFullYear(nextDueDate.getFullYear() + freqVal);
                break;
            }
          }
          if (nextDueDate) {
            const daysUntilDue = Math.floor((nextDueDate.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
            if (daysUntilDue < 0) {
              status = "OVERDUE";
            } else if (daysUntilDue <= 30) {
              status = "DUE_SOON";
            } else {
              status = "FUTURE";
            }
            if (fromDate || toDate) {
              const from = fromDate ? new Date(fromDate) : /* @__PURE__ */ new Date(0);
              const to = toDate ? new Date(toDate) : /* @__PURE__ */ new Date("2099-12-31");
              if (status === "OVERDUE" && includeOverdue !== "true") continue;
              if (status !== "OVERDUE" && (nextDueDate < from || nextDueDate > to)) continue;
            }
          }
        } else if (isRHJob) {
          let parentComponent = component;
          if (component?.parentId) {
            parentComponent = componentCodeMap.get(component.parentId) || component;
          }
          parentRH = parseFloat(parentComponent?.currentCumulativeRH || "0") || 0;
          const lastDoneRH = parseFloat(job.lastDoneRH || "0") || 0;
          const frequencyRH = parseInt(job.frequencyValue || "0") || job.intervalRunningHour || 0;
          const usedSinceLastDone = parentRH - lastDoneRH;
          remainingHours = Math.max(0, frequencyRH - usedSinceLastDone);
          if (remainingHours <= 0) {
            status = "OVERDUE";
          } else if (remainingHours <= (job.leadTimeValue || 168)) {
            status = "DUE_SOON";
          } else {
            status = "FUTURE";
          }
          if (remainingHoursMin || remainingHoursMax) {
            const minRH = parseFloat(remainingHoursMin) || 0;
            const maxRH = parseFloat(remainingHoursMax) || Infinity;
            if (status === "OVERDUE" && includeOverdue !== "true") continue;
            if (status !== "OVERDUE" && (remainingHours < minRH || remainingHours > maxRH)) continue;
          }
        }
        if (includeOverdue !== "true" && status === "OVERDUE") {
        }
        const openWO = allWorkOrders.find(
          (wo) => wo.jobId === job.id && wo.status !== "Completed" && wo.status !== "Rejected"
        );
        let spareStatus = "NOT_SET";
        const requiredSpares = job.requiredSpareParts || [];
        if (requiredSpares.length > 0) {
          let hasZero = false;
          let hasLow = false;
          for (const reqSpare of requiredSpares) {
            const spare = allSpares.find(
              (s) => s.partCode === reqSpare.partNo || s.partName === reqSpare.description
            );
            if (spare) {
              if (spare.rob === 0) hasZero = true;
              else if (spare.rob < spare.min) hasLow = true;
            }
          }
          if (hasZero) spareStatus = "ZERO";
          else if (hasLow) spareStatus = "LOW";
          else spareStatus = "OK";
        }
        plannerItems.push({
          jobId: job.id,
          jobCode: job.jobNo,
          jobTitle: job.jobTitle,
          jobType: isCalendarJob ? "CALENDAR" : "RH",
          componentId: job.componentId,
          componentCode: job.componentCode,
          componentName: job.componentName,
          department: job.department || component?.department || "N/A",
          assignedRank: job.assignedTo || "Unassigned",
          criticalFlag: job.criticality === "Yes" || job.jobPriority === "Critical" || component?.critical || false,
          classRelatedFlag: job.classRelated === "Yes",
          estimatedManHours: parseFloat(job.estimatedManHours || "0") || 0,
          nextDueDate: nextDueDate ? nextDueDate.toISOString().split("T")[0] : null,
          remainingHours,
          parentRH,
          status,
          woId: openWO?.id || null,
          woNo: openWO?.workOrderNo || null,
          woStatus: openWO?.status || null,
          spareStatus,
          frequencyValue: job.frequencyValue,
          frequencyUnit: job.frequencyUnit,
          lastDoneDate: job.lastDoneDate,
          lastDoneRH: job.lastDoneRH
        });
      }
      const statusPriority = {
        "OVERDUE": 0,
        "DUE_SOON": 1,
        "FUTURE": 2
      };
      plannerItems.sort((a, b) => {
        const statusDiff = statusPriority[a.status] - statusPriority[b.status];
        if (statusDiff !== 0) return statusDiff;
        if (a.jobType === "CALENDAR" && b.jobType === "CALENDAR") {
          if (a.nextDueDate && b.nextDueDate) {
            return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
          }
        }
        if (a.jobType === "RH" && b.jobType === "RH") {
          return (a.remainingHours || 0) - (b.remainingHours || 0);
        }
        return 0;
      });
      const totalManHours = plannerItems.reduce((sum, item) => sum + item.estimatedManHours, 0);
      const byRank = {};
      for (const item of plannerItems) {
        const rank = item.assignedRank || "Unassigned";
        if (!byRank[rank]) byRank[rank] = { jobs: 0, manHours: 0 };
        byRank[rank].jobs++;
        byRank[rank].manHours += item.estimatedManHours;
      }
      const byDepartment = {};
      for (const item of plannerItems) {
        const dept = item.department || "N/A";
        if (!byDepartment[dept]) byDepartment[dept] = { jobs: 0, manHours: 0 };
        byDepartment[dept].jobs++;
        byDepartment[dept].manHours += item.estimatedManHours;
      }
      const byStatus = { OVERDUE: 0, DUE_SOON: 0, FUTURE: 0 };
      for (const item of plannerItems) {
        byStatus[item.status]++;
      }
      res.json({
        summary: {
          totalJobs: plannerItems.length,
          totalManHours: Math.round(totalManHours * 10) / 10,
          byRank: Object.entries(byRank).map(([rank, data]) => ({
            rank,
            jobs: data.jobs,
            manHours: Math.round(data.manHours * 10) / 10
          })),
          byDepartment: Object.entries(byDepartment).map(([dept, data]) => ({
            department: dept,
            jobs: data.jobs,
            manHours: Math.round(data.manHours * 10) / 10
          })),
          byStatus
        },
        jobs: plannerItems
      });
    } catch (error) {
      console.error("Maintenance planner error:", error);
      res.status(500).json({ error: "Failed to fetch maintenance planner data: " + error.message });
    }
  });
  app2.get("/api/maintenance-planner/export", async (req, res) => {
    try {
      const format2 = req.query.format || "excel";
      const vesselId = req.query.vesselId;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      const plannerResponse = await fetch(`http://localhost:${process.env.PORT || 5e3}/api/maintenance-planner?${new URLSearchParams(req.query).toString()}`);
      const plannerData = await plannerResponse.json();
      if (format2 === "excel") {
        const wb = XLSX2.utils.book_new();
        const jobsData = plannerData.jobs.map((job) => ({
          "Job Code": job.jobCode,
          "Job Title": job.jobTitle,
          "Component Code": job.componentCode,
          "Component Name": job.componentName,
          "Department": job.department,
          "Assigned Rank": job.assignedRank,
          "Job Type": job.jobType,
          "Next Due Date": job.nextDueDate || "-",
          "Remaining Hours": job.remainingHours !== null ? job.remainingHours : "-",
          "Status": job.status,
          "Est. Man-Hours": job.estimatedManHours,
          "Spare Status": job.spareStatus,
          "WO No.": job.woNo || "-",
          "WO Status": job.woStatus || "-",
          "Critical": job.criticalFlag ? "Yes" : "No",
          "Class Related": job.classRelatedFlag ? "Yes" : "No"
        }));
        const ws = XLSX2.utils.json_to_sheet(jobsData);
        XLSX2.utils.book_append_sheet(wb, ws, "Maintenance Planner");
        const summaryData = [
          { "Metric": "Total Jobs", "Value": plannerData.summary.totalJobs },
          { "Metric": "Total Man-Hours", "Value": plannerData.summary.totalManHours },
          { "Metric": "Overdue Jobs", "Value": plannerData.summary.byStatus.OVERDUE },
          { "Metric": "Due Soon Jobs", "Value": plannerData.summary.byStatus.DUE_SOON },
          { "Metric": "Future Jobs", "Value": plannerData.summary.byStatus.FUTURE }
        ];
        const summaryWs = XLSX2.utils.json_to_sheet(summaryData);
        XLSX2.utils.book_append_sheet(wb, summaryWs, "Summary");
        const rankData = plannerData.summary.byRank.map((r) => ({
          "Rank": r.rank,
          "Jobs": r.jobs,
          "Man-Hours": r.manHours
        }));
        const rankWs = XLSX2.utils.json_to_sheet(rankData);
        XLSX2.utils.book_append_sheet(wb, rankWs, "Workload by Rank");
        const buffer = XLSX2.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=maintenance-planner-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.xlsx`);
        res.send(buffer);
      } else {
        res.json(plannerData);
      }
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export maintenance planner: " + error.message });
    }
  });
  app2.get("/api/component-documents/:componentId", requireAuth, async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (component.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot access documents for components from other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      const documents = await storage.getComponentDocuments(req.params.componentId);
      const filteredDocuments = documents.filter((doc) => {
        if (!req.user) return false;
        if (req.user.role === "PMS Admin" || req.user.role === "Office") {
          return true;
        }
        if (req.user.role === "Ship") {
          return doc.canShipView;
        }
        return false;
      });
      res.json(filteredDocuments);
    } catch (error) {
      console.error("Failed to get component documents:", error);
      res.status(500).json({ error: "Failed to get component documents" });
    }
  });
  app2.post("/api/component-documents", requirePMSAdmin, upload2.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File upload required - cannot create document without a file" });
      }
      const component = await storage.getComponent(req.body.componentId);
      if (!component) {
        return res.status(400).json({ error: "Invalid componentId - component not found" });
      }
      if (component.componentCode !== req.body.componentCode) {
        return res.status(400).json({
          error: "componentCode mismatch - does not match component's code",
          componentCode: component.componentCode,
          providedCode: req.body.componentCode
        });
      }
      if (component.vesselCode !== req.body.vesselCode) {
        return res.status(400).json({
          error: "vesselCode mismatch - does not match component's vessel",
          componentVessel: component.vesselCode,
          providedVessel: req.body.vesselCode
        });
      }
      const timestamp2 = Date.now();
      const safeFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileKey = `${component.componentCode}/${timestamp2}_${safeFileName}`;
      const fileSize = req.file.size;
      const storageBackend = "object";
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        console.error("\u274C Object storage not configured - DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
        return res.status(500).json({
          error: "Object storage not configured. Please set up object storage in the Replit Object Storage panel."
        });
      }
      try {
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(`.private/documents/${fileKey}`);
        await file.save(req.file.buffer, {
          metadata: {
            contentType: req.file.mimetype
          }
        });
        console.log(`\u{1F4E4} Uploaded file to object storage: ${fileKey}`);
      } catch (storageError) {
        console.error("\u274C Object storage upload failed:", storageError);
        return res.status(500).json({ error: "Failed to upload file to object storage" });
      }
      const coercedBody = {
        componentId: component.id,
        // Use validated component data
        componentCode: component.componentCode,
        // Use validated component data
        vesselCode: component.vesselCode,
        // Use validated component data
        fleetEquipmentCode: req.body.fleetEquipmentCode || null,
        fileName: req.body.fileName,
        fileType: req.body.fileType,
        version: req.body.version || "1.0",
        canShipView: req.body.canShipView === "true" || req.body.canShipView === true,
        canShipDownload: req.body.canShipDownload === "true" || req.body.canShipDownload === true,
        isActive: req.body.isActive === "true" || req.body.isActive === true || req.body.isActive === void 0,
        notes: req.body.notes || null,
        uploadedBy: req.user.username,
        fileKey,
        // Already set from upload
        fileSize,
        // Already a number from multer
        storageBackend
        // Track where file is stored (now part of schema)
      };
      const documentData = insertComponentDocumentSchema.parse(coercedBody);
      try {
        const document = await storage.createComponentDocument(documentData);
        res.json(document);
      } catch (dbError) {
        console.error("Failed to create document in database, rolling back file upload:", dbError);
        try {
          const bucket = objectStorageClient.bucket(bucketId);
          const file = bucket.file(`.private/documents/${fileKey}`);
          await file.delete();
        } catch (deleteError) {
          console.error("Failed to cleanup uploaded file after DB error:", deleteError);
        }
        return res.status(500).json({ error: "Failed to create document record" });
      }
    } catch (error) {
      console.error("Failed to create component document:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create component document" });
    }
  });
  app2.put("/api/component-documents/:id", requirePMSAdmin, async (req, res) => {
    try {
      const updateSchema = insertComponentDocumentSchema.pick({
        version: true,
        canShipView: true,
        canShipDownload: true,
        isActive: true,
        notes: true
      }).partial();
      const parseBoolean = (value) => {
        if (value === void 0 || value === null) return void 0;
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return void 0;
      };
      const updateData = {};
      if (req.body.version !== void 0) {
        updateData.version = req.body.version;
      }
      const parsedCanShipView = parseBoolean(req.body.canShipView);
      if (parsedCanShipView !== void 0) {
        updateData.canShipView = parsedCanShipView;
      }
      const parsedCanShipDownload = parseBoolean(req.body.canShipDownload);
      if (parsedCanShipDownload !== void 0) {
        updateData.canShipDownload = parsedCanShipDownload;
      }
      const parsedIsActive = parseBoolean(req.body.isActive);
      if (parsedIsActive !== void 0) {
        updateData.isActive = parsedIsActive;
      }
      if (req.body.notes !== void 0) {
        updateData.notes = req.body.notes;
      }
      const validatedData = updateSchema.parse(updateData);
      const document = await storage.updateComponentDocument(parseInt(req.params.id), validatedData);
      res.json(document);
    } catch (error) {
      console.error("Failed to update component document:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update component document" });
    }
  });
  app2.delete("/api/component-documents/:id", requirePMSAdmin, async (req, res) => {
    try {
      await storage.deleteComponentDocument(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete component document:", error);
      res.status(500).json({ error: "Failed to delete component document" });
    }
  });
  app2.get("/api/component-documents/:id/download", requireAuth, async (req, res) => {
    try {
      const document = await storage.getComponentDocument(parseInt(req.params.id));
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (req.user.vesselId !== document.vesselCode) {
          return res.status(403).json({ error: "Cannot access documents from other vessels" });
        }
      }
      if (req.user.role === "Ship" && !document.canShipDownload) {
        return res.status(403).json({ error: "Insufficient permissions to download this document" });
      }
      let fileBuffer;
      let contentType = "application/octet-stream";
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        console.error("\u274C Object storage not configured - DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
        return res.status(500).json({
          error: "Object storage not configured. Please set up object storage in the Replit Object Storage panel."
        });
      }
      try {
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(`.private/documents/${document.fileKey}`);
        [fileBuffer] = await file.download();
        console.log(`\u{1F4E4} Serving file from object storage: ${document.fileKey}`);
      } catch (objectError) {
        console.error("Failed to download from object storage:", objectError);
        return res.status(404).json({ error: "Document file not found in object storage" });
      }
      res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
      res.setHeader("Content-Type", contentType);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Failed to download document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document file not found in storage" });
      }
      res.status(500).json({ error: "Failed to download document" });
    }
  });
  app2.get("/api/component-class-regulatory/:componentId", requireAuth, async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (component.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot access classification data for components from other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      const items = await storage.getComponentClassRegulatory(req.params.componentId);
      res.json(items);
    } catch (error) {
      console.error("Failed to get component class regulatory data:", error);
      res.status(500).json({ error: "Failed to get component class regulatory data" });
    }
  });
  app2.post("/api/component-class-regulatory", requirePMSAdmin, async (req, res) => {
    try {
      const validatedData = insertComponentClassRegulatorySchema.parse({
        ...req.body,
        createdBy: req.user.username,
        updatedBy: req.user.username
      });
      const item = await storage.createComponentClassRegulatory(validatedData);
      res.json(item);
    } catch (error) {
      console.error("Failed to create component class regulatory:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid class regulatory data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create component class regulatory" });
    }
  });
  app2.put("/api/component-class-regulatory/:id", requirePMSAdmin, async (req, res) => {
    try {
      const validatedData = insertComponentClassRegulatorySchema.partial().parse({
        ...req.body,
        updatedBy: req.user.username
      });
      const item = await storage.updateComponentClassRegulatory(parseInt(req.params.id), validatedData);
      res.json(item);
    } catch (error) {
      console.error("Failed to update component class regulatory:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid class regulatory data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update component class regulatory" });
    }
  });
  app2.delete("/api/component-class-regulatory/:id", requirePMSAdmin, async (req, res) => {
    try {
      await storage.deleteComponentClassRegulatory(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete component class regulatory:", error);
      res.status(500).json({ error: "Failed to delete component class regulatory" });
    }
  });
  app2.get("/api/component-requisitions/:componentId", requireAuth, async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (component.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot access requisitions for components from other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      let requisitions = await storage.getComponentRequisitions(req.params.componentId);
      if (component.componentCode === "401.005" && requisitions.length === 0) {
        requisitions = [
          {
            id: 1001,
            requisitionNo: "REQ-401.005-001",
            componentId: req.params.componentId,
            itemOrService: "Rudder Shaft Bearing (SP-00001)",
            quantity: 2,
            uom: "PC",
            raisedOn: "2025-12-01",
            priority: "Normal",
            status: "PO Raised",
            requestedBy: "Chief Engineer",
            vesselCode: component.vesselCode
          },
          {
            id: 1002,
            requisitionNo: "REQ-401.005-002",
            componentId: req.params.componentId,
            itemOrService: "Rudder Actuator Service",
            quantity: 1,
            uom: "SRV",
            raisedOn: "2025-12-02",
            priority: "Urgent",
            status: "Delivered On Board",
            requestedBy: "2nd Engineer",
            vesselCode: component.vesselCode
          }
        ];
      }
      res.json(requisitions);
    } catch (error) {
      console.error("Failed to get component requisitions:", error);
      res.status(500).json({ error: "Failed to get component requisitions" });
    }
  });
  app2.get("/api/component-requisitions", requireAuth, async (req, res) => {
    try {
      let vesselCode = req.query.vesselCode;
      if (req.user.role === "Ship" && req.user.vesselId) {
        vesselCode = req.user.vesselId;
      }
      const requisitions = await storage.getAllComponentRequisitions(vesselCode);
      res.json(requisitions);
    } catch (error) {
      console.error("Failed to get all component requisitions:", error);
      res.status(500).json({ error: "Failed to get component requisitions" });
    }
  });
  app2.get("/api/component-requisitions/item/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getComponentRequisitionItem(parseInt(req.params.id));
      if (!item) {
        return res.status(404).json({ error: "Requisition not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (item.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot access requisitions from other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: item.vesselCode
          });
        }
      }
      res.json(item);
    } catch (error) {
      console.error("Failed to get component requisition:", error);
      res.status(500).json({ error: "Failed to get component requisition" });
    }
  });
  app2.post("/api/component-requisitions", requireAuth, async (req, res) => {
    try {
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (req.body.vesselCode && req.body.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot create requisitions for other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: req.body.vesselCode
          });
        }
        req.body.vesselCode = req.user.vesselId;
      }
      const validatedData = insertComponentRequisitionSchema.parse({
        ...req.body,
        requestedBy: req.body.requestedBy || req.user.username
      });
      const result = await storage.createComponentRequisition(validatedData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Failed to create component requisition:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid requisition data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create component requisition" });
    }
  });
  app2.put("/api/component-requisitions/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getComponentRequisitionItem(parseInt(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Requisition not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (existing.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot update requisitions from other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: existing.vesselCode
          });
        }
      }
      const validatedData = insertComponentRequisitionSchema.partial().parse(req.body);
      if (req.user.role !== "PMS Admin") {
        delete validatedData.vesselCode;
        delete validatedData.componentId;
      }
      const result = await storage.updateComponentRequisition(parseInt(req.params.id), validatedData);
      res.json(result);
    } catch (error) {
      console.error("Failed to update component requisition:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid requisition data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update component requisition" });
    }
  });
  app2.delete("/api/component-requisitions/:id", requirePMSAdmin, async (req, res) => {
    try {
      await storage.deleteComponentRequisition(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete component requisition:", error);
      res.status(500).json({ error: "Failed to delete component requisition" });
    }
  });
  app2.get("/api/component-maintenance-history", async (req, res) => {
    try {
      const allHistory = await storage.getAllComponentMaintenanceHistory();
      res.json(allHistory);
    } catch (error) {
      console.error("Failed to get all component maintenance history:", error);
      res.status(500).json({ error: "Failed to get component maintenance history" });
    }
  });
  app2.get("/api/component-maintenance-history/:componentId", requireAuth, async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (component.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot access maintenance history for components from other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      const history = await storage.getComponentMaintenanceHistory(req.params.componentId);
      res.json(history);
    } catch (error) {
      console.error("Failed to get component maintenance history:", error);
      res.status(500).json({ error: "Failed to get component maintenance history" });
    }
  });
  app2.get("/api/component-maintenance-history/item/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getComponentMaintenanceHistoryItem(parseInt(req.params.id));
      if (!item) {
        return res.status(404).json({ error: "Maintenance history item not found" });
      }
      if (req.user.role === "Ship" && req.user.vesselId) {
        if (item.vesselCode !== req.user.vesselId) {
          return res.status(403).json({
            error: "Cannot access maintenance history from other vessels",
            assignedVessel: req.user.vesselId,
            requestedVessel: item.vesselCode
          });
        }
      }
      res.json(item);
    } catch (error) {
      console.error("Failed to get maintenance history item:", error);
      res.status(500).json({ error: "Failed to get maintenance history item" });
    }
  });
  app2.get("/api/work-orders", async (req, res) => {
    try {
      const vesselId = req.query.vesselId;
      const workOrders2 = await storage.getWorkOrders(vesselId);
      const jobs2 = await storage.getJobs(vesselId);
      const jobsMap = new Map(jobs2.map((job) => [job.id, job]));
      const components2 = await storage.getComponents(vesselId);
      const componentsMap = new Map(components2.map((comp) => [comp.id, comp]));
      const vesselSettings = vesselId ? await storage.getPmsVesselSettings(vesselId) : null;
      const vesselGraceSettings = vesselSettings ? {
        calendarGraceMode: vesselSettings.calendarGraceMode || "COMPANY_STANDARD",
        calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
        rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
        rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
      } : void 0;
      const enrichedWorkOrders = workOrders2.map((wo) => {
        const job = wo.jobId ? jobsMap.get(wo.jobId) : wo.templateCode ? jobs2.find((j) => j.jobNo === wo.templateCode) : null;
        const component = wo.component ? componentsMap.get(wo.component) : null;
        const parseRH = (value) => {
          if (value == null || value === "") return void 0;
          const num = Number(value);
          return isNaN(num) ? void 0 : num;
        };
        const dueRH = wo.maintenanceBasis === "Running Hours" ? parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading) : void 0;
        const currentRH = wo.maintenanceBasis === "Running Hours" ? parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading) : void 0;
        const isJobCritical3 = job?.jobPriority === "Critical" || job?.classRelated === "true" || job?.classRelated === true;
        const rhLeadTimeHours = wo.maintenanceBasis === "Running Hours" ? isJobCritical3 ? vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL : vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL : void 0;
        return {
          ...wo,
          // Hydrate assignedTo from job if work order has 'Unassigned' or empty value
          assignedTo: wo.assignedTo && wo.assignedTo !== "Unassigned" ? wo.assignedTo : job?.assignedTo || "Unassigned",
          computedStatus: computeWorkOrderStatus({
            dueDate: wo.dueDate,
            dueRH,
            currentRH,
            isExecution: wo.isExecution,
            status: wo.status,
            completionDateTime: wo.dateCompleted,
            maintenanceBasis: wo.maintenanceBasis || job?.maintenanceBasis || void 0,
            vesselGraceSettings,
            rhLeadTimeHours
          }),
          leadTimeValue: job?.leadTimeValue ?? null,
          leadTimeUnit: job?.leadTimeUnit ?? null,
          dueRH: dueRH ?? null,
          currentRH: currentRH ?? null
        };
      });
      const statusPriority = {
        "Overdue": 1,
        "Due (Grace P)": 2,
        "Due": 3,
        "Due Soon": 4,
        "Planned": 5,
        "Postponed": 6,
        "Pending Approval": 7,
        "Active": 8,
        "Completed": 9,
        "Rejected": 10
      };
      const sortedWorkOrders = enrichedWorkOrders.sort((a, b) => {
        const aPriority = statusPriority[a.computedStatus] ?? 99;
        const bPriority = statusPriority[b.computedStatus] ?? 99;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });
      res.json(sortedWorkOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });
  app2.get("/api/work-orders/:id", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      let leadTimeValue = null;
      let leadTimeUnit = null;
      let job = null;
      if (workOrder.vesselId) {
        const jobs2 = await storage.getJobs(workOrder.vesselId);
        job = workOrder.jobId ? jobs2.find((j) => j.id === workOrder.jobId) : workOrder.templateCode ? jobs2.find((j) => j.jobNo === workOrder.templateCode) : null;
        leadTimeValue = job?.leadTimeValue ?? null;
        leadTimeUnit = job?.leadTimeUnit ?? null;
      }
      const component = workOrder.component ? await storage.getComponent(workOrder.component) : null;
      const parseRH = (value) => {
        if (value == null || value === "") return void 0;
        const num = Number(value);
        return isNaN(num) ? void 0 : num;
      };
      const dueRH = workOrder.maintenanceBasis === "Running Hours" ? parseRH(job?.nextDueRH) ?? parseRH(workOrder.nextDueReading) : void 0;
      const currentRH = workOrder.maintenanceBasis === "Running Hours" ? parseRH(component?.currentCumulativeRH) ?? parseRH(workOrder.currentReading) : void 0;
      const vesselSettings = workOrder.vesselId ? await storage.getPmsVesselSettings(workOrder.vesselId) : null;
      const vesselGraceSettings = vesselSettings ? {
        calendarGraceMode: vesselSettings.calendarGraceMode || "COMPANY_STANDARD",
        calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
        rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
        rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
      } : void 0;
      const isJobCritical3 = job?.jobPriority === "Critical" || job?.classRelated === "true" || job?.classRelated === true;
      const rhLeadTimeHours = workOrder.maintenanceBasis === "Running Hours" ? isJobCritical3 ? vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL : vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL : void 0;
      const enrichedWorkOrder = {
        ...workOrder,
        computedStatus: computeWorkOrderStatus({
          dueDate: workOrder.dueDate,
          dueRH,
          currentRH,
          isExecution: workOrder.isExecution,
          status: workOrder.status,
          completionDateTime: workOrder.dateCompleted,
          maintenanceBasis: workOrder.maintenanceBasis || job?.maintenanceBasis || void 0,
          vesselGraceSettings,
          rhLeadTimeHours
        }),
        leadTimeValue,
        leadTimeUnit
      };
      res.json(enrichedWorkOrder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work order" });
    }
  });
  app2.get("/api/work-orders/:id/context", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      let component = await storage.getComponent(workOrder.component);
      if (!component && workOrder.componentCode && workOrder.vesselId) {
        component = await storage.getComponentByCode(workOrder.componentCode, workOrder.vesselId);
      }
      if (!component) {
        const allComponents = await storage.getComponents(workOrder.vesselId ?? void 0);
        component = allComponents.find(
          (c) => c.name === workOrder.component || c.componentCode === workOrder.component || c.componentCode === workOrder.componentCode
        );
      }
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      let parentComponent = null;
      if (component.parentId) {
        parentComponent = await storage.getComponent(component.parentId);
      }
      const audits = await storage.getRunningHoursAudits(workOrder.component);
      const latestAudit = audits.length > 0 ? audits[0] : null;
      let job = null;
      if (workOrder.jobId) {
        job = await storage.getJob(workOrder.jobId);
      }
      const convertToIsoDate = (dateStr) => {
        if (!dateStr) return "";
        const monthMap = {
          "Jan": "01",
          "Feb": "02",
          "Mar": "03",
          "Apr": "04",
          "May": "05",
          "Jun": "06",
          "Jul": "07",
          "Aug": "08",
          "Sep": "09",
          "Oct": "10",
          "Nov": "11",
          "Dec": "12"
        };
        const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          const monthNum = monthMap[month];
          if (monthNum) {
            return `${year}-${monthNum}-${day.padStart(2, "0")}`;
          }
        }
        return dateStr;
      };
      const templateData = job ? {
        woTitle: job.jobTitle,
        jobTitle: job.jobTitle,
        jobNo: job.jobNo,
        component: workOrder.component,
        componentCode: job.componentCode || component.componentCode,
        componentName: job.componentName || component.name,
        sfiCode: job.sfiCode || job.componentCode || component.componentCode,
        maintenanceBasis: job.maintenanceBasis,
        maintenanceType: job.maintenanceType,
        frequencyValue: job.frequencyValue?.toString() || "",
        frequencyUnit: job.frequencyUnit || "Months",
        intervalRunningHour: job.intervalRunningHour?.toString() || "",
        assignedTo: job.assignedTo,
        approver: job.approver,
        department: job.department,
        jobPriority: job.jobPriority,
        classRelated: job.classRelated,
        criticality: job.criticality,
        lastDoneDate: convertToIsoDate(job.lastDoneDate),
        nextDueDate: convertToIsoDate(job.nextDueDate),
        lastDoneRH: job.lastDoneRH?.toString() || "",
        nextDueRH: job.nextDueRH?.toString() || "",
        briefWorkDescription: job.briefWorkDescription || job.jobDescription,
        jobDescription: job.jobDescription,
        requiredSpareParts: job.requiredSpareParts || [],
        requiredTools: job.requiredTools || [],
        safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
        vesselId: workOrder.vesselId
      } : {
        // Fallback: use work order fields if job not found (for unplanned WOs)
        woTitle: workOrder.jobTitle,
        jobTitle: workOrder.jobTitle,
        jobNo: workOrder.templateCode,
        component: workOrder.component,
        componentCode: component.componentCode,
        componentName: component.name,
        sfiCode: component.componentCode,
        maintenanceBasis: workOrder.maintenanceBasis || "Calendar",
        maintenanceType: workOrder.maintenanceType,
        frequencyValue: workOrder.frequencyValue?.toString() || "",
        frequencyUnit: workOrder.frequencyUnit || "Months",
        intervalRunningHour: "",
        assignedTo: workOrder.assignedTo,
        approver: workOrder.approver,
        department: workOrder.department,
        jobPriority: workOrder.jobPriority,
        classRelated: workOrder.classRelated,
        criticality: workOrder.criticality,
        lastDoneDate: "",
        nextDueDate: convertToIsoDate(workOrder.dueDate),
        lastDoneRH: "",
        nextDueRH: "",
        briefWorkDescription: workOrder.briefWorkDescription,
        jobDescription: workOrder.briefWorkDescription,
        requiredSpareParts: [],
        requiredTools: [],
        safetyRequirements: { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
        vesselId: workOrder.vesselId
      };
      let executionData = {
        // B1 - Risk Assessment, Checklists & Records
        riskAssessmentStatus: workOrder.riskAssessmentStatus || "",
        safetyChecklistsStatus: workOrder.safetyChecklistsStatus || "",
        operationalFormsStatus: workOrder.operationalFormsStatus || "",
        uploadedDocuments: workOrder.uploadedDocuments || [],
        // B2 - Work Duration
        startDateTime: workOrder.startDateTime || "",
        completionDateTime: workOrder.completionDateTime || "",
        executionAssignedTo: workOrder.executionAssignedTo || "",
        performedBy: workOrder.performedBy || "",
        noOfPersons: workOrder.noOfPersons || "",
        totalTimeHours: workOrder.totalTimeHours || "",
        manhours: workOrder.manhours || "",
        workCarriedOut: workOrder.workCarriedOut || "",
        jobExperienceNotes: workOrder.jobExperienceNotes || "",
        // B3 - Running Hours
        previousReading: workOrder.previousReading?.toString() || "",
        currentReading: workOrder.currentReading?.toString() || "",
        runningHoursDifference: workOrder.runningHoursDifference?.toString() || "",
        readingDate: workOrder.readingDate || "",
        runningHours: workOrder.runningHours || "",
        // B4 - Spare Parts Consumed
        consumedSpareParts: workOrder.consumedSpareParts || [],
        // Metadata
        woExecutionId: workOrder.woExecutionId || "",
        remarks: workOrder.remarks || "",
        dateCompleted: workOrder.dateCompleted || "",
        completionRemarks: workOrder.completionRemarks || ""
      };
      let finalTemplateData = { ...templateData };
      if (workOrder.workOrderNo === "MKR-IN-00001.WO-2025-003" || workOrder.workOrderNo === "MKR-SE-00001.WO-2025-001") {
        finalTemplateData.requiredSpareParts = [
          { partNo: "SP-00004", description: "Impressed Current Anode", quantityRequired: "2", remarks: "Annual replacement" },
          { partNo: "SP-00005", description: "Reference Cell Electrode", quantityRequired: "1", remarks: "Check and replace if corroded" }
        ];
        finalTemplateData.requiredTools = [
          { toolName: "Digital Multimeter", quantity: "1", remarks: "For voltage measurement" },
          { toolName: "Insulation Tester (Megger)", quantity: "1", remarks: "For insulation resistance check" }
        ];
        finalTemplateData.safetyRequirements = {
          ppeRequirements: ["Safety Gloves (Electrical)", "Safety Goggles"],
          permitRequirements: ["Electrical Work Permit", "Diving Operations Permit"],
          otherRequirements: ["System isolated before work", "Vessel grounded properly"]
        };
        finalTemplateData.workHistory = [
          { woNo: "MKR-IN-00001.WO-2024-002", assignedTo: "2nd Engineer", performedBy: "2nd Engineer", workDate: "2024-11-15", runDate: "", completionDate: "2024-11-15", status: "Completed", description: "Impressed current system inspection", remarks: "All anodes functional" },
          { woNo: "MKR-IN-00001.WO-2024-001", assignedTo: "3rd Engineer", performedBy: "3rd Engineer", workDate: "2024-05-20", runDate: "", completionDate: "2024-05-22", status: "Completed", description: "Annual anode replacement", remarks: "2 anodes replaced" }
        ];
        executionData.previousReading = "8500";
        executionData.currentReading = "8750";
        executionData.consumedSpareParts = [
          { partNo: "SP-00004", description: "Impressed Current Anode", quantityConsumed: "2", comments: "Replaced worn anodes" },
          { partNo: "SP-00005", description: "Reference Cell Electrode", quantityConsumed: "1", comments: "Corroded electrode replaced" }
        ];
      }
      res.json({
        workOrder,
        templateData: finalTemplateData,
        executionData,
        job,
        component: {
          id: component.id,
          componentCode: component.componentCode,
          name: component.name,
          parentId: component.parentId,
          currentCumulativeRH: component.currentCumulativeRH,
          lastUpdated: latestAudit?.dateUpdatedLocal || component.lastUpdated
        },
        parentComponent: parentComponent ? {
          id: parentComponent.id,
          componentCode: parentComponent.componentCode,
          name: parentComponent.name,
          currentCumulativeRH: parentComponent.currentCumulativeRH
        } : null,
        maintenanceBasis: workOrder.maintenanceBasis || job?.maintenanceBasis
      });
    } catch (error) {
      console.error("Failed to fetch work order context:", error);
      res.status(500).json({ error: "Failed to fetch work order context" });
    }
  });
  app2.post("/api/work-orders", async (req, res) => {
    try {
      let workOrderData = insertWorkOrderSchema.parse(req.body);
      if (workOrderData.dueDate && workOrderData.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = workOrderData.dueDate.split("-");
        workOrderData.dueDate = `${day}-${month}-${year}`;
        console.log(`Converted dueDate from ISO to DD-MM-YYYY: ${workOrderData.dueDate}`);
      }
      if (!workOrderData.jobId && workOrderData.component && workOrderData.jobTitle && workOrderData.vesselId) {
        try {
          const jobs2 = await storage.getJobs(workOrderData.vesselId);
          const matchingJob = jobs2.find(
            (j) => j.componentId === workOrderData.component && j.jobTitle === workOrderData.jobTitle
          );
          if (matchingJob) {
            workOrderData = {
              ...workOrderData,
              jobId: matchingJob.id
            };
            console.log(`Auto-resolved jobId: ${matchingJob.id} for component ${workOrderData.component} and job "${workOrderData.jobTitle}"`);
          }
        } catch (error) {
          console.error("Failed to auto-resolve jobId:", error);
        }
      }
      if (!workOrderData.workOrderNo) {
        const {
          generatePlannedWorkOrderNumber: generatePlannedWorkOrderNumber2,
          generateUnplannedWorkOrderNumber: generateUnplannedWorkOrderNumber2,
          determineWorkOrderType: determineWorkOrderType2
        } = await Promise.resolve().then(() => (init_workOrderNumbering(), workOrderNumbering_exports));
        const woType = determineWorkOrderType2(workOrderData.jobId, workOrderData.templateCode);
        workOrderData.workOrderType = woType;
        if (woType === "Planned") {
          let jobCode = "JOB-UNKNOWN";
          let componentCode = workOrderData.componentCode || "";
          if (workOrderData.jobId) {
            const job = await storage.getJob(workOrderData.jobId);
            if (job?.jobNo) {
              jobCode = job.jobNo;
            }
            if (job?.componentCode) {
              componentCode = job.componentCode;
            } else if (job?.componentId) {
              const component = await storage.getComponent(job.componentId);
              if (component?.componentCode) {
                componentCode = component.componentCode;
              }
            }
          }
          if (!componentCode && workOrderData.componentCode) {
            componentCode = workOrderData.componentCode;
          }
          if (!componentCode && workOrderData.vesselId) {
            console.warn(`No componentCode available for planned WO creation`);
          }
          if (!componentCode) {
            throw new Error("Component code is required for planned work order numbering");
          }
          workOrderData.workOrderNo = await generatePlannedWorkOrderNumber2(
            storage,
            jobCode,
            componentCode,
            workOrderData.vesselId || void 0
          );
        } else {
          const vesselId = workOrderData.vesselId || "V001";
          workOrderData.workOrderNo = await generateUnplannedWorkOrderNumber2(
            storage,
            vesselId
          );
        }
        console.log(`Generated ${woType} WO number: ${workOrderData.workOrderNo}`);
      }
      if (!workOrderData.templateCode && workOrderData.componentCode) {
        const currentYear = (/* @__PURE__ */ new Date()).getFullYear().toString();
        const vesselId = workOrderData.vesselId || "V001";
        const existingWOs = await storage.getWorkOrders(vesselId);
        const componentYearWOs = existingWOs.filter(
          (wo) => wo.templateCode?.startsWith(`WO-${workOrderData.componentCode}-${currentYear}-`)
        );
        const maxSeq = componentYearWOs.length > 0 ? Math.max(...componentYearWOs.map((wo) => {
          const match = wo.templateCode?.match(/-(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })) : 0;
        const nextSeq = maxSeq + 1;
        const generatedTemplateCode = `WO-${workOrderData.componentCode}-${currentYear}-${String(nextSeq).padStart(2, "0")}`;
        workOrderData = {
          ...workOrderData,
          templateCode: generatedTemplateCode
        };
      }
      if (!workOrderData.dueDate && workOrderData.componentCode) {
        try {
          const { calculateDueDate: calculateDueDate2 } = await Promise.resolve().then(() => (init_dateCalculations(), dateCalculations_exports));
          const vesselId = workOrderData.vesselId || "V001";
          const components2 = await storage.getComponents(vesselId);
          const component = components2.find((c) => c.componentCode === workOrderData.componentCode);
          if (component?.installationDate) {
            const calculatedDueDate = calculateDueDate2(
              component.installationDate,
              workOrderData.frequencyValue,
              workOrderData.frequencyUnit
            );
            if (calculatedDueDate) {
              workOrderData = {
                ...workOrderData,
                dueDate: calculatedDueDate
              };
              console.log(`Auto-calculated due date: ${calculatedDueDate} based on installation date: ${component.installationDate}`);
            }
          }
        } catch (error) {
          console.error("Failed to auto-calculate due date:", error);
        }
      }
      const workOrder = await storage.createWorkOrder(workOrderData);
      res.status(201).json(workOrder);
    } catch (error) {
      console.error("Work order creation error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid work order data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create work order" });
    }
  });
  app2.patch("/api/work-orders/:id", async (req, res) => {
    try {
      console.log("\u{1F4DD} PATCH work order request body keys:", Object.keys(req.body));
      const existingWO = await storage.getWorkOrder(req.params.id);
      if (!existingWO) {
        return res.status(404).json({ error: "Work order not found" });
      }
      const { isCompletedStatus: isCompletedStatus3 } = await Promise.resolve().then(() => (init_workOrderStatus(), workOrderStatus_exports));
      const woIsCompleted = isCompletedStatus3(existingWO.status);
      if (woIsCompleted) {
        const allowedFieldsForCompletedWO = ["remarks", "completionRemarks", "jobExperienceNotes"];
        const requestedFields = Object.keys(req.body);
        const disallowedFields = requestedFields.filter((f) => !allowedFieldsForCompletedWO.includes(f));
        if (disallowedFields.length > 0) {
          console.warn(`\u26A0\uFE0F Attempted to modify completed WO ${existingWO.workOrderNo}: ${disallowedFields.join(", ")}`);
          return res.status(400).json({
            error: "Cannot modify completed work order",
            message: `Work Order ${existingWO.workOrderNo} is completed and cannot be modified. Only remarks can be added.`,
            disallowedFields
          });
        }
      }
      const updateData = { ...req.body };
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === void 0) {
          delete updateData[key];
        }
      });
      const hasCompletionData = !!(updateData.completionDateTime || updateData.dateOfCompletion);
      const hasExplicitStatus = updateData.status !== void 0;
      if (hasCompletionData && !hasExplicitStatus) {
        const currentWorkOrder = await storage.getWorkOrder(req.params.id);
        if (currentWorkOrder && currentWorkOrder.status !== "Approved" && currentWorkOrder.status !== "Completed") {
          updateData.status = "Pending Approval";
          if (!currentWorkOrder.submittedDate) {
            updateData.submittedDate = (/* @__PURE__ */ new Date()).toISOString();
            console.log("\u{1F4DD} Auto-capturing submittedDate for audit trail");
          }
          console.log("\u{1F4DD} Auto-setting status to Pending Approval (completion data provided without explicit status)");
        }
      }
      const isSubmissionAction = updateData.approvalAction === "submitted" || updateData.approvalAction === "submit" || updateData.status === "Pending Approval";
      if (isSubmissionAction && !existingWO.submittedDate) {
        updateData.submittedDate = (/* @__PURE__ */ new Date()).toISOString();
        console.log("\u{1F4DD} Capturing submittedDate for audit trail on submission/Pending Approval");
      }
      console.log("\u{1F4DD} Cleaned update data keys:", Object.keys(updateData));
      const workOrder = await storage.updateWorkOrder(req.params.id, updateData);
      if (updateData.approvalAction === "approved" && updateData.status === "Completed") {
        console.log("\u{1F4CB} Work order approved - creating maintenance history and updating job cycle dates");
        const freshWorkOrder = await storage.getWorkOrder(req.params.id);
        if (!freshWorkOrder) {
          console.error("Failed to refetch work order for completion processing");
        } else {
          let component = await storage.getComponent(freshWorkOrder.component);
          if (!component && freshWorkOrder.componentCode && freshWorkOrder.vesselId) {
            component = await storage.getComponentByCode(freshWorkOrder.componentCode, freshWorkOrder.vesselId);
          }
          if (!component && freshWorkOrder.vesselId) {
            const vesselComponents = await storage.getComponents(freshWorkOrder.vesselId);
            component = vesselComponents.find(
              (c) => c.name === freshWorkOrder.component || c.componentCode === freshWorkOrder.componentCode
            );
          }
          if (component) {
            try {
              const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(freshWorkOrder.id);
              if (existingHistory) {
                console.log(`\u26A0\uFE0F Maintenance history already exists for work order ${freshWorkOrder.id}, skipping duplicate creation`);
              } else {
                const dateOfCompletion = freshWorkOrder.dateCompleted || freshWorkOrder.completionDateTime || updateData.dateCompleted || (/* @__PURE__ */ new Date()).toISOString();
                const normalizeToISO = (isoDate) => {
                  if (!isoDate) return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
                  const date = new Date(isoDate);
                  return date.toISOString().split("T")[0];
                };
                const historyPayload = {
                  componentId: component.id,
                  componentCode: freshWorkOrder.componentCode || component.componentCode,
                  vesselCode: freshWorkOrder.vesselId,
                  workOrderId: freshWorkOrder.id,
                  workOrderNo: freshWorkOrder.workOrderNo || `WO-${freshWorkOrder.id}`,
                  jobTitle: freshWorkOrder.jobTitle,
                  maintenanceType: freshWorkOrder.maintenanceType || freshWorkOrder.taskType || "Servicing",
                  dateCompleted: normalizeToISO(dateOfCompletion),
                  runningHoursAtCompletion: freshWorkOrder.runningHours || null,
                  performedBy: freshWorkOrder.performedBy || freshWorkOrder.executionAssignedTo || "Unknown",
                  approvedBy: freshWorkOrder.approver || null,
                  approvalDate: normalizeToISO(dateOfCompletion),
                  status: "Approved",
                  workDescription: freshWorkOrder.workCarriedOut || freshWorkOrder.briefWorkDescription || null,
                  sparesUsed: freshWorkOrder.consumedSpareParts ? JSON.stringify(freshWorkOrder.consumedSpareParts) : null,
                  remarks: freshWorkOrder.remarks || freshWorkOrder.jobExperienceNotes || null,
                  isComponentReplaced: false
                };
                await storage.createComponentMaintenanceHistory(historyPayload);
                console.log(`\u2705 Created maintenance history for work order ${freshWorkOrder.id} (componentId: ${component.id})`);
              }
            } catch (historyError) {
              console.error("Failed to create maintenance history record:", historyError);
            }
            try {
              let job = null;
              if (freshWorkOrder.jobId) {
                job = await storage.getJob(freshWorkOrder.jobId);
              }
              if (!job && freshWorkOrder.workOrderNo) {
                const woNumber = freshWorkOrder.workOrderNo;
                let extractedJobNo = null;
                const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
                if (newFormatMatch) {
                  extractedJobNo = newFormatMatch[1];
                }
                if (!extractedJobNo) {
                  const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
                  if (oldFormatMatch) {
                    extractedJobNo = oldFormatMatch[1];
                  }
                }
                if (extractedJobNo && freshWorkOrder.vesselId) {
                  const jobs2 = await storage.getJobs(freshWorkOrder.vesselId);
                  job = jobs2.find((j) => j.jobNo === extractedJobNo);
                }
              }
              if (job) {
                const dateOfCompletion = freshWorkOrder.dateCompleted || freshWorkOrder.completionDateTime || updateData.dateCompleted;
                const runningHours = freshWorkOrder.runningHours;
                if (freshWorkOrder.maintenanceBasis === "Calendar" && dateOfCompletion) {
                  const { calculateNextDueDate: calculateNextDueDate2 } = await Promise.resolve().then(() => (init_dateUtils(), dateUtils_exports));
                  const calendarUpdates = { lastDoneDate: dateOfCompletion };
                  if (job.frequencyValue && job.frequencyUnit) {
                    const nextDue = calculateNextDueDate2(dateOfCompletion, job.frequencyValue, job.frequencyUnit);
                    if (nextDue) {
                      calendarUpdates.nextDueDate = nextDue;
                      console.log(`\u2705 Updated job ${job.jobNo} nextDueDate: ${nextDue}`);
                    }
                  }
                  await storage.updateJob(job.id, calendarUpdates);
                }
                if (freshWorkOrder.maintenanceBasis === "Running Hours" && runningHours) {
                  const currentRH = parseInt(runningHours);
                  if (!isNaN(currentRH)) {
                    const rhUpdates = { lastDoneRH: currentRH };
                    const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
                    if (rhInterval && !isNaN(rhInterval)) {
                      rhUpdates.nextDueRH = currentRH + rhInterval;
                      console.log(`\u2705 Updated job ${job.jobNo} nextDueRH: ${rhUpdates.nextDueRH}`);
                    }
                    await storage.updateJob(job.id, rhUpdates);
                  }
                }
              }
            } catch (jobError) {
              console.error("Failed to update job cycle dates:", jobError);
            }
          } else {
            console.warn(`\u26A0\uFE0F Could not find component for work order ${freshWorkOrder.id}`);
          }
        }
      }
      res.json(workOrder);
    } catch (error) {
      console.error("\u274C Work order update error:", error);
      if (error.name === "ZodError") {
        console.error("\u274C Zod validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid work order data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update work order" });
    }
  });
  app2.post("/api/work-orders/:id/complete", async (req, res) => {
    try {
      const { runningHours, dateOfCompletion, ...executionData } = req.body;
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      let component = await storage.getComponent(workOrder.component);
      if (!component && workOrder.componentCode && workOrder.vesselId) {
        component = await storage.getComponentByCode(workOrder.componentCode, workOrder.vesselId);
        if (component) {
          console.log(`\u{1F4CB} Found component by code ${workOrder.componentCode} for vessel ${workOrder.vesselId}`);
        }
      }
      if (!component && workOrder.vesselId) {
        const vesselComponents = await storage.getComponents(workOrder.vesselId);
        component = vesselComponents.find(
          (c) => c.name === workOrder.component || c.componentCode === workOrder.componentCode
        );
        if (component) {
          console.log(`\u{1F4CB} Found component by name/code match: ${component.name}`);
        }
      }
      if (!component) {
        return res.status(404).json({ error: `Component not found: ${workOrder.component} (code: ${workOrder.componentCode})` });
      }
      const { approverUserId } = req.body;
      if (approverUserId && workOrder.jobId) {
        try {
          const job = await storage.getJob(workOrder.jobId);
          if (job && job.department) {
            const approver = await storage.getUser(approverUserId);
            if (approver && approver.department && approver.department !== job.department) {
              return res.status(400).json({
                error: `Approver department mismatch: Approver belongs to "${approver.department}" but job requires "${job.department}" department authorization.`,
                code: "DEPARTMENT_MISMATCH"
              });
            }
            console.log(`[RULE #19] Department validation passed: Approver (${approver?.department || "no dept"}) can approve job in ${job.department} department`);
          }
        } catch (deptError) {
          console.warn("[RULE #19] Department validation skipped due to error:", deptError);
        }
      }
      if (workOrder.maintenanceBasis === "Running Hours" && !runningHours) {
        return res.status(400).json({
          error: "Running hours is required for RH-based maintenance work orders"
        });
      }
      if (runningHours) {
        const newRH = parseInt(runningHours);
        if (!component.parentId) {
          return res.status(400).json({
            error: "Work orders can only update sub-component running hours. Parent component RH must be updated through the Running Hours module."
          });
        }
        const previousRH = parseInt(component.currentCumulativeRH);
        const componentVesselId = workOrder.vesselId || component.vesselId || "V001";
        const componentCode = workOrder.componentCode || component.componentCode;
        const parentComponent = await storage.getComponent(component.parentId);
        if (parentComponent) {
          const parentRH = parseInt(parentComponent.currentCumulativeRH);
          if (newRH > parentRH) {
            return res.status(400).json({
              error: `Sub-component running hours (${newRH}) cannot exceed parent component's running hours (${parentRH})`
            });
          }
        }
        if (newRH < previousRH) {
          return res.status(400).json({
            error: `Running hours cannot decrease from ${previousRH} to ${newRH}`
          });
        }
        if (dateOfCompletion && component.lastUpdated) {
          const completionDate = new Date(dateOfCompletion);
          const lastUpdate = new Date(component.lastUpdated);
          const daysDiff = Math.max(1, (completionDate.getTime() - lastUpdate.getTime()) / (1e3 * 60 * 60 * 24));
          const hoursDelta = newRH - previousRH;
          const maxAllowed = daysDiff * 25;
          if (hoursDelta > maxAllowed) {
            return res.status(400).json({
              error: `Running hours increase of ${hoursDelta} hrs over ${daysDiff.toFixed(1)} days exceeds realistic limit (max ${maxAllowed.toFixed(0)} hrs at 25 hrs/day)`
            });
          }
        }
        await storage.setComponentRunningHours({
          componentId: component.id,
          newRHValue: newRH,
          updateSource: "WO_COMPLETION",
          userId: executionData.performedBy || "System",
          lastUpdatedDate: dateOfCompletion || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
        });
        await storage.createRunningHoursAudit({
          componentId: component.id,
          vesselId: componentVesselId,
          previousRH: previousRH.toString(),
          newRH: newRH.toString(),
          cumulativeRH: newRH.toString(),
          dateUpdatedLocal: dateOfCompletion || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          dateUpdatedTZ: "UTC",
          enteredAtUTC: /* @__PURE__ */ new Date(),
          userId: executionData.performedBy || "System",
          source: "workorder",
          notes: `Updated via work order completion: ${workOrder.templateCode}`,
          meterReplaced: false
        });
      }
      const updatedWorkOrder = await storage.updateWorkOrder(req.params.id, {
        ...executionData,
        runningHoursAtCompletion: runningHours ? parseInt(runningHours) : void 0,
        dateCompleted: dateOfCompletion,
        status: "Completed"
      });
      try {
        const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(workOrder.id);
        if (existingHistory) {
          console.log(`\u26A0\uFE0F Maintenance history already exists for work order ${workOrder.id}, skipping duplicate creation`);
        } else {
          const normalizeToISO = (isoDate) => {
            if (!isoDate) {
              return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
            }
            const date = new Date(isoDate);
            return date.toISOString().split("T")[0];
          };
          const historyPayload = {
            componentId: component.id,
            componentCode: workOrder.componentCode || component.componentCode,
            vesselCode: workOrder.vesselId,
            workOrderId: workOrder.id,
            workOrderNo: workOrder.templateCode || `WO-${workOrder.id}`,
            jobTitle: workOrder.jobTitle,
            maintenanceType: workOrder.taskType || "Servicing",
            dateCompleted: normalizeToISO(dateOfCompletion),
            runningHoursAtCompletion: runningHours || null,
            performedBy: executionData.performedBy || "Unknown",
            approvedBy: executionData.approver || null,
            approvalDate: executionData.approvalDate ? normalizeToISO(executionData.approvalDate) : null,
            status: "Approved",
            workDescription: executionData.workDone || workOrder.briefWorkDescription || null,
            sparesUsed: executionData.sparesUsed || null,
            remarks: executionData.remarks || null,
            isComponentReplaced: false
          };
          await storage.createComponentMaintenanceHistory(historyPayload);
          console.log(`\u2705 Auto-populated maintenance history for work order ${workOrder.id} (componentId: ${component.id})`);
        }
      } catch (historyError) {
        console.error("Failed to create maintenance history record:", historyError);
      }
      try {
        let job = null;
        if (workOrder.jobId) {
          job = await storage.getJob(workOrder.jobId);
        }
        if (!job && workOrder.workOrderNo) {
          const woNumber = workOrder.workOrderNo;
          let extractedJobNo = null;
          const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
          if (newFormatMatch) {
            extractedJobNo = newFormatMatch[1];
          }
          if (!extractedJobNo) {
            const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
            if (oldFormatMatch) {
              extractedJobNo = oldFormatMatch[1];
            }
          }
          if (extractedJobNo) {
            const vesselId = workOrder.vesselId || component.vesselId;
            if (vesselId) {
              const jobs2 = await storage.getJobs(vesselId);
              job = jobs2.find((j) => j.jobNo === extractedJobNo);
              if (job) {
                console.log(`\u{1F4CB} Found job ${job.jobNo} via work order number extraction (jobId was not linked)`);
              }
            }
          }
        }
        if (job) {
          const updates = {};
          if (workOrder.maintenanceBasis === "Calendar" && dateOfCompletion) {
            const { calculateNextDueDate: calculateNextDueDate2 } = await Promise.resolve().then(() => (init_dateUtils(), dateUtils_exports));
            updates.lastDoneDate = dateOfCompletion;
            if (job.frequencyValue && job.frequencyUnit) {
              const nextDue = calculateNextDueDate2(
                dateOfCompletion,
                job.frequencyValue,
                job.frequencyUnit
              );
              if (nextDue) {
                updates.nextDueDate = nextDue;
                console.log(`\u2705 Auto-calculated next due date for job ${job.jobNo}: ${nextDue} (last done: ${dateOfCompletion}, interval: ${job.frequencyValue} ${job.frequencyUnit})`);
              }
            }
            await storage.updateJob(job.id, updates);
            console.log(`\u2705 Updated calendar job ${job.jobNo} with lastDoneDate: ${dateOfCompletion}`);
          }
          if (workOrder.maintenanceBasis === "Running Hours" && runningHours) {
            const currentRH = parseInt(runningHours);
            if (!isNaN(currentRH)) {
              updates.lastDoneRH = currentRH;
              const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
              if (rhInterval && !isNaN(rhInterval)) {
                const nextDueRH = currentRH + rhInterval;
                updates.nextDueRH = nextDueRH;
                console.log(`\u2705 Auto-calculated next due RH for job ${job.jobNo}: ${nextDueRH} (last done: ${currentRH}, interval: ${rhInterval} hours)`);
              }
              await storage.updateJob(job.id, updates);
              console.log(`\u2705 Updated RH job ${job.jobNo} with lastDoneRH: ${currentRH}`);
            }
          }
        } else {
          console.warn(`\u26A0\uFE0F Could not find job to update for work order ${workOrder.workOrderNo}`);
        }
      } catch (jobUpdateError) {
        console.error("Failed to update job cycle fields:", jobUpdateError);
      }
      if (workOrder.consumedSpareParts && Array.isArray(workOrder.consumedSpareParts)) {
        const consumedSpares = workOrder.consumedSpareParts;
        for (const consumedSpare of consumedSpares) {
          const qtyConsumed = typeof consumedSpare.quantityConsumed === "string" ? parseFloat(consumedSpare.quantityConsumed) : consumedSpare.quantityConsumed;
          if (qtyConsumed && qtyConsumed > 0) {
            try {
              const spares2 = await storage.getSpares(workOrder.vesselId || "V001");
              const spare = spares2.find((s) => s.partCode === consumedSpare.partNo);
              if (spare) {
                const locationId = consumedSpare.locationId ? parseInt(String(consumedSpare.locationId)) : null;
                if (locationId && !isNaN(locationId)) {
                  try {
                    await storage.performInventoryTransaction({
                      vesselId: workOrder.vesselId || "V001",
                      spareId: spare.id,
                      locationId,
                      eventType: "CONSUME",
                      qtyChange: -Math.abs(qtyConsumed),
                      // Negative for consumption
                      referenceType: "WORK_ORDER",
                      referenceId: workOrder.id,
                      referenceNote: `WO: ${workOrder.workOrderNo} - ${consumedSpare.comments || "Consumed during work completion"}`
                    });
                    console.log(`\u2705 [Inventory Transaction] Consumed ${qtyConsumed} units of ${consumedSpare.partNo} from location ${locationId} (WO: ${workOrder.workOrderNo})`);
                  } catch (txnError) {
                    if (txnError.message?.includes("INSUFFICIENT_STOCK") || txnError.message?.includes("NEGATIVE_STOCK_PREVENTED")) {
                      console.warn(`\u26A0\uFE0F Insufficient stock for ${consumedSpare.partNo} at location ${locationId}: ${txnError.message}`);
                      throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${qtyConsumed} units of ${consumedSpare.partNo} from location ${locationId}. Insufficient stock.`);
                    } else {
                      throw txnError;
                    }
                  }
                } else {
                  console.error(`\u274C [Inventory] Missing locationId for ${consumedSpare.partNo} - rejecting work order completion.`);
                  throw new Error(`LOCATION_REQUIRED: Spare part ${consumedSpare.partNo} requires a storage location for inventory tracking. Please select a location in the work order form.`);
                }
              } else {
                console.warn(`\u26A0\uFE0F Spare ${consumedSpare.partNo} not found in inventory - skipping deduction`);
              }
            } catch (spareError) {
              if (spareError.message?.includes("LOCATION_REQUIRED") || spareError.message?.includes("INSUFFICIENT_STOCK") || spareError.message?.includes("NEGATIVE_STOCK_PREVENTED")) {
                console.error(`\u274C [Inventory Enforcement] ${spareError.message}`);
                throw spareError;
              }
              console.error(`Failed to deduct spare ${consumedSpare.partNo}:`, spareError);
            }
          }
        }
      }
      res.json({
        success: true,
        workOrder: updatedWorkOrder,
        runningHoursUpdated: !!runningHours
      });
    } catch (error) {
      console.error("Work order completion error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid completion data", details: error.errors });
      }
      if (error.message?.includes("LOCATION_REQUIRED") || error.message?.includes("INSUFFICIENT_STOCK") || error.message?.includes("NEGATIVE_STOCK_PREVENTED")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to complete work order" });
    }
  });
  app2.delete("/api/work-orders/:id", async (req, res) => {
    try {
      await storage.deleteWorkOrder(req.params.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete work order" });
    }
  });
  app2.post("/api/work-orders/auto-generate", async (req, res) => {
    try {
      const vesselId = req.body.vesselId;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      const vesselSettings = await storage.getPmsVesselSettings(vesselId);
      const calendarLeadDaysCritical = vesselSettings?.calendarLeadDaysCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_CRITICAL;
      const calendarLeadDaysNonCritical = vesselSettings?.calendarLeadDaysNonCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_NON_CRITICAL;
      const rhLeadHoursCritical = vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL;
      const rhLeadHoursNonCritical = vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL;
      console.log(`[AUTO-GEN] Using lead times for vessel ${vesselId}: Calendar (C: ${calendarLeadDaysCritical}d, NC: ${calendarLeadDaysNonCritical}d), RH (C: ${rhLeadHoursCritical}hrs, NC: ${rhLeadHoursNonCritical}hrs)`);
      const allJobs = await storage.getJobs(vesselId);
      const calendarJobs = allJobs.filter(
        (job) => job.maintenanceBasis === "Calendar" && job.nextDueDate && job.isActive !== false
      );
      const rhJobs = allJobs.filter(
        (job) => job.maintenanceBasis === "Running Hours" && job.nextDueRH && job.isActive !== false
      );
      const allWorkOrders = await storage.getWorkOrders(vesselId);
      const activeWorkOrderKeys = new Set(
        allWorkOrders.filter((wo) => ["Active", "Due", "Due (Grace P)", "Overdue", "Pending Approval"].includes(wo.status)).map((wo) => `${wo.componentCode}|${wo.jobTitle}`)
      );
      const results = {
        checked: calendarJobs.length + rhJobs.length,
        generated: 0,
        workOrders: [],
        vesselSettingsUsed: vesselSettings ? true : false
      };
      const allComponents = await storage.getComponents(vesselId);
      const componentsMap = new Map(allComponents.map((c) => [c.id, c]));
      for (const job of calendarJobs) {
        const isCritical = job.criticality === "Yes" || job.jobPriority === "Critical";
        const leadTimeDays = isCritical ? calendarLeadDaysCritical : calendarLeadDaysNonCritical;
        const shouldGenerate = shouldGenerateWorkOrder(job.nextDueDate, /* @__PURE__ */ new Date(), leadTimeDays);
        if (shouldGenerate) {
          const workOrderKey = `${job.componentCode}|${job.jobTitle}`;
          if (!activeWorkOrderKeys.has(workOrderKey)) {
            const { generatePlannedWorkOrderNumber: generatePlannedWorkOrderNumber2 } = await Promise.resolve().then(() => (init_workOrderNumbering(), workOrderNumbering_exports));
            const jobCode = job.jobNo || "JOB-UNKNOWN";
            let componentCode = job.componentCode;
            if (!componentCode && job.componentId) {
              const component = componentsMap.get(job.componentId);
              componentCode = component?.componentCode;
            }
            if (!componentCode) {
              console.warn(`\u26A0\uFE0F No component code for calendar job ${job.jobNo} - skipping WO generation`);
              continue;
            }
            const workOrderNo = await generatePlannedWorkOrderNumber2(storage, jobCode, componentCode, vesselId);
            const workOrderData = {
              vesselId: job.vesselId,
              component: job.componentId,
              componentCode,
              jobId: job.id,
              // Store job ID for reliable lead time hydration
              workOrderNo,
              workOrderType: "Planned",
              templateCode: workOrderNo,
              jobTitle: job.jobTitle,
              assignedTo: job.assignedTo || "Unassigned",
              dueDate: job.nextDueDate,
              status: "Active",
              taskType: job.maintenanceType,
              maintenanceBasis: job.maintenanceBasis,
              frequencyValue: job.frequencyValue?.toString(),
              frequencyUnit: job.frequencyUnit,
              jobPriority: job.jobPriority,
              classRelated: job.classRelated,
              briefWorkDescription: job.briefWorkDescription,
              department: job.department,
              requiredSpareParts: job.requiredSpareParts || [],
              requiredTools: job.requiredTools || [],
              safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] }
            };
            const createdWO = await storage.createWorkOrder(workOrderData);
            results.generated++;
            results.workOrders.push(createdWO);
            activeWorkOrderKeys.add(workOrderKey);
            console.log(`\u2705 Auto-generated work order ${workOrderNo} for job ${job.jobNo} (${job.jobTitle})`);
          }
        }
      }
      for (const job of rhJobs) {
        const component = componentsMap.get(job.componentId);
        if (!component) {
          console.warn(`\u26A0\uFE0F  Component ${job.componentId} not found for RH job ${job.jobNo} - skipping`);
          continue;
        }
        const currentRH = parseInt(component.currentCumulativeRH || "0");
        const dueRH = parseInt(job.nextDueRH || "0");
        const isCritical = job.criticality === "Yes" || job.jobPriority === "Critical";
        const leadTimeHours = isCritical ? rhLeadHoursCritical : rhLeadHoursNonCritical;
        const shouldGenerate = currentRH >= dueRH - leadTimeHours;
        if (shouldGenerate) {
          const workOrderKey = `${job.componentCode}|${job.jobTitle}`;
          if (!activeWorkOrderKeys.has(workOrderKey)) {
            const { generatePlannedWorkOrderNumber: generatePlannedWorkOrderNumber2 } = await Promise.resolve().then(() => (init_workOrderNumbering(), workOrderNumbering_exports));
            const jobCode = job.jobNo || "JOB-UNKNOWN";
            const componentCode = job.componentCode || component?.componentCode;
            if (!componentCode) {
              console.warn(`\u26A0\uFE0F No component code for RH job ${job.jobNo} - skipping WO generation`);
              continue;
            }
            const workOrderNo = await generatePlannedWorkOrderNumber2(storage, jobCode, componentCode, vesselId);
            const workOrderData = {
              vesselId: job.vesselId,
              component: job.componentId,
              componentCode,
              // Use resolved componentCode
              jobId: job.id,
              // Store job ID for reliable lead time hydration
              workOrderNo,
              workOrderType: "Planned",
              templateCode: workOrderNo,
              jobTitle: job.jobTitle,
              assignedTo: job.assignedTo || "Unassigned",
              dueDate: null,
              // RH-based jobs don't have calendar due dates
              status: "Active",
              taskType: job.maintenanceType,
              maintenanceBasis: job.maintenanceBasis,
              frequencyValue: job.frequencyValue?.toString(),
              frequencyUnit: "Hours",
              // RH-based jobs use hours
              jobPriority: job.jobPriority,
              classRelated: job.classRelated,
              briefWorkDescription: job.briefWorkDescription,
              department: job.department,
              requiredSpareParts: job.requiredSpareParts || [],
              requiredTools: job.requiredTools || [],
              safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] }
            };
            const createdWO = await storage.createWorkOrder(workOrderData);
            results.generated++;
            results.workOrders.push(createdWO);
            activeWorkOrderKeys.add(workOrderKey);
            console.log(`\u2705 Auto-generated RH-based work order ${workOrderNo} for job ${job.jobNo} (${job.jobTitle}) - Current RH: ${currentRH}, Due RH: ${dueRH}`);
          }
        }
      }
      res.json(results);
    } catch (error) {
      console.error("Auto-generation error:", error);
      res.status(500).json({ error: "Failed to auto-generate work orders" });
    }
  });
  app2.post("/api/work-orders/backfill-job-ids", async (req, res) => {
    try {
      const vesselId = req.body.vesselId;
      const allWorkOrders = await storage.getWorkOrders(vesselId);
      const workOrdersNeedingJobId = allWorkOrders.filter((wo) => !wo.jobId && wo.component && wo.jobTitle);
      if (workOrdersNeedingJobId.length === 0) {
        return res.json({
          checked: allWorkOrders.length,
          updated: 0,
          message: "All work orders already have jobId or lack required fields (component, jobTitle)"
        });
      }
      const allJobs = await storage.getJobs(vesselId);
      let updated = 0;
      const updateResults = [];
      for (const wo of workOrdersNeedingJobId) {
        const matchingJob = allJobs.find(
          (j) => j.componentId === wo.component && j.jobTitle === wo.jobTitle && (!vesselId || j.vesselId === wo.vesselId)
        );
        if (matchingJob) {
          await storage.updateWorkOrder(wo.id, { jobId: matchingJob.id });
          updated++;
          updateResults.push({
            workOrderId: wo.id,
            jobId: matchingJob.id,
            reason: `Matched by component (${wo.component}) + jobTitle ("${wo.jobTitle}")`
          });
          console.log(`\u2705 Backfilled jobId ${matchingJob.id} for work order ${wo.id}`);
        } else {
          updateResults.push({
            workOrderId: wo.id,
            jobId: null,
            reason: `No matching job found for component (${wo.component}) + jobTitle ("${wo.jobTitle}")`
          });
        }
      }
      res.json({
        checked: allWorkOrders.length,
        needingBackfill: workOrdersNeedingJobId.length,
        updated,
        skipped: workOrdersNeedingJobId.length - updated,
        details: updateResults.slice(0, 100)
        // Return first 100 for review
      });
    } catch (error) {
      console.error("Backfill jobId error:", error);
      res.status(500).json({ error: "Failed to backfill jobId" });
    }
  });
  app2.get("/api/work-order-executions/:componentId", async (req, res) => {
    try {
      const executions = await storage.getWorkOrderExecutions(req.params.componentId);
      res.json(executions);
    } catch (error) {
      console.error("Error fetching work order executions:", error);
      res.status(500).json({ error: "Failed to fetch work order executions" });
    }
  });
  app2.get("/api/work-order-executions/details/:id", async (req, res) => {
    try {
      const execution = await storage.getWorkOrderExecutionById(req.params.id);
      if (!execution) {
        return res.status(404).json({ error: "Work order execution not found" });
      }
      res.json(execution);
    } catch (error) {
      console.error("Error fetching work order execution:", error);
      res.status(500).json({ error: "Failed to fetch work order execution" });
    }
  });
  app2.post("/api/work-order-executions", async (req, res) => {
    try {
      const executionData = insertWorkOrderExecutionSchema.parse(req.body);
      const execution = await storage.createWorkOrderExecution(executionData);
      res.json(execution);
    } catch (error) {
      console.error("Work order execution creation error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid execution data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create work order execution" });
    }
  });
  app2.patch("/api/work-order-executions/:id", async (req, res) => {
    try {
      const partialExecutionSchema = insertWorkOrderExecutionSchema.partial();
      const validatedData = partialExecutionSchema.parse(req.body);
      const execution = await storage.updateWorkOrderExecution(req.params.id, validatedData);
      res.json(execution);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid execution data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update work order execution" });
    }
  });
  app2.get("/api/defects", async (req, res) => {
    try {
      const filters = {
        vesselId: req.query.vesselId,
        status: req.query.status,
        statusView: req.query.statusScope || req.query.statusView,
        // Support both statusScope and statusView
        priority: req.query.priority,
        critical: req.query.critical === "true" ? true : req.query.critical === "false" ? false : void 0,
        is_coc: req.query.is_coc === "true" || req.query.isCoC === "true" ? true : req.query.is_coc === "false" || req.query.isCoC === "false" ? false : void 0,
        // Only apply filter when explicitly set
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search,
        includeClosedDefects: req.query.includeClosedDefects === "true"
      };
      const defects2 = await storage.getDefects(filters);
      res.json(defects2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defects" });
    }
  });
  app2.get("/api/defects/coc", async (req, res) => {
    try {
      const filters = {
        vesselId: req.query.vesselId,
        status: req.query.status,
        statusView: req.query.statusScope || req.query.statusView,
        // Support both statusScope and statusView
        priority: req.query.priority,
        isCoC: true,
        // Always filter for CoC
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search
      };
      const defects2 = await storage.getDefects(filters);
      res.json(defects2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CoC defects" });
    }
  });
  app2.get("/api/defects/recurring", async (req, res) => {
    try {
      const filters = {
        windowMonths: req.query.windowMonths ? parseInt(req.query.windowMonths) : void 0,
        minOccurrences: req.query.minOccurrences ? parseInt(req.query.minOccurrences) : void 0,
        hasCoc: req.query.hasCoc ? req.query.hasCoc === "true" : void 0,
        equipmentKey: req.query.equipmentKey
      };
      const recurringDefects2 = await storage.getRecurringDefects(filters);
      res.json(recurringDefects2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recurring defects" });
    }
  });
  app2.get("/api/defects/count", async (req, res) => {
    try {
      const filters = {
        statusView: req.query.statusScope || req.query.statusView,
        // Support both statusScope and statusView
        vesselId: req.query.vesselId,
        isCoC: req.query.isCoC !== void 0 ? req.query.isCoC === "true" : void 0,
        // Include all filter parameters to match list query filters
        category: req.query.category,
        search: req.query.search,
        period: req.query.period,
        fleet: req.query.fleet,
        group: req.query.group,
        dueOverdue: req.query.dueOverdue
      };
      const count = await storage.getDefectsCount(filters);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to get defects count" });
    }
  });
  app2.get("/api/defects/count/recurring", async (req, res) => {
    try {
      const recurringDefects2 = await storage.getRecurringDefects({});
      res.json({ count: recurringDefects2.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get recurring defects count" });
    }
  });
  app2.get("/api/defects/:id", async (req, res) => {
    try {
      const defect = await storage.getDefect(req.params.id);
      if (!defect) {
        return res.status(404).json({ error: "Defect not found" });
      }
      res.json(defect);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect" });
    }
  });
  app2.post("/api/defects", async (req, res) => {
    try {
      const validatedData = insertDefectSchema.parse(req.body);
      const { generateDefectNumber: generateDefectNumber2 } = await Promise.resolve().then(() => (init_defectNumbering(), defectNumbering_exports));
      const vesselId = validatedData.vesselId || "UNKNOWN";
      const generatedId = await generateDefectNumber2(storage, vesselId);
      const defectWithId = {
        ...validatedData,
        id: generatedId
      };
      console.log(`[DefectRoutes] Creating defect with generated ID: ${generatedId} for vessel: ${vesselId}`);
      const defect = await storage.createDefect(defectWithId);
      res.status(201).json(defect);
    } catch (error) {
      console.error("[DefectRoutes] Error creating defect:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid defect data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create defect" });
    }
  });
  app2.patch("/api/defects/:id", async (req, res) => {
    try {
      const partialDefectSchema = insertDefectSchema.partial();
      const validatedData = partialDefectSchema.parse(req.body);
      const defect = await storage.updateDefect(req.params.id, validatedData);
      res.json(defect);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid defect data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update defect" });
    }
  });
  app2.delete("/api/defects/:id", async (req, res) => {
    try {
      await storage.deleteDefect(req.params.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete defect" });
    }
  });
  app2.delete("/api/defects-clear-all", async (req, res) => {
    res.status(501).json({
      error: "Not Implemented",
      message: "The clearAllDefectsData method is not implemented in storage. This endpoint is reserved for future admin/testing functionality."
    });
  });
  app2.post("/api/defects-seed-e2e-test", async (req, res) => {
    res.status(501).json({
      error: "Not Implemented",
      message: "The seedE2ETestData method is not implemented in storage. This endpoint is reserved for future testing functionality."
    });
  });
  app2.get("/api/defects-count", async (req, res) => {
    try {
      const activeCount = await storage.getDefectsCount({ statusView: "active" });
      const resolvedCount = await storage.getDefectsCount({ statusView: "resolved" });
      res.json({
        active: activeCount,
        resolved: resolvedCount
      });
    } catch (error) {
      console.error("Error getting defects count:", error);
      res.status(500).json({ error: "Failed to get defects count" });
    }
  });
  app2.get("/api/defects/:defectId/actions", async (req, res) => {
    try {
      const actions = await storage.getDefectActions(req.params.defectId);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect actions" });
    }
  });
  app2.post("/api/defects/:defectId/actions", async (req, res) => {
    try {
      const actionData = {
        ...req.body,
        defectId: req.params.defectId
      };
      const validatedData = insertDefectActionSchema.parse(actionData);
      const action = await storage.createDefectAction(validatedData);
      res.status(201).json(action);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid action data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create defect action" });
    }
  });
  app2.patch("/api/defects/actions/:actionId", async (req, res) => {
    try {
      const partialActionSchema = insertDefectActionSchema.partial();
      const validatedData = partialActionSchema.parse(req.body);
      const action = await storage.updateDefectAction(parseInt(req.params.actionId), validatedData);
      res.json(action);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid action data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update defect action" });
    }
  });
  app2.delete("/api/defects/actions/:actionId", async (req, res) => {
    try {
      await storage.deleteDefectAction(parseInt(req.params.actionId));
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete defect action" });
    }
  });
  app2.get("/api/defects/:defectId/attachments", async (req, res) => {
    try {
      const attachments = await storage.getDefectAttachments(req.params.defectId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect attachments" });
    }
  });
  app2.post("/api/defects/:defectId/attachments", async (req, res) => {
    try {
      const attachmentData = {
        ...req.body,
        defectId: req.params.defectId
      };
      const validatedData = insertDefectAttachmentSchema.parse(attachmentData);
      const attachment = await storage.createDefectAttachment(validatedData);
      res.status(201).json(attachment);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid attachment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create defect attachment" });
    }
  });
  app2.delete("/api/defects/attachments/:attachmentId", async (req, res) => {
    try {
      await storage.deleteDefectAttachment(parseInt(req.params.attachmentId));
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete defect attachment" });
    }
  });
  app2.post("/api/defects/:id/notes", async (req, res) => {
    try {
      const { noteText, attachments, createdBy } = req.body;
      if (!noteText || noteText.length < 10) {
        return res.status(400).json({ error: "Note text must be at least 10 characters" });
      }
      const note = {
        noteId: Date.now().toString(),
        noteText,
        attachments: attachments || [],
        createdBy: createdBy || "Anonymous",
        createdOn: (/* @__PURE__ */ new Date()).toISOString()
      };
      const updatedDefect = await storage.addDefectNote(req.params.id, note);
      res.json(updatedDefect);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to add note" });
    }
  });
  app2.patch("/api/defects/:id/link", async (req, res) => {
    try {
      const { linkedDefects } = req.body;
      if (!linkedDefects || !Array.isArray(linkedDefects) || linkedDefects.length === 0) {
        return res.status(400).json({ error: "linkedDefects must be a non-empty array" });
      }
      const updatedDefect = await storage.linkDefects(req.params.id, linkedDefects);
      res.json(updatedDefect);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to link defects" });
    }
  });
  app2.patch("/api/defects/:id/close", async (req, res) => {
    try {
      const { closedBy, closureComment, closureFiles, actionTakenRequested, targetCloseDate, dateCompleted } = req.body;
      if (!closureComment || closureComment.trim().length === 0) {
        return res.status(400).json({ error: "Closure comment is required" });
      }
      if (!actionTakenRequested || actionTakenRequested.trim().length === 0) {
        return res.status(400).json({ error: "Action taken is required to close the defect" });
      }
      if (!targetCloseDate) {
        return res.status(400).json({ error: "Target date is required" });
      }
      if (!dateCompleted) {
        return res.status(400).json({ error: "Completion date is required" });
      }
      const defect = await storage.closeDefect(req.params.id, {
        closedBy: closedBy || "System",
        closureComment,
        closureFiles: closureFiles || []
      });
      res.json(defect);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to close defect" });
    }
  });
  app2.post("/api/defects/reports/:reportKey", async (req, res) => {
    try {
      const { reportKey } = req.params;
      const filters = req.body;
      const defects2 = await storage.getDefects(filters);
      let reportData = {
        title: "",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        filters,
        data: []
      };
      switch (reportKey) {
        case "status-summary":
          reportData.title = "Defects Status Summary";
          const statusGroups = defects2.reduce((acc, defect) => {
            if (!acc[defect.status]) {
              acc[defect.status] = { count: 0, defects: [] };
            }
            acc[defect.status].count++;
            acc[defect.status].defects.push(defect);
            return acc;
          }, {});
          reportData.data = Object.entries(statusGroups).map(([status, data]) => ({
            status,
            count: data.count,
            percentage: (data.count / defects2.length * 100).toFixed(1) + "%"
          }));
          break;
        case "overdue":
          reportData.title = "Overdue Defects";
          const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          reportData.data = defects2.filter(
            (d) => d.status === "Open" && d.targetCloseDate && new Date(d.targetCloseDate.split("-").reverse().join("-")) < new Date(today)
          );
          break;
        case "critical":
          reportData.title = "Critical Defects";
          reportData.data = defects2.filter((d) => d.critical || d.is_coc);
          break;
        case "by-vessel":
          reportData.title = "Defects by Vessel";
          const vesselGroups = defects2.reduce((acc, defect) => {
            if (!acc[defect.vesselName]) {
              acc[defect.vesselName] = { count: 0, open: 0, closed: 0 };
            }
            acc[defect.vesselName].count++;
            if (defect.status === "Open") {
              acc[defect.vesselName].open++;
            } else if (defect.status === "Closed") {
              acc[defect.vesselName].closed++;
            }
            return acc;
          }, {});
          reportData.data = Object.entries(vesselGroups).map(([vessel, stats]) => ({
            vessel,
            total: stats.count,
            open: stats.open,
            closed: stats.closed
          }));
          break;
        case "by-equipment":
          reportData.title = "Defects by Equipment";
          const equipmentGroups = defects2.reduce((acc, defect) => {
            const equipment = defect.equipmentCategory || "Not Specified";
            if (!acc[equipment]) {
              acc[equipment] = { count: 0, defects: [] };
            }
            acc[equipment].count++;
            acc[equipment].defects.push(defect);
            return acc;
          }, {});
          reportData.data = Object.entries(equipmentGroups).map(([equipment, data]) => ({
            equipment,
            count: data.count,
            percentage: (data.count / defects2.length * 100).toFixed(1) + "%"
          }));
          break;
        case "monthly-trend":
          reportData.title = "Monthly Trend";
          const monthGroups = defects2.reduce((acc, defect) => {
            const dateStr = defect.issueDate;
            if (!dateStr) return acc;
            const [day, month, year] = dateStr.split("-");
            const monthKey = `${year}-${month}`;
            if (!acc[monthKey]) {
              acc[monthKey] = { created: 0, closed: 0 };
            }
            acc[monthKey].created++;
            if (defect.status === "Closed" && defect.dateCompleted) {
              const [cDay, cMonth, cYear] = defect.dateCompleted.split("-");
              const closedMonthKey = `${cYear}-${cMonth}`;
              if (!acc[closedMonthKey]) {
                acc[closedMonthKey] = { created: 0, closed: 0 };
              }
              acc[closedMonthKey].closed++;
            }
            return acc;
          }, {});
          reportData.data = Object.entries(monthGroups).map(([month, stats]) => ({
            month,
            created: stats.created,
            closed: stats.closed,
            net: stats.created - stats.closed
          })).sort((a, b) => a.month.localeCompare(b.month));
          break;
        default:
          reportData.title = "Defects Report";
          reportData.data = defects2;
      }
      res.json(reportData);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });
  app2.get("/api/running-hours/:componentId", async (req, res) => {
    try {
      const audits = await storage.getRunningHoursAudits(req.params.componentId);
      res.json(audits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch running hours audits" });
    }
  });
  app2.post("/api/running-hours", async (req, res) => {
    try {
      const validatedData = insertRunningHoursAuditSchema.parse(req.body);
      const audit = await storage.createRunningHoursAudit(validatedData);
      res.status(201).json(audit);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid audit data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create audit" });
    }
  });
  app2.get("/api/test-new-endpoint", async (req, res) => {
    res.json({ message: "This is a brand new endpoint added just now!", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/api/debug/jobs", async (req, res) => {
    try {
      const allJobs = await storage.getJobs();
      const rhJobs = allJobs.filter((j) => j.maintenanceBasis === "Running Hours" && j.vesselId === "V001");
      res.json({
        totalJobs: allJobs.length,
        rhJobsCount: rhJobs.length,
        sampleRHJobs: rhJobs.slice(0, 3).map((j) => ({
          id: j.id,
          jobNo: j.jobNo,
          componentId: j.componentId,
          maintenanceBasis: j.maintenanceBasis,
          vesselId: j.vesselId
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/running-hours/cascade", async (req, res) => {
    try {
      const validatedData = cascadeRunningHoursSchema.parse(req.body);
      const result = await storage.cascadeRunningHoursUpdate(validatedData);
      res.json(result);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid cascade data", details: error.errors });
      }
      console.error("Error cascading running hours update:", error);
      res.status(500).json({ error: error.message || "Failed to cascade running hours update" });
    }
  });
  app2.post("/api/components", async (req, res) => {
    try {
      const data = req.body;
      const effectiveRhType = data.rhCounterType || "NOT_RH_DRIVEN";
      if (data.rhCounterType || data.rhMasterComponentId) {
        if (effectiveRhType === "MASTER") {
          if (data.rhMasterComponentId) {
            return res.status(400).json({
              error: "MASTER counter type cannot have a master component reference"
            });
          }
        } else if (effectiveRhType === "INHERITED") {
          if (!data.rhMasterComponentId) {
            return res.status(400).json({
              error: "INHERITED counter type requires rhMasterComponentId"
            });
          }
          const masterComponent = await storage.getComponent(data.rhMasterComponentId);
          if (!masterComponent) {
            return res.status(400).json({ error: "Master component not found" });
          }
          if (masterComponent.vesselId !== data.vesselId) {
            return res.status(400).json({
              error: "Master component must be from the same vessel"
            });
          }
          if (masterComponent.rhCounterType !== "MASTER") {
            return res.status(400).json({
              error: "Referenced component is not a MASTER counter type"
            });
          }
        } else if (effectiveRhType === "NOT_RH_DRIVEN") {
          if (data.rhMasterComponentId) {
            return res.status(400).json({
              error: "NOT_RH_DRIVEN counter type cannot have a master component reference"
            });
          }
        }
      }
      const component = await storage.createComponent(data);
      console.log("[API_CREATE] New component:", {
        id: component.id,
        code: component.componentCode,
        parentId: component.parentId,
        vesselId: component.vesselId
      });
      res.status(201).json(component);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to create component" });
    }
  });
  app2.get("/api/components", async (req, res) => {
    try {
      const vesselId = req.query.vesselId;
      const components2 = await storage.getComponents(vesselId || "V001");
      res.json(components2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });
  app2.get("/api/components/:id", async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(component);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch component" });
    }
  });
  app2.patch("/api/components/:id", async (req, res) => {
    try {
      console.log(`\u{1F527} PATCH /api/components/${req.params.id} with:`, JSON.stringify(req.body, null, 2).substring(0, 500));
      const data = req.body;
      const existingComponent = await storage.getComponent(req.params.id);
      if (!existingComponent) {
        return res.status(404).json({ error: "Component not found" });
      }
      const effectiveRhType = data.rhCounterType || existingComponent.rhCounterType || "NOT_RH_DRIVEN";
      const effectiveMasterId = data.rhMasterComponentId !== void 0 ? data.rhMasterComponentId : existingComponent.rhMasterComponentId;
      if (data.rhCounterType || data.rhMasterComponentId !== void 0) {
        if (effectiveRhType === "MASTER") {
          if (effectiveMasterId) {
            return res.status(400).json({
              error: "MASTER counter type cannot have a master component reference"
            });
          }
        } else if (effectiveRhType === "INHERITED") {
          if (!effectiveMasterId) {
            return res.status(400).json({
              error: "INHERITED counter type requires rhMasterComponentId"
            });
          }
          if (effectiveMasterId === req.params.id) {
            return res.status(400).json({
              error: "A component cannot inherit running hours from itself"
            });
          }
          const masterComponent = await storage.getComponent(effectiveMasterId);
          if (!masterComponent) {
            return res.status(400).json({ error: "Master component not found" });
          }
          if (masterComponent.vesselId !== existingComponent.vesselId) {
            return res.status(400).json({
              error: "Master component must be from the same vessel"
            });
          }
          if (masterComponent.rhCounterType !== "MASTER") {
            return res.status(400).json({
              error: "Referenced component is not a MASTER counter type"
            });
          }
        } else if (effectiveRhType === "NOT_RH_DRIVEN") {
          if (effectiveMasterId) {
            return res.status(400).json({
              error: "NOT_RH_DRIVEN counter type cannot have a master component reference"
            });
          }
        }
        if (existingComponent.rhCounterType === "MASTER" && effectiveRhType !== "MASTER") {
          const dependents = await storage.getInheritedComponents(req.params.id);
          if (dependents.length > 0) {
            const dependentNames = dependents.slice(0, 3).map((d) => d.name).join(", ");
            const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : "";
            return res.status(400).json({
              error: `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
            });
          }
        }
      }
      let component;
      if (data.currentCumulativeRH !== void 0 || data.runningHours !== void 0) {
        const rhValue = parseFloat(data.currentCumulativeRH || data.runningHours || "0");
        if (!isNaN(rhValue)) {
          const result = await storage.setComponentRunningHours({
            componentId: req.params.id,
            newRHValue: rhValue,
            updateSource: "MANUAL",
            userId: req.user?.username || "unknown",
            lastUpdatedDate: data.lastUpdated
            // Forward caller's date if provided
          });
          console.log(`\u{1F504} RH Update: synced ${result.inheritedUpdated} inherited components`);
          const { currentCumulativeRH, runningHours, lastUpdated, ...otherData } = data;
          if (Object.keys(otherData).length > 0) {
            component = await storage.updateComponent(req.params.id, otherData);
          } else {
            component = result.component;
          }
        } else {
          component = await storage.updateComponent(req.params.id, data);
        }
      } else {
        component = await storage.updateComponent(req.params.id, data);
      }
      console.log(`\u2705 Updated component:`, component.componentCode, "| vesselId:", component.vesselId, "| parentId:", component.parentId);
      res.json(component);
    } catch (error) {
      console.error(`\u274C Error updating component ${req.params.id}:`, error.message);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update component" });
    }
  });
  app2.delete("/api/components/:id", async (req, res) => {
    try {
      await storage.deleteComponent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete component" });
    }
  });
  app2.post("/api/components/:id/inactivate", async (req, res) => {
    try {
      const { cascadeInactivate, userId } = req.body;
      const result = await storage.inactivateComponent(
        req.params.id,
        userId || "system",
        { cascadeInactivate: cascadeInactivate === true }
      );
      if (!result.success) {
        if (result.activeChildrenCount && result.activeChildrenCount > 0) {
          return res.status(400).json({
            success: false,
            error: result.message,
            code: "ACTIVE_CHILDREN",
            activeChildrenCount: result.activeChildrenCount
          });
        }
        return res.status(400).json({ success: false, error: result.message });
      }
      res.json(result);
    } catch (error) {
      console.error("Error inactivating component:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to inactivate component"
      });
    }
  });
  app2.get("/api/spares", async (req, res) => {
    try {
      const allSpares = await storage.getAllSpares();
      res.json(allSpares);
    } catch (error) {
      console.error("Error fetching all spares:", error);
      res.status(500).json({ error: "Failed to fetch spares", details: error.message });
    }
  });
  app2.get("/api/spares/history/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log("[API] Fetching spare history for vessel:", vesselId);
      const history = await storage.getSpareHistory(vesselId);
      console.log("[API] Found", history.length, "history entries");
      res.json(history);
    } catch (error) {
      console.error("[API] Spare history error:", error);
      res.status(500).json({ error: "Failed to fetch spare history" });
    }
  });
  app2.get("/api/spares/:vesselId", async (req, res) => {
    try {
      const spares2 = await storage.getSpares(req.params.vesselId);
      res.json(spares2);
    } catch (error) {
      console.error("Error fetching spares:", error);
      res.status(500).json({ error: "Failed to fetch spares", details: error.message });
    }
  });
  app2.get("/api/spares/:vesselId/:id", async (req, res) => {
    try {
      const spare = await storage.getSpare(parseInt(req.params.id));
      if (!spare) {
        return res.status(404).json({ error: "Spare not found" });
      }
      res.json(spare);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spare" });
    }
  });
  app2.post("/api/spares/:vesselId", async (req, res) => {
    try {
      const spare = await storage.createSpare({
        ...req.body,
        vesselId: req.params.vesselId
      });
      res.status(201).json(spare);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to create spare" });
    }
  });
  app2.patch("/api/spares/:vesselId/:id", async (req, res) => {
    try {
      const spare = await storage.updateSpare(parseInt(req.params.id), req.body);
      res.json(spare);
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update spare" });
    }
  });
  app2.delete("/api/spares/:vesselId/:id", async (req, res) => {
    try {
      await storage.deleteSpare(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete spare" });
    }
  });
  app2.post("/api/spares/:vesselId/:id/adjust", async (req, res) => {
    try {
      const adjustPayloadSchema = z5.object({
        qtyChange: z5.number(),
        eventType: z5.enum(["CONSUME", "RECEIVE", "ADJUST"]),
        reference: z5.string().optional(),
        notes: z5.string().optional()
      });
      const payload = adjustPayloadSchema.parse(req.body);
      const spare = await storage.adjustSpareQuantity(
        parseInt(req.params.id),
        payload.qtyChange,
        payload.eventType,
        payload.reference,
        payload.notes
      );
      res.json(spare);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request payload", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("negative")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to adjust spare quantity" });
    }
  });
  app2.get("/api/spares/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log("[API] Fetching spare history for vessel (legacy route):", vesselId);
      const history = await storage.getSpareHistory(vesselId);
      console.log("[API] Found", history.length, "history entries");
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });
  app2.get("/api/spares/:vesselId/low-stock", async (req, res) => {
    try {
      const spares2 = await storage.getSpares(req.params.vesselId);
      const lowStockSpares = spares2.filter((spare) => (spare.rob || 0) <= (spare.min || 0));
      res.json(lowStockSpares);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock spares" });
    }
  });
  app2.post("/api/spares/:vesselId/batch-consume", async (req, res) => {
    try {
      const { items, workOrderId, consumedBy } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      const results = [];
      for (const item of items) {
        const result = await storage.consumeSpare(
          item.spareId,
          item.quantity,
          workOrderId,
          consumedBy || "System",
          item.notes
        );
        results.push(result);
      }
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to consume spares" });
    }
  });
  app2.post("/api/spares/:vesselId/batch-receive", async (req, res) => {
    try {
      const { items, purchaseOrderRef, receivedBy } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      const results = [];
      for (const item of items) {
        const result = await storage.receiveSpare(
          item.spareId,
          item.quantity,
          item.unitCost,
          purchaseOrderRef,
          receivedBy || "System",
          item.notes
        );
        results.push(result);
      }
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to receive spares" });
    }
  });
  app2.post("/api/spares/:id/consume", async (req, res) => {
    try {
      const spareId = parseInt(req.params.id);
      if (isNaN(spareId)) {
        return res.status(400).json({ error: "Invalid spare ID" });
      }
      const { qty, dateLocal, place, remarks, userId, workOrder } = req.body;
      if (!qty || qty <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }
      const result = await storage.consumeSpareFromLocation(
        spareId,
        qty,
        "A",
        // Default to Location A
        userId || "User",
        remarks || `Consumed at ${place || "unknown location"} on ${dateLocal}`,
        workOrder
      );
      res.json({
        success: true,
        message: "Spare consumed successfully",
        data: result
      });
    } catch (error) {
      console.error("Error consuming spare:", error);
      res.status(500).json({ error: error.message || "Failed to consume spare" });
    }
  });
  app2.post("/api/spares/:id/receive", async (req, res) => {
    try {
      const spareId = parseInt(req.params.id);
      if (isNaN(spareId)) {
        return res.status(400).json({ error: "Invalid spare ID" });
      }
      const { qty, dateLocal, supplierPO, remarks, userId } = req.body;
      if (!qty || qty <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }
      const spare = await storage.getSpare(spareId);
      if (!spare) {
        return res.status(404).json({ error: "Spare not found" });
      }
      const newRobLocationA = (spare.robLocationA || 0) + qty;
      const updatedSpare = await storage.updateSpare(spareId, {
        robLocationA: newRobLocationA
      });
      res.json({
        success: true,
        message: "Spare received successfully",
        data: updatedSpare
      });
    } catch (error) {
      console.error("Error receiving spare:", error);
      res.status(500).json({ error: error.message || "Failed to receive spare" });
    }
  });
  const consumeFromLocationBodySchema = z5.object({
    quantity: z5.coerce.number().positive("Quantity must be a positive number"),
    location: z5.enum(["A", "B"], { errorMap: () => ({ message: 'Location must be "A" or "B"' }) }),
    userId: z5.string().optional(),
    remarks: z5.string().optional(),
    workOrderRef: z5.string().optional()
  });
  const consumeFromLocationParamsSchema = z5.object({
    id: z5.coerce.number().int().positive("Spare ID must be a positive integer")
  });
  app2.post("/api/spares/:id/consume-from-location", async (req, res) => {
    try {
      const paramsResult = consumeFromLocationParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: paramsResult.error.errors[0]?.message || "Invalid spare ID",
            field: "id"
          }
        });
      }
      const bodyResult = consumeFromLocationBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          errors: bodyResult.error.errors.map((err) => ({
            code: "VALIDATION_ERROR",
            message: err.message,
            field: err.path.join(".")
          }))
        });
      }
      const { id: spareId } = paramsResult.data;
      const { quantity, location, userId, remarks, workOrderRef } = bodyResult.data;
      const result = await storage.consumeSpareFromLocation(
        spareId,
        quantity,
        location,
        userId || "system",
        remarks,
        workOrderRef
      );
      if (result.shortageQty > 0) {
        return res.json({
          success: true,
          data: result,
          warning: {
            code: "PARTIAL_CONSUMPTION",
            message: `Requested ${result.requested} but only ${result.deducted} available at Location ${location}`,
            shortageQty: result.shortageQty
          }
        });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Error consuming spare from location:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: error.message
          }
        });
      }
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message || "Failed to consume spare from location"
        }
      });
    }
  });
  app2.get("/api/inventory/locations/:vesselId", async (req, res) => {
    try {
      const locations2 = await storage.getLocations(req.params.vesselId);
      res.json({ success: true, data: locations2 });
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/locations/:vesselId/:id", async (req, res) => {
    try {
      const location = await storage.getLocationById(parseInt(req.params.id));
      if (!location) {
        return res.status(404).json({ success: false, error: "Location not found" });
      }
      res.json({ success: true, data: location });
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/inventory/locations/:vesselId", async (req, res) => {
    try {
      const { locationName, createdBy } = req.body;
      if (!locationName) {
        return res.status(400).json({ success: false, error: "locationName is required" });
      }
      const location = await storage.findOrCreateLocation(
        req.params.vesselId,
        locationName,
        createdBy || "system"
      );
      res.json({ success: true, data: location });
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/spare-links/:vesselId", async (req, res) => {
    try {
      const links = await storage.getSpareComponentLinks(req.params.vesselId);
      res.json({ success: true, data: links });
    } catch (error) {
      console.error("Error fetching spare-component links:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/spare-links/by-spare/:spareId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const links = await storage.getSpareComponentLinksBySpare(spareId);
      const linkedComponents = await storage.getLinkedComponentsForSpare(spareId);
      res.json({ success: true, data: { links, linkedComponents } });
    } catch (error) {
      console.error("Error fetching links for spare:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/spare-links/by-component/:componentId", async (req, res) => {
    try {
      const links = await storage.getSpareComponentLinksByComponent(req.params.componentId);
      res.json({ success: true, data: links });
    } catch (error) {
      console.error("Error fetching links for component:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/inventory/spare-links", async (req, res) => {
    try {
      const { vesselId, spareId, componentId, createdBy } = req.body;
      if (!vesselId || !spareId || !componentId) {
        return res.status(400).json({
          success: false,
          error: "vesselId, spareId, and componentId are required"
        });
      }
      const link = await storage.createSpareComponentLink({
        vesselId,
        spareId: parseInt(spareId),
        componentId,
        linkedBy: createdBy || "system"
      });
      res.json({ success: true, data: link });
    } catch (error) {
      console.error("Error creating spare-component link:", error);
      if (error.message?.includes("duplicate")) {
        return res.status(409).json({ success: false, error: "Link already exists" });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.delete("/api/inventory/spare-links/:spareId/:componentId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      await storage.deleteSpareComponentLink(spareId, req.params.componentId);
      res.json({ success: true, message: "Link deleted" });
    } catch (error) {
      console.error("Error deleting spare-component link:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/stock/:spareId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const stockRecords = await storage.getSpareLocationStock(spareId);
      const locationsWithQty = await storage.getSpareLocationsWithQty(spareId);
      const robTotal = await storage.getSpareRobTotal(spareId);
      res.json({
        success: true,
        data: {
          spareId,
          robTotal,
          locations: locationsWithQty,
          stockRecords
        }
      });
    } catch (error) {
      console.error("Error fetching spare stock:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/stock/by-location/:locationId", async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const spares2 = await storage.getSparesAtLocation(locationId);
      res.json({ success: true, data: spares2 });
    } catch (error) {
      console.error("Error fetching spares at location:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/inventory/stock/:spareId/:locationId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const locationId = parseInt(req.params.locationId);
      const { qty, vesselId } = req.body;
      if (qty === void 0 || qty < 0) {
        return res.status(400).json({ success: false, error: "qty must be >= 0" });
      }
      if (!vesselId) {
        return res.status(400).json({ success: false, error: "vesselId is required" });
      }
      const stock = await storage.upsertSpareLocationStock({
        vesselId,
        spareId,
        locationId,
        qty
      });
      res.json({ success: true, data: stock });
    } catch (error) {
      console.error("Error setting spare stock:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  const inventoryTransactionSchema = z5.object({
    vesselId: z5.string(),
    spareId: z5.coerce.number().int().positive(),
    locationId: z5.coerce.number().int().positive(),
    eventType: z5.enum(["RECEIVE", "CONSUME", "ADJUST_OPENING_BALANCE", "ADJUST_CORRECTION"]),
    qtyChange: z5.coerce.number().int(),
    referenceType: z5.enum(["WORK_ORDER", "MANUAL", "EXCEL_IMPORT"]),
    referenceId: z5.string().optional(),
    referenceNote: z5.string().optional(),
    userId: z5.string()
  });
  app2.post("/api/inventory/transactions", async (req, res) => {
    try {
      const parsed = inventoryTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request data" },
          errors: parsed.error.errors
        });
      }
      const result = await storage.performInventoryTransaction(parsed.data);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Error performing inventory transaction:", error);
      if (error.message?.includes("INSUFFICIENT_STOCK")) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INSUFFICIENT_STOCK",
            message: error.message.replace("INSUFFICIENT_STOCK: ", "")
          }
        });
      }
      if (error.message?.includes("NEGATIVE_STOCK_PREVENTED")) {
        return res.status(400).json({
          success: false,
          error: {
            code: "NEGATIVE_STOCK_PREVENTED",
            message: error.message.replace("NEGATIVE_STOCK_PREVENTED: ", "")
          }
        });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: error.message
          }
        });
      }
      if (error.message?.includes("requires")) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.message
          }
        });
      }
      res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: error.message } });
    }
  });
  app2.get("/api/inventory/transactions/:vesselId", async (req, res) => {
    try {
      const { spareId, locationId, eventType, limit } = req.query;
      const transactions = await storage.getInventoryTransactions(req.params.vesselId, {
        spareId: spareId ? parseInt(spareId) : void 0,
        locationId: locationId ? parseInt(locationId) : void 0,
        eventType,
        limit: limit ? parseInt(limit) : void 0
      });
      const hydratedTransactions = await Promise.all(transactions.map(async (txn) => {
        const spare = await storage.getSpare(txn.spareId);
        const linkedComponents = spare ? await storage.getLinkedComponentsForSpare(spare.id) : [];
        const location = txn.locationId ? await storage.getLocationById(txn.locationId) : null;
        return {
          ...txn,
          spare: spare ? {
            ...spare,
            linkedComponents
          } : null,
          locationName: location?.locationName || null
        };
      }));
      res.json({ success: true, data: hydratedTransactions });
    } catch (error) {
      console.error("Error fetching inventory transactions:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/spares-with-inventory/:vesselId", async (req, res) => {
    try {
      const spares2 = await storage.getSparesWithInventoryByVessel(req.params.vesselId);
      res.json({ success: true, data: spares2 });
    } catch (error) {
      console.error("Error fetching spares with inventory:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/spare-with-inventory/:spareId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const spareWithInventory = await storage.getSpareWithInventory(spareId);
      if (!spareWithInventory) {
        return res.status(404).json({ success: false, error: "Spare not found" });
      }
      res.json({ success: true, data: spareWithInventory });
    } catch (error) {
      console.error("Error fetching spare with inventory:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/inventory/spares-by-component/:componentId", async (req, res) => {
    try {
      const spares2 = await storage.getSparesWithInventoryByComponent(req.params.componentId);
      res.json({ success: true, data: spares2 });
    } catch (error) {
      console.error("Error fetching spares by component:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/stores/:vesselId", async (req, res) => {
    try {
      const { itemType } = req.query;
      const stores = await storage.getStoresItems(
        req.params.vesselId,
        itemType
      );
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });
  app2.get("/api/stores/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { itemType } = req.query;
      const history = await storage.getStoresTransactionHistory(
        vesselId,
        itemType
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores history" });
    }
  });
  app2.get("/api/stores/item/:id/history", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const history = await storage.getStoresItemHistory(itemId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch item history" });
    }
  });
  app2.post("/api/stores/:vesselId/create", requireAuth, async (req, res) => {
    try {
      const { vesselId } = req.params;
      const itemData = { ...req.body, vesselId };
      const item = await storage.createStoresItem(itemData);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to create stores item" });
    }
  });
  app2.put("/api/stores/item/:id", requireAuth, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const item = await storage.updateStoresItem(itemId, req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to update stores item" });
    }
  });
  app2.patch("/api/stores/:vesselId/:id", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const { robLocationA, robLocationB, rob } = req.body;
      const updateData = {};
      if (robLocationA !== void 0) updateData.robLocationA = robLocationA;
      if (robLocationB !== void 0) updateData.robLocationB = robLocationB;
      if (rob !== void 0) updateData.rob = rob;
      const item = await storage.updateStoresItem(itemId, updateData);
      res.json(item);
    } catch (error) {
      console.error("Error updating stores item:", error);
      res.status(500).json({ error: error.message || "Failed to update stores item" });
    }
  });
  app2.delete("/api/stores/item/:id", requireAuth, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      await storage.deleteStoresItem(itemId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to delete stores item" });
    }
  });
  app2.post("/api/stores/:vesselId/batch-consume", requireAuth, async (req, res) => {
    try {
      const { items, consumedBy } = req.body;
      const userId = req.user?.id?.toString() || consumedBy || "System";
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      const results = [];
      for (const item of items) {
        if (!item.itemId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: "Each item must have a valid itemId and positive quantity" });
        }
        const result = await storage.consumeStoresItem(
          item.itemId,
          item.quantity,
          item.location || "A",
          userId,
          item.notes,
          item.place,
          item.dateLocal,
          item.tz
        );
        results.push(result);
      }
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to consume stores" });
    }
  });
  app2.post("/api/stores/:vesselId/batch-receive", requireAuth, async (req, res) => {
    try {
      const { items, purchaseOrderRef, receivedBy } = req.body;
      const userId = req.user?.id?.toString() || receivedBy || "System";
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      const results = [];
      for (const item of items) {
        if (!item.itemId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: "Each item must have a valid itemId and positive quantity" });
        }
        const result = await storage.receiveStoresItem(
          item.itemId,
          item.quantity,
          item.location || "A",
          userId,
          item.notes,
          purchaseOrderRef,
          item.place,
          item.dateLocal,
          item.tz
        );
        results.push(result);
      }
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to receive stores" });
    }
  });
  app2.get("/api/reports/:reportType", async (req, res) => {
    try {
      const { reportType } = req.params;
      const { vesselId, dateFrom, dateTo, format: format2 } = req.query;
      const reportData = {
        title: `${reportType.toUpperCase()} Report`,
        vessel: vesselId || "All Vessels",
        period: `${dateFrom || "Start"} to ${dateTo || "End"}`,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        data: []
      };
      switch (reportType) {
        case "inventory":
          const spares2 = await storage.getSpares(vesselId);
          reportData.data = spares2.map((spare) => ({
            partCode: spare.partCode,
            partName: spare.partName,
            stockQuantity: spare.rob || 0,
            minimumQuantity: spare.min || 0,
            status: (spare.rob || 0) <= (spare.min || 0) ? "Low Stock" : "OK"
          }));
          break;
        case "consumption":
          const history = await storage.getSpareHistory(vesselId);
          reportData.data = history;
          break;
      }
      if (format2 === "csv") {
        const csv = convertToCSV(reportData);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${reportType}-report.csv"`);
        return res.send(csv);
      }
      res.json(reportData);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });
  app2.get("/api/me", async (req, res) => {
    res.json({
      user: {
        id: 1,
        name: "Admin User",
        role: "admin",
        email: "admin@pms.com"
      }
    });
  });
  app2.get("/api/users", async (req, res) => {
    try {
      const users2 = await storage.getUsers();
      res.json(users2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  app2.use("/api/bulk", bulk_default);
  app2.use("/api/alerts", alerts_default);
  app2.use("/api/forms", forms_default);
  app2.use("/api/fleet-admin", fleetAdmin_default);
  const changeRequestsRouter = createChangeRequestsRouter(storage);
  app2.use("/api/change-requests", changeRequestsRouter);
  app2.get("/api/template-builder/:templateType", async (req, res) => {
    try {
      const { templateType } = req.params;
      const template = {
        id: templateType,
        name: `${templateType} Template`,
        description: `Template for ${templateType}`,
        fields: [],
        lastModified: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });
  app2.get("/api/recurring-defects", async (req, res) => {
    try {
      const filters = {
        windowMonths: req.query.windowMonths ? parseInt(req.query.windowMonths) : 12,
        minOccurrences: req.query.minOccurrences ? parseInt(req.query.minOccurrences) : 2,
        hasCoc: req.query.hasCoc === "true" ? true : req.query.hasCoc === "false" ? false : void 0,
        equipmentKey: req.query.equipmentKey
      };
      const allRecurringDefects = await storage.getRecurringDefects();
      if (allRecurringDefects.length === 0) {
        const allDefects = await storage.getDefects({ includeClosedDefects: true });
        const equipmentKeys = /* @__PURE__ */ new Set();
        for (const defect of allDefects) {
          if (defect.equipment_key) {
            equipmentKeys.add(defect.equipment_key);
          }
        }
        const timeWindows = [6, 12, 24, 36, 48, 60];
        for (const equipmentKey of Array.from(equipmentKeys)) {
          for (const windowMonths of timeWindows) {
            await storage.calculateAndUpdateRecurringDefects(equipmentKey, windowMonths);
          }
        }
      }
      const recurringDefects2 = await storage.getRecurringDefects(filters);
      res.json(recurringDefects2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recurring defects" });
    }
  });
  app2.get("/api/recurring-defects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recurringDefect = await storage.getRecurringDefect(id);
      if (!recurringDefect) {
        return res.status(404).json({ error: "Recurring defect not found" });
      }
      res.json(recurringDefect);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recurring defect" });
    }
  });
  app2.get("/api/recurring-defects/:id/defects", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const defects2 = await storage.getDefectsForRecurring(id);
      res.json(defects2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defects for recurring defect" });
    }
  });
  app2.post("/api/recurring-defects/recalculate", async (req, res) => {
    try {
      const { equipmentKey, windowMonths } = req.body;
      if (!equipmentKey) {
        return res.status(400).json({ error: "equipmentKey is required" });
      }
      const recurringDefect = await storage.calculateAndUpdateRecurringDefects(
        equipmentKey,
        windowMonths || 12
      );
      res.json(recurringDefect);
    } catch (error) {
      res.status(500).json({ error: "Failed to recalculate recurring defects" });
    }
  });
  if (process.env.NODE_ENV === "development") {
    app2.post("/dev/seed/recurring-defects", async (req, res) => {
      try {
        const seedData = getSeedDefectsData();
        let created = 0;
        let updated = 0;
        for (const seedDefect of seedData) {
          let vesselId = await storage.getVesselIdByName(seedDefect.vesselName);
          if (!vesselId) {
            vesselId = seedDefect.vesselName.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
            await storage.createVessel({
              id: vesselId,
              name: seedDefect.vesselName,
              type: "Container"
            });
          }
          const convertDate = (dateStr) => {
            const [year, month, day] = dateStr.split("-");
            return `${day}-${month}-${year}`;
          };
          const defectData = {
            vesselId,
            vesselName: seedDefect.vesselName,
            issueDate: convertDate(seedDefect.issuedDate),
            targetCloseDate: convertDate(seedDefect.targetDate),
            status: seedDefect.status === "open" ? "Open" : "Closed",
            is_coc: seedDefect.isCoC,
            source: seedDefect.source || "Ship",
            category: "Defect",
            defectCategory: seedDefect.defectCategory,
            defectType: seedDefect.defectType,
            responsibleRole: seedDefect.responsibleRole,
            equipmentCategory: seedDefect.equipment.category,
            equipmentType: seedDefect.equipment.type,
            equipmentMake: seedDefect.equipment.make,
            equipmentModel: seedDefect.equipment.model,
            description: seedDefect.description,
            actionTakenRequested: seedDefect.actionRequested,
            seedId: seedDefect.seedId,
            // Defaults
            priority: "Medium",
            severity: 2,
            critical: false,
            occurrenceType: "Routine",
            operatingCondition: "Sailing",
            reportedBy: "System"
          };
          if (seedDefect.status === "closed" && seedDefect.dateCompleted) {
            defectData.dateCompleted = convertDate(seedDefect.dateCompleted);
          }
          const existing = await storage.getDefectBySeedId(seedDefect.seedId);
          if (existing) {
            await storage.updateDefect(existing.id, defectData);
            updated++;
          } else {
            await storage.createDefect(defectData);
            created++;
          }
        }
        res.json({
          message: "Seed data loaded successfully",
          created,
          updated,
          total: seedData.length
        });
      } catch (error) {
        console.error("Seed error:", error);
        res.status(500).json({ error: "Failed to seed data", details: error.message });
      }
    });
    app2.delete("/dev/seed/recurring-defects", async (req, res) => {
      try {
        const seedIds = [
          // Old IDs for backward compatibility
          "RD-001",
          "RD-002",
          "RD-003",
          "RD-004",
          "RD-005",
          "RD-006",
          "RD-007",
          "RD-008",
          "RD-009",
          "RD-010",
          // New IDs from updated seed data
          "RD-A-001",
          "RD-A-002",
          "RD-A-003",
          "RD-A-004",
          "RD-A-005",
          "RD-B-001",
          "RD-C-001",
          "RD-D-001",
          "RD-E-001",
          "RD-F-001"
        ];
        let deleted = 0;
        for (const seedId of seedIds) {
          const defect = await storage.getDefectBySeedId(seedId);
          if (defect) {
            await storage.deleteDefect(defect.id);
            deleted++;
          }
        }
        res.json({
          message: "Seed data deleted successfully",
          deleted
        });
      } catch (error) {
        console.error("Delete seed error:", error);
        res.status(500).json({ error: "Failed to delete seed data", details: error.message });
      }
    });
  }
  app2.get("/api/fleet/components", async (req, res) => {
    try {
      const components2 = await storage.getFleetComponents();
      res.json(components2);
    } catch (error) {
      console.error("Error fetching fleet components:", error);
      res.status(500).json({ error: "Failed to fetch fleet components" });
    }
  });
  app2.get("/api/fleet/components/:id", async (req, res) => {
    try {
      const component = await storage.getFleetComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Fleet component not found" });
      }
      res.json(component);
    } catch (error) {
      console.error("Error fetching fleet component:", error);
      res.status(500).json({ error: "Failed to fetch fleet component" });
    }
  });
  app2.post("/api/fleet/components", async (req, res) => {
    try {
      const validatedData = insertComponentSchema.parse(req.body);
      const component = await storage.createFleetComponent(validatedData);
      res.status(201).json(component);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid component data", details: error.errors });
      }
      if (error.message?.includes("must have dataScope") || error.message?.includes("cannot have vesselId") || error.message?.includes("not found")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating fleet component:", error);
      res.status(500).json({ error: error.message || "Failed to create fleet component" });
    }
  });
  app2.patch("/api/fleet/components/:id", async (req, res) => {
    try {
      const partialComponentSchema = insertComponentSchema.partial();
      const validatedData = partialComponentSchema.parse(req.body);
      const component = await storage.updateFleetComponent(req.params.id, validatedData);
      res.json(component);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid component data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("not a fleet component") || error.message?.includes("Cannot change dataScope") || error.message?.includes("Cannot assign vesselId")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating fleet component:", error);
      res.status(500).json({ error: "Failed to update fleet component" });
    }
  });
  app2.delete("/api/fleet/components/:id", async (req, res) => {
    try {
      await storage.deleteFleetComponent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("with child components")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error deleting fleet component:", error);
      res.status(500).json({ error: "Failed to delete fleet component" });
    }
  });
  app2.get("/api/fleet/jobs", async (req, res) => {
    try {
      const jobs2 = await storage.getFleetJobs();
      res.json(jobs2);
    } catch (error) {
      console.error("Error fetching fleet jobs:", error);
      res.status(500).json({ error: "Failed to fetch fleet jobs" });
    }
  });
  app2.get("/api/fleet/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getFleetJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Fleet job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching fleet job:", error);
      res.status(500).json({ error: "Failed to fetch fleet job" });
    }
  });
  app2.post("/api/fleet/jobs", async (req, res) => {
    try {
      const validatedData = insertJobSchema.parse(req.body);
      const job = await storage.createFleetJob(validatedData);
      res.status(201).json(job);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      if (error.message?.includes("must have dataScope") || error.message?.includes("cannot have vesselId") || error.message?.includes("not found")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating fleet job:", error);
      res.status(500).json({ error: error.message || "Failed to create fleet job" });
    }
  });
  app2.patch("/api/fleet/jobs/:id", async (req, res) => {
    try {
      const partialJobSchema = insertJobSchema.partial();
      const validatedData = partialJobSchema.parse(req.body);
      const job = await storage.updateFleetJob(req.params.id, validatedData);
      res.json(job);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("not a fleet") || error.message?.includes("Cannot change dataScope") || error.message?.includes("Cannot assign vesselId")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating fleet job:", error);
      res.status(500).json({ error: "Failed to update fleet job" });
    }
  });
  app2.delete("/api/fleet/jobs/:id", async (req, res) => {
    try {
      await storage.deleteFleetJob(req.params.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("not a fleet")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error deleting fleet job:", error);
      res.status(500).json({ error: "Failed to delete fleet job" });
    }
  });
  app2.get("/api/fleet/spares", async (req, res) => {
    try {
      const spares2 = await storage.getFleetSpares();
      res.json(spares2);
    } catch (error) {
      console.error("Error fetching fleet spares:", error);
      res.status(500).json({ error: "Failed to fetch fleet spares" });
    }
  });
  app2.get("/api/fleet/spares/:id", async (req, res) => {
    try {
      const spare = await storage.getFleetSpare(parseInt(req.params.id));
      if (!spare) {
        return res.status(404).json({ error: "Fleet spare not found" });
      }
      res.json(spare);
    } catch (error) {
      console.error("Error fetching fleet spare:", error);
      res.status(500).json({ error: "Failed to fetch fleet spare" });
    }
  });
  app2.post("/api/fleet/spares", async (req, res) => {
    try {
      const validatedData = insertSpareSchema.parse(req.body);
      const spare = await storage.createFleetSpare(validatedData);
      res.status(201).json(spare);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid spare data", details: error.errors });
      }
      if (error.message?.includes("must have dataScope") || error.message?.includes("cannot have vesselId") || error.message?.includes("not found")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating fleet spare:", error);
      res.status(500).json({ error: error.message || "Failed to create fleet spare" });
    }
  });
  app2.patch("/api/fleet/spares/:id", async (req, res) => {
    try {
      const partialSpareSchema = insertSpareSchema.partial();
      const validatedData = partialSpareSchema.parse(req.body);
      const spare = await storage.updateFleetSpare(parseInt(req.params.id), validatedData);
      res.json(spare);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid spare data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("not a fleet") || error.message?.includes("Cannot change dataScope") || error.message?.includes("Cannot assign vesselId")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating fleet spare:", error);
      res.status(500).json({ error: "Failed to update fleet spare" });
    }
  });
  app2.delete("/api/fleet/spares/:id", async (req, res) => {
    try {
      await storage.deleteFleetSpare(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("not a fleet")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error deleting fleet spare:", error);
      res.status(500).json({ error: "Failed to delete fleet spare" });
    }
  });
  app2.get("/api/fleet/makers", async (req, res) => {
    try {
      const search = req.query.search;
      const makers2 = await storage.getMakers(search);
      res.json(makers2);
    } catch (error) {
      console.error("Error fetching makers:", error);
      res.status(500).json({ error: "Failed to fetch makers" });
    }
  });
  app2.get("/api/fleet/makers/:id", async (req, res) => {
    try {
      const maker = await storage.getMakerById(parseInt(req.params.id));
      if (!maker) {
        return res.status(404).json({ error: "Maker not found" });
      }
      res.json(maker);
    } catch (error) {
      console.error("Error fetching maker:", error);
      res.status(500).json({ error: "Failed to fetch maker" });
    }
  });
  app2.post("/api/fleet/makers", async (req, res) => {
    try {
      const validatedData = insertMakerSchema.parse(req.body);
      let makerCode = validatedData.makerCode;
      if (!makerCode || makerCode.trim() === "") {
        const existingMakers = await storage.getMakers();
        let maxNum = 0;
        for (const m of existingMakers) {
          const match = m.makerCode?.match(/MKR-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        makerCode = `MKR-${String(maxNum + 1).padStart(6, "0")}`;
      }
      const maker = await storage.createMaker({ ...validatedData, makerCode });
      res.status(201).json(maker);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid maker data", details: error.errors });
      }
      console.error("Error creating maker:", error);
      res.status(500).json({ error: "Failed to create maker" });
    }
  });
  app2.put("/api/fleet/makers/:id", async (req, res) => {
    try {
      const partialMakerSchema = insertMakerSchema.partial();
      const validatedData = partialMakerSchema.parse(req.body);
      if (validatedData.makerCode !== void 0 && validatedData.makerCode.trim() === "") {
        delete validatedData.makerCode;
      }
      const maker = await storage.updateMaker(parseInt(req.params.id), validatedData);
      res.json(maker);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid maker data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating maker:", error);
      res.status(500).json({ error: "Failed to update maker" });
    }
  });
  app2.delete("/api/fleet/makers/:id", async (req, res) => {
    try {
      await storage.deleteMaker(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting maker:", error);
      res.status(500).json({ error: "Failed to delete maker" });
    }
  });
  app2.get("/api/fleet/master-lists", async (req, res) => {
    try {
      const listType = req.query.listType;
      const masterLists2 = await storage.getMasterLists(listType);
      res.json(masterLists2);
    } catch (error) {
      console.error("Error fetching master lists:", error);
      res.status(500).json({ error: "Failed to fetch master lists" });
    }
  });
  app2.get("/api/fleet/master-lists/:id", async (req, res) => {
    try {
      const masterList = await storage.getMasterListById(parseInt(req.params.id));
      if (!masterList) {
        return res.status(404).json({ error: "Master list not found" });
      }
      res.json(masterList);
    } catch (error) {
      console.error("Error fetching master list:", error);
      res.status(500).json({ error: "Failed to fetch master list" });
    }
  });
  app2.post("/api/fleet/master-lists", async (req, res) => {
    try {
      const validatedData = insertMasterListSchema.parse(req.body);
      const masterList = await storage.createMasterList(validatedData);
      res.status(201).json(masterList);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid master list data", details: error.errors });
      }
      console.error("Error creating master list:", error);
      res.status(500).json({ error: "Failed to create master list" });
    }
  });
  app2.put("/api/fleet/master-lists/:id", async (req, res) => {
    try {
      const partialMasterListSchema = insertMasterListSchema.partial();
      const validatedData = partialMasterListSchema.parse(req.body);
      const masterList = await storage.updateMasterList(parseInt(req.params.id), validatedData);
      res.json(masterList);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid master list data", details: error.errors });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating master list:", error);
      res.status(500).json({ error: "Failed to update master list" });
    }
  });
  app2.delete("/api/fleet/master-lists/:id", async (req, res) => {
    try {
      await storage.deleteMasterList(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting master list:", error);
      res.status(500).json({ error: "Failed to delete master list" });
    }
  });
  app2.get("/api/fleet/vessel-mappings", async (req, res) => {
    try {
      const mappings = await storage.getFleetVesselMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching vessel mappings:", error);
      res.status(500).json({ error: "Failed to fetch vessel mappings" });
    }
  });
  app2.post("/api/fleet/vessel-mappings", async (req, res) => {
    try {
      const { fleetEntityType, fleetEntityIds, vesselId, vesselEntityId, vesselEntityCode } = req.body;
      if (!fleetEntityType || !fleetEntityIds?.length || !vesselId) {
        return res.status(400).json({ error: "Missing required fields: fleetEntityType, fleetEntityIds, vesselId" });
      }
      const mappings = await storage.createFleetVesselMappings({
        fleetEntityType,
        fleetEntityIds,
        vesselId,
        vesselEntityId,
        vesselEntityCode,
        mappedBy: "admin"
      });
      res.status(201).json(mappings);
    } catch (error) {
      console.error("Error creating vessel mappings:", error);
      res.status(500).json({ error: error.message || "Failed to create vessel mappings" });
    }
  });
  app2.delete("/api/fleet/vessel-mappings/:id", async (req, res) => {
    try {
      await storage.deleteFleetVesselMapping(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vessel mapping:", error);
      res.status(500).json({ error: error.message || "Failed to delete vessel mapping" });
    }
  });
  app2.get("/api/fleets", async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const fleets2 = includeInactive ? await storage.getAllFleets() : await storage.getFleets();
      res.json(fleets2);
    } catch (error) {
      console.error("Error fetching fleets:", error);
      res.status(500).json({ error: error.message || "Failed to fetch fleets" });
    }
  });
  app2.get("/api/fleets/:id", async (req, res) => {
    try {
      const fleet = await storage.getFleetById(req.params.id);
      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }
      res.json(fleet);
    } catch (error) {
      console.error("Error fetching fleet:", error);
      res.status(500).json({ error: error.message || "Failed to fetch fleet" });
    }
  });
  app2.post("/api/fleets", async (req, res) => {
    try {
      const { id, code, name, description, isActive } = req.body;
      if (!code || !name) {
        return res.status(400).json({ error: "Fleet code and name are required" });
      }
      const fleet = await storage.createFleet({
        id: id || code,
        // Use code as id if not provided
        code,
        name,
        description: description || null,
        isActive: isActive ?? true
      });
      res.status(201).json(fleet);
    } catch (error) {
      console.error("Error creating fleet:", error);
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to create fleet" });
    }
  });
  app2.put("/api/fleets/:id", async (req, res) => {
    try {
      const { code, name, description, isActive } = req.body;
      const fleet = await storage.updateFleet(req.params.id, {
        code,
        name,
        description,
        isActive
      });
      res.json(fleet);
    } catch (error) {
      console.error("Error updating fleet:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to update fleet" });
    }
  });
  app2.delete("/api/fleets/:id", async (req, res) => {
    try {
      await storage.deleteFleet(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting fleet:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Cannot delete")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to delete fleet" });
    }
  });
  app2.get("/api/fleets/:id/vessels", async (req, res) => {
    try {
      const vessels2 = await storage.getVesselsByFleet(req.params.id);
      res.json(vessels2);
    } catch (error) {
      console.error("Error fetching fleet vessels:", error);
      res.status(500).json({ error: error.message || "Failed to fetch fleet vessels" });
    }
  });
  app2.put("/api/vessels/:id/fleet", async (req, res) => {
    try {
      const { fleetId } = req.body;
      const vessel = await storage.assignVesselToFleet(req.params.id, fleetId);
      res.json(vessel);
    } catch (error) {
      console.error("Error assigning vessel to fleet:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to assign vessel to fleet" });
    }
  });
  app2.get("/api/vessels-with-fleets", async (req, res) => {
    try {
      const vessels2 = await storage.getVesselsWithFleets();
      res.json(vessels2);
    } catch (error) {
      console.error("Error fetching vessels with fleets:", error);
      res.status(500).json({ error: error.message || "Failed to fetch vessels with fleets" });
    }
  });
  app2.get("/api/vessels", async (req, res) => {
    try {
      const vessels2 = await storage.getVessels();
      res.json(vessels2);
    } catch (error) {
      console.error("Error fetching vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  });
  app2.post("/api/vessels", async (req, res) => {
    try {
      const { id, name, code, fleetId, imoNumber, vesselType, flag, isActive } = req.body;
      if (!id || !name) {
        return res.status(400).json({ error: "Vessel ID and name are required" });
      }
      const vessel = await storage.createVessel({
        id,
        name,
        code: code || id,
        fleetId: fleetId || null,
        imoNumber: imoNumber || null,
        vesselType: vesselType || null,
        flag: flag || null,
        isActive: isActive ?? true
      });
      res.status(201).json(vessel);
    } catch (error) {
      console.error("Error creating vessel:", error);
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to create vessel" });
    }
  });
  app2.get("/api/pms-vessel-settings", async (req, res) => {
    try {
      const settings = await storage.getAllPmsVesselSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching all PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to fetch PMS vessel settings" });
    }
  });
  app2.post("/api/pms-vessel-settings", async (req, res) => {
    try {
      const { vesselId, ...settingsData } = req.body;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      const existing = await storage.getPmsVesselSettings(vesselId);
      if (existing) {
        return res.status(409).json({ error: "PMS vessel settings already exist for this vessel. Use PUT to update." });
      }
      const updatedBy = settingsData.updatedBy || req.user?.username || "test";
      const settings = await storage.createOrUpdatePmsVesselSettings({
        vesselId,
        ...settingsData,
        updatedBy
      });
      res.status(201).json(settings);
    } catch (error) {
      console.error("Error creating PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to create PMS vessel settings" });
    }
  });
  app2.get("/api/pms-vessel-settings/:vesselId", async (req, res) => {
    try {
      const settings = await storage.getPmsVesselSettings(req.params.vesselId);
      if (!settings) {
        return res.status(404).json({ error: "PMS vessel settings not found" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to fetch PMS vessel settings" });
    }
  });
  app2.put("/api/pms-vessel-settings/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const updatedBy = req.body.updatedBy || req.user?.username || "test";
      const settings = await storage.createOrUpdatePmsVesselSettings({
        vesselId,
        ...req.body,
        updatedBy
      });
      try {
        const { workOrderStatusRecalculator: workOrderStatusRecalculator3 } = await Promise.resolve().then(() => (init_workOrderStatusRecalculator(), workOrderStatusRecalculator_exports));
        const recalcResult = await workOrderStatusRecalculator3.forceRecalculation();
        console.log(`[PMS Settings] Grace period settings updated for ${vesselId}, recalculated ${recalcResult.statusesUpdated} work order statuses`);
      } catch (recalcError) {
        console.error("[PMS Settings] Failed to trigger status recalculation:", recalcError);
      }
      res.json(settings);
    } catch (error) {
      console.error("Error saving PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to save PMS vessel settings" });
    }
  });
  app2.delete("/api/pms-vessel-settings/:vesselId", async (req, res) => {
    try {
      await storage.deletePmsVesselSettings(req.params.vesselId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to delete PMS vessel settings" });
    }
  });
  app2.post("/api/work-orders/recalculate-statuses", async (req, res) => {
    try {
      const { workOrderStatusRecalculator: workOrderStatusRecalculator3 } = await Promise.resolve().then(() => (init_workOrderStatusRecalculator(), workOrderStatusRecalculator_exports));
      const result = await workOrderStatusRecalculator3.forceRecalculation();
      res.json({
        success: true,
        workOrdersChecked: result.workOrdersChecked,
        statusesUpdated: result.statusesUpdated,
        message: `Recalculated ${result.statusesUpdated} out of ${result.workOrdersChecked} work orders`
      });
    } catch (error) {
      console.error("Error recalculating work order statuses:", error);
      res.status(500).json({ error: "Failed to recalculate work order statuses" });
    }
  });
  app2.get("/api/vessel-location-names/:vesselId", async (req, res) => {
    try {
      const settings = await storage.getPmsVesselSettings(req.params.vesselId);
      res.json({
        vesselId: req.params.vesselId,
        locationAName: settings?.locationAName ?? "Location A",
        locationBName: settings?.locationBName ?? "Location B"
      });
    } catch (error) {
      console.error("Error fetching vessel location names:", error);
      res.status(500).json({ error: "Failed to fetch vessel location names" });
    }
  });
  app2.put("/api/vessel-location-names/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { locationAName, locationBName } = req.body;
      if (locationAName !== void 0 && typeof locationAName !== "string") {
        return res.status(400).json({ error: "locationAName must be a string" });
      }
      if (locationBName !== void 0 && typeof locationBName !== "string") {
        return res.status(400).json({ error: "locationBName must be a string" });
      }
      const existingSettings = await storage.getPmsVesselSettings(vesselId);
      const updatedBy = req.body.updatedBy || req.user?.username || "test";
      const settingsToSave = existingSettings ? {
        ...existingSettings,
        vesselId,
        locationAName: locationAName ?? existingSettings.locationAName ?? "Location A",
        locationBName: locationBName ?? existingSettings.locationBName ?? "Location B",
        updatedBy
      } : {
        // New settings - use defaults for non-location fields
        vesselId,
        locationAName: locationAName ?? "Location A",
        locationBName: locationBName ?? "Location B",
        calendarLeadDaysCritical: 7,
        calendarLeadDaysNonCritical: 14,
        calendarGraceMode: "COMPANY_STANDARD",
        calendarGraceDays: 7,
        rhLeadHoursCritical: 50,
        rhLeadHoursNonCritical: 100,
        rhGraceHours: 168,
        updatedBy
      };
      const updatedSettings = await storage.createOrUpdatePmsVesselSettings(settingsToSave);
      res.json({
        vesselId,
        locationAName: updatedSettings.locationAName,
        locationBName: updatedSettings.locationBName
      });
    } catch (error) {
      console.error("Error updating vessel location names:", error);
      res.status(500).json({ error: "Failed to update vessel location names" });
    }
  });
  app2.post("/api/jobs/:id/generate-wo", async (req, res) => {
    try {
      const jobId = req.params.id;
      const { reason } = req.body;
      if (!reason || !["Planning", "Breakdown", "Other"].includes(reason)) {
        return res.status(400).json({ error: "Invalid reason. Must be 'Planning', 'Breakdown', or 'Other'" });
      }
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      const workOrder = await storage.generateOnDemandWorkOrder(jobId, reason);
      res.status(201).json(workOrder);
    } catch (error) {
      console.error("Error generating on-demand work order:", error);
      res.status(500).json({ error: error.message || "Failed to generate work order" });
    }
  });
  app2.post("/api/work-orders/check-postponements", async (req, res) => {
    try {
      const { vesselId } = req.body;
      const result = await storage.checkAndRevertPostponedWorkOrders(vesselId);
      res.json({
        success: true,
        revertedCount: result.revertedCount,
        revertedWorkOrders: result.revertedWorkOrders
      });
    } catch (error) {
      console.error("Error checking postponements:", error);
      res.status(500).json({ error: error.message || "Failed to check postponements" });
    }
  });
  app2.post("/api/upload-document", upload2.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const { documentType } = req.body;
      const file = req.file;
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      const timestamp2 = Date.now();
      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf("."));
      const entityId = `uploads/${documentType}_${timestamp2}${fileExtension}`;
      const fullPath = `${privateDir}/${entityId}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      await bucket.file(objectName).save(file.buffer, {
        metadata: {
          contentType: file.mimetype
        }
      });
      const fileKey = `/objects/${entityId}`;
      res.json({
        success: true,
        fileName: file.originalname,
        fileKey,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Failed to upload document: " + error.message });
    }
  });
  app2.get("/api/documents/:fileKey(*)", async (req, res) => {
    try {
      const fileKey = "/" + req.params.fileKey;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(fileKey);
      const [metadata] = await objectFile.getMetadata();
      const [fileContent] = await objectFile.download();
      const base64Content = fileContent.toString("base64");
      let mimeType = metadata.contentType || "application/octet-stream";
      res.json({
        success: true,
        dataUrl: `data:${mimeType};base64,${base64Content}`,
        fileName: objectFile.name.substring(objectFile.name.lastIndexOf("/") + 1)
      });
    } catch (error) {
      console.error("Document retrieval error:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(500).json({ error: "Failed to retrieve document: " + error.message });
    }
  });
  app2.delete("/api/documents/:fileKey(*)", async (req, res) => {
    try {
      const fileKey = "/" + req.params.fileKey;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(fileKey);
      await objectFile.delete();
      res.json({ success: true, message: "Document deleted successfully" });
    } catch (error) {
      console.error("Document deletion error:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(500).json({ error: "Failed to delete document: " + error.message });
    }
  });
  app2.get("/api/admin/job-due-scan", async (req, res) => {
    try {
      console.log("\u{1F50D} Manual job due scan triggered (GET) for ALL vessels");
      const { jobDueScanner: jobDueScanner3 } = await Promise.resolve().then(() => (init_jobDueScanner(), jobDueScanner_exports));
      const results = await jobDueScanner3.runScan();
      console.log("\u2705 Manual job due scan completed:", results);
      res.json({
        success: true,
        scanCompleted: true,
        message: `Job due scan completed`,
        results: {
          calendarJobsChecked: results.calendarJobsChecked,
          calendarWOsGenerated: results.calendarWOsGenerated,
          rhJobsChecked: results.rhJobsChecked,
          rhWOsGenerated: results.rhWOsGenerated,
          totalGenerated: results.calendarWOsGenerated + results.rhWOsGenerated
        }
      });
    } catch (error) {
      console.error("\u274C Job due scan failed:", error);
      res.status(500).json({
        success: false,
        scanCompleted: false,
        error: "Failed to run job due scan: " + error.message
      });
    }
  });
  app2.post("/api/admin/job-due-scan", async (req, res) => {
    try {
      const { vesselId } = req.body;
      console.log(`\u{1F50D} Manual job due scan triggered${vesselId ? ` for vessel: ${vesselId}` : " for ALL vessels"}`);
      const { jobDueScanner: jobDueScanner3 } = await Promise.resolve().then(() => (init_jobDueScanner(), jobDueScanner_exports));
      const results = await jobDueScanner3.runScan();
      console.log("\u2705 Manual job due scan completed:", results);
      res.json({
        success: true,
        message: `Job due scan completed`,
        results: {
          calendarJobsChecked: results.calendarJobsChecked,
          calendarWOsGenerated: results.calendarWOsGenerated,
          rhJobsChecked: results.rhJobsChecked,
          rhWOsGenerated: results.rhWOsGenerated,
          totalGenerated: results.calendarWOsGenerated + results.rhWOsGenerated
        }
      });
    } catch (error) {
      console.error("\u274C Job due scan failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to run job due scan: " + error.message
      });
    }
  });
  app2.post("/api/admin/purge-jobs", async (req, res) => {
    try {
      const { vesselId } = req.body;
      console.log(`\u{1F9F9} Admin purge request received${vesselId ? ` for vessel: ${vesselId}` : " for ALL vessels"}`);
      const result = await storage.purgeJobsAndLinkedData(vesselId);
      const importHistory2 = {
        id: Date.now().toString(),
        type: "jobs",
        fileName: "PURGE_OPERATION",
        uploadedBy: "admin",
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        recordsProcessed: result.deletedJobs,
        recordsSuccess: result.deletedJobs,
        recordsFailed: 0,
        vesselId: vesselId || "ALL_VESSELS",
        errors: []
      };
      console.log("\u2705 Purge operation completed:", {
        ...result,
        totalRecordsAffected: result.deletedWorkOrderExecutions + result.deletedWorkOrders + result.deletedJobs + result.deletedRunningHoursAudits
      });
      res.json({
        success: true,
        message: `Successfully purged jobs and linked data${vesselId ? ` for vessel ${vesselId}` : " for all vessels"}`,
        statistics: result
      });
    } catch (error) {
      console.error("\u274C Purge operation failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to purge jobs and linked data: " + error.message
      });
    }
  });
  app2.post("/api/admin/migrate-inventory", async (req, res) => {
    try {
      const { vesselId, dryRun = true } = req.body;
      if (!vesselId) {
        return res.status(400).json({ success: false, error: "vesselId is required" });
      }
      console.log(`\u{1F504} Starting inventory migration for vessel: ${vesselId}${dryRun ? " (DRY RUN)" : ""}`);
      const sparesResult = await storage.getSpares(vesselId);
      const stats = {
        sparesProcessed: 0,
        locationsCreated: 0,
        stockRecordsCreated: 0,
        componentLinksCreated: 0,
        transactionsCreated: 0,
        errors: []
      };
      for (const spare of sparesResult) {
        try {
          stats.sparesProcessed++;
          const locationA = spare.location || "Location A";
          const locationB = spare.location2 || "Location B";
          const robA = spare.robLocationA || 0;
          const robB = spare.robLocationB || 0;
          let runningRob = 0;
          if (robA > 0) {
            stats.locationsCreated++;
            stats.stockRecordsCreated++;
            stats.transactionsCreated++;
            if (!dryRun) {
              const locA = await storage.findOrCreateLocation(vesselId, locationA, "System Migration");
              await storage.upsertSpareLocationStock({
                vesselId,
                spareId: spare.id,
                locationId: locA.id,
                qty: robA
              });
              await storage.createInventoryTransaction({
                vesselId,
                spareId: spare.id,
                locationId: locA.id,
                eventType: "RECEIVE",
                qtyChange: robA,
                robTotalBefore: runningRob,
                robTotalAfter: runningRob + robA,
                robLocationBefore: 0,
                robLocationAfter: robA,
                referenceType: "MANUAL",
                referenceId: `MIGRATE-${vesselId}-${Date.now()}`,
                referenceNote: `Opening balance migrated from legacy data`,
                userId: "System Migration"
              });
            }
            runningRob += robA;
          }
          if (robB > 0) {
            stats.locationsCreated++;
            stats.stockRecordsCreated++;
            stats.transactionsCreated++;
            if (!dryRun) {
              const locB = await storage.findOrCreateLocation(vesselId, locationB, "System Migration");
              await storage.upsertSpareLocationStock({
                vesselId,
                spareId: spare.id,
                locationId: locB.id,
                qty: robB
              });
              await storage.createInventoryTransaction({
                vesselId,
                spareId: spare.id,
                locationId: locB.id,
                eventType: "RECEIVE",
                qtyChange: robB,
                robTotalBefore: runningRob,
                robTotalAfter: runningRob + robB,
                robLocationBefore: 0,
                robLocationAfter: robB,
                referenceType: "MANUAL",
                referenceId: `MIGRATE-${vesselId}-${Date.now()}`,
                referenceNote: `Opening balance migrated from legacy data`,
                userId: "System Migration"
              });
            }
          }
          if (spare.componentId) {
            stats.componentLinksCreated++;
            if (!dryRun) {
              try {
                await storage.createSpareComponentLink({
                  vesselId,
                  spareId: spare.id,
                  componentId: spare.componentId,
                  linkedBy: "System Migration"
                });
              } catch (linkError) {
                if (!linkError.message?.includes("duplicate")) {
                  stats.errors.push(`Link error for spare ${spare.id}: ${linkError.message}`);
                } else {
                  stats.componentLinksCreated--;
                }
              }
            }
          }
        } catch (spareError) {
          stats.errors.push(`Error processing spare ${spare.id}: ${spareError.message}`);
        }
      }
      console.log(`\u2705 Migration ${dryRun ? "preview" : "completed"}:`, stats);
      res.json({
        success: true,
        dryRun,
        message: dryRun ? `Migration preview complete. Set dryRun=false to execute.` : `Migration completed successfully`,
        statistics: stats
      });
    } catch (error) {
      console.error("\u274C Migration failed:", error);
      res.status(500).json({
        success: false,
        error: "Migration failed: " + error.message
      });
    }
  });
  app2.post("/api/admin/sync-work-order-status", async (req, res) => {
    try {
      const { vesselId, dryRun = true } = req.body;
      console.log(`\u{1F504} Starting work order status sync${vesselId ? ` for vessel ${vesselId}` : " for all vessels"}${dryRun ? " (DRY RUN)" : ""}`);
      const workOrders2 = await storage.getWorkOrders(vesselId || void 0);
      const allVessels = await storage.getVessels();
      const vesselSettingsMap = /* @__PURE__ */ new Map();
      const graceSettingsMap = /* @__PURE__ */ new Map();
      for (const vessel of allVessels) {
        if (vessel.id) {
          const settings = await storage.getPmsVesselSettings(vessel.id);
          if (settings) {
            vesselSettingsMap.set(vessel.id, settings);
            graceSettingsMap.set(vessel.id, settings);
          }
        }
      }
      const allJobs = await storage.getJobs();
      const jobMap = new Map(allJobs.map((j) => [j.id, j]));
      const allComponents = await storage.getComponents();
      const componentMap = new Map(allComponents.map((c) => [c.id, c]));
      const stats = {
        totalProcessed: 0,
        statusUpdated: 0,
        alreadyCorrect: 0,
        errors: [],
        changes: []
      };
      for (const wo of workOrders2) {
        try {
          stats.totalProcessed++;
          const job = wo.jobId ? jobMap.get(wo.jobId) : void 0;
          const component = wo.componentId ? componentMap.get(wo.componentId) : void 0;
          const vesselSettings = wo.vesselId ? vesselSettingsMap.get(wo.vesselId) : void 0;
          const vesselGraceSettings = wo.vesselId ? graceSettingsMap.get(wo.vesselId) : void 0;
          const parseRH = (val) => {
            if (val === null || val === void 0 || val === "") return void 0;
            const num = typeof val === "number" ? val : parseFloat(String(val));
            return isNaN(num) ? void 0 : num;
          };
          const dueRH = wo.maintenanceBasis === "Running Hours" ? parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading) : void 0;
          const currentRH = wo.maintenanceBasis === "Running Hours" ? parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading) : void 0;
          const isJobCritical3 = job?.jobPriority === "Critical" || job?.classRelated === "true" || job?.classRelated === true;
          const rhLeadTimeHours = wo.maintenanceBasis === "Running Hours" ? isJobCritical3 ? vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL : vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS : void 0;
          const computedStatus = computeWorkOrderStatus({
            dueDate: wo.dueDate,
            dueRH,
            currentRH,
            isExecution: wo.isExecution || false,
            status: wo.status,
            completionDateTime: wo.completionDateTime,
            maintenanceBasis: wo.maintenanceBasis,
            vesselGraceSettings: vesselGraceSettings ? {
              calendarGraceMode: vesselGraceSettings.calendarGraceMode || "COMPANY_STANDARD",
              calendarGraceDays: vesselGraceSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
              rhGraceHours: vesselSettings?.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
              rhLeadTimeHours: vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
            } : void 0,
            rhLeadTimeHours
          });
          if (wo.status !== computedStatus) {
            stats.changes.push({
              id: wo.id,
              workOrderNo: wo.workOrderNo,
              oldStatus: wo.status || "null",
              newStatus: computedStatus
            });
            if (!dryRun) {
              await storage.updateWorkOrder(wo.id, { status: computedStatus });
              stats.statusUpdated++;
            } else {
              stats.statusUpdated++;
            }
          } else {
            stats.alreadyCorrect++;
          }
        } catch (woError) {
          stats.errors.push(`Error processing WO ${wo.workOrderNo}: ${woError.message}`);
        }
      }
      console.log(`\u2705 Status sync ${dryRun ? "preview" : "completed"}:`, {
        totalProcessed: stats.totalProcessed,
        statusUpdated: stats.statusUpdated,
        alreadyCorrect: stats.alreadyCorrect,
        errors: stats.errors.length
      });
      res.json({
        success: true,
        dryRun,
        message: dryRun ? `Status sync preview complete. ${stats.statusUpdated} work orders would be updated. Set dryRun=false to execute.` : `Status sync completed. ${stats.statusUpdated} work orders updated.`,
        statistics: {
          totalProcessed: stats.totalProcessed,
          statusUpdated: stats.statusUpdated,
          alreadyCorrect: stats.alreadyCorrect,
          errorCount: stats.errors.length
        },
        changes: stats.changes.slice(0, 50),
        // Limit to first 50 for response size
        errors: stats.errors
      });
    } catch (error) {
      console.error("\u274C Status sync failed:", error);
      res.status(500).json({
        success: false,
        error: "Status sync failed: " + error.message
      });
    }
  });
  const initializeCertificates = async () => {
    const existingCerts = await storage.getCertificates();
    if (existingCerts.length === 0) {
      const sampleCertificates = [
        {
          id: "C1",
          certificateName: "International Ballast Water Management Certificate",
          type: "Flag",
          vessel: "MV Test",
          issueDate: "01 Sep 2019",
          expiryDate: "01 Sep 2024",
          lastAnnual: "01 Sep 2024",
          lastInterm: "01 Sep 2024",
          endorsementDate: "01 Sep 2024",
          lastEditUpload: "01 Sep 2024",
          applicable: true,
          attachments: []
        },
        {
          id: "C2",
          certificateName: "International Ballast Water Management Certificate",
          type: "Flag",
          vessel: "MV Test",
          issueDate: "01 Sep 2019",
          expiryDate: "",
          lastAnnual: "",
          lastInterm: "",
          endorsementDate: "",
          lastEditUpload: "",
          applicable: true,
          attachments: []
        },
        {
          id: "C3",
          certificateName: "Safety Management Certificate",
          type: "Class",
          vessel: "MV TEST 2",
          issueDate: "15 Mar 2020",
          expiryDate: "15 Mar 2025",
          lastAnnual: "15 Mar 2024",
          lastInterm: "15 Sep 2023",
          endorsementDate: "15 Mar 2024",
          lastEditUpload: "20 Oct 2024",
          applicable: true,
          attachments: []
        },
        {
          id: "C4",
          certificateName: "International Oil Pollution Prevention Certificate",
          type: "Flag",
          vessel: "MT Nordic Star",
          issueDate: "01 Jan 2021",
          expiryDate: "01 Jan 2026",
          lastAnnual: "01 Jan 2024",
          lastInterm: "01 Jul 2023",
          endorsementDate: "01 Jan 2024",
          lastEditUpload: "15 Nov 2024",
          applicable: false,
          attachments: []
        },
        {
          id: "C5",
          certificateName: "Cargo Ship Safety Equipment Certificate",
          type: "Class",
          vessel: "MT Pacific Voyager",
          issueDate: "10 Jun 2022",
          expiryDate: "10 Jun 2027",
          lastAnnual: "10 Jun 2024",
          lastInterm: "",
          endorsementDate: "10 Jun 2024",
          lastEditUpload: "25 Sep 2024",
          applicable: true,
          attachments: []
        }
      ];
      for (const cert of sampleCertificates) {
        await storage.createCertificate(cert);
      }
      console.log("\u{1F4CB} Initialized certificates data with sample data via storage layer");
    }
  };
  initializeCertificates();
  app2.get("/api/certificates", async (req, res) => {
    try {
      const certificates2 = await storage.getCertificates();
      res.json(certificates2);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });
  app2.get("/api/certificates/:id", async (req, res) => {
    try {
      const certificate = await storage.getCertificate(req.params.id);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ error: "Failed to fetch certificate" });
    }
  });
  app2.patch("/api/certificates/:id", async (req, res) => {
    try {
      const updatedCertificate = await storage.updateCertificate(req.params.id, req.body);
      res.json(updatedCertificate);
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Failed to update certificate" });
    }
  });
  app2.post("/api/certificates", async (req, res) => {
    try {
      const newCertificate = await storage.createCertificate(req.body);
      res.status(201).json(newCertificate);
    } catch (error) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ error: "Failed to create certificate" });
    }
  });
  const initializeSurveys = async () => {
    const existingSurveys = await storage.getSurveys();
    if (existingSurveys.length === 0) {
      const sampleSurveys = [
        {
          id: "S1",
          surveyName: "Ballast Water Management annual Survey",
          type: "Annual",
          vessel: "MV Test",
          surveyDate: "01 Sep 2019",
          dueDate: "01 Sep 2024",
          firstRangeDate: "01 Sep 2024",
          secondRangeDate: "01 Sep 2024",
          postponed: "01 Sep 2024",
          lastEdit: "01 Sep 2024",
          applicable: true,
          attachments: []
        },
        {
          id: "S2",
          surveyName: "Ballast Water Management annual Survey",
          type: "Int",
          vessel: "MV Test",
          surveyDate: "",
          dueDate: "",
          firstRangeDate: "",
          secondRangeDate: "",
          postponed: "",
          lastEdit: "",
          applicable: true,
          attachments: []
        },
        {
          id: "S3",
          surveyName: "Safety Equipment Survey",
          type: "Annual",
          vessel: "MV TEST 2",
          surveyDate: "15 Mar 2020",
          dueDate: "15 Mar 2025",
          firstRangeDate: "15 Mar 2024",
          secondRangeDate: "15 Sep 2024",
          postponed: "",
          lastEdit: "20 Oct 2024",
          applicable: true,
          attachments: []
        },
        {
          id: "S4",
          surveyName: "Hull and Machinery Survey",
          type: "Int",
          vessel: "MT Nordic Star",
          surveyDate: "01 Jan 2021",
          dueDate: "01 Jan 2026",
          firstRangeDate: "01 Jan 2024",
          secondRangeDate: "01 Jul 2024",
          postponed: "01 Mar 2024",
          lastEdit: "15 Nov 2024",
          applicable: false,
          attachments: []
        },
        {
          id: "S5",
          surveyName: "Load Line Survey",
          type: "Annual",
          vessel: "MT Pacific Voyager",
          surveyDate: "10 Jun 2022",
          dueDate: "10 Jun 2027",
          firstRangeDate: "10 Jun 2024",
          secondRangeDate: "",
          postponed: "",
          lastEdit: "25 Sep 2024",
          applicable: true,
          attachments: []
        }
      ];
      for (const survey of sampleSurveys) {
        await storage.createSurvey(survey);
      }
      console.log("\u{1F4CB} Initialized surveys data with sample data via storage layer");
    }
  };
  initializeSurveys();
  app2.get("/api/surveys", async (req, res) => {
    try {
      const surveys2 = await storage.getSurveys();
      res.json(surveys2);
    } catch (error) {
      console.error("Error fetching surveys:", error);
      res.status(500).json({ error: "Failed to fetch surveys" });
    }
  });
  app2.get("/api/surveys/:id", async (req, res) => {
    try {
      const survey = await storage.getSurvey(req.params.id);
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }
      res.json(survey);
    } catch (error) {
      console.error("Error fetching survey:", error);
      res.status(500).json({ error: "Failed to fetch survey" });
    }
  });
  app2.patch("/api/surveys/:id", async (req, res) => {
    try {
      const updatedSurvey = await storage.updateSurvey(req.params.id, req.body);
      res.json(updatedSurvey);
    } catch (error) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: "Survey not found" });
      }
      console.error("Error updating survey:", error);
      res.status(500).json({ error: "Failed to update survey" });
    }
  });
  app2.post("/api/surveys", async (req, res) => {
    try {
      const newSurvey = await storage.createSurvey(req.body);
      res.status(201).json(newSurvey);
    } catch (error) {
      console.error("Error creating survey:", error);
      res.status(500).json({ error: "Failed to create survey" });
    }
  });
  const httpServer = createServer(app2);
  storage.recalculateAllRecurringDefects().then(() => {
    console.log("\u2705 Recurring defects recalculated successfully");
  }).catch((err) => {
    console.error("\u26A0\uFE0F Error recalculating recurring defects:", err);
  });
  (async () => {
    try {
      const { calculateNextDueDate: calculateNextDueDate2, normalizeDateToDDMMMYYYY: normalizeDateToDDMMMYYYY2 } = await Promise.resolve().then(() => (init_dateUtils(), dateUtils_exports));
      const allJobs = await storage.getJobs();
      let updatedCalendar = 0;
      let updatedRH = 0;
      for (const job of allJobs) {
        let updates = {};
        let needsUpdate = false;
        if (job.maintenanceBasis === "Calendar" && !job.nextDueDate) {
          const rawLastDone = job.lastDoneDate;
          if (rawLastDone && job.frequencyValue && job.frequencyUnit) {
            const lastDone = normalizeDateToDDMMMYYYY2(rawLastDone);
            if (lastDone) {
              const calculatedNextDue = calculateNextDueDate2(lastDone, job.frequencyValue, job.frequencyUnit);
              if (calculatedNextDue) {
                updates.nextDueDate = calculatedNextDue;
                needsUpdate = true;
                updatedCalendar++;
              }
            }
          }
        }
        if (job.maintenanceBasis === "Running Hours" && !job.nextDueRH) {
          const lastDoneRH = job.lastDoneRH;
          const intervalRH = Number(job.intervalRunningHour);
          if (lastDoneRH && !isNaN(intervalRH) && intervalRH > 0) {
            const lastRH = Number(lastDoneRH);
            if (!isNaN(lastRH)) {
              updates.nextDueRH = String(lastRH + intervalRH);
              needsUpdate = true;
              updatedRH++;
            }
          }
        }
        if (needsUpdate) {
          await storage.updateJob(job.id, updates);
        }
      }
      if (updatedCalendar > 0 || updatedRH > 0) {
        console.log(`\u2705 Job backfill complete: ${updatedCalendar} Calendar jobs (nextDueDate), ${updatedRH} RH jobs (nextDueRH)`);
      } else {
        console.log("\u2705 Job backfill check complete - all jobs already have due dates/RH calculated");
      }
    } catch (err) {
      console.error("\u26A0\uFE0F Error during job nextDueDate/nextDueRH backfill:", err);
    }
  })();
  (async () => {
    try {
      const result = await storage.checkAndRevertPostponedWorkOrders();
      if (result.revertedCount > 0) {
        console.log(`\u2705 Reverted ${result.revertedCount} expired postponed work orders to Due status`);
        result.revertedWorkOrders.forEach((wo) => {
          console.log(`   - WO ${wo.workOrderNo} (${wo.jobTitle})`);
        });
      } else {
        console.log("\u2705 No expired postponed work orders to revert");
      }
    } catch (err) {
      console.error("\u26A0\uFE0F Error checking postponed work orders on startup:", err);
    }
  })();
  const POSTPONEMENT_CHECK_INTERVAL_MS = 60 * 60 * 1e3;
  const postponementCheckInterval = setInterval(async () => {
    try {
      const result = await storage.checkAndRevertPostponedWorkOrders();
      if (result.revertedCount > 0) {
        console.log(`[Scheduled] Reverted ${result.revertedCount} expired postponed work orders`);
      }
    } catch (err) {
      console.error("[Scheduled] Error checking postponed work orders:", err);
    }
  }, POSTPONEMENT_CHECK_INTERVAL_MS);
  console.log(`\u{1F4C5} Scheduled hourly check for expired postponed work orders`);
  process.on("SIGTERM", () => {
    console.log("Cleaning up scheduled tasks...");
    clearInterval(postponementCheckInterval);
  });
  process.on("SIGINT", () => {
    console.log("Cleaning up scheduled tasks...");
    clearInterval(postponementCheckInterval);
  });
  return httpServer;
}
function convertToCSV(reportData) {
  if (!reportData.data || reportData.data.length === 0) {
    return "No data available";
  }
  const headers = Object.keys(reportData.data[0]);
  let csv = headers.join(",") + "\n";
  reportData.data.forEach((row) => {
    const values = headers.map((header) => {
      const val = row[header];
      if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csv += values.join(",") + "\n";
  });
  return csv;
}
function getSeedDefectsData() {
  return [];
}

// server/vite.ts
import express from "express";
import fs4 from "fs";
import path7 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path6 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var basePath = process.env.REPL_ID ? "" : "technical";
var BASE_PATH = process.env.NODE_ENV === "production" ? "/technical/" : "/";
var vite_config_default = defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    runtimeErrorOverlay()
  ],
  resolve: {
    alias: {
      "@": path6.resolve(import.meta.dirname, "client", "src"),
      "@shared": path6.resolve(import.meta.dirname, "shared"),
      "@assets": path6.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path6.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path6.resolve(import.meta.dirname, "dist/public"),
    assetsDir: "assets",
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path7.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path7.resolve(import.meta.dirname, "public");
  if (!fs4.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path7.resolve(distPath, "index.html"));
  });
}

// server/index.ts
init_storage();
dotenv.config();
var app = express2();
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path8 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path8.startsWith("/api")) {
      let logLine = `${req.method} ${path8} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await initStorage();
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  console.log("NODE_ENV =", process.env.NODE_ENV);
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  console.log("NODE_ENV =", process.env.NODE_ENV);
  server.listen({
    port,
    host: "127.0.0.1",
    // Force IPv4
    reusePort: false
  }, () => {
    log(`serving on port ${port}`);
  });
})();
