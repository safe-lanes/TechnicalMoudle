import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const p = createRequire(import.meta.url)('./helpers/lowImpactProbe.cjs');
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const variants = [false, true];
const fixedTime = '2026-10-05T09:00:00.000Z';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(fixedTime)); });
afterEach(() => vi.useRealTimers());

describe('low-impact declarations preserve executable behavior', () => {
  it('company types are explicitly type-only imports', () => {
    const text = p.probe.source('server/postgresStorage.ts');
    const ast = p.probe.ts.createSourceFile('storage.ts', text, p.probe.ts.ScriptTarget.Latest, true);
    const specs = ast.statements.flatMap((n: any) =>
      p.probe.ts.isImportDeclaration(n) ? n.importClause?.namedBindings?.elements || [] : []);
    for (const name of ['CompanyStandardGraceSettings', 'InsertCompanyStandardGraceSettings']) {
      const spec = specs.find((s: any) => s.name.text === name);
      expect(spec?.isTypeOnly).toBe(true);
    }
  });

  it('nullable sibling declarations emit identical methods and do not invent names', () => {
    const method = p.probe.methodText('getComponentSiblings');
    expect(method).toContain('name: string | null');
    expect(p.probe.source('server/storage.ts'))
      .toContain('getComponentSiblings(componentId: string): Promise<Array<{ cuuid: string; name: string | null }>>');
    expect(p.probe.compile(`class Subject { ${method.replace('name: string | null', 'name: string')} }`))
      .toBe(p.probe.compile(`class Subject { ${method} }`));
  });

  it('Vite contextual typing leaves the existing runtime options unchanged', () => {
    const text = p.probe.source('server/vite.ts');
    expect(text).toContain('const serverOptions: ServerOptions =');
    expect(p.probe.compile(text))
      .toBe(p.probe.compile(text.replace('const serverOptions: ServerOptions =', 'const serverOptions =')
        .replace(', type ServerOptions', '')));
    const declaration = p.probe.extract('server/vite.ts', (n: any) =>
      p.probe.ts.isVariableDeclaration(n) && n.name.getText() === 'serverOptions');
    const server = {};
    expect(p.probe.evaluate(`const ${declaration}; module.exports=serverOptions;`, { server }))
      .toEqual({ middlewareMode: true, hmr: { server }, allowedHosts: true });
  });
});

describe('defect link update and field-log preservation', () => {
  async function run(candidate: boolean, existingLinks: unknown, added: string[], missing = false, logFailure = false) {
    const defect = missing ? undefined : {
      id: 'local-defect', duuid: 'canonical-defect', vesselId: 'ship-A', linkedDefects: existingLinks,
    };
    const writes: unknown[] = [];
    const logs: unknown[] = [];
    const reads: string[] = [];
    const db = {
      update: (table: unknown) => ({
        set: (data: unknown) => ({
          where: (predicate: unknown) => ({
            returning: async () => {
              writes.push({ table, data, predicate });
              return [{ ...defect, ...(data as object) }];
            },
          }),
        }),
      }),
    };
    const Subject = p.method('linkDefects', {
      getDb: async () => db, defects: { duuid: 'defects.duuid' }, eq: p.eq,
      logFieldChanges: async (...args: unknown[]) => {
        logs.push(args);
        if (logFailure) throw Error('Fixture logging outage');
      },
    }, candidate);
    const subject = new Subject();
    subject.getDefect = async (id: string) => { reads.push(id); return defect; };
    try {
      const result = await subject.linkDefects('request-id', added);
      return plain({ result, writes, logs, reads });
    } catch (error: any) {
      return plain({ error: error.message, writes, logs, reads });
    }
  }

  it.each([
    [[], [], []],
    [[], ['b', 'a'], ['b', 'a']],
    [['b', 'a'], ['a', 'c', 'b'], ['b', 'a', 'c']],
    [['001'], ['1', '001'], ['001', '1']],
    [null, ['b', 'b'], ['b']],
    ['malformed-legacy-value', ['a'], ['a']],
  ])('preserves full update/log contract for links %j + %j', async (existing, added, expected) => {
    const baseline = await run(false, existing, added as string[]);
    const current = await run(true, existing, added as string[]);
    expect(current).toEqual(baseline);
    expect(current.writes).toEqual([{
      table: { duuid: 'defects.duuid' },
      data: { linkedDefects: expected, updatedAt: fixedTime },
      predicate: ['eq', 'defects.duuid', 'canonical-defect'],
    }]);
    expect(current.logs).toHaveLength(1);
    expect(current.logs[0]).toEqual([
      'defects', 'canonical-defect', 'ship-A',
      { id: 'local-defect', duuid: 'canonical-defect', vesselId: 'ship-A', linkedDefects: existing },
      current.result, 'system',
    ]);
    expect(current.reads).toEqual(['request-id']);
  });

  it.each(variants)('missing defect never updates or logs (candidate=%s)', async candidate => {
    expect(await run(candidate, [], ['a'], true)).toEqual({
      error: 'Defect request-id not found', writes: [], logs: [], reads: ['request-id'],
    });
  });

  it('logging failure still preserves the existing successful update', async () => {
    expect(await run(true, ['a'], ['b'], false, true))
      .toEqual(await run(false, ['a'], ['b'], false, true));
  });
});

describe('maintenance history keeps anomaly query inputs and output', () => {
  async function run(candidate: boolean, ids: (string | null)[]) {
    const history = ids.map((id, i) => ({ id: `history-${i}`, workOrderId: id, vesselCode: 'ship-A' }));
    const q = p.queryDb([history, [
      { workOrderId: 'b', daysLate: 2 }, { workOrderId: 'b', daysLate: 7 },
      { workOrderId: 'a', daysLate: null },
    ]]);
    const Subject = p.method('getMaintenanceHistoryByVessel', {
      getDb: async () => q.db, eq: p.eq, and: p.and, desc: p.desc, sql: p.sql,
      componentMaintenanceHistory: { vesselCode: 'history.vesselCode', dateCompleted: 'history.dateCompleted' },
      workOrderAnomalies: { workOrderId: 'anomalies.workOrderId', daysLate: 'anomalies.daysLate',
        anomalyType: 'anomalies.type' },
    }, candidate);
    return plain({ result: await new Subject().getMaintenanceHistoryByVessel('ship-A'), calls: q.calls });
  }

  it.each([[], ['b'], ['b', 'a', 'b'], [null, 'b', null], ['001', '1', '001']].map(ids => [ids]))(
    'preserves order, null IDs and query/aggregation contract for %j', async ids => {
      const after = await run(true, ids);
      expect(after).toEqual(await run(false, ids));
      expect(after.calls[0].where).toEqual(['eq', 'history.vesselCode', 'ship-A']);
      expect(after.calls[0].orderBy).toEqual(['desc', 'history.dateCompleted']);
      expect(after.result.map((r: any) => r.workOrderId)).toEqual(ids);
      expect(after.result.map((r: any) => r.backdatingDays))
        .toEqual(ids.map(id => id === 'b' ? 7 : 0));
      expect(after.calls).toHaveLength(ids.length ? 2 : 1);
      if (ids.length) {
        const joinedIds = after.calls[1].where[2].values[1].values.map((v: any) => v.values[0]);
        expect(joinedIds).toEqual(Array.from(new Set(ids)));
      }
    },
  );
});

describe('linked-spare ordering and canonical lookup', () => {
  async function run(candidate: boolean, localBase: number, directIds: number[], linkedIds: number[], absent: number[]) {
    const spare = (id: number) => ({ id, suuid: `canonical-${id - localBase}`, vesselId: 'ship-A' });
    const lookups = linkedIds.filter((id, i) =>
      linkedIds.indexOf(id) === i && !directIds.includes(id));
    const q = p.queryDb([
      directIds.map(spare), linkedIds.map(spareId => ({ spareId })),
      ...lookups.map(id => absent.includes(id) ? [] : [spare(id)]),
    ]);
    const trace: string[] = [];
    const Subject = p.method('getSparesWithInventoryByComponentCode', {
      getDb: async () => q.db, eq: p.eq, and: p.and,
      spares: { id: 'spares.id', vesselId: 'spares.vesselId', componentCode: 'spares.componentCode' },
      components: { cuuid: 'components.cuuid', componentCode: 'components.componentCode' },
      spareComponentLinks: { spareId: 'links.spareId', componentId: 'links.componentId', vesselId: 'links.vesselId' },
    }, candidate);
    const subject = new Subject();
    subject.getSpareWithInventory = async (uuid: string) => {
      trace.push(`start:${uuid}`);
      await Promise.resolve();
      trace.push(`end:${uuid}`);
      return { suuid: uuid, vesselId: 'ship-A', rob: 4 };
    };
    return plain({ result: await subject.getSparesWithInventoryByComponentCode('ship-A', '601'),
      calls: q.calls, trace });
  }

  it.each([0, 700])('keeps canonical identities across local-ID base %s', async base => {
    const after = await run(true, base, [base + 2, base + 1, base + 2],
      [base + 1, base + 3, base + 3, base + 4], [base + 4]);
    expect(after).toEqual(await run(false, base, [base + 2, base + 1, base + 2],
      [base + 1, base + 3, base + 3, base + 4], [base + 4]));
    expect(after.result.map((s: any) => s.suuid)).toEqual(['canonical-2', 'canonical-1', 'canonical-3']);
    expect(after.trace).toEqual([
      'start:canonical-2', 'end:canonical-2', 'start:canonical-1', 'end:canonical-1',
      'start:canonical-3', 'end:canonical-3',
    ]);
    expect(after.calls.map((c: any) => c.where)).toEqual([
      ['and', ['eq', 'spares.vesselId', 'ship-A'], ['eq', 'spares.componentCode', '601']],
      ['and', ['eq', 'components.componentCode', '601'], ['eq', 'links.vesselId', 'ship-A']],
      ['eq', 'spares.id', base + 3], ['eq', 'spares.id', base + 4],
    ]);
    expect(after.calls[1].join).toEqual([
      { cuuid: 'components.cuuid', componentCode: 'components.componentCode' },
      ['eq', 'links.componentId', 'components.cuuid'],
    ]);
  });

  it('empty direct and linked rows make no extra lookups', async () => {
    expect(await run(true, 0, [], [], [])).toEqual(await run(false, 0, [], [], []));
    expect((await run(true, 0, [], [], [])).result).toEqual([]);
  });
});

describe('unnamed siblings retain canonical spare links', () => {
  it('returns null names and links by UUID only, without rewriting local IDs', async () => {
    const siblings = [{ cuuid: 'sibling-1', name: null }, { cuuid: 'sibling-2', name: 'Valve' }];
    const q = p.queryDb([[{ cuuid: 'parent-child', parentId: 'parent' }], siblings]);
    const queryClass = p.method('getComponentSiblings', {
      getDb: async () => q.db, eq: p.eq, or: p.or, and: p.and, sql: p.sql,
      components: { cuuid: 'components.cuuid', id: 'components.id', parentId: 'components.parentId' },
    }, true);
    expect(await new queryClass().getComponentSiblings('parent-child')).toEqual(siblings);
    const Subject = p.method('createSiblingLinks', {}, true);
    const subject = new Subject();
    subject.getComponentSiblings = async () => siblings;
    subject.getSpareComponentLinksBySpare = async () => [{ componentId: 'sibling-2' }];
    subject.createSpareComponentLink = vi.fn(async () => ({}));
    expect(await subject.createSiblingLinks(700, 'spare-canonical', 'parent-child', 'ship-A', 'actor')).toBe(1);
    expect(subject.createSpareComponentLink).toHaveBeenCalledExactlyOnceWith({
      spareId: 700, spareUuid: 'spare-canonical', componentId: 'sibling-1',
      vesselId: 'ship-A', linkedBy: 'actor',
    }, true);
  });
});
