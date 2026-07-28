/**
 * SchedulerRoleWatchdog — heals the boot-time ship/shore snapshot.
 *
 * WHY THIS EXISTS (root cause reproduced 2026-07-28, dev + local pilot):
 * scheduler placement (jobDueScanner + syncAutoScheduler) was decided ONCE at
 * boot from the resolved instance id (routes.ts). DB sync_settings.instance_id
 * wins over env — so a ship whose DB carried a non-SHIP value at the moment
 * the process booted (placeholder, pre-provisioning, mid-re-tag) came up as
 * "shore", silently skipped both schedulers, and stayed that way FOREVER even
 * after the DB value was corrected: every other code path resolves the role
 * live, so manual Sync Now / field logging kept working like a ship while
 * auto-sync and WO generation were dead. Field signature: "manual works, auto
 * doesn't", zero [AutoSync] lines in the SyncDiag file, and the settings-save
 * endpoint printing "Scheduler not running — interval preference recorded".
 *
 * The watchdog re-resolves the role every WATCHDOG_INTERVAL_MS and converges
 * the schedulers to it, loudly (console + SyncDiag):
 *   • ship  + scheduler not running  → start it (the self-heal)
 *   • shore + scheduler running      → stop it (role re-tagged away from ship)
 *
 * Safe by construction: start() on both schedulers is idempotent (isRunning
 * guard), an auto tick can never overlap a manual sync (engine per-vessel
 * lock), and a check never throws (a DB blip just means "try again next
 * interval"). Runs on ship AND shore — the whole point is that boot-time role
 * may be wrong in either direction.
 */

import { jobDueScanner } from './jobDueScanner';
import { syncAutoScheduler } from '../modules/sync/autoSyncScheduler';
import { isShipInstance } from '../modules/sync/syncRole';
import { syncDiag } from '../modules/sync/syncDiagLogger';

const DEFAULT_WATCHDOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SchedulerRoleWatchdog {
  private timer: NodeJS.Timeout | null = null;
  private checkInProgress = false;
  private lastRole: 'ship' | 'shore' | null = null;
  private jobDueScanIntervalMs = 24 * 60 * 60 * 1000;

  start(opts: { jobDueScanIntervalMs: number; initialRole: 'ship' | 'shore' }): void {
    if (this.timer) return;
    this.jobDueScanIntervalMs = opts.jobDueScanIntervalMs;
    this.lastRole = opts.initialRole;
    const intervalMs =
      parseInt(process.env.SCHEDULER_ROLE_WATCHDOG_MS || '', 10) || DEFAULT_WATCHDOG_INTERVAL_MS;
    this.timer = setInterval(() => {
      void this.check();
    }, intervalMs);
    console.log(
      `[RoleWatchdog] Started (every ${Math.round(intervalMs / 1000)}s) — boot role: ${opts.initialRole}. ` +
        `Re-resolves ship/shore from sync_settings.instance_id and starts/stops the ship schedulers to match.`,
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async check(): Promise<void> {
    if (this.checkInProgress) return;
    this.checkInProgress = true;
    try {
      const ship = await isShipInstance();
      const role: 'ship' | 'shore' = ship ? 'ship' : 'shore';

      if (this.lastRole !== null && role !== this.lastRole) {
        console.warn(
          `[RoleWatchdog] ⚠️ Instance role changed ${this.lastRole} → ${role} since the last check ` +
            `(sync_settings.instance_id was re-tagged while the app was running).`,
        );
      }
      this.lastRole = role;

      if (ship) {
        if (!syncAutoScheduler.isStarted()) {
          console.warn(
            '[RoleWatchdog] 🩹 SELF-HEAL: this instance resolves as a SHIP but the auto-sync ' +
              'scheduler is not running (stale boot-time role decision) — starting it now.',
          );
          syncDiag(
            '[RoleWatchdog] SELF-HEAL: instance resolves as SHIP but auto-sync scheduler was not running — started late (boot-time role decision was stale).',
          );
          await syncAutoScheduler.start();
        }
        if (!jobDueScanner.isStarted()) {
          console.warn(
            '[RoleWatchdog] 🩹 SELF-HEAL: this instance resolves as a SHIP but the job-due scanner ' +
              'is not running (stale boot-time role decision) — starting it now.',
          );
          syncDiag(
            '[RoleWatchdog] SELF-HEAL: instance resolves as SHIP but jobDueScanner was not running — started late (boot-time role decision was stale).',
          );
          jobDueScanner.start(this.jobDueScanIntervalMs);
        }
      } else {
        if (syncAutoScheduler.isStarted() || jobDueScanner.isStarted()) {
          console.warn(
            '[RoleWatchdog] Instance now resolves as SHORE — stopping ship-only schedulers ' +
              '(auto-sync / job-due scanner). Sync stays ship-initiated.',
          );
          syncDiag(
            '[RoleWatchdog] Instance re-resolved as SHORE — ship-only schedulers stopped.',
          );
          syncAutoScheduler.stop();
          jobDueScanner.stop();
        }
      }
    } catch (err: any) {
      // Never let the watchdog take anything down — a transient DB error just
      // means the next interval re-checks.
      console.warn(`[RoleWatchdog] Check failed (will retry next interval): ${err?.message || err}`);
    } finally {
      this.checkInProgress = false;
    }
  }
}

export const schedulerRoleWatchdog = new SchedulerRoleWatchdog();
