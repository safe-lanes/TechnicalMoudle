-- ============================================================
-- Backfill UUID identity columns for fresh database installs
-- ============================================================
-- On existing databases, inline migrations (027-051 in server/migrations.ts)
-- already added these columns. This SQL migration ensures they also exist
-- on a FRESH database where those inline migrations get skipped (because
-- the tables don't exist yet when inline migrations run).
--
-- All statements are idempotent: IF NOT EXISTS / IF NOT EXISTS constraint.
-- On existing DBs this migration simply no-ops through every statement.
-- ============================================================

-- 1. vessels.vuuid
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "vuuid" text;--> statement-breakpoint
UPDATE "vessels" SET "vuuid" = gen_random_uuid()::text WHERE "vuuid" IS NULL;--> statement-breakpoint
DO $$ BEGIN BEGIN ALTER TABLE "vessels" ALTER COLUMN "vuuid" SET NOT NULL; EXCEPTION WHEN others THEN NULL; END; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessels_vuuid_unique') THEN ALTER TABLE "vessels" ADD CONSTRAINT "vessels_vuuid_unique" UNIQUE("vuuid"); END IF; END $$;--> statement-breakpoint

-- 2. components.cuuid
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "cuuid" text;--> statement-breakpoint
UPDATE "components" SET "cuuid" = gen_random_uuid()::text WHERE "cuuid" IS NULL;--> statement-breakpoint
DO $$ BEGIN BEGIN ALTER TABLE "components" ALTER COLUMN "cuuid" SET NOT NULL; EXCEPTION WHEN others THEN NULL; END; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'components_cuuid_unique') THEN ALTER TABLE "components" ADD CONSTRAINT "components_cuuid_unique" UNIQUE("cuuid"); END IF; END $$;--> statement-breakpoint

-- 3. jobs.juuid
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "juuid" text;--> statement-breakpoint
UPDATE "jobs" SET "juuid" = gen_random_uuid()::text WHERE "juuid" IS NULL;--> statement-breakpoint
DO $$ BEGIN BEGIN ALTER TABLE "jobs" ALTER COLUMN "juuid" SET NOT NULL; EXCEPTION WHEN others THEN NULL; END; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_juuid_unique') THEN ALTER TABLE "jobs" ADD CONSTRAINT "jobs_juuid_unique" UNIQUE("juuid"); END IF; END $$;--> statement-breakpoint

-- 4. work_orders.wouuid
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "wouuid" text;--> statement-breakpoint
UPDATE "work_orders" SET "wouuid" = gen_random_uuid()::text WHERE "wouuid" IS NULL;--> statement-breakpoint
DO $$ BEGIN BEGIN ALTER TABLE "work_orders" ALTER COLUMN "wouuid" SET NOT NULL; EXCEPTION WHEN others THEN NULL; END; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_wouuid_unique') THEN ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_wouuid_unique" UNIQUE("wouuid"); END IF; END $$;--> statement-breakpoint

-- 5. spares.suuid
ALTER TABLE "spares" ADD COLUMN IF NOT EXISTS "suuid" text;--> statement-breakpoint
UPDATE "spares" SET "suuid" = gen_random_uuid()::text WHERE "suuid" IS NULL;--> statement-breakpoint
DO $$ BEGIN BEGIN ALTER TABLE "spares" ALTER COLUMN "suuid" SET NOT NULL; EXCEPTION WHEN others THEN NULL; END; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_suuid_unique') THEN ALTER TABLE "spares" ADD CONSTRAINT "spares_suuid_unique" UNIQUE("suuid"); END IF; END $$;--> statement-breakpoint

-- 6. stores_items.stuuid
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "stuuid" text;--> statement-breakpoint
UPDATE "stores_items" SET "stuuid" = gen_random_uuid()::text WHERE "stuuid" IS NULL;--> statement-breakpoint
DO $$ BEGIN BEGIN ALTER TABLE "stores_items" ALTER COLUMN "stuuid" SET NOT NULL; EXCEPTION WHEN others THEN NULL; END; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_items_stuuid_unique') THEN ALTER TABLE "stores_items" ADD CONSTRAINT "stores_items_stuuid_unique" UNIQUE("stuuid"); END IF; END $$;--> statement-breakpoint

-- 7. defects.duuid
ALTER TABLE "defects" ADD COLUMN IF NOT EXISTS "duuid" text;--> statement-breakpoint
UPDATE "defects" SET "duuid" = gen_random_uuid()::text WHERE "duuid" IS NULL;--> statement-breakpoint
DO $$ BEGIN BEGIN ALTER TABLE "defects" ALTER COLUMN "duuid" SET NOT NULL; EXCEPTION WHEN others THEN NULL; END; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defects_duuid_unique') THEN ALTER TABLE "defects" ADD CONSTRAINT "defects_duuid_unique" UNIQUE("duuid"); END IF; END $$;