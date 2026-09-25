export interface WorkOrderPartADateSource {
  maintenanceBasis?: string | null;
  lastDoneDateSnapshot?: string | null;
  dueDateSnapshot?: string | null;
  dueDate?: string | null;
  nextDueDate?: string | null;
  rhLastDoneSnapshot?: string | number | null;
  dueRhSnapshot?: string | number | null;
  cycleDueRhSnapshot?: string | number | null;
  nextDueReading?: string | number | null;
}

export interface WorkOrderPartADates {
  lastCompletedOn: string;
  nextDueDate: string;
  lastCompletedRH: string;
  nextDueRH: string;
}

export interface RunningHoursWorkOrderSnapshotSource {
  lastDoneDate?: string | null;
  lastDoneRH?: string | number | null;
  dueRH?: string | number | null;
  currentRH?: string | number | null;
  intervalRunningHour?: string | number | null;
}

export function buildRunningHoursWorkOrderSnapshots(
  source: RunningHoursWorkOrderSnapshotSource,
): Record<string, string | number | null> {
  const dueRH = firstNonEmptyRH(source.dueRH);
  const lastDoneRH = firstNonEmptyRH(source.lastDoneRH);
  const currentRH = firstNonEmptyRH(source.currentRH);
  const interval = firstNonEmptyRH(source.intervalRunningHour);
  return {
    driverType: 'RH',
    cycleDueRhSnapshot: dueRH || null,
    dueRhSnapshot: dueRH || null,
    nextDueReading: dueRH || null,
    rhLastDoneSnapshot: lastDoneRH || null,
    lastDoneDateSnapshot: source.lastDoneDate?.trim() || null,
    effectiveRhAtGeneration: currentRH || null,
    currentReading: currentRH || null,
    intervalRunningHour: interval || null,
  };
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

const IMMUTABLE_WORK_ORDER_SNAPSHOT_COLUMNS = new Set([
  'driver_type',
  'dual_trigger_leg',
  'cycle_due_rh_snapshot',
  'generate_rh_snapshot',
  'due_rh_snapshot',
  'effective_rh_at_generation',
  'rh_last_done_snapshot',
  'cycle_due_date_snapshot',
  'generate_date_snapshot',
  'due_date_snapshot',
  'last_done_date_snapshot',
]);

export function isImmutableWorkOrderSnapshotField(
  fieldName: string,
): boolean {
  return (IMMUTABLE_WORK_ORDER_SNAPSHOT_FIELDS as readonly string[]).includes(fieldName)
    || IMMUTABLE_WORK_ORDER_SNAPSHOT_COLUMNS.has(fieldName);
}

/**
 * Sync may populate a snapshot once when a newly-created row arrives in parts,
 * but it must never rewrite an existing snapshot.
 */
export function shouldApplySyncedWorkOrderSnapshot(
  currentValue: unknown,
  senderOldValue: unknown,
): boolean {
  const receiverEmpty = currentValue === null
    || currentValue === undefined
    || String(currentValue).trim() === '';
  const senderCreatedField = senderOldValue === null
    || senderOldValue === undefined
    || String(senderOldValue).trim() === '';
  return receiverEmpty && senderCreatedField;
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

function firstNonEmptyRH(
  ...values: Array<string | number | null | undefined>
): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const trimmed = String(value).trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function normalizePartARunningHours(
  value: string | number | null | undefined,
): string {
  const trimmed = value === null || value === undefined
    ? ''
    : String(value).trim();
  if (!trimmed) return '';

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? String(numeric) : trimmed;
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
  const normalizedBasis = workOrder.maintenanceBasis?.trim().toLowerCase();
  const hasCalendarLeg = normalizedBasis !== 'running hours';
  const hasRunningHoursLeg =
    normalizedBasis === 'running hours' || normalizedBasis === 'dual frequency';

  return {
    lastCompletedOn: normalizePartADateForInput(
      firstNonEmptyDate(workOrder.lastDoneDateSnapshot),
    ),
    nextDueDate: hasCalendarLeg
      ? normalizePartADateForInput(
          firstNonEmptyDate(
            workOrder.dueDateSnapshot,
            workOrder.dueDate,
            workOrder.nextDueDate,
          ),
        )
      : '',
    lastCompletedRH: normalizePartARunningHours(
      firstNonEmptyRH(workOrder.rhLastDoneSnapshot),
    ),
    nextDueRH: hasRunningHoursLeg
      ? normalizePartARunningHours(
          firstNonEmptyRH(
            workOrder.dueRhSnapshot,
            workOrder.cycleDueRhSnapshot,
            workOrder.nextDueReading,
          ),
        )
      : '',
  };
}

/** Numeric list value for the same Work Order-owned RH due shown in Part A. */
export function getWorkOrderListDueHour(workOrder: WorkOrderPartADateSource): number | null {
  const dueRH = resolveWorkOrderPartADates(workOrder).nextDueRH;
  if (!dueRH) return null;
  const value = Number(dueRH);
  return Number.isFinite(value) ? value : null;
}