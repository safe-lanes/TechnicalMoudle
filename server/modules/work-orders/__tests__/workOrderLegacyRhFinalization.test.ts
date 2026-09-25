import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  getStorage: vi.fn(),
  findComponent: vi.fn(),
  findComponentByCode: vi.fn(),
  findComponents: vi.fn(),
  findMaintenanceHistoryByWorkOrderId: vi.fn(),
  createMaintenanceHistory: vi.fn(),
  findJob: vi.fn(),
  findJobs: vi.fn(),
  updateJob: vi.fn(),
}));

vi.mock('../repositories/workOrderRepository', () => repo);

describe('legacy RH approval finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.getStorage.mockReturnValue({
      getVessel: vi.fn(async () => ({ vCode: 'V001' })),
    });
    repo.findComponent.mockResolvedValue({
      cuuid: 'component-1',
      componentCode: '651.001',
      name: 'Main Engine',
      currentCumulativeRH: '7000',
    });
    repo.findMaintenanceHistoryByWorkOrderId.mockResolvedValue({});
    repo.findJob.mockResolvedValue({
      juuid: 'job-1',
      jobNo: 'JOB-1',
      lastDoneRH: 6000,
      nextDueRH: 6500,
      intervalRunningHour: 500,
    });
  });

  it('completes side effects without reducing newer Job RH values', async () => {
    repo.findById.mockResolvedValue({
      id: 'wo-1',
      wouuid: 'wo-uuid',
      workOrderNo: 'JOB-1-2026-1',
      status: 'Completed',
      vesselId: 'vessel-1',
      component: 'component-1',
      componentCode: '651.001',
      jobId: 'job-1',
      maintenanceBasis: 'Running Hours',
      dateCompleted: '2026-07-16T09:00:00.000Z',
      completionDateTime: '2026-07-16T09:00:00.000Z',
      woCompletionRh: '5000',
      runningHours: '5000',
      consumedSpareParts: [],
      missedCycles: 0,
    });

    const { finalizeWorkOrderCompletion } = await import('../services/workOrderCompletionService');
    await finalizeWorkOrderCompletion('wo-1');

    expect(repo.updateJob).toHaveBeenCalledWith('job-1', {
      lastDoneDate: '2026-07-16',
    });
    expect(repo.updateJob).not.toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ lastDoneRH: expect.anything() }),
    );
    expect(repo.updateJob).not.toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ nextDueRH: expect.anything() }),
    );
  });
});