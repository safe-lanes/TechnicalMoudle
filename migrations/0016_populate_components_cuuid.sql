UPDATE "components" SET "cuuid" = gen_random_uuid()::text WHERE "cuuid" IS NULL;
--> statement-breakpoint
ALTER TABLE "components" ALTER COLUMN "cuuid" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_cuuid_unique" UNIQUE("cuuid");
