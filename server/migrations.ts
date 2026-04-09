import { sql } from 'drizzle-orm';
import { resolvePostgres } from './postgresClient';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface Migration {
  id: string;
  name: string;
  description: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: '001_date_reported_to_office',
    name: 'Add date_reported_to_office column to defects',
    description: 'Adds the date_reported_to_office column to the defects table for tracking when defects are reported to office',
    sql: `ALTER TABLE defects ADD COLUMN IF NOT EXISTS date_reported_to_office TEXT`
  },
  {
    id: '002_equipment_categories_table',
    name: 'Create equipment_categories table',
    description: 'Creates the equipment_categories table for admin-managed equipment categorization',
    sql: `
      CREATE TABLE IF NOT EXISTS equipment_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
  },
  {
    id: '003_equipment_categories_defaults',
    name: 'Seed default equipment categories',
    description: 'Inserts default equipment categories if table is empty',
    sql: `
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
      WHERE NOT EXISTS (SELECT 1 FROM equipment_categories LIMIT 1)
    `
  },
  {
    id: '004_sire_hardware_columns',
    name: 'Add SIRE hardware columns to defects',
    description: 'Adds the SIRE hardware class columns to the defects table for SIRE 2.0 Annex 1 categorization',
    sql: `
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_id TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_level1 TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_level2 TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_level3 TEXT
    `
  },
  {
    id: '005_component_hardware_columns',
    name: 'Add component hardware columns to defects',
    description: 'Adds component SIRE hardware class columns for Part A of the defect form',
    sql: `
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_id TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_level1 TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_level2 TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_level3 TEXT
    `
  },
  {
    id: '006_defect_additional_columns',
    name: 'Add remaining missing defect columns',
    description: 'Adds risk_level, date_registered_in_system, and other missing columns to defects table',
    sql: `
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS risk_level TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS date_registered_in_system TEXT
    `
  },
  {
    id: '007_defect_categories_table',
    name: 'Create defect_categories table',
    description: 'Creates the defect_categories table for admin-managed defect type categorization',
    sql: `
      CREATE TABLE IF NOT EXISTS defect_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
  },
  {
    id: '008_defect_categories_defaults',
    name: 'Seed default defect categories',
    description: 'Inserts default defect categories if table is empty',
    sql: `
      INSERT INTO defect_categories (name, sort_order)
      SELECT name, sort_order FROM (VALUES
        ('Hull / Structural Integrity', 1),
        ('Machinery Failure (Main & Auxiliary)', 2),
        ('Electrical / Electronic Systems', 3),
        ('Navigation & Communication Equipment', 4),
        ('Safety & Emergency Systems (Fire, Lifesaving, Alarms)', 5),
        ('Ballast / Cargo / Tank Systems', 6),
        ('Environmental / Pollution Control (e.g., BWM, SOx, OWS)', 7),
        ('Steering / Rudder / Propulsion Systems', 8),
        ('Deck Equipment & Mooring Systems', 9),
        ('Condition of Class (CoC) Related', 10),
        ('Survey / Certification Deficiencies', 11),
        ('Wear & Tear / Corrosion / Fatigue', 12),
        ('Human-/Operational Error (not equipment fault)', 13),
        ('Other / Miscellaneous', 14)
      ) AS defaults(name, sort_order)
      WHERE NOT EXISTS (SELECT 1 FROM defect_categories LIMIT 1)
    `
  },
  {
    id: '009_defect_types_table',
    name: 'Create defect_types table',
    description: 'Creates the defect_types table for admin-managed defect type classification',
    sql: `
      CREATE TABLE IF NOT EXISTS defect_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
  },
  {
    id: '010_defect_types_defaults',
    name: 'Seed default defect types',
    description: 'Inserts default defect types if table is empty',
    sql: `
      INSERT INTO defect_types (name, sort_order)
      SELECT name, sort_order FROM (VALUES
        ('Corrosion / Erosion', 1),
        ('Crack / Fracture / Structural Deformation', 2),
        ('Bearing / Shaft / Gear Failure', 3),
        ('Pump / Compressor / Turbine Malfunction', 4),
        ('Valve / Seal / Gasket Leak', 5),
        ('Electrical Short / Open Circuit / Ground Fault', 6),
        ('Control System / Automation Failure', 7),
        ('Sensor / Instrumentation Fault', 8),
        ('Navigation / Communication System Fault', 9),
        ('Safety Equipment Deficiency (Fire / Lifeboat / Alarm)', 10),
        ('Ballast / Cargo / Tank System Defect', 11),
        ('Steering / Rudder / Propulsion System Defect', 12),
        ('Mooring / Deck Equipment Failure', 13),
        ('Environmental Compliance Issue (BWM / SOx / OWS)', 14),
        ('Non-Conformity / Certification Lapse', 15),
        ('Inspection / Test Failure', 16),
        ('Software / Firmware / Interface Error', 17),
        ('Recurring Fault (same equipment/system)', 18),
        ('Operational / Human Error Induced Defect', 19),
        ('Documentation / Record-Keeping Defect', 20),
        ('Wear / Fatigue – Non-critical', 21),
        ('Survey Condition of Class Item', 22),
        ('Spare / Stock-Out / BOM Defect', 23),
        ('Other / Miscellaneous', 24)
      ) AS defaults(name, sort_order)
      WHERE NOT EXISTS (SELECT 1 FROM defect_types LIMIT 1)
    `
  },
  {
    id: '011_c1_c2_closeout_columns',
    name: 'Add C1 Closeout and C2 Verification columns',
    description: 'Adds columns for C1 Closeout (closedOutByName, closedOutByRank) and C2 Verification (verified, dateVerified, verifiedByName, verifiedByOfficePosition) to defects table',
    sql: `
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_out_by_name TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_out_by_rank TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS date_verified TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified_by_name TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified_by_office_position TEXT
    `
  },
  {
    id: '012_running_hours_renewal_columns',
    name: 'Add renewal/replacement tracking columns to running_hours_audit',
    description: 'Adds columns for tracking component renewals/replacements when RH is reset to 0, plus component identification fields',
    sql: `
      ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS is_renewal_reset BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_action_type TEXT;
      ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_reason TEXT;
      ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_reference TEXT;
      ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_evidence_urls JSON;
      ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS component_code TEXT;
      ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS component_name TEXT;
      CREATE INDEX IF NOT EXISTS idx_renewal_reset ON running_hours_audit (is_renewal_reset, vessel_id)
    `
  },
  {
    id: '013_ship_certificates_master_table',
    name: 'Create ship_certificates_master table for Admin configuration',
    description: 'Creates the admin configuration table for master certificate definitions used by Cert & Surveys module',
    sql: `
      CREATE TABLE IF NOT EXISTS ship_certificates_master (
        id SERIAL PRIMARY KEY,
        sequence INTEGER NOT NULL,
        master_id TEXT NOT NULL UNIQUE,
        certificate_name TEXT NOT NULL,
        category TEXT NOT NULL,
        "group" TEXT NOT NULL,
        requirement_ref TEXT,
        applicable_to_company BOOLEAN NOT NULL DEFAULT false,
        certificate_label TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ship_cert_master_sequence ON ship_certificates_master (sequence);
      CREATE INDEX IF NOT EXISTS idx_ship_cert_master_category ON ship_certificates_master (category);
      CREATE INDEX IF NOT EXISTS idx_ship_cert_master_group ON ship_certificates_master ("group")
    `
  },
  {
    id: '014_ship_certificates_labels_config',
    name: 'Create ship_certificates_labels_config table',
    description: 'Stores category and group label configuration for Ship Certificates Admin module',
    sql: `
      CREATE TABLE IF NOT EXISTS ship_certificates_labels_config (
        id SERIAL PRIMARY KEY,
        config_type TEXT NOT NULL,
        key TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(config_type, key)
      );
      CREATE INDEX IF NOT EXISTS idx_ship_cert_labels_config_type ON ship_certificates_labels_config (config_type)
    `
  },
  {
    id: '015_ship_certificates_company_columns',
    name: 'Add company-specific columns to ship_certificates_master',
    description: 'Adds companyId, companyGroup, and companySequence columns for Company tab persistence',
    sql: `
      ALTER TABLE ship_certificates_master ADD COLUMN IF NOT EXISTS company_id TEXT;
      ALTER TABLE ship_certificates_master ADD COLUMN IF NOT EXISTS company_group TEXT;
      ALTER TABLE ship_certificates_master ADD COLUMN IF NOT EXISTS company_sequence INTEGER
    `
  },
  {
    id: '016_vessel_certificate_applicability_table',
    name: 'Create vessel_certificate_applicability table',
    description: 'Creates table to track which certificates are applicable for each vessel',
    sql: `
      CREATE TABLE IF NOT EXISTS vessel_certificate_applicability (
        id SERIAL PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        vessel_name TEXT NOT NULL,
        master_id TEXT NOT NULL,
        is_applicable BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(vessel_id, master_id)
      );
      CREATE INDEX IF NOT EXISTS idx_vessel_cert_vessel_master ON vessel_certificate_applicability(vessel_id, master_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_cert_vessel ON vessel_certificate_applicability(vessel_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_cert_master ON vessel_certificate_applicability(master_id)
    `
  },
  {
    id: '017_vessel_certificate_data_table',
    name: 'Create vessel_certificate_data table',
    description: 'Creates table to store vessel-specific certificate data (dates, attachments) for Cert & Surveys module',
    sql: `
      CREATE TABLE IF NOT EXISTS vessel_certificate_data (
        id SERIAL PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        vessel_name TEXT NOT NULL,
        master_id TEXT NOT NULL,
        issue_date TEXT,
        expiry_date TEXT,
        last_annual TEXT,
        last_interm TEXT,
        endorsement_date TEXT,
        last_edit_upload TEXT,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(vessel_id, master_id)
      );
      CREATE INDEX IF NOT EXISTS idx_vessel_cert_data_vessel_master ON vessel_certificate_data(vessel_id, master_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_cert_data_vessel ON vessel_certificate_data(vessel_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_cert_data_master ON vessel_certificate_data(master_id)
    `
  },
  {
    id: '018_ship_surveys_master_table',
    name: 'Create ship_surveys_master table for Admin configuration',
    description: 'Creates the admin configuration table for master survey definitions used by Cert & Surveys module',
    sql: `
      CREATE TABLE IF NOT EXISTS ship_surveys_master (
        id SERIAL PRIMARY KEY,
        sequence INTEGER NOT NULL,
        master_id TEXT NOT NULL UNIQUE,
        survey_name TEXT NOT NULL,
        category TEXT NOT NULL,
        "group" TEXT NOT NULL,
        requirement_ref TEXT,
        applicable_to_company BOOLEAN NOT NULL DEFAULT false,
        survey_label TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        company_id TEXT,
        company_group TEXT,
        company_sequence INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ship_survey_master_sequence ON ship_surveys_master (sequence);
      CREATE INDEX IF NOT EXISTS idx_ship_survey_master_category ON ship_surveys_master (category);
      CREATE INDEX IF NOT EXISTS idx_ship_survey_master_group ON ship_surveys_master ("group")
    `
  },
  {
    id: '019_ship_surveys_labels_config',
    name: 'Create ship_surveys_labels_config table',
    description: 'Stores category and group label configuration for Ship Surveys Admin module',
    sql: `
      CREATE TABLE IF NOT EXISTS ship_surveys_labels_config (
        id SERIAL PRIMARY KEY,
        config_type TEXT NOT NULL,
        key TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(config_type, key)
      );
      CREATE INDEX IF NOT EXISTS idx_ship_survey_labels_config_type ON ship_surveys_labels_config (config_type)
    `
  },
  {
    id: '020_vessel_survey_applicability_table',
    name: 'Create vessel_survey_applicability table',
    description: 'Creates table to track which surveys are applicable for each vessel',
    sql: `
      CREATE TABLE IF NOT EXISTS vessel_survey_applicability (
        id SERIAL PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        vessel_name TEXT NOT NULL,
        master_id TEXT NOT NULL,
        is_applicable BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(vessel_id, master_id)
      );
      CREATE INDEX IF NOT EXISTS idx_vessel_survey_vessel_master ON vessel_survey_applicability(vessel_id, master_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_survey_vessel ON vessel_survey_applicability(vessel_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_survey_master ON vessel_survey_applicability(master_id)
    `
  },
  {
    id: '021_vessel_survey_data_table',
    name: 'Create vessel_survey_data table',
    description: 'Creates table to store vessel-specific survey data (dates, attachments) for Cert & Surveys module',
    sql: `
      CREATE TABLE IF NOT EXISTS vessel_survey_data (
        id SERIAL PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        vessel_name TEXT NOT NULL,
        master_id TEXT NOT NULL,
        last_survey_date TEXT,
        next_due_date TEXT,
        survey_window TEXT,
        status TEXT,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(vessel_id, master_id)
      );
      CREATE INDEX IF NOT EXISTS idx_vessel_survey_data_vessel_master ON vessel_survey_data(vessel_id, master_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_survey_data_vessel ON vessel_survey_data(vessel_id);
      CREATE INDEX IF NOT EXISTS idx_vessel_survey_data_master ON vessel_survey_data(master_id)
    `
  },
  {
    id: '022_vessel_survey_data_columns_update',
    name: 'Update vessel_survey_data columns for Surveys page',
    description: 'Alters vessel_survey_data table to use correct date column names matching the Surveys page UI',
    sql: `
      ALTER TABLE vessel_survey_data DROP COLUMN IF EXISTS last_survey_date;
      ALTER TABLE vessel_survey_data DROP COLUMN IF EXISTS next_due_date;
      ALTER TABLE vessel_survey_data DROP COLUMN IF EXISTS survey_window;
      ALTER TABLE vessel_survey_data DROP COLUMN IF EXISTS status;
      ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS survey_date TEXT;
      ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS due_date TEXT;
      ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS first_range_date TEXT;
      ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS second_range_date TEXT;
      ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS postponed TEXT;
      ALTER TABLE vessel_survey_data ADD COLUMN IF NOT EXISTS last_edit_upload TEXT
    `
  },
  {
    id: '023_work_orders_was_rejected',
    name: 'Add was_rejected column to work_orders',
    description: 'Adds was_rejected boolean column to track if work order was previously rejected (for red font display)',
    sql: `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS was_rejected BOOLEAN DEFAULT false NOT NULL`
  },
  {
    id: '024_defects_verification_columns',
    name: 'Add defect verification and closure columns',
    description: 'Adds verification, closure, and target date extension columns to defects table',
    sql: `
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_out_by_name TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_out_by_rank TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS date_verified TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified_by_name TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified_by_office_position TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS part_a_attachments JSON DEFAULT '[]'::json;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS confirm_completed BOOLEAN DEFAULT false;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_by_name TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_by_rank TEXT;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS target_date_extensions JSON DEFAULT '[]'::json;
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS target_date_extended BOOLEAN DEFAULT false
    `
  },
  {
    id: '025_stores_ihm_columns',
    name: 'Add IHM columns to stores_items',
    description: 'Adds IHM presence and evidence type columns to stores_items table',
    sql: `
      ALTER TABLE stores_items ADD COLUMN IF NOT EXISTS ihm_presence TEXT DEFAULT 'Unknown';
      ALTER TABLE stores_items ADD COLUMN IF NOT EXISTS ihm_evidence_type TEXT DEFAULT 'None'
    `
  },
  {
    id: '026_fix_defects_vessel_id_format',
    name: 'Fix defects vessel_id format',
    description: 'Updates legacy vessel_id values (vessel1, vessel2, vessel3) to proper UUID format for data consistency',
    sql: `
      UPDATE defects SET vessel_id = '743ef9d1-841a-11ed-aa7c-7003bca91a86' WHERE vessel_id = 'vessel1';
      UPDATE defects SET vessel_id = '743feb08-841a-11ed-aa7c-7003bca91a86' WHERE vessel_id = 'vessel2';
      UPDATE defects SET vessel_id = '7440571a-841a-11ed-aa7c-7003bca91a86' WHERE vessel_id = 'vessel3'
    `
  },
  {
    id: '027_vessel_vuuid_column',
    name: 'Add vuuid column to vessels',
    description: 'Adds vuuid (canonical UUID identity) column to vessels table. All child table FK constraints will reference vuuid instead of id.',
    sql: `
      ALTER TABLE vessels ADD COLUMN IF NOT EXISTS vuuid TEXT;
      UPDATE vessels SET vuuid = id WHERE vuuid IS NULL;
      ALTER TABLE vessels ALTER COLUMN vuuid SET NOT NULL;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessels_vuuid_unique') THEN
          ALTER TABLE vessels ADD CONSTRAINT vessels_vuuid_unique UNIQUE(vuuid);
        END IF;
      END $$
    `
  },
  {
    id: '028_vessel_fk_batch1_data_tables',
    name: 'FK constraints batch 1 — 11 tables with data',
    description: 'Cleans up orphaned vessel_id references then adds FK constraints referencing vessels(vuuid) for: components, spares, stores_items, stores_ledger, jobs, work_orders, inventory_transactions, job_component_links, locations, spare_component_links, spare_location_stock',
    sql: `
      UPDATE components SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = components.vessel_id);
      UPDATE spares SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = spares.vessel_id);
      DELETE FROM stores_items WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = stores_items.vessel_id);
      DELETE FROM stores_ledger WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = stores_ledger.vessel_id);
      UPDATE jobs SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = jobs.vessel_id);
      UPDATE work_orders SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = work_orders.vessel_id);
      DELETE FROM inventory_transactions WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = inventory_transactions.vessel_id);
      DELETE FROM job_component_links WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = job_component_links.vessel_id);
      DELETE FROM locations WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = locations.vessel_id);
      DELETE FROM spare_component_links WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = spare_component_links.vessel_id);
      DELETE FROM spare_location_stock WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = spare_location_stock.vessel_id);
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'components_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE components ADD CONSTRAINT components_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE spares ADD CONSTRAINT spares_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_items_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE stores_items ADD CONSTRAINT stores_items_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_ledger_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE stores_ledger ADD CONSTRAINT stores_ledger_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE jobs ADD CONSTRAINT jobs_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE work_orders ADD CONSTRAINT work_orders_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_component_links_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE job_component_links ADD CONSTRAINT job_component_links_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE locations ADD CONSTRAINT locations_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_component_links_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE spare_component_links ADD CONSTRAINT spare_component_links_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_location_stock_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE spare_location_stock ADD CONSTRAINT spare_location_stock_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
      END $$
    `
  },
  {
    id: '029_vessel_fk_batch2_empty_tables',
    name: 'FK constraints batch 2 — 21 remaining tables',
    description: 'Cleans up orphaned vessel_id references then adds FK constraints referencing vessels(vuuid) for all remaining child tables',
    sql: `
      DELETE FROM defect_sequences WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = defect_sequences.vessel_id);
      UPDATE users SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = users.vessel_id);
      DELETE FROM running_hours_audit WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = running_hours_audit.vessel_id);
      DELETE FROM change_request WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = change_request.vessel_id);
      DELETE FROM ihm_items WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = ihm_items.vessel_id);
      DELETE FROM ihm_maintenance_log WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = ihm_maintenance_log.vessel_id);
      DELETE FROM spares_history WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = spares_history.vessel_id);
      DELETE FROM alert_config WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = alert_config.vessel_id);
      UPDATE alert_events SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = alert_events.vessel_id);
      UPDATE certificates SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = certificates.vessel_id);
      DELETE FROM defects WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = defects.vessel_id);
      UPDATE import_history SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = import_history.vessel_id);
      DELETE FROM pms_vessel_settings WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = pms_vessel_settings.vessel_id);
      UPDATE surveys SET vessel_id = NULL WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = surveys.vessel_id);
      DELETE FROM work_order_execution_details WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = work_order_execution_details.vessel_id);
      DELETE FROM work_order_executions WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = work_order_executions.vessel_id);
      DELETE FROM vessel_certificate_applicability WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = vessel_certificate_applicability.vessel_id);
      DELETE FROM vessel_certificate_data WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = vessel_certificate_data.vessel_id);
      DELETE FROM vessel_survey_applicability WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = vessel_survey_applicability.vessel_id);
      DELETE FROM vessel_survey_data WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = vessel_survey_data.vessel_id);
      DELETE FROM work_order_postponements WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = work_order_postponements.vessel_id);
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defect_sequences_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE defect_sequences ADD CONSTRAINT defect_sequences_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE users ADD CONSTRAINT users_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'running_hours_audit_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE running_hours_audit ADD CONSTRAINT running_hours_audit_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_request_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE change_request ADD CONSTRAINT change_request_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ihm_items_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE ihm_items ADD CONSTRAINT ihm_items_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ihm_maintenance_log_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE ihm_maintenance_log ADD CONSTRAINT ihm_maintenance_log_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_history_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE spares_history ADD CONSTRAINT spares_history_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_config_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE alert_config ADD CONSTRAINT alert_config_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_events_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE alert_events ADD CONSTRAINT alert_events_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE certificates ADD CONSTRAINT certificates_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defects_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE defects ADD CONSTRAINT defects_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_history_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE import_history ADD CONSTRAINT import_history_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pms_vessel_settings_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE pms_vessel_settings ADD CONSTRAINT pms_vessel_settings_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'surveys_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE surveys ADD CONSTRAINT surveys_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_execution_details_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE work_order_execution_details ADD CONSTRAINT work_order_execution_details_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_executions_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE work_order_executions ADD CONSTRAINT work_order_executions_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessel_certificate_applicability_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE vessel_certificate_applicability ADD CONSTRAINT vessel_certificate_applicability_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessel_certificate_data_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE vessel_certificate_data ADD CONSTRAINT vessel_certificate_data_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessel_survey_applicability_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE vessel_survey_applicability ADD CONSTRAINT vessel_survey_applicability_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessel_survey_data_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE vessel_survey_data ADD CONSTRAINT vessel_survey_data_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_postponements_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE work_order_postponements ADD CONSTRAINT work_order_postponements_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
      END $$
    `
  },
  {
    id: '030_vessel_fk_report_snapshots',
    name: 'FK constraint for report_snapshots',
    description: 'Cleans up orphaned vessel_id then adds FK constraint for report_snapshots table',
    sql: `
      DELETE FROM report_snapshots WHERE vessel_id IS NOT NULL AND vessel_id != '' AND NOT EXISTS (SELECT 1 FROM vessels WHERE vuuid = report_snapshots.vessel_id);
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_snapshots_vessel_id_vessels_vuuid_fk') THEN
          ALTER TABLE report_snapshots ADD CONSTRAINT report_snapshots_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
      END $$
    `
  },
  {
    id: '031_component_cuuid_column_and_data_migration',
    name: 'Add cuuid column to components + migrate child data',
    description: 'Adds cuuid (canonical UUID identity) column to components table, populates with gen_random_uuid(), then migrates all child table component_id values from COMP-xxx to the new cuuid.',
    sql: `
      -- Step 1: Add cuuid column (nullable first)
      ALTER TABLE components ADD COLUMN IF NOT EXISTS cuuid TEXT;

      -- Step 2: Populate with random UUIDs where null
      UPDATE components SET cuuid = gen_random_uuid()::text WHERE cuuid IS NULL;

      -- Step 3: Set NOT NULL
      ALTER TABLE components ALTER COLUMN cuuid SET NOT NULL;

      -- Step 4: Add UNIQUE constraint
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'components_cuuid_unique') THEN
          ALTER TABLE components ADD CONSTRAINT components_cuuid_unique UNIQUE(cuuid);
        END IF;
      END $$;

      -- Step 5: Migrate child table data (COMP-xxx → cuuid)
      -- Tables with data:
      UPDATE spares SET component_id = c.cuuid FROM components c WHERE spares.component_id = c.id AND spares.component_id IS NOT NULL;
      UPDATE jobs SET component_id = c.cuuid FROM components c WHERE jobs.component_id = c.id AND jobs.component_id IS NOT NULL;
      UPDATE spare_component_links SET component_id = c.cuuid FROM components c WHERE spare_component_links.component_id = c.id;
      UPDATE job_component_links SET component_id = c.cuuid FROM components c WHERE job_component_links.component_id = c.id;

      -- Empty tables (safe no-op):
      UPDATE running_hours_audit SET component_id = c.cuuid FROM components c WHERE running_hours_audit.component_id = c.id AND running_hours_audit.component_id IS NOT NULL;
      UPDATE ihm_items SET component_id = c.cuuid FROM components c WHERE ihm_items.component_id = c.id AND ihm_items.component_id IS NOT NULL;
      UPDATE spares_history SET component_id = c.cuuid FROM components c WHERE spares_history.component_id = c.id AND spares_history.component_id IS NOT NULL;
      UPDATE work_order_executions SET component_id = c.cuuid FROM components c WHERE work_order_executions.component_id = c.id AND work_order_executions.component_id IS NOT NULL;
      UPDATE defects SET component_id = c.cuuid FROM components c WHERE defects.component_id = c.id AND defects.component_id IS NOT NULL;
      UPDATE component_running_hours_log SET component_id = c.cuuid FROM components c WHERE component_running_hours_log.component_id = c.id;
      UPDATE component_documents SET component_id = c.cuuid FROM components c WHERE component_documents.component_id = c.id;
      UPDATE component_class_regulatory SET component_id = c.cuuid FROM components c WHERE component_class_regulatory.component_id = c.id;
      ALTER TABLE component_maintenance_history DISABLE TRIGGER ALL;
      UPDATE component_maintenance_history SET component_id = c.cuuid FROM components c WHERE component_maintenance_history.component_id = c.id;
      ALTER TABLE component_maintenance_history ENABLE TRIGGER ALL;
      UPDATE component_requisitions SET component_id = c.cuuid FROM components c WHERE component_requisitions.component_id = c.id;
      UPDATE fleet_component_mapping SET component_id = c.cuuid FROM components c WHERE fleet_component_mapping.component_id = c.id AND fleet_component_mapping.component_id IS NOT NULL;

      -- Step 6: Migrate self-references (parent_id, rh_master_component_id → cuuid)
      UPDATE components SET parent_id = c2.cuuid FROM components c2 WHERE components.parent_id = c2.id AND components.parent_id IS NOT NULL;
      UPDATE components SET rh_master_component_id = c2.cuuid FROM components c2 WHERE components.rh_master_component_id = c2.id AND components.rh_master_component_id IS NOT NULL
    `
  },
  {
    id: '032_component_fk_batch1_data_tables',
    name: 'FK constraints batch 1 — 4 tables with data',
    description: 'Cleans up orphaned component_id references then adds FK constraints referencing components(cuuid) for: spares, jobs, spare_component_links, job_component_links',
    sql: `
      UPDATE spares SET component_id = NULL WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      UPDATE jobs SET component_id = NULL WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM spare_component_links WHERE component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM job_component_links WHERE component_id NOT IN (SELECT cuuid FROM components);

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_component_id_components_cuuid_fk') THEN
          ALTER TABLE spares ADD CONSTRAINT spares_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_component_id_components_cuuid_fk') THEN
          ALTER TABLE jobs ADD CONSTRAINT jobs_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_component_links_component_id_components_cuuid_fk') THEN
          ALTER TABLE spare_component_links ADD CONSTRAINT spare_component_links_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_component_links_component_id_components_cuuid_fk') THEN
          ALTER TABLE job_component_links ADD CONSTRAINT job_component_links_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
      END $$
    `
  },
  {
    id: '033_component_fk_batch2_empty_tables',
    name: 'FK constraints batch 2 — 11 empty tables',
    description: 'Cleans up orphaned component_id references then adds FK constraints referencing components(cuuid) for remaining tables',
    sql: `
      DELETE FROM running_hours_audit WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM ihm_items WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM spares_history WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM work_order_executions WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM defects WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM component_running_hours_log WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM component_documents WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM component_class_regulatory WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      ALTER TABLE component_maintenance_history DISABLE TRIGGER ALL;
      DELETE FROM component_maintenance_history WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      ALTER TABLE component_maintenance_history ENABLE TRIGGER ALL;
      DELETE FROM component_requisitions WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);
      DELETE FROM fleet_component_mapping WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT cuuid FROM components);

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'running_hours_audit_component_id_components_cuuid_fk') THEN
          ALTER TABLE running_hours_audit ADD CONSTRAINT running_hours_audit_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ihm_items_component_id_components_cuuid_fk') THEN
          ALTER TABLE ihm_items ADD CONSTRAINT ihm_items_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_history_component_id_components_cuuid_fk') THEN
          ALTER TABLE spares_history ADD CONSTRAINT spares_history_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_executions_component_id_components_cuuid_fk') THEN
          ALTER TABLE work_order_executions ADD CONSTRAINT work_order_executions_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defects_component_id_components_cuuid_fk') THEN
          ALTER TABLE defects ADD CONSTRAINT defects_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_running_hours_log_component_id_components_cuuid_fk') THEN
          ALTER TABLE component_running_hours_log ADD CONSTRAINT component_running_hours_log_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_documents_component_id_components_cuuid_fk') THEN
          ALTER TABLE component_documents ADD CONSTRAINT component_documents_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_class_regulatory_component_id_components_cuuid_fk') THEN
          ALTER TABLE component_class_regulatory ADD CONSTRAINT component_class_regulatory_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_maintenance_history_component_id_components_cuuid_fk') THEN
          ALTER TABLE component_maintenance_history ADD CONSTRAINT component_maintenance_history_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_requisitions_component_id_components_cuuid_fk') THEN
          ALTER TABLE component_requisitions ADD CONSTRAINT component_requisitions_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fleet_component_mapping_component_id_components_cuuid_fk') THEN
          ALTER TABLE fleet_component_mapping ADD CONSTRAINT fleet_component_mapping_component_id_components_cuuid_fk FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
      END $$
    `
  },

  // ─── FK-3: JOB IDENTITY RESTRUCTURE ───
  // Jobs use JOB-xxx format IDs. juuid is populated with gen_random_uuid()::text.
  // All 4 child table job_id values are remapped from JOB-xxx → UUID.
  {
    id: '034_job_juuid_column_and_data_migration',
    name: 'Add juuid column to jobs + migrate child data',
    description: 'FK-3 Phase 1: Add juuid UUID column, populate existing rows, migrate 4 child tables',
    sql: `
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS juuid TEXT;
      UPDATE jobs SET juuid = gen_random_uuid()::text WHERE juuid IS NULL;
      ALTER TABLE jobs ALTER COLUMN juuid SET NOT NULL;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_juuid_unique') THEN
          ALTER TABLE jobs ADD CONSTRAINT jobs_juuid_unique UNIQUE(juuid);
        END IF;
      END $$;
      UPDATE work_orders SET job_id = j.juuid FROM jobs j WHERE work_orders.job_id = j.id AND work_orders.job_id IS NOT NULL;
      UPDATE job_component_links SET job_id = j.juuid FROM jobs j WHERE job_component_links.job_id = j.id;
      ALTER TABLE component_maintenance_history DISABLE TRIGGER ALL;
      UPDATE component_maintenance_history SET job_id = j.juuid FROM jobs j WHERE component_maintenance_history.job_id = j.id AND component_maintenance_history.job_id IS NOT NULL;
      ALTER TABLE component_maintenance_history ENABLE TRIGGER ALL;
      UPDATE fleet_job_vessel_mapping SET job_id = j.juuid FROM jobs j WHERE fleet_job_vessel_mapping.job_id = j.id AND fleet_job_vessel_mapping.job_id IS NOT NULL
    `
  },
  {
    id: '035_job_fk_constraints',
    name: 'FK constraints for 4 job child tables',
    description: 'FK-3 Phase 2: Cleans orphaned references then adds FK constraints from all 4 child tables to jobs(juuid)',
    sql: `
      UPDATE work_orders SET job_id = NULL WHERE job_id IS NOT NULL AND job_id NOT IN (SELECT juuid FROM jobs);
      DELETE FROM job_component_links WHERE job_id NOT IN (SELECT juuid FROM jobs);
      ALTER TABLE component_maintenance_history DISABLE TRIGGER ALL;
      UPDATE component_maintenance_history SET job_id = NULL WHERE job_id IS NOT NULL AND job_id NOT IN (SELECT juuid FROM jobs);
      ALTER TABLE component_maintenance_history ENABLE TRIGGER ALL;
      UPDATE fleet_job_vessel_mapping SET job_id = NULL WHERE job_id IS NOT NULL AND job_id NOT IN (SELECT juuid FROM jobs);

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_job_id_jobs_juuid_fk') THEN
          ALTER TABLE work_orders ADD CONSTRAINT work_orders_job_id_jobs_juuid_fk FOREIGN KEY (job_id) REFERENCES jobs(juuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_component_links_job_id_jobs_juuid_fk') THEN
          ALTER TABLE job_component_links ADD CONSTRAINT job_component_links_job_id_jobs_juuid_fk FOREIGN KEY (job_id) REFERENCES jobs(juuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_maintenance_history_job_id_jobs_juuid_fk') THEN
          ALTER TABLE component_maintenance_history ADD CONSTRAINT component_maintenance_history_job_id_jobs_juuid_fk FOREIGN KEY (job_id) REFERENCES jobs(juuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fleet_job_vessel_mapping_job_id_jobs_juuid_fk') THEN
          ALTER TABLE fleet_job_vessel_mapping ADD CONSTRAINT fleet_job_vessel_mapping_job_id_jobs_juuid_fk FOREIGN KEY (job_id) REFERENCES jobs(juuid);
        END IF;
      END $$
    `
  },

  // ─── FK-4: Work Orders Identity Restructure ───────────────────────
  {
    id: '036_work_order_wouuid_column_and_data_migration',
    name: 'Add wouuid column to work_orders + migrate child data',
    description: 'Add wouuid TEXT column, populate with gen_random_uuid(), SET NOT NULL + UNIQUE, migrate 5 child tables',
    sql: `
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS wouuid TEXT;
      UPDATE work_orders SET wouuid = gen_random_uuid()::text WHERE wouuid IS NULL;
      ALTER TABLE work_orders ALTER COLUMN wouuid SET NOT NULL;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_wouuid_unique') THEN
          ALTER TABLE work_orders ADD CONSTRAINT work_orders_wouuid_unique UNIQUE(wouuid);
        END IF;
      END $$;
      UPDATE work_order_executions SET template_id = wo.wouuid FROM work_orders wo WHERE work_order_executions.template_id = wo.id AND work_order_executions.template_id IS NOT NULL;
      UPDATE work_order_execution_details SET work_order_id = wo.wouuid FROM work_orders wo WHERE work_order_execution_details.work_order_id = wo.id AND work_order_execution_details.work_order_id IS NOT NULL;
      UPDATE work_order_postponements SET work_order_id = wo.wouuid FROM work_orders wo WHERE work_order_postponements.work_order_id = wo.id AND work_order_postponements.work_order_id IS NOT NULL;
      ALTER TABLE component_maintenance_history DISABLE TRIGGER ALL;
      UPDATE component_maintenance_history SET work_order_id = wo.wouuid FROM work_orders wo WHERE component_maintenance_history.work_order_id = wo.id AND component_maintenance_history.work_order_id IS NOT NULL;
      ALTER TABLE component_maintenance_history ENABLE TRIGGER ALL;
      UPDATE ihm_maintenance_log SET work_order_id = wo.wouuid FROM work_orders wo WHERE ihm_maintenance_log.work_order_id = wo.id AND ihm_maintenance_log.work_order_id IS NOT NULL
    `
  },
  {
    id: '037_work_order_fk_constraints',
    name: 'FK constraints for 5 work order child tables',
    description: 'Cleans orphaned references then adds FK constraints for 5 work order child tables to work_orders(wouuid)',
    sql: `
      UPDATE work_order_executions SET template_id = NULL WHERE template_id IS NOT NULL AND template_id NOT IN (SELECT wouuid FROM work_orders);
      UPDATE work_order_execution_details SET work_order_id = NULL WHERE work_order_id IS NOT NULL AND work_order_id NOT IN (SELECT wouuid FROM work_orders);
      UPDATE work_order_postponements SET work_order_id = NULL WHERE work_order_id IS NOT NULL AND work_order_id NOT IN (SELECT wouuid FROM work_orders);
      ALTER TABLE component_maintenance_history DISABLE TRIGGER ALL;
      UPDATE component_maintenance_history SET work_order_id = NULL WHERE work_order_id IS NOT NULL AND work_order_id NOT IN (SELECT wouuid FROM work_orders);
      ALTER TABLE component_maintenance_history ENABLE TRIGGER ALL;
      UPDATE ihm_maintenance_log SET work_order_id = NULL WHERE work_order_id IS NOT NULL AND work_order_id NOT IN (SELECT wouuid FROM work_orders);

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_executions_template_id_work_orders_wouuid_fk') THEN
          ALTER TABLE work_order_executions ADD CONSTRAINT work_order_executions_template_id_work_orders_wouuid_fk FOREIGN KEY (template_id) REFERENCES work_orders(wouuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_execution_details_work_order_id_work_orders_wouuid_fk') THEN
          ALTER TABLE work_order_execution_details ADD CONSTRAINT work_order_execution_details_work_order_id_work_orders_wouuid_fk FOREIGN KEY (work_order_id) REFERENCES work_orders(wouuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_postponements_work_order_id_work_orders_wouuid_fk') THEN
          ALTER TABLE work_order_postponements ADD CONSTRAINT work_order_postponements_work_order_id_work_orders_wouuid_fk FOREIGN KEY (work_order_id) REFERENCES work_orders(wouuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_maintenance_history_work_order_id_work_orders_wouuid_fk') THEN
          ALTER TABLE component_maintenance_history ADD CONSTRAINT component_maintenance_history_work_order_id_work_orders_wouuid_fk FOREIGN KEY (work_order_id) REFERENCES work_orders(wouuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ihm_maintenance_log_work_order_id_work_orders_wouuid_fk') THEN
          ALTER TABLE ihm_maintenance_log ADD CONSTRAINT ihm_maintenance_log_work_order_id_work_orders_wouuid_fk FOREIGN KEY (work_order_id) REFERENCES work_orders(wouuid);
        END IF;
      END $$
    `
  },

  // ─── FK-5: Spares Identity Restructure ────────────────────────────
  // Key difference: spares.id is INTEGER, child tables have INTEGER spare_id.
  // We add parallel spare_uuid TEXT columns to child tables.
  {
    id: '038_spare_suuid_column',
    name: 'Add suuid column to spares',
    description: 'Add suuid TEXT column, populate with gen_random_uuid(), SET NOT NULL + UNIQUE',
    sql: `
      ALTER TABLE spares ADD COLUMN IF NOT EXISTS suuid TEXT;
      UPDATE spares SET suuid = gen_random_uuid()::text WHERE suuid IS NULL;
      ALTER TABLE spares ALTER COLUMN suuid SET NOT NULL;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_suuid_unique') THEN
          ALTER TABLE spares ADD CONSTRAINT spares_suuid_unique UNIQUE(suuid);
        END IF;
      END $$
    `
  },
  {
    id: '039_spare_child_uuid_columns_and_fk_constraints',
    name: 'Add spare_uuid columns to 4 child tables + FK constraints',
    description: 'Add spare_uuid TEXT to spares_history, spare_component_links, spare_location_stock, inventory_transactions. Populate from JOIN, add FK constraints.',
    sql: `
      -- spares_history: add spare_uuid, populate, FK
      ALTER TABLE spares_history ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE spares_history sh SET spare_uuid = s.suuid FROM spares s WHERE sh.spare_id = s.id AND sh.spare_uuid IS NULL;

      -- spare_component_links: add spare_uuid, populate, SET NOT NULL, FK
      ALTER TABLE spare_component_links ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE spare_component_links scl SET spare_uuid = s.suuid FROM spares s WHERE scl.spare_id = s.id AND scl.spare_uuid IS NULL;
      ALTER TABLE spare_component_links ALTER COLUMN spare_uuid SET NOT NULL;

      -- spare_location_stock: add spare_uuid, populate, SET NOT NULL, FK
      ALTER TABLE spare_location_stock ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE spare_location_stock sls SET spare_uuid = s.suuid FROM spares s WHERE sls.spare_id = s.id AND sls.spare_uuid IS NULL;
      ALTER TABLE spare_location_stock ALTER COLUMN spare_uuid SET NOT NULL;

      -- inventory_transactions: add spare_uuid, populate, SET NOT NULL, FK
      ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE inventory_transactions it SET spare_uuid = s.suuid FROM spares s WHERE it.spare_id = s.id AND it.spare_uuid IS NULL;
      ALTER TABLE inventory_transactions ALTER COLUMN spare_uuid SET NOT NULL;

      -- FK constraints (idempotent)
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_history_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE spares_history ADD CONSTRAINT spares_history_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_component_links_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE spare_component_links ADD CONSTRAINT spare_component_links_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_location_stock_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE spare_location_stock ADD CONSTRAINT spare_location_stock_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
      END $$
    `
  },
  {
    id: '040_stores_stuuid_column',
    name: 'Add stuuid column to stores_items',
    description: 'Add stuuid TEXT column, populate with gen_random_uuid(), SET NOT NULL + UNIQUE',
    sql: `
      ALTER TABLE stores_items ADD COLUMN IF NOT EXISTS stuuid TEXT;
      UPDATE stores_items SET stuuid = gen_random_uuid()::text WHERE stuuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE stores_items ALTER COLUMN stuuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_items_stuuid_unique') THEN
          ALTER TABLE stores_items ADD CONSTRAINT stores_items_stuuid_unique UNIQUE(stuuid);
        END IF;
      END $$
    `
  },
  {
    id: '041_stores_ledger_store_uuid_and_fk_constraints',
    name: 'Add store_uuid column to stores_ledger + FK constraints',
    description: 'Add store_uuid TEXT to stores_ledger, populate from JOIN, add FK constraints for both store_uuid and item_id.',
    sql: `
      ALTER TABLE stores_ledger ADD COLUMN IF NOT EXISTS store_uuid TEXT;
      UPDATE stores_ledger sl SET store_uuid = si.stuuid FROM stores_items si WHERE sl.item_id = si.id AND sl.store_uuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE stores_ledger ALTER COLUMN store_uuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_ledger_store_uuid_stores_items_stuuid_fk') THEN
          ALTER TABLE stores_ledger ADD CONSTRAINT stores_ledger_store_uuid_stores_items_stuuid_fk FOREIGN KEY (store_uuid) REFERENCES stores_items(stuuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_ledger_item_id_stores_items_id_fk') THEN
          ALTER TABLE stores_ledger ADD CONSTRAINT stores_ledger_item_id_stores_items_id_fk FOREIGN KEY (item_id) REFERENCES stores_items(id);
        END IF;
      END $$
    `
  },
  {
    id: '042_defects_duuid_column',
    name: 'Add duuid column to defects',
    description: 'Add duuid TEXT column, populate with gen_random_uuid(), SET NOT NULL + UNIQUE',
    sql: `
      ALTER TABLE defects ADD COLUMN IF NOT EXISTS duuid TEXT;
      UPDATE defects SET duuid = gen_random_uuid()::text WHERE duuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE defects ALTER COLUMN duuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defects_duuid_unique') THEN
          ALTER TABLE defects ADD CONSTRAINT defects_duuid_unique UNIQUE(duuid);
        END IF;
      END $$
    `
  },
  {
    id: '043_defect_child_tables_fk_constraints',
    name: 'Backfill child tables with duuid + FK constraints',
    description: 'Backfill defect_actions, defect_attachments, recurring_defect_links defect_id columns with duuid values, drop old FK, add 3 FK constraints to defects(duuid).',
    sql: `
      -- Backfill defect_actions: replace DEF-xxx text IDs with duuid values
      UPDATE defect_actions da
      SET defect_id = d.duuid
      FROM defects d
      WHERE da.defect_id = d.id AND da.defect_id NOT IN (SELECT duuid FROM defects);

      -- Backfill defect_attachments: replace DEF-xxx text IDs with duuid values
      UPDATE defect_attachments datt
      SET defect_id = d.duuid
      FROM defects d
      WHERE datt.defect_id = d.id AND datt.defect_id NOT IN (SELECT duuid FROM defects);

      -- Drop existing FK on recurring_defect_links that references defects.id
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_defect_links_defect_id_defects_id_fk') THEN
          ALTER TABLE recurring_defect_links DROP CONSTRAINT recurring_defect_links_defect_id_defects_id_fk;
        END IF;
      END $$;

      -- Backfill recurring_defect_links: replace DEF-xxx text IDs with duuid values
      UPDATE recurring_defect_links rdl
      SET defect_id = d.duuid
      FROM defects d
      WHERE rdl.defect_id = d.id AND rdl.defect_id NOT IN (SELECT duuid FROM defects);

      -- Add FK constraints from all 3 child tables to defects(duuid)
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defect_actions_defect_id_defects_duuid_fk') THEN
          ALTER TABLE defect_actions ADD CONSTRAINT defect_actions_defect_id_defects_duuid_fk
            FOREIGN KEY (defect_id) REFERENCES defects(duuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'defect_attachments_defect_id_defects_duuid_fk') THEN
          ALTER TABLE defect_attachments ADD CONSTRAINT defect_attachments_defect_id_defects_duuid_fk
            FOREIGN KEY (defect_id) REFERENCES defects(duuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_defect_links_defect_id_defects_duuid_fk') THEN
          ALTER TABLE recurring_defect_links ADD CONSTRAINT recurring_defect_links_defect_id_defects_duuid_fk
            FOREIGN KEY (defect_id) REFERENCES defects(duuid) ON DELETE CASCADE;
        END IF;
      END $$
    `
  },
  {
    id: '044_alert_policies_apuuid_column',
    name: 'Add apuuid column to alert_policies',
    description: 'Add apuuid TEXT column, populate with gen_random_uuid(), SET NOT NULL + UNIQUE',
    sql: `
      ALTER TABLE alert_policies ADD COLUMN IF NOT EXISTS apuuid TEXT;
      UPDATE alert_policies SET apuuid = gen_random_uuid()::text WHERE apuuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE alert_policies ALTER COLUMN apuuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_policies_apuuid_unique') THEN
          ALTER TABLE alert_policies ADD CONSTRAINT alert_policies_apuuid_unique UNIQUE(apuuid);
        END IF;
      END $$
    `
  },
  {
    id: '045_alert_events_aeuuid_and_policy_uuid',
    name: 'Add aeuuid + policy_uuid to alert_events + FK constraint',
    description: 'Add aeuuid TEXT (UUID identity) and policy_uuid TEXT (FK → alert_policies.apuuid) to alert_events.',
    sql: `
      -- aeuuid column
      ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS aeuuid TEXT;
      UPDATE alert_events SET aeuuid = gen_random_uuid()::text WHERE aeuuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE alert_events ALTER COLUMN aeuuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_events_aeuuid_unique') THEN
          ALTER TABLE alert_events ADD CONSTRAINT alert_events_aeuuid_unique UNIQUE(aeuuid);
        END IF;
      END $$;

      -- policy_uuid column
      ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS policy_uuid TEXT;
      UPDATE alert_events ae SET policy_uuid = ap.apuuid FROM alert_policies ap WHERE ae.policy_id = ap.id AND ae.policy_uuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE alert_events ALTER COLUMN policy_uuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_events_policy_uuid_alert_policies_apuuid_fk') THEN
          ALTER TABLE alert_events ADD CONSTRAINT alert_events_policy_uuid_alert_policies_apuuid_fk
            FOREIGN KEY (policy_uuid) REFERENCES alert_policies(apuuid);
        END IF;
      END $$
    `
  },
  {
    id: '046_alert_deliveries_event_uuid_and_fk',
    name: 'Add event_uuid to alert_deliveries + FK constraint',
    description: 'Add event_uuid TEXT (FK → alert_events.aeuuid) to alert_deliveries.',
    sql: `
      ALTER TABLE alert_deliveries ADD COLUMN IF NOT EXISTS event_uuid TEXT;
      UPDATE alert_deliveries ad SET event_uuid = ae.aeuuid FROM alert_events ae WHERE ad.event_id = ae.id AND ad.event_uuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE alert_deliveries ALTER COLUMN event_uuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_deliveries_event_uuid_alert_events_aeuuid_fk') THEN
          ALTER TABLE alert_deliveries ADD CONSTRAINT alert_deliveries_event_uuid_alert_events_aeuuid_fk
            FOREIGN KEY (event_uuid) REFERENCES alert_events(aeuuid);
        END IF;
      END $$
    `
  },

  // ── FK-9: Form Definitions + Form Versions Identity Restructure ──

  {
    id: '047_form_definitions_fduuid_column',
    name: 'Add fduuid column to form_definitions',
    description: 'Add canonical UUID identity column to form_definitions with backfill, NOT NULL, UNIQUE',
    sql: `
      ALTER TABLE form_definitions ADD COLUMN IF NOT EXISTS fduuid TEXT;
      UPDATE form_definitions SET fduuid = gen_random_uuid()::text WHERE fduuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE form_definitions ALTER COLUMN fduuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_definitions_fduuid_unique') THEN
          ALTER TABLE form_definitions ADD CONSTRAINT form_definitions_fduuid_unique UNIQUE(fduuid);
        END IF;
      END $$
    `
  },
  {
    id: '048_form_versions_fvuuid_and_form_definition_uuid',
    name: 'Add fvuuid + form_definition_uuid to form_versions + FK constraint',
    description: 'Add canonical UUID identity column and FK to form_definitions on form_versions',
    sql: `
      -- fvuuid column
      ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS fvuuid TEXT;
      UPDATE form_versions SET fvuuid = gen_random_uuid()::text WHERE fvuuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE form_versions ALTER COLUMN fvuuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_versions_fvuuid_unique') THEN
          ALTER TABLE form_versions ADD CONSTRAINT form_versions_fvuuid_unique UNIQUE(fvuuid);
        END IF;
      END $$;
      -- form_definition_uuid column + FK
      ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS form_definition_uuid TEXT;
      UPDATE form_versions fv SET form_definition_uuid = fd.fduuid FROM form_definitions fd WHERE fv.form_id = fd.id AND fv.form_definition_uuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE form_versions ALTER COLUMN form_definition_uuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_versions_form_definition_uuid_form_definitions_fduuid_fk') THEN
          ALTER TABLE form_versions ADD CONSTRAINT form_versions_form_definition_uuid_form_definitions_fduuid_fk FOREIGN KEY (form_definition_uuid) REFERENCES form_definitions(fduuid);
        END IF;
      END $$
    `
  },
  {
    id: '049_form_version_usage_form_version_uuid_and_fk',
    name: 'Add form_version_uuid to form_version_usage + FK constraint',
    description: 'Add UUID FK column to form_version_usage referencing form_versions.fvuuid',
    sql: `
      ALTER TABLE form_version_usage ADD COLUMN IF NOT EXISTS form_version_uuid TEXT;
      UPDATE form_version_usage fvu SET form_version_uuid = fv.fvuuid FROM form_versions fv WHERE fvu.form_version_id = fv.id AND fvu.form_version_uuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE form_version_usage ALTER COLUMN form_version_uuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_version_usage_form_version_uuid_form_versions_fvuuid_fk') THEN
          ALTER TABLE form_version_usage ADD CONSTRAINT form_version_usage_form_version_uuid_form_versions_fvuuid_fk FOREIGN KEY (form_version_uuid) REFERENCES form_versions(fvuuid);
        END IF;
      END $$
    `
  },

  // ── FK-10: Bulk Import History Identity Restructure ──

  {
    id: '050_bulk_import_history_biuuid_column',
    name: 'Add biuuid column to bulk_import_history',
    description: 'Add canonical UUID identity column to bulk_import_history with backfill, NOT NULL, UNIQUE',
    sql: `
      ALTER TABLE bulk_import_history ADD COLUMN IF NOT EXISTS biuuid TEXT;
      UPDATE bulk_import_history SET biuuid = gen_random_uuid()::text WHERE biuuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE bulk_import_history ALTER COLUMN biuuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bulk_import_history_biuuid_unique') THEN
          ALTER TABLE bulk_import_history ADD CONSTRAINT bulk_import_history_biuuid_unique UNIQUE(biuuid);
        END IF;
      END $$
    `
  },
  {
    id: '051_bulk_import_errors_import_uuid_and_fk',
    name: 'Add import_uuid to bulk_import_errors + FK constraint',
    description: 'Add UUID FK column to bulk_import_errors referencing bulk_import_history.biuuid',
    sql: `
      ALTER TABLE bulk_import_errors ADD COLUMN IF NOT EXISTS import_uuid TEXT;
      UPDATE bulk_import_errors bie SET import_uuid = bih.biuuid FROM bulk_import_history bih WHERE bie.import_id = bih.id AND bie.import_uuid IS NULL;
      DO $$ BEGIN
        BEGIN ALTER TABLE bulk_import_errors ALTER COLUMN import_uuid SET NOT NULL; EXCEPTION WHEN others THEN NULL; END;
      END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bulk_import_errors_import_uuid_bulk_import_history_biuuid_fk') THEN
          ALTER TABLE bulk_import_errors ADD CONSTRAINT bulk_import_errors_import_uuid_bulk_import_history_biuuid_fk FOREIGN KEY (import_uuid) REFERENCES bulk_import_history(biuuid);
        END IF;
      END $$
    `
  },
  {
    id: '052_standard_audit_columns',
    name: 'Add standard audit columns to all tables',
    description: 'Adds 7 standard columns (sort_order, created_at, updated_at, created_by_uuid, updated_by_uuid, is_deleted, is_sync) to all tables missing them. 410 alterations across 71 tables. Safe: uses ADD COLUMN IF NOT EXISTS only.',
    sql: `
      ALTER TABLE "alert_config"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "alert_deliveries"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "alert_events"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "alert_policies"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "audit_log"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "bulk_import_errors"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "bulk_import_history"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "certificates"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "change_request"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "change_request_attachment"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "change_request_comment"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "component_class_regulatory"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "component_documents"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "component_maintenance_history"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "component_requisitions"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "component_running_hours_log"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "components"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "defect_actions"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "defect_attachments"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "defect_categories"
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "defect_sequences"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "defect_types"
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "defects"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "equipment_categories"
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "fleet_component_mapping"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "fleet_job_vessel_mapping"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "fleet_spare_vessel_mapping"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "fleet_vessel_mapping"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "fleets"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "form_definitions"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "form_version_usage"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "form_versions"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "ihm_items"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "ihm_maintenance_log"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "import_change_log"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "import_history"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "inventory_transactions"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "job_component_links"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "jobs"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "locations"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "makers"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "master_data"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "master_lists"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "pms_vessel_settings"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "recurring_defect_links"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "recurring_defects"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "report_snapshots"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "running_hours_audit"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "schema_migrations"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "sfi_details"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "ship_certificates_labels_config"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "ship_certificates_master"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "ship_surveys_labels_config"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "ship_surveys_master"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "spare_component_links"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "spare_location_stock"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "spares"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "spares_history"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "stores_items"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "stores_ledger"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "surveys"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "vessel_certificate_applicability"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "vessel_certificate_data"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "vessel_survey_applicability"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "vessel_survey_data"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "vessels"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "work_order_execution_details"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "work_order_executions"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "work_order_postponements"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "work_orders"
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT,
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

      ALTER TABLE "job_component_links"
        ALTER COLUMN updated_at SET DEFAULT NOW()
    `
  },
  {
    id: '053_add_skipped_cycle_cols_to_work_orders',
    name: 'Add missed_cycles and original_due_date to work_orders',
    description: 'Adds Layer 1/2 skipped cycle detection columns to work_orders table',
    sql: `
      ALTER TABLE work_orders
        ADD COLUMN IF NOT EXISTS missed_cycles INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS original_due_date TEXT
    `
  },
  {
    id: '054_add_skipped_cycle_cols_to_history',
    name: 'Add skipped cycle columns to component_maintenance_history',
    description: 'Adds Layer 1/2/3 skipped cycle detection and backfill columns to component_maintenance_history',
    sql: `
      ALTER TABLE component_maintenance_history
        ADD COLUMN IF NOT EXISTS missed_cycles INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS original_due_date TEXT,
        ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS skipped_cycle_date TEXT,
        ADD COLUMN IF NOT EXISTS source_work_order_id TEXT
    `
  },
  {
    id: '055_add_skipped_cycles_justification',
    name: 'Add skipped_cycles_justification to work_orders',
    description: 'Adds Layer 4B mandatory CE justification column for late completions with skipped cycles',
    sql: `
      ALTER TABLE work_orders
        ADD COLUMN IF NOT EXISTS skipped_cycles_justification TEXT
    `
  },
  {
    id: '056_admn_role_master',
    name: 'Create admn_role_master table with seed data',
    description: 'Creates the admn_role_master system initialization table for application role configuration and seeds 15 role records',
    sql: `
      CREATE TABLE IF NOT EXISTS admn_role_master (
        id INTEGER PRIMARY KEY,
        ruid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        assigned_role VARCHAR NOT NULL,
        roletype VARCHAR NOT NULL,
        orderby INTEGER,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by_uuid UUID,
        updated_by_uuid UUID,
        is_deleted BOOLEAN DEFAULT false,
        is_sync BOOLEAN DEFAULT false
      );

      INSERT INTO admn_role_master (id, ruid, assigned_role, roletype, orderby, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (1,  gen_random_uuid(), 'Admin',             'Office', 1,  true, 1,  NOW(), NOW(), false, false),
        (2,  gen_random_uuid(), 'Vessel Management', 'Ship',   6,  true, 6,  NOW(), NOW(), false, false),
        (3,  gen_random_uuid(), 'User',              'Office', 2,  true, 2,  NOW(), NOW(), false, false),
        (4,  gen_random_uuid(), 'Sail Admin',        'Office', 3,  true, 3,  NOW(), NOW(), false, false),
        (5,  gen_random_uuid(), 'Super Admin',       'Office', 4,  true, 4,  NOW(), NOW(), false, false),
        (6,  gen_random_uuid(), 'Vessel Admin',      'Ship',   5,  true, 5,  NOW(), NOW(), false, false),
        (7,  gen_random_uuid(), 'Vessel User',       'Ship',   7,  true, 7,  NOW(), NOW(), false, false),
        (8,  gen_random_uuid(), 'External 1',        'Office', 8,  true, 8,  NOW(), NOW(), false, false),
        (9,  gen_random_uuid(), 'External 2',        'Office', 9,  true, 9,  NOW(), NOW(), false, false),
        (10, gen_random_uuid(), 'External 3',        'Office', 10, true, 10, NOW(), NOW(), false, false),
        (11, gen_random_uuid(), 'External 4',        'Office', 11, true, 11, NOW(), NOW(), false, false),
        (12, gen_random_uuid(), 'External 10',        'Office', 12, true, 12, NOW(), NOW(), false, false),
        (13, gen_random_uuid(), 'Vessel User 2',     'Ship',   13, true, 13, NOW(), NOW(), false, false),
        (14, gen_random_uuid(), 'Vessel User 3',     'Ship',   14, true, 14, NOW(), NOW(), false, false),
        (15, gen_random_uuid(), 'Vessel User 4',     'Ship',   15, true, 15, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    id: '057_layer5_approval_tier_columns',
    name: 'Add Layer 5 approval tier columns to work_orders',
    description: 'Adds daysLate, approvalTier, superintendent fields, ceApprovalRemarks, and approvalBlockReason to work_orders',
    sql: `
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS days_late INTEGER DEFAULT 0;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS approval_tier TEXT DEFAULT 'standard';
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS superintendent_acknowledged BOOLEAN DEFAULT false;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS superintendent_acknowledged_at TEXT;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS superintendent_notified_at TEXT;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS ce_approval_remarks TEXT;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS approval_block_reason TEXT;
    `
  },
  {
    id: '058_superintendent_notifications_table',
    name: 'Create superintendent_notifications table',
    description: 'Creates the superintendent_notifications table for in-app superintendent notification tracking',
    sql: `
      CREATE TABLE IF NOT EXISTS superintendent_notifications (
        id SERIAL PRIMARY KEY,
        work_order_id TEXT NOT NULL,
        work_order_code TEXT,
        job_title TEXT,
        component_name TEXT,
        vessel_name TEXT,
        days_late INTEGER DEFAULT 0,
        missed_cycles INTEGER DEFAULT 0,
        approval_tier TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        acknowledged_at TIMESTAMP,
        is_acknowledged BOOLEAN DEFAULT false
      )
    `
  },
  {
    id: '060_work_order_anomalies_table',
    name: 'Create work_order_anomalies table',
    description: 'Creates the work_order_anomalies table for Layer 6 anomaly detection system',
    sql: `
      CREATE TABLE IF NOT EXISTS work_order_anomalies (
        id SERIAL PRIMARY KEY,
        work_order_id TEXT NOT NULL,
        work_order_code TEXT,
        component_code TEXT,
        component_name TEXT,
        job_title TEXT,
        vessel_id TEXT,
        anomaly_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completion_date TEXT,
        due_date TEXT,
        days_late INTEGER DEFAULT 0,
        missed_cycles INTEGER DEFAULT 0,
        anomaly_details JSON,
        status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        justification TEXT,
        is_resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wo_anomalies_work_order_id ON work_order_anomalies (work_order_id);
      CREATE INDEX IF NOT EXISTS idx_wo_anomalies_vessel_id ON work_order_anomalies (vessel_id);
      CREATE INDEX IF NOT EXISTS idx_wo_anomalies_status ON work_order_anomalies (status);
      CREATE INDEX IF NOT EXISTS idx_wo_anomalies_severity ON work_order_anomalies (severity);
      CREATE INDEX IF NOT EXISTS idx_wo_anomalies_detected_at ON work_order_anomalies (detected_at DESC)
    `
  },
  {
    id: '061_placeholder',
    name: 'Seed Layer 5 test work orders for all approval tiers',
    description: 'Creates 4 test WOs in Pending Approval status covering all approval tiers, plus superintendent notifications',
    sql: `
      DO $$
      DECLARE
        v_vessel_id TEXT := '744535d0-841a-11ed-aa7c-7003bca91a86';
        v_now TIMESTAMP := NOW();
      BEGIN
        -- Only seed if no test WOs exist yet
        IF NOT EXISTS (SELECT 1 FROM work_orders WHERE work_order_no LIKE 'TEST-L5-%') THEN
          -- Test WO 1: Standard (daysLate=2, missedCycles=0)
          INSERT INTO work_orders (id, wouuid, vessel_id, component, component_code, work_order_no, work_order_type, job_title, assigned_to, status, due_date, completion_date_time, date_completed, days_late, missed_cycles, approval_tier, submitted_date, is_execution, created_at, updated_at, data_scope)
          VALUES ('TEST-L5-STANDARD', gen_random_uuid(), v_vessel_id, 'FO Separators No.02', '702.005.02', 'TEST-L5-STANDARD', 'Planned', 'Test WO - Standard Approval (2 days late)', '2nd Engineer', 'Pending Approval', '2026-03-01', '2026-03-03T00:00:00.000Z', '2026-03-03T00:00:00.000Z', 2, 0, 'standard', '2026-03-03T00:00:00.000Z', true, v_now, v_now, 'vessel');

          -- Test WO 2: CE With Justification (daysLate=10, missedCycles=0)
          INSERT INTO work_orders (id, wouuid, vessel_id, component, component_code, work_order_no, work_order_type, job_title, assigned_to, status, due_date, completion_date_time, date_completed, days_late, missed_cycles, approval_tier, submitted_date, is_execution, created_at, updated_at, data_scope)
          VALUES ('TEST-L5-CE-REMARKS', gen_random_uuid(), v_vessel_id, 'FO Separators No.02', '702.005.02', 'TEST-L5-CE-REMARKS', 'Planned', 'Test WO - CE Remarks Required (10 days late)', '2nd Engineer', 'Pending Approval', '2026-02-20', '2026-03-02T00:00:00.000Z', '2026-03-02T00:00:00.000Z', 10, 0, 'ce_with_justification', '2026-03-02T00:00:00.000Z', true, v_now, v_now, 'vessel');

          -- Test WO 3: Superintendent Notification (daysLate=20, missedCycles=0)
          INSERT INTO work_orders (id, wouuid, vessel_id, component, component_code, work_order_no, work_order_type, job_title, assigned_to, status, due_date, completion_date_time, date_completed, days_late, missed_cycles, approval_tier, superintendent_notified_at, submitted_date, is_execution, created_at, updated_at, data_scope)
          VALUES ('TEST-L5-SUPT-NOTIFY', gen_random_uuid(), v_vessel_id, 'FO Separators No.02', '702.005.02', 'TEST-L5-SUPT-NOTIFY', 'Planned', 'Test WO - Superintendent Notified (20 days late)', '2nd Engineer', 'Pending Approval', '2026-02-10', '2026-03-02T00:00:00.000Z', '2026-03-02T00:00:00.000Z', 20, 0, 'superintendent_notification', v_now::TEXT, '2026-03-02T00:00:00.000Z', true, v_now, v_now, 'vessel');

          -- Test WO 4: Superintendent Locked (daysLate=35, missedCycles=4)
          INSERT INTO work_orders (id, wouuid, vessel_id, component, component_code, work_order_no, work_order_type, job_title, assigned_to, status, due_date, completion_date_time, date_completed, days_late, missed_cycles, approval_tier, superintendent_notified_at, superintendent_acknowledged, approval_block_reason, submitted_date, is_execution, created_at, updated_at, data_scope)
          VALUES ('TEST-L5-LOCKED', gen_random_uuid(), v_vessel_id, 'FO Separators No.02', '702.005.02', 'TEST-L5-LOCKED', 'Planned', 'Test WO - Superintendent Locked (35 days late, 4 cycles)', '2nd Engineer', 'Pending Approval', '2026-01-25', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', 35, 4, 'superintendent_locked', v_now::TEXT, false, 'Awaiting Superintendent acknowledgment', '2026-03-01T00:00:00.000Z', true, v_now, v_now, 'vessel');

          -- Superintendent notification for WO 3 (superintendent_notification tier)
          INSERT INTO superintendent_notifications (work_order_id, work_order_code, job_title, component_name, vessel_name, days_late, missed_cycles, approval_tier, is_acknowledged, created_at)
          VALUES ('TEST-L5-SUPT-NOTIFY', 'TEST-L5-SUPT-NOTIFY', 'Test WO - Superintendent Notified (20 days late)', '702.005.02', v_vessel_id, 20, 0, 'superintendent_notification', false, v_now);

          -- Superintendent notification for WO 4 (superintendent_locked tier)
          INSERT INTO superintendent_notifications (work_order_id, work_order_code, job_title, component_name, vessel_name, days_late, missed_cycles, approval_tier, is_acknowledged, created_at)
          VALUES ('TEST-L5-LOCKED', 'TEST-L5-LOCKED', 'Test WO - Superintendent Locked (35 days late, 4 cycles)', '702.005.02', v_vessel_id, 35, 4, 'superintendent_locked', false, v_now);

          RAISE NOTICE 'Layer 5 test data seeded successfully';
        ELSE
          RAISE NOTICE 'Layer 5 test data already exists, skipping';
        END IF;
      END $$;
    `
  },
  {
    id: '062_completion_rh_columns',
    name: 'Add completion_rh columns to work_orders',
    description: 'Adds completion_rh, completion_rh_validated, completion_rh_source, and completion_rh_validation_details columns for Layer 7 RH snapshot isolation',
    sql: `
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completion_rh DECIMAL(10,2);
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completion_rh_validated BOOLEAN;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completion_rh_source TEXT;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completion_rh_validation_details JSONB;
    `
  },
  {
    id: '063_rh_justification_and_snapshot_columns',
    name: 'Add RH justification and WO snapshot columns to work_orders',
    description: 'Adds rh_justification, rh_justification_provided_by, rh_justification_date, and RH snapshot columns (cycle_due_rh_snapshot, generate_rh_snapshot, due_rh_snapshot, effective_rh_at_generation, rh_last_done_snapshot) for Layer 7 isolation',
    sql: `
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS rh_justification TEXT;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS rh_justification_provided_by TEXT;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS rh_justification_date TIMESTAMP;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cycle_due_rh_snapshot DECIMAL(10,2);
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS generate_rh_snapshot DECIMAL(10,2);
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS due_rh_snapshot DECIMAL(10,2);
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS effective_rh_at_generation DECIMAL(10,2);
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS rh_last_done_snapshot DECIMAL(10,2);
    `
  },
  {
    id: '064_adm_menumaster_ac',
    name: 'Create adm_menumaster_ac table',
    description: 'Creates the adm_menumaster_ac table for application UI menu master definitions with self-referencing parent_menu foreign key',
    sql: `
      CREATE TABLE IF NOT EXISTS adm_menumaster_ac (
        id INTEGER PRIMARY KEY,
        muid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        display_name VARCHAR NOT NULL,
        route VARCHAR,
        parent_menu UUID,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by_uuid UUID,
        updated_by_uuid UUID,
        is_deleted BOOLEAN DEFAULT false,
        is_sync BOOLEAN DEFAULT false,
        FOREIGN KEY (parent_menu) REFERENCES adm_menumaster_ac(muid)
      );
    `
  },
  {
    id: '065_seed_adm_menumaster_ac',
    name: 'Seed adm_menumaster_ac with menu structure',
    description: 'Seeds 24 menu entries: 4 top-level modules and 20 sub-modules with sequential IDs and sort_order',
    sql: `
      INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (1, gen_random_uuid(), 'pms',          'PMS',             '/pms',          NULL, true, 1, NOW(), NOW(), false, false),
        (2, gen_random_uuid(), 'defects',      'Defects',         '/defects',      NULL, true, 2, NOW(), NOW(), false, false),
        (3, gen_random_uuid(), 'cert-surveys', 'Cert. & Surveys', '/cert-surveys', NULL, true, 3, NOW(), NOW(), false, false),
        (4, gen_random_uuid(), 'admin',        'Admin',           '/admin',        NULL, true, 4, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (5,  gen_random_uuid(), 'pms-dashboard',   'Dashboard',   '/pms/dashboard',   (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 5,  NOW(), NOW(), false, false),
        (6,  gen_random_uuid(), 'pms-components',  'Components',  '/pms/components',  (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 6,  NOW(), NOW(), false, false),
        (7,  gen_random_uuid(), 'pms-work-orders', 'Work Orders', '/pms/work-orders', (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 7,  NOW(), NOW(), false, false),
        (8,  gen_random_uuid(), 'pms-running-hrs', 'Running Hrs', '/pms/running-hrs', (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 8,  NOW(), NOW(), false, false),
        (9,  gen_random_uuid(), 'pms-spares',      'Spares',      '/spares',          (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 9,  NOW(), NOW(), false, false),
        (10, gen_random_uuid(), 'pms-stores',      'Stores',      '/stores',          (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 10, NOW(), NOW(), false, false),
        (11, gen_random_uuid(), 'pms-reports',     'Reports',     '/pms/reports',     (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 11, NOW(), NOW(), false, false),
        (12, gen_random_uuid(), 'pms-modify-pms',  'Modify PMS',  '/pms/modify-pms',  (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 12, NOW(), NOW(), false, false),
        (13, gen_random_uuid(), 'pms-admin',       'Admin',       '/pms/admin',       (SELECT muid FROM adm_menumaster_ac WHERE id = 1), true, 13, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (14, gen_random_uuid(), 'defects-dashboard', 'Dashboard',         '/defects',           (SELECT muid FROM adm_menumaster_ac WHERE id = 2), true, 14, NOW(), NOW(), false, false),
        (15, gen_random_uuid(), 'defects-active',    'Defect Log',        '/defects/active',    (SELECT muid FROM adm_menumaster_ac WHERE id = 2), true, 15, NOW(), NOW(), false, false),
        (16, gen_random_uuid(), 'defects-coc',       'CoC',               '/defects/coc',       (SELECT muid FROM adm_menumaster_ac WHERE id = 2), true, 16, NOW(), NOW(), false, false),
        (17, gen_random_uuid(), 'defects-recurring', 'Recurring Defects', '/defects/recurring', (SELECT muid FROM adm_menumaster_ac WHERE id = 2), true, 17, NOW(), NOW(), false, false),
        (18, gen_random_uuid(), 'defects-resolved',  'Resolved Defects',  '/defects/resolved',  (SELECT muid FROM adm_menumaster_ac WHERE id = 2), true, 18, NOW(), NOW(), false, false),
        (19, gen_random_uuid(), 'defects-reports',   'Reports',           '/defects/reports',   (SELECT muid FROM adm_menumaster_ac WHERE id = 2), true, 19, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (20, gen_random_uuid(), 'cert-certificates', 'Certificates', '/cert-surveys/certificates', (SELECT muid FROM adm_menumaster_ac WHERE id = 3), true, 20, NOW(), NOW(), false, false),
        (21, gen_random_uuid(), 'cert-surveys-page', 'Surveys',      '/cert-surveys/surveys',      (SELECT muid FROM adm_menumaster_ac WHERE id = 3), true, 21, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (22, gen_random_uuid(), 'admin-masters',            'Masters',              '/admin/masters',            (SELECT muid FROM adm_menumaster_ac WHERE id = 4), true, 22, NOW(), NOW(), false, false),
        (23, gen_random_uuid(), 'admin-ships-certificates', 'Ship''s Certificates', '/admin/ships-certificates', (SELECT muid FROM adm_menumaster_ac WHERE id = 4), true, 23, NOW(), NOW(), false, false),
        (24, gen_random_uuid(), 'admin-ships-surveys',      'Ship''s Surveys',      '/admin/ships-surveys',      (SELECT muid FROM adm_menumaster_ac WHERE id = 4), true, 24, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    id: '066_adm_role_menu_access',
    name: 'Create adm_role_menu_access junction table',
    description: 'Junction table for role-menu permission mappings with can_view, can_create, can_edit, can_delete booleans',
    sql: `
      CREATE TABLE IF NOT EXISTS adm_role_menu_access (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        role_ruid TEXT NOT NULL,
        menu_muid TEXT NOT NULL,
        can_view BOOLEAN DEFAULT false,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        can_delete BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by_uuid TEXT,
        updated_by_uuid TEXT,
        UNIQUE(role_ruid, menu_muid)
      );
    `
  },
  {
    id: '066b_adm_role_menu_access_fks',
    name: 'Add FK constraints to adm_role_menu_access',
    description: 'Alters columns to UUID type and adds foreign key constraints referencing admn_role_master(ruid) and adm_menumaster_ac(muid)',
    sql: `
      DO $$
      BEGIN
        ALTER TABLE adm_role_menu_access
          ALTER COLUMN role_ruid TYPE uuid USING role_ruid::uuid,
          ALTER COLUMN menu_muid TYPE uuid USING menu_muid::uuid;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'adm_role_menu_access_role_ruid_fkey'
          AND table_name = 'adm_role_menu_access'
        ) THEN
          ALTER TABLE adm_role_menu_access
            ADD CONSTRAINT adm_role_menu_access_role_ruid_fkey
            FOREIGN KEY (role_ruid) REFERENCES admn_role_master(ruid);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'adm_role_menu_access_menu_muid_fkey'
          AND table_name = 'adm_role_menu_access'
        ) THEN
          ALTER TABLE adm_role_menu_access
            ADD CONSTRAINT adm_role_menu_access_menu_muid_fkey
            FOREIGN KEY (menu_muid) REFERENCES adm_menumaster_ac(muid);
        END IF;
      END $$;
    `
  },
  {
    id: '067_seed_access_control_menu',
    name: 'Add Access Control menu entry',
    description: 'Adds Access Control sub-module under Admin (id=25, sort_order=25)',
    sql: `
      INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (25, gen_random_uuid(), 'admin-access-control', 'Access Control', '/admin/access-control', (SELECT muid FROM adm_menumaster_ac WHERE id = 4), true, 25, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    id: '068_superintendent_notifications_backdating_days',
    name: 'Add backdating_days column to superintendent_notifications',
    description: 'Adds backdating_days integer column for tracking backdating severity in superintendent notifications',
    sql: `ALTER TABLE superintendent_notifications ADD COLUMN IF NOT EXISTS backdating_days INTEGER DEFAULT 0`
  },
  {
    id: '069_fix_superintendent_notifications_vessel_name',
    name: 'Fix vessel_name data in superintendent_notifications',
    description: 'Corrects vessel_name values that contain UUIDs instead of actual vessel names by looking up the vessels table',
    sql: `
      UPDATE superintendent_notifications sn
      SET vessel_name = v.name
      FROM vessels v
      WHERE sn.vessel_name = v.vuuid
        AND sn.vessel_name IS NOT NULL
        AND sn.vessel_name != '';
      UPDATE superintendent_notifications sn
      SET vessel_name = v.name
      FROM vessels v
      WHERE sn.vessel_name = CAST(v.id AS TEXT)
        AND sn.vessel_name IS NOT NULL
        AND sn.vessel_name != ''
        AND sn.vessel_name NOT IN (SELECT name FROM vessels)
    `
  },
  {
    id: '070_fix_spare_unique_constraints',
    name: 'Fix spare_component_links and spare_location_stock unique constraints',
    description: 'Drops the incorrect 2-column unique_spare_component_link constraint and recreates it with 3 columns (spare_id, component_id, vessel_id) to match the Drizzle schema. Also adds unique_spare_location_stock on (spare_id, location_id) if missing. Deduplicates rows before creating constraints.',
    sql: `
      DO $$ 
      DECLARE
        scl_cols text;
        sls_cols text;
      BEGIN
        SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum)) INTO scl_cols
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conname = 'unique_spare_component_link' AND c.conrelid = 'spare_component_links'::regclass;

        SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum)) INTO sls_cols
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conname = 'unique_spare_location_stock' AND c.conrelid = 'spare_location_stock'::regclass;

        IF scl_cols = 'spare_id,component_id,vessel_id' AND sls_cols = 'spare_id,location_id' THEN
          RAISE NOTICE 'Constraints already correct, skipping 070';
          RETURN;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_component_link' AND conrelid = 'spare_component_links'::regclass) THEN
          ALTER TABLE spare_component_links DROP CONSTRAINT unique_spare_component_link;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_spare_component_link' AND tablename = 'spare_component_links') THEN
          DROP INDEX unique_spare_component_link;
        END IF;

        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY spare_id, component_id, vessel_id
            ORDER BY id DESC
          ) AS rn
          FROM spare_component_links
        )
        DELETE FROM spare_component_links
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_component_link' AND conrelid = 'spare_component_links'::regclass) THEN
          ALTER TABLE spare_component_links ADD CONSTRAINT unique_spare_component_link UNIQUE (spare_id, component_id, vessel_id);
        END IF;

        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_location_stock' AND conrelid = 'spare_location_stock'::regclass) THEN
          ALTER TABLE spare_location_stock DROP CONSTRAINT unique_spare_location_stock;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_spare_location_stock' AND tablename = 'spare_location_stock') THEN
          DROP INDEX unique_spare_location_stock;
        END IF;

        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY spare_id, location_id
            ORDER BY id DESC
          ) AS rn
          FROM spare_location_stock
        )
        DELETE FROM spare_location_stock
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_location_stock' AND conrelid = 'spare_location_stock'::regclass) THEN
          ALTER TABLE spare_location_stock ADD CONSTRAINT unique_spare_location_stock UNIQUE (spare_id, location_id);
        END IF;
      END $$;
    `
  },
  {
    id: '071_ensure_spare_unique_constraints',
    name: 'Ensure spare unique constraints exist (fix for databases where 070 partially applied)',
    description: 'Migration 070 may have dropped old constraints but failed to create new ones on some databases. This migration ensures the correct unique constraints exist by dropping any leftover index/constraint, deduplicating, and recreating as proper UNIQUE constraints.',
    sql: `
      DO $$ 
      DECLARE
        scl_cols text;
        sls_cols text;
      BEGIN
        SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum)) INTO scl_cols
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conname = 'unique_spare_component_link' AND c.conrelid = 'spare_component_links'::regclass;

        SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum)) INTO sls_cols
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conname = 'unique_spare_location_stock' AND c.conrelid = 'spare_location_stock'::regclass;

        IF scl_cols = 'spare_id,component_id,vessel_id' AND sls_cols = 'spare_id,location_id' THEN
          RAISE NOTICE 'Constraints already correct, skipping 071';
          RETURN;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_component_link' AND conrelid = 'spare_component_links'::regclass) THEN
          ALTER TABLE spare_component_links DROP CONSTRAINT unique_spare_component_link;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_spare_component_link' AND tablename = 'spare_component_links') THEN
          DROP INDEX unique_spare_component_link;
        END IF;

        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY spare_id, component_id, vessel_id
            ORDER BY id DESC
          ) AS rn
          FROM spare_component_links
        )
        DELETE FROM spare_component_links
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

        ALTER TABLE spare_component_links ADD CONSTRAINT unique_spare_component_link UNIQUE (spare_id, component_id, vessel_id);

        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_location_stock' AND conrelid = 'spare_location_stock'::regclass) THEN
          ALTER TABLE spare_location_stock DROP CONSTRAINT unique_spare_location_stock;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_spare_location_stock' AND tablename = 'spare_location_stock') THEN
          DROP INDEX unique_spare_location_stock;
        END IF;

        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY spare_id, location_id
            ORDER BY id DESC
          ) AS rn
          FROM spare_location_stock
        )
        DELETE FROM spare_location_stock
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

        ALTER TABLE spare_location_stock ADD CONSTRAINT unique_spare_location_stock UNIQUE (spare_id, location_id);
      END $$;
    `
  },
  {
    id: '072_optimized_spare_unique_constraints',
    name: 'Optimized spare unique constraints (replaces slow dedup in 070/071)',
    description: 'Uses ROW_NUMBER() window function for O(n) dedup instead of NOT IN (SELECT MAX...) O(n²) pattern. Fully idempotent — safe on databases where 070/071 already succeeded.',
    sql: `
      DO $$
      DECLARE
        scl_cols text;
        sls_cols text;
        deleted_scl integer;
        deleted_sls integer;
      BEGIN
        SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum)) INTO scl_cols
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conname = 'unique_spare_component_link' AND c.conrelid = 'spare_component_links'::regclass;

        SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum)) INTO sls_cols
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conname = 'unique_spare_location_stock' AND c.conrelid = 'spare_location_stock'::regclass;

        IF scl_cols = 'spare_id,component_id,vessel_id' AND sls_cols = 'spare_id,location_id' THEN
          RAISE NOTICE 'Both constraints already correct, skipping 072';
          RETURN;
        END IF;

        -- === spare_component_links ===
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_component_link' AND conrelid = 'spare_component_links'::regclass) THEN
          ALTER TABLE spare_component_links DROP CONSTRAINT unique_spare_component_link;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_spare_component_link' AND tablename = 'spare_component_links') THEN
          DROP INDEX unique_spare_component_link;
        END IF;

        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY spare_id, component_id, vessel_id
            ORDER BY id DESC
          ) AS rn
          FROM spare_component_links
        )
        DELETE FROM spare_component_links
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

        GET DIAGNOSTICS deleted_scl = ROW_COUNT;
        IF deleted_scl > 0 THEN
          RAISE NOTICE 'Deduplicated spare_component_links: removed % duplicate rows', deleted_scl;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_component_link' AND conrelid = 'spare_component_links'::regclass) THEN
          ALTER TABLE spare_component_links ADD CONSTRAINT unique_spare_component_link UNIQUE (spare_id, component_id, vessel_id);
        END IF;

        -- === spare_location_stock ===
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_location_stock' AND conrelid = 'spare_location_stock'::regclass) THEN
          ALTER TABLE spare_location_stock DROP CONSTRAINT unique_spare_location_stock;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_spare_location_stock' AND tablename = 'spare_location_stock') THEN
          DROP INDEX unique_spare_location_stock;
        END IF;

        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY spare_id, location_id
            ORDER BY id DESC
          ) AS rn
          FROM spare_location_stock
        )
        DELETE FROM spare_location_stock
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

        GET DIAGNOSTICS deleted_sls = ROW_COUNT;
        IF deleted_sls > 0 THEN
          RAISE NOTICE 'Deduplicated spare_location_stock: removed % duplicate rows', deleted_sls;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_location_stock' AND conrelid = 'spare_location_stock'::regclass) THEN
          ALTER TABLE spare_location_stock ADD CONSTRAINT unique_spare_location_stock UNIQUE (spare_id, location_id);
        END IF;
      END $$;
    `
  },
  {
    id: '073_planner_dates_table',
    name: 'Create planner_dates table for work order planner',
    description: 'Creates the planner_dates table for storing planned maintenance dates in the Work Order Planner view',
    sql: `
      CREATE TABLE IF NOT EXISTS planner_dates (
        id SERIAL PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        component_id TEXT NOT NULL,
        planned_date TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'unique_planner_date_entry'
          AND conrelid = 'planner_dates'::regclass
        ) THEN
          ALTER TABLE planner_dates
            ADD CONSTRAINT unique_planner_date_entry
            UNIQUE (vessel_id, job_id, component_id);
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_planner_dates_vessel ON planner_dates(vessel_id);
    `
  },
  {
    id: '074_planner_dates_add_uuid_audit_fk',
    name: 'Add UUID, audit, sync/delete columns and FK constraints to planner_dates',
    description: 'Adds pduuid, created_by_uuid, updated_by_uuid, is_sync, is_deleted columns and FK constraints on vessel_id, job_id, component_id',
    sql: `
      ALTER TABLE planner_dates ADD COLUMN IF NOT EXISTS pduuid TEXT;
      ALTER TABLE planner_dates ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
      ALTER TABLE planner_dates ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
      ALTER TABLE planner_dates ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE planner_dates ADD COLUMN IF NOT EXISTS is_sync BOOLEAN NOT NULL DEFAULT false;

      UPDATE planner_dates SET pduuid = gen_random_uuid()::text WHERE pduuid IS NULL;

      ALTER TABLE planner_dates ALTER COLUMN pduuid SET NOT NULL;
      ALTER TABLE planner_dates ALTER COLUMN pduuid SET DEFAULT gen_random_uuid()::text;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'planner_dates_pduuid_unique'
          AND conrelid = 'planner_dates'::regclass
        ) THEN
          ALTER TABLE planner_dates
            ADD CONSTRAINT planner_dates_pduuid_unique UNIQUE (pduuid);
        END IF;
      END $$;

      DO $$
      DECLARE
        orphan_vessel INT;
        orphan_job INT;
        orphan_component INT;
      BEGIN
        SELECT COUNT(*) INTO orphan_vessel FROM planner_dates WHERE vessel_id NOT IN (SELECT vuuid FROM vessels);
        SELECT COUNT(*) INTO orphan_job FROM planner_dates WHERE job_id NOT IN (SELECT juuid FROM jobs);
        SELECT COUNT(*) INTO orphan_component FROM planner_dates WHERE component_id NOT IN (SELECT cuuid FROM components);
        IF orphan_vessel > 0 OR orphan_job > 0 OR orphan_component > 0 THEN
          RAISE NOTICE 'planner_dates orphan cleanup: vessel=%, job=%, component=%', orphan_vessel, orphan_job, orphan_component;
          DELETE FROM planner_dates WHERE vessel_id NOT IN (SELECT vuuid FROM vessels);
          DELETE FROM planner_dates WHERE job_id NOT IN (SELECT juuid FROM jobs);
          DELETE FROM planner_dates WHERE component_id NOT IN (SELECT cuuid FROM components);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'planner_dates_vessel_id_fk'
          AND conrelid = 'planner_dates'::regclass
        ) THEN
          ALTER TABLE planner_dates
            ADD CONSTRAINT planner_dates_vessel_id_fk
            FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'planner_dates_job_id_fk'
          AND conrelid = 'planner_dates'::regclass
        ) THEN
          ALTER TABLE planner_dates
            ADD CONSTRAINT planner_dates_job_id_fk
            FOREIGN KEY (job_id) REFERENCES jobs(juuid);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'planner_dates_component_id_fk'
          AND conrelid = 'planner_dates'::regclass
        ) THEN
          ALTER TABLE planner_dates
            ADD CONSTRAINT planner_dates_component_id_fk
            FOREIGN KEY (component_id) REFERENCES components(cuuid);
        END IF;
      END $$;
    `
  },
  {
    id: '075_mark_starter_certs_system_defined',
    name: 'Mark starter-kit master certificates as system-defined',
    description: 'Sets is_system_defined=true for the 71 predefined starter-kit certificates so they cannot be deleted by users',
    sql: `
      UPDATE ship_certificates_master
      SET is_system_defined = true
      WHERE master_id IN (
        'A1-001','A1-002','A1-003','A1-004','A1-005','A1-006','A1-007','A1-008','A1-009','A1-010',
        'A1-011','A1-012','A1-013','A1-014','A1-015','A1-016','A1-017','A1-018','A1-019','A1-020',
        'A1-021','A1-022','A1-023','A1-024','A1-025','A1-026','A1-027','A1-028','A1-029','A1-030',
        'A1-031','A1-032','A1-033','A1-034','A1-035','A1-036','A1-037','A1-038','A1-039','A1-040',
        'A1-041','A1-042','A1-043','A1-044','A1-045','A1-046','A1-047','A1-048','A1-049',
        'A2-001','A2-002',
        'A3-001',
        'A4-001','A4-002','A4-003',
        'A5-001','A5-002',
        'A6-001',
        'A7-001','A7-002',
        'A8-001','A8-002',
        'A9-001','A9-002','A9-003','A9-004','A9-005',
        'B10-001','B10-002','B10-003','B10-004'
      );
    `
  },
  {
    id: '076_report_favorites_table',
    name: 'Create report_favorites table',
    description: 'Creates report_favorites table for per-user report favorites with unique constraint on (created_by_uuid, report_id)',
    sql: `
      CREATE TABLE IF NOT EXISTS report_favorites (
        id SERIAL PRIMARY KEY,
        rfuuid TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        report_id TEXT NOT NULL,
        created_by_uuid TEXT NOT NULL,
        updated_by_uuid TEXT,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        is_sync BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'report_favorites_rfuuid_unique'
        ) THEN
          ALTER TABLE report_favorites ADD CONSTRAINT report_favorites_rfuuid_unique UNIQUE (rfuuid);
        END IF;
      END $$;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'unique_user_report_favorite'
        ) THEN
          ALTER TABLE report_favorites ADD CONSTRAINT unique_user_report_favorite UNIQUE (created_by_uuid, report_id);
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_report_favorites_user ON report_favorites (created_by_uuid);
    `
  },
  {
    id: '077_create_ranks_tables',
    name: 'Create adm_available_ranks and adm_vessel_org_chart tables',
    description: 'Creates the adm_available_ranks table for rank definitions and adm_vessel_org_chart table for vessel reporting hierarchy, with FK relationships from org chart to available ranks',
    sql: `
      CREATE TABLE IF NOT EXISTS adm_available_ranks (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        ar_uuid TEXT DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        category TEXT,
        rank_id TEXT NOT NULL,
        label TEXT,
        applicable_to_company BOOLEAN DEFAULT true,
        is_system_rank BOOLEAN DEFAULT true,
        sort_order INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by_uuid TEXT,
        updated_by_uuid TEXT,
        is_deleted BOOLEAN DEFAULT false,
        is_sync BOOLEAN DEFAULT false
      );
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'adm_available_ranks_ar_uuid_unique'
        ) THEN
          ALTER TABLE adm_available_ranks ADD CONSTRAINT adm_available_ranks_ar_uuid_unique UNIQUE (ar_uuid);
        END IF;
      END $$;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'adm_available_ranks_rank_id_unique'
        ) THEN
          ALTER TABLE adm_available_ranks ADD CONSTRAINT adm_available_ranks_rank_id_unique UNIQUE (rank_id);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS adm_vessel_org_chart (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        oc_uuid TEXT DEFAULT gen_random_uuid()::text,
        rank TEXT,
        rank_id TEXT NOT NULL,
        parent_rank_id TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by_uuid TEXT,
        updated_by_uuid TEXT,
        is_deleted BOOLEAN DEFAULT false,
        is_sync BOOLEAN DEFAULT false
      );
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'adm_vessel_org_chart_oc_uuid_unique'
        ) THEN
          ALTER TABLE adm_vessel_org_chart ADD CONSTRAINT adm_vessel_org_chart_oc_uuid_unique UNIQUE (oc_uuid);
        END IF;
      END $$;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'adm_vessel_org_chart_rank_id_adm_available_ranks_rank_id_fk'
        ) THEN
          ALTER TABLE adm_vessel_org_chart ADD CONSTRAINT adm_vessel_org_chart_rank_id_adm_available_ranks_rank_id_fk
            FOREIGN KEY (rank_id) REFERENCES adm_available_ranks(rank_id) ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'adm_vessel_org_chart_parent_rank_id_adm_available_ranks_rank_id_fk'
        ) THEN
          ALTER TABLE adm_vessel_org_chart ADD CONSTRAINT adm_vessel_org_chart_parent_rank_id_adm_available_ranks_rank_id_fk
            FOREIGN KEY (parent_rank_id) REFERENCES adm_available_ranks(rank_id) ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `
  },
  {
    id: '078_seed_admin_ranks_menu',
    name: 'Add Ranks menu entry under Admin',
    description: 'Adds admin-ranks sub-module under Admin (id=26, sort_order=26)',
    sql: `
      INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
      VALUES
        (26, gen_random_uuid(), 'admin-ranks', 'Ranks', '/admin/ranks', (SELECT muid FROM adm_menumaster_ac WHERE id = 4), true, 26, NOW(), NOW(), false, false)
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    id: '079_seed_ranks_master_data',
    name: 'Seed ranks and vessel org chart master data',
    description: 'Inserts 25 default ranks into adm_available_ranks and 18 org chart hierarchy entries into adm_vessel_org_chart. Idempotent: checks table existence first, uses ON CONFLICT DO NOTHING, hierarchy-safe insertion order.',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'adm_available_ranks'
        ) THEN
          RAISE NOTICE 'Table adm_available_ranks does not exist, skipping seed';
          RETURN;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'adm_vessel_org_chart'
        ) THEN
          RAISE NOTICE 'Table adm_vessel_org_chart does not exist, skipping seed';
          RETURN;
        END IF;

        DELETE FROM adm_vessel_org_chart a
        USING adm_vessel_org_chart b
        WHERE a.id > b.id AND a.rank_id = b.rank_id;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'adm_vessel_org_chart_rank_id_unique'
        ) THEN
          ALTER TABLE adm_vessel_org_chart ADD CONSTRAINT adm_vessel_org_chart_rank_id_unique UNIQUE (rank_id);
        END IF;

        INSERT INTO adm_available_ranks (name, category, rank_id, label, applicable_to_company, is_system_rank, sort_order, is_deleted, is_sync, created_at, updated_at)
        VALUES
          ('Master', 'Senior Officers', 'R001', 'Master', true, true, 1, false, false, NOW(), NOW()),
          ('Chief Officer', 'Senior Officers', 'R002', 'Chief Officer', true, true, 2, false, false, NOW(), NOW()),
          ('Second Officer', 'Senior Officers', 'R003', '2nd Officer', true, true, 3, false, false, NOW(), NOW()),
          ('Third Officer', 'Senior Officers', 'R004', '3rd Officer', true, true, 4, false, false, NOW(), NOW()),
          ('Chief Engineer', 'Senior Officers', 'R005', 'Chief Engineer', true, true, 5, false, false, NOW(), NOW()),
          ('Second Engineer', 'Senior Officers', 'R006', '2nd Engineer', true, true, 6, false, false, NOW(), NOW()),
          ('Third Engineer', 'Senior Officers', 'R007', '3rd Engineer', true, true, 7, false, false, NOW(), NOW()),
          ('Fourth Engineer', 'Senior Officers', 'R008', '4th Engineer', true, true, 9, false, false, NOW(), NOW()),
          ('Fifth Engineer', 'Senior Officers', 'R009', 'Fifth Engineer', true, true, 10, false, false, NOW(), NOW()),
          ('Electrical Officer', 'Senior Officers', 'R010', 'Electrical Officer', true, true, 8, false, false, NOW(), NOW()),
          ('Gas Engineer', 'Senior Officers', 'R011', 'Gas Engineer', true, true, 11, false, false, NOW(), NOW()),
          ('Deck Cadet', 'Senior Officers', 'R012', 'Deck Cadet', true, true, 12, false, false, NOW(), NOW()),
          ('Engine Cadet', 'Senior Officers', 'R013', 'Engine Cadet', true, true, 14, false, false, NOW(), NOW()),
          ('Bosun', 'Ratings', 'R014', 'Bosun', true, true, 13, false, false, NOW(), NOW()),
          ('Able Bodied Seaman', 'Senior Officers', 'R015', 'AB', true, true, 16, false, false, NOW(), NOW()),
          ('Ordinary Seaman', 'Senior Officers', 'R016', 'OS', true, true, 17, false, false, NOW(), NOW()),
          ('Pumpman', 'Ratings', 'R017', 'Pumpman', true, true, 15, false, false, NOW(), NOW()),
          ('Fitter', 'Ratings', 'R018', 'Fitter', true, true, 18, false, false, NOW(), NOW()),
          ('Motorman', 'Senior Officers', 'R019', 'Motorman', true, true, 19, false, false, NOW(), NOW()),
          ('Wiper', 'Senior Officers', 'R020', 'Wiper', true, true, 20, false, false, NOW(), NOW()),
          ('Oiler', 'Ratings', 'R021', 'Oiler', true, true, 21, false, false, NOW(), NOW()),
          ('Chief Cook', 'Catering', 'R022', 'Chief Cook', true, true, 22, false, false, NOW(), NOW()),
          ('Messman', 'Catering', 'R023', 'Messman', true, true, 24, false, false, NOW(), NOW()),
          ('Junior officer', 'Senior Officers', 'R024', 'Junior officer', true, false, 23, false, false, NOW(), NOW()),
          ('Test', 'Senior Officers', 'R025', NULL, false, false, 25, false, false, NOW(), NOW())
        ON CONFLICT (rank_id) DO NOTHING;

        INSERT INTO adm_vessel_org_chart (rank, rank_id, parent_rank_id, sort_order, is_deleted, is_sync, created_at, updated_at)
        VALUES
          ('Master', 'R001', NULL, 0, false, false, NOW(), NOW())
        ON CONFLICT (rank_id) DO NOTHING;

        INSERT INTO adm_vessel_org_chart (rank, rank_id, parent_rank_id, sort_order, is_deleted, is_sync, created_at, updated_at)
        VALUES
          ('Chief Officer', 'R002', 'R001', 0, false, false, NOW(), NOW()),
          ('Chief Engineer', 'R005', 'R001', 1, false, false, NOW(), NOW()),
          ('Chief Cook', 'R022', 'R001', 2, false, false, NOW(), NOW()),
          ('Tester', 'R024', 'R001', 3, false, false, NOW(), NOW())
        ON CONFLICT (rank_id) DO NOTHING;

        INSERT INTO adm_vessel_org_chart (rank, rank_id, parent_rank_id, sort_order, is_deleted, is_sync, created_at, updated_at)
        VALUES
          ('2nd Officer', 'R003', 'R002', 0, false, false, NOW(), NOW()),
          ('3rd Officer', 'R004', 'R002', 1, false, false, NOW(), NOW()),
          ('Bosun', 'R014', 'R002', 2, false, false, NOW(), NOW()),
          ('Pumpman', 'R017', 'R002', 3, false, false, NOW(), NOW()),
          ('AB', 'R015', 'R002', 4, false, false, NOW(), NOW()),
          ('OS', 'R016', 'R002', 5, false, false, NOW(), NOW()),
          ('2nd Engineer', 'R006', 'R005', 0, false, false, NOW(), NOW()),
          ('3rd Engineer', 'R007', 'R005', 1, false, false, NOW(), NOW()),
          ('4th Engineer', 'R008', 'R005', 2, false, false, NOW(), NOW()),
          ('Electrical Officer', 'R010', 'R005', 3, false, false, NOW(), NOW()),
          ('Messman', 'R023', 'R022', 0, false, false, NOW(), NOW())
        ON CONFLICT (rank_id) DO NOTHING;

        INSERT INTO adm_vessel_org_chart (rank, rank_id, parent_rank_id, sort_order, is_deleted, is_sync, created_at, updated_at)
        VALUES
          ('Fitter', 'R018', 'R006', 0, false, false, NOW(), NOW()),
          ('Oiler', 'R021', 'R006', 1, false, false, NOW(), NOW())
        ON CONFLICT (rank_id) DO NOTHING;

        CREATE INDEX IF NOT EXISTS idx_adm_available_ranks_ar_uuid ON adm_available_ranks (ar_uuid);
        CREATE INDEX IF NOT EXISTS idx_adm_vessel_org_chart_rank_id ON adm_vessel_org_chart (rank_id);
        CREATE INDEX IF NOT EXISTS idx_adm_vessel_org_chart_parent_rank_id ON adm_vessel_org_chart (parent_rank_id);

      END $$;
    `
  },
  {
    id: '080_add_view_mode_column',
    name: 'Add view_mode column to adm_available_ranks',
    description: 'Adds view_mode text column to adm_available_ranks for storing which UI role view mode a rank belongs to.',
    sql: `
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'adm_available_ranks') THEN
          ALTER TABLE adm_available_ranks ADD COLUMN IF NOT EXISTS view_mode TEXT;
        END IF;
      END $$;
    `
  }
];

export async function createDatabaseBackup(): Promise<string | null> {
  console.log('📦 Creating database backup...');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('⏭️  Skipping database backup - DATABASE_URL not configured');
    return null;
  }
  
  try {
    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);
    
    const command = `pg_dump "${databaseUrl}" --no-owner --no-acl > "${backupFile}"`;
    
    await execAsync(command);
    
    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`✅ Database backup created: ${backupFile} (${sizeMB} MB)`);
    
    await cleanupOldBackups(backupDir, 5);
    
    return backupFile;
  } catch (error: any) {
    console.error('⚠️  Database backup failed:', error.message);
    return null;
  }
}

async function cleanupOldBackups(backupDir: string, keepCount: number): Promise<void> {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
      .map(f => ({ name: f, path: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Deleted old backup: ${file.name}`);
      }
    }
  } catch (error) {
  }
}

async function ensureMigrationsTable(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getMigrationStatus(db: any, migrationId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT id FROM schema_migrations WHERE id = ${migrationId}
  `);
  return (result.rows as any[]).length > 0;
}

async function markMigrationComplete(db: any, migration: Migration): Promise<void> {
  await db.execute(sql`
    INSERT INTO schema_migrations (id, name, description, applied_at)
    VALUES (${migration.id}, ${migration.name}, ${migration.description}, NOW())
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function runMigrations(): Promise<{ applied: number; skipped: number }> {
  console.log('🔄 Running database migrations...');
  
  const postgres = await resolvePostgres();
  if (!postgres) {
    console.log('⏭️  Skipping migrations - DATABASE_URL not configured');
    return { applied: 0, skipped: 0 };
  }
  
  const { db } = postgres;
  let applied = 0;
  let skipped = 0;
  
  try {
    await ensureMigrationsTable(db);
    
    for (const migration of migrations) {
      const alreadyApplied = await getMigrationStatus(db, migration.id);
      
      if (alreadyApplied) {
        skipped++;
        continue;
      }
      
      console.log(`  📝 Applying migration: ${migration.id} - ${migration.name}`);
      
      try {
        await db.execute(sql.raw(migration.sql));
        await markMigrationComplete(db, migration);
        applied++;
        console.log(`  ✅ Migration ${migration.id} applied successfully`);
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.message?.includes('does not exist') || error.code === '42701' || error.code === '42704') {
          console.log(`  ⚠️  Migration ${migration.id} - object already/does not exist, marking as complete`);
          await markMigrationComplete(db, migration);
          skipped++;
        } else {
          console.error(`  ❌ Migration ${migration.id} failed:`, error.message);
          throw error;
        }
      }
    }
    
    console.log(`✅ Migrations complete: ${applied} applied, ${skipped} skipped`);
    return { applied, skipped };
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    throw error;
  }
}

export async function generateDrizzleMigrations(): Promise<boolean> {
  console.log('🔄 Checking for schema changes and generating migrations...');
  
  if (!process.env.DATABASE_URL) {
    console.log('⏭️  Skipping migration generation - DATABASE_URL not configured');
    return false;
  }
  
  const migrationsFolder = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsFolder)) {
    fs.mkdirSync(migrationsFolder, { recursive: true });
  }
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const migrationName = `auto_${timestamp}`;
    
    const { stdout, stderr } = await execAsync(
      `npx drizzle-kit generate --name ${migrationName}`,
      { timeout: 60000 }
    );
    
    if (stdout.includes('No schema changes')) {
      console.log('✅ No schema changes detected - no new migrations needed');
      return false;
    }
    
    if (stdout.includes('migrations generated') || stdout.includes('migration files')) {
      console.log('✅ New migration file(s) generated automatically');
      console.log(stdout.trim());
      return true;
    }
    
    console.log('✅ Migration generation complete');
    if (stdout.trim()) console.log(stdout.trim());
    return true;
  } catch (error: any) {
    if (error.stdout?.includes('No schema changes') || error.stderr?.includes('No schema changes')) {
      console.log('✅ No schema changes detected - no new migrations needed');
      return false;
    }
    console.error('⚠️  Migration generation warning:', error.message);
    return false;
  }
}

export async function runDrizzleMigrations(): Promise<{ applied: number; skipped: number }> {
  console.log('🔄 Running Drizzle file-based SQL migrations (unified tracking)...');
  
  const postgres = await resolvePostgres();
  if (!postgres) {
    console.log('⏭️  Skipping Drizzle migrations - DATABASE_URL not configured');
    return { applied: 0, skipped: 0 };
  }
  
  const { db } = postgres;
  const migrationsFolder = path.join(process.cwd(), 'migrations');
  
  if (!fs.existsSync(migrationsFolder)) {
    console.log('⏭️  Skipping Drizzle migrations - migrations folder not found');
    return { applied: 0, skipped: 0 };
  }
  
  await ensureMigrationsTable(db);
  
  const sqlFiles = fs.readdirSync(migrationsFolder)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  let applied = 0;
  let skipped = 0;
  
  for (const sqlFile of sqlFiles) {
    const migrationId = sqlFile.replace('.sql', '');
    const alreadyApplied = await getMigrationStatus(db, migrationId);
    
    if (alreadyApplied) {
      skipped++;
      continue;
    }
    
    const filePath = path.join(migrationsFolder, sqlFile);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    
    if (!sqlContent.trim()) {
      console.log(`  ⏭️  Skipping empty migration: ${migrationId}`);
      skipped++;
      continue;
    }
    
    console.log(`  📝 Applying SQL migration: ${migrationId}`);
    
    try {
      await db.execute(sql.raw(sqlContent));
      
      const migration: Migration = {
        id: migrationId,
        name: `Drizzle SQL migration: ${sqlFile}`,
        description: `Auto-applied from migrations/${sqlFile}`,
        sql: sqlContent
      };
      await markMigrationComplete(db, migration);
      
      applied++;
      console.log(`  ✅ Migration ${migrationId} applied successfully`);
    } catch (error: any) {
      if (error.message?.includes('already exists') ||
          error.message?.includes('does not exist') ||
          error.code === '42P07' ||
          error.code === '42701' ||
          error.code === '42704') {
        console.log(`  ⚠️  Migration ${migrationId} - object already/does not exist, marking as complete`);
        const migration: Migration = {
          id: migrationId,
          name: `Drizzle SQL migration: ${sqlFile}`,
          description: `Auto-applied from migrations/${sqlFile} (already existed)`,
          sql: sqlContent
        };
        await markMigrationComplete(db, migration);
        skipped++;
      } else {
        console.error(`  ❌ Migration ${migrationId} failed:`, error.message);
        throw error;
      }
    }
  }
  
  console.log(`✅ Drizzle SQL migrations complete: ${applied} applied, ${skipped} skipped`);
  return { applied, skipped };
}

async function cleanupDuplicateFleetComponentMappings(): Promise<void> {
  const postgres = await resolvePostgres();
  if (!postgres) return;
  const { db } = postgres;

  try {
    const result = await db.execute(sql.raw(`
      DELETE FROM fleet_component_mapping a
      USING fleet_component_mapping b
      WHERE a.id > b.id
        AND a.fleet_equipment_code = b.fleet_equipment_code
        AND a.component_code = b.component_code
        AND a.vessel_code = b.vessel_code
    `));
    const count = (result as any)?.rowCount || 0;
    if (count > 0) {
      console.log(`🧹 Removed ${count} duplicate fleet_component_mapping row(s)`);
    }
  } catch (error: any) {
    console.log('⚠️  Fleet component mapping cleanup skipped:', error.message);
  }
}

export async function runBackupAndMigrations(): Promise<void> {
  await createDatabaseBackup();
  await runMigrations();
  await cleanupDuplicateFleetComponentMappings();
  await generateDrizzleMigrations();
  await runDrizzleMigrations();
}
