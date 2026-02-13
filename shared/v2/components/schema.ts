import { pgTable, text, integer, boolean, timestamp, decimal, index, json, unique, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { vessels } from "../../schema";

export const v2Components = pgTable("components", {
  id: serial("id").primaryKey(),
  cuuid: text("cuuid").notNull().unique(),
  fleetEquipmentCode: text("fleet_equipment_code"),
  fleetEquipmentName: text("fleet_equipment_name"),
  parentId: text("parent_id"),
  componentCode: text("component_code"),
  name: text("name"),
  componentCategory: text("component_category"),
  maker: text("maker"),
  makerCode: text("maker_code"),
  model: text("model"),
  modelCode: text("model_code"),
  serialNo: text("serial_no"),
  drawingNo: text("drawing_no"),
  location: text("location"),
  critical: boolean("critical").default(false),
  conditionBased: boolean("condition_based").default(false),
  installationDate: text("installation_date"),
  commissionedDate: text("commissioned_date"),
  rating: text("rating"),
  eqptSystemDept: text("eqpt_system_dept"),
  isActive: boolean("is_active").default(true),
  isParent: boolean("is_parent").default(false),
  notes: text("notes"),
  vesselId: text("vessel_id"),
  dataScope: text("data_scope").notNull().default("vessel"),
  parentFleetEquipmentCode: text("parent_fleet_equipment_code"),
  modelNumber: text("model_number"),
  department: text("department"),
  deptCategory: text("dept_category"),
  category: text("category"),
  classItem: boolean("class_item").default(false),
  noOfUnits: text("no_of_units"),
  parentComponent: text("parent_component"),
  dimensionsSize: text("dimensions_size"),
  runningHours: decimal("running_hours", { precision: 10, scale: 2 }),
  currentCumulativeRH: decimal("current_cumulative_rh", { precision: 10, scale: 2 }).notNull().default("0"),
  lastUpdated: text("last_updated"),
  applicableVesselIds: text("applicable_vessel_ids").array(),
  scopeNotes: text("scope_notes"),
  rhCounterType: text("rh_counter_type").notNull().default("NOT_RH_DRIVEN"),
  rhCounterSource: text("rh_counter_source"),
  rhMasterComponentId: text("rh_master_component_id"),
  rhCurrentMaster: decimal("rh_current_master", { precision: 10, scale: 2 }),
  rhMasterUpdatedAt: timestamp("rh_master_updated_at"),
  rhMasterUpdatedBy: text("rh_master_updated_by"),
  rhMasterUpdateSource: text("rh_master_update_source"),
  rhCurrentInheritedCached: decimal("rh_current_inherited_cached", { precision: 10, scale: 2 }),
  rhInheritedUpdatedAt: timestamp("rh_inherited_updated_at"),
  meterReplacedDate: timestamp("meter_replaced_date"),
  meterReplacedLastRh: decimal("meter_replaced_last_rh", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  dataScopeIdx: index("idx_comp_data_scope").on(table.dataScope),
  fleetTreeIdx: index("idx_comp_fleet_tree").on(table.dataScope, table.parentFleetEquipmentCode),
  vesselTreeIdx: index("idx_comp_vessel_tree").on(table.dataScope, table.vesselId, table.parentId),
  fleetEquipmentCodeIdx: index("idx_comp_fleet_equipment_code").on(table.fleetEquipmentCode),
  rhMasterIdx: index("idx_comp_rh_master").on(table.rhCounterType, table.vesselId),
  rhInheritedIdx: index("idx_comp_rh_inherited").on(table.rhMasterComponentId),
}));

export const insertComponentSchema = createInsertSchema(v2Components).omit({
  id: true,
  cuuid: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type Component = typeof v2Components.$inferSelect;

export const v2ComponentDocuments = pgTable("component_documents", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull().references(() => v2Components.cuuid, { onDelete: "restrict", onUpdate: "cascade" }),
  componentCode: text("component_code").notNull(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  fleetEquipmentCode: text("fleet_equipment_code"),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  version: text("version").notNull().default("1.0"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  canShipView: boolean("can_ship_view").notNull().default(true),
  canShipDownload: boolean("can_ship_download").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  storageBackend: text("storage_backend").default("object"),
}, (table) => ({
  componentIdIdx: index("idx_doc_component_id").on(table.componentId),
  componentCodeIdx: index("idx_doc_component_code").on(table.componentCode),
  vesselIdIdx: index("idx_doc_vessel_id").on(table.vesselId),
  fleetEquipmentCodeIdx: index("idx_doc_fleet_equipment_code").on(table.fleetEquipmentCode),
  fileTypeIdx: index("idx_doc_file_type").on(table.fileType),
}));

export const insertComponentDocumentSchema = createInsertSchema(v2ComponentDocuments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertComponentDocument = z.infer<typeof insertComponentDocumentSchema>;
export type ComponentDocument = typeof v2ComponentDocuments.$inferSelect;

export const v2ComponentClassRegulatory = pgTable("component_class_regulatory", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull().references(() => v2Components.cuuid, { onDelete: "restrict", onUpdate: "cascade" }),
  componentCode: text("component_code").notNull(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  classificationSociety: text("classification_society").notNull(),
  surveyType: text("survey_type").notNull(),
  certificateNumber: text("certificate_number"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  lastClassSurvey: text("last_class_survey"),
  nextSurveyDue: text("next_survey_due"),
  classRequirements: text("class_requirements"),
  surveyStatus: text("survey_status").notNull().default("Active"),
  remarks: text("remarks"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  componentIdIdx: index("idx_class_component_id").on(table.componentId),
  componentCodeIdx: index("idx_class_component_code").on(table.componentCode),
  vesselIdIdx: index("idx_class_vessel_id").on(table.vesselId),
  surveyTypeIdx: index("idx_class_survey_type").on(table.surveyType),
  expiryDateIdx: index("idx_class_expiry_date").on(table.expiryDate),
}));

export const insertComponentClassRegulatorySchema = createInsertSchema(v2ComponentClassRegulatory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComponentClassRegulatory = z.infer<typeof insertComponentClassRegulatorySchema>;
export type ComponentClassRegulatory = typeof v2ComponentClassRegulatory.$inferSelect;

export const v2ComponentMaintenanceHistory = pgTable("component_maintenance_history", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentId: text("component_id").notNull().references(() => v2Components.cuuid, { onDelete: "restrict", onUpdate: "cascade" }),
  componentCode: text("component_code").notNull(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  jobId: text("job_id"),
  jobCode: text("job_code"),
  workOrderId: text("work_order_id").notNull(),
  workOrderNo: text("work_order_no").notNull(),
  jobTitle: text("job_title").notNull(),
  maintenanceType: text("maintenance_type").notNull(),
  dateCompleted: text("date_completed").notNull(),
  runningHoursAtCompletion: decimal("running_hours_at_completion", { precision: 10, scale: 2 }),
  performedBy: text("performed_by").notNull(),
  approvedBy: text("approved_by"),
  approvalDate: text("approval_date"),
  status: text("status").notNull().default("Approved"),
  workDescription: text("work_description"),
  sparesUsed: json("spares_used"),
  remarks: text("remarks"),
  isComponentReplaced: boolean("is_component_replaced").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  componentIdIdx: index("idx_history_component_id").on(table.componentId),
  componentCodeIdx: index("idx_history_component_code").on(table.componentCode),
  vesselIdIdx: index("idx_history_vessel_id").on(table.vesselId),
  jobIdIdx: index("idx_history_job_id").on(table.jobId),
  jobCodeIdx: index("idx_history_job_code").on(table.jobCode),
  workOrderIdIdx: index("idx_history_work_order_id").on(table.workOrderId),
  dateCompletedIdx: index("idx_history_date_completed").on(table.dateCompleted),
}));

export const insertComponentMaintenanceHistorySchema = createInsertSchema(v2ComponentMaintenanceHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertComponentMaintenanceHistory = z.infer<typeof insertComponentMaintenanceHistorySchema>;
export type ComponentMaintenanceHistory = typeof v2ComponentMaintenanceHistory.$inferSelect;

export const v2ComponentRequisitions = pgTable("component_requisitions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  requisitionNo: text("requisition_no").notNull().unique(),
  componentId: text("component_id").notNull().references(() => v2Components.cuuid, { onDelete: "restrict", onUpdate: "cascade" }),
  componentCode: text("component_code").notNull(),
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  raisedOn: text("raised_on").notNull(),
  itemOrService: text("item_or_service").notNull(),
  relatedPartCode: text("related_part_code"),
  relatedPartName: text("related_part_name"),
  quantity: integer("quantity").notNull().default(1),
  uom: text("uom").default("EA"),
  status: text("status").notNull().default("Draft"),
  priority: text("priority").notNull().default("Normal"),
  requestedBy: text("requested_by").notNull(),
  approvedBy: text("approved_by"),
  approvalDate: text("approval_date"),
  purchaseOrderNo: text("purchase_order_no"),
  expectedDelivery: text("expected_delivery"),
  actualDelivery: text("actual_delivery"),
  supplier: text("supplier"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  componentIdIdx: index("idx_req_component_id").on(table.componentId),
  componentCodeIdx: index("idx_req_component_code").on(table.componentCode),
  vesselIdIdx: index("idx_req_vessel_id").on(table.vesselId),
  statusIdx: index("idx_req_status").on(table.status),
  requisitionNoIdx: index("idx_req_no").on(table.requisitionNo),
}));

export const insertComponentRequisitionSchema = createInsertSchema(v2ComponentRequisitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComponentRequisition = z.infer<typeof insertComponentRequisitionSchema>;
export type ComponentRequisition = typeof v2ComponentRequisitions.$inferSelect;

export const v2Jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id"),
  componentId: text("component_id").notNull().references(() => v2Components.cuuid, { onDelete: "restrict", onUpdate: "cascade" }),
  componentCode: text("component_code"),
  componentName: text("component_name"),
  jobNo: text("job_no").notNull(),
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to"),
  maintenanceType: text("maintenance_type"),
  maintenanceBasis: text("maintenance_basis"),
  frequencyType: text("frequency_type"),
  frequencyValue: text("frequency_value"),
  frequencyUnit: text("frequency_unit"),
  intervalRunningHour: integer("interval_running_hour"),
  leadTimeValue: integer("lead_time_value"),
  leadTimeUnit: text("lead_time_unit"),
  initialNextDue: text("initial_next_due"),
  lastDoneDate: text("last_done_date"),
  nextDueDate: text("next_due_date"),
  lastDoneRH: text("last_done_rh"),
  nextDueRH: text("next_due_rh"),
  jobPriority: text("job_priority"),
  classRelated: text("class_related"),
  briefWorkDescription: text("brief_work_description"),
  jobDescription: text("job_description"),
  approver: text("approver"),
  department: text("department"),
  requiredSpareParts: json("required_spare_parts").notNull().default([]),
  requiredTools: json("required_tools").notNull().default([]),
  safetyRequirements: json("safety_requirements").notNull().default({ppeRequirements: [], permitRequirements: [], otherRequirements: []}),
  dataScope: text("data_scope").notNull().default("vessel"),
  fleetEquipmentCode: text("fleet_equipment_code"),
  fleetJobCode: text("fleet_job_code"),
  sfiCode: text("sfi_code"),
  criticality: text("criticality"),
  isActive: boolean("is_active").default(true),
  estimatedManHours: decimal("estimated_man_hours", { precision: 6, scale: 2 }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vesselIdIdx: index("idx_job_vessel").on(table.vesselId),
  componentIdIdx: index("idx_job_component").on(table.componentId),
  componentCodeIdx: index("idx_job_component_code").on(table.componentCode),
  dataScopeIdx: index("idx_job_data_scope").on(table.dataScope),
  nextDueDateIdx: index("idx_job_next_due").on(table.nextDueDate),
}));

export const v2JobComponentLinks = pgTable("job_component_links", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  jobId: text("job_id").notNull(),
  componentId: text("component_id").notNull().references(() => v2Components.cuuid, { onDelete: "restrict", onUpdate: "cascade" }),
  componentCode: text("component_code"),
  linkedBy: text("linked_by").notNull(),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  lastDoneDate: text("last_done_date"),
  nextDueDate: text("next_due_date"),
  lastDoneRH: text("last_done_rh"),
  nextDueRH: text("next_due_rh"),
  updatedAt: timestamp("updated_at"),
}, (table) => ({
  jobIdIdx: index("idx_job_component_link_job").on(table.jobId),
  componentIdIdx: index("idx_job_component_link_component").on(table.componentId),
  vesselIdIdx: index("idx_job_component_link_vessel").on(table.vesselId),
  uniqueJobComponent: unique("unique_job_component_link").on(table.jobId, table.componentId),
}));
