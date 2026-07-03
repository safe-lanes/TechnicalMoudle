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

/**
 * Ship-instance -> domain map (multi-tenant mode only). Lives in the MASTER database.
 *
 * Phase 4: shore recovers the incoming ship's instance id (batch.initiatedByInstance)
 * and resolves the owning tenant `domain` here, to validate the ship-declared
 * X-Sync-Domain against the map it owns. Keyed on instance_id (the wire identity).
 * Populated at provisioning (4a); enforcement/validation is Phase 4b.
 */
export const tenantInstances = pgTable("tenant_instances", {
  instanceId: text("instance_id").primaryKey(),
  vesselId: text("vessel_id"),
  domain: text("domain").notNull(),
  // Phase 4b: per-tenant sync key, validated shore-side at the MASTER level before
  // any tenant DB is opened (fail-closed front door). Set at onboarding alongside domain.
  syncApiKey: text("sync_api_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenantInstanceSchema = createInsertSchema(tenantInstances).omit({ createdAt: true, updatedAt: true });
export type InsertTenantInstance = z.infer<typeof insertTenantInstanceSchema>;
export type TenantInstance = typeof tenantInstances.$inferSelect;
