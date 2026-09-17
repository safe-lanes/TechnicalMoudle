import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorkOrderCalendarDays,
  currentWorkOrderCalendarDate,
  formatWorkOrderCalendarDate,
  normalizeWorkOrderCalendarDate,
} from '@shared/workOrders/dateParse';

const originalTimezone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimezone;
});

describe('Work Order date-only calendar handling', () => {
  it.each([
    '2026-09-18',
    '18-Sep-2026',
    '18-09-2026',
    '18/09/2026',
  ])('keeps %s on the same calendar day in a positive-offset timezone', (storedDate) => {
    process.env.TZ = 'Asia/Kolkata';

    const normalized = normalizeWorkOrderCalendarDate(storedDate);

    expect(formatWorkOrderCalendarDate(normalized)).toBe('2026-09-18');
  });

  it('keeps the generated Work Order snapshot equal to the Job due date', () => {
    process.env.TZ = 'Asia/Kolkata';
    const jobDueDate = '18-Sep-2026';
    const dueDate = normalizeWorkOrderCalendarDate(jobDueDate);

    expect(formatWorkOrderCalendarDate(dueDate)).toBe('2026-09-18');
    expect(formatWorkOrderCalendarDate(
      addWorkOrderCalendarDays(dueDate, -30),
    )).toBe('2026-08-19');
  });

  it('represents the host-local current day as a UTC date-only value', () => {
    process.env.TZ = 'Asia/Kolkata';
    const instant = new Date('2026-09-17T20:00:00.000Z'); // 18-Sep locally

    expect(formatWorkOrderCalendarDate(
      currentWorkOrderCalendarDate(instant),
    )).toBe('2026-09-18');
  });
});