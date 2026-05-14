/**
 * Field Change Logger for Ship-Shore Sync
 *
 * Logs individual field changes to sync_field_log table.
 * Called by service/storage layer after every INSERT, UPDATE, or soft-DELETE
 * on BOTH_EDITABLE tables.
 *
 * Usage:
 *   const oldRow = await fetchExisting(id);
 *   await updateRow(id, newData);
 *   await logFieldChanges('work_orders', oldRow.wouuid, vesselId, oldRow, newRow, userId);
 *
 * For INSERT:
 *   await insertRow(data);
 *   await logFieldChanges('work_orders', newRow.wouuid, vesselId, null, newRow, userId);
 *
 * For soft-DELETE:
 *   await logFieldChanges('work_orders', row.wouuid, vesselId, { is_deleted: false }, { is_deleted: true }, userId);
 */

import { getDb, getPool } from '../../db';
import { syncFieldLog } from '../../../shared/schema';
import { requiresFieldLogging } from '../../../shared/syncConfig';
import { syncDiag } from './syncDiagLogger';
import { getRequestContext } from '../../middleware/requestContext';
import { getColumnMeta } from './oneWayApplier';

const SKIP_FIELDS = new Set([
  'updated_at', 'updatedAt',
  'created_at', 'createdAt',
  'is_sync', 'isSync',
]);

// Cache: tableName → true if its `id` column is GENERATED ALWAYS / BY DEFAULT (serial).
// Tables with serial `id` get it added to the skip set; tables with text `id` do not.
const serialIdCache = new Map<string, boolean>();

async function hasSerialId(tableName: string): Promise<boolean> {
  if (serialIdCache.has(tableName)) return serialIdCache.get(tableName)!;
  try {
    const pool = await getPool();
    const meta = await getColumnMeta(pool, tableName);
    const result = meta.identityAlwaysCols.has('id');
    serialIdCache.set(tableName, result);
    return result;
  } catch {
    return false;
  }
}

async function getEffectiveSkipFields(tableName: string): Promise<Set<string>> {
  if (await hasSerialId(tableName)) {
    const extended = new Set(SKIP_FIELDS);
    extended.add('id');
    return extended;
  }
  return SKIP_FIELDS;
}

/**
 * JSON-aware serialization for field values.
 * Prevents String() from converting objects/arrays to "[object Object]".
 */
function serializeFieldValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' || Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

// Get instance ID from environment — each ship/shore server has a unique identity
function getInstanceId(): string {
  return process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
}

/**
 * Log field-level changes to sync_field_log
 *
 * @param tableName - Database table name (e.g., 'work_orders')
 * @param rowUuid - UUID of the row that changed (e.g., wouuid value)
 * @param vesselId - Vessel ID for vessel-scoped queries (null for global tables)
 * @param oldRow - Previous state of the row (null for INSERT)
 * @param newRow - New state of the row (null for DELETE — but we use soft-delete so this shouldn't happen)
 * @param userId - Who made the change
 * @param txConn - Optional transaction connection (if inside a db.transaction block)
 */
export async function logFieldChanges(
  tableName: string,
  rowUuid: string,
  vesselId: string | null,
  oldRow: Record<string, any> | null,
  newRow: Record<string, any> | null,
  userId: string | null,
  txConn?: any
): Promise<number> {
  // Only log for BOTH_EDITABLE tables
  if (!requiresFieldLogging(tableName)) {
    return 0;
  }

  if (!rowUuid) {
    console.warn(`[FieldLogger] Skipping log for ${tableName} — no rowUuid provided`);
    return 0;
  }

  const db = txConn || await getDb();
  const instanceId = getInstanceId();
  const changedAt = new Date();
  let logCount = 0;
  const skipFields = await getEffectiveSkipFields(tableName);

  // Resolve userId: prefer explicit parameter, fall back to AsyncLocalStorage request context.
  // This avoids modifying 65+ callers that hardcode 'system' — the middleware captures the
  // real authenticated user automatically for any call originating from an HTTP request.
  const PLACEHOLDER_USER_IDS = new Set(['system', 'admin', 'System', '']);
  let resolvedUserId = userId;
  if (!resolvedUserId || PLACEHOLDER_USER_IDS.has(resolvedUserId)) {
    const ctx = getRequestContext();
    if (ctx?.userId) {
      resolvedUserId = ctx.userId;
    } else if (!resolvedUserId) {
      syncDiag(`WARNING: logFieldChanges called without userId and no request context for ${tableName}.${rowUuid} — using 'system' fallback`);
      resolvedUserId = 'system';
    }
    // If resolvedUserId is still a placeholder (e.g. 'system') but no request context found,
    // keep the original value — this happens for cron jobs, sync engine, startup tasks.
  }

  if (oldRow === null && newRow !== null) {
    // === INSERT — log all non-skip fields with old=null ===
    const entries = Object.entries(newRow)
      .filter(([key, value]) => !skipFields.has(key) && value !== null && value !== undefined);

    for (const [fieldName, newValue] of entries) {
      try {
        await db.insert(syncFieldLog).values({
          tableName,
          rowUuid,
          fieldName,
          oldValue: null,
          newValue: serializeFieldValue(newValue),
          vesselId,
          changedAt,
          changedByUserId: resolvedUserId,
          instanceId,
          isSynced: false,
        });
        logCount++;
      } catch (error: any) {
        console.error(`[FieldLogger] Error logging INSERT field ${tableName}.${fieldName}:`, error.message);
      }
    }
  } else if (oldRow !== null && newRow !== null) {
    // === UPDATE — log only changed fields ===
    const allKeys = Array.from(new Set([...Object.keys(oldRow), ...Object.keys(newRow)]));

    for (const key of allKeys) {
      if (skipFields.has(key)) continue;

      const oldVal = oldRow[key];
      const newVal = newRow[key];

      // Compare as strings to handle type differences (number vs string, date vs string, etc.)
      const oldStr = serializeFieldValue(oldVal);
      const newStr = serializeFieldValue(newVal);

      if (oldStr === newStr) continue; // No change — skip

      try {
        await db.insert(syncFieldLog).values({
          tableName,
          rowUuid,
          fieldName: key,
          oldValue: oldStr,
          newValue: newStr,
          vesselId,
          changedAt,
          changedByUserId: resolvedUserId,
          instanceId,
          isSynced: false,
        });
        logCount++;
      } catch (error: any) {
        console.error(`[FieldLogger] Error logging UPDATE field ${tableName}.${key}:`, error.message);
      }
    }
  } else if (oldRow !== null && newRow === null) {
    // === HARD DELETE — should not happen (we use soft-delete) ===
    console.warn(`[FieldLogger] Hard delete detected on ${tableName}.${rowUuid} — not logging`);
  }

  if (logCount > 0) {
    syncDiag(`FIELD-LOGGER: ${tableName} row=${rowUuid} — ${logCount} fields changed, isInsert=${oldRow === null}, vesselId=${vesselId}, instanceId=${instanceId}`);
    console.log(`[FieldLogger] Logged ${logCount} field change(s) for ${tableName}.${rowUuid}`);
  }

  return logCount;
}

/**
 * Batch-aware field change logger for high-volume operations (e.g., bulk imports).
 *
 * Behavioral parity: a call to logFieldChangesBatch([{table, uuid, vessel, oldRow, newRow, userId}])
 * inserts IDENTICAL rows to sequential calls of logFieldChanges(table, uuid, vessel, oldRow, newRow, userId).
 * Same instance_id, same skip-fields filtering (including serial `id` detection), same serializeFieldValue,
 * same requiresFieldLogging guard, same AsyncLocalStorage user-context resolution. The only difference is
 * performance: one multi-row INSERT per chunk instead of N sequential INSERTs.
 *
 * Designed for UPDATE comparisons (both oldRow and newRow present). For INSERT logging
 * (oldRow=null), use the sequential logFieldChanges function directly.
 *
 * If the accumulated change rows exceed 1,000, chunks into INSERTs of 1,000 to stay within
 * Postgres parameter limits (~65,535 params; 9 columns per row → ~7,200 rows max safe).
 */
export async function logFieldChangesBatch(
  entries: Array<{
    tableName: string;
    rowUuid: string;
    vesselId: string | null;
    oldRow: Record<string, any>;
    newRow: Record<string, any>;
    userId: string;
  }>,
  txOrDb?: any
): Promise<number> {
  if (entries.length === 0) return 0;

  const db = txOrDb || await getDb();
  const instanceId = getInstanceId();
  const changedAt = new Date();

  // Resolve userId context once — same logic as logFieldChanges
  const PLACEHOLDER_USER_IDS_BATCH = new Set(['system', 'admin', 'System', '']);
  const ctx = getRequestContext();

  // Accumulate all insert rows
  const allRows: Array<{
    tableName: string;
    rowUuid: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    vesselId: string | null;
    changedAt: Date;
    changedByUserId: string;
    instanceId: string;
    isSynced: boolean;
  }> = [];

  // Pre-resolve per-table skip fields (batch may span multiple tables)
  const skipFieldsByTable = new Map<string, Set<string>>();

  for (const entry of entries) {
    // Guard: only BOTH_EDITABLE tables
    if (!requiresFieldLogging(entry.tableName)) continue;
    if (!entry.rowUuid) continue;

    if (!skipFieldsByTable.has(entry.tableName)) {
      skipFieldsByTable.set(entry.tableName, await getEffectiveSkipFields(entry.tableName));
    }
    const skipFields = skipFieldsByTable.get(entry.tableName)!;

    // Resolve userId per entry — same fallback as logFieldChanges
    let resolvedUserId = entry.userId;
    if (!resolvedUserId || PLACEHOLDER_USER_IDS_BATCH.has(resolvedUserId)) {
      if (ctx?.userId) {
        resolvedUserId = ctx.userId;
      } else if (!resolvedUserId) {
        resolvedUserId = 'system';
      }
    }

    // Compute changed fields (UPDATE mode — both oldRow and newRow present)
    const allKeys = Array.from(new Set([...Object.keys(entry.oldRow), ...Object.keys(entry.newRow)]));

    for (const key of allKeys) {
      if (skipFields.has(key)) continue;

      const oldStr = serializeFieldValue(entry.oldRow[key]);
      const newStr = serializeFieldValue(entry.newRow[key]);

      if (oldStr === newStr) continue; // No change — skip

      allRows.push({
        tableName: entry.tableName,
        rowUuid: entry.rowUuid,
        fieldName: key,
        oldValue: oldStr,
        newValue: newStr,
        vesselId: entry.vesselId,
        changedAt,
        changedByUserId: resolvedUserId,
        instanceId,
        isSynced: false,
      });
    }
  }

  if (allRows.length === 0) return 0;

  // Chunk into batches of 1,000 to stay within Postgres parameter limits
  const CHUNK_SIZE = 1000;
  let totalInserted = 0;

  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE);
    try {
      await db.insert(syncFieldLog).values(chunk);
      totalInserted += chunk.length;
    } catch (error: any) {
      console.error(`[FieldLogger] Batch insert error (chunk ${Math.floor(i / CHUNK_SIZE) + 1}):`, error.message);
      // Best-effort — don't throw, don't rollback
    }
  }

  if (totalInserted > 0) {
    syncDiag(`FIELD-LOGGER-BATCH: ${totalInserted} field logs from ${entries.length} entries`);
    console.log(`[FieldLogger] Batch logged ${totalInserted} field change(s) from ${entries.length} entries`);
  }

  return totalInserted;
}

/**
 * Convenience function for logging soft-delete
 */
export async function logSoftDelete(
  tableName: string,
  rowUuid: string,
  vesselId: string | null,
  userId: string | null,
  txConn?: any
): Promise<void> {
  await logFieldChanges(
    tableName,
    rowUuid,
    vesselId,
    { is_deleted: false },
    { is_deleted: true },
    userId,
    txConn
  );
}
