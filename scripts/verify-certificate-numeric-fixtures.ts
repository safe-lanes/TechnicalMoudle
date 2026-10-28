/**
 * Isolated PostgreSQL fixtures: only connection-local temporary tables are
 * written, and disconnect drops them. Public tables/configuration are unchanged.
 * Run: node --import tsx scripts/verify-certificate-numeric-fixtures.ts
 */
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { resolvePostgres } from '../server/postgresClient';
import * as schema from '../shared/schema';
import * as repo from '../server/modules/cert-surveys/repositories/certificateRepository';
import { queryCertificatePage } from '../server/modules/cert-surveys/repositories/certificatePagingRepository';
import { getLegacyCertificates } from '../server/modules/cert-surveys/__tests__/fixtures/legacyCertificateList';

const postgres = await resolvePostgres();
if (!postgres) throw new Error('Development database unavailable');
const client = await postgres.pool.connect();
try {
  const tables = ['ship_certificates_master', 'vessel_certificate_applicability', 'vessel_certificate_data'] as const;
  for (const table of tables) {
    await client.query(`CREATE TEMP TABLE ${table} AS SELECT * FROM public.${table} WITH NO DATA`);
  }
  async function insert(table: typeof tables[number], rows: Record<string, unknown>[]) {
    const snake = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value])));
    await client.query(`INSERT INTO pg_temp.${table}
      SELECT * FROM jsonb_populate_recordset(NULL::pg_temp.${table}, $1::jsonb)`,
    [JSON.stringify(snake)]);
  }

  const names = ['\u00a0 VESSEL 2\ufeff', 'ΟΣ', 'İSTANBUL 10', 'Vessel 10', 'Vessel 02', 'vessel 2'];
  const natural = ['Alpha 2', 'alpha 10', 'ALPHA 02', 'alpha 0002', 'Éngine', 'engine', 'e\u0301ngine', 'Æther', 'Aether', 'Straße', 'strasse', 'Vessel 10', 'Vessel 2', '', '01 Jan 2027', '2026-10-01', 'A-2', 'A 2', 'A_2', '😀', '🚢', 'İ', 'i', 'I', 'ı', 'ΟΣ', 'ος', 'οσ'];
  const masters = Array.from({ length: 82 }, (_, i) => ({
    id: i + 1, masterId: `master-${i}`, companyId: i % 5 ? natural[i % natural.length] : '',
    certificateName: natural[i % natural.length], certificateLabel: i % 3 ? '' : natural[(i + 3) % natural.length],
    companyGroup: i % 2 ? natural[(i + 7) % natural.length] : '', companySequence: i % 7 ? i % 9 : null,
    sequence: i % 11, isActive: i < 81, isDeleted: i === 80 ? true : i % 3 ? false : null,
  }));
  const apps = names.flatMap((vesselName, v) => masters.map((master, i) => ({
    id: v * masters.length + i + 1, vesselId: `v${v}`, vesselName, masterId: master.masterId,
    isApplicable: i % 19 !== 18, isDeleted: i % 17 === 16 ? true : i % 3 ? false : null,
  })));
  const data = apps.filter((_, i) => i % 3 === 0).map((app, i) => ({
    id: i + 1, vesselId: app.vesselId, vesselName: app.vesselName, masterId: app.masterId,
    certificateNumber: i % 2 ? natural[i % natural.length] : null, issueDate: natural[(i + 2) % natural.length], lastAnnual: natural[(i + 3) % natural.length],
    nextAnnual: natural[(i + 4) % natural.length], lastInterm: natural[(i + 5) % natural.length],
    nextInterm: natural[(i + 6) % natural.length], endorsementDate: natural[(i + 7) % natural.length],
    expiryDate: i % 2 ? '' : natural[(i + 1) % natural.length], isDeleted: i % 13 === 12 ? true : i % 3 ? false : null,
    attachments: [{ id: `fixture-${i}`, name: 'fixture.pdf', data: 'data:application/pdf;base64,SGk=' }],
  }));
  await insert(tables[0], masters);
  await insert(tables[1], apps);
  await insert(tables[2], [...data, {
    ...data[0], id: 999, certificateNumber: 'last duplicate', attachments: [], isDeleted: null,
  }]);
  const db = drizzle(client, { schema });
  assert.equal(
    (await db.select({ id: schema.vesselCertificateApplicability.id }).from(schema.vesselCertificateApplicability)).length,
    apps.length,
    'Drizzle must resolve the connection-local fixture tables, not public data',
  );
  const scopes = [
    {}, { vesselId: 'v1' }, { vesselId: 'all', vesselIds: ['v2', 'v0'] },
    { vesselId: 'v0', vesselName: 'ignored' }, { vesselId: 'all', vesselIds: [] },
    { vesselIds: ['v1'] }, { vesselName: ' vessel 2 ' }, { vesselName: 'ΟΣ' },
    { vesselName: 'İSTANBUL 10' }, { vesselNames: 'ΟΣ, vessel 2' }, { vesselId: 'missing' },
  ];
  let comparisons = 0;
  await db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const readRepo = {
      getApplicableCertificates: () => repo.getApplicableCertificates(tx),
      getMasterCertificatesByIds: (ids: string[]) => repo.getMasterCertificatesByIds(ids, tx),
      getAllVesselCertificateData: () => repo.getAllVesselCertificateData(tx),
    };
    for (const scope of scopes) {
      for (const sort of [{}, { sortOrder: 'desc' }, { sortBy: 'companySequence', sortOrder: 'asc' },
        { sortBy: 'companySequence', sortOrder: 'desc' }, { sortBy: 'unknown', sortOrder: 'desc' },
        ...['id', 'companyId', 'certificateName', 'name', 'vessel', 'certificateNumber', 'type', 'companyGroup',
          'issueDate', 'expiryDate', 'lastAnnual', 'nextAnnual', 'lastInterm', 'nextInterm', 'endorsementDate']
          .flatMap(sortBy => ['asc', 'desc'].map(sortOrder => ({sortBy, sortOrder})))]) {
        for (const page of [1, 2, 3, 4, -1]) {
          const filters = { ...scope, ...sort, page };
          assert.deepEqual(await queryCertificatePage(tx, filters),
            await getLegacyCertificates(filters, readRepo));
          comparisons++;
        }
      }
    }
  });
  // Distinguish nonempty applicability/no active master from an empty scope.
  await client.query('UPDATE pg_temp.ship_certificates_master SET is_active = false');
  await db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    assert.deepEqual(await queryCertificatePage(tx, {}),
      await getLegacyCertificates({}, {
        getApplicableCertificates: () => repo.getApplicableCertificates(tx),
        getMasterCertificatesByIds: ids => repo.getMasterCertificatesByIds(ids, tx),
        getAllVesselCertificateData: () => repo.getAllVesselCertificateData(tx),
      }));
    comparisons++;
  });
  console.log(JSON.stringify({ fixtureComparisons: comparisons, allEqual: true, publicDataWrites: 0 }));
} finally {
  client.release();
  await postgres.pool.end();
}
