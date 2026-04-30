/**
 * One-Way Sync Applier — Upserts rows by UUID for one-way sync tables.
 *
 * Used for:
 * - SHIP_ONLY tables: ship pushes → shore overwrites
 * - ONE_WAY_SHORE_TO_SHIP tables: shore pushes → ship overwrites
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
          const updatePairs = buildUpdatePairs(row, lookupColumn);
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
        const insertParts = buildInsertParts(row);
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

// Columns that should not be included in INSERT/UPDATE (auto-generated)
const SKIP_COLUMNS = new Set(['id', 'created_at', 'createdAt']);

/** Build SET clauses for UPDATE */
function buildUpdatePairs(row: any, identityCol: string): { setClauses: string[]; values: any[] } {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(row)) {
    const snakeKey = toSnakeCase(key);
    // Skip PK, identity, and auto-generated columns
    if (SKIP_COLUMNS.has(key) || SKIP_COLUMNS.has(snakeKey)) continue;
    if (key === identityCol || snakeKey === identityCol) continue;
    if (key === 'updated_at' || key === 'updatedAt') continue; // We set this ourselves

    setClauses.push(`"${snakeKey}" = $${paramIndex}`);
    values.push(value ?? null);
    paramIndex++;
  }

  return { setClauses, values };
}

/** Build columns/placeholders/values for INSERT */
function buildInsertParts(row: any): { columns: string[]; placeholders: string[]; values: any[] } {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(row)) {
    const snakeKey = toSnakeCase(key);
    // Skip auto-generated integer PKs but keep UUIDs
    if (key === 'id' && typeof value === 'number') continue;

    columns.push(`"${snakeKey}"`);
    placeholders.push(`$${paramIndex}`);
    values.push(value ?? null);
    paramIndex++;
  }

  return { columns, placeholders, values };
}
