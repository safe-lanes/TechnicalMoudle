import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  engineAvailable: vi.fn(),
  activeWorkflowScoped: vi.fn(),
  scopeFor: vi.fn((moduleId: string, screenId: string) => ({
    moduleId,
    screenId,
    actionId: '',
  })),
  getActiveUsers: vi.fn(),
  getActiveAssignments: vi.fn(),
  getActiveVessels: vi.fn(),
  getActiveApprovalRoles: vi.fn(),
  getResolverRoleDefinitions: vi.fn(),
}));

vi.mock('../../approvals/engineGateway', () => ({
  activeWorkflowScoped: mocks.activeWorkflowScoped,
  isApprovalEngineAvailable: mocks.engineAvailable,
  scopeFor: mocks.scopeFor,
}));

vi.mock('../../approvals/approvalCard', () => ({
  resolveRoleApproverUserIds: vi.fn(),
}));

vi.mock('../../defects/approvalCard', () => ({
  DEFECTS_MODULE_ID: 'defects',
  defectsApprovalCard: {
    scopes: [
      {
        screenId: 'defects-extension',
        label: 'Defect Target Date Extension',
        classifications: [
          { id: 'Critical Equipment / COC Related' },
          { id: 'Normal' },
        ],
      },
      {
        screenId: 'defects-repeat-extension',
        label: 'Target Date Repeat Extension',
        classifications: [
          { id: 'Critical Equipment / COC Related' },
          { id: 'Normal' },
        ],
      },
      {
        screenId: 'defects-verification',
        label: 'Defect Verification (C2)',
        classifications: [
          { id: 'Critical Equipment / COC Related' },
          { id: 'Normal' },
        ],
      },
    ],
  },
}));

vi.mock('../repositories/devTestUsersRepository', () => ({
  getActiveUsers: mocks.getActiveUsers,
  getActiveAssignments: mocks.getActiveAssignments,
  getActiveVessels: mocks.getActiveVessels,
  getActiveApprovalRoles: mocks.getActiveApprovalRoles,
  getResolverRoleDefinitions: mocks.getResolverRoleDefinitions,
}));

import { getUsersSnapshot } from '../services/devTestUsersService';

describe('development test-user Defects workflow role metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.engineAvailable.mockReturnValue(true);
    mocks.getActiveUsers.mockResolvedValue([
      { id: 'u1', name: 'A', fullName: 'A', email: null, role: 'Admin', userType: 'Office', rank: null },
      { id: 'u2', name: 'B', fullName: 'B', email: null, role: 'Admin', userType: 'Office', rank: null },
    ]);
    mocks.getActiveAssignments.mockResolvedValue([]);
    mocks.getActiveVessels.mockResolvedValue([]);
    mocks.getActiveApprovalRoles.mockResolvedValue([]);
    mocks.getResolverRoleDefinitions.mockResolvedValue([
      { roleId: 'role-admin', roleName: 'Admin', roleType: 'Office', isActive: true },
    ]);
    mocks.activeWorkflowScoped.mockImplementation(async (
      scope: { screenId?: string },
      classification: string,
    ) =>
      scope.screenId === 'defects-extension' &&
      classification === 'Critical Equipment / COC Related'
        ? {
            nodes: [{
              key: 'review',
              type: 'approval-step',
              ordinal: 0,
              label: 'Review',
              slots: [{ roleId: 'role-admin', roleLabel: 'Administrator' }],
            }],
          }
        : null,
    );
  });

  it('reports resolver strings, matching-user counts, and label mismatches', async () => {
    const snapshot = await getUsersSnapshot();
    const criticalExtension = snapshot.defectsWorkflowRoles.find((entry) =>
      entry.scopeScreenId === 'defects-extension' &&
      entry.classification === 'Critical Equipment / COC Related',
    );

    expect(criticalExtension).toMatchObject({
      status: 'active',
      usages: [{
        roleId: 'role-admin',
        roleLabel: 'Administrator',
        assignedRole: 'Admin',
        roleStringsMatch: false,
        matchingActiveUsers: 2,
        stepNumber: 1,
        slotNumber: 1,
      }],
    });
  });

  it('returns explicit records for all six combinations, including unconfigured repeat scopes', async () => {
    const snapshot = await getUsersSnapshot();
    const repeat = snapshot.defectsWorkflowRoles.filter((entry) =>
      entry.scopeScreenId === 'defects-repeat-extension',
    );

    expect(snapshot.defectsWorkflowRoles).toHaveLength(6);
    expect(repeat).toHaveLength(2);
    expect(repeat.every((entry) => entry.status === 'no-active-workflow')).toBe(true);
    expect(mocks.activeWorkflowScoped).toHaveBeenCalledTimes(6);
  });

  it('distinguishes engine unavailability from unconfigured workflows', async () => {
    mocks.engineAvailable.mockReturnValue(false);

    const snapshot = await getUsersSnapshot();

    expect(snapshot.defectsWorkflowRoles).toHaveLength(6);
    expect(snapshot.defectsWorkflowRoles.every((entry) => entry.status === 'engine-unavailable')).toBe(true);
    expect(mocks.activeWorkflowScoped).not.toHaveBeenCalled();
  });
});