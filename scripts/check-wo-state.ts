/**
 * Pre-flight check for FK-4: Work Orders Identity Restructure
 * Checks: wouuid existence, work_orders.id format, child table row counts, orphans, existing FK constraints
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

  console.log('═══════════════════════════════════════════════════');
  console.log('  FK-4 PRE-FLIGHT: Work Orders Identity Check');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Check if wouuid column exists
  const wouuidCol = await db.execute(sql.raw(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'wouuid'
  `));
  console.log(`wouuid column exists: ${wouuidCol.rows.length > 0 ? '⚠️ YES' : '❌ NO (will be created)'}`);

  // 2. Check work_orders.id column type and format
  const idCol = await db.execute(sql.raw(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'id'
  `));
  const idInfo = idCol.rows[0] as any;
  console.log(`work_orders.id type: ${idInfo?.data_type} (${idInfo?.udt_name})`);

  const woCount = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM work_orders`));
  console.log(`Total work_orders: ${(woCount.rows[0] as any).cnt}`);

  // Sample IDs to see format
  const woSample = await db.execute(sql.raw(`SELECT id FROM work_orders LIMIT 5`));
  console.log('Sample work_orders.id values:');
  for (const r of woSample.rows) {
    console.log(`  ${(r as any).id}`);
  }

  // 3. Child table row counts
  console.log('\n--- Child Table Row Counts ---');
  const childTables = [
    { table: 'work_order_executions', col: 'template_id' },
    { table: 'work_order_execution_details', col: 'work_order_id' },
    { table: 'work_order_postponements', col: 'work_order_id' },
    { table: 'component_maintenance_history', col: 'work_order_id' },
    { table: 'ihm_maintenance_log', col: 'work_order_id' },
  ];

  for (const ct of childTables) {
    const cnt = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${ct.table}`));
    const nonNull = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${ct.table} WHERE ${ct.col} IS NOT NULL`));
    console.log(`  ${ct.table}: ${(cnt.rows[0] as any).cnt} rows (${(nonNull.rows[0] as any).cnt} with non-null ${ct.col})`);
  }

  // 4. Orphan check (child rows with no matching parent)
  console.log('\n--- Orphan Check (before migration) ---');
  for (const ct of childTables) {
    const orphans = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM ${ct.table} c
      WHERE c.${ct.col} IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = c.${ct.col})
    `));
    const cnt = (orphans.rows[0] as any).cnt;
    console.log(`  ${ct.table}.${ct.col}: ${cnt} orphans ${cnt === '0' || cnt === 0 ? '✅' : '⚠️'}`);
  }

  // 5. Existing FK constraints on work_orders
  console.log('\n--- Existing FK Constraints referencing work_orders ---');
  const fks = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name, ccu.column_name as referenced_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'work_orders'
    ORDER BY tc.table_name
  `));
  if (fks.rows.length === 0) {
    console.log('  None (clean slate) ✅');
  } else {
    for (const fk of fks.rows) {
      const r = fk as any;
      console.log(`  ${r.table_name} → work_orders.${r.referenced_column} [${r.constraint_name}]`);
    }
  }

  await pool.end();
  console.log('\n✅ Pre-flight check complete');
  process.exit(0);
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
