import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefect: vi.fn(),
  getDefectApprovalSettings: vi.fn(),
  createAuditLog: vi.fn(),
  updateDefect: vi.fn(),
  defectClassificationFactors: vi.fn(),
  activeWorkflowExistsScoped: vi.fn(),
  pendingEngineRequestInScopes: vi.fn(),
  pendingEngineRequestScoped: vi.fn(),
  maybeEngineDecideScoped: vi.fn(),
  engineSubmitOutcome: vi.fn(),
  maybeEngineSubmitScoped: vi.fn(),
  isShipInstance: vi.fn(),
}));

vi.mock('../repositories/defectsRepository', () => ({
  getDefect: mocks.getDefect,
  getDefectApprovalSettings: mocks.getDefectApprovalSettings,
  createAuditLog: mocks.createAuditLog,
  updateDefect: mocks.updateDefect,
}));

vi.mock('../approvalCard', () => ({
  DEFECTS_MODULE_ID: 'defects',
  DEFECTS_EXTENSION_SCREEN: 'defects-extension',
  DEFECTS_REPEAT_EXTENSION_SCREEN: 'defects-repeat-extension',
  DEFECTS_VERIFICATION_SCREEN: 'defects-verification',
  DEFECT_CLASS_CRITICAL: 'Critical Equipment / COC Related',
  DEFECT_CLASS_NORMAL: 'Normal',
  defectClassificationFactors: mocks.defectClassificationFactors,
  deciderIdentity: vi.fn(),
  defectsApprovalCard: { scopes: [
    { screenId: 'defects-extension', label: 'Defect Target Date Extension' },
    { screenId: 'defects-repeat-extension', label: 'Target Date Repeat Extension' },
    { screenId: 'defects-verification', label: 'Defect Verification (C2)' },
  ] },
}));

vi.mock('../../approvals/engineGateway', () => ({
  scopeFor: (moduleId: string, screenId: string) => ({ moduleId, screenId, actionId: '' }),
  activeWorkflowExistsScoped: mocks.activeWorkflowExistsScoped,
  // 25-Sep-2026 readiness (scope enabled + active chain) — follows the workflow-exists fake.
  approvalReadinessScoped: async (scope: any, classification: string) =>
    (await mocks.activeWorkflowExistsScoped(scope, classification)) ? 'READY' : 'NO_WORKFLOW',
  pendingEngineRequestInScopes: mocks.pendingEngineRequestInScopes,
  pendingEngineRequestScoped: mocks.pendingEngineRequestScoped,
  maybeEngineDecideScoped: mocks.maybeEngineDecideScoped,
  engineSubmitOutcome: mocks.engineSubmitOutcome,
  maybeEngineSubmitScoped: mocks.maybeEngineSubmitScoped,
}));

vi.mock('../../sync/syncRole', () => ({
  isShipInstance: mocks.isShipInstance,
}));

import {
  gateDefectUpdate,
  resolveDefectApprovalRouting,
} from '../services/defectsApprovalHooks';

const baseDefect = {
  id: 'DEF-1',
  duuid: 'defect-uuid-1',
  vesselId: 'vessel-1',
  targetCloseDate: '2026-01-01',
  targetDateExtensions: [],
  verified: false,
};

describe('Defects approval routing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDefect.mockResolvedValue(baseDefect);
    mocks.getDefectApprovalSettings.mockResolvedValue({ longExtensionDays: 90 });
    mocks.defectClassificationFactors.mockResolvedValue({ isCoC: false, isCriticalComponent: false });
    mocks.activeWorkflowExistsScoped.mockResolvedValue(true);
    mocks.createAuditLog.mockResolvedValue({});
    mocks.isShipInstance.mockResolvedValue(false);
  });

  it('uses the initial scope for the first extension and counts only Approved entries', async () => {
    mocks.getDefect.mockResolvedValue({
      ...baseDefect,
      targetDateExtensions: [
        { status: 'Requested' },
        { status: 'Rejected' },
      ],
    });

    const result = await resolveDefectApprovalRouting('defect-uuid-1', 'extension', '2026-01-31');

    expect(result.scope.screenId).toBe('defects-extension');
    expect(result.factors.approvedExtensionCount).toBe(0);
  });

  it('uses the repeat scope after one approved extension', async () => {
    mocks.getDefect.mockResolvedValue({
      ...baseDefect,
      targetDateExtensions: [{ status: 'Approved' }, { state: 'Rejected' }],
    });

    const result = await resolveDefectApprovalRouting('defect-uuid-1', 'extension', '2026-01-31');

    expect(result.scope.screenId).toBe('defects-repeat-extension');
    expect(result.factors.approvedExtensionCount).toBe(1);
  });

  it('treats exactly 90 days as Normal and 91 days as Critical', async () => {
    const atThreshold = await resolveDefectApprovalRouting('defect-uuid-1', 'extension', '2026-04-01');
    const overThreshold = await resolveDefectApprovalRouting('defect-uuid-1', 'extension', '2026-04-02');

    expect(atThreshold.factors.extensionDays).toBe(90);
    expect(atThreshold.factors.exceedsThreshold).toBe(false);
    expect(atThreshold.classification).toBe('Normal');
    expect(overThreshold.factors.extensionDays).toBe(91);
    expect(overThreshold.factors.exceedsThreshold).toBe(true);
    expect(overThreshold.classification).toBe('Critical Equipment / COC Related');
  });

  it('accepts the existing DD-MMM-YYYY defect target-date format', async () => {
    mocks.getDefect.mockResolvedValue({ ...baseDefect, targetCloseDate: '01-Jan-2026' });
    const result = await resolveDefectApprovalRouting('defect-uuid-1', 'extension', '2026-04-01');
    expect(result.factors.extensionDays).toBe(90);
    expect(result.classification).toBe('Normal');
  });

  it.each([
    [{ isCoC: true, isCriticalComponent: false }],
    [{ isCoC: false, isCriticalComponent: true }],
  ])('preserves CoC and component-critical classification (%j)', async (factors) => {
    mocks.defectClassificationFactors.mockResolvedValue(factors);
    const result = await resolveDefectApprovalRouting('defect-uuid-1', 'extension', '2026-01-02');
    expect(result.classification).toBe('Critical Equipment / COC Related');
  });

  it('keeps verification classification independent of extension dates', async () => {
    const result = await resolveDefectApprovalRouting('defect-uuid-1', 'verification', null);
    expect(result.scope.screenId).toBe('defects-verification');
    expect(result.classification).toBe('Normal');
    expect(result.factors.extensionDays).toBeNull();
    expect(result.factors.exceedsThreshold).toBe(false);
  });

  it('falls back to the initial scope and audits when repeat has no active workflow', async () => {
    mocks.getDefect.mockResolvedValue({
      ...baseDefect,
      targetDateExtensions: [{ status: 'Approved' }],
    });
    mocks.activeWorkflowExistsScoped.mockImplementation(async (scope: any) =>
      scope.screenId === 'defects-extension');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await resolveDefectApprovalRouting(
      'defect-uuid-1', 'extension', '2026-01-31', 'actor-1',
    );

    expect(result.scope.screenId).toBe('defects-extension');
    expect(result.fellBackFromRepeatScope).toBe(true);
    expect(result.activeWorkflowExists).toBe(true);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('No active defects-repeat-extension workflow'));
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'actor-1',
      entityType: 'defect_approval_routing',
      entityId: 'defect-uuid-1',
      actionType: 'fallback',
      oldValue: 'defects-repeat-extension',
      newValue: 'defects-extension',
    }));
    warning.mockRestore();
  });

  it('keeps diagnostics read-only when reporting repeat-scope fallback', async () => {
    mocks.getDefect.mockResolvedValue({
      ...baseDefect,
      targetDateExtensions: [{ status: 'Approved' }],
    });
    mocks.activeWorkflowExistsScoped.mockImplementation(async (scope: any) =>
      scope.screenId === 'defects-extension');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await resolveDefectApprovalRouting(
      'defect-uuid-1', 'extension', '2026-01-31', 'actor-1', { auditFallback: false },
    );

    expect(result.fellBackFromRepeatScope).toBe(true);
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it('propagates workflow lookup failures instead of treating an outage as no workflow', async () => {
    mocks.getDefect.mockResolvedValue({
      ...baseDefect,
      targetDateExtensions: [{ status: 'Approved' }],
    });
    mocks.activeWorkflowExistsScoped.mockRejectedValue(new Error('database unavailable'));
    await expect(resolveDefectApprovalRouting(
      'defect-uuid-1', 'extension', '2026-01-31',
    )).rejects.toThrow('database unavailable');
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it('uses the persisted request scope for a decision after extension counts change', async () => {
    const persistedScope = { moduleId: 'defects', screenId: 'defects-repeat-extension', actionId: '' };
    const current = {
      ...baseDefect,
      targetDateExtensions: [
        { id: 'old', status: 'Approved' },
        { id: 'pending', status: 'Requested', newTargetDate: '2026-02-01' },
      ],
    };
    const incoming = {
      targetDateExtensions: [
        { id: 'old', status: 'Approved' },
        { id: 'pending', status: 'Approved', newTargetDate: '2026-02-01', approverComments: 'ok' },
      ],
    };
    mocks.pendingEngineRequestInScopes.mockResolvedValue({
      scope: persistedScope,
      request: { requuid: 'request-1', scope: persistedScope, status: 'pending' },
    });
    mocks.maybeEngineDecideScoped.mockResolvedValue({ requestStatus: 'approved' });
    mocks.getDefect.mockResolvedValue(current);

    await gateDefectUpdate(current, incoming, { userUuid: 'approver-1' });

    expect(mocks.maybeEngineDecideScoped).toHaveBeenCalledWith(
      persistedScope,
      'defect-uuid-1',
      'approve',
      'approver-1',
      'ok',
    );
    expect(mocks.activeWorkflowExistsScoped).not.toHaveBeenCalled();
  });

  it('returns a conflict when a pending request disappears during decision', async () => {
    const current = {
      ...baseDefect,
      targetDateExtensions: [{ id: 'pending', status: 'Requested', newTargetDate: '2026-02-01' }],
    };
    mocks.pendingEngineRequestInScopes.mockResolvedValue({
      scope: { moduleId: 'defects', screenId: 'defects-extension', actionId: '' },
      request: { requuid: 'request-1', status: 'pending' },
    });
    mocks.maybeEngineDecideScoped.mockResolvedValue(null);

    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [{ id: 'pending', status: 'Approved', newTargetDate: '2026-02-01' }],
    }, { userUuid: 'approver-1' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'APPROVAL_REQUEST_CHANGED' },
    });
  });

  it('rejects a decision on a later Requested entry when FIFO governs the oldest', async () => {
    const current = {
      ...baseDefect,
      targetDateExtensions: [
        { id: 'oldest', status: 'Requested', newTargetDate: '2026-02-01' },
        { id: 'later', status: 'Requested', newTargetDate: '2026-03-01' },
      ],
    };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [
        current.targetDateExtensions[0],
        { ...current.targetDateExtensions[1], status: 'Approved' },
      ],
    }, { userUuid: 'approver-1' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'APPROVAL_REQUEST_CHANGED' },
    });
    expect(mocks.maybeEngineDecideScoped).not.toHaveBeenCalled();
  });

  it('rejects only a transition which increases Requested entries above one', async () => {
    const current = {
      ...baseDefect,
      targetDateExtensions: [{ id: 'existing', status: 'Requested' }],
    };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [
        current.targetDateExtensions[0],
        { id: 'new', status: 'Requested', newTargetDate: '2026-03-01' },
      ],
    }, { userUuid: 'user-1' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_DUPLICATE_REQUESTED' },
    });
    await expect(gateDefectUpdate({
      ...current,
      targetDateExtensions: [
        { id: 'one', status: 'Requested' },
        { id: 'two', status: 'Requested' },
      ],
    }, {
      targetDateExtensions: [{ id: 'one', status: 'Requested' }],
    }, { userUuid: 'user-1' })).resolves.toBeDefined();
  });

  it('does not let an orphan Requested extension block C1 or C2', async () => {
    const current = {
      ...baseDefect,
      targetDateExtensions: [{ id: 'orphan', status: 'Requested' }],
    };
    mocks.pendingEngineRequestInScopes.mockResolvedValue(null);
    await expect(gateDefectUpdate(current, {
      confirmCompleted: true,
      verified: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).resolves.toBeDefined();
  });

  it('blocks C1 and C2 when an extension has a pending engine request', async () => {
    const current = {
      ...baseDefect,
      targetDateExtensions: [{ id: 'pending', status: 'Requested' }],
    };
    mocks.pendingEngineRequestInScopes.mockResolvedValue({
      scope: { moduleId: 'defects', screenId: 'defects-extension', actionId: '' },
      request: { status: 'pending' },
    });
    await expect(gateDefectUpdate(current, {
      confirmCompleted: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_PENDING_CLOSEOUT' },
    });
    await expect(gateDefectUpdate(current, {
      verified: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_PENDING_VERIFICATION' },
    });
  });

  it('does not let a stale pending extension request block a defect with no Requested entry', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({
      scope: { moduleId: 'defects', screenId: 'defects-extension', actionId: '' },
      request: { status: 'pending' },
    });
    await expect(gateDefectUpdate(baseDefect, {
      confirmCompleted: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).resolves.toBeDefined();
  });

  it('keeps Master-only precedence for every changed C1 field', async () => {
    await expect(gateDefectUpdate(baseDefect, {
      dateCompleted: '2026-02-01',
    }, { userUuid: 'user-1', rankName: 'Chief Engineer' })).rejects.toMatchObject({
      statusCode: 403,
      details: { code: 'CLOSURE_MASTER_ONLY' },
    });
  });

  it('returns Master-only before pending-extension conflict for non-Master closeout', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({
      scope: { moduleId: 'defects', screenId: 'defects-extension', actionId: '' },
      request: { status: 'pending' },
    });
    await expect(gateDefectUpdate({
      ...baseDefect,
      targetDateExtensions: [{ id: 'pending', status: 'Requested' }],
    }, {
      confirmCompleted: true,
    }, { userUuid: 'user-1', rankName: 'Chief Engineer' })).rejects.toMatchObject({
      statusCode: 403,
      details: { code: 'CLOSURE_MASTER_ONLY' },
    });
  });

  it('blocks an atomic Requested extension plus C1 closeout before persistence', async () => {
    await expect(gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{ id: 'new', status: 'Requested', newTargetDate: '2026-02-01' }],
      confirmCompleted: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_PENDING_CLOSEOUT' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });

  it('blocks an atomic Requested extension plus C2 verification before persistence', async () => {
    await expect(gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{ id: 'new', status: 'Requested', newTargetDate: '2026-02-01' }],
      verified: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_PENDING_VERIFICATION' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });

  it('allows atomic closeout with an EXISTING orphan Requested extension when no workflow is active', async () => {
    mocks.activeWorkflowExistsScoped.mockResolvedValue(false);
    const current = { ...baseDefect, targetDateExtensions: [{ id: 'orphan', status: 'Requested', newTargetDate: '2026-02-01' }] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [{ id: 'orphan', status: 'Requested', newTargetDate: '2026-02-01' }],
      confirmCompleted: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).resolves.toBeDefined();
  });

  it('blocks a NEW extension request on shore when no workflow is active (25-Sep-2026)', async () => {
    mocks.activeWorkflowExistsScoped.mockResolvedValue(false);
    await expect(gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{ id: 'new-req', status: 'Requested', newTargetDate: '2026-02-01' }],
    }, { userUuid: 'user-1' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'No approval workflow is set up for "Defect Target Date Extension" (Normal). Ask an administrator to set it up in Admin → Approval Workflow.',
      details: { code: 'EXTENSION_APPROVAL_NOT_SET_UP' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });

  it('still accepts a NEW extension request on a ship with no workflow (it waits on shore)', async () => {
    mocks.isShipInstance.mockResolvedValue(true);
    mocks.activeWorkflowExistsScoped.mockResolvedValue(false);
    const gated = await gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{ id: 'ship-req', status: 'Requested', newTargetDate: '2026-02-01' }],
    }, { userUuid: 'user-1' });
    expect(gated.body.targetDateExtensions[0].status).toBe('Requested');
  });

  it('blocks atomic C1 with a newly Approved governed extension before submission', async () => {
    await expect(gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{ id: 'new-approved', status: 'Approved', newTargetDate: '2026-02-01' }],
      confirmCompleted: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_PENDING_CLOSEOUT' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });

  it('blocks atomic C2 with a newly Approved governed extension before submission', async () => {
    await expect(gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{ id: 'new-approved', status: 'Approved', newTargetDate: '2026-02-01' }],
      verified: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_PENDING_VERIFICATION' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });

  it('rejects existing Requested plus new Approved before an ALREADY_PENDING submit path', async () => {
    mocks.engineSubmitOutcome.mockResolvedValue('ALREADY_PENDING');
    const defect = { ...baseDefect, targetDateExtensions: [
      { id: 'requested', status: 'Requested', newTargetDate: '2026-01-15' },
    ] };
    await expect(gateDefectUpdate(defect, {
      targetDateExtensions: [
        ...defect.targetDateExtensions,
        { id: 'new-approved', status: 'Approved', newTargetDate: '2026-02-01' },
      ],
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_DUPLICATE_REQUESTED' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });

  it('rejects ship existing Requested plus new Approved as duplicate effective requests', async () => {
    mocks.isShipInstance.mockResolvedValue(true);
    const defect = { ...baseDefect, targetDateExtensions: [
      { id: 'requested', status: 'Requested', newTargetDate: '2026-01-15' },
    ] };
    await expect(gateDefectUpdate(defect, {
      targetDateExtensions: [
        ...defect.targetDateExtensions,
        { id: 'new-approved', status: 'Approved', newTargetDate: '2026-02-01' },
      ],
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'EXTENSION_DUPLICATE_REQUESTED' },
    });
  });

  it('treats status-only Cancelled as Master-protected closure', async () => {
    await expect(gateDefectUpdate(baseDefect, { status: 'Cancelled' }, {
      userUuid: 'user-1', rankName: 'Chief Engineer',
    })).rejects.toMatchObject({ statusCode: 403, details: { code: 'CLOSURE_MASTER_ONLY' } });
  });

  it('blocks Master status-only Cancelled while an extension is pending', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue(true);
    const current = {
      ...baseDefect,
      targetDateExtensions: [{ id: 'requested', status: 'Requested' }],
    };
    await expect(gateDefectUpdate(current, { status: 'Cancelled' }, {
      userUuid: 'master-1', rankName: 'Master',
    })).rejects.toMatchObject({ statusCode: 409, details: { code: 'EXTENSION_PENDING_CLOSEOUT' } });
  });

  it('blocks a new self-Approved extension when no workflow is active (25-Sep-2026; was legacy self-approve)', async () => {
    mocks.activeWorkflowExistsScoped.mockResolvedValue(false);
    await expect(gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{ id: 'legacy-approved', status: 'Approved', newTargetDate: '2026-02-01' }],
      confirmCompleted: true,
    }, { userUuid: 'master-1', rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409, details: { code: 'EXTENSION_APPROVAL_NOT_SET_UP' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });

  it('protects the governed Requested entry from removal while pending', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'oldest', status: 'Requested' },
    ] };
    await expect(gateDefectUpdate(current, { targetDateExtensions: [] }, { rankName: 'Master' }))
      .rejects.toMatchObject({ statusCode: 409, details: { code: 'EXTENSION_GOVERNED_ENTRY_PROTECTED' } });
  });

  it('does not allow replacing the governed entry while retaining a later Requested entry', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'oldest', status: 'Requested' }, { id: 'later', status: 'Requested' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [{ id: 'later', status: 'Requested' }],
    }, { rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409, details: { code: 'EXTENSION_GOVERNED_ENTRY_PROTECTED' },
    });
  });

  it('allows removing later orphan Requested entries while keeping the governed entry', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'oldest', status: 'Requested' }, { id: 'later', status: 'Requested' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [{ id: 'oldest', status: 'Requested' }],
    }, { rankName: 'Master' })).resolves.toBeDefined();
  });

  it('allows removing Requested entries when no engine request is pending', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue(null);
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'oldest', status: 'Requested' },
    ] };
    await expect(gateDefectUpdate(current, { targetDateExtensions: [] }, { rankName: 'Master' }))
      .resolves.toBeDefined();
  });

  it('allows the governed entry to take the authorized decision path', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    mocks.maybeEngineDecideScoped.mockResolvedValue(true);
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'oldest', status: 'Requested' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [{ id: 'oldest', status: 'Approved' }],
    }, { rankName: 'Master' })).resolves.toBeDefined();
  });

  it('protects governed order when a later Requested entry is moved ahead', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'a', status: 'Requested', newTargetDate: '2026-01-10' },
      { id: 'b', status: 'Requested', newTargetDate: '2026-01-20' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [...current.targetDateExtensions].reverse(),
    }, { rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409, details: { code: 'EXTENSION_GOVERNED_ENTRY_PROTECTED' },
    });
  });

  it('protects governed request dates and reasons while pending', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'a', status: 'Requested', newTargetDate: '2026-01-10', reasonForExtension: 'original' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [{ ...current.targetDateExtensions[0], newTargetDate: '2026-02-10' }],
    }, { rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409, details: { code: 'EXTENSION_GOVERNED_ENTRY_PROTECTED' },
    });
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [{ ...current.targetDateExtensions[0], reasonForExtension: 'changed' }],
    }, { rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409, details: { code: 'EXTENSION_GOVERNED_ENTRY_PROTECTED' },
    });
  });

  it('allows reorder and request mutation when no extension request is pending', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue(null);
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'a', status: 'Requested', newTargetDate: '2026-01-10', reasonForExtension: 'original' },
      { id: 'b', status: 'Requested', newTargetDate: '2026-01-20' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [
        { ...current.targetDateExtensions[1] },
        { ...current.targetDateExtensions[0], reasonForExtension: 'changed' },
      ],
    }, { rankName: 'Master' })).resolves.toBeDefined();
  });

  it('allows an Approved historical entry before the governed effective Requested entry', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'old', status: 'Approved' },
      { id: 'a', status: 'Requested', newTargetDate: '2026-01-10' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: current.targetDateExtensions,
      notes: [{ noteId: 'n1' }],
    }, { rankName: 'Master' })).resolves.toBeDefined();
  });

  it('rejects a Requested entry before the governed entry despite historical entries', async () => {
    mocks.pendingEngineRequestInScopes.mockResolvedValue({ scope: { screenId: 'defects-extension' } });
    const current = { ...baseDefect, targetDateExtensions: [
      { id: 'old', status: 'Approved' },
      { id: 'a', status: 'Requested' },
    ] };
    await expect(gateDefectUpdate(current, {
      targetDateExtensions: [
        current.targetDateExtensions[0],
        { id: 'b', status: 'Requested', newTargetDate: '2026-01-20' },
        current.targetDateExtensions[1],
      ],
    }, { rankName: 'Master' })).rejects.toMatchObject({
      statusCode: 409, details: { code: 'EXTENSION_GOVERNED_ENTRY_PROTECTED' },
    });
  });

  it('returns an explicit post-save error outcome while retaining the saved extension', async () => {
    mocks.engineSubmitOutcome.mockResolvedValue('ERROR');
    const gated = await gateDefectUpdate(baseDefect, {
      targetDateExtensions: [{
        id: 'new', status: 'Requested', newTargetDate: '2026-02-01',
        reasonForExtension: 'weather',
      }],
    }, { userUuid: 'user-1' });
    await expect(gated.postSave[0]()).resolves.toMatchObject({
      status: 'error',
      error: 'The extension was saved, but approval submission failed. Contact an administrator.',
    });
  });

  it('fails closed for a new shore verification when no active workflow exists', async () => {
    mocks.activeWorkflowExistsScoped.mockResolvedValue(false);
    await expect(gateDefectUpdate(baseDefect, {
      verified: true,
    }, { userUuid: 'user-1' })).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'VERIFICATION_WORKFLOW_UNAVAILABLE' },
    });
    expect(mocks.engineSubmitOutcome).not.toHaveBeenCalled();
  });
});