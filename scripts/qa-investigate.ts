import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Query 1: UUID columns per table
  console.log('=== QUERY 1: UUID columns per table ===');
  const q1 = await pool.query(`
    SELECT t.table_name,
       STRING_AGG(c.column_name, ', ') FILTER (WHERE c.column_name LIKE '%uuid%' OR c.column_name LIKE '%uui%') as uuid_columns
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND (c.column_name LIKE '%uuid%' OR c.column_name LIKE '%uui%')
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
    ORDER BY t.table_name;
  `);
  const withUuid: string[] = [];
  const withoutUuid: string[] = [];
  for (const row of q1.rows) {
    if (row.uuid_columns) {
      withUuid.push(`  ${row.table_name}: ${row.uuid_columns}`);
    } else {
      withoutUuid.push(`  ${row.table_name}`);
    }
  }
  console.log('Tables WITH uuid columns:');
  withUuid.forEach(r => console.log(r));
  console.log(`\nTables WITHOUT uuid columns (${withoutUuid.length}):`);
  withoutUuid.forEach(r => console.log(r));

  // Query 2: Primary ID column types
  console.log('\n=== QUERY 2: Primary ID column types ===');
  const q2 = await pool.query(`
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE column_name = 'id' AND table_schema = 'public'
    ORDER BY table_name;
  `);
  const autoInc: string[] = [];
  const nonAutoInc: string[] = [];
  for (const row of q2.rows) {
    const info = `  ${row.table_name}: type=${row.data_type}, default=${row.column_default || 'none'}`;
    if (row.column_default && (row.column_default.includes('nextval') || row.column_default.includes('serial'))) {
      autoInc.push(info);
    } else {
      nonAutoInc.push(info);
    }
  }
  console.log(`Auto-increment IDs (${autoInc.length}):`);
  autoInc.forEach(r => console.log(r));
  console.log(`\nNon-auto-increment IDs (${nonAutoInc.length}):`);
  nonAutoInc.forEach(r => console.log(r));

  // Query 3: All FK constraints with details
  console.log('\n=== QUERY 3: FK constraints ===');
  const q3 = await pool.query(`
    SELECT
      tc.table_name as child_table,
      kcu.column_name as child_column,
      ccu.table_name AS parent_table,
      ccu.column_name AS parent_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `);
  console.log(`Total FK constraints: ${q3.rows.length}`);
  for (const row of q3.rows) {
    console.log(`  ${row.child_table}.${row.child_column} -> ${row.parent_table}.${row.parent_column}`);
  }

  // Query 4: Non-empty tables with row counts
  console.log('\n=== QUERY 4: Non-empty table row counts ===');
  const q4 = await pool.query(`
    SELECT schemaname, relname, n_live_tup
    FROM pg_stat_user_tables
    WHERE n_live_tup > 0
    ORDER BY n_live_tup DESC;
  `);
  for (const row of q4.rows) {
    console.log(`  ${row.relname}: ${row.n_live_tup} rows`);
  }

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
