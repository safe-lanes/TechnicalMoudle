import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName, type SQL, type Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { PostgresStorage } from '../../../postgresStorage';
import * as service from '../services/sparesService';
import { markSpareAsOrdered } from '../../reports/services/sparesReportService';
import { getSpareWithInventory } from '../controllers/inventoryController';

const isolated = vi.hoisted(() => ({
  getDb: vi.fn(),
  log: vi.fn(),
  storage: {
    updateSpare: vi.fn(),
    consumeSpareFromLocation: vi.fn(),
    receiveSpareToLocation: vi.fn(),
  },
  inventoryRead: vi.fn(),
}));
vi.mock('../../../db', () => ({ getDb: isolated.getDb }));
vi.mock('../../../storage', () => ({ storage: isolated.storage }));
vi.mock('../../../modules/sync', () => ({
  logFieldChanges: isolated.log,
  logSoftDelete: vi.fn(),
  FileSyncProcessor: class {},
}));
vi.mock('../services/inventoryService', () => ({
  getSpareWithInventory: isolated.inventoryRead,
}));

type Row = Record<string, unknown>;
const dialect = new PgDialect();

// Only the database transport is replaced. Actual storage lookup, mutation,
// history, stock synchronization and calls to the field logger execute.
function fixture(vessel = 'vessel-A', id = 10, uuid = 'spare-A', deleted = false) {
  const tables: Record<string, Row[]> = {
    spares: [{
      id, suuid: uuid, vesselId: vessel, partCode: 'PART-1', partName: 'Filter',
      componentId: 'component-A', componentCode: '601', componentName: 'Pump',
      rob: 8, robLocationA: 5, robLocationB: 3,
      location: 'Store A', location2: 'Store B', deleted, isDeleted: deleted,
    }],
    locations: [
      { id: 1, luuid: 'location-A', vesselId: vessel, locationName: 'Store A' },
      { id: 2, luuid: 'location-B', vesselId: vessel, locationName: 'Store B' },
    ],
    spare_location_stock: [
      { id: 1, slsuuid: 'stock-A', spareId: id, spareUuid: uuid, vesselId: vessel, locationId: 1, locationUuid: 'location-A', qty: 5 },
      { id: 2, slsuuid: 'stock-B', spareId: id, spareUuid: uuid, vesselId: vessel, locationId: 2, locationUuid: 'location-B', qty: 3 },
    ],
    spares_history: [],
  };
  const writes: Row[] = [];
  function matching(table: string, condition: SQL): Row[] {
    const query = dialect.sqlToQuery(condition);
    if (table === 'spares') {
      return tables.spares.filter(row =>
        row.suuid === String(query.params[0]) ||
        (query.params.length > 1 && row.id === query.params[1]));
    }
    if (table === 'locations') {
      if (query.sql.includes('location_name')) {
        return tables.locations.filter(row =>
          row.vesselId === query.params[0] &&
          String(row.locationName).toLowerCase() === String(query.params[1]).trim().toLowerCase());
      }
      return tables.locations.filter(row => row.id === query.params[0]);
    }
    if (table === 'spare_location_stock') {
      if (query.sql.includes('"id" =')) {
        return tables.spare_location_stock.filter(row => row.id === query.params[0]);
      }
      return tables.spare_location_stock.filter(row =>
        row.spareId === query.params[0] && row.locationId === query.params[1]);
    }
    throw new Error(`Unexpected isolated query: ${query.sql}`);
  }
  const db = {
    select: () => ({
      from: (table: Table) => ({
        where: (condition: SQL) => {
          const rows = structuredClone(matching(getTableName(table), condition));
          return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows.slice(0, 1)) });
        },
      }),
    }),
    update: (table: Table) => ({
      set: (values: Row) => ({
        where: (condition: SQL) => ({
          returning: async () => {
            const name = getTableName(table);
            const rows = matching(name, condition);
            writes.push({ table: name, values: structuredClone(values) });
            for (const row of rows) Object.assign(row, values);
            return structuredClone(rows);
          },
        }),
      }),
    }),
    insert: (table: Table) => ({
      values: (values: Row) => ({
        returning: async () => {
          const name = getTableName(table);
          const row = { id: tables[name].length + 1, shuuid: `${vessel}-history-${tables[name].length + 1}`, ...structuredClone(values) };
          tables[name].push(row);
          writes.push({ table: name, values: structuredClone(values) });
          return [structuredClone(row)];
        },
      }),
    }),
    transaction: async (operation: (connection: unknown) => Promise<unknown>) => operation(db),
  };
  isolated.getDb.mockResolvedValue(db);
  const instance = new PostgresStorage();
  isolated.storage.updateSpare.mockImplementation(instance.updateSpare.bind(instance));
  isolated.storage.consumeSpareFromLocation.mockImplementation(instance.consumeSpareFromLocation.bind(instance));
  isolated.storage.receiveSpareToLocation.mockImplementation(instance.receiveSpareToLocation.bind(instance));
  return {
    instance, tables, writes,
    snapshot: () => structuredClone({ tables, writes, logs: isolated.log.mock.calls }),
  };
}

describe('bounded numeric spare-ID corrections preserve operational/sync contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ['consume', 'A', 2], ['consume', 'B', 20],
    ['receive', 'A', 2], ['receive', 'B', 4],
  ] as const)('%s in location %s preserves stock, history and field-log arguments', async (operation, location, quantity) => {
    const before = fixture();
    // Reflect invokes the previous runtime numeric argument without weakening
    // the production storage signature or adding a cast.
    if (operation === 'consume') {
      await Reflect.apply(before.instance.consumeSpareFromLocation, before.instance,
        [10, quantity, location, 'operator', 'maintenance', 'WO-123']);
    } else {
      await Reflect.apply(before.instance.receiveSpareToLocation, before.instance,
        [10, quantity, location, 'operator', 'delivery', 'PO-123', '2026-10-04']);
    }
    const expected = before.snapshot();
    isolated.log.mockClear();
    const after = fixture();
    const result = operation === 'consume'
      ? await service.consumeFromLocation({ id: '010' }, { quantity, location, userId: 'operator', remarks: 'maintenance', workOrderRef: 'WO-123' })
      : await service.receiveToLocation({ id: '010' }, { quantity, location, userId: 'operator', remarks: 'delivery', supplierPO: 'PO-123', dateLocal: '2026-10-04' });
    expect(result.validationError).toBe(false);
    expect(after.snapshot()).toEqual(expected);
    expect(after.tables.spares_history[0]).toMatchObject({ spareId: 10, spareUuid: 'spare-A', vesselId: 'vessel-A', userId: 'operator' });
    expect(isolated.log.mock.calls.map(call => call[0])).toEqual([
      'spares_history', 'spare_location_stock', 'spare_location_stock', 'spares',
    ]);
    if (operation === 'consume' && quantity === 20) {
      expect(result.response).toMatchObject({ warning: { code: 'PARTIAL_CONSUMPTION', shortageQty: 17 } });
    }
  });

  it('Mark Ordered preserves its date, selected UUID and update field log', async () => {
    const before = fixture();
    await Reflect.apply(before.instance.updateSpare, before.instance, [10, { lastOrderDate: '05-Oct-2026' }]);
    const expected = before.snapshot();
    isolated.log.mockClear();
    const after = fixture();
    await markSpareAsOrdered(10);
    expect(isolated.storage.updateSpare).toHaveBeenLastCalledWith('10', { lastOrderDate: '05-Oct-2026' });
    expect(after.snapshot()).toEqual(expected);
  });

  it.each([
    ['ship', 10, 'spare-A'], ['shore', 27, 'spare-A'], ['other-vessel', 10, 'spare-B'],
  ])('retains the local ID and canonical identity on %s', async (vessel, id, uuid) => {
    const data = fixture(vessel, id, uuid);
    await service.receiveToLocation({ id }, { quantity: 2, location: 'A', userId: 'operator' });
    expect(data.tables.spares_history[0]).toMatchObject({ spareId: id, spareUuid: uuid, vesselId: vessel });
    expect(isolated.log).toHaveBeenLastCalledWith('spares', uuid, vessel, expect.any(Object), expect.any(Object), 'operator');
  });

  it('does not change existing repeat-request semantics', async () => {
    const before = fixture();
    for (let i = 0; i < 2; i++) {
      await Reflect.apply(before.instance.consumeSpareFromLocation, before.instance, [10, 2, 'A', 'system', undefined, 'WO-123']);
    }
    const expected = before.snapshot();
    isolated.log.mockClear();
    const after = fixture();
    for (let i = 0; i < 2; i++) {
      await service.consumeFromLocation({ id: 10 }, { quantity: 2, location: 'A', workOrderRef: 'WO-123' });
    }
    expect(after.snapshot()).toEqual(expected);
    expect(new Set(after.tables.spares_history.map(row => row.shuuid)).size).toBe(2);
  });

  it.each(['missing', 'deleted'])('rejects a %s spare without writes or field logs', async condition => {
    const data = fixture('vessel-A', 10, 'spare-A', condition === 'deleted');
    if (condition === 'missing') data.tables.spares.length = 0;
    await expect(service.consumeFromLocation({ id: 10 }, { quantity: 2, location: 'A' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.receiveToLocation({ id: 10 }, { quantity: 2, location: 'B' })).rejects.toMatchObject({ statusCode: 404 });
    expect(data.writes).toEqual([]);
    expect(isolated.log).not.toHaveBeenCalled();
  });

  it.each([0, -1, 'bad', 1.5])('keeps invalid ID %s outside storage', async id => {
    fixture();
    expect((await service.consumeFromLocation({ id }, { quantity: 2, location: 'A' })).validationError).toBe(true);
    expect((await service.receiveToLocation({ id }, { quantity: 2, location: 'A' })).validationError).toBe(true);
    expect(isolated.storage.consumeSpareFromLocation).not.toHaveBeenCalled();
    expect(isolated.storage.receiveSpareToLocation).not.toHaveBeenCalled();
  });

  it.each([null, { suuid: 'spare-A', vesselId: 'vessel-A', totalRob: 8 }])('inventory GET preserves result %j without writes', async row => {
    isolated.inventoryRead.mockResolvedValue(row);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await Reflect.apply(getSpareWithInventory, undefined, [{ params: { spareId: '010' } }, res]);
    expect(isolated.inventoryRead).toHaveBeenCalledWith('10');
    expect(res.json).toHaveBeenCalledWith(row ? { success: true, data: row } : { success: false, error: 'Spare not found' });
    if (!row) expect(res.status).toHaveBeenCalledWith(404);
    expect(isolated.storage.updateSpare).not.toHaveBeenCalled();
    expect(isolated.log).not.toHaveBeenCalled();
  });
});
