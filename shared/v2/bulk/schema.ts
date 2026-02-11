import { pgTable, text, integer, boolean, timestamp, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { v2Components } from "../components/schema";
export type { Component, InsertComponent } from "../components/schema";

export const v2MakerList = pgTable("maker_list", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  makerCode: text("maker_code").notNull().unique(),
  makerName: text("maker_name").notNull(),
  address: text("address"),
  addressId: text("address_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  makerCodeIdx: index("idx_maker_list_code").on(table.makerCode),
  makerNameIdx: index("idx_maker_list_name").on(table.makerName),
}));

export const insertMakerListSchema = createInsertSchema(v2MakerList).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMakerList = z.infer<typeof insertMakerListSchema>;
export type MakerList = typeof v2MakerList.$inferSelect;

export const v2ImportHistory = pgTable("import_history", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  mode: text("mode").notNull(),
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
  originalName: text("original_name"),
  fileSize: integer("file_size"),
  storedFilePath: text("stored_file_path"),
  undoneAt: timestamp("undone_at"),
  errorMessage: text("error_message"),
}, (table) => ({
  typeIdx: index("idx_import_history_type").on(table.type),
  startedAtIdx: index("idx_import_history_started").on(table.startedAt),
  vesselIdx: index("idx_import_history_vessel").on(table.vesselId),
}));

export const insertImportHistorySchema = createInsertSchema(v2ImportHistory).omit({
  startedAt: true,
});

export type InsertImportHistory = z.infer<typeof insertImportHistorySchema>;
export type ImportHistory = typeof v2ImportHistory.$inferSelect;

export const v2ImportChangeLog = pgTable("import_change_log", {
  id: text("id").primaryKey(),
  importHistoryId: text("import_history_id").notNull().references(() => v2ImportHistory.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  operation: text("operation").notNull(),
  previousData: json("previous_data"),
  newData: json("new_data"),
  checksum: text("checksum").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  importHistoryIdx: index("idx_change_log_import").on(table.importHistoryId),
  entityIdx: index("idx_change_log_entity").on(table.entityType, table.entityId),
}));

export const insertImportChangeLogSchema = createInsertSchema(v2ImportChangeLog).omit({
  createdAt: true,
});

export type InsertImportChangeLog = z.infer<typeof insertImportChangeLogSchema>;
export type ImportChangeLog = typeof v2ImportChangeLog.$inferSelect;

export const v2SfiDetails = pgTable("sfi_details", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  componentCode: text("component_code").notNull().unique(),
  componentName: text("component_name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  sfiCodeIdx: index("idx_sfi_component_code").on(table.componentCode),
}));

export const insertSfiDetailsSchema = createInsertSchema(v2SfiDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSfiDetails = z.infer<typeof insertSfiDetailsSchema>;
export type SfiDetails = typeof v2SfiDetails.$inferSelect;
