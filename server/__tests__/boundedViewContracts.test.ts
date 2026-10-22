import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';

// Evaluate small, actual source expressions without importing whole screens,
// mounting providers, bypassing authentication or issuing network requests.
function source(path: string) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node {
  if (predicate(root)) return root;
  let result: ts.Node | undefined;
  ts.forEachChild(root, child => {
    if (!result) {
      try { result = find(child, predicate); } catch { /* Search sibling nodes. */ }
    }
  });
  if (!result) throw new Error('Expected contract expression was not found');
  return result;
}
function variable(root: ts.Node, name: string): ts.Expression {
  const node = find(root, node => ts.isVariableDeclaration(node) && node.name.getText() === name);
  if (!ts.isVariableDeclaration(node) || !node.initializer) throw new Error(`Missing initializer: ${name}`);
  return node.initializer;
}
function evaluate(node: ts.Node, bindings: Record<string, unknown> = {}): unknown {
  const js = ts.transpileModule(`const value = (${node.getText()});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  // Input is the repository's own source, not user-supplied code.
  return new Function(...Object.keys(bindings), `${js}\nreturn value;`)(...Object.values(bindings));
}
function callable(node: ts.Node, bindings: Record<string, unknown> = {}): Function {
  const value = evaluate(node, bindings);
  if (typeof value !== 'function') throw new Error('Expected a function expression');
  return value;
}

const ihm = source('client/src/components/modals/IhmManagementModal.tsx');
const dashboard = source('client/src/pages/pms/Dashboard.tsx');
const jobs = source('client/src/pages/pms/JobsFormPage.tsx');
const surveys = source('client/src/pages/admin/ShipsSurveysAdmin.tsx');

describe('bounded read/view contracts', () => {
  it.each([
    [null, {}],
    [{ presence: 'Present', materials: ['Asbestos'], evidenceType: 'MD', evidenceFileName: 'md.pdf', verifiedDate: '2026-10-04', supplier: 'Supplier', remarks: 'Verified' },
      { presence: 'Present', materials: ['Asbestos'], evidenceType: 'MD', evidenceFileName: 'md.pdf', verifiedDate: '2026-10-04', supplier: 'Supplier', remarks: 'Verified' }],
    [{ presence: '', materials: null, evidenceType: null, evidenceFileName: null, verifiedDate: null, supplier: null, remarks: null },
      { presence: 'Unknown', materials: [], evidenceType: 'None', evidenceFileName: '', verifiedDate: '', supplier: '', remarks: '' }],
  ])('IHM hydration preserves nullable values and existing defaults', (existingData, expected) => {
    const call = find(ihm, node => ts.isCallExpression(node) && node.expression.getText() === 'useEffect');
    if (!ts.isCallExpression(call)) throw new Error('Missing IHM effect');
    const values: Record<string, unknown> = {};
    const bindings: Record<string, unknown> = { existingData };
    for (const [setter, key] of [
      ['setPresence', 'presence'], ['setSelectedMaterials', 'materials'], ['setEvidenceType', 'evidenceType'],
      ['setEvidenceFileName', 'evidenceFileName'], ['setVerifiedDate', 'verifiedDate'], ['setSupplier', 'supplier'], ['setRemarks', 'remarks'],
    ]) bindings[setter] = (value: unknown) => { values[key] = value; };
    Reflect.apply(callable(call.arguments[0], bindings), undefined, []);
    expect(values).toEqual(expected);
  });

  it.each([
    [undefined, false, null],
    [{ vesselWideAccessGranted: false, fallbackMode: 'none' }, false, 'none'],
    [{ vesselWideAccessGranted: false, fallbackMode: 'own-rank' }, false, 'own-rank'],
    [{ vesselWideAccessGranted: true, fallbackMode: 'vessel-wide' }, true, 'vessel-wide'],
  ])('Dashboard retains server-provided scope values', (scopeMeta, granted, fallback) => {
    expect(evaluate(variable(dashboard, 'vesselWideAccessGranted'), { scopeMeta })).toBe(granted);
    expect(evaluate(variable(dashboard, 'fallbackMode'), { scopeMeta })).toBe(fallback);
  });

  it('planner dates retain inclusive start, exclusive end and invalid-date exclusion', () => {
    const parseFlexibleDate = callable(variable(dashboard, 'parseFlexibleDate'));
    const expression = variable(dashboard, 'plannedTodayWOs');
    if (!ts.isCallExpression(expression)) throw new Error('Missing planned-today filter');
    const predicate = callable(expression.arguments[0], {
      parseFlexibleDate,
      todayStart: new Date(2026, 9, 5),
      todayEnd: new Date(2026, 9, 6),
    });
    for (const [plannedDate, expected] of [
      [null, false], [undefined, false], ['invalid', false],
      [new Date(2026, 9, 5).toISOString(), true],
      [new Date(2026, 9, 5, 23, 59, 59).toISOString(), true],
      [new Date(2026, 9, 6).toISOString(), false],
    ]) expect(Reflect.apply(predicate, undefined, [{ plannedDate }])).toBe(expected);
  });

  it('Jobs reads the existing vessel hook data without changing it', () => {
    const declaration = find(jobs, node => ts.isVariableDeclaration(node) &&
      !!node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText() === 'useVessels');
    const vessels = [{ id: 'vessel-A', name: 'Ship A' }];
    const useVessels = vi.fn(() => ({ data: vessels, isLoading: false, error: null }));
    const js = ts.transpileModule(`const ${declaration.getText()};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    expect(new Function('useVessels', `${js}\nreturn vessels;`)(useVessels)).toBe(vessels);
    expect(useVessels).toHaveBeenCalledOnce();
  });

  it.each([
    [{ woTitle: 'Modern title', jobTitle: 'Legacy title' }, 'Modern title'],
    [{ jobTitle: 'Legacy title' }, 'Legacy title'],
    [{}, ''],
  ])('Jobs keeps title normalization, exports and the jobTitle write boundary', (input, title) => {
    const projection = find(jobs, node => ts.isPropertyAssignment(node) &&
      node.name.getText() === 'woTitle' && node.initializer.getText().includes('context.templateData.jobTitle'));
    if (!ts.isPropertyAssignment(projection)) throw new Error('Missing title normalization');
    const woTitle = evaluate(projection.initializer, { context: { templateData: input } });
    expect(woTitle).toBe(title);
    const templateData = { woTitle, componentName: 'Pump', componentCode: '601' };
    expect(evaluate(variable(jobs, 'exportJobTitle'), { templateData })).toBe(title);
    expect(evaluate(variable(jobs, 'pdfJobTitle'), { templateData })).toBe(title || 'Pump');
    const assignment = find(jobs, node => ts.isBinaryExpression(node) &&
      node.left.getText() === 'updatePayload.jobTitle');
    const updatePayload = { juuid: 'job-A', vesselId: 'vessel-A' };
    evaluate(assignment, { templateData, updatePayload });
    expect(updatePayload).toEqual({ juuid: 'job-A', vesselId: 'vessel-A', jobTitle: title });
  });

  it('Survey hydration preserves missing applicability instead of inventing a boolean', () => {
    const call = find(surveys, node => ts.isCallExpression(node) &&
      node.expression.getText() === 'setVesselOnlySurveys' &&
      node.arguments[0]?.getText().startsWith('vesselOnly.map'));
    if (!ts.isCallExpression(call)) throw new Error('Missing survey hydration');
    const vesselOnly = [{ id: 10, masterId: 'VES-10', surveyName: 'Survey A', surveyLabel: '', applicableToCompany: true }];
    const loaded = evaluate(call.arguments[0], { vesselOnly });
    expect(loaded).toEqual([{ ...vesselOnly[0], surveyLabel: 'Survey A' }]);
    expect(JSON.stringify(loaded)).not.toContain('"applicable":');
  });
});
