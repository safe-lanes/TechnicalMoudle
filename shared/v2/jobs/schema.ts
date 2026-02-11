import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
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
