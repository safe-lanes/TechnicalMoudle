-- Add unique constraint on adm_menumaster_ac.name for data integrity
-- The name column is used as a business key for lookups throughout the application

CREATE UNIQUE INDEX IF NOT EXISTS adm_menumaster_ac_name_key ON adm_menumaster_ac (name);
