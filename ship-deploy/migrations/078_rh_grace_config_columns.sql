ALTER TABLE "company_standard_grace_settings"
  ADD COLUMN IF NOT EXISTS "rh_grace_method" text NOT NULL DEFAULT 'FIXED_HOURS',
  ADD COLUMN IF NOT EXISTS "rh_grace_value" integer NOT NULL DEFAULT 168,
  ADD COLUMN IF NOT EXISTS "rh_grace_scope" text NOT NULL DEFAULT 'ALL_WORK_ORDERS',
  ADD COLUMN IF NOT EXISTS "rh_fallback_method" text,
  ADD COLUMN IF NOT EXISTS "rh_fallback_grace_hours" integer;
