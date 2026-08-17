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

/**
 * Task #427: session-timezone-safe CALENDAR DAY of date_updated_local.
 * safe_rh_reading_day() (migrations/167) applies ::date inside the SAME
 * session that TO_TIMESTAMP built the timestamptz in, so the literal day
 * round-trips regardless of the DB session timezone. All at-date readers
 * must compare this DATE against a target calendar day (YYYY-MM-DD), never
 * a timestamptz against an instant — otherwise a non-UTC session shifts a
 * vessel-local day across midnight.
 */
export function readingDayLocalExpr(): SQL {
  return sql`safe_rh_reading_day(${runningHoursAudit.dateUpdatedLocal})`;
}

/** Deliberate instant→calendar-day conversion for at-date targets (UTC day). */
export function targetReadingDay(targetDate: Date): string {
  return targetDate.toISOString().split('T')[0];
}
