-- Empty isolated fixture only: exercise installations with the TEXT role schema.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='admn_role_master'::regclass
      AND attname='ruid' AND atttypid='uuid'::regtype) THEN
    ALTER TABLE admn_role_master ALTER COLUMN ruid TYPE TEXT USING ruid::text;
  END IF;
END $$;
