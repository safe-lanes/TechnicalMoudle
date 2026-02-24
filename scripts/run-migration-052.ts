/**
 * Execute migration 052 (standard audit columns) directly against the database.
 * Adds 7 standard columns to 71 tables (410 alterations).
 * All operations use ADD COLUMN IF NOT EXISTS — fully idempotent and safe.
 */
import pg from 'pg';

const DB_URL = 'postgres://postgres:admin123@localhost:5432/pms';

interface TableMigration {
  name: string;
  sql: string;
}

const tables: TableMigration[] = [
  { name: 'alert_config', sql: 'ALTER TABLE "alert_config" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'alert_deliveries', sql: 'ALTER TABLE "alert_deliveries" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'alert_events', sql: 'ALTER TABLE "alert_events" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'alert_policies', sql: 'ALTER TABLE "alert_policies" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'audit_log', sql: 'ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'bulk_import_errors', sql: 'ALTER TABLE "bulk_import_errors" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'bulk_import_history', sql: 'ALTER TABLE "bulk_import_history" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'certificates', sql: 'ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'change_request', sql: 'ALTER TABLE "change_request" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'change_request_attachment', sql: 'ALTER TABLE "change_request_attachment" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'change_request_comment', sql: 'ALTER TABLE "change_request_comment" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'component_class_regulatory', sql: 'ALTER TABLE "component_class_regulatory" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'component_documents', sql: 'ALTER TABLE "component_documents" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'component_maintenance_history', sql: 'ALTER TABLE "component_maintenance_history" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'component_requisitions', sql: 'ALTER TABLE "component_requisitions" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'component_running_hours_log', sql: 'ALTER TABLE "component_running_hours_log" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'components', sql: 'ALTER TABLE "components" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'defect_actions', sql: 'ALTER TABLE "defect_actions" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'defect_attachments', sql: 'ALTER TABLE "defect_attachments" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'defect_categories', sql: 'ALTER TABLE "defect_categories" ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'defect_sequences', sql: 'ALTER TABLE "defect_sequences" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'defect_types', sql: 'ALTER TABLE "defect_types" ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'defects', sql: 'ALTER TABLE "defects" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'equipment_categories', sql: 'ALTER TABLE "equipment_categories" ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'fleet_component_mapping', sql: 'ALTER TABLE "fleet_component_mapping" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'fleet_job_vessel_mapping', sql: 'ALTER TABLE "fleet_job_vessel_mapping" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'fleet_spare_vessel_mapping', sql: 'ALTER TABLE "fleet_spare_vessel_mapping" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'fleet_vessel_mapping', sql: 'ALTER TABLE "fleet_vessel_mapping" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'fleets', sql: 'ALTER TABLE "fleets" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'form_definitions', sql: 'ALTER TABLE "form_definitions" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'form_version_usage', sql: 'ALTER TABLE "form_version_usage" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'form_versions', sql: 'ALTER TABLE "form_versions" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'ihm_items', sql: 'ALTER TABLE "ihm_items" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'ihm_maintenance_log', sql: 'ALTER TABLE "ihm_maintenance_log" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'import_change_log', sql: 'ALTER TABLE "import_change_log" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'import_history', sql: 'ALTER TABLE "import_history" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'inventory_transactions', sql: 'ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'job_component_links', sql: 'ALTER TABLE "job_component_links" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'jobs', sql: 'ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'locations', sql: 'ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'makers', sql: 'ALTER TABLE "makers" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'master_data', sql: 'ALTER TABLE "master_data" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'master_lists', sql: 'ALTER TABLE "master_lists" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'pms_vessel_settings', sql: 'ALTER TABLE "pms_vessel_settings" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'recurring_defect_links', sql: 'ALTER TABLE "recurring_defect_links" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'recurring_defects', sql: 'ALTER TABLE "recurring_defects" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'report_snapshots', sql: 'ALTER TABLE "report_snapshots" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'running_hours_audit', sql: 'ALTER TABLE "running_hours_audit" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'schema_migrations', sql: 'ALTER TABLE "schema_migrations" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'sfi_details', sql: 'ALTER TABLE "sfi_details" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'ship_certificates_labels_config', sql: 'ALTER TABLE "ship_certificates_labels_config" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'ship_certificates_master', sql: 'ALTER TABLE "ship_certificates_master" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'ship_surveys_labels_config', sql: 'ALTER TABLE "ship_surveys_labels_config" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'ship_surveys_master', sql: 'ALTER TABLE "ship_surveys_master" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'spare_component_links', sql: 'ALTER TABLE "spare_component_links" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'spare_location_stock', sql: 'ALTER TABLE "spare_location_stock" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'spares', sql: 'ALTER TABLE "spares" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'spares_history', sql: 'ALTER TABLE "spares_history" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'stores_items', sql: 'ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'stores_ledger', sql: 'ALTER TABLE "stores_ledger" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(), ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'surveys', sql: 'ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'users', sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'vessel_certificate_applicability', sql: 'ALTER TABLE "vessel_certificate_applicability" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'vessel_certificate_data', sql: 'ALTER TABLE "vessel_certificate_data" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'vessel_survey_applicability', sql: 'ALTER TABLE "vessel_survey_applicability" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'vessel_survey_data', sql: 'ALTER TABLE "vessel_survey_data" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'vessels', sql: 'ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'work_order_execution_details', sql: 'ALTER TABLE "work_order_execution_details" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'work_order_executions', sql: 'ALTER TABLE "work_order_executions" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'work_order_postponements', sql: 'ALTER TABLE "work_order_postponements" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  { name: 'work_orders', sql: 'ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS created_by_uuid TEXT, ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT, ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE' },
  // Fix default on job_component_links.updated_at
  { name: 'job_component_links (fix default)', sql: 'ALTER TABLE "job_component_links" ALTER COLUMN updated_at SET DEFAULT NOW()' },
];

async function main() {
  const pool = new pg.Pool({ connectionString: DB_URL });
  const client = await pool.connect();

  try {
    // Check if already applied
    const check = await client.query(
      "SELECT id FROM schema_migrations WHERE id = '052_standard_audit_columns'"
    );
    if (check.rows.length > 0) {
      console.log('Migration 052 already applied -- skipping');
      return;
    }

    console.log('Executing migration 052_standard_audit_columns...');
    console.log('Adding 7 standard audit columns to 71 tables (410 alterations)...\n');

    const startTime = Date.now();
    let success = 0;
    let failed = 0;

    for (const t of tables) {
      try {
        await client.query(t.sql);
        console.log('  OK ' + t.name);
        success++;
      } catch (err: any) {
        if (err.code === '42701') {
          console.log('  SKIP ' + t.name + ' -- column(s) already exist');
          success++;
        } else {
          console.log('  FAIL ' + t.name + ': ' + err.message);
          failed++;
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n=== Migration 052 Complete ===');
    console.log('  Tables processed: ' + (success + failed));
    console.log('  Success: ' + success);
    console.log('  Failed: ' + failed);
    console.log('  Time: ' + elapsed + 's');

    // Record in schema_migrations
    if (failed === 0) {
      await client.query(
        "INSERT INTO schema_migrations (id, name, description, applied_at) VALUES ('052_standard_audit_columns', 'Add standard audit columns to all tables', '410 alterations across 71 tables', NOW()) ON CONFLICT (id) DO NOTHING"
      );
      console.log('  Migration recorded in schema_migrations');
    } else {
      console.log('  WARNING: ' + failed + ' tables failed -- NOT marking migration as complete');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
