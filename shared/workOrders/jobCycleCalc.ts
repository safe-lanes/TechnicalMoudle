/**
 * SHARED JOB-CYCLE ADVANCE CALCULATION (migration 161 era).
 *
 * Extracted VERBATIM from the completion service's post-completion job update block so
 * that the SHORE completion-learning hook (sync receive path) computes the exact same
 * next-due values a ship computes when its crew completes a WO. Any behavior change here
 * changes BOTH the live completion path and shore's learned values — keep them identical.
 *
 * Semantics preserved from the original inline blocks:
 *  - Calendar basis: requires dateOfCompletion; nextDue via calculateNextDueDate
 *    (with originalDueDate anchoring).
 *  - Dual Frequency: Calendar leg ALWAYS (given a completion date); RH leg ONLY when a
 *    completion RH was entered (D2 rule — untouched otherwise).
 *  - Running Hours: the completion date advances lastDoneDate as cycle metadata,
 *    while completionRH advances lastDoneRH/nextDueRH. The date never participates
 *    in RH threshold or due calculations.
 *  - jobUpdates carries lastDoneRH/nextDueRH as NUMBERS, matching the jobs table's
 *    existing write contract.
 */
import { calculateNextDueDate } from '../dateUtils';
import { parseWorkOrderDate } from './dateParse';

export interface JobCycleJobFields {
  frequencyValue?: string | number | null;
  frequencyUnit?: string | null;
  intervalRunningHour?: number | null;
  lastDoneDate?: string | null;
  lastDoneRH?: string | number | null;
  nextDueRH?: string | number | null;
  rhEstimatedDueDate?: string | null;
  rhAveragePerDay?: string | number | null;
  rhEstimateBasis?: string | null;
}

export interface JobCycleInput {
  maintenanceBasis: string | null | undefined;
  /** WO completion date (DD-MMM-YYYY). */
  dateOfCompletion?: string | null;
  /** Completion RH string (already resolved through the woCompletionRh ?? currentReading chain). */
  completionRH?: string | null;
  /** The WO's original due date (nextDueDate || dueDate) used to anchor calendar cycles. */
  originalDueDate?: string | null;
  job: JobCycleJobFields;
}

export interface JobCycleResult {
  /** Column updates for the jobs row (lastDoneRH/nextDueRH numeric). */
  jobUpdates: Record<string, any>;
}

function finiteRh(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Historical completion can remain part of the WO record without rolling a
 * Job's newer RH cycle backward. Calendar/date fields are intentionally left
 * alone; this guard owns only the Job-level RH fields.
 */
export function preserveNewerJobRhState(
  job: Pick<JobCycleJobFields, 'lastDoneDate' | 'lastDoneRH' | 'nextDueRH'>,
  updates: Record<string, any>,
): Record<string, any> {
  const guarded = { ...updates };
  const currentDate = parseWorkOrderDate(job.lastDoneDate);
  const incomingDate = parseWorkOrderDate(guarded.lastDoneDate);
  if (
    currentDate
    && incomingDate
    && incomingDate.getTime() <= currentDate.getTime()
  ) {
    delete guarded.lastDoneDate;
    delete guarded.nextDueDate;
  }
  const currentLastDone = finiteRh(job.lastDoneRH);
  const incomingLastDone = finiteRh(guarded.lastDoneRH);

  if (
    currentLastDone !== null
    && incomingLastDone !== null
    && incomingLastDone <= currentLastDone
  ) {
    delete guarded.lastDoneRH;
    delete guarded.nextDueRH;
    delete guarded.rhEstimatedDueDate;
    delete guarded.rhAveragePerDay;
    delete guarded.rhEstimateBasis;
    return guarded;
  }

  const currentNextDue = finiteRh(job.nextDueRH);
  const incomingNextDue = finiteRh(guarded.nextDueRH);
  if (
    currentNextDue !== null
    && incomingNextDue !== null
    && incomingNextDue < currentNextDue
  ) {
    delete guarded.nextDueRH;
    delete guarded.rhEstimatedDueDate;
    delete guarded.rhAveragePerDay;
    delete guarded.rhEstimateBasis;
  }

  return guarded;
}

export function computeJobCycleUpdates(input: JobCycleInput): JobCycleResult {
  const { maintenanceBasis, dateOfCompletion, completionRH, originalDueDate, job } = input;
  const jobUpdates: Record<string, any> = {};

  const applyCalendarLeg = () => {
    if (!dateOfCompletion) return;
    jobUpdates.lastDoneDate = dateOfCompletion;
    if (job.frequencyValue && job.frequencyUnit) {
      const nextDue = calculateNextDueDate(
        dateOfCompletion,
        job.frequencyValue as any,
        job.frequencyUnit as any,
        originalDueDate ?? undefined,
      );
      if (nextDue) {
        jobUpdates.nextDueDate = nextDue;
      }
    }
  };

  const applyRhLeg = () => {
    if (!completionRH) return;
    const currentRH = parseInt(completionRH);
    if (isNaN(currentRH)) return;
    jobUpdates.lastDoneRH = currentRH;
    const rhInterval =
      job.intervalRunningHour ||
      (job.frequencyValue ? parseInt(String(job.frequencyValue)) : null);
    if (rhInterval && !isNaN(rhInterval)) {
      const nextDueRH = currentRH + rhInterval;
      jobUpdates.nextDueRH = nextDueRH;
    }
  };

  if (maintenanceBasis === 'Calendar' && dateOfCompletion) {
    applyCalendarLeg();
  }

  if (maintenanceBasis === 'Dual Frequency' && dateOfCompletion) {
    applyCalendarLeg(); // Calendar leg: ALWAYS
    applyRhLeg();       // RH leg: ONLY if RH entered (D2) — applyRhLeg no-ops without RH
  }

  if (maintenanceBasis === 'Running Hours' && dateOfCompletion) {
    jobUpdates.lastDoneDate = dateOfCompletion;
  }

  if (maintenanceBasis === 'Running Hours' && completionRH) {
    applyRhLeg();
  }

  return { jobUpdates: preserveNewerJobRhState(job, jobUpdates) };
}
