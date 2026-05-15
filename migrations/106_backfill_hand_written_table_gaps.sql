-- Migration 106: Backfill columns missing on hand-written tables (fresh DB only)
--
-- Tables created by hand-written SQL files (016-084) sort AFTER the Drizzle
-- SQL files (0051-0056) that try to ALTER them. On fresh databases, the ALTER
-- statements get skipped (42P01 — table doesn't exist yet), and the hand-
-- written CREATE TABLE doesn't include those columns. This migration fills
-- the gap. All statements are idempotent via IF NOT EXISTS.
--
-- Also covers inline-only columns (080/081) for tables created by 0043.

-- ═══════════════════════════════════════════════════════════════════════════════
-- adm_available_ranks: view_mode (inline migration 080, skipped on fresh DB)
-- adm_vessel_org_chart: rank_view (inline migration 081, skipped on fresh DB)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "adm_available_ranks" ADD COLUMN IF NOT EXISTS "view_mode" text;--> statement-breakpoint
ALTER TABLE "adm_vessel_org_chart" ADD COLUMN IF NOT EXISTS "rank_view" text;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- nr_* tables: sort_order (Drizzle 0053 skipped, inline 090 skipped)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "nr_noon_reports" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_fuel_rob" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_voyage_legs" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_bunker_records" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_cii_tracking" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_alerts" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint

-- nr_alerts: updated_at (Drizzle 0056 skipped because 023 creates table later)
ALTER TABLE "nr_alerts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- alert_acknowledgements: 6 audit/sync columns
-- 084 creates the table with only (id, aauuid, event_uuid, user_id, user_role,
-- comments, created_at). Drizzle schema also expects updated_at, is_sync,
-- created_by_uuid, updated_by_uuid, is_deleted, sort_order.
-- Drizzle 0056 (updated_at) and inline 091 (5 audit cols) both get skipped.
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
