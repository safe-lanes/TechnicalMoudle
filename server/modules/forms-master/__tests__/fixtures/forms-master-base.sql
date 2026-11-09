-- Isolated fixture schema only. Never run against an installation's public schema.
-- Test runner creates a unique schema, sets search_path, then executes this file.
CREATE TABLE IF NOT EXISTS vessels (LIKE public.vessels INCLUDING ALL);
CREATE TABLE IF NOT EXISTS admn_role_master (LIKE public.admn_role_master INCLUDING ALL);
CREATE TABLE IF NOT EXISTS adm_menumaster_ac (LIKE public.adm_menumaster_ac INCLUDING ALL);
CREATE TABLE IF NOT EXISTS adm_role_menu_access (LIKE public.adm_role_menu_access INCLUDING ALL);
CREATE TABLE IF NOT EXISTS audit_log (LIKE public.audit_log INCLUDING ALL);
CREATE TABLE IF NOT EXISTS sync_field_log (LIKE public.sync_field_log INCLUDING ALL);
CREATE TABLE IF NOT EXISTS sync_settings (LIKE public.sync_settings INCLUDING ALL);
CREATE TABLE IF NOT EXISTS sync_metadata (LIKE public.sync_metadata INCLUDING ALL);
CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(255) PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  applied_at TIMESTAMP DEFAULT NOW(), sql_hash TEXT
);
-- Sentinel represents an existing, unrelated builder record.
CREATE TABLE IF NOT EXISTS form_definitions (fduuid TEXT PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO form_definitions (fduuid, name) VALUES ('fixture-builder-sentinel', 'Preserve builder')
  ON CONFLICT (fduuid) DO NOTHING;
INSERT INTO sync_settings (setting_key, setting_value) VALUES ('instance_id', 'SHORE-FORMS-FIXTURE')
  ON CONFLICT (setting_key) DO NOTHING;
CREATE TABLE IF NOT EXISTS fixture_faults (name TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT false);
INSERT INTO fixture_faults (name) VALUES ('audit'), ('sync') ON CONFLICT (name) DO NOTHING;
CREATE OR REPLACE FUNCTION fixture_fail_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM fixture_faults WHERE name = TG_ARGV[0] AND enabled) THEN
    RAISE EXCEPTION 'Simulated % failure', TG_ARGV[0];
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'audit_log'::regclass AND tgname = 'fixture_audit_failure') THEN
    CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fixture_fail_write('audit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'sync_field_log'::regclass AND tgname = 'fixture_sync_failure') THEN
    CREATE TRIGGER fixture_sync_failure BEFORE INSERT ON sync_field_log FOR EACH ROW EXECUTE FUNCTION fixture_fail_write('sync');
  END IF;
END $$;
