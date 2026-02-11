/**
 * Field label mappings for human-readable field names in change request reports
 * Provides utilities to convert field paths and values to display-friendly formats
 */

import { getFieldDefinitions, TargetType } from '@shared/changeRequestFields';

/**
 * Legacy field path mappings for backward compatibility
 * Maps old field paths to their display names
 */
const LEGACY_FIELD_MAPPINGS: Record<string, string> = {
  'COMPONENTINFO.CRITICAL': 'Critical Status',
  'COMPONENTINFO.MAKER': 'Manufacturer',
  'COMPONENTINFO.MODEL': 'Model Number',
  'COMPONENTINFO.SERIALNO': 'Serial Number',
  'COMPONENTINFO.LOCATION': 'Location',
  'jobInfo.isActive': 'Active Status',
  'jobInfo.frequency': 'Maintenance Frequency',
  'jobInfo.taskType': 'Task Type',
  'jobInfo.priority': 'Priority Level',
  'spareInfo.quantity': 'Quantity',
  'spareInfo.reorderLevel': 'Reorder Level',
  'storeInfo.category': 'Store Category',
};

/**
 * Category display names mapping
 */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'components': 'Components',
  'work_orders': 'Work Orders',
  'spares': 'Spares',
  'stores': 'Stores',
};

/**
 * Status display names mapping
 */
export const STATUS_DISPLAY_NAMES: Record<string, string> = {
  'draft': 'Draft',
  'submitted': 'Submitted',
  'returned': 'Returned',
  'approved': 'Approved',
  'rejected': 'Rejected',
};

/**
 * Convert a string to title case
 * e.g., "myFieldName" -> "My Field Name"
 */
function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, (match) => match.toUpperCase()) // Capitalize first letter
    .trim();
}

/**
 * Get human-readable label for a field
 * 
 * Strategy:
 * 1. First tries to match using field definitions by columnName
 * 2. Falls back to legacy field path mappings
 * 3. Falls back to title-casing the last segment of the field path
 * 
 * @param targetType - The type of entity ('component', 'job', 'work_order', 'spare', 'store')
 * @param fieldPath - The field path/column name (e.g., 'critical', 'COMPONENTINFO.CRITICAL', 'maker')
 * @returns Human-readable field label
 */
export function getFieldLabel(targetType: string, fieldPath: string): string {
  // Try to find in field definitions by columnName
  try {
    const normalizedTargetType = targetType as TargetType;
    const fieldDefinitions = getFieldDefinitions(normalizedTargetType);
    
    // Check if fieldPath matches any columnName
    const fieldDef = fieldDefinitions.find(f => f.columnName === fieldPath);
    if (fieldDef) {
      return fieldDef.displayName;
    }
  } catch (error) {
    // If targetType is invalid, continue to fallback
  }

  // Try legacy field path mappings
  if (LEGACY_FIELD_MAPPINGS[fieldPath]) {
    return LEGACY_FIELD_MAPPINGS[fieldPath];
  }

  // Extract the last segment after a dot (for paths like "COMPONENTINFO.CRITICAL")
  const lastSegment = fieldPath.includes('.') 
    ? fieldPath.split('.').pop() || fieldPath 
    : fieldPath;

  // Title-case the last segment
  return toTitleCase(lastSegment);
}

/**
 * Safely convert any value to a readable string
 * Handles null, undefined, booleans, objects, arrays, and primitive types
 * 
 * @param value - The value to format
 * @returns Human-readable string representation
 */
export function formatFieldValue(value: any): string {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return '-';
  }

  // Handle booleans with readable format
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle numbers
  if (typeof value === 'number') {
    return value.toString();
  }

  // Handle strings
  if (typeof value === 'string') {
    return value.trim() === '' ? '-' : value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '-';
    }
    return value.map(item => formatFieldValue(item)).join(', ');
  }

  // Handle objects (including dates)
  if (typeof value === 'object') {
    // Handle Date objects
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    // Handle plain objects - convert to JSON string for display
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return '[Object]';
    }
  }

  // Fallback for any other type
  return String(value);
}
