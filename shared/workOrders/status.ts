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

export type GraceMethodType = 'FIXED_DAYS' | 'MONTH_END' | 'SPECIFIC_DATE_NEXT_MONTH';
export type GraceScopeType = 'ALL_WORK_ORDERS' | 'LAST_WEEK_OF_MONTH';

export interface CompanyStandardGraceConfig {
  graceMethod: GraceMethodType;
  graceValue: number | null;
  scope: GraceScopeType;
  fallbackGraceDays: number | null;
  fallbackMethod: GraceMethodType | null;
}

export const DEFAULT_COMPANY_GRACE_CONFIG: CompanyStandardGraceConfig = {
  graceMethod: 'FIXED_DAYS',
  graceValue: 7,
  scope: 'LAST_WEEK_OF_MONTH',
  fallbackGraceDays: null,
  fallbackMethod: 'MONTH_END',
};

const VALID_GRACE_METHODS: GraceMethodType[] = ['FIXED_DAYS', 'MONTH_END', 'SPECIFIC_DATE_NEXT_MONTH'];
const VALID_SCOPES: GraceScopeType[] = ['ALL_WORK_ORDERS', 'LAST_WEEK_OF_MONTH'];

export function buildCompanyGraceConfig(row: { graceMethod: string; graceValue: number | null; scope: string; fallbackGraceDays: number | null; fallbackMethod?: string | null } | null | undefined): CompanyStandardGraceConfig {
  if (!row) return DEFAULT_COMPANY_GRACE_CONFIG;
  const method = VALID_GRACE_METHODS.find(m => m === row.graceMethod);
  const scope = VALID_SCOPES.find(s => s === row.scope);
  if (!method || !scope) return DEFAULT_COMPANY_GRACE_CONFIG;
  const fbMethod = row.fallbackMethod ? VALID_GRACE_METHODS.find(m => m === row.fallbackMethod) : null;
  return { graceMethod: method, graceValue: row.graceValue, scope, fallbackGraceDays: row.fallbackGraceDays, fallbackMethod: fbMethod ?? null };
}

export interface RhGraceConfig {
  graceMethod: 'FIXED_HOURS' | 'MONTH_END' | 'SPECIFIC_DATE_NEXT_MONTH';
  graceValue: number | null;
  scope: GraceScopeType;
  fallbackMethod: 'MONTH_END' | 'FIXED_HOURS' | null;
  fallbackGraceHours: number | null;
}

export interface VesselGraceSettings {
  calendarGraceMode: GraceMode;
  calendarGraceDays: number;
  rhGraceHours: number;
  rhLeadTimeHours?: number;
  vesselCalendarGraceConfig?: CompanyStandardGraceConfig;
  vesselRhGraceConfig?: RhGraceConfig;
}

/**
 * Work order status types for display
 * Lifecycle: Active (Planned) → Due → Due (Grace P) → Overdue
 * - Active: Outside vessel lead time window (appears in Planned tab)
 * - Due: Within vessel lead time window (≤ vessel lead days/hours before due)
 * - Due (Grace P): Past due but within grace period
 * - Overdue: Past due AND past grace period
 * - Completed/Pending Approval/Rejected/Postponed: Terminal states
 */
export type ComputedWorkOrderStatus = 
  | 'Active'        // Outside vessel lead time window (Planned tab)
  | 'Due'           // Within vessel lead time window
  | 'Due (Grace P)' // Past due but within grace period
  | 'Overdue'       // Past due AND past grace period
  | 'Completed'
  | 'Pending Approval'
  | 'Rejected'
  | 'Postponed';

/**
 * RH-specific status for maintenance planning
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
  rhLeadTimeHours?: number;
  calendarLeadTimeDays?: number;
  companyGraceConfig?: CompanyStandardGraceConfig;
  referenceDate?: Date;
}

function applyGraceMethod(dueDate: Date, method: CompanyStandardGraceConfig['graceMethod'], value: number | null): Date {
  if (method === 'FIXED_DAYS') {
    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + (value || GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS));
    graceEnd.setHours(0, 0, 0, 0);
    return graceEnd;
  } else if (method === 'MONTH_END') {
    const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);
    endOfMonth.setHours(0, 0, 0, 0);
    return endOfMonth;
  } else {
    const dayOfNextMonth = value || 5;
    const graceEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, dayOfNextMonth);
    graceEnd.setHours(0, 0, 0, 0);
    return graceEnd;
  }
}

export function calculateCompanyStandardGraceEnd(dueDate: Date, config?: CompanyStandardGraceConfig): Date {
  const cfg = config || DEFAULT_COMPANY_GRACE_CONFIG;

  if (cfg.scope === 'ALL_WORK_ORDERS') {
    return applyGraceMethod(dueDate, cfg.graceMethod, cfg.graceValue);
  }

  const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);
  endOfMonth.setHours(0, 0, 0, 0);
  const daysUntilEndOfMonth = endOfMonth.getDate() - dueDate.getDate();

  if (daysUntilEndOfMonth <= 7) {
    return applyGraceMethod(dueDate, cfg.graceMethod, cfg.graceValue);
  } else if (cfg.fallbackMethod) {
    return applyGraceMethod(dueDate, cfg.fallbackMethod, cfg.fallbackGraceDays);
  } else {
    const fallbackDays = cfg.fallbackGraceDays ?? GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS;
    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + fallbackDays);
    graceEnd.setHours(0, 0, 0, 0);
    return graceEnd;
  }
}

/**
 * Calculate RH status category based on vessel lead time and grace period
 * 
 * Formulas:
 * - RH_remaining = RH_due - RH_effective_current
 * 
 * Status categories:
 * - OVERDUE: Past due RH AND past grace period (rhRemaining < -graceHours)
 * - DUE_GRACE: Past due RH but within grace period (-graceHours <= rhRemaining < 0)
 * - DUE: Within vessel lead time (0 <= rhRemaining <= leadTimeHours)
 * - PLANNED: Beyond vessel lead time (rhRemaining > leadTimeHours)
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
    // Within vessel lead time: 0 <= RH_remaining <= LT
    return 'DUE';
  } else {
    // Beyond vessel lead time: RH_remaining > LT
    return 'PLANNED';
  }
}

/**
 * Map RH status category to display status
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
    rhLeadTimeHours,
    calendarLeadTimeDays,
    companyGraceConfig
  } = input;
  
  const FINALIZED_STATUSES = new Set(['completed', 'approved', 'closed', 'cancelled', 'canceled']);
  const normalizedStatus = status ? status.toLowerCase().trim() : '';

  if (FINALIZED_STATUSES.has(normalizedStatus)) {
    return 'Completed';
  }

  if (isExecution) {
    if (status === 'Pending Approval') return 'Pending Approval';
    if (status === 'Rejected') {
    } else if (completionDateTime) {
      return 'Completed';
    } else {
      return 'Active';
    }
  }
  
  if (status === 'Pending Approval') return 'Pending Approval';
  
  if (status === 'Postponed') return 'Postponed';
  
  if (status !== 'Rejected' && completionDateTime) {
    return 'Completed';
  }
  
  // Branch based on maintenance basis for status calculation
  if (maintenanceBasis === 'Running Hours') {
    // Running Hours-based status calculation
    if (dueRH == null || currentRH == null) return 'Active';
    
    // Get lead time from settings (vessel-configured RH lead time for Due transition)
    let leadTime: number;
    if (rhLeadTimeHours !== undefined && rhLeadTimeHours !== null) {
      leadTime = rhLeadTimeHours;
    } else if (vesselGraceSettings?.rhLeadTimeHours !== undefined && vesselGraceSettings?.rhLeadTimeHours !== null) {
      leadTime = vesselGraceSettings.rhLeadTimeHours;
    } else {
      leadTime = GRACE_PERIOD_CONSTANTS.DEFAULT_RH_LEAD_TIME;
    }
    
    let graceHours: number;
    if (vesselGraceSettings?.vesselRhGraceConfig) {
      const rhCfg = vesselGraceSettings.vesselRhGraceConfig;
      if (rhCfg.scope === 'ALL_WORK_ORDERS') {
        graceHours = rhCfg.graceMethod === 'FIXED_HOURS' ? (rhCfg.graceValue ?? GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS) : GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
      } else {
        let inLastWeek = false;
        if (dueDate) {
          const dueDateObj = parseDate(dueDate);
          if (dueDateObj) {
            const endOfMonth = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth() + 1, 0);
            inLastWeek = (endOfMonth.getDate() - dueDateObj.getDate()) <= 7;
          }
        }
        if (inLastWeek) {
          graceHours = rhCfg.graceMethod === 'FIXED_HOURS' ? (rhCfg.graceValue ?? GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS) : GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
        } else if (rhCfg.fallbackMethod === 'FIXED_HOURS') {
          graceHours = rhCfg.fallbackGraceHours ?? GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
        } else {
          graceHours = GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
        }
      }
    } else {
      graceHours = vesselGraceSettings?.rhGraceHours ?? GRACE_PERIOD_CONSTANTS.RH_GRACE_HOURS;
    }
    
    const category = computeRHStatusCategory(dueRH, currentRH, leadTime, graceHours);
    return rhCategoryToDisplayStatus(category);
  } else {
    // Calendar-based status calculation (default)
    if (!dueDate) return 'Active';
    
    // Parse due date - supports both DD-MMM-YYYY and DD-MM-YYYY formats
    const dueDateObj = parseDate(dueDate);
    if (!dueDateObj) return 'Active';
    
    const today = input.referenceDate ? new Date(input.referenceDate) : new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDateTime = new Date(dueDateObj);
    dueDateTime.setHours(0, 0, 0, 0);
    
    // Calculate days difference
    const diffTime = dueDateTime.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate grace end date based on mode
    let graceEndDate: Date;
    
    if (vesselGraceSettings?.calendarGraceMode === 'CUSTOM_DAYS') {
      if (vesselGraceSettings.vesselCalendarGraceConfig) {
        graceEndDate = calculateCompanyStandardGraceEnd(dueDateTime, vesselGraceSettings.vesselCalendarGraceConfig);
      } else {
        graceEndDate = new Date(dueDateTime);
        graceEndDate.setDate(graceEndDate.getDate() + (vesselGraceSettings.calendarGraceDays || GRACE_PERIOD_CONSTANTS.GRACE_PERIOD_DAYS));
        graceEndDate.setHours(0, 0, 0, 0);
      }
    } else {
      graceEndDate = calculateCompanyStandardGraceEnd(dueDateTime, companyGraceConfig);
    }
    
    // Determine the effective calendar lead time for the Planned → Due transition
    // Use vessel-configured calendarLeadTimeDays if provided, otherwise fallback to constant
    const effectiveLeadDays = (calendarLeadTimeDays !== undefined && calendarLeadTimeDays !== null)
      ? calendarLeadTimeDays
      : GRACE_PERIOD_CONSTANTS.DUE_HORIZON_DAYS;
    
    // Status logic for calendar jobs:
    // - Overdue: today is past grace end date
    // - Due (Grace P): past due date but within grace (today <= grace end date)
    // - Due: within vessel lead time window (0 <= diffDays <= effectiveLeadDays)
    // - Active: more than vessel lead time away (Planned)
    
    if (diffDays < 0) {
      // Past due date - check if we're still in grace period
      if (today > graceEndDate) {
        return 'Overdue';
      } else {
        return 'Due (Grace P)';
      }
    } else if (diffDays <= effectiveLeadDays) {
      return 'Due';
    } else {
      return 'Active';
    }
  }
}
