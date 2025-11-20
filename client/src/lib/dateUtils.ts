import { format, parseISO, parse, isValid } from 'date-fns';

/**
 * Date utility functions for consistent date formatting across the system
 * System standard: ISO 8601 format (YYYY-MM-DD) for storage
 * Professional display format: DD-MMM-YYYY (e.g., 20-Nov-2025)
 * Legacy display format: DD-MM-YYYY
 */

/**
 * Parse a date string that might be in various formats
 * @param dateStr - Date string to parse
 * @returns Date object or null if invalid
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  // Try ISO format first (YYYY-MM-DD or full ISO string)
  try {
    const date = parseISO(dateStr);
    if (isValid(date)) return date;
  } catch {}
  
  // Try DD-MM-YYYY format (legacy data)
  try {
    const date = parse(dateStr, 'dd-MM-yyyy', new Date());
    if (isValid(date)) return date;
  } catch {}
  
  // Try DD/MM/YYYY format (alternative legacy format)
  try {
    const date = parse(dateStr, 'dd/MM/yyyy', new Date());
    if (isValid(date)) return date;
  } catch {}
  
  // Try default Date constructor as last resort
  try {
    const date = new Date(dateStr);
    if (isValid(date)) return date;
  } catch {}
  
  return null;
}

/**
 * Format a date for display (DD-MM-YYYY)
 * @param date - Date to format (Date object or string)
 * @param fallback - Fallback value if date is invalid (default: '-')
 * @returns Formatted date string
 */
export function formatForDisplay(date: Date | string | null | undefined, fallback: string = '-'): string {
  if (!date) return fallback;
  
  const dateObj = typeof date === 'string' ? parseDate(date) : date;
  if (!dateObj) return fallback;
  
  try {
    return format(dateObj, 'dd-MM-yyyy');
  } catch {
    return fallback;
  }
}

/**
 * Format a date for storage (YYYY-MM-DD)
 * @param date - Date to format (Date object or string)
 * @returns ISO formatted date string or null
 */
export function formatForStorage(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  const dateObj = typeof date === 'string' ? parseDate(date) : date;
  if (!dateObj) return null;
  
  try {
    return format(dateObj, 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

/**
 * Format a date with time for display (DD-MM-YYYY HH:mm)
 * @param date - Date to format (Date object or string)
 * @param fallback - Fallback value if date is invalid (default: '-')
 * @returns Formatted date time string
 */
export function formatDateTimeForDisplay(date: Date | string | null | undefined, fallback: string = '-'): string {
  if (!date) return fallback;
  
  const dateObj = typeof date === 'string' ? parseDate(date) : date;
  if (!dateObj) return fallback;
  
  try {
    return format(dateObj, 'dd-MM-yyyy HH:mm');
  } catch {
    return fallback;
  }
}

/**
 * Format a date professionally with month name (DD-MMM-YYYY)
 * @param date - Date to format (Date object or string)
 * @param fallback - Fallback value if date is invalid (default: '—')
 * @returns Professional formatted date string (e.g., "20-Nov-2025")
 */
export function formatProfessionalDate(date: Date | string | null | undefined, fallback: string = '—'): string {
  if (!date) return fallback;
  
  const dateObj = typeof date === 'string' ? parseDate(date) : date;
  if (!dateObj) return fallback;
  
  try {
    return format(dateObj, 'dd-MMM-yyyy');
  } catch {
    return fallback;
  }
}

/**
 * Format a date and time professionally (DD-MMM-YYYY HH:mm)
 * @param date - Date to format (Date object or string)
 * @param fallback - Fallback value if date is invalid (default: '—')
 * @returns Professional formatted datetime string (e.g., "20-Nov-2025 05:30")
 */
export function formatProfessionalDateTime(date: Date | string | null | undefined, fallback: string = '—'): string {
  if (!date) return fallback;
  
  const dateObj = typeof date === 'string' ? parseDate(date) : date;
  if (!dateObj) return fallback;
  
  try {
    return format(dateObj, 'dd-MMM-yyyy HH:mm');
  } catch {
    return fallback;
  }
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 * @returns Today's date in ISO format
 */
export function getTodayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Check if a date string is in ISO format (YYYY-MM-DD)
 * @param dateStr - Date string to check
 * @returns True if date is in ISO format
 */
export function isISOFormat(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

/**
 * Convert legacy date format (DD-MM-YYYY) to ISO format (YYYY-MM-DD)
 * @param legacyDate - Date in DD-MM-YYYY format
 * @returns Date in YYYY-MM-DD format or null
 */
export function convertLegacyToISO(legacyDate: string | null | undefined): string | null {
  if (!legacyDate) return null;
  
  // If already in ISO format, return as is
  if (isISOFormat(legacyDate)) return legacyDate;
  
  const date = parseDate(legacyDate);
  return date ? formatForStorage(date) : null;
}