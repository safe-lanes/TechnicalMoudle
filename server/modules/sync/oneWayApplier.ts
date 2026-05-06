/**
 * One-Way Sync Applier — Upserts rows by UUID for one-way sync tables.
 *
 * Used for:
 * - SHIP_ONLY tables: ship pushes -> shore overwrites
 * - ONE_WAY_SHORE_TO_SHIP tables: shore pushes -> ship overwrites
 *
 * Uses raw SQL for dynamic table names since Drizzle ORM requires static table refs.
 */

import { getPool } from '../../db';
import { getTableSyncConfig, getIdentityColumn } from '../../../shared/syncConfig';

interface ApplyResult {
  inserted: number;
  updated: number;
  softDeleted: number;
  errors: Array<{ rowIndex: number; error: string }>;
}

// ── Column metadata cache (schema-aware id/JSON handling) ──

export interface ColumnMeta {
  identityAlwaysCols: Set<string>;
  jsonCols: Set<string>;
}

const columnMetaCache = new Map<string, ColumnMeta>();

/**
 * Get column metadata for a table — caches GENERATED ALWAYS and JSON/JSONB info.
 * Exported for reuse in syncEngine.ts (applyFieldLog JSON coercion).
 */
export async function getColumnMeta(pool: any, tableName: string): Promise<ColumnMeta> {
  if (columnMetaCache.has(tableName)) return columnMetaCache.get(tableName)!;

  let identityAlwaysCols = new Set<string>();
  let jsonCols = new Set<string>();

  try {
    // Find GENERATED ALWAYS AS IDENTITY columns (e.g. adm_role_menu_access.id)
    const identityResult = await pool.query(
      `SELECT a.attname FROM pg_attribute a
       JOIN pg_class c ON a.attrelid = c.oid
       JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname = $1 AND a.attidentity = 'a'`,
      [tableName]
    );
    identityAlwaysCols = new Set((identityResult.rows || []).map((r: any) => r.attname));
  } catch { /* ignore — table may not exist yet */ }

  try {
    // Find json/jsonb columns (for value coercion)
    const jsonResult = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       AND data_type IN ('json', 'jsonb')`,
      [tableName]
    );
    jsonCols = new Set((jsonResult.rows || []).map((r: any) => r.column_name));
  } catch { /* ignore */ }

  const meta = { identityAlwaysCols, jsonCols };
  columnMetaCache.set(tableName, meta);
  return meta;
}

/**
 * Apply one-way rows — upsert by identity column (UUID).
 *
 * @param tableName - Target table name
 * @param rows - Array of row objects to upsert
 * @returns Counts of inserts, updates, soft-deletes, and any per-row errors
 */
export async function applyOneWayRows(
  tableName: string,
  rows: any[]
): Promise<ApplyResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0, softDeleted: 0, errors: [] };

  const config = getTableSyncConfig(tableName);
  if (!config) {
    return {
      inserted: 0, updated: 0, softDeleted: 0,
      errors: [{ rowIndex: -1, error: `Unknown table: ${tableName}` }],
    };
  }

  const identityCol = config.identityColumn;
  // Tables without a UUID identity column use the text PK 'id'
  const lookupColumn = identityCol || 'id';

  const pool = await getPool();

  // Schema-aware column metadata (GENERATED ALWAYS + JSON detection)
  const meta = await getColumnMeta(pool, tableName);

  const result: ApplyResult = { inserted: 0, updated: 0, softDeleted: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const lookupValue = row[lookupColumn] || row[toCamelCase(lookupColumn)];
      if (!lookupValue) {
        result.errors.push({ rowIndex: i, error: `Missing identity column "${lookupColumn}"` });
        continue;
      }

      // Check if this is a soft-delete marker
      const isDeleted = row.is_deleted === true || row.isDeleted === true;

      // Check if row exists
      const existCheck = await pool.query(
        `SELECT 1 FROM "${tableName}" WHERE "${lookupColumn}" = $1 LIMIT 1`,
        [lookupValue]
      );

      if (existCheck.rows.length > 0) {
        if (isDeleted) {
          // Soft-delete: set is_deleted = true
          await pool.query(
            `UPDATE "${tableName}" SET is_deleted = true, updated_at = NOW() WHERE "${lookupColumn}" = $1`,
            [lookupValue]
          );
          result.softDeleted++;
        } else {
          // Update all columns (excluding PK and generated columns)
          const updatePairs = buildUpdatePairs(row, lookupColumn, meta);
          if (updatePairs.setClauses.length > 0) {
            const updateSQL = `UPDATE "${tableName}" SET ${updatePairs.setClauses.join(', ')}, updated_at = NOW() WHERE "${lookupColumn}" = $${updatePairs.values.length + 1}`;
            await pool.query(updateSQL, [...updatePairs.values, lookupValue]);
          }
          result.updated++;
        }
      } else {
        if (isDeleted) {
          // Row doesn't exist and is deleted — skip
          result.softDeleted++;
          continue;
        }
        // Insert new row
        const insertParts = buildInsertParts(row, meta);
        if (insertParts.columns.length > 0) {
          const insertSQL = `INSERT INTO "${tableName}" (${insertParts.columns.join(', ')}) VALUES (${insertParts.placeholders.join(', ')}) ON CONFLICT DO NOTHING`;
          await pool.query(insertSQL, insertParts.values);
          result.inserted++;
        }
      }
    } catch (err: any) {
      result.errors.push({ rowIndex: i, error: err.message });
    }
  }

  // Advance sequences for GENERATED ALWAYS identity columns so future
  // INSERTs (via UI or next sync) don't collide with imported integer PKs.
  if (meta.identityAlwaysCols.size > 0) {
    for (const col of Array.from(meta.identityAlwaysCols)) {
      try {
        await pool.query(
          `SELECT setval(pg_get_serial_sequence('"${tableName}"', '${col}'), GREATEST(COALESCE((SELECT MAX("${col}") FROM "${tableName}"), 0), 1))`
        );
      } catch (e: any) {
        console.warn(`[OneWayApplier] Could not advance sequence for ${tableName}.${col}: ${e.message}`);
      }
    }
  }

  // Log detailed error messages so operators can diagnose failures
  if (result.errors.length > 0) {
    console.error(`[OneWayApplier] ${result.errors.length} errors applying ${tableName}:`);
    result.errors.slice(0, 5).forEach((e) =>
      console.error(`  - row ${e.rowIndex}: ${e.error}`)
    );
    if (result.errors.length > 5) {
      console.error(`  ... and ${result.errors.length - 5} more`);
    }
  }

  return result;
}

// ── Helpers ──

/** Convert snake_case to camelCase */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Convert camelCase to snake_case */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// Columns that should not be included in UPDATE (PK + auto-generated timestamps)
const SKIP_UPDATE_COLUMNS = new Set(['id', 'created_at', 'createdAt']);

/** Coerce a value for the correct PostgreSQL column type */
function coerceValue(value: any, snakeKey: string, meta: ColumnMeta): any {
  if (value === null || value === undefined) return null;
  if (meta.jsonCols.has(snakeKey)) {
    // JSON/JSONB column: ensure value is a valid JSON string for PostgreSQL
    if (typeof value === 'string') {
      try { JSON.parse(value); return value; } catch { return JSON.stringify(value); }
    }
    if (typeof value === 'object' && !(value instanceof Date)) {
      return JSON.stringify(value);
    }
    return JSON.stringify(value);
  }
  // Non-JSON: stringify plain objects for TEXT/VARCHAR columns
  if (typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

/** Build SET clauses for UPDATE */
function buildUpdatePairs(
  row: any,
  identityCol: string,
  meta: ColumnMeta
): { setClauses: string[]; values: any[] } {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(row)) {
    const snakeKey = toSnakeCase(key);
    // Skip PK, identity, generated-always, and auto-generated columns
    if (SKIP_UPDATE_COLUMNS.has(key) || SKIP_UPDATE_COLUMNS.has(snakeKey)) continue;
    if (meta.identityAlwaysCols.has(key) || meta.identityAlwaysCols.has(snakeKey)) continue;
    if (key === identityCol || snakeKey === identityCol) continue;
    if (key === 'updated_at' || key === 'updatedAt') continue; // We set this ourselves

    setClauses.push(`"${snakeKey}" = $${paramIndex}`);
    values.push(coerceValue(value, snakeKey, meta));
    paramIndex++;
  }

  return { setClauses, values };
}

/** Build columns/placeholders/values for INSERT */
function buildInsertParts(
  row: any,
  meta: ColumnMeta
): { columns: string[]; placeholders: string[]; values: any[] } {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(row)) {
    const snakeKey = toSnakeCase(key);
    // Skip only GENERATED ALWAYS columns (e.g. adm_role_menu_access.id)
    // — do NOT skip regular integer PKs (admn_role_master.id, adm_menumaster_ac.id)
    if (meta.identityAlwaysCols.has(key) || meta.identityAlwaysCols.has(snakeKey)) continue;

    columns.push(`"${snakeKey}"`);
    placeholders.push(`$${paramIndex}`);
    values.push(coerceValue(value, snakeKey, meta));
    paramIndex++;
  }

  return { columns, placeholders, values };
}

// ════════════════════════════════════════════════════════════════════════════════
// FIELD LOG INSERT APPLIER — Handles INSERT for new BOTH_EDITABLE rows via field logs
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Field log entry structure (as received from push/pull).
 */
export interface FieldLogEntry {
  tableName: string;
  rowUuid: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  vesselId?: string | null;
  changedAt?: string | Date;
  changedByUserId?: string | null;
  instanceId?: string;
}

/**
 * Apply a batch of field logs, handling both INSERT (new rows) and UPDATE (existing fields).
 *
 * Logic:
 * - Group field logs by (tableName, rowUuid)
 * - If ALL logs in a group have oldValue === null → it's an INSERT
 *   - Check if row already exists (idempotency)
 *   - If not: build INSERT INTO ... ON CONFLICT DO NOTHING
 * - Otherwise → individual UPDATE per field (existing behavior, delegated to caller)
 *
 * Returns:
 * - insertedRows: count of new rows inserted
 * - updateLogs: field logs that need UPDATE (not part of an INSERT group)
 * - errors: any errors during INSERT
 */
export async function applyFieldLogInserts(
  fieldLogs: FieldLogEntry[]
): Promise<{
  insertedRows: number;
  updateLogs: FieldLogEntry[];
  errors: string[];
}> {
  if (fieldLogs.length === 0) {
    return { insertedRows: 0, updateLogs: [], errors: [] };
  }

  const pool = await getPool();
  let insertedRows = 0;
  const updateLogs: FieldLogEntry[] = [];
  const errors: string[] = [];

  // 1. Group by (tableName, rowUuid)
  const groups = new Map<string, FieldLogEntry[]>();
  for (const log of fieldLogs) {
    const key = `${log.tableName}::${log.rowUuid}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }

  // 2. Classify each group as INSERT or UPDATE
  const groupKeys = Array.from(groups.keys());
  for (const groupKey of groupKeys) {
    const logs = groups.get(groupKey)!;
    const isInsertGroup = logs.every((l: FieldLogEntry) => l.oldValue === null);

    if (!isInsertGroup) {
      // Standard UPDATE — pass back to caller for per-field application
      updateLogs.push(...logs);
      continue;
    }

    // INSERT group — all oldValues are null → new row
    const tableName = logs[0].tableName;
    const rowUuid = logs[0].rowUuid;

    const config = getTableSyncConfig(tableName);
    if (!config) {
      errors.push(`${tableName}: unknown table`);
      updateLogs.push(...logs); // fallback to UPDATE attempt
      continue;
    }

    const identityCol = config.identityColumn || 'id';

    try {
      // Idempotency check — does row already exist?
      const existCheck = await pool.query(
        `SELECT 1 FROM "${tableName}" WHERE "${identityCol}" = $1 LIMIT 1`,
        [rowUuid]
      );

      if (existCheck.rows.length > 0) {
        // Row exists — treat as UPDATE (maybe a re-sync or partial previous apply)
        updateLogs.push(...logs);
        continue;
      }

      // Build the row object from field logs
      const meta = await getColumnMeta(pool, tableName);
      const rowData: Record<string, any> = {};

      // Set identity column
      rowData[identityCol] = rowUuid;

      // Set vessel_id if available from logs and config requires it
      if (config.vesselScopeColumn && logs[0].vesselId) {
        rowData[config.vesselScopeColumn] = logs[0].vesselId;
      }

      // Set all logged fields
      for (const log of logs) {
        const snakeField = toSnakeCase(log.fieldName);

        // Skip GENERATED ALWAYS columns
        if (meta.identityAlwaysCols.has(snakeField)) continue;

        // JSON coercion
        let value: any = log.newValue;
        if (value !== null && meta.jsonCols.has(snakeField)) {
          try {
            JSON.parse(value);
            // Valid JSON string — use as-is
          } catch {
            value = '[]'; // Corrupted → reset
          }
        }

        rowData[snakeField] = value;
      }

      // Add timestamps
      if (!rowData['created_at']) rowData['created_at'] = new Date();
      if (!rowData['updated_at']) rowData['updated_at'] = new Date();

      // Build INSERT statement
      const columns: string[] = [];
      const placeholders: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      for (const [col, val] of Object.entries(rowData)) {
        // Skip GENERATED ALWAYS columns
        if (meta.identityAlwaysCols.has(col)) continue;

        columns.push(`"${col}"`);
        placeholders.push(`$${paramIdx}`);
        // Coerce value for correct pg type
        if (val !== null && meta.jsonCols.has(col)) {
          // Already handled above, pass as-is
          values.push(val);
        } else if (val instanceof Date) {
          values.push(val);
        } else {
          values.push(val);
        }
        paramIdx++;
      }

      if (columns.length === 0) {
        errors.push(`${tableName}.${rowUuid}: no columns to insert`);
        continue;
      }

      const insertSQL = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT ("${identityCol}") DO NOTHING`;

      await pool.query(insertSQL, values);
      insertedRows++;
      console.log(`[FieldLogInsert] Inserted new row ${tableName}.${rowUuid} (${columns.length} columns)`);
    } catch (err: any) {
      errors.push(`${tableName}.${rowUuid}: ${err.message}`);
      console.error(`[FieldLogInsert] Failed to insert ${tableName}.${rowUuid}:`, err.message);
      // Fallback: don't push to updateLogs because the row doesn't exist
      // — UPDATE would also fail. Just log the error.
    }
  }

  return { insertedRows, updateLogs, errors };
}
