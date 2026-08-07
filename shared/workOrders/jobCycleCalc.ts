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
 *  - Running Hours: requires completionRH; interval = intervalRunningHour, falling back
 *    to parseInt(frequencyValue).
 *  - jobUpdates carries lastDoneRH/nextDueRH as NUMBERS, linkUpdates as STRINGS —
 *    exactly as the original code wrote them.
 */
import { calculateNextDueDate } from '../dateUtils';

export interface JobCycleJobFields {
  frequencyValue?: string | number | null;
  frequencyUnit?: string | null;
  intervalRunningHour?: number | null;
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
  /** Column updates for the job_component_links row (RH values as strings). */
  linkUpdates: Record<string, any>;
}

export function computeJobCycleUpdates(input: JobCycleInput): JobCycleResult {
  const { maintenanceBasis, dateOfCompletion, completionRH, originalDueDate, job } = input;
  const jobUpdates: Record<string, any> = {};
  const linkUpdates: Record<string, any> = {};

  const applyCalendarLeg = () => {
    if (!dateOfCompletion) return;
    linkUpdates.lastDoneDate = dateOfCompletion;
    jobUpdates.lastDoneDate = dateOfCompletion;
    if (job.frequencyValue && job.frequencyUnit) {
      const nextDue = calculateNextDueDate(
        dateOfCompletion,
        job.frequencyValue as any,
        job.frequencyUnit as any,
        originalDueDate ?? undefined,
      );
      if (nextDue) {
        linkUpdates.nextDueDate = nextDue;
        jobUpdates.nextDueDate = nextDue;
      }
    }
  };

  const applyRhLeg = () => {
    if (!completionRH) return;
    const currentRH = parseInt(completionRH);
    if (isNaN(currentRH)) return;
    linkUpdates.lastDoneRH = currentRH.toString();
    jobUpdates.lastDoneRH = currentRH;
    const rhInterval =
      job.intervalRunningHour ||
      (job.frequencyValue ? parseInt(String(job.frequencyValue)) : null);
    if (rhInterval && !isNaN(rhInterval)) {
      const nextDueRH = currentRH + rhInterval;
      linkUpdates.nextDueRH = nextDueRH.toString();
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

  if (maintenanceBasis === 'Running Hours' && completionRH) {
    applyRhLeg();
  }

  return { jobUpdates, linkUpdates };
}
