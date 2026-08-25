import type { IStorage } from '../storage';
import { ValidationError } from '../modules/shared/errors';

/**
 * Spec-compliant Work Order Numbering System
 * 
 * Planned WO Format: <V_CODE>-<JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>
 * Example: 001-MK-000041-711.001-2025-001
 * 
 * Unplanned WO Format: <V_CODE>-UWO-<COMPONENT_CODE>-<YEAR>-<RUNNING_NUMBER>
 * Example: 001-UWO-702.005.01-2026-001
 * 
 * Running numbers are:
 * - Per vessel (for uniqueness)
 * - Per component code (for unplanned)
 * - Per job + component combination (for planned)
 * - Per year
 * - Generated atomically
 * - No duplicates allowed
 */

/**
 * Generate next work order number for a planned WO
 * Format: <V_CODE>-<JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>
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
  const vesselCode = await resolveVesselCode(storage, vesselId);
  
  // Do not reset a sequence when a vessel begins using the v_code-prefixed
  // format. Existing legacy work orders remain part of the no-reuse sequence.
  const allWorkOrders = await storage.getWorkOrders(vesselId);
  const legacyPattern = new RegExp(
    `^${escapeRegex(safeJobCode)}-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`
  );
  const vesselPrefixedPattern = new RegExp(
    `^${escapeRegex(vesselCode)}-${escapeRegex(safeJobCode)}-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`
  );

  const maxRunningNumber = findMaxSequence(
    allWorkOrders.map(wo => wo.workOrderNo),
    [legacyPattern, vesselPrefixedPattern]
  );
  
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, '0');
  
  return `${vesselCode}-${safeJobCode}-${safeComponentCode}-${currentYear}-${paddedNumber}`;
}

/**
 * Generate next work order number for an unplanned WO
 * Format: <V_CODE>-UWO-<COMPONENT_CODE>-<YEAR>-<RUNNING_NUMBER>
 * Example: 001-UWO-702.005.01-2026-001
 * 
 * Numbers are unique per vessel, sequential per year
 */
export async function generateUnplannedWorkOrderNumber(
  storage: IStorage,
  vesselId: string,
  componentCode?: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  
  // Validate component code is provided for proper format
  if (!componentCode || !componentCode.trim()) {
    throw new Error('Component code is required for unplanned work order numbering');
  }
  
  const safeComponentCode = componentCode.trim();
  const vesselCode = await resolveVesselCode(storage, vesselId);
  
  // Count the legacy format as well as the vessel-prefixed format so a
  // vessel's component/year sequence never restarts during the rollout.
  const allWorkOrders = await storage.getWorkOrders(vesselId);
  const legacyPattern = new RegExp(
    `^UWO-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`
  );
  const vesselPrefixedPattern = new RegExp(
    `^${escapeRegex(vesselCode)}-UWO-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`
  );
  const maxRunningNumber = findMaxSequence(
    allWorkOrders.map(wo => wo.workOrderNo),
    [legacyPattern, vesselPrefixedPattern]
  );
  
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, '0');
  
  return `${vesselCode}-UWO-${safeComponentCode}-${currentYear}-${paddedNumber}`;
}

/**
 * Resolve the external vessel code for one exact vessel UUID. The generated
 * number must never use a first-row, name-based, or internal-code fallback.
 */
export async function resolveVesselCode(storage: IStorage, vesselId?: string): Promise<string> {
  const normalizedVesselId = vesselId?.trim();
  if (!normalizedVesselId) {
    throw new ValidationError(
      'Vessel ID is required to generate a work order number.',
      { code: 'VESSEL_ID_REQUIRED_FOR_WO_NUMBER' }
    );
  }

  const vessel = await storage.getVessel(normalizedVesselId);
  const vesselCode = vessel?.vCode?.trim();
  if (!vesselCode) {
    throw new ValidationError(
      'Vessel external code (v_code) is required before generating a work order number.',
      { code: 'VESSEL_CODE_REQUIRED_FOR_WO_NUMBER', vesselId: normalizedVesselId }
    );
  }

  return vesselCode;
}

function findMaxSequence(workOrderNumbers: Array<string | null | undefined>, patterns: RegExp[]): number {
  let maxRunningNumber = 0;
  for (const workOrderNo of workOrderNumbers) {
    if (!workOrderNo) continue;
    for (const pattern of patterns) {
      const match = workOrderNo.match(pattern);
      if (!match) continue;
      const sequence = parseInt(match[1], 10);
      if (!isNaN(sequence) && sequence > maxRunningNumber) {
        maxRunningNumber = sequence;
      }
      break;
    }
  }
  return maxRunningNumber;
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
