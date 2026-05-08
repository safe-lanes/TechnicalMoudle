/**
 * Sync Service — Business logic for the ship-shore sync protocol.
 *
 * Protocol flow:
 * 1. initiate  — create a sync batch
 * 2. push      — ship sends its changes to shore
 * 3. pull      — ship requests shore's changes (with conflict detection)
 * 4. resolve   — resolve any field-level conflicts
 * 5. complete  — advance checkpoint, mark batch done
 * 6. status    — check current sync state
 */

import * as repo from './repository';
import { applyOneWayRows, getColumnMeta, applyFieldLogInserts } from './oneWayApplier';
import {
  getTableSyncConfig,
  getTablesByCategory,
  type SyncCategory,
} from '../../../shared/syncConfig';
import { getPool } from '../../db';
import { getTableStats } from './healthMonitor';
import { syncDiag } from './syncDiagLogger';

// ═══════════════════════════════════════════════════════════════
// HELPER — Vessel UUID ↔ vessel_code lookup
// Some tables use vessel_code instead of vessel_id for scoping.
// Sync queries pass vessel UUID (vuuid), so we need the code for those tables.
// ═══════════════════════════════════════════════════════════════

let vesselCodeCache = new Map<string, string | null>();

async function getVesselCodeForUuid(vesselId: string): Promise<string | null> {
  if (vesselCodeCache.has(vesselId)) return vesselCodeCache.get(vesselId)!;
  try {
    const pool = await getPool();
    const result = await pool.query(
      `SELECT vessel_code FROM vessels WHERE vuuid = $1 LIMIT 1`,
      [vesselId]
    );
    const code = result.rows[0]?.vessel_code || null;
    vesselCodeCache.set(vesselId, code);
    return code;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. INITIATE
// ═══════════════════════════════════════════════════════════════

export async function initiateSyncSession(
  instanceId: string,
  vesselId: string,
  lastCheckpoint: Date | null
) {
  // Auto-register instance if not yet known
  await repo.upsertInstanceMetadata({
    instanceId,
    vesselId,
    lastSyncStatus: 'in_progress',
    syncDirection: 'bidirectional',
  });

  // Create a new batch
  const batch = await repo.createBatch({
    initiatedByInstance: instanceId,
    vesselId,
    checkpointBefore: lastCheckpoint,
  });

  console.log(`[Sync] Initiated batch ${batch.batchUuid} for ${instanceId} / ${vesselId}`);

  return {
    batchUuid: batch.batchUuid,
    serverTimestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. PUSH (Ship sends its changes to Shore)
// ═══════════════════════════════════════════════════════════════

export async function receivePushData(
  batchUuid: string,
  vesselId: string,
  payload: {
    oneWayRows?: Array<{ tableName: string; rows: any[] }>;
    fieldLogs?: Array<{
      tableName: string;
      rowUuid: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      vesselId: string | null;
      changedAt: string;
      changedByUserId: string | null;
      instanceId: string;
    }>;
  }
) {
  syncDiag(`RECEIVE-PUSH START: batch=${batchUuid}, vessel=${vesselId}, fieldLogs=${payload.fieldLogs?.length || 0}, oneWayRows=${payload.oneWayRows?.length || 0}`);

  // Validate batch
  const batch = await repo.getBatch(batchUuid);
  if (!batch) {
    throw Object.assign(new Error(`Batch ${batchUuid} not found`), { statusCode: 404 });
  }
  if (batch.status !== 'in_progress') {
    throw Object.assign(
      new Error(`Batch ${batchUuid} is ${batch.status}, not in_progress`),
      { statusCode: 400 }
    );
  }

  let totalReceived = 0;
  const oneWaySummary: Array<{ tableName: string; inserted: number; updated: number; errors: number }> = [];

  // 1. Apply SHIP_ONLY one-way rows (ship is master, shore overwrites)
  if (payload.oneWayRows && payload.oneWayRows.length > 0) {
    for (const batch of payload.oneWayRows) {
      const config = getTableSyncConfig(batch.tableName);
      if (!config) {
        console.warn(`[Sync Push] Skipping unknown table: ${batch.tableName}`);
        continue;
      }
      // Only accept SHIP_ONLY tables from ship's push
      if (config.category !== 'SHIP_ONLY') {
        console.warn(`[Sync Push] Rejecting non-SHIP_ONLY table: ${batch.tableName} (${config.category})`);
        continue;
      }
      const result = await applyOneWayRows(batch.tableName, batch.rows);
      oneWaySummary.push({
        tableName: batch.tableName,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors.length,
      });
      totalReceived += result.inserted + result.updated;
    }
  }

  // 2. Store AND apply ship's field logs (BOTH_EDITABLE changes)
  let fieldLogsStored = 0;
  let fieldLogsApplied = 0;
  let fieldLogApplyErrors = 0;
  if (payload.fieldLogs && payload.fieldLogs.length > 0) {
    // Validate business rules before accepting
    const acceptedLogs: typeof payload.fieldLogs = [];
    for (const log of payload.fieldLogs) {
      const config = getTableSyncConfig(log.tableName);
      if (!config || config.category !== 'BOTH_EDITABLE') {
        continue; // Skip non-BOTH_EDITABLE entries
      }

      // Enforce business rules (e.g., defects: only shore can verify)
      if (config.businessRules && log.tableName === 'defects' && log.fieldName === 'status') {
        if (log.newValue === 'verified') {
          console.warn(`[Sync Push] Rejecting ship-side defect verification for ${log.rowUuid}`);
          continue;
        }
      }

      acceptedLogs.push(log);
    }

    if (acceptedLogs.length > 0) {
      fieldLogsStored = await repo.insertFieldLogs(
        acceptedLogs.map(log => ({
          tableName: log.tableName,
          rowUuid: log.rowUuid,
          fieldName: log.fieldName,
          oldValue: log.oldValue,
          newValue: log.newValue,
          vesselId: log.vesselId,
          changedAt: new Date(log.changedAt),
          changedByUserId: log.changedByUserId,
          instanceId: log.instanceId,
        }))
      );
      syncDiag(`RECEIVE-PUSH: ${fieldLogsStored} field logs stored in sync_field_log`);

      // 3. Apply field logs to actual data tables — ship's changes must update shore's DB.
      //    Without this step, field logs are stored for conflict detection but the actual
      //    tables (work_orders, spares, stores, etc.) never get updated.
      //    Mirrors applyFieldLog() in syncEngine.ts.

      // Phase 1: Detect INSERT groups (all oldValue=null) and insert new rows
      const insertResult = await applyFieldLogInserts(acceptedLogs);
      fieldLogsApplied += insertResult.insertedRows;
      fieldLogApplyErrors += insertResult.errors.length;
      if (insertResult.errors.length > 0) {
        insertResult.errors.forEach(e => console.error(`[Sync Push] INSERT error: ${e}`));
      }

      // Phase 2: Apply remaining UPDATE field logs (non-INSERT groups + existing rows)
      // Defence: skip stale logs where local row was updated MORE RECENTLY than the
      // incoming changedAt.  This prevents re-pushed (duplicate) field logs from
      // reverting newer shore edits.  A per-row query is unavoidable but cheap.
      //
      // IMPORTANT: Use the log's changedAt (not NOW()) for updated_at when applying.
      // Using NOW() would cause subsequent fields from the same batch to be stale-skipped
      // because applying field A would set updated_at=NOW() > changedAt for field B.
      const pool = await getPool();
      for (const log of insertResult.updateLogs) {
        const config = getTableSyncConfig(log.tableName);
        if (!config) continue;
        const identityCol = config.identityColumn || 'id';
        const fieldNameSnake = toSnakeCase(log.fieldName);

        try {
          // Stale-log guard: only apply if the incoming change is at least as new as
          // the row's current updated_at.  This prevents old re-pushed logs from
          // overwriting newer local edits (e.g., category revert scenario).
          const logChangedAt = log.changedAt instanceof Date ? log.changedAt : new Date(String(log.changedAt));
          const freshCheck = await pool.query(
            `SELECT "updated_at" FROM "${log.tableName}" WHERE "${identityCol}" = $1 LIMIT 1`,
            [log.rowUuid]
          );
          if (freshCheck.rows.length > 0) {
            const localUpdatedAt = new Date(freshCheck.rows[0].updated_at);
            if (logChangedAt < localUpdatedAt) {
              // Incoming log is older than local row — skip to prevent stale overwrite
              syncDiag(`RECEIVE-PUSH STALE SKIP: ${log.tableName}.${log.fieldName} row=${log.rowUuid} — log ${logChangedAt.toISOString()} < row ${localUpdatedAt.toISOString()}`);
              console.log(
                `[Sync Push] Skipping stale field log ${log.tableName}.${log.fieldName} for ${log.rowUuid} ` +
                `(log ${logChangedAt.toISOString()} < row ${localUpdatedAt.toISOString()})`
              );
              continue;
            }
          }

          // JSON coercion for json/jsonb columns
          const meta = await getColumnMeta(pool, log.tableName);
          let valueToApply: any = log.newValue;
          if (valueToApply !== null && meta.jsonCols.has(fieldNameSnake)) {
            try {
              JSON.parse(valueToApply);
              // Valid JSON string — pass as-is (pg accepts for json/jsonb)
            } catch {
              // Not valid JSON (corrupted like "[object Object]") — reset to empty
              valueToApply = '[]';
            }
          }

          // Use the log's changedAt for updated_at — NOT NOW() — so that subsequent
          // fields from the same batch (same changedAt) don't get stale-skipped.
          await pool.query(
            `UPDATE "${log.tableName}" SET "${fieldNameSnake}" = $1, "updated_at" = $3 WHERE "${identityCol}" = $2`,
            [valueToApply, log.rowUuid, logChangedAt]
          );
          fieldLogsApplied++;
        } catch (err: any) {
          fieldLogApplyErrors++;
          console.error(`[Sync Push] Failed to apply field log ${log.tableName}.${log.fieldName} for ${log.rowUuid}: ${err.message}`);
        }
      }
    }
    totalReceived += fieldLogsStored;
  }

  // Update batch stats
  await repo.updateBatch(batchUuid, {
    recordsReceived: (batch.recordsReceived ?? 0) + totalReceived,
  });

  syncDiag(`RECEIVE-PUSH DONE: stored=${fieldLogsStored}, applied=${fieldLogsApplied}, errors=${fieldLogApplyErrors}, oneWayTables=${oneWaySummary.length}`);
  console.log(
    `[Sync Push] Batch ${batchUuid}: ${fieldLogsStored} field logs stored, ` +
    `${fieldLogsApplied} applied, ${fieldLogApplyErrors} apply errors, ` +
    `${oneWaySummary.length} one-way tables`
  );

  return {
    received: totalReceived,
    fieldLogsStored,
    fieldLogsApplied,
    fieldLogApplyErrors,
    oneWaySummary,
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. PULL (Ship requests Shore's changes)
// ═══════════════════════════════════════════════════════════════

export async function preparePullData(
  batchUuid: string,
  vesselId: string,
  shipInstanceId: string,
  lastCheckpoint: Date | null
) {
  // Validate batch
  const batch = await repo.getBatch(batchUuid);
  if (!batch) {
    throw Object.assign(new Error(`Batch ${batchUuid} not found`), { statusCode: 404 });
  }
  if (batch.status !== 'in_progress') {
    throw Object.assign(
      new Error(`Batch ${batchUuid} is ${batch.status}, not in_progress`),
      { statusCode: 400 }
    );
  }

  // Pre-resolve vessel_code for tables that use vessel_code scope
  const vesselCode = await getVesselCodeForUuid(vesselId);
  syncDiag(`PREPARE-PULL START: vessel=${vesselId}, vesselCode=${vesselCode}, checkpoint=${lastCheckpoint ? lastCheckpoint.toISOString() : 'NONE'}`);

  // 1. Gather ONE_WAY_SHORE_TO_SHIP full-row snapshots
  const oneWayRows = await gatherOneWayShoreRows(vesselId, lastCheckpoint);

  // 2. Gather shore's BOTH_EDITABLE field logs (excluding ship's own changes)
  //    Pass vesselCode so logs stored with vessel_code (instead of UUID) are also found
  const shoreFieldLogsRaw = await repo.getFieldLogsSinceCheckpoint(
    vesselId,
    lastCheckpoint,
    shipInstanceId,
    vesselCode
  );
  const shoreFieldLogs = shoreFieldLogsRaw.map(normalizeFieldLog);
  syncDiag(`PREPARE-PULL FIELD LOGS: ${shoreFieldLogs.length} shore logs for vessel`);

  // 3. Detect conflicts — ship pushed its field logs in step 2 (PUSH),
  //    now compare: did ship AND shore both change the same field on the same row?
  const shipFieldLogsRaw = await repo.getUnsyncedFieldLogs(shipInstanceId, vesselId, vesselCode);
  const shipFieldLogs = shipFieldLogsRaw.map(normalizeFieldLog);

  // Build lookup: tableName:rowUuid:fieldName → ship's log entry
  const shipChangeMap = new Map<string, typeof shipFieldLogs[0]>();
  for (const log of shipFieldLogs) {
    const key = `${log.tableName}:${log.rowUuid}:${log.fieldName}`;
    // Keep the latest ship change per field
    const existing = shipChangeMap.get(key);
    if (!existing || (log.changedAt > existing.changedAt)) {
      shipChangeMap.set(key, log);
    }
  }

  const conflicts: Array<{
    conflictUuid: string;
    tableName: string;
    rowUuid: string;
    fieldName: string;
    shipValue: string | null;
    shoreValue: string | null;
  }> = [];

  const nonConflictingLogs = [];

  for (const shoreLog of shoreFieldLogs) {
    const key = `${shoreLog.tableName}:${shoreLog.rowUuid}:${shoreLog.fieldName}`;
    const shipLog = shipChangeMap.get(key);

    if (shipLog) {
      // CONFLICT: both sides changed the same field on the same row
      const conflict = await repo.createConflict({
        tableName: shoreLog.tableName,
        rowUuid: shoreLog.rowUuid,
        fieldName: shoreLog.fieldName,
        shipValue: shipLog.newValue,
        shipChangedAt: shipLog.changedAt,
        shipChangedBy: shipLog.changedByUserId,
        shoreValue: shoreLog.newValue,
        shoreChangedAt: shoreLog.changedAt,
        shoreChangedBy: shoreLog.changedByUserId,
        vesselId,
        syncBatchId: batchUuid,
      });
      conflicts.push({
        conflictUuid: conflict.conflictUuid,
        tableName: conflict.tableName,
        rowUuid: conflict.rowUuid,
        fieldName: conflict.fieldName,
        shipValue: conflict.shipValue,
        shoreValue: conflict.shoreValue,
      });
    } else {
      // No conflict — shore change can be applied directly on ship
      nonConflictingLogs.push({
        logUuid: shoreLog.logUuid,
        tableName: shoreLog.tableName,
        rowUuid: shoreLog.rowUuid,
        fieldName: shoreLog.fieldName,
        oldValue: shoreLog.oldValue,
        newValue: shoreLog.newValue,
        changedAt: shoreLog.changedAt,
        changedByUserId: shoreLog.changedByUserId,
        instanceId: shoreLog.instanceId,
      });
    }
  }

  // Update batch stats
  await repo.updateBatch(batchUuid, {
    recordsSent: nonConflictingLogs.length + oneWayRows.reduce((sum, t) => sum + t.rows.length, 0),
    conflictsFound: conflicts.length,
  });

  const totalOneWayRows = oneWayRows.reduce((sum, t) => sum + t.rows.length, 0);
  syncDiag(`PREPARE-PULL DONE: ${totalOneWayRows} one-way rows across ${oneWayRows.length} tables, ${nonConflictingLogs.length} field logs, ${conflicts.length} conflicts`);
  // Per-table one-way breakdown
  oneWayRows.forEach(t => syncDiag(`PREPARE-PULL ONE-WAY: ${t.tableName} — ${t.rows.length} rows`));

  console.log(
    `[Sync Pull] Batch ${batchUuid}: ${nonConflictingLogs.length} field logs, ` +
    `${oneWayRows.length} one-way tables, ${conflicts.length} conflicts`
  );

  return {
    oneWayRows,
    fieldLogs: nonConflictingLogs,
    conflicts,
  };
}

// ═══════════════════════════════════════════════════════════════
// 4. RESOLVE CONFLICT
// ═══════════════════════════════════════════════════════════════

export async function resolveConflictAction(
  conflictUuid: string,
  resolution: 'ship_wins' | 'shore_wins' | 'manual',
  resolvedValue: string | null,
  resolvedBy: string
) {
  // Get the conflict details
  const conflict = await repo.getConflict(conflictUuid);
  if (!conflict) {
    throw Object.assign(new Error(`Conflict ${conflictUuid} not found`), { statusCode: 404 });
  }
  if (conflict.resolution) {
    throw Object.assign(
      new Error(`Conflict ${conflictUuid} already resolved: ${conflict.resolution}`),
      { statusCode: 400 }
    );
  }

  // Determine the winning value
  let winningValue: string | null;
  if (resolution === 'ship_wins') {
    winningValue = conflict.shipValue;
  } else if (resolution === 'shore_wins') {
    winningValue = conflict.shoreValue;
  } else {
    // manual — use the provided resolvedValue
    winningValue = resolvedValue;
  }

  // Apply the winning value to the actual data table
  const config = getTableSyncConfig(conflict.tableName);
  if (config) {
    const identityCol = config.identityColumn || 'id';
    const fieldNameSnake = toSnakeCase(conflict.fieldName);
    try {
      const pool = await getPool();
      await pool.query(
        `UPDATE "${conflict.tableName}" SET "${fieldNameSnake}" = $1, updated_at = NOW() WHERE "${identityCol}" = $2`,
        [winningValue, conflict.rowUuid]
      );
    } catch (err: any) {
      console.error(`[Sync Resolve] Failed to apply conflict resolution to ${conflict.tableName}: ${err.message}`);
      // Don't throw — still record the resolution
    }
  }

  // Record the resolution
  const resolved = await repo.resolveConflict(conflictUuid, resolution, winningValue, resolvedBy);

  // Update batch conflict count if we have a batch reference
  if (conflict.syncBatchId) {
    const batch = await repo.getBatch(conflict.syncBatchId);
    if (batch) {
      await repo.updateBatch(conflict.syncBatchId, {
        conflictsResolved: (batch.conflictsResolved ?? 0) + 1,
      });
    }
  }

  console.log(`[Sync Resolve] Conflict ${conflictUuid}: ${resolution} → "${winningValue}"`);

  return { resolved: true, resolution, resolvedValue: winningValue };
}

// ═══════════════════════════════════════════════════════════════
// 5. COMPLETE
// ═══════════════════════════════════════════════════════════════

export async function completeSyncSession(
  batchUuid: string,
  vesselId: string,
  instanceId: string
) {
  const batch = await repo.getBatch(batchUuid);
  if (!batch) {
    throw Object.assign(new Error(`Batch ${batchUuid} not found`), { statusCode: 404 });
  }
  if (batch.status !== 'in_progress') {
    throw Object.assign(
      new Error(`Batch ${batchUuid} is ${batch.status}, not in_progress`),
      { statusCode: 400 }
    );
  }

  const now = new Date();
  const startedAt = batch.startedAt instanceof Date ? batch.startedAt : new Date(batch.startedAt);
  const durationMs = now.getTime() - startedAt.getTime();

  // Pre-resolve vessel_code for dual-scope field log queries
  const vesselCode = await getVesselCodeForUuid(vesselId);

  // 1. Mark all field logs sent in this session as synced
  //    - Shore's logs that were sent to ship
  const shoreLogsRaw = await repo.getFieldLogsSinceCheckpoint(
    vesselId,
    batch.checkpointBefore,
    instanceId, // exclude ship's own
    vesselCode
  );
  const shoreLogs = shoreLogsRaw.map(normalizeFieldLog);
  if (shoreLogs.length > 0) {
    await repo.markFieldLogsSynced(
      shoreLogs.map(l => l.logUuid),
      batchUuid
    );
  }

  //    - Ship's logs that were received by shore
  const shipLogsRaw = await repo.getUnsyncedFieldLogs(instanceId, vesselId, vesselCode);
  const shipLogs = shipLogsRaw.map(normalizeFieldLog);
  if (shipLogs.length > 0) {
    await repo.markFieldLogsSynced(
      shipLogs.map(l => l.logUuid),
      batchUuid
    );
  }

  // 2. Advance checkpoint
  await repo.upsertInstanceMetadata({
    instanceId,
    vesselId,
    lastSyncCheckpoint: now,
    lastSyncStatus: 'success',
    lastSyncAt: now,
  });

  // 3. Complete batch
  await repo.updateBatch(batchUuid, {
    status: 'completed',
    completedAt: now,
    checkpointAfter: now,
    durationMs,
  });

  console.log(`[Sync Complete] Batch ${batchUuid}: ${durationMs}ms, checkpoint advanced to ${now.toISOString()}`);

  return {
    completed: true,
    newCheckpoint: now.toISOString(),
    durationMs,
  };
}

// ═══════════════════════════════════════════════════════════════
// 6. STATUS
// ═══════════════════════════════════════════════════════════════

export async function getSyncStatus(vesselId: string, instanceId: string) {
  const metadata = await repo.getInstanceMetadata(instanceId);
  const pendingChanges = await repo.getFieldLogCount(vesselId, false);
  const unresolvedConflicts = await repo.getUnresolvedConflicts(vesselId);
  const pendingFiles = await repo.getPendingFileCount(vesselId);
  const recentBatches = await repo.getRecentBatches(vesselId, 5);

  // Fetch table stats in parallel (non-blocking — if it fails, skip gracefully)
  let tableStats: Record<string, { total: number; active: number }> = {};
  try {
    tableStats = await getTableStats();
  } catch (err) {
    console.warn('[Sync] Failed to fetch table stats for status:', err);
  }

  return {
    instance: metadata ? {
      instanceId: metadata.instanceId,
      vesselId: metadata.vesselId,
      lastSyncAt: metadata.lastSyncAt,
      lastSyncStatus: metadata.lastSyncStatus,
      lastSyncCheckpoint: metadata.lastSyncCheckpoint,
    } : null,
    pendingChanges,
    unresolvedConflicts: unresolvedConflicts.length,
    unresolvedConflictDetails: unresolvedConflicts.slice(0, 20),
    pendingFiles,
    recentBatches: recentBatches.map(b => ({
      batchUuid: b.batchUuid,
      status: b.status,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
      durationMs: b.durationMs,
      recordsSent: b.recordsSent,
      recordsReceived: b.recordsReceived,
      conflictsFound: b.conflictsFound,
      conflictsResolved: b.conflictsResolved,
    })),
    tableStats,
  };
}

// ═══════════════════════════════════════════════════════════════
// ADMIN — Recent batches & unresolved conflicts
// ═══════════════════════════════════════════════════════════════

export async function getRecentBatches(vesselId: string, limit: number = 20) {
  return repo.getRecentBatches(vesselId, limit);
}

export async function getUnresolvedConflicts(vesselId: string) {
  return repo.getUnresolvedConflicts(vesselId);
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Gather full-row snapshots from ONE_WAY_SHORE_TO_SHIP tables updated since checkpoint */
async function gatherOneWayShoreRows(
  vesselId: string,
  sinceCheckpoint: Date | null
): Promise<Array<{ tableName: string; rows: any[] }>> {
  const oneWayTables = getTablesByCategory('ONE_WAY_SHORE_TO_SHIP');
  const results: Array<{ tableName: string; rows: any[] }> = [];
  const pool = await getPool();

  // Pre-resolve vessel_code for tables scoped by vessel_code instead of vessel_id (UUID)
  const vesselCode = await getVesselCodeForUuid(vesselId);

  for (const config of oneWayTables) {
    try {
      let query: string;
      const params: any[] = [];

      const vesselCol = config.vesselScopeColumn;

      if (config.isGlobal) {
        // Global tables — no vessel filter
        if (sinceCheckpoint) {
          query = `SELECT * FROM "${config.tableName}" WHERE updated_at > $1 ORDER BY updated_at ASC LIMIT 5000`;
          params.push(sinceCheckpoint);
        } else {
          query = `SELECT * FROM "${config.tableName}" ORDER BY updated_at ASC LIMIT 5000`;
        }
      } else if (vesselCol) {
        // Vessel-scoped tables — use vessel_code or vessel_id depending on column type
        const scopeValue = vesselCol === 'vessel_code' ? vesselCode : vesselId;
        if (!scopeValue) {
          console.warn(`[Sync Pull] Skipping ${config.tableName}: no ${vesselCol} value for vessel ${vesselId}`);
          continue;
        }
        if (sinceCheckpoint) {
          query = `SELECT * FROM "${config.tableName}" WHERE "${vesselCol}" = $1 AND updated_at > $2 ORDER BY updated_at ASC LIMIT 5000`;
          params.push(scopeValue, sinceCheckpoint);
        } else {
          query = `SELECT * FROM "${config.tableName}" WHERE "${vesselCol}" = $1 ORDER BY updated_at ASC LIMIT 5000`;
          params.push(scopeValue);
        }
      } else {
        // Table has no vessel column and isn't global — skip
        continue;
      }

      const result = await pool.query(query, params);
      if (result.rows.length > 0) {
        results.push({ tableName: config.tableName, rows: result.rows });
      }
    } catch (err: any) {
      // Best-effort: skip tables that don't exist yet or have schema issues
      console.warn(`[Sync Pull] Skipping one-way table ${config.tableName}: ${err.message}`);
    }
  }

  return results;
}

/** Convert camelCase to snake_case */
function toSnakeCase(str: string): string {
  // Handle consecutive uppercase (acronyms) correctly:
  // timestampUTC → timestamp_utc, previousRH → previous_rh, completionRHValidated → completion_rh_validated
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')   // split acronym from next word: "RHV" → "RH_V"
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')       // split camelCase: "timestamp" + "U" → "timestamp_U"
    .toLowerCase();
}

/**
 * Normalize a field log row from raw SQL (snake_case) to the camelCase shape
 * that the rest of service.ts expects. Handles both Drizzle and raw SQL results.
 */
function normalizeFieldLog(row: any) {
  return {
    logUuid: row.logUuid ?? row.log_uuid,
    tableName: row.tableName ?? row.table_name,
    rowUuid: row.rowUuid ?? row.row_uuid,
    fieldName: row.fieldName ?? row.field_name,
    oldValue: row.oldValue ?? row.old_value,
    newValue: row.newValue ?? row.new_value,
    vesselId: row.vesselId ?? row.vessel_id,
    changedAt: row.changedAt ?? row.changed_at,
    changedByUserId: row.changedByUserId ?? row.changed_by_user_id,
    instanceId: row.instanceId ?? row.instance_id,
    isSynced: row.isSynced ?? row.is_synced,
    syncBatchId: row.syncBatchId ?? row.sync_batch_id,
  };
}

// ═══════════════════════════════════════════════════════════════
// FLEET SYNC OVERVIEW — Shore-side fleet-wide dashboard data
// ═══════════════════════════════════════════════════════════════

export async function getFleetSyncOverview(): Promise<any[]> {
  const pool = await getPool();
  if (!pool) return [];

  const result = await pool.query(`
    SELECT
      v.vuuid AS vessel_id,
      v.name AS vessel_name,
      sm.instance_id,
      sm.last_sync_at,
      sm.last_sync_status,
      sm.last_sync_checkpoint,
      COALESCE(fl.pending_changes, 0)::int AS pending_changes,
      COALESCE(sc.unresolved_conflicts, 0)::int AS unresolved_conflicts,
      COALESCE(fq.pending_files, 0)::int AS pending_files
    FROM vessels v
    LEFT JOIN sync_metadata sm ON sm.vessel_id = v.vuuid AND sm.is_deleted = false
    LEFT JOIN (
      SELECT vessel_id, count(*) AS pending_changes
      FROM sync_field_log
      WHERE is_synced = false AND is_deleted = false
      GROUP BY vessel_id
    ) fl ON fl.vessel_id = v.vuuid
    LEFT JOIN (
      SELECT vessel_id, count(*) AS unresolved_conflicts
      FROM sync_conflicts
      WHERE resolution IS NULL AND is_deleted = false
      GROUP BY vessel_id
    ) sc ON sc.vessel_id = v.vuuid
    LEFT JOIN (
      SELECT vessel_id, count(*) AS pending_files
      FROM sync_file_queue
      WHERE status IN ('pending', 'in_progress') AND is_deleted = false
      GROUP BY vessel_id
    ) fq ON fq.vessel_id = v.vuuid
    WHERE v.is_deleted = false
    ORDER BY sm.last_sync_at ASC NULLS FIRST
  `);

  return result.rows;
}
