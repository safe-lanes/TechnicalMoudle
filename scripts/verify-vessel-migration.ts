/**
 * Final verification of vessel FK migration (027-030)
 * Checks: vuuid column, FK constraints, data integrity
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
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function verify() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log('═══════════════════════════════════════════');
  console.log('  VESSEL FK MIGRATION — FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  // 1. Check vuuid column exists
  const vuuidCol = await db.execute(sql.raw(`SELECT column_name FROM information_schema.columns WHERE table_name = 'vessels' AND column_name = 'vuuid'`));
  if (vuuidCol.rows.length > 0) {
    console.log('✅ vuuid column exists on vessels table');
    passed++;
  } else {
    console.log('❌ vuuid column MISSING on vessels table');
    failed++;
  }

  // 2. Check vuuid UNIQUE constraint
  const vuuidUnique = await db.execute(sql.raw(`SELECT conname FROM pg_constraint WHERE conname = 'vessels_vuuid_unique'`));
  if (vuuidUnique.rows.length > 0) {
    console.log('✅ vessels_vuuid_unique constraint exists');
    passed++;
  } else {
    console.log('❌ vessels_vuuid_unique constraint MISSING');
    failed++;
  }

  // 3. Check all 16 vessels have vuuid populated
  const vessels = await db.execute(sql.raw(`SELECT id, vuuid FROM vessels`));
  const allMatch = vessels.rows.every((v: any) => v.id === v.vuuid && v.vuuid !== null);
  if (allMatch && vessels.rows.length === 16) {
    console.log(`✅ All ${vessels.rows.length} vessels have vuuid = id`);
    passed++;
  } else {
    console.log(`❌ Vessel vuuid mismatch: ${vessels.rows.length} vessels, allMatch=${allMatch}`);
    failed++;
  }

  // 4. Check FK constraints count
  const fks = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'vessels' AND ccu.column_name = 'vuuid'
    ORDER BY tc.table_name
  `));
  if (fks.rows.length === 33) {
    console.log(`✅ 33 FK constraints reference vessels(vuuid)`);
    passed++;
  } else {
    console.log(`❌ Expected 33 FK constraints, found ${fks.rows.length}`);
    failed++;
    for (const fk of fks.rows) {
      console.log(`   ${(fk as any).table_name}: ${(fk as any).constraint_name}`);
    }
  }

  // 5. Check migrations recorded
  const migs = await db.execute(sql.raw(`SELECT id FROM schema_migrations WHERE id LIKE '02%' OR id LIKE '03%' ORDER BY id`));
  const migIds = migs.rows.map((r: any) => r.id);
  const expected = ['027_vessel_vuuid_column', '028_vessel_fk_batch1_data_tables', '029_vessel_fk_batch2_empty_tables', '030_vessel_fk_report_snapshots'];
  const allMigsPresent = expected.every(e => migIds.includes(e));
  if (allMigsPresent) {
    console.log('✅ All 4 migrations (027-030) recorded in schema_migrations');
    passed++;
  } else {
    console.log('❌ Missing migrations:', expected.filter(e => !migIds.includes(e)));
    failed++;
  }

  // 6. Check NO orphaned vessel_id references (spot-check key tables)
  const spotCheckTables = ['components', 'spares', 'jobs', 'work_orders', 'inventory_transactions', 'defects'];
  let orphanCount = 0;
  for (const table of spotCheckTables) {
    const orphans = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM ${table} t
      WHERE t.vessel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM vessels v WHERE v.vuuid = t.vessel_id)
    `));
    const cnt = Number((orphans.rows[0] as any).cnt);
    if (cnt > 0) {
      console.log(`❌ ${table}: ${cnt} orphaned vessel_id values`);
      orphanCount += cnt;
      failed++;
    }
  }
  if (orphanCount === 0) {
    console.log('✅ Zero orphaned vessel_id references (spot-check: 6 key tables)');
    passed++;
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  RESULT: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

verify().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
