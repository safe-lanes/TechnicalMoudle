import { pgTable, text, integer, boolean, decimal, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { v2Jobs, v2JobComponentLinks, v2ComponentMaintenanceHistory, v2Components } from "../components/schema";
export type { Component } from "../components/schema";

import { v2Jobs } from "../components/schema";
import { v2JobComponentLinks } from "../components/schema";

export const insertJobSchema = createInsertSchema(v2Jobs).omit({ createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof v2Jobs.$inferSelect;

export type JobComponentLink = typeof v2JobComponentLinks.$inferSelect;

export const v2WorkOrders = pgTable("work_orders", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id"),
  component: text("component").notNull(),
  componentCode: text("component_code"),
  jobId: text("job_id"),
  workOrderNo: text("work_order_no").notNull(),
  woExecutionId: text("wo_execution_id"),
  jobTitle: text("job_title").notNull(),
  assignedTo: text("assigned_to").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("Active"),
  dateCompleted: text("date_completed"),
  startDateTime: text("start_date_time"),
  completionDateTime: text("completion_date_time"),
  performedBy: text("performed_by"),
  workCarriedOut: text("work_carried_out"),
  remarks: text("remarks"),
  completionRemarks: text("completion_remarks"),
  jobExperienceNotes: text("job_experience_notes"),
  runningHours: decimal("running_hours", { precision: 10, scale: 2 }),
  formData: json("form_data"),
});

export type WorkOrder = typeof v2WorkOrders.$inferSelect;

export const v2Spares = pgTable("spares", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  partCode: text("part_code").notNull(),
  partName: text("part_name").notNull(),
  partNumber: text("part_number"),
  componentId: text("component_id"),
  rob: integer("rob").notNull().default(0),
  robLocationA: integer("rob_location_a").notNull().default(0),
  robLocationB: integer("rob_location_b").notNull().default(0),
  vesselId: text("vessel_id"),
  deleted: boolean("deleted").notNull().default(false),
});

export type Spare = typeof v2Spares.$inferSelect;
