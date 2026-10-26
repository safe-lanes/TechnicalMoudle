-- Hand-written, file-based idempotent migration. Run locally on shore AND vessels.
-- No sync field logs: backfill is local and must never classify later legacy imports.
DO $migration$
DECLARE
  previous_sync_bypass text := current_setting('sync.bypass_trigger', true);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('184_spare_category_optimum_qty'));
  ALTER TABLE spares ADD COLUMN IF NOT EXISTS spare_category text;
  ALTER TABLE spares ADD COLUMN IF NOT EXISTS optimum_qty integer;
  ALTER TABLE fleet_spares ADD COLUMN IF NOT EXISTS spare_category text;
  ALTER TABLE fleet_spares ADD COLUMN IF NOT EXISTS optimum_qty integer;

  INSERT INTO master_list_types
    (mltuuid, list_type_key, label, section, is_system, display_order)
  VALUES ('a012e5bc-c4fd-4d23-8c60-caa444137c01', 'spareCategory', 'Spare Category', 'Spares', true, 30)
  ON CONFLICT (list_type_key) DO NOTHING;
  INSERT INTO master_lists (list_type, list_key, list_value, display_order)
  VALUES ('spareCategory', 'essential', 'Essential', 1),
         ('spareCategory', 'optimum', 'Optimum', 2),
         ('spareCategory', 'general', 'General', 3)
  ON CONFLICT (list_type, list_key) DO NOTHING;

  -- Separate durable data guard: even direct SQL replay must preserve future NULLs.
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE id = '184_spare_category_backfill_once') THEN
    -- Preserve updated_at so the local backfill does not create a Fleet full-row
    -- sync watermark change through the generic set_updated_at() trigger.
    PERFORM set_config('sync.bypass_trigger', 'true', true);
    UPDATE spares SET spare_category = 'general' WHERE spare_category IS NULL;
    UPDATE fleet_spares SET spare_category = 'general' WHERE spare_category IS NULL;
    PERFORM set_config('sync.bypass_trigger', COALESCE(previous_sync_bypass, 'false'), true);
    INSERT INTO schema_migrations (id, name, description)
    VALUES ('184_spare_category_backfill_once', 'Spare classification local backfill',
            'One-time local General classification; no outgoing field logs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = 'spares'::regclass AND conname = 'spares_classification_pair_check') THEN
    ALTER TABLE spares ADD CONSTRAINT spares_classification_pair_check CHECK (
      (spare_category IS NOT NULL AND spare_category = 'optimum' AND optimum_qty IS NOT NULL AND optimum_qty > 0)
      OR ((spare_category IS NULL OR spare_category <> 'optimum') AND optimum_qty IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = 'fleet_spares'::regclass AND conname = 'fleet_spares_classification_pair_check') THEN
    ALTER TABLE fleet_spares ADD CONSTRAINT fleet_spares_classification_pair_check CHECK (
      (spare_category IS NOT NULL AND spare_category = 'optimum' AND optimum_qty IS NOT NULL AND optimum_qty > 0)
      OR ((spare_category IS NULL OR spare_category <> 'optimum') AND optimum_qty IS NULL)
    );
  END IF;
END $migration$;
