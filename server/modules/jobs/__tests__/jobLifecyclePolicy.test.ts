import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/jobRepository', () => ({
  findById: vi.fn(),
  update: vi.fn(),
  findWorkOrdersByJobId: vi.fn(),
}));

import * as repo from '../repositories/jobRepository';
import { generateWorkOrder, inactivateJob, updateJob } from '../services/jobService';

const mockedRepo = vi.mocked(repo);

describe('Job delete and inactive policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an ordinary edit that tries to set or clear the delete marker', async () => {
    await expect(updateJob('job-1', { isDeleted: true })).rejects.toThrow(
      'Job deletion status can only be changed through the Delete Job action'
    );
    await expect(updateJob('job-1', { is_deleted: false })).rejects.toThrow(
      'Job deletion status can only be changed through the Delete Job action'
    );
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('inactivates a live job without setting its deletion marker', async () => {
    mockedRepo.findById.mockResolvedValue({
      id: 'job-1',
      juuid: 'job-1',
      vesselId: 'vessel-1',
      isActive: true,
      isDeleted: false,
    } as any);
    mockedRepo.update.mockResolvedValue({} as any);
    mockedRepo.findWorkOrdersByJobId.mockResolvedValue([]);

    await expect(inactivateJob('job-1', 'vessel-1')).resolves.toMatchObject({
      activeWorkOrders: 0,
    });

    expect(mockedRepo.update).toHaveBeenCalledWith('job-1', { isActive: false });
  });

  it('does not generate a work order for a deleted job', async () => {
    mockedRepo.findById.mockResolvedValue({
      id: 'job-1',
      juuid: 'job-1',
      vesselId: 'vessel-1',
      isActive: false,
      isDeleted: true,
    } as any);

    await expect(generateWorkOrder('job-1', 'Planning')).rejects.toThrow(
      'Cannot generate work orders for an inactive job'
    );
  });
});