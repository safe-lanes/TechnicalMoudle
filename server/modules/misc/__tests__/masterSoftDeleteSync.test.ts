import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  additionalGroups,
  fleetGroups,
  masterUsers,
  ports,
  vesselTypes,
  vessels,
} from '@shared/schema';

const state = vi.hoisted(() => ({
  db: null as any,
  pool: null as any,
  tableRows: new Map<any, Map<string, any>>(),
  approverRows: new Map<string, any>(),
  nextApproverId: 1,
  payload: {} as Record<string, any[]>,
  approverQueries: [] as string[],
}));

vi.mock('../../../db', () => ({
  getDb: vi.fn(async () => state.db),
  getPool: vi.fn(async () => state.pool),
}));

vi.mock('../../../config/externalApi', () => ({
  buildExternalMasterDataUrl: (endpoint: string) => `https://master.test/${endpoint}`,
  getExternalMasterDataBaseUrl: () => 'https://master.test',
}));

import {
  getSourceDeletionState,
  normalizeSourceDeletionState,
  reconcileApprovers,
  syncMasters,
} from '../controllers/adminController';
import { PostgresStorage } from '../../../postgresStorage';

function makeMasterDb() {
  return {
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => Array.from(state.tableRows.get(table)?.values() ?? []).slice(0, 1),
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (values: any) => ({
        onConflictDoUpdate: async ({ set }: { set: any }) => {
          const rows = state.tableRows.get(table) ?? new Map<string, any>();
          state.tableRows.set(table, rows);
          rows.set(values.id, rows.has(values.id) ? { ...rows.get(values.id), ...set } : { ...values });
        },
      }),
    }),
  };
}

function approverKey(userId: string, level: string, module = 'Technical') {
  return `${userId}:${level}:${module}`;
}

function makeApproverPool() {
  return {
    connect: async () => ({
      query: async (statement: string, params: any[] = []) => {
        state.approverQueries.push(statement);
        if (statement.includes('SELECT id') && statement.includes('FROM moc_approvers')) {
          const [userId, level, module] = params;
          const row = state.approverRows.get(approverKey(userId, level, module));
          return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
        }
        if (statement.includes('UPDATE moc_approvers') && statement.includes('SET name')) {
          const [name, userUuid, emailId, isActive, isDeleted, updatedAt, id] = params;
          const row = Array.from(state.approverRows.values()).find((candidate) => candidate.id === id);
          Object.assign(row, { name, userUuid, emailId, isActive, isDeleted, isSync: true, updatedAt });
          return { rows: [], rowCount: 1 };
        }
        if (statement.includes('INSERT INTO moc_approvers')) {
          const [name, userId, userUuid, level, emailId, module, isActive, isDeleted, updatedAt] = params;
          state.approverRows.set(approverKey(userId, level, module), {
            id: state.nextApproverId++,
            name,
            userId,
            userUuid,
            approverLevel: level,
            emailId,
            modulename: module,
            isActive,
            isDeleted,
            isSync: true,
            updatedAt,
          });
          return { rows: [], rowCount: 1 };
        }
        if (statement.includes('UPDATE moc_approvers SET is_deleted')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    }),
  };
}

function masterPayload(flag: unknown) {
  return {
    vessels: [{ vuid: 'vessel-1', vessel: 'Vessel One', v_code: '001', isDeleted: flag }],
    vesseltypes: [{ vtuid: 'type-1', vesselType: 'Tanker', is_deleted: flag }],
    additionalGroups: [{ id: 'additional-1', group_name: 'Additional', isDeleted: flag }],
    ports: [{ puid: 'port-1', port_name: 'Port', is_deleted: flag }],
    users: [{ uuid: 'user-1', fullname: 'User', isDeleted: flag }],
    fleetGroups: [{ fleet_group_id: 'fleet-1', fleet_group_name: 'Fleet', is_deleted: flag }],
  };
}

async function runMasterSync(flag: unknown) {
  state.payload = masterPayload(flag);
  const response = { json: vi.fn() };
  await syncMasters({ body: { domain: 'tenant' } } as any, response as any);
  return response.json.mock.calls[0][0];
}

beforeEach(() => {
  state.tableRows = new Map();
  state.approverRows = new Map();
  state.nextApproverId = 1;
  state.approverQueries = [];
  state.db = makeMasterDb();
  state.pool = makeApproverPool();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('mocapprovers')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    const endpoint = url.split('/').pop()!;
    const payloadKey = endpoint === 'vesseltypes' ? 'vesseltypes'
      : endpoint === 'additionalgroups' ? 'additionalGroups'
      : endpoint === 'fleetgroups' ? 'fleetGroups'
      : endpoint;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ [payloadKey]: state.payload[payloadKey] ?? [] }),
    };
  }));
});

describe('external master deletion state', () => {
  it('accepts boolean, numeric, and serialized source delete values', () => {
    for (const value of [true, 1, '1', ' true ', 'TRUE']) {
      expect(normalizeSourceDeletionState(value)).toBe(true);
    }
    for (const value of [false, 0, '0', ' false ', undefined, null, 'deleted', 2]) {
      expect(normalizeSourceDeletionState(value)).toBe(false);
    }
    expect(getSourceDeletionState({ isDeleted: '1' })).toBe(true);
    expect(getSourceDeletionState({ is_deleted: 'true' })).toBe(true);
    expect(getSourceDeletionState({ isDeleted: '0', is_deleted: '1' })).toBe(false);
  });

  it('tombstones and then revives every ID-based master feed', async () => {
    const created = await runMasterSync(false);
    expect(created.statistics.vessels.inserted).toBe(1);
    expect(created.statistics.vesselTypes.inserted).toBe(1);
    expect(created.statistics.additionalGroups.inserted).toBe(1);
    expect(created.statistics.ports.inserted).toBe(1);
    expect(created.statistics.users.inserted).toBe(1);
    expect(created.statistics.fleetGroups.inserted).toBe(1);

    const deleted = await runMasterSync('1');
    expect(deleted.statistics.vessels.deleted).toBe(1);
    expect(deleted.statistics.vesselTypes.deleted).toBe(1);
    expect(deleted.statistics.additionalGroups.deleted).toBe(1);
    expect(deleted.statistics.ports.deleted).toBe(1);
    expect(deleted.statistics.users.deleted).toBe(1);
    expect(deleted.statistics.fleetGroups.deleted).toBe(1);

    expect(state.tableRows.get(vessels)?.get('vessel-1')).toMatchObject({ isDeleted: true, isActive: false });
    expect(state.tableRows.get(vesselTypes)?.get('type-1')).toMatchObject({ isDeleted: true });
    expect(state.tableRows.get(additionalGroups)?.get('additional-1')).toMatchObject({ isDeleted: true });
    expect(state.tableRows.get(ports)?.get('port-1')).toMatchObject({ isDeleted: true });
    expect(state.tableRows.get(masterUsers)?.get('user-1')).toMatchObject({ isDeleted: true });
    expect(state.tableRows.get(fleetGroups)?.get('fleet-1')).toMatchObject({ isDeleted: true });

    const revived = await runMasterSync('false');
    expect(revived.statistics.vessels.updated).toBe(1);
    expect(revived.statistics.vesselTypes.updated).toBe(1);
    expect(revived.statistics.additionalGroups.updated).toBe(1);
    expect(revived.statistics.ports.updated).toBe(1);
    expect(revived.statistics.users.updated).toBe(1);
    expect(revived.statistics.fleetGroups.updated).toBe(1);

    expect(state.tableRows.get(vessels)?.get('vessel-1')).toMatchObject({ isDeleted: false, isActive: true });
    for (const [table, id] of [
      [vesselTypes, 'type-1'],
      [additionalGroups, 'additional-1'],
      [ports, 'port-1'],
      [masterUsers, 'user-1'],
      [fleetGroups, 'fleet-1'],
    ] as const) {
      expect(state.tableRows.get(table)?.get(id)).toMatchObject({ isDeleted: false });
      expect(state.tableRows.get(table)?.get(id).updatedAt).toBeInstanceOf(Date);
    }
  });
});

describe('approver reconciliation', () => {
  it('tombstones a source-deleted approver and restores the same local identity', async () => {
    const stats = { inserted: 0, updated: 0, deleted: 0, skipped: 0, errors: [] as string[] };
    const source = {
      userId: 'approver-1',
      approverLevel: '1',
      modulename: 'Technical',
      name: 'Approver',
      isActive: true,
      is_deleted: '1',
    };

    await reconcileApprovers([source], new Date('2026-08-26T10:00:00Z'), stats);
    const deleted = state.approverRows.get(approverKey('approver-1', '1'));
    expect(deleted).toMatchObject({ isDeleted: true, isActive: 0, isSync: true });
    expect(stats.deleted).toBe(1);

    await reconcileApprovers([{ ...source, is_deleted: false }], new Date('2026-08-26T11:00:00Z'), stats);
    const revived = state.approverRows.get(approverKey('approver-1', '1'));
    expect(revived).toMatchObject({ id: deleted.id, isDeleted: false, isActive: 1, isSync: true });
    expect(stats.updated).toBe(1);
    expect(state.approverQueries.some((statement) => statement.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(state.approverQueries.some((statement) => statement.includes('updated_at DESC NULLS LAST'))).toBe(true);
  });

  it('leaves a manual-only approver absent from the source untouched', async () => {
    const manual = {
      id: 99,
      name: 'Manual approver',
      userId: 'manual-1',
      approverLevel: '2',
      modulename: 'Technical',
      isActive: 1,
      isDeleted: false,
      isSync: false,
    };
    state.approverRows.set(approverKey('manual-1', '2'), { ...manual });
    const stats = { inserted: 0, updated: 0, deleted: 0, skipped: 0, errors: [] as string[] };

    await reconcileApprovers([], new Date('2026-08-26T12:00:00Z'), stats);

    expect(state.approverRows.get(approverKey('manual-1', '2'))).toEqual(manual);
    expect(stats.deleted).toBe(0);
  });
});

describe('normal vessel reads', () => {
  it('hides true tombstones but keeps legacy null flags visible, unless explicitly requested', async () => {
    const legacy = { id: 'legacy', vuuid: 'legacy', name: 'Legacy', code: 'legacy', isDeleted: null };
    const live = { id: 'live', vuuid: 'live', name: 'Live', code: 'live', isDeleted: false };
    const deleted = { id: 'deleted', vuuid: 'deleted', name: 'Deleted', code: 'deleted', isDeleted: true };
    state.db = {
      select: () => ({
        from: () => {
          const all: any = [legacy, live, deleted];
          all.where = () => all.filter((vessel: any) => vessel.isDeleted !== true);
          return all;
        },
      }),
    };

    const storage = new PostgresStorage();
    expect((await storage.getVessels()).map((vessel) => vessel.id)).toEqual(['legacy', 'live']);
    expect((await storage.getVessels({ includeDeleted: true })).map((vessel) => vessel.id)).toEqual(['legacy', 'live', 'deleted']);

    let lookupWhereCalls = 0;
    state.db = {
      select: () => ({
        from: () => {
          const all: any = [deleted];
          all.where = () => (++lookupWhereCalls <= 3 ? [] : all);
          return all;
        },
      }),
    };
    expect(await storage.getVessel('deleted')).toBeUndefined();
    expect(await storage.getVesselByCode('deleted')).toBeUndefined();
    expect(await storage.getVesselIdByName('Deleted')).toBeUndefined();
    expect(await storage.getVessel('deleted', { includeDeleted: true })).toMatchObject({ id: 'deleted' });
    expect(await storage.getVesselByCode('deleted', { includeDeleted: true })).toMatchObject({ id: 'deleted' });
    expect(await storage.getVesselIdByName('Deleted', { includeDeleted: true })).toBe('deleted');
  });
});