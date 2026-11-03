import { describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { recordedHistory } from './defectPdfApprovalFixtures';

// jsPDF attaches save() per instance — wrap the class so every document hands its raw PDF to the test.
const captured: { raw: string; pages: number; width: number; height: number; texts: Array<{ text: string; y: number; page: number }> } = {
  raw: '', pages: 0, width: 0, height: 0, texts: [],
};
vi.mock('jspdf', async () => {
  const actual: any = await vi.importActual('jspdf');
  class CapturingPDF extends actual.jsPDF {
    constructor(...args: any[]) {
      super(...args);
      const originalText = this.text.bind(this);
      (this as any).text = (text: any, x: any, y: any, ...rest: any[]) => {
        if (typeof y === 'number') captured.texts.push({
          text: Array.isArray(text) ? text.join('\n') : String(text),
          y, page: this.internal.getCurrentPageInfo().pageNumber,
        });
        return (originalText as any)(text, x, y, ...rest);
      };
      (this as any).save = () => {
        captured.raw = (this as any).output();
        captured.pages = this.getNumberOfPages();
        captured.width = this.internal.pageSize.getWidth();
        captured.height = this.internal.pageSize.getHeight();
        return this;
      };
    }
  }
  return { ...actual, jsPDF: CapturingPDF, default: CapturingPDF };
});
import { pdfReportGenerator } from '@/lib/pdfReportGenerator';

// Sahil E12 / F1 (28-Sep-2026): the defect PDF prints EVERY extension; rejected closure attempts
// print only when the report setting is on (the caller then passes rejectedClosures).
function render(extra: Record<string, unknown>): string {
  captured.raw = '';
  captured.texts = [];
  pdfReportGenerator.generateDefectReportPdf({
    reportId: 'D-TEST', vessel: 'V', category: '', dateObserved: '', source: '', component: '',
    dateReportedToOffice: '', defectCategory: '', make: '', dateRegisteredInSystem: '', defectType: '',
    model: '', targetDate: '', raisedBy: '', isCoc: false, isCritical: false, dateClosed: '',
    description: 'd', immediateCause: '', immediateCauseExplanation: '', rootCause: '', rootCauseExplanation: '',
    sireVersion: '', sireReference: '', sireHardwareClass: '', riskLevel: '', priority: '', actions: [],
    confirmCompleted: false, dateCompleted: '', closedByName: '', closedByRank: '', verified: false,
    dateVerified: '', verifiedByName: '', verifiedByOfficePosition: '',
    targetDateExtensions: [],
    ...extra,
  } as any);
  return captured.raw;
}
const ext = (n: number, status: string) => ({
  existingTargetDate: `0${n}-Sep-2026`, newTargetDate: `1${n}-Sep-2026`, reasonForExtension: `reason ${n}`,
  approved: status, approvalDate: '', approverComments: `comment ${n}`,
});

describe('defect report PDF', () => {
  it('retains pending/failed file notes and embeds available image evidence', () => {
    const pdf = render({
      fileNotes: ['evidence.pdf - Awaiting synchronization', 'photo.jpg - Transfer failed - contact support'],
      fileImages: [{ label: 'Available photo', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=' }],
    });
    expect(pdf).toContain('Awaiting synchronization');
    expect(pdf).toContain('Transfer failed');
    expect(pdf).toContain('Available photo');
  });
  it('prints current and rejected legacy evidence without changing the portrait form', () => {
    const pdf = render({
      closureEvidence: 'old.pdf - Legacy evidence',
      rejectedClosures: [{ attemptNumber: '1', closureEvidence: 'rejected.pdf - Legacy evidence' }],
    });
    expect(pdf).toContain('old.pdf - Legacy evidence');
    expect(pdf).toContain('rejected.pdf - Legacy evidence');
    expect(pdf).toContain('C2. Verification');
  });
  it('prints every extension with its number and status', () => {
    const pdf = render({ targetDateExtensions: [ext(1, 'Approved'), ext(2, 'Approved'), ext(3, 'Rejected')] });
    expect(pdf).toContain('B5. Target Date Extension 1 of 3');
    expect(pdf).toContain('B5. Target Date Extension 3 of 3');
    expect(pdf).toContain('reason 1');
    expect(pdf).toContain('reason 3');
    expect(pdf).toContain('Rejected');
  });
  it('a single extension keeps the old heading', () => {
    const pdf = render({ targetDateExtensions: [ext(1, 'Approved')] });
    expect(pdf).toContain('B5. Target Date Extension');
    expect(pdf).not.toContain('1 of 1');
  });
  it('prints rejected closure attempts only when passed (setting on)', () => {
    const attempt = { attemptNumber: '1', dateCompleted: '20-Sep-2026', closedBy: 'Peter — Master', closureComment: 'done',
      rejectedBy: 'Supt — Office', rejectedAt: '21-Sep-2026', rejectionReason: 'photo unclear' };
    expect(render({ rejectedClosures: [attempt] })).toContain('C3. Rejected Closure Attempts');
    expect(render({ rejectedClosures: [attempt] })).toContain('photo unclear');
    expect(render({})).not.toContain('C3. Rejected Closure Attempts');
  });
  it('prints submitters and every intermediate/final decision once, without pairing attempts to extension rows', () => {
    render({
      targetDateExtensions: [{ ...ext(1, 'Approved'), submittedBy: 'Entry Submitter (Master)', submittedAt: '03 Nov 2026, 0800 Z' }],
      approvalHistory: recordedHistory,
    });
    const text = captured.texts.map(item => item.text).join('\n');
    for (const expected of ['Entry Submitter (Master)', 'Extension Submitter', 'Intermediate Approver', 'Final Approver',
      'First Reviewer', 'Withdrawal Actor', 'Closure Submitter', 'Closure Resubmitter', 'Closure Reviewer',
      'Verification Approver', 'ADMIN OVERRIDE', 'Recorded override explanation', 'Reason for first rejection',
      'Additional closure evidence required', '03 Nov 2026, 0915 Z']) expect(text).toContain(expected);
    expect(text.match(/Extension Approval Process/g)).toHaveLength(1);
    expect(text.match(/Verification Approval Process/g)).toHaveLength(1);
    expect(text.match(/Intermediate Approver/g)).toHaveLength(1);
    expect(text.indexOf('First Reviewer')).toBeLessThan(text.indexOf('Second Submitter'));
    expect(text.indexOf('Closure Reviewer')).toBeLessThan(text.indexOf('Closure Resubmitter'));
    expect(captured.width).toBeCloseTo(210, 0);
    expect(captured.height).toBeCloseTo(297, 0);
  });
  it.each([false, true])('prints rejection decisions independently of the detailed rejected-closure setting %s', setting => {
    const pdf = render({
      approvalHistory: recordedHistory,
      rejectedClosures: setting ? [{ attemptNumber: '1', rejectionReason: 'Appendix rejection reason' }] : undefined,
    });
    expect(pdf).toContain('Additional closure evidence required');
    expect(pdf.includes('C3. Rejected Closure Attempts')).toBe(setting);
  });
  it('honestly labels missing actors/positions/times and date-only legacy events', () => {
    render({ approvalHistory: {
      extension: { subjectType: 'defect-extension', attempts: [{ number: 1, events: [
        { type: 'approved', label: 'Approved', byName: null, byPosition: null, at: '2026-11-03', remarks: null },
        { type: 'submitted', label: 'Legacy submitted', byName: 'Known Actor', byPosition: null, at: null, remarks: null },
      ] }] },
      verification: { subjectType: 'defect-verification', attempts: [] },
    } });
    const text = captured.texts.map(item => item.text).join('\n').replace(/\s+/g, ' ');
    expect(text).toContain('Not Recorded (position Not Recorded)');
    expect(text).toContain('Known Actor (position Not Recorded)');
    expect(text).toContain('03 Nov 2026 (time Not Recorded)');
    expect(text).not.toContain('0000 Z');
    expect(text).toContain('No approval process events recorded.');
    expect(text).not.toContain('Jeevan');
  });
  it('paginates very long remarks and histories without omitted events or footer overlap', () => {
    const history = structuredClone(recordedHistory);
    history.extension.attempts[0].events[0].remarks =
      'LONG REMARK START\n' + Array.from({ length: 160 }, (_, i) => `Remark line ${i}: preserved compliance explanation.`).join('\n') + '\nLONG REMARK END';
    for (let i = 4; i <= 18; i++) {
      history.extension.attempts.push({ number: i, events: [{ ...history.extension.attempts[1].events[1], label: `Approval event ${i}` }] });
    }
    render({
      reportId: 'D-HISTORY-LONG', approvalHistory: history,
      targetDateExtensions: [{ ...ext(1, 'Approved'), approverComments: 'Long summary\n'.repeat(80) + 'SUMMARY END' }],
      fileNotes: ['Legacy evidence remains readable', ...Array.from({ length: 15 }, (_, i) => `Very long attachment filename ${i} - existing synchronized evidence and availability notes are preserved.pdf`)],
    });
    const text = captured.texts.map(item => item.text).join('\n');
    for (const value of ['LONG REMARK START', 'LONG REMARK END', 'SUMMARY END', 'Approval event 18',
      'Verification accepted', 'Legacy evidence remains readable']) expect(text).toContain(value);
    expect(captured.pages).toBeGreaterThan(4);
    expect(captured.texts.filter(item => !/^SAIL$|^Page \d+ of \d+$/.test(item.text)).every(item => item.y <= 278)).toBe(true);
    for (let page = 1; page <= captured.pages; page++) {
      expect(captured.texts.some(item => item.page === page && item.text === `Page ${page} of ${captured.pages}`)).toBe(true);
    }
    // Optional local visual inspection; never saves or updates a real defect.
    if (process.env.DEFECT_PDF_VISUAL_PATH) writeFileSync(process.env.DEFECT_PDF_VISUAL_PATH, Buffer.from(captured.raw, 'binary'));
  });
});
