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

  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[AutoSync] Scheduler already running');
      return;
    }

    if (intervalMs) {
      this.tickIntervalMs = intervalMs;
    }

    const intervalHours = (this.tickIntervalMs / 1000 / 60 / 60).toFixed(1);
    console.log(`[AutoSync] Starting scheduler (tick interval: ${intervalHours}h, boot delay: ${BOOT_DELAY_MS / 1000}s)`);

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
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[AutoSync] Scheduler stopped');
  }

  // ────────────────────────────────────────────────
  // Tick — one scheduler wake-up
  // ────────────────────────────────────────────────

  private async tick(): Promise<void> {
    try {
      // 1. Read settings on every tick (hot-reloadable)
      const settings = await syncRepo.getAllSettings();

      const enabled = settings['auto_sync_enabled'] === 'true';
      if (!enabled) {
        syncDiag('[AutoSync] auto_sync_enabled=false — skipping tick');
        return; // silent skip — don't log connectivity for disabled state
      }

      // 2. Resolve interval from settings (may differ from timer cadence)
      const intervalMinutes = parseInt(settings['sync_interval_minutes'] || '0', 10);
      if (intervalMinutes > 0) {
        const newIntervalMs = intervalMinutes * 60 * 1000;
        if (newIntervalMs !== this.tickIntervalMs) {
          console.log(`[AutoSync] Interval changed: ${this.tickIntervalMs / 60000}min → ${intervalMinutes}min (takes effect next restart)`);
          // Note: full hot-swap of setInterval is complex and fragile.
          // The setting is checked, but the actual timer cadence only changes
          // on next server restart. This is acceptable — the dashboard shows
          // the configured vs actual interval.
        }
      }

      // 3. Determine vessel ID for this ship instance
      const instanceId = settings['instance_id'] || process.env.SYNC_INSTANCE_ID || '';
      if (!instanceId) {
        console.warn('[AutoSync] No instance_id configured — cannot determine vessel. Skipping.');
        return;
      }

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
    // Re-entrancy guard
    if (this.syncInProgress.get(vesselId)) {
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
      let remaining = await syncRepo.getUnsyncedFieldLogCount(instanceId, vesselId, vesselCode);

      while (remaining > 0 && cycleNumber < maxCatchUpCycles) {
        cycleNumber++;
        console.log(`[AutoSync] Catch-up cycle ${cycleNumber}/${maxCatchUpCycles} — ${remaining} unsynced records remain`);
        syncDiag(`[AutoSync] catch-up cycle=${cycleNumber}, remaining=${remaining}, cap=${maxCatchUpCycles}`);

        const catchUpResult = await this.executeSingleCycle(instanceId, vesselId, cycleNumber, 'catch_up');

        if (!catchUpResult.success) {
          console.log(`[AutoSync] Catch-up cycle ${cycleNumber} failed — stopping catch-up`);
          break;
        }

        // Re-check remaining
        remaining = await syncRepo.getUnsyncedFieldLogCount(instanceId, vesselId, vesselCode);
      }

      if (cycleNumber > 0) {
        const finalRemaining = await syncRepo.getUnsyncedFieldLogCount(instanceId, vesselId, vesselCode);
        console.log(`[AutoSync] Catch-up complete — ran ${cycleNumber} extra cycle(s), ${finalRemaining} records still unsynced`);
      }

    } finally {
      this.syncInProgress.set(vesselId, false);
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
