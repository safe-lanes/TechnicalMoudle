import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = {
  findById: vi.fn(),
  findComponent: vi.fn(),
  findComponentByCode: vi.fn(),
  findComponents: vi.fn(),
  update: vi.fn(),
};

vi.mock('../repositories/workOrderRepository', () => repo);
vi.mock('../../sync', () => ({
  logFieldChanges: vi.fn(async () => {}),
  logFieldChangesBatch: vi.fn(async () => {}),
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

  it('revalidates stored B2 values during final approval', async () => {
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
    })).rejects.toMatchObject({
      message: 'WO Completion RH must be greater than Last Completed At (5000 Hours).',
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