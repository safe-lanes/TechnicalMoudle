ALTER TABLE "change_request" ADD COLUMN "cruuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "change_request_attachment" ADD COLUMN "crauuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "change_request_comment" ADD COLUMN "crcuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD COLUMN "cmhuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "component_running_hours_log" ADD COLUMN "crhluuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_actions" ADD COLUMN "dauuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_attachments" ADD COLUMN "datuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "ituuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "running_hours_audit" ADD COLUMN "rhauuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "spare_component_links" ADD COLUMN "scluuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD COLUMN "slsuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "spares_history" ADD COLUMN "shuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "stores_ledger" ADD COLUMN "sluuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN "vcduuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "vessel_survey_data" ADD COLUMN "vsduuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_execution_details" ADD COLUMN "woeduuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_cruuid_unique" UNIQUE("cruuid");--> statement-breakpoint
ALTER TABLE "change_request_attachment" ADD CONSTRAINT "change_request_attachment_crauuid_unique" UNIQUE("crauuid");--> statement-breakpoint
ALTER TABLE "change_request_comment" ADD CONSTRAINT "change_request_comment_crcuuid_unique" UNIQUE("crcuuid");--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD CONSTRAINT "component_maintenance_history_cmhuuid_unique" UNIQUE("cmhuuid");--> statement-breakpoint
ALTER TABLE "component_running_hours_log" ADD CONSTRAINT "component_running_hours_log_crhluuid_unique" UNIQUE("crhluuid");--> statement-breakpoint
ALTER TABLE "defect_actions" ADD CONSTRAINT "defect_actions_dauuid_unique" UNIQUE("dauuid");--> statement-breakpoint
ALTER TABLE "defect_attachments" ADD CONSTRAINT "defect_attachments_datuuid_unique" UNIQUE("datuuid");--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_ituuid_unique" UNIQUE("ituuid");--> statement-breakpoint
ALTER TABLE "running_hours_audit" ADD CONSTRAINT "running_hours_audit_rhauuid_unique" UNIQUE("rhauuid");--> statement-breakpoint
ALTER TABLE "spare_component_links" ADD CONSTRAINT "spare_component_links_scluuid_unique" UNIQUE("scluuid");--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD CONSTRAINT "spare_location_stock_slsuuid_unique" UNIQUE("slsuuid");--> statement-breakpoint
ALTER TABLE "spares_history" ADD CONSTRAINT "spares_history_shuuid_unique" UNIQUE("shuuid");--> statement-breakpoint
ALTER TABLE "stores_ledger" ADD CONSTRAINT "stores_ledger_sluuid_unique" UNIQUE("sluuid");--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD CONSTRAINT "vessel_certificate_data_vcduuid_unique" UNIQUE("vcduuid");--> statement-breakpoint
ALTER TABLE "vessel_survey_data" ADD CONSTRAINT "vessel_survey_data_vsduuid_unique" UNIQUE("vsduuid");--> statement-breakpoint
ALTER TABLE "work_order_execution_details" ADD CONSTRAINT "work_order_execution_details_woeduuid_unique" UNIQUE("woeduuid");