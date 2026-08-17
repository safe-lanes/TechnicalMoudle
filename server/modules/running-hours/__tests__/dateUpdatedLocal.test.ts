/**
 * Task #424 — Fix RH module crash on "Sept" dates.
 *
 * 1. formatLocalDateTimeDDMMMYYYY always emits 3-letter months ("Sep", never
 *    "Sept") and is byte-identical to the legacy en-GB output for other months.
 * 2. The hardened SQL parse of running_hours_audit.date_updated_local:
 *    - "Sept" rows normalize and parse to the correct date,
 *    - garbage strings yield NULL (excluded) instead of raising 22007,
 *    - valid ISO and DD-Mon-YYYY rows select the same winning reading as before.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { formatLocalDateTimeDDMMMYYYY } from '@shared/dateUtils';

describe('formatLocalDateTimeDDMMMYYYY', () => {
  it('emits "Sep" (3 letters) for September, never "Sept"', () => {
    const s = formatLocalDateTimeDDMMMYYYY(new Date(2025, 8, 15, 10, 30));
    expect(s).toBe('15 Sep 2025 10:30');
    expect(s).not.toContain('Sept');
  });

  it('matches the legacy en-GB shape for all 12 months', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 0; m < 12; m++) {
      const s = formatLocalDateTimeDDMMMYYYY(new Date(2025, m, 5, 23, 59));
      expect(s).toBe(`05 ${months[m]} 2025 23:59`);
    }
  });

  it('zero-pads day, hour and minute', () => {
    expect(formatLocalDateTimeDDMMMYYYY(new Date(2026, 0, 1, 0, 5))).toBe('01 Jan 2026 00:05');
  });
});

const hasDb = !!process.env.DATABASE_URL;

describe.runIf(hasDb)('date_updated_local SQL parse hardening', () => {
  let db: any;
  let getRunningHoursAtDateBatch: any;
  const vuuid = randomUUID();
  const vesselId = `TEST-${vuuid.slice(0, 8)}`;
  const cuuidSept = randomUUID();
  const cuuidGarbage = randomUUID();
  const cuuidMixed = randomUUID();
  const allCuuids = [cuuidSept, cuuidGarbage, cuuidMixed];
  let schema: any;

  const insertAudit = async (componentId: string, dateLocal: string, cumulative: string, enteredAt: Date) => {
    await db.insert(schema.runningHoursAudit).values({
      vesselId: vuuid,
      componentId,
      previousRH: '0',
      newRH: cumulative,
      cumulativeRH: cumulative,
      dateUpdatedLocal: dateLocal,
      dateUpdatedTZ: 'UTC',
      enteredAtUTC: enteredAt,
      userId: 'test-user',
      source: 'single',
    });
  };

  beforeAll(async () => {
    const dbMod = await import('../../../db');
    db = await dbMod.getDb();
    schema = await import('@shared/schema');
    ({ getRunningHoursAtDateBatch } = await import('../repositories/runningHoursRepository'));

    // Ensure the safe-parse SQL function exists even if the server (which runs
    // migrations on boot) hasn't started against this database yet. Idempotent.
    const fs = await import('fs');
    const { sql: rawSql } = await import('drizzle-orm');
    const migrationSql = fs.readFileSync('migrations/166_safe_rh_date_parse.sql', 'utf-8');
    await db.execute(rawSql.raw(migrationSql));

    await db.insert(schema.vessels).values({
      id: vesselId, vuuid, name: 'Test Vessel Sept', code: vesselId,
    });
    for (const cuuid of allCuuids) {
      await db.insert(schema.components).values({
        id: cuuid, cuuid, vesselId: vuuid, name: `Test Comp ${cuuid.slice(0, 6)}`,
      } as any);
    }

    // "Sept" row — legacy en-GB browser output, previously crashed the batch.
    await insertAudit(cuuidSept, '15 Sept 2025 10:30', '100', new Date('2025-09-15T10:30:00Z'));
    // Garbage / shape-passing-but-invalid rows + a valid later row on the same
    // component. The middle three pass naive prefix/shape regexes but are
    // unparseable — they must yield NULL, not raise 22007/22008.
    await insertAudit(cuuidGarbage, 'not-a-date-at-all', '50', new Date('2025-08-01T00:00:00Z'));
    await insertAudit(cuuidGarbage, '15 Sept 2025 99:99', '60', new Date('2025-08-02T00:00:00Z'));
    await insertAudit(cuuidGarbage, '2025-13-40', '65', new Date('2025-08-03T00:00:00Z'));
    await insertAudit(cuuidGarbage, '31 Feb 2025 10:00', '70', new Date('2025-08-04T00:00:00Z'));
    await insertAudit(cuuidGarbage, '10 Aug 2025 12:00', '75', new Date('2025-08-10T12:00:00Z'));
    // Mixed ISO + DD-Mon-YYYY rows: latest-at-or-before must win identically.
    await insertAudit(cuuidMixed, '2025-06-01', '200', new Date('2025-06-01T00:00:00Z'));
    await insertAudit(cuuidMixed, '20 Jun 2025 08:00', '250', new Date('2025-06-20T08:00:00Z'));
    await insertAudit(cuuidMixed, '2025-07-05', '300', new Date('2025-07-05T00:00:00Z'));
  });

  afterAll(async () => {
    if (!db) return;
    const { inArray, eq } = await import('drizzle-orm');
    await db.delete(schema.runningHoursAudit).where(inArray(schema.runningHoursAudit.componentId, allCuuids));
    await db.delete(schema.components).where(inArray(schema.components.cuuid, allCuuids));
    await db.delete(schema.vessels).where(eq(schema.vessels.vuuid, vuuid));
  });

  it('parses a "Sept" audit row to the correct date instead of crashing', async () => {
    const res = await getRunningHoursAtDateBatch(
      [{ id: cuuidSept, cuuid: cuuidSept }],
      new Date('2025-09-30T23:59:59Z')
    );
    const hit = res.get(cuuidSept);
    expect(hit).toBeDefined();
    expect(hit.runningHours).toBe(100);
    expect(hit.isFallback).toBe(false);
  });

  it('"Sept" row is NOT matched before its date (parsed as real Sep 15, not skipped)', async () => {
    const res = await getRunningHoursAtDateBatch(
      [{ id: cuuidSept, cuuid: cuuidSept }],
      new Date('2025-09-01T00:00:00Z')
    );
    // Only entry is after target → fallback branch must find it.
    const hit = res.get(cuuidSept);
    expect(hit).toBeDefined();
    expect(hit.isFallback).toBe(true);
  });

  it('shape-passing but invalid values (99:99 time, month 13, Feb 31) parse to NULL, not an error', async () => {
    const { sql: rawSql } = await import('drizzle-orm');
    const rows = await db.execute(rawSql`
      SELECT v, safe_parse_rh_date_local(v) AS parsed FROM (VALUES
        ('15 Sept 2025 99:99'), ('2025-13-40'), ('31 Feb 2025 10:00'),
        ('not-a-date-at-all'), (''), ('2025-09-15T10:30:00Z-junk-extra')
      ) AS t(v)`);
    for (const row of rows.rows ?? rows) {
      if (String(row.v).startsWith('2025-09-15')) continue; // valid ISO prefix, parses
      expect(row.parsed).toBeNull();
    }
    const ok = await db.execute(rawSql`
      SELECT safe_parse_rh_date_local('15 Sept 2025 10:30') AS a,
             safe_parse_rh_date_local('15 Sep 2025 10:30') AS b,
             safe_parse_rh_date_local('2025-09-15') AS c`);
    const r = (ok.rows ?? ok)[0];
    expect(r.a).not.toBeNull();
    expect(new Date(r.a).getTime()).toBe(new Date(r.b).getTime());
    expect(r.c).not.toBeNull();
  });

  it('a garbage date string no longer crashes; valid sibling row still wins', async () => {
    const res = await getRunningHoursAtDateBatch(
      [{ id: cuuidGarbage, cuuid: cuuidGarbage }],
      new Date('2025-08-31T23:59:59Z')
    );
    const hit = res.get(cuuidGarbage);
    expect(hit).toBeDefined();
    expect(hit.runningHours).toBe(75); // garbage row excluded, valid row selected
  });

  it('a batch mixing Sept, garbage and valid rows resolves every component (module loads)', async () => {
    const res = await getRunningHoursAtDateBatch(
      allCuuids.map((c) => ({ id: c, cuuid: c })),
      new Date('2025-12-31T00:00:00Z')
    );
    expect(res.get(cuuidSept)?.runningHours).toBe(100);
    expect(res.get(cuuidGarbage)?.runningHours).toBe(75);
    expect(res.get(cuuidMixed)?.runningHours).toBe(300);
  });

  it('ISO and DD-Mon-YYYY rows select the same winning reading as before (regression)', async () => {
    // At 2025-06-30: winner must be the 20-Jun DD-Mon-YYYY row (250), beating the 01-Jun ISO row.
    const res1 = await getRunningHoursAtDateBatch(
      [{ id: cuuidMixed, cuuid: cuuidMixed }], new Date('2025-06-30T23:59:59Z'));
    expect(res1.get(cuuidMixed)?.runningHours).toBe(250);
    // At 2025-06-10: winner must be the 01-Jun ISO row (200).
    const res2 = await getRunningHoursAtDateBatch(
      [{ id: cuuidMixed, cuuid: cuuidMixed }], new Date('2025-06-10T00:00:00Z'));
    expect(res2.get(cuuidMixed)?.runningHours).toBe(200);
    // At 2025-05-01 (before all): fallback = earliest after target = 01-Jun ISO row.
    const res3 = await getRunningHoursAtDateBatch(
      [{ id: cuuidMixed, cuuid: cuuidMixed }], new Date('2025-05-01T00:00:00Z'));
    expect(res3.get(cuuidMixed)?.runningHours).toBe(200);
    expect(res3.get(cuuidMixed)?.isFallback).toBe(true);
  });

  it('legacy getRunningHoursAtDate (postgresStorage) also tolerates Sept/garbage rows', async () => {
    const { postgresStorage } = await import('../../../postgresStorage');
    const storage = postgresStorage;
    const hit = await storage.getRunningHoursAtDate(cuuidSept, new Date('2025-09-30T23:59:59Z'));
    expect(hit?.runningHours).toBe(100);
    const g = await storage.getRunningHoursAtDate(cuuidGarbage, new Date('2025-08-31T23:59:59Z'));
    expect(g?.runningHours).toBe(75);
  });
});
