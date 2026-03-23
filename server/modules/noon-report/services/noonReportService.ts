import * as repo from '../repositories/noonReportRepository';
import { db } from '../../../db';
import { nrNoonReports, nrFuelRob, nrCiiTracking } from '@shared/schema';
import type { InsertNrNoonReport, NrNoonReport } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { runCalculations } from './calculationEngine';
import { BUNKER_SAFETY_MARGIN_PCT, FUEL_TYPES, computeCiiRefLine } from '../utils/fuelConversionFactors';
import { getVesselDwt } from '../utils/existingDataAdapter';

// ── Report CRUD ──────────────────────────────────────────────────────────────

export async function getNoonReports(filters: { vesselId?: string; status?: string }) {
  return repo.getNoonReports(filters);
}

export async function getNoonReport(id: number) {
  return repo.getNoonReportById(id);
}

export async function createDraftReport(data: InsertNrNoonReport) {
  const trim = data.draftAft && data.draftForward
    ? String(Number(data.draftAft) - Number(data.draftForward))
    : null;
  return repo.createNoonReport({ ...data, status: 'draft', trim: trim ?? undefined });
}

export async function updateDraftReport(id: number, data: Partial<InsertNrNoonReport>) {
  const report = await repo.getNoonReportById(id);
  if (!report) throw new Error('Report not found');
  if (report.status === 'submitted') throw new Error('Cannot edit a submitted report');

  const trim = data.draftAft !== undefined && data.draftForward !== undefined
    ? String(Number(data.draftAft) - Number(data.draftForward))
    : undefined;

  return repo.updateNoonReport(id, { ...data, ...(trim !== undefined ? { trim } : {}) });
}

export async function saveDraft(id: number, data: Partial<InsertNrNoonReport>) {
  const report = await repo.getNoonReportById(id);
  if (!report) throw new Error('Report not found');
  if (report.status === 'submitted') throw new Error('Cannot edit a submitted report');

  const trim = data.draftAft !== undefined && data.draftForward !== undefined
    ? String(Number(data.draftAft) - Number(data.draftForward))
    : undefined;

  return repo.saveDraft(id, { ...data, ...(trim !== undefined ? { trim } : {}) });
}

export async function submitReport(id: number, submittedBy: string) {
  const report = await repo.getNoonReportById(id);
  if (!report) throw new Error('Report not found');
  if (report.status === 'submitted') throw new Error('Report already submitted');

  const submitted = await repo.submitNoonReport(id, submittedBy);

  // Update fuel ROB after submission (clamp to 0 if negative)
  await updateFuelRobFromReport(submitted);

  // Run calculation engine (rolling averages, CII tracking, EEOI)
  await runCalculations(submitted);

  return submitted;
}

export async function deleteReport(id: number) {
  const report = await repo.getNoonReportById(id);
  if (!report) throw new Error('Report not found');
  if (report.status === 'submitted') throw new Error('Cannot delete a submitted report');
  await repo.deleteNoonReport(id);
}

// ── Fuel ROB ─────────────────────────────────────────────────────────────────

export async function getFuelRob(vesselId: string) {
  return repo.getFuelRobByVessel(vesselId);
}

async function updateFuelRobFromReport(report: NrNoonReport): Promise<void> {
  const fuelTypes: Array<{ type: string; rob: string | null | undefined }> = [
    { type: 'HFO',   rob: report.hfoRob },
    { type: 'LSMGO', rob: report.lsmgoRob },
    { type: 'MGO',   rob: report.mgoRob },
    { type: 'VLSFO', rob: report.vlsfoRob },
    { type: 'LPG',   rob: report.lpgRob },
  ];

  for (const { type, rob } of fuelTypes) {
    if (rob !== null && rob !== undefined) {
      // Clamp to 0 — ROB cannot be negative
      const clampedRob = Math.max(0, Number(rob));
      await repo.upsertFuelRob(report.vesselId, type, clampedRob, report.id);
    }
  }
}

// ── Fuel Dashboard ────────────────────────────────────────────────────────────

export async function getFuelDashboard(vesselId: string) {
  // Fetch ROB records (includes averages from calculation engine)
  const robRecords = await db.select()
    .from(nrFuelRob)
    .where(eq(nrFuelRob.vesselId, vesselId));

  // Build ROB, endurance, and avg maps by fuel type
  const robByFuelType: Record<string, number> = {};
  const enduranceDaysByFuel: Record<string, number | null> = {};
  const avg7DayByFuel: Record<string, number | null> = {};

  for (const fuelType of FUEL_TYPES) {
    robByFuelType[fuelType.toLowerCase()] = 0;
    enduranceDaysByFuel[fuelType.toLowerCase()] = null;
    avg7DayByFuel[fuelType.toLowerCase()] = null;
  }

  for (const row of robRecords) {
    const key = row.fuelType.toLowerCase();
    robByFuelType[key] = toNum(row.currentRob) ?? 0;
    enduranceDaysByFuel[key] = toNum(row.enduranceDays);
    avg7DayByFuel[key] = toNum(row.avg7Day);
  }

  // Total 7-day avg consumption across all fuel types
  const totalAvg7Day = Object.values(avg7DayByFuel)
    .filter((v): v is number => v !== null)
    .reduce((a, b) => a + b, 0);

  // Total endurance: sum all ROBs / total avg daily consumption
  const totalRob = Object.values(robByFuelType).reduce((a, b) => a + b, 0);
  const totalEnduranceDays = totalRob > 0 && totalAvg7Day > 0
    ? totalRob / totalAvg7Day
    : null;

  // Avg 7-day speed from last 7 reports
  const last7 = await repo.getLastNReports(vesselId, 7);
  const avg7DaySpeed = last7.length > 0
    ? last7.map(r => toNum(r.speed) ?? 0).reduce((a, b) => a + b, 0) / last7.length
    : 0;

  const totalEnduranceNM = totalEnduranceDays !== null && avg7DaySpeed > 0
    ? totalEnduranceDays * 24 * avg7DaySpeed
    : null;

  // Latest report for distanceToGo
  const latestReport = last7[0] ?? null;
  const distanceToGo = latestReport ? toNum(latestReport.distanceToGo) : null;

  // avgDistanceSailed7Day
  const avgDistanceSailed7Day = last7.length > 0
    ? last7.map(r => toNum(r.distanceSailed) ?? 0).reduce((a, b) => a + b, 0) / last7.length
    : 0;

  // minBunkerToNextPort = distanceToGo × (totalAvg7Day / avgDistanceSailed7Day)
  let minBunkerToNextPort: number | null = null;
  let recommendedBunker: number | null = null;
  if (distanceToGo !== null && distanceToGo > 0 && avgDistanceSailed7Day > 0 && totalAvg7Day > 0) {
    minBunkerToNextPort = distanceToGo * (totalAvg7Day / avgDistanceSailed7Day);
    recommendedBunker = minBunkerToNextPort * (1 + BUNKER_SAFETY_MARGIN_PCT / 100);
  }

  // CII tracking for current year
  const currentYear = new Date().getFullYear();
  const ciiRows = await db.select()
    .from(nrCiiTracking)
    .where(and(eq(nrCiiTracking.vesselId, vesselId), eq(nrCiiTracking.year, currentYear)))
    .limit(1);

  const ciiTracking = ciiRows[0] ?? null;

  // CII reference line — computed from vessel DWT; null if DWT not configured
  const dwt = await getVesselDwt(vesselId);
  const ciiRefLine = dwt !== null ? computeCiiRefLine(dwt) : null;

  // Last 30 submitted reports in ascending date order for trend chart
  const last30Raw = await db.select()
    .from(nrNoonReports)
    .where(and(eq(nrNoonReports.vesselId, vesselId), eq(nrNoonReports.status, 'submitted')))
    .orderBy(desc(nrNoonReports.reportDate))
    .limit(30);

  const last30 = [...last30Raw].reverse().map(r => {
    const hfo = toNum(r.hfoConsumption) ?? 0;
    const lsmgo = toNum(r.lsmgoConsumption) ?? 0;
    const mgo = toNum(r.mgoConsumption) ?? 0;
    const vlsfo = toNum(r.vlsfoConsumption) ?? 0;
    const lpg = toNum(r.lpgConsumption) ?? 0;
    return {
      date: r.reportDate,
      hfo,
      lsmgo,
      mgo,
      vlsfo,
      lpg,
      total: hfo + lsmgo + mgo + vlsfo + lpg,
    };
  });

  // Compute 7-day rolling average overlay for trend chart
  const last30WithAvg = last30.map((row, idx) => {
    const window = last30.slice(Math.max(0, idx - 6), idx + 1);
    const windowAvg = window.map(r => r.total).reduce((a, b) => a + b, 0) / window.length;
    return { ...row, avg7Day: Math.round(windowAvg * 100) / 100 };
  });

  // Speed vs consumption scatter data (all submitted reports)
  const allReports = await db.select({
    speed: nrNoonReports.speed,
    hfoConsumption: nrNoonReports.hfoConsumption,
    lsmgoConsumption: nrNoonReports.lsmgoConsumption,
    mgoConsumption: nrNoonReports.mgoConsumption,
    vlsfoConsumption: nrNoonReports.vlsfoConsumption,
    lpgConsumption: nrNoonReports.lpgConsumption,
    reportDate: nrNoonReports.reportDate,
  })
    .from(nrNoonReports)
    .where(and(eq(nrNoonReports.vesselId, vesselId), eq(nrNoonReports.status, 'submitted')))
    .orderBy(asc(nrNoonReports.reportDate));

  const speedConsumptionData = allReports.flatMap(r => {
    const speed = toNum(r.speed);
    if (speed === null) return [];
    const consumption =
      (toNum(r.hfoConsumption) ?? 0) +
      (toNum(r.lsmgoConsumption) ?? 0) +
      (toNum(r.mgoConsumption) ?? 0) +
      (toNum(r.vlsfoConsumption) ?? 0) +
      (toNum(r.lpgConsumption) ?? 0);
    return [{ speed, consumption, date: r.reportDate }];
  });

  return {
    robByFuelType,
    enduranceDays: enduranceDaysByFuel,
    avg7DayByFuel,
    totalEnduranceDays: totalEnduranceDays !== null ? round2(totalEnduranceDays) : null,
    totalEnduranceNM: totalEnduranceNM !== null ? Math.round(totalEnduranceNM) : null,
    avg7DayConsumption: round2(totalAvg7Day),
    avg7DaySpeed: round2(avg7DaySpeed),
    ciiRating: ciiTracking?.ciiRating ?? null,
    aer: ciiTracking?.aer !== null && ciiTracking?.aer !== undefined ? toNum(ciiTracking.aer) : null,
    ciiRefLine: ciiRefLine !== null ? round4(ciiRefLine) : null,
    ytdDistanceNm: ciiTracking?.ytdDistanceNm !== null ? toNum(ciiTracking?.ytdDistanceNm) : null,
    ytdCo2Mt: ciiTracking?.ytdCo2Mt !== null ? toNum(ciiTracking?.ytdCo2Mt) : null,
    minBunkerToNextPort: minBunkerToNextPort !== null ? round2(minBunkerToNextPort) : null,
    recommendedBunker: recommendedBunker !== null ? round2(recommendedBunker) : null,
    safetyMarginPct: BUNKER_SAFETY_MARGIN_PCT,
    distanceToGo,
    hasData: last30.length > 0,
    last30DaysConsumption: last30WithAvg,
    speedConsumptionData,
  };
}

// ── Legacy KPIs (kept for backward compat) ────────────────────────────────────

export async function getVesselKPIs(vesselId: string) {
  return getFuelDashboard(vesselId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
