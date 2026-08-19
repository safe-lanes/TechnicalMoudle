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

  it('honors an OFF vessel policy for a negative delta when the client omits the legacy flag', async () => {
    repo.getPmsVesselSettings.mockResolvedValue({ vesselId: 'vessel-a', rhValidationEnabled: false });

    await cascadeUpdate({ ...baseRequest, mode: 'addDelta', value: -10 }, 'Ship');

    expect(repo.cascadeRunningHoursUpdate).toHaveBeenCalledWith(expect.objectContaining({
      rhValidationBypassed: true,
      value: -10,
    }));
  });

  it('honors an OFF vessel policy for a normal zero reset when the client omits the legacy flag', async () => {
    repo.getPmsVesselSettings.mockResolvedValue({ vesselId: 'vessel-a', rhValidationEnabled: false });

    await cascadeUpdate({ ...baseRequest, mode: 'setTotal', value: 0 }, 'Ship');

    expect(repo.cascadeRunningHoursUpdate).toHaveBeenCalledWith(expect.objectContaining({
      rhValidationBypassed: true,
      value: 0,
    }));
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