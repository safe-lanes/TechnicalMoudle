-- Phase: Convert jobs.id from TEXT to INTEGER auto-increment
-- Safe because: All 4 FK constraints reference jobs(juuid), NOT jobs(id)
-- All server/frontend code uses jobs.juuid for UUID lookups (juuid migration complete)
-- Pattern follows vessels migration 0014 and components migration 0022

-- Step 1: Drop primary key constraint on old TEXT id column
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_pkey";--> statement-breakpoint

-- Step 2: Drop the old TEXT id column (no longer referenced by any FK or code)
ALTER TABLE "jobs" DROP COLUMN "id";--> statement-breakpoint

-- Step 3: Add new SERIAL id column as primary key
ALTER TABLE "jobs" ADD COLUMN "id" SERIAL PRIMARY KEY;
