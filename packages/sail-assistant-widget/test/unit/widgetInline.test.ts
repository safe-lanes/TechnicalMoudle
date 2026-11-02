// Public API (init / handle) in INLINE mode (1.0.2) and, as the regression guard, in the default floating mode.
// Mounted into jsdom (see jsdomGlobals.ts) with a stubbed global fetch standing in for the central assistant.
import './jsdomGlobals';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { init, VERSION, type WidgetConfig, type WidgetHandle } from '../../src/widgetApi';

/** A token the widget can read `exp` from (never verified by the widget). */
function tok(): string {
  const body = btoa(JSON.stringify({ userId: 'u', exp: Math.floor(Date.now() / 1000) + 60 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${body}.sig`;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const SUGGESTIONS: Record<string, string[]> = { crewing: ['How do I create a new crew record?'], audit: ['How do I create a new preparation?'] };

let calls: Array<{ url: string; body?: unknown }>;
function stubFetch() {
  calls = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    if (u.pathname === '/suggestions') {
      const m = u.searchParams.get('module') ?? '';
      return json({ module: m, questions: SUGGESTIONS[m] ?? [] });
    }
    if (u.pathname === '/chat') return json({ response: `MOCK answer to "${body.message}"`, citations: [] });
    return json({ error: 'not found' }, 404);
  });
}
const suggestionCalls = () => calls.filter((c) => c.url.includes('/suggestions')).map((c) => new URL(c.url).searchParams.get('module'));

function cfg(extra: Partial<WidgetConfig> = {}): WidgetConfig {
  return { assistantUrl: 'https://assistant.example', module: 'crewing', getToken: async () => tok(), context: { userKey: 'u1', tenantKey: 'acme' }, ...extra };
}
/** Let pending fetches resolve and React commit the result. */
const settle = () => act(async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); });
const mount = async (c: WidgetConfig) => { let h!: WidgetHandle; await act(async () => { h = init(c); }); return h; };

const host = () => document.querySelector('[data-sail-assistant]') as HTMLElement | null;
const shadow = () => host()!.shadowRoot!;
const q = (sel: string) => shadow().querySelector(sel);
const qa = (sel: string) => shadow().querySelectorAll(sel);

let container: HTMLElement;
let handle: WidgetHandle | null;
beforeEach(() => {
  stubFetch();
  container = document.createElement('div');
  container.id = 'assistant-box';
  document.body.appendChild(container);
  handle = null;
});
afterEach(async () => {
  if (handle) await act(async () => handle!.destroy());
  container.remove();
  vi.unstubAllGlobals();
});

describe('inline mode', () => {
  it('needs a container and a known mode; refuses before touching the page', () => {
    expect(() => init(cfg({ mode: 'inline' }))).toThrow(/container/);
    expect(() => init(cfg({ mode: 'inline', container: 'box' as unknown as HTMLElement }))).toThrow(/container/);
    expect(() => init(cfg({ mode: 'popup' as unknown as 'inline' }))).toThrow(/mode/);
    expect(document.querySelectorAll('[data-sail-assistant]')).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('mounts into the container: open at once, no launcher, no close button, starter questions requested immediately', async () => {
    handle = await mount(cfg({ mode: 'inline', container }));
    const h = host()!;
    expect(h.parentElement).toBe(container);
    expect(h.getAttribute('data-mode')).toBe('inline');
    expect(h.getAttribute('data-sail-assistant')).toBe(VERSION);
    expect(q('.sa-panel')).not.toBeNull();
    expect(q('.sa-panel')!.getAttribute('role')).toBe('region'); // part of the page, not a dialog
    expect(q('.sa-launcher')).toBeNull();
    expect(q('[aria-label="Close assistant"]')).toBeNull();
    expect(q('[aria-label="Start a new chat"]')).not.toBeNull();
    expect(q('textarea')).not.toBeNull();
    expect(document.activeElement).toBe(document.body); // never steals the host page's focus
    expect(shadow().activeElement).toBeNull();
    await settle();
    expect(suggestionCalls()).toEqual(['crewing']);
    expect(Array.from(qa('.sa-chip')).map((b) => b.textContent)).toEqual(SUGGESTIONS.crewing);
  });

  it('open()/close() and Escape never hide the panel', async () => {
    handle = await mount(cfg({ mode: 'inline', container }));
    await act(async () => handle!.close());
    expect(q('.sa-panel')).not.toBeNull();
    await act(async () => { q('textarea')!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(q('.sa-panel')).not.toBeNull();
    await act(async () => handle!.open());
    expect(q('.sa-panel')).not.toBeNull();
    expect(qa('.sa-panel')).toHaveLength(1);
  });

  it('updateContext: a module change clears the conversation and keeps the panel open; sign-out empties the box; sign-in re-opens it', async () => {
    handle = await mount(cfg({ mode: 'inline', container }));
    await settle();
    await act(async () => (q('.sa-chip') as HTMLButtonElement).click());
    await settle();
    expect(Array.from(qa('.sa-msg.sa-bot:not([aria-label])')).map((m) => m.textContent)).toEqual([`MOCK answer to "${SUGGESTIONS.crewing[0]}"`]);

    await act(async () => handle!.updateContext({ module: 'audit' }));
    expect(q('.sa-panel')).not.toBeNull();
    expect(qa('.sa-msg')).toHaveLength(0);
    await settle();
    expect(suggestionCalls()).toEqual(['crewing', 'audit']);
    expect(Array.from(qa('.sa-chip')).map((b) => b.textContent)).toEqual(SUGGESTIONS.audit);

    await act(async () => handle!.updateContext({ userKey: null }));
    expect(host()!.parentElement).toBe(container); // still mounted, renders nothing
    expect(q('.sa-panel')).toBeNull();
    await settle();
    expect(suggestionCalls()).toEqual(['crewing', 'audit']); // signed out: nothing is requested

    await act(async () => handle!.updateContext({ userKey: 'u2' }));
    expect(q('.sa-panel')).not.toBeNull();
    expect(qa('.sa-msg')).toHaveLength(0);
    await settle();
    expect(suggestionCalls()).toEqual(['crewing', 'audit', 'audit']);
  });

  it('destroy() removes the host from the container; the handle is dead and safe to reuse', async () => {
    handle = await mount(cfg({ mode: 'inline', container }));
    await settle();
    const before = calls.length;
    await act(async () => handle!.destroy());
    expect(container.childElementCount).toBe(0);
    expect(document.querySelectorAll('[data-sail-assistant]')).toHaveLength(0);
    expect(() => { handle!.destroy(); handle!.updateContext({ module: 'audit' }); handle!.open(); handle!.close(); }).not.toThrow();
    await settle();
    expect(calls).toHaveLength(before);
    handle = null;
  });

  it('one widget per page: a later init() replaces an inline widget (and vice versa)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handle = await mount(cfg({ mode: 'inline', container }));
    handle = await mount(cfg()); // floating, default container
    expect(container.childElementCount).toBe(0);
    expect(document.querySelectorAll('[data-sail-assistant]')).toHaveLength(1);
    expect(host()!.parentElement).toBe(document.body);
    expect(host()!.getAttribute('data-mode')).toBe('floating');
    warn.mockRestore();
  });

  it('inline widget signed out from the start renders nothing until sign-in', async () => {
    handle = await mount(cfg({ mode: 'inline', container, context: { userKey: null } }));
    expect(host()!.parentElement).toBe(container);
    expect(q('.sa-panel')).toBeNull();
    await settle();
    expect(calls).toHaveLength(0);
    await act(async () => handle!.updateContext({ userKey: 'u1', tenantKey: 'acme' }));
    expect(q('.sa-panel')).not.toBeNull();
    await settle();
    expect(suggestionCalls()).toEqual(['crewing']);
  });
});

describe('floating mode (default) is unchanged', () => {
  for (const [label, extra] of [['default', {}], ["mode: 'floating'", { mode: 'floating' as const }]] as const) {
    it(`${label}: mounted in document.body, launcher only, panel closed until opened; nothing requested until then`, async () => {
      handle = await mount(cfg(extra));
      const h = host()!;
      expect(h.parentElement).toBe(document.body);
      expect(h.getAttribute('data-mode')).toBe('floating');
      expect(h.getAttribute('data-position')).toBe('bottom-right');
      expect(q('.sa-launcher')).not.toBeNull();
      expect(q('.sa-panel')).toBeNull();
      await settle();
      expect(calls).toHaveLength(0);

      await act(async () => handle!.open());
      expect(q('.sa-panel')).not.toBeNull();
      expect(q('.sa-panel')!.getAttribute('role')).toBe('dialog');
      expect(q('.sa-panel')!.getAttribute('aria-modal')).toBe('false');
      expect(q('[aria-label="Close assistant"]')).not.toBeNull();
      expect(shadow().activeElement).toBe(q('textarea')); // focus moves into the question box (document.activeElement is retargeted to the host)
      await settle();
      expect(suggestionCalls()).toEqual(['crewing']);

      await act(async () => handle!.close());
      expect(q('.sa-panel')).toBeNull();
      expect(q('.sa-launcher')).not.toBeNull();
      await act(async () => (q('.sa-launcher') as HTMLButtonElement).click());
      expect(q('.sa-panel')).not.toBeNull();
      await act(async () => { q('textarea')!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      expect(q('.sa-panel')).toBeNull();
    });
  }

  it('a container in floating mode only changes where the host element lives — still a launcher', async () => {
    handle = await mount(cfg({ container, position: 'bottom-left' }));
    expect(host()!.parentElement).toBe(container);
    expect(host()!.getAttribute('data-mode')).toBe('floating');
    expect(host()!.getAttribute('data-position')).toBe('bottom-left');
    expect(q('.sa-launcher')).not.toBeNull();
    expect(q('.sa-panel')).toBeNull();
  });
});
