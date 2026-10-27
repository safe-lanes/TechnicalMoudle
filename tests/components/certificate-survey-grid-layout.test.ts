import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const parse = (path: string) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const property = (node: ts.ObjectLiteralExpression, name: string) =>
  node.properties.find((p): p is ts.PropertyAssignment =>
    ts.isPropertyAssignment(p) && p.name.getText() === name)?.initializer;
function objects(source: ts.SourceFile) {
  const result: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

for (const [page, nameField] of [['CertificatesPage', 'certificateName'], ['SurveysPage', 'surveyName']]) {
  test(`${page}: long-text columns remain resizable, contained and tooltip-enabled without growing rows`, () => {
    const path = `client/src/pages/cert-surveys/${page}.tsx`;
    const source = parse(path);
    const allObjects = objects(source);
    for (const field of [nameField, 'type', 'vessel']) {
      const col = allObjects.find(node => {
        const value = property(node, 'field');
        return value && ts.isStringLiteral(value) && value.text === field;
      });
      assert.ok(col, `column ${field} exists`);
      assert.equal(property(col, 'resizable')?.kind, ts.SyntaxKind.TrueKeyword);
      assert.equal(property(col, 'cellClass')?.getText(), "'cert-survey-long-text'");
      assert.ok(property(col, 'tooltipValueGetter'), `${field} exposes full hover text`);
      assert.ok(Number(property(col, 'width')?.getText()) > Number(property(col, 'minWidth')?.getText()),
        `${field} can be narrowed as well as widened`);
      assert.equal(property(col, 'flex'), undefined, 'responsive flex must not overwrite manual widths');
      assert.notEqual(property(col, 'autoHeight')?.kind, ts.SyntaxKind.TrueKeyword);
    }
    assert.ok(allObjects.some(node => property(node, 'rowHeight')?.getText() === '46'));
    assert.doesNotMatch(source.text, /sizeColumnsToFit|addEventListener\(['"]resize/);
    assert.match(source.text, /preserveColumnWidths/);
    assert.match(source.text, /className="cert-survey-grid"/);
    assert.doesNotMatch(source.text, /autoHeight:\s*true/);
    if (page === 'CertificatesPage') {
      const group = allObjects.find(node => property(node, 'field')?.getText() === "'type'")!;
      assert.match(property(group, 'tooltipValueGetter')!.getText(), /formatCompanyGroup\(params.value\)/,
        'tooltip must use the displayed group label, not its saved code');
    }
  });
}

test('the shared grid opts out of both responsive sizing paths without changing other grids by default', () => {
  const source = read('client/src/components/AgGrid/AgGridTable.tsx');
  assert.match(source, /preserveColumnWidths\s*=\s*false/);
  assert.match(source, /if \(!preserveColumnWidths\)\s*{\s*handleResponsiveGrid\(event.api\)/);
  assert.match(source, /if \(!preserveColumnWidths && gridApiRef.current/);
  // AG Grid forces the inner value wrapper when text selection is enabled.
  // The scoped clamp/overflow styles intentionally target that wrapper.
  assert.match(source, /enableCellTextSelection:\s*true/);
});

test('containment and usable resize handles are scoped; action cells and date editors are not blanket-clipped', () => {
  const source = read('client/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const scopedRules = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.includes('.cert-survey-grid'));
  assert.ok(scopedRules.length > 0);
  for (const [, selectors] of scopedRules) {
    for (const selector of selectors.split(',')) assert.match(selector, /\.cert-survey-grid/);
  }
  const handles = scopedRules.find(([, selector]) => selector.trim().endsWith('.ag-header-cell-resize'));
  assert.ok(handles);
  assert.match(handles[2], /width:\s*12px/);
  assert.match(handles[2], /cursor:\s*col-resize/);
  const clamp = scopedRules.find(([, , body]) => body.includes('-webkit-line-clamp'));
  assert.ok(clamp);
  assert.match(clamp[2], /-webkit-line-clamp:\s*2/);
  const clipping = scopedRules.filter(([, , body]) => /overflow:\s*hidden/.test(body));
  assert.ok(clipping.every(([, selectors]) => selectors.includes('.cert-survey-long-text')));
  assert.ok(clipping.some(([, selectors]) => selectors.includes(':not(.ag-cell-inline-editing)')));
});
