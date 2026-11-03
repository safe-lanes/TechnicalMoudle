/**
 * Real source-derived lookups; Drizzle compiles SQL but never executes it.
 * No storage module, live client, server, timers or environment is imported.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { and, eq, or, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { components } from '@shared/schema';
import { ValidationError } from '../modules/shared/errors';

const storagePath = 'server/postgresStorage.ts';
const repoPath = 'server/modules/components/repositories/componentRepository.ts';
const servicePath = 'server/modules/components/services/componentService.ts';
const read = (path: string) => readFileSync(path, 'utf8');
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const compiler = drizzle({});

function extract(path: string, name: string, method = false) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
  const matches: string[] = [];
  function visit(node: ts.Node) {
    if ((method ? ts.isMethodDeclaration(node) : ts.isFunctionDeclaration(node))
      && 'name' in node && node.name?.getText(ast) === name) matches.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  expect(matches).toHaveLength(1);
  return matches[0];
}

function evaluate(text: string, globals: Record<string, unknown>) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  expect(compiled.diagnostics).toEqual([]);
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, ...globals,
    require(id: string) { throw new Error(`Blocked lookup import: ${id}`); },
  }, { timeout: 5000 });
  return module.exports;
}

function harness(before: boolean, replies: Record<string, unknown>[][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const queue = [...replies];
  const getDb = async () => ({
    select: () => ({
      from: (table: typeof components) => ({
        where: (predicate: ReturnType<typeof and>) => {
          queries.push(compiler.select().from(table).where(predicate).toSQL());
          if (!queue.length) throw new Error('Unexpected query');
          return Promise.resolve(queue.shift());
        },
      }),
    }),
  });
  const byCode = extract(storagePath, 'getComponentByCode', true);
  const codeSource = before ? byCode.replace('vesselId: string | null', 'vesselId: string') : byCode;
  const getComponent = extract(storagePath, 'getComponent', true);
  const Store = evaluate(`class Store { ${getComponent}\n${codeSource} }\nmodule.exports = Store;`,
    { getDb, and, eq, or, isNull, components });
  const storage = new Store();
  const augmentWithSortOrder = vi.fn(async (rows: Record<string, unknown>[]) =>
    rows.map(row => ({ ...row, sortOrder: 17 })));
  const repo = extract(repoPath, 'findByIdOrCode');
  const repoSource = before ? repo.replace('vesselId: string | null', 'vesselId: string') : repo;
  const find = evaluate(`${repoSource}\nmodule.exports = findByIdOrCode;`,
    { storage, augmentWithSortOrder });
  return { storage, find, queries, augmentWithSortOrder };
}

describe('nullable vessel declaration preserves lookup SQL and execution order', () => {
  it.each(['vessel-A', null])('retains ID/UUID-first lookup without vessel scoping: %s', async vesselId => {
    const runs = [];
    for (const before of [true, false]) {
      const h = harness(before, [[{ id: 'local-id', cuuid: 'canonical-id', vesselId: 'other-vessel' }]]);
      const result = await h.find('canonical-id', vesselId);
      expect(result).toMatchObject({ vesselId: 'other-vessel', sortOrder: 17 });
      expect(h.queries).toHaveLength(1);
      expect(h.queries[0].sql).toContain('"cuuid" = $1');
      expect(h.queries[0].params).toEqual(['canonical-id', 'canonical-id', false]);
      expect(h.augmentWithSortOrder).toHaveBeenCalledTimes(1);
      runs.push({ result: plain(result), queries: h.queries });
    }
    expect(runs[1]).toEqual(runs[0]);
  });

  it.each(['vessel-A', null])('retains the code equality predicate and bound vessel value: %s', async vesselId => {
    const runs = [];
    for (const before of [true, false]) {
      const h = harness(before, [[], [{ id: 'code-id', componentCode: '651.001', vesselId }]]);
      const result = await h.find('651.001', vesselId);
      expect(h.queries).toHaveLength(2);
      expect(h.queries[1].sql).toContain('"vessel_id" = $2');
      expect(h.queries[1].sql).not.toContain('"vessel_id" is null');
      expect(h.queries[1].params).toEqual(['651.001', vesselId, false]);
      expect(h.augmentWithSortOrder).toHaveBeenCalledTimes(1);
      runs.push({ result: plain(result), queries: h.queries });
    }
    expect(runs[1]).toEqual(runs[0]);
  });

  it.each(['vessel-A', null])('returns undefined when neither lookup matches: %s', async vesselId => {
    const runs = [];
    for (const before of [true, false]) {
      const h = harness(before, [[], []]);
      expect(await h.find('missing', vesselId)).toBeUndefined();
      expect(h.queries).toHaveLength(2);
      expect(h.augmentWithSortOrder).not.toHaveBeenCalled();
      runs.push(h.queries);
    }
    expect(runs[1]).toEqual(runs[0]);
  });

  it('preserves the real missing-master service ValidationError for a null-context lookup', async () => {
    const service = read(servicePath);
    const start = service.indexOf('      const masterComponent = await repo.findByIdOrCode(effectiveMasterId, existingComponent.vesselId);');
    const end = service.indexOf('      if (masterComponent.vesselId !== existingComponent.vesselId)', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const branch = service.slice(start, end);
    const runs = [];
    for (const before of [true, false]) {
      const h = harness(before, [[], []]);
      const check = evaluate(`module.exports = async function () { ${branch} };`, {
        repo: { findByIdOrCode: h.find }, effectiveMasterId: 'missing',
        existingComponent: { vesselId: null }, ValidationError,
      });
      await expect(check()).rejects.toThrow(ValidationError);
      const fresh = harness(before, [[], []]);
      const exact = evaluate(`module.exports = async function () { ${branch} };`, {
        repo: { findByIdOrCode: fresh.find }, effectiveMasterId: 'missing',
        existingComponent: { vesselId: null }, ValidationError,
      });
      await expect(exact()).rejects.toMatchObject({
        name: 'ValidationError', statusCode: 400, message: 'Master component not found',
      });
      runs.push(h.queries);
    }
    expect(runs[1]).toEqual(runs[0]);
  });

  it('denies imports and omits process, network and timers', () => {
    expect(evaluate('module.exports = [typeof process, typeof fetch, typeof setTimeout, typeof setInterval];', {}))
      .toEqual(['undefined', 'undefined', 'undefined', 'undefined']);
    expect(() => evaluate("require('../db');", {})).toThrow('Blocked lookup import');
  });
});
