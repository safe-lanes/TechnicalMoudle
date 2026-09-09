import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  getComponent: vi.fn(),
  getPmsVesselSettings: vi.fn(),
  cascadeRunningHoursUpdate: vi.fn(),
}));

vi.mock('../repositories/runningHoursRepository', () => repo);

import { cascadeUpdate } from '../services/runningHoursService';

const baseRequest = {
  parentComponentId: 'component-a',
  dateUpdated: '2026-08-19',
  userId: 'test-user',
};

describe('cascade RH vessel-policy enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.getComponent.mockResolvedValue({
      id: 'component-a',
      vesselId: 'vessel-a',
      currentCumulativeRH: '100',
      lastUpdated: '2026-08-18',
    });
    repo.cascadeRunningHoursUpdate.mockResolvedValue({ updated: 1 });
  });

  it('rejects a negative delta even when vessel rate validation is OFF', async () => {
    repo.getPmsVesselSettings.mockResolvedValue({ vesselId: 'vessel-a', rhValidationEnabled: false });

    await expect(
      cascadeUpdate({ ...baseRequest, mode: 'addDelta', value: -10 }, 'Ship')
    ).rejects.toThrow('addDelta mode requires value > 0');

    expect(repo.cascadeRunningHoursUpdate).not.toHaveBeenCalled();
  });

  it('rejects an ordinary zero reset when vessel rate validation is OFF', async () => {
    repo.getPmsVesselSettings.mockResolvedValue({ vesselId: 'vessel-a', rhValidationEnabled: false });

    await expect(
      cascadeUpdate({ ...baseRequest, mode: 'setTotal', value: 0 }, 'Ship')
    ).rejects.toMatchObject({
      details: { code: 'LOWER_THAN_CURRENT_RH' },
    });

    expect(repo.cascadeRunningHoursUpdate).not.toHaveBeenCalled();
  });

  it('does not let a Sail Admin forged-OFF flag bypass an ON vessel policy', async () => {
    repo.getPmsVesselSettings.mockResolvedValue({ vesselId: 'vessel-a', rhValidationEnabled: true });

    await expect(cascadeUpdate({
      ...baseRequest,
      mode: 'addDelta',
      value: -10,
      rhValidationEnabled: false,
    }, 'Sail Admin')).rejects.toMatchObject({
      statusCode: 400,
      message: 'addDelta mode requires value > 0',
    });

    expect(repo.cascadeRunningHoursUpdate).not.toHaveBeenCalled();
  });
});