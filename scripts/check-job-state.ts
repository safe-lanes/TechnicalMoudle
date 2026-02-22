/**
 * Pre-flight check for FK-3: Jobs Identity Restructure
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

async function run() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  console.log('🔗 Connected to PostgreSQL\n');

  // 1. Check if juuid column exists
  const juuidCheck = await db.execute(sql.raw(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'juuid'
  `));
  console.log(`juuid column exists: ${juuidCheck.rows.length > 0 ? '✅ YES' : '❌ NO (clean slate)'}`);

  // 2. Check jobs.id format
  const jobSample = await db.execute(sql.raw(`SELECT id FROM jobs LIMIT 5`));
  console.log(`\nSample jobs.id values:`);
  for (const r of jobSample.rows) {
    const row = r as any;
    console.log(`  ${row.id}`);
  }

  // 3. Count jobs
  const jobCount = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM jobs`));
  console.log(`\nTotal jobs: ${(jobCount.rows[0] as any).cnt}`);

  // 4. Check jobs.id column type
  const idType = await db.execute(sql.raw(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'id'
  `));
  console.log(`jobs.id type: ${(idType.rows[0] as any).data_type}`);

  // 5. Check child table data counts
  const childTables = [
    { name: 'work_orders', col: 'job_id' },
    { name: 'job_component_links', col: 'job_id' },
    { name: 'component_maintenance_history', col: 'job_id' },
    { name: 'fleet_job_vessel_mapping', col: 'job_id' },
  ];

  console.log(`\nChild table data counts:`);
  for (const t of childTables) {
    const total = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${t.name}`));
    const withJob = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${t.name} WHERE ${t.col} IS NOT NULL`));
    console.log(`  ${t.name}: ${(total.rows[0] as any).cnt} total, ${(withJob.rows[0] as any).cnt} with job_id`);
  }

  // 6. Check orphaned job_id references
  console.log(`\nOrphan check (child job_id not in jobs.id):`);
  for (const t of childTables) {
    const orphans = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM ${t.name} ct
      WHERE ct.${t.col} IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = ct.${t.col})
    `));
    console.log(`  ${t.name}: ${(orphans.rows[0] as any).cnt} orphans`);
  }

  // 7. Check existing FK constraints on jobs
  const fks = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'jobs'
    ORDER BY tc.table_name
  `));
  console.log(`\nExisting FK constraints referencing jobs: ${fks.rows.length}`);
  for (const fk of fks.rows) {
    const r = fk as any;
    console.log(`  ${r.table_name} → jobs [${r.constraint_name}]`);
  }

  await pool.end();
  console.log('\n✅ Pre-flight check complete');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
