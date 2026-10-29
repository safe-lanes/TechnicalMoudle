import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../../../postgresClient', () => ({ getPostgresClient: vi.fn() }));
import { getPostgresClient } from '../../../postgresClient';
import { getCertificateListPage } from '../repositories/certificateRepository';

const dialect = new PgDialect();

describe('Certificate SQL read transaction', () => {
  it.each([undefined, 'companySequence', 'certificateName', 'expiryDate'])(
    'keeps scope/count/sort/page/hydration in one read-only snapshot: %s', async sortBy => {
      const tx = { execute: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 1, scoped_total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'one', attachments: null }] }) };
      const transaction = vi.fn(async (read: (tx: unknown) => unknown) => read(tx));
      vi.mocked(getPostgresClient).mockReturnValue({ db: { transaction } } as any);
      const result = await getCertificateListPage({ sortBy });
      expect(transaction).toHaveBeenCalledOnce();
      expect(tx.execute).toHaveBeenCalledTimes(3);
      expect(dialect.sqlToQuery(tx.execute.mock.calls[0][0]).sql)
        .toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      expect(result.certificates).toEqual([{ id: 'one', attachments: [] }]);
      const count = dialect.sqlToQuery(tx.execute.mock.calls[1][0]);
      const page = dialect.sqlToQuery(tx.execute.mock.calls[2][0]);
      expect(count.sql).not.toContain('attachments');
      expect(page.sql).toContain('page AS MATERIALIZED');
      expect(page.sql).not.toContain('jsonb_to_recordset');
      expect(page.params.slice(-2)).toEqual([1, 0]);
    });

  it('ships an idempotent, narrowly scoped collation migration', () => {
    const migration = fs.readFileSync('migrations/188_certificate_natural_sort.sql', 'utf8');
    expect(migration).toContain('CREATE COLLATION IF NOT EXISTS public.certificates_natural_en_us');
    expect(migration).toContain("locale = 'en-US-u-kn-true-ks-level1'");
    expect(migration).toContain('deterministic = false');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).not.toMatch(/\b(ALTER TABLE|CREATE INDEX|UPDATE|DELETE)\b/);
  });
});
