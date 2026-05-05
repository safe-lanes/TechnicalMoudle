/**
 * JSON field safety helpers.
 *
 * Problem: sync field logger historically used String() which converts
 * arrays/objects to "[object Object]". These corrupted values may exist
 * in the DB. Any code that calls .map() on JSON columns must be defensive.
 */

/**
 * Ensures a value is an array. Handles:
 * - Already an array → returned as-is
 * - A JSON string → parsed
 * - null/undefined → empty array
 * - "[object Object]" or other corrupt strings → empty array
 */
export function ensureArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Ensures a value is a valid JSON object. Handles:
 * - Already an object → returned as-is
 * - A JSON string → parsed
 * - null/undefined/corrupt → returns fallback
 */
export function ensureJsonObject(value: any, fallback: Record<string, any> = {}): Record<string, any> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
