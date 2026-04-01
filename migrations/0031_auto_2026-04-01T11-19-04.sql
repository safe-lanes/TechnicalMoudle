ALTER TABLE "company_standard_grace_settings" ALTER COLUMN "grace_method" SET DEFAULT 'FIXED_DAYS';--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ALTER COLUMN "grace_value" SET DEFAULT 7;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN "fallback_method" text DEFAULT 'MONTH_END';