import { storage } from "../storage";
import type { WorkOrder, Job, Component, PmsVesselSettings } from "@shared/schema";
import { logFieldChanges } from '../modules/sync';
import { computeWorkOrderStatus, VesselGraceSettings, ComputedWorkOrderStatus, CompanyStandardGraceConfig, buildCompanyGraceConfig } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";

/**
 * Work Order Status Recalculator Service
 * 
 * Runs every minute to recalculate and persist work order statuses.
 * When grace period settings change, work order statuses are updated automatically.
 * 
 * Key business rules:
 * - Only recalculates statuses for non-terminal work orders
 * - Terminal statuses (Completed, Rejected) are NOT recalculated
 * - Uses vessel-specific grace period settings
 * - For RH-based work orders, fetches current component RH
 */

export class WorkOrderStatusRecalculatorService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scanIntervalMs = 1 * 60 * 1000; // 1 minute

  /**
   * Start the scheduler to run periodically
   */
  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[StatusRecalculator] Already running');
      return;
    }

    if (intervalMs) {
      this.scanIntervalMs = intervalMs;
    }

    console.log(`[StatusRecalculator] Starting scheduler (interval: ${this.scanIntervalMs / 1000 / 60} minutes)`);
    
    // Defer initial recalculation to allow port detection during startup
    setTimeout(() => {
      this.runRecalculation().catch(err => {
        console.error('[StatusRecalculator] Error during initial recalculation:', err);
      });
    }, 10000);

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runRecalculation().catch(err => {
        console.error('[StatusRecalculator] Error during scheduled recalculation:', err);
      });
    }, this.scanIntervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[StatusRecalculator] Stopped');
  }

  /**
   * Terminal statuses that should NOT be recalculated
   * These represent work orders that are finalized
   */
  private isTerminalStatus(status: string | null | undefined): boolean {
    if (!status) return false;
    const normalizedStatus = status.toLowerCase().trim();
    return ['completed', 'rejected', 'closed', 'cancelled', 'canceled'].includes(normalizedStatus);
  }

  /**
   * Run a full recalculation of all work order statuses
   * Only recalculates non-terminal work orders
   */
  async runRecalculation(): Promise<{
    workOrdersChecked: number;
    statusesUpdated: number;
  }> {
    console.log('[StatusRecalculator] Starting status recalculation...');
    
    const results = {
      workOrdersChecked: 0,
      statusesUpdated: 0
    };

    try {
      // Get all work orders
      const allWorkOrders = await storage.getWorkOrders();
      
      // Filter to only non-terminal work orders
      const activeWorkOrders = allWorkOrders.filter(wo => !this.isTerminalStatus(wo.status));
      results.workOrdersChecked = activeWorkOrders.length;

      if (activeWorkOrders.length === 0) {
        console.log('[StatusRecalculator] No active work orders to recalculate');
        return results;
      }

      // Cache vessel settings, jobs, and components
      const vesselSettingsCache = new Map<string, PmsVesselSettings | null>();
      const graceSettingsCache = new Map<string, VesselGraceSettings>();
      const jobsCache = new Map<string, Job>();
      const componentsCache = new Map<string, Component>();

      // Prefetch jobs for RH-based work orders
      const jobIds = new Set<string>();
      activeWorkOrders.forEach(wo => {
        if (wo.jobId) jobIds.add(wo.jobId);
      });
      
      for (const jobId of Array.from(jobIds)) {
        const job = await storage.getJob(jobId);
        if (job) jobsCache.set(jobId, job);
      }

      // Prefetch components for RH-based jobs
      const componentIds = new Set<string>();
      jobsCache.forEach(job => {
        if (job.componentId) componentIds.add(job.componentId);
      });
      
      for (const componentId of Array.from(componentIds)) {
        const component = await storage.getComponent(componentId);
        if (component) componentsCache.set(componentId, component);
      }

      // Load company standard grace config once
      const companyGraceRow = await storage.getCompanyStandardGraceSettings();
      const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);

      // Prefetch vessel settings
      const vesselIds = new Set<string>();
      activeWorkOrders.forEach(wo => {
        if (wo.vesselId) vesselIds.add(wo.vesselId);
      });
      
      for (const vesselId of Array.from(vesselIds)) {
        const settings = await storage.getPmsVesselSettings(vesselId);
        vesselSettingsCache.set(vesselId, settings || null);
        
        if (settings) {
          const graceEntry: VesselGraceSettings = {
            calendarGraceMode: (settings.calendarGraceMode as 'COMPANY_STANDARD' | 'CUSTOM_DAYS') ?? 'COMPANY_STANDARD',
            calendarGraceDays: settings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
            rhGraceHours: settings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
            rhLeadTimeHours: settings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
          };

          if (settings.settingsMode === 'CUSTOM') {
            graceEntry.calendarGraceMode = 'CUSTOM_DAYS';
            graceEntry.vesselCalendarGraceConfig = {
              graceMethod: (settings.calendarGraceMethod || 'FIXED_DAYS') as CompanyStandardGraceConfig['graceMethod'],
              graceValue: settings.calendarGraceValue ?? 7,
              scope: (settings.calendarGraceScope || 'ALL_WORK_ORDERS') as CompanyStandardGraceConfig['scope'],
              fallbackMethod: settings.calendarFallbackMethod as CompanyStandardGraceConfig['graceMethod'] | null,
              fallbackGraceDays: settings.calendarFallbackGraceDays ?? null,
            };
            graceEntry.vesselRhGraceConfig = {
              graceMethod: (settings.rhGraceMethod || 'FIXED_HOURS') as 'FIXED_HOURS' | 'MONTH_END' | 'SPECIFIC_DATE_NEXT_MONTH',
              graceValue: settings.rhGraceValue ?? 168,
              scope: (settings.rhGraceScope || 'ALL_WORK_ORDERS') as 'ALL_WORK_ORDERS' | 'LAST_WEEK_OF_MONTH',
              fallbackMethod: settings.rhFallbackMethod as 'MONTH_END' | 'FIXED_HOURS' | null,
              fallbackGraceHours: settings.rhFallbackGraceHours ?? null,
            };
          } else if (companyGraceRow) {
            graceEntry.vesselRhGraceConfig = {
              graceMethod: (companyGraceRow.rhGraceMethod || 'FIXED_HOURS') as 'FIXED_HOURS' | 'MONTH_END' | 'SPECIFIC_DATE_NEXT_MONTH',
              graceValue: companyGraceRow.rhGraceValue ?? 168,
              scope: (companyGraceRow.rhGraceScope || 'ALL_WORK_ORDERS') as 'ALL_WORK_ORDERS' | 'LAST_WEEK_OF_MONTH',
              fallbackMethod: companyGraceRow.rhFallbackMethod as 'MONTH_END' | 'FIXED_HOURS' | null,
              fallbackGraceHours: companyGraceRow.rhFallbackGraceHours ?? null,
            };
          }

          graceSettingsCache.set(vesselId, graceEntry);
        }
      }

      // Recalculate each work order
      for (const wo of activeWorkOrders) {
        let currentRH: number | null = null;
        let dueRH: number | null = null;
        let job: Job | undefined;

        // For RH-based or Dual Frequency work orders, get the current running hours from the component
        // FALLBACK: If component data is missing, use work order's own currentReading
        if (wo.maintenanceBasis === 'Running Hours' || wo.maintenanceBasis === 'Dual Frequency') {
          if (wo.jobId) {
            job = jobsCache.get(wo.jobId);
            if (job?.componentId) {
              const component = componentsCache.get(job.componentId);
              if (component?.currentCumulativeRH != null) {
                currentRH = parseFloat(String(component.currentCumulativeRH));
              }
            }
          }
          // Fallback to work order's currentReading if component data is missing
          if (currentRH === null && wo.currentReading) {
            currentRH = parseFloat(wo.currentReading);
          }
          // Get the due RH from nextDueReading (work order always has this)
          if (wo.nextDueReading) {
            dueRH = parseFloat(wo.nextDueReading);
          }
        }

        // Get vessel grace settings
        const vesselGraceSettings = wo.vesselId ? graceSettingsCache.get(wo.vesselId) : undefined;
        const vesselSettings = wo.vesselId ? vesselSettingsCache.get(wo.vesselId) : null;

        // Determine RH lead time based on job criticality (for Planned → Due transition)
        // Needed for Running Hours AND Dual Frequency WOs
        if (!job && wo.jobId) {
          job = jobsCache.get(wo.jobId);
        }
        const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || String(job?.classRelated) === 'true';
        const rhLeadTimeHours = (wo.maintenanceBasis === 'Running Hours' || wo.maintenanceBasis === 'Dual Frequency')
          ? (isJobCritical
              ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
              : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
          : undefined;

        // Determine calendar lead time based on job criticality (for Planned → Due transition)
        // Needed for Calendar AND Dual Frequency WOs
        const calendarLeadTimeDays = (wo.maintenanceBasis !== 'Running Hours') && vesselSettings
          ? (isJobCritical
              ? vesselSettings.calendarLeadDaysCritical
              : vesselSettings.calendarLeadDaysNonCritical)
          : undefined;

        // Compute new status
        const computedStatus = computeWorkOrderStatus({
          dueDate: wo.dueDate,
          dueRH,
          currentRH,
          isExecution: wo.isExecution,
          status: wo.status,
          completionDateTime: wo.dateCompleted,
          maintenanceBasis: wo.maintenanceBasis || undefined,
          vesselGraceSettings,
          rhLeadTimeHours,
          calendarLeadTimeDays,
          companyGraceConfig
        });

        // Only update if status has changed
        if (computedStatus !== wo.status) {
          const updated = await storage.updateWorkOrder(wo.wouuid, { status: computedStatus });
          // Sync field logging — workOrderStatusRecalculator
          try { await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, updated, 'system'); } catch (e) { console.error('[FieldLogger] WO status recalc:', e); }
          results.statusesUpdated++;
          console.log(`📝 [StatusRecalculator] Updated WO ${wo.workOrderNo}: ${wo.status} → ${computedStatus}`);
        }
      }

      console.log(`[StatusRecalculator] Recalculation complete: ${results.statusesUpdated}/${results.workOrdersChecked} statuses updated`);
    } catch (error) {
      console.error('[StatusRecalculator] Recalculation failed:', error);
      throw error;
    }

    return results;
  }

  /**
   * Force an immediate recalculation (for use when settings change)
   */
  async forceRecalculation(): Promise<{
    workOrdersChecked: number;
    statusesUpdated: number;
  }> {
    console.log('[StatusRecalculator] Force recalculation triggered (settings changed)');
    return this.runRecalculation();
  }
}

// Export singleton instance
export const workOrderStatusRecalculator = new WorkOrderStatusRecalculatorService();
