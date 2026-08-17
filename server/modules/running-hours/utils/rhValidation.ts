export interface RHValidationResult {
  allowed: boolean;
  maxAllowedIncrease: number;
  requestedIncrease: number;
  daysSinceLastUpdate: number;
  lastUpdateDate: string | null;
  message: string;
  requiresAdminOverride: boolean;
  backdatedLower?: boolean; // true when date is older AND RH is lower/equal than current
}

export interface RHValidationInput {
  currentRH: number;
  newRH: number;
  componentLastUpdated: string | null;
  newUpdateDate: string;
  userRole: string;
  adminOverride?: boolean;
}

import { parseReadingDayStrict, canonicalizeReadingDateInput } from './readingDate';

const MAX_HOURS_PER_DAY = 25;

/**
 * Task #427: calendar-day parse via the SHARED strict parser (no unrestricted
 * `new Date(str)` — locale text must not shift days by machine timezone).
 * Returns null for unparseable values; callers decide the fallback.
 */
function getCalendarDate(dateStr: string): Date | null {
  const strict = parseReadingDayStrict(dateStr);
  if (strict) return strict;
  const canonical = canonicalizeReadingDateInput(dateStr);
  return canonical ? parseReadingDayStrict(canonical) : null;
}

function getDaysBetweenCalendarDates(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / msPerDay);
}

function formatDMY(dateStr: string): string {
  if (!dateStr) return dateStr;
  const d = getCalendarDate(dateStr);
  if (!d) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

export function validateRunningHoursIncrease(
  input: RHValidationInput
): RHValidationResult {
  const { currentRH, newRH, componentLastUpdated, newUpdateDate, userRole, adminOverride } = input;

  const requestedIncrease = newRH - currentRH;

  // === Date comparison runs BEFORE the no-increase early-return ===
  // This ensures back-dated LOWER entries are caught here rather than silently
  // allowed through (which would let stale readings overwrite the RH module).
  let daysSinceLastUpdate = 0;
  let sameDayUpdate = false;

  const lastCalendarDate = componentLastUpdated ? getCalendarDate(componentLastUpdated) : null;
  const newCalendarDate = getCalendarDate(newUpdateDate);

  if (lastCalendarDate && newCalendarDate) {
    daysSinceLastUpdate = getDaysBetweenCalendarDates(lastCalendarDate, newCalendarDate);

    if (daysSinceLastUpdate < 0) {
      // The new reading is dated BEFORE the component's last running-hours update.
      // When the entered RH is also lower/equal (backdatedLower), the WO completion
      // service skips the RH module write rather than throwing. For direct RH entry
      // (non-WO callers) this is a hard block regardless of the RH direction.
      const canOverride = userRole === 'Sail Admin' && adminOverride === true;
      return {
        allowed: canOverride,
        maxAllowedIncrease: 0,
        requestedIncrease,
        daysSinceLastUpdate,
        lastUpdateDate: componentLastUpdated,
        backdatedLower: requestedIncrease <= 0,
        message: canOverride
          ? 'Sail Admin override applied for backdated running-hours entry.'
          : `Completion Date (${formatDMY(newUpdateDate)}) is earlier than the component's last running-hours update (${formatDMY(componentLastUpdated || '')}). Running hours can only be recorded on or after the latest reading.`,
        requiresAdminOverride: !canOverride
      };
    }

    if (daysSinceLastUpdate === 0) {
      sameDayUpdate = true;
    }
  } else {
    daysSinceLastUpdate = 1;
  }

  // No date issue — handle the no-increase / decrease case (same-day-or-later lower reading is fine)
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

/**
 * Safely parse any date value (string, Date, null, undefined) into a Date object.
 * Returns null for invalid, unparseable, or missing values instead of throwing or
 * returning an Invalid Date — guards against mixed text formats (DD-MMM-YYYY, ISO,
 * timestamp strings) that appear across different columns.
 */
export function safeParseDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  // Full ISO timestamps (e.g. "2026-08-05T14:30:00Z", entered_at values) keep
  // their time-of-day for MAX comparisons; anything else parses to a UTC-day
  // via the SHARED strict parser (Task #427: no unrestricted `new Date(str)`).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  const strict = parseReadingDayStrict(trimmed);
  if (strict) return strict;
  const canonical = canonicalizeReadingDateInput(trimmed);
  return canonical ? parseReadingDayStrict(canonical) : null;
}
