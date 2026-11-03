/**
 * Explicit-run-only source probes. Execute the actual AST-extracted methods, never
 * import storage/server startup. The VM has no process, fetch, timers or I/O;
 * require is denied. Drizzle only compiles captured queries; no client is supplied.
 * Baselines reverse only the approved edits, not handwritten method bodies.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql, SQL } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { buildRunningHoursWorkOrderSnapshots } from '../modules/work-orders/utils/workOrderPartADates';

const storageFile = 'server/postgresStorage.ts';
const read = (file: string) => readFileSync(resolve(file), 'utf8');
const fixedTime = '2026-10-05T09:00:00.000Z';
class FixedDate extends Date {
  constructor(value?: string | number) { super(value === undefined ? fixedTime : value); }
  static now() { return Date.parse(fixedTime); }
}
const fixedMath = Object.create(Math);
fixedMath.random = () => 0.25;
const quiet = { log() {}, warn() {}, error() {} };
const methodCache = new Map<string, string>();
const compileCache = new Map<string, string>();

function nodes(file: string, match: (node: ts.Node) => boolean) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  const found: ts.Node[] = [];
  function visit(node: ts.Node) {
    if (match(node)) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
function method(name: string) {
  const cached = methodCache.get(name);
  if (cached) return cached;
  const found = nodes(storageFile, n => ts.isMethodDeclaration(n) && n.name.getText() === name);
  expect(found).toHaveLength(1);
  const text = found[0].getText();
  methodCache.set(name, text);
  return text;
}
function compile(text: string) {
  const cached = compileCache.get(text);
  if (cached) return cached;
  const result = ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  expect(result.diagnostics).toEqual([]);
  compileCache.set(text, result.outputText);
  return result.outputText;
}
function evaluate(text: string, globals: Record<string, unknown> = {}) {
  const module = { exports: {} };
  return runInNewContext(compile(text), {
    module, exports: module.exports, Date: FixedDate, Math: fixedMath, console: quiet,
    ...globals,
    require(id: string) { throw Error(`Blocked source-probe import: ${id}`); },
  }, { timeout: 5000 });
}
function baseline(name: string, text = method(name)) {
  return text
    .replaceAll('InsertWorkOrder & { id?: string }', 'InsertWorkOrder')
    .replace('Array<InsertWorkOrder>', 'InsertWorkOrder[]')
    .replaceAll('workOrderNo: sql`default`,', '')
    .replace(/(updateFleetSpare|deleteFleetSpare)\(id: string/, '$1(id: number')
    .replace('id: string; cuuid: string; data:', 'id: string; data:')
    .replace("Omit<InsertSpareLocationStock, 'spareUuid'> & { spareUuid?: string }", 'InsertSpareLocationStock')
    .replace('.values({ spareUuid: sql`default`, ...data })', '.values(data)')
    .replace('.values(componentsData.map(component => ({ id: sql`default`, ...component })))',
      '.values(componentsData)')
    .replace('.set({ updatedAt: new Date() })', '.set({ isRecurring: true, updatedAt: new Date() })');
}
function subject(name: string, globals: Record<string, unknown>, before = false) {
  const text = before ? baseline(name) : method(name);
  return evaluate(`class Subject { ${text} }\nnew Subject();`, {
    sql, eq, ...schema, randomUUID: () => 'generated-canonical-uuid', ...globals,
  });
}
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
function noSqlObjects(value: unknown): void {
  expect(value).not.toBeInstanceOf(SQL);
  if (value && typeof value === 'object') Object.values(value).forEach(noSqlObjects);
}

// The fake captures the values actually passed by storage, and runs the real
// Drizzle builder with them. returning() never executes a query or echoes input.
function captureDb(returned: Record<string, unknown>[] = [{ id: 'persisted', wouuid: 'persisted-uuid' }]) {
  const generator = drizzle({});
  const queries: unknown[] = [];
  const inputs: unknown[] = [];
  const calls: string[] = [];
  const db = {
    insert: (table: Parameters<typeof generator.insert>[0]) => {
      calls.push('insert');
      return { values(payload: Parameters<ReturnType<typeof generator.insert>['values']>[0]) {
        inputs.push(payload);
        queries.push(generator.insert(table).values(payload).returning().toSQL());
        return { returning: async () => returned };
      } };
    },
    update: (table: Parameters<typeof generator.update>[0]) => ({
      set: (payload: Parameters<ReturnType<typeof generator.update>['set']>[0]) => ({
        where: (predicate: SQL) => ({
          returning: async () => {
            calls.push('update');
            inputs.push(payload);
            queries.push(generator.update(table).set(payload).where(predicate).returning().toSQL());
            return returned;
          },
        }),
      }),
    }),
    select: () => ({ from: () => ({ where: async () => [] }) }),
  };
  return { db, queries, inputs, calls, returned };
}

async function payload(initializer: string, globals: Record<string, unknown>) {
  return evaluate(`(async () => (${initializer}))();`, globals);
}
async function callerPayloads() {
  const job = {
    juuid: 'job-uuid', vesselId: 'vessel-A', jobTitle: 'Inspect engine', assignedTo: 'Engineer',
    maintenanceType: 'Inspection', maintenanceBasis: 'Running Hours', frequencyValue: 250,
    frequencyUnit: 'Hours', intervalRunningHour: 250, jobPriority: 'Normal',
    classRelated: 'No', briefWorkDescription: 'Inspect', department: 'Engine',
    nextDueDate: '2026-11-01', lastDoneDate: '2026-10-01',
    lastDoneRH: '1000', nextDueRH: '1250',
  };
  const globals = {
    job, workOrderNo: 'VES-JOB-COMP-2026-001', componentName: 'Engine',
    componentCode: '651.001', rhDue: 1250, rhGenerate: 1200,
    componentCurrentRH: 1210, rhEffectiveCurrent: 1210, rhLastDone: 1000,
    triggerLeg: 'CALENDAR', dueDateStr: '2026-11-01', generateDateStr: '2026-10-25',
    effectiveComponentName: 'Engine', effectiveComponentCode: '651.001', dbStatus: 'Due',
    reason: 'Fixture', cycleSnapshots: { driverType: 'RH', dueRhSnapshot: '1250' },
    resolveOriginInstance: async () => 'SHIP-fixture',
  };
  const scanner = nodes('server/services/jobDueScanner.ts',
    n => ts.isVariableDeclaration(n) && n.name.getText() === 'workOrderData');
  expect(scanner).toHaveLength(3);
  const result: Record<string, unknown>[] = [];
  for (const node of scanner) {
    if (!ts.isVariableDeclaration(node) || !node.initializer) throw Error('Missing scanner payload');
    result.push(await payload(node.initializer.getText(), globals));
  }
  const history = nodes('server/modules/bulk-upload/services/importService.ts',
    n => ts.isVariableDeclaration(n) && n.name.getText() === 'woPayload');
  expect(history).toHaveLength(1);
  const historyNode = history[0];
  if (!ts.isVariableDeclaration(historyNode) || !historyNode.initializer) throw Error('Missing history payload');
  result.push(await payload(historyNode.initializer.getText(), {
    vesselId: 'vessel-A', component: { name: 'Engine', description: 'Main engine' },
    compCode: '651.001', matchingJob: job, woNumber: 'HISTORY-001', jobTitle: 'Inspect',
    performedBy: 'Engineer', approver: 'Chief', dueDate: '01-Nov-2026', status: 'Completed',
    maintenanceType: 'Inspection', workDone: 'Done', dateCompleted: '02-Nov-2026',
    remarks: 'Fixture', nextDueDate: '01-Dec-2026', nextDueHour: '1500',
    rhAtCompletion: '1250', dueRhSnapshot: '1250', parseOptionalSnapshotNumber: String,
  }));
  const standard = nodes('server/modules/bulk-upload/services/importService.ts',
    n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWorkOrderFromRow')[0];
  const standardAst = ts.createSourceFile('probe.ts', standard.getText(), ts.ScriptTarget.Latest, true);
  let standardInitializer = '';
  function find(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(standardAst) === 'workOrderData')
      standardInitializer = node.initializer?.getText(standardAst) || '';
    ts.forEachChild(node, find);
  }
  find(standardAst);
  expect(standardInitializer).not.toBe('');
  for (const isRunningHours of [false, true]) {
    result.push(await payload(standardInitializer, {
      effectiveVesselId: 'vessel-A', component: { name: 'Engine', currentCumulativeRH: '1210' },
      row: { Responsible_Rank: 'Engineer', Schedule_Type: isRunningHours ? 'Running Hours' : 'Calendar',
        Interval: 1, Interval_Unit: 'Months', Criticality: 'No', Job_Description: 'Inspect' },
      componentCode: '651.001', jobId: 'job-uuid', workOrderNo: 'IMPORT-001',
      templateCode: 'TEMPLATE-001', jobTitle: 'Inspect', isRunningHours, matchingJob: job,
      buildRunningHoursWorkOrderSnapshots,
    }));
  }
  return result;
}

describe('real work-order methods preserve SQL, precedence, inputs and return rows', () => {
  const names = ['createWorkOrder', 'bulkCreateWorkOrders', 'createFleetWorkOrder'];
  const extras = [{}, { workOrderNo: undefined }, { workOrderNo: 'WO-001' },
    { workOrderNo: null }, { workOrderNo: '' }];
  for (const name of names) {
    it(`${name}: actual caller payload shapes and every workOrderNo variant`, async () => {
      for (const shape of await callerPayloads()) for (const extra of extras) {
        const input = { ...shape, ...extra, id: 'caller-id', wouuid: 'caller-uuid', dataScope: 'custom' };
        if (!Object.hasOwn(extra, 'workOrderNo')) delete input.workOrderNo;
        const original = structuredClone(input);
        Object.freeze(input);
        const runs = [];
        for (const before of [true, false]) {
          const c = captureDb();
          const instance = subject(name, { getDb: async () => c.db }, before);
          const result = await instance[name](name === 'bulkCreateWorkOrders' ? [input] : input);
          expect(name === 'bulkCreateWorkOrders' ? result[0] : result).toBe(c.returned[0]);
          const captured = c.inputs[0];
          expect(captured).toMatchObject({
            id: 'caller-id', wouuid: 'generated-canonical-uuid',
            dataScope: name === 'createFleetWorkOrder' ? 'fleet' : 'custom',
          });
          expect(input).toEqual(original);
          noSqlObjects(result);
          runs.push(c.queries);
        }
        expect(runs[1]).toEqual(runs[0]);
      }
    });
    it(`${name}: retains generated IDs and scope defaults without mutating input`, async () => {
      for (const extra of [{}, { id: '', dataScope: '' }, { id: undefined, dataScope: undefined }]) {
        const input = Object.freeze({ component: 'Engine', jobTitle: 'Inspect', assignedTo: 'Engineer', ...extra });
        const runs = [];
        for (const before of [true, false]) {
          const c = captureDb();
          await subject(name, { getDb: async () => c.db }, before)[name](
            name === 'bulkCreateWorkOrders' ? [input] : input);
          expect(c.inputs[0]).toMatchObject({
            id: `${name === 'createFleetWorkOrder' ? 'FWO' : 'WO'}-${FixedDate.now()}-${(0.25).toString(36).substr(2, 9)}`,
            dataScope: name === 'createFleetWorkOrder' ? 'fleet' : 'vessel',
          });
          runs.push(c.queries);
        }
        expect(runs[1]).toEqual(runs[0]);
      }
    });
  }
  it('bulk WO creation keeps per-row order and skips database access for empty input', async () => {
    const rows = await callerPayloads();
    const runs = [];
    for (const before of [true, false]) {
      const c = captureDb();
      const getDb = () => { c.calls.push('getDb'); return c.db; };
      const instance = subject('bulkCreateWorkOrders', { getDb }, before);
      expect(await instance.bulkCreateWorkOrders([])).toEqual([]);
      expect(c.calls).toEqual([]);
      const result = await instance.bulkCreateWorkOrders(rows);
      expect(result).toHaveLength(rows.length);
      expect(c.queries).toHaveLength(rows.length);
      runs.push(c.queries);
    }
    expect(runs[1]).toEqual(runs[0]);
  });
});

describe('stock upsert and component bulk creation keep ownership and SQL', () => {
  for (const existing of [false, true]) for (const fail of [false, true]) {
    it(`stock branch existing=${existing}, database failure=${fail}`, async () => {
      for (const extra of [{}, { spareUuid: undefined }, { spareUuid: 'spare-uuid', locationUuid: 'given-location' }]) {
        const input = Object.freeze({ spareId: 1, locationId: 2, qty: 3, vesselId: 'vessel-A', ...extra });
        const original = structuredClone(input);
        const runs = [];
        for (const before of [true, false]) {
          const returned = { id: 90, slsuuid: 'persisted-stock', spareUuid: 'persisted-spare', vesselId: 'vessel-A', qty: 3 };
          const c = captureDb([returned]);
          const logs: unknown[][] = [];
          const failDb = {
            ...c.db,
            insert: (...args: Parameters<typeof c.db.insert>) => {
              const builder = c.db.insert(...args);
              return { values(...values: Parameters<typeof builder.values>) {
                const query = builder.values(...values);
                return { returning: async () => { if (fail) throw Error('Fixture constraint failure'); return query.returning(); } };
              } };
            },
          };
          const instance = subject('upsertSpareLocationStock', {
            getDb: () => { throw Error('txConn must win'); },
            logFieldChanges: async (...args: unknown[]) => { logs.push(args); },
          }, before);
          instance.getLocationById = async () => ({ luuid: 'resolved-location' });
          instance.getSpareLocationStockItem = async () => existing
            ? { id: 90, slsuuid: 'persisted-stock', locationUuid: null, qty: 1 } : undefined;
          if (fail && !existing) {
            await expect(instance.upsertSpareLocationStock(input, failDb)).rejects.toThrow('Fixture constraint failure');
            expect(logs).toEqual([]);
          } else {
            expect(await instance.upsertSpareLocationStock(input, failDb)).toBe(returned);
            expect(logs).toHaveLength(1);
            expect(logs[0][4]).toBe(returned);
            noSqlObjects(logs);
          }
          expect(input).toEqual(original);
          if (!existing && !before) expect(c.inputs[0]).not.toBe(input);
          runs.push({ queries: c.queries, logs: plain(logs) });
        }
        expect(runs[1]).toEqual(runs[0]);
      }
    });
  }
  it('component multi-row INSERT preserves order, defaults and every caller item', async () => {
    const input = Object.freeze([
      Object.freeze({ cuuid: 'first', name: 'Pump' }),
      Object.freeze({ cuuid: 'second', name: 'Fan', id: 'provided-id' }),
      Object.freeze({ cuuid: 'third', id: undefined, name: null }),
    ]);
    const original = structuredClone(input);
    const runs = [];
    for (const before of [true, false]) {
      const returned = [{ id: 'db-first' }, { id: 'provided-id' }, { id: 'db-third' }];
      const c = captureDb(returned);
      const instance = subject('bulkCreateComponents', {
        getDb: () => { c.calls.push('getDb'); return c.db; },
      }, before);
      expect(await instance.bulkCreateComponents([])).toEqual([]);
      expect(c.calls).toEqual([]);
      expect(await instance.bulkCreateComponents(input)).toBe(returned);
      expect(input).toEqual(original);
      if (!before) {
        expect(c.inputs[0]).not.toBe(input);
        expect(Array.isArray(c.inputs[0])).toBe(true);
        if (Array.isArray(c.inputs[0])) c.inputs[0].forEach((row, i) => expect(row).not.toBe(input[i]));
      }
      noSqlObjects(returned);
      runs.push(c.queries);
    }
    expect(runs[1]).toEqual(runs[0]);
  });
});

describe('declarations and recurrence remain executable-equivalent', () => {
  it('the execution sandbox denies application imports, environment, network and timers', () => {
    expect(evaluate('[typeof process, typeof fetch, typeof setTimeout, typeof setInterval];'))
      .toEqual(['undefined', 'undefined', 'undefined', 'undefined']);
    expect(() => evaluate('require("../index");')).toThrow('Blocked source-probe import');
  });
  it('all declaration-only edits emit identical JavaScript', () => {
    for (const name of ['createWorkOrder', 'bulkCreateWorkOrders', 'createFleetWorkOrder']) {
      const current = method(name);
      expect(compile(`class S { ${current} }`)).toBe(compile(`class S { ${current
        .replaceAll('InsertWorkOrder & { id?: string }', 'InsertWorkOrder')
        .replace('Array<InsertWorkOrder>', 'InsertWorkOrder[]')} }`));
    }
    for (const name of ['updateFleetSpare', 'deleteFleetSpare', 'bulkUpdateComponents'])
      expect(compile(`class S { ${method(name)} }`)).toBe(compile(`class S { ${baseline(name)} }`));
  });
  it('unused wrappers still delegate the original ID and payload', async () => {
    for (const name of ['updateFleetSpare', 'deleteFleetSpare']) {
      const calls: unknown[][] = [];
      const instance = subject(name, {});
      instance.updateSpare = async (...args: unknown[]) => { calls.push(args); return { id: 'returned' }; };
      instance.deleteSpare = async (...args: unknown[]) => { calls.push(args); };
      const data = { rob: 3 };
      await instance[name]('007', data);
      expect(calls).toEqual(name === 'updateFleetSpare' ? [['007', data]] : [['007']]);
    }
  });
  it('recurrence uses identical real UPDATE SQL and logs returned rows, not the dropped flag', async () => {
    const rows = [
      { duuid: 'a', vesselId: 'vessel-A', defectCategory: 'Engine' },
      { duuid: 'b', vesselId: 'vessel-A', defectCategory: 'Engine' },
    ];
    const runs = [];
    for (const before of [true, false]) {
      const returned = { duuid: 'persisted', updatedAt: new Date(fixedTime) };
      const c = captureDb([returned]);
      c.db.select = () => ({ from: () => ({ where: async () => rows }) });
      const logs: unknown[][] = [];
      await subject('calculateAndUpdateRecurringDefects', {
        getDb: async () => c.db,
        logFieldChanges: async (...args: unknown[]) => { logs.push(args); },
      }, before).calculateAndUpdateRecurringDefects('vessel-A');
      expect(logs).toHaveLength(2);
      logs.forEach(args => { expect(args[4]).toBe(returned); noSqlObjects(args); });
      runs.push({ queries: c.queries, logs: plain(logs) });
    }
    expect(runs[1]).toEqual(runs[0]);
  });
});
