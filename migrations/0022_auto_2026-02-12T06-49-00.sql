-- Phase: Convert components.id from TEXT to INTEGER auto-increment
-- Safe because: All 15 FK constraints reference components(cuuid), NOT components(id)
-- All server/frontend code uses components.cuuid for UUID lookups (cuuid migration complete)
-- Pattern follows vessels migration 0014

-- Step 1: Drop primary key constraint on old TEXT id column
ALTER TABLE "components" DROP CONSTRAINT "components_pkey";--> statement-breakpoint

-- Step 2: Drop the old TEXT id column (no longer referenced by any FK or code)
ALTER TABLE "components" DROP COLUMN "id";--> statement-breakpoint

-- Step 3: Add new SERIAL id column as primary key
ALTER TABLE "components" ADD COLUMN "id" SERIAL PRIMARY KEY;
