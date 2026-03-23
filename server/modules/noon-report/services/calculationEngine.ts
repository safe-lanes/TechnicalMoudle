// ====== NOON REPORT MODULE — Calculation Engine ======
// Called automatically after every successful report submission.
// Updates: nr_fuel_rob (averages, endurance), nr_cii_tracking (AER/CII), nr_voyage_legs (EEOI)

import { db } from '../../../db';
import { nrNoonReports, nrFuelRob, nrVoyageLegs, nrCiiTracking } from '@shared/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { NrNoonReport } from '@shared/schema';
import {
  CO2_FACTORS,
  FUEL_TYPES,
  computeCiiRefLine,
  assignCiiRating,
} from '../utils/fuelConversionFactors';

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runCalculations(report: NrNoonReport): Promise<void> {
  const results = await Promise.allSettled([
    computeRollingAveragesAndEndurance(report),
    computeCiiTracking(report),
    computeEeoi(report),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[calculationEngine] Calculation step failed:', result.reason);
    }
  }
}

// ── Rolling averages and endurance ───────────────────────────────────────────

async function computeRollingAveragesAndEndurance(report: NrNoonReport): Promise<void> {
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

  // DWT is not currently stored in the vessels table.
  // CII/AER will be null until DWT data is available.
  const dwt: number | null = null;

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

  // Upsert into nr_cii_tracking
  const existing = await db.select()
    .from(nrCiiTracking)
    .where(and(eq(nrCiiTracking.vesselId, report.vesselId), eq(nrCiiTracking.year, year)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(nrCiiTracking)
      .set({
        ytdCo2Mt: String(ytdCo2Mt),
        ytdDistanceNm: String(ytdDistanceNm),
        aer: aer !== null ? String(aer) : null,
        ciiRating,
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
    });
  }
}

// ── EEOI per voyage leg ───────────────────────────────────────────────────────

async function computeEeoi(report: NrNoonReport): Promise<void> {
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
