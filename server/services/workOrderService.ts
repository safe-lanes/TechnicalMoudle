import { storage } from "../storage";
import type { WorkOrder, InsertWorkOrder, WorkOrderExecution, InsertWorkOrderExecution } from "@shared/schema";
import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { shouldGenerateWorkOrder } from "@shared/dateUtils";
import { nanoid } from "nanoid";
import { jobService } from "./jobService";

/**
 * Work Order Service
 * Handles all business logic related to work order execution records
 * Separated from routes for better maintainability
 */

export class WorkOrderService {
  /**
   * Get all work orders with optional vessel filter and computed status
   */
  async getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
    const workOrders = await storage.getWorkOrders(vesselId);
    
    // Augment each work order with computed status
    return workOrders.map(wo => ({
      ...wo,
      computedStatus: computeWorkOrderStatus({
        dueDate: wo.dueDate,
        isExecution: wo.isExecution,
        status: wo.status,
        completionDateTime: wo.dateCompleted
      })
    }));
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

    // Auto-generate work order number if not provided
    if (!workOrderData.workOrderNo && workOrderData.componentCode) {
      workOrderData.workOrderNo = `WO-${workOrderData.componentCode}-${new Date().getFullYear()}-${nanoid(4).toUpperCase()}`;
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
   */
  async getWorkOrderExecution(workOrderId: string): Promise<WorkOrderExecution | undefined> {
    const executions = await storage.getWorkOrderExecutions();
    return executions.find(exec => exec.workOrderId === workOrderId);
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
   * Returns statistics about how many work orders were generated
   */
  async autoGenerateWorkOrdersFromJobs(vesselId?: string): Promise<{
    checked: number;
    generated: number;
    workOrders: WorkOrder[];
  }> {
    // Get all Calendar-based jobs that are due
    const dueJobs = await jobService.getDueCalendarJobs(vesselId);
    
    // Get all active work orders to prevent duplicates
    const allWorkOrders = await this.getWorkOrders(vesselId);
    const activeWorkOrderKeys = new Set(
      allWorkOrders
        .filter(wo => ['Active', 'Due', 'Due (Grace P)', 'Overdue', 'Pending Approval'].includes(wo.status))
        .map(wo => `${wo.componentCode}|${wo.jobTitle}`)
    );
    
    const results = {
      checked: dueJobs.length,
      generated: 0,
      workOrders: [] as WorkOrder[]
    };
    
    // Check each job to see if it should generate a work order
    for (const job of dueJobs) {
      const shouldGenerate = shouldGenerateWorkOrder(job.nextDueDate);
      
      if (shouldGenerate) {
        // O(1) duplicate check using Set
        const workOrderKey = `${job.componentCode}|${job.jobTitle}`;
        
        if (!activeWorkOrderKeys.has(workOrderKey)) {
          // Generate work order
          const workOrderNo = `WO-${job.componentCode}-${new Date().getFullYear()}-${nanoid(4).toUpperCase()}`;
          
          const workOrderData: InsertWorkOrder = {
            vesselId: job.vesselId,
            component: job.componentId,
            componentCode: job.componentCode,
            workOrderNo: workOrderNo,
            templateCode: workOrderNo,
            jobTitle: job.jobTitle,
            assignedTo: job.assignedTo || 'Unassigned',
            dueDate: job.nextDueDate,
            status: 'Active',
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
            }
          };
          
          const createdWO = await this.createWorkOrder(workOrderData);
          results.generated++;
          results.workOrders.push(createdWO);
          
          // Add to Set to prevent duplicate generation in same run
          activeWorkOrderKeys.add(workOrderKey);
          
          console.log(`✅ Auto-generated work order ${workOrderNo} for job ${job.jobNo} (${job.jobTitle})`);
        }
      }
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
