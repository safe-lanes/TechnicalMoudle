ALTER TABLE "company_standard_grace_settings" ADD COLUMN "calendar_lead_days_critical" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "calendar_lead_days_non_critical" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_lead_hours_critical" integer DEFAULT 720 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_lead_hours_non_critical" integer DEFAULT 720 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "rh_grace_hours" integer DEFAULT 168 NOT NULL;