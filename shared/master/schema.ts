import { pgTable, serial, text, boolean, timestamp, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  // Chatbot (Stage A): per-tenant AI assistant on/off. Default true = current behavior
  // preserved (chatbot works today); disable specific tenants as needed. Checked before
  // any LLM call so a disabled tenant incurs no LLM cost.
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

/**
 * Central chatbot interaction log (Stage A). ONE Safe-Lanes ops table, tenant-tagged
 * via `tuid`, so the internal admin (Stage C) gets a cross-tenant view + per-tenant
 * cost roll-up (GROUP BY tuid) from a single place. In multi-tenant mode this lives in
 * the MASTER database; in single-tenant mode (no master DB) the same table is created in
 * the single/default database and `tuid` is null. NEVER written into individual tenant
 * DBs. Rows are written fire-and-forget AFTER the chat response is sent — admin-only store.
 */
export const chatbotInteractions = pgTable("chatbot_interactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tuid: text("tuid"),                       // tenant tag (null in single-tenant)
  domain: text("domain"),
  userId: text("user_id"),
  userName: text("user_name"),
  userRole: text("user_role"),
  vesselId: text("vessel_id"),
  conversationId: text("conversation_id"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),         // FULL answer the user saw (admin-only store)
  toolsUsed: jsonb("tools_used"),
  docsRetrieved: jsonb("docs_retrieved"),   // null until RAG (Stage B)
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  latencyMs: integer("latency_ms"),
  model: text("model"),
  provider: text("provider"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatbotInteraction = typeof chatbotInteractions.$inferSelect;
export type InsertChatbotInteraction = typeof chatbotInteractions.$inferInsert;

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
