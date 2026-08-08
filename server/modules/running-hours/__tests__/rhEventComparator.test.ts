import { describe, it, expect } from 'vitest';
import {
  parseReadingDay,
  effectiveReadingDay,
  originRank,
  compareRhEvents,
  type RhEventLike,
} from '../rhEventComparator';

const ev = (o: Partial<RhEventLike> & { rhauuid: string }): RhEventLike => ({
  dateUpdatedLocal: null,
  enteredAtUTC: null,
  originSide: null,
  ...o,
});

describe('parseReadingDay', () => {
  it('parses date-only text to a UTC day', () => {
    expect(parseReadingDay('2026-08-05')?.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });
  it('parses date-time text to its UTC day', () => {
    expect(parseReadingDay('2026-08-05T14:30:00Z')?.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });
  it('rejects garbage and empty values', () => {
    expect(parseReadingDay('not-a-date')).toBeNull();
    expect(parseReadingDay('')).toBeNull();
    expect(parseReadingDay(null)).toBeNull();
    expect(parseReadingDay(undefined)).toBeNull();
  });
});

describe('effectiveReadingDay', () => {
  it('prefers date_updated_local over entered_at_utc', () => {
    const e = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-01', enteredAtUTC: '2026-08-07T10:00:00Z' });
    expect(effectiveReadingDay(e)?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
  it('falls back to entered_at_utc day for legacy unparseable dates (never "now")', () => {
    const e = ev({ rhauuid: 'a', dateUpdatedLocal: 'garbage', enteredAtUTC: '2026-08-07T10:00:00Z' });
    expect(effectiveReadingDay(e)?.toISOString()).toBe('2026-08-07T00:00:00.000Z');
  });
  it('returns null when no date at all', () => {
    expect(effectiveReadingDay(ev({ rhauuid: 'a' }))).toBeNull();
  });
});

describe('originRank', () => {
  it('ranks ship < legacy/unknown < shore (lower wins ties)', () => {
    expect(originRank('ship')).toBeLessThan(originRank(null));
    expect(originRank(null)).toBeLessThan(originRank('shore'));
    expect(originRank('SHIP')).toBe(originRank('ship'));
  });
});

describe('compareRhEvents — canonical latest-reading-wins order', () => {
  it('later reading date wins regardless of origin', () => {
    const shore = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'shore' });
    const ship = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-05', originSide: 'ship' });
    expect(compareRhEvents(shore, ship)).toBeGreaterThan(0);
  });
  it('later reading date wins even if it was entered earlier (arrival-order independence)', () => {
    const older = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-05', enteredAtUTC: '2026-08-08T00:00:00Z' });
    const newer = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', enteredAtUTC: '2026-08-06T00:00:00Z' });
    expect(compareRhEvents(newer, older)).toBeGreaterThan(0);
  });
  it('ship wins an exact reading-date tie', () => {
    const shore = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'shore', enteredAtUTC: '2026-08-07T00:00:00Z' });
    const ship = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T00:00:00Z' });
    expect(compareRhEvents(ship, shore)).toBeGreaterThan(0);
  });
  it('legacy (null origin) beats shore but loses to ship on ties', () => {
    const legacy = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: null });
    const shore = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'shore' });
    const ship = ev({ rhauuid: 'c', dateUpdatedLocal: '2026-08-06', originSide: 'ship' });
    expect(compareRhEvents(legacy, shore)).toBeGreaterThan(0);
    expect(compareRhEvents(ship, legacy)).toBeGreaterThan(0);
  });
  it('same day + same origin: later entered_at_utc wins', () => {
    const a = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T08:00:00Z' });
    const b = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T18:00:00Z' });
    expect(compareRhEvents(b, a)).toBeGreaterThan(0);
  });
  it('is a stable total order — antisymmetric, no zeros for distinct ids', () => {
    const a = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T08:00:00Z' });
    const b = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T08:00:00Z' });
    expect(compareRhEvents(a, b)).toBe(-compareRhEvents(b, a));
    expect(compareRhEvents(a, b)).not.toBe(0);
  });
  it('an event with no usable date always loses', () => {
    const dateless = ev({ rhauuid: 'a' });
    const dated = ev({ rhauuid: 'b', dateUpdatedLocal: '2020-01-01' });
    expect(compareRhEvents(dated, dateless)).toBeGreaterThan(0);
  });
  it('sorting a shuffled set converges to the same winner (convergence property)', () => {
    const events = [
      ev({ rhauuid: 'w', dateUpdatedLocal: '2026-08-04', originSide: 'ship' }),
      ev({ rhauuid: 'x', dateUpdatedLocal: '2026-08-06', originSide: 'shore' }),
      ev({ rhauuid: 'y', dateUpdatedLocal: '2026-08-06', originSide: 'ship' }),
      ev({ rhauuid: 'z', dateUpdatedLocal: '2026-08-05', originSide: null }),
    ];
    for (let i = 0; i < 4; i++) {
      const shuffled = [...events.slice(i), ...events.slice(0, i)];
      const winner = shuffled.reduce((best, e) => (compareRhEvents(e, best) > 0 ? e : best));
      expect(winner.rhauuid).toBe('y'); // latest day, ship wins the tie
    }
  });
});
