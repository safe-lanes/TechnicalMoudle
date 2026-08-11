/**
 * DUAL-COMPLETION COLLISION RESOLVER (Task #399)
 *
 * THE CASE: the SAME work order is completed independently on both the vessel
 * and the office BEFORE any sync runs. Per-field last-writer-wins would then
 * silently interleave the two completions' fields (Last Done diverges, values
 * flip per field). This module detects the collision SEMANTICALLY in both sync
 * apply directions and:
 *
 *   1. Records each differing completion field in sync_conflict_log with
 *      conflict_kind = 'dual_completion' so it surfaces on the Sync Conflict
 *      Review screen (user picks which side's data to keep).
 *   2. Applies a DETERMINISTIC INTERIM value meanwhile: the completion with the
 *      LATER completion date wins all completion fields; exact-date tie → ship
 *      wins (same tie rule as running hours — business-confirmed). Both sides
 *      compare the same two dates with the same rule, so both converge to the
 *      same interim state regardless of sync order.
 *   3. Propagates the eventual user resolution: resolution field logs are
 *      stamped with changed_by_user_id = RESOLUTION_ACTOR; when such a log
 *      arrives, it is FORCE-applied (no stale-skip, no re-conflict) and the
 *      mirror conflict on the receiving side is marked resolved.
 *
 * RUNNING HOURS ARE NOT TOUCHED HERE: component RH always converges via the
 * audit-history derive (latest-reading-wins, rhEventComparator). This module
 * only governs the work_orders row's completion fields.
 *
 * TRIGGER RULE (user-confirmed): IF the same WO exists on both sides AND an
 * office completion was independently recorded AND a vessel completion was
 * independently recorded THEN conflict, ELSE normal sync. A single-side
 * completion never triggers this path — the local row must already be in a
 * completed status AND this receiver must hold its own LOCAL completion field
 * log for the row (proof the completion was recorded here, not synced in).
 */

import { isCompletedStatus } from '../../utils/workOrderStatus';
import { isShipInstanceId } from './syncRole';
import { parseReadingDay } from '../running-hours/rhEventComparator';
import { syncDiag } from './syncDiagLogger';

/** Actor marker on resolution field logs — lets the other side recognise and force-apply them. */
export const RESOLUTION_ACTOR = 'sync-conflict-resolution';

export const DUAL_COMPLETION_KIND = 'dual_completion';

/**
 * work_orders columns that together constitute "the completion". snake_case.
 * status is the trigger; the rest are the payload the user may want to pick
 * per side on the review screen.
 */
export const WO_COMPLETION_FIELDS_SNAKE = new Set<string>([
  'status',
  'date_completed',
  'completion_date_time',
  'performed_by',
  'completion_remarks',
  'completion_rh',
  'wo_completion_rh',
  'completion_rh_source',
  'completion_rh_validated',
  'completion_rh_validation_details',
  'rh_justification',
  'rh_justification_provided_by',
  'rh_justification_date',
  'rh_backdated_entry',
  'current_reading',
  'current_reading_date',
  'previous_reading',
  'reading_date',
]);

const snakeToCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
/** Both naming forms — sync_field_log stores fieldName as logged (camelCase), guards use snake. */
const COMPLETION_FIELD_NAME_VARIANTS: string[] = Array.from(WO_COMPLETION_FIELDS_SNAKE)
  .flatMap((f) => [f, snakeToCamel(f)]);

export function isWoCompletionField(fieldNameSnake: string): boolean {
  return WO_COMPLETION_FIELDS_SNAKE.has(fieldNameSnake);
}

/* ────────────────────────────── pure interim rule ────────────────────────────── */

export interface CompletionSide {
  /** Completion day text (date_completed / completion_date_time), parseable prefix YYYY-MM-DD. */
  completionDate: string | null;
  /** Whether this side is the ship instance. */
  isShip: boolean;
}

/**
 * Deterministic interim winner: later completion DAY wins; missing day loses to
 * a present day; tie (or both missing) → ship wins. Pure — both instances
 * evaluate the same inputs and reach the same answer in either sync order.
 */
export function chooseInterimSide(local: CompletionSide, incoming: CompletionSide): 'local' | 'incoming' {
  const ld = parseReadingDay(local.completionDate)?.getTime() ?? null;
  const id = parseReadingDay(incoming.completionDate)?.getTime() ?? null;
  if (ld !== null && id !== null && ld !== id) return ld > id ? 'local' : 'incoming';
  if (ld !== null && id === null) return 'local';
  if (ld === null && id !== null) return 'incoming';
  // tie or both missing → ship wins
  if (local.isShip !== incoming.isShip) return local.isShip ? 'local' : 'incoming';
  return 'local'; // degenerate (same side type) — keep receiver's value, stable on both ends
}

/**
 * Batch context: incoming completion day per work order, collected from the
 * batch's own work_orders logs (date_completed preferred, completion_date_time
 * fallback) so every field of the same WO gets the same interim decision.
 */
export function collectIncomingWoCompletionDates(
  logs: Array<{ tableName: string; rowUuid: string; fieldName: string; newValue: string | null }>,
): Map<string, string | null> {
  const primary = new Map<string, string>();
  const fallback = new Map<string, string>();
  for (const log of logs) {
    if (log.tableName !== 'work_orders' || !log.newValue) continue;
    const f = log.fieldName.includes('_') ? log.fieldName : log.fieldName.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
    if (f === 'date_completed') primary.set(log.rowUuid, log.newValue);
    else if (f === 'completion_date_time') fallback.set(log.rowUuid, log.newValue);
  }
  const out = new Map<string, string | null>();
  fallback.forEach((v, k) => out.set(k, v));
  primary.forEach((v, k) => out.set(k, v));
  return out;
}

/**
 * Which of the given work orders still have an OPEN dual-completion conflict.
 * Used to hold completion learning until EVERY field conflict of the WO is resolved
 * (a partially resolved completion is still interim — job tracking must not advance).
 */
export async function findWouuidsWithOpenDualConflicts(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  wouuids: string[],
): Promise<Set<string>> {
  if (wouuids.length === 0) return new Set();
  try {
    const res = await client.query(
      `SELECT DISTINCT row_uuid FROM sync_conflict_log
        WHERE conflict_kind = $1 AND table_name = 'work_orders'
          AND is_resolved = false AND row_uuid = ANY($2)`,
      [DUAL_COMPLETION_KIND, wouuids]
    );
    return new Set(res.rows.map((r: any) => String(r.row_uuid)));
  } catch (err: any) {
    syncDiag(`DUAL-COMPLETION OPEN-CONFLICT CHECK FAILED (treating none as open): ${String(err?.message || err).substring(0, 120)}`);
    return new Set();
  }
}

/* ────────────────────────────── DB-backed detection ────────────────────────────── */

export interface DualDecision {
  /** True when a dual-completion conflict governs this log — caller must skip the stale-skip guard. */
  dualConflict: boolean;
  /** When dualConflict: whether the incoming value is the interim winner and must be applied. */
  applyIncoming: boolean;
  /** True when the incoming log is a RESOLUTION log — force-apply, skip all guards. */
  remoteResolution: boolean;
}

const NOT_DUAL: DualDecision = { dualConflict: false, applyIncoming: true, remoteResolution: false };

export interface DualCompletionCtx {
  receiverInstanceId: string;
  batchUuid?: string | null;
  /** From collectIncomingWoCompletionDates over the batch's update logs. */
  incomingCompletionDateByRow?: Map<string, string | null>;
}

/**
 * Evaluate one incoming work_orders UPDATE-origin field log for the
 * dual-completion collision. Writes the conflict row itself (deduped while
 * unresolved). Never throws for detection problems — falls back to NOT_DUAL so
 * the pre-existing guards keep the old behaviour (fail-open to legacy path).
 */
export async function evaluateDualCompletion(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  log: {
    tableName: string; rowUuid: string; fieldName: string;
    oldValue: string | null | undefined; newValue: string | null | undefined;
    changedAt: Date; instanceId?: string | null; changedByUserId?: string | null;
  },
  ctx: DualCompletionCtx,
): Promise<DualDecision> {
  if (log.tableName !== 'work_orders') return NOT_DUAL;
  const fieldSnake = log.fieldName.includes('_')
    ? log.fieldName
    : log.fieldName.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
  if (!isWoCompletionField(fieldSnake)) return NOT_DUAL;

  try {
    // ── Resolution log from the other side: force-apply + resolve local mirror ──
    if (log.changedByUserId === RESOLUTION_ACTOR) {
      await client.query(
        `UPDATE sync_conflict_log
            SET is_resolved = true, resolved_at = NOW(),
                resolved_by = $1, resolved_action = 'REMOTE_RESOLUTION'
          WHERE conflict_kind = $2 AND table_name = 'work_orders'
            AND row_uuid = $3 AND field_name IN ($4, $5) AND is_resolved = false`,
        [RESOLUTION_ACTOR, DUAL_COMPLETION_KIND, log.rowUuid, log.fieldName, fieldSnake]
      );
      syncDiag(`DUAL-COMPLETION REMOTE-RESOLUTION: work_orders.${fieldSnake} row=${log.rowUuid} — force-applying resolved value, local mirror conflict closed`);
      return { dualConflict: false, applyIncoming: true, remoteResolution: true };
    }

    // ── Local row must already be completed ──
    const rowRes = await client.query(
      `SELECT status, date_completed, completion_date_time, "${fieldSnake}" AS current_value
         FROM work_orders WHERE wouuid = $1 LIMIT 1`,
      [log.rowUuid]
    );
    if (rowRes.rows.length === 0) return NOT_DUAL;
    const row = rowRes.rows[0];
    if (!isCompletedStatus(row.status)) return NOT_DUAL;

    // ── The incoming change must be part of a completion, not a reopen etc. ──
    if (fieldSnake === 'status' && !isCompletedStatus(log.newValue ?? null)) return NOT_DUAL;

    // ── Values agreeing is not a conflict ──
    const currentValue = row.current_value === null || row.current_value === undefined
      ? null : String(row.current_value);
    const incomingValue = log.newValue === null || log.newValue === undefined ? null : String(log.newValue);
    if (currentValue === incomingValue) return NOT_DUAL;
    // Numeric columns render "1150.00" while logs carry "1150" — equal numbers are NOT a conflict.
    if (currentValue !== null && incomingValue !== null) {
      const cn = Number(currentValue), inn = Number(incomingValue);
      if (currentValue.trim() !== '' && incomingValue.trim() !== '' &&
          Number.isFinite(cn) && Number.isFinite(inn) && cn === inn) return NOT_DUAL;
    }

    // ── Independence: this receiver must hold its OWN local completion log for the row ──
    const receiverId = ctx.receiverInstanceId;
    if (!receiverId || receiverId === 'UNKNOWN') return NOT_DUAL; // cannot prove independence
    if (log.instanceId && log.instanceId === receiverId) return NOT_DUAL; // same instance — not cross-side
    // COMPLETION-EPISODE PROOF: the receiver's LATEST local status log must itself set a
    // completed status. A historical local completion followed by reopen/re-complete leaves
    // a newer non-completed local status log (or the row is no longer completed — caught
    // above), so old episodes cannot false-positive a later ordinary remote completion.
    const localStatus = await client.query(
      `SELECT new_value, changed_at FROM sync_field_log
        WHERE table_name = 'work_orders' AND row_uuid = $1
          AND instance_id = $2 AND field_name IN ('status')
        ORDER BY changed_at DESC LIMIT 1`,
      [log.rowUuid, receiverId]
    );
    if (localStatus.rows.length === 0 || !isCompletedStatus(localStatus.rows[0].new_value)) {
      return NOT_DUAL; // no CURRENT local completion episode — completion came via sync or was reopened
    }
    const localCompletion = await client.query(
      `SELECT changed_at FROM sync_field_log
        WHERE table_name = 'work_orders' AND row_uuid = $1
          AND instance_id = $2 AND field_name = ANY($3)
        ORDER BY changed_at DESC LIMIT 1`,
      [log.rowUuid, receiverId, COMPLETION_FIELD_NAME_VARIANTS]
    );
    if (localCompletion.rows.length === 0) return NOT_DUAL; // completion arrived by sync, not recorded here

    // ── Dual completion confirmed for this field: record conflict (dedup while unresolved) ──
    const existing = await client.query(
      `SELECT id FROM sync_conflict_log
        WHERE conflict_kind = $1 AND table_name = 'work_orders'
          AND row_uuid = $2 AND field_name = $3 AND is_resolved = false LIMIT 1`,
      [DUAL_COMPLETION_KIND, log.rowUuid, log.fieldName]
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO sync_conflict_log
           (batch_uuid, table_name, row_uuid, field_name, conflict_kind,
            incoming_sender_instance, incoming_changed_at, incoming_old_value, incoming_new_value,
            receiver_winner_instance, receiver_winner_changed_at, receiver_current_value)
         VALUES ($1,'work_orders',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [ctx.batchUuid ?? null, log.rowUuid, log.fieldName, DUAL_COMPLETION_KIND,
         log.instanceId ?? null, log.changedAt, log.oldValue ?? null, incomingValue,
         receiverId, new Date(localCompletion.rows[0].changed_at), currentValue]
      );
    }

    // ── Deterministic interim: later completion day wins; tie → ship ──
    const localDate: string | null = row.date_completed || row.completion_date_time || null;
    const incomingDate = ctx.incomingCompletionDateByRow?.get(log.rowUuid)
      ?? (fieldSnake === 'date_completed' || fieldSnake === 'completion_date_time' ? incomingValue : null);
    const winner = chooseInterimSide(
      { completionDate: localDate, isShip: isShipInstanceId(receiverId) },
      { completionDate: incomingDate ?? null, isShip: log.instanceId ? isShipInstanceId(log.instanceId) : false },
    );
    const applyIncoming = winner === 'incoming';
    syncDiag(
      `DUAL-COMPLETION CONFLICT: work_orders.${fieldSnake} row=${log.rowUuid} — completed on BOTH sides ` +
      `(local ${localDate ?? 'no-date'} vs incoming ${incomingDate ?? 'no-date'}); interim=${winner}, ` +
      `${applyIncoming ? 'incoming value applied' : 'local value kept'}; recorded for review`
    );
    return { dualConflict: true, applyIncoming, remoteResolution: false };
  } catch (err: any) {
    // Detection must never break the apply loop — fall back to the legacy guards.
    syncDiag(`DUAL-COMPLETION DETECT ERROR (fail-open to legacy guards): work_orders.${fieldSnake} row=${log.rowUuid}: ${String(err?.message || err).substring(0, 150)}`);
    return NOT_DUAL;
  }
}
