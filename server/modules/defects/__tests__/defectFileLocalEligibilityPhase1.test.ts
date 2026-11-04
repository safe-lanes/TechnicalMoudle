import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  local: vi.fn(), peer: vi.fn(() => { throw new Error('No peer evaluation allowed'); }),
  actor: vi.fn(), access: vi.fn(),
}));
vi.mock('../../sync/defectFileReadiness', () => ({
  localDefectPrerequisites: fake.local, defectReadiness: fake.peer,
}));
vi.mock('../services/defectFileAccess', () => ({
  defectFileActor: fake.actor, assertDefectFileAccess: fake.access,
  fileError: (message: string, statusCode = 400, code = 'DEFECT_FILE_ERROR') =>
    Object.assign(new Error(message), { statusCode, code }),
}));
vi.mock('../../../utils/asyncLocalStorage', () => ({ tenantStorage: {}, getCurrentTenantContext: () => undefined }));
vi.mock('../services/defectFileStaging', () => ({}));
vi.mock('../services/defectFileStorage', () => ({ defectFileStore: { backend: () => 'local' } }));
vi.mock('../services/defectFileDownload', () => ({}));
vi.mock('../repositories/defectsRepository', () => ({}));
vi.mock('../services/defectPeerReports', () => ({}));
vi.mock('../services/defectFileCommit', () => ({}));
vi.mock('../../../middleware/permissions', () => ({}));
import { readiness } from '../controllers/defectFileController';
import { assertLocalC1UploadAvailable, getLocalC1Availability } from '../services/defectFileReadiness';
const migrationReason = 'C1 attachments require database migration 191 on this installation. Contact your administrator.';
const storageReason = 'Private file storage is not readable and writable on this installation. Contact your administrator.';
beforeEach(() => {
  vi.clearAllMocks();
  fake.actor.mockResolvedValue({ userUuid: 'fixture-actor' });
  fake.access.mockResolvedValue(undefined);
});
describe('local-only form availability contract', () => {
  it.each([[true, true], [false, true], [true, false], [false, false]])(
    'preserves every endpoint key with migration191=%s and capability=%s', async (migration191, capability) => {
      const local = { instanceId: 'fixture', softwareVersion: 'fixture-version', migration191, capability, backend: 'local' };
      fake.local.mockResolvedValue(local);
      const req = { query: { vesselUuid: 'requested-vessel' } };
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
      await readiness(req as any, res as any, vi.fn());
      const eligible = migration191 && capability;
      const reason = !migration191 ? migrationReason : !capability ? storageReason : '';
      expect(res.json).toHaveBeenCalledWith({
        vesselUuid: 'requested-vessel', local, report: null, state: eligible ? 'ready' : 'lost',
        ready: eligible, reason, externalStorage: eligible, c1Upload: eligible,
        c1LocalUpload: eligible, c1LocalReason: reason, backend: 'local',
      });
      expect(Object.keys(res.json.mock.calls[0][0]).sort()).toEqual([
        'vesselUuid', 'local', 'report', 'state', 'ready', 'reason', 'externalStorage',
        'c1Upload', 'c1LocalUpload', 'c1LocalReason', 'backend',
      ].sort());
      expect(res.json.mock.calls[0][0].local).toBe(local);
      expect(fake.actor).toHaveBeenCalledWith(req);
      expect(fake.access).toHaveBeenCalledWith({ userUuid: 'fixture-actor' }, 'requested-vessel');
      expect(fake.local).toHaveBeenCalledOnce();
      expect(fake.peer).not.toHaveBeenCalled();
      expect(await getLocalC1Availability()).toEqual({ c1LocalUpload: eligible, c1LocalReason: reason });
      if (eligible) await expect(assertLocalC1UploadAvailable()).resolves.toBeUndefined();
      else await expect(assertLocalC1UploadAvailable()).rejects.toMatchObject({ statusCode: 409, code: 'C1_LOCAL_UNAVAILABLE', message: reason });
    },
  );
  it('does not probe local storage before authenticated vessel access succeeds', async () => {
    fake.access.mockRejectedValueOnce(Object.assign(new Error('vessel forbidden'), { statusCode: 403 }));
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await readiness({ query: { vesselUuid: 'other-vessel' } } as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(fake.local).not.toHaveBeenCalled(); expect(fake.peer).not.toHaveBeenCalled();
  });
  it('uses the same local signal for every form dialog, without importing the form startup graph', () => {
    const form = readFileSync('client/src/pages/defects/DefectFormWizard.tsx', 'utf8');
    const dialogs = [...form.matchAll(/<DefectAttachmentDialog[\s\S]*?\/>/g)].map(match => match[0]);
    expect(dialogs).toHaveLength(3);
    for (const dialog of dialogs) {
      expect(dialog).toContain('!attachmentAvailability.c1LocalUpload');
      expect(dialog).toContain('externalStorage={true}');
    }
    expect(form).not.toContain('attachmentAvailability.externalStorage');
    expect(form.match(/fetch\(`\/technical\/api\/defects\/file-readiness/g)).toHaveLength(1);
    for (const path of ['defectFileStaging', 'defectFileCommit']) {
      const source = readFileSync(`server/modules/defects/services/${path}.ts`, 'utf8');
      expect(source).toContain('await assertLocalC1UploadAvailable()');
      expect(source).not.toContain('getDefectFileReadiness');
      expect(source).not.toContain('defectReadiness');
    }
  });
});
