import { beforeEach, describe, expect, it, vi } from 'vitest';

const listRequisitions = vi.hoisted(() => vi.fn());
vi.mock('../services/subEntityService', () => ({ listRequisitions }));
vi.mock('../services/documentService', () => ({}));
vi.mock('../../../utils/tenantConnectionManager', () => ({ captureTenantFromReq: vi.fn() }));

import { listRequisitions as listFromController } from '../controllers/subEntityController';
import { mockAuthMiddleware, requireAuth } from '../../../middleware/auth';

beforeEach(() => {
  listRequisitions.mockReset().mockResolvedValue([]);
});

describe('Component controller user context', () => {
  it('normalizes a null vessel without changing the current forwarded-role/mock-user behavior', async () => {
    const req: any = {
      headers: { 'x-user-role': 'Vessel%20User', 'x-user-type': 'Ship' },
      body: {}, params: { componentId: 'c1' },
    };
    const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    const next = vi.fn();
    mockAuthMiddleware(req, res, next);
    requireAuth(req, res, next);

    expect(req.rbac).toMatchObject({ role: 'Vessel User', userType: 'Ship' });
    expect(req.user).toMatchObject({ role: 'Sail Admin', vesselId: null });
    await listFromController(req, res);
    expect(listRequisitions).toHaveBeenCalledWith('c1', {
      username: 'sail_admin', role: 'Sail Admin', vesselId: undefined,
    });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('preserves an assigned vessel when supplied a Ship identity directly', async () => {
    const req: any = {
      user: { username: 'crew', role: 'Ship', vesselId: 'V1' },
      params: { componentId: 'c1' },
    };
    const res: any = { json: vi.fn() };
    await listFromController(req, res);
    expect(listRequisitions).toHaveBeenCalledWith('c1', {
      username: 'crew', role: 'Ship', vesselId: 'V1',
    });
  });
});