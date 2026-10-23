import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isVisibleMaintenanceHistory } from '../../../../shared/workOrders/maintenanceHistoryVisibility';
import { getTableSyncConfig } from '../../../../shared/syncConfig';

vi.mock('../../../db', () => ({ getPool: () => { throw new Error('Live pool forbidden'); } }));
vi.mock('../syncDiagLogger', () => ({ syncDiag: vi.fn() }));
import { applyFieldLogInserts, type FieldLogEntry } from '../oneWayApplier';

const required = ['cmhuuid', 'component_id', 'component_code', 'vessel_code', 'work_order_id',
  'work_order_no', 'job_title', 'maintenance_type', 'date_completed', 'performed_by', 'status'];
const fields = [...required, 'id', 'job_id', 'job_code', 'is_skipped', 'source_work_order_id',
  'skipped_cycle_date', 'running_hours_at_completion'];

/** SQL fixture for the actual sync applier. Integer identities differ between instances. */
class Instance {
  rows = new Map<string, any>();
  parents = new Set(['source-wo', 'component-uuid', 'job-uuid']);
  commands: string[] = [];
  constructor(public nextId: number) {}
  async query(text: string, values: any[] = []): Promise<{ rows: any[]; rowCount?: number }> {
    this.commands.push(text);
    if (text.includes('pg_attribute')) return { rows: text.includes('nextval') ? [] : [{ attname: 'id' }] };
    if (text.includes('information_schema.columns')) {
      if (text.includes("('json', 'jsonb')") || text.includes("data_type = 'ARRAY'")) return { rows: [] };
      return { rows: (text.includes("is_nullable = 'NO'") ? required : fields).map(column_name => ({ column_name })) };
    }
    if (/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT)/.test(text)) return { rows: [] };
    if (text.startsWith('SELECT 1')) return { rows: this.rows.has(values[0]) ? [{ exists: 1 }] : [] };
    if (text.startsWith('INSERT INTO "component_maintenance_history"')) {
      const columns = text.match(/\((.*?)\) VALUES/)![1].split(', ').map(c => c.replace(/"/g, ''));
      const row = Object.fromEntries(columns.map((column, i) => [column, values[i]]));
      for (const column of ['work_order_id', 'component_id', 'job_id']) {
        if (row[column] && !this.parents.has(row[column])) {
          throw Object.assign(new Error('parent absent'), {
            code: '23503', detail: `Key (${column})=(${row[column]}) is not present`,
          });
        }
      }
      if (!this.rows.has(row.cmhuuid)) this.rows.set(row.cmhuuid, { ...row, id: this.nextId++ });
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }
}

function row(cmhuuid: string, skipped: boolean) {
  return { cmhuuid, id: 17, component_id: 'component-uuid', component_code: '601.01', vessel_code: 'VES-9',
    job_id: 'job-uuid', job_code: 'JOB-1', work_order_id: 'source-wo',
    work_order_no: skipped ? 'SKIP-RH-internal' : 'VES-9-WO-1', job_title: 'Pump service',
    maintenance_type: 'Servicing', date_completed: '2026-07-20', performed_by: 'Engineer',
    status: skipped ? 'SKIPPED' : 'Approved', is_skipped: skipped,
    source_work_order_id: skipped ? 'source-wo' : null, running_hours_at_completion: skipped ? '300' : '350' };
}
function logs(record: ReturnType<typeof row>): FieldLogEntry[] {
  return Object.entries(record).map(([fieldName, value]) => ({
    tableName: 'component_maintenance_history', rowUuid: record.cmhuuid,
    fieldName, oldValue: null, newValue: value == null ? null : String(value),
    vesselId: 'VES-9', changedAt: '2026-07-20T12:00:00Z',
  }));
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('immutable maintenance history sync preservation', () => {
  it.each(['ship-to-shore', 'shore-to-ship'])('%s retains backend skips, actual history and canonical parent UUIDs', async direction => {
    const target = new Instance(direction === 'ship-to-shore' ? 900 : 30);
    const skipped = row('skip-uuid', true), actual = row('actual-uuid', false);
    const result = await applyFieldLogInserts([...logs(skipped), ...logs(actual)], target);
    expect(result.errors).toEqual([]);
    expect(result.insertedRows).toBe(2);
    expect(target.rows.get('skip-uuid')).toMatchObject({
      component_id: 'component-uuid', work_order_id: 'source-wo', job_id: 'job-uuid', vessel_code: 'VES-9',
    });
    expect(target.rows.get('skip-uuid').id).not.toBe(17);
    expect([...target.rows.values()].filter(isVisibleMaintenanceHistory).map(h => h.cmhuuid)).toEqual(['actual-uuid']);
    const before = structuredClone([...target.rows]);
    const retry = await applyFieldLogInserts([...logs(skipped), ...logs(actual)], target);
    expect(retry.errors).toEqual([]);
    expect(retry.insertedRows).toBe(0);
    expect([...target.rows]).toEqual(before);
    expect(target.commands.some(text => text.startsWith('UPDATE'))).toBe(false);
  });

  it.each(['work_order_id', 'component_id', 'job_id'])('missing %s is retried without permanently discarding immutable linkage', async column => {
    const target = new Instance(900);
    const incoming = row('skip-uuid', true);
    const parent = incoming[column as keyof typeof incoming] as string;
    target.parents.delete(parent);
    const first = await applyFieldLogInserts(logs(incoming), target);
    expect(first.failedRowUuids).toEqual(['skip-uuid']);
    expect(first.errors[0]).toContain('parent not yet available');
    expect(target.rows.size).toBe(0);
    target.parents.add(parent);
    const second = await applyFieldLogInserts(logs(incoming), target);
    expect(second.errors).toEqual([]);
    expect(target.rows.size).toBe(1);
    expect(target.rows.get('skip-uuid')[column]).toBe(parent);
  });

  it('keeps the existing bidirectional UUID identity and vessel-code scope', () => {
    expect(getTableSyncConfig('component_maintenance_history')).toMatchObject({
      direction: 'bidirectional', identityColumn: 'cmhuuid', vesselScopeColumn: 'vessel_code', immutable: true,
    });
  });
});
