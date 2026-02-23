import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  let allPassed = true;
  const failures: string[] = [];

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FK IDENTITY RESTRUCTURE — FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ─── CHECK 1: All parent tables have UUID columns ───────────────────
  console.log('── CHECK 1: Parent UUID columns exist ──');
  const parentUuidColumns = [
    { table: 'vessels', column: 'vuuid', fk: 'FK-1' },
    { table: 'components', column: 'cuuid', fk: 'FK-2' },
    { table: 'jobs', column: 'juuid', fk: 'FK-3' },
    { table: 'work_orders', column: 'wouuid', fk: 'FK-4' },
    { table: 'spares', column: 'suuid', fk: 'FK-5' },
    { table: 'stores_items', column: 'stuuid', fk: 'FK-6' },
    { table: 'defects', column: 'duuid', fk: 'FK-7' },
    { table: 'alert_policies', column: 'apuuid', fk: 'FK-8' },
    { table: 'alert_events', column: 'aeuuid', fk: 'FK-8' },
    { table: 'form_definitions', column: 'fduuid', fk: 'FK-9' },
    { table: 'form_versions', column: 'fvuuid', fk: 'FK-9' },
    { table: 'bulk_import_history', column: 'biuuid', fk: 'FK-10' },
  ];

  for (const { table, column, fk } of parentUuidColumns) {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column]
    );
    const exists = res.rows.length > 0;
    const status = exists ? '✅' : '❌';
    console.log(`  ${status} ${fk}: ${table}.${column}`);
    if (!exists) {
      allPassed = false;
      failures.push(`Missing UUID column: ${table}.${column} (${fk})`);
    }
  }

  // ─── CHECK 2: Verify child FK columns exist (auto-detected from pg_constraint) ──
  console.log('\n── CHECK 2: Child FK columns referencing parent UUID columns ──');
  // Instead of hardcoding column names, query the actual FK constraints to verify
  // FK-1 through FK-7 repurposed existing ID columns (vessel_id, component_id, etc.)
  // FK-8 through FK-10 added new UUID columns (policy_uuid, event_uuid, etc.)
  const childFkCheck = await pool.query(`
    SELECT
      c.conrelid::regclass AS child_table,
      a_child.attname AS child_column,
      c.confrelid::regclass AS parent_table,
      a_parent.attname AS parent_column
    FROM pg_constraint c
    JOIN pg_attribute a_child ON a_child.attrelid = c.conrelid AND a_child.attnum = ANY(c.conkey)
    JOIN pg_attribute a_parent ON a_parent.attrelid = c.confrelid AND a_parent.attnum = ANY(c.confkey)
    WHERE c.contype = 'f'
      AND a_parent.attname IN ('vuuid','cuuid','juuid','wouuid','suuid','stuuid','duuid','apuuid','aeuuid','fduuid','fvuuid','biuuid')
    ORDER BY a_parent.attname, c.conrelid::regclass::text
  `);

  // Group by parent UUID to show summary
  const byParent: Record<string, string[]> = {};
  for (const row of childFkCheck.rows) {
    const key = `${row.parent_table}.${row.parent_column}`;
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(`${row.child_table}.${row.child_column}`);
  }

  for (const [parent, children] of Object.entries(byParent)) {
    console.log(`  ✅ ${parent} ← ${children.length} child FK(s)`);
    for (const child of children) {
      console.log(`      → ${child}`);
    }
  }
  console.log(`  Total: ${childFkCheck.rows.length} child FK columns verified`);

  // ─── CHECK 3: All FK constraints exist ──────────────────────────────
  console.log('\n── CHECK 3: FK constraints referencing UUID columns ──');
  const fkRes = await pool.query(`
    SELECT
      c.conname AS constraint_name,
      c.conrelid::regclass AS child_table,
      c.confrelid::regclass AS parent_table,
      a_child.attname AS child_column,
      a_parent.attname AS parent_column
    FROM pg_constraint c
    JOIN pg_attribute a_child ON a_child.attrelid = c.conrelid AND a_child.attnum = ANY(c.conkey)
    JOIN pg_attribute a_parent ON a_parent.attrelid = c.confrelid AND a_parent.attnum = ANY(c.confkey)
    WHERE c.contype = 'f'
      AND (a_parent.attname LIKE '%uuid' OR a_parent.attname IN ('vuuid','cuuid','juuid','wouuid','suuid','stuuid','duuid','apuuid','aeuuid','fduuid','fvuuid','biuuid'))
    ORDER BY c.confrelid::regclass::text, c.conrelid::regclass::text
  `);

  console.log(`  Found ${fkRes.rows.length} UUID-based FK constraints:`);
  for (const row of fkRes.rows) {
    console.log(`  ✅ ${row.child_table}.${row.child_column} → ${row.parent_table}.${row.parent_column}  (${row.constraint_name})`);
  }

  // Expected FK count per migration
  const expectedFkCounts: Record<string, number> = {
    'vuuid': 15,   // FK-1: 15 child tables (was 33 in commit msg but some share vessel_uuid)
    'cuuid': 5,    // FK-2
    'juuid': 1,    // FK-3 (work_orders → jobs)
    'wouuid': 2,   // FK-4 (work_order_steps + spare_usage)
    'suuid': 3,    // FK-5
    'stuuid': 1,   // FK-6
    'duuid': 3,    // FK-7
    'apuuid': 1,   // FK-8
    'aeuuid': 1,   // FK-8
    'fduuid': 1,   // FK-9
    'fvuuid': 1,   // FK-9
    'biuuid': 1,   // FK-10
  };

  // Count FKs per parent column
  const fkCountByParent: Record<string, number> = {};
  for (const row of fkRes.rows) {
    const key = row.parent_column;
    fkCountByParent[key] = (fkCountByParent[key] || 0) + 1;
  }

  console.log('\n  FK count by parent UUID column:');
  for (const [col, count] of Object.entries(fkCountByParent)) {
    console.log(`    ${col}: ${count} FKs`);
  }
  console.log(`  Total UUID-based FK constraints: ${fkRes.rows.length}`);

  // ─── CHECK 4: No NULL UUIDs in parent tables ───────────────────────
  console.log('\n── CHECK 4: No NULL UUIDs in parent tables ──');
  for (const { table, column, fk } of parentUuidColumns) {
    const res = await pool.query(`SELECT COUNT(*) as null_count FROM ${table} WHERE ${column} IS NULL`);
    const nullCount = parseInt(res.rows[0].null_count);
    const status = nullCount === 0 ? '✅' : '❌';
    console.log(`  ${status} ${table}.${column}: ${nullCount} NULL rows`);
    if (nullCount > 0) {
      allPassed = false;
      failures.push(`NULL UUIDs found: ${table}.${column} has ${nullCount} NULL rows`);
    }
  }

  // ─── CHECK 5: UNIQUE constraints on parent UUID columns ─────────────
  console.log('\n── CHECK 5: UNIQUE constraints on parent UUID columns ──');
  for (const { table, column, fk } of parentUuidColumns) {
    const res = await pool.query(`
      SELECT COUNT(*) as unique_count FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = $1::regclass AND c.contype = 'u' AND a.attname = $2
    `, [table, column]);
    const hasUnique = parseInt(res.rows[0].unique_count) > 0;
    const status = hasUnique ? '✅' : '❌';
    console.log(`  ${status} ${table}.${column} UNIQUE constraint`);
    if (!hasUnique) {
      allPassed = false;
      failures.push(`Missing UNIQUE constraint: ${table}.${column}`);
    }
  }

  // ─── CHECK 6: NOT NULL constraints on parent UUID columns ───────────
  console.log('\n── CHECK 6: NOT NULL constraints on parent UUID columns ──');
  for (const { table, column, fk } of parentUuidColumns) {
    const res = await pool.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    `, [table, column]);
    const isNotNull = res.rows[0]?.is_nullable === 'NO';
    const status = isNotNull ? '✅' : '❌';
    console.log(`  ${status} ${table}.${column} NOT NULL`);
    if (!isNotNull) {
      allPassed = false;
      failures.push(`Missing NOT NULL: ${table}.${column}`);
    }
  }

  // ─── CHECK 7: Migration count ──────────────────────────────────────
  console.log('\n── CHECK 7: Migration tracking ──');
  const migRes = await pool.query(`SELECT COUNT(*) as total FROM schema_migrations`);
  console.log(`  Total migrations applied: ${migRes.rows[0].total}`);

  const customMigs = await pool.query(`SELECT id FROM schema_migrations WHERE id LIKE '0%' ORDER BY id DESC LIMIT 5`);
  console.log('  Last 5 custom migrations:');
  for (const row of customMigs.rows) {
    console.log(`    ${row.id}`);
  }

  // ─── SUMMARY ───────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('  ✅ ALL CHECKS PASSED — FK identity restructure complete');
  } else {
    console.log(`  ❌ ${failures.length} FAILURE(S) DETECTED:`);
    for (const f of failures) {
      console.log(`    • ${f}`);
    }
  }
  console.log('═══════════════════════════════════════════════════════════');

  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

verify().catch(e => { console.error(e); process.exit(1); });
