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
import { syncFieldLog, syncFieldLogFailures } from '../../../shared/schema';
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

// ── Sync instance identity (stamped on every field log) ──
//
// PRECEDENCE:
//   1. DB `sync_settings.instance_id` — the SAME primary source the sync
//      engine uses (syncRole.getEffectiveInstanceId). Identity is data-driven:
//      provisioning a new ship is a single DB row, not a per-machine env step.
//   2. env SYNC_INSTANCE_ID — fallback only.
//   3. Neither set → THROW. We NEVER stamp logs with 'UNKNOWN' or any
//      placeholder: the gather query filters `WHERE instance_id = <engine id>`,
//      so placeholder-stamped rows are invisible and silently never sync.
//
// Resolved ONCE and cached — the logger runs on every write, so no per-log DB
// query. server/index.ts calls initFieldLoggerInstanceId() at startup (before
// any scheduler or request can write); the lazy fallback below covers scripts.
let cachedInstanceId: string | null = null;

export async function initFieldLoggerInstanceId(): Promise<string> {
  if (cachedInstanceId) return cachedInstanceId;

  let dbId: string | null = null;
  try {
    const { getSetting } = await import('./repository');
    dbId = await getSetting('instance_id');
  } catch {
    // DB not available — fall through to env
  }
  const dbIdTrimmed = (dbId || '').trim();
  const envId = (process.env.SYNC_INSTANCE_ID || '').trim();
  const resolved = dbIdTrimmed || envId;

  // Reject placeholder VALUES, not just absence: 'UNKNOWN' was the old silent
  // default and 'SHIP-VESSELNAME' is the unedited .env template literal — both
  // produce logs that either never sync or collide across ships.
  const PLACEHOLDER_INSTANCE_IDS = new Set(['UNKNOWN', 'SHIP-VESSELNAME']);
  if (!resolved || PLACEHOLDER_INSTANCE_IDS.has(resolved.toUpperCase())) {
    throw new Error(
      `Sync instance id is ${resolved ? `a placeholder ('${resolved}')` : 'NOT configured'}. ` +
      'Set sync_settings.instance_id in the DB (preferred — one row per ship/shore instance) ' +
      'or the SYNC_INSTANCE_ID env var to a real identity (e.g. SHIP-WAHKWONG-V003). ' +
      "Field logging refuses placeholders: logs stamped 'UNKNOWN' are invisible to the sync " +
      'gather and an unedited template id collides across ships.'
    );
  }

  if (dbIdTrimmed && envId && dbIdTrimmed !== envId) {
    console.warn(
      `[FieldLogger] WARNING: DB sync_settings.instance_id ('${dbIdTrimmed}') and env ` +
      `SYNC_INSTANCE_ID ('${envId}') disagree — the DB value wins (same precedence as the ` +
      `sync engine). Align them to avoid confusion.`
    );
  }

  cachedInstanceId = resolved;
  console.log(`[FieldLogger] Instance id resolved: '${resolved}' (source: ${dbIdTrimmed ? 'DB sync_settings.instance_id' : 'env SYNC_INSTANCE_ID'})`);
  return resolved;
}

/** Cached resolve — never returns a placeholder; throws if unresolvable. */
async function getInstanceId(): Promise<string> {
  return cachedInstanceId ?? initFieldLoggerInstanceId();
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
// ── Phase-0 un-swallow (SYNC-HARDENING-PLAN §9.4) ──
// A lost field log means the business row committed but the change will NEVER sync — and until
// now the only trace was a scrolled-away console.error (the 4th root cause behind the Frontier
// Venture "52"). Every standalone logging failure is now recorded LOUDLY and DURABLY:
// syncDiag FIELD-LOG-LOST line + session counter (surfaced via /sync/status) + a row in
// sync_field_log_failures (migration 142) so recovery works from a list, not from count-diffing.
// The business write is NEVER broken by a logging failure.
let fieldLogFailureSessionCount = 0;
export function getFieldLogFailureSessionCount(): number {
  return fieldLogFailureSessionCount;
}

async function recordFieldLogFailure(
  tableName: string,
  rowUuid: string,
  vesselId: string | null,
  failedFields: number,
  error: string,
): Promise<void> {
  fieldLogFailureSessionCount++;
  const msg = `FIELD-LOG-LOST: ${tableName} row=${rowUuid} vessel=${vesselId ?? 'null'} failedFields=${failedFields} — ${error}`;
  // The syncDiag file line is itself a durable trace (last resort if the insert below fails).
  syncDiag(`⚠️ ${msg} (business row COMMITTED; sync log NOT written — recover via sync_field_log_failures)`);
  console.error(`[FieldLogger] ⚠️ ${msg}`);
  try {
    const db = await getDb();
    await db.insert(syncFieldLogFailures).values({
      tableName,
      rowUuid,
      vesselId: vesselId ?? null,
      failedFields,
      error: String(error).slice(0, 2000),
    });
  } catch (persistErr: any) {
    console.error(`[FieldLogger] ⚠️ Could not persist field-log failure record (syncDiag line above is the trace): ${persistErr?.message}`);
  }
}

export async function logFieldChanges(
  tableName: string,
  rowUuid: string,
  vesselId: string | null,
  oldRow: Record<string, any> | null,
  newRow: Record<string, any> | null,
  userId: string | null,
  txConn?: any
): Promise<number> {
  try {
    return await logFieldChangesCore(tableName, rowUuid, vesselId, oldRow, newRow, userId, txConn);
  } catch (error: any) {
    // Tx callers rely on throw-to-rollback (write+log abort together) — preserve that contract.
    if (txConn) throw error;
    // Standalone callers: never break the business write; record the loss loudly + durably.
    await recordFieldLogFailure(tableName, rowUuid, vesselId, 0, error?.message || String(error));
    return 0;
  }
}

async function logFieldChangesCore(
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
  const instanceId = await getInstanceId();
  const changedAt = new Date();
  let logCount = 0;
  let failedFields = 0;
  let lastFieldError = '';
  const skipFields = await getEffectiveSkipFields(tableName);

  // Audit identity (Phase 0). The request-context actor is AUTHORITATIVE for the audit-identity
  // columns (changed_by_user_id / changed_by_display). Controllers inject a name/rank into the
  // caller's `userId` for their own operational use (approver, performed_by, RH attribution, …) —
  // but those operational columns are written elsewhere; here we record WHO made the request:
  //   - request present  → actorId (canonical userUuid) + actorLabel (Office name / Ship rank),
  //                         ignoring the injected `userId` param.
  //   - no request       → machine/cron/sync write: preserve the explicit token
  //                         ('auto-generation', 'system', …); the token is also its own label.
  const ctx = getRequestContext();
  let resolvedUserId: string;
  let resolvedDisplay: string;
  if (ctx?.actor) {
    resolvedUserId = ctx.actor.actorId;
    resolvedDisplay = ctx.actor.actorLabel;
  } else {
    if (!userId) {
      syncDiag(`WARNING: logFieldChanges called without userId and no request context for ${tableName}.${rowUuid} — using 'system' fallback`);
      resolvedUserId = 'system';
    } else {
      resolvedUserId = userId;
    }
    resolvedDisplay = resolvedUserId;
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
          changedByDisplay: resolvedDisplay,
          instanceId,
          isSynced: false,
        });
        logCount++;
      } catch (error: any) {
        failedFields++;
        lastFieldError = error.message;
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
          changedByDisplay: resolvedDisplay,
          instanceId,
          isSynced: false,
        });
        logCount++;
      } catch (error: any) {
        failedFields++;
        lastFieldError = error.message;
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

  // Per-field insert failures = partially lost log (§9.4). Standalone: record durably.
  // Tx callers: skip recording here — a failed statement has aborted the tx (25P02) and the
  // caller's rollback discards the row too, so nothing was lost (contract preserved).
  if (failedFields > 0 && !txConn) {
    await recordFieldLogFailure(tableName, rowUuid, vesselId, failedFields, lastFieldError);
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
  const instanceId = await getInstanceId();
  const changedAt = new Date();

  // Audit identity (Phase 0) — same precedence as logFieldChanges: the request-context actor is
  // authoritative when present; otherwise the explicit per-entry token (machine/cron) is kept.
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
    changedByDisplay: string;
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

    let resolvedUserId: string;
    let resolvedDisplay: string;
    if (ctx?.actor) {
      resolvedUserId = ctx.actor.actorId;
      resolvedDisplay = ctx.actor.actorLabel;
    } else {
      resolvedUserId = entry.userId || 'system';
      resolvedDisplay = resolvedUserId;
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
        changedByDisplay: resolvedDisplay,
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
