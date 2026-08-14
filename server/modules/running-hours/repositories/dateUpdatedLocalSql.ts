import { sql, type SQL } from 'drizzle-orm';
import { runningHoursAudit } from '@shared/schema';

/**
 * Crash-proof parse of running_hours_audit.date_updated_local (a free-text
 * column) into a timestamp for date matching.
 *
 * History: the RH entry screen used to format dates with en-GB
 * toLocaleDateString, which abbreviates September as "Sept" (4 letters).
 * TO_TIMESTAMP(..., 'DD-Mon-YYYY-HH24:MI') consumes "Sep" for the month and
 * then chokes on "t-2025…" for the year (Postgres error 22007), and a single
 * bad row aborts the whole batched query — breaking the RH module for the
 * vessel. Sync copies this column verbatim, so legacy bad rows can exist on
 * any installation.
 *
 * The actual parsing lives in the SQL function safe_parse_rh_date_local()
 * (migrations/166_safe_rh_date_parse.sql), because regex prefix checks alone
 * cannot make TO_TIMESTAMP safe: values like "15 Sep 2025 99:99" or
 * "2025-13-40" pass shape checks but raise 22008. The function:
 *  1. ISO prefix (YYYY-MM-DD…) → parse as before (identical for valid input).
 *  2. DD-Mon-YYYY[-HH24:MI] after space→dash replacement, with any LONG month
 *     name (Sept, June, July, September, …) truncated to its first 3 letters
 *     → parse (identical for valid input).
 *  3. ANY parse failure (out-of-range month/day/time, unrecognized shape)
 *     → NULL, so the row is excluded from date matching instead of raising.
 */
export function parsedDateUpdatedLocalExpr(): SQL {
  return sql`safe_parse_rh_date_local(${runningHoursAudit.dateUpdatedLocal})`;
}
