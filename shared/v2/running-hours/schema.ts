import { pgTable, text, integer, boolean, timestamp, decimal, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { v2Components, type Component } from "../components/schema";

export const v2RunningHoursAudit = pgTable("running_hours_audit", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  vesselIdInt: integer("vessel_id_int"),
  componentId: text("component_id").notNull(),
  previousRH: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
  newRH: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
  cumulativeRH: decimal("cumulative_rh", { precision: 10, scale: 2 }).notNull(),
  dateUpdatedLocal: text("date_updated_local").notNull(),
  dateUpdatedTZ: text("date_updated_tz").notNull(),
  enteredAtUTC: timestamp("entered_at_utc").notNull(),
  userId: text("user_id").notNull(),
  source: text("source").notNull(),
  notes: text("notes"),
  meterReplaced: boolean("meter_replaced").notNull().default(false),
  oldMeterFinal: decimal("old_meter_final", { precision: 10, scale: 2 }),
  newMeterStart: decimal("new_meter_start", { precision: 10, scale: 2 }),
  version: integer("version").notNull().default(1),
  isRenewalReset: boolean("is_renewal_reset").notNull().default(false),
  renewalActionType: text("renewal_action_type"),
  renewalReason: text("renewal_reason"),
  renewalReference: text("renewal_reference"),
  renewalEvidenceUrls: json("renewal_evidence_urls"),
  componentCode: text("component_code"),
  componentName: text("component_name"),
}, (table) => ({
  componentIdIdx: index("idx_component_entered").on(table.componentId, table.enteredAtUTC),
  componentDateIdx: index("idx_component_date").on(table.componentId, table.dateUpdatedLocal),
  renewalResetIdx: index("idx_renewal_reset").on(table.isRenewalReset, table.vesselId),
}));

export const insertRunningHoursAuditSchema = createInsertSchema(v2RunningHoursAudit).omit({
  id: true,
});

export type InsertRunningHoursAudit = z.infer<typeof insertRunningHoursAuditSchema>;
export type RunningHoursAudit = typeof v2RunningHoursAudit.$inferSelect;

export const v2ComponentRunningHoursLog = pgTable("component_running_hours_log", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselCode: text("vessel_code").notNull(),
  componentCode: text("component_code").notNull(),
  componentId: text("component_id").notNull(),
  previousRh: decimal("previous_rh", { precision: 10, scale: 2 }).notNull(),
  newRh: decimal("new_rh", { precision: 10, scale: 2 }).notNull(),
  deltaRh: decimal("delta_rh", { precision: 10, scale: 2 }).notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updateSource: text("update_source").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  componentCodeIdx: index("idx_rh_log_component_code").on(table.componentCode),
  vesselCodeIdx: index("idx_rh_log_vessel_code").on(table.vesselCode),
  updatedAtIdx: index("idx_rh_log_updated_at").on(table.updatedAt),
  updateSourceIdx: index("idx_rh_log_update_source").on(table.updateSource),
}));

export const insertComponentRunningHoursLogSchema = createInsertSchema(v2ComponentRunningHoursLog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComponentRunningHoursLog = z.infer<typeof insertComponentRunningHoursLogSchema>;
export type ComponentRunningHoursLog = typeof v2ComponentRunningHoursLog.$inferSelect;

export const RENEWAL_ACTION_TYPES = ['Renewed', 'Replaced', 'Overhauled'] as const;
