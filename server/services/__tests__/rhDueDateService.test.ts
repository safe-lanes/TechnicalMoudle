import { describe, expect, it } from 'vitest';
import {
  calculateHistoricalRhAverage,
  estimateRhDueDate,
  effectiveDueDate,
  resolveAuthoritativeRhComponent,
} from '../rhDueDateService';

describe('historical RH due-date projection', () => {
  const points = [
    { cumulativeRH: '100', dateUpdatedLocal: '21-Jan-2026' },
    { cumulativeRH: '1000', dateUpdatedLocal: '22-Sep-2026' },
  ];

  it('uses the supplied 900 RH over 244 days example', () => {
    const result = estimateRhDueDate(1200, points);
    expect(result.averagePerDay).toBeCloseTo(900 / 244, 8);
    expect(result.dueDate).toBe('2026-11-15');
    expect(result.basis).toBe('HISTORICAL');
  });

  it('rejects invalid, non-increasing, same-day, and reset points', () => {
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 90, dateUpdatedLocal: '02-Jan-2026' },
    ])).toBeNull();
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 200, dateUpdatedLocal: '01-Jan-2026' },
    ])).toBeNull();
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026', stampHolder: 'old' },
      { cumulativeRH: 200, dateUpdatedLocal: '02-Jan-2026', stampHolder: 'new' },
    ])).toBeNull();
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 0, dateUpdatedLocal: '02-Jan-2026', isRenewalReset: true },
      { cumulativeRH: 50, dateUpdatedLocal: '03-Jan-2026' },
    ])).toBeNull();
  });

  it('skips duplicate same-day audit snapshots and uses the latest earlier reading', () => {
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 190, dateUpdatedLocal: '10-Jan-2026', enteredAtUTC: '2026-01-10T08:00:00Z' },
      { cumulativeRH: 200, dateUpdatedLocal: '10-Jan-2026', enteredAtUTC: '2026-01-10T09:00:00Z' },
    ])).toBeCloseTo(100 / 9, 8);
  });

  it('uses the full valid history even when the Job completion date is much older', () => {
    const result = estimateRhDueDate(6500, [
      { cumulativeRH: 500, dateUpdatedLocal: '28-Dec-2025' },
      { cumulativeRH: 6000, dateUpdatedLocal: '06-Jan-2026' },
      { cumulativeRH: 6000, dateUpdatedLocal: '07-Jan-2026' },
      { cumulativeRH: 6100, dateUpdatedLocal: '15-Feb-2026' },
    ]);
    expect(result.averagePerDay).toBeCloseTo(5600 / 49, 8);
    expect(result.dueDate).toBe('2026-02-19');
    expect(result.basis).toBe('HISTORICAL');
  });

  it('uses the earliest and latest valid readings rather than only the latest pair', () => {
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 500, dateUpdatedLocal: '10-Jan-2026' },
      { cumulativeRH: 700, dateUpdatedLocal: '21-Jan-2026' },
    ])).toBeCloseTo(600 / 20, 8);
  });

  it('marks the threshold due on the latest reading date when already reached', () => {
    const result = estimateRhDueDate(900, points);
    expect(result.dueDate).toBe('2026-09-22');
  });

  it('projects at least one day for a positive fractional-day remainder', () => {
    const result = estimateRhDueDate(1001, points);
    expect(result.dueDate).toBe('2026-09-23');
  });

  it('does not bridge non-contiguous stamp epochs', () => {
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026', stampHolder: 'A' },
      { cumulativeRH: 200, dateUpdatedLocal: '10-Jan-2026', stampHolder: 'B' },
      { cumulativeRH: 300, dateUpdatedLocal: '20-Jan-2026', stampHolder: 'A' },
    ])).toBeNull();
  });

  it('excludes soft-deleted readings from historical utilization', () => {
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 200, dateUpdatedLocal: '05-Jan-2026' },
      { cumulativeRH: 500, dateUpdatedLocal: '10-Jan-2026', isDeleted: true },
    ])).toBeCloseTo(25, 8);
  });

  it('compares Dual Frequency dates without changing either source date', () => {
    expect(effectiveDueDate('20-Dec-2026', '15-Nov-2026')).toEqual({
      date: '15-Nov-2026',
      basis: 'RUNNING_HOURS',
    });
    expect(effectiveDueDate('15-Nov-2026', '15-Nov-2026').basis)
      .toBe('CALENDAR_AND_RUNNING_HOURS');
    expect(effectiveDueDate('20-Dec-2026', null).basis).toBe('CALENDAR');
  });

  it('resolves inherited history by master id, then legacy source code', async () => {
    const master = { cuuid: 'master-1', vesselId: 'v1', rhCounterType: 'MASTER' };
    expect(await resolveAuthoritativeRhComponent(
      { cuuid: 'child', rhCounterType: 'INHERITED', rhMasterComponentId: 'legacy-7', rhCounterSource: '601.01', vesselId: 'v1' },
      async id => id === 'legacy-7' ? master : null,
      async () => null,
    )).toBe(master);

    expect(await resolveAuthoritativeRhComponent(
      { cuuid: 'child', rhCounterType: 'INHERITED', rhCounterSource: '601.01', vesselId: 'v1' },
      async () => null,
      async (code, vesselId) => code === '601.01' && vesselId === 'v1' ? master : null,
    )).toBe(master);
  });
});