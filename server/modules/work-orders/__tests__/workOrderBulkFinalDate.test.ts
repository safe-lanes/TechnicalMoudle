import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  findJob: vi.fn(),
  update: vi.fn(),
  createAuditLog: vi.fn(),
}));
const finalizeWorkOrderCompletion = vi.hoisted(() => vi.fn());

vi.mock('../repositories/workOrderRepository', () => repo);
vi.mock('../../ranks/hodResolutionService', () => ({
  resolveHodForDepartment: vi.fn().mockResolvedValue({
    rankName: 'Chief Engineer',
    source: 'fallback',
    resolved: false,
  }),
}));
vi.mock('../services/complianceAnomalyService', () => ({
  invalidateComplianceCache: vi.fn(),
}));
vi.mock('../../sync', () => ({
  logFieldChanges: vi.fn(),
}));
vi.mock('../services/workOrderCompletionService', () => ({
  finalizeWorkOrderCompletion,
}));
vi.mock('../services/workOrderService', () => ({
  isSuperintendentLockEnabled: vi.fn().mockResolvedValue(false),
}));

const baseWorkOrder = {
  id: 'wo-1',
  wouuid: 'wouuid-1',
  vesselId: 'vessel-1',
  component: 'component-1',
  componentCode: '278.010.01',
  jobId: 'job-1',
  workOrderNo: 'WO-1',
  jobTitle: 'Test Job',
  department: 'Engine',
  approver: 'Chief Engineer',
  maintenanceBasis: 'Calendar',
  frequencyValue: '1',
  frequencyUnit: 'Weeks',
  dueDate: '20-Sep-2026',
  nextDueDate: '20-Sep-2026',
  dateCompleted: '2026-09-20T16:38:00.000Z',
  completionDateTime: '2026-09-10T14:36:00.000Z',
  missedCycles: 0,
  approvalTier: 'standard',
};

describe('final approval date projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findJob.mockResolvedValue({ juuid: 'job-1', level2ReviewerRankId: null });
    repo.update.mockImplementation(async (_id, updates) => ({ ...baseWorkOrder, ...updates }));
    repo.createAuditLog.mockResolvedValue(undefined);
    finalizeWorkOrderCompletion.mockResolvedValue(undefined);
  });

  it('bulk approval preserves dateCompleted and runs Job completion projection', async () => {
    repo.findById.mockResolvedValueOnce({ ...baseWorkOrder, status: 'Pending Approval' });
    const { bulkApprove } = await import('../services/workOrderBulkService');

    const result = await bulkApprove(['wo-1'], 'Chief Engineer');

    expect(result.results.failed).toEqual([]);
    expect(repo.update).toHaveBeenCalledWith(
      'wo-1',
      expect.objectContaining({ dateCompleted: baseWorkOrder.dateCompleted }),
    );
    expect(finalizeWorkOrderCompletion).toHaveBeenCalledWith('wo-1');
  });

  it('reviewer approval preserves dateCompleted before running Job completion projection', async () => {
    repo.findById.mockResolvedValueOnce({ ...baseWorkOrder, status: 'Pending Office Review' });
    const { reviewerApprove } = await import('../services/workOrderBulkService');

    await reviewerApprove('wo-1', 'Reviewed', 'reviewer-1');

    expect(repo.update).toHaveBeenCalledWith(
      'wo-1',
      expect.objectContaining({ dateCompleted: baseWorkOrder.dateCompleted }),
    );
    expect(finalizeWorkOrderCompletion).toHaveBeenCalledWith('wo-1');
  });
});