import { beforeEach, describe, expect, it, vi } from 'vitest';

// These doubles are the only persistence boundary. No live repository, pool,
// scheduler, inventory implementation or sync applier is loaded.
const repo = vi.hoisted(() => ({
  findById: vi.fn(), findComponent: vi.fn(), findComponentByCode: vi.fn(),
  findComponents: vi.fn(), findJob: vi.fn(), findJobs: vi.fn(), findJobsByVessel: vi.fn(),
  findMaintenanceHistoryByWorkOrderId: vi.fn(), createMaintenanceHistory: vi.fn(),
  update: vi.fn(), updateJob: vi.fn(), createAuditLog: vi.fn(),
  findSpares: vi.fn(), getInventoryTransactions: vi.fn(), performInventoryTransaction: vi.fn(),
  findOrCreateLocation: vi.fn(), getStorage: vi.fn(),
}));
const sideEffects = vi.hoisted(() => ({
  log: vi.fn(), persistRh: vi.fn(), anomaly: vi.fn(), validateRh: vi.fn(),
}));

vi.mock('../repositories/workOrderRepository', () => repo);
vi.mock('../../sync', () => ({ logFieldChanges: sideEffects.log }));
vi.mock('../../sync/syncRole', () => ({ isShipInstance: vi.fn().mockResolvedValue(true) }));
vi.mock('../services/workOrderService', () => ({
  isSuperintendentLockEnabled: vi.fn().mockResolvedValue(false),
  persistApprovedRhJobCycle: sideEffects.persistRh,
}));
vi.mock('../services/anomalyDetectionService', () => ({ detectAndLogAnomalies: sideEffects.anomaly }));
vi.mock('../services/complianceAnomalyService', () => ({ invalidateComplianceCache: vi.fn() }));
vi.mock('../../running-hours/services/rhTimelineValidationService', () => ({
  validateRHEntry: sideEffects.validateRh,
}));
vi.mock('../../ranks/hodResolutionService', () => ({
  resolveHodForDepartment: vi.fn().mockResolvedValue({
    rankName: 'Chief Engineer', source: 'fallback', resolved: false,
  }),
}));
// A stray production import is a test failure, not access to a real database.
vi.mock('../../../db', () => ({ getDb: () => { throw new Error('Live DB access forbidden'); } }));

import { completeWorkOrder, finalizeWorkOrderCompletion } from '../services/workOrderCompletionService';
import { bulkApprove } from '../services/workOrderBulkService';
import { createSkippedCycleRecords, createSkippedCycleRecordsRH } from '../utils/skippedCycleBackfill';

let wo: any;
let history: any[];
let transactions: any[];
let job: any;
const component = {
  id: 'local-component-7', cuuid: 'component-canonical', name: 'Pump',
  vesselId: 'ship-A', componentCode: '601', rhCounterType: 'NOT_RH_DRIVEN',
  currentCumulativeRH: '9000',
};
const params = {
  workOrderId: 'wo-canonical', componentId: 'component-canonical', componentCode: '601',
  vesselCode: 'ship-A', jobId: 'job-canonical', jobCode: 'JOB-1', jobTitle: 'Pump service',
  originalDueDate: '01-Jan-2026', missedCycles: 2, frequencyValue: '1', frequencyUnit: 'months',
};

beforeEach(() => {
  vi.clearAllMocks();
  history = []; transactions = [];
  wo = {
    id: 'local-wo-1', wouuid: 'wo-canonical', vesselId: 'ship-A',
    component: component.cuuid, componentCode: component.componentCode,
    jobId: 'job-canonical', jobTitle: 'Pump service', workOrderNo: '001-JOB-1-601-2026-001',
    status: 'Pending Approval', department: 'Engine', approver: 'Chief Engineer',
    maintenanceBasis: 'Calendar', frequencyValue: '1', frequencyUnit: 'months',
    dueDate: '01-Jan-2026', nextDueDate: '01-Jan-2026',
    dateCompleted: '2026-04-02', completionDateTime: '2026-04-02T12:00:00',
    approvalTier: 'standard', consumedSpareParts: [],
    rhLastDoneSnapshot: '100', rhNextDueSnapshot: '200', lastDoneDateSnapshot: '01-Dec-2025',
  };
  job = {
    id: 'local-job-1', juuid: 'job-canonical', jobNo: 'JOB-1', vesselId: 'ship-A',
    frequencyValue: '1', frequencyUnit: 'months', intervalRunningHour: 100,
    maintenanceBasis: 'Calendar', lastDoneDate: '01-Dec-2025', lastDoneRH: '100',
  };
  repo.findById.mockImplementation(async () => ({ ...wo }));
  repo.findComponent.mockResolvedValue({ ...component });
  repo.findComponentByCode.mockResolvedValue(undefined);
  repo.findComponents.mockResolvedValue([{ ...component }]);
  repo.findJob.mockImplementation(async () => ({ ...job }));
  repo.findJobs.mockImplementation(async () => [{ ...job }]);
  repo.findJobsByVessel.mockImplementation(async () => [{ ...job }]);
  repo.getStorage.mockReturnValue({ getVessel: vi.fn().mockResolvedValue({ vCode: '001' }) });
  repo.findMaintenanceHistoryByWorkOrderId.mockImplementation(async id =>
    history.find(row => row.workOrderId === id));
  repo.createMaintenanceHistory.mockImplementation(async row => {
    // Mirror the schema's component FK. This is not real PostgreSQL validation.
    if (row.componentId !== component.cuuid) throw new Error('Fixture component FK rejection');
    const stored = { ...row, cmhuuid: `fixture-history-${history.length + 1}` };
    history.push(stored);
    return stored;
  });
  repo.update.mockImplementation(async (_id, changes) => {
    wo = { ...wo, ...changes };
    return { ...wo };
  });
  repo.updateJob.mockImplementation(async (_id, changes) => {
    job = { ...job, ...changes };
    return { ...job };
  });
  repo.getInventoryTransactions.mockImplementation(async () => [...transactions]);
  repo.performInventoryTransaction.mockImplementation(async row => {
    transactions.push({ ...row });
    return row;
  });
  repo.findSpares.mockResolvedValue([{ id: 7, suuid: 'spare-canonical', partCode: 'P1' }]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('severe review: actual completion services with isolated persistence', () => {
  it('current bulk approval catches invalid skipped component identity; finalizer creates Approved history', async () => {
    const result = await bulkApprove([wo.id], 'Chief Engineer', 'Reviewed',
      'Maintenance was delayed because the equipment was unavailable during shutdown.');
    expect(result.results.failed).toEqual([]);
    expect(repo.createMaintenanceHistory).toHaveBeenCalledWith(expect.objectContaining({
      componentId: '', status: 'SKIPPED',
    }));
    expect(history.filter(row => row.status === 'Approved')).toHaveLength(1);
    expect(history.filter(row => row.isSkipped)).toHaveLength(0);
  });

  it('finalizer does NOT call backfill; an existing SKIPPED row suppresses Approved history', async () => {
    await createSkippedCycleRecords(params);
    wo = { ...wo, status: 'Completed', missedCycles: 2, originalDueDate: params.originalDueDate };
    await finalizeWorkOrderCompletion(wo.id);
    await finalizeWorkOrderCompletion(wo.id);
    expect(history).toHaveLength(2); // No additional skipped records from finalizer.
    expect(history.every(row => row.isSkipped)).toBe(true);
    expect(repo.updateJob).toHaveBeenCalled();
  });

  it.fails('[KNOWN DEFECT] finalizer should create Approved history even when SKIPPED history exists', async () => {
    await createSkippedCycleRecords(params);
    await finalizeWorkOrderCompletion(wo.id);
    expect(history.some(row => row.status === 'Approved')).toBe(true);
  });

  it('actual Calendar completion writes Approved history but skipped rows lose jobCode', async () => {
    await completeWorkOrder(wo.id, { dateOfCompletion: '2026-04-02', performedBy: 'Engineer' });
    expect(history.find(row => row.status === 'Approved')).toMatchObject({
      componentId: component.cuuid, jobId: job.juuid, jobCode: 'JOB-1', workOrderId: wo.wouuid,
    });
    const skipped = history.filter(row => row.isSkipped);
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every(row => row.jobCode === undefined)).toBe(true);
    expect(skipped.every(row => row.workOrderNo === 'SKIPPED-job-canonical')).toBe(true);
    expect(sideEffects.persistRh).not.toHaveBeenCalled();
    expect(sideEffects.validateRh).not.toHaveBeenCalled();
    expect(wo).toMatchObject({ rhLastDoneSnapshot: '100', rhNextDueSnapshot: '200',
      lastDoneDateSnapshot: '01-Dec-2025' });
  });

  it.each(['Running Hours', 'Dual Frequency'])(
    'actual %s completion uses canonical component/job UUID but lacks skipped jobCode', async basis => {
      wo = { ...wo, maintenanceBasis: basis, frequencyValue: basis === 'Running Hours' ? '100' : '1',
        nextDueReading: '200' };
      job = { ...job, maintenanceBasis: basis };
      // NOT_RH_DRIVEN fixture intentionally isolates history math from live RH writes.
      await completeWorkOrder(wo.id, {
        dateOfCompletion: '2026-04-02', runningHours: '600', woCompletionRh: '600',
      });
      const skipped = history.filter(row => row.isSkipped);
      expect(skipped.length).toBeGreaterThan(0);
      expect(skipped.every(row => row.componentId === component.cuuid && row.jobId === job.juuid)).toBe(true);
      expect(skipped.every(row => row.jobCode === undefined)).toBe(true);
      expect(sideEffects.validateRh).not.toHaveBeenCalled();
    },
  );

  it('dedicated repeated completion duplicates backfill but not Approved history', async () => {
    const body = { dateOfCompletion: '2026-04-02' };
    await completeWorkOrder(wo.id, body);
    const firstSkipped = history.filter(row => row.isSkipped).length;
    await completeWorkOrder(wo.id, body);
    expect(history.filter(row => row.status === 'Approved')).toHaveLength(1);
    expect(history.filter(row => row.isSkipped).length).toBe(firstSkipped * 2);
  });

  it('finalizer consumes spare only once on retry using canonical WO reference', async () => {
    wo.consumedSpareParts = [{ partCode: 'P1', quantityConsumed: 2, locationId: 10 }];
    await finalizeWorkOrderCompletion(wo.id);
    await finalizeWorkOrderCompletion(wo.id);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ referenceId: 'wo-canonical', spareId: 7, qtyChange: -2 });
  });

  it('out-of-order RH finalization drops lower dated RH cycle writes and preserves snapshots', async () => {
    wo = { ...wo, maintenanceBasis: 'Running Hours', woCompletionRh: '200' };
    job = { ...job, maintenanceBasis: 'Running Hours', lastDoneDate: '2026-06-01', lastDoneRH: '900' };
    await finalizeWorkOrderCompletion(wo.id);
    expect(sideEffects.persistRh).not.toHaveBeenCalled();
    expect(repo.updateJob.mock.calls.every(([, update]) => update.lastDoneRH === undefined)).toBe(true);
    expect(wo.rhLastDoneSnapshot).toBe('100');
  });

  it('Level 2 bulk transition does not run finalization or backfill', async () => {
    job.level2ReviewerRankId = 'reviewer-rank';
    const result = await bulkApprove([wo.id], 'Chief Engineer', 'Reviewed',
      'Maintenance was delayed because the equipment was unavailable during shutdown.');
    expect(result.results.failed).toEqual([]);
    expect(wo.status).toBe('Pending Office Review');
    expect(repo.createMaintenanceHistory).not.toHaveBeenCalled();
    expect(repo.performInventoryTransaction).not.toHaveBeenCalled();
  });
});

describe('severe review: actual skipped-cycle helpers', () => {
  it.fails('[KNOWN DEFECT] repeated Calendar backfill should not create duplicate cycles', async () => {
    await createSkippedCycleRecords(params);
    await createSkippedCycleRecords(params);
    expect(history).toHaveLength(2);
  });

  it('Calendar null value warns/returns while null unit throws', async () => {
    await createSkippedCycleRecords({ ...params, frequencyValue: null as any });
    expect(history).toHaveLength(0);
    await expect(createSkippedCycleRecords({ ...params, frequencyUnit: null as any }))
      .rejects.toThrow('toLowerCase');
    expect(history).toHaveLength(0);
  });

  it('caps Calendar and RH backfill at 104 without changing RH interval arithmetic', async () => {
    await createSkippedCycleRecords({ ...params, missedCycles: 1000 });
    expect(history).toHaveLength(104);
    history = [];
    await createSkippedCycleRecordsRH({
      ...params, workOrderNo: 'WO-1', dueRH: 200, completionRH: 10000,
      intervalRH: 100, missedCycles: 1000,
    });
    expect(history).toHaveLength(104);
    expect(history[0].runningHoursAtCompletion).toBe('300');
    expect(history[103].runningHoursAtCompletion).toBe('10600');
  });
});
