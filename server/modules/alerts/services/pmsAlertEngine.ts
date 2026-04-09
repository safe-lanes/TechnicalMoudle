/**
 * PMS Alert Engine
 *
 * Periodic scanner that evaluates 3 alert use cases:
 *   UC1: Critical Job Overdue
 *   UC2: Low Critical Spares
 *   UC3: Critical Job Cycle Skipped
 *
 * Pattern follows JobDueScannerService: setInterval with runScan().
 * Registered in server/routes.ts alongside jobDueScanner.
 */

import * as alertsRepo from '../repositories/alertsRepository';
import { evaluateOverdueJobs } from '../evaluators/overdueJobsEvaluator';
import { evaluateLowSpares } from '../evaluators/lowSparesEvaluator';
import { evaluateSkippedCycles } from '../evaluators/skippedCyclesEvaluator';
import type { AlertPolicy } from '@shared/schema';

export class PmsAlertEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scanIntervalMs = 5 * 60 * 1000; // 5 minutes

  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[PmsAlertEngine] Already running');
      return;
    }

    if (intervalMs) {
      this.scanIntervalMs = intervalMs;
    }

    console.log(`[PmsAlertEngine] Starting scanner (interval: ${this.scanIntervalMs / 1000 / 60} minutes)`);

    // Defer initial scan to allow DB and migrations to complete
    setTimeout(() => {
      this.runScan().catch(err => {
        console.error('[PmsAlertEngine] Error during initial scan:', err);
      });
    }, 30000); // 30s after boot

    this.intervalId = setInterval(() => {
      this.runScan().catch(err => {
        console.error('[PmsAlertEngine] Error during scheduled scan:', err);
      });
    }, this.scanIntervalMs);

    this.isRunning = true;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[PmsAlertEngine] Stopped');
  }

  async runScan(): Promise<{
    overdueAlerts: number;
    lowSpareAlerts: number;
    skippedCycleAlerts: number;
    totalCreated: number;
  }> {
    console.log('[PmsAlertEngine] Starting alert evaluation scan...');

    const results = {
      overdueAlerts: 0,
      lowSpareAlerts: 0,
      skippedCycleAlerts: 0,
      totalCreated: 0,
    };

    try {
      // 1. Load all enabled policies
      const allPolicies = await alertsRepo.getAlertPolicies();
      const enabledPolicies = allPolicies.filter((p: AlertPolicy) => p.enabled);

      const policyMap = new Map<string, AlertPolicy>();
      for (const p of enabledPolicies) {
        policyMap.set(p.alertType, p);
      }

      // 2. Load existing dedupe keys to avoid duplicates
      const existingDedupeKeys = await alertsRepo.getExistingAlertDedupeKeys();

      // 3. Evaluate UC1: Critical Job Overdue
      const overduePolicy = policyMap.get('critical_job_overdue');
      if (overduePolicy) {
        try {
          const overdueWOs = await alertsRepo.getOverdueWorkOrders();
          const alerts = evaluateOverdueJobs(overdueWOs, overduePolicy, existingDedupeKeys);
          for (const alert of alerts) {
            await this.createAlertEvent(overduePolicy, alert);
            existingDedupeKeys.add(alert.dedupeKey); // Prevent duplicates in same run
          }
          results.overdueAlerts = alerts.length;
        } catch (err) {
          console.error('[PmsAlertEngine] UC1 evaluation failed:', err);
        }
      }

      // 4. Evaluate UC2: Low Critical Spares
      const lowSparesPolicy = policyMap.get('low_critical_spares');
      if (lowSparesPolicy) {
        try {
          const allSpares = await alertsRepo.getAllVesselSpares();
          const alerts = evaluateLowSpares(allSpares, lowSparesPolicy, existingDedupeKeys);
          for (const alert of alerts) {
            await this.createAlertEvent(lowSparesPolicy, alert);
            existingDedupeKeys.add(alert.dedupeKey);
          }
          results.lowSpareAlerts = alerts.length;
        } catch (err) {
          console.error('[PmsAlertEngine] UC2 evaluation failed:', err);
        }
      }

      // 5. Evaluate UC3: Critical Job Cycle Skipped
      const skippedPolicy = policyMap.get('critical_job_cycle_skipped');
      if (skippedPolicy) {
        try {
          const missedWOs = await alertsRepo.getWorkOrdersWithMissedCycles();
          const alerts = evaluateSkippedCycles(missedWOs, skippedPolicy, existingDedupeKeys);
          for (const alert of alerts) {
            await this.createAlertEvent(skippedPolicy, alert);
            existingDedupeKeys.add(alert.dedupeKey);
          }
          results.skippedCycleAlerts = alerts.length;
        } catch (err) {
          console.error('[PmsAlertEngine] UC3 evaluation failed:', err);
        }
      }

      results.totalCreated = results.overdueAlerts + results.lowSpareAlerts + results.skippedCycleAlerts;
      console.log(`[PmsAlertEngine] Scan complete: UC1=${results.overdueAlerts}, UC2=${results.lowSpareAlerts}, UC3=${results.skippedCycleAlerts}, total=${results.totalCreated}`);
    } catch (error) {
      console.error('[PmsAlertEngine] Scan failed:', error);
    }

    return results;
  }

  private async createAlertEvent(
    policy: AlertPolicy,
    alert: { dedupeKey: string; objectType: string; objectId: string; vesselId: string; state: string; priority: string; payload: Record<string, any> }
  ): Promise<void> {
    try {
      const event = await alertsRepo.createAlertEvent({
        policyId: policy.id,
        policyUuid: policy.apuuid,
        alertType: policy.alertType,
        priority: alert.priority,
        objectType: alert.objectType,
        objectId: alert.objectId,
        vesselId: alert.vesselId,
        dedupeKey: alert.dedupeKey,
        state: alert.state,
        payload: JSON.stringify(alert.payload),
      });

      // Create in-app delivery if enabled
      if (policy.inAppEnabled && event) {
        await alertsRepo.createAlertDelivery({
          eventId: event.id,
          eventUuid: event.aeuuid,
          channel: 'in_app',
          recipient: 'all', // Role-based filtering happens at query time
          status: 'sent',
        });
      }
    } catch (err: any) {
      // Dedupe key collision — safe to ignore
      if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
        return;
      }
      throw err;
    }
  }
}

export const pmsAlertEngine = new PmsAlertEngine();
