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
 * Work order status types for display - SPEC-COMPLIANT
 * Per specification, only these statuses are allowed:
 * - Active: >30 days or >720 RH before due
 * - Due: ≤30 days or ≤720 RH before due (within lead time)
 * - Due (Grace P): Past due but within grace period
 * - Overdue: Past due AND past grace period
 * - Completed/Pending Approval/Rejected/Postponed: Terminal states
 */
export type ComputedWorkOrderStatus = 
  | 'Active'        // Far from due (>30 days or >720 RH)
  | 'Due'           // Within lead time (≤30 days or ≤720 RH)
  | 'Due (Grace P)' // Past due but within grace period
  | 'Overdue'       // Past due AND past grace period
  | 'Completed'
  | 'Pending Approval'
  | 'Rejected'
  | 'Postponed';

/**
 * RH-specific status for maintenance planning - SPEC-COMPLIANT
 * Uses lead time and grace period driven categorization:
 * - OVERDUE: Past due RH AND past grace period
 * - DUE_GRACE: Past due RH but within grace period
 * - DUE: Within lead time (0 <= remaining <= leadTime)
 * - PLANNED/FUTURE: Beyond lead time (remaining > leadTime)
 */
export type RHStatusCategory = 'OVERDUE' | 'DUE_GRACE' | 'DUE' | 'DUE_SOON' | 'PLANNED' | 'FUTURE';

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
 * Calculate RH status category based on spec-compliant rules
 * 
 * Formulas:
 * - RH_remaining = RH_due - RH_effective_current
 * 
 * Status categories (SPEC-COMPLIANT):
 * - OVERDUE: Past due RH AND past grace period (rhRemaining < -graceHours)
 * - DUE_GRACE: Past due RH but within grace period (-graceHours <= rhRemaining < 0)
 * - DUE: Within lead time (0 <= rhRemaining <= leadTimeHours)
 * - ACTIVE: Beyond lead time (rhRemaining > leadTimeHours)
 */
export function computeRHStatusCategory(
  dueRH: number,
  currentRH: number,
  leadTimeHours: number,
  graceHours: number = GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS
): RHStatusCategory {
  // RH_remaining = RH_due - RH_effective_current
  const rhRemaining = dueRH - currentRH;
  
  // Status determination per specification
  if (rhRemaining < -graceHours) {
    // Past due AND past grace period
    return 'OVERDUE';
  } else if (rhRemaining < 0) {
    // Past due but within grace period
    return 'DUE_GRACE' as RHStatusCategory;
  } else if (rhRemaining <= leadTimeHours) {
    // Within lead time: 0 <= RH_remaining <= LT
    return 'DUE';
  } else {
    // Beyond lead time: RH_remaining > LT
    return 'PLANNED';
  }
}

/**
 * Map RH status category to display status - SPEC-COMPLIANT
 * Maps to only the four allowed statuses: Active, Due, Due (Grace P), Overdue
 */
export function rhCategoryToDisplayStatus(category: RHStatusCategory): ComputedWorkOrderStatus {
  switch (category) {
    case 'OVERDUE':
      return 'Overdue';
    case 'DUE_GRACE':
      return 'Due (Grace P)';
    case 'DUE':
    case 'DUE_SOON':
      return 'Due';
    case 'PLANNED':
    case 'FUTURE':
      return 'Active';
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
    // REJECTED: Skip completion check - continue to calculate due date status below
    // This ensures rejected work orders appear in Due/Overdue/Active tabs based on their due date
    // The "Rejected" badge is shown in Status column from the database status field
    if (status === 'Rejected') {
      // Fall through to due date calculation below
    } else if (status === 'Approved' || completionDateTime) {
      return 'Completed';
    } else {
      return 'Active';
    }
  }
  
  // IMPORTANT: Check for Pending Approval BEFORE checking completion
  // This is the correct workflow: User fills Part B → Pending Approval → Approver approves → Completed
  // The status 'Pending Approval' takes precedence over completionDateTime because
  // the work order needs approval before it can be marked as Completed
  if (status === 'Pending Approval') return 'Pending Approval';
  
  // Postponed items stay in Planned tab
  if (status === 'Postponed') return 'Postponed';
  
  // REJECTED: Skip completion check - continue to calculate due date status below
  // Rejected work orders should appear in Due/Overdue/Active tabs based on their due date
  // The "Rejected" badge is shown in Status column from the database status field
  
  // Templates: check for completion (only after Pending Approval check, skip for Rejected)
  if (status !== 'Rejected' && (completionDateTime || status === 'Completed')) {
    return 'Completed';
  }
  
  // Branch based on maintenance basis for spec-compliant status calculation
  if (maintenanceBasis === 'Running Hours') {
    // Running Hours-based status calculation - SPEC-COMPLIANT
    if (dueRH == null || currentRH == null) return 'Active';
    
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
    
    // Get grace period from settings
    const graceHours = vesselGraceSettings?.rhGraceHours ?? GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
    
    // Calculate RH status category using spec-compliant rules (includes grace period)
    const category = computeRHStatusCategory(dueRH, currentRH, leadTime, graceHours);
    
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
