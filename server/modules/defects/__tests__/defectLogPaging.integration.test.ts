import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { defects } from '@shared/schema';
import { DEFECT_LOG_BATCH_SIZE, logEligibility, logScanFields, readDefectLog } from '../paging/defectLogReader';
import type { LogMatchOptions } from '../paging/compatibility';

const seam = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../../db', () => ({ getDb: async () => seam.db }));

describe.skipIf(!process.env.DATABASE_URL)('Defect Log actual PostgreSQL paging (rolled-back temporary fixtures)', () => {
  let pool: Pool;
  let client: PoolClient;
  const match = { timeZone: 'Asia/Kolkata', locale: 'en-US', now: '2026-10-29T12:00:00Z' };
  const input = { page: 1, pageSize: 100, match };
  const logs: { query: string; params: unknown[] }[] = [];
  let failScanAfterDetail = false;
  let detailSeen = false;
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    // All DDL and fixture writes roll back. No public defect rows are touched.
    await client.query('CREATE TEMP TABLE defects (LIKE public.defects INCLUDING DEFAULTS) ON COMMIT DROP');
    await client.query('SET LOCAL search_path = pg_temp, public');
    await client.query(`
      INSERT INTO defects (id,duuid,vessel_id,vessel_name,issue_date,category,description,status,reported_by,actions,linked_defects)
      SELECT 'fixture-' || lpad(i::text, 4, '0'), 'uuid-' || lpad(i::text, 4, '0'),
        CASE WHEN i % 2 = 0 THEN 'a' ELSE 'b' END,
        CASE WHEN i % 2 = 0 THEN 'Alpha Vessel' ELSE 'Beta Vessel' END,
        '2026-10-29', 'Defect',
        CASE WHEN i = 237 THEN '<p>Unique &amp; valve</p>' ELSE '<p>Pump</p>' END,
        'Open', 'fixture', '[{"actionDescription":"First action"}]'::json, ARRAY['linked-id']
      FROM generate_series(1,237) AS i
    `);
    const db = drizzle(client, { logger: { logQuery(query, params) {
      logs.push({ query, params });
      if (failScanAfterDetail && detailSeen && !query.includes('attachments')) throw new Error('Fixture middle-batch failure');
      if (query.includes('attachments')) detailSeen = true;
    } } });
    seam.db = { transaction: vi.fn(async (callback: any, config: any) => {
      expect(config).toEqual({ isolationLevel: 'repeatable read', accessMode: 'read only' });
      return callback(db);
    }) };
  }, 30_000);
  afterAll(async () => {
    try { await client?.query('ROLLBACK'); } finally { client?.release(); await pool?.end(); }
  });

  it('reads 100/100/37 unique rows in approved stable same-date order with correct totals', async () => {
    const pages = await Promise.all([1, 2, 3].map(page => readDefectLog({ ...input, page })));
    expect(pages.map(p => p.items.length)).toEqual([100, 100, 37]);
    expect(pages.map(p => p.total)).toEqual([237, 237, 237]);
    expect(pages.map(p => p.totalPages)).toEqual([3, 3, 3]);
    const ids = pages.flatMap(p => p.items.map(r => r.id));
    expect(new Set(ids).size).toBe(237);
    expect(ids[0]).toBe('fixture-0001');
    expect(ids.at(-1)).toBe('fixture-0237');
    expect(pages[0].items[0].actionTakenRequested).toBe('First action');
    expect(pages[0].items[0].linkedDefects).toEqual(['linked-id']);
  });

  it('searches HTML-decoded values across all candidates before paging/count', async () => {
    const result = await readDefectLog({ ...input, match: { ...match, search: 'unique & valve' } });
    expect(result.total).toBe(1);
    expect(result.items.map(r => r.id)).toEqual(['fixture-0237']);
  });

  it('counts vessel intersections before paging and retains ID/name fallback', async () => {
    const a = await readDefectLog({ ...input, vesselIds: ['a'] });
    expect(a.total).toBe(118);
    expect(a.items).toHaveLength(100);
    const none = await readDefectLog({ ...input, vesselId: 'a', match: { ...match, selectedVesselNames: ['b'] } });
    expect(none.total).toBe(0);
    const fallback = await readDefectLog({ ...input, match: { ...match, selectedVessel: 'missing', selectedVesselName: 'alpha vessel' } });
    expect(fallback.total).toBe(118);
  });

  it('clamps empty/final/out-of-range pages and preserves minimum one page', async () => {
    const last = await readDefectLog({ ...input, page: 9999 });
    expect(last.page).toBe(3);
    expect(last.items).toHaveLength(37);
    const empty = await readDefectLog({ ...input, page: 3, match: { ...match, search: 'no-such-defect' } });
    expect(empty).toMatchObject({ items: [], page: 1, total: 0, totalPages: 1 });
  });

  it('exports complete results with the same approved order and explicit export only', async () => {
    const result = await readDefectLog({ ...input, page: 2 }, true);
    expect(result.items).toHaveLength(237);
    expect(result.items.at(-1)?.id).toBe('fixture-0237');
    expect(seam.db.transaction).toHaveBeenCalled();
    expect(logs.filter(q => q.query.includes('select') && q.query.includes('count(')).length).toBeGreaterThan(0);
    expect(logs.filter(q => q.query.includes('limit')).every(q => q.query.includes('order by'))).toBe(true);
  });

  it('builds parameterized scalar-only eligibility; ignored legacy filters stay ignored', () => {
    const compiled = new PgDialect().sqlToQuery(logEligibility({
      ...input, vesselId: "'; DROP TABLE defects; --", match: { ...match, search: 'ignored by SQL' },
    }));
    expect(compiled.sql).not.toContain('DROP TABLE');
    expect(compiled.params).toContainEqual(expect.stringContaining('DROP TABLE'));
    expect(compiled.sql).not.toContain('attachments');
    expect(compiled.sql).not.toContain('target_date_extensions');
    const scan = drizzle(client).select(logScanFields({ ...input, match: { ...match, search: 'valve' } }))
      .from(defects).limit(DEFECT_LOG_BATCH_SIZE).toSQL();
    expect(scan.sql).toContain('json_array_length');
    expect(scan.sql).not.toContain('attachments');
    expect(scan.sql).not.toContain('target_date_extensions');
    expect(scan.sql).not.toContain('defect_log_matches');
  });

  it('matches real database pages against an independent browser oracle for HTML/date/Unicode semantics', async () => {
    const dateValues = [
      '2026-03-08', '08-03-2026', '2026-02-31', '0099-03-08', 'invalid', '',
      'March 8, 2026 23:30 -5', 'March 8, 2026 GMT 23:30',
      '2026-03-08T00:00:00Z', '2026-03-08T02:30:00', '2026-11-01T01:30:00',
    ];
    const rows = Array.from({ length: 237 }, (_, i) => {
      const date = dateValues[i % dateValues.length];
      return {
      id: `parity-${i}`, duuid: `parity-${String(i).padStart(4, '0')}`, vesselId: 'a', vesselName: 'Alpha Vessel', issueDate: date,
      targetCloseDate: date, dateCompleted: i % 3 ? '' : date,
      category: 'Defect', description: '<template>hidden</template><p>İ ΟΣ &amp; &#x1F6A2; 50% _literal_ C:\\pump</p>',
      priority: 'High', isDeferred: i % 2 === 0, verified: i % 4 === 0, actions: [{ actionDescription: 'First action' }],
    }; });
    const scenarios = [
      { search: 'İ' }, { search: 'ΟΣ & 🚢' }, { search: 'hidden' }, { search: '50%' },
      { search: '_literal_' }, { search: 'C:\\pump' }, { search: "'; DROP TABLE defects; --" },
      { search: 'Verified' }, { search: 'Closed' }, { search: 'Overdue' },
      { search: '09 Mar 2026' }, { dueOverdue: 'due1month' }, { dueOverdue: 'due2months' },
      { periodValue: { mode: 'yearQuarterMonth', year: 2026, month: 2 } },
    ];
    const bundle = (await build({
      entryPoints: ['server/modules/defects/__tests__/fixtures/legacyDefectLog.ts'],
      bundle: true, write: false, format: 'iife', globalName: 'LegacyLog', platform: 'browser',
      alias: { '@': `${process.cwd()}/client/src`, '@shared': `${process.cwd()}/shared` },
    })).outputFiles[0].text;
    const browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', args: ['--no-sandbox'], headless: true });
    await client.query('SAVEPOINT parity_fixture');
    try {
      await client.query('DELETE FROM defects');
      await client.query(`INSERT INTO defects(id,duuid,vessel_id,vessel_name,issue_date,target_close_date,date_completed,
          category,description,priority,is_deferred,verified,actions,status,reported_by)
          SELECT id,duuid,"vesselId","vesselName","issueDate","targetCloseDate","dateCompleted",
            category,description,priority,"isDeferred",verified,actions::json,'Open','fixture'
          FROM jsonb_to_recordset($1::jsonb) AS r(id text,duuid text,"vesselId" text,"vesselName" text,
            "issueDate" text,"targetCloseDate" text,"dateCompleted" text,category text,description text,
            priority text,"isDeferred" boolean,verified boolean,actions jsonb)`, [JSON.stringify(rows)]);
      const ordered = (await client.query('SELECT duuid FROM defects ORDER BY issue_date DESC,duuid ASC')).rows.map(r => r.duuid);
      const orderedRows = ordered.map(id => rows.find(r => r.duuid === id)!);
      for (const timeZone of ['UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Auckland', 'Europe/Istanbul']) {
        const context = await browser.newContext({ timezoneId: timeZone, locale: timeZone === 'Europe/Istanbul' ? 'tr-TR' : 'en-US' });
        const page = await context.newPage();
        await page.addScriptTag({ content: bundle });
        await page.clock.install({ time: new Date('2026-03-08T12:00:00Z') });
        try {
      for (const scenario of scenarios) {
        const options = { timeZone, locale: timeZone === 'Europe/Istanbul' ? 'tr-TR' : 'en-US', now: '2026-03-08T12:00:00Z', ...scenario } as LogMatchOptions;
        const expected = await page.evaluate(({ rows, options }) =>
          (window as any).LegacyLog.legacyFilter(rows, options).map((r: any) => r.duuid), { rows: orderedRows, options });
        const actual = await readDefectLog({ ...input, page: 999, match: options });
        const lastPage = Math.max(1, Math.ceil(expected.length / input.pageSize));
        expect(actual.total, JSON.stringify(options)).toBe(expected.length);
        expect(actual.page).toBe(lastPage);
        expect(actual.items.map(r => r.duuid), JSON.stringify(options)).toEqual(expected.slice((lastPage - 1) * input.pageSize));
      }
        } finally { await context.close(); }
      }
    } finally {
      await browser.close();
      await client.query('ROLLBACK TO SAVEPOINT parity_fixture');
    }
  }, 60_000);

  it('keeps raw active eligibility and the composed backend overdue exclusions', async () => {
    await client.query('SAVEPOINT status_fixture');
    try {
      const day = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
      await client.query("UPDATE defects SET target_close_date=$1,verified=true", [day]);
      await client.query("UPDATE defects SET verified=false WHERE id IN ('fixture-0001','fixture-0002','fixture-0003')");
      await client.query("UPDATE defects SET status='Closed' WHERE id='fixture-0002'");
      await client.query("UPDATE defects SET date_completed='invalid' WHERE id='fixture-0003'");
      const result = await readDefectLog({
        ...input, match: { ...match, now: new Date().toISOString(), dueOverdue: 'overdue' },
      });
      expect(result.items.map(row => row.id)).toEqual(['fixture-0001']);
      expect(result.total).toBe(1);
      const active = await readDefectLog(input);
      expect(active.total).toBe(236); // Verified raw-Open rows remain eligible.
    } finally { await client.query('ROLLBACK TO SAVEPOINT status_fixture'); }
  });

  it('reads multiple export batches, with no cap and no unbounded ordinary detail select', async () => {
    await client.query('SAVEPOINT export_fixture');
    try {
      await client.query(`
        INSERT INTO defects (id,duuid,vessel_id,vessel_name,issue_date,category,description,status,reported_by)
        SELECT 'bulk-'||i, 'bulk-uuid-'||i, 'a', 'Alpha Vessel', '2026-10-29',
          'Defect', 'Bulk export fixture', 'Open', 'fixture' FROM generate_series(1,1001) AS i
      `);
      const before = logs.length;
      const ordinary = await readDefectLog(input);
      expect(ordinary.total).toBe(1238);
      expect(ordinary.items).toHaveLength(100);
      expect(logs.slice(before).filter(q => q.query.includes('select'))).toHaveLength(2);
      expect(logs.at(-1)?.query).toContain('inner join (select "duuid"');
      expect(logs.at(-1)?.query).toContain('limit');
      const scanStart = logs.length;
      const filtered = await readDefectLog({ ...input, page: 999, match: { ...match, search: 'fixture' } });
      expect(filtered.total).toBe(1238);
      expect(filtered.page).toBe(13);
      expect(filtered.items).toHaveLength(38);
      const scanned = logs.slice(scanStart);
      expect(scanned.filter(q => q.query.includes('attachments'))).toHaveLength(1);
      expect(scanned.every(q => q.query.includes('limit'))).toBe(true);
      expect(scanned.filter(q => !q.query.includes('attachments')).every(q => q.params.at(-1) === DEFECT_LOG_BATCH_SIZE)).toBe(true);
      expect(scanned.every(q => !q.query.includes('offset'))).toBe(true);
      const started = performance.now();
      const exported = await readDefectLog({ ...input, match: { ...match, search: 'fixture' } }, true);
      expect(exported.items).toHaveLength(1238);
      expect(new Set(exported.items.map(row => row.duuid)).size).toBe(1238);
      console.info('Defect export profile', JSON.stringify({ rows: exported.total,
        elapsedMs: Math.round(performance.now() - started), bytes: Buffer.byteLength(JSON.stringify(exported)),
        heapUsedBytes: process.memoryUsage().heapUsed }));
      detailSeen = false;
      failScanAfterDetail = true;
      try {
        await expect(readDefectLog({ ...input, match: { ...match, search: 'fixture' } }, true))
          .rejects.toThrow();
        expect(detailSeen).toBe(true); // Failure occurs after a hydrated export batch, never a partial response.
      } finally { failScanAfterDetail = false; }
    } finally { await client.query('ROLLBACK TO SAVEPOINT export_fixture'); }
  });

  it('covers keyset date/ID/null boundaries and keeps hydration bounded on a larger fixture', async () => {
    await client.query('SAVEPOINT cursor_fixture');
    try {
      await client.query('DELETE FROM defects');
      await client.query('ALTER TABLE defects ALTER COLUMN issue_date DROP NOT NULL');
      await client.query(`
        INSERT INTO defects(id,duuid,vessel_id,vessel_name,issue_date,description,status,reported_by)
        SELECT 'cursor-'||i, 'cursor-'||lpad(i::text,6,'0'),'a','Alpha Vessel',
          CASE WHEN i<=750 THEN NULL WHEN i%3=0 THEN '' WHEN i%2=0 THEN '2026-10-29' ELSE '2025-01-01' END,
          'cursor-boundary','Open','fixture' FROM generate_series(1,5001) AS i
      `);
      const expected = (await client.query('SELECT duuid FROM defects ORDER BY issue_date DESC,duuid ASC')).rows.map(r => r.duuid);
      for (const page of [1,2,8,51,9999]) {
        const before = logs.length;
        const started = performance.now();
        const result = await readDefectLog({ ...input, page, match: { ...match, search: 'cursor-boundary' } });
        expect(result.total).toBe(5001);
        expect(result.items.map(r => r.duuid)).toEqual(expected.slice((result.page-1)*100,result.page*100));
        const queries = logs.slice(before);
        expect(queries.filter(q => q.query.includes('attachments'))).toHaveLength(1);
        expect(queries.every(q => q.query.includes('limit') && !q.query.includes('offset'))).toBe(true);
        console.info('Defect page profile', JSON.stringify({ candidates: 5001, page: result.page,
          rows: result.items.length, queries: queries.length, elapsedMs: Math.round(performance.now()-started),
          responseBytes: Buffer.byteLength(JSON.stringify(result)) }));
      }
      const full = await readDefectLog({ ...input, match: { ...match, search: 'cursor-boundary' } }, true);
      expect(full.items.map(r => r.duuid)).toEqual(expected);
      const plan = await client.query(`EXPLAIN (FORMAT JSON)
        SELECT duuid,issue_date,description FROM defects WHERE status='Open'
        ORDER BY issue_date DESC,duuid ASC LIMIT 500`);
      expect(JSON.stringify(plan.rows)).toContain('Limit');
      console.info('Defect fixture scan plan', JSON.stringify(plan.rows));
    } finally { await client.query('ROLLBACK TO SAVEPOINT cursor_fixture'); }
  }, 30_000);

  it('never invokes an obsolete helper or enables an extension and retires its migration/generator', async () => {
    expect(logs.every(q => !/defect_log_matches|CREATE EXTENSION|LANGUAGE plv8/i.test(q.query))).toBe(true);
    await expect(fs.access('migrations/187_defect_log_matching.sql')).rejects.toThrow();
    await expect(fs.access('scripts/generate-defect-log-helper.mjs')).rejects.toThrow();
  });

  it('stops an already-cancelled request before opening a transaction', async () => {
    const cancellation = new AbortController();
    cancellation.abort();
    const before = logs.length;
    await expect(readDefectLog({ ...input, signal: cancellation.signal })).rejects.toThrow();
    expect(logs.length).toBe(before);
  });

  it('omits retired migration 187 on fresh discovery and preserves its historical upgrade entry', async () => {
    await client.query('SAVEPOINT migration_history_fixture');
    try {
      await client.query(`CREATE TEMP TABLE schema_migrations (
        id text PRIMARY KEY, name text NOT NULL, description text, applied_at timestamp DEFAULT now()
      ) ON COMMIT DROP`);
      const { getPendingMigrations } = await import('../../../migrations');
      const scopedPool = { query: client.query.bind(client) } as unknown as Pool;
      const fresh = await getPendingMigrations(scopedPool);
      expect(fresh).not.toContain('187_defect_log_matching');
      await client.query(`INSERT INTO schema_migrations(id,name) VALUES('187_defect_log_matching','Historical installation')`);
      const upgrade = await getPendingMigrations(scopedPool);
      expect(upgrade).toEqual(fresh);
      expect((await client.query(`SELECT count(*)::int AS count FROM schema_migrations WHERE id='187_defect_log_matching'`)).rows[0].count).toBe(1);
    } finally { await client.query('ROLLBACK TO SAVEPOINT migration_history_fixture'); }
  }, 45_000);
});
