/** Read-only existing-data Survey parity and service-call measurement. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { resolvePostgres } from '../server/postgresClient';
import * as repo from '../server/modules/cert-surveys/repositories/surveyRepository';
import { getSurveys } from '../server/modules/cert-surveys/services/surveyService';
import { getLegacySurveys } from '../server/modules/cert-surveys/__tests__/fixtures/legacySurveyList';

const postgres = await resolvePostgres();
if (!postgres) throw new Error('Development database unavailable');
try {
  const apps = await repo.getApplicableSurveys();
  assert.ok(apps);
  const vessels = [...new Set(apps.map(row => row.vesselId))];
  const cases: Parameters<typeof getSurveys>[0][] = [
    {}, ...[2, 3, 4, 5, 6, 7, 8].map(page => ({ page })),
    ...vessels.map(vesselId => ({ vesselId })),
    { vesselId: 'all', vesselIds: vessels.slice(0, 3) },
    { vesselNames: apps.slice(0, 3).map(row => row.vesselName).join(',') },
    { vesselName: '__nonexistent_survey_probe__' }, { vesselIds: vessels.slice(0, 1) },
    { page: 1, limit: 100000 }, { page: -1, limit: 100 }, { page: 1, limit: -2 },
    ...['id', 'companyId', 'surveyName', 'name', 'vessel', 'type', 'companyGroup',
      'surveyDate', 'dueDate', 'companySequence', 'unknown']
      .flatMap(sortBy => ['asc', 'desc'].map(sortOrder => ({ sortBy, sortOrder, page: 2 }))),
  ];
  // Read both algorithms under the same snapshot, including count/page operations.
  await postgres.db.transaction(async tx => {
    const { sql } = await import('drizzle-orm');
    const { querySurveyPage } = await import('../server/modules/cert-surveys/repositories/surveyPagingRepository');
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const readRepo = {
      getApplicableSurveys: () => repo.getApplicableSurveys(tx),
      getMasterSurveysByIds: (ids: string[]) => repo.getMasterSurveysByIds(ids, tx),
      getAllVesselSurveyData: () => repo.getAllVesselSurveyData(tx),
    };
    for (const filters of cases) {
      assert.deepEqual(await querySurveyPage(tx, filters), await getLegacySurveys(filters, readRepo),
        `Existing-data parity: ${JSON.stringify(filters)}`);
    }
  });
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
  const measurements = [];
  for (const [scope, filters] of [
    ['all-first-page', {}], ['single-vessel', { vesselId: vessels[0] }],
    ['multi-vessel-later-page', { vesselId: 'all', vesselIds: vessels.slice(0, 3), page: 2 }],
    ['text-sort-later-page', { sortBy: 'dueDate', sortOrder: 'desc', page: 2 }],
  ] as const) {
    const legacyMs: number[] = [], pagedMs: number[] = [];
    for (let i = 0; i < 3; i++) {
      let start = performance.now(); await getLegacySurveys(filters); legacyMs.push(performance.now() - start);
      start = performance.now(); await getSurveys(filters); pagedMs.push(performance.now() - start);
    }
    const response = await getSurveys(filters);
    measurements.push({ scope, legacyMs, pagedMs, rows: response.surveys.length,
      total: response.total, pagedResponseBytes: bytes(response) });
  }
  console.log(JSON.stringify({ comparisonCases: cases.length, allComparisonsEqual: true,
    legacyVesselDataSourceBytes: bytes(await repo.getAllVesselSurveyData()), measurements,
    note: 'Service-call timings, not HTTP/browser latency. Legacy source size and page JSON are different diagnostic components, not total wire bytes or heap measurements.' }, null, 2));
} finally { await postgres.pool.end(); }
