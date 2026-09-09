import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isShipInstance: vi.fn(),
  setRhValidationEnabled: vi.fn(),
  deletePmsVesselSettings: vi.fn(),
}));

vi.mock('../../sync/syncRole', () => ({
  isShipInstance: mocks.isShipInstance,
}));

vi.mock('../services/vesselService', () => ({
  setRhValidationEnabled: mocks.setRhValidationEnabled,
  deletePmsVesselSettings: mocks.deletePmsVesselSettings,
}));

import {
  createPmsVesselSettings,
  deletePmsVesselSettings,
  updatePmsVesselSettings,
  updateRhValidationSwitch,
} from '../controllers/vesselController';

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('vessel RH validation policy authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isShipInstance.mockResolvedValue(false);
  });

  it('rejects attempts to set RH validation through generic settings create/update routes', async () => {
    const createRes = response();
    await createPmsVesselSettings({ body: { vesselId: 'vessel-a', rhValidationEnabled: false } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(400);

    const updateRes = response();
    await updatePmsVesselSettings({ body: { rhValidationEnabled: false }, params: { vesselId: 'vessel-a' } } as any, updateRes);
    expect(updateRes.status).toHaveBeenCalledWith(400);
  });

  it('allows only shore Sail Admin / Super Admin users through the dedicated endpoint', async () => {
    mocks.setRhValidationEnabled.mockResolvedValue({ rhValidationEnabled: false, updatedBy: 'sail-admin' });
    const res = response();
    await updateRhValidationSwitch({
      params: { vesselId: 'vessel-a' },
      body: { enabled: false },
      user: { role: 'Sail Admin', username: 'sail-admin' },
    } as any, res);

    expect(mocks.setRhValidationEnabled).toHaveBeenCalledWith('vessel-a', false, 'sail-admin');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects non-admin and ship-side mutation attempts', async () => {
    const nonAdminRes = response();
    await updateRhValidationSwitch({
      params: { vesselId: 'vessel-a' },
      body: { enabled: false },
      user: { role: 'PMS Admin' },
    } as any, nonAdminRes);
    expect(nonAdminRes.status).toHaveBeenCalledWith(403);

    mocks.isShipInstance.mockResolvedValue(true);
    const shipRes = response();
    await updateRhValidationSwitch({
      params: { vesselId: 'vessel-a' },
      body: { enabled: false },
      user: { role: 'Sail Admin' },
    } as any, shipRes);
    expect(shipRes.status).toHaveBeenCalledWith(403);
  });

  it('treats generic settings deletion as an RH policy mutation', async () => {
    const nonAdminRes = response();
    await deletePmsVesselSettings({
      params: { vesselId: 'vessel-a' },
      user: { role: 'PMS Admin' },
    } as any, nonAdminRes);
    expect(nonAdminRes.status).toHaveBeenCalledWith(403);
    expect(mocks.deletePmsVesselSettings).not.toHaveBeenCalled();

    mocks.isShipInstance.mockResolvedValue(true);
    const shipRes = response();
    await deletePmsVesselSettings({
      params: { vesselId: 'vessel-a' },
      user: { role: 'Sail Admin' },
    } as any, shipRes);
    expect(shipRes.status).toHaveBeenCalledWith(403);
    expect(mocks.deletePmsVesselSettings).not.toHaveBeenCalled();
  });
});