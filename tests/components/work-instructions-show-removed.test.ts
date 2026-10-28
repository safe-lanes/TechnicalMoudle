/**
 * Work Instructions dialog — "Show removed" must be reachable (28-Oct-2026, QA WI-13 / SH-06, Jeevan Issue 02).
 *   node --import tsx --test tests/components/work-instructions-show-removed.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  removedToggleLabel, showRemovedToggle, splitWorkInstructionRows, workInstructionRowMeta, workInstructionsListUrl,
} from '../../client/src/components/workInstructionsList';

const row = (id: string, isDeleted: boolean, removedAt: string | null = null) => ({
  jwluuid: id, jobId: 'job-1', vesselId: 'v', isDeleted, attachedAt: '2026-10-20T00:00:00Z', removedAt,
  file: { jwfuuid: 'f', fileName: 'Pump_Overhaul.pdf', fileSize: 2048, revisionRemarks: null, uploadedAt: '2026-10-19T00:00:00Z', isDeleted: false },
});

test('a Job list always asks for removed links; a Work Order list stays current-only', () => {
  assert.equal(workInstructionsListUrl('job 1', null), '/technical/api/jobs/job%201/work-instructions?includeRemoved=1');
  assert.equal(workInstructionsListUrl(null, 'wo-1'), '/technical/api/work-orders/wo-1/work-instructions');
  assert.equal(workInstructionsListUrl('job-1', 'wo-1'), '/technical/api/jobs/job-1/work-instructions?includeRemoved=1', 'the Job wins when both are given');
  assert.equal(workInstructionsListUrl(null, null), null);
});

test('rows are split into active and removed, order kept', () => {
  const { active, removed } = splitWorkInstructionRows([row('a', false), row('b', true), row('c', false)]);
  assert.deepEqual(active.map((r) => r.jwluuid), ['a', 'c']);
  assert.deepEqual(removed.map((r) => r.jwluuid), ['b']);
  assert.deepEqual(splitWorkInstructionRows(undefined), { active: [], removed: [] });
});

test('the toggle is offered whenever removed links exist (the WI-13 case) and stays while on', () => {
  assert.equal(showRemovedToggle(1, false), true, 'one removed link, toggle off: must be offered');
  assert.equal(showRemovedToggle(0, false), false, 'nothing removed: nothing to offer');
  assert.equal(showRemovedToggle(0, true), true, 'on: never disappears');
  assert.equal(removedToggleLabel(2, false), 'Show removed (2)');
  assert.equal(removedToggleLabel(2, true), 'Hide removed');
});

test('a removed row shows when it was removed', () => {
  const fmtSize = (n: number | null | undefined) => (n == null ? '' : `${Math.round(n / 1024)} KB`);
  const fmtDate = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : '');
  assert.equal(workInstructionRowMeta(row('a', false), fmtSize, fmtDate), '2 KB · uploaded 2026-10-19');
  assert.equal(workInstructionRowMeta(row('b', true, '2026-10-27T10:00:00Z'), fmtSize, fmtDate), '2 KB · uploaded 2026-10-19 · removed 2026-10-27');
  assert.equal(workInstructionRowMeta(row('c', true), fmtSize, fmtDate), '2 KB · uploaded 2026-10-19 · removed');
});

test('a row shows who uploaded, attached and removed when the server resolved the names (VS-03)', () => {
  const fmtSize = (n: number | null | undefined) => (n == null ? '' : `${Math.round(n / 1024)} KB`);
  const fmtDate = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : '');
  const named = { ...row('d', true, '2026-10-27T10:00:00Z'), attachedByName: 'Jeevan', removedByName: 'Nilesh',
    file: { ...row('d', true).file!, uploadedByName: 'Jeevan' } };
  assert.equal(workInstructionRowMeta(named, fmtSize, fmtDate),
    '2 KB · uploaded 2026-10-19 by Jeevan · attached by Jeevan · removed 2026-10-27 by Nilesh');
  const unknown = { ...row('e', false), attachedByName: null, file: { ...row('e', false).file!, uploadedByName: null } };
  assert.equal(workInstructionRowMeta(unknown, fmtSize, fmtDate), '2 KB · uploaded 2026-10-19', 'unknown users add nothing');
});

test('the dialog uses these helpers (the old chicken-and-egg cannot come back)', () => {
  const src = readFileSync(new URL('../../client/src/components/WorkInstructionsDialog.tsx', import.meta.url), 'utf8');
  assert.match(src, /from "\.\/workInstructionsList"/);
  assert.match(src, /workInstructionsListUrl\(jobId, workOrderId\)/);
  assert.match(src, /showRemovedToggle\(removed\.length, showRemoved\)/);
  assert.doesNotMatch(src, /showRemoved \? "\?includeRemoved=1" : ""/, 'removed links must not depend on the toggle state');
});
