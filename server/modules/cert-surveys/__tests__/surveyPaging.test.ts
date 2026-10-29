import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../../../postgresClient', () => ({ getPostgresClient: vi.fn() }));
vi.mock('../../sync', () => ({ logFieldChanges: vi.fn() }));
import { getPostgresClient } from '../../../postgresClient';
import { querySurveyPage } from '../repositories/surveyPagingRepository';
import { getSurveyListPage } from '../repositories/surveyRepository';
import { getSurveys } from '../services/surveyService';

const dialect = new PgDialect();
function database(total = 239, scopedTotal = total) {
  return { execute: vi.fn()
    .mockResolvedValueOnce({ rows: [{ total, scoped_total: scopedTotal }] })
    .mockResolvedValueOnce({ rows: [] }) };
}
const compile = (db: ReturnType<typeof database>, call: number) =>
  dialect.sqlToQuery(db.execute.mock.calls[call][0]);

describe('Survey database page contract', () => {
  it('counts and selects bounded rows without application candidate metadata', async () => {
    const db = database();
    expect(await querySurveyPage(db as any, { page: 2 })).toEqual({
      surveys: [], total: 239, page: 2, limit: 100, totalPages: 3,
    });
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(compile(db, 0).sql).toContain('count(*)::int AS total');
    expect(compile(db, 0).sql).not.toContain('attachments');
    const page = compile(db, 1);
    expect(page.params.slice(-2)).toEqual([100, 100]);
    expect(page.sql).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
    expect(page.sql.indexOf('d.attachments')).toBeGreaterThan(page.sql.indexOf('page AS MATERIALIZED'));
    expect(page.sql).not.toContain('jsonb_to_recordset');
  });

  it.each([
    [{ vesselId: 'v1', vesselName: 'ignored' }, 'a.vessel_id =', ['v1']],
    [{ vesselId: 'all', vesselIds: ['v2', 'v1'], vesselName: 'ignored' }, 'a.vessel_id = ANY', [['v2', 'v1']]],
    [{ vesselName: '\u00a0VESSEL 2\ufeff' }, 'lower(btrim', ['vessel 2']],
    [{ vesselNames: ' ΟΣ, vessel 1 ' }, 'lower(btrim', [['ος', 'vessel 1']]],
  ])('preserves scope precedence in count and page: %j', async (filters, expression, values) => {
    const db = database();
    await querySurveyPage(db as any, filters);
    for (const [statement] of db.execute.mock.calls) {
      const q = dialect.sqlToQuery(statement);
      expect(q.sql).toContain(expression);
      for (const value of values) expect(q.params).toContainEqual(value);
      expect(q.params).not.toContain('ignored');
    }
  });

  it('keeps strict-false master deletion and unrestricted optional saved data', async () => {
    const db = database();
    await querySurveyPage(db as any, {});
    const sql = compile(db, 1).sql;
    expect(sql).toContain('m.is_active = true AND m.is_deleted = false');
    expect(sql).toContain('a.is_deleted = false OR a.is_deleted IS NULL');
    expect(sql).toContain('LEFT JOIN data_map');
    expect(sql.split('data_source AS MATERIALIZED')[1].split('data_map AS')[0]).not.toContain('is_deleted');
    expect(sql).toContain("d.vessel_id || '-' || d.master_id");
    expect(sql).toContain('ORDER BY data_key, source_order DESC');
  });

  it.each(['id', 'companyId', 'surveyName', 'name', 'vessel', 'type', 'companyGroup', 'surveyDate', 'dueDate'])(
    'uses ordinary Survey collation before paging for %s', async sortBy => {
      const db = database();
      await querySurveyPage(db as any, { sortBy, sortOrder: 'DESC' });
      const q = compile(db, 1).sql;
      expect(q).toContain('COLLATE public.surveys_default_en_us DESC');
      expect(q.indexOf('COLLATE public.surveys_default_en_us')).toBeLessThan(q.indexOf('LIMIT'));
      expect(q).not.toContain('certificates_natural_en_us');
      if (sortBy === 'companyId') expect(q).toContain("(p.vessel_id || '::' || p.master_id) COLLATE");
    });

  it.each(['firstRangeDate', 'postponed', 'lastEdit', '__proto__', 'constructor', 'dueDate; DROP TABLE vessels'])(
    'retains sequence fallback without interpolating unsupported sort: %s', async sortBy => {
      const db = database();
      await querySurveyPage(db as any, { sortBy, sortOrder: 'desc' });
      expect(compile(db, 1).sql).toContain('p.effective_sequence DESC');
      expect(compile(db, 1).sql).not.toContain('COLLATE public.surveys_default_en_us');
      expect(compile(db, 1).sql).not.toContain('DROP TABLE');
    });

  it('does not reverse default grouping when sortOrder alone is desc', async () => {
    const db = database();
    await querySurveyPage(db as any, { sortOrder: 'desc' });
    expect(compile(db, 1).sql).not.toContain('effective_sequence DESC');
    expect(compile(db, 1).sql).toContain('p.vessel_order ASC, p.effective_sequence ASC, p.source_order ASC');
  });

  it('keeps the complete early-empty response', async () => {
    const db = database(0);
    expect(await querySurveyPage(db as any, { vesselId: 'missing' })).toEqual({
      surveys: [], total: 0, page: 1, limit: 100, totalPages: 0,
    });
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('retains no-active-master response and large export limits', async () => {
    const empty = database(0, 1);
    expect(await querySurveyPage(empty as any, {})).toEqual({
      surveys: [], total: 0, page: 1, limit: 100, totalPages: 0,
    });
    const db = database(120000);
    await querySurveyPage(db as any, { limit: 100000 });
    expect(compile(db, 1).params.slice(-2)).toEqual([100000, 0]);
  });

  it.each([
    [{ page: -1, limit: 100 }, [100, 39]],
    [{ page: 1, limit: -2 }, [237, -0]],
    [{ page: 10, limit: 100 }, [0, 239]],
    [{ page: 0, limit: 0 }, [100, 0]],
  ])('retains legacy slice window: %j', async (filters, expected) => {
    const db = database();
    await querySurveyPage(db as any, filters);
    expect(compile(db, 1).params.slice(-2)).toEqual(expected);
  });

  it.each([undefined, 'surveyName', 'dueDate', 'companySequence'])(
    'keeps service count/page/hydration in one read-only snapshot: %s', async sortBy => {
      const tx = { execute: vi.fn().mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 1, scoped_total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'v::m', attachments: null }] }) };
      const transaction = vi.fn(async read => read(tx));
      vi.mocked(getPostgresClient).mockReturnValue({ db: { transaction } } as any);
      expect(await getSurveys({ sortBy })).toEqual({
        surveys: [{ id: 'v::m', attachments: [] }], total: 1, page: 1, limit: 100, totalPages: 1,
      });
      expect(transaction).toHaveBeenCalledOnce();
      expect(tx.execute).toHaveBeenCalledTimes(3);
      expect(dialect.sqlToQuery(tx.execute.mock.calls[0][0]).sql)
        .toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    });

  it('fails explicitly when the database is unavailable', async () => {
    vi.mocked(getPostgresClient).mockReturnValue(null as any);
    await expect(getSurveyListPage({})).rejects.toThrow('Database not available');
  });

  it('ships only the approved ordinary, nondeterministic Survey collation', () => {
    const migration = fs.readFileSync('migrations/189_survey_default_sort.sql', 'utf8');
    expect(migration).toContain('CREATE COLLATION IF NOT EXISTS public.surveys_default_en_us');
    expect(migration).toContain("locale = 'en-US'");
    expect(migration).toContain('deterministic = false');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).not.toMatch(/\b(ALTER TABLE|CREATE INDEX|UPDATE|DELETE)\b/);
  });
});
