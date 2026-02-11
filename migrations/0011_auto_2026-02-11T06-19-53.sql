ALTER TABLE "certificates" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "job_component_links" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "spare_component_links" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "vessel_certificate_applicability" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "vessel_survey_applicability" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "vessel_survey_data" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "work_order_execution_details" ADD COLUMN "vessel_id_int" integer;