import { describe, expect, it } from 'vitest';
import {
  findAttemptedWorkOrderSnapshotFields,
  resolveWorkOrderPartADates,
} from '../utils/workOrderPartADates';

describe('Work Order Part A snapshot dates', () => {
  it('uses immutable snapshots ahead of mutable Work Order dates', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Calendar',
      lastDoneDateSnapshot: '01-Jan-2026',
      dueDateSnapshot: '01-Jul-2026',
      dueDate: '15-Jul-2026',
      nextDueDate: '01-Jan-2027',
    })).toEqual({
      lastCompletedOn: '2026-01-01',
      nextDueDate: '2026-07-01',
    });
  });

  it('uses dueDate before nextDueDate for legacy rows without a due snapshot', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Calendar',
      dueDateSnapshot: null,
      dueDate: '15-Jul-2026',
      nextDueDate: '01-Jan-2027',
    }).nextDueDate).toBe('2026-07-15');
  });

  it('uses nextDueDate only when both snapshot and dueDate are absent', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Calendar',
      dueDateSnapshot: ' ',
      dueDate: null,
      nextDueDate: '01-Jan-2027',
    }).nextDueDate).toBe('2027-01-01');
  });

  it('leaves Last Completed On blank when its snapshot is absent', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Calendar',
      lastDoneDateSnapshot: null,
      dueDate: '15-Jul-2026',
    }).lastCompletedOn).toBe('');
  });

  it('does not expose calendar dates for Running Hours-only work orders', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Running Hours',
      lastDoneDateSnapshot: '01-Jan-2026',
      dueDateSnapshot: '01-Jul-2026',
      dueDate: '15-Jul-2026',
      nextDueDate: '01-Jan-2027',
    })).toEqual({
      lastCompletedOn: '2026-01-01',
      nextDueDate: '',
    });
  });

  it('keeps calendar snapshots available for Dual Frequency work orders', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Dual Frequency',
      lastDoneDateSnapshot: '01-Jan-2026',
      dueDateSnapshot: '01-Jul-2026',
    })).toEqual({
      lastCompletedOn: '2026-01-01',
      nextDueDate: '2026-07-01',
    });
  });

  it.each([
    ['2026-07-15', '2026-07-15'],
    ['2026-07-15T12:30:00.000Z', '2026-07-15'],
    ['15-07-2026', '2026-07-15'],
    ['15/07/2026', '2026-07-15'],
    ['15-Jul-2026', '2026-07-15'],
  ])('normalizes %s for an HTML date input', (storedDate, expected) => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Calendar',
      dueDateSnapshot: storedDate,
    }).nextDueDate).toBe(expected);
  });

  it('detects attempts to overwrite immutable generation snapshots', () => {
    expect(findAttemptedWorkOrderSnapshotFields({
      dueDate: '2026-08-01',
      dueDateSnapshot: '2026-07-01',
      lastDoneDateSnapshot: '2026-01-01',
      rhLastDoneSnapshot: '9000',
      remarks: 'ordinary editable value',
    })).toEqual([
      'dueDateSnapshot',
      'lastDoneDateSnapshot',
      'rhLastDoneSnapshot',
    ]);
  });

  it('allows mutable operational fields through the snapshot guard', () => {
    expect(findAttemptedWorkOrderSnapshotFields({
      dueDate: '2026-08-01',
      nextDueDate: '2027-01-01',
      dateCompleted: '2026-07-15',
      status: 'Pending Approval',
    })).toEqual([]);
  });
});