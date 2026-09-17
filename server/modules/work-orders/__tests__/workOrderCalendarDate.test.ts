import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorkOrderCalendarDays,
  currentWorkOrderCalendarDate,
  formatWorkOrderCalendarDate,
  normalizeWorkOrderCalendarDate,
} from '@shared/workOrders/dateParse';
import {
  formatWorkOrderDateDDMMYYYY,
  normalizeWorkOrderDateTyping,
  parseWorkOrderDateDDMMYYYYInput,
  workOrderOverdueCompletionMessage,
  workOrderDateInputValue,
} from '@shared/dateUtils';

const originalTimezone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimezone;
});

describe('Work Order date-only calendar handling', () => {
  it.each([
    '2026-09-18',
    '2026-09-18T23:30:00.000Z',
    '18-Sep-2026',
    '18-09-2026',
    '18/09/2026',
  ])('displays %s as DD-MM-YYYY without shifting the calendar day', (storedDate) => {
    process.env.TZ = 'Asia/Kolkata';
    expect(formatWorkOrderDateDDMMYYYY(storedDate)).toBe('18-09-2026');

    process.env.TZ = 'America/Los_Angeles';
    expect(formatWorkOrderDateDDMMYYYY(storedDate)).toBe('18-09-2026');
  });

  it('keeps blank and invalid display values explicit', () => {
    expect(formatWorkOrderDateDDMMYYYY(null)).toBe('');
    expect(formatWorkOrderDateDDMMYYYY('not-a-date', '-')).toBe('-');
    expect(formatWorkOrderDateDDMMYYYY('2026-02-30', '-')).toBe('-');
    expect(formatWorkOrderDateDDMMYYYY('31-04-2026', '-')).toBe('-');
    expect(formatWorkOrderDateDDMMYYYY('31-Apr-2026', '-')).toBe('-');
  });

  it('keeps the date picker value canonical while the display format changes', () => {
    expect(workOrderDateInputValue('18-09-2026')).toBe('2026-09-18');
    expect(workOrderDateInputValue('2026-09-18T23:30:00.000Z')).toBe('2026-09-18');
    expect(workOrderDateInputValue('2026-02-30')).toBe('');
  });

  it('converts only complete valid DD-MM-YYYY manual input', () => {
    expect(parseWorkOrderDateDDMMYYYYInput('18-09-2026')).toBe('2026-09-18');
    expect(parseWorkOrderDateDDMMYYYYInput('')).toBeNull();
    expect(parseWorkOrderDateDDMMYYYYInput('18-09-26')).toBeNull();
    expect(parseWorkOrderDateDDMMYYYYInput('2026-09-18')).toBeNull();
    expect(parseWorkOrderDateDDMMYYYYInput('30-02-2026')).toBeNull();
    expect(parseWorkOrderDateDDMMYYYYInput('31-04-2026')).toBeNull();
  });

  it('normalizes manual typing and pasted digits into DD-MM-YYYY', () => {
    expect(normalizeWorkOrderDateTyping('')).toBe('');
    expect(normalizeWorkOrderDateTyping('1')).toBe('1');
    expect(normalizeWorkOrderDateTyping('180')).toBe('18-0');
    expect(normalizeWorkOrderDateTyping('1809')).toBe('18-09');
    expect(normalizeWorkOrderDateTyping('18092026')).toBe('18-09-2026');
    expect(normalizeWorkOrderDateTyping('18/09/2026')).toBe('18-09-2026');
    expect(normalizeWorkOrderDateTyping('18-09-2026123')).toBe('18-09-2026');
  });

  it('uses DD-MM-YYYY in the shared overdue completion warning', () => {
    expect(workOrderOverdueCompletionMessage('18-Sep-2026')).toBe(
      'Work was completed after the scheduled due date (18-09-2026). The record will be tagged as overdue.',
    );
  });

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