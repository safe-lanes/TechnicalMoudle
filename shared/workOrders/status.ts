import { parseDDMMYYYY } from '@shared/utils/dateCalculations';

export const GRACE_PERIOD_CONSTANTS = {
  DUE_HORIZON_DAYS: 30,
  GRACE_PERIOD_DAYS: 7,
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
  isExecution?: boolean;
  status?: string;
  completionDateTime?: string | null;
}

export function computeWorkOrderStatus(input: WorkOrderStatusInput): ComputedWorkOrderStatus {
  const { dueDate, isExecution, status, completionDateTime } = input;
  
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
  
  // Templates: compute status based on due date
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
  
  // Status logic:
  // - Overdue: due date has passed (negative days)
  // - Due (Grace P): within grace period (0 to 7 days)
  // - Due: within due horizon (8 to 30 days)
  // - Active: more than 30 days away
  
  if (diffDays < 0) {
    return 'Overdue';
  } else if (diffDays <= GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS) {
    return 'Due (Grace P)';
  } else if (diffDays <= GRACE_PERIOD_CONSTANTS.DUE_HORIZON_DAYS) {
    return 'Due';
  } else {
    return 'Active';
  }
}
