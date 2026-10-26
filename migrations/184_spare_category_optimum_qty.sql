-- Hand-written, single transactional batch: no statement-breakpoint markers.
-- The durable guard is in schema_migrations alongside ordinary runner tracking.
-- It commits WITH the backfill, and survives explicit SQL replay.
DO $migration$
DECLARE
  previous_sync_bypass text := current_setting('sync.bypass_trigger', true);
BEGIN
  -- Retain the incoming branch's lock too, coordinating with either SQL revision.
  PERFORM pg_advisory_xact_lock(hashtext('184_spare_category_optimum_qty'));
  PERFORM pg_advisory_xact_lock(184, 654);
  ALTER TABLE spares ADD COLUMN IF NOT EXISTS spare_category text;
  ALTER TABLE spares ADD COLUMN IF NOT EXISTS optimum_qty integer;
  ALTER TABLE fleet_spares ADD COLUMN IF NOT EXISTS spare_category text;
  ALTER TABLE fleet_spares ADD COLUMN IF NOT EXISTS optimum_qty integer;

  INSERT INTO master_list_types
    (mltuuid, list_type_key, label, section, is_system, display_order)
  VALUES ('5cf0ba49-1fbe-4a3e-9184-000000000184', 'spareCategory', 'Spare Category', 'Spares', true, 40)
  ON CONFLICT (list_type_key) DO NOTHING;
  INSERT INTO master_lists (list_type, list_key, list_value, display_order)
  VALUES ('spareCategory', 'essential', 'Essential', 1),
         ('spareCategory', 'optimum', 'Optimum', 2),
         ('spareCategory', 'general', 'General', 3)
  ON CONFLICT (list_type, list_key) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE id IN (
      '184_spare_category_optimum_qty_backfill', '184_spare_category_backfill_once')) THEN
    -- Existing updated_at triggers honor this flag: no Fleet sync watermark changes.
    PERFORM set_config('sync.bypass_trigger', 'true', true);
    UPDATE spares SET spare_category = 'general', optimum_qty = NULL WHERE spare_category IS NULL;
    UPDATE fleet_spares SET spare_category = 'general', optimum_qty = NULL WHERE spare_category IS NULL;
    PERFORM set_config('sync.bypass_trigger', COALESCE(previous_sync_bypass, 'false'), true);
    INSERT INTO schema_migrations (id, name, description)
    VALUES ('184_spare_category_optimum_qty_backfill', 'One-time local spare classification',
            'Existing rows only. No field logs. Never remove this guard on code rollback.');
  END IF;
  -- Both branches' SQL revisions may have shipped. Honor either durable marker,
  -- then establish both aliases without ever replaying the data update.
  INSERT INTO schema_migrations(id,name,description) VALUES
    ('184_spare_category_optimum_qty_backfill','One-time local spare classification','Shared one-time backfill guard'),
    ('184_spare_category_backfill_once','One-time local spare classification','Compatibility backfill guard')
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('spares_category_optimum_check', 'spares_classification_pair_check') AND conrelid = 'spares'::regclass) THEN
    ALTER TABLE spares ADD CONSTRAINT spares_category_optimum_check CHECK (
      CASE WHEN spare_category = 'optimum' THEN optimum_qty IS NOT NULL AND optimum_qty > 0
      ELSE optimum_qty IS NULL END
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('fleet_spares_category_optimum_check', 'fleet_spares_classification_pair_check') AND conrelid = 'fleet_spares'::regclass) THEN
    ALTER TABLE fleet_spares ADD CONSTRAINT fleet_spares_category_optimum_check CHECK (
      CASE WHEN spare_category = 'optimum' THEN optimum_qty IS NOT NULL AND optimum_qty > 0
      ELSE optimum_qty IS NULL END
    );
  END IF;
END $migration$;
