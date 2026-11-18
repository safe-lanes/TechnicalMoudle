/**
 * 18-Nov-2026 — subject-defined slots (ApprovalCard.expandSlot). A workflow step names a special
 * role; at submit the card replaces it with the roles held on the subject, and the subject's
 * AND/OR becomes the step rule. Uses the demo card + in-memory repository.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalEngine, CardRegistry } from '../../modules/approval-engine';
import type { EngineCtx, RoleSlotDef, Scope, SlotExpansion, WorkflowDefInput } from '../../modules/approval-engine';
import { makeDemoCard, DEMO_ROLES } from '../demoCard';
import { InMemoryProvider } from './inMemoryRepository';

const SCOPE: Scope = { moduleId: 'demo', screenId: 'demo-requests', actionId: '' };
const SPECIAL = 'subject:reviewers';
const office = (userId: string): EngineCtx => ({ tenantId: 'default', actor: { userId, role: 'Admin', userType: 'Office' } });
const label = (id: string) => DEMO_ROLES.find((r) => r.roleId === id)?.roleLabel ?? id;

/** What each subject (record) says: its roles and its AND/OR rule. Mutable to prove snapshot freezing. */
const SUBJECTS: Record<string, { roles: string[]; rule: 'all' | 'any' }> = {};

function wf(steps: Array<{ roles: string[]; rule: 'all' | 'any' | 'nOfM'; n?: number }>): WorkflowDefInput {
  const nodes = steps.map((s, i) => ({
    key: `step-${i + 1}`, type: 'approval-step' as const, label: `Step ${i + 1}`, ordinal: i,
    quorum: { rule: s.rule, n: s.n },
    slots: s.roles.map((r) => ({ roleId: r, roleLabel: r === SPECIAL ? "Record's reviewers" : label(r) })),
  }));
  const all = [...nodes, { key: 'end', type: 'end' as const, label: 'End', ordinal: nodes.length }];
  return { scope: SCOPE, classification: 'normal', mode: 'simple', label: 'expansion test', nodes: all, edges: all.slice(0, -1).map((n, i) => ({ from: n.key, to: all[i + 1].key })) };
}

let engine: ApprovalEngine;
let provider: InMemoryProvider;
let expandCalls = 0;

beforeEach(() => {
  expandCalls = 0;
  const { card } = makeDemoCard({
    async listRoles() { return [...DEMO_ROLES, { roleId: SPECIAL, roleLabel: "Record's reviewers" }]; },
    async expandSlot(_ctx, _scope, slot: RoleSlotDef, _subject, subjectRef): Promise<SlotExpansion | null> {
      expandCalls++;
      if (slot.roleId !== SPECIAL) return null;
      const s = SUBJECTS[subjectRef] ?? { roles: [], rule: 'any' };
      return { slots: s.roles.map((r) => ({ roleId: r, roleLabel: label(r) })), quorum: { rule: s.rule } };
    },
  });
  const registry = new CardRegistry();
  registry.register(card);
  provider = new InMemoryProvider();
  engine = new ApprovalEngine({ registry, provider });
});

async function submit(ref: string) {
  const out = await engine.submit(office('submitter'), { scope: SCOPE, subjectRef: ref, subject: { ref } });
  if (out.outcome !== 'STARTED') throw new Error(`expected STARTED, got ${out.outcome}`);
  return out.requuid;
}
async function slotsOf(requuid: string) { return provider.forTenant('default').getSlots(requuid); }

describe('subject-defined slots', () => {
  it('OR: one slot per role on the record; any one approval completes the step', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL], rule: 'all' }]));
    SUBJECTS.r1 = { roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'any' };
    const q = await submit('r1');
    const slots = await slotsOf(q);
    expect(slots.map((s) => s.roleId)).toEqual(['demo-role-reviewer', 'demo-role-manager']);
    const res = await engine.decide(office('user-mgr-1'), q, { decision: 'approve' });
    expect(res.requestStatus).toBe('approved');
  });

  it('AND: every role on the record must approve (different people)', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL], rule: 'any' }]));
    SUBJECTS.r2 = { roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'all' };
    const q = await submit('r2');
    const first = await engine.decide(office('user-rev-1'), q, { decision: 'approve' });
    expect(first.requestStatus).toBe('pending');
    expect(first.nodeSatisfied).toBe(false);
    const second = await engine.decide(office('user-mgr-1'), q, { decision: 'approve' });
    expect(second.requestStatus).toBe('approved');
  });

  it('a single role on the record gives a single slot', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL], rule: 'all' }]));
    SUBJECTS.r3 = { roles: ['demo-role-director'], rule: 'all' };
    const q = await submit('r3');
    expect((await slotsOf(q)).map((s) => s.roleId)).toEqual(['demo-role-director']);
    expect((await engine.decide(office('user-dir-2'), q, { decision: 'approve' })).requestStatus).toBe('approved');
  });

  it('a record with no roles is refused (400) and no request is created', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL], rule: 'all' }]));
    SUBJECTS.r4 = { roles: [], rule: 'any' };
    await expect(engine.submit(office('submitter'), { scope: SCOPE, subjectRef: 'r4', subject: {} })).rejects.toMatchObject({ statusCode: 400, code: 'EMPTY_SLOT_EXPANSION' });
    expect(await engine.status(office('admin'), SCOPE, 'r4')).toHaveLength(0);
  });

  it('the request keeps the roles and rule it started with, even if the record changes', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL], rule: 'all' }]));
    SUBJECTS.r5 = { roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'all' };
    const q = await submit('r5');
    SUBJECTS.r5 = { roles: ['demo-role-director'], rule: 'any' }; // record edited afterwards
    const req = (await engine.status(office('admin'), SCOPE, 'r5'))[0];
    expect(req.snapshot.nodes[0].slots!.map((s) => s.roleId)).toEqual(['demo-role-reviewer', 'demo-role-manager']);
    expect(req.snapshot.nodes[0].quorum).toEqual({ rule: 'all' });
    await expect(engine.decide(office('user-dir-1'), q, { decision: 'approve' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('the stored workflow is never changed by an expansion', async () => {
    const saved = await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL], rule: 'all' }]));
    SUBJECTS.r6 = { roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'any' };
    await submit('r6');
    const again = await engine.getWorkflow(office('admin'), saved.wfuuid);
    expect(again.nodes[0].slots!.map((s) => s.roleId)).toEqual([SPECIAL]);
    expect(again.nodes[0].quorum).toEqual({ rule: 'all' });
  });

  it('special slot mixed with a fixed role: the step keeps its configured rule', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL, 'demo-role-director'], rule: 'all' }]));
    SUBJECTS.r7 = { roles: ['demo-role-reviewer'], rule: 'any' };
    const q = await submit('r7');
    const req = (await engine.status(office('admin'), SCOPE, 'r7'))[0];
    expect(req.snapshot.nodes[0].slots!.map((s) => s.roleId)).toEqual(['demo-role-reviewer', 'demo-role-director']);
    expect(req.snapshot.nodes[0].quorum).toEqual({ rule: 'all', n: undefined });
    expect((await engine.decide(office('user-rev-1'), q, { decision: 'approve' })).requestStatus).toBe('pending');
    expect((await engine.decide(office('user-dir-1'), q, { decision: 'approve' })).requestStatus).toBe('approved');
  });

  it('a role already in the step is not duplicated by the expansion', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: ['demo-role-reviewer', SPECIAL], rule: 'all' }]));
    SUBJECTS.r8 = { roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'any' };
    const q = await submit('r8');
    expect((await slotsOf(q)).map((s) => s.roleId)).toEqual(['demo-role-reviewer', 'demo-role-manager']);
  });

  it('two steps: the special slot can sit in any step and the other steps are untouched', async () => {
    await engine.saveWorkflow(office('admin'), wf([{ roles: ['demo-role-director'], rule: 'any' }, { roles: [SPECIAL], rule: 'all' }]));
    SUBJECTS.r9 = { roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'any' };
    const q = await submit('r9');
    const step1 = await engine.decide(office('user-dir-3'), q, { decision: 'approve' });
    expect(step1.activatedNodeKey).toBe('step-2');
    expect((await engine.decide(office('user-rev-2'), q, { decision: 'approve' })).requestStatus).toBe('approved');
  });

  it('NO_WORKFLOW / DISABLED never call the card hook', async () => {
    SUBJECTS.r10 = { roles: ['demo-role-reviewer'], rule: 'any' };
    expect((await engine.submit(office('s'), { scope: SCOPE, subjectRef: 'r10', subject: {} })).outcome).toBe('NO_WORKFLOW');
    await engine.saveWorkflow(office('admin'), wf([{ roles: [SPECIAL], rule: 'all' }]));
    await engine.setScopeEnabled(office('admin'), SCOPE, false);
    expect((await engine.submit(office('s'), { scope: SCOPE, subjectRef: 'r10', subject: {} })).outcome).toBe('DISABLED');
    expect(expandCalls).toBe(0);
  });
});

describe('cards without the hook are unchanged', () => {
  it('the request snapshot holds exactly the configured slots and rule', async () => {
    const { card } = makeDemoCard();
    expect(card.expandSlot).toBeUndefined();
    const registry = new CardRegistry();
    registry.register(card);
    const plain = new ApprovalEngine({ registry, provider: new InMemoryProvider() });
    await plain.saveWorkflow(office('admin'), wf([{ roles: ['demo-role-reviewer', 'demo-role-manager'], rule: 'all' }]));
    const out = await plain.submit(office('s'), { scope: SCOPE, subjectRef: 'p1', subject: {} });
    expect(out.outcome).toBe('STARTED');
    const req = (await plain.status(office('admin'), SCOPE, 'p1'))[0];
    expect(req.snapshot.nodes[0].slots!.map((s) => s.roleId)).toEqual(['demo-role-reviewer', 'demo-role-manager']);
    expect(req.snapshot.nodes[0].quorum).toEqual({ rule: 'all', n: undefined });
  });
});
