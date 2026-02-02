-- Migration: Add mandatory columns (uuid, is_deleted, created_at, updated_at, updated_by) 
-- to all tables using PostgreSQL 13+ native gen_random_uuid()
-- Run this migration to sync database with schema.ts mandatory columns

-- =====================================================
-- CORE TABLES
-- =====================================================

-- components (already has updated_at, created_at)
ALTER TABLE components ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE components ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE components ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- jobs (already has updated_at, created_at)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- work_orders (already has updated_at, created_at)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- work_order_executions
ALTER TABLE work_order_executions ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE work_order_executions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE work_order_executions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE work_order_executions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE work_order_executions ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- spares (already has is_deleted after rename, created_at, updated_at, updated_by)
ALTER TABLE spares ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- stores_items (already has is_deleted after rename)
ALTER TABLE stores_items ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE stores_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE stores_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE stores_items ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- defects
ALTER TABLE defects ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE defects ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- defect_actions
ALTER TABLE defect_actions ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE defect_actions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE defect_actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE defect_actions ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- defect_attachments
ALTER TABLE defect_attachments ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE defect_attachments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE defect_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE defect_attachments ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- =====================================================
-- FLEET TABLES
-- =====================================================

-- fleet_equipment_master
ALTER TABLE fleet_equipment_master ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE fleet_equipment_master ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet_equipment_master ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- fleet_vessel_mapping
ALTER TABLE fleet_vessel_mapping ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE fleet_vessel_mapping ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet_vessel_mapping ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_vessel_mapping ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_vessel_mapping ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- fleet_component_mapping
ALTER TABLE fleet_component_mapping ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE fleet_component_mapping ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet_component_mapping ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_component_mapping ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_component_mapping ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- fleet_job_vessel_mapping
ALTER TABLE fleet_job_vessel_mapping ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE fleet_job_vessel_mapping ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet_job_vessel_mapping ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_job_vessel_mapping ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_job_vessel_mapping ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- fleet_spare_vessel_mapping
ALTER TABLE fleet_spare_vessel_mapping ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE fleet_spare_vessel_mapping ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet_spare_vessel_mapping ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_spare_vessel_mapping ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE fleet_spare_vessel_mapping ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- fleets
ALTER TABLE fleets ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE fleets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleets ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- fleet_groups
ALTER TABLE fleet_groups ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE fleet_groups ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fleet_groups ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- =====================================================
-- INVENTORY TABLES
-- =====================================================

-- locations
ALTER TABLE locations ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE locations ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- spare_component_links
ALTER TABLE spare_component_links ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE spare_component_links ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE spare_component_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE spare_component_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE spare_component_links ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- spare_location_stock
ALTER TABLE spare_location_stock ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE spare_location_stock ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE spare_location_stock ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE spare_location_stock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE spare_location_stock ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- inventory_transactions (IMMUTABLE audit - only uuid and created_at)
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();

-- job_component_links
ALTER TABLE job_component_links ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE job_component_links ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE job_component_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE job_component_links ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- =====================================================
-- MASTER DATA TABLES
-- =====================================================

-- makers
ALTER TABLE makers ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE makers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE makers ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- master_lists
ALTER TABLE master_lists ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE master_lists ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_lists ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- maker_list
ALTER TABLE maker_list ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE maker_list ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE maker_list ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- sfi_details
ALTER TABLE sfi_details ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sfi_details ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sfi_details ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- master_data
ALTER TABLE master_data ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE master_data ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_data ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- equipment_categories
ALTER TABLE equipment_categories ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE equipment_categories ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE equipment_categories ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- defect_categories
ALTER TABLE defect_categories ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE defect_categories ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE defect_categories ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- defect_types
ALTER TABLE defect_types ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE defect_types ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE defect_types ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- =====================================================
-- CERTIFICATE & SURVEY TABLES
-- =====================================================

-- certificates
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- surveys
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- work_order_execution_details
ALTER TABLE work_order_execution_details ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE work_order_execution_details ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE work_order_execution_details ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ship_certificates_master
ALTER TABLE ship_certificates_master ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE ship_certificates_master ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ship_certificates_master ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ship_certificates_labels_config
ALTER TABLE ship_certificates_labels_config ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE ship_certificates_labels_config ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ship_certificates_labels_config ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- vessel_certificate_applicability
ALTER TABLE vessel_certificate_applicability ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE vessel_certificate_applicability ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vessel_certificate_applicability ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- vessel_certificate_data
ALTER TABLE vessel_certificate_data ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE vessel_certificate_data ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vessel_certificate_data ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ship_surveys_master
ALTER TABLE ship_surveys_master ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE ship_surveys_master ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ship_surveys_master ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ship_surveys_labels_config
ALTER TABLE ship_surveys_labels_config ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE ship_surveys_labels_config ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ship_surveys_labels_config ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- vessel_survey_applicability
ALTER TABLE vessel_survey_applicability ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE vessel_survey_applicability ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vessel_survey_applicability ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- vessel_survey_data
ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- =====================================================
-- BULK IMPORT TABLES
-- =====================================================

-- bulk_import_history
ALTER TABLE bulk_import_history ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE bulk_import_history ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bulk_import_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE bulk_import_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE bulk_import_history ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- bulk_import_errors (IMMUTABLE audit - only uuid and created_at)
ALTER TABLE bulk_import_errors ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- =====================================================
-- IMMUTABLE AUDIT TABLES (only uuid and created_at, no is_deleted/updated_at)
-- =====================================================

-- audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- component_maintenance_history
ALTER TABLE component_maintenance_history ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- component_running_hours_log
ALTER TABLE component_running_hours_log ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- running_hours_audit
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- spares_history
ALTER TABLE spares_history ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- stores_ledger
ALTER TABLE stores_ledger ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- import_change_log
ALTER TABLE import_change_log ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- import_history
ALTER TABLE import_history ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE import_history ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE import_history ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- =====================================================
-- ADDITIONAL TABLES
-- =====================================================

-- vessels
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- vessel_types
ALTER TABLE vessel_types ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE vessel_types ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vessel_types ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ports
ALTER TABLE ports ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE ports ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- master_users
ALTER TABLE master_users ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE master_users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_users ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- pms_vessel_settings
ALTER TABLE pms_vessel_settings ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE pms_vessel_settings ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pms_vessel_settings ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- component_documents
ALTER TABLE component_documents ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE component_documents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE component_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE component_documents ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- component_class_regulatory
ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE component_class_regulatory ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- component_requisitions
ALTER TABLE component_requisitions ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE component_requisitions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE component_requisitions ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- recurring_defects
ALTER TABLE recurring_defects ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE recurring_defects ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE recurring_defects ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- recurring_defect_links
ALTER TABLE recurring_defect_links ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE recurring_defect_links ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE recurring_defect_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE recurring_defect_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE recurring_defect_links ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- defect_sequences
ALTER TABLE defect_sequences ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE defect_sequences ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE defect_sequences ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE defect_sequences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE defect_sequences ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ihm_items
ALTER TABLE ihm_items ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE ihm_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ihm_items ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ihm_maintenance_log (IMMUTABLE audit)
ALTER TABLE ihm_maintenance_log ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- additional_groups
ALTER TABLE additional_groups ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE additional_groups ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE additional_groups ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- form_definitions
ALTER TABLE form_definitions ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE form_definitions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE form_definitions ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- form_versions
ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- form_version_usage
ALTER TABLE form_version_usage ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE form_version_usage ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE form_version_usage ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- change_request
ALTER TABLE change_request ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE change_request ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE change_request ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- change_request_comment
ALTER TABLE change_request_comment ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE change_request_comment ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE change_request_comment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE change_request_comment ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- change_request_attachment
ALTER TABLE change_request_attachment ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE change_request_attachment ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE change_request_attachment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE change_request_attachment ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- alert_policies
ALTER TABLE alert_policies ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE alert_policies ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE alert_policies ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- alert_config
ALTER TABLE alert_config ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE alert_config ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE alert_config ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- alert_events (IMMUTABLE audit)
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- alert_deliveries (IMMUTABLE audit)
ALTER TABLE alert_deliveries ADD COLUMN IF NOT EXISTS uuid TEXT NOT NULL DEFAULT gen_random_uuid();

-- Migration complete
SELECT 'Migration completed: Added mandatory columns (uuid, is_deleted, created_at, updated_at, updated_by) to all tables' AS status;
