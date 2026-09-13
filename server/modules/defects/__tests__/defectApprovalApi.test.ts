import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefectApprovalRouting: vi.fn(),
  updateDefectApprovalSettings: vi.fn(),
  getDefectApprovalSettings: vi.fn(),
  requireRole: vi.fn(() => (_req: any, _res: any, next: () => void) => next()),
  requireVesselAccess: vi.fn((_req: any, _res: any, next: () => void) => next()),
  hasActiveUserVesselAssignment: vi.fn(),
}));

vi.mock('../services/defectsService', () => ({
  getDefectApprovalRouting: mocks.getDefectApprovalRouting,
  updateDefectApprovalSettings: mocks.updateDefectApprovalSettings,
  getDefectApprovalSettings: mocks.getDefectApprovalSettings,
  getDefect: vi.fn(),
  hasActiveUserVesselAssignment: mocks.hasActiveUserVesselAssignment,
}));

import {
  enforceDefectVesselIdentity,
  getDefectApprovalRouting,
  updateDefectApprovalSettings,
} from '../controllers/defectsController';

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('Defects approval API controllers', () => {
  beforeEach(() => vi.resetAllMocks());

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

    expect(getSettings).toBeDefined();
    expect(putSettings).toBeDefined();
    expect(diagnostic).toBeDefined();
    expect(mocks.requireRole).toHaveBeenCalledTimes(2);
    expect(mocks.requireRole).toHaveBeenCalledWith(['PMS Admin', 'Sail Admin', 'Super Admin']);
    expect(diagnostic.route.stack.some((layer: any) => layer.handle === mocks.requireVesselAccess)).toBe(true);
  });
});