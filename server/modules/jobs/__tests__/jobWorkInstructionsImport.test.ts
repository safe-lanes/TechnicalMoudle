import { beforeEach, describe, expect, it, vi } from 'vitest';

// Work Instructions in the Jobs bulk import (mig 183; requirement §12/§13; decisions D2 + D3): the service rules the
// bulk-upload module calls — names resolved before the Job write, links created after, never duplicated.
const role = vi.hoisted(() => ({ ship: false }));
vi.mock('../../sync/syncRole', () => ({ isShipInstance: async () => role.ship }));
vi.mock('../../sync/fileSyncProcessor', () => ({ FileSyncProcessor: { queueFileForSync: vi.fn(async () => undefined) } }));
const repo = vi.hoisted(() => ({
  findJob: vi.fn(), listVesselFiles: vi.fn(), findFile: vi.fn(), findFileByName: vi.fn(), createFile: vi.fn(),
  listLinks: vi.fn(), findLink: vi.fn(), findActiveLink: vi.fn(), createLink: vi.fn(), setLinkDeleted: vi.fn(),
}));
vi.mock('../repositories/jobWorkInstructionRepository', () => repo);

import { attachResolvedFiles, parseJobAttachmentNames, resolveJobAttachmentNames } from '../services/jobWorkInstructionService';

const V = 'vessel-A';
const BS = String.fromCharCode(92); // a backslash, kept out of the source text
beforeEach(() => {
  vi.clearAllMocks(); role.ship = false;
  repo.findFileByName.mockImplementation(async (_v: string, name: string) =>
    name.toLowerCase() === 'pump_overhaul.pdf' ? { jwfuuid: 'f-1', fileName: 'Pump_Overhaul.pdf' } : undefined);
  repo.findActiveLink.mockResolvedValue(undefined);
  repo.createLink.mockImplementation(async (d: any) => ({ jwluuid: 'l-new', ...d }));
});

describe('parseJobAttachmentNames', () => {
  it('splits on ";" or new lines, trims, drops blanks and case-duplicates', () => {
    expect(parseJobAttachmentNames(' A.pdf ; b.pdf;; \n a.PDF ')).toEqual(['A.pdf', 'b.pdf']);
  });
  it('empty / missing cell → no attachments', () => {
    expect(parseJobAttachmentNames(undefined)).toEqual([]);
    expect(parseJobAttachmentNames('')).toEqual([]);
    expect(parseJobAttachmentNames(null)).toEqual([]);
  });
});

describe('resolveJobAttachmentNames (D3: names of files already uploaded for the vessel)', () => {
  it('resolves an existing name (case-insensitive) to its file', async () => {
    const r = await resolveJobAttachmentNames(V, 'pump_overhaul.PDF');
    expect(r).toEqual({ files: [{ jwfuuid: 'f-1', fileName: 'Pump_Overhaul.pdf' }], error: null });
    expect(repo.findFileByName).toHaveBeenCalledWith(V, 'pump_overhaul.PDF');
  });
  it('an unknown name rejects the row with a message naming the file (D2)', async () => {
    const r = await resolveJobAttachmentNames(V, 'Pump_Overhaul.pdf; Missing.pdf');
    expect(r.error).toMatch(/"Missing.pdf" was not found/);
  });
  it('a path or a non-PDF is refused without touching the DB', async () => {
    expect((await resolveJobAttachmentNames(V, '../x.pdf')).error).toMatch(/not a path/);
    expect((await resolveJobAttachmentNames(V, 'docs/x.pdf')).error).toMatch(/not a path/);
    expect((await resolveJobAttachmentNames(V, `docs${BS}x.pdf`)).error).toMatch(/not a path/);
    expect((await resolveJobAttachmentNames(V, 'notes.txt')).error).toMatch(/not a PDF/);
    expect(repo.findFileByName).not.toHaveBeenCalled();
  });
  it('no cell → no files, no error', async () => {
    expect(await resolveJobAttachmentNames(V, undefined)).toEqual({ files: [], error: null });
  });
});

describe('attachResolvedFiles (after the Job write)', () => {
  const job = { juuid: 'job-1', vesselId: V };
  const files = [{ jwfuuid: 'f-1', fileName: 'Pump_Overhaul.pdf' }, { jwfuuid: 'f-2', fileName: 'Valve.pdf' }];
  it('links each file to the Job with the Job vessel and the importing user', async () => {
    const attached = await attachResolvedFiles(job, files, 'u-import');
    expect(attached).toEqual(['Pump_Overhaul.pdf', 'Valve.pdf']);
    expect(repo.createLink).toHaveBeenCalledTimes(2);
    expect(repo.createLink.mock.calls[0][0]).toMatchObject({ jobId: 'job-1', fileUuid: 'f-1', vesselId: V, attachedByUuid: 'u-import' });
  });
  it('re-import: a link that is already active is not created again (§13)', async () => {
    repo.findActiveLink.mockImplementation(async (_j: string, f: string) => (f === 'f-1' ? { jwluuid: 'l-1' } : undefined));
    expect(await attachResolvedFiles(job, files, 'u-import')).toEqual(['Valve.pdf']);
    expect(repo.createLink).toHaveBeenCalledTimes(1);
  });
  it('nothing to attach → no DB calls; a ship instance is refused (office-only writes)', async () => {
    expect(await attachResolvedFiles(job, [], 'u')).toEqual([]);
    expect(repo.findActiveLink).not.toHaveBeenCalled();
    role.ship = true;
    await expect(attachResolvedFiles(job, files, 'u')).rejects.toMatchObject({ statusCode: 403 });
  });
});
