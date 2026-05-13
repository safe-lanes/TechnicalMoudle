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
import * as alertsRepo from '../alerts/repositories/alertsRepository';
import { getFieldDisplayName } from './conflictReviewRepository';

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
      //
      //    Wrapped in a transaction with SET LOCAL sync.bypass_trigger = 'true' so that
      //    the set_updated_at() BEFORE UPDATE trigger does NOT override the application-
      //    supplied log.changedAt value. Without this, the trigger sets updated_at = NOW(),
      //    causing subsequent same-batch field logs to fail the stale-skip guard.
      const pool = await getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL sync.bypass_trigger = 'true'`);
        syncDiag(`SYNC-APPLY TRIGGER BYPASS active for batch=${batchUuid}`);

        // Phase 1: Detect INSERT groups (all oldValue=null) and insert new rows
        const insertResult = await applyFieldLogInserts(acceptedLogs, client);
        fieldLogsApplied += insertResult.insertedRows;
        fieldLogApplyErrors += insertResult.errors.length;
        if (insertResult.errors.length > 0) {
          insertResult.errors.forEach(e => console.error(`[Sync Push] INSERT error: ${e}`));
        }

        // Phase 2: Apply remaining UPDATE field logs (non-INSERT groups + existing rows)
        //
        // Per-field stale-skip guard (Option 2c):
        // Instead of comparing against row.updated_at (which mixes ALL field edits and
        // trigger stamps), we check sync_field_log for a newer RECEIVER-side edit on the
        // SAME field only.  This prevents false positives where an unrelated local edit
        // bumps row.updated_at and causes all incoming logs to appear stale.
        //
        // INSERT-origin logs (oldValue === null) ALWAYS apply (defence-in-depth from 58c33ad2).
        //
        // True conflicts (receiver has newer same-field edit) are recorded in
        // sync_conflict_log for visibility and future resolution UI.
        //
        // IMPORTANT: Use the log's changedAt (not NOW()) for updated_at when applying.
        // The trigger bypass ensures the supplied value is preserved in the row.
        const receiverInstanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
        if (receiverInstanceId === 'UNKNOWN') {
          syncDiag('WARNING: SYNC_INSTANCE_ID not set — per-field stale-skip protection degraded');
          console.error('[Sync Push] CRITICAL: SYNC_INSTANCE_ID env var not configured — stale-skip guard cannot distinguish receiver-local edits');
        }

        for (const log of insertResult.updateLogs) {
          const config = getTableSyncConfig(log.tableName);
          if (!config) continue;
          const identityCol = config.identityColumn || 'id';
          const fieldNameSnake = toSnakeCase(log.fieldName);

          try {
            const logChangedAt = log.changedAt instanceof Date ? log.changedAt : new Date(String(log.changedAt));
            const isInsertLog = log.oldValue === null || log.oldValue === undefined;

            // INSERT-origin logs ALWAYS apply — row needs these fields to exist
            if (isInsertLog) {
              syncDiag(`INSERT-LOG ALLOWED: ${log.tableName}.${log.fieldName} row=${log.rowUuid}`);
              // fall through to apply below
            } else {
              // Per-field stale-skip: check if the RECEIVER has a newer log for this
              // exact (table, row, field). Only receiver-local logs count — we compare
              // against instance_id = receiverInstanceId, NOT against the sender's logs.
              const fieldCheck = await client.query(
                `SELECT changed_at, instance_id FROM sync_field_log
                 WHERE table_name = $1 AND row_uuid = $2 AND field_name = $3
                   AND instance_id = $4 AND changed_at > $5
                 ORDER BY changed_at DESC LIMIT 1`,
                [log.tableName, log.rowUuid, log.fieldName, receiverInstanceId, logChangedAt]
              );

              if (fieldCheck.rows.length > 0) {
                // REAL CONFLICT: receiver edited this SAME field more recently.
                const winner = fieldCheck.rows[0];
                const winnerChangedAt = new Date(winner.changed_at);

                // Read current value from data table for the conflict log
                let currentValue: string | null = null;
                try {
                  const curRow = await client.query(
                    `SELECT "${fieldNameSnake}" FROM "${log.tableName}" WHERE "${identityCol}" = $1 LIMIT 1`,
                    [log.rowUuid]
                  );
                  if (curRow.rows.length > 0) {
                    const raw = curRow.rows[0][fieldNameSnake];
                    currentValue = raw === null || raw === undefined ? null : String(raw);
                  }
                } catch { /* best-effort — don't fail the loop for logging */ }

                // Record in sync_conflict_log
                try {
                  await client.query(
                    `INSERT INTO sync_conflict_log
                       (batch_uuid, table_name, row_uuid, field_name,
                        incoming_sender_instance, incoming_changed_at,
                        incoming_old_value, incoming_new_value,
                        receiver_winner_instance, receiver_winner_changed_at,
                        receiver_current_value)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [batchUuid, log.tableName, log.rowUuid, log.fieldName,
                     log.instanceId, logChangedAt,
                     log.oldValue, log.newValue,
                     receiverInstanceId, winnerChangedAt,
                     currentValue]
                  );
                  // ── Conflict notification (fire-and-forget) ──
                  try {
                    // Look up the rejected user from the incoming sender's field log
                    const rejectedUserQuery = await client.query(
                      `SELECT changed_by_user_id FROM sync_field_log
                       WHERE table_name = $1 AND row_uuid = $2 AND field_name = $3
                         AND instance_id = $4
                       ORDER BY changed_at DESC LIMIT 1`,
                      [log.tableName, log.rowUuid, log.fieldName, log.instanceId]
                    );
                    const rejectedUserId = rejectedUserQuery.rows[0]?.changed_by_user_id;

                    // Only notify real users, not 'system'
                    if (rejectedUserId && rejectedUserId !== 'system') {
                      const fieldLabel = getFieldDisplayName(log.fieldName);
                      const event = await alertsRepo.createAlertEvent({
                        alertType: 'sync_conflict_detected',
                        priority: 'medium',
                        objectType: log.tableName,
                        objectId: log.rowUuid,
                        vesselId: log.vesselId || null,
                        dedupeKey: `sync_conflict:${log.tableName}:${log.rowUuid}:${log.fieldName}:${logChangedAt.toISOString()}`,
                        state: 'open',
                        payload: JSON.stringify({
                          alertMessage: `Sync conflict: your change to "${fieldLabel}" was rejected — the other side has a newer edit`,
                          tableName: log.tableName,
                          fieldName: log.fieldName,
                          targetUserId: rejectedUserId,
                          link: `/admin/sync-conflicts`,
                        }),
                      });

                      if (event) {
                        await alertsRepo.createAlertDelivery({
                          eventId: event.id,
                          eventUuid: event.aeuuid,
                          channel: 'in_app',
                          recipient: rejectedUserId,
                          status: 'sent',
                        });
                        syncDiag(`CONFLICT NOTIFICATION: sent to user=${rejectedUserId} for ${log.tableName}.${log.fieldName}`);
                      }
                    }
                  } catch (notifyErr: any) {
                    // Dedupe key collision is normal — ignore. Other errors are non-fatal.
                    if (!notifyErr.message?.includes('unique') && !notifyErr.message?.includes('duplicate')) {
                      syncDiag(`CONFLICT NOTIFICATION FAILED: ${notifyErr.message} — conflict still logged`);
                    }
                  }
                } catch (clErr: any) {
                  console.error(`[Sync Push] Failed to write sync_conflict_log: ${clErr.message}`);
                }

                syncDiag(`CONFLICT LOGGED: ${log.tableName}.${log.fieldName} row=${log.rowUuid} — incoming ${logChangedAt.toISOString()} rejected by receiver ${winnerChangedAt.toISOString()}`);
                continue; // skip apply — receiver's edit wins
              }
              // No receiver-side conflict → fall through to apply
            }

            // ── Integer FK interception: location_id on spare_location_stock / inventory_transactions ──
            // The sender's integer location_id is auto-increment-specific and meaningless on the receiver.
            // If the row already has a location_uuid, we recompute location_id from local locations table.
            // If no location_uuid, we accept the incoming integer as-is (legacy / same-instance scenario).
            let effectiveNewValue = log.newValue;
            if (fieldNameSnake === 'location_id' &&
                (log.tableName === 'spare_location_stock' || log.tableName === 'inventory_transactions')) {
              try {
                const rowCheck = await client.query(
                  `SELECT location_uuid FROM "${log.tableName}" WHERE "${identityCol}" = $1 LIMIT 1`,
                  [log.rowUuid]
                );
                const existingLocUuid = rowCheck.rows[0]?.location_uuid;
                if (existingLocUuid) {
                  const locLookup = await client.query(
                    `SELECT id FROM locations WHERE luuid = $1 LIMIT 1`,
                    [existingLocUuid]
                  );
                  if (locLookup.rows.length > 0) {
                    syncDiag(`FK-REMAP: ${log.tableName} row=${log.rowUuid} incoming location_id=${log.newValue} → recomputed to local ${locLookup.rows[0].id} via location_uuid=${existingLocUuid}`);
                    effectiveNewValue = String(locLookup.rows[0].id);
                  }
                }
              } catch (fkErr: any) {
                syncDiag(`FK-REMAP location_id check error: ${fkErr.message}`);
              }
            }

            // JSON coercion for json/jsonb columns
            const meta = await getColumnMeta(client, log.tableName);
            let valueToApply: any = effectiveNewValue;
            if (valueToApply !== null && meta.jsonCols.has(fieldNameSnake)) {
              try {
                JSON.parse(valueToApply);
                // Valid JSON string — pass as-is (pg accepts for json/jsonb)
              } catch {
                // Not valid JSON (corrupted like "[object Object]") — reset to empty
                valueToApply = '[]';
              }
            }

            // Use the log's changedAt for updated_at — trigger bypass ensures it sticks.
            await client.query(
              `UPDATE "${log.tableName}" SET "${fieldNameSnake}" = $1, "updated_at" = $3 WHERE "${identityCol}" = $2`,
              [valueToApply, log.rowUuid, logChangedAt]
            );

            // ── Derived RH update — propagate running_hours_audit field changes to components current state ──
            // When running_hours_audit fields (new_rh, cumulative_rh) are applied via UPDATE,
            // also update the corresponding component's current_cumulative_rh and rh_current_master.
            if (log.tableName === 'running_hours_audit' &&
                (fieldNameSnake === 'new_rh' || fieldNameSnake === 'cumulative_rh') &&
                valueToApply !== null) {
              try {
                const auditRow = await client.query(
                  `SELECT component_id, entered_at_utc FROM running_hours_audit WHERE rhauuid = $1 LIMIT 1`,
                  [log.rowUuid]
                );
                if (auditRow.rows.length > 0) {
                  const compId = auditRow.rows[0].component_id;
                  const rhUpdatedAt = auditRow.rows[0].entered_at_utc || new Date();
                  const oldRow = await client.query(
                    `SELECT current_cumulative_rh, rh_current_master FROM components WHERE cuuid = $1 LIMIT 1`,
                    [compId]
                  );
                  const oldVal = oldRow.rows[0]?.current_cumulative_rh || oldRow.rows[0]?.rh_current_master || '(not found)';
                  // Also propagate rh_master_updated_at so "Last Updated Date" reflects on shore
                  await client.query(
                    `UPDATE components SET current_cumulative_rh = $1, rh_current_master = $1, rh_master_updated_at = $3, updated_at = NOW() WHERE cuuid = $2`,
                    [String(valueToApply), compId, rhUpdatedAt]
                  );
                  syncDiag(`RH-APPLY UPDATE: component=${compId} current_cumulative_rh updated from ${oldVal} to ${valueToApply}, rh_master_updated_at=${rhUpdatedAt} from audit row ${log.rowUuid}`);
                }
              } catch (rhErr: any) {
                syncDiag(`RH-APPLY UPDATE ERROR: audit=${log.rowUuid}: ${rhErr.message}`);
              }
            }

            // ── Cross-instance integer FK resolution for location_uuid → location_id ──
            // When a location_uuid field is applied on spare_location_stock or inventory_transactions,
            // the sender's integer location_id is meaningless on the receiver (different auto-increment
            // sequences). We resolve it by looking up the local locations row with matching luuid.
            // If the location hasn't synced yet, we log a warning — it will self-heal on next sync cycle
            // when the location row arrives and a subsequent upsert backfills location_id.
            if (fieldNameSnake === 'location_uuid' && valueToApply &&
                (log.tableName === 'spare_location_stock' || log.tableName === 'inventory_transactions')) {
              try {
                const locLookup = await client.query(
                  `SELECT id FROM locations WHERE luuid = $1 LIMIT 1`,
                  [valueToApply]
                );
                if (locLookup.rows.length > 0) {
                  const localLocId = locLookup.rows[0].id;
                  await client.query(
                    `UPDATE "${log.tableName}" SET "location_id" = $1 WHERE "${identityCol}" = $2`,
                    [localLocId, log.rowUuid]
                  );
                  syncDiag(`FK-REMAP: ${log.tableName} row=${log.rowUuid} location_uuid=${valueToApply} → local location_id=${localLocId}`);
                } else {
                  syncDiag(`FK-REMAP DEFERRED: ${log.tableName} row=${log.rowUuid} location_uuid=${valueToApply} — location not yet synced, location_id left as-is`);
                }
              } catch (fkErr: any) {
                syncDiag(`FK-REMAP ERROR: ${log.tableName} row=${log.rowUuid}: ${fkErr.message}`);
              }
            }

            fieldLogsApplied++;
          } catch (err: any) {
            fieldLogApplyErrors++;
            console.error(`[Sync Push] Failed to apply field log ${log.tableName}.${log.fieldName} for ${log.rowUuid}: ${err.message}`);
          }
        }

        await client.query('COMMIT');
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        console.error(`[Sync Push] Transaction error during field log apply: ${txErr.message}`);
        throw txErr;
      } finally {
        client.release();
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
  syncDiag(`PREPARE-PULL FIELD LOGS: ${shoreFieldLogs.length} shore logs for vessel=${vesselId} (excluded instance=${shipInstanceId})`);
  if (shoreFieldLogs.length > 0) {
    // Per-table breakdown for diagnostics
    const tableBreakdown: Record<string, number> = {};
    for (const log of shoreFieldLogs) { tableBreakdown[log.tableName] = (tableBreakdown[log.tableName] || 0) + 1; }
    syncDiag(`PREPARE-PULL FIELD LOG TABLES: ${JSON.stringify(tableBreakdown)}`);
  }

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
