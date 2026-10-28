/**
 * Withdraw panel — settled withdrawals are shown ONCE, in the "Approval process" list (QA round 3 WD-01, 28-Oct-2026).
 *   node --import tsx --test tests/components/withdraw-panel-no-duplicate.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = readFileSync(new URL('../../client/src/components/approvals/WithdrawRequestPanel.tsx', import.meta.url), 'utf8');

test('the panel no longer renders the settled "Withdrawn by … on …" / "too late" notes (the process list shows them)', () => {
  assert.doesNotMatch(src, /Withdrawn by \{/, 'settled withdrawal text must not be rendered by the panel');
  assert.doesNotMatch(src, /Withdrawal too late:/, 'too-late text must not be rendered by the panel');
  assert.doesNotMatch(src, /withdrawal-note-withdrawn|outcome === "withdrawn" &&|outcome === "too-late" &&/);
});

test('the panel keeps what the process list cannot show yet: waiting for the office, refusal, the Withdraw button', () => {
  assert.match(src, /latest\.outcome === null \|\| latest\.outcome === "refused"/);
  assert.match(src, /waiting for the office \(after sync\)/);
  assert.match(src, /Withdrawal refused:/);
  assert.match(src, /data-testid="button-withdraw-request"/);
  assert.match(src, /if \(!data\.canWithdraw && !note\) return null;/, 'nothing to show → the panel renders nothing');
});

test('the process list is the single place for settled outcomes (labels exist server-side)', () => {
  const history = readFileSync(new URL('../../server/modules/approvals/approvalHistoryService.ts', import.meta.url), 'utf8');
  assert.match(history, /case 'withdrawn': return 'Withdrawn';/);
  assert.match(history, /case 'withdrawal-too-late': return 'Withdrawal too late/);
});
