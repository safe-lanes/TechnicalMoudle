import { describe, expect, it, vi } from 'vitest';

vi.mock('../engineGateway', () => ({ listPendingEngineRequests: vi.fn() }));
vi.mock('../approvalNotifier', () => ({ notifyUsers: vi.fn(), subjectLine: vi.fn() }));
vi.mock('../../../postgresClient', () => ({ getPostgresClient: vi.fn() }));
vi.mock('../../../utils/asyncLocalStorage', () => ({ getCurrentTenantContext: vi.fn() }));

import { findStalledSteps } from '../stalledApprovalWarning';

// Sahil E5 / Q7 (25-Sep-2026): warn Sail Admin after 24 h when a step has nobody to approve.
const H = 3_600_000;
const now = new Date('2026-09-26T12:00:00Z');
const slot = (o: Partial<any>) => ({ nodeKey: 'step-1', status: 'active', roleLabel: 'Superintendent', resolvedApproverIds: [], decidedAt: null, ...o });

describe('findStalledSteps', () => {
  it('flags an active step with zero approvers older than the window', () => {
    const r = findStalledSteps([{ requuid: 'r1', submittedAt: new Date(now.getTime() - 25 * H).toISOString(), slots: [slot({})] }], now, 24 * H);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ requuid: 'r1', nodeKey: 'step-1', roleLabels: ['Superintendent'] });
  });
  it('does not flag it before the window', () => {
    expect(findStalledSteps([{ requuid: 'r1', submittedAt: new Date(now.getTime() - 23 * H).toISOString(), slots: [slot({})] }], now, 24 * H)).toHaveLength(0);
  });
  it('does not flag a step where at least one slot has an approver', () => {
    expect(findStalledSteps([{ requuid: 'r1', submittedAt: new Date(now.getTime() - 48 * H).toISOString(),
      slots: [slot({}), slot({ roleLabel: 'TM', resolvedApproverIds: ['u1'] })] }], now, 24 * H)).toHaveLength(0);
  });
  it('measures a later step from the previous decision, not from submission', () => {
    const req = { requuid: 'r2', submittedAt: new Date(now.getTime() - 72 * H).toISOString(), slots: [
      slot({ nodeKey: 'step-1', status: 'approved', resolvedApproverIds: ['u1'], decidedAt: new Date(now.getTime() - 10 * H).toISOString() }),
      slot({ nodeKey: 'step-2' }),
    ] };
    expect(findStalledSteps([req], now, 24 * H)).toHaveLength(0);
    expect(findStalledSteps([req], new Date(now.getTime() + 15 * H), 24 * H)).toHaveLength(1);
  });
  it('ignores requests with no active slot', () => {
    expect(findStalledSteps([{ requuid: 'r3', submittedAt: new Date(0).toISOString(), slots: [slot({ status: 'pending' })] }], now, 24 * H)).toHaveLength(0);
  });
});

// Jeevan #14(a), 22-Oct-2026: an ALL step where ONE role has nobody is stalled too (needs the snapshot).
describe('findStalledSteps — partly empty ALL step', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  const old = new Date(now.getTime() - 48 * 3600_000).toISOString();
  const s = (roleLabel: string, ids: string[] | null) => ({ nodeKey: 'n1', status: 'active', roleLabel, resolvedApproverIds: ids, decidedAt: null });
  it('flags the empty role when the quorum is ALL', () => {
    const r = findStalledSteps([{ requuid: 'r1', submittedAt: old, slots: [s('CE', ['u1']), s('TSI', [])],
      snapshot: { nodes: [{ key: 'n1', quorum: { rule: 'all' } }] } }], now, 0);
    expect(r).toHaveLength(1);
    expect(r[0].roleLabels).toEqual(['TSI']);
  });
  it('not stalled when the quorum is ANY and someone can act', () => {
    expect(findStalledSteps([{ requuid: 'r1', submittedAt: old, slots: [s('CE', ['u1']), s('TSI', [])],
      snapshot: { nodes: [{ key: 'n1', quorum: { rule: 'any' } }] } }], now, 0)).toHaveLength(0);
  });
});
