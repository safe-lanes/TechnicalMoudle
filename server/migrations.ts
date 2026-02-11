import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
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
    id: '027_vessel_id_int_triggers_backfill',
    name: 'Vessel integer ID dual-write triggers and backfill',
    description: 'Creates sync_vessel_id_int() trigger function and 31 triggers for automatic vessel_id_int population, plus backfills existing data',
    sql: `
      CREATE OR REPLACE FUNCTION sync_vessel_id_int()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.vessel_id IS NOT NULL THEN
          NEW.vessel_id_int := (SELECT id_int FROM vessels WHERE id = NEW.vessel_id);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DO $do$
      DECLARE
        tbl TEXT;
        trg_name TEXT;
      BEGIN
        FOR tbl IN
          SELECT unnest(ARRAY[
            'alert_config','alert_events','certificates','change_request','components',
            'defect_sequences','defects','ihm_items','ihm_maintenance_log','import_history',
            'inventory_transactions','job_component_links','jobs','locations','pms_vessel_settings',
            'running_hours_audit','spare_component_links','spare_location_stock','spares',
            'spares_history','stores_items','stores_ledger','surveys','users',
            'vessel_certificate_applicability','vessel_certificate_data',
            'vessel_survey_applicability','vessel_survey_data',
            'work_order_execution_details','work_order_executions','work_orders'
          ])
        LOOP
          trg_name := 'trg_sync_vessel_id_int_' || regexp_replace(tbl, '[^a-z0-9_]', '_', 'g');
          IF length(trg_name) > 63 THEN
            trg_name := left(trg_name, 63);
          END IF;
          EXECUTE format(
            'CREATE OR REPLACE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sync_vessel_id_int()',
            trg_name, tbl
          );
        END LOOP;
      END $do$;

      UPDATE alert_config SET vessel_id_int = v.id_int FROM vessels v WHERE alert_config.vessel_id = v.id AND alert_config.vessel_id_int IS NULL;
      UPDATE alert_events SET vessel_id_int = v.id_int FROM vessels v WHERE alert_events.vessel_id = v.id AND alert_events.vessel_id_int IS NULL;
      UPDATE certificates SET vessel_id_int = v.id_int FROM vessels v WHERE certificates.vessel_id = v.id AND certificates.vessel_id_int IS NULL;
      UPDATE change_request SET vessel_id_int = v.id_int FROM vessels v WHERE change_request.vessel_id = v.id AND change_request.vessel_id_int IS NULL;
      UPDATE components SET vessel_id_int = v.id_int FROM vessels v WHERE components.vessel_id = v.id AND components.vessel_id_int IS NULL;
      UPDATE defect_sequences SET vessel_id_int = v.id_int FROM vessels v WHERE defect_sequences.vessel_id = v.id AND defect_sequences.vessel_id_int IS NULL;
      UPDATE defects SET vessel_id_int = v.id_int FROM vessels v WHERE defects.vessel_id = v.id AND defects.vessel_id_int IS NULL;
      UPDATE ihm_items SET vessel_id_int = v.id_int FROM vessels v WHERE ihm_items.vessel_id = v.id AND ihm_items.vessel_id_int IS NULL;
      UPDATE ihm_maintenance_log SET vessel_id_int = v.id_int FROM vessels v WHERE ihm_maintenance_log.vessel_id = v.id AND ihm_maintenance_log.vessel_id_int IS NULL;
      UPDATE import_history SET vessel_id_int = v.id_int FROM vessels v WHERE import_history.vessel_id = v.id AND import_history.vessel_id_int IS NULL;
      UPDATE inventory_transactions SET vessel_id_int = v.id_int FROM vessels v WHERE inventory_transactions.vessel_id = v.id AND inventory_transactions.vessel_id_int IS NULL;
      UPDATE job_component_links SET vessel_id_int = v.id_int FROM vessels v WHERE job_component_links.vessel_id = v.id AND job_component_links.vessel_id_int IS NULL;
      UPDATE jobs SET vessel_id_int = v.id_int FROM vessels v WHERE jobs.vessel_id = v.id AND jobs.vessel_id_int IS NULL;
      UPDATE locations SET vessel_id_int = v.id_int FROM vessels v WHERE locations.vessel_id = v.id AND locations.vessel_id_int IS NULL;
      UPDATE pms_vessel_settings SET vessel_id_int = v.id_int FROM vessels v WHERE pms_vessel_settings.vessel_id = v.id AND pms_vessel_settings.vessel_id_int IS NULL;
      UPDATE running_hours_audit SET vessel_id_int = v.id_int FROM vessels v WHERE running_hours_audit.vessel_id = v.id AND running_hours_audit.vessel_id_int IS NULL;
      UPDATE spare_component_links SET vessel_id_int = v.id_int FROM vessels v WHERE spare_component_links.vessel_id = v.id AND spare_component_links.vessel_id_int IS NULL;
      UPDATE spare_location_stock SET vessel_id_int = v.id_int FROM vessels v WHERE spare_location_stock.vessel_id = v.id AND spare_location_stock.vessel_id_int IS NULL;
      UPDATE spares SET vessel_id_int = v.id_int FROM vessels v WHERE spares.vessel_id = v.id AND spares.vessel_id_int IS NULL;
      UPDATE spares_history SET vessel_id_int = v.id_int FROM vessels v WHERE spares_history.vessel_id = v.id AND spares_history.vessel_id_int IS NULL;
      UPDATE stores_items SET vessel_id_int = v.id_int FROM vessels v WHERE stores_items.vessel_id = v.id AND stores_items.vessel_id_int IS NULL;
      UPDATE stores_ledger SET vessel_id_int = v.id_int FROM vessels v WHERE stores_ledger.vessel_id = v.id AND stores_ledger.vessel_id_int IS NULL;
      UPDATE surveys SET vessel_id_int = v.id_int FROM vessels v WHERE surveys.vessel_id = v.id AND surveys.vessel_id_int IS NULL;
      UPDATE users SET vessel_id_int = v.id_int FROM vessels v WHERE users.vessel_id = v.id AND users.vessel_id_int IS NULL;
      UPDATE vessel_certificate_applicability SET vessel_id_int = v.id_int FROM vessels v WHERE vessel_certificate_applicability.vessel_id = v.id AND vessel_certificate_applicability.vessel_id_int IS NULL;
      UPDATE vessel_certificate_data SET vessel_id_int = v.id_int FROM vessels v WHERE vessel_certificate_data.vessel_id = v.id AND vessel_certificate_data.vessel_id_int IS NULL;
      UPDATE vessel_survey_applicability SET vessel_id_int = v.id_int FROM vessels v WHERE vessel_survey_applicability.vessel_id = v.id AND vessel_survey_applicability.vessel_id_int IS NULL;
      UPDATE vessel_survey_data SET vessel_id_int = v.id_int FROM vessels v WHERE vessel_survey_data.vessel_id = v.id AND vessel_survey_data.vessel_id_int IS NULL;
      UPDATE work_order_execution_details SET vessel_id_int = v.id_int FROM vessels v WHERE work_order_execution_details.vessel_id = v.id AND work_order_execution_details.vessel_id_int IS NULL;
      UPDATE work_order_executions SET vessel_id_int = v.id_int FROM vessels v WHERE work_order_executions.vessel_id = v.id AND work_order_executions.vessel_id_int IS NULL;
      UPDATE work_orders SET vessel_id_int = v.id_int FROM vessels v WHERE work_orders.vessel_id = v.id AND work_orders.vessel_id_int IS NULL
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

export async function runDrizzleMigrations(): Promise<void> {
  console.log('🔄 Running Drizzle file-based migrations...');
  
  if (isFileStorageForced()) {
    console.log('⏭️  Skipping Drizzle migrations - file-based storage is active');
    return;
  }
  
  const postgres = await resolvePostgres();
  if (!postgres) {
    console.log('⏭️  Skipping Drizzle migrations - DATABASE_URL not configured');
    return;
  }
  
  const { db } = postgres;
  const migrationsFolder = path.join(process.cwd(), 'migrations');
  
  if (!fs.existsSync(migrationsFolder)) {
    console.log('⏭️  Skipping Drizzle migrations - migrations folder not found');
    return;
  }
  
  try {
    await migrate(db, { migrationsFolder });
    console.log('✅ Drizzle file-based migrations complete');
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.code === '42P07') {
      console.log('✅ Drizzle migrations complete (tables already exist)');
    } else {
      console.error('❌ Drizzle migration error:', error.message);
      throw error;
    }
  }
}

export async function runBackupAndMigrations(): Promise<void> {
  await createDatabaseBackup();
  await runMigrations();
  await generateDrizzleMigrations();
  await runDrizzleMigrations();
}
