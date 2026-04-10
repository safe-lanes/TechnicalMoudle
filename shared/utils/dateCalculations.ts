// Date calculation utilities for work order due dates

/**
 * Parses a date in DD-MM-YYYY format to a Date object
 */
export function parseDDMMYYYY(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  
  return new Date(Date.UTC(year, month, day));
}

/**
 * Formats a Date object to DD-MM-YYYY format
 */
export function formatDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
}

/**
 * Adds a time interval to a date
 */
export function addInterval(
  startDate: Date,
  intervalValue: number,
  intervalUnit: string
): Date {
  const result = new Date(startDate);
  
  switch (intervalUnit?.toLowerCase()) {
    case 'days':
      result.setDate(result.getDate() + intervalValue);
      break;
    case 'weeks':
      result.setDate(result.getDate() + (intervalValue * 7));
      break;
    case 'months':
      result.setMonth(result.getMonth() + intervalValue);
      break;
    case 'years':
      result.setFullYear(result.getFullYear() + intervalValue);
      break;
    default:
      // If unit is not recognized, default to months
      result.setMonth(result.getMonth() + intervalValue);
  }
  
  return result;
}

/**
 * Calculates due date based on installation date and maintenance interval
 */
export function calculateDueDate(
  installationDate: string | null | undefined,
  frequencyValue: string | number | null | undefined,
  frequencyUnit: string | null | undefined
): string | null {
  // Parse installation date
  const startDate = parseDDMMYYYY(installationDate);
  if (!startDate) return null;
  
  // Parse frequency value
  const intervalValue = typeof frequencyValue === 'string' 
    ? parseInt(frequencyValue, 10) 
    : frequencyValue;
  
  if (!intervalValue || isNaN(intervalValue) || intervalValue <= 0) return null;
  if (!frequencyUnit) return null;
  
  // Calculate due date
  const dueDate = addInterval(startDate, intervalValue, frequencyUnit);
  
  return formatDDMMYYYY(dueDate);
}
