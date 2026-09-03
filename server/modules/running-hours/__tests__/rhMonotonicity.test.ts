import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRHMonotonicity } from '../utils/rhValidation';
import { canApplyWinningRHToCurrent } from '../rhEventComparator';

const repo = vi.hoisted(() => ({
  getComponent: vi.fn(),
  getPmsVesselSettings: vi.fn(),
  updateMasterRunningHours: vi.fn(),
  updateChildRhWithStampAccrual: vi.fn(),
  createRunningHoursAudit: vi.fn(),
}));

vi.mock('../repositories/runningHoursRepository', () => repo);

import { updateChildRH, updateMasterRH } from '../services/runningHoursService';

describe('RH monotonicity integrity rule', () => {
  it('rejects the production regression: 1,840 to 1,800 on a later date', () => {
    const result = validateRHMonotonicity({
      currentRH: 1840,
      submittedRH: 1800,
      currentRHDate: '2026-07-31',
      submittedRHDate: '2026-08-07',
    });

    expect(result).toMatchObject({
      allowed: false,
      reason: 'LOWER_THAN_CURRENT_RH',
      delta: -40,
      currentRH: 1840,
      submittedRH: 1800,
    });
  });

  it('allows equal values as idempotent no-ops', () => {
    expect(validateRHMonotonicity({
      currentRH: 1840,
      submittedRH: 1840,
    })).toMatchObject({
      allowed: true,
      reason: 'EQUAL_CURRENT_RH',
      delta: 0,
    });
  });

  it('allows an explicitly approved reset while rejecting an ordinary decrease', () => {
    expect(validateRHMonotonicity({
      currentRH: 1840,
      submittedRH: 0,
      approvedReset: true,
    }).reason).toBe('APPROVED_RESET');

    expect(validateRHMonotonicity({
      currentRH: 1840,
      submittedRH: 0,
    }).allowed).toBe(false);
  });
});

describe('RH service boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.updateMasterRunningHours.mockResolvedValue({
      masterUpdated: {},
      inheritedUpdated: 0,
    });
    repo.updateChildRhWithStampAccrual.mockResolvedValue({
      previousRH: 1840,
      changed: true,
    });
    repo.createRunningHoursAudit.mockResolvedValue({});
  });

  it('blocks a lower Work Order reading before master persistence', async () => {
    repo.getComponent.mockResolvedValue({
      cuuid: 'master-1',
      id: 'master-1',
      vesselId: null,
      name: 'Main Engine',
      componentCode: '601001001',
      rhCounterType: 'MASTER',
      rhCurrentMaster: '1840',
      currentCumulativeRH: '1840',
      lastUpdated: '2026-07-31',
    });

    await expect(updateMasterRH('master-1', {
      newRHValue: 1800,
      updateSource: 'WORKORDER',
      userId: 'Chief Engineer',
      dateUpdated: '2026-08-07',
    })).rejects.toMatchObject({
      details: {
        code: 'LOWER_THAN_CURRENT_RH',
        currentRH: 1840,
        submittedRH: 1800,
        delta: -40,
      },
    });

    expect(repo.updateMasterRunningHours).not.toHaveBeenCalled();
  });

  it('blocks a lower inherited reading even when vessel rate validation is off', async () => {
    repo.getComponent.mockResolvedValue({
      cuuid: 'child-1',
      id: 'child-1',
      vesselId: 'vessel-1',
      name: 'Cylinder Unit',
      rhCounterType: 'INHERITED',
      currentCumulativeRH: '1840',
      lastUpdated: '2026-07-31',
    });
    repo.getPmsVesselSettings.mockResolvedValue({ rhValidationEnabled: false });

    await expect(updateChildRH('child-1', {
      newRHValue: 1800,
      dateUpdated: '2026-08-07',
      rhValidationEnabled: false,
    })).rejects.toMatchObject({
      details: {
        code: 'LOWER_THAN_CURRENT_RH',
      },
    });

    expect(repo.updateChildRhWithStampAccrual).not.toHaveBeenCalled();
    expect(repo.createRunningHoursAudit).not.toHaveBeenCalled();
  });

  it('does not persist or audit an equal master reading', async () => {
    const component = {
      cuuid: 'master-1',
      id: 'master-1',
      vesselId: null,
      name: 'Main Engine',
      rhCounterType: 'MASTER',
      rhCurrentMaster: '1840',
      currentCumulativeRH: '1840',
      lastUpdated: '2026-07-31',
    };
    repo.getComponent.mockResolvedValue(component);

    const result = await updateMasterRH('master-1', {
      newRHValue: 1840,
      updateSource: 'WORKORDER',
      userId: 'Chief Engineer',
      dateUpdated: '2026-08-07',
    });

    expect(result).toMatchObject({ success: true, noChange: true, inheritedUpdated: 0 });
    expect(repo.updateMasterRunningHours).not.toHaveBeenCalled();
  });

  it('persists a valid higher Work Order reading with its source unchanged', async () => {
    repo.getComponent.mockResolvedValue({
      cuuid: 'master-1',
      id: 'master-1',
      vesselId: null,
      name: 'Main Engine',
      rhCounterType: 'MASTER',
      rhCurrentMaster: '1840',
      currentCumulativeRH: '1840',
      lastUpdated: '2026-08-06',
    });

    await updateMasterRH('master-1', {
      newRHValue: 1850,
      updateSource: 'WORKORDER',
      userId: 'Chief Engineer',
      dateUpdated: '2026-08-07',
    });

    expect(repo.updateMasterRunningHours).toHaveBeenCalledWith(expect.objectContaining({
      newRHValue: 1850,
      updateSource: 'WORKORDER',
    }));
  });
});

describe('sync winner monotonicity', () => {
  it('does not apply a lower non-reset winner', () => {
    expect(canApplyWinningRHToCurrent(1840, 1800, false)).toBe(false);
  });

  it('allows a lower approved reset winner', () => {
    expect(canApplyWinningRHToCurrent(1840, 0, true)).toBe(true);
  });

  it('allows equal and higher winners', () => {
    expect(canApplyWinningRHToCurrent(1840, 1840, false)).toBe(true);
    expect(canApplyWinningRHToCurrent(1840, 1850, false)).toBe(true);
  });
});