-- 13-Oct-2026 (Testvessel follow-up): component_documents synced by its integer id, which is assigned separately on
-- shore and on each ship. An office upload and a ship upload both got id 1 and each side silently kept only its own
-- (proven on the shore+ship pilot). Give documents a UUID identity (cduuid) — sync matches on it from now on
-- (shared/syncConfig.ts).
--
-- Mixed versions are expected (shore is updated first, ships pull the code at night), so the UUID of an EXISTING
-- document is computed, not random: md5('component_documents:' || id || ':' || file_key). A document copied to the
-- ship at provisioning has the same id and file_key on both sides → the same UUID, with no coordination. Two
-- different documents that collided on id have different file_keys → different UUIDs. The receiving side derives
-- the same value for an old (id-keyed) sender's new document (oneWayApplier LEGACY_ID_KEYED). New documents get a
-- random UUID.
--
-- Additive and idempotent.

ALTER TABLE component_documents ADD COLUMN IF NOT EXISTS cduuid TEXT;

UPDATE component_documents
SET cduuid = md5('component_documents:' || id::text || ':' || coalesce(file_key, ''))::uuid::text
WHERE cduuid IS NULL;

ALTER TABLE component_documents ALTER COLUMN cduuid SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_component_documents_cduuid ON component_documents (cduuid);

-- This instance's own changes still waiting to be sent were keyed by the old integer id: re-key them to the UUID so
-- they travel under the new identity. Only own logs (same rule as migration 181); received logs are history only.
WITH me AS (
  SELECT NULLIF((SELECT s.setting_value FROM sync_settings s WHERE s.setting_key = 'instance_id' LIMIT 1), '') AS db_id,
         EXISTS (SELECT 1 FROM sync_field_log x WHERE x.instance_id NOT LIKE 'SHIP-%') AS has_non_ship_logs
)
UPDATE sync_field_log l
SET row_uuid = d.cduuid
FROM component_documents d, me
WHERE l.table_name = 'component_documents'
  AND l.is_synced = false
  AND l.row_uuid = d.id::text
  AND CASE WHEN me.db_id IS NOT NULL THEN l.instance_id = me.db_id
           WHEN me.has_non_ship_logs THEN l.instance_id NOT LIKE 'SHIP-%'
           ELSE true END;

-- Pending file transfers of documents carried the integer id as their row reference: align them too.
UPDATE sync_file_queue q
SET row_uuid = d.cduuid
FROM component_documents d
WHERE q.table_name = 'component_documents'
  AND q.row_uuid = d.id::text
  AND q.status <> 'completed';
