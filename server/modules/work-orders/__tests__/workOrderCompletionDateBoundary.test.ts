import { describe, expect, it, vi } from 'vitest';

const repo = {
  findById: vi.fn(),
  getStorage: vi.fn(),
  findComponent: vi.fn(),
  findComponentByCode: vi.fn(),
  findComponents: vi.fn(),
};

vi.mock('../repositories/workOrderRepository', () => repo);
vi.mock('../../sync', () => ({ logFieldChanges: vi.fn(async () => {}) }));

describe('direct Work Order completion date boundary', () => {
  it('rejects a date-less completion before component lookup, RH work, or audits', async () => {
    repo.findById.mockResolvedValueOnce({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Pending Approval',
      dateCompleted: null,
      completionDateTime: null,
      maintenanceBasis: 'Running Hours',
      component: 'component-1',
    });

    const { completeWorkOrder } = await import('../services/workOrderCompletionService');
    await expect(completeWorkOrder('wo-1', {
      runningHours: '5000',
      woCompletionRh: '5000',
    })).rejects.toThrow('completion date is required');

    expect(repo.findComponent).not.toHaveBeenCalled();
    expect(repo.getStorage).not.toHaveBeenCalled();
  });
});