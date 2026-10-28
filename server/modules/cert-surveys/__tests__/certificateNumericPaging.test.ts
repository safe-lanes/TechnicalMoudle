import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { queryNumericCertificatePage, supportsSqlCertificateSort } from '../repositories/certificateNumericPaging';

const dialect = new PgDialect();

function database(total = 239, scopedTotal = total) {
  return { execute: vi.fn()
    .mockResolvedValueOnce({ rows: [{ total, scoped_total: scopedTotal }] })
    .mockResolvedValueOnce({ rows: [] }) };
}

describe('Database Certificate scope/count/sequence paging', () => {
  it('returns only the database count and bounded page, without application candidate metadata', async () => {
    const db = database();
    const result = await queryNumericCertificatePage(db as any, { page: 2 });
    expect(result).toMatchObject({ total: 239, page: 2, limit: 100, totalPages: 3 });
    expect(db.execute).toHaveBeenCalledTimes(2);
    const count = dialect.sqlToQuery(db.execute.mock.calls[0][0]);
    expect(count.sql).toContain('count(*)::int AS total');
    expect(count.sql).toContain('JOIN ship_certificates_master');
    expect(count.sql).not.toContain('attachments');
    const page = dialect.sqlToQuery(db.execute.mock.calls[1][0]);
    expect(page.sql).toContain('page AS MATERIALIZED');
    expect(page.sql).toContain('LEFT JOIN vessel_certificate_data');
    expect(page.sql).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
    expect(page.params.slice(-2)).toEqual([100, 100]);
    expect(page.sql).not.toContain('jsonb_to_recordset');
  });

  it.each([
    [{ vesselId: 'v1', vesselName: 'ignored' }, 'a.vessel_id =', ['v1']],
    [{ vesselId: 'all', vesselIds: ['v2', 'v1'], vesselName: 'ignored' }, 'a.vessel_id = ANY', [['v2', 'v1']]],
    [{ vesselName: '  VESSEL 2 ' }, 'lower(btrim', ['vessel 2']],
    [{ vesselNames: ' VESSEL 2, vessel 1 ' }, 'lower(btrim', [['vessel 2', 'vessel 1']]],
  ])('pushes the existing scope precedence into both SQL stages: %j', async (filters, expression, values) => {
    const db = database();
    await queryNumericCertificatePage(db as any, filters);
    for (const [statement] of db.execute.mock.calls) {
      const query = dialect.sqlToQuery(statement);
      expect(query.sql).toContain(expression);
      for (const value of values) expect(query.params).toContainEqual(value);
      expect(query.params).not.toContain('ignored');
    }
  });

  it('preserves the early empty-scope response without page/sort metadata', async () => {
    const db = database(0);
    expect(await queryNumericCertificatePage(db as any, { vesselId: 'missing' }))
      .toEqual({ certificates: [], total: 0, page: 1, limit: 100 });
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('retains full metadata for applicability that has no eligible active master', async () => {
    const db = database(0, 1);
    expect(await queryNumericCertificatePage(db as any, {})).toMatchObject({
      certificates: [], total: 0, totalPages: 0, sortBy: 'companySequence', sortOrder: 'asc',
    });
  });

  it('does not treat default metadata sortOrder=desc as a request to reverse vessel/sequence order', async () => {
    const db = database();
    await queryNumericCertificatePage(db as any, { sortOrder: 'desc' });
    const query = dialect.sqlToQuery(db.execute.mock.calls[1][0]);
    expect(query.sql).not.toContain('effective_sequence DESC');
    expect(query.sql).toContain('p.vessel_order ASC, p.effective_sequence ASC, p.source_order ASC');
  });

  it('preserves numeric-sort ties using prior vessel/sequence/source encounter order', async () => {
    const db = database();
    await queryNumericCertificatePage(db as any, { sortBy: 'companySequence', sortOrder: 'desc' });
    expect(dialect.sqlToQuery(db.execute.mock.calls[1][0]).sql)
      .toContain('p.effective_sequence DESC, p.vessel_order ASC, p.effective_sequence ASC, p.source_order ASC');
  });

  it('refuses to substitute a database collation for the natural string comparator', async () => {
    expect(supportsSqlCertificateSort('certificateName')).toBe(false);
    expect(supportsSqlCertificateSort('expiryDate')).toBe(false);
    expect(supportsSqlCertificateSort('unknown')).toBe(true);
    const db = database();
    await expect(queryNumericCertificatePage(db as any, { sortBy: 'certificateName' }))
      .rejects.toThrow('Natural text sorting is not supported');
    expect(db.execute).not.toHaveBeenCalled();
  });
});
