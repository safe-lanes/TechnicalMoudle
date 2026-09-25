import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefect: vi.fn(),
  reopenDefectAfterVerificationReturn: vi.fn(),
  createAuditLog: vi.fn(),
  deciderIdentity: vi.fn(),
}));

vi.mock('../repositories/defectsRepository', () => ({
  getDefect: mocks.getDefect,
  reopenDefectAfterVerificationReturn: mocks.reopenDefectAfterVerificationReturn,
  createAuditLog: mocks.createAuditLog,
}));
vi.mock('../approvalCard', () => ({
  DEFECTS_MODULE_ID: 'defects',
  DEFECTS_EXTENSION_SCREEN: 'defects-extension',
  DEFECTS_REPEAT_EXTENSION_SCREEN: 'defects-repeat-extension',
  DEFECTS_VERIFICATION_SCREEN: 'defects-verification',
  DEFECT_CLASS_CRITICAL: 'Critical Equipment / COC Related',
  DEFECT_CLASS_NORMAL: 'Normal',
  defectClassificationFactors: vi.fn(),
  deciderIdentity: mocks.deciderIdentity,
}));
vi.mock('../../approvals/engineGateway', () => ({
  scopeFor: (moduleId: string, screenId: string) => ({ moduleId, screenId, actionId: '' }),
}));

import { applyVerificationDecision } from '../services/defectsApprovalHooks';

const closedDefect = {
  id: 'DEF-1',
  duuid: 'defect-uuid-1',
  vesselId: 'vessel-1',
  status: 'Closed',
  confirmCompleted: true,
  dateCompleted: '2026-09-15',
  closedByName: 'Master One',
  closedByRank: 'Master',
  closureComment: 'Rectification complete',
  verified: true,
  dateVerified: '2026-09-16',
  verifiedByName: 'Verifier One',
  verifiedByOfficePosition: 'Technical Superintendent',
  isDeferred: true,
  targetCloseDate: '2026-10-31',
};

describe('verification return closure preservation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDefect.mockResolvedValue({ ...closedDefect });
    mocks.deciderIdentity.mockResolvedValue({
      name: 'Technical Manager',
      roleLabel: 'Technical Manager',
    });
    mocks.createAuditLog.mockResolvedValue({});
  });

  it('routes rejection through the idempotent reopen transaction with the request UUID', async () => {
    mocks.reopenDefectAfterVerificationReturn.mockResolvedValue({
      history: { attemptNumber: 1 },
      defect: {
        ...closedDefect,
        status: 'Open',
        confirmCompleted: false,
        verified: false,
      },
      alreadyApplied: false,
    });

    await applyVerificationDecision(
      closedDefect.duuid, false, 'Evidence is incomplete', 'manager-1', 'request-1',
    );

    expect(mocks.reopenDefectAfterVerificationReturn).toHaveBeenCalledWith({
      defectDuuid: closedDefect.duuid,
      approvalRequestUuid: 'request-1',
      rejectedByUserUuid: 'manager-1',
      rejectedByName: 'Technical Manager',
      rejectedByPosition: 'Technical Manager',
      rejectionReason: 'Evidence is incomplete',
    });
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it('keeps live C1/C2 unchanged, audits the split state, and rethrows callback failure', async () => {
    const original = { ...closedDefect };
    const liveDefect = { ...closedDefect };
    mocks.getDefect.mockResolvedValue(liveDefect);
    mocks.reopenDefectAfterVerificationReturn.mockRejectedValue(
      new Error('forced history insert failure'),
    );

    await expect(applyVerificationDecision(
      closedDefect.duuid, false, 'Evidence is incomplete', 'manager-1', 'request-1',
    )).rejects.toThrow('forced history insert failure');

    expect(liveDefect).toEqual(original);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'defect_verification_reopen',
      entityId: closedDefect.duuid,
      actionType: 'error',
      payload: expect.objectContaining({
        approvalRequestUuid: 'request-1',
        reopenError: 'forced history insert failure',
      }),
    }));
  });
});