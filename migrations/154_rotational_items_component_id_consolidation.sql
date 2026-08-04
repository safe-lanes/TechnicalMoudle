-- 154: rotational_items component-link consolidation (upgrade path).
--
-- Migration 152 was amended in place (table introduced in the current rotational-items
-- work, never deployed to production) so FRESH installs create rotational_items with a
-- single component_id column storing components.cuuid — the schema-wide convention.
--
-- This migration upgrades ALREADY-PROVISIONED databases (e.g. a second dev/ship
-- instance where the original 152 ran): backfill component_id from component_cuuid,
-- drop component_cuuid, and rebuild the installed-lookup index on component_id.
-- Also clears stale sync_field_log rows referencing the removed column (and the old
-- mixed-format componentId values) so replay can never write legacy ids.
--
-- Idempotent: a complete no-op on databases created from the amended 152.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rotational_items' AND column_name = 'component_cuuid'
  ) THEN
    -- component_cuuid was always the authoritative cuuid link; component_id held
    -- mixed legacy ids. Overwrite unconditionally.
    UPDATE rotational_items SET component_id = component_cuuid;
    ALTER TABLE rotational_items DROP COLUMN component_cuuid; -- also drops its partial index
    DELETE FROM sync_field_log
      WHERE table_name = 'rotational_items' AND field_name IN ('componentCuuid', 'componentId');
  END IF;
END $$;

-- NOTE (Task #366): the index on component_id is no longer created here. Migration 155
-- drops component_id entirely (pure master table); recreating the index on fresh
-- installs (where the amended 152 never adds the column) would fail.
