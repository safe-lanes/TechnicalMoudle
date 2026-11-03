/**
 * Explicit-run-only: execute complete real method/function source in an
 * allowlisted VM. No live module imports, database clients, timers or startup.
 * All fakes and fixtures remain inside this test file.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql, SQL } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { sanitizeWorkOrderB3Fields } from '@shared/workOrderPayload';

function extract(file: string, predicate: (node: ts.Node) => boolean) {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: ts.Node[] = [];
  function visit(node: ts.Node) {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  expect(found).toHaveLength(1);
  return found[0].getText();
}
function method(file: string) {
  return extract(file, n => ts.isMethodDeclaration(n) && n.name.getText() === 'createWorkOrder');
}
const quiet = { log() {}, warn() {}, error() {} };
const fixedTime = '2026-10-05T09:00:00.000Z';
class FixedDate extends Date {
  constructor(value?: string | number) { super(value === undefined ? fixedTime : value); }
  static now() { return Date.parse(fixedTime); }
}
const fixedMath = Object.create(Math);
fixedMath.random = () => 0.25;
function evaluate(text: string, globals: Record<string, unknown>, imports: Record<string, unknown> = {}) {
  const module = { exports: {} };
  return runInNewContext(ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Date: FixedDate, Math: fixedMath, console: quiet,
    ...globals,
    require(id: string) {
      if (!Object.hasOwn(imports, id)) throw Error(`Blocked creation-probe import: ${id}`);
      return imports[id];
    },
  }, { timeout: 5000 });
}
function noSqlObjects(value: unknown): void {
  expect(value).not.toBeInstanceOf(SQL);
  if (value && typeof value === 'object') Object.values(value).forEach(noSqlObjects);
}
function storage(before: boolean) {
  const queries: unknown[] = [];
  const values: unknown[] = [];
  const returned = {
    id: 'database-local-id', wouuid: 'database-canonical-uuid', vesselId: 'vessel-A',
    workOrderNo: 'DB-WO-001', status: 'Active', component: 'Engine', jobTitle: 'Inspect',
  };
  const generator = drizzle({});
  const db = {
    insert(table: Parameters<typeof generator.insert>[0]) {
      return { values(value: Parameters<ReturnType<typeof generator.insert>['values']>[0]) {
        values.push(value);
        queries.push(generator.insert(table).values(value).returning().toSQL());
        return { returning: async () => [returned] };
      } };
    },
  };
  let source = method('server/postgresStorage.ts');
  if (before) source = source.replace('InsertWorkOrder & { id?: string }', 'InsertWorkOrder')
    .replace('workOrderNo: sql`default`,', '');
  const instance = evaluate(`class Storage { ${source} }\nnew Storage();`, {
    getDb: async () => db, workOrders: schema.workOrders, sql,
    randomUUID: () => 'generated-canonical-uuid',
  });
  return { instance, queries, values, returned };
}

describe('caller sync boundaries use returned rows, never SQL expressions', () => {
  it('full UI service produces the post-numbering/assignment payload and logs/audits the returned row', async () => {
    const source = extract('server/modules/work-orders/services/workOrderService.ts',
      n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWorkOrder').replace(/^export /, '');
    const outcomes = [];
    for (const before of [true, false]) {
      const s = storage(before);
      const logs: unknown[][] = [];
      const audits: unknown[] = [];
      const payloads: unknown[] = [];
      const body = Object.freeze({
        vesselId: 'vessel-A', component: 'Engine', componentCode: '651.001',
        jobId: 'job-uuid', jobTitle: 'Inspect', assignedTo: 'Engineer',
        workOrderNo: '', templateCode: 'TEMPLATE-001', status: 'Active',
        maintenanceBasis: 'Calendar', dueDate: '2026-11-01',
      });
      const repo = {
        findComponent: async () => ({ componentCode: '651.001', rhCounterType: 'NOT_RH_DRIVEN' }),
        findJob: async () => ({ jobNo: 'JOB-001', componentCode: '651.001' }),
        getStorage: () => { throw Error('Replaced below with isolated storage'); },
        create: async (data: unknown) => {
          payloads.push(data);
          return s.instance.createWorkOrder(data);
        },
        createAuditLog: async (row: unknown) => { audits.push(row); },
      };
      // getStorage is used only by the stubbed numbering functions, never for I/O.
      repo.getStorage = () => s.instance;
      const create = evaluate(`${source}\ncreateWorkOrder;`, {
        repo, sanitizeWorkOrderB3Fields,
        applyAssignmentSync: async (data: Record<string, unknown>) => ({ ...data, assignedTo: 'assigned-user' }),
        ensureCompletedWorkOrderDate() {},
        logFieldChanges: async (...args: unknown[]) => { logs.push(args); },
        ValidationError: Error,
      }, {
        '@shared/schema': schema,
        '../../../utils/workOrderNumbering': {
          determineWorkOrderType: () => 'Planned',
          generatePlannedWorkOrderNumber: async () => 'GENERATED-UI-001',
          generateUnplannedWorkOrderNumber: async () => 'GENERATED-UNPLANNED-001',
        },
      });
      expect(await create(body)).toBe(s.returned);
      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        workOrderNo: 'GENERATED-UI-001', assignedTo: 'assigned-user', dueDate: '01-11-2026',
      });
      expect(body.workOrderNo).toBe('');
      expect(body.assignedTo).toBe('Engineer');
      expect(logs).toHaveLength(1);
      expect(logs[0][4]).toBe(s.returned);
      expect(audits[0]).toMatchObject({
        entityId: s.returned.wouuid, payload: { workOrderNo: s.returned.workOrderNo },
      });
      noSqlObjects(logs);
      noSqlObjects(audits);
      outcomes.push({ queries: s.queries, logs, audits, payloads });
    }
    expect(outcomes[1]).toEqual(outcomes[0]);
  });
  it('full scanner-facing service retains empty-string numbering, duplicate guard and returned-row sync', async () => {
    const source = method('server/services/workOrderService.ts');
    const outcomes = [];
    for (const before of [true, false]) {
      const s = storage(before);
      const logs: unknown[][] = [];
      const storageFake = {
        createWorkOrder: s.instance.createWorkOrder.bind(s.instance),
        getWorkOrdersByJobId: async () => [],
      };
      const instance = evaluate(`class Caller { ${source} }\nnew Caller();`, {
        storage: storageFake, isBlockingStatus: () => true,
        ensureCompletedWorkOrderDate() {},
        generateUnplannedWorkOrderNumber: async () => 'GENERATED-LEGACY-001',
        logFieldChanges: async (...args: unknown[]) => { logs.push(args); },
      });
      const input = {
        vesselId: 'vessel-A', componentCode: '651.001', component: 'Engine',
        jobId: 'job-uuid', jobTitle: 'Inspect', assignedTo: 'Engineer', workOrderNo: '',
      };
      expect(await instance.createWorkOrder(input)).toBe(s.returned);
      expect(input.workOrderNo).toBe('GENERATED-LEGACY-001');
      expect(logs[0][4]).toBe(s.returned);
      noSqlObjects(logs);
      const writesBeforeDuplicate = s.queries.length;
      storageFake.getWorkOrdersByJobId = async () => [{
        jobId: 'job-uuid', componentCode: '651.001', vesselId: 'vessel-A',
        status: 'Active', workOrderNo: 'existing',
      }];
      await expect(instance.createWorkOrder(input)).rejects.toThrow('Work Order already exists');
      expect(s.queries).toHaveLength(writesBeforeDuplicate);
      outcomes.push({ queries: s.queries, logs });
    }
    expect(outcomes[1]).toEqual(outcomes[0]);
  });
  it('actual history-import logging block preserves the returned-row projection without local ID', async () => {
    const source = extract('server/modules/bulk-upload/services/importService.ts', n =>
      ts.isTryStatement(n) && Boolean(n.tryBlock.statements[0]?.getText().includes('...woForLog')
        && n.tryBlock.statements[0]?.getText().includes('savedWO')));
    const outcomes = [];
    for (const before of [true, false]) {
      const s = storage(before);
      const savedWO = await s.instance.createWorkOrder({
        component: 'Engine', jobTitle: 'Inspect', assignedTo: 'Engineer', workOrderNo: 'HISTORY-001',
      });
      const logs: unknown[][] = [];
      await evaluate(`(async () => { ${source} })();`, {
        savedWO, logFieldChanges: async (...args: unknown[]) => { logs.push(args); },
      });
      const { id: omitted, ...projected } = s.returned;
      expect(omitted).toBe('database-local-id');
      expect(logs[0][4]).toEqual(projected);
      expect(logs[0][4]).not.toHaveProperty('id');
      noSqlObjects(logs);
      outcomes.push({ queries: s.queries, logs });
    }
    expect(outcomes[1]).toEqual(outcomes[0]);
  });
});
