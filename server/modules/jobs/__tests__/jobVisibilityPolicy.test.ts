import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/jobService', () => ({
  listJobs: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock('../services/jobContextService', () => ({
  getJobContext: vi.fn(),
}));

import * as jobService from '../services/jobService';
import * as jobContextService from '../services/jobContextService';
import { getJob, getJobContext, listJobs } from '../controllers/jobController';

const mockedJobService = vi.mocked(jobService);
const mockedContextService = vi.mocked(jobContextService);

function createResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const shipRequest = (overrides: Record<string, unknown> = {}) => ({
  query: {},
  params: {},
  user: { userType: 'Ship' },
  ...overrides,
}) as any;

describe('Job visibility policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes inactive Jobs from a Ship user list while preserving them for Office', async () => {
    mockedJobService.listJobs.mockResolvedValue([
      { id: 'active', isActive: true },
      { id: 'inactive', isActive: false },
    ] as any);

    const shipRes = createResponse();
    await listJobs(shipRequest(), shipRes);
    expect(shipRes.json).toHaveBeenCalledWith([{ id: 'active', isActive: true }]);

    const officeRes = createResponse();
    await listJobs({ query: {}, params: {}, user: { userType: 'Office' } } as any, officeRes);
    expect(officeRes.json).toHaveBeenCalledWith([
      { id: 'active', isActive: true },
      { id: 'inactive', isActive: false },
    ]);
  });

  it('returns not found to Ship users for inactive Job detail and context routes', async () => {
    mockedJobService.getJob.mockResolvedValue({ id: 'inactive', isActive: false } as any);

    const detailRes = createResponse();
    await getJob(shipRequest({ params: { id: 'inactive' } }), detailRes);
    expect(detailRes.status).toHaveBeenCalledWith(404);

    const contextRes = createResponse();
    await getJobContext(shipRequest({ params: { id: 'inactive' } }), contextRes);
    expect(contextRes.status).toHaveBeenCalledWith(404);
    expect(mockedContextService.getJobContext).not.toHaveBeenCalled();
  });
});