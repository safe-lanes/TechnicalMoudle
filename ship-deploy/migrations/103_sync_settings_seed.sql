-- Migration 103: Seed default sync settings
-- These are configurable via the Shore Admin UI (Fleet Sync Overview page)
-- Environment variables still work as fallback if DB settings are empty

INSERT INTO sync_settings (ssuuid, setting_key, setting_value, setting_type, description, is_editable)
VALUES
  (gen_random_uuid()::text, 'shore_url', '', 'url', 'Shore server base URL for sync API calls (e.g., https://pms.safelanes.com/technical/api). Leave empty for local mode.', true),
  (gen_random_uuid()::text, 'instance_id', '', 'text', 'Unique identity for this server instance (e.g., SHIP-V003 or SHORE-AWS). Set during provisioning.', true),
  (gen_random_uuid()::text, 'sync_interval_minutes', '0', 'number', 'Auto-sync interval in minutes. 0 = manual sync only. Recommended: 30-60 for vessels.', true),
  (gen_random_uuid()::text, 'auto_sync_enabled', 'false', 'boolean', 'Enable automatic scheduled sync.', true),
  (gen_random_uuid()::text, 'local_mode', 'true', 'boolean', 'When true, sync calls service functions directly instead of HTTP. For development only.', true),
  (gen_random_uuid()::text, 'max_retries', '3', 'number', 'Maximum retry attempts per sync API call.', true),
  (gen_random_uuid()::text, 'chunk_size', '200', 'number', 'Maximum records per sync push/pull request.', true),
  (gen_random_uuid()::text, 'request_timeout_seconds', '30', 'number', 'Timeout per sync API request in seconds.', true),
  (gen_random_uuid()::text, 'field_log_retention_days', '90', 'number', 'Days to keep synced field log entries before pruning.', true),
  (gen_random_uuid()::text, 'batch_retention_days', '365', 'number', 'Days to keep completed/failed sync batches before pruning.', true)
ON CONFLICT (setting_key) DO NOTHING;
