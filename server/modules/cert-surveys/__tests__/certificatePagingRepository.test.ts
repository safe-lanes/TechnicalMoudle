import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../../../postgresClient', () => ({ getPostgresClient: vi.fn() }));
import { getPostgresClient } from '../../../postgresClient';
import {
  getCertificatePage, getVesselCertificateMetadata, withCertificateReadSnapshot,
} from '../repositories/certificateRepository';

const dialect = new PgDialect();

describe('Certificate SQL page hydration', () => {
  it('omits file bodies from compatibility metadata', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
    await getVesselCertificateMetadata({ select, execute: vi.fn() } as any);
    const selected = select.mock.calls[0][0] as any;
    expect(selected).not.toHaveProperty('attachments');
    expect(Object.keys(selected)).toEqual([
      'id', 'vesselId', 'masterId', 'certificateNumber', 'issueDate', 'expiryDate',
      'lastAnnual', 'nextAnnual', 'lastInterm', 'nextInterm', 'endorsementDate', 'lastEditUpload',
    ]);
    const predicate = dialect.sqlToQuery(where.mock.calls[0][0]);
    expect(predicate.sql).toContain('"is_deleted"');
    expect(predicate.sql).toContain('is null');
    expect(predicate.params).toContain(false);
  });

  it('selects rank windows in SQL before hydrating complete attachment objects', async () => {
    const attachments = [{ id: 'file-2', data: 'data:application/pdf;base64,SGk=' }];
    const execute = vi.fn().mockResolvedValue({ rows: [{ rank: 1, attachments }] });
    const rows = [
      { name: 'first', _certificateDataId: 10, attachments: [] },
      { name: 'second', _certificateDataId: 20, attachments: [] },
      { name: 'third', _certificateDataId: 30, attachments: [] },
    ];
    const result = await getCertificatePage({ execute } as any, rows, 2, 1);
    expect(result).toEqual([{ name: 'second', attachments }]);
    const statement = dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(statement.sql).toContain('AS MATERIALIZED');
    expect(statement.sql).toContain('LEFT JOIN vessel_certificate_data');
    expect(statement.sql).toMatch(/ORDER BY rank LIMIT \$2 OFFSET \$3/);
    expect(statement.params.slice(1)).toEqual([1, 1]);
    expect(JSON.parse(statement.params[0] as string)).toEqual([
      { rank: 0, data_id: 10 }, { rank: 1, data_id: 20 }, { rank: 2, data_id: 30 },
    ]);
    expect(statement.params[0]).not.toContain('data:');
    expect(result[0]).not.toHaveProperty('_certificateDataId');
  });

  it('returns blank attachments for a Certificate without saved data', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ rank: 0, attachments: null }] });
    expect(await getCertificatePage({ execute } as any,
      [{ name: 'blank', attachments: [] }], 1, 100)).toEqual([{ name: 'blank', attachments: [] }]);
  });

  it('keeps all read stages inside the same read-only repeatable-read transaction', async () => {
    const tx = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
    const transaction = vi.fn(async (read: (tx: unknown) => unknown) => read(tx));
    vi.mocked(getPostgresClient).mockReturnValue({ db: { transaction } } as any);
    await withCertificateReadSnapshot(reader => reader.getCertificatePage([], 1, 100));
    expect(transaction).toHaveBeenCalledOnce();
    expect(dialect.sqlToQuery(tx.execute.mock.calls[0][0]).sql)
      .toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  });
});
