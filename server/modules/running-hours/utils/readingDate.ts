/**
 * CANONICAL RH READING-DATE CONTRACT (Task #427)
 *
 * `running_hours_audit.date_updated_local` (and the component stamp columns
 * derived from it: components.last_updated, rotational_items.rh_last_updated)
 * semantically hold a vessel-local CALENDAR DAY, not an instant. The canonical
 * persisted form is `YYYY-MM-DD`.
 *
 * This module is the SINGLE JavaScript parser/formatter for that contract.
 * Its grammar mirrors the SQL side exactly:
 *   - safe_parse_rh_date_local()  (migrations/166 + re-created in 167)
 *   - safe_rh_reading_day()       (migrations/167 — DATE-returning wrapper)
 * Cross-parity rule: for ANY text, the JS parser and safe_rh_reading_day()
 * must yield the SAME calendar day, or BOTH must yield null/NULL.
 *
 * Grammar (persisted-text parser — parseReadingDayStrict):
 *   1. ISO prefix `YYYY-MM-DD…` — the literal digits are the day (no timezone
 *      math, trailing text ignored, exactly like the SQL prefix branch).
 *      Malformed-but-ISO-shaped values (2025-13-40, 2025-02-30) → null
 *      (SQL TO_TIMESTAMP raises 22008 → safe fn returns NULL; JS must NOT
 *      Date.UTC-normalize them into a different valid day).
 *   2. Legacy `DD Mon YYYY [HH:mm]` / `DD-Mon-YYYY[-HH24:MI]` with any LONG
 *      month name (Sept, June, September, …) truncated to its first 3 letters.
 *      Out-of-range day/time (31 Feb, 99:99) → null. Trailing text ignored.
 *   3. Anything else → null. NEVER `new Date(text)` — locale-dependent
 *      parsing is exactly the poisoning this contract eliminates.
 */

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function daysInMonth(yearNum: number, monthIdx: number): number {
  return new Date(Date.UTC(yearNum, monthIdx + 1, 0)).getUTCDate();
}

function utcDay(y: number, mIdx: number, d: number): Date | null {
  if (mIdx < 0 || mIdx > 11) return null;
  if (d < 1 || d > daysInMonth(y, mIdx)) return null;
  return new Date(Date.UTC(y, mIdx, d));
}

/**
 * Strict calendar-day parse of a persisted reading-date text (or Date).
 * Returns a UTC-midnight Date, or null when unparseable/malformed.
 * MUST stay in lockstep with SQL safe_rh_reading_day() — see module header.
 */
export function parseReadingDayStrict(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const str = String(value).trim();
  if (!str) return null;

  // 1) ISO prefix — literal digits, validated as a real calendar date.
  const iso = str.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  if (iso) {
    return utcDay(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  }

  // 2) Legacy DD Mon YYYY [HH:mm] (spaces or dashes, long month names OK).
  const legacy = str.match(
    /^([0-9]{1,2})[-\s]+([A-Za-z]{3,})[-\s]+([0-9]{4})(?:[-\s]+([0-9]{1,2}):([0-9]{1,2}))?/
  );
  if (legacy) {
    const monthIdx = MONTH_INDEX[legacy[2].slice(0, 3).toLowerCase()];
    if (monthIdx === undefined) return null;
    // Long month names must START with a valid 3-letter abbreviation the same
    // way the SQL truncation does (e.g. "Sept"→Sep, "June"→Jun). A word whose
    // first 3 letters match but isn't a month-ish token still parses in SQL
    // (TO_TIMESTAMP only reads 3 letters), so we intentionally accept it too.
    if (legacy[4] !== undefined) {
      const hh = parseInt(legacy[4], 10);
      const mi = parseInt(legacy[5], 10);
      if (hh > 23 || mi > 59) return null; // SQL: 22008 → NULL
    }
    return utcDay(parseInt(legacy[3], 10), monthIdx, parseInt(legacy[1], 10));
  }

  return null;
}

/** Format a Date's UTC day as canonical `YYYY-MM-DD`. */
export function formatReadingDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Canonicalize a persisted-contract value to `YYYY-MM-DD`, or null.
 * (Strict grammar only — use canonicalizeReadingDateInput for user input.)
 */
export function canonicalReadingDay(value: string | Date | null | undefined): string | null {
  const d = parseReadingDayStrict(value);
  return d ? formatReadingDay(d) : null;
}

/**
 * Canonicalize a USER-SUPPLIED reading date to `YYYY-MM-DD`, or null.
 * Superset of the strict grammar: additionally accepts numeric D-M-YYYY /
 * D/M/YYYY (day-first — matches the app's existing WO date handling).
 * Every writer MUST pass dates through this ONCE at the service boundary and
 * persist only the canonical result; display formatting stays in the UI.
 */
export function canonicalizeReadingDateInput(value: string | Date | null | undefined): string | null {
  const strict = canonicalReadingDay(value);
  if (strict) return strict;
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^([0-9]{1,2})[-\/]([0-9]{1,2})[-\/]([0-9]{4})/);
  if (m) {
    const d = utcDay(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return d ? formatReadingDay(d) : null;
  }
  return null;
}

/** Today's UTC calendar day as `YYYY-MM-DD` (fallback when no date supplied). */
export function todayReadingDay(): string {
  return formatReadingDay(new Date());
}

/** Thrown when a SUPPLIED reading date is unparseable. Callers/route error
 * middleware treat it like a validation error (400), never a silent default. */
export class InvalidReadingDateError extends Error {
  readonly status = 400;
  readonly code = 'RH_INVALID_READING_DATE';
  constructor(value: unknown, field = 'reading date') {
    super(`Invalid ${field} "${String(value)}". Use a real calendar date (e.g. ${todayReadingDay()}).`);
    this.name = 'ValidationError';
  }
}

/**
 * Boundary rule (Task #427): ABSENT dates (null/undefined/empty) may default —
 * returns null so the caller picks its documented fallback. A PRESENT but
 * unparseable/malformed date (e.g. "2025-13-40") is REJECTED with
 * InvalidReadingDateError — silently converting it to "today" would stamp a
 * bogus observed day and corrupt latest-reading-wins ordering.
 */
export function requireReadingDayInput(
  value: string | Date | null | undefined,
  field = 'reading date'
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const canonical = canonicalizeReadingDateInput(value);
  if (!canonical) throw new InvalidReadingDateError(value, field);
  return canonical;
}
