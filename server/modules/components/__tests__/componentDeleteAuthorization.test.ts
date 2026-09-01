import { describe, expect, it, vi } from 'vitest';

const { requirePermission } = vi.hoisted(() => ({
  requirePermission: vi.fn(() => (_req: any, _res: any, next: () => void) => next()),
}));

vi.mock('../../../middleware/permissions', () => ({ requirePermission }));
vi.mock('../../../middleware/auth', () => ({
  requireAuth: (_req: any, _res: any, next: () => void) => next(),
  requirePMSAdmin: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../shared/middleware', () => ({
  asyncHandler: (handler: any) => handler,
}));
vi.mock('../controllers/componentController', () => ({
  updateSortOrder: vi.fn(),
  listByVessel: vi.fn(),
  getDetails: vi.fn(),
  listAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  inactivate: vi.fn(),
}));
vi.mock('../controllers/componentUploadController', () => ({ upload: vi.fn() }));
vi.mock('../controllers/subEntityController', () => ({
  listDocuments: vi.fn(), createDocument: vi.fn(), updateDocument: vi.fn(), deleteDocument: vi.fn(), downloadDocument: vi.fn(),
  listClassRegulatory: vi.fn(), createClassRegulatory: vi.fn(), updateClassRegulatory: vi.fn(), deleteClassRegulatory: vi.fn(),
  listRequisitions: vi.fn(), listAllRequisitions: vi.fn(), getRequisition: vi.fn(), createRequisition: vi.fn(), updateRequisition: vi.fn(), deleteRequisition: vi.fn(),
  listAllMaintenanceHistory: vi.fn(), listVesselMaintenanceHistory: vi.fn(), listMaintenanceHistory: vi.fn(), getMaintenanceHistoryItem: vi.fn(),
  listEquipmentCategories: vi.fn(), createEquipmentCategory: vi.fn(), updateEquipmentCategory: vi.fn(), deleteEquipmentCategory: vi.fn(),
}));

import router from '../routes';

describe('Component delete authorization', () => {
  it('uses the strict permission guard, which rejects unauthorized and unconfigured roles with 403', () => {
    const deleteRoute = (router as any).stack.find(
      (layer: any) => layer.route?.path === '/components/:id' && layer.route.methods.delete
    );

    expect(deleteRoute).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith(
      'pms-components',
      'delete',
      { enforce: true, unconfigured: 'deny' }
    );
  });
});