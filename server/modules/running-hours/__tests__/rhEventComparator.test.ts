import { describe, it, expect } from 'vitest';
import {
  parseReadingDay,
  effectiveReadingDay,
  originRank,
  compareRhEvents,
  incomingRhStamp,
  shouldStripIncomingRh,
  localRhClaimDay,
  RH_GUARD_STRIP_COLUMNS,
  applyWinningRhToComponent,
  selfHealInheritedRhCaches,
  type RhEventLike,
} from '../rhEventComparator';

const ev = (o: Partial<RhEventLike> & { rhauuid: string }): RhEventLike => ({
  dateUpdatedLocal: null,
  enteredAtUTC: null,
  originSide: null,
  ...o,
});

describe('parseReadingDay', () => {
  it('parses date-only text to a UTC day', () => {
    expect(parseReadingDay('2026-08-05')?.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });
  it('parses date-time text to its UTC day', () => {
    expect(parseReadingDay('2026-08-05T14:30:00Z')?.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });
  it('rejects garbage and empty values', () => {
    expect(parseReadingDay('not-a-date')).toBeNull();
    expect(parseReadingDay('')).toBeNull();
    expect(parseReadingDay(null)).toBeNull();
    expect(parseReadingDay(undefined)).toBeNull();
  });
});

describe('effectiveReadingDay', () => {
  it('prefers date_updated_local over entered_at_utc', () => {
    const e = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-01', enteredAtUTC: '2026-08-07T10:00:00Z' });
    expect(effectiveReadingDay(e)?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
  it('falls back to entered_at_utc day for legacy unparseable dates (never "now")', () => {
    const e = ev({ rhauuid: 'a', dateUpdatedLocal: 'garbage', enteredAtUTC: '2026-08-07T10:00:00Z' });
    expect(effectiveReadingDay(e)?.toISOString()).toBe('2026-08-07T00:00:00.000Z');
  });
  it('returns null when no date at all', () => {
    expect(effectiveReadingDay(ev({ rhauuid: 'a' }))).toBeNull();
  });
});

describe('originRank', () => {
  it('ranks ship < legacy/unknown < shore (lower wins ties)', () => {
    expect(originRank('ship')).toBeLessThan(originRank(null));
    expect(originRank(null)).toBeLessThan(originRank('shore'));
    expect(originRank('SHIP')).toBe(originRank('ship'));
  });
});

describe('compareRhEvents — canonical latest-reading-wins order', () => {
  it('later reading date wins regardless of origin', () => {
    const shore = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'shore' });
    const ship = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-05', originSide: 'ship' });
    expect(compareRhEvents(shore, ship)).toBeGreaterThan(0);
  });
  it('later reading date wins even if it was entered earlier (arrival-order independence)', () => {
    const older = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-05', enteredAtUTC: '2026-08-08T00:00:00Z' });
    const newer = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', enteredAtUTC: '2026-08-06T00:00:00Z' });
    expect(compareRhEvents(newer, older)).toBeGreaterThan(0);
  });
  it('ship wins an exact reading-date tie', () => {
    const shore = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'shore', enteredAtUTC: '2026-08-07T00:00:00Z' });
    const ship = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T00:00:00Z' });
    expect(compareRhEvents(ship, shore)).toBeGreaterThan(0);
  });
  it('legacy (null origin) beats shore but loses to ship on ties', () => {
    const legacy = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: null });
    const shore = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'shore' });
    const ship = ev({ rhauuid: 'c', dateUpdatedLocal: '2026-08-06', originSide: 'ship' });
    expect(compareRhEvents(legacy, shore)).toBeGreaterThan(0);
    expect(compareRhEvents(ship, legacy)).toBeGreaterThan(0);
  });
  it('same day + same origin: later entered_at_utc wins', () => {
    const a = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T08:00:00Z' });
    const b = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T18:00:00Z' });
    expect(compareRhEvents(b, a)).toBeGreaterThan(0);
  });
  it('is a stable total order — antisymmetric, no zeros for distinct ids', () => {
    const a = ev({ rhauuid: 'a', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T08:00:00Z' });
    const b = ev({ rhauuid: 'b', dateUpdatedLocal: '2026-08-06', originSide: 'ship', enteredAtUTC: '2026-08-06T08:00:00Z' });
    expect(compareRhEvents(a, b)).toBe(-compareRhEvents(b, a));
    expect(compareRhEvents(a, b)).not.toBe(0);
  });
  it('an event with no usable date always loses', () => {
    const dateless = ev({ rhauuid: 'a' });
    const dated = ev({ rhauuid: 'b', dateUpdatedLocal: '2020-01-01' });
    expect(compareRhEvents(dated, dateless)).toBeGreaterThan(0);
  });
  it('sorting a shuffled set converges to the same winner (convergence property)', () => {
    const events = [
      ev({ rhauuid: 'w', dateUpdatedLocal: '2026-08-04', originSide: 'ship' }),
      ev({ rhauuid: 'x', dateUpdatedLocal: '2026-08-06', originSide: 'shore' }),
      ev({ rhauuid: 'y', dateUpdatedLocal: '2026-08-06', originSide: 'ship' }),
      ev({ rhauuid: 'z', dateUpdatedLocal: '2026-08-05', originSide: null }),
    ];
    for (let i = 0; i < 4; i++) {
      const shuffled = [...events.slice(i), ...events.slice(0, i)];
      const winner = shuffled.reduce((best, e) => (compareRhEvents(e, best) > 0 ? e : best));
      expect(winner.rhauuid).toBe('y'); // latest day, ship wins the tie
    }
  });
});

/* ───────────── Task #417: RH-LATEST-GUARD strip decision matrix ───────────── */

describe('shouldStripIncomingRh — guard decision matrix (Task #417)', () => {
  const localDay = parseReadingDay('2026-08-06')!;
  it('strips when incoming stamp is OLDER than the local winner', () => {
    expect(shouldStripIncomingRh('2026-08-05', localDay)).toBe(true);
  });
  it('strips on an EQUAL-day stamp (ship wins ties — closes the pre-#417 loophole)', () => {
    expect(shouldStripIncomingRh('2026-08-06', localDay)).toBe(true);
    expect(shouldStripIncomingRh('2026-08-06T23:59:00Z', localDay)).toBe(true);
  });
  it('applies (does NOT strip) only when strictly newer', () => {
    expect(shouldStripIncomingRh('2026-08-07', localDay)).toBe(false);
  });
  it('strips when the incoming stamp is missing or unparseable', () => {
    expect(shouldStripIncomingRh(null, localDay)).toBe(true);
    expect(shouldStripIncomingRh(undefined, localDay)).toBe(true);
    expect(shouldStripIncomingRh('garbage', localDay)).toBe(true);
  });
  it('accepts Date objects', () => {
    expect(shouldStripIncomingRh(new Date('2026-08-07T00:00:00Z'), localDay)).toBe(false);
    expect(shouldStripIncomingRh(new Date('2026-08-06T10:00:00Z'), localDay)).toBe(true);
  });
});

describe('incomingRhStamp — stamp claim priority (Task #417)', () => {
  it('prefers the master stamp, then inherited stamp, then last_updated', () => {
    expect(incomingRhStamp({ rh_master_updated_at: 'M', rh_inherited_updated_at: 'I', last_updated: 'L' })).toBe('M');
    expect(incomingRhStamp({ rh_inherited_updated_at: 'I', last_updated: 'L' })).toBe('I');
    expect(incomingRhStamp({ rhInheritedUpdatedAt: 'I' })).toBe('I');
    expect(incomingRhStamp({ last_updated: 'L' })).toBe('L');
    expect(incomingRhStamp({})).toBeUndefined();
  });
});

describe('RH_GUARD_STRIP_COLUMNS — protects master AND inherited columns, never non-RH data', () => {
  it('contains the inherited cache/date columns in both naming styles', () => {
    for (const col of ['rh_current_inherited_cached', 'rhCurrentInheritedCached', 'rh_inherited_updated_at', 'rhInheritedUpdatedAt',
      'current_cumulative_rh', 'rh_current_master', 'last_updated']) {
      expect(RH_GUARD_STRIP_COLUMNS).toContain(col);
    }
  });
  it('never touches non-RH component columns', () => {
    for (const col of ['name', 'component_code', 'parent_id', 'current_stamp', 'rotational_item', 'rh_counter_type', 'rh_master_component_id']) {
      expect(RH_GUARD_STRIP_COLUMNS).not.toContain(col);
    }
  });
});

/* ───────────── Task #417: counter-type-aware derive (mock conn) ───────────── */

/** Minimal audit row factory for the mock DB. */
const auditRow = (o: any) => ({
  rhauuid: o.rhauuid, component_id: o.componentId,
  cumulative_rh: o.rh, new_rh: o.rh,
  date_updated_local: o.day, entered_at_utc: o.entered || `${o.day}T10:00:00Z`,
  origin_side: o.origin ?? 'ship',
});

/**
 * Mock conn: routes the exact SQL shapes applyWinningRhToComponent issues.
 * - rotation_history MAX → none
 * - running_hours_audit winner select → latest row for that component (pre-sorted input)
 * - components SELECT by cuuid → provided component map
 * - UPDATE components → recorded
 */
function mockConn(components: Record<string, any>, audits: Record<string, any[]>) {
  const updates: { sql: string; params: any[] }[] = [];
  return {
    updates,
    async query(sqlText: string, params?: any[]) {
      const s = sqlText.replace(/\s+/g, ' ');
      if (s.includes('FROM rotation_history')) return { rows: [{ latest: null }] };
      if (s.includes('FROM running_hours_audit')) {
        const list = audits[params![0]] || [];
        return { rows: list.slice(0, 1) }; // caller LIMIT 1; tests pre-sort
      }
      if (s.includes('component_code = $1 OR id = $1')) {
        // master resolution: by cuuid OR (code + vessel)
        const byId = components[params![0]];
        const hit = byId ? [params![0], byId] : Object.entries(components).find(([, c]: any) =>
          c.component_code === params![0] && c.vessel_id === params![1]);
        return { rows: hit ? [{ cuuid: hit[0], ...(hit[1] as any) }] : [] };
      }
      if (s.includes('FROM components WHERE cuuid')) {
        const c = components[params![0]];
        return { rows: c ? [c] : [] };
      }
      if (s.startsWith('SELECT cuuid FROM components')) {
        return { rows: Object.entries(components)
          .filter(([, c]: any) => String(c.rh_counter_type).toUpperCase() === 'INHERITED' && c.rh_master_component_id)
          .map(([cuuid]) => ({ cuuid })) };
      }
      if (s.startsWith('UPDATE components')) {
        updates.push({ sql: s, params: params! });
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`unexpected query: ${s.substring(0, 80)}`);
    },
  };
}

describe('applyWinningRhToComponent — inherited branch (Task #417)', () => {
  const MASTER = 'master-1';
  const CHILD = 'child-1';
  const comps = () => ({
    [MASTER]: { rh_counter_type: 'MASTER', rh_master_component_id: null, meter_replaced_last_rh: '100' },
    [CHILD]: { rh_counter_type: 'INHERITED', rh_master_component_id: MASTER, meter_replaced_last_rh: null },
  });

  it('INHERITED: writes own cumulative + cache from the MASTER winner + baseline, dated with the READING date', async () => {
    const conn = mockConn(comps(), {
      [MASTER]: [auditRow({ rhauuid: 'm1', componentId: MASTER, rh: '2900', day: '2026-06-01' })],
      [CHILD]: [auditRow({ rhauuid: 'c1', componentId: CHILD, rh: '450', day: '2026-06-01' })],
    });
    expect(await applyWinningRhToComponent(conn, CHILD, 'test')).toBe(true);
    const upd = conn.updates.find(u => u.sql.includes('rh_current_inherited_cached'))!;
    expect(upd).toBeTruthy();
    const [cum, cache, inhDate, lastUpdated] = upd.params;
    expect(cum).toBe('450.00');                       // child's own hours
    expect(cache).toBe('3000.00');                    // 100 baseline + 2900 master reading
    expect(inhDate.toISOString()).toBe('2026-06-01T00:00:00.000Z'); // MASTER winner's reading day (cache provenance), never "now"
    expect(lastUpdated).toBe('2026-06-01');
    // never writes rh_current_master for an inherited component
    expect(upd.sql).not.toContain('rh_current_master');
  });

  it('INHERITED: resolves a legacy component-CODE master reference (vessel-scoped)', async () => {
    const comps = {
      'master-uuid': { rh_counter_type: 'MASTER', rh_master_component_id: null, meter_replaced_last_rh: '100', component_code: '651.001', vessel_id: 'V1' },
      'child-legacy': { rh_counter_type: 'INHERITED', rh_master_component_id: '651.001', meter_replaced_last_rh: null, component_code: '651.001.01', vessel_id: 'V1' },
    };
    const conn = mockConn(comps, {
      'master-uuid': [auditRow({ rhauuid: 'm1', componentId: 'master-uuid', rh: '2900', day: '2026-06-01' })],
      'child-legacy': [auditRow({ rhauuid: 'c1', componentId: 'child-legacy', rh: '450', day: '2026-06-01' })],
    });
    expect(await applyWinningRhToComponent(conn, 'child-legacy', 'test')).toBe(true);
    const upd = conn.updates.find(u => u.sql.includes('rh_current_inherited_cached'))!;
    expect(upd.params[1]).toBe('3000.00'); // resolved master by code+vessel
  });

  it('INHERITED: resolves a legacy rh_counter_source-only master reference', async () => {
    const comps = {
      'master-uuid': { rh_counter_type: 'MASTER', rh_master_component_id: null, meter_replaced_last_rh: '100', component_code: '651.001', vessel_id: 'V1' },
      'child-src': { rh_counter_type: 'INHERITED', rh_master_component_id: null, rh_counter_source: '651.001', meter_replaced_last_rh: null, component_code: '651.001.02', vessel_id: 'V1' },
    };
    const conn = mockConn(comps, {
      'master-uuid': [auditRow({ rhauuid: 'm1', componentId: 'master-uuid', rh: '2900', day: '2026-06-01' })],
      'child-src': [auditRow({ rhauuid: 'c1', componentId: 'child-src', rh: '450', day: '2026-06-01' })],
    });
    expect(await applyWinningRhToComponent(conn, 'child-src', 'test')).toBe(true);
    const upd = conn.updates.find(u => u.sql.includes('rh_current_inherited_cached'))!;
    expect(upd.params[1]).toBe('3000.00');
  });

  it('INHERITED: no-op skip — already-derived state produces zero writes (self-heal idempotency)', async () => {
    const comps = {
      'master-uuid': { rh_counter_type: 'MASTER', rh_master_component_id: null, meter_replaced_last_rh: '100', component_code: '651.001', vessel_id: 'V1' },
      'child-1': { rh_counter_type: 'INHERITED', rh_master_component_id: 'master-uuid', meter_replaced_last_rh: null, vessel_id: 'V1',
        current_cumulative_rh: '450.00', rh_current_inherited_cached: '3000.00',
        rh_inherited_updated_at: '2026-06-01T00:00:00.000Z', last_updated: '2026-06-01' },
    };
    const conn = mockConn(comps, {
      'master-uuid': [auditRow({ rhauuid: 'm1', componentId: 'master-uuid', rh: '2900', day: '2026-06-01' })],
      'child-1': [auditRow({ rhauuid: 'c1', componentId: 'child-1', rh: '450', day: '2026-06-01' })],
    });
    expect(await applyWinningRhToComponent(conn, 'child-1', 'test')).toBe('unchanged');
    expect(conn.updates.length).toBe(0);
  });

  it('INHERITED: preserves the existing cache when the master has no winner (never blanks)', async () => {
    const conn = mockConn(comps(), {
      [MASTER]: [],
      [CHILD]: [auditRow({ rhauuid: 'c1', componentId: CHILD, rh: '450', day: '2026-06-01' })],
    });
    expect(await applyWinningRhToComponent(conn, CHILD, 'test')).toBe(true);
    const upd = conn.updates[conn.updates.length - 1];
    expect(upd.sql).toContain('COALESCE');
    expect(upd.params[1]).toBeNull(); // COALESCE keeps existing cache
  });

  it('MASTER: keeps the exact legacy master-column write AND refreshes children caches with the TOTAL', async () => {
    const conn = mockConn(comps(), {
      [MASTER]: [auditRow({ rhauuid: 'm1', componentId: MASTER, rh: '2900', day: '2026-06-02' })],
    });
    expect(await applyWinningRhToComponent(conn, MASTER, 'test')).toBe(true);
    const masterUpd = conn.updates.find(u => u.sql.includes('rh_current_master'))!;
    expect(masterUpd.params[0]).toBe('2900.00');
    const childUpd = conn.updates.find(u => u.sql.includes('rh_master_component_id'))!;
    expect(childUpd.params[0]).toBe('3000.00'); // baseline 100 + 2900
    expect(childUpd.params[1].toISOString()).toBe('2026-06-02T00:00:00.000Z');
    expect(childUpd.sql).not.toContain('current_cumulative_rh'); // children's own hours untouched
  });

  it('no usable winner → component untouched (self-heal safety rule)', async () => {
    const conn = mockConn(comps(), { [CHILD]: [], [MASTER]: [] });
    expect(await applyWinningRhToComponent(conn, CHILD, 'test')).toBe(false);
    expect(conn.updates.length).toBe(0);
  });
});

describe('localRhClaimDay — guard local-claim resolution (Task #417 review fix)', () => {
  const d = (s: string) => parseReadingDay(s)!;
  it('takes the newer of child winner day and local cache stamp', () => {
    expect(localRhClaimDay(d('2026-06-01'), '2026-06-10')!.toISOString()).toBe('2026-06-10T00:00:00.000Z');
    expect(localRhClaimDay(d('2026-06-10'), '2026-06-01')!.toISOString()).toBe('2026-06-10T00:00:00.000Z');
  });
  it('falls back to whichever exists (master-refresh with no child cascade audit)', () => {
    expect(localRhClaimDay(null, '2026-06-10')!.toISOString()).toBe('2026-06-10T00:00:00.000Z');
    expect(localRhClaimDay(d('2026-06-01'), null)!.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(localRhClaimDay(null, null)).toBeNull();
  });
  it('stale incoming claim loses against a fresher cache stamp even when child audit is older', () => {
    // Reviewer scenario: child audit June 1, master refresh stamped cache June 10, shore row claims June 2.
    const claim = localRhClaimDay(d('2026-06-01'), '2026-06-10')!;
    expect(shouldStripIncomingRh('2026-06-02', claim)).toBe(true);   // stale shore row stripped
    expect(shouldStripIncomingRh('2026-06-11', claim)).toBe(false);  // genuinely newer applies
  });
});

describe('applyWinningRhToComponent — cache provenance stamping (Task #417 review fix)', () => {
  const comps = () => ({
    'master-1': { rh_counter_type: 'MASTER', rh_master_component_id: null, meter_replaced_last_rh: '100', component_code: '651.001', vessel_id: 'V1' },
    'child-1': { rh_counter_type: 'INHERITED', rh_master_component_id: 'master-1', meter_replaced_last_rh: null, vessel_id: 'V1' },
  });
  it("stamps rh_inherited_updated_at with the MASTER winner's day, not the child's", async () => {
    const conn = mockConn(comps(), {
      'master-1': [auditRow({ rhauuid: 'm1', componentId: 'master-1', rh: '2900', day: '2026-06-10' })],
      'child-1': [auditRow({ rhauuid: 'c1', componentId: 'child-1', rh: '450', day: '2026-06-01' })],
    });
    expect(await applyWinningRhToComponent(conn, 'child-1', 'test')).toBe(true);
    const upd = conn.updates.find(u => u.sql.includes('rh_current_inherited_cached'))!;
    expect(upd.params[2].toISOString()).toBe('2026-06-10T00:00:00.000Z'); // master's reading day
  });
  it('no master winner → preserves BOTH cache value and its stamp (COALESCE)', async () => {
    const conn = mockConn(comps(), {
      'master-1': [],
      'child-1': [auditRow({ rhauuid: 'c1', componentId: 'child-1', rh: '450', day: '2026-06-01' })],
    });
    expect(await applyWinningRhToComponent(conn, 'child-1', 'test')).toBe(true);
    const upd = conn.updates[conn.updates.length - 1];
    expect(upd.params[1]).toBeNull();
    expect(upd.params[2]).toBeNull();
    expect((upd.sql.match(/COALESCE/g) || []).length).toBe(2); // cache AND stamp preserved
  });
});

describe('selfHealInheritedRhCaches (Task #417)', () => {
  it('scans only inherited components; heals those with history, skips those without', async () => {
    const comps = {
      'master-1': { rh_counter_type: 'MASTER', rh_master_component_id: null, meter_replaced_last_rh: null },
      'child-ok': { rh_counter_type: 'INHERITED', rh_master_component_id: 'master-1', meter_replaced_last_rh: null },
      'child-nohistory': { rh_counter_type: 'INHERITED', rh_master_component_id: 'master-1', meter_replaced_last_rh: null },
    };
    const conn = mockConn(comps, {
      'master-1': [auditRow({ rhauuid: 'm1', componentId: 'master-1', rh: '2900', day: '2026-06-01' })],
      'child-ok': [auditRow({ rhauuid: 'c1', componentId: 'child-ok', rh: '450', day: '2026-06-01' })],
      'child-nohistory': [],
    });
    const { scanned, healed } = await selfHealInheritedRhCaches(conn);
    expect(scanned).toBe(2);
    expect(healed).toBe(1);
    expect(conn.updates.length).toBe(1); // no-winner child untouched
  });
});
