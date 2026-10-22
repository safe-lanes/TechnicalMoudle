import { describe, expect, it } from 'vitest';
import { defectSeriesPrefix, formatDefectNumber, highestInSeries, vcodeDefectSeriesPrefix } from '../defectNumberSeries';

// Decision D1 (Ghazi, 22-Oct-2026, Jeevan #11): the defect number carries the vessel V-code.
describe('V-code defect numbers', () => {
  it('ship and office series', () => {
    expect(formatDefectNumber(vcodeDefectSeriesPrefix('0123', 2026, 'ship')!, 5)).toBe('0123-26-0005');
    expect(formatDefectNumber(vcodeDefectSeriesPrefix('0123', 26, 'shore')!, 1)).toBe('0123-26-O0001');
  });
  it('no usable V-code → null (caller keeps the D{vessel} series)', () => {
    expect(vcodeDefectSeriesPrefix(null, 26, 'ship')).toBeNull();
    expect(vcodeDefectSeriesPrefix('  ', 26, 'ship')).toBeNull();
    expect(vcodeDefectSeriesPrefix('AB-1', 26, 'ship')).toBeNull();
  });
  it('the ship and office series never read each other; old series give the running number floor', () => {
    const ids = ['D048-26-0004', 'D048-26-O0002', '0123-26-0001', '0123-26-O0007'];
    expect(highestInSeries(ids, vcodeDefectSeriesPrefix('0123', 26, 'ship')!)).toBe(1);
    expect(highestInSeries(ids, vcodeDefectSeriesPrefix('0123', 26, 'shore')!)).toBe(7);
    expect(highestInSeries(ids, defectSeriesPrefix(48, 26, 'ship'))).toBe(4);
  });
});
