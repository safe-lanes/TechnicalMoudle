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
  findRunningHoursAudits: vi.fn(),
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

  it('does not project from a rejected older completion even when its RH is higher', async () => {
    repo.findJob.mockResolvedValue({
      juuid: 'job-1', jobNo: 'JOB-1', lastDoneDate: '2026-02-12',
      lastDoneRH: 1200, nextDueRH: 1400, intervalRunningHour: 200,
    });
    repo.findById.mockResolvedValue({
      id: 'wo-older', wouuid: 'wo-older', workOrderNo: 'JOB-1-2026-1',
      status: 'Completed', vesselId: 'vessel-1', component: 'component-1',
      componentCode: '651.001', jobId: 'job-1', maintenanceBasis: 'Running Hours',
      dateCompleted: '2026-02-04', woCompletionRh: '1300', runningHours: '1300',
      consumedSpareParts: [], missedCycles: 0,
    });
    const { finalizeWorkOrderCompletion } = await import('../services/workOrderCompletionService');
    await finalizeWorkOrderCompletion('wo-older');
    expect(repo.updateJob).not.toHaveBeenCalledWith('job-1', expect.objectContaining({
      lastDoneRH: expect.anything(),
    }));
    expect(repo.updateJob).not.toHaveBeenCalledWith('job-1', expect.objectContaining({
      rhEstimatedDueDate: expect.anything(),
    }));
  });
});

describe('Vessel RH approval cycle estimate', () => {
  const wo = { maintenanceBasis: 'Running Hours', vesselId: 'vessel-1', workOrderNo: 'WO-RH' };
  const component = { cuuid: 'master-1', vesselId: 'vessel-1', rhCounterType: 'MASTER' };
  const job = {
    juuid: 'job-1', lastDoneDate: '2026-02-04', lastDoneRH: '1100',
    nextDueRH: '1300', intervalRunningHour: 200,
    rhEstimatedDueDate: '2026-02-22', rhAveragePerDay: '10.975610',
    rhEstimateBasis: 'RH_COMPLETION_FIRST_LATEST_V2_HISTORICAL',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces the complete old estimate tuple with the 12-Feb / 1200 cycle', async () => {
    repo.findRunningHoursAudits.mockResolvedValue([
      { cumulativeRH: '1100', dateUpdatedLocal: '2026-02-11' },
      { cumulativeRH: '1000', dateUpdatedLocal: '2026-02-01' },
    ]);
    const { buildApprovedRhJobUpdates } = await import('../services/workOrderService');
    const updates = await buildApprovedRhJobUpdates(job, wo, component, '2026-02-12', '1200');
    expect(updates).toMatchObject({
      lastDoneDate: '2026-02-12', lastDoneRH: 1200, nextDueRH: 1400,
      rhEstimatedDueDate: '2026-03-04', rhAveragePerDay: '10',
      rhEstimateBasis: 'RH_COMPLETION_FIRST_LATEST_V2_HISTORICAL',
    });
  });

  it('clears the previous estimate on first/next RH advance with insufficient history', async () => {
    repo.findRunningHoursAudits.mockResolvedValue([
      { cumulativeRH: '1200', dateUpdatedLocal: '2026-02-12' },
    ]);
    const { buildApprovedRhJobUpdates } = await import('../services/workOrderService');
    expect(await buildApprovedRhJobUpdates(job, wo, component, '2026-02-12', '1200')).toMatchObject({
      lastDoneRH: 1200, nextDueRH: 1400,
      rhEstimatedDueDate: null, rhAveragePerDay: null,
      rhEstimateBasis: 'RH_COMPLETION_FIRST_LATEST_V2_INSUFFICIENT_HISTORY',
    });
  });

  it('calculates the first completion when the MASTER already has two valid readings', async () => {
    repo.findRunningHoursAudits.mockResolvedValue([
      { cumulativeRH: '1100', dateUpdatedLocal: '2026-02-11' },
      { cumulativeRH: '1000', dateUpdatedLocal: '2026-02-01' },
    ]);
    const { buildApprovedRhJobUpdates } = await import('../services/workOrderService');
    const updates = await buildApprovedRhJobUpdates({
      ...job, lastDoneDate: null, lastDoneRH: null, nextDueRH: null,
      rhEstimatedDueDate: null, rhAveragePerDay: null,
    }, wo, component, '2026-02-12', '1200');
    expect(updates).toMatchObject({
      lastDoneDate: '2026-02-12', lastDoneRH: 1200, nextDueRH: 1400,
      rhEstimatedDueDate: '2026-03-04', rhAveragePerDay: '10',
    });
  });

  it('clears the old estimate if the authoritative MASTER cannot be found', async () => {
    const { buildApprovedRhJobUpdates } = await import('../services/workOrderService');
    const updates = await buildApprovedRhJobUpdates(
      job, wo, { ...component, rhCounterType: 'INHERITED', rhMasterComponentId: 'missing' },
      '2026-02-12', '1200',
    );
    expect(updates).toMatchObject({
      lastDoneRH: 1200, nextDueRH: 1400, rhEstimatedDueDate: null,
      rhAveragePerDay: null,
      rhEstimateBasis: 'RH_COMPLETION_FIRST_LATEST_V2_MISSING_RH_SOURCE',
    });
  });

  it('keeps the current cycle when an older or duplicate WO is approved', async () => {
    const { buildApprovedRhJobUpdates } = await import('../services/workOrderService');
    expect(await buildApprovedRhJobUpdates(
      { ...job, lastDoneDate: '2026-02-12', lastDoneRH: '1200', nextDueRH: '1400' },
      wo, component, '2026-02-04', '1300',
    )).toEqual({});
    expect(await buildApprovedRhJobUpdates(
      { ...job, lastDoneDate: '2026-02-12', lastDoneRH: '1200', nextDueRH: '1400' },
      wo, component, '2026-02-12', '1200',
    )).toEqual({});
    expect(repo.findRunningHoursAudits).not.toHaveBeenCalled();
  });

  it('does not touch the RH tuple for a date-only Dual Frequency completion', async () => {
    const { buildApprovedRhJobUpdates } = await import('../services/workOrderService');
    const updates = await buildApprovedRhJobUpdates(
      { ...job, frequencyValue: '1', frequencyUnit: 'Months' },
      { ...wo, maintenanceBasis: 'Dual Frequency' }, component, '2026-02-12', null,
    );
    expect(updates.lastDoneDate).toBe('2026-02-12');
    expect(updates.lastDoneRH).toBeUndefined();
    expect(updates.rhEstimatedDueDate).toBeUndefined();
    expect(repo.findRunningHoursAudits).not.toHaveBeenCalled();
  });

  it('re-reads the Job after a CAS conflict instead of writing an older estimate', async () => {
    repo.findRunningHoursAudits.mockResolvedValue([
      { cumulativeRH: '1100', dateUpdatedLocal: '2026-02-11' },
      { cumulativeRH: '1000', dateUpdatedLocal: '2026-02-01' },
    ]);
    const cas = vi.fn().mockResolvedValueOnce(null);
    repo.getStorage.mockReturnValue({ updateJobIfRhCycleUnchanged: cas });
    repo.findJob.mockResolvedValue({
      ...job, lastDoneDate: '2026-02-12', lastDoneRH: '1200',
      nextDueRH: '1400', rhEstimatedDueDate: '2026-03-04',
    });
    const { persistApprovedRhJobCycle } = await import('../services/workOrderService');
    await persistApprovedRhJobCycle(job, wo, component, '2026-02-12', '1200');
    expect(cas).toHaveBeenCalledTimes(1);
    expect(repo.findJob).toHaveBeenCalledWith(job.juuid);
  });
});