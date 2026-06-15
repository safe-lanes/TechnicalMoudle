-- Migration 0025c: Backfill feature columns that only exist in inline migrations
-- On fresh databases, inline migrations (server/migrations.ts) get skipped because
-- they ALTER TABLE on tables that don't exist yet (tables are created by SQL files
-- which run AFTER inlines). This migration adds all those missing feature columns
-- to tables from the 0000 baseline so fresh DBs match existing DBs.
-- All statements are idempotent via IF NOT EXISTS.

-- ═══════════════════════════════════════════════════════════════════════════════
-- work_orders: 17 feature columns (from inline migrations 053, 055, 057, 062, 063)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Inline 053: Skipped-cycle detection columns
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "missed_cycles" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "original_due_date" text;--> statement-breakpoint

-- Inline 055: CE justification for late completions
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "skipped_cycles_justification" text;--> statement-breakpoint

-- Inline 057: Layer 5 approval tier columns
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "days_late" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "approval_tier" text DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "superintendent_acknowledged" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "superintendent_acknowledged_at" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "superintendent_notified_at" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "ce_approval_remarks" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "approval_block_reason" text;--> statement-breakpoint

-- Inline 062: Layer 7 RH snapshot isolation — completion columns
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "completion_rh" numeric(10,2);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "completion_rh_validated" boolean;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "completion_rh_source" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "completion_rh_validation_details" jsonb;--> statement-breakpoint

-- Inline 063: Layer 7 RH justification columns
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "rh_justification" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "rh_justification_provided_by" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "rh_justification_date" timestamp;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- component_maintenance_history: 5 columns (from inline migration 054)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "component_maintenance_history" ADD COLUMN IF NOT EXISTS "missed_cycles" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD COLUMN IF NOT EXISTS "original_due_date" text;--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD COLUMN IF NOT EXISTS "is_skipped" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD COLUMN IF NOT EXISTS "skipped_cycle_date" text;--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD COLUMN IF NOT EXISTS "source_work_order_id" text;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- Spare child FK columns (from inline migrations 039, 041)
-- On fresh DB we add the column only; population and FK constraints are handled
-- by the application layer when new records are created.
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "spares_history" ADD COLUMN IF NOT EXISTS "spare_uuid" text;--> statement-breakpoint
ALTER TABLE "spare_component_links" ADD COLUMN IF NOT EXISTS "spare_uuid" text;--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD COLUMN IF NOT EXISTS "spare_uuid" text;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "spare_uuid" text;--> statement-breakpoint
ALTER TABLE "stores_ledger" ADD COLUMN IF NOT EXISTS "store_uuid" text;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- defects: target_date_extended (from inline migration ~032)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "defects" ADD COLUMN IF NOT EXISTS "target_date_extended" boolean DEFAULT false;
