import { describe, expect, it } from 'vitest';
import {
  compareWorkOrders,
  getDisplayedWorkOrderDueDate,
  isDisplayedWorkOrderDueDateExpected,
  shouldShowNextDueHourColumn,
} from '@shared/utils/workOrderFilters';
import {
  buildHydrationJobIndexes,
  resolveWorkOrderHydrationJob,
} from '../utils/workOrderListHydration';

describe('Work Order due detail display', () => {
  it('uses the calendar date for Calendar jobs', () => {
    expect(getDisplayedWorkOrderDueDate({
      maintenanceBasis: 'Calendar',
      dueDate: '20-Oct-2026',
      rhEstimatedDueDate: '10-Oct-2026',
    })).toBe('20-Oct-2026');
  });

  it('uses the expected RH date for Running Hours jobs', () => {
    const workOrder = {
      maintenanceBasis: 'Running Hours',
      dueDate: null,
      rhEstimatedDueDate: '13-Nov-2026',
    };
    expect(getDisplayedWorkOrderDueDate(workOrder)).toBe('13-Nov-2026');
    expect(isDisplayedWorkOrderDueDateExpected(workOrder)).toBe(true);
  });

  it('uses the earlier calendar or expected RH date for Dual Frequency jobs', () => {
    const rhEarlier = {
      maintenanceBasis: 'Dual Frequency',
      dueDate: '20-Dec-2026',
      rhEstimatedDueDate: '15-Nov-2026',
    };
    const calendarEarlier = {
      maintenanceBasis: 'Dual Frequency',
      dueDate: '20-Oct-2026',
      rhEstimatedDueDate: '15-Nov-2026',
    };
    expect(getDisplayedWorkOrderDueDate(rhEarlier)).toBe('15-Nov-2026');
    expect(isDisplayedWorkOrderDueDateExpected(rhEarlier)).toBe(true);
    expect(getDisplayedWorkOrderDueDate(calendarEarlier)).toBe('20-Oct-2026');
    expect(isDisplayedWorkOrderDueDateExpected(calendarEarlier)).toBe(false);
  });

  it('does not label Calendar due dates as expected', () => {
    expect(isDisplayedWorkOrderDueDateExpected({
      maintenanceBasis: 'Calendar',
      dueDate: '20-Oct-2026',
      rhEstimatedDueDate: '10-Oct-2026',
    })).toBe(false);
  });

  it('keeps a missing estimate separate from an available RH threshold', () => {
    expect(getDisplayedWorkOrderDueDate({
      maintenanceBasis: 'Running Hours',
      dueDate: null,
      rhEstimatedDueDate: null,
      nextDueHour: 500,
    })).toBeNull();
  });

  it('sorts by the date displayed to the user', () => {
    const calendar = { maintenanceBasis: 'Calendar', dueDate: '20-Oct-2026' };
    const rh = { maintenanceBasis: 'Running Hours', rhEstimatedDueDate: '2026-11-10' };
    expect(compareWorkOrders(calendar, rh, 'dueDate', 'asc', 'Due')).toBeLessThan(0);
  });

  it('shows Next Due Hour only on the four applicable Work Order tabs', () => {
    for (const tab of ['Planned', 'Due', 'Overdue', 'Postponed']) {
      expect(shouldShowNextDueHourColumn(tab)).toBe(true);
    }
    for (const tab of ['Pending Approval', 'Completed', 'Unplanned']) {
      expect(shouldShowNextDueHourColumn(tab)).toBe(false);
    }
  });

  it('uses the same-vessel job when legacy job numbers collide', () => {
    const vesselOneJob = {
      juuid: 'job-v1',
      vesselId: 'v1',
      jobNo: 'MKR-001',
      rhEstimatedDueDate: '2026-10-10',
      nextDueRH: '500',
    };
    const vesselTwoJob = {
      juuid: 'job-v2',
      vesselId: 'v2',
      jobNo: 'MKR-001',
      rhEstimatedDueDate: '2026-11-20',
      nextDueRH: '900',
    };
    const jobs = [vesselOneJob, vesselTwoJob];
    const resolved = resolveWorkOrderHydrationJob(
      { vesselId: 'v2', templateCode: 'MKR-001' },
      new Map(jobs.map(job => [job.juuid, job])),
      buildHydrationJobIndexes(jobs),
    );
    expect(resolved).toBe(vesselTwoJob);
  });

  it('uses component identity when job numbers collide within one vessel', () => {
    const componentOneJob = {
      juuid: 'job-c1',
      vesselId: 'v1',
      jobNo: 'MKR-001',
      componentId: 'component-1',
      componentCode: '601.001',
      rhEstimatedDueDate: '2026-10-10',
      nextDueRH: '500',
    };
    const componentTwoJob = {
      juuid: 'job-c2',
      vesselId: 'v1',
      jobNo: 'MKR-001',
      componentId: 'component-2',
      componentCode: '601.002',
      rhEstimatedDueDate: '2026-11-20',
      nextDueRH: '900',
    };
    const jobs = [componentOneJob, componentTwoJob];
    const indexes = buildHydrationJobIndexes(jobs);
    const resolved = resolveWorkOrderHydrationJob(
      { vesselId: 'v1', templateCode: 'MKR-001', componentCode: '601.002' },
      new Map(jobs.map(job => [job.juuid, job])),
      indexes,
    );
    expect(resolved).toBe(componentTwoJob);
    expect(resolveWorkOrderHydrationJob(
      { vesselId: 'v1', templateCode: 'MKR-001' },
      new Map(jobs.map(job => [job.juuid, job])),
      indexes,
    )).toBeNull();
  });
});