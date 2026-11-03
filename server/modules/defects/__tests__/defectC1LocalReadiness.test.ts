import { describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ local: vi.fn(), peer: vi.fn() }));
vi.mock('../../sync/defectFileReadiness', () => ({ localDefectPrerequisites: fixture.local, defectReadiness: fixture.peer }));
import { getDefectFileReadiness, getLocalC1Availability, assertLocalC1UploadAvailable } from '../services/defectFileReadiness';

describe('C1 local availability is not sync compatibility', () => {
  it.each(['unknown', 'stale', 'lost', 'ready'])('allows local writes with an %s peer without changing peer flags', async state => {
    const peer = { state, ready: state === 'ready', c1Upload: state === 'ready', externalStorage: state === 'ready' };
    fixture.peer.mockResolvedValue(peer);
    fixture.local.mockResolvedValue({ migration191: true, capability: true });
    expect(await getLocalC1Availability()).toEqual({ c1LocalUpload: true, c1LocalReason: '' });
    await expect(assertLocalC1UploadAvailable()).resolves.toBeUndefined();
    expect(await getDefectFileReadiness('fixture-vessel')).toBe(peer);
  });
  it.each([
    [false, true, 'migration 191'],
    [true, false, 'Private file storage'],
  ])('fails explicitly for missing local prerequisites', async (migration191, capability, reason) => {
    fixture.local.mockResolvedValue({ migration191, capability });
    expect(await getLocalC1Availability()).toMatchObject({ c1LocalUpload: false, c1LocalReason: expect.stringContaining(reason as string) });
    await expect(assertLocalC1UploadAvailable()).rejects.toMatchObject({ statusCode: 409, code: 'C1_LOCAL_UNAVAILABLE' });
  });
});
