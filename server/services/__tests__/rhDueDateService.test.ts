import { describe, expect, it } from 'vitest';
import {
  calculateHistoricalRhAverage,
  estimateRhDueDate,
  effectiveDueDate,
  RH_ESTIMATE_BASIS_VERSION,
  resolveAuthoritativeRhComponent,
} from '../rhDueDateService';

describe('historical RH due-date projection', () => {
  const points = [
    { cumulativeRH: '100', dateUpdatedLocal: '21-Jan-2026' },
    { cumulativeRH: '1000', dateUpdatedLocal: '22-Sep-2026' },
  ];

  it('projects the full frequency from the WO completion date', () => {
    const result = estimateRhDueDate('20-Sep-2026', 200, points);
    expect(result.averagePerDay).toBeCloseTo(900 / 244, 8);
    expect(result.dueDate).toBe('2026-11-13');
    expect(result.basis).toBe(`${RH_ESTIMATE_BASIS_VERSION}_HISTORICAL`);
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
    ])).toBeCloseTo(50, 8);
  });

  it('skips duplicate same-day audit snapshots and uses the latest earlier reading', () => {
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 190, dateUpdatedLocal: '10-Jan-2026', enteredAtUTC: '2026-01-10T08:00:00Z' },
      { cumulativeRH: 200, dateUpdatedLocal: '10-Jan-2026', enteredAtUTC: '2026-01-10T09:00:00Z' },
    ])).toBeCloseTo(100 / 9, 8);
  });

  it('uses full valid history for the rate but anchors on Job completion', () => {
    const result = estimateRhDueDate('20-Jan-2026', 400, [
      { cumulativeRH: 500, dateUpdatedLocal: '28-Dec-2025' },
      { cumulativeRH: 6000, dateUpdatedLocal: '06-Jan-2026' },
      { cumulativeRH: 6000, dateUpdatedLocal: '07-Jan-2026' },
      { cumulativeRH: 6100, dateUpdatedLocal: '15-Feb-2026' },
    ]);
    expect(result.averagePerDay).toBeCloseTo(5600 / 49, 8);
    expect(result.dueDate).toBe('2026-01-24');
    expect(result.basis).toBe(`${RH_ESTIMATE_BASIS_VERSION}_HISTORICAL`);
  });

  it('uses the earliest and latest valid readings rather than only the latest pair', () => {
    expect(calculateHistoricalRhAverage([
      { cumulativeRH: 100, dateUpdatedLocal: '01-Jan-2026' },
      { cumulativeRH: 500, dateUpdatedLocal: '10-Jan-2026' },
      { cumulativeRH: 700, dateUpdatedLocal: '21-Jan-2026' },
    ])).toBeCloseTo(600 / 20, 8);
  });

  it('does not reduce the full frequency by RH consumed after completion', () => {
    const result = estimateRhDueDate('20-Sep-2026', 200, points);
    expect(result.dueDate).toBe('2026-11-13');
  });

  it('uses ordinary rounding when the frequency projects below half a day', () => {
    const result = estimateRhDueDate('22-Sep-2026', 1, points);
    expect(result.dueDate).toBe('2026-09-22');
  });

  it('returns versioned unavailable reasons for invalid completion data', () => {
    expect(estimateRhDueDate(null, 200, points).basis)
      .toBe(`${RH_ESTIMATE_BASIS_VERSION}_INVALID_COMPLETION_DATE`);
    expect(estimateRhDueDate('20-Sep-2026', null, points).basis)
      .toBe(`${RH_ESTIMATE_BASIS_VERSION}_MISSING_RH_FREQUENCY`);
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