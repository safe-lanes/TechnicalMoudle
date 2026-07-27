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
import { applyOneWayRows, getColumnMeta, applyFieldLogInserts, applyFullRowsIfAbsent, gatherFullRows, SYNC_COLUMN_ALIASES, coerceArrayValue, evaluateInsertOriginGuard, evaluateStaleSkipGuard } from './oneWayApplier';
import { FileSyncProcessor, DEFAULT_FILE_DRAIN_MAX_BYTES } from './fileSyncProcessor';
import {
  getTablesByCategory,
  getTableSyncConfig,
} from '../../../shared/syncConfig';
import { getPool } from '../../db';
import { syncDiag } from './syncDiagLogger';
import { isShipInstanceId } from './syncRole';

// ── Configuration ──

const CHUNK_SIZE = 200;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000]; // Exponential backoff (ms)
// Tunable sync limits. Phase 4a moved these from module consts to per-instance
// fields resolved DB-then-env in loadSettings() (mirroring instance_id/shore_url),
// so a provisioned ship can carry per-vessel values. Defaults preserve the prior
// hardcoded behavior EXACTLY: no DB row + no env ⇒ 30000 / 1000, byte-identical.
const DEFAULT_REQUEST_TIMEOUT_MS = 30000; // A2: per /sync/push attempt
// VSAT-safe FLOOR for the per-push request timeout. No source (DB, env, provisioning bundle, or
// the hardcoded default) may drive the effective timeout below this — a shorter value aborts
// pushes the shore has already applied → false failures → dead-letter data loss (the Frontier
// Venture 2026-07-23 incident, caused by env=1200). Enforced at runtime (loadSettings clamp) and
// at provisioning (seed clamp). 60s standard, uniform across the fleet.
export const SYNC_REQUEST_TIMEOUT_FLOOR_MS = 60000;
const DEFAULT_PUSH_BATCH_SIZE = 1000;     // A1: field-log rows per push
// B-P0.2: overall budget for the file-transfer phase so a slow/stuck file can never
// hang the sync cycle. Healthy file syncs finish in seconds and are unaffected; only
// a runaway phase is cut (files remain pending/resumable). 0 / unset ⇒ default below.
const FILE_PHASE_MAX_MS = parseInt(process.env.SYNC_FILE_PHASE_MAX_MS || '', 10) || 120000;
// Drain-to-zero (manual "Sync Now"): repeat whole cycles until push+pull backlogs are 0 or a
// safety stop fires. Cap = sync_settings.catch_up_max_cycles (same as the auto-scheduler); time
// budget bounds one press so a huge historical backlog drains a chunk without hanging the button.
const DEFAULT_DRAIN_MAX_CYCLES = 20;
const SYNC_DRAIN_MAX_MS = parseInt(process.env.SYNC_DRAIN_MAX_MS || '', 10) || 60000;

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
  remainingPush: number | null;   // ship is_synced=false for this instance/vessel after the cycle
  remainingPull: number | null;   // shore is_synced=false for this vessel (instance != ship)
  remainingFilePull: number | null; // shore→ship pending files <= size gate after the cycle
}

// ── Engine ──

export class SyncEngine {
  private instanceId: string;
  private shoreBaseUrl: string;
  private syncApiKey: string;
  // Phase 4a: per-instance tunables, resolved DB-then-env in loadSettings().
  // Seeded from env (or hardcoded default) in the constructor so they are valid
  // even before loadSettings runs — default-preserving.
  private requestTimeoutMs: number;
  private pushBatchSize: number;
  private catchUpMaxCycles: number = DEFAULT_DRAIN_MAX_CYCLES;
  private fileDrainMaxBytes: number = DEFAULT_FILE_DRAIN_MAX_BYTES;
  private settingsLoaded: boolean = false;
  /** Where the effective shore_url came from — surfaced in the startup log. */
  private shoreUrlSource: 'DB' | 'env' | 'none' = 'none';
  /** Non-null when the resolved config cannot support a REMOTE sync; runSync() rejects. */
  private configFatal: string | null = null;
  // Shared re-entrancy guard (backend safety net): one drain/sync per vessel at a time across
  // BOTH the manual "Sync Now" drain and the auto-scheduler tick. Released in try/finally so a
  // thrown/failed cycle always clears it — a stuck guard would block all future syncs.
  private inFlight = new Set<string>();
  // REMOVED in migration 147: `droppedRetryCount` was an in-memory Map counting consecutive shore
  // drops, used to dead-letter a row (mark it is_synced=true) after 3 tries. Two defects: it gave
  // up on undelivered data — the Frontier Venture 71 — and being in-memory it reset on every PM2
  // restart, so the count reflected process uptime rather than delivery history. Both are now the
  // persisted sync_field_log.sync_attempts column plus the backoff ladder, which never gives up.
  // Self-heal: full-row requests the SHORE returned from our pushes (needsFullRows). Drained
  // into the next push's fullRows payload. In-memory by design — if lost (restart), the same
  // fragments re-fail on shore and the request regenerates. Map<tableName, Set<rowUuid>>.
  private pendingFullRowRequests = new Map<string, Set<string>>();
  // Pull-side FILE dead-letter counter (files only — field-log delivery no longer dead-letters at
  // file queueUuid. In-memory on the singleton engine so it persists across cycles within a run.
  private filePullRetryCount = new Map<string, number>();

  constructor() {
    this.instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    this.shoreBaseUrl = process.env.SYNC_SHORE_URL || '';
    this.syncApiKey = process.env.SYNC_API_KEY || '';
    this.requestTimeoutMs = parseInt(process.env.SYNC_REQUEST_TIMEOUT_MS || '', 10) || DEFAULT_REQUEST_TIMEOUT_MS;
    this.pushBatchSize = parseInt(process.env.SYNC_PUSH_BATCH_SIZE || '', 10) || DEFAULT_PUSH_BATCH_SIZE;
  }

  /** Load settings from DB (with env var fallback). Called once per sync cycle. */
  async loadSettings(): Promise<void> {
    if (this.settingsLoaded) return;

    try {
      const settings = await syncRepo.getAllSettings();

      this.instanceId = settings['instance_id'] || process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
      // ── shore_url: resolve DB → env, then SELF-HEAL and GUARD ──────────────────────
      // Frontier Venture carried a BLANK shore_url in sync_settings and worked only because
      // SYNC_SHORE_URL happened to be set in the ship's .env. Lose that env var and
      // isLocalMode() flips true, the ship stops talking to shore, and NOTHING reports an
      // error — it just silently no-ops forever. That is the landmine this closes.
      const dbShoreUrl = (settings['shore_url'] || '').trim();
      const envShoreUrl = (process.env.SYNC_SHORE_URL || '').trim();
      this.shoreBaseUrl = dbShoreUrl || envShoreUrl;
      this.shoreUrlSource = dbShoreUrl ? 'DB' : (envShoreUrl ? 'env' : 'none');
      // Phase 4b: per-tenant key from sync_settings (seeded at provisioning),
      // env fallback so legacy/unseeded ships behave exactly as today.
      this.syncApiKey = settings['sync_api_key'] || process.env.SYNC_API_KEY || '';

      // Phase 4a: DB-then-env-then-default. Empty/invalid DB value ⇒ env ⇒ hardcoded
      // default (1000 / 30000) — identical to today when the new keys are unseeded.
      const dbBatch = parseInt(settings['sync_push_batch_size'] || '', 10);
      this.pushBatchSize = dbBatch || parseInt(process.env.SYNC_PUSH_BATCH_SIZE || '', 10) || DEFAULT_PUSH_BATCH_SIZE;
      const dbTimeout = parseInt(settings['sync_request_timeout_ms'] || '', 10);
      const envTimeout = parseInt(process.env.SYNC_REQUEST_TIMEOUT_MS || '', 10);
      const resolvedTimeout = dbTimeout || envTimeout || DEFAULT_REQUEST_TIMEOUT_MS;
      // Source of the effective timeout — surfaced in the startup log so a bad value
      // (e.g. the env=1200 that caused the Frontier Venture outage) is visible immediately.
      const timeoutSource = dbTimeout ? 'DB' : (envTimeout ? 'env' : 'default');
      // RUNTIME FLOOR (belt-and-suspenders): clamp so NO source — a hand-set low DB value, a low
      // env, or the hardcoded default — can ever drive the effective timeout below the VSAT floor.
      this.requestTimeoutMs = Math.max(resolvedTimeout, SYNC_REQUEST_TIMEOUT_FLOOR_MS);
      if (resolvedTimeout < SYNC_REQUEST_TIMEOUT_FLOOR_MS) {
        console.warn(`[SyncEngine] ⚠️ requestTimeoutMs=${resolvedTimeout} (${timeoutSource}) is below the ${SYNC_REQUEST_TIMEOUT_FLOOR_MS}ms VSAT floor — clamped to ${SYNC_REQUEST_TIMEOUT_FLOOR_MS}ms.`);
      }
      // Drain cap — same sync_settings key the auto-scheduler uses; default 20 when unseeded.
      const dbCatchUp = parseInt(settings['catch_up_max_cycles'] || '', 10);
      this.catchUpMaxCycles = dbCatchUp || DEFAULT_DRAIN_MAX_CYCLES;
      // Size gate for the file-pull drain (bytes) — DB → env → 10MB default.
      const dbFileMax = parseInt(settings['sync_file_drain_max_bytes'] || '', 10);
      this.fileDrainMaxBytes = dbFileMax || DEFAULT_FILE_DRAIN_MAX_BYTES;

      // SELF-HEAL: DB blank but env resolves → persist the env value so the DB becomes
      // authoritative as designed, converting a fleet-wide landmine into a one-time auto-fix.
      // Safe to persist: sync_settings is NOT in shared/syncConfig.ts — it never syncs, so this
      // value cannot propagate to another instance. seedSettingIfEmpty only writes when the row
      // is absent/empty, so a deliberate admin DB value is never overwritten by env.
      // TRADE-OFF, on the record: once persisted the DB WINS, so a wrong env value becomes
      // sticky and editing .env alone will no longer change behaviour. Hence the loud log.
      if (!dbShoreUrl && envShoreUrl) {
        try {
          await syncRepo.seedSettingIfEmpty('shore_url', envShoreUrl);
          console.warn(`[SyncEngine] 🩹 CONFIG SELF-HEAL: sync_settings.shore_url was EMPTY — persisted from env: "${envShoreUrl}". The DB value is authoritative from now on; change it there, not in .env.`);
          syncDiag(`CONFIG SELF-HEAL: shore_url seeded from env "${envShoreUrl}" (was empty in sync_settings)`);
        } catch (healErr: any) {
          console.error(`[SyncEngine] config self-heal for shore_url FAILED (non-fatal): ${healErr?.message || healErr}`);
        }
      }

      // GUARD: refuse to slide into local mode by ACCIDENT. Explicit SYNC_LOCAL_MODE=true is a
      // deliberate operator choice and stays allowed; an unresolvable shore_url is not.
      // Deliberately does NOT exit the process: a vessel losing its whole PMS because sync
      // config is wrong is worse than sync failing loudly. runSync() rejects instead, so the
      // failure is visible in SyncDiag and the Sync Health surface every cycle.
      this.configFatal = null;
      if (!this.shoreBaseUrl && process.env.SYNC_LOCAL_MODE !== 'true') {
        this.configFatal =
          'shore_url is EMPTY in sync_settings AND SYNC_SHORE_URL is unset, and SYNC_LOCAL_MODE is not explicitly "true". ' +
          'Refusing to run sync in silent local mode. Set sync_settings.shore_url (preferred) or SYNC_SHORE_URL.';
        console.error(`[SyncEngine] ❌ FATAL CONFIG: ${this.configFatal}`);
        syncDiag(`FATAL CONFIG: ${this.configFatal}`);
      }

      this.settingsLoaded = true;
      console.log(`[SyncEngine] Settings loaded from DB — instanceId=${this.instanceId}, shoreUrl=${this.shoreBaseUrl || '(EMPTY)'} (${this.shoreUrlSource}), localMode=${this.isLocalMode()}, requestTimeoutMs=${this.requestTimeoutMs} (${timeoutSource}), pushBatchSize=${this.pushBatchSize}`);
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
      // Config guard (item B): never enter local mode by accident — fail loudly, every cycle.
      if (this.configFatal) {
        syncDiag(`=== SYNC ABORTED (config) === vessel=${vesselId}: ${this.configFatal}`);
        throw new Error(`Sync configuration invalid — ${this.configFatal}`);
      }
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

      // Step 4: COMPLETE — Advance checkpoint. appliedRowUuids acks which pulled shore rows
      // this ship applied, so the shore marks only those is_synced=true (Option 2, pull-side).
      const completeResult = await this.callSyncApi('POST', '/sync/complete', {
        batchUuid,
        vesselId,
        instanceId: this.instanceId,
        appliedRowUuids: pullResult.appliedRowUuids,
        // One-way orphaning fix: tables whose one-way apply failed this cycle. The shore
        // holds the checkpoint at checkpointBefore when non-empty, so the failed window
        // is re-offered next sync (one-way applies are idempotent upserts).
        failedOneWayTables: pullResult.failedOneWayTables,
        // 148: echo the delivered maxima MINUS anything that failed, so the shore advances
        // only healthy tables. Omitted entirely when the shore never sent them (old shore).
        ...(Object.keys(pullResult.oneWayTableMax || {}).length > 0
          ? {
              appliedTableCheckpoints: Object.fromEntries(
                Object.entries(pullResult.oneWayTableMax).filter(
                  ([t]) => !pullResult.failedOneWayTables.includes(t)
                )
              ),
            }
          : {}),
      });
      console.log(`[SyncEngine] Sync completed. Checkpoint: ${completeResult.newCheckpoint}`);

      syncDiag(`SYNC COMPLETE: checkpoint=${completeResult.newCheckpoint}`);

      // Step 4a: Save new checkpoint LOCALLY.
      // In remote mode, completeSyncSession updates SHORE's sync_metadata — but the
      // ship reads its checkpoint from its OWN local DB. Without this step, the ship's
      // checkpoint never advances, causing shore to re-send all one-way rows since the
      // original checkpoint on every sync cycle (massive bandwidth waste).
      if (!this.isLocalMode()) {
        try {
          await syncRepo.upsertInstanceMetadata({
            instanceId: this.instanceId,
            vesselId,
            // newCheckpoint can be null when the shore held the watermark back (failed
            // one-way tables, or a held-back first sync) — save null, never new Date(null).
            lastSyncCheckpoint: completeResult.newCheckpoint ? new Date(completeResult.newCheckpoint) : null,
            lastSyncStatus: 'success',
            lastSyncAt: new Date(),
          });
          // 148: persist the per-table watermarks the shore returned. Presence-gated —
          // an OLD shore omits the key, we write nothing, and the single checkpoint above
          // remains the only watermark (byte-identical to pre-148).
          if (Object.prototype.hasOwnProperty.call(completeResult, 'newTableCheckpoints')) {
            const n = await syncRepo.setTableCheckpoints(
              this.instanceId, completeResult.newTableCheckpoints || {}
            );
            syncDiag(`PER-TABLE CHECKPOINTS SAVED LOCALLY: ${n} advanced`);
          }
          syncDiag(`CHECKPOINT SAVED LOCALLY: ${completeResult.newCheckpoint}`);
        } catch (cpErr: any) {
          // Non-fatal: checkpoint stuck means re-sending data but no data loss
          syncDiag(`CHECKPOINT LOCAL SAVE FAILED: ${cpErr.message}`);
          console.warn(`[SyncEngine] Failed to save local checkpoint: ${cpErr.message}`);
        }
      }

      // Step 4b: Mark local field logs as synced.
      // In remote mode, completeSyncSession marks logs in SHORE's DB but the ship's
      // local DB still has them as is_synced=false. Without this step, the same logs
      // would be re-pushed on the next sync cycle, overwriting newer shore values.
      // IMPORTANT: Only SHIP instances mark their own logs as synced here. Shore's
      // field logs are marked synced later by completeSyncSession when the ship pulls them.
      const isShip = isShipInstanceId(this.instanceId);
      if (pushedLogUuids.length > 0 && isShip) {
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
      // Remaining <= size-gate office→ship files after this cycle — feeds the drain's 0-condition
      // so normal attachments fully arrive in one Sync Now (large files excluded, don't block).
      let remainingFilePull = 0;
      try {
        const fileProcessor = new FileSyncProcessor(this.shoreBaseUrl, this.instanceId, this.syncApiKey);
        // B-P0.2: bound the file phase so it cannot hang the cycle. processQueue returns
        // cleanly once the budget is exceeded (remaining files stay pending/resumable).
        // Field-data success is already independent of files (this block is non-fatal).
        const fileResult = await fileProcessor.processQueue(vesselId, batchUuid!, FILE_PHASE_MAX_MS);
        filesProcessedCount = fileResult.filesProcessed;
        filesFailedCount = fileResult.filesFailed;
        console.log(
          `[SyncEngine] Files (push): ${fileResult.filesProcessed} processed, ${fileResult.filesFailed} failed, ${fileResult.bytesTransferred} bytes`
        );

        // NEW — shore→ship PULL (ship-only), AFTER the existing push. Additive; the push path is
        // untouched. Reuses receiveChunk for reassembly/hash/save. Size-gated so one Sync Now
        // completes normal attachments while large files drain over cycles.
        const pullResult = await fileProcessor.pullQueue(vesselId, FILE_PHASE_MAX_MS, this.fileDrainMaxBytes, this.filePullRetryCount);
        filesProcessedCount += pullResult.filesProcessed;
        filesFailedCount += pullResult.filesFailed;
        remainingFilePull = pullResult.remainingSmall;
        console.log(
          `[SyncEngine] Files (pull): ${pullResult.filesProcessed} processed, ${pullResult.filesFailed} failed, ${pullResult.bytesTransferred} bytes, remainingSmall=${pullResult.remainingSmall}`
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
      // Remaining backlog after this cycle — drives the drain loop's stop condition.
      // Push: ship's own is_synced=false. Pull: shore-reported (from /sync/complete).
      let remainingPush = 0;
      if (isShip) {
        try {
          const vc = await this.getVesselCode(vesselId);
          remainingPush = await syncRepo.getUnsyncedFieldLogCount(this.instanceId, vesselId, vc);
        } catch (cntErr: any) {
          console.warn(`[SyncEngine] Could not count remaining push rows: ${cntErr.message}`);
        }
      }
      // FINALIZE THE LOCAL BATCH ROW (pilot 2026-07-26).
      // In REMOTE mode completeSyncSession runs on SHORE and finalizes SHORE's row; the ship's
      // own row — inserted defensively above so error persistence works — was never updated on
      // SUCCESS. Only the failure path finalized it. Consequences, all ship-side:
      //   • Sync Dashboard showed every successful sync as "In Progress", 0 pushed / 0 pulled,
      //     no duration — indistinguishable from a hung sync on the screen crew actually watch.
      //   • pruningService only deletes status IN ('completed','failed'), so these rows were
      //     NEVER prunable — unbounded growth in the very table pruning exists to bound.
      //   • healthMonitor counts status='in_progress' as ACTIVE batches, so the ship reported
      //     every historical sync as still running.
      // Deliberately NOT passing errorMessage (would wipe apply errors stored at Step 6) or
      // checkpointAfter (completeSyncSession owns it; in local mode it is already correct).
      // Non-fatal: updateBatch throws 404 if the row is absent (defensive insert failed), and a
      // bookkeeping failure must never turn a successful sync into a reported failure.
      if (batchUuid) {
        try {
          await syncRepo.updateBatch(batchUuid, {
            status: 'completed',
            completedAt: new Date(),
            durationMs,
            recordsSent: recordsPushed,
            recordsReceived: recordsPulled,
            conflictsFound,
            conflictsResolved: conflictsAutoResolved,
            filesQueued: filesProcessedCount + filesFailedCount,
            filesCompleted: filesProcessedCount,
          });
        } catch (finalizeErr: any) {
          console.warn(`[SyncEngine] Could not finalize local batch row: ${finalizeErr.message}`);
        }
      }

      syncDiag(`=== SYNC END === vessel=${vesselId}, duration=${durationMs}ms, status=success, pushed=${recordsPushed}, pulled=${recordsPulled}, conflicts=${conflictsFound}, files=${filesProcessedCount}+${filesFailedCount}, remainingPush=${remainingPush}, remainingPull=${completeResult.remainingPull ?? 0}`);
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
        remainingPush,
        remainingPull: completeResult.remainingPull ?? 0,
        remainingFilePull,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      // Enrich error string with cause.code (Node fetch wraps real error in cause)
      const errorDetail = error.message + (error.cause?.code ? ` [${error.cause.code}]` : '');
      syncDiag(`=== SYNC END === vessel=${vesselId}, duration=${durationMs}ms, status=FAILED, error=${errorDetail}`);
      console.error(`[SyncEngine] Sync failed for vessel ${vesselId}:`, errorDetail);

      // Mark batch as failed if it was created
      if (batchUuid) {
        try {
          await syncRepo.updateBatch(batchUuid, {
            status: 'failed',
            errorMessage: errorDetail,
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
        error: errorDetail,
        newCheckpoint: null,
        remainingPush: null,   // unknown on failure → drain loop stops
        remainingPull: null,
        remainingFilePull: null,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RE-ENTRANCY GUARD (shared: manual drain + auto-scheduler)
  // ═══════════════════════════════════════════════════════════════

  /** Try to claim a vessel for syncing. Returns false if a sync/drain is already running for it. */
  tryAcquireVessel(vesselId: string): boolean {
    if (this.inFlight.has(vesselId)) return false;
    this.inFlight.add(vesselId);
    return true;
  }

  /** Release a vessel claim. MUST be called in a finally so a thrown cycle can't leave it stuck. */
  releaseVessel(vesselId: string): void {
    this.inFlight.delete(vesselId);
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAIN — repeat whole cycles until push+pull backlogs hit 0 (or a safety stop)
  // ═══════════════════════════════════════════════════════════════

  /**
   * One "Sync Now" = fully reconcile the vessel in a single user action: loop runSync (whole,
   * unchanged cycles — per-batch limits and all fix internals intact) until BOTH the ship's
   * unsynced backlog and the shore's pending-for-this-vessel backlog are zero, or a safety stop.
   * Safety: DRAINED (remaining==0) | NO-PROGRESS (remaining didn't decrease — respects the
   * dead-letter guard, so a poison row stops the loop rather than spinning) | CAP
   * (catch_up_max_cycles) | TIME BUDGET (SYNC_DRAIN_MAX_MS) | FAILURE. Returns an aggregate
   * SyncResult (summed pushed/pulled) plus cyclesRun.
   */
  async runSyncToCompletion(vesselId: string): Promise<SyncResult & { cyclesRun: number }> {
    await this.loadSettings();

    // Backend re-entrancy safety net (one drain per vessel across manual + scheduler).
    if (!this.tryAcquireVessel(vesselId)) {
      syncDiag(`DRAIN SKIP: sync already in progress for vessel=${vesselId}`);
      return {
        success: false, batchUuid: null, recordsPushed: 0, recordsPulled: 0,
        conflictsFound: 0, conflictsAutoResolved: 0, filesQueued: 0, durationMs: 0,
        error: 'A sync is already in progress for this vessel — please wait for it to finish.',
        newCheckpoint: null, remainingPush: null, remainingPull: null, remainingFilePull: null, cyclesRun: 0,
      };
    }

    const maxCycles = this.catchUpMaxCycles || DEFAULT_DRAIN_MAX_CYCLES;
    const startMs = Date.now();
    let cyclesRun = 0;
    let prevRemaining = Number.POSITIVE_INFINITY;
    let aggPushed = 0, aggPulled = 0, aggConflicts = 0, aggAuto = 0, aggFiles = 0;
    let last!: SyncResult;

    try {
      for (;;) {
        last = await this.runSync(vesselId); // unchanged single cycle (self-catches its errors)
        cyclesRun++;
        aggPushed += last.recordsPushed;
        aggPulled += last.recordsPulled;
        aggConflicts += last.conflictsFound;
        aggAuto += last.conflictsAutoResolved;
        aggFiles += last.filesQueued;

        if (!last.success) break; // FAILURE → stop (counts unknown)

        // Size-gated: field-log backlog (push+pull) + office→ship files <= the size gate. Large
        // files are excluded from remainingFilePull, so they never hold Sync Now open — they still
        // transfer each cycle and complete over time. No-progress + cap + time budget still bound it.
        const remaining = (last.remainingPush ?? 0) + (last.remainingPull ?? 0) + (last.remainingFilePull ?? 0);
        if (remaining === 0) {
          syncDiag(`DRAIN COMPLETE: vessel=${vesselId} fully reconciled in ${cyclesRun} cycle(s)`);
          break; // FULLY DRAINED ✓
        }
        if (remaining >= prevRemaining) {
          // NO-PROGRESS: nothing net-drained this cycle (e.g. poison/dead-letter rows). Stop rather
          // than spin — the d8e88c679 dead-letter counter still advances and clears them over time.
          syncDiag(`DRAIN NO-PROGRESS: vessel=${vesselId} remaining=${remaining} did not decrease — stopping (cycle ${cyclesRun})`);
          console.warn(`[SyncEngine] Drain stopped (no progress): ${remaining} rows remain for vessel ${vesselId}. Poison/dead-letter rows persist for a later sync.`);
          break;
        }
        prevRemaining = remaining;

        if (cyclesRun >= maxCycles) {
          console.warn(`[SyncEngine] Drain hit max cycles (${maxCycles}) for vessel ${vesselId}; ${remaining} rows remain — will finish on next Sync Now / auto-tick.`);
          break; // CAP backstop
        }
        if (Date.now() - startMs >= SYNC_DRAIN_MAX_MS) {
          console.warn(`[SyncEngine] Drain hit time budget (${SYNC_DRAIN_MAX_MS}ms) for vessel ${vesselId}; ${remaining} rows remain — will finish on next Sync Now / auto-tick.`);
          break; // TIME BUDGET
        }
      }
    } finally {
      this.releaseVessel(vesselId); // always release — a stuck guard is worse than an overlap
    }

    return {
      ...last,
      recordsPushed: aggPushed,
      recordsPulled: aggPulled,
      conflictsFound: aggConflicts,
      conflictsAutoResolved: aggAuto,
      filesQueued: aggFiles,
      cyclesRun,
    };
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
    if (isShipInstanceId(this.instanceId)) {
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
    //    IMPORTANT: Only SHIP instances push field logs. Shore's field logs remain in
    //    sync_field_log (is_synced=false) until the ship pulls them via preparePullData.
    //    If shore pushes to itself in LOCAL mode, the logs get marked is_synced=true
    //    and the ship can never pull them — breaking shore→ship bidirectional sync.
    const isShip = isShipInstanceId(this.instanceId);
    const vesselCode = await this.getVesselCode(vesselId);
    syncDiag(`PUSH START: gathering field logs for vessel=${vesselId}, vesselCode=${vesselCode}`);
    const fieldLogs = isShip
      ? await syncRepo.getUnsyncedFieldLogs(this.instanceId, vesselId, vesselCode, this.pushBatchSize)
      : [];
    syncDiag(`PUSH: found ${fieldLogs.length} unsynced field logs${!isShip ? ' (shore skips field log push)' : ''}`);
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
    // Fix 3: row_uuids the shore reports it could NOT apply — accumulated across chunks
    // below. Only logs whose row actually applied get marked synced; dropped rows stay
    // is_synced=false and retry next cycle. `pushedLogUuids` is computed AFTER the loop.
    const droppedRowUuids = new Set<string>();
    // Migration 147: rows the shore explicitly CONFIRMED applied, and whether it spoke at all.
    const confirmedRowUuids = new Set<string>();
    let sawPositiveConfirm = false;

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

    // ── FIX 58: Gather master record hints ──────────────────────────
    // ship_surveys_master / ship_certificates_master are ONE_WAY_SHORE_TO_SHIP
    // so they can't travel to shore via field logs or one-way rows.
    // Include the real master record data as hints so shore's ENSURE-MASTER
    // placeholders get the actual names, requirement_ref, company_group, etc.
    const masterRecordHints: Array<{ tableName: string; rows: any[] }> = [];
    if (isShip && fieldLogPayloads.length > 0) {
      const surveyMasterIds = new Set<string>();
      const certMasterIds = new Set<string>();
      for (const log of fieldLogPayloads) {
        if (log.tableName === 'vessel_survey_data' && log.fieldName === 'masterId' && log.newValue) {
          surveyMasterIds.add(log.newValue);
        }
        if (log.tableName === 'vessel_certificate_data' && log.fieldName === 'masterId' && log.newValue) {
          certMasterIds.add(log.newValue);
        }
      }
      const pool = await getPool();
      if (surveyMasterIds.size > 0) {
        try {
          const r = await pool.query(
            `SELECT master_id, survey_name, category, "group", requirement_ref,
                    applicable_to_company, survey_label, company_id, company_group, company_sequence, sequence
             FROM ship_surveys_master WHERE master_id = ANY($1) AND is_deleted = false`,
            [Array.from(surveyMasterIds)]
          );
          if (r.rows.length > 0) masterRecordHints.push({ tableName: 'ship_surveys_master', rows: r.rows });
        } catch (err: any) { console.warn('[SyncEngine] FIX 58 survey master hints:', err.message); }
      }
      if (certMasterIds.size > 0) {
        try {
          const r = await pool.query(
            `SELECT master_id, certificate_name, category, "group", requirement_ref,
                    applicable_to_company, certificate_label, company_id, company_group, company_sequence, sequence
             FROM ship_certificates_master WHERE master_id = ANY($1) AND is_deleted = false`,
            [Array.from(certMasterIds)]
          );
          if (r.rows.length > 0) masterRecordHints.push({ tableName: 'ship_certificates_master', rows: r.rows });
        } catch (err: any) { console.warn('[SyncEngine] FIX 58 cert master hints:', err.message); }
      }
      if (masterRecordHints.length > 0) {
        syncDiag(`FIX 58: sending ${masterRecordHints.reduce((s, h) => s + h.rows.length, 0)} master record hint(s) to shore`);
      }
    }

    if (fieldLogPayloads.length > 0 || shipOnlyRows.length > 0) {
      // Fix 1b — row-aware chunking: never split one row_uuid across HTTP chunks (each chunk
      // is a separate receivePushData/applyFieldLogInserts on shore). fieldLogPayloads is
      // row-contiguous (Fix 1a gather returns a row's fields together), so start a new chunk
      // only at a row boundary once the current chunk reaches CHUNK_SIZE. A chunk may exceed
      // CHUNK_SIZE by one row's fields — acceptable. Empty payload → one empty chunk (preserves
      // the "register the push step" call, and keeps shipOnlyRows on the first chunk).
      const chunks: (typeof fieldLogPayloads)[] = [];
      let current: typeof fieldLogPayloads = [];
      let lastRow: string | null = null;
      for (const p of fieldLogPayloads) {
        if (p.rowUuid !== lastRow && current.length >= CHUNK_SIZE) {
          chunks.push(current);
          current = [];
        }
        current.push(p);
        lastRow = p.rowUuid;
      }
      if (current.length > 0) chunks.push(current);
      if (chunks.length === 0) chunks.push([]); // shipOnlyRows-only push (no field logs)

      // Self-heal delivery: full rows the shore requested in earlier push responses. Gathered
      // fresh from our DB (current state) and sent with the FIRST chunk only. Drained now —
      // if the shore still can't apply, the fragments re-fail there and the request regenerates.
      const fullRowsPayload = await this.drainFullRowRequests();

      for (let idx = 0; idx < chunks.length; idx++) {
        const result = await this.callSyncApiWithRetry('POST', '/sync/push', {
          batchUuid,
          vesselId,
          oneWayRows: idx === 0 ? shipOnlyRows : [], // One-way rows with first chunk only
          fieldLogs: chunks[idx],
          masterRecordHints: idx === 0 ? masterRecordHints : [], // Hints with first chunk only
          ...(idx === 0 && fullRowsPayload.length > 0 ? { fullRows: fullRowsPayload } : {}),
        });
        totalPushed += result.received || 0;
        // Fix 3: collect rows the shore could not apply (backward-compat: old shore omits the
        // field → undefined → nothing collected → ship marks all synced = current behaviour).
        (result.droppedRowUuids || []).forEach((r: string) => droppedRowUuids.add(r));
          // Migration 147 — POSITIVE CONFIRM, selected on FIELD PRESENCE not value.
          // Writing this as `result.appliedRowUuids || []` would be a data-stall bug: an older
          // shore omits the key, the empty array would read as "nothing applied", and the ship
          // would re-push the same backlog forever. Presence of the key IS the capability signal.
          if (Object.prototype.hasOwnProperty.call(result, 'appliedRowUuids')) {
            sawPositiveConfirm = true;
            (result.appliedRowUuids || []).forEach((r: string) => confirmedRowUuids.add(r));
          }
        // Self-heal: queue the shore's full-row requests for our NEXT push (old shore omits
        // the field → nothing queued → today's behaviour).
        this.queueFullRowRequests(result.needsFullRows);
      }
    } else {
      // Empty push to register the push step. Still deliver any queued self-heal rows.
      const fullRowsPayload = await this.drainFullRowRequests();
      const result = await this.callSyncApiWithRetry('POST', '/sync/push', {
        batchUuid,
        vesselId,
        oneWayRows: [],
        fieldLogs: [],
        ...(fullRowsPayload.length > 0 ? { fullRows: fullRowsPayload } : {}),
      });
      this.queueFullRowRequests(result?.needsFullRows);
    }

    // Fix 3 — mark synced ONLY rows the shore actually applied. Dropped rows stay unsynced
    // and retry next cycle (after Fix 1 they arrive whole and apply).
    //
    // MIGRATION 147 — THE DEAD-LETTER IS GONE. It used to give up on a row after
    // DEAD_LETTER_AFTER=3 consecutive drops and mark it is_synced=true "to stop the loop",
    // silently declaring undelivered data delivered. That is precisely how the Frontier Venture
    // 71 work orders were lost. Nothing is abandoned any more: unconfirmed rows stay
    // is_synced=false forever and the persisted backoff ladder throttles how often they retry.
    //
    // CONFIRM-BEFORE-SENT: a log is marked synced only when the shore CONFIRMED its row applied.
    //   * new shore  -> appliedRowUuids present  -> confirm positively (silence != success)
    //   * old shore  -> key absent               -> fall back to dropped-set subtraction, which is
    //                                               byte-identical to today's behaviour
    // Selected on PRESENCE (sawPositiveConfirm), never on the array's emptiness.
    const confirmedThisCycle = (ru: string): boolean =>
      sawPositiveConfirm ? confirmedRowUuids.has(ru) : !droppedRowUuids.has(ru);

    const attemptedRowUuids = new Set<string>();
    for (const l of fieldLogs) {
      const ru = l.rowUuid ?? (l as any).row_uuid;
      if (ru && !confirmedThisCycle(ru)) attemptedRowUuids.add(ru);
    }
    if (attemptedRowUuids.size > 0) {
      try {
        await syncRepo.recordDeliveryAttempt(Array.from(attemptedRowUuids), this.instanceId);
        syncDiag(`RETRY LADDER: ${attemptedRowUuids.size} row(s) not confirmed — attempt recorded, backing off (never abandoned)`);
      } catch (attErr: any) {
        // Bookkeeping must never fail a sync. Worst case the row retries next cycle without
        // backing off — noisier, still correct.
        console.warn(`[SyncEngine] could not record delivery attempts: ${attErr?.message || attErr}`);
      }
    }

    const pushedLogUuids = fieldLogs
      .filter(l => confirmedThisCycle(l.rowUuid ?? (l as any).row_uuid))
      .map(l => l.logUuid ?? (l as any).log_uuid);

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
    appliedRowUuids: string[];
    failedOneWayTables: string[];
    /** 148: max updated_at delivered per one-way table, from the pull response. */
    oneWayTableMax: Record<string, string>;
  }> {
    let totalPulled = 0;
    let totalApplyErrors = 0;
    let conflictsFound = 0;
    let conflictsAutoResolved = 0;
    const allErrors: string[] = [];
    // ONE-WAY tables whose apply had ANY error this cycle. Reported in /sync/complete so
    // the shore holds the checkpoint back instead of advancing past undelivered rows
    // (the one-way orphaning fix — field logs are is_synced-driven and unaffected).
    const failedOneWayTables: string[] = [];
    // 148: echoed straight back on /sync/complete for the tables that applied cleanly.
    // Absent from an OLD shore's response ⇒ stays empty ⇒ we send nothing ⇒ single-watermark.
    let oneWayTableMax: Record<string, string> = {};
    // Option 2 (pull-side per-row ack): row_uuids the ship confirms it APPLIED, sent back in
    // /sync/complete so the shore marks only these is_synced=true. Anything not acked stays
    // is_synced=false and is re-offered next pull. Empty when there are no field logs to apply.
    const appliedRowUuids: string[] = [];

    // ── 148: per-table one-way watermarks ────────────────────────────────────────
    // 🔴 THE min() RULE. `lastCheckpoint` is what an OLD shore uses — it ignores the map
    // and gathers `updated_at > lastCheckpoint` for EVERY table. So this value must be the
    // MINIMUM of our per-table watermarks, never the max:
    //     min -> an old shore re-offers rows some tables already have. Harmless; one-way
    //            applies are idempotent upserts.
    //     max -> an old shore SILENTLY SKIPS everything between a lagging table's
    //            watermark and the max. Unrecoverable, and exactly the stranded-parent
    //            bug that cost WK their role rows.
    // getConservativeFloor returns null when any table has no watermark, and null means
    // "send everything" — the safe direction.
    const oneWayTableNames = getTablesByCategory('ONE_WAY_SHORE_TO_SHIP').map(t => t.tableName);
    const tableCheckpoints = await syncRepo.getTableCheckpoints(this.instanceId);
    const havePerTable = Object.keys(tableCheckpoints).length > 0;
    const floor = havePerTable
      ? await syncRepo.getConservativeFloor(this.instanceId, oneWayTableNames)
      : lastCheckpoint;
    if (havePerTable) {
      syncDiag(
        `PULL CHECKPOINTS: per-table=${Object.keys(tableCheckpoints).length}, ` +
        `floor(min)=${floor ? floor.toISOString() : 'NULL (full offer)'}`
      );
    }

    // A. Request remote changes
    const pullData = await this.callSyncApiWithRetry('POST', '/sync/pull', {
      batchUuid,
      vesselId,
      instanceId: this.instanceId,
      lastCheckpoint: floor ? floor.toISOString() : null,
      ...(havePerTable
        ? {
            tableCheckpoints: Object.fromEntries(
              Object.entries(tableCheckpoints).map(([t, d]) => [t, d.toISOString()])
            ),
          }
        : {}),
    });

    // 148: capture per-table delivered maxima. Presence-gated exactly like appliedRowUuids
    // — an older shore omits the key and we fall back to the single watermark.
    if (Object.prototype.hasOwnProperty.call(pullData, 'oneWayTableMax')) {
      oneWayTableMax = pullData.oneWayTableMax || {};
    }

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
      // NOTE: RBAC/ranks pre-cleanup was REMOVED (data-loss bug).
      // The provisioning bundle import (provisioningService.ts) already handles
      // the one-time UUID mismatch cleanup. Running it on every incremental pull
      // was deleting ALL rows then only re-inserting the incremental subset,
      // causing permanent data loss for roles, menus, and permissions.
      // Tables with no UUID identity (e.g. adm_role_menu_access) now use
      // composite-key matching in oneWayApplier.ts instead.

      for (const tableData of pullData.oneWayRows) {
        try {
          const result = await applyOneWayRows(tableData.tableName, tableData.rows);
          syncDiag(`PULL ONE-WAY: ${tableData.tableName} — inserted=${result.inserted}, updated=${result.updated}, deleted=${result.softDeleted}, errors=${result.errors.length}`);
          totalPulled += result.inserted + result.updated + result.softDeleted;
          totalApplyErrors += result.errors.length;
          if (result.errors.length > 0) {
            failedOneWayTables.push(tableData.tableName);
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
          failedOneWayTables.push(tableData.tableName);
          syncDiag(`PULL ONE-WAY EXCEPTION: ${tableData.tableName}: ${err.message.substring(0, 150)}`);
          console.error(`[SyncEngine] Failed to apply one-way rows for ${tableData.tableName}:`, err.message);
          allErrors.push(`${tableData.tableName}: ${err.message}`);
        }
      }
    }

    // Self-heal (pull direction): requests generated by this cycle's apply — fragments that
    // targeted rows ABSENT on this ship. Fetched from the shore right after the apply tx.
    let pullSelfHealRequests: Array<{ tableName: string; rowUuid: string }> = [];

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
        pullSelfHealRequests = insertResult.needsFullRows || [];
        syncDiag(`PULL FIELD-LOG INSERT: inserted=${insertResult.insertedRows}, updateRemaining=${insertResult.updateLogs.length}, errors=${insertResult.errors.length}`);
        if (insertResult.errors.length > 0) {
          insertResult.errors.slice(0, 5).forEach((e: string) => syncDiag(`PULL INSERT ERROR: ${e.substring(0, 150)}`));
        }
        totalPulled += insertResult.insertedRows;
        if (insertResult.errors.length > 0) {
          totalApplyErrors += insertResult.errors.length;
          allErrors.push(...insertResult.errors);
        }

        // Track per-row apply failures for the /sync/complete ack. Row-atomic: a row counts as
        // applied only if NONE of its logs failed (matches the complete-row batching contract).
        // failedRowUuids from the INSERT phase is an existing return value (13c92f9de) — read-only.
        const failedRowUuids = new Set<string>(insertResult.failedRowUuids || []);

        // Phase 2: Apply remaining UPDATE field logs (non-INSERT groups + existing rows)
        let updateApplied = 0;
        let updateErrors = 0;
        let updSpIdx = 0;
        for (const log of insertResult.updateLogs) {
          // Part A: per-row savepoint so one poison UPDATE (e.g. an immutable-table reject) can no
          // longer 25P02-abort its siblings in this pull batch. Mirrors the INSERT-path savepoints
          // (d8e88c679): RELEASE on success, ROLLBACK TO SAVEPOINT on failure.
          const updSp = `pull_upd_${updSpIdx++}`;
          try { await client.query(`SAVEPOINT ${updSp}`); } catch { /* non-fatal */ }
          try {
            // §13 guard: the PULL path previously applied EVERY update log unconditionally —
            // no stale-skip, no insert-origin check. That is the exact path by which the
            // Frontier Venture "39" had status/approval_tier/days_late reverted by a
            // re-delivered creation-time log. Skip is TERMINAL (acked, not re-offered): the
            // row exists and its column is populated, so retrying can never change the outcome.
            const guard = await evaluateInsertOriginGuard(client, log as any);
            if (guard.skip) {
              try { await client.query(`RELEASE SAVEPOINT ${updSp}`); } catch { /* non-fatal */ }
              continue;
            }
            // §18 SYMMETRY: the shore's receive path has rejected a stale incoming edit since
            // day one; this path did not, so an OLDER shore edit silently overwrote a NEWER
            // local ship value with no conflict record. Same shared helper as the shore now, so
            // the two directions record the same things. Conflict ROWS yes (the Conflict Review
            // UI exists on ships); notifications deliberately not yet.
            // TERMINAL like the shore's: the receiver's edit won, so re-offering cannot change
            // the outcome — do NOT add to failedRowUuids.
            if (log.oldValue !== null && log.oldValue !== undefined) {
              const stale = await evaluateStaleSkipGuard(
                client,
                { ...log, changedAt: log.changedAt instanceof Date ? log.changedAt : new Date(String(log.changedAt)) } as any,
                this.instanceId,
                { batchUuid },
              );
              if (stale.skip) {
                try { await client.query(`RELEASE SAVEPOINT ${updSp}`); } catch { /* non-fatal */ }
                continue;
              }
            }
            await this.applyFieldLog(log, client);
            try { await client.query(`RELEASE SAVEPOINT ${updSp}`); } catch { /* non-fatal */ }
            totalPulled++;
            updateApplied++;
          } catch (err: any) {
            try { await client.query(`ROLLBACK TO SAVEPOINT ${updSp}`); } catch { /* non-fatal */ }
            totalApplyErrors++;
            updateErrors++;
            allErrors.push(`${log.tableName}.${log.fieldName}: ${err.message}`);
            // Part B: an immutable-table UPDATE can never apply (INSERT-only + DB trigger). Treat it
            // as TERMINAL — withhold from failedRowUuids so it ACKs and drops from the backlog
            // instead of re-offering every cycle (mirrors the 6c8ff600e dead-letter mechanic).
            const cfg = getTableSyncConfig(log.tableName);
            const immutableReject = !!cfg?.immutable || /immutable/i.test(err.message || '');
            if (immutableReject) {
              syncDiag(`PULL FIELD-LOG IMMUTABLE-ACK (terminal): ${log.tableName}.${log.fieldName} row=${log.rowUuid} — ${(err.message || '').substring(0, 120)}`);
              console.warn(`[SyncEngine] Immutable-table UPDATE rejected — acked as terminal (not retried): ${log.tableName}.${log.fieldName} row=${log.rowUuid}`);
            } else {
              if (log.rowUuid) failedRowUuids.add(log.rowUuid);
              console.error(`[SyncEngine] Failed to apply field log ${log.tableName}.${log.fieldName}:`, err.message);
            }
          }
        }
        syncDiag(`PULL FIELD-LOG UPDATE: total=${insertResult.updateLogs.length}, applied=${updateApplied}, errors=${updateErrors}`);

        // Ack set: every distinct row in this pull payload whose logs all applied cleanly.
        const seenRowUuids = new Set<string>();
        for (const l of pullData.fieldLogs) {
          const ru = l.rowUuid;
          if (!ru || seenRowUuids.has(ru)) continue;
          seenRowUuids.add(ru);
          if (!failedRowUuids.has(ru)) appliedRowUuids.push(ru);
        }
        syncDiag(`PULL FIELD-LOG ACK: ${appliedRowUuids.length} rows applied, ${failedRowUuids.size} rows failed (re-offered next pull)`);

        await client.query('COMMIT');
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        console.error(`[SyncEngine] Transaction error during pull field log apply: ${txErr.message}`);
        throw txErr;
      } finally {
        client.release();
      }
    }

    // C2. Self-heal (pull direction): fetch the complete rows for fragments that targeted
    //     rows absent on this ship, and insert them ONLY-IF-ABSENT. The fragments were kept
    //     failed (not acked), so the next pull/drain iteration re-offers them and they apply
    //     as normal updates against the now-present rows. Old shore (no /sync/fetch-rows)
    //     → caught + logged, behaviour degrades to today's.
    if (pullSelfHealRequests.length > 0) {
      try {
        const byTable = new Map<string, string[]>();
        for (const n of pullSelfHealRequests) {
          if (!byTable.has(n.tableName)) byTable.set(n.tableName, []);
          byTable.get(n.tableName)!.push(n.rowUuid);
        }
        const requests = Array.from(byTable.entries()).map(([tableName, rowUuids]) => ({ tableName, rowUuids }));
        const resp = await this.callSyncApi('POST', '/sync/fetch-rows', {
          vesselId,
          instanceId: this.instanceId,
          requests,
        });
        for (const t of (resp?.tables || [])) {
          const healed = await applyFullRowsIfAbsent(t.tableName, t.rows);
          totalPulled += healed.inserted;
          syncDiag(`SELF-HEAL APPLY (pull): ${t.tableName} — inserted=${healed.inserted}, skipped(existing)=${healed.skipped}, errors=${healed.errors.length}`);
        }
      } catch (healErr: any) {
        syncDiag(`SELF-HEAL FETCH SKIPPED (old shore or network): ${String(healErr?.message || healErr).substring(0, 150)}`);
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

    return { totalPulled, totalApplyErrors, conflictsFound, conflictsAutoResolved, errors: allErrors, appliedRowUuids, failedOneWayTables, oneWayTableMax };
  }

  // ═══════════════════════════════════════════════════════════════
  // SELF-HEAL — full-row request queue (push direction)
  // ═══════════════════════════════════════════════════════════════

  /** Queue the shore's needsFullRows (from a push response) for our next push. Dedups. */
  private queueFullRowRequests(needs?: Array<{ tableName: string; rowUuid: string }>): void {
    if (!Array.isArray(needs) || needs.length === 0) return;
    for (const n of needs) {
      if (!n || typeof n.tableName !== 'string' || typeof n.rowUuid !== 'string') continue;
      if (!this.pendingFullRowRequests.has(n.tableName)) this.pendingFullRowRequests.set(n.tableName, new Set());
      this.pendingFullRowRequests.get(n.tableName)!.add(n.rowUuid);
    }
    const total = Array.from(this.pendingFullRowRequests.values()).reduce((s, v) => s + v.size, 0);
    syncDiag(`SELF-HEAL QUEUE: shore requested full rows — queue now ${total} row(s) across ${this.pendingFullRowRequests.size} table(s)`);
  }

  /** Drain the queue into a fullRows payload (gathered fresh from our own DB). */
  private async drainFullRowRequests(): Promise<Array<{ tableName: string; rows: any[] }>> {
    if (this.pendingFullRowRequests.size === 0) return [];
    const requests = Array.from(this.pendingFullRowRequests.entries()).map(([tableName, set]) => ({
      tableName,
      rowUuids: Array.from(set),
    }));
    this.pendingFullRowRequests.clear(); // regenerates via re-failure if anything is lost
    const tables = await gatherFullRows(requests);
    if (tables.length > 0) {
      syncDiag(`SELF-HEAL DELIVER: sending ${tables.reduce((s, t) => s + t.rows.length, 0)} full row(s) to shore with this push`);
    }
    return tables;
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
      if (log.newValue === 'verified' && !isShipInstanceId(this.instanceId)) {
        // Shore receiving ship's verification — reject
        console.warn(`[SyncEngine] Business rule: ship cannot verify defects. Skipping.`);
        return;
      }
    }

    const identityCol = config.identityColumn || 'id';
    // Honor column aliases (e.g. location2 → location_2) before camel→snake, which cannot insert
    // an underscore before a digit. Keeps the UPDATE path consistent with the INSERT path.
    const fieldNameSnake = SYNC_COLUMN_ALIASES[log.fieldName] ?? camelToSnake(log.fieldName);

    const conn = client || await getPool();

    // JSON coercion: if the column is json/jsonb, ensure the value is valid JSON.
    // The field logger stores JSON values as JSON strings (e.g., '[{"spareId":"abc"}]').
    // For json/jsonb columns, we must pass a parsed object so pg serializes it correctly,
    // OR pass the raw JSON string which pg accepts directly for json/jsonb types.
    const meta = await getColumnMeta(conn, log.tableName);
    // Defense-in-depth: skip a column that doesn't exist on this table rather than issuing an
    // UPDATE that throws 42703. Fail-open when allCols is unknown (empty).
    if (meta.allCols.size > 0 && !meta.allCols.has(fieldNameSnake)) {
      syncDiag(`APPLY-FIELD-LOG SKIP unknown column ${log.tableName}.${fieldNameSnake}`);
      return;
    }
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
    } else if (valueToApply !== null && meta.arrayCols.has(fieldNameSnake)) {
      // Postgres array column — parse the stored JSON string back to a JS array so pg serializes
      // {...}; a JSON string would fail with "malformed array literal".
      valueToApply = coerceArrayValue(valueToApply);
    }

    // Use the log's changedAt for updated_at — trigger bypass ensures it sticks.
    const logTs = log.changedAt instanceof Date ? log.changedAt : new Date(String(log.changedAt));
    // Let errors bubble up to the caller for proper counting (Defect D fix)
    await conn.query(
      `UPDATE "${log.tableName}" SET "${fieldNameSnake}" = $1, "updated_at" = $3 WHERE "${identityCol}" = $2`,
      [valueToApply, log.rowUuid, logTs]
    );

    // ── Derived RH update — propagate running_hours_audit field changes to components current state ──
    // Same pattern as service.ts receivePushData: when an RH audit field is applied during PULL,
    // update the corresponding component's current_cumulative_rh and rh_current_master.
    if (log.tableName === 'running_hours_audit' &&
        (fieldNameSnake === 'new_rh' || fieldNameSnake === 'cumulative_rh') &&
        valueToApply !== null) {
      try {
        const auditRow = await conn.query(
          `SELECT component_id FROM running_hours_audit WHERE rhauuid = $1 LIMIT 1`,
          [log.rowUuid]
        );
        if (auditRow.rows.length > 0) {
          const compId = auditRow.rows[0].component_id;
          const oldRow = await conn.query(
            `SELECT current_cumulative_rh, rh_current_master FROM components WHERE cuuid = $1 LIMIT 1`,
            [compId]
          );
          const oldVal = oldRow.rows[0]?.current_cumulative_rh || oldRow.rows[0]?.rh_current_master || '(not found)';
          await conn.query(
            `UPDATE components SET current_cumulative_rh = $1, rh_current_master = $1, updated_at = NOW() WHERE cuuid = $2`,
            [String(valueToApply), compId]
          );
          syncDiag(`RH-APPLY PULL: component=${compId} current_cumulative_rh updated from ${oldVal} to ${valueToApply} from audit row ${log.rowUuid}`);
        }
      } catch (rhErr: any) {
        syncDiag(`RH-APPLY PULL ERROR: audit=${log.rowUuid}: ${rhErr.message}`);
      }
    }
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
      signal: AbortSignal.timeout(this.requestTimeoutMs),
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
        // 4th arg (appliedRowUuids) intentionally NOT passed in local mode — preserves the
        // pre-existing legacy-all marking there. failedOneWayTables (5th) is passed so the
        // one-way holdback works in local mode too.
        return svc.completeSyncSession(body.batchUuid, body.vesselId, body.instanceId, undefined, body.failedOneWayTables);
      case '/sync/fetch-rows':
        // Self-heal fetch works in local mode too (same-DB: rows are gathered and the
        // only-if-absent apply naturally skips everything that already exists).
        return { tables: await svc.fetchFullRowsForHeal(body.requests) };
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
