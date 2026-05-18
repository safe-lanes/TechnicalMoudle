ALTER TABLE "job_component_links" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
UPDATE "job_component_links" SET "updated_at" = COALESCE("linked_at", now()) WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "job_component_links" ALTER COLUMN "updated_at" SET NOT NULL;
