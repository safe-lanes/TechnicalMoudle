// ====== NOON REPORT MODULE — Calculation Engine ======
// Called automatically after every successful report submission.
// Updates: nr_fuel_rob (averages, endurance), nr_cii_tracking (AER/CII), nr_voyage_legs (EEOI)

import { getDb } from '../../../db';
import { nrNoonReports, nrFuelRob, nrVoyageLegs, nrCiiTracking } from '@shared/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { NrNoonReport } from '@shared/schema';
import { getVesselDwt } from '../utils/existingDataAdapter';
import {
  CO2_FACTORS,
  FUEL_TYPES,
  computeCiiRefLine,
  assignCiiRating,
} from '../utils/fuelConversionFactors';

// ── Bunker ROB adjustment (called by bunkerService on BDN create/update/delete) ──
// Exported here (in the calculation engine) per architectural requirement so
// all nr_fuel_rob mutations go through a single service.

export async function adjustRobForBunker(
  vesselId: string,
  fuelType: string,
  deltaMt: number,
): Promise<void> {
  const db = await getDb();
  const rows = await db.select()
    .from(nrFuelRob)
    .where(and(eq(nrFuelRob.vesselId, vesselId), eq(nrFuelRob.fuelType, fuelType)))
    .limit(1);

  if (rows.length === 0) {
    const newRob = Math.max(0, deltaMt);
    await db.insert(nrFuelRob).values({
      vesselId,
      fuelType,
      currentRob: String(newRob),
      updatedAt: new Date(),
    });
  } else {
    const current = Number(rows[0].currentRob) || 0;
    const updated = Math.max(0, current + deltaMt);
    await db.update(nrFuelRob)
      .set({ currentRob: String(updated), updatedAt: new Date() })
      .where(and(eq(nrFuelRob.vesselId, vesselId), eq(nrFuelRob.fuelType, fuelType)));
  }
}

// ── Main entry point (two-phase) ──────────────────────────────────────────────
// Phase 1: run KPI steps concurrently; Phase 2: run alert engine sequentially
// after Phase 1 so previousCiiRating and updated endurance are already persisted.

const PHASE1_STEPS = ['rollingAverages', 'ciiTracking', 'eeoi'] as const;
const ALL_STEPS = [...PHASE1_STEPS, 'alertEngine'] as const;
type StepName = typeof ALL_STEPS[number];

export async function runCalculations(report: NrNoonReport): Promise<void> {
  // Lazy import to avoid circular deps between engine and alertEngine
  const { generateAlerts } = await import('./alertEngine');

  // ── Phase 1: KPI updates (concurrent) ──────────────────────────────────────
  const phase1: Array<[typeof PHASE1_STEPS[number], Promise<void>]> = [
    ['rollingAverages', computeRollingAveragesAndEndurance(report)],
    ['ciiTracking', computeCiiTracking(report)],
    ['eeoi', computeEeoi(report)],
  ];
  const phase1Results = await Promise.allSettled(phase1.map(([, p]) => p));
  const failed: StepName[] = [];
  phase1Results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const name = phase1[i][0];
      failed.push(name);
      console.error(`[calculationEngine] Step "${name}" failed for vessel=${report.vesselId} report=${report.id}:`, result.reason);
    }
  });

  // ── Phase 2: Alert engine (sequential, after Phase 1 persisted) ────────────
  try {
    await generateAlerts(report);
  } catch (err) {
    failed.push('alertEngine');
    console.error(`[calculationEngine] Step "alertEngine" failed for vessel=${report.vesselId} report=${report.id}:`, err);
  }

  if (failed.length > 0) {
    console.warn(
      `[calculationEngine] ${failed.length}/${ALL_STEPS.length} steps failed (${failed.join(', ')}). ` +
      `Submission succeeded but some data may be stale for vessel=${report.vesselId} report=${report.id}.`
    );
  }
}

// ── Rolling averages and endurance ───────────────────────────────────────────

async function computeRollingAveragesAndEndurance(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  const [last7, last3] = await Promise.all([
    getLastNSubmitted(report.vesselId, 7),
    getLastNSubmitted(report.vesselId, 3),
  ]);

  const avgSpeed7 = avg(last7.map(r => toNum(r.speed)));

  for (const fuelType of FUEL_TYPES) {
    const cons7 = last7
      .map(r => getReportConsumption(r, fuelType))
      .filter((v): v is number => v !== null);
    const cons3 = last3
      .map(r => getReportConsumption(r, fuelType))
      .filter((v): v is number => v !== null);

    const avg7Day = cons7.length > 0 ? cons7.reduce((a, b) => a + b, 0) / cons7.length : null;
    const avg3Day = cons3.length > 0 ? cons3.reduce((a, b) => a + b, 0) / cons3.length : null;

    // Get current ROB from database (already updated by updateFuelRobFromReport)
    const robRows = await db.select()
      .from(nrFuelRob)
      .where(and(eq(nrFuelRob.vesselId, report.vesselId), eq(nrFuelRob.fuelType, fuelType)))
      .limit(1);

    const robRow = robRows[0] ?? null;
    // Clamp to 0 if stored ROB is negative (safety floor)
    const currentRob = robRow !== null ? Math.max(0, toNum(robRow.currentRob) ?? 0) : null;

    let enduranceDays: number | null = null;
    let enduranceNM: number | null = null;

    if (currentRob !== null && avg7Day !== null && avg7Day > 0) {
      enduranceDays = currentRob / avg7Day;
      const speed = avgSpeed7 ?? 0;
      enduranceNM = enduranceDays * 24 * speed;
    }

    // Upsert the averages and endurance into nr_fuel_rob
    if (robRow !== null) {
      await db.update(nrFuelRob)
        .set({
          avg3Day: avg3Day !== null ? String(avg3Day) : null,
          avg7Day: avg7Day !== null ? String(avg7Day) : null,
          enduranceDays: enduranceDays !== null ? String(enduranceDays) : null,
          enduranceNm: enduranceNM !== null ? String(enduranceNM) : null,
        })
        .where(and(eq(nrFuelRob.vesselId, report.vesselId), eq(nrFuelRob.fuelType, fuelType)));
    } else if (avg7Day !== null) {
      // Create entry if it didn't exist yet (unlikely but safe)
      await db.insert(nrFuelRob).values({
        vesselId: report.vesselId,
        fuelType,
        currentRob: '0',
        lastReportId: report.id,
        avg3Day: avg3Day !== null ? String(avg3Day) : null,
        avg7Day: String(avg7Day),
        enduranceDays: enduranceDays !== null ? String(enduranceDays) : null,
        enduranceNm: enduranceNM !== null ? String(enduranceNM) : null,
      });
    }
  }
}

// ── CII tracking ─────────────────────────────────────────────────────────────

async function computeCiiTracking(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  const year = new Date(report.reportDate).getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Fetch all submitted reports in the current calendar year for this vessel
  const yearReports = await db.select()
    .from(nrNoonReports)
    .where(
      and(
        eq(nrNoonReports.vesselId, report.vesselId),
        eq(nrNoonReports.status, 'submitted'),
        gte(nrNoonReports.reportDate, yearStart),
        lte(nrNoonReports.reportDate, yearEnd),
      )
    );

  // Accumulate YTD CO₂ (tonnes) and distance NM
  let ytdCo2Mt = 0;
  let ytdDistanceNm = 0;

  for (const r of yearReports) {
    // Use the stored co2Total if available, otherwise compute from per-fuel consumptions
    if (r.co2Total !== null && r.co2Total !== undefined) {
      ytdCo2Mt += toNum(r.co2Total) ?? 0;
    } else {
      for (const fuelType of FUEL_TYPES) {
        const cons = getReportConsumption(r, fuelType) ?? 0;
        ytdCo2Mt += cons * (CO2_FACTORS[fuelType] ?? 0);
      }
    }
    ytdDistanceNm += toNum(r.distanceSailed) ?? 0;
  }

  // Fetch vessel DWT — null if vessel not found or DWT not configured
  const dwt = await getVesselDwt(report.vesselId);

  // AER = (ytdCO2 in grams) / (DWT × ytdDistanceNM)
  // ytdCo2Mt is in tonnes → multiply by 1e6 to get grams
  let aer: number | null = null;
  let ciiRating: string | null = null;

  if (dwt !== null && dwt > 0 && ytdDistanceNm > 0) {
    const ytdCo2Grams = ytdCo2Mt * 1_000_000;
    aer = ytdCo2Grams / (dwt * ytdDistanceNm);
    const refLine = computeCiiRefLine(dwt);
    ciiRating = assignCiiRating(aer, refLine);
  }

  // Upsert into nr_cii_tracking — capture existing rating for band-drop detection
  const existing = await db.select()
    .from(nrCiiTracking)
    .where(and(eq(nrCiiTracking.vesselId, report.vesselId), eq(nrCiiTracking.year, year)))
    .limit(1);

  const previousCiiRating = existing[0]?.ciiRating ?? null;

  if (existing.length > 0) {
    await db.update(nrCiiTracking)
      .set({
        ytdCo2Mt: String(ytdCo2Mt),
        ytdDistanceNm: String(ytdDistanceNm),
        aer: aer !== null ? String(aer) : null,
        ciiRating,
        previousCiiRating, // store old rating before overwriting
        updatedAt: new Date(),
      })
      .where(and(eq(nrCiiTracking.vesselId, report.vesselId), eq(nrCiiTracking.year, year)));
  } else {
    await db.insert(nrCiiTracking).values({
      vesselId: report.vesselId,
      year,
      ytdCo2Mt: String(ytdCo2Mt),
      ytdDistanceNm: String(ytdDistanceNm),
      aer: aer !== null ? String(aer) : null,
      ciiRating,
      previousCiiRating: null, // first submission — no previous
    });
  }
}

// ── EEOI per voyage leg ───────────────────────────────────────────────────────

async function computeEeoi(report: NrNoonReport): Promise<void> {
  const db = await getDb();
  const voyageNo = report.voyageNo;
  if (!voyageNo) return;

  const cargoMt = toNum(report.cargoQuantity);
  const distanceSailed = toNum(report.distanceSailed);

  if (!cargoMt || !distanceSailed || cargoMt <= 0 || distanceSailed <= 0) return;

  // Total CO₂ for this report
  let totalCo2Mt = 0;
  if (report.co2Total !== null && report.co2Total !== undefined) {
    totalCo2Mt = toNum(report.co2Total) ?? 0;
  } else {
    for (const fuelType of FUEL_TYPES) {
      const cons = getReportConsumption(report, fuelType) ?? 0;
      totalCo2Mt += cons * (CO2_FACTORS[fuelType] ?? 0);
    }
  }

  // EEOI = CO₂ (tonnes) / (cargo MT × distance NM)
  const eeoi = totalCo2Mt / (cargoMt * distanceSailed);

  // Upsert voyage leg with EEOI
  const existing = await db.select()
    .from(nrVoyageLegs)
    .where(and(eq(nrVoyageLegs.vesselId, report.vesselId), eq(nrVoyageLegs.voyageNo, voyageNo)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(nrVoyageLegs)
      .set({ eeoi: String(eeoi), updatedAt: new Date() })
      .where(eq(nrVoyageLegs.id, existing[0].id));
  } else {
    await db.insert(nrVoyageLegs).values({
      vesselId: report.vesselId,
      voyageNo,
      portFrom: report.portFrom ?? undefined,
      portTo: report.portTo ?? undefined,
      eeoi: String(eeoi),
    });
  }
}

// ── Typed consumption accessor (no 'as any') ──────────────────────────────────

function getReportConsumption(report: NrNoonReport, fuelType: typeof FUEL_TYPES[number]): number | null {
  switch (fuelType) {
    case 'HFO':   return toNum(report.hfoConsumption);
    case 'LSMGO': return toNum(report.lsmgoConsumption);
    case 'MGO':   return toNum(report.mgoConsumption);
    case 'VLSFO': return toNum(report.vlsfoConsumption);
    case 'LPG':   return toNum(report.lpgConsumption);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getLastNSubmitted(vesselId: string, n: number): Promise<NrNoonReport[]> {
  const db = await getDb();
  return db.select()
    .from(nrNoonReports)
    .where(and(eq(nrNoonReports.vesselId, vesselId), eq(nrNoonReports.status, 'submitted')))
    .orderBy(desc(nrNoonReports.reportDate))
    .limit(n) as Promise<NrNoonReport[]>;
}

function toNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function avg(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v !== null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
