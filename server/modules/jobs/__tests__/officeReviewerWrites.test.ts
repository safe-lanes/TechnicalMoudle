import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/jobRepository', () => ({
  findById: vi.fn(), findComponent: vi.fn(), update: vi.fn(),
}));
import * as repo from '../repositories/jobRepository';
import { updateJob } from '../services/jobService';

describe('Office Reviewer direct Job edits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findById).mockResolvedValue({
      id: 'legacy-job', juuid: 'job-uuid', componentId: null,
      maintenanceBasis: 'Running Hours', intervalRunningHour: 100,
      lastDoneRH: '1000', nextDueRH: '1100', officeReviewerRoleRuids: ['A', 'B'],
      level2ReviewerRankId: 'Office',
    } as any);
    vi.mocked(repo.update).mockImplementation(async (_id, data) => data as any);
  });

  it('saves a complete native array without touching RH or legacy reviewer fields', async () => {
    await updateJob('job-uuid', { officeReviewerRoleRuids: ['C', 'A'] });
    expect(repo.update).toHaveBeenCalledWith('job-uuid', { officeReviewerRoleRuids: ['A', 'C'] });
  });
  it('clears with [] without recalculating RH', async () => {
    await updateJob('job-uuid', { officeReviewerRoleRuids: [] });
    expect(repo.update).toHaveBeenCalledWith('job-uuid', { officeReviewerRoleRuids: [] });
  });
  it('preserves the new array on omitted-field PATCH and retires legacy writes', async () => {
    await updateJob('job-uuid', { jobPriority: 'High', level2ReviewerRankId: 'Office' });
    expect(repo.update).toHaveBeenCalledWith('job-uuid', { jobPriority: 'High' });
  });
  it.each(['A,B', null, ['A', 'A'], [7]])('rejects invalid reviewer values %j before persistence', async value => {
    await expect(updateJob('job-uuid', { officeReviewerRoleRuids: value })).rejects.toThrow(/Office Reviewer/);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
