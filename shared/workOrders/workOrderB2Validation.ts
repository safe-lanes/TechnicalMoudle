export type WorkOrderB2ValidationCode =
  | 'START_DATE_NOT_AFTER_LAST_COMPLETED'
  | 'WO_COMPLETION_RH_NOT_AFTER_LAST_COMPLETED';

export interface WorkOrderB2ValidationError {
  code: WorkOrderB2ValidationCode;
  field: 'startDateTime' | 'woCompletionRh';
  message: string;
}

export interface WorkOrderB2ValidationInput {
  maintenanceBasis?: string | null;
  startDateTime?: string | null;
  lastDoneDateSnapshot?: string | null;
  woCompletionRh?: string | number | null;
  rhLastDoneSnapshot?: string | number | null;
}

const MONTH_NUMBER: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function normalizeWorkOrderB2Date(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const numeric = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (numeric) {
    return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  }

  const named = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (named) {
    const month = MONTH_NUMBER[named[2].toLowerCase()];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`;
  }

  return null;
}

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateWorkOrderB2Baselines(
  input: WorkOrderB2ValidationInput,
): WorkOrderB2ValidationError[] {
  const errors: WorkOrderB2ValidationError[] = [];
  const basis = String(input.maintenanceBasis || '').trim().toUpperCase();
  const validatesStartDate =
    basis === 'CALENDAR'
    || basis === 'RUNNING HOURS'
    || basis === 'DUAL FREQUENCY';

  if (validatesStartDate) {
    const startDate = normalizeWorkOrderB2Date(input.startDateTime);
    const lastCompletedOn = normalizeWorkOrderB2Date(input.lastDoneDateSnapshot);
    if (startDate && lastCompletedOn && startDate <= lastCompletedOn) {
      errors.push({
        code: 'START_DATE_NOT_AFTER_LAST_COMPLETED',
        field: 'startDateTime',
        message: `Start Date must be after Last Completed On (${lastCompletedOn}).`,
      });
    }
  }

  if (basis === 'RUNNING HOURS') {
    const completionRH = finiteNumber(input.woCompletionRh);
    const lastCompletedRH = finiteNumber(input.rhLastDoneSnapshot);
    if (
      completionRH !== null
      && lastCompletedRH !== null
      && completionRH <= lastCompletedRH
    ) {
      errors.push({
        code: 'WO_COMPLETION_RH_NOT_AFTER_LAST_COMPLETED',
        field: 'woCompletionRh',
        message: `WO Completion RH must be greater than Last Completed At (${lastCompletedRH} Hours).`,
      });
    }
  }

  return errors;
}