import { describe, it, expect } from 'vitest';
import {
  collectCompletionWouuidsFromLogs,
  collectCompletionWouuidsFromFullRows,
  filterAdvanceOnly,
  learnFromShipCompletions,
  refreshRhEstimatesFromAuditRows,
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
    expect(filterAdvanceOnly({ last_done_date: '01-Jul-2026' }, { ...calUpdates })).toBeTruthy();
    expect(filterAdvanceOnly({ last_done_date: null }, { ...calUpdates })).toBeTruthy();
  });

  it('re-applying the same completion is a no-op', () => {
    expect(filterAdvanceOnly({ last_done_date: '01-Aug-2026' }, { ...calUpdates })).toBeNull();
  });

  it('does not regress tracking from an out-of-order older completion', () => {
    expect(filterAdvanceOnly({ last_done_date: '15-Aug-2026' }, { ...calUpdates })).toBeNull();
  });

  it('RH leg advances only on strictly higher RH', () => {
    expect(filterAdvanceOnly({ last_done_rh: '11000' }, { ...rhUpdates })).toBeTruthy();
    expect(filterAdvanceOnly({ last_done_rh: '12000' }, { ...rhUpdates })).toBeNull();
    expect(filterAdvanceOnly({ last_done_rh: '13000' }, { ...rhUpdates })).toBeNull();
  });

  it('does not let an older RH completion overwrite its historical estimate', () => {
    const res = filterAdvanceOnly(
      { last_done_rh: '13000' },
      {
        ...rhUpdates,
        rhEstimatedDueDate: '15-Nov-2026',
        rhAveragePerDay: 3.69,
        rhEstimateBasis: 'HISTORICAL',
      },
    );
    expect(res).toBeNull();
  });

  it('rejects estimate-only updates without an advancing RH leg', () => {
    expect(filterAdvanceOnly(
      { last_done_rh: '13000' },
      {
        rhEstimatedDueDate: '15-Nov-2026',
        rhAveragePerDay: 3.69,
        rhEstimateBasis: 'HISTORICAL',
      },
    )).toBeNull();
  });

  it('filters calendar and RH legs independently', () => {
    const res = filterAdvanceOnly(
      { last_done_date: '15-Aug-2026', last_done_rh: '11000' },
      { ...calUpdates, ...rhUpdates },
    );
    expect(res).toBeTruthy();
    expect(res!.lastDoneDate).toBeUndefined();
    expect(res!.nextDueDate).toBeUndefined();
    expect(res!.lastDoneRH).toBe(12000);
  });
});

describe('learnFromShipCompletions', () => {
  function makeClient(options?: { failJobId?: string }) {
    const queries: Array<{ text: string; values?: any[] }> = [];
    const workOrders: Record<string, Record<string, any>> = {
      'wo-1': {
        wouuid: 'wo-1',
        status: 'Completed',
        job_id: 'job-1',
        vessel_id: 'vessel-1',
        maintenance_basis: 'Dual Frequency',
        date_completed: '01-Aug-2026',
        wo_completion_rh: '12000',
        completion_rh: '11000',
        current_reading: '10000',
        next_due_date: '01-Aug-2026',
        due_date: null,
        work_order_no: 'WO-1',
      },
      'wo-2': {
        wouuid: 'wo-2',
        status: 'Completed',
        job_id: 'job-2',
        vessel_id: 'vessel-1',
        maintenance_basis: 'Calendar',
        date_completed: '02-Aug-2026',
        wo_completion_rh: null,
        completion_rh: null,
        current_reading: null,
        next_due_date: '02-Aug-2026',
        due_date: null,
        work_order_no: 'WO-2',
      },
      'wo-rh': {
        wouuid: 'wo-rh',
        status: 'Completed',
        job_id: 'job-rh',
        vessel_id: 'vessel-1',
        maintenance_basis: 'Running Hours',
        date_completed: '04-Aug-2026',
        wo_completion_rh: '14000',
        completion_rh: '13000',
        current_reading: '12000',
        next_due_date: null,
        due_date: null,
        work_order_no: 'WO-RH',
      },
      'wo-no-job': {
        wouuid: 'wo-no-job',
        status: 'Completed',
        job_id: null,
        vessel_id: 'vessel-1',
        maintenance_basis: 'Calendar',
        date_completed: '03-Aug-2026',
        work_order_no: 'WO-NO-JOB',
      },
      'wo-wrong-vessel': {
        wouuid: 'wo-wrong-vessel',
        status: 'Completed',
        job_id: 'job-1',
        vessel_id: 'vessel-2',
        maintenance_basis: 'Calendar',
        date_completed: '03-Aug-2026',
        work_order_no: 'WO-WRONG-VESSEL',
      },
    };
    const jobs: Record<string, Record<string, any>> = {
      'job-1': {
        juuid: 'job-1',
        job_no: 'JOB-1',
        vessel_id: 'vessel-1',
        frequency_value: '3',
        frequency_unit: 'Months',
        interval_running_hour: 500,
        component_id: 'component-1',
        last_done_date: '01-Jul-2026',
        last_done_rh: '11000',
      },
      'job-2': {
        juuid: 'job-2',
        job_no: 'JOB-2',
        vessel_id: 'vessel-1',
        frequency_value: '3',
        frequency_unit: 'Months',
        interval_running_hour: null,
        last_done_date: '01-Jul-2026',
        last_done_rh: null,
      },
      'job-rh': {
        juuid: 'job-rh',
        job_no: 'JOB-RH',
        vessel_id: 'vessel-1',
        frequency_value: null,
        frequency_unit: null,
        interval_running_hour: 500,
        component_id: 'component-1',
        last_done_date: '01-Jul-2026',
        last_done_rh: '13500',
      },
    };

    const client = {
      async query(text: string, values?: any[]) {
        queries.push({ text, values });
        if (text.includes('FROM work_orders')) {
          const row = workOrders[String(values?.[0])];
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (text.includes('FROM jobs')) {
          const row = jobs[String(values?.[0])];
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (text.includes('FROM components')) {
          return {
            rows: [{
              cuuid: 'component-1',
              id: '1',
              vessel_id: 'vessel-1',
              rh_counter_type: 'MASTER',
              rh_master_component_id: null,
              rh_counter_source: null,
            }],
            rowCount: 1,
          };
        }
        if (text.includes('FROM running_hours_audit')) {
          return {
            rows: [
              {
                cumulative_rh: '1000',
                date_updated_local: '01-Aug-2026',
                entered_at_utc: '2026-08-01T00:00:00Z',
                is_deleted: false,
              },
              {
                cumulative_rh: '100',
                date_updated_local: '01-May-2026',
                entered_at_utc: '2026-05-01T00:00:00Z',
                is_deleted: false,
              },
            ],
            rowCount: 2,
          };
        }
        if (text.startsWith('UPDATE jobs')) {
          if (values?.[0] === options?.failJobId) throw new Error('simulated Job write failure');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    return { client: client as any, queries };
  }

  it('keeps trigger bypass active and writes cycle tracking plus the persisted RH estimate', async () => {
    const { client, queries } = makeClient();
    const result = await learnFromShipCompletions(client, ['wo-1']);

    expect(result).toEqual({ candidates: 1, jobsAdvanced: 1, skipped: 0, errors: 0 });
    expect(queries[0].text).toContain(`SET LOCAL sync.bypass_trigger = 'true'`);

    const update = queries.find((q) => q.text.startsWith('UPDATE jobs'));
    expect(update).toBeTruthy();
    expect(update!.text).toContain('"last_done_date"');
    expect(update!.text).toContain('"next_due_date"');
    expect(update!.text).toContain('"last_done_rh"');
    expect(update!.text).toContain('"next_due_rh"');
    expect(update!.text).toContain('"rh_estimated_due_date"');
    expect(update!.text).toContain('"rh_average_per_day"');
    expect(update!.text).toContain('"rh_estimate_basis"');
    expect(update!.text).toContain('updated_at = NOW()');
    expect(update!.text).not.toContain('tracking_rebaselined_at');
    expect(update!.text).not.toContain('job_component_links');
    expect(update!.values).toContain('12000');
    expect(update!.values).toContain('12500');
    expect(queries.some((q) => q.text.includes('job_component_links'))).toBe(false);
  });

  it('skips a completed Work Order without job_id instead of guessing a Job', async () => {
    const { client, queries } = makeClient();
    const result = await learnFromShipCompletions(client, ['wo-no-job']);

    expect(result).toEqual({ candidates: 1, jobsAdvanced: 0, skipped: 1, errors: 0 });
    expect(queries.some((q) => q.text.includes('FROM jobs'))).toBe(false);
    expect(queries.some((q) => q.text.startsWith('UPDATE jobs'))).toBe(false);
  });

  it('learns RH completion date and RH from the same persisted Work Order', async () => {
    const { client, queries } = makeClient();
    const result = await learnFromShipCompletions(client, ['wo-rh']);

    expect(result).toEqual({ candidates: 1, jobsAdvanced: 1, skipped: 0, errors: 0 });
    const update = queries.find((q) => q.text.startsWith('UPDATE jobs'));
    expect(update).toBeTruthy();
    expect(update!.text).toContain('"last_done_date"');
    expect(update!.text).toContain('"last_done_rh"');
    expect(update!.text).toContain('"next_due_rh"');
    expect(update!.values).toContain('2026-08-04');
    expect(update!.values).toContain('14000');
    expect(update!.values).toContain('14500');
  });

  it('rolls back only the failed Work Order savepoint and continues the batch', async () => {
    const { client, queries } = makeClient({ failJobId: 'job-1' });
    const result = await learnFromShipCompletions(client, ['wo-1', 'wo-2']);

    expect(result).toEqual({ candidates: 2, jobsAdvanced: 1, skipped: 0, errors: 1 });
    expect(queries.some((q) => q.text.includes('ROLLBACK TO SAVEPOINT learn_wo_0'))).toBe(true);
    expect(queries.some((q) => q.text.includes('RELEASE SAVEPOINT learn_wo_0'))).toBe(true);
    expect(queries.some((q) => q.text.includes('SAVEPOINT learn_wo_1'))).toBe(true);
    expect(queries.filter((q) => q.text.startsWith('UPDATE jobs'))).toHaveLength(2);
  });

  it('does not update a Job from another vessel', async () => {
    const { client, queries } = makeClient();
    const result = await learnFromShipCompletions(client, ['wo-wrong-vessel']);

    expect(result).toEqual({ candidates: 1, jobsAdvanced: 0, skipped: 1, errors: 0 });
    expect(queries.some((q) => q.text.startsWith('UPDATE jobs'))).toBe(false);
  });
});

describe('refreshRhEstimatesFromAuditRows', () => {
  it('converges an insufficient estimate when RH history arrives in a later push', async () => {
    const queries: Array<{ text: string; values?: any[] }> = [];
    const client = {
      async query(text: string, values?: any[]) {
        queries.push({ text, values });
        if (text.includes('FROM running_hours_audit a')) {
          return {
            rows: [{
              component_id: 'master-1',
              component_cuuid: 'master-1',
              component_legacy_id: '1',
              component_code: '601.01',
            }],
            rowCount: 1,
          };
        }
        if (text.includes('SELECT DISTINCT') && text.includes('FROM jobs j')) {
          return {
            rows: [{
              juuid: 'job-rh',
              vessel_id: 'vessel-1',
              component_id: 'master-1',
              maintenance_basis: 'Running Hours',
              interval_running_hour: 200,
              last_done_date: '22-Sep-2026',
              last_done_rh: '1000',
              next_due_rh: '1200',
              component_cuuid: 'master-1',
              component_legacy_id: '1',
              component_vessel_id: 'vessel-1',
              rh_counter_type: 'MASTER',
              rh_master_component_id: null,
              rh_counter_source: null,
            }],
            rowCount: 1,
          };
        }
        if (text.includes('FROM running_hours_audit')) {
          return {
            rows: [
              { cumulative_rh: '1000', date_updated_local: '22-Sep-2026', entered_at_utc: '2026-09-22T00:00:00Z', is_deleted: false },
              { cumulative_rh: '100', date_updated_local: '21-Jan-2026', entered_at_utc: '2026-01-21T00:00:00Z', is_deleted: false },
            ],
            rowCount: 2,
          };
        }
        if (text.startsWith('UPDATE jobs')) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
    };

    expect(await refreshRhEstimatesFromAuditRows(client as any, ['audit-1', 'audit-2'])).toBe(1);
    const update = queries.find(query => query.text.startsWith('UPDATE jobs'));
    const candidateQuery = queries.find(query => query.text.includes('FROM jobs j'));
    expect(candidateQuery?.text).toContain('c.id::text = j.component_id');
    expect(candidateQuery?.text).toContain('c.rh_master_component_id = ANY($1::text[])');
    expect(update?.values).toEqual([
      'job-rh',
      '2026-11-15',
      expect.closeTo(900 / 244, 8),
      'HISTORICAL',
      '22-Sep-2026',
      '1000',
      '1200',
    ]);
  });
});
