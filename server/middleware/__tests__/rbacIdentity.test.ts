/**
 * Phase 0 / P0.1 — server-side RBAC identity.
 * The SAILERP shell forwards identity as headers (x-user-id / x-user-role / x-user-type / …).
 * Before P0.1, mockAuthMiddleware set req.user.role='Sail Admin' for EVERY request and requireRole /
 * requirePermission never enforced anything. These tests pin the new contract:
 *   - the forwarded role/type are resolved onto req.rbac
 *   - requireRole evaluates the forwarded identity (Office/Ship by user type, admins by name)
 *   - requirePermission is a pass-through unless a route opts in ({ enforce: true }); when enforcing it
 *     bypasses only real admins, reads permissions for the forwarded role name, and can be told to
 *     DENY unconfigured roles
 *   - PMS_AUTH_MOCK_RBAC=1 restores the old mock (local/pilot only)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../storage', () => ({
  storage: {
    getRoleByName: vi.fn(),
    getRoleMenuPermissions: vi.fn(),
    getActiveMenuItems: vi.fn(),
  },
}));

import { mockAuthMiddleware, requireRole } from '../auth';
import { requirePermission } from '../permissions';
import { storage } from '../../storage';

type Res = { statusCode: number; body: any; status: (c: number) => Res; json: (b: any) => Res };
const mkRes = (): Res => { const r: any = { statusCode: 200, body: null }; r.status = (c: number) => { r.statusCode = c; return r; }; r.json = (b: any) => { r.body = b; return r; }; return r; };
const mkReq = (headers: Record<string, string> = {}, body: any = {}) => ({ headers, body } as any);
const run = (mw: any, req: any) => new Promise<{ res: Res; nexted: boolean }>((resolve) => {
  const res = mkRes();
  let nexted = false;
  const out = mw(req, res, () => { nexted = true; resolve({ res, nexted }); });
  if (out && typeof out.then === 'function') out.then(() => resolve({ res, nexted })); else setImmediate(() => resolve({ res, nexted }));
});
const office = (role: string) => ({ 'x-user-id': 'u1', 'x-user-role': encodeURIComponent(role), 'x-user-type': 'Office' });
const ship = (role: string) => ({ 'x-user-id': 'u2', 'x-user-role': encodeURIComponent(role), 'x-user-type': 'Ship' });

describe('P0.1 mockAuthMiddleware resolves the forwarded identity onto req.rbac', () => {
  const saved = process.env.PMS_AUTH_MOCK_RBAC;
  beforeEach(() => { delete process.env.PMS_AUTH_MOCK_RBAC; });
  afterEach(() => { if (saved === undefined) delete process.env.PMS_AUTH_MOCK_RBAC; else process.env.PMS_AUTH_MOCK_RBAC = saved; });

  it('forwarded Office/Admin → rbac {role:"Admin", userType:"Office", source:"forwarded"}', async () => {
    const req = mkReq(office('Admin'));
    await run(mockAuthMiddleware, req);
    expect(req.rbac).toEqual({ role: 'Admin', userType: 'Office', source: 'forwarded' });
    // identity fields still threaded as before
    expect(req.user.userUuid).toBe('u1');
    expect((req.user as any).forwardedRole).toBe('Admin');
  });
  it('forwarded Ship/Vessel User → userType Ship', async () => {
    const req = mkReq(ship('Vessel User'));
    await run(mockAuthMiddleware, req);
    expect(req.rbac).toEqual({ role: 'Vessel User', userType: 'Ship', source: 'forwarded' });
  });
  it('no forwarded identity → source "none", no role', async () => {
    const req = mkReq({});
    await run(mockAuthMiddleware, req);
    expect(req.rbac).toEqual({ role: null, userType: null, source: 'none' });
  });
  it('PMS_AUTH_MOCK_RBAC=1 → the old mock (Sail Admin / Office) regardless of headers', async () => {
    process.env.PMS_AUTH_MOCK_RBAC = '1';
    const req = mkReq(ship('Vessel User'));
    await run(mockAuthMiddleware, req);
    expect(req.rbac).toEqual({ role: 'Sail Admin', userType: 'Office', source: 'mock' });
  });
  it('req.user.role is unchanged (legacy consumers keep today\'s value)', async () => {
    const req = mkReq(ship('Vessel User'));
    await run(mockAuthMiddleware, req);
    expect(req.user.role).toBe('Sail Admin');
  });
});

describe('P0.1 requireRole evaluates the forwarded identity', () => {
  const officeOnly = requireRole(['Office', 'PMS Admin', 'Sail Admin']);
  const sailOnly = requireRole(['Sail Admin']);
  const withIdentity = async (headers: Record<string, string>, mw: any) => { const req = mkReq(headers); await run(mockAuthMiddleware, req); return run(mw, req); };

  it('Office-typed user (role "Admin") passes the office guard', async () => { const r = await withIdentity(office('Admin'), officeOnly); expect(r.nexted).toBe(true); });
  it('Sail Admin passes the office guard', async () => { const r = await withIdentity(office('Sail Admin'), officeOnly); expect(r.nexted).toBe(true); });
  it('Ship-typed user (Vessel User) is refused 403 with required/current', async () => {
    const r = await withIdentity(ship('Vessel User'), officeOnly);
    expect(r.nexted).toBe(false); expect(r.res.statusCode).toBe(403); expect(r.res.body.current).toBe('Vessel User'); expect(r.res.body.required).toEqual(['Office', 'PMS Admin', 'Sail Admin']);
  });
  it('Ship-typed Vessel Admin is refused too (type decides, not admin-ish names)', async () => { const r = await withIdentity(ship('Vessel Admin'), officeOnly); expect(r.res.statusCode).toBe(403); });
  it('no forwarded identity → 403 (current "anonymous")', async () => { const r = await withIdentity({}, officeOnly); expect(r.res.statusCode).toBe(403); expect(r.res.body.current).toBe('anonymous'); });
  it('name-only guard: Sail Admin passes, Super Admin does not', async () => {
    expect((await withIdentity(office('Sail Admin'), sailOnly)).nexted).toBe(true);
    expect((await withIdentity(office('Super Admin'), sailOnly)).res.statusCode).toBe(403);
  });
  it('mock switch on → everything passes as before', async () => {
    process.env.PMS_AUTH_MOCK_RBAC = '1';
    try { expect((await withIdentity(ship('Vessel User'), sailOnly)).nexted).toBe(true); } finally { delete process.env.PMS_AUTH_MOCK_RBAC; }
  });
});

describe('P0.1/P0.4 requirePermission — opt-in enforcement on the forwarded role name', () => {
  const legacy = requirePermission('change-requests', 'edit');                    // default: pass-through
  const guard = requirePermission('change-requests', 'edit', { enforce: true });
  const strict = requirePermission('change-requests', 'edit', { enforce: true, unconfigured: 'deny' });
  const withIdentity = async (headers: Record<string, string>, mw: any) => { const req = mkReq(headers); await run(mockAuthMiddleware, req); return run(mw, req); };
  beforeEach(() => { vi.mocked(storage.getRoleByName).mockReset(); vi.mocked(storage.getRoleMenuPermissions).mockReset(); vi.mocked(storage.getActiveMenuItems).mockReset(); });

  it('default (no enforce) is a pass-through for everyone — pre-Phase-0 runtime behaviour', async () => {
    expect((await withIdentity(ship('Vessel User'), legacy)).nexted).toBe(true);
    expect((await withIdentity({}, legacy)).nexted).toBe(true);
    expect(storage.getRoleByName).not.toHaveBeenCalled();
  });
  it('Sail Admin bypasses without touching the DB', async () => {
    const r = await withIdentity(office('Sail Admin'), guard);
    expect(r.nexted).toBe(true); expect(storage.getRoleByName).not.toHaveBeenCalled();
  });
  it('"Admin" is NOT a bypass role — permissions are read for the forwarded name', async () => {
    vi.mocked(storage.getRoleByName).mockResolvedValue({ ruid: 'r-admin' } as any);
    vi.mocked(storage.getRoleMenuPermissions).mockResolvedValue([{ menuMuid: 'm-cr', canEdit: true }] as any);
    vi.mocked(storage.getActiveMenuItems).mockResolvedValue([{ name: 'change-requests', muid: 'm-cr' }] as any);
    const r = await withIdentity(office('Admin'), guard);
    expect(storage.getRoleByName).toHaveBeenCalledWith('Admin'); expect(r.nexted).toBe(true);
  });
  it('configured role without the flag → 403', async () => {
    vi.mocked(storage.getRoleByName).mockResolvedValue({ ruid: 'r-vu' } as any);
    vi.mocked(storage.getRoleMenuPermissions).mockResolvedValue([{ menuMuid: 'm-other', canEdit: true }] as any);
    vi.mocked(storage.getActiveMenuItems).mockResolvedValue([{ name: 'change-requests', muid: 'm-cr' }, { name: 'other', muid: 'm-other' }] as any);
    const r = await withIdentity(ship('Vessel User'), guard);
    expect(r.res.statusCode).toBe(403);
  });
  it('unconfigured role: default fail-open (parity with the frontend) …', async () => {
    vi.mocked(storage.getRoleByName).mockResolvedValue(undefined as any);
    const r = await withIdentity(office('External 1'), guard);
    expect(r.nexted).toBe(true);
  });
  it('… but DENIED when the route asks for unconfigured:"deny" (P0.4 approval surfaces)', async () => {
    vi.mocked(storage.getRoleByName).mockResolvedValue(undefined as any);
    const r = await withIdentity(office('External 1'), strict);
    expect(r.res.statusCode).toBe(403); expect(r.res.body.reason).toBe('ROLE_UNCONFIGURED');
  });
  it('no forwarded identity with unconfigured:"deny" → 403 as well', async () => {
    const r = await withIdentity({}, strict);
    expect(r.res.statusCode).toBe(403);
  });
});

describe('Conflict Review view and edit grants', () => {
  const view = requirePermission('admin-sync-conflicts', 'view', { enforce: true });
  const edit = requirePermission('admin-sync-conflicts', 'edit', { enforce: true });
  const dashboardCount = requirePermission('admin-sync-dashboard', 'view', { enforce: true });
  const check = async (headers: Record<string, string>, mw: any) => {
    const req = mkReq(headers);
    await run(mockAuthMiddleware, req);
    return run(mw, req);
  };
  beforeEach(() => {
    vi.mocked(storage.getRoleByName).mockReset();
    vi.mocked(storage.getRoleMenuPermissions).mockReset();
    vi.mocked(storage.getActiveMenuItems).mockReset();
    vi.mocked(storage.getRoleByName).mockResolvedValue({ ruid: 'r1' } as any);
    vi.mocked(storage.getActiveMenuItems).mockResolvedValue([
      { name: 'admin-sync-conflicts', muid: 'review' },
      { name: 'admin-sync-dashboard', muid: 'dashboard' },
    ] as any);
  });
  it('rejects requests with no authenticated user even for unconfigured and bypass roles', async () => {
    const result = await run(view, mkReq());
    expect(result.res.statusCode).toBe(401);
  });
  it.each([office('Admin'), ship('Vessel User')])('allows configured view-only identities to read but not resolve (%o)', async headers => {
    vi.mocked(storage.getRoleMenuPermissions).mockResolvedValue([{ menuMuid: 'review', canView: true, canEdit: false }] as any);
    expect((await check(headers, view)).nexted).toBe(true);
    expect((await check(headers, edit)).res.statusCode).toBe(403);
  });
  it('keeps dashboard counts available without disclosing review rows', async () => {
    vi.mocked(storage.getRoleMenuPermissions).mockResolvedValue([{ menuMuid: 'dashboard', canView: true, canEdit: true }] as any);
    expect((await check(office('Admin'), dashboardCount)).nexted).toBe(true);
    expect((await check(office('Admin'), view)).res.statusCode).toBe(403);
    expect((await check(office('Admin'), edit)).res.statusCode).toBe(403);
  });
  it('denies false and missing review flags for configured roles', async () => {
    vi.mocked(storage.getRoleMenuPermissions).mockResolvedValue([{ menuMuid: 'review', canView: false, canEdit: false }] as any);
    expect((await check(ship('Vessel User'), view)).res.statusCode).toBe(403);
    vi.mocked(storage.getRoleMenuPermissions).mockResolvedValue([{ menuMuid: 'dashboard', canView: true }] as any);
    expect((await check(ship('Vessel User'), view)).res.statusCode).toBe(403);
  });
  it('bypasses Sail/PMS Admin and retains unconfigured fail-open', async () => {
    for (const role of ['Sail Admin', 'PMS Admin']) {
      expect((await check(office(role), view)).nexted).toBe(true);
      expect((await check(office(role), edit)).nexted).toBe(true);
    }
    expect(storage.getRoleByName).not.toHaveBeenCalled();
    vi.mocked(storage.getRoleByName).mockResolvedValue(undefined as any);
    expect((await check(ship('New Role'), view)).nexted).toBe(true);
    expect((await check(ship('New Role'), edit)).nexted).toBe(true);
  });
});
