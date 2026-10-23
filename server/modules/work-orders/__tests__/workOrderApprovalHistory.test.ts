import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isVisibleMaintenanceHistory } from '../../../../shared/workOrders/maintenanceHistoryVisibility';
const seam = vi.hoisted(() => ({
  wo: {} as any, job: {} as any, rows: [] as any[],
  repo: {
    findById: vi.fn(), update: vi.fn(), findComponent: vi.fn(), findComponentByCode: vi.fn(), findComponents: vi.fn(),
    findJob: vi.fn(), findJobs: vi.fn(), createAuditLog: vi.fn(), updateJob: vi.fn(),
    findMaintenanceHistoryByWorkOrderId: vi.fn(), findMaintenanceHistoryForSource: vi.fn(),
    createMaintenanceHistory: vi.fn(), getStorage: vi.fn(),
  },
  storage: { getVessel: vi.fn(), getPmsVesselSettings: vi.fn() },
}));
vi.mock('../repositories/workOrderRepository', () => seam.repo);
vi.mock('../../../storage', () => ({ storage: seam.storage }));
vi.mock('../../../db', () => ({ getDb: () => { throw new Error('Live DB forbidden'); } }));
vi.mock('../../sync', () => ({ logFieldChanges: vi.fn() }));
vi.mock('../services/complianceAnomalyService', () => ({ invalidateComplianceCache: vi.fn() }));
vi.mock('../../../services/jobDueScanner', () => ({ jobDueScanner: { runScan: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../ranks/hodResolutionService', () => ({
  resolveHodForDepartment: vi.fn().mockResolvedValue({ rankName: 'Chief Engineer', source: 'fallback' }),
  getHodShortLabel: vi.fn().mockReturnValue('CE'),
}));
import { updateWorkOrder } from '../services/workOrderService';
const component = { cuuid: 'component', vesselId: 'vessel', name: 'Pump', componentCode: '601',
  rhCounterType: 'NOT_RH_DRIVEN' };
beforeEach(() => {
  vi.clearAllMocks();
  seam.rows = [];
  seam.wo = { id: 'local-wo', wouuid: 'wo', vesselId: 'vessel', jobId: 'job', component: 'component',
    componentCode: '601', status: 'Pending Approval', approvalTier: 'standard', department: 'Engine',
    maintenanceBasis: 'Calendar', frequencyValue: '1', frequencyUnit: 'months',
    dueDate: '01-Jan-2026', nextDueDate: '01-Jan-2026', dateCompleted: '2026-03-03',
    completionDateTime: '2026-03-03', workOrderNo: 'VES-JOB-1-601-2026-001',
    jobTitle: 'Pump service', consumedSpareParts: [], missedCycles: 1 };
  seam.job = { juuid: 'job', jobNo: 'JOB-1', vesselId: 'vessel',
    frequencyValue: '1', frequencyUnit: 'months', maintenanceBasis: 'Calendar', officeReviewerRoleRuids: [] };
  seam.repo.findById.mockImplementation(async () => ({ ...seam.wo }));
  seam.repo.update.mockImplementation(async (_id, patch) => (seam.wo = { ...seam.wo, ...patch }));
  seam.repo.findJob.mockImplementation(async () => ({ ...seam.job }));
  seam.repo.findJobs.mockResolvedValue([seam.job]);
  seam.repo.findComponent.mockResolvedValue(component);
  seam.repo.findComponents.mockResolvedValue([component]);
  seam.repo.findMaintenanceHistoryForSource.mockImplementation(async () => seam.rows);
  seam.repo.findMaintenanceHistoryByWorkOrderId.mockImplementation(async () => seam.rows.find(isVisibleMaintenanceHistory));
  seam.repo.createMaintenanceHistory.mockImplementation(async row => {
    const existing = seam.rows.find(h => h.workOrderId === row.workOrderId
      && isVisibleMaintenanceHistory(h) === isVisibleMaintenanceHistory(row)
      && (!row.isSkipped || h.skippedCycleDate === row.skippedCycleDate));
    if (existing) return existing;
    seam.rows.push(row); return row;
  });
  seam.storage.getVessel.mockResolvedValue({ vCode: 'VES' });
  seam.storage.getPmsVesselSettings.mockResolvedValue({ superintendentLockEnabled: false });
  seam.repo.getStorage.mockReturnValue(seam.storage);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('actual update-approval history lifecycle', () => {
  const approve = () => updateWorkOrder('local-wo', {
    status: 'Completed', approvalAction: 'approved', approverRemarks: 'Reviewed',
    skippedCyclesJustification: 'Delayed during equipment shutdown and subsequently completed safely.',
  });
  it.each(['Calendar', 'Running Hours', 'Dual Frequency'])('writes distinct skipped and actual history through %s update approval', async basis => {
    seam.wo.maintenanceBasis = basis;
    seam.wo.nextDueReading = '200';
    seam.wo.woCompletionRh = '500';
    seam.wo.frequencyValue = basis === 'Running Hours' ? '100' : '1';
    seam.job.maintenanceBasis = basis;
    seam.job.intervalRunningHour = 100;
    await approve();
    expect(seam.wo.status).toBe('Completed');
    expect(seam.rows.some(h => h.isSkipped)).toBe(true);
    expect(seam.rows.filter(isVisibleMaintenanceHistory)).toHaveLength(1);
    expect(seam.rows.find(h => h.isSkipped)).toMatchObject({ componentId: 'component', jobCode: 'JOB-1' });
    expect(seam.wo.workOrderNo).toBe('VES-JOB-1-601-2026-001');
  });
  it('does not run final maintenance history while waiting for Office Review', async () => {
    seam.job.officeReviewerRoleRuids = ['reviewer-role'];
    await approve();
    expect(seam.wo.status).toBe('Pending Office Review');
    expect(seam.rows).toHaveLength(0);
    expect(seam.repo.updateJob).not.toHaveBeenCalled();
  });
});
