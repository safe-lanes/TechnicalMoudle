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
import {
  evaluateCertificateExpiring,
  evaluateCertificateExpired,
} from '../evaluators/certificateEvaluators';
import {
  evaluateSurveyDueSoon,
  evaluateSurveyWindowClosing,
  evaluateSurveyOverdue,
} from '../evaluators/surveyEvaluators';
import {
  evaluateDefectOverdue,
  evaluateDefectCoc,
} from '../evaluators/defectEvaluators';
import type { AlertPolicy } from '@shared/schema';
import { getCurrentTenantContext } from '../../../utils/asyncLocalStorage';

export class PmsAlertEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scanIntervalMs = 5 * 60 * 1000; // 5 minutes
  // Phase 5: per-tenant-context re-entrancy guard. Keyed on the resolved tenant
  // (tuid) so a slow scan in one tenant never overlaps ITSELF, while different
  // tenants still scan concurrently. '__single__' covers single-tenant/ship.
  private scanInProgress = new Map<string, boolean>();

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
    certExpiringAlerts: number;
    certExpiredAlerts: number;
    surveyDueSoonAlerts: number;
    surveyWindowClosingAlerts: number;
    surveyOverdueAlerts: number;
    defectOverdueAlerts: number;
    defectCocAlerts: number;
    totalCreated: number;
  }> {
    // Re-entrancy guard (per tenant context): skip if a scan for this context is
    // still running, so a scan exceeding its interval can never overlap itself.
    const ctxKey = getCurrentTenantContext()?.tuid ?? '__single__';
    if (this.scanInProgress.get(ctxKey)) {
      console.log(`[PmsAlertEngine] Scan already in progress for '${ctxKey}' — skipping this tick (no overlap)`);
      return {
        overdueAlerts: 0, lowSpareAlerts: 0, skippedCycleAlerts: 0,
        certExpiringAlerts: 0, certExpiredAlerts: 0,
        surveyDueSoonAlerts: 0, surveyWindowClosingAlerts: 0, surveyOverdueAlerts: 0,
        defectOverdueAlerts: 0, defectCocAlerts: 0, totalCreated: 0,
      };
    }
    this.scanInProgress.set(ctxKey, true);
    console.log('[PmsAlertEngine] Starting alert evaluation scan...');

    const results = {
      overdueAlerts: 0,
      lowSpareAlerts: 0,
      skippedCycleAlerts: 0,
      certExpiringAlerts: 0,
      certExpiredAlerts: 0,
      surveyDueSoonAlerts: 0,
      surveyWindowClosingAlerts: 0,
      surveyOverdueAlerts: 0,
      defectOverdueAlerts: 0,
      defectCocAlerts: 0,
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
          // Status is computed on read (no persisted 'Overdue' band to query).
          // Source from the enriched work-order list, which sets `status` to the
          // computed band, then keep the overdue vessel-scoped rows.
          const { getWorkOrdersWithComputedStatus } = await import('../../work-orders/services/workOrderService');
          const allComputed = await getWorkOrdersWithComputedStatus();
          const overdueWOs = allComputed.filter((wo: any) => wo.status === 'Overdue' && wo.dataScope === 'vessel');
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

      // 6. Certificate + Survey evaluators share LIVE cert/survey data and
      //    master-name maps — load once, only if any of those policies enabled.
      const certPolicy = policyMap.get('certificate_expiration');
      const certExpiredPolicy = policyMap.get('certificate_expired');
      if (certPolicy || certExpiredPolicy) {
        try {
          const certRepo = await import('../../cert-surveys/repositories/certificateRepository');
          const certRows = (await certRepo.getAllVesselCertificateData()) || [];
          const liveCertRows = certRows.filter((r: any) => r.isDeleted !== true);
          const masterIds = Array.from(new Set(liveCertRows.map((r: any) => r.masterId).filter(Boolean))) as string[];
          const masters = masterIds.length
            ? await certRepo.getMasterCertificatesByIds(masterIds)
            : [];
          const nameByMasterId = new Map<string, string>();
          for (const m of masters as any[]) nameByMasterId.set(m.masterId, m.certificateName);

          if (certPolicy) {
            const alerts = evaluateCertificateExpiring(liveCertRows as any, certPolicy, existingDedupeKeys, nameByMasterId);
            for (const alert of alerts) {
              await this.createAlertEvent(certPolicy, alert);
              existingDedupeKeys.add(alert.dedupeKey);
            }
            results.certExpiringAlerts = alerts.length;
          }
          if (certExpiredPolicy) {
            const alerts = evaluateCertificateExpired(liveCertRows as any, certExpiredPolicy, existingDedupeKeys, nameByMasterId);
            for (const alert of alerts) {
              await this.createAlertEvent(certExpiredPolicy, alert);
              existingDedupeKeys.add(alert.dedupeKey);
            }
            results.certExpiredAlerts = alerts.length;
          }
        } catch (err) {
          console.error('[PmsAlertEngine] Certificate evaluation failed:', err);
        }
      }

      const surveyDueSoonPolicy = policyMap.get('survey_due_soon');
      const surveyWindowPolicy = policyMap.get('survey_window_closing');
      const surveyOverduePolicy = policyMap.get('survey_overdue');
      if (surveyDueSoonPolicy || surveyWindowPolicy || surveyOverduePolicy) {
        try {
          const surveyRepo = await import('../../cert-surveys/repositories/surveyRepository');
          const surveyRows = (await surveyRepo.getAllVesselSurveyData()) || [];
          const liveSurveyRows = surveyRows.filter((r: any) => r.isDeleted !== true);
          const masterIds = Array.from(new Set(liveSurveyRows.map((r: any) => r.masterId).filter(Boolean))) as string[];
          const masters = masterIds.length
            ? await surveyRepo.getMasterSurveysByIds(masterIds)
            : [];
          const nameByMasterId = new Map<string, string>();
          for (const m of masters as any[]) nameByMasterId.set(m.masterId, m.surveyName);

          if (surveyDueSoonPolicy) {
            const alerts = evaluateSurveyDueSoon(liveSurveyRows as any, surveyDueSoonPolicy, existingDedupeKeys, nameByMasterId);
            for (const alert of alerts) {
              await this.createAlertEvent(surveyDueSoonPolicy, alert);
              existingDedupeKeys.add(alert.dedupeKey);
            }
            results.surveyDueSoonAlerts = alerts.length;
          }
          if (surveyWindowPolicy) {
            const alerts = evaluateSurveyWindowClosing(liveSurveyRows as any, surveyWindowPolicy, existingDedupeKeys, nameByMasterId);
            for (const alert of alerts) {
              await this.createAlertEvent(surveyWindowPolicy, alert);
              existingDedupeKeys.add(alert.dedupeKey);
            }
            results.surveyWindowClosingAlerts = alerts.length;
          }
          if (surveyOverduePolicy) {
            const alerts = evaluateSurveyOverdue(liveSurveyRows as any, surveyOverduePolicy, existingDedupeKeys, nameByMasterId);
            for (const alert of alerts) {
              await this.createAlertEvent(surveyOverduePolicy, alert);
              existingDedupeKeys.add(alert.dedupeKey);
            }
            results.surveyOverdueAlerts = alerts.length;
          }
        } catch (err) {
          console.error('[PmsAlertEngine] Survey evaluation failed:', err);
        }
      }

      // 7. Defect evaluators share storage.getDefects() — load once if enabled.
      const defectOverduePolicy = policyMap.get('defect_overdue');
      const defectCocPolicy = policyMap.get('defect_coc');
      if (defectOverduePolicy || defectCocPolicy) {
        try {
          const { storage } = await import('../../../storage');
          const defects = (await storage.getDefects()) || [];

          if (defectOverduePolicy) {
            const alerts = evaluateDefectOverdue(defects as any, defectOverduePolicy, existingDedupeKeys);
            for (const alert of alerts) {
              await this.createAlertEvent(defectOverduePolicy, alert);
              existingDedupeKeys.add(alert.dedupeKey);
            }
            results.defectOverdueAlerts = alerts.length;
          }
          if (defectCocPolicy) {
            const alerts = evaluateDefectCoc(defects as any, defectCocPolicy, existingDedupeKeys);
            for (const alert of alerts) {
              await this.createAlertEvent(defectCocPolicy, alert);
              existingDedupeKeys.add(alert.dedupeKey);
            }
            results.defectCocAlerts = alerts.length;
          }
        } catch (err) {
          console.error('[PmsAlertEngine] Defect evaluation failed:', err);
        }
      }

      results.totalCreated =
        results.overdueAlerts +
        results.lowSpareAlerts +
        results.skippedCycleAlerts +
        results.certExpiringAlerts +
        results.certExpiredAlerts +
        results.surveyDueSoonAlerts +
        results.surveyWindowClosingAlerts +
        results.surveyOverdueAlerts +
        results.defectOverdueAlerts +
        results.defectCocAlerts;
      console.log(
        `[PmsAlertEngine] Scan complete: UC1=${results.overdueAlerts}, UC2=${results.lowSpareAlerts}, UC3=${results.skippedCycleAlerts}, ` +
        `certExpiring=${results.certExpiringAlerts}, certExpired=${results.certExpiredAlerts}, ` +
        `surveyDueSoon=${results.surveyDueSoonAlerts}, surveyWindowClosing=${results.surveyWindowClosingAlerts}, surveyOverdue=${results.surveyOverdueAlerts}, ` +
        `defectOverdue=${results.defectOverdueAlerts}, defectCoc=${results.defectCocAlerts}, total=${results.totalCreated}`
      );
    } catch (error) {
      console.error('[PmsAlertEngine] Scan failed:', error);
    } finally {
      this.scanInProgress.delete(ctxKey);
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
