/**
 * SyncAutoScheduler — Autonomous ship-shore sync on a configurable timer.
 *
 * Reads `auto_sync_enabled` and `sync_interval_minutes` from sync_settings
 * on every tick. Default interval: 360 minutes (6 hours).
 *
 * Features:
 *   • Re-entrancy guard — per-vessel lock prevents overlapping sync cycles
 *   • Extended-outage catch-up — after each successful cycle, if unsynced
 *     records remain, immediately runs another cycle (capped by
 *     `catch_up_max_cycles` setting, default 20)
 *   • Connectivity logging — every attempt (success, failure, skip) is
 *     recorded in `sync_connectivity_log` for queryable VSAT reporting
 *
 * Pattern follows SyncPruningScheduler (pruningService.ts).
 */

import * as syncRepo from './repository';
import { getSyncEngine, type SyncResult } from './syncEngine';
import { syncDiag } from './syncDiagLogger';
import { isShipInstance } from './syncRole';
import { getPool } from '../../db';

// ── Defaults ──

const DEFAULT_INTERVAL_MINUTES = 360;       // 6 hours
const BOOT_DELAY_MS = 180_000;              // 3 minutes after server start
const DEFAULT_CATCH_UP_MAX_CYCLES = 20;
const FIELD_LOG_BATCH_SIZE = 1000;          // matches getUnsyncedFieldLogs LIMIT

// ── Error category classifier ──

function classifyError(error: any): syncRepo.ConnectivityLogEntry['outcome'] {
  // Node.js fetch wraps the real error: error.message = "fetch failed",
  // error.cause.code = "ECONNREFUSED" / "UND_ERR_CONNECT_TIMEOUT", etc.
  // Check all three surfaces: message, cause.code, cause.message.
  const msg = (error?.message || '').toLowerCase();
  const causeCode = (error?.cause?.code || '').toLowerCase();
  const causeMsg = (error?.cause?.message || '').toLowerCase();
  const all = `${msg} ${causeCode} ${causeMsg}`;

  if (/econnrefused|enotfound|enetunreach|ehostunreach|eai_again/.test(all)) {
    return 'network_unreachable';
  }
  if (/timeout|abort|timedout|etimedout|econnaborted|und_err_connect_timeout/.test(all)) {
    return 'timeout';
  }
  if (/\b5\d{2}\b|server error/.test(all)) {
    return 'server_error';
  }
  if (/\b4\d{2}\b|client error/.test(all)) {
    return 'client_error';
  }
  return 'unknown_error';
}

// ── Vessel code helper (mirrors SyncEngine.getVesselCode) ──

const vesselCodeCache = new Map<string, string | null>();

async function getVesselCode(vesselId: string): Promise<string | null> {
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
// Scheduler class
// ═══════════════════════════════════════════════════════════════

export class SyncAutoScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private tickIntervalMs = DEFAULT_INTERVAL_MINUTES * 60 * 1000;

  /** Per-vessel re-entrancy guard */
  private syncInProgress = new Map<string, boolean>();

  async start(intervalMs?: number): Promise<void> {
    if (this.isRunning) {
      console.log('[AutoSync] Scheduler already running');
      return;
    }

    // Resolve cadence: DB admin preference > caller arg > DEFAULT. So an admin's
    // saved sync_interval_minutes survives server restarts.
    this.tickIntervalMs = await this.resolveIntervalMs(intervalMs);

    const intervalMin = Math.round(this.tickIntervalMs / 60000);
    const intervalHours = (this.tickIntervalMs / 1000 / 60 / 60).toFixed(2);
    console.log(`[AutoSync] Starting scheduler (tick interval: ${intervalMin}min / ${intervalHours}h, boot delay: ${BOOT_DELAY_MS / 1000}s)`);

    // Deferred initial tick — allow DB and migrations to complete first
    setTimeout(() => {
      this.tick().catch(err => {
        console.error('[AutoSync] Error during initial tick:', err);
      });
    }, BOOT_DELAY_MS);

    this.intervalId = setInterval(() => {
      this.tick().catch(err => {
        console.error('[AutoSync] Error during scheduled tick:', err);
      });
    }, this.tickIntervalMs);

    this.isRunning = true;
    // EFFECTIVE-STATE line (§16): "is auto-sync actually on?" must be answerable from the boot
    // log, not a DB query. Mirrors how the sync timeout now reports its resolved source.
    try {
      const s = await syncRepo.getAllSettings();
      const raw = s['auto_sync_enabled'];
      const on = syncRepo.parseBooleanSetting(raw, false);
      const mins = Math.round(this.tickIntervalMs / 60000);
      console.log(`[AutoSync] EFFECTIVE STATE — auto_sync_enabled=${on ? 'ON' : 'OFF'} (raw ${JSON.stringify(raw ?? null)}), interval=${mins}min. ${on ? `Next tick in ${Math.round(BOOT_DELAY_MS / 1000)}s, then every ${mins}min.` : 'TICKS WILL NO-OP until this is enabled.'}`);
    } catch (e: any) {
      console.warn(`[AutoSync] Could not read effective auto-sync state at startup: ${e?.message || e}`);
    }
    console.log(`[AutoSync] Scheduler started — will run every ${Math.round(this.tickIntervalMs / 60000)} minutes`);
  }

  /**
   * Resolve the startup tick cadence (ms). Precedence:
   *   1. DB sync_settings.sync_interval_minutes (admin preference — survives restarts)
   *   2. the intervalMs arg passed by the caller (routes.ts)
   *   3. DEFAULT_INTERVAL_MINUTES
   * No minimum enforced — admin's choice. Falls back gracefully if DB unavailable.
   */
  private async resolveIntervalMs(argMs?: number): Promise<number> {
    try {
      const settings = await syncRepo.getAllSettings();
      const raw = settings['sync_interval_minutes'];
      const minutes = parseInt(raw || '0', 10);
      if (Number.isFinite(minutes) && minutes > 0) {
        console.log(`[AutoSync] Using interval from DB: ${minutes} minutes`);
        return minutes * 60 * 1000;
      }
      console.log(`[AutoSync] DB sync_interval_minutes invalid ("${raw ?? 'null'}") — falling back to default ${DEFAULT_INTERVAL_MINUTES} minutes`);
    } catch (err: any) {
      console.warn('[AutoSync] Could not read sync_interval_minutes at startup — falling back:', err?.message || err);
    }
    if (argMs && argMs > 0) return argMs;
    return DEFAULT_INTERVAL_MINUTES * 60 * 1000;
  }

  /**
   * Reconfigure the live tick cadence immediately. Called by the settings-save
   * endpoint and by tick() when a direct-DB change is detected. No minimum
   * enforced beyond > 0 — admin chose, admin gets.
   */
  restartWithNewInterval(intervalMinutes: number): void {
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      console.warn(`[AutoSync] Ignoring invalid sync interval: ${intervalMinutes} (must be a positive number of minutes)`);
      return;
    }

    const newMs = intervalMinutes * 60 * 1000;

    if (!this.isRunning) {
      // Not started (shore instance, or auto-sync disabled at boot). Record the
      // preference so a later start() honors it; nothing to clear.
      this.tickIntervalMs = newMs;
      console.log(`[AutoSync] Scheduler not running — interval preference recorded as ${intervalMinutes}min (applies when started)`);
      return;
    }

    if (newMs === this.tickIntervalMs) {
      console.log(`[AutoSync] Sync interval already ${intervalMinutes}min — no change`);
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.tickIntervalMs = newMs;
    this.intervalId = setInterval(() => {
      this.tick().catch(err => {
        console.error('[AutoSync] Error during scheduled tick:', err);
      });
    }, this.tickIntervalMs);
    // Intentionally NOT firing an immediate tick — let the new cadence's first tick happen naturally.
    console.log(`[AutoSync] Sync interval updated to ${intervalMinutes} minutes — now live`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[AutoSync] Scheduler stopped');
  }

  /** True when the tick timer is live. Used by the role watchdog and the
   *  settings-save self-heal to detect a ship whose scheduler never started
   *  (stale boot-time role decision). */
  isStarted(): boolean {
    return this.isRunning;
  }

  // ────────────────────────────────────────────────
  // One-time self-heal re-offer sweep (Build 2b)
  // ────────────────────────────────────────────────
  // Rows dead-lettered by the push-side 3-strike guard were marked is_synced=true and are
  // indistinguishable from delivered rows in the DB. This ONE-TIME sweep (marker-guarded via
  // sync_settings 'selfheal_reoffer_v1') re-offers this ship's recent logs for the affected
  // tables; genuinely-delivered rows re-apply as idempotent no-op updates on the shore, while
  // stranded rows re-fail there and trigger the full-row self-heal (needsFullRows → next push
  // delivers the complete row → fragments apply). Bounded: 2 tables × 30-day window.
  private async maybeRunSelfHealReofferSweep(
    settings: Record<string, string>,
    instanceId: string,
  ): Promise<void> {
    const MARKER = 'selfheal_reoffer_v1';
    if ((settings[MARKER] || '') === 'done') return;
    try {
      const pool = await getPool();
      const r = await pool.query(
        `UPDATE sync_field_log SET is_synced = false
          WHERE instance_id = $1 AND is_synced = true
            AND table_name IN ('work_orders','superintendent_notifications')
            AND changed_at >= NOW() - interval '30 days'`,
        [instanceId],
      );
      // Persist the marker (sync_settings row may not exist for a brand-new key — UPDATE
      // then INSERT; seedSettingIfEmpty is UPDATE-only and would no-op here).
      const upd = await pool.query(
        `UPDATE sync_settings SET setting_value = 'done', updated_at = NOW() WHERE setting_key = $1`,
        [MARKER],
      );
      if ((upd.rowCount ?? 0) === 0) {
        await pool.query(
          `INSERT INTO sync_settings (setting_key, setting_value) VALUES ($1, 'done')`,
          [MARKER],
        );
      }
      console.log(`[AutoSync] 🩹 Self-heal re-offer sweep: ${r.rowCount ?? 0} log(s) re-offered (one-time, marker set).`);
      syncDiag(`SELF-HEAL REOFFER SWEEP: ${r.rowCount ?? 0} log(s) re-offered for instance=${instanceId} (work_orders, superintendent_notifications, 30d window). Marker '${MARKER}' set.`);
    } catch (err: any) {
      // Marker NOT set on failure → retried next tick.
      console.warn(`[AutoSync] Self-heal re-offer sweep failed (will retry next tick): ${err?.message || err}`);
    }
  }

  // ────────────────────────────────────────────────
  // Tick — one scheduler wake-up
  // ────────────────────────────────────────────────

  private async tick(): Promise<void> {
    try {
      // Defense-in-depth: auto-sync is ship-only. If the scheduler was somehow
      // started on shore (e.g. via tests or future code changes), bail out.
      if (!(await isShipInstance())) {
        syncDiag('[AutoSync] Shore instance detected in tick() — skipping (sync is ship-initiated)');
        return;
      }

      // 1. Read settings on every tick (hot-reloadable)
      const settings = await syncRepo.getAllSettings();

      // Tolerant parse (§16): a strict === 'true' meant 'TRUE'/'True'/'1' read as FALSE and
      // auto-sync silently never ran, while manual Sync Now kept working because it never
      // consults this flag. Default TRUE on an unparseable value would be worse; default is
      // the seeded intent, so an unrecognised value logs a warning and falls back to false.
      const enabled = syncRepo.parseBooleanSetting(settings['auto_sync_enabled'], false);
      if (!enabled) {
        syncDiag('[AutoSync] auto_sync_enabled=false — skipping tick');
        return; // silent skip — don't log connectivity for disabled state
      }

      // 2. Resolve interval from settings — apply LIVE if it changed. This catches
      // a direct DB edit (one not made through the settings endpoint, which already
      // calls restartWithNewInterval). The current tick continues; the new cadence
      // governs subsequent ticks.
      const intervalMinutes = parseInt(settings['sync_interval_minutes'] || '0', 10);
      if (intervalMinutes > 0 && intervalMinutes * 60 * 1000 !== this.tickIntervalMs) {
        console.log(`[AutoSync] Detected interval change in settings → applying live (${this.tickIntervalMs / 60000}min → ${intervalMinutes}min)`);
        this.restartWithNewInterval(intervalMinutes);
      }

      // 3. Determine vessel ID for this ship instance
      const instanceId = settings['instance_id'] || process.env.SYNC_INSTANCE_ID || '';
      if (!instanceId) {
        console.warn('[AutoSync] No instance_id configured — cannot determine vessel. Skipping.');
        return;
      }

      // 3b. One-time self-heal re-offer sweep (marker-guarded; ship-only by the gate above).
      await this.maybeRunSelfHealReofferSweep(settings, instanceId);

      const metadata = await syncRepo.getInstanceMetadata(instanceId);
      const vesselId = metadata?.vesselId;
      if (!vesselId) {
        console.warn(`[AutoSync] No vesselId in sync_metadata for instance ${instanceId}. Skipping.`);
        return;
      }

      // 4. Run sync cycle (with catch-up)
      const maxCatchUp = parseInt(settings['catch_up_max_cycles'] || String(DEFAULT_CATCH_UP_MAX_CYCLES), 10);
      await this.runWithCatchUp(instanceId, vesselId, maxCatchUp);

    } catch (error: any) {
      console.error('[AutoSync] Tick failed:', error.message);
    }
  }

  // ────────────────────────────────────────────────
  // Run sync + catch-up cycles
  // ────────────────────────────────────────────────

  private async runWithCatchUp(
    instanceId: string,
    vesselId: string,
    maxCatchUpCycles: number,
  ): Promise<void> {
    // Re-entrancy guard — scheduler's own flag PLUS the engine's shared inFlight set, so an auto
    // tick can never overlap a manual "Sync Now" drain (or vice-versa) on the same vessel.
    const engine = getSyncEngine();
    if (this.syncInProgress.get(vesselId) || !engine.tryAcquireVessel(vesselId)) {
      console.log(`[AutoSync] Sync already in progress for vessel ${vesselId} — skipping`);
      await syncRepo.insertConnectivityLog({
        instanceId,
        vesselId,
        outcome: 'skipped_reentrant',
        triggerType: 'auto',
      });
      return;
    }

    this.syncInProgress.set(vesselId, true);
    let cycleNumber = 0;

    try {
      // ── Primary sync cycle ──
      const primaryResult = await this.executeSingleCycle(instanceId, vesselId, cycleNumber, 'auto');

      if (!primaryResult.success) {
        // Failed — no catch-up. Error already logged in executeSingleCycle.
        return;
      }

      // ── Catch-up cycles ──
      if (maxCatchUpCycles <= 0) return;

      const vesselCode = await getVesselCode(vesselId);
      // Drain condition covers BOTH directions: ship's unsynced (push) + shore's pending for this
      // vessel (pull). Without the pull term, office→ship large changes lagged across ticks.
      //
      // Push term is the DUE count, not the total (migration 147). A row waiting out a retry
      // backoff is undelivered but not sendable, so counting it here spins the loop to its full
      // cap while every gather returns nothing — 20 pointless VSAT round-trips per tick. The
      // total is still what we REPORT (see finalRemaining below and /sync/status); it is just not
      // what we act on.
      let remaining = await syncRepo.getDueFieldLogCount(instanceId, vesselId, vesselCode)
        + await syncRepo.getShorePullRemainingCount(vesselId, instanceId, vesselCode);

      while (remaining > 0 && cycleNumber < maxCatchUpCycles) {
        cycleNumber++;
        console.log(`[AutoSync] Catch-up cycle ${cycleNumber}/${maxCatchUpCycles} — ${remaining} unsynced records remain`);
        syncDiag(`[AutoSync] catch-up cycle=${cycleNumber}, remaining=${remaining}, cap=${maxCatchUpCycles}`);

        const catchUpResult = await this.executeSingleCycle(instanceId, vesselId, cycleNumber, 'catch_up');

        if (!catchUpResult.success) {
          console.log(`[AutoSync] Catch-up cycle ${cycleNumber} failed — stopping catch-up`);
          break;
        }

        // Re-check remaining (push + pull) — DUE count, same reasoning as above.
        remaining = await syncRepo.getDueFieldLogCount(instanceId, vesselId, vesselCode)
          + await syncRepo.getShorePullRemainingCount(vesselId, instanceId, vesselCode);
      }

      if (cycleNumber > 0) {
        // Report the TRUE TOTAL, not the due count — this line is how support learns a vessel is
        // carrying undelivered records. "0 due" with rows still held would read as all-clear.
        const finalRemaining = await syncRepo.getUnsyncedFieldLogCount(instanceId, vesselId, vesselCode)
          + await syncRepo.getShorePullRemainingCount(vesselId, instanceId, vesselCode);
        const heldBack = finalRemaining - remaining;
        console.log(
          `[AutoSync] Catch-up complete — ran ${cycleNumber} extra cycle(s), ${finalRemaining} records still unsynced` +
          (heldBack > 0 ? ` (${heldBack} waiting on retry backoff — not an error)` : '')
        );
      }

    } finally {
      this.syncInProgress.set(vesselId, false);
      engine.releaseVessel(vesselId); // always release the shared guard
    }
  }

  // ────────────────────────────────────────────────
  // Execute one sync cycle + log connectivity
  // ────────────────────────────────────────────────

  private async executeSingleCycle(
    instanceId: string,
    vesselId: string,
    cycleNumber: number,
    triggerType: 'auto' | 'catch_up',
  ): Promise<SyncResult> {
    const startMs = Date.now();
    let result: SyncResult;

    try {
      const engine = getSyncEngine();
      result = await engine.runSync(vesselId);
    } catch (error: any) {
      // runSync should catch its own errors, but guard against unexpected throws
      const latencyMs = Date.now() - startMs;
      const outcome = classifyError(error);

      await syncRepo.insertConnectivityLog({
        instanceId,
        vesselId,
        outcome,
        errorMessage: error.message?.substring(0, 500),
        errorCategory: outcome,
        latencyMs,
        catchUpCycle: cycleNumber,
        triggerType,
      });

      console.error(`[AutoSync] Cycle ${cycleNumber} threw: ${error.message}`);
      syncDiag(`[AutoSync] EXCEPTION cycle=${cycleNumber}, outcome=${outcome}, latency=${latencyMs}ms, err=${error.message}`);

      return {
        success: false,
        batchUuid: null,
        recordsPushed: 0,
        recordsPulled: 0,
        conflictsFound: 0,
        conflictsAutoResolved: 0,
        filesQueued: 0,
        durationMs: latencyMs,
        error: error.message,
        newCheckpoint: null,
        remainingPush: null,
        remainingPull: null,
        remainingFilePull: null,
      };
    }

    // Log connectivity — success or structured failure
    const latencyMs = Date.now() - startMs;
    const outcome: syncRepo.ConnectivityLogEntry['outcome'] = result.success
      ? 'success'
      : classifyError({ message: result.error || '' });

    await syncRepo.insertConnectivityLog({
      instanceId,
      vesselId,
      outcome,
      errorMessage: result.error?.substring(0, 500) ?? null,
      errorCategory: result.success ? null : outcome,
      latencyMs,
      batchUuid: result.batchUuid,
      recordsPushed: result.recordsPushed,
      recordsPulled: result.recordsPulled,
      catchUpCycle: cycleNumber,
      triggerType,
    });

    if (result.success) {
      console.log(`[AutoSync] Cycle ${cycleNumber} OK — pushed=${result.recordsPushed}, pulled=${result.recordsPulled}, duration=${result.durationMs}ms`);
    } else {
      console.warn(`[AutoSync] Cycle ${cycleNumber} FAILED — ${result.error}`);
    }

    syncDiag(`[AutoSync] cycle=${cycleNumber}, trigger=${triggerType}, outcome=${outcome}, pushed=${result.recordsPushed}, pulled=${result.recordsPulled}, latency=${latencyMs}ms`);

    return result;
  }
}

// ── Singleton ──

export const syncAutoScheduler = new SyncAutoScheduler();
