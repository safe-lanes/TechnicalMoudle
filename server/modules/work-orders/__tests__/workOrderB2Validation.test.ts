import { describe, expect, it } from 'vitest';
import { validateWorkOrderB2Baselines } from '@shared/workOrders/workOrderB2Validation';

describe('Work Order B2 snapshot baseline validation', () => {
  it.each(['Calendar', 'Running Hours', 'Dual Frequency'])(
    'requires %s Start Date to be strictly after Last Completed On',
    (maintenanceBasis) => {
      const base = {
        maintenanceBasis,
        lastDoneDateSnapshot: '15-Jul-2026',
      };
      expect(validateWorkOrderB2Baselines({
        ...base,
        startDateTime: '2026-07-16T08:00:00.000Z',
      })).toEqual([]);
      expect(validateWorkOrderB2Baselines({
        ...base,
        startDateTime: '2026-07-15T08:00:00.000Z',
      })[0]?.code).toBe('START_DATE_NOT_AFTER_LAST_COMPLETED');
      expect(validateWorkOrderB2Baselines({
        ...base,
        startDateTime: '2026-07-14T08:00:00.000Z',
      })[0]?.code).toBe('START_DATE_NOT_AFTER_LAST_COMPLETED');
    },
  );

  it('requires RH completion hours to be strictly greater than the snapshot', () => {
    const base = {
      maintenanceBasis: 'Running Hours',
      rhLastDoneSnapshot: '9000.00',
    };
    expect(validateWorkOrderB2Baselines({
      ...base,
      woCompletionRh: '9000.01',
    })).toEqual([]);
    expect(validateWorkOrderB2Baselines({
      ...base,
      woCompletionRh: '9000',
    })[0]?.code).toBe('WO_COMPLETION_RH_NOT_AFTER_LAST_COMPLETED');
    expect(validateWorkOrderB2Baselines({
      ...base,
      woCompletionRh: '8999',
    })[0]?.code).toBe('WO_COMPLETION_RH_NOT_AFTER_LAST_COMPLETED');
  });

  it('does not apply the completion-RH baseline to Calendar or Dual Work Orders', () => {
    for (const maintenanceBasis of ['Calendar', 'Dual Frequency']) {
      expect(validateWorkOrderB2Baselines({
        maintenanceBasis,
        woCompletionRh: '100',
        rhLastDoneSnapshot: '9000',
      })).toEqual([]);
    }
  });

  it('skips only comparisons whose legacy snapshot is blank', () => {
    expect(validateWorkOrderB2Baselines({
      maintenanceBasis: 'Running Hours',
      startDateTime: '2026-01-01',
      lastDoneDateSnapshot: null,
      woCompletionRh: '1',
      rhLastDoneSnapshot: null,
    })).toEqual([]);
  });

  it('normalizes supported stored date formats before comparing', () => {
    expect(validateWorkOrderB2Baselines({
      maintenanceBasis: 'Calendar',
      startDateTime: '16/07/2026',
      lastDoneDateSnapshot: '15-Jul-2026',
    })).toEqual([]);
  });
});