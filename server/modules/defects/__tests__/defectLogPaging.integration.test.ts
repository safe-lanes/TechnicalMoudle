import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { logEligibility, readDefectLog } from '../paging/defectLogReader';
import { matchesDefectLog, type LogMatchOptions } from '../paging/compatibility';

const seam = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../../db', () => ({ getDb: async () => seam.db }));

describe.skipIf(!process.env.DATABASE_URL)('Defect Log actual PostgreSQL paging (rolled-back temporary fixtures)', () => {
  let pool: Pool;
  let client: PoolClient;
  const match = { timeZone: 'Asia/Kolkata', locale: 'en-US', now: '2026-10-29T12:00:00Z' };
  const input = { page: 1, pageSize: 100, match };
  const logs: string[] = [];
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    // All DDL and fixture writes roll back. No public defect rows are touched.
    const migration = await fs.readFile('migrations/187_defect_log_matching.sql', 'utf8');
    await client.query(migration.replaceAll('--> statement-breakpoint', ''));
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
    const db = drizzle(client, { logger: { logQuery(query) { logs.push(query); } } });
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
    expect(logs.filter(q => q.includes('select') && q.includes('count(')).length).toBeGreaterThan(0);
    expect(logs.filter(q => q.includes('limit')).every(q => q.includes('order by'))).toBe(true);
  });

  it('builds parameterized scalar-only eligibility; ignored legacy filters stay ignored', () => {
    const compiled = new PgDialect().sqlToQuery(logEligibility({
      ...input, match: { ...match, search: "'; DROP TABLE defects; --" },
    }));
    expect(compiled.sql).not.toContain('DROP TABLE');
    expect(compiled.params).toContainEqual(expect.stringContaining('DROP TABLE'));
    expect(compiled.sql).not.toContain('attachments');
    expect(compiled.sql).not.toContain('target_date_extensions');
    expect(compiled.sql).toContain('json_array_length');
  });

  it('runs the bundled helper inside PostgreSQL with the tested HTML/date/Unicode semantics', async () => {
    const dateValues = [
      '2026-03-08', '08-03-2026', '2026-02-31', '0099-03-08', 'invalid', '',
      'March 8, 2026 23:30 -5', 'March 8, 2026 GMT 23:30',
      '2026-03-08T00:00:00Z', '2026-03-08T02:30:00', '2026-11-01T01:30:00',
    ];
    const rows = dateValues.map((date, i) => ({
      id: String(i), vesselId: 'a', vesselName: 'Alpha Vessel', issueDate: date,
      targetCloseDate: date, dateCompleted: i % 3 ? '' : date,
      category: 'Defect', description: '<template>hidden</template><p>İ Σ &amp; &#x1F6A2;</p>',
      priority: 'High', isDeferred: i % 2 === 0, verified: i % 4 === 0, hasActions: true,
    }));
    const scenarios = [
      { search: 'İ' }, { search: 'Σ & 🚢' }, { search: 'hidden' },
      { search: 'Verified' }, { search: 'Closed' }, { search: 'Overdue' },
      { search: '09 Mar 2026' }, { dueOverdue: 'overdue' }, { dueOverdue: 'due1month' },
      { periodValue: { mode: 'yearQuarterMonth', year: 2026, month: 2 } },
    ];
    for (const timeZone of ['UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Auckland']) {
      for (const scenario of scenarios) {
        const options = { timeZone, locale: 'en-US', now: '2026-03-08T12:00:00Z', ...scenario } as LogMatchOptions;
        const actual = await client.query(
          'SELECT public.defect_log_matches_v1(value, $2::jsonb) AS matches FROM jsonb_array_elements($1::jsonb)',
          [JSON.stringify(rows), JSON.stringify(options)],
        );
        expect(actual.rows.map(r => r.matches), JSON.stringify(options))
          .toEqual(rows.map(row => matchesDefectLog(row, options)));
      }
    }
  });

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
      expect(logs.slice(before).filter(q => q.includes('select'))).toHaveLength(2);
      expect(logs.at(-1)).toContain('inner join (select "duuid"');
      expect(logs.at(-1)).toContain('limit');
      const exported = await readDefectLog(input, true);
      expect(exported.items).toHaveLength(1238);
      expect(new Set(exported.items.map(row => row.duuid)).size).toBe(1238);
    } finally { await client.query('ROLLBACK TO SAVEPOINT export_fixture'); }
  });
});
