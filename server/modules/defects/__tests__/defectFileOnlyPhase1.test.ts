import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFECT_SECTION_FIELDS, DEFECT_SECTIONS } from '@shared/defectAttachments';
import { auditLog, syncFileQueue } from '@shared/schema';

// Boundaries are hoisted before any application import: no DB, storage or sync module runs.
const fake = vi.hoisted(() => ({
  files: new Map<string, Buffer>(), intents: [] as any[], locked: undefined as any,
  local: vi.fn(), peer: vi.fn(() => { throw new Error('Peer readiness must not run'); }),
  access: vi.fn(), execute: vi.fn(), work: vi.fn(), revalidate: vi.fn(),
}));
vi.mock('../../../db', () => ({ getDb: async () => ({
  transaction: async (run: any) => {
    const before = fake.intents.length;
    try {
      return await run({
        select: () => ({ from: () => ({ where: () => Object.assign(
          Promise.resolve(fake.locked ? [fake.locked] : []),
          { for: async (mode: string) => { expect(mode).toBe('update'); return fake.locked ? [fake.locked] : []; } },
        ) }) }),
        execute: fake.execute,
        insert: (table: any) => ({ values: async (value: any) => { fake.intents.push({ table, value }); } }),
      });
    } catch (error) { fake.intents.splice(before); throw error; }
  },
}) }));
vi.mock('../../sync/defectFileReadiness', () => ({
  localDefectPrerequisites: fake.local, defectReadiness: fake.peer,
}));
vi.mock('../../sync/syncRole', () => ({
  getEffectiveInstanceId: async () => 'fixture-instance', isShipInstance: async () => true,
}));
vi.mock('../services/defectFileAccess', () => ({
  assertDefectFileAccess: fake.access,
  fileError: (message: string, statusCode = 400, code = 'DEFECT_FILE_ERROR') =>
    Object.assign(new Error(message), { statusCode, code }),
}));
vi.mock('../services/defectFileStorage', () => ({
  fileHash: (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex'),
  defectFileStore: {
    backend: () => 'local',
    write: async (key: string, bytes: Buffer, _backend: string, staging = false) => {
      const name = `${staging}:${key}`;
      if (fake.files.has(name)) throw Object.assign(new Error('exists'), { code: 'EEXIST' });
      fake.files.set(name, Buffer.from(bytes));
    },
    read: async (key: string, _backend: string, staging = false) => {
      const bytes = fake.files.get(`${staging}:${key}`);
      if (!bytes) throw new Error('missing fixture file');
      return bytes;
    },
    remove: async (key: string, _backend: string, staging = false) => { fake.files.delete(`${staging}:${key}`); },
  },
}));
import { stageDefectFile, stagingNamespace } from '../services/defectFileStaging';
import { withDefectFileSave } from '../services/defectFileCommit';
import { defectFileCommitContext } from '../services/defectFileContext';

const vessel = '11111111-1111-4111-a111-111111111111';
const sessionId = '22222222-2222-4222-a222-222222222222';
const actor = { tenant: 'fixture', userUuid: '33333333-3333-4333-a333-333333333333',
  role: 'Master', rank: 'Master', userType: 'Ship' as const, name: 'Fixture actor' };
const pdf = { originalname: 'proof.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfixture') };
const legacy = { id: 'old', name: 'old.pdf', size: 4, type: 'application/pdf',
  data: 'data:application/pdf;base64,AAAA', uploadedAt: '2026-11-01' };
const save = (body: any, current: any = null, who: any = actor) =>
  withDefectFileSave(body, current, who, fake.work, fake.revalidate);
const commit = { sessionId, expectedUpdatedAt: '2026-11-01T00:00:00.000Z' };
beforeEach(() => {
  vi.clearAllMocks(); fake.files.clear(); fake.intents = []; fake.locked = undefined;
  fake.local.mockResolvedValue({ migration191: true, capability: true, backend: 'local' });
  fake.access.mockResolvedValue(undefined);
  fake.work.mockImplementation(async (body: any) => {
    expect(defectFileCommitContext.getStore()?.tx).toBeDefined();
    return body;
  });
});
describe('Defects file-only staging and commit without any peer evaluation', () => {
  it.each(DEFECT_SECTIONS)('%s stages privately and commits queue, audit and transaction context', async section => {
    const file = await stageDefectFile(actor, { vesselUuid: vessel, sessionId, section }, pdf);
    expect(file).toMatchObject({ storageVersion: 1, stagedRef: expect.any(String), size: pdf.buffer.length });
    expect(file).not.toHaveProperty('data');
    const field = DEFECT_SECTION_FIELDS[section];
    const body = await save({ vesselId: vessel, [field]: [file], attachmentCommit: commit });
    expect(body[field][0]).not.toHaveProperty('stagedRef');
    expect(body[field][0].sha256).toBe(createHash('sha256').update(pdf.buffer).digest('hex'));
    expect(fake.files.get(`false:${file.fileKey}`)).toEqual(pdf.buffer);
    expect(fake.files.has(`true:${stagingNamespace(actor)}/${file.stagedRef}.bin`)).toBe(true);
    expect(fake.execute).toHaveBeenCalledOnce();
    expect(fake.revalidate).toHaveBeenCalledOnce();
    expect(fake.intents).toEqual([
      { table: syncFileQueue, value: expect.objectContaining({ status: 'pending', direction: 'ship_to_shore',
        fileKey: file.fileKey, fileHash: file.sha256, totalChunks: 1, vesselId: vessel }) },
      { table: auditLog, value: expect.objectContaining({ actionType: 'attachments-save',
        payload: { vesselUuid: vessel, added: [{ id: file.id, section, sha256: file.sha256 }], removed: [] } }) },
    ]);
    expect(fake.peer).not.toHaveBeenCalled();
  });
  it.each(['absent', 'stale', 'incompatible'])('all sections save with %s peer reports', async state => {
    // Poison the unused peer boundary with each peer condition.
    fake.peer.mockReturnValue({ state, externalStorage: false } as never);
    const body: any = { vesselId: vessel, attachmentCommit: commit };
    for (const section of DEFECT_SECTIONS) {
      body[DEFECT_SECTION_FIELDS[section]] = [await stageDefectFile(actor, { vesselUuid: vessel, sessionId, section }, pdf)];
    }
    await save(body);
    expect(fake.intents.filter(i => i.table === syncFileQueue)).toHaveLength(3);
    expect(fake.peer).not.toHaveBeenCalled();
  });
  it.each(DEFECT_SECTIONS)('%s refuses local schema/storage failures at stage and commit', async section => {
    const input = { vesselUuid: vessel, sessionId, section };
    const file = await stageDefectFile(actor, input, pdf);
    for (const local of [{ migration191: false, capability: true }, { migration191: true, capability: false }]) {
      fake.local.mockResolvedValue(local);
      await expect(stageDefectFile(actor, input, pdf)).rejects.toMatchObject({ statusCode: 409, code: 'C1_LOCAL_UNAVAILABLE' });
      await expect(save({ vesselId: vessel, [DEFECT_SECTION_FIELDS[section]]: [file], attachmentCommit: commit }))
        .rejects.toMatchObject({ statusCode: 409, code: 'C1_LOCAL_UNAVAILABLE' });
    }
    expect(fake.intents).toEqual([]);
    expect(fake.peer).not.toHaveBeenCalled();
  });
  it.each(DEFECT_SECTIONS)('%s keeps exact saved legacy values and rejects new or modified ones', async section => {
    const field = DEFECT_SECTION_FIELDS[section];
    fake.work.mockImplementation(async (body: any) => body);
    const current = { vesselId: vessel, [field]: [legacy] };
    expect((await save({ [field]: [{ ...legacy }] }, current))[field]).toEqual([legacy]);
    for (const value of [{ ...legacy, data: 'changed' }, { ...legacy, id: 'new' }]) {
      await expect(save({ [field]: [value] }, current)).rejects.toMatchObject({ statusCode: 409, code: 'EXTERNAL_UPLOAD_REQUIRED' });
    }
    expect(fake.local).not.toHaveBeenCalled();
    expect(fake.peer).not.toHaveBeenCalled();
  });
  it('does not consult local or peer readiness for no-file saves', async () => {
    fake.work.mockImplementation(async (body: any) => body);
    await expect(save({ description: 'no attachment change' })).resolves.toEqual({ description: 'no attachment change' });
    expect(fake.local).not.toHaveBeenCalled(); expect(fake.peer).not.toHaveBeenCalled();
  });
  it('rejects a stale locked version and corrupted staged bytes without queue/audit writes', async () => {
    const current = { vesselId: vessel, duuid: '44444444-4444-4444-a444-444444444444', updatedAt: commit.expectedUpdatedAt };
    const file = await stageDefectFile(actor, { vesselUuid: vessel, sessionId, section: 'part-b' }, pdf, current);
    fake.locked = { ...current, updatedAt: '2026-11-02T00:00:00.000Z' };
    const body = { attachments: [file], attachmentCommit: commit };
    await expect(save(body, current)).rejects.toMatchObject({ code: 'DEFECT_STALE' });
    fake.locked = current;
    fake.files.set(`true:${stagingNamespace(actor)}/${file.stagedRef}.bin`, Buffer.from('corrupt'));
    await expect(save(body, current)).rejects.toThrow('integrity');
    expect(fake.work).not.toHaveBeenCalled(); expect(fake.intents).toEqual([]);
  });
  it('retains stages for an identical promotion retry and rolls back captured transaction intent', async () => {
    const file = await stageDefectFile(actor, { vesselUuid: vessel, sessionId, section: 'part-b' }, pdf);
    const body = { vesselId: vessel, attachments: [file], attachmentCommit: commit };
    fake.work.mockRejectedValueOnce(new Error('fixture rollback'));
    await expect(save(body)).rejects.toThrow('fixture rollback');
    expect(fake.intents).toEqual([]);
    await expect(save(body)).resolves.toHaveProperty('attachments');
    expect(fake.intents).toHaveLength(2);
  });
});
