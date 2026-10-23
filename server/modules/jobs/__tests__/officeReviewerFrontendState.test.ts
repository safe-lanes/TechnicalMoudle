import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
import { officeReviewerRolesEqual } from '../../../../shared/officeReviewer';

const text = fs.readFileSync('client/src/hooks/useModifyMode.ts', 'utf8');
const ast = ts.createSourceFile('useModifyMode.ts', text, ts.ScriptTarget.Latest, true);
let callback: ts.Node | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'trackFieldChange'
      && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
}
visit(ast);
if (!callback) throw new Error('Modify-mode callback fixture missing');
const js = ts.transpileModule(`const track = ${callback.getText(ast)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

describe('Work Order Modify PMS reviewer-array tracking', () => {
  it('retains the original array across edits and removes reverted/reordered selections', () => {
    let state: any = { originalSnapshot: { officeReviewerRoleRuids: ['A', 'B'] }, fieldChanges: {} };
    const track = new Function('setState', 'officeReviewerRolesEqual', `${js}; return track;`)(
      (update: any) => { state = update(state); }, officeReviewerRolesEqual,
    );
    track('officeReviewerRoleRuids', ['A', 'C'], ['A', 'B']);
    track('officeReviewerRoleRuids', ['C'], ['A', 'C']);
    expect(state.fieldChanges.officeReviewerRoleRuids.originalValue).toEqual(['A', 'B']);
    expect(state.fieldChanges.officeReviewerRoleRuids.currentValue).toEqual(['C']);
    track('officeReviewerRoleRuids', ['B', 'A'], ['C']);
    expect(state.fieldChanges).toEqual({});
    track('officeReviewerRoleRuids', [], ['A', 'B']);
    expect(state.fieldChanges.officeReviewerRoleRuids.currentValue).toEqual([]);
  });
});
