import { beforeEach, describe, expect, it, vi } from 'vitest';

// 23-Oct-2026 (replit_dev merge): Nilesh's approver value changes (overriddenChanges) must survive the approval
// engine. The engine's FINAL decision re-enters approveChangeRequest({ viaEngine }) inside the same request —
// the final approver's overrides are applied then; a non-final step leaves the CR unchanged.
const repo = vi.hoisted(() => ({
  getChangeRequest: vi.fn(), getSpare: vi.fn(), getJob: vi.fn(), approveChangeRequest: vi.fn(),
  getChangeRequestApprovalSteps: vi.fn(async () => []), updateChangeRequestApprovalStep: vi.fn(),
}));
const gw = vi.hoisted(() => ({ maybeEngineDecide: vi.fn(), refuseDirectDecision: vi.fn() }));
vi.mock('../repositories/changeRequestsRepository', () => repo);
vi.mock('../../approvals/engineGateway', () => gw);
vi.mock('../../sync/syncRole', () => ({ isShipInstance: async () => false }));
vi.mock('../../jobs/services/officeReviewerValidation', () => ({ validateReviewerSelection: async (v: unknown) => v }));

import { approveChangeRequest } from '../services/changeRequestsService';

const cr = { id: 7, cruuid: 'cr-7', status: 'submitted', targetType: 'spare', targetId: 's-1',
  proposedChangesJson: [{ field: 'remarks', oldValue: 'a', newValue: '100' }] };
const overrides = [{ field: 'remarks', approverNewValue: '80' }];

describe('approver value changes through the approval engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.getChangeRequest.mockResolvedValue(cr);
    repo.getSpare.mockResolvedValue({ suuid: 's-1', critical: 'No' });
    repo.approveChangeRequest.mockResolvedValue({ ...cr, status: 'approved' });
  });

  it('final step: the engine re-entry applies the final approver\'s overrides', async () => {
    let finalised = false;
    gw.maybeEngineDecide.mockImplementation(async () => {
      if (finalised) return null; // on re-entry the engine has no pending request any more (as in production)
      finalised = true;
      await approveChangeRequest(7, { comment: 'ok' }, { viaEngine: true }); // the engine's onDecision
      return { requestStatus: 'approved', nodeSatisfied: true, activatedNodeKey: null };
    });
    await approveChangeRequest(7, { comment: 'ok', reviewerId: 'u1', overriddenChanges: overrides });
    expect(repo.approveChangeRequest).toHaveBeenCalledTimes(1);
    expect(repo.approveChangeRequest.mock.calls[0][4]).toEqual(overrides);
  });

  it('non-final step: nothing is applied and nothing is left behind for a later call', async () => {
    gw.maybeEngineDecide.mockResolvedValue({ requestStatus: 'pending', nodeSatisfied: true, activatedNodeKey: 'step-2' });
    await approveChangeRequest(7, { comment: 'ok', overriddenChanges: overrides });
    expect(repo.approveChangeRequest).not.toHaveBeenCalled();
    // a later engine re-entry for the same CR does not pick up the earlier step's overrides
    gw.maybeEngineDecide.mockResolvedValue(null);
    await approveChangeRequest(7, { comment: 'ok' }, { viaEngine: true });
    expect(repo.approveChangeRequest.mock.calls[0][4]).toBeUndefined();
  });

  it('invalid override is refused before any decision', async () => {
    await expect(approveChangeRequest(7, { comment: 'ok', overriddenChanges: [{ field: 'remarks', approverNewValue: ['x'] }] }))
      .rejects.toThrow(/Scalar field overrides must be strings/);
    expect(gw.maybeEngineDecide).not.toHaveBeenCalled();
  });
});
