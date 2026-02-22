/**
 * Pre-flight check for FK-5: Spares Identity Restructure
 * Key difference: spares.id is INTEGER, child tables have INTEGER spare_id
 * We add parallel spare_uuid TEXT columns to child tables
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
  console.log('  FK-5 PRE-FLIGHT: Spares Identity Check');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Check suuid column
  const suuidCol = await db.execute(sql.raw(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'spares' AND column_name = 'suuid'
  `));
  console.log(`suuid column exists: ${suuidCol.rows.length > 0 ? '⚠️ YES' : '❌ NO (will be created)'}`);

  // 2. Check spares.id type
  const idCol = await db.execute(sql.raw(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'spares' AND column_name = 'id'
  `));
  const idInfo = idCol.rows[0] as any;
  console.log(`spares.id type: ${idInfo?.data_type} (${idInfo?.udt_name})`);

  const spareCount = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM spares`));
  console.log(`Total spares: ${(spareCount.rows[0] as any).cnt}`);

  // 3. Child table info
  console.log('\n--- Child Tables (INTEGER spare_id) ---');
  const childTables = [
    { table: 'spares_history', col: 'spare_id', uuidCol: 'spare_uuid' },
    { table: 'spare_component_links', col: 'spare_id', uuidCol: 'spare_uuid' },
    { table: 'spare_location_stock', col: 'spare_id', uuidCol: 'spare_uuid' },
    { table: 'inventory_transactions', col: 'spare_id', uuidCol: 'spare_uuid' },
  ];

  for (const ct of childTables) {
    const cnt = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${ct.table}`));
    const colType = await db.execute(sql.raw(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = '${ct.table}' AND column_name = '${ct.col}'
    `));
    const uuidColExists = await db.execute(sql.raw(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = '${ct.table}' AND column_name = '${ct.uuidCol}'
    `));
    console.log(`  ${ct.table}: ${(cnt.rows[0] as any).cnt} rows, ${ct.col} type=${(colType.rows[0] as any)?.data_type}, spare_uuid col=${uuidColExists.rows.length > 0 ? 'EXISTS' : 'NOT YET'}`);
  }

  // 4. Orphan check
  console.log('\n--- Orphan Check ---');
  for (const ct of childTables) {
    const orphans = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM ${ct.table} c
      WHERE NOT EXISTS (SELECT 1 FROM spares s WHERE s.id = c.${ct.col})
    `));
    const cnt = (orphans.rows[0] as any).cnt;
    console.log(`  ${ct.table}.${ct.col}: ${cnt} orphans ${cnt === '0' || cnt === 0 ? '✅' : '⚠️'}`);
  }

  // 5. Existing FK constraints
  console.log('\n--- Existing FK Constraints referencing spares ---');
  const fks = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name, ccu.column_name as referenced_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'spares'
    ORDER BY tc.table_name
  `));
  if (fks.rows.length === 0) {
    console.log('  None (clean slate) ✅');
  } else {
    for (const fk of fks.rows) {
      const r = fk as any;
      console.log(`  ${r.table_name} → spares.${r.referenced_column} [${r.constraint_name}]`);
    }
  }

  // 6. Unique constraints on child tables
  console.log('\n--- Unique Constraints on Child Tables ---');
  const uniques = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name,
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_name IN ('spare_component_links', 'spare_location_stock')
    GROUP BY tc.table_name, tc.constraint_name
  `));
  for (const u of uniques.rows) {
    const r = u as any;
    console.log(`  ${r.table_name}: ${r.constraint_name} (${r.columns})`);
  }

  await pool.end();
  console.log('\n✅ Pre-flight check complete');
  process.exit(0);
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
