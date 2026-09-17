import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = {
  findById: vi.fn(),
  findJob: vi.fn(),
  findComponent: vi.fn(),
  findComponentByCode: vi.fn(),
  findComponents: vi.fn(),
  findMaintenanceHistoryByWorkOrderId: vi.fn(),
  createMaintenanceHistory: vi.fn(),
  updateJob: vi.fn(),
  createAuditLog: vi.fn(),
  update: vi.fn(),
};

vi.mock('../repositories/workOrderRepository', () => repo);
vi.mock('../../sync', () => ({
  logFieldChanges: vi.fn(async () => {}),
  logFieldChangesBatch: vi.fn(async () => {}),
}));
vi.mock('../../../storage', () => ({
  storage: {
    getPmsVesselSettings: vi.fn(async () => ({ superintendentLockEnabled: false })),
    getVessel: vi.fn(async () => ({ vCode: 'V001' })),
  },
}));
vi.mock('../../ranks/hodResolutionService', () => ({
  resolveHodForDepartment: vi.fn(async () => ({
    rankName: 'Chief Engineer',
    source: 'fallback',
    resolved: false,
  })),
  getHodShortLabel: vi.fn(() => 'C/E'),
}));
vi.mock('../../sync/syncRole', () => ({
  isShipInstance: vi.fn(async () => false),
}));
vi.mock('../services/workOrderGenerationGate', () => ({
  isOfficeRhEntryEnabled: vi.fn(async () => false),
}));

describe('PATCH Work Order B2 snapshot validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findComponent.mockResolvedValue({
      cuuid: 'component-1',
      name: 'Main Engine',
      componentCode: '651.001',
      rhCounterType: 'MASTER',
    });
    repo.findJob.mockResolvedValue({
      juuid: 'job-1',
      jobNo: 'JOB-1',
      level2ReviewerRankId: null,
      lastDoneRH: 6000,
      nextDueRH: 6500,
      intervalRunningHour: 500,
    });
    repo.findMaintenanceHistoryByWorkOrderId.mockResolvedValue({});
    repo.update.mockImplementation(async (_id, updates) => ({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Pending Approval',
      maintenanceBasis: 'Running Hours',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      consumedSpareParts: [],
      ...updates,
    }));
  });

  it('rejects an earlier Calendar Start Date before persistence', async () => {
    repo.findById.mockResolvedValue({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Active',
      maintenanceBasis: 'Calendar',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      lastDoneDateSnapshot: '15-Jul-2026',
    });

    const { updateWorkOrder } = await import('../services/workOrderService');
    await expect(updateWorkOrder('wo-1', {
      startDateTime: '2026-07-14T08:00',
    })).rejects.toMatchObject({
      message: 'Start Date must be after Last Completed On (2026-07-15).',
    });
  });

  it('rejects lower RH completion hours before persistence', async () => {
    repo.findById.mockResolvedValue({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Active',
      maintenanceBasis: 'Running Hours',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      rhLastDoneSnapshot: '5000',
    });

    const { updateWorkOrder } = await import('../services/workOrderService');
    await expect(updateWorkOrder('wo-1', {
      woCompletionRh: '4999',
    })).rejects.toMatchObject({
      message: 'WO Completion RH must be greater than Last Completed At (5000 Hours).',
    });
  });

  it('rejects a Part B mutation included in a legacy approval payload', async () => {
    repo.findById.mockResolvedValue({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Pending Approval',
      maintenanceBasis: 'Running Hours',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      startDateTime: '2026-07-16T08:00',
      lastDoneDateSnapshot: '15-Jul-2026',
      woCompletionRh: '5000',
      rhLastDoneSnapshot: '5000',
    });

    const { updateWorkOrder } = await import('../services/workOrderService');
    await expect(updateWorkOrder('wo-1', {
      status: 'Completed',
      approvalAction: 'approved',
      startDateTime: '2026-07-17T08:00',
    })).rejects.toMatchObject({
      message: expect.stringContaining('Cannot modify [startDateTime]'),
      details: expect.objectContaining({
        code: 'PENDING_APPROVAL_EXECUTION_FIELDS_READ_ONLY',
      }),
    });
  });

  it('approves an unchanged legacy Pending Approval payload without rewriting echoed Part B', async () => {
    const legacyWO = {
      id: 'wo-1',
      wouuid: 'wo-uuid',
      workOrderNo: 'JOB-1-2026-1',
      status: 'Pending Approval',
      maintenanceBasis: 'Running Hours',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      jobId: 'job-1',
      startDateTime: '2026-07-15T08:00',
      completionDateTime: '2026-07-16T09:00:00.000Z',
      // The authoritative persisted final date may differ from the execution
      // timestamp echoed by the production approval UI.
      dateCompleted: '2026-07-16T12:00:00.000Z',
      lastDoneDateSnapshot: '15-Jul-2026',
      runningHours: '5000',
      woCompletionRh: '5000',
      rhLastDoneSnapshot: '5000',
      approvalTier: 'standard',
      missedCycles: 0,
      consumedSpareParts: [],
    };
    repo.findById.mockResolvedValue(legacyWO);
    repo.update.mockImplementation(async (_id, updates) => ({ ...legacyWO, ...updates }));

    const { updateWorkOrder } = await import('../services/workOrderService');
    await expect(updateWorkOrder('wo-1', {
      status: 'Completed',
      approvalAction: 'approved',
      startDateTime: legacyWO.startDateTime,
      woCompletionRh: legacyWO.woCompletionRh,
      // Exact WorkOrderFormPage.handleApprove payload shape.
      dateCompleted: legacyWO.completionDateTime,
    })).resolves.toMatchObject({
      workOrder: { status: 'Completed' },
    });

    const firstApprovalUpdate = repo.update.mock.calls.find(
      ([, updates]) => updates.status === 'Completed',
    )?.[1];
    expect(firstApprovalUpdate).toBeDefined();
    expect(firstApprovalUpdate).not.toHaveProperty('startDateTime');
    expect(firstApprovalUpdate).not.toHaveProperty('woCompletionRh');
    expect(firstApprovalUpdate).not.toHaveProperty('completionDateTime');
    expect(firstApprovalUpdate.dateCompleted).toBe(legacyWO.dateCompleted);
    expect(repo.updateJob).not.toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ lastDoneRH: expect.anything() }),
    );
    expect(repo.updateJob).not.toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ nextDueRH: expect.anything() }),
    );
  });

  it('rejects mutation of legacy RH metadata during approval', async () => {
    repo.findById.mockResolvedValue({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Pending Approval',
      maintenanceBasis: 'Running Hours',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      completionDateTime: '2026-07-16T09:00:00.000Z',
      completionRH: '5000',
    });

    const { updateWorkOrder } = await import('../services/workOrderService');
    await expect(updateWorkOrder('wo-1', {
      status: 'Completed',
      approvalAction: 'approved',
      completionRH: '4999',
    })).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'PENDING_APPROVAL_EXECUTION_FIELDS_READ_ONLY',
        disallowedFields: ['completionRH'],
      }),
    });
  });

  it('rejects a genuinely changed completion date during approval', async () => {
    repo.findById.mockResolvedValue({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Pending Approval',
      maintenanceBasis: 'Calendar',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      completionDateTime: '2026-07-16T09:00:00.000Z',
      dateCompleted: '2026-07-16T12:00:00.000Z',
    });

    const { updateWorkOrder } = await import('../services/workOrderService');
    await expect(updateWorkOrder('wo-1', {
      status: 'Completed',
      approvalAction: 'approved',
      dateCompleted: '2026-07-17T09:00:00.000Z',
    })).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'PENDING_APPROVAL_EXECUTION_FIELDS_READ_ONLY',
        disallowedFields: ['dateCompleted'],
      }),
    });
  });

  it('rejects an invalid Start Date through Pending Approval office edit', async () => {
    repo.findById.mockResolvedValue({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Pending Approval',
      maintenanceBasis: 'Calendar',
      component: 'component-1',
      componentCode: '651.001',
      vesselId: 'vessel-1',
      lastDoneDateSnapshot: '15-Jul-2026',
    });

    const { updateWorkOrder } = await import('../services/workOrderService');
    await expect(updateWorkOrder('wo-1', {
      partBOfficeEdit: true,
      userRole: 'Office',
      startDateTime: '2026-07-15T08:00',
    })).rejects.toMatchObject({
      message: 'Start Date must be after Last Completed On (2026-07-15).',
    });

    expect(repo.update).not.toHaveBeenCalled();
  });
});