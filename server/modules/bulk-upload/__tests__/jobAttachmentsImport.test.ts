import { beforeEach, describe, expect, it, vi } from 'vitest';

// Jobs bulk import — "Job attachments" column (Work Instructions, mig 183; requirement §12/§13; decisions D2 + D3).
// Only the attachment helpers are exercised here; the Jobs loop wires them before/after the Job write (see importService).
const repo = vi.hoisted(() => ({ findFileByName: vi.fn(), findActiveLink: vi.fn(), createLink: vi.fn() }));
vi.mock('../../jobs/repositories/jobWorkInstructionRepository', () => repo);
vi.mock('../../../storage', () => ({ storage: {} }));
vi.mock('../../work-orders/repositories/workOrderRepository', () => ({}));

import { parseJobAttachmentNames, resolveJobAttachments } from '../services/importService';

const V = 'vessel-A';
beforeEach(() => {
  vi.clearAllMocks();
  repo.findFileByName.mockImplementation(async (_v: string, name: string) =>
    name.toLowerCase() === 'pump_overhaul.pdf' ? { jwfuuid: 'f-1', fileName: 'Pump_Overhaul.pdf' } : undefined);
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

describe('resolveJobAttachments (D3: names of files already uploaded for the vessel)', () => {
  it('resolves an existing name (case-insensitive) to its file', async () => {
    const r = await resolveJobAttachments(V, 'pump_overhaul.PDF');
    expect(r).toEqual({ files: [{ jwfuuid: 'f-1', fileName: 'Pump_Overhaul.pdf' }], error: null });
    expect(repo.findFileByName).toHaveBeenCalledWith(V, 'pump_overhaul.PDF');
  });
  it('an unknown name rejects the row with a message naming the file (D2)', async () => {
    const r = await resolveJobAttachments(V, 'Pump_Overhaul.pdf; Missing.pdf');
    expect(r.error).toMatch(/"Missing.pdf" was not found/);
  });
  it('a path or a non-PDF is refused without touching the DB', async () => {
    expect((await resolveJobAttachments(V, '../x.pdf')).error).toMatch(/not a path/);
    expect((await resolveJobAttachments(V, 'docs' + String.fromCharCode(92) + 'x.pdf')).error).toMatch(/not a path/);
    expect((await resolveJobAttachments(V, 'notes.txt')).error).toMatch(/not a PDF/);
    expect(repo.findFileByName).not.toHaveBeenCalled();
  });
  it('no cell → no files, no error', async () => {
    expect(await resolveJobAttachments(V, undefined)).toEqual({ files: [], error: null });
  });
});
