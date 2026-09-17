-- Migration 146: normalise boolean sync_settings values to canonical lowercase.
--
-- NUMBERING: 143 = drift detector, 144 = RESERVED for Phase 1 tri-state sync_state,
-- 145 = deprecate dead keys. This takes 146.
--
-- WHY (SYNC-HARDENING-PLAN §16): the scheduler read `auto_sync_enabled` with a strict,
-- case-sensitive `=== 'true'`. A stored 'TRUE' / 'True' / '1' therefore evaluated FALSE and
-- auto-sync silently never ran — with manual "Sync Now" still working, because it never consults
-- this flag. Completely invisible: no error, one skip line per tick.
--
-- SEED AUDIT RESULT (recorded here so nobody re-investigates): every seed path in this repo
-- already writes lowercase — migration 103 seeds 'false', migration 119 sets 'true'. So a
-- correctly-provisioned ship is NOT affected. The exposure was (a) the settings-save endpoint,
-- which persisted whatever a caller sent without canonicalising (fixed in code), and (b) any
-- hand-edited DB row. This migration cleans up (b) wherever it happened.
--
-- The reader is now tolerant regardless, so this is belt-and-braces: it keeps the stored form
-- canonical for humans and for raw SQL checks like `WHERE setting_value = 'true'`.
--
-- sync_settings is per-instance and NOT in shared/syncConfig.ts — this never syncs anywhere.
-- Idempotent: already-canonical rows match no WHERE clause; second run updates zero rows.

UPDATE sync_settings
   SET setting_value = 'true', updated_at = NOW()
 WHERE setting_key IN ('auto_sync_enabled', 'local_mode')
   AND setting_value IS NOT NULL
   AND setting_value <> 'true'
   AND lower(btrim(setting_value)) IN ('true', '1', 'yes', 'y', 'on', 't');
--> statement-breakpoint

UPDATE sync_settings
   SET setting_value = 'false', updated_at = NOW()
 WHERE setting_key IN ('auto_sync_enabled', 'local_mode')
   AND setting_value IS NOT NULL
   AND setting_value <> 'false'
   AND lower(btrim(setting_value)) IN ('false', '0', 'no', 'n', 'off', 'f');
