import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = {
  findById: vi.fn(),
  getStorage: vi.fn(),
  findComponent: vi.fn(),
  findComponentByCode: vi.fn(),
  findComponents: vi.fn(),
  findJob: vi.fn(),
  findMaintenanceHistoryByWorkOrderId: vi.fn(),
  update: vi.fn(),
  createRunningHoursAudit: vi.fn(),
};

vi.mock('../repositories/workOrderRepository', () => repo);
vi.mock('../../sync', () => ({ logFieldChanges: vi.fn(async () => {}) }));
vi.mock('../../sync/syncRole', () => ({ isShipInstance: vi.fn(async () => true) }));
vi.mock('../services/anomalyDetectionService', () => ({ detectAndLogAnomalies: vi.fn(async () => {}) }));
vi.mock('../services/complianceAnomalyService', () => ({ invalidateComplianceCache: vi.fn() }));

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

  it.each(['NOT_RH_DRIVEN', 'NOT RH DRIVEN'])(
    'completes a %s work order without requiring or writing running hours',
    async counterType => {
      repo.findById.mockResolvedValue({
        id: 'wo-1', wouuid: 'wo-uuid', workOrderNo: 'CUSTOM',
        status: 'Pending Approval', maintenanceBasis: 'Running Hours',
        component: 'component-1', dateCompleted: null,
      });
      repo.findComponent.mockResolvedValue({ cuuid: 'component-1', rhCounterType: counterType });
      repo.findMaintenanceHistoryByWorkOrderId.mockResolvedValue({ id: 'existing-history' });
      repo.update.mockImplementation(async (_id, update) => ({ ...update, id: 'wo-1' }));

      const { completeWorkOrder } = await import('../services/workOrderCompletionService');
      const result = await completeWorkOrder('wo-1', { dateOfCompletion: '2026-08-01' });

      expect(result.success).toBe(true);
      expect(repo.update).toHaveBeenCalledWith('wo-1', expect.objectContaining({
        status: 'Completed', rhSyncedAt: undefined, runningHoursAtCompletion: undefined,
      }));
      expect(repo.createRunningHoursAudit).not.toHaveBeenCalled();
    },
  );

  it.each(['NOT_RH_DRIVEN', 'NOT RH DRIVEN'])(
    'does not route a stale supplied reading from %s through RH sync or RH-only accuracy checks',
    async counterType => {
      repo.findById.mockResolvedValue({
        id: 'wo-1', wouuid: 'wo-uuid', workOrderNo: 'CUSTOM',
        status: 'Pending Approval', maintenanceBasis: 'Running Hours',
        component: 'component-1', dateCompleted: null,
      });
      repo.findComponent.mockResolvedValue({ cuuid: 'component-1', rhCounterType: counterType });
      repo.findMaintenanceHistoryByWorkOrderId.mockResolvedValue({ id: 'existing-history' });
      repo.update.mockImplementation(async (_id, update) => ({ ...update, id: 'wo-1' }));

      const { completeWorkOrder } = await import('../services/workOrderCompletionService');
      const result = await completeWorkOrder('wo-1', {
        dateOfCompletion: '2026-08-01',
        runningHours: '700',
        woCompletionRh: '750',
        currentReadingDate: '2999-01-01',
      });

      expect(result.success).toBe(true);
      expect(repo.createRunningHoursAudit).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith('wo-1', expect.objectContaining({ rhSyncedAt: undefined }));
    },
  );

  it.each(['MASTER', 'INHERITED'])(
    'keeps the Completion RH versus Current Reading check for %s',
    async counterType => {
      repo.findById.mockResolvedValue({
        id: 'wo-1', wouuid: 'wo-uuid', status: 'Pending Approval',
        maintenanceBasis: 'Running Hours', component: 'component-1',
      });
      repo.findComponent.mockResolvedValue({ cuuid: 'component-1', rhCounterType: counterType });
      const { completeWorkOrder } = await import('../services/workOrderCompletionService');
      await expect(completeWorkOrder('wo-1', {
        dateOfCompletion: '2026-08-01', runningHours: '700', woCompletionRh: '750',
      })).rejects.toMatchObject({ details: { code: 'WO_COMPLETION_RH_EXCEEDS_READING' } });
      expect(repo.update).not.toHaveBeenCalled();
    },
  );

  it.each(['MASTER', 'INHERITED'])(
    'keeps the future Current Reading Date check for %s',
    async counterType => {
      repo.findById.mockResolvedValue({
        id: 'wo-1', wouuid: 'wo-uuid', status: 'Pending Approval',
        maintenanceBasis: 'Running Hours', component: 'component-1',
      });
      repo.findComponent.mockResolvedValue({ cuuid: 'component-1', rhCounterType: counterType });
      const { completeWorkOrder } = await import('../services/workOrderCompletionService');
      await expect(completeWorkOrder('wo-1', {
        dateOfCompletion: '2026-08-01', runningHours: '700', woCompletionRh: '700',
        currentReadingDate: '2999-01-01',
      })).rejects.toMatchObject({ details: { code: 'READING_DATE_IN_FUTURE' } });
      expect(repo.update).not.toHaveBeenCalled();
    },
  );
});