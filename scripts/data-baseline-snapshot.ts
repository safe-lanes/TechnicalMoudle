/**
 * Records row counts for every table in the database.
 * Run BEFORE refactoring and AFTER each module extraction to verify zero data loss.
 *
 * Usage: npx tsx scripts/data-baseline-snapshot.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';

async function takeSnapshot() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    const tablesResult = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const snapshot: Record<string, number> = {};

    for (const row of tablesResult.rows) {
      const tableName = row.tablename as string;
      const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      snapshot[tableName] = parseInt(result.rows[0].count as string);
    }

    if (!fs.existsSync('docs')) fs.mkdirSync('docs', { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `docs/data-snapshot-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2));

    // Also save as BASELINE for easy reference
    fs.writeFileSync('docs/data-snapshot-BASELINE.json', JSON.stringify(snapshot, null, 2));

    console.log(`\nData Baseline Snapshot - ${new Date().toISOString()}`);
    console.log('='.repeat(50));

    let totalRows = 0;
    for (const [table, count] of Object.entries(snapshot).sort()) {
      if (count > 0) {
        console.log(`  ${table}: ${count.toLocaleString()} rows`);
        totalRows += count;
      }
    }
    console.log('='.repeat(50));
    console.log(`  TOTAL: ${totalRows.toLocaleString()} rows across ${Object.keys(snapshot).length} tables`);
    console.log(`\n  Saved to: ${filename}`);
    console.log(`  Baseline: docs/data-snapshot-BASELINE.json`);

    return snapshot;
  } finally {
    await pool.end();
  }
}

takeSnapshot().catch((err) => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});
