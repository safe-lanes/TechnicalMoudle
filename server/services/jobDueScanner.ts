import { workOrderService } from "./workOrderService";
import { jobService } from "./jobService";
import { storage } from "../storage";
import { generatePlannedWorkOrderNumber } from "../utils/workOrderNumbering";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import { 
  isBlockingStatus, 
  extractJobNoFromWorkOrderNo,
  buildJobsWithActiveWOSet,
  buildRhCycleWOMap,
  buildCalendarCycleWOMap,
  findBlockingWOForJob
} from "../utils/workOrderStatus";
import type { InsertWorkOrder, Job, PmsVesselSettings } from "@shared/schema";

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
 * Uses centralized WORK_ORDER_THRESHOLDS as fallback when vessel settings not configured
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
  private isRunning = false;
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
    
    // Run immediately on startup
    this.runScan().catch(err => {
      console.error('[JobDueScanner] Error during initial scan:', err);
    });

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
   * Run a full scan of all jobs and generate work orders as needed
   */
  async runScan(): Promise<{
    calendarJobsChecked: number;
    calendarWOsGenerated: number;
    rhJobsChecked: number;
    rhWOsGenerated: number;
  }> {
    console.log('[JobDueScanner] Starting job due scan...');
    
    const results = {
      calendarJobsChecked: 0,
      calendarWOsGenerated: 0,
      rhJobsChecked: 0,
      rhWOsGenerated: 0
    };

    try {
      // Process Calendar-based jobs using existing method
      const calendarResults = await workOrderService.autoGenerateWorkOrdersFromJobs();
      results.calendarJobsChecked = calendarResults.checked;
      results.calendarWOsGenerated = calendarResults.generated;

      // Process Running Hours-based jobs
      const rhResults = await this.processRunningHoursJobs();
      results.rhJobsChecked = rhResults.checked;
      results.rhWOsGenerated = rhResults.generated;

      console.log(`[JobDueScanner] Scan complete: Calendar (${results.calendarWOsGenerated}/${results.calendarJobsChecked} WOs), RH (${results.rhWOsGenerated}/${results.rhJobsChecked} WOs)`);
    } catch (error) {
      console.error('[JobDueScanner] Scan failed:', error);
      throw error;
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
  private async processRunningHoursJobs(): Promise<{ checked: number; generated: number }> {
    // Get only active RH-based jobs
    const allJobs = await storage.getJobs();
    const rhJobs = allJobs.filter(job => 
      job.maintenanceBasis === 'Running Hours' && 
      job.isActive !== false && // Job must be active
      job.intervalRunningHour && job.intervalRunningHour > 0 // Must have valid frequency
    );

    // Fetch vessel PMS settings for lead time configuration
    const settingsCache = new Map<string, PmsVesselSettings | null>();
    const getSettingsForVessel = async (vId: string | null): Promise<PmsVesselSettings | null> => {
      if (!vId) return null;
      if (settingsCache.has(vId)) return settingsCache.get(vId) || null;
      const settings = await storage.getPmsVesselSettings(vId);
      settingsCache.set(vId, settings || null);
      return settings || null;
    };

    // Get all work orders to check for duplicates
    // Note: We fetch all WOs but use vessel-scoped keys for proper cross-vessel handling
    const allWorkOrders = await storage.getWorkOrders();
    
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
        vesselComponents.forEach(c => componentCache.set(c.id, c));
        vesselComponentsFetched.add(vesselId);
      }
      return componentCache.get(componentId);
    };

    let generated = 0;

    for (const job of rhJobs) {
      // Get the component from cache to check RH counter type and current RH
      const component = await getComponentFromCache(job.componentId, job.vesselId);
      if (!component) continue;

      // Check RH counter type - must be MASTER or INHERITED
      const rhCounterType = component.rhCounterType;
      if (rhCounterType !== 'MASTER' && rhCounterType !== 'INHERITED') {
        continue; // Skip jobs on components without proper RH tracking
      }

      // Determine effective current RH based on counter type
      let rhEffectiveCurrent: number;
      if (rhCounterType === 'MASTER') {
        rhEffectiveCurrent = parseFloat(component.rhCurrentMaster || '0');
      } else {
        // INHERITED - use cached value from master
        rhEffectiveCurrent = parseFloat(component.rhCurrentInheritedCached || '0');
      }

      // Get RH_last_done from job (stored at last WO completion)
      const rhLastDone = parseFloat(job.lastDoneRH || '0');
      
      // F = frequency_rh
      const frequencyRH = job.intervalRunningHour || 0;
      if (frequencyRH <= 0) continue;

      // Get vessel settings for lead time
      const settings = await getSettingsForVessel(job.vesselId);
      const leadTimeRH = getRhLeadHours(job, settings);

      // Calculate cycle values
      // RH_due = RH_last_done + F
      const rhDue = rhLastDone + frequencyRH;
      // RH_generate = RH_due - LT
      const rhGenerate = Math.max(0, rhDue - leadTimeRH);

      // Check auto-generation condition: RH_effective_current >= RH_generate
      if (rhEffectiveCurrent < rhGenerate) {
        continue; // Not yet time to generate
      }

      // LEGACY FALLBACK: Check if job has any active WO with NULL/empty componentCode
      // If so, block ALL generation for this job to protect legacy data
      // Check by both jobId AND jobNo (vessel-scoped) to catch legacy WOs without jobId
      const legacyBlockingWO = allWorkOrders.find(wo => {
        if (!isBlockingStatus(wo.status)) return false;
        if (wo.componentCode && wo.componentCode !== '') return false; // Not a legacy WO
        
        // Match by jobId (modern WOs)
        if (wo.jobId === job.id) return true;
        
        // Match by vessel-scoped jobNo (legacy WOs without jobId)
        const woJobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
        if (woJobNo === job.jobNo && wo.vesselId === job.vesselId) return true;
        
        return false;
      });
      
      if (legacyBlockingWO) {
        // Legacy WO exists without component code - block entire job
        continue;
      }
      
      // All RH timing checks passed - now get ALL linked components for this job
      // FIX: Get linked components from job_component_links table (many-to-many relationship)
      const linkedComponents = await storage.getLinkedComponentsForJob(job.id);
      
      // If no linked components found, fall back to job's primary component
      if (linkedComponents.length === 0 && job.componentId) {
        linkedComponents.push({
          componentId: job.componentId,
          componentCode: job.componentCode || component.componentCode || '',
          componentName: job.componentName || component.name || ''
        });
      }
      
      if (linkedComponents.length === 0) {
        console.warn(`⚠️ No linked components for RH job ${job.jobNo} - skipping WO generation`);
        continue;
      }
      
      // Generate a work order for EACH linked component
      for (const linkedComponent of linkedComponents) {
        const componentCode = linkedComponent.componentCode;
        const componentName = linkedComponent.componentName;
        
        if (!componentCode) {
          console.warn(`⚠️ No component code for linked component of RH job ${job.jobNo} - skipping`);
          continue;
        }
        
        // COMPONENT-LEVEL CHECK: Check if WO already exists for this job + component combination
        const existingWOForComponent = allWorkOrders.find(wo => 
          wo.jobId === job.id &&
          wo.componentCode === componentCode &&
          isBlockingStatus(wo.status)
        );
        
        if (existingWOForComponent) {
          continue; // Already has an active WO for this component - skip
        }
        
        // Component-specific cycle key for RH: `${vesselId}|${jobNo}|${componentCode}|${rhDue}`
        const componentCycleKey = `${job.vesselId || 'unknown'}|${job.jobNo}|${componentCode}|${rhDue}`;
        if (existingCycleWOs.has(componentCycleKey)) {
          continue; // WO already exists for this component's cycle - skip
        }
        
        const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || undefined);
        
        const workOrderData: InsertWorkOrder = {
          vesselId: job.vesselId,
          component: componentName,
          componentCode: componentCode, // Use linked component's code
          jobId: job.id, // Link to job for cycle tracking
          workOrderNo: workOrderNo,
          templateCode: workOrderNo,
          jobTitle: job.jobTitle,
          assignedTo: job.assignedTo || 'Unassigned',
          dueDate: undefined, // RH-based jobs don't have calendar due date
          nextDueReading: String(rhDue), // Store the due RH value
          currentReading: String(rhEffectiveCurrent), // Store current RH at generation time
          status: 'Due', // Start as Due since trigger condition is met
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
          console.log(`✅ [RH Trigger 1] Auto-generated WO ${workOrderNo} for ${priorityLabel} job ${job.jobNo} -> component ${componentCode}`);
          console.log(`   RH_last_done=${rhLastDone}, F=${frequencyRH}, LT=${leadTimeRH}`);
          console.log(`   RH_due=${rhDue}, RH_generate=${rhGenerate}, RH_current=${rhEffectiveCurrent}`);
        } catch (error: any) {
          console.warn(`⚠️ Failed to create WO for RH job ${job.jobNo} + component ${componentCode}: ${error.message}`);
        }
      }
    }

    // Log settings used for transparency
    if (settingsCache.size > 0) {
      Array.from(settingsCache.entries()).forEach(([vId, settings]) => {
        if (settings) {
          console.log(`📋 [RH WO Gen] Vessel ${vId} lead times: Critical=${settings.rhLeadHoursCritical}hrs, Non-Critical=${settings.rhLeadHoursNonCritical}hrs`);
        } else {
          console.log(`⚠️ [RH WO Gen] Vessel ${vId} has no PMS settings configured, using 0 hour lead time`);
        }
      });
    }

    return { checked: rhJobs.length, generated };
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
   */
  async generateWorkOrderForJob(jobId: string): Promise<{ success: boolean; workOrder?: any; message: string }> {
    const job = await storage.getJob(jobId);
    if (!job) {
      return { success: false, message: 'Job not found' };
    }

    // Get all work orders for this vessel
    const allWorkOrders = await storage.getWorkOrders(job.vesselId || undefined);
    
    // JOB-LEVEL LOCK: Check if job already has an active WO
    // Uses case-insensitive status matching via findBlockingWOForJob()
    const existingActiveWO = findBlockingWOForJob(allWorkOrders, job.id, job.jobNo);
    
    if (existingActiveWO) {
      return { 
        success: false, 
        message: `Work Order already exists for this job: ${existingActiveWO.workOrderNo}` 
      };
    }

    // Determine job type and compute cycle values
    const isRHJob = job.maintenanceBasis === 'Running Hours';
    
    let cycleSnapshots: Partial<InsertWorkOrder> = {};
    let rhEffectiveCurrent: number | undefined;
    
    if (isRHJob) {
      // RH Job: compute cycle values
      const component = await storage.getComponent(job.componentId);
      if (!component) {
        return { success: false, message: 'Component not found for job' };
      }
      
      // Determine effective current RH based on counter type
      const rhCounterType = component.rhCounterType;
      if (rhCounterType === 'MASTER') {
        rhEffectiveCurrent = parseFloat(component.rhCurrentMaster || '0');
      } else if (rhCounterType === 'INHERITED') {
        rhEffectiveCurrent = parseFloat(component.rhCurrentInheritedCached || '0');
      } else {
        // Fallback for non-RH tracked components
        rhEffectiveCurrent = parseFloat(component.runningHours || '0');
      }
      
      const rhLastDone = parseFloat(job.lastDoneRH || '0');
      const frequencyRH = job.intervalRunningHour || 0;
      
      // Get vessel settings for lead time
      const settings = job.vesselId ? await storage.getPmsVesselSettings(job.vesselId) : null;
      const leadTimeRH = getRhLeadHours(job, settings);
      
      // Calculate cycle values
      const rhDue = rhLastDone + frequencyRH;
      const rhGenerate = Math.max(0, rhDue - leadTimeRH);
      
      // Check for existing WO with same cycle (cycle uniqueness)
      // Uses case-insensitive status matching via isBlockingStatus()
      const existingCycleWO = allWorkOrders.find(wo => 
        wo.jobId === job.id &&
        wo.cycleDueRhSnapshot === String(rhDue) &&
        isBlockingStatus(wo.status)
      );
      
      if (existingCycleWO) {
        return { 
          success: false, 
          message: `Work Order already exists for this job cycle: ${existingCycleWO.workOrderNo}` 
        };
      }
      
      cycleSnapshots = {
        driverType: 'RH',
        cycleDueRhSnapshot: String(rhDue),
        generateRhSnapshot: String(rhGenerate),
        dueRhSnapshot: String(rhDue),
        effectiveRhAtGeneration: String(rhEffectiveCurrent),
        rhLastDoneSnapshot: String(rhLastDone),
        nextDueReading: String(rhDue),
        currentReading: String(rhEffectiveCurrent),
      };
      
      console.log(`[Manual Trigger 3] RH Job: RH_last_done=${rhLastDone}, F=${frequencyRH}, LT=${leadTimeRH}`);
      console.log(`   RH_due=${rhDue}, RH_generate=${rhGenerate}, RH_current=${rhEffectiveCurrent}`);
    } else {
      // Calendar Job: compute cycle values
      const dueDate = job.nextDueDate ? new Date(job.nextDueDate) : new Date();
      dueDate.setHours(0, 0, 0, 0);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      // Get vessel settings for lead time
      const settings = job.vesselId ? await storage.getPmsVesselSettings(job.vesselId) : null;
      const leadTimeDays = isJobCritical(job) 
        ? (settings?.calendarLeadDaysCritical || 0) 
        : (settings?.calendarLeadDaysNonCritical || 0);
      
      const generateDate = new Date(dueDate);
      generateDate.setDate(generateDate.getDate() - leadTimeDays);
      const generateDateStr = generateDate.toISOString().split('T')[0];
      
      // Check for existing WO with same cycle (cycle uniqueness)
      // Uses case-insensitive status matching via isBlockingStatus()
      const existingCycleWO = allWorkOrders.find(wo => 
        wo.jobId === job.id &&
        wo.cycleDueDateSnapshot === dueDateStr &&
        isBlockingStatus(wo.status)
      );
      
      if (existingCycleWO) {
        return { 
          success: false, 
          message: `Work Order already exists for this job cycle: ${existingCycleWO.workOrderNo}` 
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
      
      console.log(`[Manual Trigger 3] Calendar Job: last_done=${job.lastDoneDate || 'N/A'}, LT=${leadTimeDays} days`);
      console.log(`   DUE_DATE=${dueDateStr}, GENERATE_DATE=${generateDateStr}`);
    }

    // Get componentCode - fallback to component record if not on job
    let componentCode = job.componentCode;
    if (!componentCode && job.componentId) {
      const component = await storage.getComponent(job.componentId);
      componentCode = component?.componentCode || '';
    }
    if (!componentCode) {
      return { 
        success: false, 
        message: `Component code is required for work order generation` 
      };
    }
    
    // Generate WO number with correct format: <JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>
    const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || undefined);
    
    const workOrderData: InsertWorkOrder = {
      vesselId: job.vesselId,
      component: job.componentName,
      componentCode: componentCode, // Use resolved componentCode
      jobId: job.id, // Link to job for cycle tracking
      workOrderNo: workOrderNo,
      templateCode: workOrderNo,
      jobTitle: job.jobTitle,
      assignedTo: job.assignedTo || 'Unassigned',
      status: 'Due', // Manual generation starts as Due
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
      // Spread cycle snapshots based on job type
      ...cycleSnapshots,
    };
    
    const createdWO = await workOrderService.createWorkOrder(workOrderData);
    
    console.log(`✅ [Manual Trigger 3] On-demand work order ${workOrderNo} created for job ${job.jobNo}`);
    
    return { 
      success: true, 
      workOrder: createdWO,
      message: `Work order ${workOrderNo} created successfully` 
    };
  }
}

export const jobDueScanner = new JobDueScannerService();
