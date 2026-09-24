import { describe, expect, it } from 'vitest';
import { refreshRhEstimatesSafely } from '../service';
import { collectCompletionWouuidsFromLogs, learnFromShipCompletions } from '../shipCompletionLearner';

describe('shore completion transaction boundary', () => {
  it('collects split completion logs and duplicate re-offers without depending on status changes', () => {
    expect(collectCompletionWouuidsFromLogs([
      { tableName: 'work_orders', rowUuid: 'wo-1', fieldName: 'date_completed', newValue: '01-Aug-2026' },
      { tableName: 'work_orders', rowUuid: 'wo-1', fieldName: 'status', newValue: 'Completed' },
      { tableName: 'work_orders', rowUuid: 'wo-2', fieldName: 'wo_completion_rh', newValue: '12000' },
      { tableName: 'jobs', rowUuid: 'job-1', fieldName: 'last_done_rh', newValue: '12000' },
    ])).toEqual(['wo-1', 'wo-2']);
  });

  it('keeps a completed Calendar WO, its Job and unrelated rows when audit discovery fails', async () => {
    const committed: string[] = ['work_orders:wo-1:Completed', 'spares:spare-1:updated'];
    let savepoint: string[] = [];
    const commands: string[] = [];
    const client = {
      async query(text: string, values?: unknown[]) {
        commands.push(text);
        if (text.startsWith('SAVEPOINT rh_refresh_batch')) savepoint = [...committed];
        if (text.startsWith('ROLLBACK TO SAVEPOINT rh_refresh_batch')) {
          committed.splice(0, committed.length, ...savepoint);
        }
        if (text.includes('FROM work_orders')) return { rows: [{
          wouuid: 'wo-1', work_order_no: 'WO-1', status: 'Completed',
          job_id: 'job-1', vessel_id: 'vessel-1', maintenance_basis: 'Calendar',
          date_completed: '01-Aug-2026',
        }] };
        if (text.includes('FROM jobs')) return { rows: [{
          juuid: 'job-1', job_no: 'JOB-1', vessel_id: 'vessel-1',
          frequency_value: '3', frequency_unit: 'Months',
          last_done_date: '01-Jul-2026', last_done_rh: null,
        }] };
        if (text.startsWith('UPDATE jobs')) {
          expect(values?.[0]).toBe('job-1');
          committed.push('jobs:job-1:advanced');
          return { rowCount: 1, rows: [] };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const learned = await learnFromShipCompletions(client as any, ['wo-1']);
    expect(learned.jobsAdvanced).toBe(1);
    const refreshed = await refreshRhEstimatesSafely(
      client as any, ['audit-1'], 'batch-1',
      async () => {
        committed.push('estimate:uncommitted');
        throw new Error('simulated audit discovery failure');
      },
    );
    expect(refreshed).toBe(0);
    expect(committed).toEqual([
      'work_orders:wo-1:Completed', 'spares:spare-1:updated', 'jobs:job-1:advanced',
    ]);
    expect(commands).toContain('ROLLBACK TO SAVEPOINT rh_refresh_batch');
    expect(commands).not.toContain('ROLLBACK');
  });
});