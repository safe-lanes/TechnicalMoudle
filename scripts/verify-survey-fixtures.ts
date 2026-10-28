/**
 * PostgreSQL parity fixtures. Only connection-local temporary tables are written;
 * no public business records are changed. Disconnect removes the fixtures.
 * Run: node --import tsx scripts/verify-survey-fixtures.ts
 */
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { resolvePostgres } from '../server/postgresClient';
import * as schema from '../shared/schema';
import * as repo from '../server/modules/cert-surveys/repositories/surveyRepository';
import { querySurveyPage, type SurveyPagingFilters } from '../server/modules/cert-surveys/repositories/surveyPagingRepository';
import { getLegacySurveys } from '../server/modules/cert-surveys/__tests__/fixtures/legacySurveyList';
import { surveyClientFunction } from '../server/modules/cert-surveys/__tests__/fixtures/surveyClientFunctions';

const postgres = await resolvePostgres();
if (!postgres) throw new Error('Development database unavailable');
const client = await postgres.pool.connect();
try {
  const tables = ['ship_surveys_master', 'vessel_survey_applicability', 'vessel_survey_data'] as const;
  for (const table of tables) {
    await client.query(`CREATE TEMP TABLE ${table} AS SELECT * FROM public.${table} WITH NO DATA`);
  }
  async function insert(table: typeof tables[number], rows: Record<string, unknown>[]) {
    const snake = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value])));
    await client.query(`INSERT INTO pg_temp.${table}
      SELECT * FROM jsonb_populate_recordset(NULL::pg_temp.${table}, $1::jsonb)`, [JSON.stringify(snake)]);
  }
  const names = ['\u00a0 VESSEL 2\ufeff', 'ΟΣ', 'İSTANBUL 10', 'Vessel 10', 'Vessel 02', 'vessel 2'];
  const text = ['Alpha 2', 'alpha 10', 'ALPHA 02', 'alpha 0002', 'Éngine', 'engine', 'e\u0301ngine',
    'Æther', 'Aether', 'Straße', 'strasse', 'Vessel 10', 'Vessel 2', '', '01 Jan 2027', '2026-10-01',
    'A-2', 'A 2', 'A_2', '😀', '🚢', 'İ', 'i', 'I', 'ı', 'ΟΣ', 'ος', 'οσ', 'é', 'e\u0301',
    'a\u00adb', 'ab', 'x\u200by', 'xy', '❤', '❤️', 'か', 'が', 'か\u3099', '한', '한'];
  const masters = Array.from({ length: 122 }, (_, i) => ({
    id: i + 1, masterId: `master-${i}`, companyId: i % 5 ? text[i % text.length] : '',
    surveyName: text[i % text.length], surveyLabel: i % 3 ? '' : text[(i + 3) % text.length],
    companyGroup: i % 2 ? text[(i + 7) % text.length] : '', companySequence: i % 7 ? i % 9 : null,
    sequence: i % 11, isActive: i < 121, isDeleted: i === 120 ? true : i % 4 ? false : null,
  }));
  const apps = names.flatMap((vesselName, v) => masters.map((master, i) => ({
    id: v * masters.length + i + 1, vesselId: `v${v}`, vesselName, masterId: master.masterId,
    isApplicable: i % 19 !== 18, isDeleted: i % 17 === 16 ? true : i % 3 ? false : null,
  })));
  const data = apps.filter((_, i) => i % 3 === 0).map((app, i) => ({
    id: i + 1, vesselId: app.vesselId, vesselName: app.vesselName, masterId: app.masterId,
    surveyDate: i % 2 ? text[i % text.length] : null, dueDate: text[(i + 2) % text.length],
    firstRangeDate: text[(i + 3) % text.length], secondRangeDate: text[(i + 4) % text.length],
    postponed: text[(i + 5) % text.length], lastEditUpload: text[(i + 6) % text.length],
    isDeleted: i % 13 === 12 ? true : i % 3 ? false : null,
    attachments: [{ id: `fixture-${i}`, name: 'fixture.pdf', type: 'application/pdf',
      size: 2, data: 'data:application/pdf;base64,SGk=' }],
  }));
  await insert(tables[0], [...masters,
    { ...masters[1], id: 1000, masterId: 'b-c' }, { ...masters[1], id: 1001, masterId: 'c' }]);
  await insert(tables[1], [...apps,
    { ...apps[1], id: 1000, vesselId: 'a', masterId: 'b-c' },
    { ...apps[1], id: 1001, vesselId: 'a-b', masterId: 'c' },
    { ...apps[2], id: 1002 }, // duplicate applicability must retain row multiplicity
    { ...apps[1], id: 1003, masterId: 'missing-master' },
  ]);
  await insert(tables[2], [...data,
    { ...data[0], id: 999, dueDate: 'last duplicate', attachments: [], isDeleted: true },
    { ...data[1], id: 1000, vesselId: 'a', masterId: 'b-c' },
    { ...data[1], id: 1001, vesselId: 'a-b', masterId: 'c', dueDate: 'last colliding key', isDeleted: true },
  ]);
  const db = drizzle(client, { schema });
  assert.equal((await db.select().from(schema.shipSurveysMaster)).length, masters.length + 2,
    'Drizzle must resolve temp fixtures, not public data');
  let comparisons = 0, browserComparisons = 0;
  await db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const readRepo = {
      getApplicableSurveys: () => repo.getApplicableSurveys(tx),
      getMasterSurveysByIds: (ids: string[]) => repo.getMasterSurveysByIds(ids, tx),
      getAllVesselSurveyData: () => repo.getAllVesselSurveyData(tx),
    };
    const scopes: SurveyPagingFilters[] = [
      {}, { vesselId: 'v1' }, { vesselId: 'all', vesselIds: ['v2', 'v0'] },
      { vesselId: 'v0', vesselName: 'ignored' }, { vesselId: 'all', vesselIds: [] },
      { vesselId: 'all', vesselIds: [], vesselName: 'ΟΣ' }, { vesselIds: ['v1'] },
      { vesselName: ' vessel 2 ' }, { vesselName: 'ΟΣ' }, { vesselName: 'İSTANBUL 10' },
      { vesselNames: 'ΟΣ, vessel 2' }, { vesselId: 'missing' }, { vesselId: 'a' },
    ];
    const sorts = [{}, { sortOrder: 'desc' },
      ...['id', 'companyId', 'surveyName', 'name', 'vessel', 'type', 'companyGroup', 'surveyDate', 'dueDate',
        'companySequence', 'firstRangeDate', 'postponed', 'lastEdit', '__proto__', 'unknown']
        .flatMap(sortBy => ['asc', 'desc'].map(sortOrder => ({ sortBy, sortOrder })))];
    for (const scope of scopes) for (const sort of sorts) for (const page of [1, 2, 3, 8, -1]) {
      const filters = { ...scope, ...sort, page };
      assert.deepEqual(await querySurveyPage(tx, filters), await getLegacySurveys(filters, readRepo),
        `Fixture parity: ${JSON.stringify(filters)}`);
      comparisons++;
    }
    for (const filters of [{ page: 0, limit: 0 }, { page: 1, limit: -2 }, { page: -1, limit: -2 },
      { page: 1, limit: 100000 }, { page: 2, limit: 1 }]) {
      assert.deepEqual(await querySurveyPage(tx, filters), await getLegacySurveys(filters, readRepo));
      comparisons++;
    }
    // Run unchanged browser filter/export selection on actual SQL and legacy rows.
    for (const dueInFilter of ['all', 'overdue', '1month', '2months', '3months']) {
      const current = await querySurveyPage(tx, {}), previous = await getLegacySurveys({}, readRepo);
      const filter = (surveys: unknown) => surveyClientFunction('filter', {
        surveys, selectedVesselNames: [], dueInFilter,
      })();
      assert.deepEqual(filter(current.surveys), filter(previous.surveys));
      const exportRows = async (read: (f: SurveyPagingFilters) => Promise<unknown>) =>
        surveyClientFunction('export', {
          dueInFilter, selectedVesselNames: ['ΟΣ', 'Vessel 10'],
          fetch: async (url: string) => {
            const p = new URL(url, 'http://test').searchParams;
            return { ok: true, json: () => read({ page: Number(p.get('page')), limit: Number(p.get('limit')),
              vesselNames: p.get('vesselNames') || undefined }) };
          },
        })();
      assert.deepEqual(await exportRows(f => querySurveyPage(tx, f)),
        await exportRows(f => getLegacySurveys(f, readRepo)));
      browserComparisons += 2;
    }
    // Validate ICU equivalences themselves, not just sorted fixture page positions.
    const pairs = await client.query(`WITH vals AS (
      SELECT value,ordinality::int AS id FROM unnest($1::text[]) WITH ORDINALITY AS t(value,ordinality)
    ) SELECT a.id AS a,b.id AS b,CASE
      WHEN a.value COLLATE public.surveys_default_en_us < b.value COLLATE public.surveys_default_en_us THEN -1
      WHEN a.value COLLATE public.surveys_default_en_us > b.value COLLATE public.surveys_default_en_us THEN 1
      ELSE 0 END AS comparison FROM vals a CROSS JOIN vals b`, [text]);
    for (const r of pairs.rows) assert.equal(r.comparison, Math.sign(text[r.a - 1].localeCompare(text[r.b - 1])));
  });
  await client.query('UPDATE pg_temp.ship_surveys_master SET is_active = false');
  for (const limit of [100, -2]) {
    const readRepo = {
      getApplicableSurveys: () => repo.getApplicableSurveys(db),
      getMasterSurveysByIds: (ids: string[]) => repo.getMasterSurveysByIds(ids, db),
      getAllVesselSurveyData: () => repo.getAllVesselSurveyData(db),
    };
    assert.deepEqual(await querySurveyPage(db, { limit }), await getLegacySurveys({ limit }, readRepo));
    comparisons++;
  }
  console.log(JSON.stringify({ fixtureComparisons: comparisons, browserComparisons,
    collationPairs: text.length ** 2, allEqual: true, publicDataWrites: 0 }));
} finally {
  client.release();
  await postgres.pool.end();
}
