import * as repo from '../repositories/noonReportRepository';
import type { InsertNrNoonReport } from '@shared/schema';

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

  // Update fuel ROB after submission
  await updateFuelRobFromReport(submitted);

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

async function updateFuelRobFromReport(report: any) {
  const fuelTypes = [
    { type: 'HFO', rob: report.hfoRob },
    { type: 'LSMGO', rob: report.lsmgoRob },
    { type: 'MGO', rob: report.mgoRob },
    { type: 'VLSFO', rob: report.vlsfoRob },
    { type: 'LPG', rob: report.lpgRob },
  ];

  for (const { type, rob } of fuelTypes) {
    if (rob !== null && rob !== undefined) {
      await repo.upsertFuelRob(report.vesselId, type, Number(rob), report.id);
    }
  }
}

// ── Rolling averages & KPIs ───────────────────────────────────────────────────

export async function getVesselKPIs(vesselId: string) {
  const last7 = await repo.getLastNReports(vesselId, 7);
  const last3 = last7.slice(0, 3);
  const rob = await repo.getFuelRobByVessel(vesselId);

  const avg7HFO = average(last7.map(r => Number(r.hfoConsumption || 0)));
  const avg3HFO = average(last3.map(r => Number(r.hfoConsumption || 0)));
  const totalDailyConsumption = average(last7.map(r =>
    (Number(r.hfoConsumption || 0) + Number(r.lsmgoConsumption || 0) +
     Number(r.mgoConsumption || 0) + Number(r.vlsfoConsumption || 0))
  ));

  const robMap: Record<string, number> = {};
  for (const r of rob) robMap[r.fuelType] = Number(r.currentRob);

  const totalRob = Object.values(robMap).reduce((a, b) => a + b, 0);
  const enduranceDays = totalDailyConsumption > 0 ? totalRob / totalDailyConsumption : 999;
  const avgSpeed = average(last7.map(r => Number(r.speed || 0)));
  const enduranceNm = enduranceDays * 24 * avgSpeed;

  const latestCII = last7[0]?.ciiRating || null;

  const speedConsumptionData = last7.map(r => ({
    speed: Number(r.speed || 0),
    consumption: Number(r.hfoConsumption || 0) + Number(r.lsmgoConsumption || 0) +
      Number(r.mgoConsumption || 0) + Number(r.vlsfoConsumption || 0),
    date: r.reportDate,
  }));

  const consumptionTrend = last7.map(r => ({
    date: r.reportDate,
    hfo: Number(r.hfoConsumption || 0),
    lsmgo: Number(r.lsmgoConsumption || 0),
    mgo: Number(r.mgoConsumption || 0),
    total: Number(r.hfoConsumption || 0) + Number(r.lsmgoConsumption || 0) +
      Number(r.mgoConsumption || 0) + Number(r.vlsfoConsumption || 0),
  })).reverse();

  return {
    rob: robMap,
    enduranceDays: Math.round(enduranceDays * 10) / 10,
    enduranceNm: Math.round(enduranceNm),
    avgSpeed,
    avg7DayHFO: Math.round(avg7HFO * 100) / 100,
    avg3DayHFO: Math.round(avg3HFO * 100) / 100,
    totalDailyConsumption: Math.round(totalDailyConsumption * 100) / 100,
    ciiRating: latestCII,
    speedConsumptionData,
    consumptionTrend,
  };
}

function average(nums: number[]) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
