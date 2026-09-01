/**
 * SHORE COMPLETION LEARNER (Task: office WOs generated from stale job data).
 *
 * THE GAP THIS CLOSES: when the crew completes a WO on the ship, the ship's completion
 * service advances the job's tracking columns (last done / next due) LOCALLY. But `jobs`
 * and `job_component_links` sync ONE_WAY shore→ship, so the SHORE copy of the job never
 * learns about the completion — office job records go permanently stale, and the shore
 * WO sweep then generates months-overdue "phantom" WOs from them (598 of them on
 * 2026-08-05/06).
 *
 * THE FIX: when shore receives a ship push whose work_orders changes land a COMPLETED
 * status (field log or self-heal full row), recompute the linked job's cycle from the
 * received WO snapshot — using the SAME shared calculation the ship used
 * (computeJobCycleUpdates) — and advance shore's Job tracking columns.
 *
 * INVARIANTS:
 *  - Source of truth is the received WO snapshot's completion date + completion RH
 *    (wo_completion_rh ?? completion_rh ?? current_reading). NEVER shore component RH.
 *  - ADVANCE-ONLY, PER LEG: the calendar leg applies only when the WO completion date is
 *    newer than the job's local last-done date; the RH leg only when the completion RH is
 *    higher than the local last-done RH. Re-delivery of the same completion is a no-op;
 *    out-of-order older completions never regress tracking.
 *  - Runs inside the SAME transaction as the field-log apply (same client), with the job
 *    row locked (SELECT ... FOR UPDATE) against concurrent shore edits.
 *  - Failures are contained per-WO (savepoints) — learning must never sink a sync batch.
 *  - Shore-only by construction: receivePushData executes on the shore receiver.
 */
import type { PoolClient } from 'pg';
import { computeJobCycleUpdates } from '@shared/workOrders/jobCycleCalc';
import { parseWorkOrderDate } from '@shared/workOrders/dateParse';
import { isCompletedStatus } from '../../utils/workOrderStatus';
import { syncDiag } from './syncDiagLogger';

export interface LearnResult {
  candidates: number;
  jobsAdvanced: number;
  skipped: number;
  errors: number;
}

/**
 * Field logs → candidate wouuids: ANY applied work_orders change. The learner itself
 * checks the PERSISTED local status, so triggering broadly is safe (advance-only makes
 * re-runs no-ops) and closes the gap where a completion's fields are split across
 * batches (e.g. status lands in one push, date_completed / completion RH in a later
 * one — the later fields must re-trigger learning or shore tracking stays stale).
 */
export function collectCompletionWouuidsFromLogs(
  logs: Array<{ tableName: string; rowUuid: string; fieldName: string; newValue: string | null }>,
): string[] {
  const out = new Set<string>();
  for (const log of logs) {
    if (log.tableName === 'work_orders' && log.rowUuid) out.add(log.rowUuid);
  }
  return Array.from(out);
}

/** Self-heal full rows → candidate wouuids of ALL work_orders rows (learner filters by persisted status). */
export function collectCompletionWouuidsFromFullRows(
  tableName: string,
  rows: Array<Record<string, any>>,
): string[] {
  if (tableName !== 'work_orders') return [];
  const out = new Set<string>();
  for (const row of rows) {
    const wouuid = row.wouuid ?? row.Wouuid;
    if (wouuid) out.add(String(wouuid));
  }
  return Array.from(out);
}

function toDateMs(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const d = parseWorkOrderDate(String(v));
  return d && !isNaN(d.getTime()) ? d.getTime() : null;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v));
  return isNaN(n) ? null : n;
}

/**
 * PURE advance-only filter: strips the calendar and/or RH leg from the computed updates
 * when the local job values are already at least as new. Exported for unit tests.
 * Returns null when nothing survives (no-op).
 */
export function filterAdvanceOnly(
  localJob: { last_done_date?: any; last_done_rh?: any },
  jobUpdates: Record<string, any>,
): Record<string, any> | null {
  const ju = { ...jobUpdates };

  // Calendar leg — advance only when incoming lastDoneDate is strictly newer (or local unset).
  if (ju.lastDoneDate !== undefined) {
    const incoming = toDateMs(ju.lastDoneDate);
    const local = toDateMs(localJob.last_done_date);
    const advance = incoming !== null && (local === null || incoming > local);
    if (!advance) {
      delete ju.lastDoneDate; delete ju.nextDueDate;
    }
  }
  // RH leg — advance only when incoming lastDoneRH is strictly higher (or local unset).
  if (ju.lastDoneRH !== undefined) {
    const incoming = toNum(ju.lastDoneRH);
    const local = toNum(localJob.last_done_rh);
    const advance = incoming !== null && (local === null || incoming > local);
    if (!advance) {
      delete ju.lastDoneRH; delete ju.nextDueRH;
    }
  }
  return Object.keys(ju).length > 0 ? ju : null;
}

const COL_MAP: Record<string, string> = {
  lastDoneDate: 'last_done_date',
  nextDueDate: 'next_due_date',
  lastDoneRH: 'last_done_rh',
  nextDueRH: 'next_due_rh',
};

function buildSet(updates: Record<string, any>, startIdx: number): { sql: string; values: any[] } {
  const parts: string[] = [];
  const values: any[] = [];
  let i = startIdx;
  for (const [k, col] of Object.entries(COL_MAP)) {
    if (updates[k] !== undefined) {
      parts.push(`"${col}" = $${i++}`);
      values.push(String(updates[k]));
    }
  }
  parts.push(`updated_at = NOW()`);
  return { sql: parts.join(', '), values };
}

/**
 * Advance shore Job tracking for the given completed WO uuids.
 * MUST be called with the same client/transaction as the field-log apply.
 */
export async function learnFromShipCompletions(client: PoolClient, wouuids: string[]): Promise<LearnResult> {
  const result: LearnResult = { candidates: wouuids.length, jobsAdvanced: 0, skipped: 0, errors: 0 };
  // Every caller owns the surrounding transaction, but keep this guard local to the
  // learner as well so a future caller cannot field-log the derived Job projection
  // back to the vessel and create a sync loop.
  await client.query(`SET LOCAL sync.bypass_trigger = 'true'`);
  for (let i = 0; i < wouuids.length; i++) {
    const wouuid = wouuids[i];
    const sp = `learn_wo_${i}`;
    try {
      await client.query(`SAVEPOINT ${sp}`);
      const woRes = await client.query(
        `SELECT wouuid, status, job_id, vessel_id, maintenance_basis,
                date_completed, wo_completion_rh, completion_rh, current_reading,
                next_due_date, due_date, work_order_no
           FROM work_orders WHERE wouuid = $1 LIMIT 1`,
        [wouuid],
      );
      const wo = woRes.rows[0];
      if (!wo) {
        result.skipped++;
        syncDiag(`COMPLETION-LEARN SKIP: WO ${wouuid} is missing on shore`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        continue;
      }
      if (!isCompletedStatus(wo.status)) {
        result.skipped++;
        syncDiag(`COMPLETION-LEARN SKIP: WO ${wo.work_order_no || wouuid} is not completed (status=${wo.status || 'NULL'})`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        continue;
      }
      if (!wo.job_id) {
        result.skipped++;
        syncDiag(`COMPLETION-LEARN SKIP: completed WO ${wo.work_order_no || wouuid} has no job_id`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        continue;
      }

      // Row-lock the job against concurrent shore edits within this transaction.
      const jobRes = await client.query(
        `SELECT juuid, job_no, vessel_id, frequency_value, frequency_unit, interval_running_hour,
                last_done_date, last_done_rh
           FROM jobs WHERE juuid = $1 FOR UPDATE`,
        [wo.job_id],
      );
      const job = jobRes.rows[0];
      if (!job) {
        result.skipped++;
        syncDiag(`COMPLETION-LEARN SKIP: completed WO ${wo.work_order_no || wouuid} references missing Job ${wo.job_id}`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        continue;
      }
      if (wo.vessel_id && job.vessel_id && wo.vessel_id !== job.vessel_id) {
        result.skipped++;
        syncDiag(`COMPLETION-LEARN SKIP: WO ${wo.work_order_no || wouuid} vessel ${wo.vessel_id} does not match Job ${job.job_no} vessel ${job.vessel_id}`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        continue;
      }

      // Completion RH source chain mirrors the completion service (R1).
      const completionRH = wo.wo_completion_rh ?? wo.completion_rh ?? wo.current_reading;
      const { jobUpdates } = computeJobCycleUpdates({
        maintenanceBasis: wo.maintenance_basis,
        dateOfCompletion: wo.date_completed,
        completionRH: completionRH != null ? String(completionRH) : null,
        originalDueDate: wo.next_due_date || wo.due_date || null,
        job: {
          frequencyValue: job.frequency_value,
          frequencyUnit: job.frequency_unit,
          intervalRunningHour: job.interval_running_hour,
        },
      });

      const filtered = filterAdvanceOnly(job, jobUpdates);
      if (!filtered) {
        result.skipped++;
        syncDiag(`COMPLETION-LEARN SKIP: WO ${wo.work_order_no || wouuid} does not advance shore Job ${job.job_no}`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        continue;
      }

      const jobSet = buildSet(filtered, 2);
      await client.query(`UPDATE jobs SET ${jobSet.sql} WHERE juuid = $1`, [job.juuid, ...jobSet.values]);
      result.jobsAdvanced++;

      syncDiag(`COMPLETION-LEARN: WO ${wo.work_order_no || wouuid} advanced shore job ${job.job_no} → ${JSON.stringify(filtered)}`);
      await client.query(`RELEASE SAVEPOINT ${sp}`);
    } catch (err: any) {
      result.errors++;
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
      } catch { /* non-fatal */ }
      syncDiag(`COMPLETION-LEARN ERROR: WO ${wouuid}: ${String(err?.message || err).substring(0, 160)}`);
    }
  }
  if (wouuids.length > 0) {
    syncDiag(`COMPLETION-LEARN SUMMARY: candidates=${result.candidates} jobsAdvanced=${result.jobsAdvanced} skipped=${result.skipped} errors=${result.errors}`);
  }
  return result;
}
