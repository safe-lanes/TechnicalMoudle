/**
 * Run Migrations 036-037: Work Order wouuid + FK constraints
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

interface MigDef { id: string; name: string; sql: string; }

const migrations: MigDef[] = [
  {
    id: '036_work_order_wouuid_column_and_data_migration',
    name: 'Add wouuid column to work_orders + migrate child data',
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
  }
];

async function run() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  console.log('🔗 Connected to PostgreSQL');

  for (const mig of migrations) {
    const check = await db.execute(sql.raw(`SELECT id FROM schema_migrations WHERE id = '${mig.id}'`));
    if (check.rows.length > 0) { console.log(`⏭️  ${mig.id} already applied`); continue; }

    console.log(`\n🔄 Running ${mig.id}: ${mig.name}...`);
    try {
      await db.execute(sql.raw(mig.sql));
      await db.execute(sql`INSERT INTO schema_migrations (id, name, description, applied_at) VALUES (${mig.id}, ${mig.name}, ${mig.name}, NOW()) ON CONFLICT (id) DO NOTHING`);
      console.log(`  ✅ ${mig.id} applied successfully`);
    } catch (error: any) {
      console.error(`  ❌ ${mig.id} FAILED:`, error.message);
      await pool.end();
      process.exit(1);
    }
  }

  // Verify wouuid column
  console.log('\n📋 Verification...');
  const woSample = await db.execute(sql.raw(`SELECT id, wouuid FROM work_orders LIMIT 5`));
  console.log('Sample work_orders (id → wouuid):');
  for (const w of woSample.rows) {
    const r = w as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.wouuid);
    console.log(`  ${r.id} → ${r.wouuid} ${isUuid ? '✅ UUID' : '❌ not UUID'}`);
  }

  // Verify FK constraints
  const fks = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'work_orders' AND ccu.column_name = 'wouuid'
    ORDER BY tc.table_name
  `));
  console.log(`\n✅ Found ${fks.rows.length} FK constraints referencing work_orders(wouuid)`);
  for (const fk of fks.rows) {
    const r = fk as any;
    console.log(`  ✅ ${r.table_name} → work_orders.wouuid  [${r.constraint_name}]`);
  }

  await pool.end();
  console.log('\n✅ All migrations (036-037) complete');
  process.exit(0);
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
