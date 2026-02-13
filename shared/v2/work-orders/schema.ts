import { pgTable, text, integer, boolean, timestamp, decimal, index, json, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { v2Components, v2ComponentMaintenanceHistory, v2Jobs, v2JobComponentLinks } from "../components/schema";
import { v2Components, v2Jobs } from "../components/schema";
export type { Component, ComponentMaintenanceHistory, InsertComponentMaintenanceHistory } from "../components/schema";

export { v2Spares } from "../jobs/schema";
export type { Job, InsertJob, JobComponentLink, Spare } from "../jobs/schema";

export {
  v2SpareComponentLinks,
  v2Locations,
  v2SpareLocationStock,
  v2InventoryTransactions,
  insertLocationSchema,
  insertSpareLocationStockSchema,
  insertInventoryTransactionSchema,
} from "../spares/schema";
export type {
  SpareComponentLink,
  Location,
  InsertLocation,
  SpareLocationStock,
  InsertSpareLocationStock,
  InventoryTransaction,
  InsertInventoryTransaction,
} from "../spares/schema";

export const v2WorkOrders = pgTable("work_orders", {
  id: text("id").primaryKey(),
  wouuid: text("wouuid").notNull().unique(),
  vesselId: text("vessel_id"),
  component: text("component").notNull(),
  componentCode: text("component_code"),
  jobId: text("job_id").references(() => v2Jobs.juuid),
  workOrderNo: text("work_order_no").notNull(),
  workOrderType: text("work_order_type").notNull().default("Planned"),
  templateCode: text("template_code"),
  executionId: text("execution_id"),
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("Active"),
  dateCompleted: text("date_completed"),
  submittedDate: text("submitted_date"),
  formData: json("form_data"),
  taskType: text("task_type"),
  maintenanceType: text("maintenance_type"),
  maintenanceBasis: text("maintenance_basis"),
  frequencyValue: text("frequency_value"),
  frequencyUnit: text("frequency_unit"),
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
  jobPriority: text("job_priority"),
  briefWorkDescription: text("brief_work_description"),
  dataScope: text("data_scope").notNull().default("vessel"),
  fleetEquipmentCode: text("fleet_equipment_code"),
  fleetJobCode: text("fleet_job_code"),
  jobGroup: text("job_group"),
  jobCategory: text("job_category"),
  sfiCode: text("sfi_code"),
  maintenanceIntervalValue: integer("maintenance_interval_value"),
  maintenanceIntervalUnit: text("maintenance_interval_unit"),
  intervalRunningHour: integer("interval_running_hour"),
  department: text("department"),
  criticality: text("criticality"),
  isActive: boolean("is_active").default(true),
  applicableVesselIds: text("applicable_vessel_ids").array(),
  scopeNotes: text("scope_notes"),
  postponementEndDate: text("postponement_end_date"),
  postponementReason: text("postponement_reason"),
  postponementAuthorizedBy: text("postponement_authorized_by"),
  onDemandReason: text("on_demand_reason"),
  requiredSpareParts: json("required_spare_parts").notNull().default([]),
  requiredTools: json("required_tools").notNull().default([]),
  safetyRequirements: json("safety_requirements").notNull().default({ppeRequirements: [], permitRequirements: [], otherRequirements: []}),
  uploadedDocuments: json("uploaded_documents").notNull().default([]),
  consumedSpareParts: json("consumed_spare_parts").notNull().default([]),
  riskAssessmentStatus: text("risk_assessment_status"),
  safetyChecklistsStatus: text("safety_checklists_status"),
  operationalFormsStatus: text("operational_forms_status"),
  startDateTime: text("start_date_time"),
  completionDateTime: text("completion_date_time"),
  executionAssignedTo: text("execution_assigned_to"),
  performedBy: text("performed_by"),
  noOfPersons: text("no_of_persons"),
  totalTimeHours: text("total_time_hours"),
  manhours: text("manhours"),
  workCarriedOut: text("work_carried_out"),
  jobExperienceNotes: text("job_experience_notes"),
  previousReading: text("previous_reading"),
  runningHours: text("running_hours"),
  runningHoursDifference: text("running_hours_difference"),
  readingDate: text("reading_date"),
  woExecutionId: text("wo_execution_id"),
  remarks: text("remarks"),
  completionRemarks: text("completion_remarks"),
  rejectionComments: text("rejection_comments"),
  approvalAction: text("approval_action"),
  wasRejected: boolean("was_rejected").notNull().default(false),
  driverType: text("driver_type"),
  cycleDueRhSnapshot: decimal("cycle_due_rh_snapshot", { precision: 10, scale: 2 }),
  generateRhSnapshot: decimal("generate_rh_snapshot", { precision: 10, scale: 2 }),
  dueRhSnapshot: decimal("due_rh_snapshot", { precision: 10, scale: 2 }),
  effectiveRhAtGeneration: decimal("effective_rh_at_generation", { precision: 10, scale: 2 }),
  rhLastDoneSnapshot: decimal("rh_last_done_snapshot", { precision: 10, scale: 2 }),
  cycleDueDateSnapshot: text("cycle_due_date_snapshot"),
  generateDateSnapshot: text("generate_date_snapshot"),
  dueDateSnapshot: text("due_date_snapshot"),
  lastDoneDateSnapshot: text("last_done_date_snapshot"),
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
  fleetJobCodeUniqueIdx: unique("unique_fleet_job_code_vessel").on(table.fleetJobCode, table.dataScope, table.vesselId),
  jobIdCycleRhIdx: index("idx_wo_job_cycle_rh").on(table.jobId, table.cycleDueRhSnapshot),
  jobIdCycleDateIdx: index("idx_wo_job_cycle_date").on(table.jobId, table.cycleDueDateSnapshot),
}));

export const insertWorkOrderSchema = createInsertSchema(v2WorkOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  workOrderNo: z.string().optional(),
});

export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof v2WorkOrders.$inferSelect;

export const v2WorkOrderExecutions = pgTable("work_order_executions", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  componentId: text("component_id").notNull().references(() => v2Components.cuuid, { onDelete: "restrict", onUpdate: "cascade" }),
  vesselId: text("vessel_id").notNull(),
  executionId: text("execution_id").notNull().unique(),
  dateCompleted: text("date_completed"),
  runningHoursAtCompletion: decimal("running_hours_at_completion", { precision: 10, scale: 2 }),
  performedBy: text("performed_by"),
  approvedBy: text("approved_by"),
  status: text("status").notNull().default("In Progress"),
  uploadedDocuments: json("uploaded_documents").notNull().default([]),
  consumedSpareParts: json("consumed_spare_parts").notNull().default([]),
  workDescription: text("work_description"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  templateIdIdx: index("idx_exec_template").on(table.templateId),
  componentIdIdx: index("idx_exec_component").on(table.componentId),
  vesselIdIdx: index("idx_exec_vessel").on(table.vesselId),
  statusIdx: index("idx_exec_status").on(table.status),
  dateCompletedIdx: index("idx_exec_date_completed").on(table.dateCompleted),
}));

export const insertWorkOrderExecutionSchema = createInsertSchema(v2WorkOrderExecutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrderExecution = z.infer<typeof insertWorkOrderExecutionSchema>;
export type WorkOrderExecution = typeof v2WorkOrderExecutions.$inferSelect;

export const v2WorkOrderExecutionDetails = pgTable("work_order_execution_details", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  workOrderId: text("work_order_id").notNull(),
  vesselId: text("vessel_id").notNull(),
  executedBy: text("executed_by"),
  executedDate: text("executed_date"),
  completionNotes: text("completion_notes"),
  partsUsed: json("parts_used").$type<any[]>().default([]),
  toolsUsed: json("tools_used").$type<any[]>().default([]),
  laborHours: decimal("labor_hours", { precision: 6, scale: 2 }),
  findings: text("findings"),
  recommendations: text("recommendations"),
  nextActionRequired: text("next_action_required"),
  qualityCheckBy: text("quality_check_by"),
  qualityCheckDate: text("quality_check_date"),
  qualityCheckNotes: text("quality_check_notes"),
  attachments: json("attachments").$type<any[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  workOrderIdx: index("idx_exec_details_wo").on(table.workOrderId),
  vesselIdx: index("idx_exec_details_vessel").on(table.vesselId),
  executedDateIdx: index("idx_exec_details_date").on(table.executedDate),
}));

export const insertWorkOrderExecutionDetailsSchema = createInsertSchema(v2WorkOrderExecutionDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkOrderExecutionDetails = z.infer<typeof insertWorkOrderExecutionDetailsSchema>;
export type WorkOrderExecutionDetails = typeof v2WorkOrderExecutionDetails.$inferSelect;

export const v2PmsVesselSettings = pgTable("pms_vessel_settings", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull().unique(),
  calendarLeadDaysCritical: integer("calendar_lead_days_critical").notNull().default(7),
  calendarLeadDaysNonCritical: integer("calendar_lead_days_non_critical").notNull().default(14),
  calendarGraceMode: text("calendar_grace_mode").notNull().default("COMPANY_STANDARD"),
  calendarGraceDays: integer("calendar_grace_days").notNull().default(7),
  rhLeadHoursCritical: integer("rh_lead_hours_critical").notNull().default(50),
  rhLeadHoursNonCritical: integer("rh_lead_hours_non_critical").notNull().default(100),
  rhGraceHours: integer("rh_grace_hours").notNull().default(168),
  locationAName: text("location_a_name").notNull().default("Location A"),
  locationBName: text("location_b_name").notNull().default("Location B"),
  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vesselIdIdx: index("idx_pms_settings_vessel_id").on(table.vesselId),
}));

export type PmsVesselSettings = typeof v2PmsVesselSettings.$inferSelect;
