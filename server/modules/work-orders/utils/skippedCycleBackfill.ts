import { normalizeDateToDDMMMYYYY } from '@shared/dateUtils';
import { parse, isValid, add } from 'date-fns';
import { format } from 'date-fns';
import * as repo from '../repositories/workOrderRepository';

const MAX_SKIPPED_RECORDS = 104;

export async function createSkippedCycleRecords(params: {
  workOrderId: string;
  componentId: string;
  componentCode: string | null;
  vesselCode: string | null;
  jobId: string | null;
  jobCode: string | null;
  jobTitle: string | null;
  originalDueDate: string | null | undefined;
  missedCycles: number;
  frequencyValue: string | number;
  frequencyUnit: string;
}): Promise<void> {
  const {
    workOrderId, componentId, componentCode, vesselCode,
    jobId, jobCode, jobTitle, originalDueDate,
    missedCycles, frequencyValue, frequencyUnit
  } = params;

  if (!missedCycles || missedCycles <= 0) return;

  if (!originalDueDate) {
    console.warn(`[BACKFILL WARNING] originalDueDate missing for WO ${workOrderId}, cannot create skipped cycle records`);
    return;
  }

  const normalizedOriginal = normalizeDateToDDMMMYYYY(originalDueDate);
  if (!normalizedOriginal) {
    console.warn(`[BACKFILL WARNING] originalDueDate '${originalDueDate}' could not be normalized for WO ${workOrderId}`);
    return;
  }

  const parsedOriginal = parse(normalizedOriginal, 'dd-MMM-yyyy', new Date());
  if (!isValid(parsedOriginal)) {
    console.warn(`[BACKFILL WARNING] originalDueDate '${normalizedOriginal}' is invalid for WO ${workOrderId}`);
    return;
  }

  let cyclesToCreate = missedCycles;
  if (cyclesToCreate > MAX_SKIPPED_RECORDS) {
    console.warn(`[BACKFILL WARNING] missedCycles=${missedCycles} exceeds cap of ${MAX_SKIPPED_RECORDS}. Creating only ${MAX_SKIPPED_RECORDS} SKIPPED records.`);
    cyclesToCreate = MAX_SKIPPED_RECORDS;
  }

  const numericFreq = typeof frequencyValue === 'number'
    ? frequencyValue
    : parseInt(String(frequencyValue), 10);
  if (isNaN(numericFreq) || numericFreq <= 0) {
    console.warn(`[BACKFILL WARNING] Invalid frequencyValue '${frequencyValue}' for WO ${workOrderId}`);
    return;
  }

  let durationKey: 'days' | 'weeks' | 'months' | 'years';
  switch (frequencyUnit.toLowerCase()) {
    case 'days': durationKey = 'days'; break;
    case 'weeks': durationKey = 'weeks'; break;
    case 'months': durationKey = 'months'; break;
    case 'years': durationKey = 'years'; break;
    default:
      console.warn(`[BACKFILL WARNING] Invalid frequencyUnit '${frequencyUnit}' for WO ${workOrderId}`);
      return;
  }

  for (let i = 1; i <= cyclesToCreate; i++) {
    const skippedDate = add(parsedOriginal, { [durationKey]: numericFreq * i });
    const formattedDate = format(skippedDate, 'dd-MMM-yyyy');

    await repo.createMaintenanceHistory({
      componentId,
      componentCode: componentCode || 'UNKNOWN',
      vesselCode: vesselCode || 'UNKNOWN',
      jobId: jobId || undefined,
      jobCode: jobCode || undefined,
      jobTitle: jobTitle || 'Unknown Job',
      workOrderId: workOrderId || 'SKIPPED',
      workOrderNo: `SKIPPED-${jobCode || jobId || 'UNKNOWN'}`,
      maintenanceType: 'Servicing',
      dateCompleted: formattedDate,
      runningHoursAtCompletion: null,
      performedBy: 'System',
      approvedBy: null,
      approvalDate: null,
      status: 'SKIPPED',
      workDescription: 'Maintenance cycle not performed — automatically recorded as SKIPPED',
      sparesUsed: null,
      remarks: null,
      isComponentReplaced: false,
      missedCycles: 0,
      originalDueDate: formattedDate,
      isSkipped: true,
      skippedCycleDate: formattedDate,
      sourceWorkOrderId: workOrderId
    });
  }

  console.log(`[BACKFILL] Created ${cyclesToCreate} SKIPPED cycle records for job ${jobCode || jobId}, triggered by WO ${workOrderId}`);
}

export async function createSkippedCycleRecordsRH(params: {
  workOrderId: string;
  workOrderNo: string | null;
  componentId: string;
  componentCode: string | null;
  vesselCode: string | null;
  jobId: string | null;
  jobCode: string | null;
  jobTitle: string | null;
  dueRH: number;
  completionRH: number;
  intervalRH: number;
  missedCycles: number;
}): Promise<void> {
  const {
    workOrderId, workOrderNo, componentId, componentCode, vesselCode,
    jobId, jobCode, jobTitle, dueRH, completionRH, intervalRH, missedCycles
  } = params;

  if (!missedCycles || missedCycles <= 0) return;

  let cyclesToCreate = missedCycles;
  if (cyclesToCreate > MAX_SKIPPED_RECORDS) {
    console.warn(`[BACKFILL-RH WARNING] missedCycles=${missedCycles} exceeds cap of ${MAX_SKIPPED_RECORDS}. Creating only ${MAX_SKIPPED_RECORDS} SKIPPED records.`);
    cyclesToCreate = MAX_SKIPPED_RECORDS;
  }

  for (let i = 1; i <= cyclesToCreate; i++) {
    const skippedAtRH = dueRH + (intervalRH * i);

    await repo.createMaintenanceHistory({
      componentId,
      componentCode: componentCode || 'UNKNOWN',
      vesselCode: vesselCode || 'UNKNOWN',
      jobId: jobId || undefined,
      jobCode: jobCode || undefined,
      jobTitle: jobTitle || 'Unknown Job',
      workOrderId,
      workOrderNo: workOrderNo || `SKIPPED-RH-${workOrderId}`,
      maintenanceType: 'Servicing',
      dateCompleted: format(new Date(), 'yyyy-MM-dd'),
      runningHoursAtCompletion: skippedAtRH.toString(),
      performedBy: 'System',
      approvedBy: null,
      approvalDate: null,
      status: 'SKIPPED',
      workDescription: `Maintenance cycle not performed at ${skippedAtRH} RH — automatically recorded as SKIPPED`,
      sparesUsed: null,
      remarks: null,
      isComponentReplaced: false,
      missedCycles: 0,
      originalDueDate: null,
      isSkipped: true,
      skippedCycleDate: format(new Date(), 'yyyy-MM-dd'),
      sourceWorkOrderId: workOrderId
    });
  }

  console.log(`[BACKFILL-RH] Created ${cyclesToCreate} SKIPPED cycle records for job ${jobCode || jobId} (dueRH: ${dueRH}, completionRH: ${completionRH}, interval: ${intervalRH}), triggered by WO ${workOrderId}`);
}
