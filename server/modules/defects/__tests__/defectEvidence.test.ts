import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defectAttachmentAvailability, defectEvidenceLabel, resolveDefectEvidence, STALE_CLOSURE_MESSAGE } from '@shared/defectEvidence';

const repo = vi.hoisted(() => ({ getDefectClosureHistory: vi.fn() }));
vi.mock('../repositories/defectsRepository', () => repo);
import { assertDefectEvidenceRules } from '../services/defectsService';

const file = (id: string) => ({ id, name: `${id}.pdf`, data: 'data:application/pdf;base64,JVBERg==', type: 'application/pdf', size: 4, uploadedAt: '2026-11-02' });
const current = () => ({
  duuid: 'defect-1', status: 'Open', attachments: [file('b')], partCAttachments: [file('c')],
  closureFiles: ['b', 'old-row', 'missing'],
});

describe('independent C1 evidence and legacy compatibility', () => {
  beforeEach(() => repo.getDefectClosureHistory.mockResolvedValue([]));
  it('resolves C1 first, then B, then separate same-defect IDs without changing inputs', () => {
    const ids = ['c', 'b', 'old-row', 'missing'];
    const resolved = resolveDefectEvidence(ids, [file('c')], [file('b')], [{ datuuid: 'old-row', filename: 'legacy.pdf', url: '/private/legacy.pdf' }]);
    expect(resolved.map((f) => f.source)).toEqual(['c1', 'legacy', 'legacy', 'unavailable']);
    expect(defectEvidenceLabel(resolved[1])).toContain('Legacy evidence');
    expect(ids).toEqual(['c', 'b', 'old-row', 'missing']);
  });
  it('never guesses ambiguous IDs or filenames and never exposes unsafe URLs', () => {
    expect(resolveDefectEvidence(['b'], [], [file('b'), file('b')])[0].source).toBe('unavailable');
    expect(resolveDefectEvidence(['other'], [], [file('b')])[0].source).toBe('unavailable');
    expect(resolveDefectEvidence(['bad'], [], [], [{ datuuid: 'bad', filename: 'bad', url: 'javascript:alert(1)' }])[0].href).toBeUndefined();
  });
  it('retains saved legacy/missing IDs, accepts C1 references, and tolerates omitted lists', async () => {
    await expect(assertDefectEvidenceRules(current(), {})).resolves.toBeUndefined();
    await expect(assertDefectEvidenceRules(current(), { closureFiles: ['b', 'old-row', 'missing', 'c'] })).resolves.toBeUndefined();
  });
  it('rejects NEW Part B, URL and history-only selections with a refresh message', async () => {
    repo.getDefectClosureHistory.mockResolvedValue([{ closureFiles: ['history-only'] }]);
    for (const id of ['new-b', 'history-only', 'https://example.test/a.pdf']) {
      await expect(assertDefectEvidenceRules(current(), { attachments: [file('new-b')], closureFiles: [id] }))
        .rejects.toMatchObject({ statusCode: 400, message: STALE_CLOSURE_MESSAGE });
    }
    await expect(assertDefectEvidenceRules({ ...current(), closureFiles: [] }, { closureFiles: ['b'] }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
  it('fails closed for new C1 writes in M1 but permits unchanged sync-received rows', async () => {
    expect(defectAttachmentAvailability()).toMatchObject({ c1Upload: false, externalStorage: false });
    await expect(assertDefectEvidenceRules(current(), { partCAttachments: [file('new')] }))
      .rejects.toMatchObject({ statusCode: 409, code: 'C1_UNAVAILABLE' });
    await expect(assertDefectEvidenceRules(current(), { partCAttachments: [file('c')] })).resolves.toBeUndefined();
    await expect(assertDefectEvidenceRules(current(), { partCAttachments: [{ ...file('c'), data: 'replacement' }] }))
      .rejects.toMatchObject({ code: 'C1_UNAVAILABLE' });
  });
  it('protects closed and rejected B/C1 evidence, but allows deliberate unprotected removal', async () => {
    const closed = { ...current(), status: 'Closed' };
    for (const field of ['attachments', 'partCAttachments']) {
      await expect(assertDefectEvidenceRules(closed, { [field]: [] }))
        .rejects.toMatchObject({ code: 'CLOSURE_EVIDENCE_PROTECTED' });
    }
    repo.getDefectClosureHistory.mockResolvedValue([{ closureFiles: ['b', 'c'] }]);
    await expect(assertDefectEvidenceRules(current(), { attachments: [], partCAttachments: [] }))
      .rejects.toMatchObject({ code: 'CLOSURE_EVIDENCE_PROTECTED' });
    repo.getDefectClosureHistory.mockResolvedValue([]);
    await expect(assertDefectEvidenceRules(current(), { attachments: [], partCAttachments: [] })).resolves.toBeUndefined();
  });
});
