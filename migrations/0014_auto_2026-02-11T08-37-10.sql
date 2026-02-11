-- Phase 4: Convert vessels.id from TEXT to INTEGER auto-increment
-- Safe because: All 31 FK constraints reference vessels(vuuid), NOT vessels(id)
-- All server/frontend code uses vessels.vuuid for UUID lookups (Phase 3 complete)

-- Step 1: Drop primary key constraint on old TEXT id column
ALTER TABLE "vessels" DROP CONSTRAINT "vessels_pkey";--> statement-breakpoint

-- Step 2: Drop the old TEXT id column (no longer referenced by any FK or code)
ALTER TABLE "vessels" DROP COLUMN "id";--> statement-breakpoint

-- Step 3: Add new SERIAL id column as primary key
ALTER TABLE "vessels" ADD COLUMN "id" SERIAL PRIMARY KEY;--> statement-breakpoint

-- Step 4: Make vuuid NOT NULL (it's the canonical UUID identity column)
ALTER TABLE "vessels" ALTER COLUMN "vuuid" SET NOT NULL;
