/**
 * Compares current database state against baseline snapshot.
 * Run after EACH module extraction to confirm zero data loss.
 *
 * Usage: npx tsx scripts/verify-data-integrity.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';

async function verify() {
  const baselineFile = 'docs/data-snapshot-BASELINE.json';

  if (!fs.existsSync(baselineFile)) {
    console.error('Baseline file not found. Run data-baseline-snapshot.ts first.');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const baseline: Record<string, number> = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));
  const pool = new Pool({ connectionString });

  try {
    const tablesResult = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    let allGood = true;
    console.log(`\nData Integrity Verification`);
    console.log('='.repeat(60));

    for (const row of tablesResult.rows) {
      const tableName = row.tablename as string;
      const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const currentCount = parseInt(result.rows[0].count as string);
      const baselineCount = baseline[tableName] || 0;

      if (currentCount < baselineCount) {
        console.log(`  FAIL ${tableName}: ${baselineCount} -> ${currentCount} (LOST ${baselineCount - currentCount} rows!)`);
        allGood = false;
      }
    }

    // Check for missing tables
    for (const tableName of Object.keys(baseline)) {
      const exists = tablesResult.rows.some((r: any) => r.tablename === tableName);
      if (!exists) {
        console.log(`  FAIL ${tableName}: TABLE MISSING! Was ${baseline[tableName]} rows`);
        allGood = false;
      }
    }

    console.log('='.repeat(60));
    if (allGood) {
      console.log('  ALL DATA INTACT - zero data loss detected');
    } else {
      console.log('  DATA INTEGRITY ISSUES DETECTED - STOP and investigate!');
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
