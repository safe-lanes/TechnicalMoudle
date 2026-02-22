/**
 * Run Migrations 034-035: Job juuid + FK constraints
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
    id: '034_job_juuid_column_and_data_migration',
    name: 'Add juuid column to jobs + migrate child data',
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

  // Verify juuid column
  console.log('\n📋 Verification...');
  const jobsSample = await db.execute(sql.raw(`SELECT id, juuid FROM jobs LIMIT 5`));
  console.log(`Sample jobs (id → juuid):`);
  for (const j of jobsSample.rows) {
    const r = j as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.juuid);
    console.log(`  ${r.id} → ${r.juuid} ${isUuid ? '✅ UUID' : '❌ not UUID'}`);
  }

  // Verify child data migrated
  const woSample = await db.execute(sql.raw(`SELECT job_id FROM work_orders WHERE job_id IS NOT NULL LIMIT 3`));
  console.log(`\nSample work_orders.job_id (should be UUIDs now):`);
  for (const w of woSample.rows) {
    const r = w as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.job_id);
    console.log(`  ${r.job_id} ${isUuid ? '✅' : '❌'}`);
  }

  const jclSample = await db.execute(sql.raw(`SELECT job_id FROM job_component_links LIMIT 3`));
  console.log(`\nSample job_component_links.job_id (should be UUIDs now):`);
  for (const l of jclSample.rows) {
    const r = l as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.job_id);
    console.log(`  ${r.job_id} ${isUuid ? '✅' : '❌'}`);
  }

  // Verify FK constraints
  const fks = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'jobs' AND ccu.column_name = 'juuid'
    ORDER BY tc.table_name
  `));
  console.log(`\n✅ Found ${fks.rows.length} FK constraints referencing jobs(juuid)`);
  for (const fk of fks.rows) {
    const r = fk as any;
    console.log(`  ✅ ${r.table_name} → jobs.juuid  [${r.constraint_name}]`);
  }

  // Verify zero orphans
  const orphanCheck = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM work_orders wo
    WHERE wo.job_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.juuid = wo.job_id)
  `));
  console.log(`\nOrphan check (work_orders): ${(orphanCheck.rows[0] as any).cnt} orphans`);

  const orphanCheck2 = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM job_component_links jcl
    WHERE NOT EXISTS (SELECT 1 FROM jobs j WHERE j.juuid = jcl.job_id)
  `));
  console.log(`Orphan check (job_component_links): ${(orphanCheck2.rows[0] as any).cnt} orphans`);

  await pool.end();
  console.log('\n✅ All migrations (034-035) complete');
  process.exit(0);
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
