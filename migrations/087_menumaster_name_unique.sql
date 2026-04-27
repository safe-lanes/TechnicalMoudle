-- Add unique constraint on adm_menumaster_ac.name for data integrity
-- The name column is used as a business key for lookups throughout the application
-- Guard: only create the index if no duplicate names exist

DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT name FROM adm_menumaster_ac GROUP BY name HAVING COUNT(*) > 1
  ) dupes;

  IF dup_count > 0 THEN
    RAISE NOTICE 'Skipping unique index on adm_menumaster_ac.name: % duplicate name(s) found', dup_count;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'adm_menumaster_ac_name_key'
    ) THEN
      CREATE UNIQUE INDEX adm_menumaster_ac_name_key ON adm_menumaster_ac (name);
      RAISE NOTICE 'Created unique index adm_menumaster_ac_name_key';
    END IF;
  END IF;
END $$;
