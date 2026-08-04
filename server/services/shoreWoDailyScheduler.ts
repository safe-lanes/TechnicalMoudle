/**
 * SHORE daily work-order sweep — the shore half of the dual-writer design
 * (docs/WO-DUPLICATE-GENERATION-FIX-PLAN.md §9.7, approved 2026-08-03).
 *
 * WHY: on VSAT, sync lags. If the office sees no work orders while a ship is offline,
 * the client concludes the system is broken. So shore generates on its own once-daily
 * cadence (the ship keeps its own scanner), and the post-sync RECONCILER resolves the
 * duplicates the two writers produce. Generation and reconciliation run back-to-back
 * per vessel, both respecting the sync engine's per-vessel lock.
 *
 * SCOPE: PROVISIONED vessels only (any sync_metadata row). That is exactly the set
 * where a ship exists and sync can lag. Never-provisioned vessels (85 in production)
 * are deliberately excluded — auto-generating thousands of setup WOs for vessels that
 * have no crew would be a mass write nobody asked for; Sail Admin generates those
 * manually via the (gated) Generate Now button during onboarding.
 *
 * ROLE SAFETY (the 28-Jul lesson): started at boot from the resolved role, and managed
 * afterwards by schedulerRoleWatchdog — NEVER trust the boot-time snapshot alone.
 * Registered in stopAllSchedulers (routes.ts); a missed entry orphans on PM2 restart.
 */
import { isShipInstance } from '../modules/sync/syncRole';
import { syncDiag } from '../modules/sync/syncDiagLogger';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** First sweep waits out the boot storm (migrations, watchdog settle, first syncs). */
const FIRST_RUN_DELAY_MS = 10 * 60 * 1000;

class ShoreWoDailyScheduler {
  private timer: NodeJS.Timeout | null = null;
  private firstRunTimer: NodeJS.Timeout | null = null;
  private running = false;      // scheduler armed
  private sweepInFlight = false; // a sweep is executing right now
  private intervalMs = DEFAULT_INTERVAL_MS;

  isRunning(): boolean { return this.running; }

  start(intervalMs?: number): void {
    if (this.running) return; // idempotent — watchdog may call start() repeatedly
    this.intervalMs = intervalMs || parseInt(process.env.SHORE_WO_SWEEP_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL_MS;
    this.running = true;
    this.firstRunTimer = setTimeout(() => { void this.runSweep(); }, FIRST_RUN_DELAY_MS);
    this.timer = setInterval(() => { void this.runSweep(); }, this.intervalMs);
    console.log(`[ShoreWoSweep] started — daily generation+reconcile for provisioned vessels (interval ${this.intervalMs / 3600000}h, first run in ${FIRST_RUN_DELAY_MS / 60000}min)`);
  }

  stop(): void {
    if (this.firstRunTimer) { clearTimeout(this.firstRunTimer); this.firstRunTimer = null; }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.running) console.log('[ShoreWoSweep] stopped');
    this.running = false;
  }

  /** One full sweep: per provisioned vessel — generate, then reconcile. */
  async runSweep(): Promise<void> {
    if (this.sweepInFlight) {
      console.warn('[ShoreWoSweep] previous sweep still in flight — skipping this tick');
      return;
    }
    this.sweepInFlight = true;
    try {
      // Re-check the role at RUN time, not just at start — the watchdog converges the
      // scheduler on role change, but a sweep already ticking must also refuse.
      if (await isShipInstance()) {
        console.warn('[ShoreWoSweep] instance resolves as SHIP — refusing to run the shore sweep');
        return;
      }

      const reconRepo = await import('../modules/work-orders/repositories/workOrderReconcileRepository');
      const { jobDueScanner } = await import('./jobDueScanner');

      const vessels = await reconRepo.getProvisionedVesselIds();
      syncDiag(`SHORE-WO-SWEEP START vessels=${vessels.length}`);
      let generated = 0;

      for (const vesselId of vessels) {
        try {
          // Generate ONLY — the same sweep the ship runs, scoped to this vessel. runScan
          // carries its own in-progress guard (409 path) and duplicate checks.
          //
          // RECONCILIATION DELIBERATELY REMOVED FROM THIS SWEEP (2026-08-04): duplicates
          // only become visible on shore when a sync delivers the ship's copy, and every
          // sync-complete now fires the reconciler for that vessel (sync controller,
          // post-sync trigger). Running it here too covered nothing extra. The only
          // reconcile paths are: post-sync trigger (primary; next cycle retries a miss)
          // and the manual POST /work-orders/reconciler/run (vessels that never sync).
          const scan = await jobDueScanner.runScan(vesselId);
          if (!scan.skipped) {
            generated += scan.calendarWOsGenerated + scan.rhWOsGenerated + scan.dualWOsGenerated;
          }
        } catch (err: any) {
          // One bad vessel must not abort the sweep for the rest.
          console.error(`[ShoreWoSweep] vessel ${vesselId} failed: ${err?.message || err}`);
        }
      }
      console.log(`[ShoreWoSweep] sweep complete: ${vessels.length} vessel(s), generated=${generated} (reconcile runs post-sync, not here)`);
      syncDiag(`SHORE-WO-SWEEP END vessels=${vessels.length} generated=${generated}`);
    } finally {
      this.sweepInFlight = false;
    }
  }
}

export const shoreWoDailyScheduler = new ShoreWoDailyScheduler();
