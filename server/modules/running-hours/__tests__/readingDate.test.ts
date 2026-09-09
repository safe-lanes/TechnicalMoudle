import { describe, it, expect } from 'vitest';
import {
  parseReadingDayStrict,
  canonicalReadingDay,
  canonicalizeReadingDateInput,
  formatReadingDay,
} from '../utils/readingDate';

const day = (v: string | Date | null | undefined) => {
  const d = parseReadingDayStrict(v as any);
  return d ? formatReadingDay(d) : null;
};

describe('parseReadingDayStrict — ISO branch', () => {
  it('parses plain ISO to its literal day', () => {
    expect(day('2026-06-01')).toBe('2026-06-01');
  });
  it('ignores trailing text (timestamps, offsets — literal day, no tz math)', () => {
    expect(day('2026-08-05T14:30:00Z')).toBe('2026-08-05');
    expect(day('2026-01-01T23:00:00-05:00')).toBe('2026-01-01');
    expect(day('2026-06-01 garbage')).toBe('2026-06-01');
  });
  it('REJECTS malformed ISO instead of Date.UTC-normalizing it', () => {
    expect(day('2025-13-40')).toBeNull();
    expect(day('2025-02-30')).toBeNull();
    expect(day('2025-00-10')).toBeNull();
  });
  it('handles leap days', () => {
    expect(day('2024-02-29')).toBe('2024-02-29');
    expect(day('2025-02-29')).toBeNull();
  });
});

describe('parseReadingDayStrict — legacy locale branch', () => {
  it('parses DD Mon YYYY HH:mm (the observed poison format)', () => {
    expect(day('01 Apr 2020 05:30')).toBe('2020-04-01');
    expect(day('01 Apr 2020 00:30')).toBe('2020-04-01');
    expect(day('01 Apr 2020 23:30')).toBe('2020-04-01');
  });
  it('parses long month names (Sept, June, September)', () => {
    expect(day('01 Sept 2026 10:15')).toBe('2026-09-01');
    expect(day('15 June 2025')).toBe('2025-06-15');
    expect(day('3 September 2024 08:00')).toBe('2024-09-03');
  });
  it('parses dashed DD-Mon-YYYY variants', () => {
    expect(day('15-Sep-2025')).toBe('2025-09-15');
    expect(day('15-Sep-2025 10:00')).toBe('2025-09-15');
  });
  it('rejects out-of-range days and times', () => {
    expect(day('31 Feb 2025')).toBeNull();
    expect(day('15 Sep 2025 99:99')).toBeNull();
    expect(day('32 Jan 2025')).toBeNull();
  });
  it('rejects unknown month tokens', () => {
    expect(day('15 Xyz 2025')).toBeNull();
  });
});

describe('parseReadingDayStrict — misc', () => {
  it('rejects garbage / empty / null', () => {
    expect(day('not-a-date')).toBeNull();
    expect(day('')).toBeNull();
    expect(day(null)).toBeNull();
    expect(day(undefined)).toBeNull();
  });
  it('has NO unrestricted new Date() fallback (RFC-style strings rejected)', () => {
    expect(day('Tue, 01 Apr 2020 05:30:00 GMT')).toBeNull(); // no leading day-number
  });
  it('accepts Date instances by their UTC day', () => {
    expect(day(new Date(Date.UTC(2026, 5, 1, 23, 59)))).toBe('2026-06-01');
    expect(day(new Date('invalid'))).toBeNull();
  });
});

describe('canonicalizeReadingDateInput (user-input superset)', () => {
  it('accepts everything the strict grammar accepts', () => {
    expect(canonicalizeReadingDateInput('01 Sept 2026 10:15')).toBe('2026-09-01');
    expect(canonicalizeReadingDateInput('2026-06-01T10:00:00+05:30')).toBe('2026-06-01');
  });
  it('additionally accepts numeric day-first D-M-YYYY / D/M/YYYY', () => {
    expect(canonicalizeReadingDateInput('15-08-2026')).toBe('2026-08-15');
    expect(canonicalizeReadingDateInput('5/8/2026')).toBe('2026-08-05');
    expect(canonicalizeReadingDateInput('31-02-2026')).toBeNull();
  });
  it('still rejects malformed ISO and garbage', () => {
    expect(canonicalizeReadingDateInput('2025-13-40')).toBeNull();
    expect(canonicalizeReadingDateInput('soon')).toBeNull();
  });
});

describe('canonicalReadingDay is timezone-independent', () => {
  it('same result regardless of process TZ (pure UTC math)', () => {
    // parseReadingDayStrict never consults local time: verify midnight edges.
    expect(canonicalReadingDay('01 Apr 2020 00:30')).toBe('2020-04-01');
    expect(canonicalReadingDay('01 Apr 2020 23:30')).toBe('2020-04-01');
    expect(canonicalReadingDay('2020-04-01T00:00:01+14:00')).toBe('2020-04-01');
  });
});
