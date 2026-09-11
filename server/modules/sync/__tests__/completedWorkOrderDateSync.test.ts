import { describe, expect, it, vi } from 'vitest';
import {
  COMPLETED_DATE_SYNC_ERROR,
  ensureDateBeforeSyncedCompletedStatus,
} from '../completedWorkOrderDateSync';

const completedLog = {
  tableName: 'work_orders',
  rowUuid: 'wo-1',
  fieldName: 'status',
  newValue: 'Completed',
};

describe('synced Completed Work Order date guarantee', () => {
  it('leaves a row with a valid final date unchanged', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ date_completed: '2026-09-10', completion_date_time: null }],
    });
    await ensureDateBeforeSyncedCompletedStatus({ query }, completedLog);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('promotes the stored execution timestamp before applying Completed status', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ date_completed: null, completion_date_time: '2026-09-10T12:30:00.000Z' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    await ensureDateBeforeSyncedCompletedStatus({ query }, completedLog);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET date_completed = $1'),
      ['2026-09-10T12:30:00.000Z', 'wo-1'],
    );
  });

  it('uses a companion completion date from the same sync batch', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ date_completed: null, completion_date_time: null }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    await ensureDateBeforeSyncedCompletedStatus({ query }, completedLog, '2026-09-11');
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET date_completed = $1'),
      ['2026-09-11', 'wo-1'],
    );
  });

  it('rejects a synced Completed status with no usable date', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ date_completed: null, completion_date_time: null }],
    });
    await expect(ensureDateBeforeSyncedCompletedStatus({ query }, completedLog))
      .rejects.toMatchObject({ code: COMPLETED_DATE_SYNC_ERROR });
  });

  it('ignores unrelated field logs', async () => {
    const query = vi.fn();
    await ensureDateBeforeSyncedCompletedStatus(
      { query },
      { ...completedLog, fieldName: 'remarks', newValue: 'Completed' },
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('also protects a lowercase completed sync status', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ date_completed: null, completion_date_time: null }],
    });
    await expect(ensureDateBeforeSyncedCompletedStatus(
      { query },
      { ...completedLog, newValue: ' completed ' },
    )).rejects.toMatchObject({ code: COMPLETED_DATE_SYNC_ERROR });
  });
});