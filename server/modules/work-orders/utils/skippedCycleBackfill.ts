import { createHash } from 'crypto';
import { normalizeDateToDDMMMYYYY } from '@shared/dateUtils';
import { parse, isValid, add, format } from 'date-fns';
import * as repo from '../repositories/workOrderRepository';
import { calculateMissedCyclesRH } from '@shared/dateUtils';
import { isVisibleMaintenanceHistory } from '@shared/workOrders/maintenanceHistoryVisibility';

const MAX_SKIPPED_RECORDS = 104;
type Linkage = {
  workOrderId: string;
  componentId: string;
  componentCode: string | null;
  vesselCode: string | null;
  jobId: string | null;
  jobCode: string | null;
  jobTitle: string | null;
};

export function skippedCycleCode(source: string, basis: 'CAL' | 'RH', boundary: string): string {
  return `SKIP-${basis}-${createHash('sha256').update(`${source}:${basis}:${boundary}`).digest('hex').slice(0, 32)}`;
}

/** Resolve persisted canonical identities; never use caller names/template codes as IDs. */
async function resolveLinkage(params: Linkage) {
  const source = await repo.findById(params.workOrderId);
  if (!source?.wouuid || !source.vesselId) {
    console.warn(`[BACKFILL WARNING] Missing source/vessel for ${params.workOrderId}`);
    return null;
  }
  const vessel = await repo.getStorage().getVessel(source.vesselId);
  if (!vessel?.vCode) {
    console.warn(`[BACKFILL WARNING] Missing vessel code for ${source.wouuid}`);
    return null;
  }
  let component = await repo.findComponent(source.component);
  if (component && component.vesselId !== source.vesselId) component = undefined;
  if (!component && source.componentCode) {
    component = await repo.findComponentByCode(source.componentCode, source.vesselId);
  }
  if (!component) {
    const matches = (await repo.findComponents(source.vesselId))
      .filter(c => c.vesselId === source.vesselId && c.name === source.component);
    if (matches.length === 1) component = matches[0];
  }
  if (!component?.cuuid || !component.componentCode || component.vesselId !== source.vesselId) {
    console.warn(`[BACKFILL WARNING] Missing/ambiguous component for ${source.wouuid}`);
    return null;
  }
  const job = source.jobId ? await repo.findJob(source.jobId) : undefined;
  if (job && job.vesselId !== source.vesselId) {
    console.warn(`[BACKFILL WARNING] Cross-vessel Job rejected for ${source.wouuid}`);
    return null;
  }
  return { source, component, job, vessel };
}

function count(missedCycles: number): number {
  return Number.isFinite(missedCycles) && missedCycles > 0
    ? Math.min(Math.floor(missedCycles), MAX_SKIPPED_RECORDS) : 0;
}

export async function createSkippedCycleRecords(params: Linkage & {
  originalDueDate: string | null | undefined;
  missedCycles: number;
  frequencyValue: string | number | null | undefined;
  frequencyUnit: string | null | undefined;
}): Promise<void> {
  const cycles = count(params.missedCycles);
  if (!cycles) return;
  const numericFreq = typeof params.frequencyValue === 'number'
    ? params.frequencyValue : parseInt(String(params.frequencyValue), 10);
  const unit = params.frequencyUnit?.toLowerCase();
  const durationKey = ({ days: 'days', weeks: 'weeks', months: 'months', years: 'years' } as const)[
    unit as 'days' | 'weeks' | 'months' | 'years'
  ];
  if (!Number.isFinite(Number(params.frequencyValue)) || !Number.isFinite(numericFreq) || numericFreq <= 0 || !durationKey) {
    console.warn(`[BACKFILL WARNING] Unsupported calendar frequency for ${params.workOrderId}; completion continues`);
    return;
  }
  const linked = await resolveLinkage(params);
  if (!linked) return;
  const { source, component, job, vessel } = linked;
  const previous = await repo.findMaintenanceHistoryForSource(source.wouuid);
  const savedBasis = previous.map(row => {
    try { return JSON.parse(row.remarks || '{}').skippedCycleBasis; } catch { return null; }
  }).find(basis => basis?.kind === 'CAL');
  const basisFrequency = savedBasis?.frequency ?? numericFreq;
  const basisUnit = savedBasis?.unit ?? durationKey;
  const original = savedBasis?.original || source.originalDueDate || source.cycleDueDateSnapshot
    || source.dueDateSnapshot || params.originalDueDate;
  const normalized = original && normalizeDateToDDMMMYYYY(original);
  const parsed = normalized ? parse(normalized, 'dd-MMM-yyyy', new Date()) : null;
  if (!parsed || !isValid(parsed)) {
    console.warn(`[BACKFILL WARNING] Unsupported original cycle date for ${source.wouuid}`);
    return;
  }
  const cyclesToCreate = Math.min(savedBasis?.cycles ?? cycles, MAX_SKIPPED_RECORDS);
  for (let i = 1; i <= cyclesToCreate; i++) {
    // Preserve the existing calendar arithmetic and 104-row cap.
    const skippedDate = add(parsed, { [basisUnit]: basisFrequency * i });
    const day = format(skippedDate, 'dd-MMM-yyyy');
    await repo.createMaintenanceHistory({
      componentId: component.cuuid, componentCode: component.componentCode, vesselCode: vessel.vCode,
      jobId: job?.juuid ?? null, jobCode: job?.jobNo ?? null,
      jobTitle: source.jobTitle, workOrderId: source.wouuid,
      workOrderNo: skippedCycleCode(source.wouuid, 'CAL', format(skippedDate, 'yyyy-MM-dd')),
      maintenanceType: 'Servicing', dateCompleted: day, runningHoursAtCompletion: null,
      performedBy: 'System', approvedBy: null, approvalDate: null, status: 'SKIPPED',
      workDescription: 'Maintenance cycle not performed — automatically recorded as SKIPPED',
      sparesUsed: null, remarks: JSON.stringify({ skippedCycleBasis: {
        kind: 'CAL', original, frequency: basisFrequency, unit: basisUnit, cycles: cyclesToCreate,
      } }), isComponentReplaced: false, missedCycles: 0,
      originalDueDate: day, isSkipped: true, skippedCycleDate: day, sourceWorkOrderId: source.wouuid,
    });
  }
}

export async function createSkippedCycleRecordsRH(params: Linkage & {
  workOrderNo: string | null;
  dueRH: number;
  completionRH: number;
  intervalRH: number;
  missedCycles: number;
}): Promise<void> {
  const cycles = count(params.missedCycles);
  if (!cycles) return;
  if (![params.dueRH, params.completionRH, params.intervalRH].every(Number.isFinite)
    || params.dueRH < 0 || params.intervalRH <= 0) {
    console.warn(`[BACKFILL-RH WARNING] Unsupported RH frequency/boundary for ${params.workOrderId}; completion continues`);
    return;
  }
  const linked = await resolveLinkage(params);
  if (!linked) return;
  const { source, component, job, vessel } = linked;
  const previous = await repo.findMaintenanceHistoryForSource(source.wouuid);
  const savedBasis = previous.map(row => {
    try { return JSON.parse(row.remarks || '{}').skippedCycleBasis; } catch { return null; }
  }).find(basis => basis?.kind === 'RH');
  // New records persist their original basis; retries never depend on an advanced Job.
  const legacyBoundaries = previous.filter(row => !isVisibleMaintenanceHistory(row) && row.runningHoursAtCompletion != null)
    .map(row => Number(row.runningHoursAtCompletion)).filter(Number.isFinite);
  const dueRH = savedBasis?.dueRH ?? source.cycleDueRhSnapshot ?? source.dueRhSnapshot
    ?? (legacyBoundaries.length ? Math.min(...legacyBoundaries) - params.intervalRH : params.dueRH);
  const intervalRH = savedBasis?.intervalRH ?? params.intervalRH;
  const completionDay = normalizeDateToDDMMMYYYY(source.completionDateTime || source.dateCompleted || '');
  if (!completionDay) {
    console.warn(`[BACKFILL-RH WARNING] Missing completion day for ${source.wouuid}`);
    return;
  }
  const cyclesToCreate = Math.min(savedBasis?.cycles ?? cycles, MAX_SKIPPED_RECORDS);
  for (let i = 1; i <= cyclesToCreate; i++) {
    const boundary = dueRH + intervalRH * i;
    await repo.createMaintenanceHistory({
      componentId: component.cuuid, componentCode: component.componentCode, vesselCode: vessel.vCode,
      jobId: job?.juuid ?? null, jobCode: job?.jobNo ?? null, jobTitle: source.jobTitle,
      workOrderId: source.wouuid, workOrderNo: skippedCycleCode(source.wouuid, 'RH', String(boundary)),
      maintenanceType: 'Servicing', dateCompleted: completionDay, runningHoursAtCompletion: String(boundary),
      performedBy: 'System', approvedBy: null, approvalDate: null, status: 'SKIPPED',
      workDescription: `Maintenance cycle not performed at ${boundary} RH — automatically recorded as SKIPPED`,
      sparesUsed: null, remarks: JSON.stringify({ skippedCycleBasis: { kind: 'RH', dueRH, intervalRH, cycles: cyclesToCreate } }),
      isComponentReplaced: false, missedCycles: 0,
      originalDueDate: null, isSkipped: true, skippedCycleDate: completionDay, sourceWorkOrderId: source.wouuid,
    });
  }
}

/** Shared approval-route adapter. WO snapshots, not the advanced Job, define retry boundaries. */
export async function recordSkippedCyclesForWorkOrder(
  workOrderId: string, missedCycles: number, originalDueDate?: string | null, originalDueRH?: string | null,
) {
  const source = await repo.findById(workOrderId);
  if (!source || source.status !== 'Completed') return;
  const params: Linkage = {
    workOrderId: source.wouuid, componentId: '', componentCode: null,
    vesselCode: null, jobId: null, jobCode: null, jobTitle: source.jobTitle,
  };
  if (source.maintenanceBasis === 'Running Hours') {
    const job = source.jobId ? await repo.findJob(source.jobId) : undefined;
    const due = source.cycleDueRhSnapshot ?? source.dueRhSnapshot ?? originalDueRH ?? source.nextDueReading;
    const interval = job?.intervalRunningHour || source.frequencyValue;
    const completion = source.woCompletionRh ?? source.completionRH ?? source.currentReading ?? source.runningHours;
    if (due == null || completion == null || !interval) {
      console.warn(`[BACKFILL-RH WARNING] Missing RH cycle basis for ${source.wouuid}`);
      return;
    }
    await createSkippedCycleRecordsRH({ ...params, workOrderNo: source.workOrderNo,
      dueRH: Number(due), completionRH: Number(completion), intervalRH: Number(interval),
      missedCycles: missedCycles || calculateMissedCyclesRH(due, completion, interval) });
  } else if (source.maintenanceBasis === 'Calendar' || source.maintenanceBasis === 'Dual Frequency') {
    await createSkippedCycleRecords({ ...params, missedCycles,
      originalDueDate: source.originalDueDate || originalDueDate || source.nextDueDate || source.dueDate,
      frequencyValue: source.frequencyValue, frequencyUnit: source.frequencyUnit });
  }
}
