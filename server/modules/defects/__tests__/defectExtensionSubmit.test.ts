import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';
import { resolveDefectExtensionUi } from '../../../../client/src/pages/defects/defectApprovalPresentation';

// Execute the actual wizard callbacks, not a second implementation of submission.
const source = readFileSync('client/src/pages/defects/DefectFormWizard.tsx', 'utf8');
const ast = ts.createSourceFile('wizard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let save = '';
let submit = '';
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'saveDefect') save = node.initializer!.getText(ast);
  if (ts.isJsxOpeningElement(node) && node.attributes.properties.some(p =>
    ts.isJsxAttribute(p) && p.name.getText(ast) === 'data-testid' && p.initializer?.getText(ast) === '"button-submit-extension"')) {
    const click = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'onClick') as ts.JsxAttribute;
    submit = (click.initializer as ts.JsxExpression).expression!.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (!save || !submit) throw new Error('Production B5/save callbacks not found');

function harness(isSaving = false) {
  const data = { vesselId: 'fixture-vessel', issueDate: '2026-11-01', componentId: 'fixture-component',
    description: 'Isolated extension form test', targetCloseDate: '2026-11-18', status: 'Open',
    confirmCompleted: false, dateCompleted: '', closedByName: '', closedByRank: '', verified: false };
  const currentExtension = { newTargetDate: '2026-11-19', reasonForExtension: 'Further repairs required' };
  const toast = vi.fn();
  const bindings: Record<string, any> = {
    currentExtension, targetDateExtensions: [], showExtensionForm: true,
    form: { trigger: vi.fn().mockResolvedValue(true), getValues: vi.fn((key?: keyof typeof data) => key ? data[key] : data) },
    currentDefect: { ...data, id: 'fixture-defect', closureFiles: null }, createdDefectId: null,
    isSaving, isSubmittingExtension: false, extensionSubmissionRef: { current: false },
    extensionDraftRef: { current: null },
    setIsSaving: vi.fn(), setIsSubmittingExtension: vi.fn(), setTargetDateExtensions: vi.fn(),
    setShowExtensionForm: vi.fn(), setSavedFileDefect: vi.fn(), setCreatedDefectId: vi.fn(),
    actions: [], partAAttachments: [], fileAttachments: [],
    partCAttachments: [{ id: 'preserved-evidence', name: 'Previous closure evidence.pdf' }], closureFiles: [],
    attachmentAvailability: { externalStorage: false }, attachmentSessionId: 'fixture-session',
    isExternalDefectAttachment: () => false, currentUser: null, defectId: 'fixture-defect',
    approvalDefectId: 'fixture-defect', onCompleted: null, setLocation: vi.fn(), toast,
    queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
    defectApprovalChainQueryKey: (id: string, action: string) => ['fixture-chain', id, action],
    apiRequest: vi.fn().mockImplementation(async (_method, _url, body) => new Response(JSON.stringify({
      ...data, id: 'fixture-defect', ...body, approvalSubmission: { status: 'succeeded' },
    }))),
  };
  const code = transformSync(`function callbacks() { const saveDefect = ${save}; const submit = ${submit}; return { saveDefect, submit }; }`,
    { loader: 'ts', target: 'es2020' }).code;
  const callbacks = new Function(...Object.keys(bindings), `${code}\nreturn callbacks();`)(...Object.values(bindings));
  return { ...bindings, ...callbacks, data };
}

describe('B5 submission after rejected verification', () => {
  it('persists once before displaying a Requested entry, preserving empty live selection and old documents', async () => {
    const h = harness();
    let release!: () => void;
    h.apiRequest.mockImplementationOnce(async (_m: string, _u: string, body: any) => {
      expect(h.setTargetDateExtensions).not.toHaveBeenCalled();
      expect(h.setShowExtensionForm).not.toHaveBeenCalled();
      await new Promise<void>(resolve => { release = resolve; });
      return new Response(JSON.stringify({ id: 'fixture-defect', ...body, approvalSubmission: { status: 'succeeded' } }));
    });
    const pending = h.submit();
    await vi.waitFor(() => expect(h.apiRequest).toHaveBeenCalledOnce());
    await h.submit(); // Same render, before React has committed the busy state.
    expect(h.apiRequest).toHaveBeenCalledOnce();
    release();
    await pending;
    const [method, url, body] = h.apiRequest.mock.calls[0];
    expect([method, url]).toEqual(['PATCH', '/technical/api/defects/fixture-defect']);
    expect(body.targetDateExtensions).toHaveLength(1);
    expect(body.targetDateExtensions[0]).toMatchObject({ status: 'Requested', newTargetDate: '2026-11-19' });
    expect(body.targetCloseDate).toBe('2026-11-18');
    expect(body.confirmCompleted).toBe(false);
    expect(body.closureFiles).toEqual([]);
    expect(body.partCAttachments).toEqual(h.partCAttachments);
    expect(h.setTargetDateExtensions).toHaveBeenCalledExactlyOnceWith(body.targetDateExtensions);
    expect(h.setShowExtensionForm).toHaveBeenCalledWith(false);
    expect(h.extensionSubmissionRef.current).toBe(false);
    expect(h.extensionDraftRef.current).toBeNull();
  });

  it.each([
    '409: {"message":"The record changed. Refresh and retry."}',
    'Connection interrupted',
  ])('retains the draft and actual error without a phantom Requested card: %s', async error => {
    const h = harness();
    h.apiRequest.mockRejectedValueOnce(new Error(error));
    await h.submit();
    expect(h.setTargetDateExtensions).not.toHaveBeenCalled();
    expect(h.setShowExtensionForm).not.toHaveBeenCalled();
    expect(h.currentExtension).toEqual({ newTargetDate: '2026-11-19', reasonForExtension: 'Further repairs required' });
    expect(h.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      title: 'Error saving defect', description: error.startsWith('409') ? 'The record changed. Refresh and retry.' : error,
    }));
    expect(h.extensionSubmissionRef.current).toBe(false);
    const failedEntry = h.apiRequest.mock.calls[0][2].targetDateExtensions[0];
    // A definite failed save followed by a successful retry creates just one stored entry.
    await h.submit();
    expect(h.setTargetDateExtensions).toHaveBeenCalledOnce();
    expect(h.setTargetDateExtensions.mock.calls[0][0]).toHaveLength(1);
    expect(h.apiRequest.mock.calls[1][2].targetDateExtensions[0]).toEqual(failedEntry);
  });

  it('reuses the exact request identity after the server saves but its response is lost', async () => {
    const h = harness();
    let saved: any;
    h.apiRequest.mockImplementationOnce(async (_method: string, _url: string, body: any) => {
      saved = structuredClone(body);
      throw new Error('Response lost after persistence');
    });
    await h.submit();
    expect(h.setTargetDateExtensions).not.toHaveBeenCalled();
    h.apiRequest.mockImplementationOnce(async (_method: string, _url: string, body: any) => {
      expect(body.targetDateExtensions).toEqual(saved.targetDateExtensions);
      // An unchanged existing request is a normal save, not a second approval submission.
      return new Response(JSON.stringify({ id: 'fixture-defect', ...saved, approvalSubmission: { status: 'not_required' } }));
    });
    await h.submit();
    expect(h.setTargetDateExtensions).toHaveBeenCalledExactlyOnceWith(saved.targetDateExtensions);
    expect(h.extensionDraftRef.current).toBeNull();
  });

  it('keeps a saved entry when approval submission fails and hides new-request Submit', async () => {
    const h = harness();
    h.apiRequest.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'fixture-defect', approvalSubmission: { status: 'failed', message: 'Approval service unavailable' },
    })));
    await h.submit();
    expect(h.apiRequest).toHaveBeenCalledOnce();
    expect(h.setTargetDateExtensions).toHaveBeenCalledOnce();
    expect(h.setShowExtensionForm).toHaveBeenCalledWith(false);
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Approval service unavailable', description: 'The extension was saved.',
    }));
    expect(resolveDefectExtensionUi({
      formOpen: false, hasStoredExtension: true, requestStatus: 'Requested', canEdit: true,
    }).showSubmit).toBe(false);
  });

  it.each(['missing-date', 'missing-reason', 'earlier-date', 'invalid-form', 'incomplete-c1', 'save-in-progress'])(
    'preserves draft and existing validation for %s', async scenario => {
      const h = harness(scenario === 'save-in-progress');
      if (scenario === 'missing-date') h.currentExtension.newTargetDate = '';
      if (scenario === 'missing-reason') h.currentExtension.reasonForExtension = ' ';
      if (scenario === 'earlier-date') h.currentExtension.newTargetDate = '2026-11-18';
      if (scenario === 'invalid-form') h.form.trigger.mockResolvedValue(false);
      if (scenario === 'incomplete-c1') h.data.closedByName = 'Unsubmitted closure';
      await h.submit();
      expect(h.apiRequest).not.toHaveBeenCalled();
      expect(h.setTargetDateExtensions).not.toHaveBeenCalled();
      expect(h.setShowExtensionForm).not.toHaveBeenCalled();
      expect(h.toast).toHaveBeenCalledOnce();
      expect(h.extensionSubmissionRef.current).toBe(false);
    },
  );
});
