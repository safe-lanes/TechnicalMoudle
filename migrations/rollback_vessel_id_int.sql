-- ROLLBACK SCRIPT: Revert vessel integer ID migration
-- Run this to undo Phase 4 and restore UUID-only vessel identification
-- Safe to run at any point during or after the migration

-- Step 0: Drop all sync triggers first
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_alert_config ON alert_config;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_alert_events ON alert_events;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_certificates ON certificates;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_change_request ON change_request;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_components ON components;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_defect_sequences ON defect_sequences;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_defects ON defects;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_ihm_items ON ihm_items;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_ihm_maintenance_log ON ihm_maintenance_log;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_import_history ON import_history;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_inventory_transactions ON inventory_transactions;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_job_component_links ON job_component_links;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_jobs ON jobs;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_locations ON locations;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_pms_vessel_settings ON pms_vessel_settings;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_running_hours_audit ON running_hours_audit;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_spare_component_links ON spare_component_links;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_spare_location_stock ON spare_location_stock;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_spares ON spares;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_spares_history ON spares_history;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_stores_items ON stores_items;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_stores_ledger ON stores_ledger;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_surveys ON surveys;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_users ON users;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_vessel_cert_app ON vessel_certificate_applicability;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_vessel_cert_data ON vessel_certificate_data;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_vessel_surv_app ON vessel_survey_applicability;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_vessel_surv_data ON vessel_survey_data;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_wo_exec_details ON work_order_execution_details;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_wo_executions ON work_order_executions;
DROP TRIGGER IF EXISTS trg_sync_vessel_id_int_work_orders ON work_orders;

-- Drop the trigger function
DROP FUNCTION IF EXISTS sync_vessel_id_int();

-- Step 1: Drop vessel_id_int from all 31 FK tables
ALTER TABLE alert_config DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE alert_events DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE certificates DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE change_request DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE components DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE defect_sequences DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE defects DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE ihm_items DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE ihm_maintenance_log DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE import_history DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE job_component_links DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE jobs DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE locations DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE pms_vessel_settings DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE running_hours_audit DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE spare_component_links DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE spare_location_stock DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE spares DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE spares_history DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE stores_items DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE stores_ledger DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE surveys DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE users DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE vessel_certificate_applicability DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE vessel_certificate_data DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE vessel_survey_applicability DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE vessel_survey_data DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE work_order_execution_details DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE work_order_executions DROP COLUMN IF EXISTS vessel_id_int;
ALTER TABLE work_orders DROP COLUMN IF EXISTS vessel_id_int;

-- Step 2: Drop id_int from vessels table
DROP INDEX IF EXISTS vessels_id_int_uq;
ALTER TABLE vessels DROP COLUMN IF EXISTS id_int;

-- Step 3: Drop the sequence created by SERIAL
DROP SEQUENCE IF EXISTS vessels_id_int_seq;

-- After running this rollback:
-- 1. Revert shared/schema.ts to remove idInt and vesselIdInt references
-- 2. Revert shared/v2/*/schema.ts to remove vesselIdInt references
-- 3. Restart the application
