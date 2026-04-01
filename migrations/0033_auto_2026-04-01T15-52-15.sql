ALTER TABLE "pms_vessel_settings" ADD COLUMN "settings_mode" text DEFAULT 'COMPANY_STANDARD' NOT NULL;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "calendar_grace_method" text DEFAULT 'FIXED_DAYS' NOT NULL;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "calendar_grace_value" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "calendar_grace_scope" text DEFAULT 'ALL_WORK_ORDERS' NOT NULL;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "calendar_fallback_method" text;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "calendar_fallback_grace_days" integer;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "rh_grace_method" text DEFAULT 'FIXED_HOURS' NOT NULL;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "rh_grace_value" integer DEFAULT 168 NOT NULL;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "rh_grace_scope" text DEFAULT 'ALL_WORK_ORDERS' NOT NULL;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "rh_fallback_method" text;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "rh_fallback_grace_hours" integer;