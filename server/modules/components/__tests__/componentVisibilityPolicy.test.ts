import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/componentService', () => ({
  listByVessel: vi.fn(),
  listAll: vi.fn(),
  getById: vi.fn(),
}));

import * as componentService from '../services/componentService';
import { getDetails, listAll, listByVessel } from '../controllers/componentController';

const mockedService = vi.mocked(componentService);

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

describe('Component visibility policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps inactive Components available to Office while hiding them from Ship lists', async () => {
    const components = [
      { id: 'active', isActive: true },
      { id: 'inactive', isActive: false },
    ] as any;
    mockedService.listByVessel.mockResolvedValue(components);
    mockedService.listAll.mockResolvedValue(components);

    const shipList = createResponse();
    await listByVessel(shipRequest({ params: { vesselId: 'vessel-1' } }), shipList);
    expect(shipList.json).toHaveBeenCalledWith([{ id: 'active', isActive: true }]);

    const officeList = createResponse();
    await listAll({ query: {}, params: {}, user: { userType: 'Office' } } as any, officeList);
    expect(officeList.json).toHaveBeenCalledWith(components);
  });

  it('returns not found when a Ship user requests an inactive Component detail', async () => {
    mockedService.getById.mockResolvedValue({ id: 'inactive', isActive: false } as any);

    const res = createResponse();
    await getDetails(shipRequest({ params: { id: 'inactive' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});