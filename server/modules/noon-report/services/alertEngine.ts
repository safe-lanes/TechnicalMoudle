// ====== NOON REPORT MODULE — Alert Engine ======
// Called by calculationEngine.ts Phase 2 after KPI updates are persisted.
// Evaluates 7 rules against the newly submitted report and creates/auto-resolves
// alerts in the nr_alerts table.

import { getDb } from '../../../db';
import {
  nrNoonReports,
  nrFuelRob,
  nrCiiTracking,
  nrAlerts,
} from '@shared/schema';
import type { NrNoonReport, AlertType } from '@shared/schema';
import { eq, and, isNull, ne, desc, inArray } from 'drizzle-orm';
import { ALERT_THRESHOLDS, FUEL_TYPES } from '../utils/fuelConversionFactors';

// CII rating severity order (A = best, E = worst)
const CII_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

// Alert types that the system auto-resolves when condition clears
const AUTO_RESOLVE_TYPES: AlertType[] = [
  'HIGH_CONSUMPTION',
  'VERY_HIGH_CONSUMPTION',
  'LOW_ROB',
  'CRITICAL_ROB',
];

// ── Public entry point ────────────────────────────────────────────────────────

export async function generateAlerts(report: NrNoonReport): Promise<void> {
  const [consumed, cleared] = await Promise.all([
    evaluateRules(report),
    autoResolveCleared(report),
  ]);
  void cleared; // result not used — auto-resolve is fire-and-forget
  void consumed;
}

// ── Rule evaluation ───────────────────────────────────────────────────────────

async function evaluateRules(report: NrNoonReport): Promise<void> {
  await Promise.allSettled([
    ruleConsumptionSpike(report),
    ruleRobEndurance(report),
    ruleAeHoursSpike(report),
    ruleCiiBandDrop(report),
    ruleNegativeRobRisk(report),
  ]);
}

// ── Rule: HIGH_CONSUMPTION / VERY_HIGH_CONSUMPTION ───────────────────────────
// Compare today's total consumption vs the 7-day rolling average already in
// nr_fuel_rob (written by Phase 1). Trigger if > +15% (warning) or > +25% (critical).

async function ruleConsumptionSpike(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  // Sum today's total consumption from the report fields
  const todayTotal =
    (toNum(report.hfoConsumption) ?? 0) +
    (toNum(report.lsmgoConsumption) ?? 0) +
    (toNum(report.mgoConsumption) ?? 0) +
    (toNum(report.vlsfoConsumption) ?? 0) +
    (toNum(report.lpgConsumption) ?? 0);

  if (todayTotal <= 0) return;

  // Fetch 7-day averages from nr_fuel_rob
  const robRows = await db.select()
    .from(nrFuelRob)
    .where(eq(nrFuelRob.vesselId, report.vesselId));

  const avg7Day = robRows
    .map(r => toNum(r.avg7Day) ?? 0)
    .reduce((a, b) => a + b, 0);

  if (avg7Day <= 0) return; // not enough history

  const pctAbove = (todayTotal - avg7Day) / avg7Day;

  if (pctAbove >= ALERT_THRESHOLDS.consumptionSpike.critical) {
    // Escalated to critical — resolve any open warning-tier alert first to avoid contradictory active alerts
    await resolveOpenAlert(report.vesselId, 'HIGH_CONSUMPTION');
    await upsertAlert(report.vesselId, report.id, 'VERY_HIGH_CONSUMPTION', 'critical',
      `Total fuel consumption is ${(pctAbove * 100).toFixed(1)}% above the 7-day average ` +
      `(${todayTotal.toFixed(2)} mt vs avg ${avg7Day.toFixed(2)} mt).`,
      todayTotal, avg7Day * (1 + ALERT_THRESHOLDS.consumptionSpike.critical));
  } else if (pctAbove >= ALERT_THRESHOLDS.consumptionSpike.warning) {
    // Warning tier — resolve any open critical-tier alert (de-escalation) first
    await resolveOpenAlert(report.vesselId, 'VERY_HIGH_CONSUMPTION');
    await upsertAlert(report.vesselId, report.id, 'HIGH_CONSUMPTION', 'warning',
      `Total fuel consumption is ${(pctAbove * 100).toFixed(1)}% above the 7-day average ` +
      `(${todayTotal.toFixed(2)} mt vs avg ${avg7Day.toFixed(2)} mt).`,
      todayTotal, avg7Day * (1 + ALERT_THRESHOLDS.consumptionSpike.warning));
  }
}

// ── Rule: LOW_ROB / CRITICAL_ROB ─────────────────────────────────────────────
// Check total endurance (all-fuel ROBs / total 7-day avg consumption).
// Trigger LOW_ROB if < 10 days; CRITICAL_ROB if < 5 days.

async function ruleRobEndurance(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  const robRows = await db.select()
    .from(nrFuelRob)
    .where(eq(nrFuelRob.vesselId, report.vesselId));

  const totalRob = robRows.map(r => toNum(r.currentRob) ?? 0).reduce((a, b) => a + b, 0);
  const totalAvg7Day = robRows.map(r => toNum(r.avg7Day) ?? 0).reduce((a, b) => a + b, 0);

  if (totalAvg7Day <= 0) return;

  const enduranceDays = totalRob / totalAvg7Day;

  if (enduranceDays < ALERT_THRESHOLDS.enduranceDays.critical) {
    // Critical tier — resolve any open warning-tier alert first
    await resolveOpenAlert(report.vesselId, 'LOW_ROB');
    await upsertAlert(report.vesselId, report.id, 'CRITICAL_ROB', 'critical',
      `Combined fuel endurance is critically low: ${enduranceDays.toFixed(1)} days remaining ` +
      `(total ROB ${totalRob.toFixed(1)} mt, avg daily consumption ${totalAvg7Day.toFixed(2)} mt/day).`,
      enduranceDays, ALERT_THRESHOLDS.enduranceDays.critical);
  } else if (enduranceDays < ALERT_THRESHOLDS.enduranceDays.warning) {
    // Warning tier — resolve any open critical-tier alert (de-escalation) first
    await resolveOpenAlert(report.vesselId, 'CRITICAL_ROB');
    await upsertAlert(report.vesselId, report.id, 'LOW_ROB', 'warning',
      `Combined fuel endurance is low: ${enduranceDays.toFixed(1)} days remaining ` +
      `(total ROB ${totalRob.toFixed(1)} mt, avg daily consumption ${totalAvg7Day.toFixed(2)} mt/day).`,
      enduranceDays, ALERT_THRESHOLDS.enduranceDays.warning);
  }
}

// ── Rule: AE_HOURS_SPIKE ─────────────────────────────────────────────────────
// Compare today's aeRunningHours vs the avg of the last 7 *prior* submitted reports.
// The current report is explicitly excluded by filtering id != report.id.
// Skip if fewer than aeMinDataPoints data points are available in the baseline.

async function ruleAeHoursSpike(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  const currentAeHours = toNum(report.aeRunningHours);
  if (currentAeHours === null || currentAeHours <= 0) return;

  // Fetch up to 7 prior submitted reports for this vessel, excluding current report by ID
  const prior = await db.select({ aeRunningHours: nrNoonReports.aeRunningHours })
    .from(nrNoonReports)
    .where(and(
      eq(nrNoonReports.vesselId, report.vesselId),
      eq(nrNoonReports.status, 'submitted'),
      ne(nrNoonReports.id, report.id),
    ))
    .orderBy(desc(nrNoonReports.reportDate))
    .limit(7);

  const priorHours = prior
    .map(r => toNum(r.aeRunningHours))
    .filter((v): v is number => v !== null && v > 0);

  if (priorHours.length < ALERT_THRESHOLDS.aeMinDataPoints) return;

  const avgAeHours = priorHours.reduce((a, b) => a + b, 0) / priorHours.length;
  if (avgAeHours <= 0) return;

  const pctAbove = (currentAeHours - avgAeHours) / avgAeHours;

  if (pctAbove >= ALERT_THRESHOLDS.aeHoursSpike.warning) {
    await upsertAlert(report.vesselId, report.id, 'AE_HOURS_SPIKE', 'warning',
      `Auxiliary engine running hours spiked ${(pctAbove * 100).toFixed(1)}% above the 7-report average ` +
      `(${currentAeHours.toFixed(1)} h vs avg ${avgAeHours.toFixed(1)} h).`,
      currentAeHours, avgAeHours * (1 + ALERT_THRESHOLDS.aeHoursSpike.warning));
  }
}

// ── Rule: CII_BAND_DROP ───────────────────────────────────────────────────────
// Detect when the YTD CII rating worsened compared to the previous update.
// Reads previousCiiRating written by computeCiiTracking in Phase 1.

async function ruleCiiBandDrop(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  const year = new Date(report.reportDate).getFullYear();
  const ciiRows = await db.select()
    .from(nrCiiTracking)
    .where(and(eq(nrCiiTracking.vesselId, report.vesselId), eq(nrCiiTracking.year, year)))
    .limit(1);

  const row = ciiRows[0] ?? null;
  if (!row || !row.ciiRating || !row.previousCiiRating) return;

  const prevOrder = CII_ORDER[row.previousCiiRating] ?? 0;
  const newOrder = CII_ORDER[row.ciiRating] ?? 0;

  if (newOrder > prevOrder) {
    await upsertAlert(report.vesselId, report.id, 'CII_BAND_DROP', 'critical',
      `YTD CII rating deteriorated from ${row.previousCiiRating} to ${row.ciiRating}. ` +
      `Immediate action may be required to improve efficiency.`,
      newOrder, prevOrder);
  }
}

// ── Rule: NEGATIVE_ROB_RISK ───────────────────────────────────────────────────
// Check if any reported ROB field was negative (indicating data error or over-consumption).

async function ruleNegativeRobRisk(report: NrNoonReport): Promise<void> {
  const robFields: Array<{ type: string; value: string | null | undefined }> = [
    { type: 'HFO',   value: report.hfoRob },
    { type: 'LSMGO', value: report.lsmgoRob },
    { type: 'MGO',   value: report.mgoRob },
    { type: 'VLSFO', value: report.vlsfoRob },
    { type: 'LPG',   value: report.lpgRob },
  ];

  const negatives = robFields.filter(f => {
    const v = toNum(f.value);
    return v !== null && v < 0;
  });

  if (negatives.length === 0) return;

  const typeList = negatives.map(f => f.type).join(', ');
  const minRob = Math.min(...negatives.map(f => toNum(f.value)!));

  await upsertAlert(report.vesselId, report.id, 'NEGATIVE_ROB_RISK', 'critical',
    `Reported ROB for ${typeList} is negative (minimum: ${minRob.toFixed(2)} mt). ` +
    `Please verify consumption figures and bunkering records.`,
    minRob, 0);
}

// ── Auto-resolve cleared alerts ───────────────────────────────────────────────
// For types that the system can auto-resolve, acknowledge existing open alerts
// when the triggering condition has cleared.

async function autoResolveCleared(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  const robRows = await db.select()
    .from(nrFuelRob)
    .where(eq(nrFuelRob.vesselId, report.vesselId));

  const totalRob = robRows.map(r => toNum(r.currentRob) ?? 0).reduce((a, b) => a + b, 0);
  const totalAvg7Day = robRows.map(r => toNum(r.avg7Day) ?? 0).reduce((a, b) => a + b, 0);
  const enduranceDays = totalAvg7Day > 0 ? totalRob / totalAvg7Day : null;

  const todayTotal =
    (toNum(report.hfoConsumption) ?? 0) +
    (toNum(report.lsmgoConsumption) ?? 0) +
    (toNum(report.mgoConsumption) ?? 0) +
    (toNum(report.vlsfoConsumption) ?? 0) +
    (toNum(report.lpgConsumption) ?? 0);

  const pctAbove = totalAvg7Day > 0 ? (todayTotal - totalAvg7Day) / totalAvg7Day : null;

  const toResolve: AlertType[] = [];

  // Consumption cleared
  if (pctAbove !== null && pctAbove < ALERT_THRESHOLDS.consumptionSpike.critical) {
    toResolve.push('VERY_HIGH_CONSUMPTION');
  }
  if (pctAbove !== null && pctAbove < ALERT_THRESHOLDS.consumptionSpike.warning) {
    toResolve.push('HIGH_CONSUMPTION');
  }

  // Endurance cleared
  if (enduranceDays !== null && enduranceDays >= ALERT_THRESHOLDS.enduranceDays.critical) {
    toResolve.push('CRITICAL_ROB');
  }
  if (enduranceDays !== null && enduranceDays >= ALERT_THRESHOLDS.enduranceDays.warning) {
    toResolve.push('LOW_ROB');
  }

  if (toResolve.length === 0) return;

  await db.update(nrAlerts)
    .set({
      acknowledgedAt: new Date(),
      acknowledgedBy: 'system',
    })
    .where(and(
      eq(nrAlerts.vesselId, report.vesselId),
      isNull(nrAlerts.acknowledgedAt),
      inArray(nrAlerts.alertType, toResolve),
    ));
}

// ── Resolve a single open alert of a given type (used for tier-switching) ────
// Marks the alert as system-acknowledged without permanently deleting it.

async function resolveOpenAlert(vesselId: string, alertType: AlertType): Promise<void> {
  const db = await getDb();
  await db.update(nrAlerts)
    .set({ acknowledgedAt: new Date(), acknowledgedBy: 'system' })
    .where(and(
      eq(nrAlerts.vesselId, vesselId),
      eq(nrAlerts.alertType, alertType),
      isNull(nrAlerts.acknowledgedAt),
    ));
}

// ── Upsert alert (insert if no active alert of this type, otherwise update message) ──

async function upsertAlert(
  vesselId: string,
  reportId: number,
  alertType: AlertType,
  severity: 'warning' | 'critical',
  message: string,
  metricValue: number | null,
  thresholdValue: number | null,
): Promise<void> {
  const db = await getDb();
  // Check for an existing open (unacknowledged) alert of the same type for this vessel
  const existing = await db.select({ id: nrAlerts.id })
    .from(nrAlerts)
    .where(and(
      eq(nrAlerts.vesselId, vesselId),
      eq(nrAlerts.alertType, alertType),
      isNull(nrAlerts.acknowledgedAt),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update the existing open alert with fresher data
    await db.update(nrAlerts)
      .set({
        reportId,
        severity,
        message,
        metricValue: metricValue !== null ? String(metricValue) : null,
        thresholdValue: thresholdValue !== null ? String(thresholdValue) : null,
      })
      .where(eq(nrAlerts.id, existing[0].id));
  } else {
    await db.insert(nrAlerts).values({
      vesselId,
      reportId,
      alertType,
      severity,
      message,
      metricValue: metricValue !== null ? String(metricValue) : null,
      thresholdValue: thresholdValue !== null ? String(thresholdValue) : null,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}
