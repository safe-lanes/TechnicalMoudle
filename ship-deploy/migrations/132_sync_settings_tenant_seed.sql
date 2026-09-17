-- Migration 132: pre-seed multi-tenant sync_settings keys EMPTY so the
-- UPDATE-only seed/loadSettings paths have a row to write to.
--
-- Phase 4 (additive plumbing — NO behavior change):
--   * sync_api_key            — the ship's per-tenant sync key (seeded from the bundle).
--   * sync_push_batch_size    — field-log rows per push (syncEngine PUSH_BATCH_SIZE).
--   * sync_request_timeout_ms — per /sync/push attempt timeout (syncEngine REQUEST_TIMEOUT).
--
-- (Phase 4b simplified design: the ship never declares a domain — shore is the sole
-- authority via the master instance->domain map — so no `domain` key is seeded.)
--
-- These are DISTINCT from the pre-existing 103 keys chunk_size / request_timeout_seconds
-- (a file chunk size and a different timeout) — no collision.
--
-- Rows are seeded EMPTY: shore never imports a bundle, so its rows stay empty and the
-- engine falls back to env/hardcoded defaults — byte-identical to today. Only ships
-- that import a bundle get non-empty values (conditional seed, no overwrite-if-set).
-- Idempotent: ON CONFLICT (setting_key) DO NOTHING (the 103/119 pattern).
INSERT INTO sync_settings (ssuuid, setting_key, setting_value, setting_type, description, is_editable)
VALUES
  (gen_random_uuid()::text, 'sync_api_key', '', 'text', 'Per-tenant sync API key (seeded at provisioning). Empty on shore.', true),
  (gen_random_uuid()::text, 'sync_push_batch_size', '', 'number', 'Field-log rows per push. Empty = env/default (1000).', true),
  (gen_random_uuid()::text, 'sync_request_timeout_ms', '', 'number', 'Per /sync/push attempt timeout (ms). Empty = env/default (30000).', true)
ON CONFLICT (setting_key) DO NOTHING;
