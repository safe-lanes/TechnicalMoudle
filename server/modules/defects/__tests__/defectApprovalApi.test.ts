import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefectApprovalRouting: vi.fn(),
  getDefectApprovalChain: vi.fn(),
  getDefectClosureHistory: vi.fn(),
  updateDefectApprovalSettings: vi.fn(),
  getDefectApprovalSettings: vi.fn(),
  updateDefect: vi.fn(),
  requireRole: vi.fn(() => (_req: any, _res: any, next: () => void) => next()),
  requireVesselAccess: vi.fn((_req: any, _res: any, next: () => void) => next()),
  hasActiveUserVesselAssignment: vi.fn(),
}));

vi.mock('../services/defectsService', () => ({
  getDefectApprovalRouting: mocks.getDefectApprovalRouting,
  getDefectApprovalChain: mocks.getDefectApprovalChain,
  getDefectClosureHistory: mocks.getDefectClosureHistory,
  updateDefectApprovalSettings: mocks.updateDefectApprovalSettings,
  getDefectApprovalSettings: mocks.getDefectApprovalSettings,
  getDefect: vi.fn(),
  updateDefect: mocks.updateDefect,
  hasActiveUserVesselAssignment: mocks.hasActiveUserVesselAssignment,
}));

import {
  enforceDefectVesselIdentity,
  getDefectApprovalChain,
  getDefectClosureHistory,
  getDefectApprovalRouting,
  updateDefectApprovalSettings,
  updateDefect as updateDefectController,
} from '../controllers/defectsController';

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('Defects approval API controllers', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    [{ status: 'started' }, 'succeeded'],
    [{ status: 'already_pending' }, 'succeeded'],
    [{ status: 'no_workflow' }, 'not_required'],
    [{ status: 'off' }, 'not_required'],
    [{ status: 'error', error: 'The extension was saved, but approval submission failed. Contact an administrator.' }, 'failed'],
  ])('normalizes post-save approval status %j to %s', async (raw, status) => {
    mocks.updateDefect.mockResolvedValue({ defect: { id: 'DEF-1' }, approvalSubmissions: [raw] });
    const res = response();
    await updateDefectController({ params: { id: 'DEF-1' }, body: {} } as any, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      approvalSubmission: expect.objectContaining({ status }),
    }));
  });

  it('returns not_required when no post-save approval task exists', async () => {
    mocks.updateDefect.mockResolvedValue({ defect: { id: 'DEF-1' }, approvalSubmissions: [] });
    const res = response();
    await updateDefectController({ params: { id: 'DEF-1' }, body: {} } as any, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      approvalSubmission: { status: 'not_required' },
    }));
  });

  it('rejects invalid approval settings before the service/storage write', async () => {
    const res = response();
    await updateDefectApprovalSettings({
      body: { long_extension_days: 0, show_rejected_closures_on_report: false },
      user: { userUuid: 'admin-1' },
    } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.updateDefectApprovalSettings).not.toHaveBeenCalled();
  });

  it('requires a new target date for extension diagnostics', async () => {
    const res = response();
    await getDefectApprovalRouting({
      params: { id: 'DEF-1' },
      query: { action: 'extension' },
      user: { userUuid: 'user-1' },
    } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.getDefectApprovalRouting).not.toHaveBeenCalled();
  });

  it('returns diagnostic factors without invoking a mutation service', async () => {
    mocks.getDefectApprovalRouting.mockResolvedValue({
      scope: { moduleId: 'defects', screenId: 'defects-extension', actionId: '' },
      classification: 'Normal',
      factors: {
        isCoC: false,
        isCriticalComponent: false,
        approvedExtensionCount: 0,
        currentTargetDate: '2026-01-01',
        newTargetDate: null,
        extensionDays: null,
        longExtensionThreshold: 90,
        exceedsThreshold: false,
      },
      activeWorkflowExists: true,
      fellBackFromRepeatScope: false,
    });
    const res = response();

    await getDefectApprovalRouting({
      params: { id: 'DEF-1' },
      query: { action: 'verification' },
      user: { userUuid: 'user-1' },
    } as any, res);

    expect(mocks.getDefectApprovalRouting).toHaveBeenCalledWith('DEF-1', 'verification', null, 'user-1');
    expect(mocks.updateDefectApprovalSettings).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'defects-extension',
      classification: 'Normal',
      activeWorkflowExists: true,
    }));
  });

  it('returns the read-only approval-chain projection and forwards the actor', async () => {
    mocks.getDefectApprovalChain.mockResolvedValue({
      hasActiveWorkflow: true,
      scope: 'defects-verification',
      classification: 'Normal',
      requestStatus: 'pending',
      requestUuid: 'request-1',
      currentStepKey: 'verify',
      steps: [],
      currentUserCanDecide: true,
      currentUserSlotId: 'verify:0',
    });
    const res = response();
    await getDefectApprovalChain({
      params: { id: 'DEF-1' },
      query: { action: 'verification' },
      rbac: { role: 'Vessel User', userType: 'Ship', source: 'forwarded' },
      user: { userUuid: 'user-1' },
    } as any, res);

    expect(mocks.getDefectApprovalChain).toHaveBeenCalledWith(
      'DEF-1', 'verification', 'user-1', 'Vessel User',
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      requestStatus: 'pending',
      requestUuid: 'request-1',
      currentUserCanDecide: true,
    }));
  });

  it('returns immutable closure history without invoking a mutation', async () => {
    mocks.getDefectClosureHistory.mockResolvedValue([
      { dchuuid: 'history-1', defectDuuid: 'D-1', attemptNumber: 1 },
    ]);
    const res = response();

    await getDefectClosureHistory({ params: { id: 'DEF-1' } } as any, res);

    expect(mocks.getDefectClosureHistory).toHaveBeenCalledWith('DEF-1');
    expect(mocks.updateDefect).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ dchuuid: 'history-1', attemptNumber: 1 }),
    ]);
  });

  it('preserves approval-engine unavailability as HTTP 503', async () => {
    mocks.getDefectApprovalChain.mockRejectedValue(
      Object.assign(new Error('Approval status is unavailable on this instance'), {
        statusCode: 503,
        code: 'APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE',
      }),
    );
    const res = response();

    await getDefectApprovalChain({
      params: { id: 'DEF-1' },
      query: { action: 'extension' },
      rbac: { role: 'Vessel User', userType: 'Ship', source: 'forwarded' },
      user: { userUuid: 'user-1' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Approval status is unavailable on this instance',
      code: 'APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE',
    });
  });

  it('uses forwarded RBAC and vessel assignments instead of the legacy mock role', async () => {
    mocks.hasActiveUserVesselAssignment.mockResolvedValue(false);
    const denied = response();
    await enforceDefectVesselIdentity({
      params: { vesselId: 'vessel-2' },
      rbac: { role: 'Vessel User', userType: 'Ship', source: 'forwarded' },
      user: { userUuid: 'ship-user', role: 'Sail Admin' },
    } as any, denied, vi.fn());
    expect(denied.status).toHaveBeenCalledWith(403);

    mocks.hasActiveUserVesselAssignment.mockResolvedValue(true);
    const allowed = response();
    const next = vi.fn();
    await enforceDefectVesselIdentity({
      params: { vesselId: 'vessel-1' },
      rbac: { role: 'Vessel User', userType: 'Ship', source: 'forwarded' },
      user: { userUuid: 'ship-user', role: 'Sail Admin' },
    } as any, allowed, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('Defects approval API route guards', () => {
  it('registers admin role guards and vessel access on diagnostics', async () => {
    vi.resetModules();
    vi.doMock('../../../middleware/auth', () => ({
      requireRole: mocks.requireRole,
      requireVesselAccess: mocks.requireVesselAccess,
    }));
    vi.doMock('../../shared/middleware', () => ({ asyncHandler: (handler: any) => handler }));
    vi.doMock('../../../middleware/permissions', () => ({
      requirePermission: vi.fn(() => (_req: any, _res: any, next: () => void) => next()),
    }));

    const { default: router } = await import('../routes');
    const stack = (router as any).stack;
    const getSettings = stack.find((layer: any) =>
      layer.route?.path === '/defects/approval-settings' && layer.route.methods.get);
    const putSettings = stack.find((layer: any) =>
      layer.route?.path === '/defects/approval-settings' && layer.route.methods.put);
    const diagnostic = stack.find((layer: any) =>
      layer.route?.path === '/defects/:id/approval-routing' && layer.route.methods.get);
    const chain = stack.find((layer: any) =>
      layer.route?.path === '/defects/:id/approval-chain' && layer.route.methods.get);
    const diagnostics = stack.find((layer: any) =>
      layer.route?.path === '/defects/approval-diagnostics' && layer.route.methods.get);
    const closureHistory = stack.find((layer: any) =>
      layer.route?.path === '/defects/:id/closure-history' && layer.route.methods.get);

    expect(getSettings).toBeDefined();
    expect(putSettings).toBeDefined();
    expect(diagnostic).toBeDefined();
    expect(chain).toBeDefined();
    expect(diagnostics).toBeDefined();
    expect(closureHistory).toBeDefined();
    expect(mocks.requireRole).toHaveBeenCalledTimes(3);
    expect(mocks.requireRole).toHaveBeenCalledWith(['PMS Admin', 'Sail Admin', 'Super Admin']);
    expect(diagnostic.route.stack.some((layer: any) => layer.handle === mocks.requireVesselAccess)).toBe(true);
    expect(chain.route.stack.some((layer: any) => layer.handle === mocks.requireVesselAccess)).toBe(true);
    expect(closureHistory.route.stack.some((layer: any) => layer.handle === mocks.requireVesselAccess)).toBe(true);
  });
});