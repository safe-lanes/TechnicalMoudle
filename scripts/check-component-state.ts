/**
 * Pre-flight check for FK-2: Component identity restructure
 * Checks: cuuid existence, component count, child table orphans
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

async function check() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('═══════════════════════════════════════════');
  console.log('  FK-2 PRE-FLIGHT: Component State Check');
  console.log('═══════════════════════════════════════════\n');

  // 1. Check if cuuid column exists already
  const cuuidCol = await db.execute(sql.raw(`SELECT column_name FROM information_schema.columns WHERE table_name = 'components' AND column_name = 'cuuid'`));
  console.log('cuuid column exists:', cuuidCol.rows.length > 0);

  // 2. Check components table
  const compCount = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM components`));
  console.log('Component count:', (compCount.rows[0] as any).cnt);

  // 3. Check id type
  const idType = await db.execute(sql.raw(`SELECT data_type FROM information_schema.columns WHERE table_name = 'components' AND column_name = 'id'`));
  console.log('components.id type:', (idType.rows[0] as any).data_type);

  // 4. Sample component IDs
  const samples = await db.execute(sql.raw(`SELECT id FROM components LIMIT 5`));
  console.log('Sample component IDs:', samples.rows.map((r: any) => r.id));

  // 5. Check each child table for orphaned component_id references
  const childTables = [
    'running_hours_audit', 'ihm_items', 'spares', 'spares_history', 'jobs',
    'work_order_executions', 'defects', 'component_running_hours_log',
    'component_documents', 'component_class_regulatory', 'component_maintenance_history',
    'component_requisitions', 'fleet_component_mapping', 'spare_component_links', 'job_component_links'
  ];

  console.log('\n--- Orphan Check (child tables with component_id) ---');
  let totalOrphans = 0;
  for (const table of childTables) {
    try {
      const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${table}`));
      const count = Number((countResult.rows[0] as any).cnt);

      if (count === 0) {
        console.log(`  ${table}: 0 rows (empty)`);
        continue;
      }

      const orphanResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as cnt FROM ${table} t
        WHERE t.component_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM components c WHERE c.id = t.component_id)
      `));
      const orphans = Number((orphanResult.rows[0] as any).cnt);

      if (orphans > 0) {
        console.log(`  ❌ ${table}: ${count} rows, ${orphans} ORPHANS`);
        totalOrphans += orphans;
      } else {
        console.log(`  ✅ ${table}: ${count} rows, 0 orphans`);
      }
    } catch (e: any) {
      console.log(`  ⚠️  ${table}: ${e.message.includes('does not exist') ? 'TABLE NOT FOUND' : e.message}`);
    }
  }

  // 6. Check self-references (parentId, rhMasterComponentId)
  console.log('\n--- Self-Reference Check ---');
  try {
    const parentOrphans = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM components c
      WHERE c.parent_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM components p WHERE p.id = c.parent_id)
    `));
    console.log(`  parentId orphans: ${(parentOrphans.rows[0] as any).cnt}`);
  } catch (e: any) { console.log(`  parentId check error: ${e.message}`); }

  try {
    const rhMasterOrphans = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM components c
      WHERE c.rh_master_component_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM components p WHERE p.id = c.rh_master_component_id)
    `));
    console.log(`  rhMasterComponentId orphans: ${(rhMasterOrphans.rows[0] as any).cnt}`);
  } catch (e: any) { console.log(`  rhMasterComponentId check error: ${e.message}`); }

  // 7. Check existing FK constraints on components
  const existingFks = await db.execute(sql.raw(`
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'components'
    ORDER BY tc.table_name
  `));
  console.log(`\nExisting FK constraints referencing components: ${existingFks.rows.length}`);
  for (const fk of existingFks.rows) {
    console.log(`  ${(fk as any).table_name}: ${(fk as any).constraint_name}`);
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Total orphans: ${totalOrphans}`);
  console.log(`═══════════════════════════════════════════`);

  await pool.end();
  process.exit(totalOrphans > 0 ? 1 : 0);
}

check().catch(e => { console.error('Error:', e.message); process.exit(1); });
