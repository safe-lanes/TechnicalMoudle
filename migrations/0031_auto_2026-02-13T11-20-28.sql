-- Phase: Convert work_orders.id from TEXT to INTEGER auto-increment
-- Safe because: All 4 FK constraints reference work_orders(wouuid), NOT work_orders(id)
-- All server/frontend code uses work_orders.wouuid for UUID lookups (wouuid migration complete)
-- Pattern follows vessels migration 0014, components migration 0022, and jobs migration 0027

-- Step 1: Drop primary key constraint on old TEXT id column
ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_pkey";--> statement-breakpoint

-- Step 2: Drop the old TEXT id column (no longer referenced by any FK or code)
ALTER TABLE "work_orders" DROP COLUMN "id";--> statement-breakpoint

-- Step 3: Add new SERIAL id column as primary key
ALTER TABLE "work_orders" ADD COLUMN "id" SERIAL PRIMARY KEY;
