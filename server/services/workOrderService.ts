import { storage } from "../storage";
import type { WorkOrder, InsertWorkOrder, WorkOrderExecution, InsertWorkOrderExecution, Job, PmsVesselSettings, Component } from "@shared/schema";
import { computeWorkOrderStatus, VesselGraceSettings } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import { shouldGenerateWorkOrder } from "@shared/dateUtils";
import { generatePlannedWorkOrderNumber, generateUnplannedWorkOrderNumber } from "../utils/workOrderNumbering";
import { jobService } from "./jobService";
import { 
  isBlockingStatus, 
  isCompletedStatus,
  extractJobNoFromWorkOrderNo,
  buildJobsWithActiveWOSet,
  buildCalendarCycleWOMap
} from "../utils/workOrderStatus";

/**
 * Determine if a job is "critical" based on its jobPriority
 * Critical and High priority jobs are considered critical for lead time purposes
 */
function isJobCritical(job: Job): boolean {
  const priority = job.jobPriority?.toLowerCase() || '';
  return priority === 'critical' || priority === 'high';
}

/**
 * Get the appropriate calendar lead time in days for a job based on its priority
 */
function getCalendarLeadDays(job: Job, settings: PmsVesselSettings | null | undefined): number {
  if (!settings) return 0; // No settings configured, use 0 lead time
  return isJobCritical(job) 
    ? settings.calendarLeadDaysCritical 
    : settings.calendarLeadDaysNonCritical;
}

/**
 * Get the appropriate RH lead time in hours for a job based on its priority
 */
function getRhLeadHours(job: Job, settings: PmsVesselSettings | null | undefined): number {
  if (!settings) return 0; // No settings configured, use 0 lead time
  return isJobCritical(job)
    ? settings.rhLeadHoursCritical
    : settings.rhLeadHoursNonCritical;
}

/**
 * Work Order Service
 * Handles all business logic related to work order execution records
 * Separated from routes for better maintainability
 */

export class WorkOrderService {
  /**
   * Get all work orders with optional vessel filter and computed status
   * Fetches component running hours for RH-based work orders and vessel grace settings
   */
  async getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
    const workOrders = await storage.getWorkOrders(vesselId);
    
    // Get unique job IDs from RH-based work orders to fetch component data
    const rhWorkOrders = workOrders.filter(wo => wo.maintenanceBasis === 'Running Hours' && wo.jobId);
    const jobIds = Array.from(new Set(rhWorkOrders.map(wo => wo.jobId).filter((id): id is string => id !== null)));
    
    // Fetch jobs to get component IDs
    const jobsMap = new Map<string, Job>();
    for (const jobId of jobIds) {
      const job = await storage.getJob(jobId);
      if (job) {
        jobsMap.set(jobId, job);
      }
    }
    
    // Get unique component IDs from those jobs
    const componentIds = Array.from(new Set(
      Array.from(jobsMap.values())
        .map(job => job.componentId)
        .filter((id): id is string => id !== null && id !== undefined)
    ));
    
    // Fetch component data to get current running hours
    const componentsMap = new Map<string, Component>();
    for (const componentId of componentIds) {
      const component = await storage.getComponent(componentId);
      if (component) {
        componentsMap.set(componentId, component);
      }
    }
    
    // Fetch vessel grace settings for proper status calculation
    const vesselIds = Array.from(new Set(workOrders.map(wo => wo.vesselId).filter((id): id is string => id !== null)));
    const vesselSettingsMap = new Map<string, PmsVesselSettings>();
    const graceSettingsMap = new Map<string, VesselGraceSettings>();
    for (const vId of vesselIds) {
      const settings = await storage.getPmsVesselSettings(vId);
      if (settings) {
        vesselSettingsMap.set(vId, settings);
        graceSettingsMap.set(vId, {
          calendarGraceMode: settings.calendarGraceMode as 'COMPANY_STANDARD' | 'CUSTOM_DAYS' || 'COMPANY_STANDARD',
          calendarGraceDays: settings.calendarGraceDays || WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
          rhGraceHours: settings.rhGraceHours || WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
          rhLeadTimeHours: settings.rhLeadHoursNonCritical || WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
        });
      }
    }
    
    // Augment each work order with computed status
    return workOrders.map(wo => {
      let currentRH: number | null = null;
      let dueRH: number | null = null;
      let job: Job | undefined;
      
      // For RH-based work orders, get the current running hours from the component
      // FALLBACK: If component data is missing, use work order's own currentReading
      if (wo.maintenanceBasis === 'Running Hours') {
        if (wo.jobId) {
          job = jobsMap.get(wo.jobId);
          if (job?.componentId) {
            const component = componentsMap.get(job.componentId);
            // Use explicit null check to handle zero running hours correctly
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
      const vesselGraceSettings = wo.vesselId ? graceSettingsMap.get(wo.vesselId) : undefined;
      const vesselSettings = wo.vesselId ? vesselSettingsMap.get(wo.vesselId) : undefined;
      
      // Determine RH lead time based on job criticality (Critical vs Non-Critical)
      // NOTE: Using ?? (nullish coalescing) ensures explicit 0 values are preserved
      // Fallback uses centralized WORK_ORDER_THRESHOLDS (720 hours per spec)
      const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || String(job?.classRelated) === 'true';
      const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours' 
        ? (isJobCritical 
            ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
            : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
        : undefined;
      
      return {
        ...wo,
        computedStatus: computeWorkOrderStatus({
          dueDate: wo.dueDate,
          dueRH,
          currentRH,
          isExecution: wo.isExecution,
          status: wo.status,
          completionDateTime: wo.dateCompleted,
          maintenanceBasis: wo.maintenanceBasis || undefined,
          vesselGraceSettings,
          rhLeadTimeHours
        })
      };
    });
  }

  /**
   * Get a single work order by ID
   */
  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    return storage.getWorkOrder(id);
  }

  /**
   * Create a new work order
   */
  async createWorkOrder(workOrderData: InsertWorkOrder): Promise<WorkOrder> {
    // Validate required fields
    if (!workOrderData.vesselId) {
      throw new Error('Vessel ID is required');
    }
    
    if (!workOrderData.jobTitle) {
      throw new Error('Job title is required');
    }

    // Work order number should already be generated by the caller using the appropriate utility
    // If not provided for some reason (unplanned WO), generate unplanned format
    if (!workOrderData.workOrderNo) {
      workOrderData.workOrderNo = await generateUnplannedWorkOrderNumber(storage, workOrderData.vesselId);
      workOrderData.templateCode = workOrderData.workOrderNo;
    }

    return storage.createWorkOrder(workOrderData);
  }

  /**
   * Update an existing work order
   */
  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    return storage.updateWorkOrder(id, updates);
  }

  /**
   * Delete a work order
   */
  async deleteWorkOrder(id: string): Promise<void> {
    return storage.deleteWorkOrder(id);
  }

  /**
   * Get work order execution data
   * Note: This fetches executions by looking up via templateId (reference to work_orders.id)
   */
  async getWorkOrderExecution(workOrderId: string, componentId: string): Promise<WorkOrderExecution | undefined> {
    const executions = await storage.getWorkOrderExecutions(componentId);
    return executions.find(exec => exec.templateId === workOrderId);
  }

  /**
   * Create work order execution record
   */
  async createWorkOrderExecution(executionData: InsertWorkOrderExecution): Promise<WorkOrderExecution> {
    return storage.createWorkOrderExecution(executionData);
  }

  /**
   * Update work order execution record
   */
  async updateWorkOrderExecution(id: string, updates: Partial<InsertWorkOrderExecution>): Promise<WorkOrderExecution> {
    return storage.updateWorkOrderExecution(id, updates);
  }

  /**
   * Auto-generate work orders from due jobs (Calendar-based)
   * TRIGGER 2: Calendar-based auto-generation per new WO generation rules
   * 
   * Applicability:
   * - job.maintenanceBasis = 'Calendar'
   * - job.isActive = true
   * 
   * Calculations:
   * - last_done_date = date of last completed WO (job.lastDoneDate)
   * - F_days = frequency_days (frequencyValue in days)
   * - LT_days = lead_time_days
   * - DUE_DATE = last_done_date + F_days
   * - GENERATE_DATE = DUE_DATE - LT_days
   * 
   * Auto-generation condition:
   * - Today >= GENERATE_DATE
   * - AND no DUE/OVERDUE/PENDING APPROVAL/POSTPONED WO exists for same job + same DUE_DATE cycle
   */
  async autoGenerateWorkOrdersFromJobs(vesselId?: string): Promise<{
    checked: number;
    generated: number;
    workOrders: WorkOrder[];
  }> {
    // Get only active Calendar-based jobs
    const allJobs = await jobService.getJobs(vesselId);
    const calendarJobs = allJobs.filter(job => 
      job.maintenanceBasis === 'Calendar' && 
      job.isActive !== false && // Job must be active
      job.nextDueDate // Must have valid due date
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
    const allWorkOrders = await this.getWorkOrders(vesselId);
    
    // JOB-LEVEL LOCK: Build sets of jobs that already have an active WO
    // Rule: "one active WO per job at a time" - prevents ANY duplicate regardless of cycle
    // Uses both jobId (primary) and jobNo (fallback) for comprehensive blocking
    const activeWOSets = buildJobsWithActiveWOSet(allWorkOrders);
    
    // CYCLE UNIQUENESS: Also build a map by (jobNo + cycleDueDate) for cycle-level check
    // Uses case-insensitive status matching via isBlockingStatus()
    const existingCycleWOs = buildCalendarCycleWOMap(allWorkOrders);
    
    const results = {
      checked: calendarJobs.length,
      generated: 0,
      workOrders: [] as WorkOrder[]
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    for (const job of calendarJobs) {
      // Get vessel settings for lead time
      const settings = await getSettingsForVessel(job.vesselId);
      const leadTimeDays = getCalendarLeadDays(job, settings);
      
      // Calculate DUE_DATE and GENERATE_DATE
      // DUE_DATE is stored in job.nextDueDate
      const dueDate = new Date(job.nextDueDate!);
      dueDate.setHours(0, 0, 0, 0);
      
      // GENERATE_DATE = DUE_DATE - LT_days
      const generateDate = new Date(dueDate);
      generateDate.setDate(generateDate.getDate() - leadTimeDays);
      
      // Check auto-generation condition: Today >= GENERATE_DATE
      if (today < generateDate) {
        continue; // Not yet time to generate
      }
      
      // JOB-LEVEL LOCK CHECK: Only one active WO per job at a time
      // Primary check: by jobId (reliable, direct field match)
      // Fallback check: by jobNo (for legacy WOs without jobId)
      if (activeWOSets.byJobId.has(job.id) || activeWOSets.byJobNo.has(job.jobNo)) {
        continue; // Already has an active WO - skip
      }
      
      // Normalize due date for cycle key (ISO date string YYYY-MM-DD)
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      // CYCLE UNIQUENESS CHECK: Each calendar cycle is uniquely identified by (jobNo + DUE_DATE)
      const cycleKey = `${job.jobNo}|${dueDateStr}`;
      if (existingCycleWOs.has(cycleKey)) {
        // WO already exists for this cycle - skip
        continue;
      }
      
      // All checks passed - generate the WO
      // Get componentCode - fallback to component record if not on job
      let componentCode = job.componentCode;
      if (!componentCode && job.componentId) {
        const component = await storage.getComponent(job.componentId);
        componentCode = component?.componentCode || '';
      }
      if (!componentCode) {
        console.warn(`⚠️ No component code for calendar job ${job.jobNo} - skipping WO generation`);
        continue;
      }
      const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || undefined);
      
      // Calculate generate date string for snapshot
      const generateDateStr = generateDate.toISOString().split('T')[0];
      
      const workOrderData: InsertWorkOrder = {
        vesselId: job.vesselId,
        component: job.componentName,
        componentCode: componentCode, // Use resolved componentCode
        jobId: job.id, // Link to job for cycle tracking
        workOrderNo: workOrderNo,
        templateCode: workOrderNo,
        jobTitle: job.jobTitle,
        assignedTo: job.assignedTo || 'Unassigned',
        dueDate: job.nextDueDate,
        status: 'Due', // Start as Due since trigger condition is met
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
        // === CALENDAR CYCLE SNAPSHOTS (TRIGGER 2) ===
        driverType: 'CALENDAR',
        cycleDueDateSnapshot: dueDateStr,
        generateDateSnapshot: generateDateStr,
        dueDateSnapshot: dueDateStr,
        lastDoneDateSnapshot: job.lastDoneDate || null,
      };
      
      const createdWO = await this.createWorkOrder(workOrderData);
      results.generated++;
      results.workOrders.push(createdWO);
      
      // Add to sets to prevent duplicate generation in same run
      existingCycleWOs.set(cycleKey, workOrderData as any);
      activeWOSets.byJobId.add(job.id);
      activeWOSets.byJobNo.add(job.jobNo);
      
      const priorityLabel = isJobCritical(job) ? 'Critical' : 'Non-Critical';
      console.log(`✅ [Calendar Trigger 2] Auto-generated WO ${workOrderNo} for ${priorityLabel} job ${job.jobNo}`);
      console.log(`   last_done=${job.lastDoneDate || 'N/A'}, LT=${leadTimeDays} days`);
      console.log(`   DUE_DATE=${dueDateStr}, GENERATE_DATE=${generateDateStr}, Today=${today.toISOString().split('T')[0]}`);
    }
    
    // Log settings used for transparency
    if (settingsCache.size > 0) {
      Array.from(settingsCache.entries()).forEach(([vId, settings]) => {
        if (settings) {
          console.log(`📋 [Calendar WO Gen] Vessel ${vId} lead times: Critical=${settings.calendarLeadDaysCritical}d, Non-Critical=${settings.calendarLeadDaysNonCritical}d`);
        } else {
          console.log(`⚠️ [Calendar WO Gen] Vessel ${vId} has no PMS settings configured, using 0 day lead time`);
        }
      });
    }
    
    return results;
  }

  /**
   * Bulk create work orders
   */
  async bulkCreateWorkOrders(workOrders: InsertWorkOrder[]): Promise<WorkOrder[]> {
    return storage.bulkCreateWorkOrders(workOrders);
  }

  /**
   * Bulk update work orders
   */
  async bulkUpdateWorkOrders(workOrders: Array<{ templateCode: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]> {
    return storage.bulkUpdateWorkOrders(workOrders);
  }

  /**
   * Bulk upsert work orders
   */
  async bulkUpsertWorkOrders(workOrders: InsertWorkOrder[]): Promise<{ created: number; updated: number }> {
    return storage.bulkUpsertWorkOrders(workOrders);
  }
}

// Export singleton instance
export const workOrderService = new WorkOrderService();
