/**
 * Sync Engine — Orchestrates a complete ship-shore sync cycle.
 *
 * Flow:
 * 1. INITIATE — Create sync batch, register with shore
 * 2. PUSH — Send local changes to shore
 *    a. Gather SHIP_ONLY table rows changed since last checkpoint
 *    b. Gather BOTH_EDITABLE field logs (is_synced = false)
 *    c. POST /sync/push with gathered data
 * 3. PULL — Request shore's changes
 *    a. POST /sync/pull
 *    b. Apply ONE_WAY_SHORE_TO_SHIP rows (overwrite local)
 *    c. Apply BOTH_EDITABLE field logs (merge)
 *    d. Queue conflicts for resolution
 * 4. COMPLETE — Advance checkpoint, mark batch done
 *
 * The engine handles:
 * - Chunked transfer (split large payloads into manageable chunks)
 * - Retry with backoff on network failure
 * - Partial sync recovery (resume from last successful chunk)
 * - Checkpoint management (only advance on full success)
 * - Local mode for development (calls service functions directly)
 */

import * as syncRepo from './repository';
import { applyOneWayRows, getColumnMeta, applyFieldLogInserts } from './oneWayApplier';
import { FileSyncProcessor } from './fileSyncProcessor';
import {
  getTablesByCategory,
  getTableSyncConfig,
} from '../../../shared/syncConfig';
import { getPool } from '../../db';
import { syncDiag } from './syncDiagLogger';

// ── Configuration ──

const CHUNK_SIZE = 200;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000]; // Exponential backoff (ms)
const REQUEST_TIMEOUT = 30000;

// ── Types ──

export interface SyncResult {
  success: boolean;
  batchUuid: string | null;
  recordsPushed: number;
  recordsPulled: number;
  conflictsFound: number;
  conflictsAutoResolved: number;
  filesQueued: number;
  durationMs: number;
  error: string | null;
  newCheckpoint: string | null;
}

// ── Engine ──

export class SyncEngine {
  private instanceId: string;
  private shoreBaseUrl: string;
  private syncApiKey: string;
  private settingsLoaded: boolean = false;

  constructor() {
    this.instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    this.shoreBaseUrl = process.env.SYNC_SHORE_URL || '';
    this.syncApiKey = process.env.SYNC_API_KEY || '';
  }

  /** Load settings from DB (with env var fallback). Called once per sync cycle. */
  async loadSettings(): Promise<void> {
    if (this.settingsLoaded) return;

    try {
      const settings = await syncRepo.getAllSettings();

      this.instanceId = settings['instance_id'] || process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
      this.shoreBaseUrl = settings['shore_url'] || process.env.SYNC_SHORE_URL || '';
      this.syncApiKey = process.env.SYNC_API_KEY || '';

      this.settingsLoaded = true;
      console.log(`[SyncEngine] Settings loaded from DB — instanceId=${this.instanceId}, shoreUrl=${this.shoreBaseUrl || '(empty)'}, localMode=${this.isLocalMode()}`);
    } catch (error) {
      // DB might not be ready — fall back to env vars (already set in constructor)
      console.warn('[SyncEngine] Could not load DB settings, using env vars:', error);
    }
  }

  /** Force reload on next sync cycle (called when settings are updated via API) */
  reloadSettings(): void {
    this.settingsLoaded = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER — Resolve vessel UUID → vessel_code (cached)
  // ═══════════════════════════════════════════════════════════════
  private vesselCodeCache = new Map<string, string | null>();

  private async getVesselCode(vesselId: string): Promise<string | null> {
    if (this.vesselCodeCache.has(vesselId)) return this.vesselCodeCache.get(vesselId)!;
    try {
      const pool = await getPool();
      const result = await pool.query(
        `SELECT vessel_code FROM vessels WHERE vuuid = $1 LIMIT 1`,
        [vesselId]
      );
      const code = result.rows[0]?.vessel_code || null;
      this.vesselCodeCache.set(vesselId, code);
      return code;
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC — Run a complete sync cycle
  // ═══════════════════════════════════════════════════════════════

  async runSync(vesselId: string): Promise<SyncResult> {
    await this.loadSettings();

    const startTime = Date.now();
    let batchUuid: string | null = null;
    let recordsPushed = 0;
    let recordsPulled = 0;
    let conflictsFound = 0;
    let conflictsAutoResolved = 0;

    try {
      syncDiag(`=== SYNC START === vessel=${vesselId}, instance=${this.instanceId}, mode=${this.isLocalMode() ? 'LOCAL' : 'REMOTE'}`);
      console.log(`[SyncEngine] Starting sync for vessel ${vesselId} from instance ${this.instanceId}`);

      // Step 1: INITIATE
      const metadata = await syncRepo.getInstanceMetadata(this.instanceId);
      const lastCheckpoint = metadata?.lastSyncCheckpoint || null;

      const initResult = await this.callSyncApi('POST', '/sync/initiate', {
        instanceId: this.instanceId,
        vesselId,
        lastCheckpoint: lastCheckpoint ? lastCheckpoint.toISOString() : null,
      });
      batchUuid = initResult.batchUuid;
      console.log(`[SyncEngine] Batch initiated: ${batchUuid}`);

      // Create local batch row so error persistence works on ship.
      // In remote mode the batch was created on SHORE's DB — the ship has no row,
      // so updateBatch() would fail with "Batch not found". ON CONFLICT handles
      // local mode where initiateSyncSession already created the row.
      try {
        const localPool = await getPool();
        await localPool.query(
          `INSERT INTO sync_batches (batch_uuid, initiated_by_instance, vessel_id, checkpoint_before, status)
           VALUES ($1, $2, $3, $4, 'in_progress')
           ON CONFLICT (batch_uuid) DO NOTHING`,
          [batchUuid, this.instanceId, vesselId, lastCheckpoint]
        );
      } catch (localBatchErr: any) {
        console.warn(`[SyncEngine] Could not create local batch row: ${localBatchErr.message}`);
      }

      // Step 2: PUSH — Send local changes to shore
      const pushResult = await this.executePush(batchUuid!, vesselId, lastCheckpoint);
      recordsPushed = pushResult.totalPushed;
      const pushedLogUuids = pushResult.pushedLogUuids;
      console.log(`[SyncEngine] Pushed ${recordsPushed} records (${pushedLogUuids.length} field logs)`);

      // Step 3: PULL — Get shore's changes
      const pullResult = await this.executePull(batchUuid!, vesselId, lastCheckpoint);
      recordsPulled = pullResult.totalPulled;
      conflictsFound = pullResult.conflictsFound;
      conflictsAutoResolved = pullResult.conflictsAutoResolved;
      const pullErrors = pullResult.errors;
      console.log(`[SyncEngine] Pulled ${recordsPulled} records, ${conflictsFound} conflicts`);
      if (pullResult.totalApplyErrors > 0) {
        console.warn(`[SyncEngine] ${pullResult.totalApplyErrors} apply errors during pull`);
      }

      // Step 4: COMPLETE — Advance checkpoint
      const completeResult = await this.callSyncApi('POST', '/sync/complete', {
        batchUuid,
        vesselId,
        instanceId: this.instanceId,
      });
      console.log(`[SyncEngine] Sync completed. Checkpoint: ${completeResult.newCheckpoint}`);

      syncDiag(`SYNC COMPLETE: checkpoint=${completeResult.newCheckpoint}`);

      // Step 4b: Mark local field logs as synced.
      // In remote mode, completeSyncSession marks logs in SHORE's DB but the ship's
      // local DB still has them as is_synced=false. Without this step, the same logs
      // would be re-pushed on the next sync cycle, overwriting newer shore values.
      if (pushedLogUuids.length > 0) {
        try {
          await syncRepo.markFieldLogsSynced(pushedLogUuids, batchUuid!);
          syncDiag(`PUSH DONE: marked ${pushedLogUuids.length} field logs as synced locally`);
          console.log(`[SyncEngine] Marked ${pushedLogUuids.length} local field logs as synced`);
        } catch (markErr: any) {
          // Non-fatal: worst case, logs will be re-pushed next cycle (duplicate but not data loss)
          console.warn(`[SyncEngine] Failed to mark local logs as synced: ${markErr.message}`);
        }
      }

      // Step 5: Process file queue (after field data is synced)
      let filesProcessedCount = 0;
      let filesFailedCount = 0;
      try {
        const fileProcessor = new FileSyncProcessor(this.shoreBaseUrl);
        const fileResult = await fileProcessor.processQueue(vesselId, batchUuid!);
        filesProcessedCount = fileResult.filesProcessed;
        filesFailedCount = fileResult.filesFailed;
        console.log(
          `[SyncEngine] Files: ${fileResult.filesProcessed} processed, ${fileResult.filesFailed} failed, ${fileResult.bytesTransferred} bytes`
        );
      } catch (fileError: any) {
        console.warn(`[SyncEngine] File sync failed (non-fatal): ${fileError.message}`);
        // File sync failure is non-fatal — field data is already synced
      }

      // Step 6: Store apply errors in batch record (if any)
      const errorMessage = pullErrors.length > 0
        ? pullErrors.join('\n')
        : null;
      if (errorMessage && batchUuid) {
        try {
          await syncRepo.updateBatch(batchUuid, { errorMessage });
        } catch (updateErr: any) {
          console.warn(`[SyncEngine] Failed to store errors in batch: ${updateErr.message}`);
        }
      }

      const durationMs = Date.now() - startTime;
      syncDiag(`=== SYNC END === vessel=${vesselId}, duration=${durationMs}ms, status=success, pushed=${recordsPushed}, pulled=${recordsPulled}, conflicts=${conflictsFound}, files=${filesProcessedCount}+${filesFailedCount}`);
      return {
        success: true,
        batchUuid,
        recordsPushed,
        recordsPulled,
        conflictsFound,
        conflictsAutoResolved,
        filesQueued: filesProcessedCount + filesFailedCount,
        durationMs,
        error: errorMessage,
        newCheckpoint: completeResult.newCheckpoint,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      syncDiag(`=== SYNC END === vessel=${vesselId}, duration=${durationMs}ms, status=FAILED, error=${error.message}`);
      console.error(`[SyncEngine] Sync failed for vessel ${vesselId}:`, error.message);

      // Mark batch as failed if it was created
      if (batchUuid) {
        try {
          await syncRepo.updateBatch(batchUuid, {
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date(),
            durationMs,
          });
        } catch (updateError) {
          console.error('[SyncEngine] Failed to update batch status:', updateError);
        }
      }

      return {
        success: false,
        batchUuid,
        recordsPushed,
        recordsPulled,
        conflictsFound,
        conflictsAutoResolved,
        filesQueued: 0,
        durationMs,
        error: error.message,
        newCheckpoint: null,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUSH — Gather and send local changes
  // ═══════════════════════════════════════════════════════════════

  private async executePush(
    batchUuid: string,
    vesselId: string,
    lastCheckpoint: Date | null
  ): Promise<{ totalPushed: number; pushedLogUuids: string[] }> {
    let totalPushed = 0;

    // A. Gather SHIP_ONLY rows changed since checkpoint (only from ship instances)
    const shipOnlyRows: Array<{ tableName: string; rows: any[] }> = [];
    if (this.instanceId.toUpperCase().startsWith('SHIP')) {
      const shipOnlyTables = getTablesByCategory('SHIP_ONLY');
      for (const tableConfig of shipOnlyTables) {
        try {
          const rows = await this.getChangedRows(tableConfig.tableName, vesselId, lastCheckpoint, tableConfig.vesselScopeColumn);
          if (rows.length > 0) {
            shipOnlyRows.push({ tableName: tableConfig.tableName, rows });
          }
        } catch (err: any) {
          // Best-effort: skip tables that don't exist locally
          console.warn(`[SyncEngine] Skipping SHIP_ONLY table ${tableConfig.tableName}: ${err.message}`);
        }
      }
    }

    // B. Gather BOTH_EDITABLE field logs (unsynced, from this instance)
    //    Pass vesselCode so logs stored with vessel_code (for vessel_code-scoped tables) are also found
    const vesselCode = await this.getVesselCode(vesselId);
    syncDiag(`PUSH START: gathering field logs for vessel=${vesselId}, vesselCode=${vesselCode}`);
    const fieldLogs = await syncRepo.getUnsyncedFieldLogs(this.instanceId, vesselId, vesselCode);
    syncDiag(`PUSH: found ${fieldLogs.length} unsynced field logs`);
    // Table breakdown
    const pushTables: Record<string, number> = {};
    fieldLogs.forEach((l: any) => { pushTables[l.tableName ?? l.table_name] = (pushTables[l.tableName ?? l.table_name] || 0) + 1; });
    if (Object.keys(pushTables).length > 0) syncDiag(`PUSH table breakdown:`, pushTables);
    // Sample first 5 logs
    fieldLogs.slice(0, 5).forEach((l: any, i: number) => {
      const tbl = l.tableName ?? l.table_name;
      const fld = l.fieldName ?? l.field_name;
      const row = l.rowUuid ?? l.row_uuid;
      const nv = l.newValue ?? l.new_value;
      syncDiag(`PUSH sample[${i}]: table=${tbl}, field=${fld}, row=${row}, oldNull=${(l.oldValue ?? l.old_value) === null}, newValue=${nv ? String(nv).substring(0, 80) : 'NULL'}`);
    });
    // Capture logUuids so the caller can mark them as synced after COMPLETE succeeds
    const pushedLogUuids = fieldLogs.map(l => l.logUuid ?? (l as any).log_uuid);

    // C. Send in chunks
    //    Field logs may come from raw SQL (snake_case) or Drizzle (camelCase) — handle both
    const fieldLogPayloads = fieldLogs.map((log: any) => ({
      tableName: log.tableName ?? log.table_name,
      rowUuid: log.rowUuid ?? log.row_uuid,
      fieldName: log.fieldName ?? log.field_name,
      oldValue: log.oldValue ?? log.old_value,
      newValue: log.newValue ?? log.new_value,
      vesselId: log.vesselId ?? log.vessel_id,
      changedAt: (log.changedAt ?? log.changed_at) instanceof Date
        ? (log.changedAt ?? log.changed_at).toISOString()
        : String(log.changedAt ?? log.changed_at),
      changedByUserId: log.changedByUserId ?? log.changed_by_user_id,
      instanceId: log.instanceId ?? log.instance_id,
    }));

    if (fieldLogPayloads.length > 0 || shipOnlyRows.length > 0) {
      for (let i = 0; i < Math.max(fieldLogPayloads.length, 1); i += CHUNK_SIZE) {
        const chunk = fieldLogPayloads.slice(i, i + CHUNK_SIZE);
        const result = await this.callSyncApiWithRetry('POST', '/sync/push', {
          batchUuid,
          vesselId,
          oneWayRows: i === 0 ? shipOnlyRows : [], // One-way rows with first chunk only
          fieldLogs: chunk,
        });
        totalPushed += result.received || 0;
      }
    } else {
      // Empty push to register the push step
      await this.callSyncApiWithRetry('POST', '/sync/push', {
        batchUuid,
        vesselId,
        oneWayRows: [],
        fieldLogs: [],
      });
    }

    return { totalPushed, pushedLogUuids };
  }

  // ═══════════════════════════════════════════════════════════════
  // PULL — Get and apply remote changes
  // ═══════════════════════════════════════════════════════════════

  private async executePull(
    batchUuid: string,
    vesselId: string,
    lastCheckpoint: Date | null
  ): Promise<{
    totalPulled: number;
    totalApplyErrors: number;
    conflictsFound: number;
    conflictsAutoResolved: number;
    errors: string[];
  }> {
    let totalPulled = 0;
    let totalApplyErrors = 0;
    let conflictsFound = 0;
    let conflictsAutoResolved = 0;
    const allErrors: string[] = [];

    // A. Request remote changes
    const pullData = await this.callSyncApiWithRetry('POST', '/sync/pull', {
      batchUuid,
      vesselId,
      instanceId: this.instanceId,
      lastCheckpoint: lastCheckpoint ? lastCheckpoint.toISOString() : null,
    });

    // Diagnostic breakdown of pull data
    const pullOneWay: Record<string, number> = {};
    (pullData.oneWayRows || []).forEach((r: any) => { pullOneWay[r.tableName] = r.rows?.length || 0; });
    const pullFields: Record<string, number> = {};
    (pullData.fieldLogs || []).forEach((l: any) => { pullFields[l.tableName] = (pullFields[l.tableName] || 0) + 1; });
    syncDiag(`PULL RECEIVED: ${pullData.oneWayRows?.length || 0} one-way table batches, ${pullData.fieldLogs?.length || 0} field logs`);
    if (Object.keys(pullOneWay).length > 0) syncDiag(`PULL one-way tables:`, pullOneWay);
    if (Object.keys(pullFields).length > 0) syncDiag(`PULL field log tables:`, pullFields);

    // B. Apply ONE_WAY rows (remote is master, overwrite local)
    if (pullData.oneWayRows && pullData.oneWayRows.length > 0) {
      // Pre-cleanup: clear seeded RBAC/rank data so shore UUIDs import cleanly.
      // Same logic as provisioning (commit 0de153bc): ship migrations seed
      // roles/menus/ranks/permissions with auto-generated UUIDs that differ from
      // shore's UUIDs, causing cascading FK violations on upsert.
      const pulledTableNames = new Set(
        pullData.oneWayRows.map((t: any) => t.tableName)
      );
      const pool = await getPool();

      if (
        pulledTableNames.has('admn_role_master') ||
        pulledTableNames.has('adm_menumaster_ac') ||
        pulledTableNames.has('adm_role_menu_access')
      ) {
        try {
          console.log('[SyncEngine] Clearing seeded RBAC data before sync apply...');
          await pool.query('DELETE FROM adm_role_menu_access');
          await pool.query('DELETE FROM adm_menumaster_ac WHERE parent_menu IS NOT NULL');
          await pool.query('DELETE FROM adm_menumaster_ac');
          await pool.query('DELETE FROM admn_role_master');
          syncDiag(`PULL: RBAC cleanup done`);
          console.log('[SyncEngine] RBAC cleanup complete');
        } catch (cleanupErr: any) {
          syncDiag(`PULL: RBAC cleanup FAILED: ${cleanupErr.message}`);
          console.error(`[SyncEngine] RBAC cleanup failed: ${cleanupErr.message}`);
        }
      }

      if (pulledTableNames.has('adm_available_ranks')) {
        try {
          console.log('[SyncEngine] Clearing seeded ranks data before sync apply...');
          await pool.query('DELETE FROM adm_vessel_org_chart');
          await pool.query('DELETE FROM vessel_org_chart_nodes');
          await pool.query('DELETE FROM adm_available_ranks');
          syncDiag(`PULL: Ranks cleanup done`);
          console.log('[SyncEngine] Ranks cleanup complete');
        } catch (cleanupErr: any) {
          syncDiag(`PULL: Ranks cleanup FAILED: ${cleanupErr.message}`);
          console.warn(`[SyncEngine] Ranks cleanup partial: ${cleanupErr.message}`);
        }
      }

      for (const tableData of pullData.oneWayRows) {
        try {
          const result = await applyOneWayRows(tableData.tableName, tableData.rows);
          syncDiag(`PULL ONE-WAY: ${tableData.tableName} — inserted=${result.inserted}, updated=${result.updated}, deleted=${result.softDeleted}, errors=${result.errors.length}`);
          totalPulled += result.inserted + result.updated + result.softDeleted;
          totalApplyErrors += result.errors.length;
          if (result.errors.length > 0) {
            result.errors.slice(0, 3).forEach((e) => syncDiag(`PULL ONE-WAY ERROR: ${tableData.tableName}[${e.rowIndex}]: ${String(e.error).substring(0, 150)}`));
            // Collect first 5 error details for batch record
            const errorSamples = result.errors.slice(0, 5).map(
              (e) => `${tableData.tableName}[${e.rowIndex}]: ${e.error}`
            );
            if (result.errors.length > 5) {
              errorSamples.push(`... and ${result.errors.length - 5} more`);
            }
            allErrors.push(...errorSamples);
          }
        } catch (err: any) {
          syncDiag(`PULL ONE-WAY EXCEPTION: ${tableData.tableName}: ${err.message.substring(0, 150)}`);
          console.error(`[SyncEngine] Failed to apply one-way rows for ${tableData.tableName}:`, err.message);
          allErrors.push(`${tableData.tableName}: ${err.message}`);
        }
      }
    }

    // C. Apply BOTH_EDITABLE field logs (INSERT new rows + UPDATE existing fields)
    //    Wrapped in a transaction with SET LOCAL sync.bypass_trigger = 'true' so the
    //    set_updated_at() BEFORE UPDATE trigger preserves the supplied log.changedAt.
    if (pullData.fieldLogs && pullData.fieldLogs.length > 0) {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL sync.bypass_trigger = 'true'`);
        syncDiag(`SYNC-APPLY TRIGGER BYPASS active for pull`);

        // Phase 1: Detect INSERT groups (all oldValue=null) and insert new rows
        const insertResult = await applyFieldLogInserts(pullData.fieldLogs, client);
        syncDiag(`PULL FIELD-LOG INSERT: inserted=${insertResult.insertedRows}, updateRemaining=${insertResult.updateLogs.length}, errors=${insertResult.errors.length}`);
        if (insertResult.errors.length > 0) {
          insertResult.errors.slice(0, 5).forEach((e: string) => syncDiag(`PULL INSERT ERROR: ${e.substring(0, 150)}`));
        }
        totalPulled += insertResult.insertedRows;
        if (insertResult.errors.length > 0) {
          totalApplyErrors += insertResult.errors.length;
          allErrors.push(...insertResult.errors);
        }

        // Phase 2: Apply remaining UPDATE field logs (non-INSERT groups + existing rows)
        let updateApplied = 0;
        let updateErrors = 0;
        for (const log of insertResult.updateLogs) {
          try {
            await this.applyFieldLog(log, client);
            totalPulled++;
            updateApplied++;
          } catch (err: any) {
            totalApplyErrors++;
            updateErrors++;
            allErrors.push(`${log.tableName}.${log.fieldName}: ${err.message}`);
            console.error(`[SyncEngine] Failed to apply field log ${log.tableName}.${log.fieldName}:`, err.message);
          }
        }
        syncDiag(`PULL FIELD-LOG UPDATE: total=${insertResult.updateLogs.length}, applied=${updateApplied}, errors=${updateErrors}`);

        await client.query('COMMIT');
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        console.error(`[SyncEngine] Transaction error during pull field log apply: ${txErr.message}`);
        throw txErr;
      } finally {
        client.release();
      }
    }

    // D. Handle conflicts
    if (pullData.conflicts && pullData.conflicts.length > 0) {
      conflictsFound = pullData.conflicts.length;
      for (const conflict of pullData.conflicts) {
        // Auto-resolve if both sides changed to the same value
        if (conflict.shipValue === conflict.shoreValue) {
          try {
            await syncRepo.resolveConflict(
              conflict.conflictUuid,
              'auto_same_value',
              conflict.shoreValue,
              'sync_engine'
            );
            conflictsAutoResolved++;
          } catch (err: any) {
            console.error(`[SyncEngine] Failed to auto-resolve conflict ${conflict.conflictUuid}:`, err.message);
          }
        }
        // Different values → leave for manual resolution
      }
      if (conflictsFound > 0) {
        console.log(`[SyncEngine] ${conflictsFound} conflicts, ${conflictsAutoResolved} auto-resolved`);
      }
    }

    return { totalPulled, totalApplyErrors, conflictsFound, conflictsAutoResolved, errors: allErrors };
  }

  // ═══════════════════════════════════════════════════════════════
  // FIELD LOG APPLIER — Merge a single field change into local DB
  // ═══════════════════════════════════════════════════════════════

  private async applyFieldLog(
    log: {
      tableName: string;
      rowUuid: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      changedAt?: string | Date;
      changedByUserId?: string | null;
      instanceId?: string;
    },
    /** Optional pg client to reuse (for transactional SET LOCAL sync.bypass_trigger) */
    client?: { query: (text: string, values?: any[]) => Promise<any> }
  ): Promise<void> {
    const config = getTableSyncConfig(log.tableName);
    if (!config) {
      console.warn(`[SyncEngine] Unknown table in field log: ${log.tableName}`);
      return;
    }

    // Business rule enforcement
    if (config.businessRules && log.tableName === 'defects' && log.fieldName === 'status') {
      if (log.newValue === 'verified' && !this.instanceId.toUpperCase().startsWith('SHIP')) {
        // Shore receiving ship's verification — reject
        console.warn(`[SyncEngine] Business rule: ship cannot verify defects. Skipping.`);
        return;
      }
    }

    const identityCol = config.identityColumn || 'id';
    const fieldNameSnake = camelToSnake(log.fieldName);

    const conn = client || await getPool();

    // JSON coercion: if the column is json/jsonb, ensure the value is valid JSON.
    // The field logger stores JSON values as JSON strings (e.g., '[{"spareId":"abc"}]').
    // For json/jsonb columns, we must pass a parsed object so pg serializes it correctly,
    // OR pass the raw JSON string which pg accepts directly for json/jsonb types.
    const meta = await getColumnMeta(conn, log.tableName);
    let valueToApply: any = log.newValue;
    if (valueToApply !== null && meta.jsonCols.has(fieldNameSnake)) {
      try {
        // Parse to validate it's proper JSON, then pass the string as-is
        // (pg accepts JSON strings directly for json/jsonb columns)
        JSON.parse(valueToApply);
        // valueToApply is already a valid JSON string — pass as-is
      } catch {
        // Not valid JSON (corrupted legacy value like "[object Object]") — reset to empty
        valueToApply = '[]';
      }
    }

    // Use the log's changedAt for updated_at — trigger bypass ensures it sticks.
    const logTs = log.changedAt instanceof Date ? log.changedAt : new Date(String(log.changedAt));
    // Let errors bubble up to the caller for proper counting (Defect D fix)
    await conn.query(
      `UPDATE "${log.tableName}" SET "${fieldNameSnake}" = $1, "updated_at" = $3 WHERE "${identityCol}" = $2`,
      [valueToApply, log.rowUuid, logTs]
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DELTA EXTRACTION — Get rows changed since checkpoint
  // ═══════════════════════════════════════════════════════════════

  private async getChangedRows(
    tableName: string,
    vesselId: string,
    since: Date | null,
    vesselScopeColumn: string | null
  ): Promise<any[]> {
    const pool = await getPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (since) {
      conditions.push(`"updated_at" > $${paramIdx}`);
      params.push(since);
      paramIdx++;
    }

    if (vesselScopeColumn && vesselId) {
      conditions.push(`"${vesselScopeColumn}" = $${paramIdx}`);
      params.push(vesselId);
      paramIdx++;
    }

    let query = `SELECT * FROM "${tableName}"`;
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY "updated_at" ASC LIMIT 5000';

    const result = await pool.query(query, params);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════
  // SYNC API CALLER — HTTP or local direct call
  // ═══════════════════════════════════════════════════════════════

  private async callSyncApi(method: string, path: string, body: any): Promise<any> {
    // Local mode: call service functions directly (dev/test)
    if (this.isLocalMode()) {
      return this.callLocalSync(path, body);
    }

    // Production: HTTP call to remote server
    const url = `${this.shoreBaseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Api-Key': this.syncApiKey,
        'X-Sync-Instance-Id': this.instanceId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync API ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /** Local mode — call service functions directly (no HTTP) */
  private async callLocalSync(path: string, body: any): Promise<any> {
    const svc = await import('./service');

    switch (path) {
      case '/sync/initiate':
        return svc.initiateSyncSession(
          body.instanceId,
          body.vesselId,
          body.lastCheckpoint ? new Date(body.lastCheckpoint) : null
        );
      case '/sync/push':
        return svc.receivePushData(body.batchUuid, body.vesselId, body);
      case '/sync/pull':
        return svc.preparePullData(
          body.batchUuid,
          body.vesselId,
          body.instanceId,
          body.lastCheckpoint ? new Date(body.lastCheckpoint) : null
        );
      case '/sync/complete':
        return svc.completeSyncSession(body.batchUuid, body.vesselId, body.instanceId);
      default:
        throw new Error(`Unknown sync path: ${path}`);
    }
  }

  /** Retry wrapper with exponential backoff */
  private async callSyncApiWithRetry(method: string, path: string, body: any): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callSyncApi(method, path, body);
      } catch (error: any) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          console.warn(
            `[SyncEngine] Attempt ${attempt + 1} failed for ${path}: ${error.message}. ` +
            `Retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed after ${MAX_RETRIES + 1} attempts`);
  }

  /** Check if running in local mode (no HTTP, direct function calls) */
  private isLocalMode(): boolean {
    return (
      process.env.SYNC_LOCAL_MODE === 'true' ||
      !this.shoreBaseUrl ||
      this.shoreBaseUrl === ''
    );
  }

  /** Get current instance ID (for use by controllers) */
  getInstanceId(): string {
    return this.instanceId;
  }
}

// ── Singleton ──

let engineInstance: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!engineInstance) {
    engineInstance = new SyncEngine();
  }
  return engineInstance;
}

// ── Helpers ──

function camelToSnake(str: string): string {
  // Handle consecutive uppercase (acronyms) correctly:
  // timestampUTC → timestamp_utc, previousRH → previous_rh, completionRHValidated → completion_rh_validated
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}
