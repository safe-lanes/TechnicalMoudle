import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Captured verbatim from the repository before the approved change.
// This baseline is source, not a separately implemented lookup replica.
const originalSource = `export async function findByIdOrCode(id: string, vesselId: string): Promise<Component | undefined> {
  const byId = await storage.getComponent(id);
  if (byId) {
    const [augmented] = await augmentWithSortOrder([byId]);
    return augmented;
  }
  const byCode = await storage.getComponentByCode(id, vesselId);
  if (byCode) {
    const [augmented] = await augmentWithSortOrder([byCode]);
    return augmented;
  }
  return undefined;
}`;

const repositoryPath = 'server/modules/components/repositories/componentRepository.ts';
const ast = ts.createSourceFile(
  repositoryPath, readFileSync(repositoryPath, 'utf8'), ts.ScriptTarget.Latest, true,
);
const matches = ast.statements.filter(
  node => ts.isFunctionDeclaration(node) && node.name?.text === 'findByIdOrCode',
);
if (matches.length !== 1) throw new Error('Expected exactly one real findByIdOrCode function');
const candidateSource = matches[0].getText(ast);

type Row = { id: string; vesselId?: string | null; sortOrder?: number };
type Lookup = (id: string, vesselId: unknown) => Promise<Row | undefined>;
type StorageStub = {
  getComponent: (id: string) => Promise<Row | undefined>;
  getComponentByCode: (id: string, vesselId: unknown) => Promise<Row | undefined>;
};
type AugmentStub = (rows: Row[]) => Promise<Row[]>;

function evaluate(source: string, storage: StorageStub, augmentWithSortOrder: AugmentStub): Lookup {
  const module: { exports: { findByIdOrCode?: Lookup } } = { exports: {} };
  const javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(javascript, {
    module,
    exports: module.exports,
    storage,
    augmentWithSortOrder,
    console: { log() {}, warn() {}, error() {} },
    require(name: string) { throw new Error(`Nullable master lookup blocked import: ${name}`); },
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const lookup = module.exports.findByIdOrCode;
  if (typeof lookup !== 'function') throw new Error('Real lookup was not exported');
  return lookup;
}

async function fixture(source: string, vesselId: unknown, idHit: boolean, fallbackHit: boolean) {
  const calls: unknown[][] = [];
  // Deliberately not vessel-matched: ID-first reads must not gain a vessel filter.
  const byId = Object.freeze({ id: 'id-row', vesselId: 'different-vessel', sortOrder: -1 });
  const byCode = Object.freeze({ id: 'code-row', vesselId: 'ship-A', sortOrder: -2 });
  const augmented = Object.freeze({ id: 'augmented-row', sortOrder: 73 });
  const lookup = evaluate(source, {
    async getComponent(id) {
      calls.push(['getComponent', id]);
      return idHit ? byId : undefined;
    },
    async getComponentByCode(id, vessel) {
      calls.push(['getComponentByCode', id, vessel]);
      // NULL equality cannot yield a fallback hit under the actual SQL.
      return vessel === null ? undefined : fallbackHit ? byCode : undefined;
    },
  }, async rows => {
    calls.push(['augmentWithSortOrder', Array.from(rows)]);
    return [augmented];
  });
  const result = await lookup('master-reference', vesselId);
  return { result, calls, byId, byCode, augmented };
}

const vessels = [
  { label: 'null', value: null },
  { label: 'nonempty string', value: 'ship-A' },
  { label: 'empty string', value: '' },
  { label: 'runtime undefined', value: undefined },
];

describe('nullable master lookup: complete real function against captured original', () => {
  it('changes only the declared vessel type and strict-null skip after ID miss', () => {
    const expected = originalSource
      .replace('vesselId: string)', 'vesselId: string | null)')
      .replace('  const byCode =', '  if (vesselId === null) return undefined;\n  const byCode =');
    expect(candidateSource).toBe(expected);
  });

  for (const { label, value } of vessels) {
    it(`${label}: ID hit preserves unfiltered precedence and exact augmented result`, async () => {
      const before = await fixture(originalSource, value, true, true);
      const after = await fixture(candidateSource, value, true, true);
      expect(after.calls).toEqual(before.calls);
      expect(after.calls).toEqual([
        ['getComponent', 'master-reference'],
        ['augmentWithSortOrder', [after.byId]],
      ]);
      expect(before.result).toBe(before.augmented);
      expect(after.result).toBe(after.augmented);
      expect(after.result).not.toBe(after.byId);
      expect(after.result).toEqual(before.result);
    });

    if (value === null) {
      it('null: ID miss preserves undefined result and omits only the NULL code query', async () => {
        const before = await fixture(originalSource, value, false, false);
        const after = await fixture(candidateSource, value, false, false);
        expect(before.result).toBeUndefined();
        expect(after.result).toBeUndefined();
        expect(before.calls).toEqual([
          ['getComponent', 'master-reference'],
          ['getComponentByCode', 'master-reference', null],
        ]);
        expect(after.calls).toEqual([['getComponent', 'master-reference']]);
      });
    } else {
      for (const fallbackHit of [false, true]) {
        it(`${label}: ID miss/fallback ${fallbackHit ? 'hit' : 'miss'} preserves arguments, calls and result`, async () => {
          const before = await fixture(originalSource, value, false, fallbackHit);
          const after = await fixture(candidateSource, value, false, fallbackHit);
          const expected: unknown[][] = [
            ['getComponent', 'master-reference'],
            ['getComponentByCode', 'master-reference', value],
          ];
          if (fallbackHit) expected.push(['augmentWithSortOrder', [after.byCode]]);
          expect(after.calls).toEqual(before.calls);
          expect(after.calls).toEqual(expected);
          expect(after.result).toEqual(before.result);
          if (fallbackHit) {
            expect(before.result).toBe(before.augmented);
            expect(after.result).toBe(after.augmented);
            expect(after.result).not.toBe(after.byCode);
          } else {
            expect(before.result).toBeUndefined();
            expect(after.result).toBeUndefined();
          }
        });
      }
    }
  }

  it('denies application imports and exposes no process, network or timer globals', async () => {
    const storage: StorageStub = {
      async getComponent() { throw new Error('Unexpected storage access'); },
      async getComponentByCode() { throw new Error('Unexpected storage access'); },
    };
    const augment: AugmentStub = async () => { throw new Error('Unexpected augmentation'); };
    expect(() => evaluate("import '../db';\n" + candidateSource, storage, augment))
      .toThrow('Nullable master lookup blocked import: ../db');
    const inspect = evaluate(`export async function findByIdOrCode() {
      return { id: [typeof process, typeof fetch, typeof XMLHttpRequest,
        typeof WebSocket, typeof setTimeout, typeof setInterval].join(',') };
    }`, storage, augment);
    expect(await inspect('unused', null)).toEqual({
      id: 'undefined,undefined,undefined,undefined,undefined,undefined',
    });
  });
});
