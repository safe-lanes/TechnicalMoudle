UPDATE "ship_certificates_labels_config" SET "updated_at" = now() WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "ship_certificates_labels_config" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
UPDATE "ship_surveys_labels_config" SET "updated_at" = now() WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "ship_surveys_labels_config" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vessel_certificate_applicability" ALTER COLUMN "is_deleted" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ALTER COLUMN "is_deleted" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vessel_survey_applicability" ALTER COLUMN "is_deleted" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "adm_vessel_org_chart" ADD COLUMN "department" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_vessel_certificate_applicability_live" ON "vessel_certificate_applicability" USING btree ("vessel_id","master_id") WHERE "vessel_certificate_applicability"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_vessel_certificate_data_live" ON "vessel_certificate_data" USING btree ("vessel_id","master_id") WHERE "vessel_certificate_data"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_vessel_survey_applicability_live" ON "vessel_survey_applicability" USING btree ("vessel_id","master_id") WHERE "vessel_survey_applicability"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_vessel_survey_data_vessel_master" ON "vessel_survey_data" USING btree ("vessel_id","master_id");