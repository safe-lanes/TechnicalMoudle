DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='settings_mode') THEN
    ALTER TABLE pms_vessel_settings
      ADD COLUMN settings_mode TEXT NOT NULL DEFAULT 'COMPANY_STANDARD',
      ADD COLUMN calendar_grace_method TEXT NOT NULL DEFAULT 'FIXED_DAYS',
      ADD COLUMN calendar_grace_value INTEGER NOT NULL DEFAULT 7,
      ADD COLUMN calendar_grace_scope TEXT NOT NULL DEFAULT 'ALL_WORK_ORDERS',
      ADD COLUMN calendar_fallback_method TEXT,
      ADD COLUMN calendar_fallback_grace_days INTEGER,
      ADD COLUMN rh_grace_method TEXT NOT NULL DEFAULT 'FIXED_HOURS',
      ADD COLUMN rh_grace_value INTEGER NOT NULL DEFAULT 168,
      ADD COLUMN rh_grace_scope TEXT NOT NULL DEFAULT 'ALL_WORK_ORDERS',
      ADD COLUMN rh_fallback_method TEXT,
      ADD COLUMN rh_fallback_grace_hours INTEGER;
  END IF;
END $$;
