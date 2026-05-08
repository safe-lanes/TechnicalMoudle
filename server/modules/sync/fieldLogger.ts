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

import { getDb } from '../../db';
import { syncFieldLog } from '../../../shared/schema';
import { requiresFieldLogging } from '../../../shared/syncConfig';
import { syncDiag } from './syncDiagLogger';

// Fields to NEVER log — these are meta fields managed by the system, not user data.
// NOTE: 'id' was previously skipped here (assumed to be an integer auto-PK).
// Many BOTH_EDITABLE tables have text PK 'id' (defects, work_orders, work_order_executions,
// work_order_documents, work_order_postponements, etc.) — those values are essential for
// INSERT replication via applyFieldLogInserts(). For tables with GENERATED ALWAYS integer id,
// the column is already filtered out by getColumnMeta().identityAlwaysCols in oneWayApplier.
const SKIP_FIELDS = new Set([
  'updated_at', 'updatedAt',
  'created_at', 'createdAt',
  'is_sync', 'isSync',
]);

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

  if (oldRow === null && newRow !== null) {
    // === INSERT — log all non-skip fields with old=null ===
    const entries = Object.entries(newRow)
      .filter(([key, value]) => !SKIP_FIELDS.has(key) && value !== null && value !== undefined);

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
          changedByUserId: userId,
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
      if (SKIP_FIELDS.has(key)) continue;

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
          changedByUserId: userId,
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
    syncDiag(`FIELD-LOGGER: ${tableName} row=${rowUuid} — ${logCount} fields changed, isInsert=${oldRow === null}`);
    console.log(`[FieldLogger] Logged ${logCount} field change(s) for ${tableName}.${rowUuid}`);
  }

  return logCount;
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
