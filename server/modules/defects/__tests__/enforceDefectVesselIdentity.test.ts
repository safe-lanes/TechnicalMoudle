/**
 * enforceDefectVesselIdentity — the defect read-route guard (30-Oct-2026, QA R3 retest JB-05 / EN-06 / RG-03).
 *
 * On a VESSEL installation a Ship user used to get 403 on /defects/:id/{approval-chain,closure-history,approval-process,
 * approval-routing}: the guard looked up master_user_vessels, a shore-only table a ship never holds (PROVEN on the pilot
 * ship: 200 on the defect, 403 on all four sub-routes). On a ship instance a Ship user now passes; the shore keeps the
 * assignment-table check; office users and admins are unchanged.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isShipInstance = vi.fn<[], Promise<boolean>>();
const hasActiveUserVesselAssignment = vi.fn<[string, string], Promise<boolean>>();
vi.mock('../../sync/syncRole', () => ({ isShipInstance: () => isShipInstance() }));
vi.mock('../services/defectsService', () => ({
  hasActiveUserVesselAssignment: (u: string, v: string) => hasActiveUserVesselAssignment(u, v),
  getDefect: vi.fn(),
}));

import { enforceDefectVesselIdentity } from '../controllers/defectsController';

function run(identity: { userType: string | null; role: string | null }, userUuid = 'u-1', vesselId = 'v-1') {
  const req: any = { rbac: { ...identity, source: 'forwarded' }, user: { userUuid }, params: { vesselId } };
  const status = vi.fn();
  const json = vi.fn();
  status.mockReturnValue({ json });
  const res: any = { status };
  const next = vi.fn();
  return enforceDefectVesselIdentity(req, res, next).then(() => ({ next, status, json }));
}

describe('enforceDefectVesselIdentity', () => {
  beforeEach(() => {
    isShipInstance.mockReset();
    hasActiveUserVesselAssignment.mockReset();
  });

  it('SHIP instance: a Ship user reads the defects of the vessel the installation serves (the QA 403)', async () => {
    isShipInstance.mockResolvedValue(true);
    const r = await run({ userType: 'Ship', role: 'Vessel Admin' });
    expect(r.next).toHaveBeenCalledTimes(1);
    expect(r.status).not.toHaveBeenCalled();
    expect(hasActiveUserVesselAssignment).not.toHaveBeenCalled(); // the shore-only table is never consulted on a ship
  });

  it('SHORE instance: a Ship user still needs an active assignment row (unchanged)', async () => {
    isShipInstance.mockResolvedValue(false);
    hasActiveUserVesselAssignment.mockResolvedValue(false);
    const r = await run({ userType: 'Ship', role: 'Vessel User' });
    expect(r.next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json).toHaveBeenCalledWith({ error: 'Forbidden - Can only access data for assigned vessel' });
    hasActiveUserVesselAssignment.mockResolvedValue(true);
    const ok = await run({ userType: 'Ship', role: 'Vessel User' });
    expect(ok.next).toHaveBeenCalledTimes(1);
  });

  it('office users and admins pass without any instance check (unchanged)', async () => {
    isShipInstance.mockResolvedValue(false);
    expect((await run({ userType: 'Office', role: 'User' })).next).toHaveBeenCalledTimes(1);
    expect((await run({ userType: 'Ship', role: 'Sail Admin' })).next).toHaveBeenCalledTimes(1);
    expect(isShipInstance).not.toHaveBeenCalled();
  });

  it('no forwarded identity → 403 (unchanged)', async () => {
    isShipInstance.mockResolvedValue(true);
    const r = await run({ userType: null, role: null });
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json).toHaveBeenCalledWith({ error: 'Forbidden - Vessel access requires a forwarded identity' });
  });
});
