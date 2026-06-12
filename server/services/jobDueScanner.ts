import { workOrderService } from "./workOrderService";
import { jobService } from "./jobService";
import { storage } from "../storage";
import { generatePlannedWorkOrderNumber } from "../utils/workOrderNumbering";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import { computeWorkOrderStatus, type VesselGraceSettings, buildCompanyGraceConfig } from "@shared/workOrders/status";
import { 
  isBlockingStatus, 
  extractJobNoFromWorkOrderNo,
  buildJobsWithActiveWOSet,
  buildRhCycleWOMap,
  buildCalendarCycleWOMap,
  findBlockingWOForJob
} from "../utils/workOrderStatus";
import type { InsertWorkOrder, Job, PmsVesselSettings, Component } from "@shared/schema";
import { parseWorkOrderDate } from "@shared/workOrders/dateParse";

/**
 * Determine if a job is "critical" based on its jobPriority
 * Critical and High priority jobs are considered critical for lead time purposes
 */
function isJobCritical(job: Job): boolean {
  const priority = job.jobPriority?.toLowerCase() || '';
  return priority === 'critical' || priority === 'high';
}

/**
 * Get the appropriate RH lead time in hours for a job based on its priority
 * This is used for the Planned → Due transition (vessel-configured), NOT for WO generation.
 * WO generation always uses the fixed RH_GENERATION_ADVANCE_HOURS constant.
 */
function getRhLeadHours(job: Job, settings: PmsVesselSettings | null | undefined): number {
  if (!settings) {
    return isJobCritical(job) 
      ? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL 
      : WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL;
  }
  return isJobCritical(job)
    ? (settings.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
    : (settings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL);
}

/**
 * Job Due Scanner Service
 * Scans all jobs and generates work orders when they become due
 * Supports both Calendar-based and Running Hours-based jobs
 */

export class JobDueScannerService {
  private isRunning = false;        // guards double-start() of the scheduler
  private runInProgress = false;    // guards re-entrant ticks (a run still in progress)
  private intervalId: NodeJS.Timeout | null = null;
  private scanIntervalMs = 1 * 60 * 1000; // 1 minute

  /**
   * Start the scheduler to run periodically
   */
  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[JobDueScanner] Already running');
      return;
    }

    if (intervalMs) {
      this.scanIntervalMs = intervalMs;
    }

    console.log(`[JobDueScanner] Starting scheduler (interval: ${this.scanIntervalMs / 1000 / 60} minutes)`);
    
    // Defer initial scan to allow port detection during startup
    setTimeout(() => {
      this.runScan().catch(err => {
        console.error('[JobDueScanner] Error during initial scan:', err);
      });
    }, 10000);

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runScan().catch(err => {
        console.error('[JobDueScanner] Error during scheduled scan:', err);
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
    console.log('[JobDueScanner] Stopped');
  }

  /**
   * Run a full scan of jobs and generate work orders as needed.
   * @param scopeVesselId optional — when provided, only this vessel's jobs/WOs
   *   are scanned. Used by the office on-demand "Generate Now" action. When
   *   omitted, scans every vessel in this DB (the daily ship-side schedule;
   *   a ship DB holds only its own vessel anyway).
   * @returns the counts, plus `skipped: true` if a run was already in progress.
   */
  async runScan(scopeVesselId?: string): Promise<{
    calendarJobsChecked: number;
    calendarWOsGenerated: number;
    rhJobsChecked: number;
    rhWOsGenerated: number;
    dualJobsChecked: number;
    dualWOsGenerated: number;
    skipped?: boolean;
  }> {
    // Re-entrancy guard: if the previous scan is still running, skip this tick
    // rather than stacking concurrent runs (which compounds heap + blocks the event loop).
    if (this.runInProgress) {
      console.log('[JobDueScanner] Previous scan still running — skipping this run');
      return {
        calendarJobsChecked: 0,
        calendarWOsGenerated: 0,
        rhJobsChecked: 0,
        rhWOsGenerated: 0,
        dualJobsChecked: 0,
        dualWOsGenerated: 0,
        skipped: true
      };
    }
    this.runInProgress = true;

    const scopeLabel = scopeVesselId ? `vessel ${scopeVesselId}` : 'all vessels';
    console.log(`[JobDueScanner] Starting job due scan (${scopeLabel})...`);

    const results = {
      calendarJobsChecked: 0,
      calendarWOsGenerated: 0,
      rhJobsChecked: 0,
      rhWOsGenerated: 0,
      dualJobsChecked: 0,
      dualWOsGenerated: 0
    };

    try {
      // Process Calendar-based jobs using existing method
      const calendarResults = await workOrderService.autoGenerateWorkOrdersFromJobs(scopeVesselId);
      results.calendarJobsChecked = calendarResults.checked;
      results.calendarWOsGenerated = calendarResults.generated;

      // Process Running Hours-based jobs
      const rhResults = await this.processRunningHoursJobs(scopeVesselId);
      results.rhJobsChecked = rhResults.checked;
      results.rhWOsGenerated = rhResults.generated;

      // Process Dual Frequency jobs (whichever-first: Calendar OR RH)
      const dualResults = await this.processDualFrequencyJobs(scopeVesselId);
      results.dualJobsChecked = dualResults.checked;
      results.dualWOsGenerated = dualResults.generated;

      console.log(`[JobDueScanner] Scan complete (${scopeLabel}): Calendar (${results.calendarWOsGenerated}/${results.calendarJobsChecked} WOs), RH (${results.rhWOsGenerated}/${results.rhJobsChecked} WOs), Dual (${results.dualWOsGenerated}/${results.dualJobsChecked} WOs)`);
    } catch (error) {
      console.error('[JobDueScanner] Scan failed:', error);
      throw error;
    } finally {
      this.runInProgress = false;
    }

    return results;
  }

  /**
   * Process Running Hours-based jobs and generate work orders when due
   * TRIGGER 1: RH-based auto-generation per new WO generation rules
   * 
   * Applicability:
   * - job.maintenanceBasis = 'Running Hours'
   * - Component RH Counter Type = MASTER or INHERITED
   * - job.isActive = true
   * 
   * Calculations:
   * - RH_last_done = job.lastDoneRH (stored at last WO completion)
   * - F = frequency_rh (intervalRunningHour)
   * - LT = lead_time_rh
   * - RH_effective_current = MASTER → rhCurrentMaster, INHERITED → rhCurrentInheritedCached
   * - RH_due = RH_last_done + F
   * - RH_generate = RH_due - LT
   * 
   * Auto-generation condition:
   * - RH_effective_current >= RH_generate
   * - AND no DUE/OVERDUE/PENDING APPROVAL/POSTPONED WO exists for same job + same RH_due cycle
   */
  private async processRunningHoursJobs(scopeVesselId?: string): Promise<{ checked: number; generated: number }> {
    const skipReasons = {
      noComponentId: 0,
      componentNotFound: 0,
      wrongCounterType: 0,
      belowThreshold: 0,
      legacyBlocking: 0,
      noLinkedComponents: 0,
      existingWO: 0,
      cycleExists: 0,
    };

    // Get only active RH-based jobs (vessel-scoped when an on-demand scope is given)
    const allJobs = await storage.getJobs(scopeVesselId);
    const rhJobs = allJobs.filter(job => 
      job.maintenanceBasis === 'Running Hours' && 
      job.isActive !== false && // Job must be active
      job.intervalRunningHour && job.intervalRunningHour > 0 // Must have valid frequency
    );

    // Get work orders to check for duplicates (scoped to the same vessel when on-demand).
    // Cross-vessel uniqueness is preserved via vessel-scoped keys regardless.
    const allWorkOrders = await storage.getWorkOrders(scopeVesselId);
    
    // JOB-LEVEL LOCK: Build sets of jobs that already have an active WO
    // Rule: "one active WO per job at a time" - prevents ANY duplicate regardless of cycle
    // Uses both jobId (primary) and jobNo (fallback) for comprehensive blocking
    // Note: byJobNo is now vessel-scoped with key format: `${vesselId}|${jobNo}`
    const activeWOSets = buildJobsWithActiveWOSet(allWorkOrders);
    
    // CYCLE UNIQUENESS: Build a map by (vesselId + jobNo + cycleDueRh) for cycle-level check
    // Uses case-insensitive status matching via isBlockingStatus()
    // Key format is now: `${vesselId}|${jobNo}|${cycleDueRh}` for vessel-scoped uniqueness
    const existingCycleWOs = buildRhCycleWOMap(allWorkOrders);
    
    // Cache for components - will fetch lazily per vessel
    const componentCache = new Map<string, any>();
    const vesselComponentsFetched = new Set<string>();
    
    const getComponentFromCache = async (componentId: string, vesselId: string | null): Promise<any | undefined> => {
      // Ensure we've fetched components for this vessel
      if (vesselId && !vesselComponentsFetched.has(vesselId)) {
        const vesselComponents = await storage.getComponents(vesselId);
        vesselComponents.forEach(c => {
          componentCache.set(c.id, c);
          if (c.cuuid) componentCache.set(c.cuuid, c);
        });
        vesselComponentsFetched.add(vesselId);
      }
      return componentCache.get(componentId);
    };

    // Prefetch ALL job→component links for the candidate RH jobs in ONE query
    // (kills the per-job getLinkedComponentsForJob N+1 → lower heap/CPU).
    const rhLinksMap = await storage.getLinkedComponentsForJobs(rhJobs.map(j => j.juuid));

    let generated = 0;

    for (const job of rhJobs) {
      // Get the component from cache to check RH counter type and current RH
      if (!job.componentId) {
        skipReasons.noComponentId++;
        continue;
      }
      const component = await getComponentFromCache(job.componentId, job.vesselId);
      if (!component) {
        skipReasons.componentNotFound++;
        continue;
      }

      // Check RH counter type - must be MASTER or INHERITED
      const rhCounterType = component.rhCounterType;
      if (rhCounterType !== 'MASTER' && rhCounterType !== 'INHERITED') {
        skipReasons.wrongCounterType++;
        continue;
      }

      // Determine effective current RH based on counter type
      let rhEffectiveCurrent: number;
      if (rhCounterType === 'MASTER') {
        rhEffectiveCurrent = parseFloat(component.rhCurrentMaster || '0');
      } else {
        // INHERITED - use cached value from master
        rhEffectiveCurrent = parseFloat(component.rhCurrentInheritedCached || '0');
      }

      // F = frequency_rh
      const frequencyRH = job.intervalRunningHour || 0;
      if (frequencyRH <= 0) continue;

      // Use FIXED 720-hour generation advance (business rule: generation is fixed, not vessel-driven)
      const generationAdvanceRH = WORK_ORDER_THRESHOLDS.RH_GENERATION_ADVANCE_HOURS;

      // LEGACY FALLBACK: Check if job has any active WO with NULL/empty componentCode
      // If so, block ALL generation for this job to protect legacy data
      const legacyBlockingWO = allWorkOrders.find(wo => {
        if (!isBlockingStatus(wo.status)) return false;
        if (wo.componentCode && wo.componentCode !== '') return false;
        if (wo.jobId === job.juuid) return true;
        const woJobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
        if (woJobNo === job.jobNo && wo.vesselId === job.vesselId) return true;
        return false;
      });

      if (legacyBlockingWO) {
        skipReasons.legacyBlocking++;
        continue;
      }
      
      // Get ALL linked components for this job from the prefetched batch map
      // (copy so the per-job fallback push below never mutates the shared array).
      const linkedComponents = [...(rhLinksMap.get(job.juuid) ?? [])];

      // If no linked components found, fall back to job's primary component
      if (linkedComponents.length === 0 && job.componentId) {
        linkedComponents.push({
          componentId: job.componentId,
          componentCode: job.componentCode || component.componentCode || '',
          componentName: job.componentName || component.name || ''
        });
      }
      
      if (linkedComponents.length === 0) {
        skipReasons.noLinkedComponents++;
        continue;
      }
      
      // Generate a work order for EACH linked component (with per-component RH tracking)
      for (const linkedComponent of linkedComponents) {
        const componentCode = linkedComponent.componentCode;
        const componentName = linkedComponent.componentName;
        
        if (!componentCode) {
          console.warn(`⚠️ No component code for linked component of RH job ${job.jobNo} - skipping`);
          continue;
        }

        // Use component-specific lastDoneRH from link table, fall back to job-level
        const rhLastDone = parseFloat(linkedComponent.lastDoneRH || job.lastDoneRH || '0');
        
        // Compute per-component current RH from the linked component's own record
        let componentCurrentRH = rhEffectiveCurrent;
        const linkedComp = await getComponentFromCache(linkedComponent.componentId, job.vesselId);
        if (linkedComp) {
          const lcCounterType = linkedComp.rhCounterType;
          if (lcCounterType === 'MASTER') {
            componentCurrentRH = parseFloat(linkedComp.rhCurrentMaster || '0');
          } else if (lcCounterType === 'INHERITED') {
            componentCurrentRH = parseFloat(linkedComp.rhCurrentInheritedCached || '0');
          }
        }

        // Calculate per-component cycle values using fixed generation advance
        const rhDue = rhLastDone + frequencyRH;
        const rhGenerate = Math.max(0, rhDue - generationAdvanceRH);

        // Check auto-generation condition per component using component's own current RH
        if (componentCurrentRH < rhGenerate) {
          skipReasons.belowThreshold++;
          continue;
        }
        
        // COMPONENT-LEVEL CHECK: Check if WO already exists for this job + component combination
        const existingWOForComponent = allWorkOrders.find(wo =>
          wo.jobId === job.juuid &&
          wo.componentCode === componentCode &&
          isBlockingStatus(wo.status)
        );
        
        if (existingWOForComponent) {
          skipReasons.existingWO++;
          continue;
        }
        
        // Component-specific cycle key for RH: `${vesselId}|${jobNo}|${componentCode}|${rhDue}`
        const componentCycleKey = `${job.vesselId || 'unknown'}|${job.jobNo}|${componentCode}|${rhDue}`;
        if (existingCycleWOs.has(componentCycleKey)) {
          skipReasons.cycleExists++;
          continue;
        }
        
        const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || undefined);
        
        const workOrderData: InsertWorkOrder = {
          vesselId: job.vesselId,
          component: componentName,
          componentCode: componentCode, // Use linked component's code
          jobId: job.juuid, // Link to job for cycle tracking
          workOrderNo: workOrderNo,
          templateCode: workOrderNo,
          jobTitle: job.jobTitle,
          assignedTo: job.assignedTo || 'Unassigned',
          dueDate: undefined, // RH-based jobs don't have calendar due date
          nextDueReading: String(rhDue), // Store the due RH value
          currentReading: String(componentCurrentRH), // Store per-component current RH at generation time
          status: 'Active', // Start as Active/Planned; recalculator will move to Due when within vessel lead time
          taskType: job.maintenanceType,
          maintenanceBasis: job.maintenanceBasis,
          frequencyValue: job.frequencyValue?.toString(),
          frequencyUnit: job.frequencyUnit,
          intervalRunningHour: job.intervalRunningHour,
          jobPriority: job.jobPriority,
          classRelated: job.classRelated,
          briefWorkDescription: job.briefWorkDescription,
          department: job.department,
          requiredSpareParts: job.requiredSpareParts || [],
          requiredTools: job.requiredTools || [],
          safetyRequirements: job.safetyRequirements || {
            ppeRequirements: [],
            permitRequirements: [],
            otherRequirements: []
          },
          // === RH CYCLE SNAPSHOTS (TRIGGER 1) ===
          driverType: 'RH',
          cycleDueRhSnapshot: String(rhDue),
          generateRhSnapshot: String(rhGenerate),
          dueRhSnapshot: String(rhDue),
          effectiveRhAtGeneration: String(rhEffectiveCurrent),
          rhLastDoneSnapshot: String(rhLastDone),
        };
        
        try {
          const createdWO = await workOrderService.createWorkOrder(workOrderData);
          generated++;
          
          // Add to maps AND allWorkOrders to prevent duplicate generation in same run
          existingCycleWOs.set(componentCycleKey, createdWO as any);
          allWorkOrders.push(createdWO); // Keep in-memory array in sync for subsequent checks
          
          const priorityLabel = isJobCritical(job) ? 'Critical' : 'Non-Critical';
          console.log(`✅ [RH Trigger 1] Auto-generated WO ${workOrderNo} for ${priorityLabel} job ${job.jobNo} -> component ${componentCode} (status: Active/Planned)`);
          console.log(`   RH_last_done=${rhLastDone}, F=${frequencyRH}, Generation advance=${generationAdvanceRH}hrs`);
          console.log(`   RH_due=${rhDue}, RH_generate=${rhGenerate}, RH_current=${rhEffectiveCurrent}`);
        } catch (error: any) {
          console.warn(`⚠️ Failed to create WO for RH job ${job.jobNo} + component ${componentCode}: ${error.message}`);
        }
      }
    }

    console.log(`📋 [RH WO Gen] Using fixed generation advance: ${WORK_ORDER_THRESHOLDS.RH_GENERATION_ADVANCE_HOURS} hours. Initial status: Active (Planned).`);

    const totalSkipped = Object.values(skipReasons).reduce((a, b) => a + b, 0);
    if (rhJobs.length > 0 && generated === 0) {
      console.log(`[RH Scan Diagnostic] ${rhJobs.length} RH jobs checked, ${generated} WOs generated. Skip breakdown: belowThreshold=${skipReasons.belowThreshold}, wrongCounterType=${skipReasons.wrongCounterType}, existingWO=${skipReasons.existingWO}, cycleExists=${skipReasons.cycleExists}, legacyBlocking=${skipReasons.legacyBlocking}, noComponentId=${skipReasons.noComponentId}, componentNotFound=${skipReasons.componentNotFound}, noLinkedComponents=${skipReasons.noLinkedComponents}`);
    }

    return { checked: rhJobs.length, generated };
  }

  /**
   * Process Dual Frequency jobs — whichever-first: Calendar OR RH
   * A WO is generated when EITHER the calendar leg OR the RH leg reaches its threshold.
   * The WO records BOTH calendar and RH snapshots (D6) plus which leg triggered (D5).
   *
   * Applicability:
   * - job.maintenanceBasis = 'Dual Frequency'
   * - Component RH Counter Type = MASTER or INHERITED (D3)
   * - job.isActive = true
   * - job.intervalRunningHour > 0 AND job.nextDueDate set
   */
  private async processDualFrequencyJobs(scopeVesselId?: string): Promise<{ checked: number; generated: number }> {
    const skipReasons = {
      noComponentId: 0,
      componentNotFound: 0,
      wrongCounterType: 0,
      neitherLegDue: 0,
      legacyBlocking: 0,
      noLinkedComponents: 0,
      existingWO: 0,
      missingCalendarData: 0,
      missingRHData: 0,
    };

    // Get only active Dual Frequency jobs (vessel-scoped when an on-demand scope is given)
    const allJobs = await storage.getJobs(scopeVesselId);
    const dualJobs = allJobs.filter(job =>
      job.maintenanceBasis === 'Dual Frequency' &&
      job.isActive !== false &&
      job.intervalRunningHour && job.intervalRunningHour > 0 &&
      job.nextDueDate
    );

    if (dualJobs.length === 0) {
      return { checked: 0, generated: 0 };
    }

    const allWorkOrders = await storage.getWorkOrders(scopeVesselId);

    // JOB-LEVEL LOCK: one active WO per job
    const activeWOSets = buildJobsWithActiveWOSet(allWorkOrders);

    // Component cache (same pattern as processRunningHoursJobs)
    const componentCache = new Map<string, any>();
    const vesselComponentsFetched = new Set<string>();

    const getComponentFromCache = async (componentId: string, vesselId: string | null): Promise<any | undefined> => {
      if (vesselId && !vesselComponentsFetched.has(vesselId)) {
        const vesselComponents = await storage.getComponents(vesselId);
        vesselComponents.forEach(c => {
          componentCache.set(c.id, c);
          if (c.cuuid) componentCache.set(c.cuuid, c);
        });
        vesselComponentsFetched.add(vesselId);
      }
      return componentCache.get(componentId);
    };

    // Prefetch ALL job→component links for the candidate Dual jobs in ONE query
    // (kills the per-job getLinkedComponentsForJob N+1 → lower heap/CPU).
    const dualLinksMap = await storage.getLinkedComponentsForJobs(dualJobs.map(j => j.juuid));

    let generated = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const job of dualJobs) {
      // Must have component for RH resolution (D3)
      if (!job.componentId) {
        skipReasons.noComponentId++;
        continue;
      }
      const component = await getComponentFromCache(job.componentId, job.vesselId);
      if (!component) {
        skipReasons.componentNotFound++;
        continue;
      }

      // D3: RH counter type must be MASTER or INHERITED
      // Normalize to uppercase — DB column is unconstrained text with inconsistent casing
      const rhCounterType = (component.rhCounterType || '').toUpperCase();
      if (rhCounterType !== 'MASTER' && rhCounterType !== 'INHERITED') {
        skipReasons.wrongCounterType++;
        continue;
      }

      // Calendar leg values — SHARED parser (dateParse.ts contract): raw
      // new Date() invalidated/swapped DD-MM-YYYY dates. Unparseable → skip.
      const dueDate = parseWorkOrderDate(job.nextDueDate);
      if (!dueDate) {
        skipReasons.missingCalendarData++;
        continue;
      }
      dueDate.setHours(0, 0, 0, 0);
      const generateDate = new Date(dueDate);
      generateDate.setDate(generateDate.getDate() - WORK_ORDER_THRESHOLDS.CALENDAR_GENERATION_ADVANCE_DAYS);
      const calendarDue = today >= generateDate;

      // RH leg values
      let rhEffectiveCurrent: number;
      if (rhCounterType === 'MASTER') {
        rhEffectiveCurrent = parseFloat(component.rhCurrentMaster || '0');
      } else {
        rhEffectiveCurrent = parseFloat(component.rhCurrentInheritedCached || '0');
      }
      const frequencyRH = job.intervalRunningHour || 0;
      const rhLastDone = parseFloat(job.lastDoneRH || '0');
      const rhDue = rhLastDone + frequencyRH;
      const rhGenerate = Math.max(0, rhDue - WORK_ORDER_THRESHOLDS.RH_GENERATION_ADVANCE_HOURS);
      const rhLegDue = rhEffectiveCurrent >= rhGenerate;

      // Whichever-first: at least one leg must be due
      if (!calendarDue && !rhLegDue) {
        skipReasons.neitherLegDue++;
        continue;
      }

      const triggerLeg = calendarDue ? 'CALENDAR' : 'RH';

      // LEGACY FALLBACK: Check for legacy WO without componentCode
      const legacyBlockingWO = allWorkOrders.find(wo => {
        if (!isBlockingStatus(wo.status)) return false;
        if (wo.componentCode && wo.componentCode !== '') return false;
        if (wo.jobId === job.juuid) return true;
        const woJobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
        if (woJobNo === job.jobNo && wo.vesselId === job.vesselId) return true;
        return false;
      });

      if (legacyBlockingWO) {
        skipReasons.legacyBlocking++;
        continue;
      }

      // Get linked components from the prefetched batch map
      // (copy so the per-job fallback push below never mutates the shared array).
      const linkedComponents = [...(dualLinksMap.get(job.juuid) ?? [])];
      if (linkedComponents.length === 0 && job.componentId) {
        linkedComponents.push({
          componentId: job.componentId,
          componentCode: job.componentCode || component.componentCode || '',
          componentName: job.componentName || component.name || ''
        });
      }
      if (linkedComponents.length === 0) {
        skipReasons.noLinkedComponents++;
        continue;
      }

      const dueDateStr = dueDate.toISOString().split('T')[0];
      const generateDateStr = generateDate.toISOString().split('T')[0];

      // Generate a WO for EACH linked component
      for (const linkedComponent of linkedComponents) {
        const componentCode = linkedComponent.componentCode;
        const componentName = linkedComponent.componentName;

        if (!componentCode) continue;

        // COMPONENT-LEVEL CHECK: active WO for this job + component
        const existingWOForComponent = allWorkOrders.find(wo =>
          wo.jobId === job.juuid &&
          wo.componentCode === componentCode &&
          isBlockingStatus(wo.status)
        );

        if (existingWOForComponent) {
          skipReasons.existingWO++;
          continue;
        }

        const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || undefined);

        // D6: Record BOTH calendar and RH snapshots
        const workOrderData: InsertWorkOrder = {
          vesselId: job.vesselId,
          component: componentName,
          componentCode: componentCode,
          jobId: job.juuid,
          workOrderNo: workOrderNo,
          templateCode: workOrderNo,
          jobTitle: job.jobTitle,
          assignedTo: job.assignedTo || 'Unassigned',
          dueDate: job.nextDueDate, // Calendar due date
          nextDueReading: String(rhDue), // RH due value
          currentReading: String(rhEffectiveCurrent),
          status: 'Active',
          taskType: job.maintenanceType,
          maintenanceBasis: 'Dual Frequency', // D5: WO tag
          frequencyValue: job.frequencyValue?.toString(),
          frequencyUnit: job.frequencyUnit,
          intervalRunningHour: job.intervalRunningHour,
          jobPriority: job.jobPriority,
          classRelated: job.classRelated,
          briefWorkDescription: job.briefWorkDescription,
          department: job.department,
          requiredSpareParts: job.requiredSpareParts || [],
          requiredTools: job.requiredTools || [],
          safetyRequirements: job.safetyRequirements || {
            ppeRequirements: [],
            permitRequirements: [],
            otherRequirements: []
          },
          // D5: Which leg triggered
          driverType: triggerLeg === 'CALENDAR' ? 'DUAL_CALENDAR' : 'DUAL_RH',
          dualTriggerLeg: triggerLeg,
          // Calendar snapshots (always present for Dual)
          cycleDueDateSnapshot: dueDateStr,
          generateDateSnapshot: generateDateStr,
          dueDateSnapshot: dueDateStr,
          lastDoneDateSnapshot: job.lastDoneDate || null,
          // RH snapshots (always present for Dual)
          cycleDueRhSnapshot: String(rhDue),
          generateRhSnapshot: String(rhGenerate),
          dueRhSnapshot: String(rhDue),
          effectiveRhAtGeneration: String(rhEffectiveCurrent),
          rhLastDoneSnapshot: String(rhLastDone),
        };

        try {
          const createdWO = await workOrderService.createWorkOrder(workOrderData);
          generated++;

          allWorkOrders.push(createdWO);

          const priorityLabel = isJobCritical(job) ? 'Critical' : 'Non-Critical';
          console.log(`✅ [Dual Trigger] Auto-generated WO ${workOrderNo} for ${priorityLabel} job ${job.jobNo} -> component ${componentCode} (trigger: ${triggerLeg})`);
          console.log(`   Calendar: due=${dueDateStr}, generate=${generateDateStr}, calendarDue=${calendarDue}`);
          console.log(`   RH: last_done=${rhLastDone}, F=${frequencyRH}, due=${rhDue}, generate=${rhGenerate}, current=${rhEffectiveCurrent}, rhDue=${rhLegDue}`);
        } catch (error: any) {
          console.warn(`⚠️ Failed to create WO for Dual job ${job.jobNo} + component ${componentCode}: ${error.message}`);
        }
      }
    }

    if (dualJobs.length > 0) {
      console.log(`📋 [Dual WO Gen] ${dualJobs.length} Dual jobs checked, ${generated} WOs generated. Skip breakdown: neitherLegDue=${skipReasons.neitherLegDue}, wrongCounterType=${skipReasons.wrongCounterType}, existingWO=${skipReasons.existingWO}, legacyBlocking=${skipReasons.legacyBlocking}, noComponentId=${skipReasons.noComponentId}, componentNotFound=${skipReasons.componentNotFound}, noLinkedComponents=${skipReasons.noLinkedComponents}`);
    }

    return { checked: dualJobs.length, generated };
  }

  /**
   * Generate a work order for a specific job on-demand (Manual Button)
   * TRIGGER 3: Manual "Generate WO" button per new WO generation rules
   * 
   * Manual generation rules (STRICT):
   * 1. Determine job type (RH or Calendar)
   * 2. Compute current cycle (RH_due or DUE_DATE)
   * 3. Duplicate protection (MANDATORY):
   *    - If any OPEN/IN_PROGRESS WO exists for same job + same cycle → DO NOT CREATE
   *    - If any OPEN/IN_PROGRESS WO exists for same job (older cycle) → DO NOT CREATE
   *    Show message: "Work Order already exists for this job cycle: <WO_NUMBER>"
   * 
   * Manual trigger can override timing (can generate before generate date/RH_generate)
   * but CANNOT bypass cycle uniqueness or open-WO restriction
   * 
   * @param jobId - The job ID to generate WO for
   * @param reason - The reason for generating (Planning/Breakdown/Other)
   * @param activeComponentCode - Optional component code for multi-linked jobs
   */
  async generateWorkOrderForJob(
    jobId: string, 
    reason: 'Planning' | 'Breakdown' | 'Other' = 'Planning',
    activeComponentCode?: string
  ): Promise<{ success: boolean; workOrder?: any; message: string }> {
    const job = await storage.getJob(jobId);
    if (!job) {
      return { success: false, message: 'Job not found' };
    }

    // Determine the component code to use
    // Priority: activeComponentCode (from Section C context) > job.componentCode
    const effectiveComponentCode = activeComponentCode || job.componentCode;
    
    if (!effectiveComponentCode) {
      return { 
        success: false, 
        message: `Component code is required for work order generation` 
      };
    }

    // Get all work orders for this vessel for duplicate checking
    const allWorkOrders = await storage.getWorkOrders(job.vesselId || undefined);
    
    // ============= DUPLICATE PROTECTION (uses Trigger 1 utilities) =============
    // Build blocking sets and cycle maps using SAME utilities as Trigger 1
    const activeWOSets = buildJobsWithActiveWOSet(allWorkOrders, job.vesselId || undefined);
    const rhCycleMap = buildRhCycleWOMap(allWorkOrders, job.vesselId || undefined);
    const calendarCycleMap = buildCalendarCycleWOMap(allWorkOrders, job.vesselId || undefined);
    
    // Step 1: Check for legacy WOs without componentCode - blocks entire job
    // Find blocking WO using Trigger 1's findBlockingWOForJob utility
    const legacyBlockingWO = allWorkOrders.find(wo => {
      if (!isBlockingStatus(wo.status)) return false;
      if (wo.componentCode && wo.componentCode !== '') return false; // Not a legacy WO
      
      // Must match this specific job
      if (wo.jobId === job.juuid) return true;
      const woJobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo) || (wo as any).jobNo;
      if (woJobNo === job.jobNo && wo.vesselId === job.vesselId) return true;
      
      return false;
    });
    
    if (legacyBlockingWO) {
      return { 
        success: false, 
        message: `Work Order already exists for this job: ${legacyBlockingWO.workOrderNo}. A legacy work order (without component code) blocks this job.`,
        blockingWorkOrder: {
          id: legacyBlockingWO.id,
          workOrderNo: legacyBlockingWO.workOrderNo,
          status: legacyBlockingWO.status,
          componentCode: legacyBlockingWO.componentCode
        }
      };
    }
    
    // Step 2: COMPONENT-LEVEL CHECK using blocking sets (direct lookup)
    // Check if this job already has an active WO (any component)
    const vesselJobNoKey = `${job.vesselId || 'unknown'}|${job.jobNo}`;
    const isJobBlockedByJobId = activeWOSets.byJobId.has(job.juuid);
    const isJobBlockedByJobNo = activeWOSets.byJobNo.has(vesselJobNoKey);
    
    if (isJobBlockedByJobId || isJobBlockedByJobNo) {
      // Find the specific blocking WO for error message
      const existingWOForComponent = allWorkOrders.find(wo => {
        if (!isBlockingStatus(wo.status)) return false;
        if (wo.componentCode !== effectiveComponentCode) return false;
        if (wo.jobId === job.juuid) return true;
        const woJobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo) || (wo as any).jobNo;
        return woJobNo === job.jobNo && wo.vesselId === job.vesselId;
      });
      
      if (existingWOForComponent) {
        return { 
          success: false, 
          message: `Work Order already exists for this job and component: ${existingWOForComponent.workOrderNo}. Only one active work order is allowed per job-component combination.`,
          blockingWorkOrder: {
            id: existingWOForComponent.id,
            workOrderNo: existingWOForComponent.workOrderNo,
            status: existingWOForComponent.status,
            componentCode: existingWOForComponent.componentCode
          }
        };
      }
    }

    // Get component data for RH calculations and name
    // Resolution order: activeComponentCode > linked components > job.componentId
    let componentData: Component | undefined;
    let effectiveComponentName = job.componentName || '';
    
    if (activeComponentCode && job.vesselId) {
      // Look up component by activeComponentCode, scoped by vessel
      const components = await storage.getComponents(job.vesselId);
      componentData = components.find(c => c.componentCode === activeComponentCode);
      if (componentData) {
        effectiveComponentName = componentData.name || effectiveComponentName;
      }
    } else if (!componentData && job.vesselId) {
      // Try linked components lookup
      const linkedComponents = await storage.getLinkedComponentsForJob(job.juuid);
      if (linkedComponents.length > 0) {
        // Use the first linked component (should match effectiveComponentCode)
        const linkedComponent = linkedComponents.find(lc => lc.componentCode === effectiveComponentCode);
        if (linkedComponent && linkedComponent.componentId) {
          componentData = await storage.getComponent(linkedComponent.componentId);
          if (componentData) {
            effectiveComponentName = componentData.name || linkedComponent.componentName || effectiveComponentName;
          }
        }
      }
    }
    
    if (!componentData && job.componentId) {
      componentData = await storage.getComponent(job.componentId);
    }

    // Get vessel settings for lead time and grace period configuration
    const settings = job.vesselId ? await storage.getPmsVesselSettings(job.vesselId) : null;

    // Determine job type and compute cycle values
    const isRHJob = job.maintenanceBasis === 'Running Hours';
    const isDualJob = job.maintenanceBasis === 'Dual Frequency';

    let cycleSnapshots: Partial<InsertWorkOrder> = {};
    let dueRH: number | null = null;
    let currentRH: number | null = null;
    let rhLeadTimeHours: number | undefined;

    if (isDualJob) {
      // Dual Frequency Job: compute BOTH calendar and RH cycle values
      if (!componentData) {
        return { success: false, message: 'Component not found for Dual Frequency job' };
      }

      // D3: Validate RH counter type
      const dualRhCounterType = componentData.rhCounterType;
      if (dualRhCounterType !== 'MASTER' && dualRhCounterType !== 'INHERITED') {
        return { success: false, message: `Dual Frequency requires component RH Counter Type to be MASTER or INHERITED (current: ${dualRhCounterType})` };
      }

      rhLeadTimeHours = getRhLeadHours(job, settings);

      // RH values
      if (dualRhCounterType === 'MASTER') {
        currentRH = parseFloat(componentData.rhCurrentMaster || '0');
      } else {
        currentRH = parseFloat(componentData.rhCurrentInheritedCached || '0');
      }
      const dualRhLastDone = parseFloat(job.lastDoneRH || '0');
      const dualFrequencyRH = job.intervalRunningHour || 0;
      const dualRhDueValue = dualRhLastDone + dualFrequencyRH;
      const dualRhGenerate = Math.max(0, dualRhDueValue - WORK_ORDER_THRESHOLDS.RH_GENERATION_ADVANCE_HOURS);
      dueRH = dualRhDueValue;

      // Calendar values
      const dualDueDate = parseWorkOrderDate(job.nextDueDate) ?? new Date(); // shared parser (dateParse.ts contract)
      dualDueDate.setHours(0, 0, 0, 0);
      const dualDueDateStr = dualDueDate.toISOString().split('T')[0];
      const dualGenerateDate = new Date(dualDueDate);
      dualGenerateDate.setDate(dualGenerateDate.getDate() - WORK_ORDER_THRESHOLDS.CALENDAR_GENERATION_ADVANCE_DAYS);
      const dualGenerateDateStr = dualGenerateDate.toISOString().split('T')[0];

      // Determine which leg would trigger (for driverType) — manual trigger allows override
      const dualToday = new Date();
      dualToday.setHours(0, 0, 0, 0);
      const calLegDue = dualToday >= dualGenerateDate;
      const rhLegDue = currentRH >= dualRhGenerate;
      const dualTriggerLeg = calLegDue ? 'CALENDAR' : (rhLegDue ? 'RH' : 'CALENDAR');

      // Job-level blocking already checked above; skip cycle-level for Dual (manual override)

      cycleSnapshots = {
        driverType: dualTriggerLeg === 'CALENDAR' ? 'DUAL_CALENDAR' : 'DUAL_RH',
        dualTriggerLeg: dualTriggerLeg,
        // Calendar snapshots
        cycleDueDateSnapshot: dualDueDateStr,
        generateDateSnapshot: dualGenerateDateStr,
        dueDateSnapshot: dualDueDateStr,
        lastDoneDateSnapshot: job.lastDoneDate || null,
        dueDate: job.nextDueDate,
        // RH snapshots
        cycleDueRhSnapshot: String(dualRhDueValue),
        generateRhSnapshot: String(dualRhGenerate),
        dueRhSnapshot: String(dualRhDueValue),
        effectiveRhAtGeneration: String(currentRH),
        rhLastDoneSnapshot: String(dualRhLastDone),
        nextDueReading: String(dualRhDueValue),
        currentReading: String(currentRH),
        intervalRunningHour: job.intervalRunningHour,
      };

      console.log(`[Manual Trigger 3] Dual Frequency Job: trigger=${dualTriggerLeg}`);
      console.log(`   Calendar: last_done=${job.lastDoneDate || 'N/A'}, DUE_DATE=${dualDueDateStr}, GENERATE_DATE=${dualGenerateDateStr}`);
      console.log(`   RH: last_done=${dualRhLastDone}, F=${dualFrequencyRH}, RH_due=${dualRhDueValue}, RH_generate=${dualRhGenerate}, RH_current=${currentRH}`);
    } else if (isRHJob) {
      // RH Job: compute cycle values
      if (!componentData) {
        return { success: false, message: 'Component not found for job' };
      }
      
      // Get vessel lead time hours for status computation (Planned → Due transition)
      rhLeadTimeHours = getRhLeadHours(job, settings);
      
      // Determine effective current RH based on counter type
      const rhCounterType = componentData.rhCounterType;
      if (rhCounterType === 'MASTER') {
        currentRH = parseFloat(componentData.rhCurrentMaster || '0');
      } else if (rhCounterType === 'INHERITED') {
        currentRH = parseFloat(componentData.rhCurrentInheritedCached || '0');
      } else {
        currentRH = parseFloat(componentData.runningHours || '0');
      }
      
      const rhLastDone = parseFloat(job.lastDoneRH || '0');
      const frequencyRH = job.intervalRunningHour || 0;
      
      // Calculate cycle values
      const rhDueValue = rhLastDone + frequencyRH;
      const rhGenerate = Math.max(0, rhDueValue - WORK_ORDER_THRESHOLDS.RH_GENERATION_ADVANCE_HOURS);
      dueRH = rhDueValue;
      
      // Step 3: CYCLE-LEVEL CHECK (RH) using Trigger 1's cycle map (direct lookup)
      // Key format: `${vesselId}|${jobNo}|${componentCode}|${cycleDueRhSnapshot}`
      const rhDueStr = String(rhDueValue);
      const vesselId = job.vesselId || 'unknown';
      const compCode = effectiveComponentCode || 'unknown';
      
      // Build cycle key matching Trigger 1's format
      const rhCycleKey = `${vesselId}|${job.jobNo}|${compCode}|${rhDueStr}`;
      const rhCycleKeyUnknown = `${vesselId}|${job.jobNo}|unknown|${rhDueStr}`;
      
      // Direct lookup against cycle map (same as Trigger 1)
      const componentCycleWO = rhCycleMap.get(rhCycleKey) || rhCycleMap.get(rhCycleKeyUnknown);
      
      if (componentCycleWO) {
        return { 
          success: false, 
          message: `Work Order already exists for this job cycle: ${componentCycleWO.workOrderNo}`,
          blockingWorkOrder: {
            id: componentCycleWO.id,
            workOrderNo: componentCycleWO.workOrderNo,
            status: componentCycleWO.status,
            componentCode: componentCycleWO.componentCode
          }
        };
      }
      
      cycleSnapshots = {
        driverType: 'RH',
        cycleDueRhSnapshot: String(rhDueValue),
        generateRhSnapshot: String(rhGenerate),
        dueRhSnapshot: String(rhDueValue),
        effectiveRhAtGeneration: String(currentRH),
        rhLastDoneSnapshot: String(rhLastDone),
        nextDueReading: String(rhDueValue),
        currentReading: String(currentRH),
        intervalRunningHour: job.intervalRunningHour,
      };
      
      console.log(`[Manual Trigger 3] RH Job: RH_last_done=${rhLastDone}, F=${frequencyRH}, Generation advance=${WORK_ORDER_THRESHOLDS.RH_GENERATION_ADVANCE_HOURS}hrs, Vessel LT=${rhLeadTimeHours}hrs`);
      console.log(`   RH_due=${rhDueValue}, RH_generate=${rhGenerate}, RH_current=${currentRH}`);
    } else {
      // Calendar Job: compute cycle values
      const dueDate = parseWorkOrderDate(job.nextDueDate) ?? new Date(); // shared parser (dateParse.ts contract)
      dueDate.setHours(0, 0, 0, 0);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      // Use FIXED 30-day generation advance (business rule: generation is fixed, not vessel-driven)
      const generateDate = new Date(dueDate);
      generateDate.setDate(generateDate.getDate() - WORK_ORDER_THRESHOLDS.CALENDAR_GENERATION_ADVANCE_DAYS);
      const generateDateStr = generateDate.toISOString().split('T')[0];
      
      // Step 3: CYCLE-LEVEL CHECK (Calendar) using Trigger 1's cycle map (direct lookup)
      // Key format: `${vesselId}|${jobNo}|${componentCode}|${cycleDueDateSnapshot}`
      const calVesselId = job.vesselId || 'unknown';
      const calCompCode = effectiveComponentCode || 'unknown';
      
      // Build cycle key matching Trigger 1's format
      const calCycleKey = `${calVesselId}|${job.jobNo}|${calCompCode}|${dueDateStr}`;
      const calCycleKeyUnknown = `${calVesselId}|${job.jobNo}|unknown|${dueDateStr}`;
      
      // Direct lookup against cycle map (same as Trigger 1)
      const calendarCycleWO = calendarCycleMap.get(calCycleKey) || calendarCycleMap.get(calCycleKeyUnknown);
      
      if (calendarCycleWO) {
        return { 
          success: false, 
          message: `Work Order already exists for this job cycle: ${calendarCycleWO.workOrderNo}`,
          blockingWorkOrder: {
            id: calendarCycleWO.id,
            workOrderNo: calendarCycleWO.workOrderNo,
            status: calendarCycleWO.status,
            componentCode: calendarCycleWO.componentCode
          }
        };
      }
      
      cycleSnapshots = {
        driverType: 'CALENDAR',
        cycleDueDateSnapshot: dueDateStr,
        generateDateSnapshot: generateDateStr,
        dueDateSnapshot: dueDateStr,
        lastDoneDateSnapshot: job.lastDoneDate || null,
        dueDate: job.nextDueDate,
      };
      
      console.log(`[Manual Trigger 3] Calendar Job: last_done=${job.lastDoneDate || 'N/A'}, Generation advance=${WORK_ORDER_THRESHOLDS.CALENDAR_GENERATION_ADVANCE_DAYS} days`);
      console.log(`   DUE_DATE=${dueDateStr}, GENERATE_DATE=${generateDateStr}`);
    }

    // ============= COMPUTE STATUS USING SHARED UTILITY =============
    // Build vessel grace settings for the shared status computation function
    const vesselGraceSettings: VesselGraceSettings | undefined = settings ? {
      calendarGraceMode: (settings.calendarGraceMode as 'COMPANY_STANDARD' | 'CUSTOM_DAYS') || 'COMPANY_STANDARD',
      calendarGraceDays: settings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
      rhGraceHours: settings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
      rhLeadTimeHours: rhLeadTimeHours
    } : undefined;
    
    // Compute calendar lead time for status calculation (vessel-configured, for Planned → Due)
    const calendarLeadTimeDays = job.maintenanceBasis !== 'Running Hours' && settings
      ? (isJobCritical(job) ? settings.calendarLeadDaysCritical : settings.calendarLeadDaysNonCritical)
      : undefined;

    // Load company standard grace config for accurate status computation
    const companyGraceRow = await storage.getCompanyStandardGraceSettings();
    const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);

    // Use the shared computeWorkOrderStatus function for spec-compliant status
    const computedStatusResult = computeWorkOrderStatus({
      dueDate: job.nextDueDate,
      dueRH,
      currentRH,
      isExecution: false,
      status: undefined,
      completionDateTime: null,
      maintenanceBasis: job.maintenanceBasis || undefined,
      vesselGraceSettings,
      rhLeadTimeHours,
      calendarLeadTimeDays,
      companyGraceConfig
    });
    
    // Map computed status to database status field
    // "Due (Grace P)" maps to "Due" in the database (grace is a display concept)
    let dbStatus: string;
    if (computedStatusResult === 'Due (Grace P)') {
      dbStatus = 'Due';
    } else {
      dbStatus = computedStatusResult;
    }
    
    console.log(`   Computed status: ${computedStatusResult} → DB status: ${dbStatus}`);
    
    // Generate WO number with correct format
    const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, effectiveComponentCode, job.vesselId || undefined);
    
    const workOrderData: InsertWorkOrder = {
      vesselId: job.vesselId,
      component: effectiveComponentName,
      componentCode: effectiveComponentCode,
      jobId: job.juuid,
      workOrderNo: workOrderNo,
      templateCode: workOrderNo,
      jobTitle: job.jobTitle,
      assignedTo: job.assignedTo || 'Unassigned',
      status: dbStatus, // Use computed status from shared utility
      taskType: job.maintenanceType,
      maintenanceBasis: job.maintenanceBasis,
      frequencyValue: job.frequencyValue?.toString(),
      frequencyUnit: job.frequencyUnit,
      jobPriority: job.jobPriority,
      classRelated: job.classRelated,
      briefWorkDescription: job.briefWorkDescription,
      department: job.department,
      requiredSpareParts: job.requiredSpareParts || [],
      requiredTools: job.requiredTools || [],
      safetyRequirements: job.safetyRequirements || {
        ppeRequirements: [],
        permitRequirements: [],
        otherRequirements: []
      },
      remarks: `On-demand work order generated. Reason: ${reason}`,
      // Spread cycle snapshots based on job type
      ...cycleSnapshots,
    };
    
    const createdWO = await workOrderService.createWorkOrder(workOrderData);
    
    console.log(`✅ [Manual Trigger 3] On-demand work order ${workOrderNo} created for job ${job.jobNo} with status: ${dbStatus}`);
    
    return { 
      success: true, 
      workOrder: createdWO,
      message: `Work order ${workOrderNo} created successfully` 
    };
  }
}

export const jobDueScanner = new JobDueScannerService();
