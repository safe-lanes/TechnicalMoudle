/**
 * Survey Alert Evaluators (Step 2 MVP)
 *
 * Source: vessel_survey_data (LIVE table) via
 *   surveyRepository.getAllVesselSurveyData()
 * Friendly names resolved from ship_surveys_master by masterId.
 *
 * Three use cases:
 *   survey_due_soon       — "Survey Due Soon"        (0 <= daysDiff(due_date) <= leadDays)
 *   survey_window_closing — "Survey Window Closing"  (0 <= daysDiff(second_range_date) <= leadDays)
 *   survey_overdue        — "Survey Overdue"         (daysDiff(second_range_date ?? due_date) < 0)
 *
 * READ-ONLY. Dates are mixed-format text → parsed via parseWorkOrderDate.
 * Milestone-encoded dedupe keys → each milestone fires exactly once, ever.
 */

import type { AlertPolicy } from '@shared/schema';
import { parseWorkOrderDate } from '@shared/workOrders/dateParse';
import type { PmsDateAlert } from './certificateEvaluators';

export interface VesselSurveyRow {
  id: number;
  vesselId: string | null;
  vesselName?: string | null;
  masterId: string;
  dueDate: string | null;
  firstRangeDate: string | null;
  secondRangeDate: string | null;
  isDeleted?: boolean | null;
}

function daysDiffFrom(value: string | null | undefined): number | null {
  const parsed = parseWorkOrderDate(value);
  if (!parsed) return null;
  return Math.floor((parsed.getTime() - Date.now()) / 86400000);
}

export function evaluateSurveyDueSoon(
  rows: VesselSurveyRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>,
  nameByMasterId?: Map<string, string>,
): PmsDateAlert[] {
  const alerts: PmsDateAlert[] = [];
  const t = JSON.parse(policy.thresholds || '{}');
  const leadDays: number = typeof t.leadDays === 'number' ? t.leadDays : 30;

  for (const row of rows) {
    if (row.isDeleted === true) continue;
    if (!row.vesselId) continue;

    const d = daysDiffFrom(row.dueDate);
    if (d === null) {
      console.warn(`[survey_due_soon] unparseable due_date for survey row ${row.id}: "${row.dueDate}" — skipping`);
      continue;
    }
    if (d < 0 || d > leadDays) continue;

    const dedupeKey = `survey_due_soon:${row.id}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    const surveyName = nameByMasterId?.get(row.masterId) || row.masterId;
    alerts.push({
      dedupeKey,
      objectType: 'survey',
      objectId: String(row.id),
      vesselId: row.vesselId,
      state: 'due',
      priority: policy.priority,
      payload: {
        surveyName,
        masterId: row.masterId,
        vesselName: row.vesselName,
        dueDate: row.dueDate,
        daysToDue: d,
        alertMessage: `Survey "${surveyName}" is due in ${d} day(s) (on ${row.dueDate})`,
      },
    });
  }

  return alerts;
}

export function evaluateSurveyWindowClosing(
  rows: VesselSurveyRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>,
  nameByMasterId?: Map<string, string>,
): PmsDateAlert[] {
  const alerts: PmsDateAlert[] = [];
  const t = JSON.parse(policy.thresholds || '{}');
  const leadDays: number = typeof t.leadDays === 'number' ? t.leadDays : 30;

  for (const row of rows) {
    if (row.isDeleted === true) continue;
    if (!row.vesselId) continue;
    if (!row.secondRangeDate) continue; // window-closing only applies when window end exists

    const d = daysDiffFrom(row.secondRangeDate);
    if (d === null) {
      console.warn(`[survey_window_closing] unparseable second_range_date for survey row ${row.id}: "${row.secondRangeDate}" — skipping`);
      continue;
    }
    if (d < 0 || d > leadDays) continue;

    const dedupeKey = `survey_window_closing:${row.id}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    const surveyName = nameByMasterId?.get(row.masterId) || row.masterId;
    alerts.push({
      dedupeKey,
      objectType: 'survey',
      objectId: String(row.id),
      vesselId: row.vesselId,
      state: 'closing',
      priority: policy.priority,
      payload: {
        surveyName,
        masterId: row.masterId,
        vesselName: row.vesselName,
        secondRangeDate: row.secondRangeDate,
        daysToWindowClose: d,
        alertMessage: `Survey "${surveyName}" window closes in ${d} day(s) (on ${row.secondRangeDate})`,
      },
    });
  }

  return alerts;
}

export function evaluateSurveyOverdue(
  rows: VesselSurveyRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>,
  nameByMasterId?: Map<string, string>,
): PmsDateAlert[] {
  const alerts: PmsDateAlert[] = [];

  for (const row of rows) {
    if (row.isDeleted === true) continue;
    if (!row.vesselId) continue;

    const effective = row.secondRangeDate ?? row.dueDate;
    const d = daysDiffFrom(effective);
    if (d === null) {
      console.warn(`[survey_overdue] unparseable overdue date for survey row ${row.id}: "${effective}" — skipping`);
      continue;
    }
    if (d >= 0) continue;

    const dedupeKey = `survey_overdue:${row.id}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    const surveyName = nameByMasterId?.get(row.masterId) || row.masterId;
    alerts.push({
      dedupeKey,
      objectType: 'survey',
      objectId: String(row.id),
      vesselId: row.vesselId,
      state: 'overdue',
      priority: policy.priority,
      payload: {
        surveyName,
        masterId: row.masterId,
        vesselName: row.vesselName,
        effectiveDate: effective,
        daysOverdue: Math.abs(d),
        alertMessage: `Survey "${surveyName}" is overdue by ${Math.abs(d)} day(s) (was due ${effective})`,
      },
    });
  }

  return alerts;
}
