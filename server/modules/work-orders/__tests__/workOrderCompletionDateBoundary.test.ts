import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('rejects a Start Date equal to the immutable Last Completed On snapshot', async () => {
    repo.findById.mockResolvedValueOnce({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Active',
      maintenanceBasis: 'Calendar',
      component: 'component-1',
      dateCompleted: null,
      lastDoneDateSnapshot: '15-Jul-2026',
    });

    const { completeWorkOrder } = await import('../services/workOrderCompletionService');
    await expect(completeWorkOrder('wo-1', {
      dateOfCompletion: '16-Jul-2026',
      startDateTime: '2026-07-15T08:00',
    })).rejects.toMatchObject({
      message: 'Start Date must be after Last Completed On (2026-07-15).',
    });

    expect(repo.findComponent).not.toHaveBeenCalled();
    expect(repo.getStorage).not.toHaveBeenCalled();
  });

  it('rejects RH completion equal to the immutable Last Completed At snapshot', async () => {
    repo.findById.mockResolvedValueOnce({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      status: 'Active',
      maintenanceBasis: 'Running Hours',
      component: 'component-1',
      dateCompleted: null,
      rhLastDoneSnapshot: '5000',
    });

    const { completeWorkOrder } = await import('../services/workOrderCompletionService');
    await expect(completeWorkOrder('wo-1', {
      dateOfCompletion: '16-Jul-2026',
      woCompletionRh: '5000',
    })).rejects.toMatchObject({
      message: 'WO Completion RH must be greater than Last Completed At (5000 Hours).',
    });

    expect(repo.findComponent).not.toHaveBeenCalled();
    expect(repo.getStorage).not.toHaveBeenCalled();
  });
});