import { describe, expect, it, vi } from 'vitest';

// jsPDF attaches save() per instance — wrap the class so every document hands its raw PDF to the test.
const captured: { raw: string } = { raw: '' };
vi.mock('jspdf', async () => {
  const actual: any = await vi.importActual('jspdf');
  class CapturingPDF extends actual.jsPDF {
    constructor(...args: any[]) {
      super(...args);
      (this as any).save = () => { captured.raw = (this as any).output(); return this; };
    }
  }
  return { ...actual, jsPDF: CapturingPDF, default: CapturingPDF };
});
import { pdfReportGenerator } from '@/lib/pdfReportGenerator';

// Sahil E12 / F1 (28-Sep-2026): the defect PDF prints EVERY extension; rejected closure attempts
// print only when the report setting is on (the caller then passes rejectedClosures).
function render(extra: Record<string, unknown>): string {
  captured.raw = '';
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
});
