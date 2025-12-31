/**
 * Work Order Status Utilities
 * Centralized status handling for consistent blocking status checks
 * 
 * WO Generation Rules - Blocking Statuses:
 * A WO must NOT be created if an existing WO exists with these statuses:
 * - DUE / OVERDUE / PENDING APPROVAL / POSTPONED
 * 
 * Additional active statuses that block new WO creation:
 * - Active, Due (Grace P), In Progress, Open
 * 
 * This module provides case-insensitive status matching to handle
 * variations in how statuses are stored/displayed.
 */

/**
 * All statuses that block new WO generation (case-insensitive EXACT matching)
 * These represent work orders that are "in progress" or "pending"
 * 
 * Per WO Generation Rules:
 * - DUE / OVERDUE / PENDING APPROVAL / POSTPONED
 * - Additionally: Active, Due (Grace P), In Progress, Open
 */
const BLOCKING_STATUSES_EXACT = new Set([
  'active',
  'due',
  'due (grace p)',
  'due (grace)',
  'overdue',
  'pending approval',
  'pending_approval',
  'pendingapproval',
  'postponed',
  'in progress',
  'in_progress',
  'inprogress',
  'open',
]);

/**
 * Statuses that indicate a WO is completed/finalized and should not block new WO
 */
const COMPLETED_STATUSES_EXACT = new Set([
  'completed',
  'closed',
  'approved',
  'rejected',
  'cancelled',
  'canceled',
]);

/**
 * Check if a work order status blocks new WO generation
 * Uses case-insensitive EXACT matching to prevent false positives
 * (e.g., "Not Due" should NOT block, only "Due" should)
 * 
 * @param status - The status to check
 * @returns true if this status blocks new WO creation
 */
export function isBlockingStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  
  const normalizedStatus = status.toLowerCase().trim();
  
  // Use exact match against known blocking statuses
  return BLOCKING_STATUSES_EXACT.has(normalizedStatus);
}

/**
 * Check if a work order is completed/finalized
 * Uses case-insensitive EXACT matching
 * 
 * @param status - The status to check
 * @returns true if this status indicates completion
 */
export function isCompletedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  
  const normalizedStatus = status.toLowerCase().trim();
  
  // Use exact match against known completed statuses
  return COMPLETED_STATUSES_EXACT.has(normalizedStatus);
}

/**
 * Extract jobNo from a work order number
 * Handles multiple formats:
 * - NEW format: <JOB_NO>-<COMPONENT_CODE>-<YYYY>-<RUNNING> (e.g., MKR-IN-00002-403.001-2025-439)
 * - OLD format: <JOB_NO>-<YYYY>-<RUNNING> (e.g., MKR-IN-00001-2025-001)
 * - Variant: <JOB_NO>.WO-<YYYY>-<RUNNING> (e.g., MKR-SE-00005.WO-2025-002)
 */
export function extractJobNoFromWorkOrderNo(workOrderNo: string | undefined): string | null {
  if (!workOrderNo) return null;
  
  // Try NEW format first: has component code with dots before the year
  // Pattern: capture everything before -<digits>.<digits> pattern
  const newFormatMatch = workOrderNo.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
  if (newFormatMatch) {
    return newFormatMatch[1];
  }
  
  // Try OLD format with .WO suffix: MKR-SE-00005.WO-2025-002
  const woSuffixMatch = workOrderNo.match(/^(.+?)\.WO-\d{4}-\d+$/);
  if (woSuffixMatch) {
    return woSuffixMatch[1];
  }
  
  // Try OLD format: MKR-IN-00001-2025-001 (jobNo-year-running)
  const oldFormatMatch = workOrderNo.match(/^(.+)-\d{4}-\d+$/);
  if (oldFormatMatch) {
    return oldFormatMatch[1];
  }
  
  return null;
}

/**
 * Build a set of job numbers that have active/blocking work orders
 * Used for job-level lock: "one active WO per job at a time"
 */
export function buildJobsWithActiveWOSet(workOrders: Array<{ status: string; workOrderNo?: string }>): Set<string> {
  const jobsWithActiveWO = new Set<string>();
  
  workOrders.forEach(wo => {
    if (isBlockingStatus(wo.status)) {
      const jobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
      if (jobNo) {
        jobsWithActiveWO.add(jobNo);
      }
    }
  });
  
  return jobsWithActiveWO;
}

/**
 * Build a map of existing cycle-based work orders for RH jobs
 * Key: `${jobNo}|${cycleDueRh}`
 * 
 * IMPORTANT: Includes ALL work orders (active AND completed) because a completed
 * WO still represents that cycle being satisfied. Only excludes cancelled/rejected.
 */
export function buildRhCycleWOMap<T extends { status: string; workOrderNo?: string; cycleDueRhSnapshot?: string | null }>(
  workOrders: T[]
): Map<string, T> {
  const cycleMap = new Map<string, T>();
  
  workOrders.forEach(wo => {
    // Skip cancelled/rejected WOs - they don't count as cycle satisfaction
    const normalizedStatus = wo.status?.toLowerCase().trim() || '';
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'rejected') {
      return;
    }
    
    if (wo.cycleDueRhSnapshot) {
      const jobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
      if (jobNo) {
        const cycleKey = `${jobNo}|${wo.cycleDueRhSnapshot}`;
        cycleMap.set(cycleKey, wo);
      }
    }
  });
  
  return cycleMap;
}

/**
 * Build a map of existing cycle-based work orders for Calendar jobs
 * Key: `${jobNo}|${cycleDueDate}`
 * 
 * IMPORTANT: Includes ALL work orders (active AND completed) because a completed
 * WO still represents that cycle being satisfied. Only excludes cancelled/rejected.
 */
export function buildCalendarCycleWOMap<T extends { status: string; workOrderNo?: string; cycleDueDateSnapshot?: string | null }>(
  workOrders: T[]
): Map<string, T> {
  const cycleMap = new Map<string, T>();
  
  workOrders.forEach(wo => {
    // Skip cancelled/rejected WOs - they don't count as cycle satisfaction
    const normalizedStatus = wo.status?.toLowerCase().trim() || '';
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'rejected') {
      return;
    }
    
    if (wo.cycleDueDateSnapshot) {
      const jobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
      if (jobNo) {
        const cycleKey = `${jobNo}|${wo.cycleDueDateSnapshot}`;
        cycleMap.set(cycleKey, wo);
      }
    }
  });
  
  return cycleMap;
}

/**
 * Find an existing blocking WO for a job by jobId
 * Also checks older cycles using jobNo extraction
 */
export function findBlockingWOForJob<T extends { status: string; jobId?: string | null; workOrderNo?: string }>(
  workOrders: T[],
  jobId: string,
  jobNo: string
): T | undefined {
  return workOrders.find(wo => {
    if (!isBlockingStatus(wo.status)) return false;
    
    // Direct match by jobId
    if (wo.jobId === jobId) return true;
    
    // Match by extracted jobNo from workOrderNo
    const woJobNo = extractJobNoFromWorkOrderNo(wo.workOrderNo);
    return woJobNo === jobNo;
  });
}
