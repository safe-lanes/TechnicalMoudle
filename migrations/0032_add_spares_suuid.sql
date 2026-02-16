-- Phase 1: Add suuid column to spares table
-- Pattern follows vessel (vuuid), component (cuuid), jobs (juuid), work orders (wouuid)

-- Step 1: Add column as nullable
ALTER TABLE "spares" ADD COLUMN "suuid" TEXT;

-- Step 2: Backfill existing rows with UUIDs
UPDATE "spares" SET "suuid" = gen_random_uuid()::text WHERE "suuid" IS NULL;

-- Step 3: Make NOT NULL
ALTER TABLE "spares" ALTER COLUMN "suuid" SET NOT NULL;

-- Step 4: Add UNIQUE constraint
ALTER TABLE "spares" ADD CONSTRAINT "spares_suuid_unique" UNIQUE("suuid");
