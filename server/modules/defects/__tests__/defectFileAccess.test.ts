import { describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ mapped: vi.fn(), rows: [] as any[] }));
vi.mock('../../assistant-api/masterUserRepository', () => ({ findMasterUserById: mock.mapped }));
vi.mock('../../../db', () => ({ getDb: async () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => mock.rows }) }) }),
}) }));
import { assertDefectFileAccess, defectFileActor } from '../services/defectFileAccess';
const office = { userUuid: 'fixture-user', name: 'Fixture', role: 'Sail Admin', userType: 'Office' as const, rank: 'Master', tenant: 'fixture' };
describe('defect private file authorization', () => {
  it('never authorizes from the default req.user role or unverified forwarded headers', async () => {
    await expect(defectFileActor({ headers: { 'x-user-role': 'Sail Admin' }, user: { role: 'Sail Admin' } } as any))
      .rejects.toMatchObject({ statusCode: 403, code: 'IDENTITY_REQUIRED' });
  });
  it('uses verified canonical identity, not the mock role', async () => {
    mock.mapped.mockResolvedValue({ role: 'Vessel User', userType: 'Ship' });
    expect(await defectFileActor({ headers: {}, verifiedUser: { userId: 'real-user', role: 'Vessel User', userType: 'Ship' }, user: { role: 'Sail Admin', rank_name: 'Master' } } as any))
      .toMatchObject({ userUuid: 'real-user', role: 'Vessel User', userType: 'Ship' });
  });
  it('keeps vessel callers within active assignments and permits office access across vessels', async () => {
    mock.rows = [];
    await expect(assertDefectFileAccess({ ...office, userType: 'Ship' }, 'other-vessel')).rejects.toMatchObject({ statusCode: 403 });
    mock.rows = [{}];
    await expect(assertDefectFileAccess({ ...office, userType: 'Ship' }, 'assigned-vessel')).resolves.toBeUndefined();
    await expect(assertDefectFileAccess(office, 'any-vessel')).resolves.toBeUndefined();
  });
  it('checks Part A lock before staging and rejects non-Master C1 uploads', async () => {
    await expect(assertDefectFileAccess(office, 'v', 'part-a', { partAAttachments: [], auditTrail: [] })).rejects.toThrow(/Part A/);
    await expect(assertDefectFileAccess({ ...office, rank: 'Chief Engineer' }, 'v', 'part-c1')).rejects.toMatchObject({ statusCode: 403 });
  });
});
