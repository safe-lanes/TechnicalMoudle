import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Master registry of tenants — multi-tenant mode only.
 *
 * Lives in the MASTER database (MASTER_DATABASE_URL), NOT in any tenant or the
 * single/default database. All tenant databases share the master server's host
 * and credentials (parsed from MASTER_DATABASE_URL) — only `database_name`
 * varies per tenant. No per-tenant URL or credentials are stored here (security:
 * nothing queryable that grants DB access; simplicity: one credential set in env).
 *
 * This schema is separate from shared/schema.ts and is only ever touched by the
 * tenant connection manager + the master migration. When MASTER_DATABASE_URL is
 * unset it is never imported on the live path.
 */
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  tuid: text("tuid").notNull(),
  databaseName: text("database_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
