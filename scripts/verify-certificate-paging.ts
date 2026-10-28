/**
 * Read-only compatibility/performance probe. No fixture records are inserted.
 * Run: node --import tsx scripts/verify-certificate-paging.ts
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { sql } from 'drizzle-orm';
import { resolvePostgres } from '../server/postgresClient';
import * as repo from '../server/modules/cert-surveys/repositories/certificateRepository';
import { getCertificates } from '../server/modules/cert-surveys/services/certificateService';
import { getLegacyCertificates } from '../server/modules/cert-surveys/__tests__/fixtures/legacyCertificateList';

const postgres = await resolvePostgres();
if (!postgres) throw new Error('Development database unavailable');
try {
  const apps = await repo.getApplicableCertificates();
  assert.ok(apps);
  const vessels = [...new Set(apps.map(row => row.vesselId))];
  const cases: Parameters<typeof getCertificates>[0][] = [
    {}, ...[2, 3, 4, 5, 6, 7, 8].map(page => ({ page })),
    ...vessels.map(vesselId => ({ vesselId })),
    { vesselId: 'all', vesselIds: vessels.slice(0, 3) },
    { vesselNames: apps.slice(0, 3).map(row => row.vesselName).join(',') },
    { vesselName: '__nonexistent_certificate_probe__' },
    { page: 1, limit: 100000 }, { page: -1, limit: 100 }, { page: 1, limit: -2 },
    ...['id', 'certificateName', 'vessel', 'type', 'certificateNumber', 'issueDate', 'expiryDate',
      'lastAnnual', 'nextAnnual', 'lastInterm', 'nextInterm', 'endorsementDate', 'companySequence']
      .flatMap(sortBy => ['asc', 'desc'].map(sortOrder => ({ sortBy, sortOrder, page: 2 }))),
  ];
  for (const filters of cases) {
    assert.deepEqual(await getCertificates(filters), await getLegacyCertificates(filters));
  }

  // Test actual SQL page boundaries with virtual rows and no database writes.
  await postgres.db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const virtual = Array.from({ length: 247 }, (_, rank) => ({ rank, attachments: [] }));
    for (const [page, limit] of [[1, 100], [2, 100], [3, 100], [4, 100], [-1, 100], [1, -2], [1, 100000]]) {
      assert.deepEqual(await repo.getCertificatePage(tx, virtual, page, limit),
        virtual.slice((page - 1) * limit, (page - 1) * limit + limit));
    }
  });

  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
  const measurements: { scope: string; legacyMs: number[]; pagedMs: number[]; legacySourceBytes: number; pagedResponseBytes: number }[] = [];
  for (const [scope, filters] of [
    ['all-vessels', {}],
    ['single-vessel', { vesselId: vessels[0] }],
  ] as const) {
    const legacyMs: number[] = [], pagedMs: number[] = [];
    for (let i = 0; i < 3; i++) {
      let start = performance.now(); await getLegacyCertificates(filters); legacyMs.push(performance.now() - start);
      start = performance.now(); await getCertificates(filters); pagedMs.push(performance.now() - start);
    }
    const legacySource = await repo.getAllVesselCertificateData();
    const paged = await getCertificates(filters);
    measurements.push({
      scope, legacyMs, pagedMs,
      legacySourceBytes: bytes(legacySource),
      pagedResponseBytes: bytes(paged),
    });
  }
  console.log(JSON.stringify({
    comparisonCases: cases.length, sqlBoundaryCases: 7, allComparisonsEqual: true,
    measurements,
    note: 'Diagnostic legacy vessel-data source size versus current response JSON size, not wire bytes or heap measurements. Default/numeric sorts use SQL scope/count/page selection; explicit natural string sorts still use the compatibility path.',
  }, null, 2));
} finally {
  await postgres.pool.end();
}
