-- Migration 119: Update sync-settings defaults so new/unconfigured vessels
-- get auto-sync ON at a 6-hour cadence (was OFF / 0 = broken out-of-the-box).
-- Conservative: only changes rows still at the OLD seed defaults; admin-set
-- values are left untouched. Idempotent (re-run = zero rows changed).

-- 1) Fresh installs where the keys are somehow missing: seed the NEW defaults.
INSERT INTO sync_settings (ssuuid, setting_key, setting_value, setting_type, description, is_editable)
VALUES (gen_random_uuid()::text, 'auto_sync_enabled', 'true', 'boolean', 'Enable automatic scheduled sync.', true)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO sync_settings (ssuuid, setting_key, setting_value, setting_type, description, is_editable)
VALUES (gen_random_uuid()::text, 'sync_interval_minutes', '360', 'number', 'Auto-sync interval in minutes. Recommended 30-360 for vessels.', true)
ON CONFLICT (setting_key) DO NOTHING;

-- 2) Existing vessels still at the OLD seed defaults → adopt the new defaults.
--    Only matches the exact stale-default values, so admin overrides are preserved.
UPDATE sync_settings
   SET setting_value = 'true', updated_at = now()
 WHERE setting_key = 'auto_sync_enabled'
   AND setting_value = 'false';

UPDATE sync_settings
   SET setting_value = '360', updated_at = now()
 WHERE setting_key = 'sync_interval_minutes'
   AND setting_value = '0';
