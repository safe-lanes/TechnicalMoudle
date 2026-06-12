import { format, parse, add, isValid, differenceInCalendarDays, differenceInMonths, differenceInYears } from 'date-fns';
import { parseWorkOrderDate } from './workOrders/dateParse';

/**
 * Normalize various date formats to DD-MMM-YYYY format
 * Handles: Excel serials, ISO strings, locale strings, and DD-MMM-YYYY
 * @param dateInput - Date in any common format
 * @returns Date in DD-MMM-YYYY format, or null if invalid
 */
export function normalizeDateToDDMMMYYYY(dateInput: string | number | Date | null | undefined): string | null {
  if (!dateInput) return null;
  
  try {
    let parsedDate: Date;
    
    // Handle Excel serial number (number of days since 1900-01-01)
    if (typeof dateInput === 'number') {
      // Excel serial date: days since 1900-01-01 (serial 1 = Jan 1, 1900)
      // Excel incorrectly treats 1900 as a leap year (serial 60 = Feb 29, 1900 in Excel, which doesn't exist)
      // For dates on/after March 1, 1900 (serial >= 60), we subtract 1 to skip the phantom Feb 29
      // This corrects Excel's one-day offset for all modern dates
      let adjustedSerial = dateInput;
      if (dateInput >= 60) {
        adjustedSerial = dateInput - 1;
      }
      const excelEpoch = new Date(1899, 11, 31); // Excel's epoch is Dec 31, 1899
      parsedDate = new Date(excelEpoch.getTime() + adjustedSerial * 24 * 60 * 60 * 1000);
    }
    // Handle Date object
    else if (dateInput instanceof Date) {
      parsedDate = dateInput;
    }
    // Handle string formats
    else {
      const dateString = String(dateInput).trim();
      
      // Check if string is a numeric Excel serial number (e.g., "45623")
      // Excel serial numbers for modern dates are typically between 40000-60000
      const numericValue = parseFloat(dateString);
      if (!isNaN(numericValue) && /^\d+(\.\d+)?$/.test(dateString) && numericValue > 1000 && numericValue < 100000) {
        // It's a numeric string representing an Excel serial date
        let adjustedSerial = numericValue;
        if (numericValue >= 60) {
          adjustedSerial = numericValue - 1;
        }
        const excelEpoch = new Date(1899, 11, 31);
        parsedDate = new Date(excelEpoch.getTime() + adjustedSerial * 24 * 60 * 60 * 1000);
      } else {
        // Try DD-MMM-YYYY format first (target format)
        parsedDate = parse(dateString, 'dd-MMM-yyyy', new Date());
        if (!isValid(parsedDate)) {
          // Try DD/MM/YYYY format (European format with slashes)
          parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
        }
        if (!isValid(parsedDate)) {
          // Try DD-MM-YYYY format (European format with dashes)
          parsedDate = parse(dateString, 'dd-MM-yyyy', new Date());
        }
        if (!isValid(parsedDate)) {
          // Try ISO format (YYYY-MM-DD)
          parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
        }
        if (!isValid(parsedDate)) {
          // Try locale string format (fallback to native parser)
          parsedDate = new Date(dateString);
        }
      }
    }
    
    // Validate result
    if (!isValid(parsedDate)) {
      return null;
    }
    
    // Validate year is within reasonable range (1900-2100)
    const year = parsedDate.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`Invalid year ${year} in date, rejecting:`, dateInput);
      return null;
    }
    
    // Format to DD-MMM-YYYY
    return format(parsedDate, 'dd-MMM-yyyy');
  } catch (error) {
    console.error('Error normalizing date:', dateInput, error);
    return null;
  }
}

/**
 * Calculate next due date: completionDate + one frequency interval
 * ROBUSTNESS: Accepts any date format (DD-MMM-YYYY, ISO, Excel serial) and normalizes before calculation
 * @param lastDoneDate - Actual completion date in any format (DD-MMM-YYYY, ISO, Excel serial, etc.)
 * @param intervalValue - Numeric interval (e.g., "3", "6", "12")
 * @param intervalUnit - Unit: 'Days' | 'Weeks' | 'Months' | 'Years'
 * @param originalDueDate - Retained for backward compatibility, not used in calculation
 * @returns Next due date in DD-MMM-YYYY format, or null if calculation fails
 */
export function calculateNextDueDate(
  lastDoneDate: string | number | null | undefined,
  intervalValue: string | number | null | undefined,
  intervalUnit: string | null | undefined,
  originalDueDate?: string | number | null | undefined
): string | null {
  if (!lastDoneDate || !intervalValue || !intervalUnit) {
    return null;
  }

  try {
    const baseDate = normalizeDateToDDMMMYYYY(lastDoneDate);
    if (!baseDate) {
      console.error('Failed to normalize lastDoneDate:', lastDoneDate);
      return null;
    }

    const parsedDate = parse(baseDate, 'dd-MMM-yyyy', new Date());
    if (!isValid(parsedDate)) {
      console.error('Failed to parse base date:', baseDate);
      return null;
    }
    
    // Parse interval value as number
    const numericInterval = typeof intervalValue === 'number' 
      ? intervalValue 
      : parseInt(String(intervalValue), 10);
    if (isNaN(numericInterval) || numericInterval <= 0) {
      console.error('Invalid interval value:', intervalValue);
      return null;
    }

    // Map interval unit to date-fns duration keys
    let durationKey: 'days' | 'weeks' | 'months' | 'years';
    switch (intervalUnit.toLowerCase()) {
      case 'days':
        durationKey = 'days';
        break;
      case 'weeks':
        durationKey = 'weeks';
        break;
      case 'months':
        durationKey = 'months';
        break;
      case 'years':
        durationKey = 'years';
        break;
      default:
        console.error('Invalid interval unit:', intervalUnit);
        return null;
    }

    const nextDue = add(parsedDate, { [durationKey]: numericInterval });

    return format(nextDue, 'dd-MMM-yyyy');
  } catch (error) {
    console.error('Error calculating next due date:', { lastDoneDate, intervalValue, intervalUnit, error });
    return null;
  }
}

export function calculateMissedCycles(
  scheduledDueDate: string | null | undefined,
  completionDate: string | null | undefined,
  frequencyValue: string | number | null | undefined,
  frequencyUnit: string | null | undefined
): number {
  if (!scheduledDueDate || !completionDate || !frequencyValue || !frequencyUnit) return 0;

  try {
    const normalizedDue = normalizeDateToDDMMMYYYY(scheduledDueDate);
    const normalizedCompletion = normalizeDateToDDMMMYYYY(completionDate);
    if (!normalizedDue || !normalizedCompletion) return 0;

    const dueDate = parse(normalizedDue, 'dd-MMM-yyyy', new Date());
    const compDate = parse(normalizedCompletion, 'dd-MMM-yyyy', new Date());
    if (!isValid(dueDate) || !isValid(compDate)) return 0;

    const interval = typeof frequencyValue === 'number' ? frequencyValue : parseInt(String(frequencyValue), 10);
    if (isNaN(interval) || interval <= 0) return 0;

    const unit = frequencyUnit.toLowerCase();
    let delay: number;

    if (unit === 'days') {
      delay = differenceInCalendarDays(compDate, dueDate);
      return delay > 0 ? Math.floor(delay / interval) : 0;
    } else if (unit === 'weeks') {
      delay = differenceInCalendarDays(compDate, dueDate);
      return delay > 0 ? Math.floor(delay / (interval * 7)) : 0;
    } else if (unit === 'months') {
      delay = differenceInMonths(compDate, dueDate);
      return delay > 0 ? Math.floor(delay / interval) : 0;
    } else if (unit === 'years') {
      delay = differenceInYears(compDate, dueDate);
      return delay > 0 ? Math.floor(delay / interval) : 0;
    }
    return 0;
  } catch (err) {
    console.error('Error calculating missed cycles:', err);
    return 0;
  }
}

/**
 * Check if a calendar-based job should generate a work order
 * @param nextDueDate - Next due date in DD-MMM-YYYY format
 * @param currentDate - Current date (defaults to today)
 * @param leadTimeDays - Lead time in days before due date (defaults to 0)
 * @returns true if work order should be generated (within lead time of due date)
 */
export function shouldGenerateWorkOrder(
  nextDueDate: string | null | undefined,
  currentDate: Date = new Date(),
  leadTimeDays: number = 0
): boolean {
  if (!nextDueDate) {
    return false;
  }

  try {
    // SHARED parser (workOrders/dateParse.ts contract): the previous
    // single-format parse('dd-MMM-yyyy') silently returned Invalid for ISO and
    // DD-MM-YYYY due dates → those jobs NEVER generated a work order.
    const parsedDueDate = parseWorkOrderDate(nextDueDate);
    if (!parsedDueDate) return false;

    // Normalize current date to midnight for comparison
    const normalizedCurrent = new Date(currentDate);
    normalizedCurrent.setHours(0, 0, 0, 0);
    
    // Calculate the trigger date (due date minus lead time)
    const triggerDate = new Date(parsedDueDate);
    triggerDate.setDate(triggerDate.getDate() - leadTimeDays);
    triggerDate.setHours(0, 0, 0, 0);
    
    // Generate work order if current date is at or past trigger date
    return normalizedCurrent >= triggerDate;
  } catch (error) {
    console.error('Error checking work order generation criteria:', error);
    return false;
  }
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const normalized = normalizeDateToDDMMMYYYY(dateStr);
  if (!normalized) return '';
  const parsed = parse(normalized, 'dd-MMM-yyyy', new Date());
  if (!isValid(parsed)) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  const diffDays = differenceInCalendarDays(now, parsed);
  if (diffDays < 0) return `in ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = differenceInMonths(now, parsed);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = differenceInYears(now, parsed);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

export function calculateMissedCyclesRH(
  dueRH: number | string | null | undefined,
  completionRH: number | string | null | undefined,
  intervalRH: number | string | null | undefined
): number {
  if (dueRH == null || completionRH == null || intervalRH == null) return 0;

  const due = typeof dueRH === 'string' ? parseFloat(dueRH) : dueRH;
  const completion = typeof completionRH === 'string' ? parseFloat(completionRH) : completionRH;
  const interval = typeof intervalRH === 'string' ? parseFloat(intervalRH) : intervalRH;

  if (isNaN(due) || isNaN(completion) || isNaN(interval) || interval <= 0) return 0;

  const delay = completion - due;
  if (delay <= 0) return 0;

  return Math.floor(delay / interval);
}

export function formatRHWithSeparators(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
