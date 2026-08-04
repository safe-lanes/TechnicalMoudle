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
import { applyOneWayRows, getColumnMeta, applyFieldLogInserts, applyFullRowsIfAbsent, gatherFullRows , evaluateInsertOriginGuard, evaluateStaleSkipGuard, getLatestRotationDate, isReadingPreRotation } from './oneWayApplier';
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
import { safeParseDate } from '../running-hours/utils/rhValidation';

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
    masterRecordHints?: Array<{ tableName: string; rows: any[] }>;
    /** Self-heal delivery: complete rows this receiver previously requested via needsFullRows.
     *  Applied ONLY-IF-ABSENT (structurally incapable of overwriting). Optional — old ships
     *  never send it. */
    fullRows?: Array<{ tableName: string; rows: any[] }>;
  }
) {
  syncDiag(`RECEIVE-PUSH START: batch=${batchUuid}, vessel=${vesselId}, fieldLogs=${payload.fieldLogs?.length || 0}, oneWayRows=${payload.oneWayRows?.length || 0}, fullRows=${payload.fullRows?.length || 0}`);

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

  // ── Instance-id collision guard ──
  // Two DIFFERENT vessels presenting the SAME instance id is almost always an
  // unedited .env template (e.g. both ships left 'SHIP-VESSELNAME') or a cloned
  // image. Their field logs and metadata would interleave under one identity.
  // Loud warning so the shore operator catches it immediately.
  try {
    const senderInstance = (batch as any).initiatedByInstance || (batch as any).initiated_by_instance;
    if (senderInstance) {
      const collisionPool = await getPool();
      const collision = await collisionPool.query(
        `SELECT DISTINCT vessel_id FROM sync_batches
         WHERE initiated_by_instance = $1 AND vessel_id IS NOT NULL AND vessel_id <> $2
         LIMIT 5`,
        [senderInstance, vesselId]
      );
      if (collision.rows.length > 0) {
        const others = collision.rows.map((r: any) => r.vessel_id).join(', ');
        console.warn(
          `[Sync Push] ⚠️ INSTANCE-ID COLLISION: instance '${senderInstance}' is now syncing vessel '${vesselId}' ` +
          `but has previously synced different vessel(s): ${others}. Two ships are likely sharing one identity ` +
          `(unedited .env template / cloned image). Give each ship a unique SHIP-<code> id.`
        );
        syncDiag(`INSTANCE-ID COLLISION: ${senderInstance} vessel=${vesselId} previously=${others}`);
      }
    }
  } catch (collErr: any) {
    syncDiag(`instance-id collision check failed (non-fatal): ${collErr.message}`);
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

  // 1b. Self-heal delivery — apply the full rows the ship supplied for our earlier
  //     needsFullRows requests, BEFORE the field logs, so this same push's re-offered
  //     fragments find the rows present and apply as normal updates. Only-if-absent by
  //     construction (applyFullRowsIfAbsent) — cannot overwrite anything.
  let selfHealInserted = 0;
  if (payload.fullRows && payload.fullRows.length > 0) {
    for (const t of payload.fullRows) {
      const config = getTableSyncConfig(t.tableName);
      if (!config || config.category !== 'BOTH_EDITABLE') {
        console.warn(`[Sync Push] Self-heal fullRows rejected for non-BOTH_EDITABLE table: ${t.tableName}`);
        continue;
      }
      const r = await applyFullRowsIfAbsent(t.tableName, t.rows);
      selfHealInserted += r.inserted;
      if (r.errors.length > 0) r.errors.slice(0, 3).forEach(e => syncDiag(`SELF-HEAL APPLY ERROR: ${e.substring(0, 150)}`));
      syncDiag(`SELF-HEAL APPLY (push): ${t.tableName} — inserted=${r.inserted}, skipped(existing)=${r.skipped}, errors=${r.errors.length}`);
    }
  }

  // 2. Store AND apply ship's field logs (BOTH_EDITABLE changes)
  let fieldLogsStored = 0;
  let fieldLogsApplied = 0;
  let fieldLogApplyErrors = 0;
  let fieldLogRowMissing = 0; // UPDATEs that matched 0 rows (row absent on receiver) — must never be silent
  // Fix 2/3: row_uuids the receiver could NOT apply (dropped INSERTs + UPDATE-against-missing-row).
  // Returned in the push response so the ship keeps them is_synced=false and retries them next
  // cycle (after Fix 1 they arrive whole and apply), instead of losing them permanently.
  const droppedRowUuids = new Set<string>();
  // Self-heal requests generated by THIS apply — returned to the ship so it supplies the
  // complete rows in its next push. Old ships ignore the field (harmless).
  const needsFullRows: Array<{ tableName: string; rowUuid: string }> = [];
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
        (insertResult.failedRowUuids || []).forEach(r => droppedRowUuids.add(r));
        (insertResult.needsFullRows || []).forEach(n => needsFullRows.push(n));
        if (insertResult.errors.length > 0) {
          // VISIBLE ALERT: a dropped INSERT means an incoming row could NOT be applied and is now
          // MISSING on this instance (the historical silent-drop that orphaned WOs / notifications).
          // Surface it unmistakably — both in the server log and the sync diag — and it is already
          // counted in fieldLogApplyErrors, which flows to the RECEIVE-PUSH DONE summary so a non-zero
          // 'errors' count is never invisible. (Follow-up: also raise a Conflict-Review UI entry.)
          insertResult.errors.forEach(e => console.error(`[Sync Push] INSERT error: ${e}`));
          console.error(
            `[Sync Push] ⚠️ DROPPED-ROW ALERT: ${insertResult.errors.length} incoming INSERT(s) could ` +
            `NOT be applied and are MISSING on this instance (batch=${batchUuid}). Rows: ${insertResult.errors.join(' | ')}`
          );
          syncDiag(
            `RECEIVE-PUSH ⚠️ DROPPED-ROW ALERT: ${insertResult.errors.length} insert(s) dropped, batch=${batchUuid} — ${insertResult.errors.join(' | ')}`
          );
        }

        // ── Detect whether cert/survey data tables were touched in this batch ──
        // Used after all field-log processing (INSERT + UPDATE) to ensure
        // applicability rows exist.  See "Ensure applicability" block below.
        const touchedDataTables = new Set<string>();
        for (const log of acceptedLogs) {
          if (log.tableName === 'vessel_certificate_data' || log.tableName === 'vessel_survey_data') {
            touchedDataTables.add(log.tableName);
          }
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

        let pushUpdIdx = 0;
        for (const log of insertResult.updateLogs) {
          const config = getTableSyncConfig(log.tableName);
          if (!config) continue;
          const identityCol = config.identityColumn || 'id';
          const fieldNameSnake = toSnakeCase(log.fieldName);

          // Part A: per-row savepoint so one poison UPDATE (e.g. an immutable-table reject) can no
          // longer 25P02-abort its siblings in this receive batch (mirrors the INSERT-path savepoints,
          // d8e88c679). RELEASE on success/conflict-skip, ROLLBACK TO SAVEPOINT on failure.
          const pushSp = `push_upd_${pushUpdIdx++}`;
          try { await client.query(`SAVEPOINT ${pushSp}`); } catch { /* non-fatal */ }
          try {
            const logChangedAt = log.changedAt instanceof Date ? log.changedAt : new Date(String(log.changedAt));
            const isInsertLog = log.oldValue === null || log.oldValue === undefined;

            // INSERT-origin logs apply UNCONDITIONALLY only while the row is being created.
            // Once the row EXISTS, a creation-time log is by definition the oldest state of that
            // row and must not overwrite a populated column — that is how the Frontier Venture
            // "39" were reverted. See evaluateInsertOriginGuard (SYNC-HARDENING-PLAN §13).
            if (isInsertLog) {
              const guard = await evaluateInsertOriginGuard(client, log);
              if (guard.skip) {
                // TERMINAL: acked, not re-offered. The condition can never change, so retrying
                // would loop forever. Deliberately NO sync_conflict_log row and NO notification —
                // this is not a user-visible conflict; the counter on /sync/status is the signal.
                try { await client.query(`RELEASE SAVEPOINT ${pushSp}`); } catch { /* non-fatal */ }
                continue;
              }
              syncDiag(`INSERT-LOG ALLOWED: ${log.tableName}.${log.fieldName} row=${log.rowUuid}`);
              // fall through to apply below
            } else {
              // §18: the detection + conflict-record now live in the SHARED helper that the
              // ship's pull path also calls, so both directions behave identically and there is
              // one implementation to reason about. The notification below stays here — it is a
              // shore-side choice about office-user attention, not part of the guard.
              const stale = await evaluateStaleSkipGuard(
                client,
                { ...log, changedAt: logChangedAt },
                receiverInstanceId,
                { batchUuid },
              );

              if (stale.skip) {
                // ── Conflict notification (fire-and-forget, SHORE ONLY) ──
                try {
                  // Look up the rejected user from the incoming sender's field log
                  const rejectedUserId = (log as any).changedByUserId || null;
                  // 'auto-generation' (and startup/cron stamp 'system') — neither is a real
                  // recipient, so both must be excluded or we'd queue a notification nobody owns.
                  const MACHINE_ACTORS = new Set(['system', 'auto-generation']);
                  if (rejectedUserId && !MACHINE_ACTORS.has(rejectedUserId)) {
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

                try { await client.query(`RELEASE SAVEPOINT ${pushSp}`); } catch { /* non-fatal */ }
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
            const updateResult = await client.query(
              `UPDATE "${log.tableName}" SET "${fieldNameSnake}" = $1, "updated_at" = $3 WHERE "${identityCol}" = $2`,
              [valueToApply, log.rowUuid, logChangedAt]
            );

            // Defence-in-depth: if UPDATE matched 0 rows, the row doesn't exist
            // on the receiver and the incoming change just VANISHED. This was
            // previously syncDiag-only (errors=0) — which masked Issue 01
            // (generated WOs reached the shore but were never inserted, and the
            // per-field UPDATEs against the missing row dropped silently). Now
            // it is loud and COUNTED so the batch result can never look clean.
            if (updateResult.rowCount === 0) {
              fieldLogRowMissing++;
              droppedRowUuids.add(log.rowUuid); // Fix 2/3: keep unsynced so the ship retries once its INSERT lands
              console.warn(`[Sync Push] UPDATE skipped — row missing on receiver: ${log.tableName}.${fieldNameSnake} row=${log.rowUuid} (change dropped; see FIELD-LOG-INSERT RECOVERY)`);
              syncDiag(`UPDATE-MISS: ${log.tableName}.${fieldNameSnake} row=${log.rowUuid} — row not found, UPDATE had no effect`);
            }

            // ── Derived RH update — propagate running_hours_audit field changes to components current state ──
            // When running_hours_audit fields (new_rh, cumulative_rh) are applied via UPDATE,
            // also update the corresponding component's current_cumulative_rh and rh_current_master.
            if (log.tableName === 'running_hours_audit' &&
                (fieldNameSnake === 'new_rh' || fieldNameSnake === 'cumulative_rh') &&
                valueToApply !== null) {
              try {
                const auditRow = await client.query(
                  `SELECT component_id, entered_at_utc, date_updated_local FROM running_hours_audit WHERE rhauuid = $1 LIMIT 1`,
                  [log.rowUuid]
                );
                if (auditRow.rows.length > 0) {
                  const compId = auditRow.rows[0].component_id;
                  // Rotation ordering guard: a pre-swap RH reading applied AFTER the rotation
                  // must not clobber the post-swap baseline with the old stamp's hours.
                  const rotGuardReading = safeParseDate(auditRow.rows[0].date_updated_local)
                    || (auditRow.rows[0].entered_at_utc instanceof Date ? auditRow.rows[0].entered_at_utc : safeParseDate(auditRow.rows[0].entered_at_utc));
                  const latestRotation = await getLatestRotationDate(client, compId);
                  if (latestRotation && isReadingPreRotation(rotGuardReading, latestRotation)) {
                    syncDiag(`RH-APPLY UPDATE SKIP (pre-rotation): component=${compId} audit=${log.rowUuid} reading ${rotGuardReading.toISOString()} predates latest rotation ${latestRotation.toISOString()} — component baseline untouched`);
                    continue;
                  }
                  const rhUpdatedAt = auditRow.rows[0].entered_at_utc || new Date();
                  const oldRow = await client.query(
                    `SELECT current_cumulative_rh, rh_current_master FROM components WHERE cuuid = $1 LIMIT 1`,
                    [compId]
                  );
                  const oldVal = oldRow.rows[0]?.current_cumulative_rh || oldRow.rows[0]?.rh_current_master || '(not found)';
                  // Also propagate rh_master_updated_at + last_updated so "Last Updated Date" reflects on shore.
                  // The API reads: component.lastUpdated || component.rhMasterUpdatedAt || component.updatedAt
                  // last_updated (TEXT) has highest priority, so it MUST be set here.
                  // Components is ONE_WAY_SHORE_TO_SHIP — vessel's last_updated change never syncs back.
                  // IMPORTANT: Vessel sets last_updated = date_updated_local (user-selected date, e.g. "13-May-2026 10:30").
                  // We must use the same field here — NOT entered_at_utc which is a system timestamp.
                  const lastUpdatedText = auditRow.rows[0].date_updated_local || (rhUpdatedAt instanceof Date ? rhUpdatedAt : new Date(String(rhUpdatedAt))).toISOString();
                  // rh_master_updated_at must be the USER's reading date (date_updated_local),
                  // NOT entered_at_utc (the system write time). It feeds the "Last Updated"
                  // MAX() and the WO-approval back-dated check; using the system time made
                  // shore show the sync time (Issue 1) and made WO approval skip RH (Issue 2).
                  const rhMasterUpdatedAtVal = safeParseDate(auditRow.rows[0].date_updated_local) || rhUpdatedAt;
                  await client.query(
                    `UPDATE components SET current_cumulative_rh = $1, rh_current_master = $1, rh_master_updated_at = $3, last_updated = $4, updated_at = NOW() WHERE cuuid = $2`,
                    [String(valueToApply), compId, rhMasterUpdatedAtVal, lastUpdatedText]
                  );
                  syncDiag(`RH-APPLY UPDATE: component=${compId} current_cumulative_rh updated from ${oldVal} to ${valueToApply}, last_updated=${lastUpdatedText} from audit row ${log.rowUuid}`);
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
            try { await client.query(`RELEASE SAVEPOINT ${pushSp}`); } catch { /* non-fatal */ }
          } catch (err: any) {
            try { await client.query(`ROLLBACK TO SAVEPOINT ${pushSp}`); } catch { /* non-fatal */ }
            fieldLogApplyErrors++;
            // Part B: an immutable-table UPDATE can never apply (INSERT-only + DB trigger) → terminal.
            // The push catch already does NOT add to droppedRowUuids, so the row acks by default;
            // just surface it distinctly instead of as a generic apply error.
            const immutableReject = !!config.immutable || /immutable/i.test(err.message || '');
            if (immutableReject) {
              syncDiag(`RECEIVE UPDATE IMMUTABLE-ACK (terminal): ${log.tableName}.${log.fieldName} row=${log.rowUuid} — ${(err.message || '').substring(0, 120)}`);
              console.warn(`[Sync Push] Immutable-table UPDATE rejected — acked as terminal (not retried): ${log.tableName}.${log.fieldName} row=${log.rowUuid}`);
            } else {
              console.error(`[Sync Push] Failed to apply field log ${log.tableName}.${log.fieldName} for ${log.rowUuid}: ${err.message}`);
            }
          }
        }

        // ── Ensure master records (FIX 56) ────────────────────────────────────
        // ship_surveys_master and ship_certificates_master are ONE_WAY_SHORE_TO_SHIP,
        // so definitions created on ship never sync back. When vessel_survey_data or
        // vessel_certificate_data arrives from ship referencing a master_id that
        // doesn't exist on shore, the UI can't display it (getMasterSurveysByIds /
        // getMasterCertificatesByIds filter by master table).
        //
        // Create placeholder master records so the data is visible. Admins can
        // update the name/category later via the shore admin UI.
        //
        // master_id format: "A1-007" (letter+digit+"-"+seq) or "VES-013"/"CMP-001"
        if (touchedDataTables.size > 0) {
          const ENSURE_MASTER_PAIRS: Array<{
            dataTable: string; masterTable: string; nameCol: string;
          }> = [
            { dataTable: 'vessel_certificate_data', masterTable: 'ship_certificates_master', nameCol: 'certificate_name' },
            { dataTable: 'vessel_survey_data', masterTable: 'ship_surveys_master', nameCol: 'survey_name' },
          ];

          for (const mp of ENSURE_MASTER_PAIRS) {
            if (!touchedDataTables.has(mp.dataTable)) continue;
            try {
              const masterResult = await client.query(
                `INSERT INTO "${mp.masterTable}" (
                   sequence, master_id, "${mp.nameCol}", category, "group",
                   applicable_to_company, is_active, is_deleted, created_at, updated_at
                 )
                 SELECT DISTINCT
                   COALESCE(
                     NULLIF(SPLIT_PART(d.master_id, '-', 2), '')::int,
                     0
                   ),
                   d.master_id,
                   d.master_id,
                   CASE
                     WHEN d.master_id ~ '^[A-Z][0-9]+-' THEN LEFT(d.master_id, 1)
                     ELSE SPLIT_PART(d.master_id, '-', 1)
                   END,
                   CASE
                     WHEN d.master_id ~ '^[A-Z][0-9]+-' THEN SUBSTRING(d.master_id, 2, 1)
                     ELSE ''
                   END,
                   false, true, false, NOW(), NOW()
                 FROM "${mp.dataTable}" d
                 WHERE d.is_deleted = false
                   AND d.vessel_id = $1
                   AND d.master_id IS NOT NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM "${mp.masterTable}" m
                     WHERE m.master_id = d.master_id
                   )
                 ON CONFLICT (master_id) DO NOTHING`,
                [vesselId]
              );
              const created = masterResult.rowCount ?? 0;
              if (created > 0) {
                syncDiag(`ENSURE-MASTER: created ${created} ${mp.masterTable} placeholder(s) for vessel=${vesselId}`);
              }
            } catch (masterErr: any) {
              syncDiag(`ENSURE-MASTER ERROR: ${mp.masterTable} vessel=${vesselId}: ${masterErr.message}`);
            }
          }
        }

        // ── Ensure applicability (FIX 55) ───────────────────────────────────
        // After master records are ensured, also ensure applicability rows exist.
        // Shore UI queries applicability as entry point (getSurveys/getCertificates).
        // Applicability tables are ONE_WAY_SHORE_TO_SHIP — ship-created records
        // never travel back. We derive them from the data row.
        // Idempotent via ON CONFLICT DO NOTHING. Scoped to this vessel.
        if (touchedDataTables.size > 0) {
          const ENSURE_APP_PAIRS: Array<{ dataTable: string; appTable: string }> = [
            { dataTable: 'vessel_certificate_data', appTable: 'vessel_certificate_applicability' },
            { dataTable: 'vessel_survey_data', appTable: 'vessel_survey_applicability' },
          ];

          for (const pair of ENSURE_APP_PAIRS) {
            if (!touchedDataTables.has(pair.dataTable)) continue;
            try {
              const ensureResult = await client.query(
                `INSERT INTO "${pair.appTable}" (vessel_id, vessel_name, master_id, is_applicable, is_deleted, created_at, updated_at)
                 SELECT DISTINCT d.vessel_id, COALESCE(d.vessel_name, 'Unknown'), d.master_id, true, false, NOW(), NOW()
                 FROM "${pair.dataTable}" d
                 WHERE d.is_deleted = false
                   AND d.vessel_id = $1
                   AND d.vessel_id IS NOT NULL
                   AND d.master_id IS NOT NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM "${pair.appTable}" a
                     WHERE a.vessel_id = d.vessel_id AND a.master_id = d.master_id AND a.is_deleted = false
                   )
                 ON CONFLICT (vessel_id, master_id) WHERE is_deleted = false DO NOTHING`,
                [vesselId]
              );
              const created = ensureResult.rowCount ?? 0;
              if (created > 0) {
                syncDiag(`ENSURE-APPLICABILITY: created ${created} ${pair.appTable} row(s) for vessel=${vesselId}`);
              }
            } catch (appErr: any) {
              // Non-fatal — data is still synced, applicability can be created via migration/next cycle
              syncDiag(`ENSURE-APPLICABILITY ERROR: ${pair.appTable} vessel=${vesselId}: ${appErr.message}`);
            }
          }
        }

        // ── Apply masterRecordHints (FIX 58) ────────────────────────────
        // Ship sends real master record data (names, requirement_ref, etc.)
        // so shore can update placeholder masters that ENSURE-MASTER created
        // with master_id as name. This runs AFTER ensure-master/applicability
        // so the rows exist by the time we UPDATE them.
        if (payload.masterRecordHints && payload.masterRecordHints.length > 0) {
          const HINT_TABLE_MAP: Record<string, { table: string; nameCol: string; labelCol: string }> = {
            ship_surveys_master: { table: 'ship_surveys_master', nameCol: 'survey_name', labelCol: 'survey_label' },
            ship_certificates_master: { table: 'ship_certificates_master', nameCol: 'certificate_name', labelCol: 'certificate_label' },
          };

          for (const hint of payload.masterRecordHints) {
            const mapping = HINT_TABLE_MAP[hint.tableName];
            if (!mapping) continue;

            for (const row of (hint.rows || [])) {
              if (!row.master_id) continue;
              try {
                // applicable_to_company intentionally NOT synced from ship —
                // only shore admin decides company-wide applicability (domain decision).
                // FIX 56 creates synced masters with applicable_to_company = false;
                // that default is preserved here so ship-created masters stay vessel-specific
                // and don't trigger the admin-save fan-out to all vessels.
                const updateResult = await client.query(
                  `UPDATE "${mapping.table}" SET
                     "${mapping.nameCol}"    = COALESCE($2, "${mapping.nameCol}"),
                     "${mapping.labelCol}"   = COALESCE($3, "${mapping.labelCol}"),
                     category                = COALESCE($4, category),
                     "group"                 = COALESCE($5, "group"),
                     requirement_ref         = COALESCE($6, requirement_ref),
                     company_id              = COALESCE($7, company_id),
                     company_group           = COALESCE($8, company_group),
                     company_sequence        = COALESCE($9, company_sequence),
                     sequence                = COALESCE($10, sequence),
                     updated_at              = NOW()
                   WHERE master_id = $1`,
                  [
                    row.master_id,
                    row[mapping.nameCol] || null,
                    row[mapping.labelCol] || null,
                    row.category || null,
                    row.group || null,
                    row.requirement_ref || null,
                    row.company_id || null,
                    row.company_group || null,
                    row.company_sequence != null ? row.company_sequence : null,
                    row.sequence != null ? row.sequence : null,
                  ]
                );
                if ((updateResult.rowCount ?? 0) > 0) {
                  syncDiag(`MASTER-HINT APPLIED: ${mapping.table} master_id=${row.master_id} name=${row[mapping.nameCol]}`);
                }
              } catch (hintErr: any) {
                syncDiag(`MASTER-HINT ERROR: ${mapping.table} master_id=${row.master_id}: ${hintErr.message}`);
              }
            }
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

  syncDiag(`RECEIVE-PUSH DONE: stored=${fieldLogsStored}, applied=${fieldLogsApplied}, errors=${fieldLogApplyErrors}, rowMissing=${fieldLogRowMissing}, oneWayTables=${oneWaySummary.length}`);
  console.log(
    `[Sync Push] Batch ${batchUuid}: ${fieldLogsStored} field logs stored, ` +
    `${fieldLogsApplied} applied, ${fieldLogApplyErrors} apply errors, ` +
    `${fieldLogRowMissing} row-missing skips, ` +
    `${oneWaySummary.length} one-way tables`
  );
  if (fieldLogRowMissing > 0) {
    console.warn(`[Sync Push] WARNING: ${fieldLogRowMissing} field change(s) targeted rows that do not exist on this instance — data was NOT applied (stored≫applied gap). Investigate FIELD-LOG-INSERT RECOVERY / UPDATE-MISS lines above.`);
  }

  return {
    received: totalReceived,
    fieldLogsStored,
    fieldLogsApplied,
    fieldLogApplyErrors,
    fieldLogRowMissing,
    droppedRowUuids: Array.from(droppedRowUuids), // Fix 2/3: rows the ship must keep unsynced + retry
    // POSITIVE CONFIRM (migration 147). droppedRowUuids is a NEGATIVE ack: it reports what failed,
    // so "shore said nothing" reads as "everything applied". Safe while the shore always answers,
    // but it is the wrong default — silence must never mean success. This field states what the
    // shore ACTUALLY applied, so the ship can mark synced only on confirmation.
    //
    // The ship selects on FIELD PRESENCE, not value: an older shore omits the key entirely and the
    // ship falls back to the droppedRowUuids path (byte-identical to today). An empty ARRAY here is
    // meaningful and different — it means "nothing applied".
    appliedRowUuids: Array.from(
      new Set(
        (payload.fieldLogs || [])
          .map((l: any) => l.rowUuid ?? (l as any).row_uuid)
          .filter((r: any) => r && !droppedRowUuids.has(r))
      )
    ),
    // Self-heal: fragments targeting rows absent here — the ship supplies the complete
    // rows in its next push. Optional field; old ships ignore it.
    needsFullRows,
    selfHealInserted,
    oneWaySummary,
  };
}

/**
 * Self-heal fetch (pull direction): the SHIP hit fragments for rows absent on ITS side and
 * requests the complete rows from the shore. Read-only gather from the tenant DB (the
 * syncTenantGuard has already scoped this request to the ship's own tenant). Capped.
 */
export async function fetchFullRowsForHeal(
  requests: Array<{ tableName: string; rowUuids: string[] }>
): Promise<Array<{ tableName: string; rows: any[] }>> {
  const sane = (requests || [])
    .filter(r => r && typeof r.tableName === 'string' && Array.isArray(r.rowUuids))
    .map(r => ({ tableName: r.tableName, rowUuids: r.rowUuids.filter(u => typeof u === 'string') }));
  const tables = await gatherFullRows(sane);
  syncDiag(`SELF-HEAL FETCH (shore): ${sane.length} request table(s) → ${tables.reduce((n, t) => n + t.rows.length, 0)} row(s) supplied`);
  return tables;
}

// ═══════════════════════════════════════════════════════════════
// 3. PULL (Ship requests Shore's changes)
// ═══════════════════════════════════════════════════════════════

export async function preparePullData(
  batchUuid: string,
  vesselId: string,
  shipInstanceId: string,
  lastCheckpoint: Date | null,
  /** Migration 148 — per-table one-way watermarks from the ship. ABSENT (old ship) means
   *  fall back to the single `lastCheckpoint` for every table, i.e. today's behaviour
   *  exactly. Presence of the key is the capability signal; no version handshake. */
  tableCheckpoints?: Record<string, Date>
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
  const shoreInstanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
  syncDiag(`PREPARE-PULL START: vessel=${vesselId}, vesselCode=${vesselCode}, checkpoint=${lastCheckpoint ? lastCheckpoint.toISOString() : 'NONE'}, shoreInstanceId=${shoreInstanceId}`);

  // Safety check: if shore's SYNC_INSTANCE_ID matches the ship's, shore's own logs
  // will be excluded by the instance_id != filter, causing 0 results silently.
  if (shoreInstanceId === shipInstanceId) {
    syncDiag(`PREPARE-PULL CRITICAL WARNING: shore SYNC_INSTANCE_ID '${shoreInstanceId}' matches ship instanceId '${shipInstanceId}' — shore field logs will be SELF-EXCLUDED!`);
    console.error(`[Sync Pull] CRITICAL: SYNC_INSTANCE_ID='${shoreInstanceId}' matches ship '${shipInstanceId}'. Shore's field logs will NOT be sent to ship. Fix SYNC_INSTANCE_ID in shore's environment!`);
  }

  // 1. Gather ONE_WAY_SHORE_TO_SHIP full-row snapshots (148: per-table watermarks,
  //    falling back to the shared floor for any table without one)
  const oneWayGather = await gatherOneWayShoreRows(vesselId, lastCheckpoint, tableCheckpoints);
  const oneWayRows = oneWayGather.batches;

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
        vesselId: shoreLog.vesselId,
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
    // 148: max updated_at delivered per one-way table this cycle. The ship echoes back
    // only the tables it applied cleanly, and /sync/complete advances exactly those.
    oneWayTableMax: oneWayGather.tableMax,
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
  instanceId: string,
  appliedRowUuids?: string[],
  /** One-way tables whose apply FAILED on the ship this cycle (one-way orphaning fix).
   *  Non-empty → the checkpoint is held at checkpointBefore instead of advancing, so the
   *  failed one-way window is re-offered next sync (idempotent upserts). The one-way
   *  watermark is a single per-instance timestamp, so the hold covers the whole one-way
   *  window — bounded, idempotent re-delivery; field logs are is_synced-driven and unaffected. */
  failedOneWayTables?: string[],
  /** Migration 148 — { tableName: iso } the ship applied cleanly this cycle, echoed from
   *  the pull response's oneWayTableMax. ABSENT (old ship) → fall back entirely to the
   *  single-watermark path below, byte-identical to pre-148 behaviour. */
  appliedTableCheckpoints?: Record<string, string>
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
  syncDiag(`COMPLETE-SESSION: marking shore logs synced for vessel=${vesselId} checkpointBefore=${batch.checkpointBefore?.toISOString?.() || batch.checkpointBefore || 'NONE'} excludeInstance=${instanceId}`);
  const shoreLogsRaw = await repo.getFieldLogsSinceCheckpoint(
    vesselId,
    batch.checkpointBefore,
    instanceId, // exclude ship's own
    vesselCode
  );
  const shoreLogs = shoreLogsRaw.map(normalizeFieldLog);

  // Option 2 (pull-side per-row ack): mark synced ONLY rows the ship confirmed it applied.
  //  - New ship sends appliedRowUuids → mark just those rows' logs; every unacked/undelivered
  //    shore log stays is_synced=false and is re-offered on the next pull (is_synced-driven gather).
  //    This also closes a latent hole: preparePullData sends only NON-conflicting logs, but the old
  //    code marked ALL in-window logs synced (including conflict rows it never sent). Ack scoping
  //    now leaves those correctly unsynced until resolved.
  //  - BACKWARD-COMPAT: old ship omits appliedRowUuids (undefined) → mark the whole sent window,
  //    exactly as today. Because the pull gather and this gather share LIMIT/order and both key on
  //    is_synced=false, the sent set equals this set, so an old ship still drains and never strands
  //    more than today.
  let logsToMark = shoreLogs;
  if (Array.isArray(appliedRowUuids)) {
    const acked = new Set(appliedRowUuids);
    logsToMark = shoreLogs.filter(l => acked.has(l.rowUuid));
  }
  syncDiag(`COMPLETE-SESSION: ${shoreLogs.length} shore logs in window; marking ${logsToMark.length} synced (ack=${Array.isArray(appliedRowUuids) ? appliedRowUuids.length : 'legacy-all'})`);
  if (logsToMark.length > 0) {
    await repo.markFieldLogsSynced(
      logsToMark.map(l => l.logUuid),
      batchUuid
    );
  }

  //    - Ship's logs that were received by shore
  const shipLogsRaw = await repo.getUnsyncedFieldLogs(instanceId, vesselId, vesselCode);
  const shipLogs = shipLogsRaw.map(normalizeFieldLog);
  syncDiag(`COMPLETE-SESSION: found ${shipLogs.length} ship logs to mark synced`);
  if (shipLogs.length > 0) {
    await repo.markFieldLogsSynced(
      shipLogs.map(l => l.logUuid),
      batchUuid
    );
  }

  // 2. Advance checkpoint — UNLESS the ship reported failed one-way tables, in which
  //    case hold it at checkpointBefore so the failed one-way window is re-offered next
  //    cycle instead of being orphaned behind the watermark (the epic Unknown-table case).
  // ── 148: PER-TABLE ADVANCE ────────────────────────────────────────────────────
  // Presence of appliedTableCheckpoints is the capability signal (same rule as 147's
  // appliedRowUuids). Absent ⇒ old ship ⇒ skip this entirely and use the single
  // watermark below, unchanged.
  const failedSet = new Set(failedOneWayTables || []);
  let perTableWritten = 0;
  if (appliedTableCheckpoints && Object.keys(appliedTableCheckpoints).length > 0) {
    // Advance ONLY tables that did not fail. A failed table keeps its old watermark, so
    // its window re-offers next cycle — while every healthy table moves on. This is what
    // breaks the "one broken table freezes all ~52" loop.
    const advance: Record<string, string> = {};
    for (const [t, iso] of Object.entries(appliedTableCheckpoints)) {
      if (!failedSet.has(t) && iso) advance[t] = iso;
    }
    perTableWritten = await repo.setTableCheckpoints(instanceId, advance);
    if (failedSet.size > 0) {
      syncDiag(
        `COMPLETE-SESSION PER-TABLE: advanced ${perTableWritten} table(s); ` +
        `held [${Array.from(failedSet).join(',')}] — other tables unaffected`
      );
    }
  }

  const oneWayHoldback = Array.isArray(failedOneWayTables) && failedOneWayTables.length > 0;
  const checkpointBefore = batch.checkpointBefore
    ? (batch.checkpointBefore instanceof Date ? batch.checkpointBefore : new Date(batch.checkpointBefore))
    : null;
  const effectiveCheckpoint = oneWayHoldback ? checkpointBefore : now;
  if (oneWayHoldback) {
    const held = effectiveCheckpoint ? effectiveCheckpoint.toISOString() : 'NULL (full one-way resend)';
    console.warn(
      `[Sync Complete] ⚠️ ONE-WAY HOLDBACK: ship reported failed one-way table(s) [${failedOneWayTables!.join(', ')}] — ` +
      `checkpoint held at ${held}; their window re-offers next sync.`
    );
    syncDiag(`COMPLETE-SESSION ONE-WAY HOLDBACK: tables=[${failedOneWayTables!.join(',')}] checkpoint held at ${held}`);
  }
  await repo.upsertInstanceMetadata({
    instanceId,
    vesselId,
    lastSyncCheckpoint: effectiveCheckpoint,
    lastSyncStatus: 'success',
    lastSyncAt: now,
  });

  // 3. Complete batch
  await repo.updateBatch(batchUuid, {
    status: 'completed',
    completedAt: now,
    ...(effectiveCheckpoint ? { checkpointAfter: effectiveCheckpoint } : {}),
    durationMs,
  });

  console.log(`[Sync Complete] Batch ${batchUuid}: ${durationMs}ms, checkpoint ${oneWayHoldback ? 'HELD at' : 'advanced to'} ${effectiveCheckpoint ? effectiveCheckpoint.toISOString() : 'NULL'}`);

  // Remaining office→ship backlog for this vessel (is_synced=false, instance != ship) AFTER this
  // session's mark-synced — lets the ship's drain loop know whether the pull direction is drained.
  const remainingPull = await repo.getShorePullRemainingCount(vesselId, instanceId, vesselCode);

  return {
    completed: true,
    // The EFFECTIVE checkpoint (held back on one-way failures) — the ship saves this
    // locally, so ship and shore watermarks stay consistent. Null = full one-way resend.
    newCheckpoint: effectiveCheckpoint ? effectiveCheckpoint.toISOString() : null,
    oneWayHoldback,
    // 148: the authoritative per-table watermarks after this cycle. The ship persists
    // these; its `lastCheckpoint` for the NEXT pull is the MINIMUM of them (see
    // repo.getConservativeFloor). Absent from an old shore's response ⇒ the ship keeps
    // using the single newCheckpoint for everything.
    newTableCheckpoints: await repo.getTableCheckpoints(instanceId),
    perTableAdvanced: perTableWritten,
    durationMs,
    remainingPull,
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
  sinceCheckpoint: Date | null,
  /** Migration 148: per-table watermarks. A table absent here falls back to
   *  `sinceCheckpoint` — that COALESCE is what keeps day one identical to before. */
  tableCheckpoints?: Record<string, Date>
): Promise<{
  batches: Array<{ tableName: string; rows: any[] }>;
  /** Max updated_at ACTUALLY DELIVERED per table, ISO. The checkpoint advances to THIS,
   *  never to wall-clock now — which is what closes the silent LIMIT 5000 truncation:
   *  rows 5001+ used to be dropped while the watermark jumped past them for good. */
  tableMax: Record<string, string>;
}> {
  const oneWayTables = getTablesByCategory('ONE_WAY_SHORE_TO_SHIP');
  const results: Array<{ tableName: string; rows: any[] }> = [];
  const tableMax: Record<string, string> = {};
  const pool = await getPool();

  // Pre-resolve vessel_code for tables scoped by vessel_code instead of vessel_id (UUID)
  const vesselCode = await getVesselCodeForUuid(vesselId);

  for (const config of oneWayTables) {
    try {
      let query: string;
      const params: any[] = [];

      // Per-table watermark (148) with fallback to the shared floor. Missing row =
      // "never diverged from the single checkpoint", so behaviour is unchanged.
      const sinceForTable =
        (tableCheckpoints && tableCheckpoints[config.tableName]) || sinceCheckpoint;

      const vesselCol = config.vesselScopeColumn;

      if (config.isGlobal) {
        // Global tables — no vessel filter
        if (sinceForTable) {
          query = `SELECT *, updated_at::text AS __wm FROM "${config.tableName}" WHERE updated_at > $1 ORDER BY updated_at ASC LIMIT 5000`;
          params.push(sinceForTable);
        } else {
          query = `SELECT *, updated_at::text AS __wm FROM "${config.tableName}" ORDER BY updated_at ASC LIMIT 5000`;
        }
      } else if (vesselCol) {
        // Vessel-scoped tables — use vessel_code or vessel_id depending on column type
        const scopeValue = vesselCol === 'vessel_code' ? vesselCode : vesselId;
        if (!scopeValue) {
          // Not scopeable to this vessel ⇒ it has NOTHING to deliver here, so stamp a
          // watermark rather than leaving a hole. A hole would make getConservativeFloor
          // return null forever, and the ship would then full-snapshot all ~52 tables on
          // every sync against an old shore — the exact 60s-504 path 148 exists to remove.
          // Only a table that THROWS stays unstamped: that is a real unknown and the
          // conservative null is the right answer there.
          console.warn(`[Sync Pull] Skipping ${config.tableName}: no ${vesselCol} value for vessel ${vesselId}`);
          tableMax[config.tableName] = new Date().toISOString();
          continue;
        }
        if (sinceForTable) {
          query = `SELECT *, updated_at::text AS __wm FROM "${config.tableName}" WHERE "${vesselCol}" = $1 AND updated_at > $2 ORDER BY updated_at ASC LIMIT 5000`;
          params.push(scopeValue, sinceForTable);
        } else {
          query = `SELECT *, updated_at::text AS __wm FROM "${config.tableName}" WHERE "${vesselCol}" = $1 ORDER BY updated_at ASC LIMIT 5000`;
          params.push(scopeValue);
        }
      } else {
        // No vessel column and not global ⇒ this table can never be gathered for ANY
        // vessel. Nothing to deliver, so stamp it (same reasoning as the branch above).
        tableMax[config.tableName] = new Date().toISOString();
        continue;
      }

      const result = await pool.query(query, params);
      if (result.rows.length > 0) {
        // Rows are ORDER BY updated_at ASC, so the LAST row carries the max we are
        // actually delivering. Advancing to this (not to now) means a LIMIT-5000
        // truncation simply resumes next cycle instead of being skipped forever.
        //
        // 🔴 FULL PRECISION IS MANDATORY. Postgres timestamptz keeps MICROseconds; the pg
        // driver parses it into a JS Date, which keeps only MILLIseconds. Round-tripping
        // through Date truncates 32.327456Z to 32.327Z — a watermark EARLIER than the row
        // it just delivered — so `updated_at > wm` returns that row again on every cycle,
        // forever. Harness caught exactly this: 12009 rows delivered from a 12000-row
        // table, one boundary row looping. `updated_at::text` keeps the raw value.
        const last = result.rows[result.rows.length - 1];
        if (last?.__wm) tableMax[config.tableName] = String(last.__wm);
        // Strip the helper column so it never reaches the ship's applier as an
        // unknown column (SELECT * rows are inserted verbatim there).
        for (const r of result.rows) delete r.__wm;
        results.push({ tableName: config.tableName, rows: result.rows });
      } else {
        // Queried and found nothing: fully caught up as of the moment we asked, so it may
        // safely advance — including on a first sync with no prior watermark. We ASKED
        // and the answer was "no rows"; that is knowledge, not an absence of it.
        tableMax[config.tableName] = new Date().toISOString();
      }
    } catch (err: any) {
      // Best-effort: skip tables that don't exist yet or have schema issues.
      // NOTE: a table that throws records NO tableMax, so its watermark is not advanced
      // — a schema error can never step the checkpoint over rows it failed to read.
      console.warn(`[Sync Pull] Skipping one-way table ${config.tableName}: ${err.message}`);
    }
  }

  return { batches: results, tableMax };
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

  // A vessel accumulates MANY sync_metadata rows over its life (the shore's own instance +
  // every ship instance_id it has ever used — the instance-id-orphaning issue). The badge/
  // "x ago" must read the CURRENT (freshest) stamp, not an orphaned/never-synced row. So:
  // DISTINCT ON (v.vuuid) ... ORDER BY sm.last_sync_at DESC NULLS LAST picks exactly the most
  // recently-synced sync_metadata row per vessel (a NULL is chosen only if ALL rows are NULL →
  // genuinely "Never Synced"). fl/sc/fq are per-vessel aggregates (one row each), so they don't
  // fan out and are unaffected by the pick. The outer query re-sorts to the display order
  // (most stale first). Collapsing to one row per vessel also removes duplicate vessel lines.
  const result = await pool.query(`
    SELECT * FROM (
      SELECT DISTINCT ON (v.vuuid)
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
      ORDER BY v.vuuid, sm.last_sync_at DESC NULLS LAST
    ) t
    ORDER BY t.last_sync_at ASC NULLS FIRST
  `);

  return result.rows;
}
