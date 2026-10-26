import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const state = vi.hoisted(() => ({
  getDb: vi.fn(),
  updateSpare: vi.fn(),
  tables: {} as Record<string, any[]>,
}));
vi.mock('../../../db', () => ({ getDb: state.getDb }));
vi.mock('../../../storage', () => ({ storage: { updateSpare: state.updateSpare } }));

// Exercise the real repository predicates and service, not a mocked identity lookup.
import { resyncSpares } from '../services/fleetAdminService';
import { getFleetSpareByIdentity } from '../repositories/fleetAdminRepository';

const pair = (spare: any) => ({ spareCategory: spare.spareCategory, optimumQty: spare.optimumQty });
const vesselSpare = (id: string, vesselId = 'vessel-1') => ({
  suuid: id, vesselId, partName: 'Seal Kit', spareCategory: 'general', optimumQty: null,
  rob: 13, robLocationA: 8, robLocationB: 5, min: 2, max: 20, critical: 'Yes',
});

beforeEach(() => {
  vi.resetAllMocks();
  state.tables = {
    fleet_spares: [
      { partCode: 'SAME-PART', fleetEquipmentCode: 'EQ-A', partName: 'Seal Kit', spareCategory: 'essential', optimumQty: null, isActive: true, isDeleted: false },
      { partCode: 'SAME-PART', fleetEquipmentCode: 'EQ-B', partName: 'Seal Kit', spareCategory: 'optimum', optimumQty: 7, isActive: true, isDeleted: false },
    ],
    fleet_spare_vessel_mapping: [
      { partCode: 'SAME-PART', fleetEquipmentCode: 'EQ-A', vesselCode: 'vessel-1', spareId: 'spare-A', isActive: true },
      { partCode: 'SAME-PART', fleetEquipmentCode: 'EQ-B', vesselCode: 'vessel-1', spareId: 'spare-B', isActive: true },
      { partCode: 'SAME-PART', fleetEquipmentCode: 'EQ-B', vesselCode: 'vessel-2', spareId: 'spare-other', isActive: true },
    ],
    spares: [vesselSpare('spare-A'), vesselSpare('spare-B'), vesselSpare('spare-other', 'vessel-2')],
  };
  const dialect = new PgDialect();
  state.getDb.mockResolvedValue({
    select: () => ({ from: (table: any) => ({ where: (condition: any) => {
      const query = dialect.sqlToQuery(condition);
      const checks = [...query.sql.matchAll(/\."([^"]+)" = \$(\d+)/g)];
      if (!checks.length) throw new Error(`Unexpected predicate: ${query.sql}`);
      return state.tables[getTableName(table)].filter(row => checks.every(([, column, index]) => {
        const key = column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        return row[key] === query.params[Number(index) - 1];
      })).map(row => ({ ...row }));
    } }) }),
  });
  state.updateSpare.mockImplementation(async (suuid, fields) => {
    const saved = state.tables.spares.find(row => row.suuid === suuid);
    Object.assign(saved, fields);
    return saved;
  });
});

describe('Fleet spare classification resync uses composite source identity', () => {
  it('targeted equipment resync selects its own pair, not the first duplicate Part Code', async () => {
    expect(pair(await getFleetSpareByIdentity('SAME-PART', 'EQ-B'))).toEqual({ spareCategory: 'optimum', optimumQty: 7 });
    const originalA = { ...state.tables.spares[0] };
    const originalOtherVessel = { ...state.tables.spares[2] };
    const result = await resyncSpares('vessel-1', 'EQ-B');
    expect(result).toMatchObject({ synced: 1, failed: 0, skipped: 0 });
    expect(state.updateSpare).toHaveBeenCalledTimes(1);
    expect(state.updateSpare).toHaveBeenCalledWith('spare-B', { spareCategory: 'optimum', optimumQty: 7 });
    expect(state.tables.spares[0]).toEqual(originalA);
    expect(state.tables.spares[2]).toEqual(originalOtherVessel);
    expect(state.tables.spares[1]).toMatchObject({ spareCategory: 'optimum', optimumQty: 7, rob: 13, robLocationA: 8, robLocationB: 5, min: 2, max: 20, critical: 'Yes' });
  });

  it('full-vessel resync keeps duplicate Part Codes separate and is a no-op when repeated', async () => {
    const result = await resyncSpares('vessel-1');
    expect(result).toMatchObject({ synced: 2, failed: 0, skipped: 0 });
    expect(pair(state.tables.spares[0])).toEqual({ spareCategory: 'essential', optimumQty: null });
    expect(pair(state.tables.spares[1])).toEqual({ spareCategory: 'optimum', optimumQty: 7 });
    expect(pair(state.tables.spares[2])).toEqual({ spareCategory: 'general', optimumQty: null });
    state.updateSpare.mockClear();
    expect(await resyncSpares('vessel-1')).toMatchObject({ synced: 0, noChanges: 2 });
    expect(state.updateSpare).not.toHaveBeenCalled();
  });

  it('does not fall back to another equipment when the mapped source is inactive, deleted, or missing', async () => {
    for (const unavailable of ['inactive', 'deleted', 'missing']) {
      const source = state.tables.fleet_spares.find(row => row.fleetEquipmentCode === 'EQ-B');
      if (unavailable === 'inactive') source.isActive = false;
      if (unavailable === 'deleted') { source.isActive = true; source.isDeleted = true; }
      if (unavailable === 'missing') state.tables.fleet_spares = state.tables.fleet_spares.filter(row => row !== source);
      expect(await resyncSpares('vessel-1', 'EQ-B')).toMatchObject({ synced: 0, skipped: 1, failed: 0 });
      expect(pair(state.tables.spares[1])).toEqual({ spareCategory: 'general', optimumQty: null });
    }
    expect(state.updateSpare).not.toHaveBeenCalled();
  });
});
