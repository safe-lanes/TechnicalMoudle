import { describe, expect, it, vi } from 'vitest';

const storage = {
  getWorkOrders: vi.fn(),
  getVessels: vi.fn(),
  getJobs: vi.fn(),
  getCompanyStandardGraceSettings: vi.fn(),
  updateWorkOrder: vi.fn(),
};

vi.mock('../../../storage', () => ({ storage }));
vi.mock('../../sync', () => ({ logFieldChanges: vi.fn(async () => {}) }));

describe('admin Work Order status sync', () => {
  it('promotes execution timestamp to final date before persisting Completed', async () => {
    storage.getWorkOrders.mockResolvedValueOnce([{
      id: 'wo-local-id',
      wouuid: 'wo-uuid',
      workOrderNo: 'WO-1',
      vesselId: 'vessel-1',
      status: 'Due',
      isExecution: true,
      completionDateTime: '2026-09-10T12:30:00.000Z',
      dateCompleted: null,
      maintenanceBasis: 'Calendar',
      dueDate: '01-09-2026',
    }]);
    storage.getVessels.mockResolvedValueOnce([]);
    storage.getJobs.mockResolvedValueOnce([]);
    storage.getCompanyStandardGraceSettings.mockResolvedValueOnce(null);
    storage.updateWorkOrder.mockImplementationOnce(async (_id: string, changes: any) => ({
      wouuid: 'wo-uuid',
      vesselId: 'vessel-1',
      ...changes,
    }));

    const { syncWorkOrderStatus } = await import('../controllers/adminController');
    const response = { json: vi.fn() };
    await syncWorkOrderStatus({ body: { dryRun: false } } as any, response as any);

    expect(storage.updateWorkOrder).toHaveBeenCalledWith('wo-uuid', {
      status: 'Completed',
      dateCompleted: '2026-09-10T12:30:00.000Z',
    });
  });
});