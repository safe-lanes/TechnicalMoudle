/**
 * CENTRALIZED WORK ORDER THRESHOLD CONSTANTS
 * ============================================
 * 
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL STATUS THRESHOLDS.
 * ALL OTHER FILES MUST IMPORT FROM HERE - NO HARDCODED VALUES ALLOWED.
 * 
 * DO NOT CHANGE THESE VALUES UNLESS EXPLICITLY REQUESTED BY THE USER.
 * 
 * Specification (as per Status Types document):
 * - Active: Job is not yet due (>30 days for calendar, >720 RH for running hours)
 * - Due: Job is approaching due date (≤30 days for calendar, ≤720 RH for running hours)
 * - Due (Grace P): Job is past due date but still within grace period
 * - Overdue: Job has exceeded both the due date AND the grace period
 */

export const WORK_ORDER_THRESHOLDS = {
  /**
   * Calendar Lead Time (in days)
   * Work orders become "Due" when within this many days of due date
   * Work orders are "Active" when more than this many days away
   */
  CALENDAR_LEAD_TIME_DAYS: 30,

  /**
   * Running Hours Lead Time (in hours)
   * Work orders become "Due" when within this many hours of due RH
   * Work orders are "Active" when more than this many hours away
   * 
   * IMPORTANT: This is 720 hours per specification, NOT 100!
   */
  RH_LEAD_TIME_HOURS: 720,

  /**
   * Running Hours Grace Period (in hours)
   * After due RH is exceeded, WO stays in "Grace P" for this many hours
   * Then transitions to "Overdue"
   * 168 hours = 7 days equivalent
   */
  RH_GRACE_PERIOD_HOURS: 168,

  /**
   * Calendar Grace Period (in days)
   * Minimum fixed grace period for calendar-based jobs
   * Used when due date is in last 7 days of month (COMPANY_STANDARD mode)
   */
  CALENDAR_GRACE_PERIOD_DAYS: 7,

  /**
   * Critical job RH lead time multiplier
   * Critical/High priority jobs may use different lead times
   * This is the default for critical jobs when vessel settings not configured
   */
  RH_LEAD_TIME_HOURS_CRITICAL: 720,

  /**
   * Non-critical job RH lead time
   * Same as standard RH_LEAD_TIME_HOURS for consistency
   */
  RH_LEAD_TIME_HOURS_NON_CRITICAL: 720,
} as const;

/**
 * Type for accessing threshold values
 */
export type WorkOrderThresholds = typeof WORK_ORDER_THRESHOLDS;
