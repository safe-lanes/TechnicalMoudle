-- Schema-first only. NEVER independently backfill UUIDs on shore and vessel.
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('185_component_class_regulatory_identity_lifecycle'));
  ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS ccruuid text;
  ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS deleted_by_uuid text;
  ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS deleted_at timestamp;
  -- NULL historical identities remain legal during reconciliation; known identities must be unique.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_class_regulatory_ccruuid
    ON component_class_regulatory (ccruuid);
END
$migration$;
