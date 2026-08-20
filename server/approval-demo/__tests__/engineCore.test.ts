/**
 * Phase 1 / B8 — engine core through the DEMO card (registry, submit routing, snapshot
 * isolation, quorum all/any/nOfM, decide authz + idempotency + exactly-once onDecision,
 * pendingForUser, tenant isolation). Uses the in-memory repository double.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalEngine, CardRegistry, CardRegistrationError } from '../../modules/approval-engine';
import type { EngineCtx, EngineEvent, Scope, WorkflowDefInput } from '../../modules/approval-engine';
import { makeDemoCard, DEMO_HOLDERS } from '../demoCard';
import { InMemoryProvider } from './inMemoryRepository';

const SCOPE_REQ: Scope = { moduleId: 'demo', screenId: 'demo-requests', actionId: '' };
const SCOPE_ORD: Scope = { moduleId: 'demo', screenId: 'demo-orders', actionId: 'close' };
const office = (userId: string): EngineCtx => ({ tenantId: 'default', actor: { userId, role: 'Admin', userType: 'Office' } });

function wf(scope: Scope, classification: string, steps: Array<{ roles: string[]; rule: 'all' | 'any' | 'nOfM'; n?: number }>): WorkflowDefInput {
  const nodes = steps.map((s, i) => ({
    key: `step-${i + 1}`, type: 'approval-step' as const, label: `Step ${i + 1}`, ordinal: i,
    quorum: { rule: s.rule, n: s.n },
    slots: s.roles.map((r) => ({ roleId: r, roleLabel: r.toUpperCase() })),
  }));
  const all = [...nodes, { key: 'end', type: 'end' as const, label: 'End', ordinal: nodes.length }];
  return { scope, classification, mode: 'simple', label: 'test', nodes: all, edges: all.slice(0, -1).map((n, i) => ({ from: n.key, to: all[i + 1].key })) };
}

let engine: ApprovalEngine;
let provider: InMemoryProvider;
let recorder: ReturnType<typeof makeDemoCard>['recorder'];
let events: EngineEvent[];

beforeEach(() => {
  const demo = makeDemoCard();
  recorder = demo.recorder;
  const registry = new CardRegistry();
  registry.register(demo.card);
  provider = new InMemoryProvider();
  events = [];
  engine = new ApprovalEngine({ registry, provider, onEvent: (e) => events.push(e) });
});

describe('registry validation (B8.1)', () => {
  it('valid card loads; tree is served', () => {
    expect(engine.registryTree().modules).toHaveLength(1);
    expect(engine.registryTree().modules[0].scopes).toHaveLength(2);
  });
  it('missing function refuses boot with a precise error', () => {
    const { card } = makeDemoCard({ onDecision: undefined as any });
    const r = new CardRegistry();
    expect(() => r.register(card)).toThrow(/required function onDecision\(\) missing/);
  });
  it('duplicate moduleId refuses boot', () => {
    const r = new CardRegistry();
    r.register(makeDemoCard().card);
    expect(() => r.register(makeDemoCard().card)).toThrow(CardRegistrationError);
  });
  it('duplicate classification refuses boot', () => {
    const { card } = makeDemoCard();
    (card.scopes[0].classifications as any) = [{ id: 'x', label: 'X' }, { id: 'x', label: 'X2' }];
    expect(() => new CardRegistry().register(card)).toThrow(/duplicate classification/);
  });
});

describe('submit (B8.2)', () => {
  it('classification routing: critical subject → the critical workflow', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer'], rule: 'any' }]));
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'critical', [{ roles: ['demo-role-director'], rule: 'all' }]));
    const r = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SUBJ-1', subject: { critical: true } });
    expect(r.outcome).toBe('STARTED');
    const slots = await provider.forTenant('default').getSlots((r as any).requuid);
    expect(slots.map((s) => s.roleId)).toEqual(['demo-role-director', 'demo-role-director', 'demo-role-director'].slice(0, slots.length));
  });
  it('no workflow for the classification → NO_WORKFLOW (module falls back)', async () => {
    const r = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SUBJ-2', subject: { critical: false } });
    expect(r).toEqual({ outcome: 'NO_WORKFLOW' });
  });
  it('disabled scope → DISABLED even with a workflow present', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer'], rule: 'any' }]));
    await engine.setScopeEnabled(office('admin'), SCOPE_REQ, false);
    expect((await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SUBJ-3', subject: {} })).outcome).toBe('DISABLED');
    await engine.setScopeEnabled(office('admin'), SCOPE_REQ, true);
    expect((await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SUBJ-3', subject: {} })).outcome).toBe('STARTED');
  });
  it('second submit for the same subject → ALREADY_PENDING with the first requuid', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer'], rule: 'any' }]));
    const a = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SUBJ-4', subject: {} });
    const b = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SUBJ-4', subject: {} });
    expect(b.outcome).toBe('ALREADY_PENDING');
    expect((b as any).requuid).toBe((a as any).requuid);
  });
  it('unknown scope → 404 EngineError', async () => {
    await expect(engine.submit(office('crew'), { scope: { moduleId: 'demo', screenId: 'nope', actionId: '' }, subjectRef: 'S', subject: {} }))
      .rejects.toMatchObject({ statusCode: 404, code: 'UNKNOWN_SCOPE' });
  });
});

describe('snapshot isolation (B8.3)', () => {
  it('editing the workflow mid-flight leaves the in-flight request on the old graph', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer'], rule: 'any' }]));
    const r = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SNAP-1', subject: {} });
    // new version with a completely different chain
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-manager'], rule: 'all' }, { roles: ['demo-role-director'], rule: 'any' }]));
    // reviewer (old chain) can still decide and complete it
    const d = await engine.decide(office('user-rev-1'), (r as any).requuid, { decision: 'approve' });
    expect(d.requestStatus).toBe('approved');
    // a NEW submit uses the new chain (manager first)
    const r2 = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'SNAP-2', subject: {} });
    const slots2 = await provider.forTenant('default').getSlots((r2 as any).requuid);
    expect(slots2.filter((s) => s.status === 'active').map((s) => s.roleId)).toEqual(['demo-role-manager']);
  });
});

describe('quorum (B8.4)', () => {
  const threeDirectors = { roles: ['demo-role-reviewer', 'demo-role-manager', 'demo-role-director'], rule: 'nOfM' as const, n: 2 };
  it('all: every slot must approve before the node advances', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'all' }]));
    const r = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'Q-ALL', subject: {} });
    const d1 = await engine.decide(office('user-rev-1'), (r as any).requuid, { decision: 'approve' });
    expect(d1.nodeSatisfied).toBe(false);
    expect(d1.requestStatus).toBe('pending');
    const d2 = await engine.decide(office('user-mgr-1'), (r as any).requuid, { decision: 'approve' });
    expect(d2.requestStatus).toBe('approved');
  });
  it('any: one approval satisfies; the other slot is SUPERSEDED, not deleted', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'any' }]));
    const r = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'Q-ANY', subject: {} });
    const d = await engine.decide(office('user-mgr-1'), (r as any).requuid, { decision: 'approve' });
    expect(d.requestStatus).toBe('approved');
    const slots = await provider.forTenant('default').getSlots((r as any).requuid);
    expect(slots).toHaveLength(2);
    expect(slots.find((s) => s.roleId === 'demo-role-reviewer')!.status).toBe('superseded');
    expect(slots.find((s) => s.roleId === 'demo-role-manager')!.status).toBe('approved');
  });
  it('2-of-3: second approval satisfies, third slot superseded', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [threeDirectors]));
    const r = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'Q-2OF3', subject: {} });
    expect((await engine.decide(office('user-rev-1'), (r as any).requuid, { decision: 'approve' })).nodeSatisfied).toBe(false);
    const d2 = await engine.decide(office('user-mgr-1'), (r as any).requuid, { decision: 'approve' });
    expect(d2.requestStatus).toBe('approved');
    const slots = await provider.forTenant('default').getSlots((r as any).requuid);
    expect(slots.map((s) => s.status).sort()).toEqual(['approved', 'approved', 'superseded']);
  });
});

describe('decide (B8.5)', () => {
  let requuid: string;
  beforeEach(async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [
      { roles: ['demo-role-reviewer'], rule: 'any' },
      { roles: ['demo-role-manager'], rule: 'all' },
    ]));
    const r = await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'DEC-1', subject: {} });
    requuid = (r as any).requuid;
  });
  it('wrong role (not an approver anywhere) → 403', async () => {
    await expect(engine.decide(office('stranger'), requuid, { decision: 'approve' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_TURN' });
  });
  it('not-your-turn (approver of a LATER node) → 403', async () => {
    await expect(engine.decide(office('user-mgr-1'), requuid, { decision: 'approve' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_TURN' });
  });
  it('multi-step advance: step 1 → step 2 activated with resolved approvers + events', async () => {
    const d = await engine.decide(office('user-rev-2'), requuid, { decision: 'approve' });
    expect(d.activatedNodeKey).toBe('step-2');
    expect(events.filter((e) => e.type === 'step-activated')).toHaveLength(2);
    expect(recorder.pendings.map((p) => p.nodeKey)).toEqual(['step-1', 'step-2']);
    expect(recorder.pendings[1].approverUserIds).toEqual(DEMO_HOLDERS.default['demo-role-manager']);
  });
  it('decided request → 409; onDecision fired EXACTLY once', async () => {
    await engine.decide(office('user-rev-1'), requuid, { decision: 'approve' });
    await engine.decide(office('user-mgr-1'), requuid, { decision: 'approve' });
    expect(recorder.decisions).toHaveLength(1);
    expect(recorder.decisions[0]).toMatchObject({ requuid, outcome: 'approved' });
    await expect(engine.decide(office('user-mgr-1'), requuid, { decision: 'approve' }))
      .rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_DECIDED' });
    expect(recorder.decisions).toHaveLength(1);
    expect(events.filter((e) => e.type === 'request-completed')).toHaveLength(1);
  });
  it('reject → returned; remaining slots superseded; onDecision(returned) once', async () => {
    const d = await engine.decide(office('user-rev-1'), requuid, { decision: 'reject', remarks: 'not good' });
    expect(d.requestStatus).toBe('returned');
    const slots = await provider.forTenant('default').getSlots(requuid);
    expect(slots.find((s) => s.nodeKey === 'step-1')!.status).toBe('rejected');
    expect(slots.find((s) => s.nodeKey === 'step-2')!.status).toBe('superseded');
    expect(recorder.decisions).toEqual([expect.objectContaining({ outcome: 'returned', remarks: 'not good' })]);
    expect(events.filter((e) => e.type === 'request-returned')).toHaveLength(1);
  });
});

describe('pendingForUser across two scopes (B8.6)', () => {
  it('lists both active items for a shared approver', async () => {
    await engine.saveWorkflow(office('admin'), wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer'], rule: 'any' }]));
    await engine.saveWorkflow(office('admin'), wf(SCOPE_ORD, 'large', [{ roles: ['demo-role-reviewer'], rule: 'all' }]));
    await engine.submit(office('crew'), { scope: SCOPE_REQ, subjectRef: 'P-1', subject: {} });
    await engine.submit(office('crew'), { scope: SCOPE_ORD, subjectRef: 'P-2', subject: { amount: 5000 } });
    const pending = await engine.pendingForUser(office('x'), 'user-rev-1');
    expect(pending.map((p) => p.subjectRef).sort()).toEqual(['P-1', 'P-2']);
    expect(pending.map((p) => p.scope.screenId).sort()).toEqual(['demo-orders', 'demo-requests']);
  });
});

describe('tenant isolation (B8.7, provider-level)', () => {
  it('same scope, different workflows per tenant, no leakage', async () => {
    const t1 = { tenantId: 't1', actor: { userId: 'admin', role: 'Admin', userType: 'Office' as const } };
    const t2 = { tenantId: 't2', actor: { userId: 'admin', role: 'Admin', userType: 'Office' as const } };
    await engine.saveWorkflow(t1, wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-reviewer'], rule: 'any' }]));
    await engine.saveWorkflow(t2, wf(SCOPE_REQ, 'normal', [{ roles: ['demo-role-manager'], rule: 'all' }, { roles: ['demo-role-director'], rule: 'any' }]));
    const r1 = await engine.submit({ ...t1, actor: { ...t1.actor, userId: 'crew' } }, { scope: SCOPE_REQ, subjectRef: 'TI-1', subject: {} });
    const r2 = await engine.submit({ ...t2, actor: { ...t2.actor, userId: 'crew' } }, { scope: SCOPE_REQ, subjectRef: 'TI-1', subject: {} });
    expect(r1.outcome).toBe('STARTED'); expect(r2.outcome).toBe('STARTED'); // same subjectRef, different tenants — no clash
    const s1 = await provider.forTenant('t1').getSlots((r1 as any).requuid);
    const s2 = await provider.forTenant('t2').getSlots((r2 as any).requuid);
    expect(s1.map((s) => s.roleId)).toEqual(['demo-role-reviewer']);
    expect(s2.filter((s) => s.status === 'active').map((s) => s.roleId)).toEqual(['demo-role-manager']);
    expect((await engine.listWorkflows(t1, SCOPE_REQ))).toHaveLength(1);
    expect((await engine.listWorkflows(t2, SCOPE_REQ))).toHaveLength(1);
  });
});
