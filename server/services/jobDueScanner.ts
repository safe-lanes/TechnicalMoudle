import { workOrderService } from "./workOrderService";
import { jobService } from "./jobService";
import { storage } from "../storage";
import { generatePlannedWorkOrderNumber } from "../utils/workOrderNumbering";
import type { InsertWorkOrder, Job } from "@shared/schema";

/**
 * Job Due Scanner Service
 * Scans all jobs and generates work orders when they become due
 * Supports both Calendar-based and Running Hours-based jobs
 */

export class JobDueScannerService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scanIntervalMs = 60 * 60 * 1000; // 1 hour

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
   */
  private async processRunningHoursJobs(): Promise<{ checked: number; generated: number }> {
    const allJobs = await storage.getJobs();
    const rhJobs = allJobs.filter(job => 
      job.maintenanceBasis === 'Running Hours' && 
      job.nextDueRH && 
      parseFloat(job.nextDueRH) > 0
    );

    // Get all active work orders to prevent duplicates
    const allWorkOrders = await storage.getWorkOrders();
    const activeWorkOrderKeys = new Set(
      allWorkOrders
        .filter(wo => ['Active', 'Due', 'Due (Grace P)', 'Overdue', 'Pending Approval'].includes(wo.status))
        .map(wo => `${wo.componentCode}|${wo.jobTitle}`)
    );

    let generated = 0;

    for (const job of rhJobs) {
      // Get the component to check current running hours
      const component = await storage.getComponent(job.componentId);
      if (!component) continue;

      // Get parent component for running hours (RH is tracked on parent)
      let rhSource = component;
      if (component.parentId) {
        const parent = await storage.getComponent(component.parentId);
        if (parent && parent.runningHours) {
          rhSource = parent;
        }
      }

      const currentRH = parseFloat(rhSource.runningHours || '0');
      const nextDueRH = parseFloat(job.nextDueRH || '0');

      // Check if job is due (current RH >= next due RH)
      if (currentRH >= nextDueRH) {
        const workOrderKey = `${job.componentCode}|${job.jobTitle}`;
        
        if (!activeWorkOrderKeys.has(workOrderKey)) {
          // Generate spec-compliant work order number: <JOB CODE>.WO-<YEAR>-<RUNNING NUMBER>
          const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, job.vesselId || undefined);
          
          const workOrderData: InsertWorkOrder = {
            vesselId: job.vesselId,
            component: job.componentName, // Use component name, not ID
            componentCode: job.componentCode,
            workOrderNo: workOrderNo,
            templateCode: workOrderNo,
            jobTitle: job.jobTitle,
            assignedTo: job.assignedTo || 'Unassigned',
            dueDate: undefined, // RH-based jobs don't have calendar due date
            nextDueReading: job.nextDueRH, // Store the due RH value
            currentReading: String(currentRH), // Store current RH at generation time
            status: 'Active',
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
            }
          };
          
          await workOrderService.createWorkOrder(workOrderData);
          generated++;
          
          // Add to Set to prevent duplicate generation in same run
          activeWorkOrderKeys.add(workOrderKey);
          
          console.log(`✅ Auto-generated RH work order ${workOrderNo} for job ${job.jobNo} (${job.jobTitle}) at ${currentRH} RH (due: ${nextDueRH} RH)`);
        }
      }
    }

    return { checked: rhJobs.length, generated };
  }

  /**
   * Generate a work order for a specific job on-demand
   * Returns the created work order or null if already exists
   */
  async generateWorkOrderForJob(jobId: string): Promise<{ success: boolean; workOrder?: any; message: string }> {
    const job = await storage.getJob(jobId);
    if (!job) {
      return { success: false, message: 'Job not found' };
    }

    // Check for existing active work order
    const allWorkOrders = await storage.getWorkOrders(job.vesselId || undefined);
    const existingWO = allWorkOrders.find(wo => 
      wo.componentCode === job.componentCode && 
      wo.jobTitle === job.jobTitle &&
      ['Active', 'Due', 'Due (Grace P)', 'Overdue', 'Pending Approval'].includes(wo.status)
    );

    if (existingWO) {
      return { 
        success: false, 
        message: `Active work order already exists: ${existingWO.workOrderNo}` 
      };
    }

    // Generate spec-compliant work order number: <JOB CODE>.WO-<YEAR>-<RUNNING NUMBER>
    const workOrderNo = await generatePlannedWorkOrderNumber(storage, job.jobNo, job.vesselId || undefined);
    
    const workOrderData: InsertWorkOrder = {
      vesselId: job.vesselId,
      component: job.componentName, // Use component name, not ID
      componentCode: job.componentCode,
      workOrderNo: workOrderNo,
      templateCode: workOrderNo,
      jobTitle: job.jobTitle,
      assignedTo: job.assignedTo || 'Unassigned',
      dueDate: job.maintenanceBasis === 'Calendar' ? (job.nextDueDate || undefined) : undefined,
      nextDueReading: job.maintenanceBasis === 'Running Hours' ? job.nextDueRH : undefined,
      status: 'Active',
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
      }
    };
    
    const createdWO = await workOrderService.createWorkOrder(workOrderData);
    
    console.log(`✅ On-demand work order ${workOrderNo} created for job ${job.jobNo}`);
    
    return { 
      success: true, 
      workOrder: createdWO,
      message: `Work order ${workOrderNo} created successfully` 
    };
  }
}

export const jobDueScanner = new JobDueScannerService();
