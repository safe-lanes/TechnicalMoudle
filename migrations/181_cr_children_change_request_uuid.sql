-- 13-Oct-2026 (Testvessel follow-up): change request comments and attachments linked to their change request ONLY
-- by its LOCAL integer id (change_request_id). That number is assigned separately on shore and on each ship, so a
-- synced comment/attachment kept the SENDER's number and landed on no change request, or on a different one
-- (proven on the shore+ship pilot). Add the change request's UUID — the same everywhere — so sync can resolve the
-- local id from it (server/modules/sync/oneWayApplier.ts PARENT_UUID_LINKS).
--
-- Additive and idempotent: nullable columns, IF NOT EXISTS, backfill only where still NULL.

ALTER TABLE change_request_comment    ADD COLUMN IF NOT EXISTS change_request_uuid TEXT;
ALTER TABLE change_request_attachment ADD COLUMN IF NOT EXISTS change_request_uuid TEXT;

-- Backfill ONLY rows this instance created itself (its own creation field log, written under this instance's id):
-- for those the local change_request_id is right. Rows received from the other side carry the SENDER's number,
-- which may name a different change request here — they stay NULL (unknown) instead of being fixed to a wrong
-- parent. Without a DB instance_id nothing is backfilled. NULL rows keep today's behaviour.
UPDATE change_request_comment c
SET change_request_uuid = cr.cruuid
FROM change_request cr
WHERE c.change_request_uuid IS NULL
  AND cr.id = c.change_request_id
  AND EXISTS (
    SELECT 1 FROM sync_field_log l
    WHERE l.table_name = 'change_request_comment' AND l.row_uuid = c.crcuuid AND l.old_value IS NULL
      AND l.instance_id = (SELECT s.setting_value FROM sync_settings s
                           WHERE s.setting_key = 'instance_id' AND coalesce(s.setting_value, '') <> '' LIMIT 1)
  );

UPDATE change_request_attachment a
SET change_request_uuid = cr.cruuid
FROM change_request cr
WHERE a.change_request_uuid IS NULL
  AND cr.id = a.change_request_id
  AND EXISTS (
    SELECT 1 FROM sync_field_log l
    WHERE l.table_name = 'change_request_attachment' AND l.row_uuid = a.crauuid AND l.old_value IS NULL
      AND l.instance_id = (SELECT s.setting_value FROM sync_settings s
                           WHERE s.setting_key = 'instance_id' AND coalesce(s.setting_value, '') <> '' LIMIT 1)
  );
