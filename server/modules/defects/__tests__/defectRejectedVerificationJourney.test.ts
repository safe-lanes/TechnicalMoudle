import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalEngine, CardRegistry, type ApprovalCard, type WorkflowDefInput } from '../../approval-engine';
import { InMemoryProvider } from '../../../approval-demo/__tests__/inMemoryRepository';

const fixture = vi.hoisted(() => ({ current: {} as any, history: [] as any[] }));
vi.mock('../repositories/defectsRepository', () => ({
  getDefect: async () => structuredClone(fixture.current),
  getDefectApprovalSettings: async () => ({ longExtensionDays: 90 }),
  createAuditLog: vi.fn(),
  updateDefect: async (_id: string, update: any) => {
    fixture.current = { ...fixture.current, ...structuredClone(update) };
    return structuredClone(fixture.current);
  },
  // Repository double only. The real SQL transaction is covered by defectClosureReopen.integration.test.ts.
  reopenDefectAfterVerificationReturn: async (input: any) => {
    fixture.history.push({ ...structuredClone(fixture.current), ...input });
    fixture.current = { ...fixture.current, status: 'Open', confirmCompleted: false, verified: false,
      dateCompleted: null, closedByName: null, closedByRank: null, closureFiles: null,
      dateVerified: null, verifiedDate: null, verifiedByName: null, verifiedByOfficePosition: null };
    return { defect: fixture.current, history: fixture.history[0], alreadyApplied: false };
  },
}));
vi.mock('../../sync/syncRole', () => ({ isShipInstance: async () => false }));
vi.mock('../../approvals/approvalHistoryService', () => ({
  currentActor: async () => ({ uuid: 'requester', name: 'Fixture requester', position: 'Chief Engineer' }),
}));
vi.mock('../approvalCard', () => ({
  DEFECTS_MODULE_ID: 'defects', DEFECTS_EXTENSION_SCREEN: 'defects-extension',
  DEFECTS_REPEAT_EXTENSION_SCREEN: 'defects-repeat-extension', DEFECTS_VERIFICATION_SCREEN: 'defects-verification',
  DEFECT_CLASS_NORMAL: 'Normal', DEFECT_CLASS_CRITICAL: 'Critical Equipment / COC Related',
  defectClassificationFactors: async () => ({ isCoC: false, isCriticalComponent: false }),
  deciderIdentity: async () => ({ name: 'Fixture Approver', roleLabel: 'Technical Superintendent' }),
}));
import { engineCtx, setTechnicalEngine } from '../../approvals/engineGateway';
import { gateDefectUpdate, applyVerificationDecision, applyExtensionDecision } from '../services/defectsApprovalHooks';

afterEach(() => setTechnicalEngine(null));

describe('rejected verification to extension lifecycle — isolated repositories, real engine and gate', () => {
  it.each([false, true])('reopens, saves and reloads one %s-repeat request without changing its target until approval', async repeat => {
    fixture.current = { id: 'fixture-defect', duuid: 'fixture-duuid', vesselId: 'fixture-vessel',
      status: 'Closed', confirmCompleted: true, verified: false, dateCompleted: '2026-11-02',
      closedByName: 'Fixture Master', closedByRank: 'Master', closureFiles: ['evidence-1'],
      partCAttachments: [{ id: 'evidence-1', name: 'Closure.pdf' }], attachments: [{ id: 'rectification-1' }],
      targetCloseDate: '2026-11-18', isDeferred: repeat,
      targetDateExtensions: repeat ? [{ id: 'prior-approved', status: 'Approved', newTargetDate: '2026-11-18' }] : [] };
    fixture.history = [];
    const provider = new InMemoryProvider();
    const registry = new CardRegistry();
    const screens = ['defects-extension', 'defects-repeat-extension', 'defects-verification'];
    const card: ApprovalCard = {
      moduleId: 'defects', label: 'Isolated Defects',
      scopes: screens.map(screenId => ({ screenId, actionId: '', label: screenId, classifications: [{ id: 'Normal', label: 'Normal' }] })),
      classify: async () => 'Normal',
      listRoles: async () => [{ roleId: 'fixture-reviewer', roleLabel: 'Reviewer' }],
      resolveApprovers: async () => ['fixture-approver'],
      onDecision: async (_ctx, notice) => {
        if (notice.scope.screenId === 'defects-verification') {
          await applyVerificationDecision(notice.subjectRef, notice.outcome === 'approved',
            notice.remarks || '', notice.decidedBy, notice.requuid);
        } else {
          await applyExtensionDecision(notice.subjectRef, notice.outcome === 'approved', notice.remarks || '', notice.decidedBy);
        }
      },
    };
    registry.register(card);
    const engine = new ApprovalEngine({ registry, provider });
    setTechnicalEngine(engine);
    const context = engineCtx('requester');
    const repo = provider.forTenant(context.tenantId);
    for (const screenId of screens) {
      const definition: WorkflowDefInput = { scope: { moduleId: 'defects', screenId, actionId: '' },
        classification: 'Normal', label: 'Isolated review', mode: 'simple',
        nodes: [
          { key: 'review', type: 'approval-step', label: 'Review', ordinal: 0, quorum: { rule: 'all' },
            slots: [{ roleId: 'fixture-reviewer', roleLabel: 'Reviewer' }] },
          { key: 'end', type: 'end', label: 'End', ordinal: 1 },
        ], edges: [{ from: 'review', to: 'end' }] };
      await repo.saveWorkflowVersion(definition, 'fixture-admin');
    }
    const verification = await engine.submit(context, {
      scope: { moduleId: 'defects', screenId: 'defects-verification', actionId: '' },
      subjectRef: fixture.current.duuid, subject: {}, vesselId: fixture.current.vesselId,
    });
    expect(verification.outcome).toBe('STARTED');
    if (verification.outcome !== 'STARTED') throw new Error('Fixture verification did not start');
    const rejection = await engine.decide(engineCtx('fixture-approver'), verification.requuid,
      { decision: 'reject', remarks: 'Additional repairs and evidence required' });
    expect(rejection.callbackError).toBeUndefined();
    expect(fixture.current).toMatchObject({ status: 'Open', confirmCompleted: false, verified: false, closureFiles: null });
    const history = structuredClone(fixture.history);
    const newEntry = { id: 'new-extension', status: 'Requested', newTargetDate: '2026-11-19',
      existingTargetDate: '2026-11-18', reasonForExtension: 'Further rectification required' };
    const gated = await gateDefectUpdate(structuredClone(fixture.current), {
      ...structuredClone(fixture.current), dateCompleted: '', closedByName: '', closedByRank: '', closureFiles: [],
      targetDateExtensions: [...fixture.current.targetDateExtensions, newEntry],
    }, { userUuid: 'requester', rankName: 'Chief Engineer' });
    // Production ordering: persist the gated body before running its post-save tasks.
    fixture.current = { ...fixture.current, ...structuredClone(gated.body) };
    expect(await gated.postSave[0]()).toEqual({ status: 'started' });
    const reloaded = structuredClone(fixture.current);
    expect(reloaded.targetCloseDate).toBe('2026-11-18');
    expect(reloaded.targetDateExtensions.filter((e: any) => e.id === newEntry.id)).toHaveLength(1);
    expect(fixture.history).toEqual(history);
    expect(reloaded.partCAttachments).toEqual([{ id: 'evidence-1', name: 'Closure.pdf' }]);
    expect(reloaded.attachments).toEqual([{ id: 'rectification-1' }]);
    const pending = Array.from(repo.requests.values()).filter(r => r.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].scope.screenId).toBe(repeat ? 'defects-repeat-extension' : 'defects-extension');
    expect(pending[0].submittedBy).toBe('requester');
    // A lost-response retry echoes the same entry ID; the gate must not enqueue a second submit.
    const replayedSave = await gateDefectUpdate(structuredClone(fixture.current), {
      ...structuredClone(fixture.current), targetDateExtensions: reloaded.targetDateExtensions,
    }, { userUuid: 'requester', rankName: 'Chief Engineer' });
    expect(replayedSave.postSave).toHaveLength(0);
    expect(history[0]).toMatchObject({ approvalRequestUuid: verification.requuid, closureFiles: ['evidence-1'],
      rejectionReason: 'Additional repairs and evidence required' });
    // Retrying submission work cannot fork an approval request.
    expect(await gated.postSave[0]()).toEqual({ status: 'already_pending' });
    expect(Array.from(repo.requests.values()).filter(r => r.status === 'pending')).toHaveLength(1);
    const approved = await engine.decide(engineCtx('fixture-approver'), pending[0].requuid, { decision: 'approve', remarks: 'Approved' });
    expect(approved.callbackError).toBeUndefined();
    expect(fixture.current.targetCloseDate).toBe('2026-11-19');
    expect(fixture.current.targetDateExtensions.at(-1).status).toBe('Approved');
    expect(fixture.history).toEqual(history);
  });
});
