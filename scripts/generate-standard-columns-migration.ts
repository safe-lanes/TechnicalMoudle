/**
 * Phase 2: Generate safe ALTER TABLE migration SQL for standard columns.
 * Only adds missing columns or fixes incorrect definitions.
 * Does NOT drop tables, drop columns, modify unrelated columns, or recreate tables.
 */
import pg from 'pg';

const DB_URL = 'postgres://postgres:admin123@localhost:5432/pms';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  column_default: string | null;
}

interface RequiredColumn {
  name: string;
  expectedType: string;
  expectedDataType?: string;
  expectedDefault: string | null;
  sqlDefinition: string;
}

const REQUIRED_COLUMNS: RequiredColumn[] = [
  { name: 'sort_order',       expectedType: 'int4',   expectedDataType: 'integer',    expectedDefault: '0',      sqlDefinition: 'INTEGER DEFAULT 0' },
  { name: 'created_at',       expectedType: 'timestamp', expectedDataType: 'timestamp without time zone', expectedDefault: 'now()',  sqlDefinition: 'TIMESTAMP DEFAULT NOW()' },
  { name: 'updated_at',       expectedType: 'timestamp', expectedDataType: 'timestamp without time zone', expectedDefault: 'now()',  sqlDefinition: 'TIMESTAMP DEFAULT NOW()' },
  { name: 'created_by_uuid',  expectedType: 'text',   expectedDefault: null,           sqlDefinition: 'TEXT' },
  { name: 'updated_by_uuid',  expectedType: 'text',   expectedDefault: null,           sqlDefinition: 'TEXT' },
  { name: 'is_deleted',       expectedType: 'bool',   expectedDataType: 'boolean',     expectedDefault: 'false',  sqlDefinition: 'BOOLEAN DEFAULT FALSE' },
  { name: 'is_sync',          expectedType: 'bool',   expectedDataType: 'boolean',     expectedDefault: 'false',  sqlDefinition: 'BOOLEAN DEFAULT FALSE' },
];

function checkDefault(actual: string | null, expected: string | null): boolean {
  if (expected === null) return true;
  if (actual === null) return false;
  const norm = actual.toLowerCase().replace(/\s+/g, '').replace(/::.*$/, '');
  return norm.includes(expected.toLowerCase());
}

function checkType(col: ColumnInfo, req: RequiredColumn): boolean {
  const udt = col.udt_name.toLowerCase();
  if (udt === req.expectedType) return true;
  if (req.expectedDataType && col.data_type.toLowerCase() === req.expectedDataType.toLowerCase()) return true;
  return false;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DB_URL });
  const client = await pool.connect();

  try {
    // Get all tables
    const tablesRes = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    // Get all columns
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, udt_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    const colsByTable: Record<string, ColumnInfo[]> = {};
    for (const row of colsRes.rows) {
      if (!colsByTable[row.table_name]) colsByTable[row.table_name] = [];
      colsByTable[row.table_name].push(row);
    }

    // Generate SQL grouped by table
    const sqlStatements: string[] = [];
    let totalAlterations = 0;

    for (const tableName of tables) {
      const tableCols = colsByTable[tableName] || [];
      const tableAlterations: string[] = [];

      for (const req of REQUIRED_COLUMNS) {
        const col = tableCols.find(c => c.column_name === req.name);

        if (!col) {
          // Column missing — ADD it
          tableAlterations.push(
            `  ADD COLUMN IF NOT EXISTS ${req.name} ${req.sqlDefinition}`
          );
        } else {
          // Column exists — check type and default
          const typeOk = checkType(col, req);
          const defaultOk = checkDefault(col.column_default, req.expectedDefault);

          if (!typeOk) {
            // Type mismatch — ALTER COLUMN TYPE
            const targetType = req.sqlDefinition.split(' ')[0]; // e.g. INTEGER, TIMESTAMP, BOOLEAN, TEXT
            tableAlterations.push(
              `  ALTER COLUMN ${req.name} TYPE ${targetType} USING ${req.name}::${targetType}`
            );
          }

          if (!defaultOk && req.expectedDefault !== null) {
            // Default mismatch — SET DEFAULT
            tableAlterations.push(
              `  ALTER COLUMN ${req.name} SET DEFAULT ${req.expectedDefault === 'now()' ? 'NOW()' : req.expectedDefault}`
            );
          }
        }
      }

      if (tableAlterations.length > 0) {
        sqlStatements.push(
          `-- Table: ${tableName} (${tableAlterations.length} alterations)\nALTER TABLE "${tableName}"\n${tableAlterations.join(',\n')};\n`
        );
        totalAlterations += tableAlterations.length;
      }
    }

    // Output
    console.log('-- ═══════════════════════════════════════════════════════════');
    console.log('-- PHASE 2: Safe Migration SQL — Standard Audit Columns');
    console.log('-- Generated: ' + new Date().toISOString());
    console.log(`-- Total tables affected: ${sqlStatements.length}`);
    console.log(`-- Total alterations: ${totalAlterations}`);
    console.log('-- ═══════════════════════════════════════════════════════════');
    console.log('-- SAFETY: Only ADD COLUMN IF NOT EXISTS / ALTER COLUMN TYPE / SET DEFAULT');
    console.log('-- No DROP TABLE, DROP COLUMN, or data-destructive operations');
    console.log('-- ═══════════════════════════════════════════════════════════\n');

    for (const stmt of sqlStatements) {
      console.log(stmt);
    }

    console.log(`-- ═══════════════════════════════════════════════════════════`);
    console.log(`-- SUMMARY: ${sqlStatements.length} tables, ${totalAlterations} alterations`);
    console.log(`-- ═══════════════════════════════════════════════════════════`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
