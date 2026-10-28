import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { workOrderPageQuery } from '@shared/workOrdersPagination';
import {
  intersectWorkOrderScope,
  resolveWorkOrderReadScope,
  workOrderScopePredicate,
} from '../repositories/workOrderPagingScope';
import type { RbacIdentity } from '../../../middleware/auth';

// No live connection, authentication headers, or mutation fixtures.
vi.mock('../../../db', () => ({ getDb: vi.fn() }));

const office: RbacIdentity = { role: 'Office', userType: 'Office', source: 'forwarded' };
const ship: RbacIdentity = { role: 'Vessel User', userType: 'Ship', source: 'forwarded' };
const parse = (values: Record<string, unknown> = {}) => workOrderPageQuery.parse(values);

describe('proposed Work Order paged transport contract', () => {
  it('preserves page defaults, literal search text, and maximum size', () => {
    expect(parse()).toMatchObject({ page: 1, pageSize: 10, status: 'Planned', period: null });
    expect(parse({ page: '4', pageSize: '500', search: '100%_\\' }))
      .toMatchObject({ page: 4, pageSize: 200, search: '100%_\\' });
  });

  it.each(['0', '-1', '1.5', '1x', '', ' ', [], {}, 'Infinity', '9007199254740992'])(
    'rejects malformed page %j', page => {
      expect(workOrderPageQuery.safeParse({ page }).success).toBe(false);
    },
  );

  it('rejects unsafe offsets, unsupported sorts and statuses', () => {
    for (const q of [
      { page: Number.MAX_SAFE_INTEGER, pageSize: 200 },
      { sortBy: 'wouuid;DROP TABLE work_orders' },
      { sortDir: 'ASC NULLS LAST' }, { status: 'Invented' }, { filters: '{}' },
    ]) expect(workOrderPageQuery.safeParse(q).success).toBe(false);
  });

  it('distinguishes an omitted vessel allow-list from an explicitly empty one', () => {
    expect(parse().vesselIds).toBeUndefined();
    expect(parse({ vesselIds: '' }).vesselIds).toBe('');
  });
  it('accepts validated browser timezones and rejects invented/injected values', () => {
    for (const timeZone of ['Australia/Brisbane', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'])
      expect(parse({ timeZone }).timeZone).toBe(timeZone);
    for (const timeZone of ['', 'invented-zone', "UTC');DROP TABLE work_orders;--", [], {}])
      expect(workOrderPageQuery.safeParse({ timeZone }).success).toBe(false);
  });

  it.each([
    { mode: 'year-only', year: 2026 },
    { mode: 'year-quarter', year: 2026, quarter: 4 },
    { mode: 'year-months', year: 2024, months: [2, 2] },
    { mode: 'date-range', dateFrom: '2026-01-01T00:00:00.000Z', dateTo: '2026-02-01T00:00:00.000Z' },
  ])('accepts valid period %j without deduplicating RH months', period => {
    expect(parse({ period: JSON.stringify(period) }).period).toEqual(period);
  });

  it('retains empty and JSON-null period requests as no filter', () => {
    expect(parse({ period: '' }).period).toBeNull();
    expect(parse({ period: 'null' }).period).toBeNull();
  });

  it.each([
    '{', '[]', '{}',
    '{"mode":"year-only","year":"2026"}',
    '{"mode":"year-quarter","year":2026,"quarter":5}',
    '{"mode":"year-months","year":2026,"months":[]}',
    '{"mode":"year-months","year":2026,"months":[13]}',
    '{"mode":"date-range","dateFrom":"bad","dateTo":"2026-01-01"}',
    '{"mode":"date-range","dateFrom":"2026-02-30","dateTo":"2026-03-05"}',
    '{"mode":"date-range","dateFrom":"2026-02-02","dateTo":"2026-01-01"}',
  ])('rejects malformed period %s', period => {
    expect(workOrderPageQuery.safeParse({ period }).success).toBe(false);
  });

  it('validates criticality without silently changing rank/search text', () => {
    expect(parse({ criticality: 'critical,critical-component', rank: ' Chief Engineer ' }))
      .toMatchObject({ criticality: ['critical', 'critical-component'], rank: ' Chief Engineer ' });
    expect(workOrderPageQuery.safeParse({ criticality: 'anything' }).success).toBe(false);
  });
});

describe('proposed trusted Work Order read scope', () => {
  it('preserves authorized Office fleet and selected-vessel reads', () => {
    expect(intersectWorkOrderScope(office, parse(), [])).toEqual({ vesselIds: null });
    expect(intersectWorkOrderScope(office, parse({ vesselId: 'B' }), ['A']))
      .toEqual({ vesselIds: ['B'] });
  });

  it('uses active assignments, never a client list, for My Vessels authority', () => {
    expect(intersectWorkOrderScope(office, parse({ scope: 'my' }), ['A', 'A', 'B']))
      .toEqual({ vesselIds: ['A', 'B'] });
    expect(intersectWorkOrderScope(office, parse({ vesselIds: 'B,C' }), ['A', 'B']))
      .toEqual({ vesselIds: ['B'] });
    expect(intersectWorkOrderScope(office, parse({ scope: 'my', vesselId: 'C' }), ['A']))
      .toEqual({ vesselIds: [] });
  });

  it('does not let scope=all or a fleet selector widen Ship access', () => {
    expect(intersectWorkOrderScope(ship, parse({ scope: 'all' }), ['A']))
      .toEqual({ vesselIds: ['A'] });
    expect(intersectWorkOrderScope(ship, parse({ vesselIds: 'A,B' }), ['A']))
      .toEqual({ vesselIds: ['A'] });
    expect(() => intersectWorkOrderScope(ship, parse({ vesselId: 'B' }), ['A']))
      .toThrow('Vessel is not assigned');
  });

  it('keeps empty assignments, explicit lists and the legacy empty sentinel empty', () => {
    for (const q of [
      { scope: 'my' }, { vesselIds: '' }, { vesselIds: '__NO_ASSIGNED_VESSELS__' },
      { scope: 'my', vesselId: 'A' },
    ]) expect(intersectWorkOrderScope(office, parse(q), [])).toEqual({ vesselIds: [] });
    expect(intersectWorkOrderScope(ship, parse(), [])).toEqual({ vesselIds: [] });
  });

  it('does not trust the legacy mock user role when RBAC identity is missing', async () => {
    expect(() => intersectWorkOrderScope(undefined, parse(), ['A'])).toThrow('trusted');
    await expect(resolveWorkOrderReadScope({}, parse())).rejects.toThrow('trusted');
    await expect(resolveWorkOrderReadScope({ rbac: office }, parse({ scope: 'my' })))
      .resolves.toEqual({ vesselIds: [] });
  });

  it('compiles vessel scope with bound parameters and explicit TRUE/FALSE', () => {
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(workOrderScopePredicate({ vesselIds: null })).sql).toBe('TRUE');
    expect(dialect.sqlToQuery(workOrderScopePredicate({ vesselIds: [] })).sql).toBe('FALSE');
    const attack = "A'); DROP TABLE work_orders; --";
    const compiled = dialect.sqlToQuery(workOrderScopePredicate({ vesselIds: [attack, 'B'] }));
    expect(compiled.sql).toBe('w.vessel_id IN ($1,$2)');
    expect(compiled.params).toEqual([attack, 'B']);
    expect(compiled.sql).not.toContain(attack);
  });
});
