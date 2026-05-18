-- Add updated_at triggers to sync infrastructure tables
-- These tables were created after migration 100 ran, so they need catch-up triggers
DO $$
DECLARE tbl TEXT; tn TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['sync_metadata','sync_field_log','sync_conflicts','sync_file_queue','sync_batches'])
  LOOP
    tn := 'trg_' || tbl || '_updated_at';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', tn, tbl);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tn, tbl);
  END LOOP;
END;
$$;
