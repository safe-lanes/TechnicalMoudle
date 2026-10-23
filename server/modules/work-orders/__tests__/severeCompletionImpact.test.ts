import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isVisibleMaintenanceHistory } from '../../../../shared/workOrders/maintenanceHistoryVisibility';

// Lifecycle tests use an isolated repository. Atomic persistence is tested separately.
const repo = vi.hoisted(() => ({
  findById: vi.fn(), findComponent: vi.fn(), findComponentByCode: vi.fn(),
  findComponents: vi.fn(), findJob: vi.fn(), findJobs: vi.fn(), findJobsByVessel: vi.fn(),
  findMaintenanceHistoryByWorkOrderId: vi.fn(), findMaintenanceHistoryForSource: vi.fn(),
  createMaintenanceHistory: vi.fn(), update: vi.fn(), updateJob: vi.fn(), createAuditLog: vi.fn(),
  findSpares: vi.fn(), getInventoryTransactions: vi.fn(), performInventoryTransaction: vi.fn(),
  findOrCreateLocation: vi.fn(), getStorage: vi.fn(),
}));
const effects = vi.hoisted(() => ({ log: vi.fn(), persistRh: vi.fn(), anomaly: vi.fn(), validateRh: vi.fn() }));
vi.mock('../repositories/workOrderRepository', () => repo);
vi.mock('../../sync', () => ({ logFieldChanges: effects.log }));
vi.mock('../../sync/syncRole', () => ({ isShipInstance: vi.fn().mockResolvedValue(true) }));
vi.mock('../services/workOrderService', () => ({
  isSuperintendentLockEnabled: vi.fn().mockResolvedValue(false),
  persistApprovedRhJobCycle: effects.persistRh,
}));
vi.mock('../services/anomalyDetectionService', () => ({ detectAndLogAnomalies: effects.anomaly }));
vi.mock('../services/complianceAnomalyService', () => ({ invalidateComplianceCache: vi.fn() }));
vi.mock('../../running-hours/services/rhTimelineValidationService', () => ({ validateRHEntry: effects.validateRh }));
vi.mock('../../ranks/hodResolutionService', () => ({
  resolveHodForDepartment: vi.fn().mockResolvedValue({ rankName: 'Chief Engineer', source: 'fallback' }),
}));
vi.mock('../../../db', () => ({ getDb: () => { throw new Error('Live DB forbidden'); } }));

import { completeWorkOrder, finalizeWorkOrderCompletion } from '../services/workOrderCompletionService';
import { bulkApprove, reviewerApprove } from '../services/workOrderBulkService';
import { createSkippedCycleRecords, createSkippedCycleRecordsRH } from '../utils/skippedCycleBackfill';

let wo: any, job: any, history: any[], transactions: any[];
const component = { cuuid: 'component-canonical', name: 'Pump', vesselId: 'ship-A',
  componentCode: '601', rhCounterType: 'NOT_RH_DRIVEN', currentCumulativeRH: '9000' };
const params = { workOrderId: 'wo-canonical', componentId: component.cuuid, componentCode: '601',
  vesselCode: 'ship-A', jobId: 'job-canonical', jobCode: 'JOB-1', jobTitle: 'Pump service',
  originalDueDate: '01-Jan-2026', missedCycles: 2, frequencyValue: '1', frequencyUnit: 'months' };

beforeEach(() => {
  vi.clearAllMocks();
  history = []; transactions = [];
  wo = { id: 'local-wo-1', wouuid: 'wo-canonical', vesselId: 'ship-A',
    component: component.cuuid, componentCode: '601', jobId: 'job-canonical', jobTitle: 'Pump service',
    workOrderNo: '001-JOB-1-601-2026-001', status: 'Pending Approval', department: 'Engine',
    approver: 'Chief Engineer', maintenanceBasis: 'Calendar', frequencyValue: '1', frequencyUnit: 'months',
    dueDate: '01-Jan-2026', nextDueDate: '01-Jan-2026', dateCompleted: '2026-04-02',
    completionDateTime: '2026-04-02T12:00:00', approvalTier: 'standard', consumedSpareParts: [],
    rhLastDoneSnapshot: '100', rhNextDueSnapshot: '200', lastDoneDateSnapshot: '01-Dec-2025' };
  job = { juuid: 'job-canonical', jobNo: 'JOB-1', vesselId: 'ship-A', frequencyValue: '1',
    frequencyUnit: 'months', intervalRunningHour: 100, maintenanceBasis: 'Calendar',
    lastDoneDate: '01-Dec-2025', lastDoneRH: '100' };
  repo.findById.mockImplementation(async () => ({ ...wo }));
  repo.findComponent.mockResolvedValue({ ...component });
  repo.findComponentByCode.mockResolvedValue(undefined);
  repo.findComponents.mockResolvedValue([{ ...component }]);
  repo.findJob.mockImplementation(async () => ({ ...job }));
  repo.findJobs.mockImplementation(async () => [{ ...job }]);
  repo.findJobsByVessel.mockImplementation(async () => [{ ...job }]);
  repo.getStorage.mockReturnValue({ getVessel: vi.fn().mockResolvedValue({ vCode: '001' }) });
  repo.findMaintenanceHistoryByWorkOrderId.mockImplementation(async id =>
    history.find(row => row.workOrderId === id && isVisibleMaintenanceHistory(row)));
  repo.findMaintenanceHistoryForSource.mockImplementation(async id =>
    history.filter(row => row.workOrderId === id || row.sourceWorkOrderId === id));
  repo.createMaintenanceHistory.mockImplementation(async row => {
    if (row.componentId !== component.cuuid) throw new Error('Fixture component FK rejection');
    const existing = history.find(h => h.workOrderId === row.workOrderId
      && isVisibleMaintenanceHistory(h) === isVisibleMaintenanceHistory(row)
      && (isVisibleMaintenanceHistory(row) || (row.runningHoursAtCompletion != null
        ? Number(h.runningHoursAtCompletion) === Number(row.runningHoursAtCompletion)
        : h.skippedCycleDate === row.skippedCycleDate)));
    if (existing) return existing;
    const stored = { ...row, cmhuuid: `fixture-${history.length}` };
    history.push(stored);
    return stored;
  });
  repo.update.mockImplementation(async (_id, changes) => (wo = { ...wo, ...changes }));
  repo.updateJob.mockImplementation(async (_id, changes) => (job = { ...job, ...changes }));
  repo.getInventoryTransactions.mockImplementation(async () => [...transactions]);
  repo.performInventoryTransaction.mockImplementation(async row => { transactions.push(row); return row; });
  repo.findSpares.mockResolvedValue([{ id: 7, suuid: 'spare-canonical', partCode: 'P1' }]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const justification = 'Maintenance delayed because the equipment was unavailable during shutdown.';
describe('actual completion lifecycle, isolated persistence', () => {
  it.each(['Calendar', 'Running Hours', 'Dual Frequency'])('bulk %s approval creates correctly linked skips without suppressing actual maintenance', async basis => {
    wo.maintenanceBasis = basis;
    wo.nextDueReading = '200'; wo.woCompletionRh = '500'; wo.runningHours = '550';
    wo.frequencyValue = basis === 'Running Hours' ? '100' : '1';
    job.maintenanceBasis = basis;
    const result = await bulkApprove([wo.id], 'Chief Engineer', 'Reviewed', justification);
    expect(result.results.failed).toEqual([]);
    expect(history.filter(isVisibleMaintenanceHistory)).toHaveLength(1);
    const skipped = history.filter(h => !isVisibleMaintenanceHistory(h));
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every(h => h.componentId === component.cuuid && h.jobCode === 'JOB-1')).toBe(true);
    expect(new Set(skipped.map(h => h.workOrderNo)).size).toBe(skipped.length);
    expect(skipped.every(h => h.workOrderNo !== wo.workOrderNo && h.sourceWorkOrderId === wo.wouuid)).toBe(true);
  });

  it('existing skipped rows never suppress actual final completion, including retries', async () => {
    await createSkippedCycleRecords(params);
    wo = { ...wo, status: 'Completed', missedCycles: 2, originalDueDate: params.originalDueDate };
    await finalizeWorkOrderCompletion(wo.id);
    await finalizeWorkOrderCompletion(wo.id);
    expect(history.filter(isVisibleMaintenanceHistory)).toHaveLength(1);
    expect(history.filter(h => !isVisibleMaintenanceHistory(h))).toHaveLength(2);
  });

  it.each(['Calendar', 'Dual Frequency'])('direct %s completion writes separate actual and skipped history', async basis => {
    wo.maintenanceBasis = basis;
    await completeWorkOrder(wo.id, { dateOfCompletion: '2026-04-02', performedBy: 'Engineer' });
    const actual = history.find(isVisibleMaintenanceHistory);
    expect(actual).toMatchObject({ componentId: component.cuuid, jobId: job.juuid, jobCode: 'JOB-1',
      workOrderId: wo.wouuid, workOrderNo: wo.workOrderNo });
    expect(history.some(h => h.isSkipped)).toBe(true);
    const firstLength = history.length;
    await completeWorkOrder(wo.id, { dateOfCompletion: '2026-04-02', performedBy: 'Engineer' });
    expect(history).toHaveLength(firstLength);
    expect(effects.validateRh).not.toHaveBeenCalled();
  });

  it('RH direct completion preserves cycle boundaries and distinguishes same-day RH skips', async () => {
    wo = { ...wo, maintenanceBasis: 'Running Hours', nextDueReading: '200', frequencyValue: '100' };
    job.maintenanceBasis = 'Running Hours';
    await completeWorkOrder(wo.id, { dateOfCompletion: '2026-04-02', runningHours: '550', woCompletionRh: '500' });
    const skipped = history.filter(h => h.isSkipped);
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped[0].runningHoursAtCompletion).toBe('300');
    expect(new Set(skipped.map(h => h.workOrderNo)).size).toBe(skipped.length);
    expect(skipped.every(h => h.workOrderNo !== wo.workOrderNo)).toBe(true);
  });

  it.each(['Calendar', 'Running Hours', 'Dual Frequency'])('%s approval requiring Office Review creates no completion effects early', async basis => {
    wo.maintenanceBasis = basis;
    wo.nextDueReading = '200'; wo.woCompletionRh = '500'; wo.runningHours = '550';
    wo.frequencyValue = basis === 'Running Hours' ? '100' : '1';
    job.maintenanceBasis = basis;
    job.officeReviewerRoleRuids = ['reviewer'];
    await bulkApprove([wo.id], 'Chief Engineer', 'Reviewed', justification);
    expect(wo.status).toBe('Pending Office Review');
    expect(history).toHaveLength(0);
    await finalizeWorkOrderCompletion(wo.id);
    expect(history).toHaveLength(0);
    await reviewerApprove(wo.id, 'Reviewed', 'reviewer-user');
    expect(wo.status).toBe('Completed');
    expect(history.filter(isVisibleMaintenanceHistory)).toHaveLength(1);
    expect(history.some(h => h.isSkipped)).toBe(true);
  });

  it('completion with missing frequency continues without unsupported reconstruction', async () => {
    wo.frequencyValue = null; wo.frequencyUnit = null;
    const result = await completeWorkOrder(wo.id, { dateOfCompletion: '2026-04-02' });
    expect(result.success).toBe(true);
    expect(history.filter(isVisibleMaintenanceHistory)).toHaveLength(1);
    expect(history.some(h => h.isSkipped)).toBe(false);
  });

  it('spare consumption is not repeated on finalizer retry; snapshots remain unchanged', async () => {
    wo.status = 'Completed';
    wo.consumedSpareParts = [{ partCode: 'P1', quantityConsumed: 2, locationId: 10 }];
    await finalizeWorkOrderCompletion(wo.id);
    await finalizeWorkOrderCompletion(wo.id);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ referenceId: wo.wouuid, spareId: 7, qtyChange: -2 });
    expect(wo.rhLastDoneSnapshot).toBe('100');
    expect(component.currentCumulativeRH).toBe('9000');
  });
});

describe('actual skipped-cycle helpers', () => {
  it('Calendar retries retain the original basis after the Job advances', async () => {
    await createSkippedCycleRecords(params);
    job.nextDueDate = '01-Jan-2027';
    await createSkippedCycleRecords({ ...params, frequencyValue: '2', originalDueDate: '01-Jan-2027', missedCycles: 8 });
    expect(history).toHaveLength(2);
    expect(history.map(h => h.skippedCycleDate)).toEqual(['01-Feb-2026', '01-Mar-2026']);
  });

  it('retains the original string-frequency integer parsing and calendar arithmetic', async () => {
    await createSkippedCycleRecords({ ...params, frequencyValue: '2.5' });
    expect(history.map(h => h.skippedCycleDate)).toEqual(['01-Mar-2026', '01-May-2026']);
  });

  it.each([{ frequencyValue: null }, { frequencyUnit: null }, { frequencyValue: 'bad' }, { frequencyValue: '1x' }, { frequencyUnit: 'bad' }])(
    'invalid frequency safely omits reconstruction: %j', async patch => {
      await createSkippedCycleRecords({ ...params, ...patch });
      expect(history).toHaveLength(0);
    },
  );

  it('RH retry preserves first-recorded boundaries when Job state changes', async () => {
    const rh = { ...params, workOrderNo: wo.workOrderNo, dueRH: 200, completionRH: 550, intervalRH: 100 };
    await createSkippedCycleRecordsRH(rh);
    await createSkippedCycleRecordsRH({ ...rh, dueRH: 500, intervalRH: 200, missedCycles: 7 });
    expect(history.map(h => h.runningHoursAtCompletion)).toEqual(['300', '400']);
  });

  it('recognizes legacy RH rows after next-due advancement without rewriting them', async () => {
    const legacy = { componentId: component.cuuid, workOrderId: wo.wouuid,
      workOrderNo: wo.workOrderNo, sourceWorkOrderId: wo.wouuid, isSkipped: true, status: 'SKIPPED',
      runningHoursAtCompletion: '300', cmhuuid: 'legacy-identity', dateCompleted: '02-Apr-2026' };
    history.push(legacy);
    await createSkippedCycleRecordsRH({ ...params, workOrderNo: wo.workOrderNo,
      dueRH: 500, completionRH: 550, intervalRH: 100 });
    expect(history).toHaveLength(2);
    expect(history[0]).toBe(legacy);
    expect(history.map(h => h.runningHoursAtCompletion)).toEqual(['300', '400']);
  });

  it('missing/ambiguous or cross-vessel linkage never invents an equipment identity', async () => {
    repo.findComponent.mockResolvedValue({ ...component, vesselId: 'another-vessel' });
    repo.findComponents.mockResolvedValue([]);
    await createSkippedCycleRecords(params);
    expect(history).toHaveLength(0);
    repo.findComponent.mockResolvedValue({ ...component });
    job.vesselId = 'another-vessel';
    await createSkippedCycleRecords(params);
    expect(history).toHaveLength(0);
  });

  it('a missing linked Job is represented as missing, not replaced with a template or another Job', async () => {
    repo.findJob.mockResolvedValue(undefined);
    await createSkippedCycleRecords(params);
    expect(history).toHaveLength(2);
    expect(history.every(h => h.jobId === null && h.jobCode === null)).toBe(true);
  });

  it('keeps the existing cap of 104 and RH arithmetic', async () => {
    await createSkippedCycleRecords({ ...params, missedCycles: 1000 });
    expect(history).toHaveLength(104);
    history = [];
    await createSkippedCycleRecordsRH({ ...params, workOrderNo: wo.workOrderNo,
      dueRH: 200, completionRH: 10000, intervalRH: 100, missedCycles: 1000 });
    expect(history).toHaveLength(104);
    expect(history[0].runningHoursAtCompletion).toBe('300');
    expect(history[103].runningHoursAtCompletion).toBe('10600');
  });
});
