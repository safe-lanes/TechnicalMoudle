import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFECT_SECTIONS, DEFECT_SECTION_FIELDS, defectFileKey } from '@shared/defectAttachments';
import { auditLog, syncFileQueue } from '@shared/schema';
const fake = vi.hoisted(() => ({
  locked: null as any, manifest: null as any, intents: [] as any[], prepared: undefined as Buffer | undefined,
  bytes: Buffer.from('%PDF-fixture'), work: vi.fn(), access: vi.fn(), local: vi.fn(), readStage: vi.fn(),
  lock: vi.fn(), revalidate: vi.fn(), failInsert: false,
}));
vi.mock('../../../db', () => ({ getDb: async () => ({
  transaction: async (run: any) => {
    const before = fake.intents.length;
    try { return await run({
      select: () => ({ from: () => ({ where: () => Object.assign(Promise.resolve([]), {
        for: async (mode: string) => { fake.lock(mode); return fake.locked ? [fake.locked] : []; },
      }) }) }),
      execute: vi.fn(),
      insert: (table: any) => ({ values: async (value: any) => {
        fake.intents.push({ table, value });
        if (fake.failInsert) throw new Error('transaction failure');
      } }),
    }); } catch (error) { fake.intents.splice(before); throw error; }
  },
}) }));
vi.mock('../services/defectFileAccess', () => ({
  assertDefectFileAccess: fake.access,
  fileError: (message: string, statusCode = 400, code = 'DEFECT_FILE_ERROR') =>
    Object.assign(new Error(message), { statusCode, code }),
}));
vi.mock('../services/defectFileReadiness', () => ({
  assertLocalC1UploadAvailable: fake.local,
  getDefectFileReadiness: () => { throw new Error('Peer/form readiness is not a save gate'); },
}));
vi.mock('../services/defectFileStaging', () => ({
  readStagedDefectFile: fake.readStage, stagingNamespace: () => 'fixture-namespace',
}));
vi.mock('../services/defectFileStorage', () => ({
  fileHash: (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex'),
  defectFileStore: {
    read: async (_key: string, _backend: string, staging = false) => staging ? fake.bytes : fake.prepared,
    write: async (_key: string, bytes: Buffer) => {
      if (fake.prepared) throw Object.assign(new Error('exists'), { code: 'EEXIST' });
      fake.prepared = Buffer.from(bytes);
    },
  },
}));
vi.mock('../../sync/syncRole', () => ({ getEffectiveInstanceId: async () => 'fixture', isShipInstance: async () => false }));
import { withDefectFileSave } from '../services/defectFileCommit';
import { defectFileCommitContext } from '../services/defectFileContext';
const vessel = '11111111-1111-4111-a111-111111111111';
const sessionId = '22222222-2222-4222-a222-222222222222';
const duuid = '33333333-3333-4333-a333-333333333333';
const id = '44444444-4444-4444-a444-444444444444';
const actor = { tenant: 'fixture', userUuid: 'actor', role: 'Master', rank: 'Master', userType: 'Office' as const, name: 'Fixture' };
const commit = { sessionId, expectedUpdatedAt: '2026-11-01T00:00:00.000Z' };
const current = { vesselId: vessel, duuid, updatedAt: commit.expectedUpdatedAt };
const legacy = { id: 'legacy', name: 'old.pdf', size: 1, type: 'application/pdf', data: 'data:application/pdf;base64,AA==', uploadedAt: '2026-11-01' };
function descriptor(section: typeof DEFECT_SECTIONS[number]) {
  return { storageVersion: 1, id, name: 'proof.pdf', size: fake.bytes.length, type: 'application/pdf',
    uploadedAt: '2026-11-01', backend: 'local', fileKey: defectFileKey(vessel, duuid, section, id, 'pdf'),
    sha256: createHash('sha256').update(fake.bytes).digest('hex'), uploadedByUuid: actor.userUuid };
}
function staged(section: typeof DEFECT_SECTIONS[number]) {
  fake.manifest = { token: id, tenant: actor.tenant, actorUuid: actor.userUuid, sessionId,
    vesselUuid: vessel, defectUuid: duuid, section, attachment: descriptor(section) };
  return { ...fake.manifest.attachment, stagedRef: id };
}
function save(body: any, row: any = current, who: any = actor) {
  return withDefectFileSave({ ...body, attachmentCommit: commit }, row, who, fake.work, fake.revalidate);
}
beforeEach(() => {
  vi.clearAllMocks(); fake.locked = current; fake.intents = []; fake.prepared = undefined; fake.failInsert = false;
  fake.local.mockResolvedValue(undefined); fake.access.mockResolvedValue(undefined);
  fake.readStage.mockImplementation(async () => fake.manifest);
  fake.work.mockImplementation(async (body: any) => body);
  fake.revalidate.mockResolvedValue(undefined);
});
describe('preservation at the authoritative locked-row boundary', () => {
  it.each(DEFECT_SECTIONS)('%s preserves immutable saved external files and rejects changes to each descriptor field', async section => {
    const field = DEFECT_SECTION_FIELDS[section], old = descriptor(section);
    const row = { ...current, [field]: [old] };
    fake.locked = row;
    expect((await save({ [field]: [{ ...old }] }, row))[field]).toEqual([old]);
    for (const key of ['name', 'size', 'type', 'backend', 'fileKey', 'sha256', 'uploadedByUuid', 'uploadedAt']) {
      await expect(save({ [field]: [{ ...old, [key]: 'changed' }] }, row)).rejects.toThrow('immutable');
    }
    expect(fake.local).not.toHaveBeenCalled(); expect(fake.intents).toEqual([]);
  });
  it.each(DEFECT_SECTIONS)('%s only retains same-section deep-equal inline entries, including the locked row', async section => {
    const field = DEFECT_SECTION_FIELDS[section], other = field === 'attachments' ? 'partAAttachments' : 'attachments';
    const row = { ...current, [field]: [legacy] };
    expect((await save({ [field]: [{ ...legacy }] }, row))[field]).toEqual([legacy]);
    await expect(save({ [field]: [{ ...legacy, name: 'changed.pdf' }] }, row))
      .rejects.toMatchObject({ statusCode: 409, code: 'EXTERNAL_UPLOAD_REQUIRED' });
    await expect(save({ [other]: [legacy] }, row)).rejects.toMatchObject({ code: 'EXTERNAL_UPLOAD_REQUIRED' });
    // Force the external transaction while the inline pre-lock entry differs from the authoritative row.
    const external = staged(section);
    fake.locked = { ...row, [field]: [{ ...legacy, data: 'authoritative changed value' }] };
    await expect(save({ [field]: [legacy, external] }, row)).rejects.toMatchObject({ code: 'EXTERNAL_UPLOAD_REQUIRED' });
    expect(fake.lock).toHaveBeenCalledWith('update');
    expect(fake.intents).toEqual([]);
  });
  it.each(DEFECT_SECTIONS)('%s refuses changed staged metadata, wrong session/section/vessel/defect and stale versions', async section => {
    const field = DEFECT_SECTION_FIELDS[section], file = staged(section);
    for (const key of ['name', 'size', 'type', 'backend', 'fileKey', 'sha256', 'uploadedAt', 'uploadedByUuid']) {
      await expect(save({ [field]: [{ ...file, [key]: 'tampered' }] })).rejects.toThrow('metadata was changed');
    }
    const manifest = { ...fake.manifest };
    for (const patch of [{ sessionId: 'other' }, { section: 'other' }, { vesselUuid: 'other' }, { defectUuid: 'other' }]) {
      fake.manifest = { ...manifest, ...patch };
      await expect(save({ [field]: [file] })).rejects.toMatchObject({ statusCode: 403 });
    }
    fake.manifest = manifest;
    fake.locked = { ...current, updatedAt: '2026-11-02T00:00:00.000Z' };
    await expect(save({ [field]: [file] })).rejects.toMatchObject({ code: 'DEFECT_STALE' });
    expect(fake.work).not.toHaveBeenCalled(); expect(fake.intents).toEqual([]);
  });
  it('requires an actor, valid commit session and owned staged receipt', async () => {
    const file = staged('part-b');
    await expect(save({ attachments: [file] }, current, null)).rejects.toMatchObject({ statusCode: 403 });
    await expect(withDefectFileSave({ attachments: [file] }, current, actor, fake.work, fake.revalidate)).rejects.toThrow('upload session');
    const { stagedRef, ...withoutReceipt } = file;
    await expect(save({ attachments: [withoutReceipt] })).rejects.toThrow('owned staged upload');
    fake.readStage.mockRejectedValueOnce(Object.assign(new Error('another user'), { statusCode: 403 }));
    await expect(save({ attachments: [file] })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('preserves transaction context, queue/audit intent, retry bytes and final local gate', async () => {
    const file = staged('part-b');
    fake.work.mockImplementation(async (body: any) => {
      expect(defectFileCommitContext.getStore()).toMatchObject({ duuid, actorUuid: actor.userUuid, tx: expect.any(Object) });
      return body;
    });
    fake.local.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('storage became unavailable'));
    await expect(save({ attachments: [file] })).rejects.toThrow('storage became unavailable');
    expect(fake.intents).toEqual([]);
    const body = await save({ attachments: [file] });
    expect(body.attachments[0]).not.toHaveProperty('stagedRef');
    expect(fake.intents[0]).toEqual({ table: syncFileQueue, value: expect.objectContaining({
      rowUuid: duuid, direction: 'shore_to_ship', fileKey: file.fileKey, fileHash: file.sha256, status: 'pending',
    }) });
    expect(fake.intents[1]).toEqual({ table: auditLog, value: expect.objectContaining({ actionType: 'attachments-save' }) });
    fake.prepared = Buffer.from('conflicting bytes');
    await expect(save({ attachments: [file] })).rejects.toThrow('Prepared file content conflicts');
  });
  it('retains removal audit intent and rolls back captured inserts on transaction failure', async () => {
    const old = descriptor('part-b'), row = { ...current, attachments: [old] };
    fake.locked = row;
    await save({ attachments: [] }, row);
    expect(fake.intents).toEqual([{ table: auditLog, value: expect.objectContaining({
      payload: { vesselUuid: vessel, added: [], removed: [{ section: 'part-b', id }] },
    }) }]);
    fake.intents = []; fake.failInsert = true;
    const file = staged('part-b'); fake.locked = current;
    await expect(save({ attachments: [file] })).rejects.toThrow('transaction failure');
    expect(fake.intents).toEqual([]);
  });
});
