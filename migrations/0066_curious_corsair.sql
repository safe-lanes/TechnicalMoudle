DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defect_approval_settings_singleton_key_check') THEN
    ALTER TABLE "defect_approval_settings"
      ADD CONSTRAINT "defect_approval_settings_singleton_key_check"
      CHECK ("singleton_key" = 'default');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defect_approval_settings_long_extension_days_check') THEN
    ALTER TABLE "defect_approval_settings"
      ADD CONSTRAINT "defect_approval_settings_long_extension_days_check"
      CHECK ("long_extension_days" BETWEEN 1 AND 3650);
  END IF;
END $$;