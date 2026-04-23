ALTER TABLE "change_request" ADD COLUMN IF NOT EXISTS "cruuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "change_request_attachment" ADD COLUMN IF NOT EXISTS "crauuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "change_request_comment" ADD COLUMN IF NOT EXISTS "crcuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD COLUMN IF NOT EXISTS "cmhuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "component_running_hours_log" ADD COLUMN IF NOT EXISTS "crhluuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_actions" ADD COLUMN IF NOT EXISTS "dauuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_attachments" ADD COLUMN IF NOT EXISTS "datuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "ituuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "running_hours_audit" ADD COLUMN IF NOT EXISTS "rhauuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "spare_component_links" ADD COLUMN IF NOT EXISTS "scluuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD COLUMN IF NOT EXISTS "slsuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "spares_history" ADD COLUMN IF NOT EXISTS "shuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "stores_ledger" ADD COLUMN IF NOT EXISTS "sluuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN IF NOT EXISTS "vcduuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "vessel_survey_data" ADD COLUMN IF NOT EXISTS "vsduuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_execution_details" ADD COLUMN IF NOT EXISTS "woeduuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_request_cruuid_unique') THEN
    ALTER TABLE "change_request" ADD CONSTRAINT "change_request_cruuid_unique" UNIQUE("cruuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_request_attachment_crauuid_unique') THEN
    ALTER TABLE "change_request_attachment" ADD CONSTRAINT "change_request_attachment_crauuid_unique" UNIQUE("crauuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_request_comment_crcuuid_unique') THEN
    ALTER TABLE "change_request_comment" ADD CONSTRAINT "change_request_comment_crcuuid_unique" UNIQUE("crcuuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_maintenance_history_cmhuuid_unique') THEN
    ALTER TABLE "component_maintenance_history" ADD CONSTRAINT "component_maintenance_history_cmhuuid_unique" UNIQUE("cmhuuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_running_hours_log_crhluuid_unique') THEN
    ALTER TABLE "component_running_hours_log" ADD CONSTRAINT "component_running_hours_log_crhluuid_unique" UNIQUE("crhluuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defect_actions_dauuid_unique') THEN
    ALTER TABLE "defect_actions" ADD CONSTRAINT "defect_actions_dauuid_unique" UNIQUE("dauuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defect_attachments_datuuid_unique') THEN
    ALTER TABLE "defect_attachments" ADD CONSTRAINT "defect_attachments_datuuid_unique" UNIQUE("datuuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_ituuid_unique') THEN
    ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_ituuid_unique" UNIQUE("ituuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'running_hours_audit_rhauuid_unique') THEN
    ALTER TABLE "running_hours_audit" ADD CONSTRAINT "running_hours_audit_rhauuid_unique" UNIQUE("rhauuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_component_links_scluuid_unique') THEN
    ALTER TABLE "spare_component_links" ADD CONSTRAINT "spare_component_links_scluuid_unique" UNIQUE("scluuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_location_stock_slsuuid_unique') THEN
    ALTER TABLE "spare_location_stock" ADD CONSTRAINT "spare_location_stock_slsuuid_unique" UNIQUE("slsuuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_history_shuuid_unique') THEN
    ALTER TABLE "spares_history" ADD CONSTRAINT "spares_history_shuuid_unique" UNIQUE("shuuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_ledger_sluuid_unique') THEN
    ALTER TABLE "stores_ledger" ADD CONSTRAINT "stores_ledger_sluuid_unique" UNIQUE("sluuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessel_certificate_data_vcduuid_unique') THEN
    ALTER TABLE "vessel_certificate_data" ADD CONSTRAINT "vessel_certificate_data_vcduuid_unique" UNIQUE("vcduuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessel_survey_data_vsduuid_unique') THEN
    ALTER TABLE "vessel_survey_data" ADD CONSTRAINT "vessel_survey_data_vsduuid_unique" UNIQUE("vsduuid");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_execution_details_woeduuid_unique') THEN
    ALTER TABLE "work_order_execution_details" ADD CONSTRAINT "work_order_execution_details_woeduuid_unique" UNIQUE("woeduuid");
  END IF;
END $$;
