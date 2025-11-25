import { parseDDMMYYYY } from '@shared/utils/dateCalculations';

export const GRACE_PERIOD_CONSTANTS = {
  DUE_HORIZON_DAYS: 30,
  GRACE_PERIOD_DAYS: 7, // Minimum grace period for calendar jobs
  RH_GRACE_HOURS: 168, // Grace period for running hours jobs (168 hours = 7 days equivalent)
} as const;

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
}

export function computeWorkOrderStatus(input: WorkOrderStatusInput): ComputedWorkOrderStatus {
  const { dueDate, dueRH, currentRH, isExecution, status, completionDateTime, maintenanceBasis } = input;
  
  // Execution records use their stored status
  if (isExecution) {
    if (status === 'Approved' || completionDateTime) return 'Completed';
    if (status === 'Pending Approval') return 'Pending Approval';
    if (status === 'Rejected') return 'Rejected';
    return 'Active';
  }
  
  // Templates: check for completion first (before due date calculation)
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
    
    // Status logic for RH jobs:
    // - Overdue: current RH exceeds due RH
    // - Due (Grace P): within 168 hours grace (spec requirement)
    // - Due: within horizon (roughly 720 hours = 30 days @ 24hrs/day)
    // - Active: more than horizon away
    
    if (rhDiff < 0) {
      return 'Overdue';
    } else if (rhDiff <= GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS) {
      return 'Due (Grace P)';
    } else if (rhDiff <= 720) { // 30-day equivalent at 24 hrs/day
      return 'Due';
    } else {
      return 'Active';
    }
  } else {
    // Calendar-based status calculation (default)
    if (!dueDate) return 'Active';
    
    // Parse due date (DD-MM-YYYY format)
    const dueDateObj = parseDDMMYYYY(dueDate);
    if (!dueDateObj) return 'Active';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDateTime = new Date(dueDateObj);
    dueDateTime.setHours(0, 0, 0, 0);
    
    // Calculate days difference
    const diffTime = dueDateTime.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate spec-compliant grace period for calendar jobs:
    // Grace extends to end of month OR 7 days after due date (whichever is longer)
    const endOfMonth = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth() + 1, 0);
    endOfMonth.setHours(0, 0, 0, 0);
    
    // Calculate grace end date: max(dueDate + 7 days, end of due month)
    const sevenDaysAfterDue = new Date(dueDateTime);
    sevenDaysAfterDue.setDate(sevenDaysAfterDue.getDate() + GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS);
    sevenDaysAfterDue.setHours(0, 0, 0, 0);
    
    const graceEndDate = endOfMonth > sevenDaysAfterDue ? endOfMonth : sevenDaysAfterDue;
    
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
