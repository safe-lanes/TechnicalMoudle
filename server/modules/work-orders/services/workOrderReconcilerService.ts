/**
 * WO DUPLICATE RECONCILER — resolves duplicate work-order numbers AFTER sync
 * (docs/WO-DUPLICATE-GENERATION-FIX-PLAN.md §9, approved by Sahil 2026-08-03).
 *
 * Under the dual-writer design (shore daily scheduler + ship scanner) both sides may
 * legitimately generate a work order for the same job; sync (wouuid-keyed, untouched)
 * delivers both. This service groups live rows by (vessel_id, work_order_no) and
 * resolves each group with the approved precedence — ALL CASES AUTO-RESOLVE:
 *
 *   1. exactly one copy touched  → the touched copy survives (content beats origin —
 *      Gas Mia measured ~50/50 on where crew work actually landed)
 *   2. neither touched           → the SHIP's copy survives (origin = instance_id on
 *      the earliest INSERT-origin field log, proven on the pilot; fallback when logs
 *      are pruned/absent: the earlier created_at survives)
 *   3. both touched              → the ship's copy survives; the office copy is
 *      ARCHIVED AND FLAGGED, never deleted — snapshot + survivor pointer in
 *      work_order_reconcile_archive answers "where did my approval go"
 *
 * The loser is SOFT-deleted with an explicit field log (work_orders writes are NOT
 * storage-logged — the postpone-sync lesson). Soft delete is self-heal-safe: the row
 * stays present on both sides, so the duplicate cannot be resurrected. Children are
 * repointed to the survivor, each repoint field-logged so the ship converges —
 * EXCEPT ihm_maintenance_log, which is LEFT IN PLACE (integer identity ids diverge
 * across sides; a repoint UPDATE mints phantom rows on the ship — proven 2026-08-03).
 *
 * Operational rules (§9.6): SHORE ONLY (both-sides runs would machine-generate real
 * conflicts on BOTH_EDITABLE children) · between syncs via the engine's per-vessel
 * lock · idempotent (losers leave the live set; archive is UNIQUE on loser_wouuid) ·
 * bounded per run · every action loud in console + syncDiag.
 */
import * as repo from '../repositories/workOrderReconcileRepository';
import { logFieldChanges } from '../../sync';
import { syncDiag } from '../../sync/syncDiagLogger';
import { getSyncEngine } from '../../sync/syncEngine';
import { isShipInstance } from '../../sync/syncRole';

const RECONCILE_ACTOR = 'wo-reconciler';
export const MAX_GROUPS_PER_VESSEL_PER_RUN = 50;

/** Persisted workflow statuses that mean a human has acted on the WO. */
const WORKFLOW_STATUSES = new Set([
  'completed', 'pending approval', 'postponed', 'rejected',
  'awaiting office approval', 'postponement approved', 'in progress',
]);

/**
 * Child tables that FOLLOW THE SURVIVOR. Two deliberate absences, both LEFT IN PLACE
 * on the archived loser and recorded in child_moves:
 *  - ihm_maintenance_log (§9.4): integer identity ids diverge across sides; a repoint
 *    UPDATE mints phantom rows on the ship — proven 2026-08-03.
 *  - component_maintenance_history: syncConfig `immutable: true` — a DB trigger
 *    hard-rejects ANY update ("Maintenance history records are immutable"), which the
 *    E2E hit live. History rows stay attached to the archived loser; the archive row
 *    says where they are. Consistent with the applier's own immutable handling.
 */
const REPOINT_TABLES: Array<{ table: string; fkColumn: string; idColumn: string; synced: boolean }> = [
  { table: 'work_order_documents',          fkColumn: 'work_order_id', idColumn: 'id',       synced: true },
  { table: 'work_order_executions',         fkColumn: 'template_id',   idColumn: 'id',       synced: true },
  { table: 'work_order_execution_details',  fkColumn: 'work_order_id', idColumn: 'woeduuid', synced: true },
  { table: 'work_order_postponements',      fkColumn: 'work_order_id', idColumn: 'id',       synced: true },
  { table: 'superintendent_notifications',  fkColumn: 'work_order_id', idColumn: 'snuuid',   synced: true },
  { table: 'wo_postponement_approvals',     fkColumn: 'work_order_id', idColumn: 'wpauuid',  synced: true },
  // NO_SYNC local bookkeeping — repointed so shore views stay correct; no field log.
  { table: 'work_order_anomalies',          fkColumn: 'work_order_id', idColumn: 'id',       synced: false },
];

/** Left-in-place tables: counted for the archive record, never written. */
const LEFT_IN_PLACE_TABLES: Array<{ table: string; fkColumn: string; reason: string }> = [
  { table: 'ihm_maintenance_log',           fkColumn: 'work_order_id', reason: 'serial-id repoint mints phantoms on ship (§9.4)' },
  { table: 'component_maintenance_history', fkColumn: 'work_order_id', reason: 'immutable by DB trigger' },
];

export interface ReconcileResult {
  vesselId: string;
  groupsSeen: number;
  resolved: { case1: number; case2: number; case3: number };
  skippedUnresolvable: number;
  remainingGroups: number;
  lockBusy: boolean;
  errors: string[];
}

export interface ReconcileRunSummary {
  startedAt: string;
  finishedAt: string;
  vessels: ReconcileResult[];
}

let lastRun: ReconcileRunSummary | null = null;
export function getLastRunSummary(): ReconcileRunSummary | null { return lastRun; }

function isNonEmpty(v: any): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== '' && s !== '[]' && s !== '{}' && s.toLowerCase() !== 'null';
}

/** "Touched" per plan §9.2 — any evidence a human worked this copy. */
async function isTouched(row: any): Promise<boolean> {
  if (isNonEmpty(row.approver) || isNonEmpty(row.submitted_date) || isNonEmpty(row.date_completed) ||
      isNonEmpty(row.work_carried_out) || isNonEmpty(row.performed_by) || isNonEmpty(row.manhours)) {
    return true;
  }
  const consumed = row.consumed_spare_parts;
  if (Array.isArray(consumed) ? consumed.length > 0 : isNonEmpty(consumed)) return true;
  if (WORKFLOW_STATUSES.has(String(row.status || '').toLowerCase().trim())) return true;
  return await repo.hasDocuments(row.wouuid);
}

/**
 * Resolve one duplicate group: pick the survivor, archive+retire every other row.
 * Returns the resolution case, or null when the group must be left alone.
 */
async function resolveGroup(
  group: repo.DuplicateGroup,
  shipInstanceIds: Set<string>,
): Promise<{ resolutionCase: 1 | 2 | 3 } | null> {
  const flags = await Promise.all(group.rows.map(isTouched));
  const touched = group.rows.filter((_, i) => flags[i]);

  let survivor: any;
  let resolutionCase: 1 | 2 | 3;
  let caseNote = '';

  if (touched.length === 1) {
    resolutionCase = 1;
    survivor = touched[0];
  } else {
    // 0 touched → case 2; ≥2 touched → case 3. Ship's copy wins in both; the split is
    // recorded because case 3 is the one support gets asked about.
    resolutionCase = touched.length === 0 ? 2 : 3;
    const pool = touched.length >= 2 ? touched : group.rows;
    const origins = await Promise.all(pool.map(r => repo.getInsertOriginInstanceId(r.wouuid)));
    const shipRows = pool.filter((_, i) => origins[i] !== null && shipInstanceIds.has(origins[i]!));
    if (shipRows.length > 0) {
      survivor = shipRows[0]; // ascending created_at → earliest ship copy
    } else {
      // Origin unknowable (logs pruned/absent) — §9.2 fallback: earliest created_at.
      survivor = pool[0];
      caseNote = 'origin-logs-absent: fell back to earliest created_at';
    }
  }

  for (const loser of group.rows) {
    if (loser.wouuid === survivor.wouuid) continue;

    const childMoves: Record<string, any> = {};
    for (const spec of REPOINT_TABLES) {
      const movedIds = await repo.repointChildren(spec.table, spec.fkColumn, spec.idColumn, loser.wouuid, survivor.wouuid);
      if (movedIds.length === 0) continue;
      childMoves[spec.table] = { moved: movedIds.length };
      if (spec.synced) {
        for (const logId of movedIds) {
          await logFieldChanges(spec.table, logId, group.vesselId,
            { [spec.fkColumn]: loser.wouuid }, { [spec.fkColumn]: survivor.wouuid }, RECONCILE_ACTOR);
        }
      }
    }
    let leftInPlaceTotal = 0;
    for (const spec of LEFT_IN_PLACE_TABLES) {
      const n = await repo.countChildRows(spec.table, spec.fkColumn, loser.wouuid);
      if (n > 0) { childMoves[spec.table] = { left_in_place: n, reason: spec.reason }; leftInPlaceTotal += n; }
    }

    // Archive BEFORE retiring — if the archive insert fails, the row stays live and the
    // next run retries. UNIQUE(loser_wouuid) makes a replayed loser a no-op.
    await repo.insertArchiveRow({
      vesselId: group.vesselId,
      workOrderNo: group.workOrderNo,
      loserWouuid: loser.wouuid,
      survivorWouuid: survivor.wouuid,
      resolutionCase,
      loserRowSnapshot: loser,
      childMoves,
      notes: caseNote || null,
    });

    await repo.softDeleteWorkOrder(loser.wouuid);
    await logFieldChanges('work_orders', loser.wouuid, group.vesselId,
      { is_deleted: false }, { is_deleted: true }, RECONCILE_ACTOR);

    const line = `[WO-Reconciler] case ${resolutionCase}: ${group.workOrderNo} — loser ${loser.wouuid.slice(0, 8)} archived+retired, ` +
      `survivor ${survivor.wouuid.slice(0, 8)}, children moved: ${Object.keys(childMoves).filter(k => !childMoves[k].left_in_place).join(', ') || 'none'}` +
      (leftInPlaceTotal > 0 ? `, left-in-place: ${leftInPlaceTotal}` : '') + (caseNote ? ` (${caseNote})` : '');
    console.log(line);
    syncDiag(`WO-RECONCILE case=${resolutionCase} vessel=${group.vesselId} no=${group.workOrderNo} loser=${loser.wouuid} survivor=${survivor.wouuid}${caseNote ? ` note=${caseNote}` : ''}`);
  }

  return { resolutionCase };
}

/** Reconcile one vessel. Skips (lockBusy) when sync holds the vessel — next run catches up. */
export async function reconcileVessel(vesselId: string): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    vesselId, groupsSeen: 0, resolved: { case1: 0, case2: 0, case3: 0 },
    skippedUnresolvable: 0, remainingGroups: 0, lockBusy: false, errors: [],
  };

  if (await isShipInstance()) {
    // §9.6: SHORE ONLY. A ship-side run would fight the shore run on BOTH_EDITABLE children.
    result.errors.push('refused: reconciler is shore-only');
    return result;
  }

  const engine = getSyncEngine();
  if (!engine.tryAcquireVessel(vesselId)) {
    result.lockBusy = true;
    syncDiag(`WO-RECONCILE SKIP vessel=${vesselId} — sync in progress (lock busy)`);
    return result;
  }

  try {
    const shipInstanceIds = await repo.getShipInstanceIds(vesselId);
    const groups = await repo.findDuplicateGroups(vesselId, MAX_GROUPS_PER_VESSEL_PER_RUN);
    result.groupsSeen = groups.length;

    for (const group of groups) {
      try {
        const r = await resolveGroup(group, shipInstanceIds);
        if (r) result.resolved[`case${r.resolutionCase}` as 'case1' | 'case2' | 'case3']++;
        else result.skippedUnresolvable++;
      } catch (err: any) {
        result.errors.push(`${group.workOrderNo}: ${err?.message || err}`);
        console.error(`[WO-Reconciler] ERROR on ${group.workOrderNo}:`, err?.message || err);
      }
    }

    result.remainingGroups = await repo.countDuplicateGroups(vesselId);
    if (result.remainingGroups > 0) {
      // No silent caps: name what was left for the next run.
      console.log(`[WO-Reconciler] vessel ${vesselId}: ${result.remainingGroups} duplicate group(s) remain — picked up next run (cap ${MAX_GROUPS_PER_VESSEL_PER_RUN}/run)`);
    }
  } finally {
    engine.releaseVessel(vesselId); // always — a stuck vessel lock starves sync itself
  }
  return result;
}

/** Reconcile every provisioned vessel (the dual-writer set). Used by the daily sweep. */
export async function reconcileAllProvisionedVessels(): Promise<ReconcileRunSummary> {
  const startedAt = new Date().toISOString();
  const vessels = await repo.getProvisionedVesselIds();
  const results: ReconcileResult[] = [];
  for (const v of vessels) {
    try {
      results.push(await reconcileVessel(v));
    } catch (err: any) {
      results.push({
        vesselId: v, groupsSeen: 0, resolved: { case1: 0, case2: 0, case3: 0 },
        skippedUnresolvable: 0, remainingGroups: -1, lockBusy: false,
        errors: [String(err?.message || err)],
      });
    }
  }
  lastRun = { startedAt, finishedAt: new Date().toISOString(), vessels: results };
  const totals = results.reduce((a, r) => a + r.resolved.case1 + r.resolved.case2 + r.resolved.case3, 0);
  console.log(`[WO-Reconciler] sweep done: ${vessels.length} provisioned vessel(s), ${totals} duplicate(s) resolved`);
  return lastRun;
}
