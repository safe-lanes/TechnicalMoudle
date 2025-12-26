import { parseDDMMYYYY } from '@shared/utils/dateCalculations';

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

export const GRACE_PERIOD_CONSTANTS = {
  DUE_HORIZON_DAYS: 30,
  GRACE_PERIOD_DAYS: 7, // Minimum grace period for calendar jobs
  RH_GRACE_HOURS: 168, // Grace period for running hours jobs (168 hours = 7 days equivalent)
} as const;

export type GraceMode = 'COMPANY_STANDARD' | 'CUSTOM_DAYS';

export interface VesselGraceSettings {
  calendarGraceMode: GraceMode;
  calendarGraceDays: number;
  rhGraceHours: number;
}

export type ComputedWorkOrderStatus = 
  | 'Active'
  | 'Due'
  | 'Due (Grace P)'
  | 'Overdue'
  | 'Completed'
  | 'Pending Approval'
  | 'Rejected'
  | 'Postponed';

export interface WorkOrderStatusInput {
  dueDate?: string | null;
  dueRH?: number | null;
  currentRH?: number | null;
  isExecution?: boolean;
  status?: string;
  completionDateTime?: string | null;
  maintenanceBasis?: string;
  vesselGraceSettings?: VesselGraceSettings;
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

export function computeWorkOrderStatus(input: WorkOrderStatusInput): ComputedWorkOrderStatus {
  const { dueDate, dueRH, currentRH, isExecution, status, completionDateTime, maintenanceBasis, vesselGraceSettings } = input;
  
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
  
  // Branch based on maintenance basis for spec-compliant grace periods
  if (maintenanceBasis === 'Running Hours') {
    // Running Hours-based status calculation
    if (dueRH == null || currentRH == null) return 'Active';
    
    const rhDiff = dueRH - currentRH;
    
    // Use vessel-specific RH grace hours if available, otherwise use default
    const rhGraceHours = vesselGraceSettings?.rhGraceHours ?? GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
    
    // Status logic for RH jobs:
    // - Overdue: current RH exceeds due RH + grace
    // - Due (Grace P): past due RH but within grace
    // - Due: within horizon (roughly 720 hours = 30 days @ 24hrs/day)
    // - Active: more than horizon away
    
    if (rhDiff < -rhGraceHours) {
      return 'Overdue';
    } else if (rhDiff < 0) {
      return 'Due (Grace P)';
    } else if (rhDiff <= 720) { // 30-day equivalent at 24 hrs/day
      return 'Due';
    } else {
      return 'Active';
    }
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
