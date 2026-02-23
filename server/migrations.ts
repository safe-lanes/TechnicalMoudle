import { sql } from 'drizzle-orm';
import { resolvePostgres } from './postgresClient';
import { isFileStorageForced } from './storageFactory';
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
    description: 'Adds vessel_id FK constraints referencing vessels(vuuid) for: components, spares, stores_items, stores_ledger, jobs, work_orders, inventory_transactions, job_component_links, locations, spare_component_links, spare_location_stock',
    sql: `
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
    description: 'Adds vessel_id FK constraints referencing vessels(vuuid) for all remaining child tables: defect_sequences, users, running_hours_audit, change_request, ihm_items, ihm_maintenance_log, spares_history, alert_config, alert_events, certificates, defects, import_history, pms_vessel_settings, surveys, work_order_execution_details, work_order_executions, vessel_certificate_applicability, vessel_certificate_data, vessel_survey_applicability, vessel_survey_data, work_order_postponements',
    sql: `
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
    description: 'Adds vessel_id FK constraint for report_snapshots table. Documents 13 future tables that will need FK constraints when created: audit_log, bulk_import_history, component_class_regulatory, component_documents, component_maintenance_history, component_requisitions, component_running_hours_log, fleet_component_mapping, fleet_job_vessel_mapping, fleet_spare_vessel_mapping, fleet_vessel_mapping, master_data, postponement_history',
    sql: `
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
      UPDATE component_maintenance_history SET component_id = c.cuuid FROM components c WHERE component_maintenance_history.component_id = c.id;
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
    description: 'Adds component_id FK constraints referencing components(cuuid) for: spares, jobs, spare_component_links, job_component_links',
    sql: `
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
    description: 'Adds component_id FK constraints referencing components(cuuid) for: running_hours_audit, ihm_items, spares_history, work_order_executions, defects, component_running_hours_log, component_documents, component_class_regulatory, component_maintenance_history, component_requisitions, fleet_component_mapping',
    sql: `
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
      UPDATE component_maintenance_history SET job_id = j.juuid FROM jobs j WHERE component_maintenance_history.job_id = j.id AND component_maintenance_history.job_id IS NOT NULL;
      UPDATE fleet_job_vessel_mapping SET job_id = j.juuid FROM jobs j WHERE fleet_job_vessel_mapping.job_id = j.id AND fleet_job_vessel_mapping.job_id IS NOT NULL
    `
  },
  {
    id: '035_job_fk_constraints',
    name: 'FK constraints for 4 job child tables',
    description: 'FK-3 Phase 2: Add FK constraints from all 4 child tables to jobs(juuid)',
    sql: `
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
      UPDATE component_maintenance_history SET work_order_id = wo.wouuid FROM work_orders wo WHERE component_maintenance_history.work_order_id = wo.id AND component_maintenance_history.work_order_id IS NOT NULL;
      UPDATE ihm_maintenance_log SET work_order_id = wo.wouuid FROM work_orders wo WHERE ihm_maintenance_log.work_order_id = wo.id AND ihm_maintenance_log.work_order_id IS NOT NULL
    `
  },
  {
    id: '037_work_order_fk_constraints',
    name: 'FK constraints for 5 work order child tables',
    description: 'Add FK constraints from work_order_executions, work_order_execution_details, work_order_postponements, component_maintenance_history, ihm_maintenance_log to work_orders(wouuid)',
    sql: `
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
  }
];

export async function createDatabaseBackup(): Promise<string | null> {
  console.log('📦 Creating database backup...');
  
  if (isFileStorageForced()) {
    console.log('⏭️  Skipping database backup - file-based storage is active');
    return null;
  }
  
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
  
  if (isFileStorageForced()) {
    console.log('⏭️  Skipping migrations - file-based storage is active');
    return { applied: 0, skipped: 0 };
  }
  
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
        if (error.message?.includes('already exists') || error.code === '42701') {
          console.log(`  ⚠️  Migration ${migration.id} - column/table already exists, marking as complete`);
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
  
  if (isFileStorageForced()) {
    console.log('⏭️  Skipping migration generation - file-based storage is active');
    return false;
  }
  
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
  
  if (isFileStorageForced()) {
    console.log('⏭️  Skipping Drizzle migrations - file-based storage is active');
    return { applied: 0, skipped: 0 };
  }
  
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
          error.code === '42P07' || 
          error.code === '42701') {
        console.log(`  ⚠️  Migration ${migrationId} - object already exists, marking as complete`);
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

export async function runBackupAndMigrations(): Promise<void> {
  await createDatabaseBackup();
  await runMigrations();
  await generateDrizzleMigrations();
  await runDrizzleMigrations();
}
