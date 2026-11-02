import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DEFECT_FILE_BYTES, defectFileKey } from '@shared/defectAttachments';
import { DefectFileStore } from '../services/defectFileStorage';
import { stageDefectFile, readStagedDefectFile, validateDefectUpload, draftDefectUuid } from '../services/defectFileStaging';
import { tenantStorage } from '../../../utils/asyncLocalStorage';
const mock = vi.hoisted(() => ({ ready: vi.fn(), access: vi.fn() }));
vi.mock('../services/defectFileReadiness', () => ({ getDefectFileReadiness: mock.ready }));
vi.mock('../services/defectFileAccess', async original => ({ ...await original<any>(), assertDefectFileAccess: mock.access }));
const root = `/tmp/defect-storage-${randomUUID()}`;
const store = new DefectFileStore(root);
vi.spyOn(store, 'backend').mockReturnValue('local');
const actor = { userUuid: randomUUID(), name: 'Fixture', role: 'Sail Admin', userType: 'Office' as const, rank: 'Master', tenant: 'fixture' };
const input = { vesselUuid: randomUUID(), sessionId: randomUUID(), section: 'part-b' as const };
const pdf = { originalname: 'evidence.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture') };
afterAll(() => fs.rm(root, { recursive: true, force: true }));
describe('private defect storage and staging', () => {
  it('validates content, supported extensions and the exact 5 MB threshold without new packages', () => {
    expect(validateDefectUpload(pdf).type).toBe('application/pdf');
    const boundary = Buffer.alloc(DEFECT_FILE_BYTES); boundary.write('%PDF-');
    expect(validateDefectUpload({ ...pdf, buffer: boundary }).extension).toBe('pdf');
    expect(() => validateDefectUpload({ ...pdf, buffer: Buffer.alloc(DEFECT_FILE_BYTES + 1) })).toThrow('5 MB');
    expect(() => validateDefectUpload({ ...pdf, originalname: 'evidence.png' })).toThrow('does not match');
    expect(() => validateDefectUpload({ ...pdf, buffer: Buffer.from('<script>') })).toThrow('does not match');
  });
  it('fails closed before writing when the peer pair is not ready', async () => {
    mock.ready.mockResolvedValue({ externalStorage: false, c1Upload: false, reason: 'not ready' });
    await expect(stageDefectFile(actor, input, pdf, undefined, store)).rejects.toMatchObject({ code: 'DEFECT_FILES_UNAVAILABLE' });
    expect(await store.manifests('local')).toEqual([]);
  });
  it('stages without a defect row, binds actor/session/vessel, and enforces seven-day expiry', async () => {
    mock.ready.mockResolvedValue({ externalStorage: true, c1Upload: true });
    const staged = await stageDefectFile(actor, input, pdf, undefined, store);
    expect(staged).not.toHaveProperty('data');
    const manifest = await readStagedDefectFile(actor, staged.stagedRef!, 'local', store);
    expect(manifest.defectUuid).toBe(draftDefectUuid(actor, input.sessionId, input.vesselUuid));
    expect(manifest.section).toBe('part-b');
    await expect(readStagedDefectFile({ ...actor, userUuid: randomUUID() }, staged.stagedRef!, 'local', store))
      .rejects.toMatchObject({ statusCode: 403 });
    const now = vi.spyOn(Date, 'now').mockReturnValue(manifest.expiresAt + 1);
    try { await expect(readStagedDefectFile(actor, staged.stagedRef!, 'local', store)).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' }); }
    finally { now.mockRestore(); }
  });
  it('rejects unsafe paths and never overwrites a committed file', async () => {
    const key = defectFileKey(input.vesselUuid, randomUUID(), 'part-a', randomUUID(), 'pdf');
    await store.write(key, pdf.buffer, 'local');
    await expect(store.write(key, Buffer.from('changed'), 'local')).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await store.read(key, 'local')).toEqual(pdf.buffer);
    await expect(store.read('../escape', 'local')).rejects.toThrow();
  });
  it('isolates identical canonical file keys in different tenant roots', async () => {
    const key = defectFileKey(input.vesselUuid, randomUUID(), 'part-b', randomUUID(), 'pdf');
    for (const tuid of ['tenant-one', 'tenant-two']) {
      await tenantStorage.run({ tuid } as any, async () => {
        await store.write(key, Buffer.from(tuid), 'local');
        expect((await store.read(key, 'local')).toString()).toBe(tuid);
      });
    }
  });
});
