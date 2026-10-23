import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { getTableSyncConfig } from '../../../../shared/syncConfig';

const filePath = path.resolve(process.cwd(), 'server/modules/sync/oneWayApplier.ts');
const text = fs.readFileSync(filePath, 'utf8');
const ast = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
const names = ['toSnakeCase', 'coerceArrayValue', 'coerceValue', 'buildUpdatePairs', 'buildInsertParts'];
const functions = ast.statements.filter(node =>
  ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text),
).map(node => node.getText(ast).replace(/^export /, ''));
if (functions.length !== names.length) throw new Error('Incomplete real sync fixture');
const emitted = ts.transpileModule(
  `const SKIP_UPDATE_COLUMNS = new Set(['id', 'created_at', 'createdAt']); ${functions.join('\n')}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
const { buildUpdatePairs, buildInsertParts } = new Function(
  `${emitted}; return { buildUpdatePairs, buildInsertParts };`,
)();

const meta = {
  jsonCols: new Set(['office_reviewer_role_ruids']),
  arrayCols: new Set(), identityAlwaysCols: new Set(),
  allCols: new Set(['juuid', 'office_reviewer_role_ruids', 'job_title']),
};

describe('Office Reviewer existing one-way sync serializer', () => {
  it('keeps Job direction/identity and uses no field logger registration', () => {
    expect(getTableSyncConfig('jobs')).toMatchObject({
      category: 'ONE_WAY_SHORE_TO_SHIP', identityColumn: 'juuid', direction: 'shore_to_ship',
    });
  });
  it.each([{ roles: ['A', 'C'] }, { roles: ['C'] }, { roles: [] }])('serializes native arrays correctly for INSERT and UPDATE: $roles', ({ roles }) => {
    const insert = buildInsertParts({ juuid: 'same-uuid', officeReviewerRoleRuids: roles }, meta);
    expect(insert.columns).toContain('"office_reviewer_role_ruids"');
    expect(JSON.parse(insert.values[1])).toEqual(roles);
    const update = buildUpdatePairs({ juuid: 'same-uuid', officeReviewerRoleRuids: roles }, 'juuid', meta);
    expect(update.setClauses).toEqual(['"office_reviewer_role_ruids" = $1']);
    expect(JSON.parse(update.values[0])).toEqual(roles);
    expect(Array.isArray(JSON.parse(update.values[0]))).toBe(true);
  });
  it('preserves omitted selection and propagates an explicit SQL NULL', () => {
    const omitted = buildUpdatePairs({ jobTitle: 'Updated' }, 'juuid', meta);
    expect(omitted.setClauses).not.toContain('"office_reviewer_role_ruids" = $1');
    const nullValue = buildUpdatePairs({ officeReviewerRoleRuids: null }, 'juuid', meta);
    expect(nullValue.values).toEqual([null]);
  });
  it('documents why an old receiver requires migration/restart before delivery', () => {
    const oldMeta = { ...meta, allCols: new Set(['juuid']) };
    expect(buildUpdatePairs({ officeReviewerRoleRuids: ['A'] }, 'juuid', oldMeta).setClauses).toEqual([]);
  });
});
