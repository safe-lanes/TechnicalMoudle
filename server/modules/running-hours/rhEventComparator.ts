/**
 * CANONICAL RH EVENT COMPARATOR + ORDER-INDEPENDENT COMPONENT DERIVE (Task #394)
 *
 * THE RULE (everywhere, both sides): the RH reading event with the LATEST
 * OBSERVED READING DATE wins — regardless of which side entered it or which
 * order sync delivered it. Exact-date ties: ship wins (it reads the physical
 * counter); legacy rows with no origin_side rank between ship and shore
 * (they are overwhelmingly ship-era rows). Final tie-break: entered_at_utc,
 * then rhauuid — a STABLE total order, so every instance converges to the
 * same winner no matter the arrival order.
 *
 * WHY DERIVE-FROM-HISTORY, NOT APPLY-INCOMING: the sync conflict window is
 * per-field (sync_field_log timestamps). Applying a single incoming value can
 * half-apply a reading or let the last arrival win. Instead, every hook calls
 * applyWinningRhToComponent(), which recomputes the component's current RH
 * from the FULL locally persisted audit history via the comparator. Replay-
 * safe, arrival-order-independent, and self-healing.
 *
 * ROTATION GUARD: readings observed on a calendar day strictly BEFORE the
 * component's latest rotation are excluded from the winner selection (the
 * rotation baseline owns the counter from the swap onward) — same semantics
 * as the pre-existing isReadingPreRotation guard.
 *
 * DATE HANDLING: date_updated_local is a date-only TEXT (YYYY-MM-DD...) in
 * vessel-local terms; comparisons are on the UTC calendar day of that text.
 * Rows whose date text is unparseable fall back to entered_at_utc's day
 * (legacy rule), never to "now".
 */

import { parseReadingDayStrict, canonicalReadingDay, formatReadingDay } from './utils/readingDate';

/**
 * Parse a reading-date text to a UTC-day Date, or null.
 * Task #427: delegates to the SHARED strict calendar-day parser (mirrors SQL
 * safe_rh_reading_day). Legacy locale strings ("01 Apr 2020 05:30", long month
 * names) now parse to their TRUE day; malformed ISO (2025-13-40) is rejected
 * instead of being Date.UTC-normalized into a different valid day; there is no
 * unrestricted `new Date(str)` fallback.
 */
export function parseReadingDay(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return parseReadingDayStrict(String(dateStr));
}

/**
 * SQL expression for a row's effective observed reading day. Mirrors
 * effectiveReadingDay(): the shared safe parser on date_updated_local
 * (legacy DD Mon YYYY / long-month rows rank by their TRUE reading day;
 * malformed values → NULL), falling back to entered_at_utc's day ONLY for
 * rows the parser classifies as unparseable. Requires safe_rh_reading_day()
 * from migrations/167 (which also re-creates 166's function).
 */
// Fallback for unparseable rows is the UTC calendar day of entry. entered_at_utc
// is `timestamp without time zone` holding UTC wall time; the explicit double
// `AT TIME ZONE 'UTC'` (naive→timestamptz interpreted as UTC→naive UTC) makes
// the day extraction session-timezone-independent even if the column type ever
// changes to timestamptz — matching JS effectiveReadingDay()'s getUTC* day.
const READING_DAY_SQL = `COALESCE(safe_rh_reading_day(date_updated_local), (entered_at_utc AT TIME ZONE 'UTC' AT TIME ZONE 'UTC')::date)`;

/**
 * Ranking policy (Task #427): a row whose reading-date text the parser
 * classifies as UNPARSEABLE can never outrank a parseable reading — otherwise
 * a backdated malformed row entered today would rank by its entry day and win
 * (the original poisoning bug, just for garbage text). Parseable rows rank by
 * their true reading day; unparseable rows sort strictly after them (NULLS
 * LAST) and keep the entered_at-day fallback only among themselves.
 */
const PARSED_DAY_SQL = `safe_rh_reading_day(date_updated_local)`;

export interface RhEventLike {
  rhauuid: string;
  dateUpdatedLocal: string | null;
  enteredAtUTC: Date | string | null;
  originSide?: string | null; // 'ship' | 'shore' | null (legacy)
}

/** Origin rank for ties: ship (0) beats legacy/unknown (1) beats shore (2). */
export function originRank(originSide: string | null | undefined): number {
  const o = (originSide || '').toLowerCase();
  if (o === 'ship') return 0;
  if (o === 'shore') return 2;
  return 1;
}

function enteredAtMs(e: RhEventLike): number {
  const v = e.enteredAtUTC instanceof Date ? e.enteredAtUTC : (e.enteredAtUTC ? new Date(String(e.enteredAtUTC)) : null);
  return v && !isNaN(v.getTime()) ? v.getTime() : 0;
}

/** Effective observed reading day: date_updated_local, else entered_at_utc day. */
export function effectiveReadingDay(e: RhEventLike): Date | null {
  const d = parseReadingDay(e.dateUpdatedLocal);
  if (d) return d;
  const ms = enteredAtMs(e);
  if (!ms) return null;
  const t = new Date(ms);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

/**
 * Canonical comparator. Returns >0 when `a` WINS over `b`, <0 when `b` wins.
 * Never returns 0 for rows with distinct rhauuid (stable total order).
 */
export function compareRhEvents(a: RhEventLike, b: RhEventLike): number {
  // Task #427: parseable reading dates ALWAYS beat unparseable ones (mirrors
  // the SQL `parsed day DESC NULLS LAST` ranking) — a malformed/garbage date
  // must never win purely because its row was entered recently.
  const pa = parseReadingDay(a.dateUpdatedLocal);
  const pb = parseReadingDay(b.dateUpdatedLocal);
  if (!!pa !== !!pb) return pa ? 1 : -1;
  const da = effectiveReadingDay(a)?.getTime() ?? -Infinity;
  const db = effectiveReadingDay(b)?.getTime() ?? -Infinity;
  if (da !== db) return da - db > 0 ? 1 : -1;
  const ra = originRank(a.originSide);
  const rb = originRank(b.originSide);
  if (ra !== rb) return rb - ra > 0 ? 1 : -1; // lower rank wins
  const ea = enteredAtMs(a);
  const eb = enteredAtMs(b);
  if (ea !== eb) return ea - eb > 0 ? 1 : -1;
  return a.rhauuid > b.rhauuid ? 1 : -1;
}

/* ────────────────── RH-LATEST-GUARD pure helpers (Task #417) ──────────────────
 * Used by the components ONE_WAY_SHORE_TO_SHIP applier; kept here (pure) so the
 * strip decision matrix is unit-testable. Both naming styles are listed because
 * incoming rows may be snake_case or camelCase.
 */
export const RH_GUARD_STRIP_COLUMNS = [
  'current_cumulative_rh', 'currentCumulativeRH',
  'rh_current_master', 'rhCurrentMaster', 'rh_master_updated_at', 'rhMasterUpdatedAt',
  'rh_master_update_source', 'rhMasterUpdateSource', 'last_updated', 'lastUpdated',
  'rh_current_inherited_cached', 'rhCurrentInheritedCached', 'rh_inherited_updated_at', 'rhInheritedUpdatedAt',
] as const;

/** Incoming RH stamp claim from a components row (master stamp, then inherited stamp, then last_updated). */
export function incomingRhStamp(row: Record<string, any>): any {
  return row['rh_master_updated_at'] ?? row['rhMasterUpdatedAt']
    ?? row['rh_inherited_updated_at'] ?? row['rhInheritedUpdatedAt']
    ?? row['last_updated'] ?? row['lastUpdated'];
}

/**
 * Strip decision: TRUE (preserve local RH columns) unless the incoming stamp's
 * day is STRICTLY newer than the local winning reading day. Equal-day → strip
 * (ship wins ties — Domain Team confirmed; the pre-#417 `<` let same-day shore
 * stamps overwrite the ship, causing the stale-revert regression).
 */
/**
 * The LOCAL RH claim day a sync guard should defend: the newer of the child's
 * own winning reading day and the local inherited-cache provenance stamp
 * (rh_inherited_updated_at). A master-arrival refresh can make the cache
 * NEWER than the child's own latest audit event — comparing only against the
 * child winner would let a stale shore row overwrite the fresher cache.
 */
export function localRhClaimDay(winnerDay: Date | null, localCacheStampRaw: any): Date | null {
  const cacheDay = localCacheStampRaw
    ? parseReadingDay(String(localCacheStampRaw instanceof Date ? localCacheStampRaw.toISOString() : localCacheStampRaw))
    : null;
  if (winnerDay && cacheDay) return winnerDay.getTime() >= cacheDay.getTime() ? winnerDay : cacheDay;
  return winnerDay ?? cacheDay ?? null;
}

export function shouldStripIncomingRh(incomingStampRaw: any, localWinnerDay: Date): boolean {
  const incomingDay = incomingStampRaw
    ? parseReadingDay(String(incomingStampRaw instanceof Date ? incomingStampRaw.toISOString() : incomingStampRaw))
    : null;
  return !incomingDay || incomingDay.getTime() <= localWinnerDay.getTime();
}

/* ────────────────────────── DB-backed helpers ──────────────────────────
 * `conn` is anything with .query(text, params) — a pool, client, or tx conn.
 */

/** Latest rotation date for a component (null when none / table absent). */
async function latestRotationDay(conn: any, componentId: string): Promise<Date | null> {
  try {
    const r = await conn.query(
      `SELECT MAX(rotation_date) AS latest FROM rotation_history WHERE component_id = $1 AND is_deleted = FALSE`,
      [componentId]
    );
    const v = r.rows[0]?.latest;
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  } catch {
    return null; // old schema — guard disabled, prior behaviour preserved
  }
}

export interface WinningRhEvent {
  rhauuid: string;
  rh: number;               // cumulative_rh || new_rh of the winner
  readingDay: Date;         // effective observed reading day
  dateUpdatedLocal: string | null;
  originSide: string | null;
}

/**
 * Select the winning (latest-reading) audit event for a component from the
 * LOCAL audit history, excluding deleted rows and pre-rotation readings.
 * SQL mirrors compareRhEvents exactly (reading day → ship-first → entered_at → rhauuid).
 */
export async function selectWinningRhEvent(conn: any, componentId: string): Promise<WinningRhEvent | null> {
  const rotDay = await latestRotationDay(conn, componentId);
  const params: any[] = [componentId];
  let rotClause = '';
  if (rotDay) {
    rotClause = ` AND ${READING_DAY_SQL} >= $2::date`;
    params.push(rotDay.toISOString().split('T')[0]);
  }
  // NULLS LAST is explicit policy: an unparseable/undatable row can never sort
  // first (entered_at_utc is NOT NULL in practice, so the COALESCE is non-null,
  // but the ordering stays safe even for degenerate rows).
  const r = await conn.query(
    `SELECT rhauuid, component_id, cumulative_rh, new_rh, date_updated_local, entered_at_utc, origin_side
       FROM running_hours_audit
      WHERE component_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
        AND (cumulative_rh IS NOT NULL OR new_rh IS NOT NULL)${rotClause}
      ORDER BY ${PARSED_DAY_SQL} DESC NULLS LAST,
               ${READING_DAY_SQL} DESC,
               (CASE WHEN lower(origin_side) = 'ship' THEN 0 WHEN origin_side IS NULL OR origin_side = '' THEN 1 ELSE 2 END) ASC,
               entered_at_utc DESC,
               rhauuid DESC
      LIMIT 1`,
    params
  );
  const row = r.rows[0];
  if (!row) return null;
  const rhRaw = row.cumulative_rh ?? row.new_rh;
  const rh = parseFloat(String(rhRaw));
  if (rhRaw === null || rhRaw === undefined || isNaN(rh)) return null;
  const day = effectiveReadingDay({
    rhauuid: row.rhauuid, dateUpdatedLocal: row.date_updated_local,
    enteredAtUTC: row.entered_at_utc, originSide: row.origin_side,
  });
  if (!day) return null;
  return { rhauuid: row.rhauuid, rh, readingDay: day, dateUpdatedLocal: row.date_updated_local, originSide: row.origin_side ?? null };
}

/**
 * ORDER-INDEPENDENT DERIVE: recompute the component's current RH state from
 * the full local audit history and write the WINNER (not any incoming value).
 * All three sync RH hooks (field-log apply, audit post-insert, receive-push)
 * call this — so component state can never diverge from history, no matter
 * which fragment of an event arrived, or in what order.
 * Returns true when the component was updated.
 */
export async function applyWinningRhToComponent(conn: any, componentId: string, context: string): Promise<boolean | 'unchanged'> {
  const winner = await selectWinningRhEvent(conn, componentId);
  if (!winner) return false;
  // last_updated (TEXT, highest read priority) carries the winner's CANONICAL
  // reading day (Task #427 policy: derive must never re-expose poisoned legacy
  // text into component stamps — the sync strip guards parse these stamps);
  // rh_master_updated_at carries the reading DAY — never entry/sync time
  // (backdate-guard poisoning protection, see rh-reading-date-vs-entry-time).
  const lastUpdatedText = canonicalReadingDay(winner.dateUpdatedLocal) || formatReadingDay(winner.readingDay);

  // Task #417: counter-type-aware derive. INHERITED components display
  // rh_current_inherited_cached (the MASTER's TOTAL = meter baseline + master
  // reading — cascade convention, see updateMasterRunningHours). The pre-#394
  // direct-apply sync kept that column in step; the derive rework only wrote
  // master columns, leaving inherited displays stale on the receiving side.
  let comp: any = null;
  try {
    const c = await conn.query(
      `SELECT id, rh_counter_type, rh_master_component_id, rh_counter_source,
              meter_replaced_last_rh, component_code, vessel_id,
              current_cumulative_rh, rh_current_inherited_cached, rh_inherited_updated_at, last_updated,
              rh_current_master, rh_master_updated_at
         FROM components WHERE cuuid = $1 LIMIT 1`,
      [componentId]
    );
    comp = c.rows[0] || null;
  } catch { /* pre-migration schema — fall through to legacy master-shaped update */ }

  const counterType = String(comp?.rh_counter_type || '').toUpperCase();
  // Legacy data may express the master relationship via rh_counter_source
  // instead of rh_master_component_id (same rule as getInheritedComponents).
  const masterRef = comp?.rh_master_component_id || comp?.rh_counter_source || null;

  if (counterType === 'INHERITED' && masterRef) {
    // Child's own winning event drives its individual hours (current_cumulative_rh).
    // The cache is derived from the MASTER's winning event + the master's meter
    // baseline — order-independent (audit history, not the master's component row).
    // No master winner → keep the existing cache AND its stamp (never blank it).
    let cache: string | null = null;
    let cacheDay: Date | null = null; // provenance: the MASTER winner's reading day
    try {
      // The master reference may hold the master's cuuid, its full id, or its
      // component CODE (legacy data — same resolution rule as the cascades /
      // runningHoursService). Non-cuuid matches are vessel-scoped: the same
      // code exists on every vessel.
      const m = await conn.query(
        `SELECT cuuid, meter_replaced_last_rh FROM components
          WHERE (cuuid = $1 OR ((component_code = $1 OR id = $1) AND vessel_id = $2))
            AND (is_deleted = false OR is_deleted IS NULL)
          ORDER BY (cuuid = $1) DESC LIMIT 1`,
        [masterRef, comp.vessel_id]
      );
      const master = m.rows[0];
      if (master) {
        const baseline = parseFloat(master.meter_replaced_last_rh || '0') || 0;
        const masterWinner = await selectWinningRhEvent(conn, master.cuuid);
        if (masterWinner) {
          cache = (baseline + masterWinner.rh).toFixed(2);
          cacheDay = masterWinner.readingDay;
        }
      }
    } catch (e: any) {
      console.log(`[RH-Derive:${context}] INHERITED cache lookup failed for master=${masterRef}: ${String(e?.message || e).substring(0, 120)} — cache preserved`);
    }
    // No-op skip: don't rewrite (and churn updated_at) when the derived state
    // already matches — keeps repeated derives and every startup self-heal cheap.
    const num = (v: any) => (v === null || v === undefined ? null : parseFloat(String(v)));
    const day = (v: any) => (v ? parseReadingDay(String(v instanceof Date ? v.toISOString() : v))?.getTime() ?? null : null);
    // rh_inherited_updated_at is the CACHE's provenance stamp — the MASTER
    // winner's reading day that produced the cache — NOT the child's own
    // reading day. When no master winner exists, both cache and stamp are
    // preserved so the stamp always describes the value it accompanies (the
    // sync guard compares incoming claims against this stamp).
    // last_updated policy (Task #427 convergence): the NEWER of the child's own
    // winner day and the master winner's day. The master-side children refresh
    // below only ADVANCES this stamp (never stomps a newer child day), so both
    // derive passes agree on the same final value — otherwise the startup
    // self-heal ping-pongs between master-day and child-day on every boot.
    const childLastUpdatedText =
      cacheDay && cacheDay.getTime() > winner.readingDay.getTime()
        ? formatReadingDay(cacheDay)
        : lastUpdatedText;
    const unchanged =
      num(comp.current_cumulative_rh) === num(winner.rh.toFixed(2)) &&
      (cache === null || num(comp.rh_current_inherited_cached) === num(cache)) &&
      (cacheDay === null || day(comp.rh_inherited_updated_at) === cacheDay.getTime()) &&
      String(comp.last_updated ?? '') === childLastUpdatedText;
    if (unchanged) {
      return 'unchanged';
    }
    await conn.query(
      `UPDATE components SET current_cumulative_rh = $1,
          rh_current_inherited_cached = COALESCE($2, rh_current_inherited_cached),
          rh_inherited_updated_at = COALESCE($3, rh_inherited_updated_at),
          last_updated = $4, updated_at = NOW()
        WHERE cuuid = $5`,
      [winner.rh.toFixed(2), cache, cacheDay, childLastUpdatedText, componentId]
    );
    console.log(`[RH-Derive:${context}] INHERITED component=${componentId} set to winner event ${winner.rhauuid} rh=${winner.rh} cache=${cache ?? 'preserved'} cacheDay=${cacheDay ? cacheDay.toISOString().split('T')[0] : 'preserved'} reading=${winner.readingDay.toISOString().split('T')[0]} origin=${winner.originSide || 'legacy'}`);
    return true;
  }

  // MASTER/legacy no-op check (Task #427): without it, extending the startup
  // self-heal to MASTERs would rewrite (and churn updated_at on) every master
  // on each boot. Same day-compare technique as the INHERITED branch above.
  const numM = (v: any) => (v === null || v === undefined ? null : parseFloat(String(v)));
  const dayM = (v: any) => (v ? parseReadingDay(String(v instanceof Date ? v.toISOString() : v))?.getTime() ?? null : null);
  const masterUnchanged = comp &&
    numM(comp.current_cumulative_rh) === numM(winner.rh.toFixed(2)) &&
    numM(comp.rh_current_master) === numM(winner.rh.toFixed(2)) &&
    dayM(comp.rh_master_updated_at) === winner.readingDay.getTime() &&
    String(comp.last_updated ?? '') === lastUpdatedText;
  if (!masterUnchanged) {
    await conn.query(
      `UPDATE components SET current_cumulative_rh = $1, rh_current_master = $1,
          rh_master_updated_at = $2, last_updated = $3, updated_at = NOW()
        WHERE cuuid = $4`,
      [winner.rh.toFixed(2), winner.readingDay, lastUpdatedText, componentId]
    );
    console.log(`[RH-Derive:${context}] component=${componentId} set to winner event ${winner.rhauuid} rh=${winner.rh} reading=${winner.readingDay.toISOString().split('T')[0]} origin=${winner.originSide || 'legacy'}`);
  }

  let childrenRefreshed = 0;
  // Task #417: a MASTER's winning event also refreshes its inherited children's
  // caches — covers arrival orders where the master's audit lands without (or
  // before) the child cascade rows. Same TOTAL convention as the cascades.
  if (counterType === 'MASTER') {
    try {
      const baseline = parseFloat(comp?.meter_replaced_last_rh || '0') || 0;
      const total = (baseline + winner.rh).toFixed(2);
      // Children may reference this master by cuuid, full id, or component CODE
      // via rh_master_component_id — or by CODE via legacy rh_counter_source
      // (same rule as getInheritedComponents). Non-cuuid matches vessel-scoped.
      const r = await conn.query(
        `UPDATE components SET rh_current_inherited_cached = $1,
            rh_inherited_updated_at = $2,
            -- Task #427 convergence: only ADVANCE the child's last_updated to the
            -- master's reading day; a child whose own reading day is newer keeps
            -- its stamp (the INHERITED derive stamps max(child day, master day)).
            last_updated = CASE
              WHEN safe_rh_reading_day(last_updated) IS NULL
                OR safe_rh_reading_day(last_updated) < ($2 AT TIME ZONE 'UTC')::date THEN $3
              ELSE last_updated END,
            updated_at = NOW()
          WHERE (rh_master_component_id = $4
                 OR (vessel_id = $6 AND (
                      ($5::text IS NOT NULL AND (rh_master_component_id = $5 OR rh_counter_source = $5))
                      OR ($7::text IS NOT NULL AND rh_master_component_id = $7))))
            AND upper(rh_counter_type) = 'INHERITED'
            AND (is_deleted = false OR is_deleted IS NULL)
            AND (rh_current_inherited_cached IS DISTINCT FROM $1::decimal
                 OR rh_inherited_updated_at IS DISTINCT FROM $2
                 OR ((safe_rh_reading_day(last_updated) IS NULL
                      OR safe_rh_reading_day(last_updated) < ($2 AT TIME ZONE 'UTC')::date)
                     AND last_updated IS DISTINCT FROM $3))`,
        [total, winner.readingDay, lastUpdatedText, componentId, comp?.component_code ?? null, comp?.vessel_id ?? null, comp?.id ?? null]
      );
      if (r.rowCount) {
        childrenRefreshed = r.rowCount;
        console.log(`[RH-Derive:${context}] master=${componentId} refreshed inherited cache on ${r.rowCount} child component(s) total=${total}`);
      }
    } catch (e: any) {
      console.log(`[RH-Derive:${context}] inherited-children cache refresh failed for master=${componentId}: ${String(e?.message || e).substring(0, 120)}`);
    }
  }
  // Strict no-op signal (Task #427): repeated derives/self-heals on converged
  // data must report zero updates so a second boot shows zero churn.
  if (masterUnchanged && childrenRefreshed === 0) return 'unchanged';
  return true;
}

/**
 * Task #417 SELF-HEAL: one-shot recompute of every INHERITED component's display
 * state from local audit history. Idempotent; components without a usable
 * winning event are never touched. Safe to run on every startup (cheap once
 * values converge), covers displays left stale by the pre-fix derive.
 */
export async function selfHealInheritedRhCaches(conn: any): Promise<{ scanned: number; healed: number }> {
  const r = await conn.query(
    `SELECT cuuid FROM components
      WHERE upper(rh_counter_type) = 'INHERITED'
        AND (rh_master_component_id IS NOT NULL OR rh_counter_source IS NOT NULL)
        AND (is_deleted = false OR is_deleted IS NULL)`
  );
  let healed = 0;
  for (const row of r.rows) {
    try {
      const res = await applyWinningRhToComponent(conn, row.cuuid, 'self-heal');
      if (res === true) healed++; // 'unchanged' = verified in sync, no write
    } catch (e: any) {
      console.log(`[RH-SelfHeal] component=${row.cuuid} failed: ${String(e?.message || e).substring(0, 120)}`);
    }
  }
  return { scanned: r.rows.length, healed };
}

export interface RhSelfHealMetrics {
  mastersScanned: number;
  childrenScanned: number;
  mastersHealed: number;
  childrenHealed: number;
  rhDecreases: number;
  errors: number;
  durationMs: number;
}

/**
 * Task #427 SELF-HEAL (masters + inherited): one-shot recompute of component RH
 * display state from local audit history via the hardened winner selection.
 * MASTERs are healed FIRST (their derive also refreshes children caches), then
 * INHERITED components recompute their own cumulative state. Idempotent: on
 * converged data every apply returns 'unchanged' → zero writes, zero churn.
 *
 * Metrics double as the winner-change report: every healed component is logged
 * individually by the derive, RH DECREASES are flagged specially (rotation-guard
 * interactions can legitimately lower displayed RH and must be auditable).
 */
export async function selfHealRhComponents(conn: any, opts?: { batchSize?: number; vesselId?: string }): Promise<RhSelfHealMetrics> {
  const started = Date.now();
  const batchSize = opts?.batchSize ?? 100;
  // Optional vessel scope (tests / targeted repair). Startup passes no scope.
  const vesselClause = opts?.vesselId ? ` AND vessel_id = $1` : '';
  const vesselParams = opts?.vesselId ? [opts.vesselId] : [];
  const metrics: RhSelfHealMetrics = {
    mastersScanned: 0, childrenScanned: 0, mastersHealed: 0, childrenHealed: 0,
    rhDecreases: 0, errors: 0, durationMs: 0,
  };

  const healSet = async (rows: any[], kind: 'master' | 'child') => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const oldRh = row.current_cumulative_rh !== null && row.current_cumulative_rh !== undefined
          ? parseFloat(String(row.current_cumulative_rh)) : null;
        const res = await applyWinningRhToComponent(conn, row.cuuid, 'self-heal');
        if (res === true) {
          if (kind === 'master') metrics.mastersHealed++; else metrics.childrenHealed++;
          // RH-decrease audit: re-read the derived value only for changed rows.
          const after = await conn.query(`SELECT current_cumulative_rh FROM components WHERE cuuid = $1`, [row.cuuid]);
          const newRh = after.rows?.[0]?.current_cumulative_rh != null ? parseFloat(String(after.rows[0].current_cumulative_rh)) : null;
          if (oldRh !== null && newRh !== null && newRh < oldRh) {
            metrics.rhDecreases++;
            console.warn(`[RH-SelfHeal] ⚠️ RH DECREASE on ${kind} ${row.component_code || row.cuuid}: ${oldRh} → ${newRh} (rotation-guard/winner change — audit if unexpected)`);
          }
        }
      } catch (e: any) {
        metrics.errors++;
        console.log(`[RH-SelfHeal] ${kind}=${row.cuuid} failed: ${String(e?.message || e).substring(0, 120)}`);
      }
      if ((i + 1) % batchSize === 0) {
        console.log(`[RH-SelfHeal] progress: ${i + 1}/${rows.length} ${kind}s processed`);
      }
    }
  };

  const masters = await conn.query(
    `SELECT cuuid, component_code, current_cumulative_rh FROM components
      WHERE upper(rh_counter_type) = 'MASTER'
        AND (is_deleted = false OR is_deleted IS NULL)${vesselClause}`,
    vesselParams
  );
  metrics.mastersScanned = masters.rows.length;
  await healSet(masters.rows, 'master');

  const children = await conn.query(
    `SELECT cuuid, component_code, current_cumulative_rh FROM components
      WHERE upper(rh_counter_type) = 'INHERITED'
        AND (rh_master_component_id IS NOT NULL OR rh_counter_source IS NOT NULL)
        AND (is_deleted = false OR is_deleted IS NULL)${vesselClause}`,
    vesselParams
  );
  metrics.childrenScanned = children.rows.length;
  await healSet(children.rows, 'child');

  metrics.durationMs = Date.now() - started;
  return metrics;
}

/**
 * LEGACY-SAFE BASELINE for WO-completion backdate pre-flights: prefer the
 * audit-derived latest reading day over the component's own stamps
 * (rh_master_updated_at / last_updated may be poisoned with entry time from
 * the old bug era). Falls back to the provided component stamp when there is
 * no usable audit history (e.g. fresh install).
 */
export async function resolveRhBaselineDay(conn: any, componentId: string, componentStampFallback: Date | null): Promise<Date | null> {
  try {
    const winner = await selectWinningRhEvent(conn, componentId);
    if (winner) return winner.readingDay;
  } catch { /* fall through to component stamp */ }
  if (componentStampFallback && !isNaN(componentStampFallback.getTime())) {
    return new Date(Date.UTC(
      componentStampFallback.getUTCFullYear(), componentStampFallback.getUTCMonth(), componentStampFallback.getUTCDate()
    ));
  }
  return null;
}

/* ────────────── WO-level double-apply claim (Task #243 scope) ──────────────
 * Atomic compare-and-set on work_orders.rh_synced_at: exactly ONE caller may
 * claim the right to apply a WO's RH reading; concurrent/replayed completions
 * see 0 rows and skip. On downstream failure the claim is released so a
 * corrected retry can apply.
 */
export async function claimWoRhSync(conn: any, wouuid: string): Promise<boolean> {
  const r = await conn.query(
    `UPDATE work_orders SET rh_synced_at = NOW() WHERE wouuid = $1 AND rh_synced_at IS NULL RETURNING wouuid`,
    [wouuid]
  );
  return r.rows.length > 0;
}

export async function releaseWoRhSync(conn: any, wouuid: string): Promise<void> {
  try {
    await conn.query(`UPDATE work_orders SET rh_synced_at = NULL WHERE wouuid = $1`, [wouuid]);
  } catch (e: any) {
    console.error(`[RH-Claim] release failed for WO ${wouuid}: ${e?.message || e}`);
  }
}
