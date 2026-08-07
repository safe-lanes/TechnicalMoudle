import { describe, it, expect } from 'vitest';
import {
  collectCompletionWouuidsFromLogs,
  collectCompletionWouuidsFromFullRows,
  filterAdvanceOnly,
} from '../shipCompletionLearner';

describe('collectCompletionWouuidsFromLogs', () => {
  it('collects ANY applied work_orders log (learner filters by persisted status) and dedupes', () => {
    const out = collectCompletionWouuidsFromLogs([
      { tableName: 'work_orders', rowUuid: 'a', fieldName: 'status', newValue: 'Completed' },
      { tableName: 'work_orders', rowUuid: 'a', fieldName: 'date_completed', newValue: '01-Aug-2026' }, // dedupe
      // completion fields arriving in a LATER batch than the status change must re-trigger:
      { tableName: 'work_orders', rowUuid: 'b', fieldName: 'wo_completion_rh', newValue: '12000' },
      { tableName: 'spares', rowUuid: 'd', fieldName: 'status', newValue: 'Completed' },
    ]);
    expect(out.sort()).toEqual(['a', 'b']);
  });
});

describe('collectCompletionWouuidsFromFullRows', () => {
  it('collects all work_orders rows with a uuid; other tables ignored', () => {
    const out = collectCompletionWouuidsFromFullRows('work_orders', [
      { wouuid: 'x', status: 'Completed' },
      { wouuid: 'y', status: 'Active' },
      { status: 'Completed' }, // no uuid
    ]);
    expect(out.sort()).toEqual(['x', 'y']);
    expect(collectCompletionWouuidsFromFullRows('spares', [{ wouuid: 'z', status: 'Completed' }])).toEqual([]);
  });
});

describe('filterAdvanceOnly (advance-only per leg)', () => {
  const calUpdates = { lastDoneDate: '01-Aug-2026', nextDueDate: '01-Nov-2026' };
  const rhUpdates = { lastDoneRH: 12000, nextDueRH: 12500 };

  it('applies calendar leg when local last done is older or unset', () => {
    expect(filterAdvanceOnly({ last_done_date: '01-Jul-2026' }, { ...calUpdates }, { ...calUpdates })).toBeTruthy();
    expect(filterAdvanceOnly({ last_done_date: null }, { ...calUpdates }, { ...calUpdates })).toBeTruthy();
  });

  it('re-applying the SAME completion is a no-op (idempotent)', () => {
    expect(filterAdvanceOnly({ last_done_date: '01-Aug-2026' }, { ...calUpdates }, { ...calUpdates })).toBeNull();
  });

  it('out-of-order OLDER completion never regresses tracking', () => {
    expect(filterAdvanceOnly({ last_done_date: '15-Aug-2026' }, { ...calUpdates }, { ...calUpdates })).toBeNull();
  });

  it('RH leg advances only on strictly higher RH', () => {
    expect(filterAdvanceOnly({ last_done_rh: '11000' }, { ...rhUpdates }, {})).toBeTruthy();
    expect(filterAdvanceOnly({ last_done_rh: '12000' }, { ...rhUpdates }, {})).toBeNull();
    expect(filterAdvanceOnly({ last_done_rh: '13000' }, { ...rhUpdates }, {})).toBeNull();
  });

  it('legs filter independently (batched/out-of-order per leg)', () => {
    const res = filterAdvanceOnly(
      { last_done_date: '15-Aug-2026', last_done_rh: '11000' }, // calendar ahead, RH behind
      { ...calUpdates, ...rhUpdates },
      { lastDoneDate: '01-Aug-2026', nextDueDate: '01-Nov-2026', lastDoneRH: '12000', nextDueRH: '12500' },
    );
    expect(res).toBeTruthy();
    expect(res!.jobUpdates.lastDoneDate).toBeUndefined();
    expect(res!.jobUpdates.nextDueDate).toBeUndefined();
    expect(res!.jobUpdates.lastDoneRH).toBe(12000);
    expect(res!.linkUpdates.lastDoneDate).toBeUndefined();
    expect(res!.linkUpdates.lastDoneRH).toBe('12000');
  });
});
