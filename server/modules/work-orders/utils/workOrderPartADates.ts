export interface WorkOrderPartADateSource {
  maintenanceBasis?: string | null;
  lastDoneDateSnapshot?: string | null;
  dueDateSnapshot?: string | null;
  dueDate?: string | null;
  nextDueDate?: string | null;
}

export interface WorkOrderPartADates {
  lastCompletedOn: string;
  nextDueDate: string;
}

export const IMMUTABLE_WORK_ORDER_SNAPSHOT_FIELDS = [
  'driverType',
  'dualTriggerLeg',
  'cycleDueRhSnapshot',
  'generateRhSnapshot',
  'dueRhSnapshot',
  'effectiveRhAtGeneration',
  'rhLastDoneSnapshot',
  'cycleDueDateSnapshot',
  'generateDateSnapshot',
  'dueDateSnapshot',
  'lastDoneDateSnapshot',
] as const;

export function findAttemptedWorkOrderSnapshotFields(
  input: Record<string, unknown>,
): string[] {
  return Object.keys(input).filter((key) =>
    (IMMUTABLE_WORK_ORDER_SNAPSHOT_FIELDS as readonly string[]).includes(key),
  );
}

const MONTH_NUMBER: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function firstNonEmptyDate(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function normalizePartADateForInput(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const numericMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (numericMatch) {
    return `${numericMatch[3]}-${numericMatch[2].padStart(2, '0')}-${numericMatch[1].padStart(2, '0')}`;
  }

  const namedMonthMatch = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (namedMonthMatch) {
    const month = MONTH_NUMBER[namedMonthMatch[2].toLowerCase()];
    if (month) {
      return `${namedMonthMatch[3]}-${month}-${namedMonthMatch[1].padStart(2, '0')}`;
    }
  }

  return trimmed;
}

/**
 * Resolve the immutable dates displayed in Work Order Form Part A.
 *
 * Job and maintenance-history values are deliberately not accepted here:
 * Part A must remain stable when the linked Job or a later cycle changes.
 */
export function resolveWorkOrderPartADates(
  workOrder: WorkOrderPartADateSource,
): WorkOrderPartADates {
  const isRunningHoursOnly =
    workOrder.maintenanceBasis?.trim().toLowerCase() === 'running hours';

  return {
    lastCompletedOn: normalizePartADateForInput(
      firstNonEmptyDate(workOrder.lastDoneDateSnapshot),
    ),
    nextDueDate: isRunningHoursOnly
      ? ''
      : normalizePartADateForInput(
          firstNonEmptyDate(
            workOrder.dueDateSnapshot,
            workOrder.dueDate,
            workOrder.nextDueDate,
          ),
        ),
  };
}