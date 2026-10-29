DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('186_section_h_master_metadata'));
  ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS classification_society_key text;
  ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS survey_type_key text;
  ALTER TABLE master_lists ADD COLUMN IF NOT EXISTS country text;
  ALTER TABLE master_lists ADD COLUMN IF NOT EXISTS category text;
  ALTER TABLE master_lists ADD COLUMN IF NOT EXISTS description text;
  -- Already present on audit-migrated installations; preserve existing timestamps.
  ALTER TABLE master_lists ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
END
$migration$;
