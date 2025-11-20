import { format, parse, add, isValid } from 'date-fns';

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
      // Excel serial date: days since 1900-01-01 (with 1900 leap year bug)
      // Excel incorrectly treats 1900 as a leap year, so we need to account for this
      // For serial >= 60 (dates from Mar 1, 1900 onwards), subtract 1 day
      let adjustedSerial = dateInput;
      if (dateInput >= 60) {
        adjustedSerial = dateInput - 1;
      }
      const excelEpoch = new Date(1899, 11, 30); // Excel's epoch is Dec 30, 1899
      parsedDate = new Date(excelEpoch.getTime() + adjustedSerial * 24 * 60 * 60 * 1000);
    }
    // Handle Date object
    else if (dateInput instanceof Date) {
      parsedDate = dateInput;
    }
    // Handle string formats
    else {
      const dateString = String(dateInput).trim();
      
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
    
    // Validate result
    if (!isValid(parsedDate)) {
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
 * Calculate next due date from last done date + interval
 * ROBUSTNESS: Accepts any date format (DD-MMM-YYYY, ISO, Excel serial) and normalizes before calculation
 * @param lastDoneDate - Date in any format (DD-MMM-YYYY, ISO, Excel serial, etc.)
 * @param intervalValue - Numeric interval (e.g., "3", "6", "12")
 * @param intervalUnit - Unit: 'Days' | 'Weeks' | 'Months' | 'Years'
 * @returns Next due date in DD-MMM-YYYY format, or null if calculation fails
 */
export function calculateNextDueDate(
  lastDoneDate: string | number | null | undefined,
  intervalValue: string | number | null | undefined,
  intervalUnit: string | null | undefined
): string | null {
  if (!lastDoneDate || !intervalValue || !intervalUnit) {
    return null;
  }

  try {
    // CRITICAL FIX: Normalize input date to DD-MMM-YYYY first
    // This handles Excel serials, ISO dates, and any other format
    const normalizedDate = normalizeDateToDDMMMYYYY(lastDoneDate);
    if (!normalizedDate) {
      console.error('Failed to normalize lastDoneDate:', lastDoneDate);
      return null;
    }

    // Parse the normalized date (DD-MMM-YYYY format)
    const parsedDate = parse(normalizedDate, 'dd-MMM-yyyy', new Date());
    if (!isValid(parsedDate)) {
      console.error('Failed to parse normalized date:', normalizedDate);
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

    // Calculate next due date
    const nextDue = add(parsedDate, { [durationKey]: numericInterval });
    
    // Format back to DD-MMM-YYYY
    return format(nextDue, 'dd-MMM-yyyy');
  } catch (error) {
    console.error('Error calculating next due date:', { lastDoneDate, intervalValue, intervalUnit, error });
    return null;
  }
}

/**
 * Check if a calendar-based job should generate a work order
 * @param nextDueDate - Next due date in DD-MMM-YYYY format
 * @param currentDate - Current date (defaults to today)
 * @returns true if work order should be generated (next due date has passed)
 */
export function shouldGenerateWorkOrder(
  nextDueDate: string | null | undefined,
  currentDate: Date = new Date()
): boolean {
  if (!nextDueDate) {
    return false;
  }

  try {
    const parsedDueDate = parse(nextDueDate, 'dd-MMM-yyyy', new Date());
    // Generate work order if due date is today or in the past
    return parsedDueDate <= currentDate;
  } catch (error) {
    console.error('Error checking work order generation criteria:', error);
    return false;
  }
}
