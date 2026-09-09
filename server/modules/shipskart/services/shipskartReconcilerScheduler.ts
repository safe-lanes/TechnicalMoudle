/**
 * Shipskart reconciler scheduler — SHORE-ONLY.
 *
 * Ships never talk to Shipskart, so this mirrors the auto-sync scheduler's discipline in
 * reverse: it starts only on a SHORE instance, and every tick is additionally gated by the
 * per-tenant `reconciler_enabled` flag inside runReconciliation (default FALSE, so a fresh
 * deploy cannot start pushing to a partner API by accident).
 *
 * Boot delay + interval are env-tunable. Re-entrancy guarded — a slow pass can never
 * overlap itself. Must be stopped in stopAllSchedulers (routes.ts) or a PM2 restart
 * orphans it, exactly like the sync schedulers.
 */
import { runReconciliation } from './shipskartReconcilerService';
import { isShipInstance } from '../../sync/syncRole';
import { logIdentityIntegrationExpectation } from './identityGuard';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // hourly — masters change slowly
const DEFAULT_BOOT_DELAY_MS = 5 * 60 * 1000; // let migrations/sync settle first

export class ShipskartReconcilerScheduler {
  private timer: NodeJS.Timeout | null = null;
  private bootTimer: NodeJS.Timeout | null = null;
  private inProgress = false;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    if (await isShipInstance()) {
      console.log('[ShipskartReconciler] Ship instance — scheduler NOT started (Shipskart integration is shore-only)');
      return;
    }
    const intervalMs = parseInt(process.env.SHIPSKART_RECONCILE_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL_MS;
    const bootDelayMs = parseInt(process.env.SHIPSKART_RECONCILE_BOOT_DELAY_MS || '', 10) || DEFAULT_BOOT_DELAY_MS;
    const limit = parseInt(process.env.SHIPSKART_RECONCILE_BATCH || '', 10) || undefined;

    this.bootTimer = setTimeout(() => { void this.tick(limit); }, bootDelayMs);
    this.timer = setInterval(() => { void this.tick(limit); }, intervalMs);
    this.started = true;
    // Boot-time note: per-user Purchasing depends on the x-user-id header arriving on
    // requests. This states the dependency and names the greppable tag, so a shore that is
    // not identity-integrated is found in the log, not from a mis-attributed requisition.
    logIdentityIntegrationExpectation();
    console.log(
      `[ShipskartReconciler] Shore instance — scheduler started (every ${Math.round(intervalMs / 60000)}min, ` +
      `first run in ${Math.round(bootDelayMs / 60000)}min). Each tick still requires reconciler_enabled=true for the tenant.`,
    );
  }

  private async tick(limit?: number): Promise<void> {
    if (this.inProgress) {
      console.log('[ShipskartReconciler] previous pass still running — skipping this tick');
      return;
    }
    this.inProgress = true;
    try {
      const summary = await runReconciliation({ limit });
      if (!summary.ran) return; // disabled for this tenant — runReconciliation already explains why
      console.log(`[ShipskartReconciler] pass done: vessels=${JSON.stringify(summary.vessels)} users=${JSON.stringify(summary.users)} mappings=${JSON.stringify(summary.mappings)}`);
    } catch (err: any) {
      // Never let a partner-API problem take the process down.
      console.error(`[ShipskartReconciler] pass failed: ${err?.message || err}`);
    } finally {
      this.inProgress = false;
    }
  }

  stop(): void {
    if (this.bootTimer) { clearTimeout(this.bootTimer); this.bootTimer = null; }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.started = false;
    console.log('[ShipskartReconciler] Scheduler stopped');
  }

  isStarted(): boolean { return this.started; }
}

export const shipskartReconcilerScheduler = new ShipskartReconcilerScheduler();
