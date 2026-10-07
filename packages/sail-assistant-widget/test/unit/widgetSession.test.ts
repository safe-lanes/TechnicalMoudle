import { describe, expect, it, vi } from 'vitest';
import { MSG_NOT_ALLOWED, MSG_SESSION, MSG_UNAVAILABLE, WidgetSession, DEFAULT_SESSION_OPTIONS } from '../../src/widgetSession';
import { AssistantTransport, type TokenRequest } from '../../src/widgetTransport';

/** A token the widget can read `exp` from (signature is fake — the widget never verifies, the assistant does). */
function tok(n: number, ttl = 60): string {
  const body = Buffer.from(JSON.stringify({ userId: 'u', role: 'r', iat: 0, exp: Math.floor(Date.now() / 1000) + ttl, n }))
    .toString('base64url');
  return `${body}.sig${n}`;
}

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
/** Resolve-on-demand fetch, so tests control ordering (late responses). Honors AbortSignal like real fetch. */
function controllableFetch() {
  const calls: Array<{ url: string; init: RequestInit; resolve: (r: Response) => void }> = [];
  const fetchImpl = (url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    const sig = init.signal as AbortSignal | undefined;
    sig?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    calls.push({ url, init, resolve });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}
function immediateFetch(h: Handler) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return h(url, init);
  };
  return { calls, fetchImpl: f as unknown as typeof fetch };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

function make(fetchImpl: typeof fetch, opts: Partial<typeof DEFAULT_SESSION_OPTIONS> = {}, getToken?: (r: TokenRequest) => Promise<string>) {
  let n = 0;
  const tokenCalls: TokenRequest[] = [];
  const provider = getToken ?? (async (r: TokenRequest) => { tokenCalls.push(r); return tok(++n); });
  const t = new AssistantTransport('https://assistant.example', provider, fetchImpl);
  const s = new WidgetSession(t, { module: 'crewing', userKey: 'u1', tenantKey: 'acme' }, { ...DEFAULT_SESSION_OPTIONS, ...opts });
  return { s, tokenCalls };
}

describe('chat', () => {
  it('sends module, optional vessel and bounded history; shows the answer with citations', async () => {
    const { calls, fetchImpl } = immediateFetch((url, init) => {
      const b = JSON.parse(String(init.body));
      return json({ response: `echo ${b.message}`, gate: 'answer', citations: [{ manual: 'Crewing manual', section: '1.2' }] });
    });
    const { s } = make(fetchImpl, { historyMessages: 4, suggestions: false });
    for (let i = 1; i <= 4; i++) await s.send(`q${i}`);
    const last = JSON.parse(String(calls[calls.length - 1].init.body));
    expect(last.context).toEqual({ module: 'crewing' }); // no vessel keys when the module has no vessel
    expect(last.conversationHistory).toHaveLength(4);
    expect(last.conversationHistory[0]).toEqual({ role: 'user', content: 'q2' });
    expect((calls[0].init.headers as Record<string, string>)['x-assistant-identity']).toMatch(/\.sig1$/);
    const msgs = s.getState().messages;
    expect(msgs.at(-1)).toMatchObject({ role: 'assistant', content: 'echo q4', citations: [{ manual: 'Crewing manual' }] });
  });

  it('includes vessel context only when given', async () => {
    const { calls, fetchImpl } = immediateFetch(() => json({ response: 'ok' }));
    const { s } = make(fetchImpl, { suggestions: false });
    s.updateContext({ vesselId: 'v9', vesselName: 'MV Test' });
    await s.send('hi');
    expect(JSON.parse(String(calls[0].init.body)).context).toEqual({ module: 'crewing', vesselId: 'v9', vesselName: 'MV Test' });
  });

  it('keeps at most maxMessages on screen', async () => {
    const { fetchImpl } = immediateFetch(() => json({ response: 'a' }));
    const { s } = make(fetchImpl, { maxMessages: 6, suggestions: false });
    for (let i = 0; i < 10; i++) await s.send(`q${i}`);
    expect(s.getState().messages).toHaveLength(6);
    expect(s.getState().messages.at(-2)?.content).toBe('q9');
  });

  it('ignores a second question while one is pending', async () => {
    const { calls, fetchImpl } = controllableFetch();
    const { s } = make(fetchImpl, { suggestions: false });
    const p = s.send('one');
    await flush();
    await s.send('two');
    expect(calls).toHaveLength(1);
    calls[0].resolve(json({ response: 'ans' }));
    await p;
    expect(s.getState().messages.map((m) => m.content)).toEqual(['one', 'ans']);
  });
});

describe('context changes', () => {
  for (const [label, patch] of [
    ['vessel', { vesselId: 'v2' }], ['user', { userKey: 'u2' }], ['tenant', { tenantKey: 'other' }], ['module', { module: 'audit' }],
  ] as const) {
    it(`${label} change clears history, aborts the request and discards the late answer`, async () => {
      const { calls, fetchImpl } = controllableFetch();
      const { s } = make(fetchImpl, { suggestions: false });
      s.updateContext({ vesselId: 'v1' });
      const p = s.send('old question');
      await flush();
      expect(s.getState().pending).toBe(true);
      const signal = calls[0].init.signal as AbortSignal;
      s.updateContext(patch as never);
      expect(signal.aborted).toBe(true);
      expect(s.getState().messages).toEqual([]);
      expect(s.getState().pending).toBe(false);
      calls[0].resolve(json({ response: 'LATE answer for the old context' }));
      await p;
      await flush();
      expect(s.getState().messages).toEqual([]);
    });
  }

  it('a late answer that resolves AFTER a reset (no abort honoured) is still discarded', async () => {
    let release!: (r: Response) => void;
    const fetchImpl = (() => new Promise<Response>((res) => { release = res; })) as unknown as typeof fetch; // ignores abort
    const { s } = make(fetchImpl, { suggestions: false });
    const p = s.send('q');
    await flush();
    s.updateContext({ vesselId: 'other' });
    release(json({ response: 'stale' }));
    await p;
    expect(s.getState().messages).toEqual([]);
  });

  it('vesselName or page change alone keeps the conversation', async () => {
    const { fetchImpl } = immediateFetch(() => json({ response: 'a' }));
    const { s } = make(fetchImpl, { suggestions: false });
    s.updateContext({ vesselId: 'v1', vesselName: 'A' });
    await s.send('q');
    s.updateContext({ vesselName: 'A renamed', currentPage: '/crew/list' });
    expect(s.getState().messages).toHaveLength(2);
  });

  it('sign-out (userKey null) clears, closes, hides and never asks for a token', async () => {
    const { fetchImpl, calls } = immediateFetch(() => json({ response: 'a' }));
    const { s, tokenCalls } = make(fetchImpl, { suggestions: false });
    s.setOpen(true);
    await s.send('q');
    const before = tokenCalls.length;
    s.updateContext({ userKey: null });
    expect(s.getState()).toMatchObject({ signedIn: false, open: false, messages: [] });
    await s.send('after logout');
    s.setOpen(true);
    expect(s.getState().open).toBe(false);
    expect(tokenCalls.length).toBe(before);
    expect(calls).toHaveLength(1);
  });

  it('the cached token is dropped on user change (a new token is minted for the new user)', async () => {
    const { calls, fetchImpl } = immediateFetch(() => json({ response: 'a' }));
    const { s, tokenCalls } = make(fetchImpl, { suggestions: false });
    await s.send('q1');
    await s.send('q2');
    expect(tokenCalls).toHaveLength(1); // reused while fresh
    s.updateContext({ userKey: 'u2' });
    await s.send('q3');
    expect(tokenCalls).toHaveLength(2);
    expect((calls[2].init.headers as Record<string, string>)['x-assistant-identity']).toMatch(/\.sig2$/);
  });
});

describe('expired / rejected token — bounded retry', () => {
  it('401 → exactly one forced refresh → retry succeeds', async () => {
    let n = 0;
    const { calls, fetchImpl } = immediateFetch(() => (++n === 1 ? json({ error: 'identity rejected: expired' }, 401) : json({ response: 'ok' })));
    const { s, tokenCalls } = make(fetchImpl, { suggestions: false });
    await s.send('q');
    expect(calls).toHaveLength(2);
    expect(tokenCalls.map((t) => t.forceRefresh)).toEqual([false, true]);
    expect(s.getState().messages.at(-1)?.content).toBe('ok');
  });

  it('401 twice → stops (no loop) and asks the user to sign in again', async () => {
    const { calls, fetchImpl } = immediateFetch(() => json({ error: 'identity rejected: bad-signature' }, 401));
    const { s, tokenCalls } = make(fetchImpl, { suggestions: false });
    await s.send('q');
    expect(calls).toHaveLength(2);
    expect(tokenCalls).toHaveLength(2);
    expect(s.getState().messages.at(-1)).toMatchObject({ content: MSG_SESSION, error: 'session' });
    expect(s.getState().retryable).toBeNull();
  });

  it('token provider refusal (e.g. role not allowed, ship) → "not available", assistant never called', async () => {
    const { calls, fetchImpl } = immediateFetch(() => json({ response: 'x' }));
    const { s } = make(fetchImpl, { suggestions: false }, async () => { throw new Error('HTTP 403'); });
    await s.send('q');
    expect(calls).toHaveLength(0);
    expect(s.getState().messages.at(-1)).toMatchObject({ content: MSG_NOT_ALLOWED, error: 'not-allowed' });
  });

  it('a nearly expired cached token is not reused', async () => {
    const { fetchImpl } = immediateFetch(() => json({ response: 'ok' }));
    let n = 0;
    const tokenCalls: number[] = [];
    const { s } = make(fetchImpl, { suggestions: false }, async () => { tokenCalls.push(++n); return tok(n, 10); });
    await s.send('a');
    await s.send('b');
    expect(tokenCalls).toEqual([1, 2]);
  });

  it('assistant 5xx → unavailable with "Try again"; retry re-asks the same question once', async () => {
    let n = 0;
    const { calls, fetchImpl } = immediateFetch(() => (++n === 1 ? json({}, 503) : json({ response: 'back' })));
    const { s } = make(fetchImpl, { suggestions: false });
    await s.send('q');
    expect(s.getState().messages.at(-1)).toMatchObject({ content: MSG_UNAVAILABLE, error: 'unavailable' });
    expect(s.getState().retryable).toBe('q');
    s.retry();
    await flush();
    await flush();
    expect(calls).toHaveLength(2);
    expect(s.getState().messages.map((m) => m.content)).toEqual(['q', 'back']);
  });

  it('error bubbles are never sent back as history', async () => {
    let n = 0;
    const { calls, fetchImpl } = immediateFetch(() => (++n === 1 ? json({}, 500) : json({ response: 'fine' })));
    const { s } = make(fetchImpl, { suggestions: false });
    await s.send('first');
    await s.send('second');
    const hist = JSON.parse(String(calls[1].init.body)).conversationHistory;
    expect(hist).toEqual([{ role: 'user', content: 'first' }]);
  });
});

describe('suggestions', () => {
  it('load on first open for the configured module; refresh on module change; [] hides', async () => {
    const { calls, fetchImpl } = immediateFetch((url) => {
      const m = new URL(url).searchParams.get('module');
      return json({ module: m, questions: m === 'crewing' ? ['How do I create a new crew record?'] : [] });
    });
    const { s } = make(fetchImpl);
    expect(calls).toHaveLength(0); // nothing fetched until the user opens the panel
    s.setOpen(true);
    await flush(); await flush();
    expect(s.getState().suggestions).toEqual(['How do I create a new crew record?']);
    s.updateContext({ module: 'audit' });
    await flush(); await flush();
    expect(calls.map((c) => new URL(c.url).searchParams.get('module'))).toEqual(['crewing', 'audit']);
    expect(s.getState().suggestions).toEqual([]);
  });

  it('a response for another module is ignored (never shows Technical questions in Crewing)', async () => {
    const { fetchImpl } = immediateFetch(() => json({ module: 'technical', questions: ['How do I complete a work order?'] }));
    const { s } = make(fetchImpl);
    s.setOpen(true);
    await flush(); await flush();
    expect(s.getState().suggestions).toEqual([]);
  });

  it('failure hides suggestions (no generic fallback)', async () => {
    const { fetchImpl } = immediateFetch(() => json({}, 500));
    const { s } = make(fetchImpl);
    s.setOpen(true);
    await flush(); await flush();
    expect(s.getState().suggestions).toEqual([]);
  });

  it('suggestions: false never calls the endpoint', async () => {
    const { calls, fetchImpl } = immediateFetch(() => json({ module: 'crewing', questions: ['x?'] }));
    const { s } = make(fetchImpl, { suggestions: false });
    s.setOpen(true);
    await flush();
    expect(calls).toHaveLength(0);
    expect(s.getState().suggestions).toEqual([]);
  });

  it('module change while a suggestions request is in flight aborts it and the old answer never shows', async () => {
    const { calls, fetchImpl } = controllableFetch();
    const { s } = make(fetchImpl);
    s.setOpen(true);
    await flush();
    s.updateContext({ module: 'safety' });
    await flush();
    expect((calls[0].init.signal as AbortSignal).aborted).toBe(true);
    calls[1].resolve(json({ module: 'safety', questions: ['How do I create a new MOC?'] }));
    await flush(); await flush();
    expect(s.getState().suggestions).toEqual(['How do I create a new MOC?']);
  });
});

describe('suggestions — late answers', () => {
  it('an old module\'s suggestions arriving after the new module\'s (abort not honoured) never replace them', async () => {
    const pending: Array<{ url: string; resolve: (r: Response) => void }> = [];
    const fetchImpl = ((url: string) => new Promise<Response>((resolve) => { pending.push({ url, resolve }); })) as unknown as typeof fetch;
    const { s } = make(fetchImpl);
    s.setOpen(true);
    await flush();
    s.updateContext({ module: 'safety' });
    await flush();
    pending[1].resolve(json({ module: 'safety', questions: ['How do I create a new MOC?'] }));
    await flush(); await flush();
    pending[0].resolve(json({ module: 'crewing', questions: ['How do I create a new crew record?'] }));
    await flush(); await flush();
    expect(s.getState().suggestions).toEqual(['How do I create a new MOC?']);
  });
});

describe('destroy', () => {
  it('aborts in-flight work, drops late answers and stops notifying', async () => {
    const { calls, fetchImpl } = controllableFetch();
    const { s } = make(fetchImpl, { suggestions: false });
    const listener = vi.fn();
    s.subscribe(listener);
    const p = s.send('q');
    await flush();
    listener.mockClear();
    s.destroy();
    expect((calls[0].init.signal as AbortSignal).aborted).toBe(true);
    await p;
    await s.send('after');
    expect(listener).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });
});
