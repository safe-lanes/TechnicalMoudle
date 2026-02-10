import { pgTable, text, integer, boolean, timestamp, decimal, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { v2Components } from "../components/schema";
export type { Component } from "../components/schema";

export const v2Spares = pgTable("spares", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  partCode: text("part_code").notNull(),
  partName: text("part_name").notNull(),
  componentId: text("component_id"),
  componentCode: text("component_code"),
  componentName: text("component_name").notNull(),
  componentSpareCode: text("component_spare_code"),
  critical: text("critical").notNull(),
  rob: integer("rob").notNull().default(0),
  robLocationA: integer("rob_location_a").notNull().default(0),
  robLocationB: integer("rob_location_b").notNull().default(0),
  min: integer("min").notNull().default(0),
  max: integer("max"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  stockingNumber: text("stocking_number"),
  leadTime: text("lead_time"),
  supplier: text("supplier"),
  lastOrderDate: text("last_order_date"),
  location: text("location"),
  vesselId: text("vessel_id"),
  deleted: boolean("deleted").notNull().default(false),
  dataScope: text("data_scope").notNull().default("vessel"),
  fleetEquipmentCode: text("fleet_equipment_code"),
  fleetPartCode: text("fleet_part_code"),
  partNumber: text("part_number"),
  uom: text("uom"),
  drawingNumber: text("drawing_number"),
  drawingNo: text("drawing_no"),
  location2: text("location_2"),
  remarks: text("remarks"),
  unit: text("unit"),
  positionNumber: text("position_number"),
  note: text("note"),
  specification: text("specification"),
  maker: text("maker"),
  makerCode: text("maker_code"),
  model: text("model"),
  manualName: text("manual_name"),
  pageNumber: text("page_number"),
  criticality: text("criticality"),
  isActive: boolean("is_active").default(true),
  ihm: text("ihm"),
  ihmPresence: text("ihm_presence").default("UNKNOWN"),
  evidenceType: text("evidence_type"),
  partCategory: text("part_category"),
  applicableVesselIds: text("applicable_vessel_ids").array(),
  scopeNotes: text("scope_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
}, (table) => ({
  componentIdIdx: index("idx_spare_component").on(table.componentId),
  vesselIdIdx: index("idx_spare_vessel").on(table.vesselId),
  componentSpareCodeIdx: index("idx_spare_code").on(table.vesselId, table.componentSpareCode),
  dataScopeIdx: index("idx_spare_data_scope").on(table.dataScope),
  fleetEquipmentCodeIdx: index("idx_spare_fleet_equipment").on(table.dataScope, table.fleetEquipmentCode),
  fleetPartCodeUniqueIdx: unique("unique_fleet_part_code_vessel").on(table.fleetPartCode, table.dataScope, table.vesselId),
}));

export const insertSpareSchema = createInsertSchema(v2Spares).omit({
  id: true,
  deleted: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSpare = z.infer<typeof insertSpareSchema>;
export type Spare = typeof v2Spares.$inferSelect;

export const v2SparesHistory = pgTable("spares_history", {
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
  eventType: text("event_type").notNull(),
  qtyChange: integer("qty_change").notNull(),
  robAfter: integer("rob_after").notNull(),
  userId: text("user_id").notNull(),
  remarks: text("remarks"),
  reference: text("reference"),
  dateLocal: text("date_local"),
  tz: text("tz"),
  place: text("place"),
}, (table) => ({
  timestampIdx: index("idx_history_timestamp").on(table.timestampUTC),
  spareIdIdx: index("idx_history_spare").on(table.spareId),
  eventTypeIdx: index("idx_history_event").on(table.eventType),
}));

export const insertSpareHistorySchema = createInsertSchema(v2SparesHistory).omit({
  id: true,
});

export type InsertSpareHistory = z.infer<typeof insertSpareHistorySchema>;
export type SpareHistory = typeof v2SparesHistory.$inferSelect;

export const v2Locations = pgTable("locations", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Location = typeof v2Locations.$inferSelect;

export const v2SpareLocationStock = pgTable("spare_location_stock", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  spareId: integer("spare_id").notNull(),
  locationId: integer("location_id").notNull(),
  qty: integer("qty").notNull().default(0),
}, (table) => ({
  spareIdIdx: index("idx_spare_location_stock_spare").on(table.spareId),
  locationIdIdx: index("idx_spare_location_stock_location").on(table.locationId),
  vesselIdIdx: index("idx_spare_location_stock_vessel").on(table.vesselId),
  uniqueSpareLocation: unique("unique_spare_location_stock").on(table.spareId, table.locationId),
}));

export type SpareLocationStock = typeof v2SpareLocationStock.$inferSelect;

export const v2SpareComponentLinks = pgTable("spare_component_links", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  spareId: integer("spare_id").notNull(),
  componentId: text("component_id").notNull(),
  vesselId: text("vessel_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SpareComponentLink = typeof v2SpareComponentLinks.$inferSelect;

export const v2InventoryTransactions = pgTable("inventory_transactions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  spareId: integer("spare_id").notNull(),
  locationId: integer("location_id"),
  eventType: text("event_type").notNull(),
  qtyChange: integer("qty_change").notNull(),
  qtyBefore: integer("qty_before").notNull(),
  qtyAfter: integer("qty_after").notNull(),
  userId: text("user_id").notNull(),
  remarks: text("remarks"),
  reference: text("reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InventoryTransaction = typeof v2InventoryTransactions.$inferSelect;
