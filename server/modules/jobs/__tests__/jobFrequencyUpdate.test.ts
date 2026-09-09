import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/jobRepository', () => ({
  findById: vi.fn(),
  findComponent: vi.fn(),
  update: vi.fn(),
}));

import * as repo from '../repositories/jobRepository';
import { updateJob } from '../services/jobService';

const mockedRepo = vi.mocked(repo);

function runningHoursJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    juuid: 'job-1',
    vesselId: 'vessel-1',
    componentId: null,
    maintenanceBasis: 'Running Hours',
    frequencyValue: null,
    frequencyUnit: null,
    intervalRunningHour: 400,
    lastDoneRH: '1000',
    ...overrides,
  } as any;
}

describe('Running Hours job frequency updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRepo.update.mockImplementation(async (_id, data) => data as any);
  });

  it('normalizes a legacy frequencyValue update into intervalRunningHour and recalculates nextDueRH', async () => {
    mockedRepo.findById.mockResolvedValue(runningHoursJob());

    await updateJob('job-1', { frequencyValue: '600' });

    expect(mockedRepo.update).toHaveBeenCalledWith('job-1', {
      intervalRunningHour: 600,
      nextDueRH: '1600',
    });
  });

  it('persists an explicit RH interval and recalculates nextDueRH', async () => {
    mockedRepo.findById.mockResolvedValue(runningHoursJob());

    await updateJob('job-1', { intervalRunningHour: '750' });

    expect(mockedRepo.update).toHaveBeenCalledWith('job-1', {
      intervalRunningHour: 750,
      nextDueRH: '1750',
    });
  });

  it.each(['', 0, -1, '1.5'])('rejects invalid RH interval %j', async (intervalRunningHour) => {
    mockedRepo.findById.mockResolvedValue(runningHoursJob());

    await expect(updateJob('job-1', { intervalRunningHour })).rejects.toThrow(
      'Frequency (Hours) to be a whole number greater than 0'
    );
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  it('keeps Calendar frequency updates in frequencyValue', async () => {
    mockedRepo.findById.mockResolvedValue({
      id: 'job-2',
      juuid: 'job-2',
      vesselId: 'vessel-1',
      componentId: null,
      maintenanceBasis: 'Calendar',
      frequencyValue: '3',
      frequencyUnit: 'Months',
      lastDoneDate: null,
    } as any);

    await updateJob('job-2', { frequencyValue: '6' });

    expect(mockedRepo.update).toHaveBeenCalledWith('job-2', {
      frequencyValue: '6',
    });
  });

  it('keeps both Dual Frequency legs independent', async () => {
    mockedRepo.findById.mockResolvedValue({
      id: 'job-3',
      juuid: 'job-3',
      vesselId: 'vessel-1',
      componentId: null,
      maintenanceBasis: 'Dual Frequency',
      frequencyValue: '3',
      frequencyUnit: 'Months',
      intervalRunningHour: 400,
    } as any);

    await updateJob('job-3', {
      frequencyValue: '6',
      frequencyUnit: 'Months',
      intervalRunningHour: 800,
    });

    expect(mockedRepo.update).toHaveBeenCalledWith('job-3', {
      frequencyValue: '6',
      frequencyUnit: 'Months',
      intervalRunningHour: 800,
    });
  });
});