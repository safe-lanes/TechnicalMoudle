ALTER TABLE "company_standard_grace_settings"
  ADD COLUMN IF NOT EXISTS "calendar_lead_days_critical" integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "calendar_lead_days_non_critical" integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS "rh_lead_hours_critical" integer NOT NULL DEFAULT 720,
  ADD COLUMN IF NOT EXISTS "rh_lead_hours_non_critical" integer NOT NULL DEFAULT 720,
  ADD COLUMN IF NOT EXISTS "rh_grace_hours" integer NOT NULL DEFAULT 168;
