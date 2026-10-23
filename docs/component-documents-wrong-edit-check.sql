-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Component documents — find edits that the OLD sync applied to the WRONG document (READ-ONLY, SELECT only).
-- Written 14-Oct-2026. Background: before the fix, a document's sync key was its row number, which differs between
-- the office and the ship. An edit made on one side (notes, version, ship view/download, active) could land on a
-- DIFFERENT document on the other side. Proven on the shore+ship pilot.
--
-- Replace VESSEL_UUID (the vessel's vuuid) everywhere, then run PART A on the office (the client's tenant DB) and
-- PART B on that vessel's ship. Send both outputs back; the comparison is by document number.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION READ ONLY;

-- ═══ PART A — OFFICE database ═══

-- A1. Edits RECEIVED FROM THE SHIP (old version, keyed by the ship's row number), with the office document that
--     has that same number today. If PART B shows a different file for that number on the ship, this office
--     document received an edit meant for another document.
SELECT l.instance_id                 AS from_ship,
       l.row_uuid::int               AS doc_no,
       l.field_name, l.old_value, l.new_value, l.changed_at,
       d.file_key                    AS office_file_at_this_no,
       left(d.file_name, 60)         AS office_doc_at_this_no
FROM sync_field_log l
LEFT JOIN component_documents d ON d.id::text = l.row_uuid
WHERE l.table_name = 'component_documents'
  AND l.instance_id LIKE 'SHIP-%'
  AND l.row_uuid ~ '^[0-9]+$'
  AND NOT EXISTS (                                  -- an edit, not part of the document's creation
        SELECT 1 FROM sync_field_log c
        WHERE c.table_name = l.table_name AND c.row_uuid = l.row_uuid AND c.instance_id = l.instance_id
          AND c.field_name = 'fileKey' AND c.changed_at = l.changed_at)
  AND l.vessel_id = 'VESSEL_UUID'
ORDER BY l.changed_at;

-- A2. Edits MADE IN THE OFFICE (keyed by the office row number), with the file of that office document. If PART B
--     shows a different file for that number on the ship, the ship applied this edit to another document.
SELECT l.row_uuid::int               AS doc_no,
       l.field_name, l.old_value, l.new_value, l.changed_at,
       d.file_key                    AS office_file,
       left(d.file_name, 60)         AS office_doc
FROM sync_field_log l
JOIN component_documents d ON d.id::text = l.row_uuid
WHERE l.table_name = 'component_documents'
  AND l.instance_id NOT LIKE 'SHIP-%'
  AND l.row_uuid ~ '^[0-9]+$'
  AND NOT EXISTS (                                  -- an edit, not part of the document's creation
        SELECT 1 FROM sync_field_log c
        WHERE c.table_name = l.table_name AND c.row_uuid = l.row_uuid AND c.instance_id = l.instance_id
          AND c.field_name = 'fileKey' AND c.changed_at = l.changed_at)
  AND d.vessel_code = 'VESSEL_UUID'
ORDER BY l.changed_at;

-- A3. Every document of the vessel in the office (number, file) — used to find the INTENDED document by its file.
SELECT id AS doc_no, file_key, left(file_name, 60) AS file_name, coalesce(notes, '') AS notes, version,
       can_ship_view, can_ship_download, is_active
FROM component_documents WHERE vessel_code = 'VESSEL_UUID' ORDER BY id;

-- ═══ PART B — SHIP database ═══

-- B1. Every document on the ship (number, file, current values).
SELECT id AS doc_no, file_key, left(file_name, 60) AS file_name, coalesce(notes, '') AS notes, version,
       can_ship_view, can_ship_download, is_active
FROM component_documents ORDER BY id;

ROLLBACK;

-- CAVEAT: document numbers belong to the CURRENT ship installation. If the ship was set up again (re-provisioned),
-- only compare A1/A2 rows changed AFTER that setup date — older rows used the previous installation's numbers.
-- Tested 14-Oct-2026 on the pilot: an old-version ship edit of a shared document (ship no. 1, office no. 10) was
-- applied in the office to document no. 1 (a different document); A1 + B1 flag exactly that row.
--
-- HOW TO READ: for each A1 row, find doc_no in B1. Same file_key → the edit landed on the right document.
-- Different file_key → the office document "office_doc_at_this_no" received an edit meant for the ship's document
-- with B1.file_key (which in the office is the A3 row with that file_key). A2 is the same check the other way round.
