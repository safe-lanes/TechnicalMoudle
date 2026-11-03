import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as attachmentTypes from '@shared/defectAttachments';

// Compile this frontend component locally without changing the server-oriented
// Vitest JSX configuration or mounting Radix portals in a real browser.
const code = transformSync(readFileSync('client/src/pages/defects/DefectAttachmentDialog.tsx', 'utf8'), {
  loader: 'tsx', format: 'cjs', jsx: 'automatic',
  define: { 'import.meta.env.VITE_APP_ENV': '"replit"' },
}).code;
const nativeRequire = createRequire(import.meta.url);
const external = {
  storageVersion: 1 as const, id: 'c1-file', name: `${'long-closure-document-'.repeat(8)}.pdf`,
  type: 'application/pdf', size: 1536, uploadedAt: '2026-11-03',
  fileKey: 'vessel/defect/part-c1/file.pdf', backend: 'local' as const,
  sha256: 'fixture-hash', uploadedByUuid: 'test-user',
};
function render(overrides: Record<string, any> = {}, state = { busy: false, error: '' }) {
  let stateIndex = 0;
  const states = [state.busy, state.error];
  const refs: any[] = [];
  const primitive = (tag: string) => ({ children, ...props }: any) => React.createElement(tag, props, children);
  const module = { exports: {} as any };
  const require = (name: string): any => {
    if (name === 'react') return { ...React, useState: () => [states[stateIndex++], vi.fn()], useRef: (value: any) => {
      const ref = { current: value }; refs.push(ref); return ref;
    } };
    if (name === '@/components/ui/dialog') return {
      Dialog: ({ children, open }: any) => open ? children : null,
      DialogContent: primitive('section'), DialogHeader: primitive('header'),
      DialogTitle: primitive('h2'), DialogDescription: primitive('p'),
    };
    if (name === '@/components/ui/button') return { Button: ({ children, variant, size, ...props }: any) => React.createElement('button', props, children) };
    if (name === '@/components/FileAttachmentDialog') return { FileAttachmentDialog: () => React.createElement('div', { 'data-legacy-dialog': true }) };
    if (name === '@/lib/authToken') return { getAccessToken: () => null };
    if (name === '@shared/defectAttachments') return attachmentTypes;
    return nativeRequire(name);
  };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  const props = { open: true, onOpenChange: vi.fn(), attachments: [], onAttachmentsChange: vi.fn(),
    title: 'Part C1 - Closure documents', externalStorage: true, section: 'part-c1',
    vesselUuid: 'test-vessel', sessionId: 'test-session', defectId: 'test-defect', user: { userUuid: 'test-user' },
    ...overrides };
  const tree = module.exports.DefectAttachmentDialog(props);
  return { tree, props, refs, html: renderToStaticMarkup(tree) };
}
function elements(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(elements)];
}
afterEach(() => vi.unstubAllGlobals());

describe('C1 presentation matches Part B without changing attachment operations', () => {
  it('renders the compact popup, hidden multiple-file input, upload area and empty footer', () => {
    const { html } = render();
    expect(html).toContain('max-w-[500px]');
    expect(html).toContain('w-[calc(100%-2rem)]');
    expect(html).toContain('max-h-[calc(100dvh-2rem)]');
    expect(html).toContain('border-dashed');
    expect(html).toContain('Click to upload files');
    expect(html).toContain('PDF, JPG, PNG (max 5MB)');
    expect(html).toMatch(/<input[^>]*multiple=""[^>]*class="hidden"/);
    expect(html).toContain('No closure documents yet');
    expect(html).toContain('0 files attached');
    expect(html).toContain('justify-between');
    expect(html).not.toContain('Rectification');
    expect(html).not.toContain('data-legacy-dialog');
  });
  it('shows bounded cards, formatted size, full filenames and accessible icon actions', () => {
    const { html } = render({ attachments: [external] });
    expect(html).toContain('h-[200px]');
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('truncate');
    expect(html).toContain(`title="${external.name}"`);
    expect(html).toContain('1.5 KB');
    for (const verb of ['View', 'Download', 'Remove']) expect(html).toContain(`aria-label="${verb} ${external.name}"`);
    expect(html).toContain('1 file attached');
    expect(html).not.toContain('Staged — not saved');
  });
  it('distinguishes staged files and preserves read-only access to saved and legacy files', () => {
    const staged = render({ attachments: [{ ...external, stagedRef: 'owned-receipt' }] }).html;
    expect(staged).toContain('Staged — not saved');
    const { html } = render({ readOnly: true, attachments: [external, {
      id: 'legacy', name: 'old.png', size: 40, type: 'image/png', data: 'data:image/png;base64,AA==',
    }] });
    expect(html).toContain('2 files attached');
    expect(html).toContain('aria-label="View old.png"');
    expect(html).toContain('aria-label="Download old.png"');
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('aria-label="Remove');
  });
  it('keeps upload feedback and errors visible while preventing Done and removal during upload', () => {
    const { tree, html } = render({ attachments: [external] }, { busy: true, error: 'Upload failed. Please retry.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Upload failed. Please retry.');
    expect(html).toContain('Uploading…');
    const buttons = elements(tree).filter(el => el.props?.onClick);
    expect(buttons.find(el => el.props['aria-label'] === `Remove ${external.name}`).props.disabled).toBe(true);
    expect(buttons.find(el => el.props.children === 'Uploading…').props.disabled).toBe(true);
  });
  it('keeps Done as close-only and removes only the selected C1 item', () => {
    const { tree, props } = render({ attachments: [external, { ...external, id: 'other', name: 'other.pdf' }] });
    elements(tree).find(el => el.props?.['aria-label'] === `Remove ${external.name}`).props.onClick();
    expect(props.onAttachmentsChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'other' })]);
    elements(tree).find(el => el.props?.children === 'Done').props.onClick();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
  it.each(['part-a', 'part-b'])('leaves %s external and inline presentation unchanged', section => {
    expect(render({ section, attachments: [external] }).html).toContain('max-w-2xl');
    expect(render({ section, externalStorage: false }).html).toContain('data-legacy-dialog');
  });
  it('wires the hidden picker to the existing multipart staging handler, never FileReader', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...external, stagedRef: 'owned-receipt' }) });
    const reader = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('FileReader', reader);
    const { tree, props, refs } = render();
    const input = elements(tree).find(el => el.type === 'input');
    const click = vi.fn();
    refs[0].current = { click };
    elements(tree).find(el => el.props?.['aria-label'] === 'Click to upload closure documents').props.onClick();
    expect(click).toHaveBeenCalledOnce();
    const file = new File(['%PDF-1.4\n'], 'closure.pdf', { type: 'application/pdf' });
    input.props.onChange({ target: { files: [file], value: 'selected' } });
    await vi.waitFor(() => expect(props.onAttachmentsChange).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith('/technical/api/defects/test-defect/file-staging/part-c1', expect.objectContaining({
      method: 'POST', body: expect.any(FormData), credentials: 'include',
    }));
    const form = fetch.mock.calls[0][1].body;
    expect(form.get('vesselUuid')).toBe('test-vessel');
    expect(form.get('sessionId')).toBe('test-session');
    expect(props.onAttachmentsChange.mock.calls[0][0][0]).toMatchObject({ storageVersion: 1, stagedRef: 'owned-receipt' });
    expect(reader).not.toHaveBeenCalled();
  });
});
