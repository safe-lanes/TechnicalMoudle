import { parseDDMMYYYY } from '@shared/utils/dateCalculations';
import { WORK_ORDER_THRESHOLDS } from './constants';

const MONTH_NAMES: { [key: string]: number } = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
};

/**
 * Parse date in DD-MMM-YYYY format (e.g., "15-Jan-2024")
 */
function parseDDMMMYYYY(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = MONTH_NAMES[parts[1]];
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  
  return new Date(year, month, day);
}

/**
 * Parse date - handles both DD-MMM-YYYY (15-Jan-2024) and DD-MM-YYYY (15-01-2024) formats
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  // Try DD-MMM-YYYY first (more common in this app)
  const dmmyResult = parseDDMMMYYYY(dateStr);
  if (dmmyResult) return dmmyResult;
  
  // Fall back to DD-MM-YYYY
  return parseDDMMYYYY(dateStr);
}

/**
 * GRACE_PERIOD_CONSTANTS - NOW USES CENTRALIZED THRESHOLDS
 * All values imported from shared/workOrders/constants.ts
 * DO NOT CHANGE THESE VALUES HERE - modify constants.ts instead
 */
export const GRACE_PERIOD_CONSTANTS = {
  DUE_HORIZON_DAYS: WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS,
  GRACE_PERIOD_DAYS: WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
  RH_GRACE_HOURS: WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
  DEFAULT_RH_LEAD_TIME: WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS,
} as const;

export type GraceMode = 'COMPANY_STANDARD' | 'CUSTOM_DAYS';

export interface VesselGraceSettings {
  calendarGraceMode: GraceMode;
  calendarGraceDays: number;
  rhGraceHours: number;
  rhLeadTimeHours?: number; // RH Lead Time (used for DUE SOON categorization)
}

/**
 * Work order status types for display
 * - Legacy display statuses (still used for work orders with existing stored status)
 * - PLANNED/DUE SOON/DUE/OVERDUE are the spec-compliant RH status categories
 */
export type ComputedWorkOrderStatus = 
  | 'Active'      // Legacy: far from due
  | 'Planned'     // RH: RH_remaining > LT (more than lead time away)
  | 'Due Soon'    // RH: 0 < RH_remaining <= LT (within lead time but not yet due)
  | 'Due'         // RH: RH_remaining = 0 (at due point) OR Calendar: within horizon
  | 'Due (Grace P)' // Legacy: past due but within grace
  | 'Overdue'     // Past due (past grace for calendar, negative remaining for RH)
  | 'Completed'
  | 'Pending Approval'
  | 'Rejected'
  | 'Postponed';

/**
 * RH-specific status for maintenance planning (per workflow document)
 * Uses strict LT-driven categorization:
 * - OVERDUE: RH_remaining < 0
 * - DUE: RH_remaining = 0
 * - DUE_SOON: 0 < RH_remaining <= LT
 * - PLANNED: RH_remaining > LT (or FUTURE)
 */
export type RHStatusCategory = 'OVERDUE' | 'DUE' | 'DUE_SOON' | 'PLANNED' | 'FUTURE';

export interface WorkOrderStatusInput {
  dueDate?: string | null;
  dueRH?: number | null;
  currentRH?: number | null;
  isExecution?: boolean;
  status?: string;
  completionDateTime?: string | null;
  maintenanceBasis?: string;
  vesselGraceSettings?: VesselGraceSettings;
  rhLeadTimeHours?: number; // Lead time for RH-based status calculation
}

/**
 * Calculate grace end date based on Company Standard rule:
 * - If due date is in the last 7 days of the month → grace = 7 days
 * - Otherwise → grace extends to end of the due month
 */
function calculateCompanyStandardGraceEnd(dueDate: Date): Date {
  const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);
  endOfMonth.setHours(0, 0, 0, 0);
  
  // Check if due date is in last 7 days of month
  const daysUntilEndOfMonth = endOfMonth.getDate() - dueDate.getDate();
  
  if (daysUntilEndOfMonth <= 7) {
    // Due date is in last 7 days of month - use fixed 7-day grace
    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS);
    graceEnd.setHours(0, 0, 0, 0);
    return graceEnd;
  } else {
    // Grace extends to end of month
    return endOfMonth;
  }
}

/**
 * Calculate RH status category based on workflow document rules
 * 
 * Formulas (per workflow document):
 * - RH_remaining = RH_due - RH_effective_current
 * - RH_due = RH_last_done + Frequency (this should be pre-calculated and passed as dueRH)
 * 
 * Status categories:
 * - OVERDUE: RH_remaining < 0 (current RH exceeds due RH)
 * - DUE: RH_remaining = 0 (at exactly due RH, tolerance of ±1)
 * - DUE_SOON: 0 < RH_remaining <= LT (within lead time window)
 * - PLANNED (FUTURE): RH_remaining > LT (beyond lead time, not yet actionable)
 */
export function computeRHStatusCategory(
  dueRH: number,
  currentRH: number,
  leadTimeHours: number
): RHStatusCategory {
  // RH_remaining = RH_due - RH_effective_current
  const rhRemaining = dueRH - currentRH;
  
  // Status determination per workflow document
  if (rhRemaining < 0) {
    return 'OVERDUE';
  } else if (Math.abs(rhRemaining) < 1) {
    // At due point (with tolerance for floating point)
    return 'DUE';
  } else if (rhRemaining <= leadTimeHours) {
    // Within lead time window: 0 < RH_remaining <= LT
    return 'DUE_SOON';
  } else {
    // Beyond lead time: RH_remaining > LT
    return 'PLANNED';
  }
}

/**
 * Map RH status category to display status
 */
export function rhCategoryToDisplayStatus(category: RHStatusCategory): ComputedWorkOrderStatus {
  switch (category) {
    case 'OVERDUE':
      return 'Overdue';
    case 'DUE':
      return 'Due';
    case 'DUE_SOON':
      return 'Due Soon';
    case 'PLANNED':
    case 'FUTURE':
      return 'Planned';
    default:
      return 'Active';
  }
}

export function computeWorkOrderStatus(input: WorkOrderStatusInput): ComputedWorkOrderStatus {
  const { 
    dueDate, 
    dueRH, 
    currentRH, 
    isExecution, 
    status, 
    completionDateTime, 
    maintenanceBasis, 
    vesselGraceSettings,
    rhLeadTimeHours
  } = input;
  
  // Execution records use their stored status
  // IMPORTANT: Check Pending Approval BEFORE completionDateTime
  // Workflow: User fills Part B (sets completionDateTime) → Pending Approval → Approver approves → Completed
  if (isExecution) {
    if (status === 'Pending Approval') return 'Pending Approval';
    if (status === 'Rejected') return 'Rejected';
    if (status === 'Approved' || completionDateTime) return 'Completed';
    return 'Active';
  }
  
  // IMPORTANT: Check for Pending Approval BEFORE checking completion
  // This is the correct workflow: User fills Part B → Pending Approval → Approver approves → Completed
  // The status 'Pending Approval' takes precedence over completionDateTime because
  // the work order needs approval before it can be marked as Completed
  if (status === 'Pending Approval') return 'Pending Approval';
  
  // Templates: check for completion (only after Pending Approval check)
  if (completionDateTime || status === 'Completed') {
    return 'Completed';
  }
  
  // Check for manual postponed or rejected status
  if (status === 'Postponed') return 'Postponed';
  if (status === 'Rejected') return 'Rejected';
  
  // Branch based on maintenance basis for spec-compliant status calculation
  if (maintenanceBasis === 'Running Hours') {
    // Running Hours-based status calculation (per workflow document)
    if (dueRH == null || currentRH == null) return 'Planned';
    
    // Get lead time from settings
    // Important: Respect explicit zero lead time (null-coalescing only for undefined/null)
    // If rhLeadTimeHours is 0, use 0; only fall back to default when truly undefined
    let leadTime: number;
    if (rhLeadTimeHours !== undefined && rhLeadTimeHours !== null) {
      leadTime = rhLeadTimeHours;
    } else if (vesselGraceSettings?.rhLeadTimeHours !== undefined && vesselGraceSettings?.rhLeadTimeHours !== null) {
      leadTime = vesselGraceSettings.rhLeadTimeHours;
    } else {
      leadTime = GRACE_PERIOD_CONSTANTS.DEFAULT_RH_LEAD_TIME;
    }
    
    // Calculate RH status category using workflow document rules
    const category = computeRHStatusCategory(dueRH, currentRH, leadTime);
    
    // Map to display status
    return rhCategoryToDisplayStatus(category);
  } else {
    // Calendar-based status calculation (default)
    if (!dueDate) return 'Active';
    
    // Parse due date - supports both DD-MMM-YYYY and DD-MM-YYYY formats
    const dueDateObj = parseDate(dueDate);
    if (!dueDateObj) return 'Active';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDateTime = new Date(dueDateObj);
    dueDateTime.setHours(0, 0, 0, 0);
    
    // Calculate days difference
    const diffTime = dueDateTime.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate grace end date based on mode
    let graceEndDate: Date;
    
    if (vesselGraceSettings?.calendarGraceMode === 'CUSTOM_DAYS') {
      // Use custom fixed grace period
      graceEndDate = new Date(dueDateTime);
      graceEndDate.setDate(graceEndDate.getDate() + (vesselGraceSettings.calendarGraceDays || GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS));
      graceEndDate.setHours(0, 0, 0, 0);
    } else {
      // Default to COMPANY_STANDARD grace rule
      graceEndDate = calculateCompanyStandardGraceEnd(dueDateTime);
    }
    
    // Status logic for calendar jobs:
    // - Overdue: today is past grace end date
    // - Due (Grace P): past due date but within grace (today <= grace end date)
    // - Due: approaching but not yet due (positive days within horizon)
    // - Active: more than horizon away
    
    if (diffDays < 0) {
      // Past due date - check if we're still in grace period
      if (today > graceEndDate) {
        return 'Overdue';
      } else {
        return 'Due (Grace P)';
      }
    } else if (diffDays <= GRACE_PERIOD_CONSTANTS.DUE_HORIZON_DAYS) {
      return 'Due';
    } else {
      return 'Active';
    }
  }
}
