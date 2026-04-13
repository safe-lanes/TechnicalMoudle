ALTER TABLE "work_orders" ADD COLUMN "assigned_to_rank_id" text;--> statement-breakpoint
UPDATE "work_orders" SET "assigned_to_rank_id" = r."rank_id"
FROM "adm_available_ranks" r
WHERE LOWER(TRIM("work_orders"."assigned_to")) = LOWER(TRIM(r."name"))
AND "work_orders"."assigned_to" IS NOT NULL
AND "work_orders"."assigned_to_rank_id" IS NULL;