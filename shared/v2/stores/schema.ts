import { pgTable, text, integer, decimal, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const v2StoresItems = pgTable("stores_items", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  itemType: text("item_type").notNull(),
  itemCode: text("item_code").notNull(),
  impaCode: text("impa_code"),
  itemName: text("item_name").notNull(),
  category: text("category"),
  specification: text("specification"),
  uom: text("uom"),
  rob: decimal("rob", { precision: 10, scale: 2 }).notNull().default("0"),
  robLocationA: decimal("rob_location_a", { precision: 10, scale: 2 }).notNull().default("0"),
  robLocationB: decimal("rob_location_b", { precision: 10, scale: 2 }).notNull().default("0"),
  locationA: text("location_a"),
  locationB: text("location_b"),
  min: decimal("min", { precision: 10, scale: 2 }).notNull().default("0"),
  max: decimal("max", { precision: 10, scale: 2 }),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  lastOrderDate: text("last_order_date"),
  leadTime: text("lead_time"),
  ihm: boolean("ihm").notNull().default(false),
  ihmDetails: text("ihm_details"),
  ihmPresence: text("ihm_presence").default("Unknown"),
  ihmEvidenceType: text("ihm_evidence_type").default("None"),
  remarks: text("remarks"),
  deleted: boolean("deleted").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vesselIdIdx: index("idx_stores_vessel").on(table.vesselId),
  itemTypeIdx: index("idx_stores_item_type").on(table.itemType),
  itemCodeIdx: index("idx_stores_item_code").on(table.vesselId, table.itemCode),
  impaCodeIdx: index("idx_stores_impa_code").on(table.impaCode),
  deletedIdx: index("idx_stores_deleted").on(table.deleted),
}));

export const v2InsertStoresItemSchema = createInsertSchema(v2StoresItems).omit({
  id: true,
  deleted: true,
  createdAt: true,
  updatedAt: true,
});

export type V2InsertStoresItem = z.infer<typeof v2InsertStoresItemSchema>;
export type V2StoresItem = typeof v2StoresItems.$inferSelect;

export const v2StoresLedger = pgTable("stores_ledger", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  vesselId: text("vessel_id").notNull(),
  section: text("section").notNull(),
  itemId: integer("item_id").notNull(),
  partCode: text("part_code").notNull(),
  itemName: text("item_name").notNull(),
  uom: text("uom"),
  eventType: text("event_type").notNull(),
  qtyChangeBase: decimal("qty_change_base", { precision: 10, scale: 2 }).notNull(),
  qtyDisplay: decimal("qty_display", { precision: 10, scale: 2 }).notNull(),
  uomDisplay: text("uom_display"),
  robAfterBase: decimal("rob_after_base", { precision: 10, scale: 2 }).notNull(),
  dateLocal: text("date_local").notNull(),
  tz: text("tz").notNull(),
  timestampUTC: timestamp("timestamp_utc").notNull(),
  place: text("place"),
  ref: text("ref"),
  userId: text("user_id").notNull(),
  remarks: text("remarks"),
}, (table) => ({
  vesselSectionDateIdx: index("idx_vessel_section_date").on(table.vesselId, table.section, table.dateLocal),
  itemDateIdx: index("idx_item_date").on(table.itemId, table.dateLocal),
}));

export const v2InsertStoresLedgerSchema = createInsertSchema(v2StoresLedger).omit({
  id: true,
});

export type V2InsertStoresLedger = z.infer<typeof v2InsertStoresLedgerSchema>;
export type V2StoresLedger = typeof v2StoresLedger.$inferSelect;
