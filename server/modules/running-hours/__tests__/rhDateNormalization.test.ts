/**
 * Task #427 — RH date-format poisoning regression suite (DB-gated).
 *
 * Covers:
 *  - JS ↔ SQL calendar-day parser parity (safe_rh_reading_day vs parseReadingDayStrict),
 *    including across Postgres session timezones.
 *  - Migration 167 normalization: converts, is idempotent, preserves originals in the
 *    backup table, leaves unparseable rows untouched.
 *  - Winner selection: a backdated legacy-format row can never outrank a newer ISO
 *    reading purely because of its text format; malformed rows neither win nor crash.
 *  - Self-heal: heals a stale MASTER and is a strict no-op on second run.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { canonicalReadingDay } from '../utils/readingDate';

// Safety guard: this suite writes fixture rows to the database (and runs the
// vessel-SCOPED self-heal on its own fixture vessel only). It must never run
// against a shared/staging/production database by accident, so DATABASE_URL
// alone is not enough — an explicit opt-in is required.
const hasDb = !!process.env.DATABASE_URL && process.env.RH_DB_TESTS === '1';

describe.runIf(hasDb)('Task #427 — RH date normalization & winner hardening', () => {
  let db: any;
  let pool: any;
  let schema: any;
  let rawSql: any;
  const vuuid = randomUUID();
  const vesselId = `T427-${vuuid.slice(0, 8)}`;
  const cuuidMaster = randomUUID();
  const cuuidChild = randomUUID();
  const cuuidNorm = randomUUID();
  const allCuuids = [cuuidMaster, cuuidChild, cuuidNorm];

  const migrationSqlPath = 'migrations/167_rh_date_normalization.sql';
  const runMigration = async () => {
    const fs = await import('fs');
    await db.execute(rawSql.raw(fs.readFileSync(migrationSqlPath, 'utf-8')));
  };

  const insertAudit = async (componentId: string, dateLocal: string, cumulative: string, enteredAt: Date, originSide?: string) => {
    const rhauuid = randomUUID();
    await db.insert(schema.runningHoursAudit).values({
      rhauuid,
      vesselId: vuuid,
      componentId,
      previousRH: '0',
      newRH: cumulative,
      cumulativeRH: cumulative,
      dateUpdatedLocal: dateLocal,
      dateUpdatedTZ: 'UTC',
      enteredAtUTC: enteredAt,
      userId: 'test-427',
      source: 'single',
      ...(originSide ? { originSide } : {}),
    } as any);
    return rhauuid;
  };

  beforeAll(async () => {
    const dbMod = await import('../../../db');
    db = await dbMod.getDb();
    pool = await dbMod.getPool();
    schema = await import('@shared/schema');
    ({ sql: rawSql } = await import('drizzle-orm'));
    await runMigration();

    await db.insert(schema.vessels).values({ id: vesselId, vuuid, name: 'T427 Vessel', code: vesselId });
    await db.insert(schema.components).values({
      id: cuuidMaster, cuuid: cuuidMaster, vesselId: vuuid, name: 'T427 Master',
      componentCode: '601.001-T427', rhCounterType: 'MASTER',
      currentCumulativeRH: '2000.00', rhCurrentMaster: '2000.00',
    } as any);
    await db.insert(schema.components).values({
      id: cuuidChild, cuuid: cuuidChild, vesselId: vuuid, name: 'T427 Child',
      componentCode: '601.002-T427', rhCounterType: 'INHERITED',
      rhMasterComponentId: cuuidMaster, currentCumulativeRH: '2000.00',
    } as any);
    await db.insert(schema.components).values({
      id: cuuidNorm, cuuid: cuuidNorm, vesselId: vuuid, name: 'T427 Norm',
    } as any);
  });

  afterAll(async () => {
    if (!db) return;
    const { inArray, eq } = await import('drizzle-orm');
    await db.execute(rawSql`DELETE FROM rh_date_normalization_backup WHERE rhauuid IN (
      SELECT rhauuid FROM running_hours_audit WHERE component_id = ANY(ARRAY[${cuuidMaster}, ${cuuidChild}, ${cuuidNorm}]::text[])
    )`);
    await db.delete(schema.runningHoursAudit).where(inArray(schema.runningHoursAudit.componentId, allCuuids));
    await db.delete(schema.components).where(inArray(schema.components.cuuid, allCuuids));
    await db.delete(schema.vessels).where(eq(schema.vessels.vuuid, vuuid));
  });

  // ── 1. JS ↔ SQL parser parity ─────────────────────────────────────────────
  const paritySamples = [
    '2026-06-01', '2026-08-05T14:30:00Z', '2026-01-01T23:00:00-05:00',
    '01 Apr 2020 05:30', '01 Apr 2020 00:30', '01 Apr 2020 23:30',
    '01 Sept 2026 10:15', '15 June 2025', '3 September 2024 08:00',
    '15-Sep-2025', '15-Sep-2025 10:00',
    '2025-13-40', '2025-02-30', '31 Feb 2025', '15 Sep 2025 99:99',
    'not-a-date', '', '15 Xyz 2025', '2024-02-29', '2025-02-29',
  ];

  it('JS and SQL pick the SAME day (or both NULL) for every sample text', async () => {
    for (const s of paritySamples) {
      const r = await pool.query(`SELECT safe_rh_reading_day($1)::text AS d`, [s]);
      const sqlDay: string | null = r.rows[0].d;
      expect({ text: s, day: sqlDay }).toEqual({ text: s, day: canonicalReadingDay(s) });
    }
  });

  it('parity holds across Postgres session timezones (calendar-day round-trip)', async () => {
    for (const tz of ['UTC', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const client = await pool.connect();
      try {
        await client.query(`SET TIME ZONE '${tz}'`);
        for (const s of ['01 Apr 2020 00:30', '01 Apr 2020 23:30', '2026-06-01', '01 Sept 2026 10:15']) {
          const r = await client.query(`SELECT safe_rh_reading_day($1)::text AS d`, [s]);
          expect({ tz, text: s, day: r.rows[0].d }).toEqual({ tz, text: s, day: canonicalReadingDay(s) });
        }
      } finally {
        await client.query(`SET TIME ZONE DEFAULT`).catch(() => {});
        client.release();
      }
    }
  });

  // ── 2. Migration normalization ────────────────────────────────────────────
  it('normalizes parseable non-ISO rows, preserves originals, leaves unparseable rows untouched, and is idempotent', async () => {
    const legacyId = await insertAudit(cuuidNorm, '01 Apr 2020 05:30', '100', new Date('2026-08-01T00:00:00Z'));
    const septId = await insertAudit(cuuidNorm, '01 Sept 2026 10:15', '110', new Date('2026-08-02T00:00:00Z'));
    const garbageId = await insertAudit(cuuidNorm, 'not-a-date-at-all', '120', new Date('2026-08-03T00:00:00Z'));
    const isoId = await insertAudit(cuuidNorm, '2026-05-05', '130', new Date('2026-08-04T00:00:00Z'));

    await runMigration();

    const rows = await pool.query(
      `SELECT rhauuid, date_updated_local FROM running_hours_audit WHERE rhauuid = ANY($1::text[])`,
      [[legacyId, septId, garbageId, isoId]]
    );
    const byId = Object.fromEntries(rows.rows.map((r: any) => [r.rhauuid, r.date_updated_local]));
    expect(byId[legacyId]).toBe('2020-04-01');
    expect(byId[septId]).toBe('2026-09-01');
    expect(byId[garbageId]).toBe('not-a-date-at-all'); // untouched, never blanked
    expect(byId[isoId]).toBe('2026-05-05'); // already canonical, untouched

    // Originals preserved for rollback.
    const backup = await pool.query(
      `SELECT rhauuid, old_text, new_text FROM rh_date_normalization_backup WHERE rhauuid = ANY($1::text[]) ORDER BY rhauuid`,
      [[legacyId, septId]]
    );
    const bById = Object.fromEntries(backup.rows.map((r: any) => [r.rhauuid, r]));
    expect(bById[legacyId].old_text).toBe('01 Apr 2020 05:30');
    expect(bById[septId].old_text).toBe('01 Sept 2026 10:15');

    // Idempotent: second run changes nothing and does not duplicate backups.
    await runMigration();
    const rows2 = await pool.query(
      `SELECT date_updated_local FROM running_hours_audit WHERE rhauuid = $1`, [legacyId]);
    expect(rows2.rows[0].date_updated_local).toBe('2020-04-01');
    const backup2 = await pool.query(
      `SELECT COUNT(*)::int AS n FROM rh_date_normalization_backup WHERE rhauuid = ANY($1::text[])`,
      [[legacyId, septId]]
    );
    expect(backup2.rows[0].n).toBe(2);
  });

  // ── 3. Winner selection hardening ────────────────────────────────────────
  it('a backdated legacy-format row never beats a newer ISO reading; malformed rows neither win nor crash', async () => {
    const { selectWinningRhEvent } = await import('../rhEventComparator');
    // Newer ISO reading (ship WO completion): 3000 hrs on 2026-08-10.
    await insertAudit(cuuidMaster, '2026-08-10', '3000.00', new Date('2026-08-10T08:00:00Z'), 'ship');
    // Backdated legacy cascade row ENTERED LATER (the poisoning scenario):
    await insertAudit(cuuidMaster, '01 Apr 2020 05:30', '2000.00', new Date('2026-08-15T09:00:00Z'), 'shore');
    // Malformed rows entered latest of all:
    await insertAudit(cuuidMaster, '2025-13-40', '9999.00', new Date('2026-08-16T09:00:00Z'), 'shore');
    await insertAudit(cuuidMaster, '15 Sep 2025 99:99', '8888.00', new Date('2026-08-16T10:00:00Z'), 'shore');

    const winner = await selectWinningRhEvent(pool, cuuidMaster);
    expect(winner).not.toBeNull();
    expect(parseFloat(String(winner!.rh))).toBe(3000);
    expect(winner!.readingDay.toISOString().slice(0, 10)).toBe('2026-08-10');
  });

  // ── 4. Self-heal: MASTER heal + strict no-op on second run ───────────────
  it('self-heal heals a stale MASTER (and its child cache) and is a strict no-op on the second run', async () => {
    const { selfHealRhComponents } = await import('../rhEventComparator');

    // SCOPED to the fixture vessel only — never fleet-wide from a test.
    const first = await selfHealRhComponents(pool, { vesselId: vuuid });
    expect(first.errors).toBe(0);
    expect(first.mastersScanned).toBe(1);
    expect(first.childrenScanned).toBe(1);

    const comp = await pool.query(
      `SELECT current_cumulative_rh, rh_current_master, last_updated FROM components WHERE cuuid = $1`,
      [cuuidMaster]
    );
    expect(parseFloat(comp.rows[0].current_cumulative_rh)).toBe(3000);
    expect(parseFloat(comp.rows[0].rh_current_master)).toBe(3000);
    expect(comp.rows[0].last_updated).toBe('2026-08-10'); // canonical, never poisoned text

    const child = await pool.query(
      `SELECT rh_current_inherited_cached, last_updated FROM components WHERE cuuid = $1`, [cuuidChild]);
    expect(parseFloat(child.rows[0].rh_current_inherited_cached)).toBe(3000);
    expect(child.rows[0].last_updated).toBe('2026-08-10');

    // Second run: zero updates, zero churn (our components at least contribute none).
    const updatedAtBefore = await pool.query(`SELECT updated_at FROM components WHERE cuuid = $1`, [cuuidMaster]);
    const second = await selfHealRhComponents(pool, { vesselId: vuuid });
    expect(second.errors).toBe(0);
    expect(second.mastersHealed).toBe(0);
    expect(second.childrenHealed).toBe(0);
    const updatedAtAfter = await pool.query(`SELECT updated_at FROM components WHERE cuuid = $1`, [cuuidMaster]);
    expect(new Date(updatedAtAfter.rows[0].updated_at).getTime())
      .toBe(new Date(updatedAtBefore.rows[0].updated_at).getTime());
  });

  // ── 5. Tie-break preservation ────────────────────────────────────────────
  it('equal-day rows keep the tie-break order: ship-first, then entered_at DESC', async () => {
    const { selectWinningRhEvent } = await import('../rhEventComparator');
    const c = randomUUID();
    await db.insert(schema.components).values({ id: c, cuuid: c, vesselId: vuuid, name: 'T427 Tie' } as any);
    try {
      await insertAudit(c, '2026-08-12', '500.00', new Date('2026-08-12T10:00:00Z'), 'shore');
      await insertAudit(c, '12 Aug 2026 08:00', '480.00', new Date('2026-08-12T08:00:00Z'), 'ship');
      const winner = await selectWinningRhEvent(pool, c);
      // Same reading day (2026-08-12, legacy text parses to the same day) → ship wins.
      expect(parseFloat(String(winner!.rh))).toBe(480);
    } finally {
      const { inArray, eq } = await import('drizzle-orm');
      await db.delete(schema.runningHoursAudit).where(eq(schema.runningHoursAudit.componentId, c));
      await db.delete(schema.components).where(eq(schema.components.cuuid, c));
    }
  });

  // ── 5a. Unparseable-row fallback day is UTC, not session TZ ──────────────
  it('malformed rows straddling UTC midnight rank by UTC entry day under non-UTC session timezones (winner + rotation)', async () => {
    const { selectWinningRhEvent } = await import('../rhEventComparator');
    const c = randomUUID();
    await db.insert(schema.components).values({ id: c, cuuid: c, vesselId: vuuid, name: 'T427 TZ Fallback' } as any);
    const client = await pool.connect();
    try {
      // Two UNPARSEABLE rows straddling UTC midnight: in a west-of-UTC session
      // TZ a bare entered_at_utc::date would put BOTH on Aug 15 (flipping the
      // winner to the higher-entered_at tie-break either way), while the JS
      // comparator uses the UTC day. The explicit AT TIME ZONE 'UTC' cast must
      // make SQL agree: the 00:30Z row is UTC day Aug 16 and wins.
      await insertAudit(c, 'not-a-date-A', '100.00', new Date('2026-08-15T23:30:00Z'), 'ship');
      await insertAudit(c, 'not-a-date-B', '200.00', new Date('2026-08-16T00:30:00Z'), 'shore');

      for (const tz of ['America/New_York', 'Pacific/Auckland', 'UTC']) {
        await client.query(`SET TIME ZONE '${tz}'`);
        const winner = await selectWinningRhEvent(client, c);
        expect(parseFloat(String(winner!.rh))).toBe(200);
        expect(winner!.readingDay.toISOString().slice(0, 10)).toBe('2026-08-16');
      }

      // Rotation filter: a rotation on 2026-08-16 must exclude the Aug-15 UTC
      // row and keep the Aug-16 UTC row regardless of session timezone.
      await pool.query(
        `INSERT INTO rotation_history (vessel_id, component_id, in_riuuid, in_stamp, in_rh, rotation_date)
         VALUES ($1, $2, $3, 'T427-STAMP', 0, '2026-08-16T00:00:00Z')`,
        [vuuid, c, randomUUID()]
      );
      for (const tz of ['America/New_York', 'Pacific/Auckland', 'UTC']) {
        await client.query(`SET TIME ZONE '${tz}'`);
        const rotWinner = await selectWinningRhEvent(client, c);
        expect(rotWinner).not.toBeNull();
        expect(parseFloat(String(rotWinner!.rh))).toBe(200);
        expect(rotWinner!.readingDay.toISOString().slice(0, 10)).toBe('2026-08-16');
      }
    } finally {
      await client.query(`SET TIME ZONE 'UTC'`).catch(() => {});
      client.release();
      const { eq } = await import('drizzle-orm');
      await pool.query(`DELETE FROM rotation_history WHERE component_id = $1`, [c]).catch(() => {});
      await db.delete(schema.runningHoursAudit).where(eq(schema.runningHoursAudit.componentId, c));
      await db.delete(schema.components).where(eq(schema.components.cuuid, c));
    }
  });

  // ── 5a2. Storage insert boundary: last line of defence ────────────────────
  it('PostgresStorage.createRunningHoursAudit canonicalizes legacy dates, defaults when absent, and rejects malformed text', async () => {
    const { PostgresStorage } = await import('../../../postgresStorage');
    const storage = new PostgresStorage();
    const c = randomUUID();
    await db.insert(schema.components).values({ id: c, cuuid: c, vesselId: vuuid, name: 'T427 StorageBoundary' } as any);
    try {
      // Legacy-format → canonicalized on insert.
      const legacy = await storage.createRunningHoursAudit({
        componentId: c, vesselId: vuuid, previousRH: '0', newRH: '10', cumulativeRH: '10',
        dateUpdatedLocal: '01 Sept 2026 10:15', dateUpdatedTZ: 'UTC', enteredAtUTC: new Date(),
        userId: 'tester', source: 'single',
      } as any);
      expect((legacy as any).dateUpdatedLocal).toBe('2026-09-01');

      // Absent → defaults to today's UTC day.
      const absent = await storage.createRunningHoursAudit({
        componentId: c, vesselId: vuuid, previousRH: '10', newRH: '20', cumulativeRH: '20',
        dateUpdatedTZ: 'UTC', enteredAtUTC: new Date(), userId: 'tester', source: 'single',
      } as any);
      expect((absent as any).dateUpdatedLocal).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Malformed → rejected, nothing persisted.
      for (const bad of ['2025-13-40', '15 Sep 2025 99:99', 'not-a-date']) {
        await expect(storage.createRunningHoursAudit({
          componentId: c, vesselId: vuuid, previousRH: '20', newRH: '30', cumulativeRH: '30',
          dateUpdatedLocal: bad, dateUpdatedTZ: 'UTC', enteredAtUTC: new Date(),
          userId: 'tester', source: 'single',
        } as any)).rejects.toThrow(/Invalid reading date/);
      }
      const count = await pool.query(
        `SELECT count(*)::int AS n FROM running_hours_audit WHERE component_id = $1`, [c]);
      expect(count.rows[0].n).toBe(2);
    } finally {
      const { eq } = await import('drizzle-orm');
      await db.delete(schema.runningHoursAudit).where(eq(schema.runningHoursAudit.componentId, c));
      await db.delete(schema.components).where(eq(schema.components.cuuid, c));
    }
  });

  // ── 5b. Cascade date guard: tenant-aware pool + backdated rejection ──────
  it('cascadeRunningHoursUpdate date guard reads the tenant audit history (getPool seam) and rejects a backdated entry with no writes', async () => {
    const { PostgresStorage } = await import('../../../postgresStorage');
    const storage = new PostgresStorage();
    const auditCountBefore = await pool.query(
      `SELECT count(*)::int AS n FROM running_hours_audit WHERE component_id = $1`, [cuuidMaster]);

    // Latest winner for cuuidMaster is the 2026-08-10 ISO reading (section 3) —
    // an entry dated earlier must be rejected by the shared winner-based guard.
    await expect(storage.cascadeRunningHoursUpdate({
      parentComponentId: cuuidMaster, mode: 'setTotal', value: 5000,
      dateUpdated: '2020-01-01', userId: 'tester',
    })).rejects.toThrow(/Invalid date/);

    const auditCountAfter = await pool.query(
      `SELECT count(*)::int AS n FROM running_hours_audit WHERE component_id = $1`, [cuuidMaster]);
    expect(auditCountAfter.rows[0].n).toBe(auditCountBefore.rows[0].n);
  });

  // ── 6. At-date readers are calendar-day based & session-TZ-safe ──────────
  it('getRunningHoursAtDateBatch / getRunningHoursAtDate compare by calendar day, incl. legacy rows arriving after normalization and non-UTC session timezones', async () => {
    const c = randomUUID();
    await db.insert(schema.components).values({ id: c, cuuid: c, vesselId: vuuid, name: 'T427 AtDate' } as any);
    try {
      // Legacy-format row "arriving via sync AFTER migration 167 ran" (never normalized).
      await insertAudit(c, '01 Sept 2026 10:15', '700.00', new Date('2026-09-02T00:30:00Z'));
      await insertAudit(c, '2026-08-10', '600.00', new Date('2026-08-10T12:00:00Z'));
      await insertAudit(c, 'garbage-not-a-date', '999.00', new Date('2026-09-05T12:00:00Z')); // must be excluded, never crash

      // Force non-UTC session timezones onto the pooled connections the
      // readers will use (best-effort: touch several pool clients).
      const clients = await Promise.all([pool.connect(), pool.connect(), pool.connect()]);
      try {
        for (const cl of clients) await cl.query(`SET TIME ZONE 'America/New_York'`);
      } finally {
        clients.forEach((cl: any) => cl.release());
      }
      try {
        const repoMod = await import('../repositories/runningHoursRepository');
        // Target = the legacy row's reading day exactly (2026-09-01). A timestamptz
        // comparison in an America/New_York session would shift '2026-09-01 10:15'
        // relative to the instant and could exclude or misorder it.
        const batch = await repoMod.getRunningHoursAtDateBatch(
          [{ id: c, cuuid: c }], new Date('2026-09-01T00:00:00Z'));
        expect(batch.get(c)?.runningHours).toBe(700);
        expect(batch.get(c)?.isFallback).toBe(false);

        // Day BEFORE the legacy row → the ISO row wins.
        const before = await repoMod.getRunningHoursAtDateBatch(
          [{ id: c, cuuid: c }], new Date('2026-08-31T23:59:59Z'));
        expect(before.get(c)?.runningHours).toBe(600);

        // Day before ANY row → fallback = earliest after target (ISO row).
        const fb = await repoMod.getRunningHoursAtDateBatch(
          [{ id: c, cuuid: c }], new Date('2026-08-01T00:00:00Z'));
        expect(fb.get(c)?.runningHours).toBe(600);
        expect(fb.get(c)?.isFallback).toBe(true);

        // Single-component storage reader mirrors the batch semantics.
        const { PostgresStorage } = await import('../../../postgresStorage');
        const storage: any = new PostgresStorage();
        const single = await storage.getRunningHoursAtDate(c, new Date('2026-09-01T00:00:00Z'));
        expect(single?.runningHours).toBe(700);
        const singleBefore = await (storage as any).getRunningHoursAtDate(c, new Date('2026-08-31T12:00:00Z'));
        expect(singleBefore?.runningHours).toBe(600);
      } finally {
        const reset = await Promise.all([pool.connect(), pool.connect(), pool.connect()]);
        for (const cl of reset) await cl.query(`SET TIME ZONE DEFAULT`).catch(() => {});
        reset.forEach((cl: any) => cl.release());
      }
    } finally {
      const { eq } = await import('drizzle-orm');
      await db.delete(schema.runningHoursAudit).where(eq(schema.runningHoursAudit.componentId, c));
      await db.delete(schema.components).where(eq(schema.components.cuuid, c));
    }
  });
});
