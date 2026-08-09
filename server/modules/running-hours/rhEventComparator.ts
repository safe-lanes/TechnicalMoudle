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

/** Parse a reading-date text to a UTC-day Date, or null. */
export function parseReadingDay(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  if (m) {
    const d = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
    return isNaN(d.getTime()) ? null : d;
  }
  const p = new Date(String(dateStr));
  if (isNaN(p.getTime())) return null;
  return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()));
}

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
    rotClause = ` AND (CASE WHEN date_updated_local ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                        THEN substring(date_updated_local from 1 for 10)::date
                        ELSE entered_at_utc::date END) >= $2::date`;
    params.push(rotDay.toISOString().split('T')[0]);
  }
  const r = await conn.query(
    `SELECT rhauuid, component_id, cumulative_rh, new_rh, date_updated_local, entered_at_utc, origin_side
       FROM running_hours_audit
      WHERE component_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
        AND (cumulative_rh IS NOT NULL OR new_rh IS NOT NULL)${rotClause}
      ORDER BY (CASE WHEN date_updated_local ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                  THEN substring(date_updated_local from 1 for 10)::date
                  ELSE entered_at_utc::date END) DESC,
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
export async function applyWinningRhToComponent(conn: any, componentId: string, context: string): Promise<boolean> {
  const winner = await selectWinningRhEvent(conn, componentId);
  if (!winner) return false;
  // last_updated (TEXT, highest read priority) carries the user's reading date text;
  // rh_master_updated_at carries the reading DAY — never entry/sync time (backdate-guard
  // poisoning protection, see rh-reading-date-vs-entry-time).
  const lastUpdatedText = winner.dateUpdatedLocal || winner.readingDay.toISOString();
  await conn.query(
    `UPDATE components SET current_cumulative_rh = $1, rh_current_master = $1,
        rh_master_updated_at = $2, last_updated = $3, updated_at = NOW()
      WHERE cuuid = $4`,
    [winner.rh.toFixed(2), winner.readingDay, lastUpdatedText, componentId]
  );
  console.log(`[RH-Derive:${context}] component=${componentId} set to winner event ${winner.rhauuid} rh=${winner.rh} reading=${winner.readingDay.toISOString().split('T')[0]} origin=${winner.originSide || 'legacy'}`);
  return true;
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
