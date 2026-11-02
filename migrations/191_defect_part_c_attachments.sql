-- Schema only. Existing closure evidence stays in its original collection.
ALTER TABLE defects ADD COLUMN IF NOT EXISTS part_c_attachments json DEFAULT '[]'::json;
