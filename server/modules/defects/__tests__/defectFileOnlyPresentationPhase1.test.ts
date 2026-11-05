import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as attachmentTypes from '@shared/defectAttachments';

// Evaluate only the two dialog components with inert UI/auth primitives; never
// import the form, Certificate/Survey pages, query clients or server startup.
const nativeRequire = createRequire(import.meta.url);
const external = { storageVersion: 1, id: 'file', name: 'proof.pdf', size: 11, type: 'application/pdf',
  uploadedAt: '2026-11-01', backend: 'local', sha256: 'fixture-hash', uploadedByUuid: 'actor',
  fileKey: 'fixture-key' };
const inline = { id: 'legacy', name: 'old.pdf', size: 4, type: 'application/pdf',
  uploadedAt: '2026-11-01', data: 'data:application/pdf;base64,AAAA' };
function render(section = 'part-a', overrides: any = {}, shared = false) {
  const path = shared ? 'client/src/components/FileAttachmentDialog.tsx' : 'client/src/pages/defects/DefectAttachmentDialog.tsx';
  const code = transformSync(readFileSync(path, 'utf8'), {
    loader: 'tsx', format: 'cjs', jsx: 'automatic',
    define: { 'import.meta.env.VITE_APP_ENV': '"replit"' },
  }).code;
  const module = { exports: {} as any };
  const primitive = (tag: string) => ({ children, ...props }: any) => React.createElement(tag, props, children);
  const require = (name: string): any => {
    if (name === 'react') return { ...React, useState: (initial: any) => [initial, vi.fn()],
      useRef: (value: any) => ({ current: value }), useEffect: () => {} };
    if (name === '@/components/ui/dialog') return {
      Dialog: ({ open, children }: any) => open ? children : null, DialogContent: primitive('section'),
      DialogTitle: primitive('h2'), DialogHeader: primitive('header'), DialogDescription: primitive('p'), DialogFooter: primitive('footer'),
    };
    if (name === '@/components/ui/button') return { Button: ({ children, variant, size, ...props }: any) => React.createElement('button', props, children) };
    if (name === '@/hooks/use-toast') return { useToast: () => ({ toast: vi.fn() }) };
    if (name === '@/lib/authToken') return { getAccessToken: () => null };
    if (name === '@shared/defectAttachments') return attachmentTypes;
    if (name === '@/components/FileAttachmentDialog') throw new Error('Defects must not delegate to inline upload');
    return nativeRequire(name);
  };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  const props = { open: true, onOpenChange: vi.fn(), attachments: [], onAttachmentsChange: vi.fn(),
    section, externalStorage: false, title: 'Attachments', vesselUuid: 'fixture-vessel',
    sessionId: 'fixture-session', defectId: 'fixture-defect', ...overrides };
  const tree = shared ? module.exports.FileAttachmentDialog(props) : module.exports.DefectAttachmentDialog(props);
  return { tree, props, html: renderToStaticMarkup(tree) };
}
function elements(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(elements)];
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('private upload presentation with legacy read compatibility', () => {
  it.each(['part-a', 'part-b', 'part-c1'])('%s always stages multipart, even without a counterpart', async section => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...external, stagedRef: 'receipt' }) });
    const reader = vi.fn(() => { throw new Error('No new inline attachments'); });
    vi.stubGlobal('fetch', fetch); vi.stubGlobal('FileReader', reader);
    const { tree, props, html } = render(section);
    expect(html).toContain('type="file"');
    expect(html).toMatch(/Changes are committed when you save/);
    const event = { target: { files: [new File(['%PDF-1.4'], 'proof.pdf', { type: 'application/pdf' })], value: 'chosen' } };
    elements(tree).find(el => el.type === 'input').props.onChange(event);
    await vi.waitFor(() => expect(props.onAttachmentsChange).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(`/technical/api/defects/fixture-defect/file-staging/${section}`,
      expect.objectContaining({ method: 'POST', body: expect.any(FormData), credentials: 'include' }));
    const body = fetch.mock.calls[0][1].body;
    expect(body.get('sessionId')).toBe('fixture-session');
    expect(body.get('vesselUuid')).toBe('fixture-vessel');
    expect(props.onAttachmentsChange.mock.calls[0][0][0]).toMatchObject({ storageVersion: 1, stagedRef: 'receipt' });
    expect(props.onAttachmentsChange.mock.calls[0][0][0]).not.toHaveProperty('data');
    expect(reader).not.toHaveBeenCalled();
    expect(event.target.value).toBe('');
  });
  it.each(['part-a', 'part-b', 'part-c1'])('%s keeps old inline attachments viewable and downloadable', async section => {
    const blob = new Blob(['legacy'], { type: 'application/pdf' });
    const fetch = vi.fn().mockResolvedValue({ blob: async () => blob });
    const open = vi.fn(), click = vi.fn(), link: any = {};
    link.click = click;
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', { open });
    vi.stubGlobal('document', { createElement: vi.fn(() => link) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
    // Capture revocation scheduling without retaining a real 60-second timer.
    const timeout = vi.spyOn(globalThis, 'setTimeout').mockImplementation((() => 0) as any);
    const { tree, html } = render(section, { attachments: [inline], readOnly: true });
    expect(html).not.toContain('type="file"');
    const actions = elements(tree).filter(el => el.props?.onClick);
    const action = (verb: string) => actions.find(el => el.props['aria-label'] === `${verb} ${inline.name}` || el.props.children === verb);
    await action('View').props.onClick();
    // Event handlers intentionally discard the promise; drain only microtasks.
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(open).toHaveBeenCalledWith('blob:fixture', '_blank', 'noopener,noreferrer');
    action('Download').props.onClick();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith(inline.data);
    expect(link.download).toBe(inline.name); expect(click).toHaveBeenCalledOnce();
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 60_000);
  });
  it.each(['part-a', 'part-b', 'part-c1'])('%s distinguishes staged from saved and Done never commits', section => {
    expect(render(section, { attachments: [{ ...external, stagedRef: 'receipt' }] }).html).toContain('Staged — not saved');
    expect(render(section, { attachments: [external] }).html).not.toContain('Staged — not saved');
    const { tree, props } = render(section, { attachments: [external] });
    elements(tree).find(el => el.props?.children === 'Done').props.onClick();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onAttachmentsChange).not.toHaveBeenCalled();
  });
  it.each(['part-a', 'part-b', 'part-c1'])('%s reads private saved and staged files through the existing section/session URLs', async section => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['fixture']) });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', { open: vi.fn() });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((() => 0) as any);
    for (const staged of [false, true]) {
      const file = staged ? { ...external, stagedRef: 'receipt' } : external;
      const { tree } = render(section, { attachments: [file], readOnly: true });
      elements(tree).find(el => el.props?.['aria-label'] === `View ${external.name}`).props.onClick();
      for (let i = 0; i < 8; i++) await Promise.resolve();
      expect(fetch).toHaveBeenLastCalledWith(staged
        ? '/technical/api/defects/file-staging/receipt?sessionId=fixture-session&backend=local'
        : `/technical/api/defects/fixture-defect/files/${section}/file`,
      expect.objectContaining({ credentials: 'include', headers: expect.any(Object) }));
    }
  });
  it.each(['part-a', 'part-b', 'part-c1'])('%s uses draft staging before the first Defect save and retains existing entries after upload failure', async section => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'fixture refusal' }) });
    vi.stubGlobal('fetch', fetch);
    const { tree, props } = render(section, { defectId: undefined, attachments: [inline] });
    elements(tree).find(el => el.type === 'input').props.onChange({
      target: { files: [new File(['%PDF-1.4'], 'proof.pdf', { type: 'application/pdf' })], value: '' },
    });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith(`/technical/api/defects/file-staging/${section}`, expect.any(Object));
    expect(props.onAttachmentsChange).not.toHaveBeenCalled();
    expect(props.attachments).toEqual([inline]);
  });
  it.each(['CertificatesPage', 'SurveysPage'])('%s retains its shared inline dialog without performing uploads or network', page => {
    const source = readFileSync(`client/src/pages/cert-surveys/${page}.tsx`, 'utf8');
    expect(source).toContain('import { FileAttachmentDialog');
    expect(source).toContain('<FileAttachmentDialog');
    const network = vi.fn(() => { throw new Error('Network prohibited'); });
    vi.stubGlobal('fetch', network);
    const { tree, props, html } = render('unused', { attachments: [inline] }, true);
    expect(html).toContain('data-testid="input-file-attachment"');
    expect(html).toContain('old.pdf');
    elements(tree).find(el => el.props?.['data-testid'] === 'button-close-attachment-dialog').props.onClick();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(network).not.toHaveBeenCalled(); expect(props.onAttachmentsChange).not.toHaveBeenCalled();
  });
});
