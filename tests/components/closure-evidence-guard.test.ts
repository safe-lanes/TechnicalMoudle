/**
 * Defects C1 Attachment(s) popup — removing closure evidence is refused at once (QA round 3 DF-09, 28-Oct-2026).
 *   node --import tsx --test tests/components/closure-evidence-guard.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CLOSURE_EVIDENCE_PROTECTED_MESSAGE, closureEvidenceRemovalRefusal, isClosedDefect, protectedClosureEvidenceIds, savedAttachmentIds,
} from '../../client/src/pages/defects/closureEvidenceGuard';

const files = [{ id: 'ev-1', name: 'rectified.png' }, { id: 'ev-2', name: 'old.png' }];

test('closed = confirmCompleted or a closed-like status, exactly as the server decides it', () => {
  assert.equal(isClosedDefect({ confirmCompleted: true }), true);
  assert.equal(isClosedDefect({ status: 'Closed' }), true);
  assert.equal(isClosedDefect({ status: ' resolved ' }), true);
  assert.equal(isClosedDefect({ status: 'Open', confirmCompleted: false }), false);
  assert.equal(isClosedDefect(null), false);
});

test('open defect, no rejected closures: every file may be removed', () => {
  const d = { status: 'Open', confirmCompleted: false, attachments: files };
  assert.equal(closureEvidenceRemovalRefusal('ev-1', d, []), null);
  assert.equal(closureEvidenceRemovalRefusal('ev-2', d, undefined), null);
});

test('closed defect: every saved file is protected (the DF-09 case)', () => {
  const d = { status: 'Closed', confirmCompleted: true, attachments: files };
  assert.equal(closureEvidenceRemovalRefusal('ev-1', d, []), CLOSURE_EVIDENCE_PROTECTED_MESSAGE);
  assert.equal(closureEvidenceRemovalRefusal('ev-2', d, []), CLOSURE_EVIDENCE_PROTECTED_MESSAGE);
  assert.equal(closureEvidenceRemovalRefusal('brand-new-unsaved', d, []), null, 'a file not yet saved on the defect is not protected');
});

test('reopened after a rejected closure: only the evidence of that attempt stays protected', () => {
  const d = { status: 'Open', confirmCompleted: false, attachments: files };
  const history = [{ closureFiles: ['ev-1'] }, { closureFiles: null }];
  assert.equal(closureEvidenceRemovalRefusal('ev-1', d, history), CLOSURE_EVIDENCE_PROTECTED_MESSAGE);
  assert.equal(closureEvidenceRemovalRefusal('ev-2', d, history), null);
  assert.deepEqual([...protectedClosureEvidenceIds(d, history)], ['ev-1']);
});

test('attachment ids are read like the server reads them', () => {
  assert.deepEqual(savedAttachmentIds([{ id: 'a' }, { id: '' }, { name: 'no id' }, null, { id: 7 }]), ['a']);
  assert.deepEqual(savedAttachmentIds('not a list'), []);
});

test('the C1 Attachment(s) dialog is wired to the guard', () => {
  const src = readFileSync(new URL('../../client/src/pages/defects/DefectFormWizard.tsx', import.meta.url), 'utf8');
  assert.match(src, /import \{ closureEvidenceRemovalRefusal \} from "\.\/closureEvidenceGuard"/);
  assert.match(src, /title="C1 Attachments - Rectification Documentation"[\s\S]{0,200}canRemove=\{\(a\) => closureEvidenceRemovalRefusal\(a\.id, currentDefect, closureHistory\.data\)\}/);
  const dialog = readFileSync(new URL('../../client/src/components/FileAttachmentDialog.tsx', import.meta.url), 'utf8');
  assert.match(dialog, /const refusal = canRemove\?\.\(attachment\);[\s\S]{0,200}variant: 'destructive'[\s\S]{0,40}return;/, 'the dialog must refuse before it removes');
});
