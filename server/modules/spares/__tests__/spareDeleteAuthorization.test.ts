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
vi.mock('../controllers/sparesController', () => ({
  getAllSpares: vi.fn(), getSpareHistoryByVessel: vi.fn(), bulkUpdate: vi.fn(),
  consumeSimple: vi.fn(), receiveSimple: vi.fn(), consumeFromLocation: vi.fn(), receiveToLocation: vi.fn(),
  batchConsume: vi.fn(), batchReceive: vi.fn(), getSpareHistoryLegacy: vi.fn(), getLowStockSpares: vi.fn(),
  inactivateSpare: vi.fn(), adjustSpareAtLocation: vi.fn(), adjustSpareQuantity: vi.fn(),
  getSpareById: vi.fn(), createSpare: vi.fn(), updateSpare: vi.fn(), deleteSpare: vi.fn(), getSparesByVessel: vi.fn(),
}));
vi.mock('../controllers/inventoryController', () => ({
  getLocations: vi.fn(), getLocationById: vi.fn(), createLocation: vi.fn(), reconcile: vi.fn(),
  getSpareLinksBySpare: vi.fn(), getSpareLinksByComponent: vi.fn(), getSpareLinks: vi.fn(),
  createSpareLink: vi.fn(), deleteSpareLink: vi.fn(), getSparesAtLocation: vi.fn(),
  getLocationsWithStock: vi.fn(), getFullSparesAtLocation: vi.fn(), getSpareStock: vi.fn(),
  upsertStock: vi.fn(), createTransaction: vi.fn(), getTransactions: vi.fn(), backfillSiblingLinks: vi.fn(),
  getSparesWithInventory: vi.fn(), getSpareWithInventory: vi.fn(), getSparesByComponent: vi.fn(),
  getSparesByComponentCode: vi.fn(),
}));

import router from '../routes';

describe('Spare delete authorization', () => {
  it('uses the strict Spare delete permission guard', () => {
    const deleteRoute = (router as any).stack.find(
      (layer: any) => layer.route?.path === '/spares/:vesselId/:id' && layer.route.methods.delete
    );

    expect(deleteRoute).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith(
      'pms-spares',
      'delete',
      { enforce: true, unconfigured: 'deny' }
    );
  });
});