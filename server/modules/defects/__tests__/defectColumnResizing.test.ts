import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync('client/src/index.css', 'utf8'));

describe.each(['DefectsLogWithTabs', 'DefectsCoC'])('%s column resizing', page => {
  const source = readFileSync(`client/src/pages/defects/${page}.tsx`, 'utf8');
  const ast = ts.createSourceFile(`${page}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let grid: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined;
  let columns = '';
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === 'AgGridTable') grid = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'columnDefs') columns = node.initializer!.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);

  it('opts only this table into visible handles and preserved column widths', () => {
    expect(grid).toBeDefined();
    const attrs = grid!.attributes.properties.filter(ts.isJsxAttribute);
    expect(attrs.find(a => a.name.getText(ast) === 'preserveColumnWidths')?.initializer).toBeUndefined();
    expect(attrs.some(a => a.name.getText(ast) === 'preserveColumnWidths')).toBe(true);
    expect(attrs.find(a => a.name.getText(ast) === 'className')?.initializer?.getText(ast)).toBe('"defects-resizable-grid"');
  });

  it.each([false, true])('keeps every column, including Actions, resizable with resolved=%s', includesResolved => {
    expect(columns).not.toBe('');
    const renderers = ['TwoLineDateCellRenderer', 'CategoryCellRenderer', 'HtmlTextCellRenderer',
      'StatusCellRenderer', 'PriorityCellRenderer', 'ActionsCellRenderer'];
    const code = transformSync(`const columns = ${columns};`, { loader: 'ts' }).code;
    const defs = new Function(...renderers, 'includesResolved', `${code}\nreturn columns;`)(
      ...renderers.map(() => () => null), includesResolved,
    );
    expect(defs.length).toBeGreaterThan(5);
    expect(defs.find((def: any) => def.field === 'actions')).toMatchObject({ resizable: true });
    expect(defs.every((def: any) => def.resizable === true)).toBe(true);
    // Stateful flex is reapplied on grid definition updates; initialFlex leaves user widths intact.
    expect(defs.every((def: any) => def.initialFlex > 0 && def.flex === undefined)).toBe(true);
  });

  it('does not refit columns on grid ready or browser resize', () => {
    expect(source).not.toContain('.sizeColumnsToFit(');
    expect(source).toContain('setGridApi(');
  });

  it('uses a loading overlay instead of unmounting the grid during filter requests', () => {
    let node: ts.Node | undefined = grid;
    while (node && !ts.isFunctionDeclaration(node)) {
      expect(ts.isConditionalExpression(node) && node.condition.getText(ast) === 'isLoading').toBe(false);
      node = node.parent;
    }
    const options = grid!.attributes.properties.filter(ts.isJsxAttribute)
      .find(attr => attr.name.getText(ast) === 'gridOptions')!.initializer!.getText(ast);
    expect(options).toContain('loading: isLoading');
  });
});

it('exposes drag handles only in the scoped defect grids', () => {
  const declarations: Record<string, string> = {};
  css.walkRules('.ag-theme-alpine.defects-resizable-grid .ag-header-cell-resize', rule => {
    rule.walkDecls(decl => { declarations[decl.prop] = decl.value; });
  });
  expect(parseFloat(declarations.width)).toBeGreaterThan(0);
  expect(parseFloat(declarations.opacity)).toBeGreaterThan(0);
  expect(declarations.cursor).toBe('col-resize');
});

it('leaves the existing global hidden-resize-handle rule unchanged', () => {
  const declarations: Record<string, string> = {};
  css.walkRules('.ag-theme-alpine .ag-header-cell-resize', rule => {
    rule.walkDecls(decl => { declarations[decl.prop] = decl.value; });
  });
  expect(declarations).toEqual({ width: '0', opacity: '0' });
});
