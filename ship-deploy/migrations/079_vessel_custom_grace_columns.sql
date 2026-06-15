DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='settings_mode') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN settings_mode TEXT NOT NULL DEFAULT 'COMPANY_STANDARD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='calendar_grace_method') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN calendar_grace_method TEXT NOT NULL DEFAULT 'FIXED_DAYS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='calendar_grace_value') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN calendar_grace_value INTEGER NOT NULL DEFAULT 7;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='calendar_grace_scope') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN calendar_grace_scope TEXT NOT NULL DEFAULT 'ALL_WORK_ORDERS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='calendar_fallback_method') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN calendar_fallback_method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='calendar_fallback_grace_days') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN calendar_fallback_grace_days INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='rh_grace_method') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN rh_grace_method TEXT NOT NULL DEFAULT 'FIXED_HOURS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='rh_grace_value') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN rh_grace_value INTEGER NOT NULL DEFAULT 168;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='rh_grace_scope') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN rh_grace_scope TEXT NOT NULL DEFAULT 'ALL_WORK_ORDERS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='rh_fallback_method') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN rh_fallback_method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pms_vessel_settings' AND column_name='rh_fallback_grace_hours') THEN
    ALTER TABLE pms_vessel_settings ADD COLUMN rh_fallback_grace_hours INTEGER;
  END IF;
END $$;
