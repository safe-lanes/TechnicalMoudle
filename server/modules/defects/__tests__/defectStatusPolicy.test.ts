import { describe, expect, it } from 'vitest';
import { computeDefectStatus, isDefectOverdue, parseDefectDate } from '@shared/defectStatus';

// Sahil E1 / Q5 (28-Sep-2026): ONE defect status policy — overdue only against the extended date.
const now = new Date(2026, 8, 28, 10, 0, 0); // 28-Sep-2026 local

describe('computeDefectStatus', () => {
  it('extended defect before its NEW date is Extended, not Overdue', () => {
    expect(computeDefectStatus({ isDeferred: true, targetCloseDate: '2026-10-15' }, now)).toBe('Extended');
  });
  it('extended defect AFTER its new date is Overdue (was never overdue before 28-Sep)', () => {
    expect(computeDefectStatus({ isDeferred: true, targetCloseDate: '2026-09-20' }, now)).toBe('Overdue');
  });
  it('plain defect past target is Overdue; on the target day it is not', () => {
    expect(computeDefectStatus({ targetCloseDate: '2026-09-27' }, now)).toBe('Overdue');
    expect(computeDefectStatus({ targetCloseDate: '2026-09-28' }, now)).toBe('Reported');
  });
  it('completed defect is Closed even past target; verified wins over everything', () => {
    expect(computeDefectStatus({ targetCloseDate: '2026-09-01', dateCompleted: '2026-09-10' }, now)).toBe('Closed');
    expect(computeDefectStatus({ targetCloseDate: '2026-09-01', verified: true }, now)).toBe('Verified');
  });
  it('actions without other state → In Progress', () => {
    expect(computeDefectStatus({ targetCloseDate: '2026-12-01', actions: [{ id: 1 }] }, now)).toBe('In Progress');
  });
  it('isDefectOverdue mirrors the policy', () => {
    expect(isDefectOverdue({ targetCloseDate: '2026-09-27' }, now)).toBe(true);
    expect(isDefectOverdue({ targetCloseDate: '2026-09-27', dateCompleted: '2026-09-27' }, now)).toBe(false);
  });
});

describe('parseDefectDate', () => {
  it('reads YYYY-MM-DD as that day (the old report reversed it into the wrong month)', () => {
    const d = parseDefectDate('2026-09-10')!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 10]);
  });
  it('reads DD-MM-YYYY', () => {
    const d = parseDefectDate('10-09-2026')!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 10]);
  });
  it('invalid → null', () => {
    expect(parseDefectDate('not a date')).toBeNull();
    expect(parseDefectDate(null)).toBeNull();
  });
});
