-- Fix for orphaned ALTER from 0046_fine_mandroid.sql
-- The multi-statement batch aborted when CREATE TABLE IF NOT EXISTS master_list_types hit an already-existing table.
-- This migration re-applies only the ALTER TABLE + UPDATE that was lost.
-- Idempotent: safe to run even if column already exists.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "assigned_to_rank_id" text;

UPDATE "jobs" SET "assigned_to_rank_id" = r."rank_id"
FROM "adm_available_ranks" r
WHERE LOWER(TRIM("jobs"."assigned_to")) = LOWER(TRIM(r."name"))
AND "jobs"."assigned_to" IS NOT NULL
AND "jobs"."assigned_to_rank_id" IS NULL;
