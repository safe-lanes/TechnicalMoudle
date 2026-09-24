import { describe, expect, it } from 'vitest';
import { refreshRhEstimatesSafely } from '../service';
import {
  collectCompletionWouuidsFromLogs,
  learnFromShipCompletions,
  refreshRhEstimatesFromAuditRows,
} from '../shipCompletionLearner';

type EstimateFailure = 'component' | 'auditLookup' | 'estimateWrite' | 'auditDiscovery' | 'auditRefresh';
type Row = Record<string, any>;
type ShoreState = { workOrder: Row; job: Row; unrelatedLog: string | null };

/**
 * A small transactional shore store: queries mutate rows, SQL errors poison the
 * transaction until ROLLBACK TO SAVEPOINT, and COMMIT publishes the result.
 * Unlike a query-spy, this checks the rows actually left after both saves.
 */
class ShoreTransaction {
  committed: ShoreState;
  private pending: ShoreState | null = null;
  private savepoints: Array<{ name: string; state: ShoreState }> = [];
  private aborted = false;
  readonly commands: string[] = [];
  readonly failures: Set<EstimateFailure>;

  constructor(basis: 'Running Hours' | 'Dual Frequency' | 'Calendar', failures: EstimateFailure[] = []) {
    this.failures = new Set(failures);
    this.committed = {
      workOrder: {
        wouuid: 'wo-1', work_order_no: 'WO-1', status: 'Pending',
        job_id: 'job-1', vessel_id: 'vessel-1', maintenance_basis: basis,
        date_completed: null, wo_completion_rh: null, component_id: 'component-1',
        next_due_date: '01-Aug-2026',
      },
      job: {
        juuid: 'job-1', job_no: 'JOB-1', vessel_id: 'vessel-1',
        component_id: 'component-1', component_code: '601.01',
        frequency_value: '3', frequency_unit: 'Months',
        interval_running_hour: 500, maintenance_basis: basis,
        last_done_date: '01-Jul-2026', next_due_date: '01-Oct-2026',
        last_done_rh: '11000', next_due_rh: '11500',
        rh_estimated_due_date: '01-Sep-2026', rh_average_per_day: '12',
        rh_estimate_basis: 'PRIOR_CYCLE',
      },
      unrelatedLog: null,
    };
  }

  private get state(): ShoreState {
    if (!this.pending) throw new Error('Query outside the simulated push transaction');
    return this.pending;
  }

  private fail(message: string): never {
    this.aborted = true;
    throw new Error(message);
  }

  async query(text: string, values: any[] = []): Promise<{ rows: Row[]; rowCount: number }> {
    this.commands.push(text);
    const ok = (rows: Row[] = [], rowCount = rows.length) => ({ rows, rowCount });
    if (text === 'BEGIN') {
      this.pending = structuredClone(this.committed);
      this.savepoints = [];
      this.aborted = false;
      return ok();
    }
    if (text.startsWith('ROLLBACK TO SAVEPOINT ')) {
      const name = text.substring('ROLLBACK TO SAVEPOINT '.length);
      const index = this.savepoints.findLastIndex(sp => sp.name === name);
      if (index < 0) throw new Error(`Unknown savepoint ${name}`);
      this.pending = structuredClone(this.savepoints[index].state);
      this.savepoints.length = index + 1;
      this.aborted = false;
      return ok();
    }
    if (text === 'ROLLBACK') {
      this.pending = null;
      this.aborted = false;
      this.savepoints = [];
      return ok();
    }
    if (this.aborted) throw new Error('current transaction is aborted');
    if (text.startsWith('SAVEPOINT ')) {
      this.savepoints.push({ name: text.substring('SAVEPOINT '.length), state: structuredClone(this.state) });
      return ok();
    }
    if (text.startsWith('RELEASE SAVEPOINT ')) {
      const name = text.substring('RELEASE SAVEPOINT '.length);
      if (this.savepoints.at(-1)?.name !== name) throw new Error(`Savepoint order mismatch: ${name}`);
      this.savepoints.pop();
      return ok();
    }
    if (text === 'COMMIT') {
      if (this.savepoints.length) throw new Error('Unreleased savepoints at commit');
      this.committed = structuredClone(this.state);
      this.pending = null;
      return ok();
    }
    if (text.startsWith('SET LOCAL ')) return ok();

    // These two writes stand in for accepted WO and unrelated field-log applies
    // within receivePushData's already-open transaction.
    if (text.startsWith('UPDATE work_orders SET')) {
      Object.assign(this.state.workOrder, { status: values[1], date_completed: values[2], wo_completion_rh: values[3] });
      return ok([], 1);
    }
    if (text.startsWith('UPDATE spares SET')) {
      this.state.unrelatedLog = String(values[1]);
      return ok([], 1);
    }
    if (text.includes('FROM work_orders')) {
      return ok(this.state.workOrder.wouuid === values[0] ? [structuredClone(this.state.workOrder)] : []);
    }
    if (text.includes('FROM running_hours_audit a')) {
      if (this.failures.has('auditDiscovery')) return this.fail('audit discovery unavailable');
      return ok([{ component_id: 'component-1', component_cuuid: 'component-1', component_code: '601.01' }]);
    }
    if (text.includes('FROM jobs j')) {
      const job = this.state.job;
      return ok([{
        ...structuredClone(job), component_cuuid: 'component-1', component_legacy_id: '1',
        component_vessel_id: job.vessel_id, rh_counter_type: 'MASTER',
      }]);
    }
    if (text.includes('FROM jobs') && text.includes('FOR UPDATE')) {
      if (text.includes('WHERE juuid = $1') && this.state.job.juuid === values[0])
        return ok([structuredClone(this.state.job)]);
      return ok();
    }
    if (text.includes('FROM components')) {
      if (this.failures.has('component')) return this.fail('component resolution unavailable');
      return ok([{
        cuuid: 'component-1', id: '1', vessel_id: 'vessel-1',
        rh_counter_type: 'MASTER', rh_master_component_id: null, rh_counter_source: null,
      }]);
    }
    if (text.includes('FROM running_hours_audit')) {
      if (this.failures.has('auditLookup') || this.failures.has('auditRefresh'))
        return this.fail('RH audit history unavailable');
      return ok([]);
    }
    if (text.startsWith('UPDATE jobs SET ')) {
      if (this.state.job.juuid !== values[0]) return ok([], 0);
      if (text.includes('SET rh_estimated_due_date') && this.failures.has('estimateWrite'))
        return this.fail('estimate write unavailable');
      const setClause = text.slice(text.indexOf('SET ') + 4, text.indexOf('WHERE'));
      const assignments = Array.from(setClause.matchAll(/"?([a-z_]+)"?\s*=\s*\$(\d+)/g));
      for (const [, column, parameter] of assignments) {
        this.state.job[column] = values[Number(parameter) - 1];
      }
      return ok([], 1);
    }
    throw new Error(`Unexpected query: ${text}`);
  }
}

describe('shore completion transaction boundary', () => {
  async function applyCompletedPush(client: ShoreTransaction) {
    await client.query('BEGIN');
    await client.query('UPDATE work_orders SET status = $2, date_completed = $3, wo_completion_rh = $4 WHERE wouuid = $1',
      ['wo-1', 'Completed', '01-Aug-2026', '12000']);
    await client.query('UPDATE spares SET quantity = $2 WHERE suuid = $1', ['spare-1', '9']);
    return learnFromShipCompletions(client as any, ['wo-1']);
  }

  it.each([
    ['Running Hours', 'component'],
    ['Running Hours', 'auditLookup'],
    ['Running Hours', 'estimateWrite'],
    ['Dual Frequency', 'component'],
    ['Dual Frequency', 'auditLookup'],
    ['Dual Frequency', 'estimateWrite'],
  ] as const)(
    'intentionally commits the completed %s Job cycle with a blank estimate after %s failure',
    async (basis, failure) => {
      const client = new ShoreTransaction(basis, [failure]);
      const result = await applyCompletedPush(client);
      expect(result).toMatchObject({ jobsAdvanced: 1, errors: 0, errorWouuids: [] });
      await client.query('COMMIT');

      const { workOrder, job, unrelatedLog } = client.committed;
      expect(workOrder).toMatchObject({
        status: 'Completed', job_id: 'job-1', date_completed: '01-Aug-2026', wo_completion_rh: '12000',
      });
      expect(job).toMatchObject({
        juuid: 'job-1', last_done_date: '2026-08-01',
        last_done_rh: '12000', next_due_rh: '12500',
        rh_estimated_due_date: null, rh_average_per_day: null,
      });
      expect(job.rh_estimate_basis).not.toBe('PRIOR_CYCLE');
      expect(job.next_due_date).toBe(basis === 'Dual Frequency' ? '01-Nov-2026' : '01-Oct-2026');
      expect(unrelatedLog).toBe('9');
      expect(client.commands).toContain('ROLLBACK TO SAVEPOINT learn_estimate_0');
      expect(client.commands).not.toContain('ROLLBACK TO SAVEPOINT learn_wo_0');
      expect(client.commands).not.toContain('ROLLBACK');
      expect(client.commands.at(-1)).toBe('COMMIT');
    },
  );

  it.each(['auditDiscovery', 'auditRefresh'] as const)(
    'commits the completed Job, WO and unrelated field log when %s fails just before COMMIT',
    async failure => {
      const client = new ShoreTransaction('Dual Frequency');
      const result = await applyCompletedPush(client);
      expect(result).toMatchObject({ jobsAdvanced: 1, errors: 0, errorWouuids: [] });
      // The actual push service calls this with the SAME client immediately
      // before COMMIT. A failed audit row is optional, not a core sync failure.
      client.failures.add(failure);
      const refreshed = await refreshRhEstimatesSafely(
        client as any, ['audit-1'], 'batch-1', refreshRhEstimatesFromAuditRows,
      );
      expect(refreshed).toBe(0);
      await client.query('COMMIT');

      expect(client.committed.workOrder.status).toBe('Completed');
      expect(client.committed.job).toMatchObject({
        last_done_date: '2026-08-01', last_done_rh: '12000',
        next_due_date: '01-Nov-2026', next_due_rh: '12500',
        rh_estimated_due_date: null, rh_average_per_day: null,
      });
      expect(client.committed.unrelatedLog).toBe('9');
      expect(client.commands).not.toContain('ROLLBACK');
      expect(client.commands.at(-1)).toBe('COMMIT');
      expect(client.commands).toContain(
        failure === 'auditDiscovery'
          ? 'ROLLBACK TO SAVEPOINT rh_refresh_batch'
          : 'ROLLBACK TO SAVEPOINT rh_refresh_0',
      );
    },
  );

  it('keeps Calendar completion independent of RH estimation', async () => {
    const client = new ShoreTransaction('Calendar', ['component', 'auditLookup']);
    const result = await applyCompletedPush(client);
    expect(result).toMatchObject({ jobsAdvanced: 1, errors: 0 });
    await client.query('COMMIT');
    expect(client.committed.workOrder.status).toBe('Completed');
    expect(client.committed.job).toMatchObject({
      last_done_date: '2026-08-01', next_due_date: '01-Nov-2026',
      last_done_rh: '11000', next_due_rh: '11500',
    });
    expect(client.commands.some(text => text.includes('FROM components'))).toBe(false);
    expect(client.commands.some(text => text.includes('FROM running_hours_audit'))).toBe(false);
  });

  it('does not guess another Job when the exact link is missing or belongs to another vessel', async () => {
    for (const invalidLink of ['missing', 'other-vessel']) {
      const client = new ShoreTransaction('Dual Frequency');
      if (invalidLink === 'missing') client.committed.workOrder.job_id = 'nonexistent-job';
      else client.committed.job.vessel_id = 'another-vessel';
      const before = structuredClone(client.committed.job);
      const result = await applyCompletedPush(client);
      expect(result).toMatchObject({ jobsAdvanced: 0, skipped: 1, errors: 0 });
      await client.query('COMMIT');
      expect(client.committed.workOrder.status).toBe('Completed');
      expect(client.committed.job).toEqual(before);
      expect(client.committed.unrelatedLog).toBe('9');
    }
  });

  it('leaves an already-advanced Job unchanged on duplicate and older completion replays', async () => {
    const client = new ShoreTransaction('Dual Frequency', ['component']);
    await applyCompletedPush(client);
    await client.query('COMMIT');
    const advanced = structuredClone(client.committed.job);

    await client.query('BEGIN');
    const replay = await learnFromShipCompletions(client as any, ['wo-1']);
    expect(replay).toMatchObject({ jobsAdvanced: 0, skipped: 1 });
    await client.query('COMMIT');
    expect(client.committed.job).toEqual(advanced);

    await client.query('BEGIN');
    await client.query('UPDATE work_orders SET status = $2, date_completed = $3, wo_completion_rh = $4 WHERE wouuid = $1',
      ['wo-1', 'Completed', '01-Jul-2026', '11000']);
    const older = await learnFromShipCompletions(client as any, ['wo-1']);
    expect(older).toMatchObject({ jobsAdvanced: 0, skipped: 1 });
    await client.query('COMMIT');
    expect(client.committed.job).toEqual(advanced);
  });

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