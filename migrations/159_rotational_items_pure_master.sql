-- 159: rotational_items → pure master table (Task #366).
--
-- Migration 156 was amended in place (table never deployed to production) so FRESH
-- installs create rotational_items WITHOUT the component back-pointer columns and
-- WITH stamp_name. This migration upgrades ALREADY-PROVISIONED databases:
--
--   * ADD stamp_name (part description shown wherever the stamp is picked/displayed).
--   * DROP component_id / component_code / component_name — the installed-on link is
--     DERIVED via join components.current_stamp = rotational_items.stamp (per vessel);
--     the historical "where fitted" trace lives in immutable rotation_history.
--   * DROP idx_rotational_items_component (index on the removed column).
--   * DELETE stale sync_field_log rows for the removed field names so replay never
--     carries dead payloads (the applier's unknown-column guard would skip them
--     anyway — this is housekeeping).
--   * Ensure the derived-join index on components (vessel_id, current_stamp) exists.
--
-- Idempotent: safe to re-run; a complete no-op on databases created from the amended 156.

ALTER TABLE rotational_items ADD COLUMN IF NOT EXISTS stamp_name TEXT;

DROP INDEX IF EXISTS idx_rotational_items_component;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rotational_items' AND column_name = 'component_id'
  ) THEN
    ALTER TABLE rotational_items DROP COLUMN component_id;
    ALTER TABLE rotational_items DROP COLUMN IF EXISTS component_code;
    ALTER TABLE rotational_items DROP COLUMN IF EXISTS component_name;
    DELETE FROM sync_field_log
      WHERE table_name = 'rotational_items'
        AND field_name IN ('componentId', 'componentCode', 'componentName');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comp_vessel_current_stamp
  ON components (vessel_id, current_stamp) WHERE current_stamp IS NOT NULL AND is_deleted = FALSE;
