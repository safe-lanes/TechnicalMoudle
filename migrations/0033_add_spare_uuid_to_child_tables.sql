-- Phase 2a: Add spare_uuid to 4 core child tables with FK constraints to spares(suuid)
-- Uses parallel identity column approach: keep integer spare_id during transition

-- =============================================
-- 1. spares_history
-- =============================================
ALTER TABLE "spares_history" ADD COLUMN "spare_uuid" TEXT;

UPDATE "spares_history" sh
SET "spare_uuid" = s."suuid"
FROM "spares" s
WHERE sh."spare_id" = s."id";

-- spares_history has 0 rows currently, but make NOT NULL for future inserts
ALTER TABLE "spares_history" ALTER COLUMN "spare_uuid" SET NOT NULL;

ALTER TABLE "spares_history" ADD CONSTRAINT "spares_history_spare_uuid_spares_suuid_fk"
  FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;

-- =============================================
-- 2. spare_component_links
-- =============================================
ALTER TABLE "spare_component_links" ADD COLUMN "spare_uuid" TEXT;

UPDATE "spare_component_links" scl
SET "spare_uuid" = s."suuid"
FROM "spares" s
WHERE scl."spare_id" = s."id";

ALTER TABLE "spare_component_links" ALTER COLUMN "spare_uuid" SET NOT NULL;

ALTER TABLE "spare_component_links" ADD CONSTRAINT "spare_component_links_spare_uuid_spares_suuid_fk"
  FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;

-- =============================================
-- 3. spare_location_stock
-- =============================================
ALTER TABLE "spare_location_stock" ADD COLUMN "spare_uuid" TEXT;

UPDATE "spare_location_stock" sls
SET "spare_uuid" = s."suuid"
FROM "spares" s
WHERE sls."spare_id" = s."id";

ALTER TABLE "spare_location_stock" ALTER COLUMN "spare_uuid" SET NOT NULL;

ALTER TABLE "spare_location_stock" ADD CONSTRAINT "spare_location_stock_spare_uuid_spares_suuid_fk"
  FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;

-- =============================================
-- 4. inventory_transactions
-- =============================================
ALTER TABLE "inventory_transactions" ADD COLUMN "spare_uuid" TEXT;

UPDATE "inventory_transactions" it
SET "spare_uuid" = s."suuid"
FROM "spares" s
WHERE it."spare_id" = s."id";

ALTER TABLE "inventory_transactions" ALTER COLUMN "spare_uuid" SET NOT NULL;

ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_spare_uuid_spares_suuid_fk"
  FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;
