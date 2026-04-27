-- Migration: 003_equipment_categories_defaults
-- Description: Inserts default equipment categories if table is empty

INSERT INTO equipment_categories (name, sort_order)
SELECT name, sort_order FROM (VALUES
  ('Hull', 1),
  ('Cargo & Tank Cleaning', 2),
  ('Navigation', 3),
  ('Communication', 4),
  ('Anchoring & Mooring', 5),
  ('Safety - LSA FFA Emg Med', 6),
  ('Machinery Spaces', 7),
  ('Electrical', 8),
  ('Other', 9)
) AS defaults(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM equipment_categories LIMIT 1);
