-- 13-Oct-2026 (Testvessel follow-up): component_documents synced by its integer id, which is assigned separately on
-- shore and on each ship. An office upload and a ship upload both got id 1 and each side silently kept only its own
-- (proven on the shore+ship pilot). Give documents a UUID identity (cduuid) — sync matches on it from now on
-- (shared/syncConfig.ts).
--
-- Mixed versions are expected (shore is updated first, ships pull the code at night), so the UUID of an EXISTING
-- document is computed, not random, from what is the SAME on shore and ship for the same document: its stored file
-- (file_key, unique per upload — it carries the upload timestamp) and its component (component_id = components.cuuid):
--   md5('component_documents:' || file_key || ':' || component_id || ':' || n)
-- where n = 1, 2, … only separates the rare case of one file attached twice to the same component (by upload time).
-- NOT the integer id: a document that synced under the old code has DIFFERENT ids on the two sides (proven on the
-- pilot: shore 4, ship 1). The receiving side derives the same value for an old (id-keyed) sender's new document
-- (oneWayApplier LEGACY_ID_KEYED, n = 1). New documents get a random UUID.
--
-- Additive and idempotent.

ALTER TABLE component_documents ADD COLUMN IF NOT EXISTS cduuid TEXT;

WITH ranked AS (
  SELECT id, file_key, component_id,
         row_number() OVER (PARTITION BY file_key, component_id ORDER BY uploaded_at, id) AS n
  FROM component_documents
  WHERE cduuid IS NULL
)
UPDATE component_documents d
SET cduuid = md5('component_documents:' || r.file_key || ':' || r.component_id || ':' || r.n::text)::uuid::text
FROM ranked r
WHERE d.id = r.id;

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
