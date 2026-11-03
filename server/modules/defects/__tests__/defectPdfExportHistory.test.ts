import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import {
  loadDefectPdfApprovalHistory, extensionSubmissionForPdf, formatPdfApprovalTime,
} from '@/pages/defects/defectPdfApprovalHistory';
import { recordedHistory } from './defectPdfApprovalFixtures';
import { orderExtensionHistory } from '@/pages/defects/defectApprovalPresentation';

// Execute the production export handler without mounting or changing a live defect.
const source = readFileSync('client/src/pages/defects/DefectFormWizard.tsx', 'utf8');
const ast = ts.createSourceFile('DefectFormWizard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let exportCode = '';
function findExport(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleExportPdf') exportCode = node.initializer!.getText(ast);
  ts.forEachChild(node, findExport);
}
findExport(ast);
function fixture(options: { id?: string | null; setting?: boolean; historyStatus?: number; body?: unknown } = {}) {
  const id = 'id' in options ? options.id : 'D-PDF-TEST';
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/report-settings')) return Response.json({ showRejectedClosuresOnReport: options.setting === true });
    return Response.json(options.body ?? recordedHistory, { status: options.historyStatus ?? 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  const submitted = { id: 'ext-saved', requestedByName: 'Persisted Submitter', requestedByPosition: 'Master', requestedAt: '2026-11-03T08:00:00Z' };
  const values: any = { vesselId: 'vessel-test', description: 'Unsaved description at export click', dateCompleted: '2026-11-03',
    confirmCompleted: true, closedByName: 'Manually Entered Closer', closedByRank: 'Master' };
  const generate = vi.fn(), toast = vi.fn();
  const attachments = vi.fn().mockResolvedValue({ fileNotes: ['Existing file note'] });
  const bindings: Record<string, any> = {
    form: { getValues: () => values }, currentDefect: id ? { id, targetDateExtensions: [submitted] } : null,
    createdDefectId: null, approvalDefectId: id, defectId: 'UNSAVED-REPORT', currentUser: { userUuid: 'session-actor' },
    loadDefectPdfApprovalHistory, extensionSubmissionForPdf, orderExtensionHistory,
    defectFileHeaders: () => ({ Authorization: 'Bearer test-session' }),
    fetch: fetcher, toast, vessels: [{ id: 'vessel-test', name: 'Test Vessel' }],
    findSourceById: () => undefined, buildImmediateCauseText: () => '', buildRootCauseText: () => '',
    prepareDefectPdfAttachments: attachments, partAAttachments: [], fileAttachments: [], partCAttachments: [], attachmentSessionId: 'test-session',
    pdfReportGenerator: { generateDefectReportPdf: generate }, formatDate: (value: string) => value || '',
    targetDateExtensions: [
      { ...submitted, reasonForExtension: 'Unsaved extension reason', status: 'Approved' },
      { id: 'ext-unsaved', requestedByName: 'Do Not Attribute This User', requestedAt: '2026-11-04T08:00:00Z', status: 'Requested' },
    ],
    actions: [], closureHistory: { data: [{ attemptNumber: 1, rejectionReason: 'Previous closure rejection' }] },
    resolveEvidence: () => [], selectedEvidence: [], defectEvidenceLabel: () => '',
  };
  const module = { exports: {} as any };
  const code = transformSync(`export const run = ${exportCode};`, { loader: 'ts', format: 'cjs' }).code;
  new Function('module', 'exports', ...Object.keys(bindings), code)(module, module.exports, ...Object.values(bindings));
  return { run: module.exports.run as () => Promise<void>, fetcher, generate, toast, values, attachments };
}
afterEach(() => vi.unstubAllGlobals());

describe('Defect PDF export history preparation', () => {
  it.each([false, true])('exports fresh history and current unsaved values without writing (appendix setting %s)', async setting => {
    const f = fixture({ setting });
    const exporting = f.run();
    f.values.description = 'Edited after export was clicked';
    await exporting;
    expect(f.generate).toHaveBeenCalledOnce();
    const payload = f.generate.mock.calls[0][0];
    expect(payload.description).toBe('Unsaved description at export click');
    expect(payload.closureEvidence).toBe('');
    expect(payload.closedByName).toBe('Manually Entered Closer');
    expect(payload.approvalHistory).toEqual(recordedHistory);
    expect(payload.fileNotes).toEqual(['Existing file note']);
    expect(payload.targetDateExtensions[0]).toMatchObject({
      reasonForExtension: 'Unsaved extension reason', submittedBy: 'Persisted Submitter (Master)', submittedAt: '03 Nov 2026, 0800 Z',
    });
    expect(payload.targetDateExtensions[1].submittedBy).not.toContain('Do Not Attribute This User');
    expect(payload.targetDateExtensions[1].submittedAt).toBe('Not Recorded');
    expect(Boolean(payload.rejectedClosures)).toBe(setting);
    expect(f.fetcher).toHaveBeenCalledWith(expect.stringContaining('/D-PDF-TEST/approval-process'), {
      method: 'GET', credentials: 'include', cache: 'no-store', headers: { Authorization: 'Bearer test-session' },
    });
    expect(f.fetcher.mock.calls.every(([, init]: any) => !init?.method || init.method === 'GET')).toBe(true);
    await f.run();
    expect(f.fetcher.mock.calls.filter(([url]) => url.endsWith('/approval-process'))).toHaveLength(2);
  });
  it.each([401, 403, 404, 500])('blocks incomplete PDF on history HTTP %s and supports retry', async historyStatus => {
    const f = fixture({ historyStatus });
    await f.run();
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.attachments).not.toHaveBeenCalled();
    expect(f.toast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive', description: expect.stringContaining('retry Export'),
    }));
    f.fetcher.mockResolvedValueOnce(Response.json(recordedHistory));
    await f.run();
    expect(f.generate).toHaveBeenCalledOnce();
  });
  it('blocks network failure or malformed history instead of using cached/partial data', async () => {
    const f = fixture({ body: { extension: recordedHistory.extension } });
    await f.run();
    expect(f.generate).not.toHaveBeenCalled();
    f.fetcher.mockRejectedValueOnce(new Error('Network offline'));
    await f.run();
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.toast).toHaveBeenLastCalledWith(expect.objectContaining({
      description: 'Approval history could not be loaded. Check your connection and retry Export.', variant: 'destructive',
    }));
    f.fetcher.mockResolvedValueOnce(new Response('Not valid JSON', { status: 200 }));
    await f.run();
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.toast).toHaveBeenLastCalledWith(expect.objectContaining({
      description: expect.stringContaining('incomplete'), variant: 'destructive',
    }));
  });
  it('keeps unsaved new defects exportable without history or invented activity', async () => {
    const f = fixture({ id: null });
    await f.run();
    const payload = f.generate.mock.calls[0][0];
    expect(payload.approvalHistory).toBeUndefined();
    expect(f.fetcher.mock.calls.every(([url]) => !url.endsWith('/approval-process'))).toBe(true);
    expect(payload.targetDateExtensions.every((row: any) => row.submittedAt === 'Not Recorded')).toBe(true);
  });
  it('accepts successful empty history and keeps a newly saved ID distinct from a draft report number', async () => {
    const empty = {
      extension: { subjectType: 'defect-extension', attempts: [] },
      verification: { subjectType: 'defect-verification', attempts: [] },
    };
    const f = fixture({ id: 'NEWLY-SAVED-ID', body: empty });
    await f.run();
    expect(f.generate.mock.calls[0][0].approvalHistory).toEqual(empty);
    expect(f.fetcher.mock.calls[0][0]).toContain('/NEWLY-SAVED-ID/');
  });
  it('encodes defect identity and does not conflate missing metadata with another entry or session user', async () => {
    const request = vi.fn().mockResolvedValue(Response.json(recordedHistory));
    await loadDefectPdfApprovalHistory('D/1 ?#', {}, request);
    expect(request.mock.calls[0][0]).toContain('/D%2F1%20%3F%23/approval-process');
    expect(extensionSubmissionForPdf('missing', [{ id: 'other', requestedByName: 'Different Entry' }])).toEqual({
      submittedBy: 'Not Recorded (position Not Recorded)', submittedAt: 'Not Recorded',
    });
    expect(formatPdfApprovalTime('03-11-2026')).toBe('03 Nov 2026 (time Not Recorded)');
    expect(formatPdfApprovalTime('2026-11-03T14:45:00+05:30')).toBe('03 Nov 2026, 0915 Z');
  });
});
