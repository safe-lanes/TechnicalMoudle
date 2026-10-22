import { beforeEach, describe, expect, it, vi } from 'vitest';

const isolated = vi.hoisted(() => ({
  getJob: vi.fn(), getWorkOrders: vi.fn(), createWorkOrder: vi.fn(),
}));
vi.mock('../../storage', () => ({ storage: isolated }));
vi.mock('../workOrderService', () => ({ workOrderService: {} }));
vi.mock('../jobService', () => ({ jobService: {} }));
vi.mock('../../modules/sync/syncRole', () => ({ getEffectiveInstanceId: vi.fn() }));

import { RunningHoursService } from '../runningHoursService';
import { JobDueScannerService } from '../jobDueScanner';

describe('legacy RH validation and duplicate blocker declarations', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    [{}, ['Component ID is required', 'New running hours value is required', 'Updated by is required']],
    [{ componentId: 'component-A', newRunningHours: null, updatedBy: 'operator' }, ['New running hours value is required']],
    [{ componentId: 'component-A', newRunningHours: -1, updatedBy: 'operator' }, ['Running hours cannot be negative']],
    [{ componentId: 'component-A', newRunningHours: 0, updatedBy: 'operator' }, []],
    [{ componentId: 'component-A', newRunningHours: 120, updatedBy: 'operator' }, []],
  ])('retains legacy validation errors without writes', (input, errors) => {
    expect(new RunningHoursService().validateRunningHoursUpdate(input)).toEqual({ valid: errors.length === 0, errors });
    expect(isolated.createWorkOrder).not.toHaveBeenCalled();
  });

  it('keeps missing-job rejection unchanged', async () => {
    isolated.getJob.mockResolvedValue(undefined);
    expect(await new JobDueScannerService().generateWorkOrderForJob('job-A')).toEqual({ success: false, message: 'Job not found' });
    expect(isolated.getWorkOrders).not.toHaveBeenCalled();
  });

  it.each([null, '601'])('keeps existing blocker identity and details for component %s', async componentCode => {
    isolated.getJob.mockResolvedValue({ juuid: 'job-A', jobNo: 'JOB-1', vesselId: 'vessel-A', componentCode: '601' });
    const blocker = { id: 'local-wo', wouuid: 'wo-A', workOrderNo: 'WO-123', jobId: 'job-A', vesselId: 'vessel-A', status: 'Active', componentCode };
    isolated.getWorkOrders.mockResolvedValue([blocker]);
    const result = await new JobDueScannerService().generateWorkOrderForJob('job-A');
    expect(result).toMatchObject({
      success: false,
      blockingWorkOrder: { id: 'local-wo', workOrderNo: 'WO-123', status: 'Active', componentCode },
    });
    expect(isolated.getWorkOrders).toHaveBeenCalledWith('vessel-A');
    expect(isolated.createWorkOrder).not.toHaveBeenCalled();
  });
});
