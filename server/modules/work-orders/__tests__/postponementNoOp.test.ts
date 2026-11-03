import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { and, eq, or, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { workOrders } from '@shared/schema';
import { describe, expect, it } from 'vitest';

// Complete real method captured before editing; no hand-written behavior replica.
const originalMethod = `async checkAndRevertPostponedWorkOrders(vesselId?: string): Promise<{
    revertedCount: number;
    revertedWorkOrders: WorkOrder[];
  }> {
    const db = await getDb();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Find postponed work orders past their postponed date.
    // "Awaiting Office Approval" WOs are intentionally excluded — they must not
    // be auto-reverted until the office acts. Only "Postponed" (legacy) and
    // "Postponement Approved" (Plan B) WOs are eligible.
    let query = db.select().from(workOrders)
      .where(and(
        or(
          eq(workOrders.status, 'Postponed'),
          eq(workOrders.status, 'Postponement Approved')
        ),
        eq(workOrders.isActive, true)
      ));
    
    const postponedWOs = await query;
    const revertedWorkOrders: WorkOrder[] = [];
    
    for (const wo of postponedWOs) {
      // Check if vessel filter applies
      if (vesselId && wo.vesselId !== vesselId) continue;
      
      // Check if postponed date has passed
      if (wo.postponedDate && wo.postponedDate <= todayStr) {
        const result = await db.update(workOrders)
          .set({
            status: 'Pending',
            postponedDate: null,
            updatedAt: new Date()
          })
          .where(eq(workOrders.wouuid, wo.wouuid))
          .returning();

        if (result.length > 0) {
          revertedWorkOrders.push(result[0]);
          // Sync field logging — checkAndRevertPostponedWorkOrders
          try { await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, result[0], 'system'); } catch (e) { console.error('[FieldLogger] WO revert postponed:', e); }
        }
      }
    }
    
    return {
      revertedCount: revertedWorkOrders.length,
      revertedWorkOrders,
    };
  }`;

const source = readFileSync('server/postgresStorage.ts', 'utf8');
const ast = ts.createSourceFile('storage.ts', source, ts.ScriptTarget.Latest, true);
const methods: ts.MethodDeclaration[] = [];
function visit(node: ts.Node) {
  if (ts.isMethodDeclaration(node)
    && node.name.getText(ast) === 'checkAndRevertPostponedWorkOrders') methods.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
if (methods.length !== 1) throw new Error('Expected one real postponement method');
const changedMethod = methods[0].getText(ast);

class FrozenDate extends Date {
  constructor() { super('2026-11-03T00:00:00.000Z'); }
  static now() { return new Date('2026-11-03T00:00:00.000Z').getTime(); }
}

type Result = { revertedCount: number; revertedWorkOrders: unknown[] };
type Subject = { checkAndRevertPostponedWorkOrders: (vesselId?: string) => Promise<Result> };

async function run(method: string, endDate: string | undefined, vesselId?: string) {
  const calls: unknown[][] = [];
  let updates = 0;
  let logs = 0;
  let executions = 0;
  const database = drizzle(async () => {
    executions++;
    throw new Error('Postponement no-op forbids database execution');
  });
  const rows = endDate === undefined ? [] : ['ship-A', 'ship-B'].map((vessel, index) => ({
    wouuid: `fixture-wo-${index}`,
    get vesselId() {
      calls.push(['vessel-filter-read', `fixture-wo-${index}`, vessel]);
      return vessel;
    },
    status: index === 0 ? 'Postponed' : 'Postponement Approved',
    isActive: true,
    postponementEndDate: endDate,
  }));
  for (const row of rows) expect(Object.hasOwn(row, 'postponedDate')).toBe(false);
  const fakeDatabase = {
    select() {
      calls.push(['select']);
      return {
        from(table: unknown) {
          expect(table).toBe(workOrders);
          calls.push(['from', 'work_orders']);
          return {
            where(condition: SQL | undefined) {
              const generated = database.select().from(workOrders).where(condition).toSQL();
              calls.push(['where', generated.sql, generated.params]);
              return Promise.resolve(rows);
            },
          };
        },
      };
    },
    update() {
      updates++;
      throw new Error('Postponement no-op forbids updates');
    },
  };
  const module: { exports: { Subject?: new () => Subject } } = { exports: {} };
  const javascript = ts.transpileModule(
    `export class Subject { ${method} }`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  runInNewContext(javascript, {
    module,
    exports: module.exports,
    getDb: async () => {
      calls.push(['getDb']);
      return fakeDatabase;
    },
    workOrders, and, or, eq,
    Date: FrozenDate,
    logFieldChanges() {
      logs++;
      throw new Error('Postponement no-op forbids sync writes');
    },
    console: { log() {}, warn() {}, error() {} },
    require(name: string) { throw new Error(`Postponement no-op blocked import: ${name}`); },
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const Constructor = module.exports.Subject;
  if (typeof Constructor !== 'function') throw new Error('Real method class was not exported');
  const result = await new Constructor().checkAndRevertPostponedWorkOrders(vesselId);
  return { result, calls, updates, logs, executions };
}

describe('complete real postponement method: unchanged no-op', () => {
  for (const { label, endDate } of [
    { label: 'no postponed rows', endDate: undefined },
    { label: 'future DD-Mon-YYYY end date', endDate: '20-Nov-2026' },
    { label: 'overdue DD-Mon-YYYY end date', endDate: '01-Oct-2026' },
  ]) {
    for (const vesselId of [undefined, 'ship-A', 'other-vessel']) {
      it(`${label}, vessel ${vesselId ?? 'unfiltered'}: same select, filtering and result; zero updates`, async () => {
        const before = await run(originalMethod, endDate, vesselId);
        const after = await run(changedMethod, endDate, vesselId);
        expect(before.result).toEqual({ revertedCount: 0, revertedWorkOrders: [] });
        expect(after.result).toEqual(before.result);
        expect(after.calls).toEqual(before.calls);
        expect(after.calls.slice(0, 3)).toEqual([
          ['getDb'], ['select'], ['from', 'work_orders'],
        ]);
        expect(after.calls[3][0]).toBe('where');
        expect(after.calls[3][2]).toEqual(['Postponed', 'Postponement Approved', true]);
        expect(after.calls.slice(4)).toEqual(vesselId && endDate ? [
          ['vessel-filter-read', 'fixture-wo-0', 'ship-A'],
          ['vessel-filter-read', 'fixture-wo-1', 'ship-B'],
        ] : []);
        for (const result of [before, after]) {
          expect(result.updates).toBe(0);
          expect(result.logs).toBe(0);
          expect(result.executions).toBe(0);
        }
      });
    }
  }

  it('keeps the complete method unchanged apart from the exact dead-block replacement', () => {
    const originalAst = ts.createSourceFile(
      'original.ts', `class Original { ${originalMethod} }`, ts.ScriptTarget.Latest, true,
    );
    const blocks: ts.IfStatement[] = [];
    function find(node: ts.Node) {
      if (ts.isIfStatement(node)
        && node.expression.getText(originalAst) === 'wo.postponedDate && wo.postponedDate <= todayStr') {
        blocks.push(node);
      }
      ts.forEachChild(node, find);
    }
    find(originalAst);
    if (blocks.length !== 1) throw new Error('Expected one original dead block');
    const deadBlock = blocks[0].getText(originalAst);
    expect(changedMethod).toBe(originalMethod.replace(deadBlock,
      '// Postponement expiry not implemented; stored dates use DD-Mon-YYYY, so a separate approved task must handle parsing before activating it.',
    ));
    expect(changedMethod).toContain('const todayStr = today.toISOString().split');
    expect(new FrozenDate().toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  it('method sandbox denies imports and exposes no process, network or timers', async () => {
    await expect(run("async checkAndRevertPostponedWorkOrders() { require('../db'); }", undefined))
      .rejects.toThrow('Postponement no-op blocked import');
    for (const identifier of ['process', 'fetch', 'WebSocket', 'XMLHttpRequest', 'setTimeout', 'setInterval']) {
      await expect(run(`async checkAndRevertPostponedWorkOrders() { ${identifier}(); }`, undefined))
        .rejects.toThrow(`${identifier} is not defined`);
    }
  });
});
