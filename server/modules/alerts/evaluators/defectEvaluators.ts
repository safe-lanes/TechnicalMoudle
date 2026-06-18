/**
 * Defect Alert Evaluators (Step 2 MVP)
 *
 * Source: storage.getDefects() (defects table).
 *
 * Two use cases:
 *   defect_overdue — active defect past its target_close_date
 *   defect_coc     — Condition-of-Class / Class defect raised (active)
 *
 * Step-1 corrections applied:
 *   - "DONE" set is casing/variant robust: lower(status) LIKE '%closed%' OR '%cancel%'
 *     (catches Closed, Verified & Closed, Cancelled). Active = NOT done.
 *   - COC signal = is_coc = true OR lower(source) = 'class' (no class data today → 0 matches,
 *     which is acceptable; fires when a real class defect appears).
 *
 * READ-ONLY. target_close_date is ISO text → parsed via parseWorkOrderDate.
 * Stable dedupe keys → each defect fires exactly once, ever.
 */

import type { AlertPolicy } from '@shared/schema';
import { parseWorkOrderDate } from '@shared/workOrders/dateParse';
import type { PmsDateAlert } from './certificateEvaluators';

export interface DefectRow {
  id: string;
  vesselId: string | null;
  vesselName?: string | null;
  description?: string | null;
  status: string | null;
  source?: string | null;
  category?: string | null;
  is_coc?: boolean | null;
  targetCloseDate?: string | null;
}

/** A defect is DONE (resolved) when its status contains 'closed' or 'cancel'. */
function isDone(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase();
  return s.includes('closed') || s.includes('cancel');
}

function defectLabel(row: DefectRow): string {
  const desc = (row.description || '').trim();
  if (!desc) return `Defect ${row.id}`;
  return desc.length > 80 ? `${desc.slice(0, 77)}...` : desc;
}

export function evaluateDefectOverdue(
  rows: DefectRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>,
): PmsDateAlert[] {
  const alerts: PmsDateAlert[] = [];

  for (const row of rows) {
    if (!row.vesselId) continue;
    if (isDone(row.status)) continue;
    if (!row.targetCloseDate) continue;

    const parsed = parseWorkOrderDate(row.targetCloseDate);
    if (!parsed) {
      console.warn(`[defect_overdue] unparseable target_close_date for defect ${row.id}: "${row.targetCloseDate}" — skipping`);
      continue;
    }
    const d = Math.floor((parsed.getTime() - Date.now()) / 86400000);
    if (d >= 0) continue;

    const dedupeKey = `defect_overdue:${row.id}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    const label = defectLabel(row);
    alerts.push({
      dedupeKey,
      objectType: 'defect',
      objectId: row.id,
      vesselId: row.vesselId,
      state: 'overdue',
      priority: policy.priority,
      payload: {
        defectId: row.id,
        title: label,
        vesselName: row.vesselName,
        status: row.status,
        targetCloseDate: row.targetCloseDate,
        daysOverdue: Math.abs(d),
        alertMessage: `Defect "${label}" is overdue by ${Math.abs(d)} day(s) (target ${row.targetCloseDate})`,
      },
    });
  }

  return alerts;
}

export function evaluateDefectCoc(
  rows: DefectRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>,
): PmsDateAlert[] {
  const alerts: PmsDateAlert[] = [];

  for (const row of rows) {
    if (!row.vesselId) continue;
    if (isDone(row.status)) continue;

    const isCoc = row.is_coc === true || (row.source || '').toLowerCase() === 'class';
    if (!isCoc) continue;

    const dedupeKey = `defect_coc:${row.id}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    const label = defectLabel(row);
    alerts.push({
      dedupeKey,
      objectType: 'defect',
      objectId: row.id,
      vesselId: row.vesselId,
      state: 'coc',
      priority: policy.priority,
      payload: {
        defectId: row.id,
        title: label,
        vesselName: row.vesselName,
        status: row.status,
        source: row.source,
        alertMessage: `COC / Class defect raised: "${label}"`,
      },
    });
  }

  return alerts;
}
