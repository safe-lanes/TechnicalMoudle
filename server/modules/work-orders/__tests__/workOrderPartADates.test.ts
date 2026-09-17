import { describe, expect, it } from 'vitest';
import {
  buildRunningHoursWorkOrderSnapshots,
  findAttemptedWorkOrderSnapshotFields,
  isImmutableWorkOrderSnapshotField,
  resolveWorkOrderPartADates,
  shouldApplySyncedWorkOrderSnapshot,
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
      lastCompletedRH: '',
      nextDueRH: '',
    });
  });

  it('keeps the displayed cycle due date unchanged after postponement', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Dual Frequency',
      dueDateSnapshot: '05-Dec-2026',
      dueDate: '20-Dec-2026',
    }).nextDueDate).toBe('2026-12-05');
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
      lastCompletedRH: '',
      nextDueRH: '',
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
      lastCompletedRH: '',
      nextDueRH: '',
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

  it('recognizes camelCase and database snapshot field names for sync protection', () => {
    expect(isImmutableWorkOrderSnapshotField('rhLastDoneSnapshot')).toBe(true);
    expect(isImmutableWorkOrderSnapshotField('rh_last_done_snapshot')).toBe(true);
    expect(isImmutableWorkOrderSnapshotField('date_completed')).toBe(false);
  });

  it('allows sync to fill an empty snapshot once but never overwrite it', () => {
    expect(shouldApplySyncedWorkOrderSnapshot(null, null)).toBe(true);
    expect(shouldApplySyncedWorkOrderSnapshot('', null)).toBe(true);
    expect(shouldApplySyncedWorkOrderSnapshot('9000', null)).toBe(false);
    expect(shouldApplySyncedWorkOrderSnapshot(null, '8500')).toBe(false);
  });

  it('uses only Work Order RH snapshots for existing RH Part A values', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Running Hours',
      lastDoneDateSnapshot: '15-Apr-2026',
      rhLastDoneSnapshot: '9000.00',
      dueRhSnapshot: '9500.00',
      cycleDueRhSnapshot: '9600',
      nextDueReading: '9700',
    })).toEqual({
      lastCompletedOn: '2026-04-15',
      nextDueDate: '',
      lastCompletedRH: '9000',
      nextDueRH: '9500',
    });
  });

  it('falls back through Work Order-owned RH due fields without inventing last done history', () => {
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Running Hours',
      dueRhSnapshot: null,
      cycleDueRhSnapshot: '9600.50',
      nextDueReading: '9700',
    })).toMatchObject({
      lastCompletedOn: '',
      lastCompletedRH: '',
      nextDueRH: '9600.5',
    });

    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Running Hours',
      cycleDueRhSnapshot: null,
      nextDueReading: '9700',
    }).nextDueRH).toBe('9700');
  });

  it('freezes a linked Job cycle for bulk-created RH Work Orders', () => {
    const mutableJob = {
      lastDoneDate: '01-Feb-2026',
      lastDoneRH: '800',
      nextDueRH: '1050',
    };
    const snapshots = buildRunningHoursWorkOrderSnapshots({
      lastDoneDate: mutableJob.lastDoneDate,
      lastDoneRH: mutableJob.lastDoneRH,
      dueRH: mutableJob.nextDueRH,
      currentRH: '900',
      intervalRunningHour: 250,
    });

    mutableJob.lastDoneDate = '15-Mar-2026';
    mutableJob.lastDoneRH = '1050';
    mutableJob.nextDueRH = '1300';

    expect(snapshots).toMatchObject({
      driverType: 'RH',
      lastDoneDateSnapshot: '01-Feb-2026',
      rhLastDoneSnapshot: '800',
      dueRhSnapshot: '1050',
      cycleDueRhSnapshot: '1050',
      nextDueReading: '1050',
      effectiveRhAtGeneration: '900',
    });
    expect(resolveWorkOrderPartADates({
      maintenanceBasis: 'Running Hours',
      ...snapshots,
    })).toEqual({
      lastCompletedOn: '2026-02-01',
      nextDueDate: '',
      lastCompletedRH: '800',
      nextDueRH: '1050',
    });
  });
});