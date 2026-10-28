/**
 * Work Instructions dialog — Open / Download must go through the authenticated fetch helpers,
 * never a plain browser link (28-Oct-2026, QA WI-03/WI-04/WO-02/WO-04: the PDF opened on the
 * vessel but failed in the office — a navigated <a href> carries no Bearer / x-user-* headers,
 * which a multi-tenant office refuses with 401).
 *
 * Source-contract test in the style of the other tests in this folder:
 *   node --import tsx --test tests/components/work-instructions-authed-open.test.ts
 * Set WI_DIALOG_SOURCE=<path> to point it at another copy of the dialog (instrument check).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const sourcePath = process.env.WI_DIALOG_SOURCE ?? 'client/src/components/WorkInstructionsDialog.tsx';
const text = readFileSync(process.env.WI_DIALOG_SOURCE ? sourcePath : new URL(sourcePath, root), 'utf8');
const source = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

type Found = { testId: string; node: ts.JsxOpeningLikeElement };
const elements: Found[] = [];
function walk(node: ts.Node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    const attr = node.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'data-testid');
    const id = attr?.initializer?.getText() ?? '';
    if (/wi-open-|wi-download-/.test(id)) elements.push({ testId: id, node });
  }
  ts.forEachChild(node, walk);
}
walk(source);
const attrText = (el: ts.JsxOpeningLikeElement, name: string) =>
  el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name)?.initializer?.getText() ?? null;

test('the Open and Download controls exist (one each)', () => {
  assert.equal(elements.filter((e) => e.testId.includes('wi-open-')).length, 1);
  assert.equal(elements.filter((e) => e.testId.includes('wi-download-')).length, 1);
});

test('neither control is a navigated link: no <a href>, no target=_blank, no window.open', () => {
  for (const { node } of elements) {
    assert.notEqual(node.tagName.getText(), 'a', 'must not be an <a>');
    assert.equal(attrText(node, 'href'), null, 'must not carry href');
    assert.equal(attrText(node, 'target'), null, 'must not carry target');
    assert.ok(attrText(node, 'onClick'), 'must act through onClick');
  }
  assert.doesNotMatch(text, /window\.open\(/, 'the dialog itself must not navigate');
});

test('Open and Download call the authenticated helpers from @/lib/authedDownload', () => {
  assert.match(text, /import \{[^}]*downloadAuthedFile[^}]*\} from "@\/lib\/authedDownload"/);
  assert.match(text, /import \{[^}]*viewAuthedDocument[^}]*\} from "@\/lib\/authedDownload"/);
  const open = elements.find((e) => e.testId.includes('wi-open-'))!;
  const download = elements.find((e) => e.testId.includes('wi-download-'))!;
  assert.match(attrText(open.node, 'onClick')!, /onOpen\(/);
  assert.match(attrText(download.node, 'onClick')!, /onDownload\(/);
  assert.match(text, /const onOpen = [\s\S]*?viewAuthedDocument\(openUrl\([^)]*true\)\)/);
  assert.match(text, /const onDownload = [\s\S]*?downloadAuthedFile\(openUrl\([^)]*false\),\s*f\.fileName\)/);
});

test('the download URL still targets the work-instruction-files download route (inline for Open)', () => {
  assert.match(text, /\/technical\/api\/work-instruction-files\/\$\{encodeURIComponent\(f\.jwfuuid\)\}\/download\$\{inline \? "\?inline=1" : ""\}/);
});
