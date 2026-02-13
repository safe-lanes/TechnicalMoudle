-- Add juuid column to jobs table (canonical UUID identity column)
-- Safe backfill pattern: add nullable → populate → set NOT NULL → add UNIQUE

-- Step 1: Add column as nullable first (safe for tables with existing rows)
ALTER TABLE "jobs" ADD COLUMN "juuid" text;--> statement-breakpoint

-- Step 2: Backfill existing rows with generated UUIDs
UPDATE "jobs" SET "juuid" = gen_random_uuid()::text WHERE "juuid" IS NULL;--> statement-breakpoint

-- Step 3: Set NOT NULL constraint after all rows have values
ALTER TABLE "jobs" ALTER COLUMN "juuid" SET NOT NULL;--> statement-breakpoint

-- Step 4: Add UNIQUE constraint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_juuid_unique" UNIQUE("juuid");
