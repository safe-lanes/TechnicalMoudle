-- Data cleanup only: normal Section H editing no longer requires vessel rollout approval.
-- Keep the shared settings table, every other setting and all business records unchanged.
-- Replaying this batch, including on an installation without the key, is a no-op.
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('189_remove_section_h_ready_vessels'));
  DELETE FROM sync_settings WHERE setting_key = 'section_h_ready_vessels';
END
$migration$;
