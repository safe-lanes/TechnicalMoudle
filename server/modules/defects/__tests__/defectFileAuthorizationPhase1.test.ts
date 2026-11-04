import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFECT_FILE_BYTES, DEFECT_SECTIONS } from '@shared/defectAttachments';
const fake = vi.hoisted(() => ({
  assigned: [] as any[], mapped: vi.fn(), closeout: vi.fn(), files: new Map<string, Buffer>(),
}));
vi.mock('../../../db', () => ({ getDb: async () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => fake.assigned }) }) }),
}) }));
vi.mock('../../../utils/tenantConnectionManager', () => ({ tenantConnectionManager: { isMultiTenantEnabled: false } }));
vi.mock('../../../utils/asyncLocalStorage', () => ({ getCurrentTenantContext: () => ({ tuid: 'fixture' }) }));
vi.mock('../../assistant-api/masterUserRepository', () => ({ findMasterUserById: fake.mapped }));
vi.mock('../services/defectsApprovalHooks', () => ({ assertDefectCloseoutAllowed: fake.closeout }));
vi.mock('../../sync/defectFileReadiness', () => ({
  localDefectPrerequisites: async () => ({ migration191: true, capability: true }),
  defectReadiness: () => { throw new Error('Peer evaluation prohibited'); },
}));
vi.mock('../services/defectFileStorage', () => ({
  fileHash: (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex'),
  defectFileStore: {
    backend: () => 'local',
    write: async (key: string, bytes: Buffer) => { fake.files.set(key, Buffer.from(bytes)); },
    read: async (key: string) => { if (!fake.files.has(key)) throw new Error('missing'); return fake.files.get(key); },
    remove: async (key: string) => { fake.files.delete(key); },
  },
}));
import { defectFileActor, assertDefectFileAccess } from '../services/defectFileAccess';
import { stageDefectFile, readStagedDefectFile, stagingNamespace, validateDefectUpload } from '../services/defectFileStaging';
const vessel = '11111111-1111-4111-a111-111111111111';
const sessionId = '22222222-2222-4222-a222-222222222222';
const actor = { tenant: 'fixture', userUuid: '33333333-3333-4333-a333-333333333333',
  role: 'Master', rank: 'Master', userType: 'Ship' as const, name: 'Fixture actor' };
const pdf = { originalname: 'proof.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfixture') };
const current = { vesselId: vessel, duuid: '44444444-4444-4444-a444-444444444444', partAAttachments: [] };
beforeEach(() => {
  vi.clearAllMocks(); fake.assigned = [{}]; fake.files.clear();
  fake.mapped.mockResolvedValue({ userType: 'Ship', designation: 'Master', fullName: 'Fixture actor' });
  fake.closeout.mockResolvedValue(undefined);
});
describe('existing Defects file authorization and validation', () => {
  it('requires a verified mapped actor and preserves tenant/rank identity', async () => {
    await expect(defectFileActor({ headers: {} } as any)).rejects.toMatchObject({ code: 'IDENTITY_REQUIRED', statusCode: 403 });
    const req = { headers: {}, verifiedUser: { userId: actor.userUuid, role: 'Master', userType: 'Ship' } };
    expect(await defectFileActor(req as any)).toMatchObject({ tenant: 'fixture', rank: 'Master', userUuid: actor.userUuid });
    fake.mapped.mockResolvedValueOnce(null);
    await expect(defectFileActor(req as any)).rejects.toMatchObject({ statusCode: 403 });
    fake.mapped.mockResolvedValueOnce({ userType: 'Office' });
    await expect(defectFileActor(req as any)).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each(DEFECT_SECTIONS)('%s enforces assigned vessel, session and current vessel identity', async section => {
    const input = { vesselUuid: vessel, sessionId, section };
    fake.assigned = [];
    await expect(stageDefectFile(actor, input, pdf)).rejects.toMatchObject({ statusCode: 403 });
    fake.assigned = [{}];
    await expect(stageDefectFile(actor, { ...input, sessionId: 'invalid' }, pdf)).rejects.toThrow('valid vessel and upload session');
    await expect(stageDefectFile(actor, { ...input, vesselUuid: 'invalid' }, pdf)).rejects.toThrow('valid vessel and upload session');
    await expect(stageDefectFile(actor, input, pdf, { ...current, vesselId: 'other' })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('keeps the Part A lock, C1 Master and closeout checks while Office retains vessel access', async () => {
    await expect(assertDefectFileAccess(actor, vessel, 'part-a', current)).rejects.toMatchObject({ statusCode: 409 });
    const unlocked = { ...current, auditTrail: [{ action: 'part-a-unlocked', userId: actor.userUuid }] };
    await expect(assertDefectFileAccess(actor, vessel, 'part-a', unlocked)).resolves.toBeUndefined();
    await expect(assertDefectFileAccess({ ...actor, rank: 'Chief Engineer' }, vessel, 'part-c1', current))
      .rejects.toMatchObject({ statusCode: 403 });
    fake.closeout.mockRejectedValueOnce(new Error('closeout held'));
    await expect(assertDefectFileAccess(actor, vessel, 'part-c1', current)).rejects.toThrow('closeout held');
    expect(fake.closeout).toHaveBeenCalledWith(current, { userUuid: actor.userUuid, rankName: 'Master' });
    fake.assigned = [];
    await expect(assertDefectFileAccess({ ...actor, userType: 'Office' }, vessel, 'part-b', current)).resolves.toBeUndefined();
  });
  it('retains size, content signature, extension, MIME and filename validation', () => {
    expect(validateDefectUpload(pdf)).toEqual({ extension: 'pdf', type: 'application/pdf', name: 'proof.pdf' });
    for (const buffer of [Buffer.alloc(0), Buffer.alloc(DEFECT_FILE_BYTES + 1), Buffer.from('not pdf')]) {
      expect(() => validateDefectUpload({ ...pdf, buffer })).toThrow();
    }
    expect(() => validateDefectUpload({ ...pdf, originalname: 'proof.png' })).toThrow();
    expect(() => validateDefectUpload({ ...pdf, mimetype: 'image/png' })).toThrow();
    expect(validateDefectUpload({ ...pdf, mimetype: 'application/octet-stream' }).type).toBe('application/pdf');
    expect(validateDefectUpload({ ...pdf, originalname: '../unsafe\\\u0000.pdf' }).name).toBe('.._unsafe__.pdf');
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(validateDefectUpload({ buffer: png, originalname: 'image.png', mimetype: 'image/png' }).type).toBe('image/png');
    expect(validateDefectUpload({ buffer: Buffer.from([255, 216, 255]), originalname: 'image.jpeg', mimetype: 'image/jpeg' }).extension).toBe('jpg');
    expect(validateDefectUpload({ ...pdf, buffer: Buffer.concat([pdf.buffer, Buffer.alloc(DEFECT_FILE_BYTES - pdf.buffer.length)]) })).toHaveProperty('type', 'application/pdf');
  });
  it('preserves staged user, tenant, token and expiration checks', async () => {
    const file = await stageDefectFile(actor, { vesselUuid: vessel, sessionId, section: 'part-b' }, pdf);
    const key = `${stagingNamespace(actor)}/${file.stagedRef}.json`;
    const original = JSON.parse(fake.files.get(key)!.toString());
    await expect(readStagedDefectFile({ ...actor, userUuid: 'another-user' }, file.stagedRef!, 'local')).rejects.toMatchObject({ statusCode: 403 });
    for (const patch of [{ tenant: 'other' }, { token: sessionId }, { expiresAt: 0 }]) {
      fake.files.set(key, Buffer.from(JSON.stringify({ ...original, ...patch })));
      await expect(readStagedDefectFile(actor, file.stagedRef!, 'local')).rejects.toThrow();
    }
    await expect(readStagedDefectFile(actor, 'invalid', 'local')).rejects.toThrow('Invalid staged upload reference');
  });
});
