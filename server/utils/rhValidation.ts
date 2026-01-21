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
  currentRH: number;
  newRH: number;
  componentLastUpdated: string | null;
  newUpdateDate: string;
  userRole: string;
  adminOverride?: boolean;
}

const MAX_HOURS_PER_DAY = 25;

function getCalendarDate(dateStr: string): Date {
  const date = new Date(dateStr);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDaysBetweenCalendarDates(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / msPerDay);
}

export function validateRunningHoursIncrease(
  input: RHValidationInput
): RHValidationResult {
  const { currentRH, newRH, componentLastUpdated, newUpdateDate, userRole, adminOverride } = input;
  
  const requestedIncrease = newRH - currentRH;
  
  if (requestedIncrease <= 0) {
    return {
      allowed: true,
      maxAllowedIncrease: 0,
      requestedIncrease,
      daysSinceLastUpdate: 0,
      lastUpdateDate: componentLastUpdated,
      message: 'No increase or decrease - no validation needed',
      requiresAdminOverride: false
    };
  }
  
  let daysSinceLastUpdate = 0;
  let sameDayUpdate = false;
  
  if (componentLastUpdated) {
    const lastCalendarDate = getCalendarDate(componentLastUpdated);
    const newCalendarDate = getCalendarDate(newUpdateDate);
    
    daysSinceLastUpdate = getDaysBetweenCalendarDates(lastCalendarDate, newCalendarDate);
    
    if (daysSinceLastUpdate === 0) {
      sameDayUpdate = true;
    }
  } else {
    daysSinceLastUpdate = 1;
  }
  
  let maxAllowedIncrease: number;
  
  if (sameDayUpdate) {
    const canOverride = userRole === 'Sail Admin' && adminOverride === true;
    
    return {
      allowed: canOverride,
      maxAllowedIncrease: 0,
      requestedIncrease,
      daysSinceLastUpdate: 0,
      lastUpdateDate: componentLastUpdated,
      message: canOverride
        ? 'Sail Admin override applied for same-day duplicate update'
        : 'Same-day update already performed. Only one update of max 25 hours is allowed per day.',
      requiresAdminOverride: !canOverride
    };
  } else {
    maxAllowedIncrease = daysSinceLastUpdate * MAX_HOURS_PER_DAY;
  }
  
  const isWithinLimit = requestedIncrease <= maxAllowedIncrease;
  
  if (isWithinLimit) {
    return {
      allowed: true,
      maxAllowedIncrease,
      requestedIncrease,
      daysSinceLastUpdate,
      lastUpdateDate: componentLastUpdated,
      message: `Increase of ${requestedIncrease} hours is within the allowed limit of ${maxAllowedIncrease} hours`,
      requiresAdminOverride: false
    };
  }
  
  const canOverride = userRole === 'Sail Admin' && adminOverride === true;
  
  return {
    allowed: canOverride,
    maxAllowedIncrease,
    requestedIncrease,
    daysSinceLastUpdate,
    lastUpdateDate: componentLastUpdated,
    message: canOverride
      ? `Sail Admin override applied. Increase of ${requestedIncrease} hours exceeds normal limit of ${maxAllowedIncrease} hours (${daysSinceLastUpdate} days × 25 hours/day).`
      : `Increase of ${requestedIncrease} hours exceeds maximum allowed of ${maxAllowedIncrease} hours. Maximum allowed is ${daysSinceLastUpdate} day(s) × 25 hours/day = ${maxAllowedIncrease} hours.`,
    requiresAdminOverride: !canOverride
  };
}

export function canAdminOverride(userRole: string): boolean {
  return userRole === 'Sail Admin';
}
