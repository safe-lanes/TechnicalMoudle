import { getDb } from '../db';
import { runningHoursAudit } from '@shared/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

export interface RHValidationResult {
  allowed: boolean;
  maxAllowedIncrease: number;
  requestedIncrease: number;
  daysSinceLastUpdate: number;
  lastUpdateDate: string | null;
  message: string;
  requiresAdminOverride: boolean;
}

export interface RHValidationInput {
  componentId: string;
  currentRH: number;
  newRH: number;
  updateDateUTC: Date;
  userRole: string;
  adminOverride?: boolean;
}

const MAX_HOURS_PER_DAY = 25;

export async function validateRunningHoursIncrease(
  input: RHValidationInput
): Promise<RHValidationResult> {
  const { componentId, currentRH, newRH, updateDateUTC, userRole, adminOverride } = input;
  
  const requestedIncrease = newRH - currentRH;
  
  if (requestedIncrease <= 0) {
    return {
      allowed: true,
      maxAllowedIncrease: 0,
      requestedIncrease,
      daysSinceLastUpdate: 0,
      lastUpdateDate: null,
      message: 'No increase or decrease - no validation needed',
      requiresAdminOverride: false
    };
  }
  
  const db = await getDb();
  
  const lastAudit = await db.select()
    .from(runningHoursAudit)
    .where(eq(runningHoursAudit.componentId, componentId))
    .orderBy(desc(runningHoursAudit.enteredAtUTC))
    .limit(1);
  
  let daysSinceLastUpdate = 0;
  let lastUpdateDate: string | null = null;
  let sameDayUpdate = false;
  
  if (lastAudit.length > 0) {
    const lastEntryDate = new Date(lastAudit[0].enteredAtUTC);
    lastUpdateDate = lastEntryDate.toISOString().split('T')[0];
    
    const updateDateStr = updateDateUTC.toISOString().split('T')[0];
    const lastDateStr = lastEntryDate.toISOString().split('T')[0];
    
    if (updateDateStr === lastDateStr) {
      sameDayUpdate = true;
      daysSinceLastUpdate = 0;
    } else {
      const diffTime = updateDateUTC.getTime() - lastEntryDate.getTime();
      daysSinceLastUpdate = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
  }
  
  let maxAllowedIncrease: number;
  
  if (sameDayUpdate) {
    const todayStart = new Date(updateDateUTC);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(updateDateUTC);
    todayEnd.setUTCHours(23, 59, 59, 999);
    
    const todayUpdates = await db.select()
      .from(runningHoursAudit)
      .where(and(
        eq(runningHoursAudit.componentId, componentId),
        gte(runningHoursAudit.enteredAtUTC, todayStart)
      ));
    
    if (todayUpdates.length > 0) {
      maxAllowedIncrease = 0;
      
      const canOverride = userRole === 'PMS Admin' && adminOverride === true;
      
      return {
        allowed: canOverride,
        maxAllowedIncrease: 0,
        requestedIncrease,
        daysSinceLastUpdate: 0,
        lastUpdateDate,
        message: canOverride 
          ? 'Admin override applied for same-day duplicate update'
          : 'Same-day update already performed. Only one update of max 25 hours is allowed per day.',
        requiresAdminOverride: !canOverride
      };
    }
    
    maxAllowedIncrease = MAX_HOURS_PER_DAY;
  } else if (lastAudit.length === 0) {
    // First ever update - allow 25 hours max
    maxAllowedIncrease = MAX_HOURS_PER_DAY;
  } else {
    // Formula: days × 25 hours
    // If 1 day has elapsed → 25 hours max
    // If 2 days have elapsed → 50 hours max
    // etc.
    maxAllowedIncrease = daysSinceLastUpdate * MAX_HOURS_PER_DAY;
  }
  
  const isWithinLimit = requestedIncrease <= maxAllowedIncrease;
  
  if (isWithinLimit) {
    return {
      allowed: true,
      maxAllowedIncrease,
      requestedIncrease,
      daysSinceLastUpdate,
      lastUpdateDate,
      message: `Increase of ${requestedIncrease} hours is within the allowed limit of ${maxAllowedIncrease} hours`,
      requiresAdminOverride: false
    };
  }
  
  const canOverride = userRole === 'PMS Admin' && adminOverride === true;
  
  return {
    allowed: canOverride,
    maxAllowedIncrease,
    requestedIncrease,
    daysSinceLastUpdate,
    lastUpdateDate,
    message: canOverride
      ? `Admin override applied. Increase of ${requestedIncrease} hours exceeds normal limit of ${maxAllowedIncrease} hours (${daysSinceLastUpdate} days × 25 hours/day).`
      : `Increase of ${requestedIncrease} hours exceeds maximum allowed of ${maxAllowedIncrease} hours. Maximum allowed is ${daysSinceLastUpdate} day(s) × 25 hours/day = ${maxAllowedIncrease} hours.`,
    requiresAdminOverride: !canOverride
  };
}

export function canAdminOverride(userRole: string): boolean {
  return userRole === 'PMS Admin';
}
