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
      componentCode: componentCode || undefined,
      vesselCode: vesselCode || undefined,
      jobId: jobId || undefined,
      jobCode: jobCode || undefined,
      jobTitle: jobTitle || undefined,
      workOrderId: null,
      workOrderNo: null,
      maintenanceType: null,
      dateCompleted: formattedDate,
      runningHoursAtCompletion: null,
      performedBy: null,
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
