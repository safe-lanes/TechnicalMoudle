import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Job Work Instructions (mig 183, 25-Oct-2026) — the service rules from Jeevan's requirement and decisions D1-D5.
// The repository is mocked; file bytes go to a temp dir (process.cwd() is pointed there) so the orphan-cleanup path
// is exercised for real. Ship/office is mocked through syncRole.
const role = vi.hoisted(() => ({ ship: false }));
vi.mock('../../sync/syncRole', () => ({ isShipInstance: async () => role.ship }));
vi.mock('../../sync/fileSyncProcessor', () => ({ FileSyncProcessor: { queueFileForSync: vi.fn(async () => undefined) } }));
const repo = vi.hoisted(() => ({
  findJob: vi.fn(), listVesselFiles: vi.fn(), findFile: vi.fn(), findFileByName: vi.fn(), createFile: vi.fn(),
  listLinks: vi.fn(), findLink: vi.fn(), findActiveLink: vi.fn(), createLink: vi.fn(), setLinkDeleted: vi.fn(),
  findUserNames: vi.fn(),
}));
vi.mock('../repositories/jobWorkInstructionRepository', () => repo);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jwi-'));
const cwd = process.cwd();
process.chdir(tmp);
afterAll(() => { process.chdir(cwd); fs.rmSync(tmp, { recursive: true, force: true }); });

import { FileSyncProcessor } from '../../sync/fileSyncProcessor';
import { attach, download, listForJob, listForWorkOrder, remove, restore, sanitizeFileName, upload, uploadVesselFiles, validatePdf, MAX_PDF_BYTES } from '../services/jobWorkInstructionService';

const V = 'vessel-A';
const job = { juuid: 'job-1', vesselId: V, dataScope: 'vessel' };
const office = { userUuid: 'u-off', role: 'Sail Admin', userType: 'Office', vesselId: null };
const shipUser = { userUuid: 'u-ship', role: 'Ship', userType: 'Ship', vesselId: V };
const pdf = (name = 'Pump_Overhaul.pdf', body = '%PDF-1.4 test', mimetype = 'application/pdf') =>
  ({ originalname: name, mimetype, size: Buffer.byteLength(body), buffer: Buffer.from(body) } as Express.Multer.File);
const storedFile = { jwfuuid: 'f-1', vesselId: V, fileName: 'Pump_Overhaul.pdf', fileKey: `${V}/1_Pump_Overhaul.pdf`, storageBackend: 'local', fileSize: 13, isDeleted: false, revisionRemarks: null, uploadedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks(); role.ship = false;
  repo.findJob.mockResolvedValue(job);
  repo.findFileByName.mockResolvedValue(undefined);
  repo.findFile.mockResolvedValue(storedFile);
  repo.findActiveLink.mockResolvedValue(undefined);
  repo.findUserNames.mockResolvedValue(new Map());
  repo.createFile.mockImplementation(async (d: any) => ({ ...storedFile, ...d, jwfuuid: 'f-new' }));
  repo.createLink.mockImplementation(async (d: any) => ({ jwluuid: 'l-new', isDeleted: false, ...d }));
});

describe('PDF validation (§5, D1)', () => {
  it('accepts a real PDF and returns the safe name', () => {
    expect(validatePdf(pdf('My Instr (rev 2).pdf'))).toBe('My Instr (rev 2).pdf');
  });
  it.each([
    ['wrong extension', pdf('notes.docx'), /Only PDF/],
    ['wrong MIME', pdf('a.pdf', '%PDF-1.4', 'image/png'), /not a PDF/],
    ['wrong signature', pdf('a.pdf', 'hello'), /not a valid PDF/],
  ])('rejects %s', (_l, file, msg) => { expect(() => validatePdf(file)).toThrow(msg); });
  it('rejects over 25 MB', () => {
    const f = pdf(); f.size = MAX_PDF_BYTES + 1;
    expect(() => validatePdf(f)).toThrow(/larger than 25 MB/);
  });
  it('strips paths from the name', () => {
    expect(sanitizeFileName('..\\..\\etc/passwd.pdf')).toBe('passwd.pdf');
    expect(() => sanitizeFileName('.pdf')).toThrow(/not valid/);
  });
});

describe('upload (§5, §6)', () => {
  it('stores the file, creates the file row and the Job link, queues the bytes for ship sync', async () => {
    const r = await upload('job-1', pdf(), office, ' Rev 1 ');
    expect(r.file.jwfuuid).toBe('f-new');
    expect(repo.createFile.mock.calls[0][0]).toMatchObject({ vesselId: V, fileName: 'Pump_Overhaul.pdf', storageBackend: 'local', revisionRemarks: 'Rev 1', uploadedByUuid: 'u-off' });
    expect(fs.existsSync(path.join(tmp, '.private', 'job-docs', repo.createFile.mock.calls[0][0].fileKey))).toBe(true);
    expect(repo.createLink.mock.calls[0][0]).toMatchObject({ jobId: 'job-1', fileUuid: 'f-new', vesselId: V });
    expect(vi.mocked(FileSyncProcessor.queueFileForSync)).toHaveBeenCalledWith('job_work_instruction_files', 'f-new', expect.any(String), 'Pump_Overhaul.pdf', 13, V);
  });
  it('same active name on the vessel → 409 that names the existing file (attach it instead)', async () => {
    repo.findFileByName.mockResolvedValue(storedFile);
    await expect(upload('job-1', pdf(), office)).rejects.toMatchObject({ statusCode: 409, details: { code: 'WORK_INSTRUCTION_NAME_EXISTS', fileUuid: 'f-1' } });
    expect(repo.createFile).not.toHaveBeenCalled();
  });
  it('DB failure after storing → the orphan file is deleted', async () => {
    repo.createFile.mockRejectedValue(new Error('db down'));
    await expect(upload('job-1', pdf('Orphan.pdf'), office)).rejects.toThrow('db down');
    const dir = path.join(tmp, '.private', 'job-docs', V);
    expect(fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.includes('Orphan')) : []).toEqual([]);
  });
  it('refused on a ship (office only, §10/§11)', async () => {
    role.ship = true;
    await expect(upload('job-1', pdf(), office)).rejects.toMatchObject({ statusCode: 403, details: { code: 'WORK_INSTRUCTIONS_OFFICE_ONLY' } });
  });
  it('refused for a Fleet Job (§20)', async () => {
    repo.findJob.mockResolvedValue({ ...job, dataScope: 'fleet' });
    await expect(upload('job-1', pdf(), office)).rejects.toThrow(/Vessel Jobs only/);
  });
});

describe('attach existing (§2, §17, §18)', () => {
  it('links a same-vessel file', async () => {
    const l = await attach('job-1', 'f-1', office);
    expect(l).toMatchObject({ jobId: 'job-1', fileUuid: 'f-1', vesselId: V });
  });
  it('refuses a file of another vessel', async () => {
    repo.findFile.mockResolvedValue({ ...storedFile, vesselId: 'vessel-B' });
    await expect(attach('job-1', 'f-1', office)).rejects.toMatchObject({ statusCode: 403, details: { code: 'WORK_INSTRUCTION_OTHER_VESSEL' } });
  });
  it('refuses a duplicate active link', async () => {
    repo.findActiveLink.mockResolvedValue({ jwluuid: 'l-1' });
    await expect(attach('job-1', 'f-1', office)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('remove / restore (§7, §8)', () => {
  it('remove soft-deletes the link only (the file is never touched)', async () => {
    repo.findLink.mockResolvedValue({ jwluuid: 'l-1', jobId: 'job-1', fileUuid: 'f-1', isDeleted: false });
    repo.setLinkDeleted.mockResolvedValue({ jwluuid: 'l-1', isDeleted: true });
    await remove('job-1', 'l-1', office);
    expect(repo.setLinkDeleted).toHaveBeenCalledWith('l-1', true, 'u-off');
  });
  it('restore clears the deletion when the file is still active and not already linked', async () => {
    repo.findLink.mockResolvedValue({ jwluuid: 'l-1', jobId: 'job-1', fileUuid: 'f-1', isDeleted: true });
    repo.setLinkDeleted.mockResolvedValue({ jwluuid: 'l-1', isDeleted: false });
    await restore('job-1', 'l-1', office);
    expect(repo.setLinkDeleted).toHaveBeenCalledWith('l-1', false, 'u-off');
  });
  it('restore refused when an active link to the same file exists', async () => {
    repo.findLink.mockResolvedValue({ jwluuid: 'l-1', jobId: 'job-1', fileUuid: 'f-1', isDeleted: true });
    repo.findActiveLink.mockResolvedValue({ jwluuid: 'l-2' });
    await expect(restore('job-1', 'l-1', office)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("a link of another Job cannot be removed through this Job", async () => {
    repo.findLink.mockResolvedValue({ jwluuid: 'l-9', jobId: 'job-OTHER', fileUuid: 'f-1', isDeleted: false });
    await expect(remove('job-1', 'l-9', office)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('reads', () => {
  it('lists active links with the file; ship user sees only their vessel', async () => {
    repo.listLinks.mockResolvedValue([{ jwluuid: 'l-1', jobId: 'job-1', vesselId: V, isDeleted: false, attachedAt: new Date(), file: storedFile }]);
    const rows = await listForJob('job-1', shipUser);
    expect(rows[0].file?.fileName).toBe('Pump_Overhaul.pdf');
    await expect(listForJob('job-1', { ...shipUser, vesselId: 'vessel-B' })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('with includeRemoved the removed links come back too, each with its removal time (28-Oct-2026, WI-13 Show removed)', async () => {
    const removedOn = new Date('2026-10-27T10:00:00Z');
    repo.listLinks.mockResolvedValue([
      { jwluuid: 'l-1', jobId: 'job-1', vesselId: V, isDeleted: false, attachedAt: new Date(), updatedAt: new Date(), file: storedFile },
      { jwluuid: 'l-2', jobId: 'job-1', vesselId: V, isDeleted: true, attachedAt: new Date(), updatedAt: removedOn, file: storedFile },
    ]);
    const rows = await listForJob('job-1', office, true);
    expect(repo.listLinks).toHaveBeenCalledWith('job-1', true);
    expect(rows.map((r) => [r.jwluuid, r.isDeleted, r.removedAt])).toEqual([['l-1', false, null], ['l-2', true, removedOn]]);
  });
  it('rows carry who uploaded / attached / removed, resolved from master_users; unknown ids give no name (28-Oct-2026, VS-03)', async () => {
    repo.findUserNames.mockResolvedValue(new Map([['u-up', 'Uma Uploader'], ['u-rm', 'Rama Remover']]));
    repo.listLinks.mockResolvedValue([
      { jwluuid: 'l-1', jobId: 'job-1', vesselId: V, isDeleted: false, attachedAt: new Date(), attachedByUuid: 'u-up', updatedByUuid: 'u-up', file: { ...storedFile, uploadedByUuid: 'u-up' } },
      { jwluuid: 'l-2', jobId: 'job-1', vesselId: V, isDeleted: true, attachedAt: new Date(), attachedByUuid: 'u-unknown', updatedAt: new Date(), updatedByUuid: 'u-rm', file: { ...storedFile, uploadedByUuid: 'u-unknown' } },
    ]);
    const rows = await listForJob('job-1', office, true);
    expect(repo.findUserNames).toHaveBeenCalledWith(['u-up', 'u-up', 'u-unknown', 'u-unknown', 'u-rm']);
    expect(rows.map((r) => [r.file?.uploadedByName, r.attachedByName, r.removedByName])).toEqual([
      ['Uma Uploader', 'Uma Uploader', null], [null, null, 'Rama Remover'],
    ]);
  });
  it('the Work Order view is the linked Job\'s live list; a WO without a Job has none', async () => {
    repo.listLinks.mockResolvedValue([]);
    expect(await listForWorkOrder('job-1', office)).toEqual([]);
    expect(await listForWorkOrder(null, office)).toEqual([]);
    expect(repo.listLinks).toHaveBeenCalledTimes(1);
  });
  it('download says when the bytes have not arrived yet (ship before file sync)', async () => {
    await expect(download('f-1', office)).rejects.toThrow(/not available on this server yet/);
  });
});

describe('multi-file upload for a vessel (Bulk Upload screen; files stored without a Job link)', () => {
  it('judges each file on its own: uploaded / skipped (name exists) / refused (not a PDF)', async () => {
    repo.findFileByName.mockImplementation(async (_v: string, name: string) => (name === 'Existing.pdf' ? storedFile : undefined));
    const out = await uploadVesselFiles(V, [pdf('New_One.pdf'), pdf('Existing.pdf'), pdf('notes.txt', 'hello', 'text/plain'), pdf('New_Two.pdf')], office, 'Batch 1');
    expect(out.uploaded.map((f) => f.fileName)).toEqual(['New_One.pdf', 'New_Two.pdf']);
    expect(out.skipped).toEqual([{ fileName: 'Existing.pdf', reason: expect.stringMatching(/already exists/) }]);
    expect(out.refused).toEqual([{ fileName: 'notes.txt', reason: expect.stringMatching(/PDF/) }]);
    expect(repo.createFile).toHaveBeenCalledTimes(2);
    expect(repo.createFile.mock.calls[0][0]).toMatchObject({ vesselId: V, revisionRemarks: 'Batch 1', uploadedByUuid: 'u-off' });
    expect(repo.createLink).not.toHaveBeenCalled(); // no Job link — the Jobs import names them later
    expect(FileSyncProcessor.queueFileForSync).toHaveBeenCalledTimes(2);
  });
  it('ship instance and other-vessel ship user are refused', async () => {
    role.ship = true;
    await expect(uploadVesselFiles(V, [pdf()], office)).rejects.toMatchObject({ statusCode: 403 });
    role.ship = false;
    await expect(uploadVesselFiles(V, [pdf()], { ...shipUser, vesselId: 'vessel-B' })).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.createFile).not.toHaveBeenCalled();
  });
  it('a database failure is not swallowed as "refused"', async () => {
    repo.createFile.mockRejectedValue(new Error('db down'));
    await expect(uploadVesselFiles(V, [pdf()], office)).rejects.toThrow('db down');
  });
});
