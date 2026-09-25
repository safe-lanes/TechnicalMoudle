import { describe, expect, it } from 'vitest';
import { formatWorkOrderExportDueValue } from '@/pages/pms/workOrderExportDueValue';
import { getWorkOrderListDueHour } from '../utils/workOrderPartADates';

describe('Work Orders Excel and PDF due-value formatting', () => {
  const formatForEitherExport = formatWorkOrderExportDueValue;

  it('exports the displayed Work Order RH snapshot, not an advanced Job target', () => {
    const wo = {
      maintenanceBasis: 'Running Hours',
      dueRhSnapshot: '1000.00',
      cycleDueRhSnapshot: '1100.00',
      nextDueReading: '1200',
      dueRH: 1400, // Job-derived value in the list response, not the WO cycle
    };
    expect(formatForEitherExport({
      ...wo, nextDueHour: getWorkOrderListDueHour(wo),
    })).toBe('1,000 RH');
  });

  it('retains the Work Order fallback order used by the list and form', () => {
    const base = { maintenanceBasis: 'Running Hours', nextDueReading: '1200' };
    for (const [wo, expected] of [
      [{ ...base, dueRhSnapshot: null, cycleDueRhSnapshot: '1100.00' }, '1,100 RH'],
      [{ ...base, dueRhSnapshot: null, cycleDueRhSnapshot: null }, '1,200 RH'],
    ] as const) {
      expect(formatForEitherExport({
        ...wo, nextDueHour: getWorkOrderListDueHour(wo),
      })).toBe(expected);
    }
  });

  it('keeps zero and missing or invalid RH targets distinct', () => {
    const base = { maintenanceBasis: 'Running Hours', dueRH: 1400, nextDueReading: '1200' };
    expect(formatForEitherExport({ ...base, nextDueHour: 0 })).toBe('0 RH');
    expect(formatForEitherExport({ ...base, nextDueHour: null })).toBe('-');
    expect(formatForEitherExport({ ...base, nextDueHour: Number.NaN })).toBe('-');
  });

  it('leaves Calendar and Dual Frequency date exports unchanged', () => {
    for (const maintenanceBasis of ['Calendar', 'Dual Frequency']) {
      expect(formatForEitherExport({
        maintenanceBasis, dueDate: '2026-09-25', nextDueHour: 1000,
      })).toBe('25-Sep-2026');
      expect(formatForEitherExport({ maintenanceBasis, dueDate: null })).toBe('-');
    }
  });
});