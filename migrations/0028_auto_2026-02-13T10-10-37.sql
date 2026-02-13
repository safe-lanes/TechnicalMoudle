-- Phase: Add wouuid column to work_orders table
-- Safe backfill pattern: nullable → populate with gen_random_uuid() → NOT NULL → UNIQUE
-- Pattern follows jobs migration 0025 (juuid), components migration 0016-0017 (cuuid), vessels migration 0008 (vuuid)

-- Step 1: Add column as nullable first (safe for tables with existing rows)
ALTER TABLE "work_orders" ADD COLUMN "wouuid" text;--> statement-breakpoint

-- Step 2: Backfill existing rows with generated UUIDs
UPDATE "work_orders" SET "wouuid" = gen_random_uuid()::text WHERE "wouuid" IS NULL;--> statement-breakpoint

-- Step 3: Set NOT NULL constraint after all rows have values
ALTER TABLE "work_orders" ALTER COLUMN "wouuid" SET NOT NULL;--> statement-breakpoint

-- Step 4: Add UNIQUE constraint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_wouuid_unique" UNIQUE("wouuid");
