import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentMaintenanceHistory, components, jobs, vessels, workOrders } from '../../../../shared/schema';
import { PgDialect } from 'drizzle-orm/pg-core';

const seam = vi.hoisted(() => ({ db: null as any, log: vi.fn() }));
vi.mock('../../../db', () => ({ getDb: async () => seam.db }));
vi.mock('../../sync/fieldLogger', () => ({ logFieldChanges: (...args: any[]) => seam.log(...args) }));
import { persistMaintenanceHistory, sameMaintenanceCycle, visibleMaintenanceHistory } from '../utils/maintenanceHistoryPersistence';
import { isVisibleMaintenanceHistory } from '../../../../shared/workOrders/maintenanceHistoryVisibility';

// Models transaction commit/rollback and source serialization. This is not a live PostgreSQL test.
class HistoryDatabase {
  rows: any[] = [];
  logs: any[] = [];
  locks = 0;
  source = { wouuid: 'source-uuid', vesselId: 'vessel-uuid', jobId: 'job-uuid' };
  component = { cuuid: 'component-uuid', componentCode: '601.01', vesselId: 'vessel-uuid' };
  job = { juuid: 'job-uuid', jobNo: 'JOB-123', vesselId: 'vessel-uuid' };
  vessel: any = { vuuid: 'vessel-uuid', id: 'local-vessel', vCode: 'VES-9' };
  private tail = Promise.resolve();
  async transaction(work: (tx: any) => Promise<any>) {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const rows = structuredClone(this.rows), logs = structuredClone(this.logs);
    const tx = {
      select: () => ({
        from: (table: unknown) => {
          const read = () => table === workOrders ? [this.source]
            : table === vessels ? (this.vessel ? [this.vessel] : [])
            : table === components ? [this.component]
            : table === jobs ? [this.job]
            : table === componentMaintenanceHistory ? this.rows : [];
          const query = {
            where: () => query,
            for: (mode: string) => { expect(table).toBe(workOrders); expect(mode).toBe('update'); this.locks++; return read(); },
            limit: () => read(),
            then: (resolve: (rows: any[]) => unknown) => Promise.resolve(read()).then(resolve),
          };
          return query;
        },
      }),
      insert: (table: unknown) => ({
        values: (row: any) => ({
          returning: async () => {
            expect(table).toBe(componentMaintenanceHistory);
            const inserted = { ...row, cmhuuid: `uuid-${this.rows.length}`, id: this.rows.length + 1 };
            this.rows.push(inserted);
            return [inserted];
          },
        }),
      }),
      testLogs: this.logs,
    };
    try { return await work(tx); }
    catch (error) { this.rows = rows; this.logs = logs; throw error; }
    finally { release(); }
  }
}

const actual = { componentId: 'component-uuid', componentCode: 'caller-code', vesselCode: 'vessel-uuid',
  jobId: 'job-uuid', jobCode: 'WRONG-TEMPLATE', workOrderId: 'source-uuid', workOrderNo: 'WO-123',
  jobTitle: 'Pump service', maintenanceType: 'Servicing', dateCompleted: '2026-07-20',
  performedBy: 'Engineer', status: 'Approved' };
const skipped = { ...actual, workOrderNo: 'SKIP-CAL-internal', status: 'SKIPPED', isSkipped: true,
  skippedCycleDate: '01-Jul-2026', originalDueDate: '01-Jul-2026', sourceWorkOrderId: 'source-uuid' };
let db: HistoryDatabase;
beforeEach(() => {
  vi.clearAllMocks();
  db = new HistoryDatabase(); seam.db = db;
  seam.log.mockImplementation(async (_table, _uuid, _vessel, _old, row, _user, tx) => {
    tx.testLogs.push(row);
    return 1;
  });
});

describe('actual history transaction boundary', () => {
  it('serializes simultaneous skipped and actual writers without losing separate completion', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => persistMaintenanceHistory(i % 2 ? actual : skipped)));
    expect(db.rows).toHaveLength(2);
    expect(db.logs).toHaveLength(2);
    expect(db.locks).toBe(12);
    expect(db.rows.filter(isVisibleMaintenanceHistory)).toHaveLength(1);
    // vessel_code = the Work Order's vessel id (as every existing row), not vessels.v_code
    expect(db.rows.every(row => row.vesselCode === 'vessel-uuid' && row.componentCode === '601.01'
      && row.jobCode === 'JOB-123' && row.workOrderId === 'source-uuid')).toBe(true);
  });

  it('recognizes immutable legacy Calendar and RH rows without rewriting identity or fields', async () => {
    const legacy = { ...skipped, cmhuuid: 'legacy-identity', workOrderNo: 'OLD-CODE', skippedCycleDate: '2026-07-01' };
    db.rows = [legacy];
    const saved = await persistMaintenanceHistory(skipped);
    expect(saved).toBe(legacy);
    expect(db.rows).toHaveLength(1);
    expect(seam.log).not.toHaveBeenCalled();
    expect(sameMaintenanceCycle({ ...legacy, runningHoursAtCompletion: '300.00' },
      { ...skipped, runningHoursAtCompletion: '300', skippedCycleDate: 'other-day' })).toBe(true);
    expect(sameMaintenanceCycle({ ...legacy, runningHoursAtCompletion: '300' },
      { ...skipped, runningHoursAtCompletion: '400' })).toBe(false);
  });

  it('same-day RH cycles remain distinct and retries add no logs', async () => {
    await Promise.all(['300', '400', '300', '400'].map(runningHoursAtCompletion =>
      persistMaintenanceHistory({ ...skipped, runningHoursAtCompletion })));
    expect(db.rows).toHaveLength(2);
    expect(db.logs).toHaveLength(2);
  });

  it('logging failure rolls back both history and logs, allowing a clean retry', async () => {
    seam.log.mockImplementationOnce(async (...args: any[]) => {
      args[6].testLogs.push(args[4]);
      throw new Error('field logging failed');
    });
    await expect(persistMaintenanceHistory(actual)).rejects.toThrow('field logging failed');
    expect(db.rows).toHaveLength(0);
    expect(db.logs).toHaveLength(0);
    await persistMaintenanceHistory(actual);
    expect(db.rows).toHaveLength(1);
    expect(db.logs).toHaveLength(1);
  });

  it('does not mix competing first-writer cycle bases within the same source', async () => {
    const first = { ...skipped, remarks: JSON.stringify({ skippedCycleBasis: {
      kind: 'CAL', original: '01-Jun-2026', frequency: 1, unit: 'months', cycles: 2,
    } }) };
    await persistMaintenanceHistory(first);
    const competing = { ...first, skippedCycleDate: '01-Aug-2026', remarks: JSON.stringify({
      skippedCycleBasis: { kind: 'CAL', original: '01-Jul-2026', frequency: 1, unit: 'months', cycles: 2 },
    }) };
    await expect(persistMaintenanceHistory(competing)).rejects.toThrow('basis changed');
    expect(db.rows).toHaveLength(1);
    expect(db.logs).toHaveLength(1);
  });

  // 23-Oct-2026: a vessel without a V-code (all pilot vessels) must still save its history.
  it('saves history for a vessel without a V-code, logged under the vessel id', async () => {
    db.vessel = { vuuid: 'vessel-uuid', id: 'local-vessel', vCode: null };
    await persistMaintenanceHistory(actual);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].vesselCode).toBe('vessel-uuid');
    expect(db.logs).toHaveLength(1);
  });

  it('rejects cross-vessel component and Job linkage before inserting', async () => {
    db.component.vesselId = 'another-vessel';
    await expect(persistMaintenanceHistory(actual)).rejects.toThrow('another vessel');
    expect(db.rows).toHaveLength(0);
    db.component.vesselId = 'vessel-uuid'; db.job.vesselId = 'another-vessel';
    await expect(persistMaintenanceHistory(actual)).rejects.toThrow('another vessel');
    expect(seam.log).not.toHaveBeenCalled();
  });

  it('presentation SQL excludes both flags and legacy status without changing sync identities', () => {
    const query = new PgDialect().sqlToQuery(visibleMaintenanceHistory);
    expect(query.sql).toContain('is_skipped');
    expect(query.sql).toContain('SKIPPED');
    expect(query.sql).not.toContain('is_sync');
    expect([actual, skipped, { ...actual, isSkipped: null, status: 'SKIPPED' }]
      .filter(isVisibleMaintenanceHistory)).toEqual([actual]);
  });
});
