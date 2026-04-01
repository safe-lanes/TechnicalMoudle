ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_grace_method" text DEFAULT 'FIXED_HOURS' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_grace_value" integer DEFAULT 168 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_grace_scope" text DEFAULT 'ALL_WORK_ORDERS' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_fallback_method" text;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_fallback_grace_hours" integer;