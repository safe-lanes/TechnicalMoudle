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
   * Includes pre-creation validation to prevent duplicate active work orders for the same job
   */
  async createWorkOrder(workOrderData: InsertWorkOrder): Promise<WorkOrder> {
    // Validate required fields
    if (!workOrderData.vesselId) {
      throw new Error('Vessel ID is required');
    }
    
    if (!workOrderData.jobTitle) {
      throw new Error('Job title is required');
    }

    // DUPLICATE PREVENTION: Check if there's already an active work order for this job + component combination
    // This is a safeguard in addition to the database partial unique index
    // Uses isBlockingStatus() for consistent status matching across all code paths
    // FIX: Check by jobId + componentCode to allow one WO per linked component (not just per job)
    // NOTE: If componentCode is null/undefined, fall back to job-level check for backwards compatibility
    if (workOrderData.jobId) {
      const existingWOs = await storage.getWorkOrders(workOrderData.vesselId);
      const newComponentCode = workOrderData.componentCode || null;
      
      const existingActiveWO = existingWOs.find(wo => {
        if (wo.jobId !== workOrderData.jobId) return false;
        if (!isBlockingStatus(wo.status)) return false;
        
        // Normalize componentCode: treat null, undefined, and empty string as equivalent
        const existingComponentCode = wo.componentCode || null;
        
        // If new WO has componentCode, match exactly (including both being null)
        // This allows multiple WOs for same job if they have DIFFERENT componentCodes
        return existingComponentCode === newComponentCode;
      });
      
      if (existingActiveWO) {
        console.warn(`⚠️ [Duplicate Prevention] Active work order already exists for job ${workOrderData.jobId} + component ${workOrderData.componentCode}: ${existingActiveWO.workOrderNo} (status: ${existingActiveWO.status})`);
        throw new Error(`Work Order already exists for this job and component: ${existingActiveWO.workOrderNo}. Only one active work order is allowed per job-component combination.`);
      }
    }

    // Work order number should already be generated by the caller using the appropriate utility
    // If not provided for some reason (unplanned WO), generate unplanned format
    if (!workOrderData.workOrderNo) {
      // For unplanned WOs, componentCode is required for the new format
      const componentCode = workOrderData.componentCode || '';
      if (!componentCode) {
        throw new Error('Component code is required for unplanned work order numbering');
      }
      workOrderData.workOrderNo = await generateUnplannedWorkOrderNumber(storage, workOrderData.vesselId, componentCode);
      workOrderData.templateCode = workOrderData.workOrderNo;
    }

    return storage.createWorkOrder(workOrderData);
  }

  /**
   * Update an existing work order
   */
  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    const updatesAny = updates as any;

    // Layer 7: When transitioning to Pending Approval with RH data, apply isolation logic
    if (updatesAny.status === 'Pending Approval' && updatesAny.currentReading) {
      const runningHours = parseInt(updatesAny.currentReading);
      if (!isNaN(runningHours) && runningHours > 0) {
        // Store completion RH snapshot on the work order
        updatesAny.completionRH = String(runningHours);
        updatesAny.completionRHValidated = true;
        updatesAny.completionRHSource = updatesAny.completionRHSource || 'MANUAL_ENTRY';
        updatesAny.runningHoursAtCompletion = runningHours;

        // Store justification fields if provided
        if (updatesAny.rhJustification) {
          updatesAny.rhJustificationProvidedBy = updatesAny.performedBy || 'System';
          updatesAny.rhJustificationDate = new Date();
        }

        // Create audit trail for the RH snapshot (isolated — does NOT modify RH Module)
        try {
          const wo = await storage.getWorkOrder(id);
          if (wo) {
            const { validateRHEntry } = await import('../modules/running-hours/services/rhTimelineValidationService');
            const allComponents = wo.vesselId ? await storage.getComponents(wo.vesselId) : [];
            const component = allComponents.find((c: any) => c.name === wo.component || c.componentCode === (wo as any).componentCode);

            if (component) {
              const completionDate = updatesAny.dateOfCompletion || updatesAny.completionDateTime?.split('T')[0] || new Date().toISOString().split('T')[0];
              const validation = await validateRHEntry(component.cuuid, completionDate, runningHours);

              updatesAny.completionRHValidationDetails = {
                isValid: validation.isValid,
                validationDate: new Date().toISOString(),
                validRange: validation.validRange,
                utilizationRate: validation.utilizationRate,
                requiresJustification: validation.requiresJustification,
                validationErrors: validation.anomalyFlags
              };

              // Create read-only audit entry (ISOLATION: no setComponentRunningHours call)
              const previousRH = parseInt(component.currentCumulativeRH || '0');
              await storage.createRunningHoursAudit({
                componentId: component.cuuid,
                vesselId: wo.vesselId || component.vesselId,
                previousRH: String(previousRH),
                newRH: String(runningHours),
                cumulativeRH: String(runningHours),
                dateUpdatedLocal: completionDate,
                dateUpdatedTZ: 'UTC',
                enteredAtUTC: new Date(),
                userId: updatesAny.performedBy || 'System',
                source: 'workorder',
                notes: `RH snapshot via WO save: ${wo.workOrderNo || wo.id} (ISOLATED)`,
                meterReplaced: false
              });
              console.log(`📋 [Layer 7] RH snapshot ${runningHours} saved for WO ${wo.workOrderNo || id}. No RH Module modification.`);
            }
          }
        } catch (err: any) {
          console.warn(`⚠️ [Layer 7] RH audit trail creation failed: ${err.message}`);
        }
      }
    }

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
    // Note: We fetch WOs for the specified vessel (or all) but use vessel-scoped keys
    const allWorkOrders = await this.getWorkOrders(vesselId);
    
    // JOB-LEVEL LOCK: Build sets of jobs that already have an active WO
    // Rule: "one active WO per job at a time" - prevents ANY duplicate regardless of cycle
    // Uses both jobId (primary) and jobNo (fallback) for comprehensive blocking
    // Note: byJobNo is now vessel-scoped with key format: `${vesselId}|${jobNo}`
    const activeWOSets = buildJobsWithActiveWOSet(allWorkOrders, vesselId);
    
    // CYCLE UNIQUENESS: Also build a map by (vesselId + jobNo + cycleDueDate) for cycle-level check
    // Uses case-insensitive status matching via isBlockingStatus()
    // Key format is now: `${vesselId}|${jobNo}|${cycleDueDate}` for vessel-scoped uniqueness
    const existingCycleWOs = buildCalendarCycleWOMap(allWorkOrders, vesselId);
    
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
      
      // Normalize due date for cycle key (ISO date string YYYY-MM-DD)
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      // Calculate generate date string for snapshot
      const generateDateStr = generateDate.toISOString().split('T')[0];
      
      // FIX: Get ALL linked components for this job (many-to-many relationship)
      // Each linked component should get its own work order
      const linkedComponents = await storage.getLinkedComponentsForJob(job.juuid);
      
      // If no linked components found, fall back to job's primary component
      if (linkedComponents.length === 0 && job.componentId) {
        const primaryComponent = await storage.getComponent(job.componentId);
        if (primaryComponent) {
          linkedComponents.push({
            componentId: primaryComponent.cuuid,
            componentCode: primaryComponent.componentCode || '',
            componentName: primaryComponent.name || ''
          });
        }
      }
      
      if (linkedComponents.length === 0) {
        console.warn(`⚠️ No linked components for calendar job ${job.jobNo} - skipping WO generation`);
        continue;
      }
      
      // Generate a work order for EACH linked component
      for (const linkedComponent of linkedComponents) {
        const componentCode = linkedComponent.componentCode;
        const componentName = linkedComponent.componentName;
        const componentId = linkedComponent.componentId;
        
        if (!componentCode) {
          console.warn(`⚠️ No component code for linked component ${componentId} of job ${job.jobNo} - skipping`);
          continue;
        }
        
        // COMPONENT-LEVEL CYCLE CHECK: Each component should have its own WO per cycle
        // Key format: `${vesselId}|${jobNo}|${componentCode}|${dueDateStr}`
        const componentCycleKey = `${job.vesselId || 'unknown'}|${job.jobNo}|${componentCode}|${dueDateStr}`;
        
        // Check if WO already exists for this job + component + cycle
        const existingWOForComponent = allWorkOrders.find(wo => 
          wo.jobId === job.juuid &&
          wo.componentCode === componentCode &&
          isBlockingStatus(wo.status)
        );
        
        if (existingWOForComponent) {
          continue; // Already has an active WO for this component - skip
        }
        
        // Check cycle map for this specific component
        if (existingCycleWOs.has(componentCycleKey)) {
          continue; // WO already exists for this component's cycle - skip
        }
        
        const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, componentCode, job.vesselId || undefined);
        
        const workOrderData: InsertWorkOrder = {
          vesselId: job.vesselId,
          component: componentName,
          componentCode: componentCode,
          jobId: job.juuid,
          workOrderNo: workOrderNo,
          templateCode: workOrderNo,
          jobTitle: job.jobTitle,
          assignedTo: job.assignedTo || 'Unassigned',
          dueDate: job.nextDueDate,
          status: 'Due',
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
          driverType: 'CALENDAR',
          cycleDueDateSnapshot: dueDateStr,
          generateDateSnapshot: generateDateStr,
          dueDateSnapshot: dueDateStr,
          lastDoneDateSnapshot: job.lastDoneDate || null,
        };
        
        try {
          const createdWO = await this.createWorkOrder(workOrderData);
          results.generated++;
          results.workOrders.push(createdWO);
          
          // Add to map to prevent duplicate generation in same run
          existingCycleWOs.set(componentCycleKey, workOrderData as any);
          
          const priorityLabel = isJobCritical(job) ? 'Critical' : 'Non-Critical';
          console.log(`✅ [Calendar Trigger 2] Auto-generated WO ${workOrderNo} for ${priorityLabel} job ${job.jobNo} -> component ${componentCode}`);
          console.log(`   last_done=${job.lastDoneDate || 'N/A'}, LT=${leadTimeDays} days`);
          console.log(`   DUE_DATE=${dueDateStr}, GENERATE_DATE=${generateDateStr}, Today=${today.toISOString().split('T')[0]}`);
        } catch (error: any) {
          console.warn(`⚠️ Failed to create WO for job ${job.jobNo} + component ${componentCode}: ${error.message}`);
        }
      }
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
