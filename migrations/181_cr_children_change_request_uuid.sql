-- 13-Oct-2026 (Testvessel follow-up): change request comments and attachments linked to their change request ONLY
-- by its LOCAL integer id (change_request_id). That number is assigned separately on shore and on each ship, so a
-- synced comment/attachment kept the SENDER's number and landed on no change request, or on a different one
-- (proven on the shore+ship pilot). Add the change request's UUID — the same everywhere — so sync can resolve the
-- local id from it (server/modules/sync/oneWayApplier.ts PARENT_UUID_LINKS).
--
-- Additive and idempotent: nullable columns, IF NOT EXISTS, backfill only where still NULL.

ALTER TABLE change_request_comment    ADD COLUMN IF NOT EXISTS change_request_uuid TEXT;
ALTER TABLE change_request_attachment ADD COLUMN IF NOT EXISTS change_request_uuid TEXT;

-- Backfill ONLY rows THIS database created itself — for those the local change_request_id is right. Rows received
-- from the other side carry the SENDER's number, which may name a different change request here: they stay NULL
-- (unknown; today's behaviour) instead of being fixed to a wrong parent.
-- "Created here" = the row's creation field log was written by this instance:
--   * sync_settings.instance_id set            → logs under exactly that id;
--   * otherwise (id comes from the environment) → a shore DB also holds the ships' logs, always under 'SHIP-…' ids,
--     so its own are the non-'SHIP-' ones; a ship DB holds only its own logs (all 'SHIP-…'), so all of them.
-- Any doubt resolves to "not own" → NULL, never a guessed parent.
WITH me AS (
  SELECT NULLIF((SELECT s.setting_value FROM sync_settings s WHERE s.setting_key = 'instance_id' LIMIT 1), '') AS db_id,
         EXISTS (SELECT 1 FROM sync_field_log x WHERE x.instance_id NOT LIKE 'SHIP-%') AS has_non_ship_logs
)
UPDATE change_request_comment c
SET change_request_uuid = cr.cruuid
FROM change_request cr, me
WHERE c.change_request_uuid IS NULL
  AND cr.id = c.change_request_id
  AND EXISTS (
    SELECT 1 FROM sync_field_log l
    WHERE l.table_name = 'change_request_comment' AND l.row_uuid = c.crcuuid AND l.old_value IS NULL
      AND CASE WHEN me.db_id IS NOT NULL THEN l.instance_id = me.db_id
               WHEN me.has_non_ship_logs THEN l.instance_id NOT LIKE 'SHIP-%'
               ELSE true END
  );

WITH me AS (
  SELECT NULLIF((SELECT s.setting_value FROM sync_settings s WHERE s.setting_key = 'instance_id' LIMIT 1), '') AS db_id,
         EXISTS (SELECT 1 FROM sync_field_log x WHERE x.instance_id NOT LIKE 'SHIP-%') AS has_non_ship_logs
)
UPDATE change_request_attachment a
SET change_request_uuid = cr.cruuid
FROM change_request cr, me
WHERE a.change_request_uuid IS NULL
  AND cr.id = a.change_request_id
  AND EXISTS (
    SELECT 1 FROM sync_field_log l
    WHERE l.table_name = 'change_request_attachment' AND l.row_uuid = a.crauuid AND l.old_value IS NULL
      AND CASE WHEN me.db_id IS NOT NULL THEN l.instance_id = me.db_id
               WHEN me.has_non_ship_logs THEN l.instance_id NOT LIKE 'SHIP-%'
               ELSE true END
  );
