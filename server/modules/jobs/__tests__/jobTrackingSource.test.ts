import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findJobs: vi.fn(),
  findJobComponentLinks: vi.fn(),
  findComponent: vi.fn(),
  findComponentByCode: vi.fn(),
}));

vi.mock('../repositories/jobRepository', () => repo);

describe('Job tracking source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Job tracking values when a component link contains different tracking data', async () => {
    repo.findJobs.mockResolvedValueOnce([{
      juuid: 'job-1',
      vesselId: 'vessel-1',
      componentId: 'component-1',
      componentCode: '278.010.01',
      maintenanceBasis: 'Calendar',
      lastDoneDate: '2025-01-20',
      nextDueDate: '27-Jan-2025',
      lastDoneRH: null,
      nextDueRH: null,
    }]);
    repo.findJobComponentLinks.mockResolvedValueOnce([{
      jobId: 'job-1',
      componentId: 'component-1',
      componentCode: '278.010.01',
      lastDoneDate: '2025-01-10',
      nextDueDate: '17-Jan-2025',
    }]);

    const { listJobs } = await import('../services/jobService');
    const [job] = await listJobs('vessel-1', 'component-1');

    expect(job.lastDoneDate).toBe('2025-01-20');
    expect(job.nextDueDate).toBe('27-Jan-2025');
    expect(job).not.toHaveProperty('componentTracking');
  });
});