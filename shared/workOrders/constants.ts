/**
 * CENTRALIZED WORK ORDER THRESHOLD CONSTANTS
 * ============================================
 * 
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL STATUS THRESHOLDS.
 * ALL OTHER FILES MUST IMPORT FROM HERE - NO HARDCODED VALUES ALLOWED.
 * 
 * DO NOT CHANGE THESE VALUES UNLESS EXPLICITLY REQUESTED BY THE USER.
 * 
 * BUSINESS RULE SEPARATION:
 * - GENERATION constants control WHEN a WO is created (fixed, not vessel-driven)
 * - LEAD TIME constants are FALLBACK defaults for vessel-configured Due thresholds
 * - GRACE constants control the grace period after the due date/point
 * 
 * Lifecycle: Generated early → Planned → Due by vessel Lead Time → Grace P → Overdue
 */

export const WORK_ORDER_THRESHOLDS = {
  /**
   * GENERATION CONSTANTS (FIXED - not vessel-driven)
   * These control WHEN a work order is created, independent of vessel settings.
   */

  /** Calendar: generate WO this many days before due date (FIXED 30 days) */
  CALENDAR_GENERATION_ADVANCE_DAYS: 30,

  /** RH: generate WO this many hours before due RH point (FIXED 720 hours) */
  RH_GENERATION_ADVANCE_HOURS: 720,

  /**
   * FALLBACK LEAD TIME CONSTANTS (used when vessel settings are NOT configured)
   * When vessel settings exist, vessel-configured lead times are used instead.
   * These serve as safe defaults for the Planned → Due transition.
   */

  /** Fallback calendar lead time when vessel has no settings (days) */
  CALENDAR_LEAD_TIME_DAYS: 30,

  /** Fallback RH lead time when vessel has no settings (hours) */
  RH_LEAD_TIME_HOURS: 720,

  /** Fallback RH lead time for critical jobs when vessel has no settings */
  RH_LEAD_TIME_HOURS_CRITICAL: 720,

  /** Fallback RH lead time for non-critical jobs when vessel has no settings */
  RH_LEAD_TIME_HOURS_NON_CRITICAL: 720,

  /** Fallback calendar lead time for critical jobs when vessel has no settings */
  CALENDAR_LEAD_TIME_DAYS_CRITICAL: 7,

  /** Fallback calendar lead time for non-critical jobs when vessel has no settings */
  CALENDAR_LEAD_TIME_DAYS_NON_CRITICAL: 14,

  /**
   * GRACE PERIOD CONSTANTS
   */

  /** RH grace period hours (168 = 7 days equivalent) */
  RH_GRACE_PERIOD_HOURS: 168,

  /** Calendar grace period days (minimum fixed grace for COMPANY_STANDARD mode) */
  CALENDAR_GRACE_PERIOD_DAYS: 7,
} as const;

/**
 * Type for accessing threshold values
 */
export type WorkOrderThresholds = typeof WORK_ORDER_THRESHOLDS;
