-- 134: backfill vessel_id on historic sync_field_log rows for the three join-scoped
-- child tables whose write paths logged vessel_id = NULL (defect_actions,
-- change_request_attachment, change_request_comment). The ongoing gather is
-- `WHERE vessel_id IN (vuuid, code)` — NULL rows are silently dropped, so these
-- tables' past edits never synced. Resolve each log's parent vessel and stamp it,
-- making the stuck history deliverable on the next sync.
--
-- Scope discipline: ONLY these 3 table_names, ONLY WHERE vessel_id IS NULL.
-- Idempotent: a second run matches zero rows (vessel_id no longer NULL).
-- Logs whose data row no longer exists (e.g. hard-deleted defect actions) cannot
-- resolve a parent and remain NULL — unchanged behaviour for them.

UPDATE sync_field_log sfl
SET vessel_id = d.vessel_id
FROM defect_actions da
JOIN defects d ON d.duuid = da.defect_id
WHERE sfl.table_name = 'defect_actions'
  AND sfl.vessel_id IS NULL
  AND sfl.row_uuid = da.dauuid;
--> statement-breakpoint

UPDATE sync_field_log sfl
SET vessel_id = cr.vessel_id
FROM change_request_attachment cra
JOIN change_request cr ON cr.id = cra.change_request_id
WHERE sfl.table_name = 'change_request_attachment'
  AND sfl.vessel_id IS NULL
  AND sfl.row_uuid = cra.crauuid;
--> statement-breakpoint

UPDATE sync_field_log sfl
SET vessel_id = cr.vessel_id
FROM change_request_comment crc
JOIN change_request cr ON cr.id = crc.change_request_id
WHERE sfl.table_name = 'change_request_comment'
  AND sfl.vessel_id IS NULL
  AND sfl.row_uuid = crc.crcuuid;
