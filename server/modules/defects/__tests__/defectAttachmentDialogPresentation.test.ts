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
function renderDialog(overrides: Record<string, any> = {}, state = { busy: false, error: '' }) {
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

describe.each([
  {
    section: 'part-a', title: 'Part A Attachments - Defect Photos',
    description: 'Defect photos and attachments.', picker: 'defect photos and attachments',
    empty: 'No defect photos or attachments yet', hint: 'Upload photos or attachments to document the defect.',
  },
  {
    section: 'part-b', title: 'Part B - Rectification Documentation',
    description: 'Rectification documentation.', picker: 'rectification documents',
    empty: 'No rectification documents yet', hint: 'Upload documentation to support defect rectification.',
  },
  {
    section: 'part-c1', title: 'Part C1 - Closure documents',
    description: 'Closure documents and evidence.', picker: 'closure documents',
    empty: 'No closure documents yet', hint: 'Upload evidence to support defect closure.',
  },
])('$section uses the compact presentation without changing attachment operations', copy => {
  const render = (overrides: Record<string, any> = {}, state = { busy: false, error: '' }) =>
    renderDialog({ section: copy.section, title: copy.title, ...overrides }, state);
  it('renders the compact popup, hidden multiple-file input, upload area and empty footer', () => {
    const { html } = render();
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.description);
    expect(html).toContain(`aria-label="Choose ${copy.picker}"`);
    expect(html).toContain(`aria-label="Click to upload ${copy.picker}"`);
    expect(html).toContain(copy.hint);
    expect(html).toContain('Changes are committed when you save the defect form.');
    expect(html).toContain('max-w-[500px]');
    expect(html).toContain('w-[calc(100%-2rem)]');
    expect(html).toContain('max-h-[calc(100dvh-2rem)]');
    expect(html).toContain('border-dashed');
    expect(html).toContain('Click to upload files');
    expect(html).toContain('PDF, JPG, PNG (max 5MB)');
    expect(html).toMatch(/<input[^>]*multiple=""[^>]*class="hidden"/);
    expect(html).toContain(copy.empty);
    expect(html).toContain('0 files attached');
    expect(html).toContain('justify-between');
    if (copy.section !== 'part-c1') expect(html).not.toMatch(/closure/i);
    expect(html).not.toContain('max-w-2xl');
    expect(html).not.toContain('data-legacy-dialog');
  });
  it('shows bounded cards, formatted size, full filenames and accessible icon actions', () => {
    const { html } = render({ attachments: [external] });
    expect(html).toContain('h-[200px]');
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('truncate');
    expect(html).toContain('grid-cols-[auto_minmax(0,1fr)_auto]');
    expect(html).toContain('overflow-x-hidden');
    expect(html).toContain('lucide-file-text');
    expect(html).toContain('lucide-eye');
    expect(html).toContain('lucide-download');
    expect(html).toContain('lucide-trash');
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
    expect(html).toContain('lucide-image');
    expect(html).toContain('40 B');
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('aria-label="Remove');
  });
  it('keeps the empty read-only state section-specific with no upload invitation', () => {
    const { html } = render({ readOnly: true });
    expect(html).toContain(copy.empty);
    expect(html).toContain('0 files attached');
    expect(html).not.toContain(copy.hint);
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('Click to upload');
  });
  it('keeps many large files inside the same bounded list', () => {
    const { html } = render({ attachments: Array.from({ length: 30 }, (_, index) => ({
      ...external, id: `fixture-${index}`, size: 5 * 1024 * 1024,
    })) });
    expect(html).toContain('30 files attached');
    expect(html).toContain('5.0 MB');
    expect(html.match(/grid-cols-\[auto_minmax\(0,1fr\)_auto\]/g)).toHaveLength(30);
    expect(html).toContain('h-[200px]');
  });
  it('keeps upload feedback and errors visible while preventing Done and removal during upload', () => {
    const { tree, html, props } = render({ attachments: [external] }, { busy: true, error: 'Upload failed. Please retry.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Upload failed. Please retry.');
    expect(html).toContain('Uploading…');
    expect(html).toContain(`aria-label="Uploading ${copy.picker}"`);
    expect(elements(tree).find(el => el.type === 'input').props.disabled).toBe(true);
    const buttons = elements(tree).filter(el => el.props?.onClick);
    expect(buttons.find(el => el.props['aria-label'] === `Uploading ${copy.picker}`).props.disabled).toBe(true);
    expect(buttons.find(el => el.props['aria-label'] === `Remove ${external.name}`).props.disabled).toBe(true);
    expect(buttons.find(el => el.props.children === 'Uploading…').props.disabled).toBe(true);
    tree.props.onOpenChange(false);
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it('keeps Done as close-only and removes only the selected section item', () => {
    const otherSection = [{ ...external, id: 'untouched-section' }];
    const otherDialog = renderDialog({
      section: copy.section === 'part-a' ? 'part-b' : 'part-a',
      attachments: otherSection,
    });
    const { tree, props } = render({ attachments: [external, { ...external, id: 'other', name: 'other.pdf' }] });
    elements(tree).find(el => el.props?.['aria-label'] === `Remove ${external.name}`).props.onClick();
    expect(props.onAttachmentsChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'other' })]);
    elements(tree).find(el => el.props?.children === 'Done').props.onClick();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onAttachmentsChange).toHaveBeenCalledOnce();
    expect(otherSection).toEqual([expect.objectContaining({ id: 'untouched-section' })]);
    expect(otherDialog.props.onAttachmentsChange).not.toHaveBeenCalled();
  });
  it('uses the compact private upload presentation even without counterpart readiness', () => {
    expect(render({ attachments: [external] }).html).toContain('max-w-[500px]');
    expect(render({ externalStorage: false }).html).not.toContain('data-legacy-dialog');
    expect(render({ externalStorage: false }).html).toContain('type="file"');
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
    elements(tree).find(el => el.props?.['aria-label'] === `Click to upload ${copy.picker}`).props.onClick();
    expect(click).toHaveBeenCalledOnce();
    const file = new File(['%PDF-1.4\n'], 'closure.pdf', { type: 'application/pdf' });
    input.props.onChange({ target: { files: [file], value: 'selected' } });
    await vi.waitFor(() => expect(props.onAttachmentsChange).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(`/technical/api/defects/test-defect/file-staging/${copy.section}`, expect.objectContaining({
      method: 'POST', body: expect.any(FormData), credentials: 'include',
    }));
    const form = fetch.mock.calls[0][1].body;
    expect(form.get('vesselUuid')).toBe('test-vessel');
    expect(form.get('sessionId')).toBe('test-session');
    expect(props.onAttachmentsChange.mock.calls[0][0][0]).toMatchObject({ storageVersion: 1, stagedRef: 'owned-receipt' });
    expect(reader).not.toHaveBeenCalled();
  });
});
