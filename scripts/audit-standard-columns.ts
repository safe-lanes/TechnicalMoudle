/**
 * Phase 1: Full Schema Compliance Audit
 * Checks all tables for required standard columns:
 *   sort_order, created_at, updated_at, created_by_uuid, updated_by_uuid, is_deleted, is_sync
 */
import pg from 'pg';

const DB_URL = 'postgres://postgres:admin123@localhost:5432/pms';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  column_default: string | null;
  is_nullable: string;
}

interface RequiredColumn {
  name: string;
  expectedType: string;        // udt_name match
  expectedTypeAlt?: string;    // alternative type name
  expectedDefault: string | null; // partial match for column_default
  expectedDataType?: string;   // data_type match
}

const REQUIRED_COLUMNS: RequiredColumn[] = [
  { name: 'sort_order',       expectedType: 'int4',        expectedDefault: '0',          expectedDataType: 'integer' },
  { name: 'created_at',       expectedType: 'timestamp',   expectedDefault: 'now()',       expectedDataType: 'timestamp without time zone' },
  { name: 'updated_at',       expectedType: 'timestamp',   expectedDefault: 'now()',       expectedDataType: 'timestamp without time zone' },
  { name: 'created_by_uuid',  expectedType: 'text',        expectedDefault: null },
  { name: 'updated_by_uuid',  expectedType: 'text',        expectedDefault: null },
  { name: 'is_deleted',       expectedType: 'bool',        expectedDefault: 'false',      expectedDataType: 'boolean' },
  { name: 'is_sync',          expectedType: 'bool',        expectedDefault: 'false',      expectedDataType: 'boolean' },
];

type ColumnStatus = '✅' | '⚠️' | '❌';

interface TableAudit {
  tableName: string;
  columns: Record<string, { status: ColumnStatus; detail: string }>;
}

function checkDefault(actual: string | null, expected: string | null): boolean {
  if (expected === null) return true; // no default required
  if (actual === null) return false;
  const norm = actual.toLowerCase().replace(/\s+/g, '').replace(/::.*$/, '');
  return norm.includes(expected.toLowerCase());
}

function checkType(col: ColumnInfo, req: RequiredColumn): boolean {
  const udt = col.udt_name.toLowerCase();
  if (udt === req.expectedType) return true;
  if (req.expectedTypeAlt && udt === req.expectedTypeAlt.toLowerCase()) return true;
  // Also check data_type
  if (req.expectedDataType && col.data_type.toLowerCase() === req.expectedDataType.toLowerCase()) return true;
  return false;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DB_URL });
  const client = await pool.connect();

  try {
    // Get all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    // Get all columns for all tables
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, udt_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    // Group columns by table
    const colsByTable: Record<string, ColumnInfo[]> = {};
    for (const row of colsRes.rows) {
      if (!colsByTable[row.table_name]) colsByTable[row.table_name] = [];
      colsByTable[row.table_name].push(row);
    }

    // Audit each table
    const audits: TableAudit[] = [];
    for (const tableName of tables) {
      const tableCols = colsByTable[tableName] || [];
      const audit: TableAudit = { tableName, columns: {} };

      for (const req of REQUIRED_COLUMNS) {
        const col = tableCols.find(c => c.column_name === req.name);
        if (!col) {
          audit.columns[req.name] = { status: '❌', detail: 'Missing' };
        } else {
          const typeOk = checkType(col, req);
          const defaultOk = checkDefault(col.column_default, req.expectedDefault);

          if (typeOk && defaultOk) {
            audit.columns[req.name] = { status: '✅', detail: `${col.udt_name}, default: ${col.column_default || 'none'}` };
          } else {
            const issues: string[] = [];
            if (!typeOk) issues.push(`type: ${col.udt_name} (expected: ${req.expectedType})`);
            if (!defaultOk) issues.push(`default: ${col.column_default || 'none'} (expected: ${req.expectedDefault})`);
            audit.columns[req.name] = { status: '⚠️', detail: issues.join('; ') };
          }
        }
      }

      audits.push(audit);
    }

    // ═══════════════════════════════════════════
    // REPORT OUTPUT
    // ═══════════════════════════════════════════

    console.log('═'.repeat(120));
    console.log('PHASE 1: FULL SCHEMA COMPLIANCE AUDIT');
    console.log('═'.repeat(120));
    console.log(`Total tables: ${tables.length}\n`);

    // Table header
    const colNames = REQUIRED_COLUMNS.map(c => c.name);
    const colWidths = [40, 14, 14, 14, 17, 17, 14, 14];
    const header = ['Table Name', ...colNames].map((h, i) => h.padEnd(colWidths[i])).join('│');
    const separator = colWidths.map(w => '─'.repeat(w)).join('┼');

    console.log(header);
    console.log(separator);

    for (const audit of audits) {
      const row = [
        audit.tableName.padEnd(colWidths[0]),
        ...colNames.map((cn, i) => {
          const s = audit.columns[cn]?.status || '❌';
          return s.padEnd(colWidths[i + 1]);
        })
      ].join('│');
      console.log(row);
    }

    // ═══════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════

    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));

    const fullyCompliant = audits.filter(a => Object.values(a.columns).every(c => c.status === '✅'));
    const missingAtLeastOne = audits.filter(a => Object.values(a.columns).some(c => c.status === '❌'));
    const incorrectDefs = audits.filter(a => Object.values(a.columns).some(c => c.status === '⚠️'));

    console.log(`Total tables scanned:              ${audits.length}`);
    console.log(`Fully compliant tables:            ${fullyCompliant.length}`);
    console.log(`Tables missing at least one column: ${missingAtLeastOne.length}`);
    console.log(`Tables with incorrect definitions:  ${incorrectDefs.length}`);

    // Grouped issues
    console.log('\n' + '─'.repeat(80));
    console.log('GROUPED ISSUES BY COLUMN');
    console.log('─'.repeat(80));

    for (const req of REQUIRED_COLUMNS) {
      const missing = audits.filter(a => a.columns[req.name]?.status === '❌');
      const incorrect = audits.filter(a => a.columns[req.name]?.status === '⚠️');

      if (missing.length > 0 || incorrect.length > 0) {
        console.log(`\n[${req.name}]`);
        if (missing.length > 0) {
          console.log(`  ❌ Missing (${missing.length}): ${missing.map(a => a.tableName).join(', ')}`);
        }
        if (incorrect.length > 0) {
          console.log(`  ⚠️ Incorrect (${incorrect.length}):`);
          for (const a of incorrect) {
            console.log(`    - ${a.tableName}: ${a.columns[req.name].detail}`);
          }
        }
      }
    }

    // Output detailed data as JSON for Phase 2
    const outputPath = '/tmp/schema-audit-results.json';
    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(audits, null, 2));
    console.log(`\nDetailed audit data saved to: ${outputPath}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
