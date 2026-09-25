import { ValidationError } from '../../shared/errors';

type DateFields = {
  status?: string | null;
  dateCompleted?: string | null;
  completionDateTime?: string | null;
};

function nonBlank(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Completed is the only final state covered by this invariant. */
export function isCompletedWorkOrderStatus(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'completed';
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

const MONTH_NUMBER: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function namedMonthNumber(value: string): number | null {
  const month = MONTH_NUMBER[value.slice(0, 3).toLowerCase()];
  return month ?? null;
}

function hasValidTimeSuffix(value: string): boolean {
  if (!value.trim()) return true;

  // Supported timestamp suffixes are the same 24-hour formats produced by
  // the application: optional T/whitespace, HH:mm[:ss[.fraction]], then an
  // optional ISO timezone. Reject arbitrary trailing prose and impossible
  // clock values instead of allowing Date to normalize them.
  const match = value.match(/^(?:T|\s+)(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):?(\d{2}))?$/);
  if (!match) return false;

  const [, hour, minute, second = '0', offsetHour, offsetMinute] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  return offsetHour === undefined
    || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59);
}

function isValidNamedMonthDate(date: string): boolean {
  // DD-MMM-YYYY, DD Month YYYY, optionally followed by a time.
  let match = date.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})(.*)$/);
  if (match) {
    const [, day, monthName, year, trailing] = match;
    const month = namedMonthNumber(monthName);
    if (month === null || !isRealCalendarDate(Number(year), month, Number(day))) return false;
    return hasValidTimeSuffix(trailing);
  }

  // Month DD YYYY is occasionally present in legacy exports. Validate its
  // explicit components instead of allowing JavaScript to normalize it.
  match = date.match(/^([A-Za-z]{3,9})[\s-](\d{1,2}),?[\s-](\d{4})(.*)$/);
  if (match) {
    const [, monthName, day, year, trailing] = match;
    const month = namedMonthNumber(monthName);
    if (month === null || !isRealCalendarDate(Number(year), month, Number(day))) return false;
    return hasValidTimeSuffix(trailing);
  }

  return false;
}

/**
 * Accept the formats already accepted across Work Order completion paths,
 * without rewriting the submitted value or changing its timezone semantics.
 */
export function isValidCompletedWorkOrderDate(value: unknown): value is string {
  const date = nonBlank(value);
  if (!date) return false;

  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (!isRealCalendarDate(Number(year), Number(month), Number(day))) return false;
    return date.length === 10 || !Number.isNaN(new Date(date).getTime());
  }

  const numericMatch = date.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(.*)$/);
  if (numericMatch) {
    const [, day, month, year, trailing] = numericMatch;
    return isRealCalendarDate(Number(year), Number(month), Number(day))
      && hasValidTimeSuffix(trailing);
  }

  return isValidNamedMonthDate(date);
}

/**
 * Return the persisted final Work Order date in the date-only format used by
 * Job cycle tracking. completionDateTime is intentionally not accepted here.
 */
export function getJobCompletionDate(
  workOrder: { dateCompleted?: string | null },
): string | null {
  const date = nonBlank(workOrder.dateCompleted);
  if (!date || !isValidCompletedWorkOrderDate(date)) return null;

  let match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  match = date.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;

  match = date.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})/);
  if (match) {
    const month = namedMonthNumber(match[2]);
    return month === null
      ? null
      : `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  match = date.match(/^([A-Za-z]{3,9})[\s-](\d{1,2}),?[\s-](\d{4})/);
  if (match) {
    const month = namedMonthNumber(match[1]);
    return month === null
      ? null
      : `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }

  return null;
}

/**
 * Preserve an already-persisted final date during approval. Legacy rows that
 * predate dateCompleted may still initialize it from their execution timestamp.
 */
export function resolveFinalCompletionDate(
  workOrder: Pick<DateFields, 'dateCompleted' | 'completionDateTime'>,
): string | null {
  return nonBlank(workOrder.dateCompleted) ?? nonBlank(workOrder.completionDateTime);
}

/**
 * Final-state safety net for Work Order writers.
 *
 * This deliberately does not change any caller's normal date-source
 * precedence. Callers first build their existing update payload. Only if a
 * Completed result still lacks dateCompleted do we retain an already-saved
 * final date or fall back to the already-saved execution timestamp.
 */
export function ensureCompletedWorkOrderDate<
  T extends DateFields & Record<string, any>,
  E extends DateFields,
>(existing: E | null | undefined, update: T): T {
  const resultingStatus = update.status ?? existing?.status;
  if (!isCompletedWorkOrderStatus(resultingStatus)) return update;

  const outgoingDate = nonBlank(update.dateCompleted);
  if (outgoingDate) {
    if (!isValidCompletedWorkOrderDate(outgoingDate)) {
      throw new ValidationError('A completed work order requires a valid completion date.');
    }
    return update;
  }

  const savedFinalDate = nonBlank(existing?.dateCompleted);
  if (savedFinalDate) {
    if (!isValidCompletedWorkOrderDate(savedFinalDate)) {
      throw new ValidationError('A completed work order has an invalid stored completion date.');
    }
    update.dateCompleted = savedFinalDate;
    return update;
  }

  const savedExecutionDate = nonBlank(existing?.completionDateTime);
  if (savedExecutionDate) {
    if (!isValidCompletedWorkOrderDate(savedExecutionDate)) {
      throw new ValidationError('A completed work order requires a valid completion date.');
    }
    update.dateCompleted = savedExecutionDate;
    return update;
  }

  throw new ValidationError('A completion date is required before a work order can be marked Completed.');
}