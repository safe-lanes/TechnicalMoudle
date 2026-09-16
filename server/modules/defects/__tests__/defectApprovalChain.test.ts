import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefect: vi.fn(),
  approvalRequestsInScopes: vi.fn(),
  activeWorkflowScoped: vi.fn(),
  approvalActorCanDecide: vi.fn(),
  isApprovalEngineAvailable: vi.fn(),
  classifyDefect: vi.fn(),
  deciderIdentity: vi.fn(),
}));

vi.mock('../repositories/defectsRepository', () => ({
  getDefect: mocks.getDefect,
}));

vi.mock('../approvalCard', () => ({
  DEFECTS_EXTENSION_SCREEN: 'defects-extension',
  DEFECTS_REPEAT_EXTENSION_SCREEN: 'defects-repeat-extension',
  DEFECTS_VERIFICATION_SCREEN: 'defects-verification',
  DEFECT_CLASS_NORMAL: 'Normal',
  DEFECT_CLASS_CRITICAL: 'Critical Equipment / COC Related',
  classifyDefect: mocks.classifyDefect,
  deciderIdentity: mocks.deciderIdentity,
}));

vi.mock('../../approvals/engineGateway', () => ({
  scopeFor: (moduleId: string, screenId: string) => ({ moduleId, screenId, actionId: '' }),
  approvalRequestsInScopes: mocks.approvalRequestsInScopes,
  activeWorkflowScoped: mocks.activeWorkflowScoped,
  approvalActorCanDecide: mocks.approvalActorCanDecide,
  isApprovalEngineAvailable: mocks.isApprovalEngineAvailable,
}));

import { getDefectApprovalChain } from '../services/defectsService';

const nodes = [
  {
    key: 'review',
    type: 'approval-step',
    label: 'Review',
    ordinal: 0,
    quorum: { rule: 'any' as const },
    slots: [{ roleId: 'role-review', roleLabel: 'Reviewer' }],
  },
  {
    key: 'verify',
    type: 'approval-step',
    label: 'Verify',
    ordinal: 1,
    quorum: { rule: 'all' as const },
    slots: [{ roleId: 'role-verify', roleLabel: 'Verifier' }],
  },
  {
    key: 'end',
    type: 'end',
    label: 'End',
    ordinal: 2,
    slots: [],
  },
];

const baseDefect = {
  id: 'DEF-1',
  duuid: 'defect-uuid-1',
  vesselId: 'vessel-1',
  targetDateExtensions: [],
};

describe('Defects approval chain projection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDefect.mockResolvedValue(baseDefect);
    mocks.approvalRequestsInScopes.mockResolvedValue([]);
    mocks.classifyDefect.mockResolvedValue('Normal');
    mocks.activeWorkflowScoped.mockResolvedValue(null);
    mocks.isApprovalEngineAvailable.mockReturnValue(true);
    mocks.deciderIdentity.mockResolvedValue({ name: 'A. Approver', roleLabel: 'Chief Engineer' });
  });

  it('returns the stable no-workflow shape without writing', async () => {
    const result = await getDefectApprovalChain('DEF-1', 'extension', 'user-1', 'Vessel User');

    expect(result).toEqual({
      hasActiveWorkflow: false,
      scope: 'defects-extension',
      classification: 'Normal',
      requestStatus: 'none',
      requestUuid: null,
      currentStepKey: null,
      steps: [],
      currentUserCanDecide: false,
      currentUserSlotId: null,
    });
    expect(mocks.approvalRequestsInScopes).toHaveBeenCalled();
    expect(mocks.activeWorkflowScoped).toHaveBeenCalled();
  });

  it('reports engine unavailability as an error instead of no workflow', async () => {
    mocks.isApprovalEngineAvailable.mockReturnValue(false);

    await expect(getDefectApprovalChain('DEF-1', 'extension', 'user-1', 'Vessel User'))
      .rejects.toMatchObject({
        statusCode: 503,
        code: 'APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE',
      });
    expect(mocks.approvalRequestsInScopes).not.toHaveBeenCalled();
  });

  it('projects pending steps and computes can-decide from the active resolved slot', async () => {
    const request = {
      requuid: 'request-1',
      scope: { moduleId: 'defects', screenId: 'defects-verification', actionId: '' },
      classification: 'Normal',
      subjectRef: 'defect-uuid-1',
      vesselId: 'vessel-1',
      snapshot: { scope: { moduleId: 'defects', screenId: 'defects-verification', actionId: '' }, classification: 'Normal', mode: 'simple', label: 'Verification', nodes, edges: [], wfuuid: 'wf-1', version: 1 },
      status: 'pending' as const,
      currentNodeKey: 'review',
      submittedBy: 'submitter',
      submittedAt: '2026-01-01T00:00:00.000Z',
      finalizedAt: null,
      slots: [
        { requuid: 'request-1', nodeKey: 'review', slotOrdinal: 0, roleId: 'role-review', roleLabel: 'Reviewer', status: 'active' as const, resolvedApproverIds: ['user-1'], decidedBy: null, decidedAt: null, remarks: null },
        { requuid: 'request-1', nodeKey: 'verify', slotOrdinal: 0, roleId: 'role-verify', roleLabel: 'Verifier', status: 'pending' as const, resolvedApproverIds: null, decidedBy: null, decidedAt: null, remarks: null },
      ],
    };
    mocks.approvalRequestsInScopes.mockResolvedValue([request]);
    mocks.approvalActorCanDecide.mockReturnValue({ canDecide: true, slotId: 'review:0' });

    const result = await getDefectApprovalChain('DEF-1', 'verification', 'user-1', 'Chief Engineer');

    expect(result).toMatchObject({
      hasActiveWorkflow: true,
      scope: 'defects-verification',
      requestStatus: 'pending',
      requestUuid: 'request-1',
      currentStepKey: 'review',
      currentUserCanDecide: true,
      currentUserSlotId: 'review:0',
    });
    expect(result.steps.map((step) => step.status)).toEqual(['active', 'pending']);
    expect(result.steps.map((step) => step.nodeKey)).not.toContain('end');
    expect(result.steps[0].slots[0]).toMatchObject({
      slotId: 'review:0',
      status: 'active',
      roleLabel: 'Reviewer',
    });
  });

  it('projects terminal decisions and decider display fields read-only', async () => {
    const request = {
      requuid: 'request-2',
      scope: { moduleId: 'defects', screenId: 'defects-verification', actionId: '' },
      classification: 'Critical Equipment / COC Related',
      subjectRef: 'defect-uuid-1',
      vesselId: 'vessel-1',
      snapshot: { scope: { moduleId: 'defects', screenId: 'defects-verification', actionId: '' }, classification: 'Critical Equipment / COC Related', mode: 'simple', label: 'Verification', nodes, edges: [], wfuuid: 'wf-2', version: 1 },
      status: 'approved' as const,
      currentNodeKey: null,
      submittedBy: 'submitter',
      submittedAt: '2026-01-01T00:00:00.000Z',
      finalizedAt: '2026-01-01T01:00:00.000Z',
      slots: [
        { requuid: 'request-2', nodeKey: 'review', slotOrdinal: 0, roleId: 'role-review', roleLabel: 'Reviewer', status: 'approved' as const, resolvedApproverIds: ['user-1'], decidedBy: 'user-1', decidedAt: '2026-01-01T00:30:00.000Z', remarks: 'Looks good' },
        { requuid: 'request-2', nodeKey: 'verify', slotOrdinal: 0, roleId: 'role-verify', roleLabel: 'Verifier', status: 'pending' as const, resolvedApproverIds: null, decidedBy: null, decidedAt: null, remarks: null },
      ],
    };
    mocks.approvalRequestsInScopes.mockResolvedValue([request]);

    const result = await getDefectApprovalChain('DEF-1', 'verification', 'other-user', 'Vessel User');

    expect(result.requestStatus).toBe('approved');
    expect(result.currentUserCanDecide).toBe(false);
    expect(result.steps.map((step) => step.status)).toEqual(['approved', 'skipped']);
    expect(result.steps[0].slots[0]).toMatchObject({
      status: 'approved',
      decidedByName: 'A. Approver',
      decidedByPosition: 'Chief Engineer',
      decidedAt: '2026-01-01T00:30:00.000Z',
      remarks: 'Looks good',
    });
  });
});