import { describe, expect, it } from 'vitest';
import { orderRequestsNewestFirst } from '../core/engine';

// Sahil E7 (25-Sep-2026): engine.status() ordering is part of the contract — newest first.
describe('engine status() ordering contract', () => {
  it('orders newest submittedAt first regardless of the adapter order', () => {
    const rows = [
      { requuid: 'a', submittedAt: '2026-09-01T10:00:00Z' },
      { requuid: 'b', submittedAt: '2026-09-03T10:00:00Z' },
      { requuid: 'c', submittedAt: '2026-09-02T10:00:00Z' },
    ];
    expect(orderRequestsNewestFirst(rows).map((r) => r.requuid)).toEqual(['b', 'c', 'a']);
  });
  it('breaks equal timestamps by requuid descending (total, stable order)', () => {
    const t = '2026-09-01T10:00:00Z';
    const rows = [{ requuid: 'x1', submittedAt: t }, { requuid: 'x3', submittedAt: t }, { requuid: 'x2', submittedAt: t }];
    expect(orderRequestsNewestFirst(rows).map((r) => r.requuid)).toEqual(['x3', 'x2', 'x1']);
  });
  it('does not mutate the input', () => {
    const rows = [{ requuid: 'a', submittedAt: '2026-09-01T00:00:00Z' }, { requuid: 'b', submittedAt: '2026-09-02T00:00:00Z' }];
    orderRequestsNewestFirst(rows);
    expect(rows.map((r) => r.requuid)).toEqual(['a', 'b']);
  });
});
