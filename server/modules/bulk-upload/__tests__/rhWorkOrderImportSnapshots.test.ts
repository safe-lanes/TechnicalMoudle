import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveWorkOrderPartADates } from '../../work-orders/utils/workOrderPartADates';

const persisted: any[] = [];
const component = {
  cuuid: 'component-uuid',
  name: 'Main Engine',
  currentCumulativeRH: '900',
};
const job = {
  id: 42,
  juuid: 'job-uuid',
  jobNo: 'JOB-001',
  jobTitle: 'Inspect Engine',
  componentId: component.cuuid,
  maintenanceBasis: 'Running Hours',
  intervalRunningHour: 250,
  lastDoneDate: '01-Feb-2026',
  lastDoneRH: '800',
  nextDueRH: '1050',
};

vi.mock('../../../storage', () => ({
  storage: {
    getComponent: vi.fn(async () => component),
    getJobs: vi.fn(async () => [job]),
    createWorkOrder: vi.fn(async (data: any) => {
      persisted.push(structuredClone(data));
      return { id: 'wo-local-id', wouuid: 'wo-uuid', ...data };
    }),
  },
}));

vi.mock('../../../utils/workOrderNumbering', () => ({
  generatePlannedWorkOrderNumber: vi.fn(async () => 'JOB-001-651.001-2026-001'),
  generateUnplannedWorkOrderNumber: vi.fn(async () => 'UWO-651.001-2026-001'),
}));

vi.mock('../../work-orders/services/workOrderService', () => ({
  applyAssignmentSync: vi.fn(async (data: any) => data),
}));

describe('standard bulk RH Work Order creation', () => {
  beforeEach(() => {
    persisted.length = 0;
  });

  it('persists the linked Job cycle as immutable Part A snapshots', async () => {
    const { createWorkOrderFromRow } = await import('../services/importService');
    await createWorkOrderFromRow({
      Generated_Component_Code: '651.001',
      Job_Title: 'Inspect Engine',
      Job_Code: 'JOB-001',
      Schedule_Type: 'Running Hours',
      Interval: 250,
      Interval_Unit: 'Hours',
      Responsible_Rank: '2nd Engineer',
    }, 'WO-TEMPLATE-1', 'vessel-uuid');

    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      jobId: 'job-uuid',
      maintenanceBasis: 'Running Hours',
      driverType: 'RH',
      lastDoneDateSnapshot: '01-Feb-2026',
      rhLastDoneSnapshot: '800',
      dueRhSnapshot: '1050',
      cycleDueRhSnapshot: '1050',
      nextDueReading: '1050',
      effectiveRhAtGeneration: '900',
      currentReading: '900',
      intervalRunningHour: '250',
    });

    job.lastDoneDate = '15-Mar-2026';
    job.lastDoneRH = '1050';
    job.nextDueRH = '1300';

    expect(resolveWorkOrderPartADates(persisted[0])).toEqual({
      lastCompletedOn: '2026-02-01',
      nextDueDate: '',
      lastCompletedRH: '800',
      nextDueRH: '1050',
    });
  });
});