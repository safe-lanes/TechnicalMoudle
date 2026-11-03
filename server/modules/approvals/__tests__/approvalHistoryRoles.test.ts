import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mock = vi.hoisted(() => {
  const where = vi.fn();
  const from = vi.fn(() => ({ where }));
  const select = vi.fn((_projection: Record<string, unknown>) => ({ from }));
  return { where, from, select, log: vi.fn(), tenant: vi.fn() };
});
vi.mock('../../../postgresClient', () => ({ getPostgresClient: () => ({ db: { select: mock.select } }) }));
vi.mock('../../../utils/asyncLocalStorage', () => ({ getCurrentTenantContext: mock.tenant }));
vi.mock('../../sync/fieldLogger', () => ({ logFieldChanges: mock.log }));
import { lookupAccountRoles } from '../approvalHistoryRepository';

beforeEach(() => {
  vi.clearAllMocks();
  mock.tenant.mockReturnValue(null);
});

describe('approval history account role read', () => {
  it('reads only exact IDs and roles, excludes deleted accounts and trims blank values', async () => {
    mock.where.mockResolvedValue([{ id: 'actor-a', role: ' Sail Admin ' }, { id: 'actor-b', role: '  ' }]);
    const roles = await lookupAccountRoles(['actor-a', 'actor-a', 'actor-b', 'system', '']);
    expect(roles).toEqual(new Map([['actor-a', 'Sail Admin'], ['actor-b', null]]));
    expect(Object.keys(mock.select.mock.calls[0][0])).toEqual(['id', 'role']);
    const query = new PgDialect().sqlToQuery(mock.where.mock.calls[0][0]);
    expect(query.params).toEqual(['actor-a', 'actor-b', false]);
    expect(query.sql).toContain('"master_users"."is_deleted"');
    expect(query.sql).toContain('is null');
    expect(query.sql).not.toContain('full_name');
    expect(mock.log).not.toHaveBeenCalled();
  });
  it('uses the installation tenant database and does not query for empty IDs', async () => {
    expect(await lookupAccountRoles([])).toEqual(new Map());
    expect(mock.select).not.toHaveBeenCalled();
    const where = vi.fn().mockResolvedValue([]);
    const select = vi.fn(() => ({ from: () => ({ where }) }));
    mock.tenant.mockReturnValue({ db: { select } });
    expect(await lookupAccountRoles(['unavailable-account'])).toEqual(new Map());
    expect(select).toHaveBeenCalledOnce();
    expect(mock.select).not.toHaveBeenCalled();
    expect(mock.log).not.toHaveBeenCalled();
  });
});
