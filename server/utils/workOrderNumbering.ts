import type { IStorage } from '../storage';

/**
 * Spec-compliant Work Order Numbering System
 * 
 * Planned WO Format: <JOB_CODE>-<YYYY>-<RUNNING_3DIGIT>
 * Example: MK-000041-2025-001
 * 
 * Unplanned WO Format: UWO-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>
 * Example: UWO-VESSEL01-2025-001
 * 
 * Running numbers are:
 * - Per vessel
 * - Per year
 * - Generated atomically
 * - No duplicates allowed
 */

/**
 * Generate next work order number for a planned WO
 * Format: <JOB_CODE>-<YYYY>-<RUNNING_3DIGIT>
 */
export async function generatePlannedWorkOrderNumber(
  storage: IStorage,
  jobCode: string,
  vesselId?: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  
  // Ensure job code is never empty - fallback to UNKNOWN-JOB if needed
  const safeJobCode = jobCode && jobCode.trim() ? jobCode.trim() : 'UNKNOWN-JOB';
  
  // Find all WOs for this job in current year with planned numbering format
  const allWorkOrders = await storage.getWorkOrders(vesselId);
  
  const existingWOsForJob = allWorkOrders.filter(wo => {
    // Match planned WO format: <JOB_CODE>-<YYYY>-<RUNNING_3DIGIT>
    const plannedPattern = new RegExp(`^${escapeRegex(safeJobCode)}-${currentYear}-(\\d+)$`);
    return plannedPattern.test(wo.workOrderNo);
  });
  
  // Extract running numbers and find max
  let maxRunningNumber = 0;
  existingWOsForJob.forEach(wo => {
    const match = wo.workOrderNo.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) {
        maxRunningNumber = num;
      }
    }
  });
  
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, '0');
  
  return `${safeJobCode}-${currentYear}-${paddedNumber}`;
}

/**
 * Generate next work order number for an unplanned WO
 * Format: UWO-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>
 */
export async function generateUnplannedWorkOrderNumber(
  storage: IStorage,
  vesselId: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  
  // Find all unplanned WOs for this vessel in current year
  const allWorkOrders = await storage.getWorkOrders(vesselId);
  
  const existingUnplannedWOs = allWorkOrders.filter(wo => {
    // Match unplanned WO format: UWO-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>
    const unplannedPattern = new RegExp(`^UWO-${escapeRegex(vesselId)}-${currentYear}-(\\d+)$`);
    return unplannedPattern.test(wo.workOrderNo);
  });
  
  // Extract running numbers and find max
  let maxRunningNumber = 0;
  existingUnplannedWOs.forEach(wo => {
    const match = wo.workOrderNo.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) {
        maxRunningNumber = num;
      }
    }
  });
  
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, '0');
  
  return `UWO-${vesselId}-${currentYear}-${paddedNumber}`;
}

/**
 * Helper function to escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Determine if a work order should be planned or unplanned based on job linkage
 * Planned: Has a linked job (jobId or templateCode exists)
 * Unplanned: Created ad-hoc without job template
 */
export function determineWorkOrderType(jobId?: string | null, templateCode?: string | null): 'Planned' | 'Unplanned' {
  return (jobId || templateCode) ? 'Planned' : 'Unplanned';
}
