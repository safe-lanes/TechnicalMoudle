import { describe, expect, it, vi } from 'vitest';
import { PostgresStorage } from '../../../postgresStorage';

const deletedSpare = {
  id: 10,
  suuid: 'spare-10',
  vesselId: 'vessel-1',
  deleted: true,
  isDeleted: true,
  isActive: false,
};

function deletedStorage() {
  const instance = new PostgresStorage();
  vi.spyOn(instance, 'getSpare').mockResolvedValue(deletedSpare as any);
  return instance;
}

describe('retained-deleted Spare operational mutation guards', () => {
  it.each([
    ['legacy consume', (storage: PostgresStorage) => storage.consumeSpare('10', 1, 'user')],
    ['location consume', (storage: PostgresStorage) => storage.consumeSpareFromLocation('10', 1, 'A', 'user')],
    ['location receive', (storage: PostgresStorage) => storage.receiveSpareToLocation('10', 1, 'A', 'user')],
    ['location adjustment', (storage: PostgresStorage) => storage.adjustSpareAtLocation('10', 1, 'A', 'user')],
    ['location transfer', (storage: PostgresStorage) => storage.transferSpareLocation('10', 1, 0, 'user')],
    ['legacy receive', (storage: PostgresStorage) => storage.receiveSpare('10', 1, 'user')],
    ['quantity adjustment', (storage: PostgresStorage) => storage.adjustSpareQuantity('10', 1, 'ADJUST')],
    ['inventory transaction', (storage: PostgresStorage) => storage.performInventoryTransaction({
      vesselId: 'vessel-1', spareId: 10, locationId: 1, eventType: 'ADJUST',
      qtyChange: 1, referenceType: 'MANUAL', userId: 'user',
    })],
  ])('rejects a deleted Spare before %s can write stock or history', async (_label, mutate) => {
    await expect(mutate(deletedStorage())).rejects.toMatchObject({
      message: 'Spare 10 not found',
      statusCode: 404,
    });
  });
});