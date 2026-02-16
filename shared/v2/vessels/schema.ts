import { pgTable, text, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const v2Vessels = pgTable("vessels", {
  id: serial("id").primaryKey(),
  vuuid: text("vuuid").notNull().unique(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  fleetId: text("fleet_id"),
  imoNumber: text("imo_number"),
  vesselType: text("vessel_type"),
  flag: text("flag"),
  vesselSequence: integer("vessel_sequence"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const v2Fleets = pgTable("fleets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVesselSchema = createInsertSchema(v2Vessels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Vessel = typeof v2Vessels.$inferSelect;
export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type Fleet = typeof v2Fleets.$inferSelect;
