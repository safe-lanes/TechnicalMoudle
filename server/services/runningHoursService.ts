import { storage } from "../storage";
import type { RunningHoursAudit, InsertRunningHoursAudit, CascadeRunningHoursRequest } from "@shared/schema";

/**
 * Running Hours Service
 * Handles all business logic related to running hours tracking, cascade updates,
 * and automatic work order generation based on running hour thresholds
 */

export class RunningHoursService {
  /**
   * Get all running hours audit records for a vessel
   */
  async getRunningHoursAudits(vesselId: string): Promise<RunningHoursAudit[]> {
    return storage.getRunningHoursAudits(vesselId);
  }

  /**
   * Get running hours audit records for a specific component
   */
  async getRunningHoursAuditsForComponent(vesselId: string, componentId: string): Promise<RunningHoursAudit[]> {
    const allAudits = await storage.getRunningHoursAudits(vesselId);
    return allAudits.filter(audit => audit.componentId === componentId);
  }

  /**
   * Create a new running hours audit entry
   */
  async createRunningHoursAudit(auditData: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
    return storage.createRunningHoursAudit(auditData);
  }

  /**
   * Cascade running hours update to parent and children components
   * This method:
   * 1. Updates the component's running hours
   * 2. Creates an audit trail entry
   * 3. Recursively updates all child components
   * 4. Checks if any Running Hours-based jobs have exceeded their threshold
   * 5. Auto-generates work orders for jobs that have exceeded threshold
   */
  async cascadeRunningHoursUpdate(cascadeData: CascadeRunningHoursRequest): Promise<{
    updatedComponents: number;
    auditsCreated: number;
    workOrdersGenerated: number;
    workOrders: any[];
  }> {
    return storage.cascadeRunningHoursUpdate(cascadeData);
  }

  /**
   * Validate running hours update data
   */
  validateRunningHoursUpdate(updateData: Partial<CascadeRunningHoursRequest>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!updateData.componentId) {
      errors.push('Component ID is required');
    }

    if (updateData.newRunningHours === undefined || updateData.newRunningHours === null) {
      errors.push('New running hours value is required');
    } else if (updateData.newRunningHours < 0) {
      errors.push('Running hours cannot be negative');
    }

    if (!updateData.updatedBy) {
      errors.push('Updated by is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get latest running hours for a component
   */
  async getLatestRunningHours(componentId: string): Promise<number | null> {
    const component = await storage.getComponent(componentId);
    if (!component || !component.runningHours) {
      return null;
    }
    return typeof component.runningHours === 'string' ? parseFloat(component.runningHours) : component.runningHours;
  }

  /**
   * Calculate running hours delta between updates
   */
  calculateDelta(oldValue: number, newValue: number): number {
    return newValue - oldValue;
  }

  /**
   * Check if running hours update is realistic
   * (prevents accidental large jumps or decreases)
   */
  isRealisticUpdate(oldValue: number, newValue: number, maxHourlyIncrease: number = 24): boolean {
    const delta = newValue - oldValue;
    
    // Prevent decreases
    if (delta < 0) {
      return false;
    }
    
    // Prevent unrealistic jumps
    if (delta > maxHourlyIncrease) {
      return false;
    }
    
    return true;
  }
}

// Export singleton instance
export const runningHoursService = new RunningHoursService();
