import { describe, it, expect } from 'vitest';
import { computeJobCycleUpdates } from '@shared/workOrders/jobCycleCalc';

const calJob = { frequencyValue: 3, frequencyUnit: 'Months', intervalRunningHour: null };
const rhJob = { frequencyValue: null, frequencyUnit: null, intervalRunningHour: 500 };

describe('computeJobCycleUpdates', () => {
  it('Calendar: sets lastDoneDate and computes nextDueDate', () => {
    const { jobUpdates } = computeJobCycleUpdates({
      maintenanceBasis: 'Calendar',
      dateOfCompletion: '01-Aug-2026',
      originalDueDate: '01-Aug-2026',
      job: calJob,
    });
    expect(jobUpdates.lastDoneDate).toBe('01-Aug-2026');
    expect(jobUpdates.nextDueDate).toBeTruthy();
  });

  it('Calendar without completion date: no updates', () => {
    const { jobUpdates } = computeJobCycleUpdates({
      maintenanceBasis: 'Calendar', dateOfCompletion: null, job: calJob,
    });
    expect(Object.keys(jobUpdates)).toHaveLength(0);
  });

  it('Running Hours: numeric Job updates, interval from intervalRunningHour', () => {
    const { jobUpdates } = computeJobCycleUpdates({
      maintenanceBasis: 'Running Hours', completionRH: '12000', job: rhJob,
    });
    expect(jobUpdates.lastDoneRH).toBe(12000);
    expect(jobUpdates.nextDueRH).toBe(12500);
  });

  it('Running Hours: interval falls back to parseInt(frequencyValue)', () => {
    const { jobUpdates } = computeJobCycleUpdates({
      maintenanceBasis: 'Running Hours', completionRH: '1000',
      job: { frequencyValue: '250', frequencyUnit: null, intervalRunningHour: null },
    });
    expect(jobUpdates.nextDueRH).toBe(1250);
  });

  it('Running Hours: non-numeric RH → no updates', () => {
    const { jobUpdates } = computeJobCycleUpdates({
      maintenanceBasis: 'Running Hours', completionRH: 'abc', job: rhJob,
    });
    expect(Object.keys(jobUpdates)).toHaveLength(0);
  });

  it('Dual Frequency: calendar leg always, RH leg only when RH entered (D2)', () => {
    const withoutRh = computeJobCycleUpdates({
      maintenanceBasis: 'Dual Frequency', dateOfCompletion: '01-Aug-2026',
      job: { ...calJob, intervalRunningHour: 500 },
    });
    expect(withoutRh.jobUpdates.lastDoneDate).toBe('01-Aug-2026');
    expect(withoutRh.jobUpdates.lastDoneRH).toBeUndefined();

    const withRh = computeJobCycleUpdates({
      maintenanceBasis: 'Dual Frequency', dateOfCompletion: '01-Aug-2026', completionRH: '9000',
      job: { ...calJob, intervalRunningHour: 500 },
    });
    expect(withRh.jobUpdates.lastDoneDate).toBe('01-Aug-2026');
    expect(withRh.jobUpdates.lastDoneRH).toBe(9000);
    expect(withRh.jobUpdates.nextDueRH).toBe(9500);
  });

  it('unknown basis: no updates', () => {
    const { jobUpdates } = computeJobCycleUpdates({
      maintenanceBasis: 'Condition', dateOfCompletion: '01-Aug-2026', completionRH: '100', job: calJob,
    });
    expect(Object.keys(jobUpdates)).toHaveLength(0);
  });
});
