import { describe, expect, it } from 'vitest';
import {
  ensureCompletedWorkOrderDate,
  isCompletedWorkOrderStatus,
  isValidCompletedWorkOrderDate,
} from '../utils/completedWorkOrderDate';

describe('Completed Work Order date guarantee', () => {
  it('does not alter non-completed updates', () => {
    const update = { status: 'Pending Approval', dateCompleted: undefined };
    expect(ensureCompletedWorkOrderDate({ completionDateTime: '2026-09-10T12:30:00.000Z' }, update))
      .toBe(update);
    expect(update.dateCompleted).toBeUndefined();
  });

  it.each(['Completed', 'completed', ' COMPLETED '])(
    'recognizes %s as the Completed state',
    (status) => {
      expect(isCompletedWorkOrderStatus(status)).toBe(true);
      expect(() => ensureCompletedWorkOrderDate(
        { dateCompleted: null, completionDateTime: null },
        { status },
      )).toThrow('completion date is required');
    },
  );

  it.each(['Closed', 'Approved', 'Cancelled', 'Canceled', 'Pending Approval'])(
    'does not broaden the Completed-only invariant to %s',
    (status) => {
      expect(isCompletedWorkOrderStatus(status)).toBe(false);
    },
  );

  it('preserves the completion date already selected by the caller', () => {
    const update = { status: 'Completed', dateCompleted: '2026-09-11T04:00:00.000Z' };
    ensureCompletedWorkOrderDate(
      { dateCompleted: '2026-09-10', completionDateTime: '2026-09-09T10:00:00.000Z' },
      update,
    );
    expect(update.dateCompleted).toBe('2026-09-11T04:00:00.000Z');
  });

  it('retains an existing valid final date when a partial update omits it', () => {
    const update: Record<string, any> = { status: 'Completed' };
    ensureCompletedWorkOrderDate({ dateCompleted: '2026-09-10' }, update);
    expect(update.dateCompleted).toBe('2026-09-10');
  });

  it('protects an existing valid final date from a null overwrite', () => {
    const update: Record<string, any> = { status: 'Completed', dateCompleted: null };
    ensureCompletedWorkOrderDate({ dateCompleted: '10-09-2026' }, update);
    expect(update.dateCompleted).toBe('10-09-2026');
  });

  it('falls back to the persisted execution timestamp only when final date is absent', () => {
    const update: Record<string, any> = { status: 'Completed' };
    ensureCompletedWorkOrderDate(
      { dateCompleted: null, completionDateTime: '2026-09-10T12:30:00.000Z' },
      update,
    );
    expect(update.dateCompleted).toBe('2026-09-10T12:30:00.000Z');
  });

  it('rejects a Completed transition with no usable completion date', () => {
    expect(() => ensureCompletedWorkOrderDate(
      { dateCompleted: null, completionDateTime: null },
      { status: 'Completed' },
    )).toThrow('A completion date is required');
  });

  it('rejects an invalid outgoing final date', () => {
    expect(() => ensureCompletedWorkOrderDate(
      { completionDateTime: '2026-09-10T12:30:00.000Z' },
      { status: 'Completed', dateCompleted: '2026-02-30' },
    )).toThrow('valid completion date');
  });

  it.each([
    '31-Apr-2026',
    '31 April 2026',
    'Sep 31 2026',
    'February 30 2026',
    '10 September 2026 99:99',
    '10-09-2026T99:99',
    '10/09/2026 nonsense',
  ])('rejects impossible named-month date %s', (value) => {
    expect(isValidCompletedWorkOrderDate(value)).toBe(false);
  });

  it.each([
    '2026-09-10',
    '2026-09-10T12:30:00.000Z',
    '10-09-2026',
    '10/09/2026',
    '10-Sep-2026',
    '10 September 2026',
    'Sep 10 2026',
  ])('accepts existing completion date format %s', (value) => {
    expect(isValidCompletedWorkOrderDate(value)).toBe(true);
  });
});