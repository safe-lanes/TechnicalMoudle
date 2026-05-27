import { describe, it, expect } from 'vitest';
import {
  computePointInTimeStatus,
  findActivePostponementAt,
  getWorkOrderBucketMonth,
  type PITWorkOrder,
  type PITPostponement,
} from '@shared/workOrders/pointInTimeStatus';
import type { CompanyStandardGraceConfig } from '@shared/workOrders/status';

const COMPANY_GRACE: CompanyStandardGraceConfig = {
  graceMethod: 'FIXED_DAYS',
  graceValue: 7,
  scope: 'ALL_WORK_ORDERS',
  fallbackGraceDays: null,
  fallbackMethod: null,
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// Uses DD-MMM-YYYY format — the format computeWorkOrderStatus parses.
const isoDate = (y: number, m: number, d: number) => `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${y}`;
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

describe('computePointInTimeStatus', () => {
  it('returns Overdue at end of Feb for a WO due 10-Feb that gets completed 15-Mar', () => {
    const wo: PITWorkOrder = {
      wouuid: 'wo-1',
      dueDate: isoDate(2026, 2, 10),
      originalDueDate: isoDate(2026, 2, 10),
      completionDateTime: '2026-03-15T10:00:00Z',
      maintenanceBasis: 'Calendar',
    };
    const febEnd = monthEnd(2026, 2);
    const status = computePointInTimeStatus({ wo, refDate: febEnd, companyGraceConfig: COMPANY_GRACE });
    expect(status).toBe('Overdue');
  });

  it('returns Completed at end of Mar for the same WO', () => {
    const wo: PITWorkOrder = {
      wouuid: 'wo-1',
      dueDate: isoDate(2026, 2, 10),
      originalDueDate: isoDate(2026, 2, 10),
      completionDateTime: '2026-03-15T10:00:00Z',
      maintenanceBasis: 'Calendar',
    };
    const marEnd = monthEnd(2026, 3);
    const status = computePointInTimeStatus({ wo, refDate: marEnd, companyGraceConfig: COMPANY_GRACE });
    expect(status).toBe('Completed');
  });

  it('returns Outstanding for an open WO still within grace at month-end', () => {
    const wo: PITWorkOrder = {
      wouuid: 'wo-2',
      dueDate: isoDate(2026, 2, 28),
      originalDueDate: isoDate(2026, 2, 28),
      completionDateTime: null,
      maintenanceBasis: 'Calendar',
    };
    const febEnd = monthEnd(2026, 2);
    const status = computePointInTimeStatus({ wo, refDate: febEnd, companyGraceConfig: COMPANY_GRACE });
    // Past due (Feb 28) but well within 7-day grace at Feb 28 end-of-day → Outstanding
    expect(status).toBe('Outstanding');
  });

  it('returns Postponed when a WO had an approved postponement and the new due date is still in the future', () => {
    const wo: PITWorkOrder = {
      wouuid: 'wo-3',
      dueDate: isoDate(2026, 5, 1),       // current dueDate reflects latest postponement
      originalDueDate: isoDate(2026, 2, 10),
      completionDateTime: null,
      maintenanceBasis: 'Calendar',
    };
    const postponements: PITPostponement[] = [
      {
        workOrderId: 'wo-3',
        postponementNumber: 1,
        status: 'Approved',
        approvedDate: isoDate(2026, 2, 20),
        newDueDate: isoDate(2026, 5, 1),
      },
    ];
    const febEnd = monthEnd(2026, 2);
    const status = computePointInTimeStatus({ wo, postponements, refDate: febEnd, companyGraceConfig: COMPANY_GRACE });
    expect(status).toBe('Postponed');
  });

  it('returns Overdue (not Postponed) when the new postponed due date is itself past grace at month-end', () => {
    const wo: PITWorkOrder = {
      wouuid: 'wo-4',
      dueDate: isoDate(2026, 1, 20),
      originalDueDate: isoDate(2026, 1, 5),
      completionDateTime: null,
      maintenanceBasis: 'Calendar',
    };
    const postponements: PITPostponement[] = [
      {
        workOrderId: 'wo-4',
        postponementNumber: 1,
        status: 'Approved',
        approvedDate: isoDate(2026, 1, 6),
        newDueDate: isoDate(2026, 1, 20), // also past + grace by end of Feb
      },
    ];
    const febEnd = monthEnd(2026, 2);
    const status = computePointInTimeStatus({ wo, postponements, refDate: febEnd, companyGraceConfig: COMPANY_GRACE });
    expect(status).toBe('Overdue');
  });

  it('ignores postponements approved after the reference date', () => {
    const wo: PITWorkOrder = {
      wouuid: 'wo-5',
      dueDate: isoDate(2026, 5, 1),
      originalDueDate: isoDate(2026, 2, 10),
      completionDateTime: null,
      maintenanceBasis: 'Calendar',
    };
    const postponements: PITPostponement[] = [
      {
        workOrderId: 'wo-5',
        postponementNumber: 1,
        status: 'Approved',
        approvedDate: isoDate(2026, 3, 15), // approved AFTER end of Feb
        newDueDate: isoDate(2026, 5, 1),
      },
    ];
    const febEnd = monthEnd(2026, 2);
    const status = computePointInTimeStatus({ wo, postponements, refDate: febEnd, companyGraceConfig: COMPANY_GRACE });
    // At end of Feb, no postponement in effect → effective due = originalDueDate (10-Feb)
    // 10-Feb + 7 days grace = 17-Feb → end of Feb is past grace → Overdue
    expect(status).toBe('Overdue');
  });

  it('ignores Pending or Rejected postponements', () => {
    const wo: PITWorkOrder = {
      wouuid: 'wo-6',
      dueDate: isoDate(2026, 2, 10),
      originalDueDate: isoDate(2026, 2, 10),
      completionDateTime: null,
      maintenanceBasis: 'Calendar',
    };
    const postponements: PITPostponement[] = [
      { workOrderId: 'wo-6', postponementNumber: 1, status: 'Pending', approvedDate: isoDate(2026, 2, 12), newDueDate: isoDate(2026, 5, 1) },
      { workOrderId: 'wo-6', postponementNumber: 2, status: 'Rejected', approvedDate: isoDate(2026, 2, 13), newDueDate: isoDate(2026, 5, 1) },
    ];
    const febEnd = monthEnd(2026, 2);
    const status = computePointInTimeStatus({ wo, postponements, refDate: febEnd, companyGraceConfig: COMPANY_GRACE });
    expect(status).toBe('Overdue');
  });

  it('picks the latest postponement when multiple are approved', () => {
    const postponements: PITPostponement[] = [
      { workOrderId: 'wo-7', postponementNumber: 1, status: 'Approved', approvedDate: isoDate(2026, 2, 5), newDueDate: isoDate(2026, 3, 15) },
      { workOrderId: 'wo-7', postponementNumber: 2, status: 'Approved', approvedDate: isoDate(2026, 2, 20), newDueDate: isoDate(2026, 6, 1) },
    ];
    const febEnd = monthEnd(2026, 2);
    const active = findActivePostponementAt(postponements, febEnd);
    expect(active?.postponementNumber).toBe(2);
    expect(active?.newDueDate).toBe(isoDate(2026, 6, 1));
  });

  it('buckets a WO by its originalDueDate when available', () => {
    const wo: PITWorkOrder = {
      dueDate: isoDate(2026, 5, 1),
      originalDueDate: isoDate(2026, 2, 10),
    };
    const bucket = getWorkOrderBucketMonth(wo);
    expect(bucket).toEqual({ year: 2026, month: 1 }); // Feb (0-indexed)
  });

  it('falls back to dueDate when originalDueDate is missing', () => {
    const wo: PITWorkOrder = { dueDate: isoDate(2026, 4, 1) };
    const bucket = getWorkOrderBucketMonth(wo);
    expect(bucket).toEqual({ year: 2026, month: 3 });
  });
});
