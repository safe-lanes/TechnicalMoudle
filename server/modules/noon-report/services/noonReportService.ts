import * as repo from '../repositories/noonReportRepository';
import { getDb } from '../../../db';
import { nrNoonReports, nrFuelRob, nrCiiTracking, nrAlerts } from '@shared/schema';
import type { InsertNrNoonReport, NrNoonReport } from '@shared/schema';
import { eq, and, desc, asc, isNull, count } from 'drizzle-orm';
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
  const db = await getDb();
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

// ── Alert CRUD ────────────────────────────────────────────────────────────────

/** Active (unacknowledged) alerts for a vessel, newest first. */
export async function getActiveAlerts(vesselId: string) {
  const db = await getDb();
  return db.select()
    .from(nrAlerts)
    .where(and(eq(nrAlerts.vesselId, vesselId), isNull(nrAlerts.acknowledgedAt)))
    .orderBy(desc(nrAlerts.createdAt));
}

/** Paginated alert history for a vessel (all alerts, including acknowledged). */
export async function getAllAlerts(vesselId: string, page: number, limit: number) {
  const db = await getDb();
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  const [data, totalRows] = await Promise.all([
    db.select()
      .from(nrAlerts)
      .where(eq(nrAlerts.vesselId, vesselId))
      .orderBy(desc(nrAlerts.createdAt))
      .limit(safeLimit)
      .offset(offset),
    db.select({ total: count() })
      .from(nrAlerts)
      .where(eq(nrAlerts.vesselId, vesselId)),
  ]);

  const total = totalRows[0]?.total ?? 0;
  return {
    data,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}

/** Unacknowledged alert count for a vessel (used by sidebar badge). */
export async function getActiveAlertCount(vesselId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ total: count() })
    .from(nrAlerts)
    .where(and(eq(nrAlerts.vesselId, vesselId), isNull(nrAlerts.acknowledgedAt)));
  return rows[0]?.total ?? 0;
}

/** Acknowledge a single alert by id. Returns 404 if not found. */
export async function acknowledgeAlert(alertId: number, acknowledgedBy: string) {
  const db = await getDb();
  const existing = await db.select({ id: nrAlerts.id })
    .from(nrAlerts)
    .where(eq(nrAlerts.id, alertId))
    .limit(1);

  if (existing.length === 0) return null;

  const updated = await db.update(nrAlerts)
    .set({ acknowledgedAt: new Date(), acknowledgedBy })
    .where(eq(nrAlerts.id, alertId))
    .returning();

  return updated[0] ?? null;
}

// ── Fleet Summary (all vessels) ───────────────────────────────────────────────

export interface VesselFleetSummary {
  vesselId: string;
  lastReportDate: string | null;
  lastVoyageNo: string | null;
  lastPortFrom: string | null;
  lastPortTo: string | null;
  lastCiiRating: string | null;
  lastCondition: string | null;
  totalReports: number;
  submittedReports: number;
  activeAlerts: number;
  totalHfoRob: number;
  totalAllRob: number;
  avg7DayConsumption: number | null;
  enduranceDays: number | null;
}

export async function getFleetSummary(vesselIds: string[]): Promise<VesselFleetSummary[]> {
  const db = await getDb();
  const results: VesselFleetSummary[] = [];

  for (const vesselId of vesselIds) {
    // Latest submitted report
    const latestReports = await db.select()
      .from(nrNoonReports)
      .where(and(eq(nrNoonReports.vesselId, vesselId), eq(nrNoonReports.status, 'submitted')))
      .orderBy(desc(nrNoonReports.reportDate))
      .limit(1);
    const latest = latestReports[0] ?? null;

    // Report counts
    const allReports = await db.select()
      .from(nrNoonReports)
      .where(eq(nrNoonReports.vesselId, vesselId));
    const totalReports = allReports.length;
    const submittedReports = allReports.filter(r => r.status === 'submitted').length;

    // Active alerts
    const alertRows = await db.select({ total: count() })
      .from(nrAlerts)
      .where(and(eq(nrAlerts.vesselId, vesselId), isNull(nrAlerts.acknowledgedAt)));
    const activeAlerts = alertRows[0]?.total ?? 0;

    // ROB & averages from nr_fuel_rob
    const robRows = await db.select()
      .from(nrFuelRob)
      .where(eq(nrFuelRob.vesselId, vesselId));
    const totalHfoRob = toNum(robRows.find(r => r.fuelType === 'HFO')?.currentRob) ?? 0;
    const totalAllRob = robRows.reduce((acc, r) => acc + (toNum(r.currentRob) ?? 0), 0);
    const avg7Day = robRows.reduce((acc, r) => acc + (toNum(r.avg7Day) ?? 0), 0) || null;

    // Total endurance
    const totalEndurance = avg7Day && totalAllRob > 0
      ? round2(totalAllRob / avg7Day)
      : null;

    results.push({
      vesselId,
      lastReportDate: latest?.reportDate ?? null,
      lastVoyageNo: latest?.voyageNo ?? null,
      lastPortFrom: latest?.portFrom ?? null,
      lastPortTo: latest?.portTo ?? null,
      lastCiiRating: latest?.ciiRating ?? null,
      lastCondition: latest?.condition ?? null,
      totalReports,
      submittedReports,
      activeAlerts: Number(activeAlerts),
      totalHfoRob,
      totalAllRob: round2(totalAllRob),
      avg7DayConsumption: avg7Day ? round2(avg7Day) : null,
      enduranceDays: totalEndurance,
    });
  }

  return results;
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
