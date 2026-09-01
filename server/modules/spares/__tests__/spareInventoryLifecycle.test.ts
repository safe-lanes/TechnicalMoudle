import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  getSpare: vi.fn(),
  getSpareLocationStock: vi.fn(),
  getSpareLocationsWithQty: vi.fn(),
  getSpareRobTotal: vi.fn(),
  upsertSpareLocationStock: vi.fn(),
  performInventoryTransaction: vi.fn(),
}));

vi.mock('../repositories/inventoryRepository', () => repo);
vi.mock('../../../storage', () => ({ storage: {} }));

import * as service from '../services/inventoryService';

describe('Spare inventory lifecycle guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.getSpare.mockResolvedValue({
      id: 10,
      vesselId: 'vessel-1',
      deleted: true,
      isDeleted: true,
      isActive: false,
    });
  });

  it('does not expose retained-deleted Spare stock through the direct stock read', async () => {
    await expect(service.getSpareStock(10)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.getSpareLocationStock).not.toHaveBeenCalled();
    expect(repo.getSpareLocationsWithQty).not.toHaveBeenCalled();
  });

  it('does not allow stock to be changed for a retained-deleted Spare', async () => {
    await expect(service.upsertStock(10, 4, { vesselId: 'vessel-1', qty: 2 }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(repo.upsertSpareLocationStock).not.toHaveBeenCalled();
  });
});