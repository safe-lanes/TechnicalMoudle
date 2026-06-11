/**
 * Shared, format-complete date parser for work-order / job date strings.
 *
 * ⚠️ CONTRACT: every WO/job date STRING (due dates, completion dates,
 * last-done / next-due dates) MUST be parsed through parseWorkOrderDate —
 * NEVER a raw `new Date(str)` and never a single-format parser. Stored
 * formats are MIXED in real data (DD-MMM-YYYY seeds, ISO YYYY-MM-DD from
 * HTML date inputs and normalizers, ISO datetimes, DD-MM-YYYY / DD/MM/YYYY
 * from imports), and the previous per-consumer parsers each mis-handled a
 * different subset:
 *   - raw new Date('25-02-2026')  → Invalid Date (crashed the calendar
 *     generation loop via .toISOString()); new Date('10-02-2026') → Oct 2
 *     (US month/day swap) → wrong approval tier / generate window
 *   - the old status.ts parser turned ISO '2026-02-10' into garbage
 *     (Date.UTC(10, 0, 2026) ≈ year 1915) → false Overdue on compute-on-read
 *   - shouldGenerateWorkOrder parsed only DD-MMM-YYYY → ISO dates never
 *     generated
 *
 * Semantics:
 *   - date-only values (any supported format) → UTC midnight Date
 *   - ISO datetime values → native Date (full precision preserved)
 *   - unparseable / out-of-range values → null (callers must guard — and
 *     must SKIP the row, never throw, so one bad date cannot poison a loop)
 */

const MONTH_SHORT: { [key: string]: number } = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Build a UTC-midnight date and reject out-of-range component combinations
 *  (e.g. day 32, month 13) via round-trip validation. */
function utcDateValidated(year: number, monthIdx: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(monthIdx) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2200) return null; // sanity window — rejects swapped-component garbage
  const d = new Date(Date.UTC(year, monthIdx, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIdx || d.getUTCDate() !== day) return null;
  return d;
}

export function parseWorkOrderDate(value: string | Date | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value); // ms epoch
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  // ISO date-only: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return utcDateValidated(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));

  // ISO datetime: YYYY-MM-DD[T ]... — native parse preserves time + zone
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD-MMM-YYYY (e.g. 15-Jan-2024) — also tolerates DD/MMM/YYYY and full month names
  m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,9})[-\/ ](\d{4})$/);
  if (m) {
    const monthIdx = MONTH_SHORT[m[2].slice(0, 3).toLowerCase()];
    if (monthIdx === undefined) return null;
    return utcDateValidated(parseInt(m[3], 10), monthIdx, parseInt(m[1], 10));
  }

  // DD-MM-YYYY or DD/MM/YYYY (day-first, NOT US order)
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return utcDateValidated(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));

  // Last resort: native Date (RFC strings etc.)
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
