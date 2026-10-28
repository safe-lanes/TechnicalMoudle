import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfiguredApproverRole, type ConfiguredApproverLookup } from '../../server/modules/approval-engine/client/ConfiguredApproverRole';

const render = (result?: ConfiguredApproverLookup) =>
  renderToStaticMarkup(React.createElement(ConfiguredApproverRole, { roleLabel: 'Configured role', result }));
const user = (id: string, vessels: string[]) => ({ id, name: `Approver ${id}`, vessels });
const lookup = (users: NonNullable<ConfiguredApproverLookup['users']>): ConfiguredApproverLookup =>
  ({ names: users.map((u) => u.name), vesselScoped: true, users });
const emptyMessage = 'No configured approvers have an active vessel assignment.';

test('any active vessel assignment qualifies; users with no active assignments are hidden', () => {
  const html = render(lookup([user('A', ['Vessel 001']), user('B', ['Vessel 002']), user('C', [])]));
  assert.match(html, /Approver A/);
  assert.match(html, /Approver B/);
  assert.doesNotMatch(html, /Approver C/);
  assert.doesNotMatch(html, /no vessel assigned|all vessels/);
});

test('multiple active assignments and repeated records produce one user row per role', () => {
  const html = render(lookup([
    user('A', ['Vessel 001', 'Vessel 002', 'Vessel 001']),
    user('A', ['Vessel 003']),
  ]));
  assert.equal(html.match(/Approver A/g)?.length, 1);
  assert.match(html, /Vessel 001, Vessel 002, Vessel 003/);
});

test('empty, inactive-only, or removed assignments show the explicit empty state, not fallback names', () => {
  // The API projects active assignments only; inactive/removed assignments yield [].
  for (const users of [[], [user('Inactive only', [])], [user('Removed', [])]]) {
    const html = render({ ...lookup(users), names: ['Unfiltered legacy name'] });
    assert.match(html, new RegExp(emptyMessage));
    assert.doesNotMatch(html, /Unfiltered legacy name|configured-approver-table/);
  }
});

test('mixed assignment history displays only the active assignment projection', () => {
  const html = render(lookup([user('Mixed', ['Active Vessel'])]));
  assert.match(html, /Approver Mixed/);
  assert.match(html, /Active Vessel/);
  assert.doesNotMatch(html, /Inactive Vessel/);
});

test('loading, HTTP failure, missing assignment data, and empty results remain distinct', () => {
  assert.match(render(), /resolving/);
  const failed = render({ names: [], vesselScoped: false, error: 'could not load the approvers (HTTP 403)' });
  assert.match(failed, /configured-approver-load-error/);
  assert.match(failed, /HTTP 403/);
  assert.doesNotMatch(failed, new RegExp(emptyMessage));
  const legacy = render({ names: ['Unfiltered name'], vesselScoped: false });
  assert.match(legacy, /configured-approver-load-error/);
  assert.doesNotMatch(legacy, /Unfiltered name/);
});

test('existing server display lookup restricts vessel labels to active assignments', () => {
  const source = readFileSync('server/modules/approvals/approvalCard.ts', 'utf8');
  const displayLookup = source.slice(source.indexOf('async function withAssignedVessels'));
  assert.match(displayLookup, /eq\(masterUserVessels\.isActive, true\)/);
});

test('panel integration uses the filtered renderer without selected-vessel dependency or name fallback', () => {
  const source = readFileSync('server/modules/approval-engine/client/ApprovalEngineAdmin.tsx', 'utf8');
  assert.match(source, /<ConfiguredApproverRole key=\{sl\.roleId\} roleLabel=\{sl\.roleLabel\} result=\{approverNames\[sl\.roleId\]\}/);
  assert.doesNotMatch(source, /r\.names\.join|r\.users\.map|useVessel|selectedVessel/);
  assert.doesNotMatch(
    readFileSync('server/modules/approval-engine/client/ConfiguredApproverRole.tsx', 'utf8'),
    /useVessel|selectedVessel/,
  );
});
