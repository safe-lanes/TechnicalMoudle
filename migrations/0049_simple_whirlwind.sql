UPDATE "ship_certificates_labels_config" SET "updated_at" = now() WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "ship_certificates_labels_config" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
UPDATE "ship_surveys_labels_config" SET "updated_at" = now() WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "ship_surveys_labels_config" ALTER COLUMN "updated_at" SET NOT NULL;
