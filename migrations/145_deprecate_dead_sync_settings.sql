-- Migration 145: mark the two DEAD sync_settings keys as deprecated in their own description.
--
-- NUMBERING: 144 is RESERVED for Phase 1 tri-state sync_state (confirmed 2026-07-24). Item B
-- lands after the drift detector (143) and therefore takes 145, leaving 144 free as agreed.
--
-- WHY (Frontier Venture, 2026-07-24): support read sync_settings looking for the sync timeout
-- and found `request_timeout_seconds = 30`. Nothing reads it. The engine reads
-- `sync_request_timeout_ms` (syncEngine.ts loadSettings) — the key migration 132 added and
-- migration 141 backfilled. Support would have kept tuning a value that does nothing while the
-- real one stayed empty. Same story for `local_mode`: isLocalMode() reads
-- process.env.SYNC_LOCAL_MODE and whether shore_url resolves — never this row.
--
-- The rows are NOT deleted: an admin UI may enumerate settings and a missing key could render
-- oddly. Renaming the description is enough to stop the misdirection, and it is reversible.
--
-- sync_settings is per-instance and NOT in shared/syncConfig.ts — this never syncs anywhere.
-- Idempotent: pure UPDATEs matched on setting_key; second run changes nothing.

UPDATE sync_settings
   SET setting_value = setting_value,
       description = 'DEPRECATED — NOT READ BY ANY CODE. The effective per-request sync timeout is sync_request_timeout_ms (60000ms floor, migration 141). Changing this value has no effect.'
 WHERE setting_key = 'request_timeout_seconds';
--> statement-breakpoint

UPDATE sync_settings
   SET setting_value = setting_value,
       description = 'DEPRECATED — NOT READ BY ANY CODE. Local mode is decided by env SYNC_LOCAL_MODE and by whether shore_url resolves (syncEngine.isLocalMode). Changing this value has no effect.'
 WHERE setting_key = 'local_mode';
