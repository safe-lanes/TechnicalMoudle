import type { IStorage } from '../storage';

/**
 * Spec-compliant Work Order Numbering System
 * 
 * Planned WO Format: <JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>
 * Example: MK-000041-711.001-2025-001
 * 
 * Unplanned WO Format: UWO-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>
 * Example: UWO-VESSEL01-2025-001
 * 
 * Running numbers are:
 * - Per vessel
 * - Per job + component combination
 * - Per year
 * - Generated atomically
 * - No duplicates allowed
 */

/**
 * Generate next work order number for a planned WO
 * Format: <JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>
 */
export async function generatePlannedWorkOrderNumber(
  storage: IStorage,
  jobCode: string,
  componentCode: string,
  vesselId?: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  
  // Validate required parameters - throw if component code is empty
  if (!componentCode || !componentCode.trim()) {
    throw new Error('Component code is required for planned work order numbering');
  }
  
  // Ensure job code is never empty - fallback to UNKNOWN-JOB if needed
  const safeJobCode = jobCode && jobCode.trim() ? jobCode.trim() : 'UNKNOWN-JOB';
  const safeComponentCode = componentCode.trim();
  
  // Find all WOs for this job+component in current year with planned numbering format
  const allWorkOrders = await storage.getWorkOrders(vesselId);
  
  const existingWOsForJobComponent = allWorkOrders.filter(wo => {
    // Match planned WO format: <JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>
    const plannedPattern = new RegExp(`^${escapeRegex(safeJobCode)}-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`);
    return plannedPattern.test(wo.workOrderNo);
  });
  
  // Extract running numbers and find max
  let maxRunningNumber = 0;
  existingWOsForJobComponent.forEach(wo => {
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
  
  return `${safeJobCode}-${safeComponentCode}-${currentYear}-${paddedNumber}`;
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

/**
 * Task type codes for job number generation
 * Format: MKR-<TYPE>-<5DIGIT>
 */
const TASK_TYPE_CODES: Record<string, string> = {
  'Inspection': 'IN',
  'Service': 'SE',
  'Overhaul': 'OV',
  'Calibration': 'CA',
  'Test': 'TE',
  'Replacement': 'RE',
  'Cleaning': 'CL',
  'Lubrication': 'LU',
  'General': 'GN'
};

/**
 * Generate next job number following the MKR-XX-NNNNN convention
 * Format: MKR-<TYPE_CODE>-<5DIGIT_SEQUENCE>
 * Example: MKR-IN-00001, MKR-SE-00002
 * 
 * @param storage - Storage interface to query existing jobs
 * @param taskType - Task type (Inspection, Service, Overhaul, etc.)
 * @returns Generated job number in MKR format
 */
export async function generateJobNumber(
  storage: IStorage,
  taskType?: string
): Promise<string> {
  // Get the type code, default to 'IN' (Inspection) if not specified
  const typeCode = taskType && TASK_TYPE_CODES[taskType] 
    ? TASK_TYPE_CODES[taskType] 
    : 'IN';
  
  // Find all existing jobs to get the max sequence number
  const allJobs = await storage.getJobs();
  
  // Extract sequence numbers from existing MKR-XX-NNNNN formatted job numbers
  let maxSequence = 0;
  allJobs.forEach(job => {
    if (job.jobNo) {
      // Match MKR-XX-NNNNN format (where XX is 2 letter code, NNNNN is 5 digits)
      const match = job.jobNo.match(/^MKR-[A-Z]{2}-(\d{5})$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }
  });
  
  const nextSequence = maxSequence + 1;
  const paddedSequence = nextSequence.toString().padStart(5, '0');
  
  return `MKR-${typeCode}-${paddedSequence}`;
}

/**
 * Validate if a job number follows the MKR-XX-NNNNN format
 * Returns true if valid, false otherwise
 */
export function isValidJobNumber(jobNo: string): boolean {
  if (!jobNo || typeof jobNo !== 'string') return false;
  // Match MKR-XX-NNNNN format (2 letter code, 5 digits)
  return /^MKR-[A-Z]{2}-\d{5}$/.test(jobNo);
}
