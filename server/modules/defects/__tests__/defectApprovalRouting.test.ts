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
}));

vi.mock('../../approvals/engineGateway', () => ({
  scopeFor: (moduleId: string, screenId: string) => ({ moduleId, screenId, actionId: '' }),
  activeWorkflowExistsScoped: mocks.activeWorkflowExistsScoped,
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
});