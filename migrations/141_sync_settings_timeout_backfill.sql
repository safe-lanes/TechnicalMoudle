-- Migration 141: backfill empty sync_settings timeout/batch keys with VSAT-safe defaults.
--
-- ROOT CAUSE (Frontier Venture, 2026-07-23 outage): sync_request_timeout_ms was pre-seeded
-- EMPTY by migration 132 and only ever set at provisioning via seedSettingIfEmpty (UPDATE-only,
-- runs only on bundle import). Ships provisioned before the bundle carried the value — or never
-- re-provisioned — kept an EMPTY row, so loadSettings fell through to a hand-set
-- env SYNC_REQUEST_TIMEOUT_MS=1200 (1.2s). Over VSAT every push aborted before the shore's
-- acknowledgment returned -> false failure -> 3-cycle dead-letter -> good work orders marked
-- is_synced=true but never delivered. Full analysis: docs/SYNC-HARDENING-PLAN.md.
--
-- This migration sets a DB value so NO ship depends on env. 60000 (60s) is the fleet-standard
-- VSAT-safe value (matches the provisioning default reqTimeout ?? 60000). Uniform across all ships.
--
-- Idempotent: only touches rows whose value is still empty (COALESCE = ''); a second run finds
-- none and updates 0 rows. Never overwrites an operator-set value.
--
-- Harmless on shore: sync is ship-initiated (the shore never pushes), so the shore never uses
-- requestTimeoutMs. Setting it there is inert; scoping to ships would be fragile because some
-- ships hold instance_id in env, not DB. Unconditional-where-empty guarantees every ship is fixed.
UPDATE sync_settings
   SET setting_value = '60000', updated_at = NOW()
 WHERE setting_key = 'sync_request_timeout_ms'
   AND COALESCE(setting_value, '') = '';

UPDATE sync_settings
   SET setting_value = '200', updated_at = NOW()
 WHERE setting_key = 'sync_push_batch_size'
   AND COALESCE(setting_value, '') = '';
