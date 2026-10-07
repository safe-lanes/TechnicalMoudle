/**
 * Talks to the central assistant. The host supplies `getToken`, which calls the host module's OWN authenticated
 * backend to mint a short-lived signed identity; the widget only forwards that token in `x-assistant-identity`.
 * No signing key, service secret or trainer credential ever exists in the browser.
 *
 * Expired/invalid token: exactly ONE forced refresh and ONE retry per request, then a clear "sign in again" error —
 * never a loop.
 */

export interface TokenRequest {
  /** What the token is for — lets a host log or rate-limit; it must not change the identity. */
  reason: 'chat' | 'suggestions';
  /** true after the assistant rejected the previous token: the host must mint a fresh one, not return a cached value. */
  forceRefresh: boolean;
  signal: AbortSignal;
}

export type TokenProvider = (req: TokenRequest) => Promise<string>;

export interface Citation {
  module?: string;
  manual: string;
  section: string;
}

export interface ChatReply {
  response: string;
  gate?: string;
  module?: string | null;
  candidates?: string[];
  citations?: Citation[];
}

export interface ChatRequestBody {
  message: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: Record<string, string>;
  conversationId: string;
}

/** The host's token endpoint refused (not signed in, role not allowed, ship instance, …) or failed. */
export class TokenUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenUnavailableError';
  }
}

/** The assistant rejected a freshly minted token too — the user's session is no longer valid. */
export class IdentityRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityRejectedError';
  }
}

/** Network failure, timeout or a non-401 HTTP error from the assistant. */
export class AssistantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantUnavailableError';
  }
}

export const CHAT_TIMEOUT_MS = 45_000;
export const SUGGESTIONS_TIMEOUT_MS = 10_000;
const TOKEN_TIMEOUT_MS = 15_000;
/** A cached token is reused only while it has at least this long left (tokens live ~60 s). */
const TOKEN_REUSE_MARGIN_SEC = 20;

function isAbort(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError';
}

/** Unverified read of the token's `exp` — used ONLY to decide whether to reuse it; the assistant verifies it. */
export function tokenExpiry(token: string): number | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  try {
    const b64 = token.slice(0, dot).replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return typeof json?.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

/** Abort `parent` OR after `ms` — without AbortSignal.any (older browsers). Returns the signal and a disposer. */
function withTimeout(parent: AbortSignal, ms: number): { signal: AbortSignal; done: () => void } {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (parent.aborted) ctl.abort();
  else parent.addEventListener('abort', onAbort, { once: true });
  const t = setTimeout(() => ctl.abort(), ms);
  return {
    signal: ctl.signal,
    done: () => {
      clearTimeout(t);
      parent.removeEventListener('abort', onAbort);
    },
  };
}

export class AssistantTransport {
  private cached: { token: string; exp: number | null } | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly getToken: TokenProvider,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  /** Forget the cached token (identity, tenant or module changed; logout). */
  forgetToken(): void {
    this.cached = null;
  }

  private async token(reason: TokenRequest['reason'], forceRefresh: boolean, signal: AbortSignal): Promise<string> {
    const now = Date.now() / 1000;
    if (!forceRefresh && this.cached && this.cached.exp !== null && this.cached.exp - now > TOKEN_REUSE_MARGIN_SEC) {
      return this.cached.token;
    }
    this.cached = null;
    const t = withTimeout(signal, TOKEN_TIMEOUT_MS);
    let tok: unknown;
    try {
      tok = await this.getToken({ reason, forceRefresh, signal: t.signal });
    } catch (e) {
      if (signal.aborted) throw e;
      throw new TokenUnavailableError(e instanceof Error ? e.message : 'token request failed');
    } finally {
      t.done();
    }
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    if (typeof tok !== 'string' || !tok.includes('.')) throw new TokenUnavailableError('token provider returned no token');
    this.cached = { token: tok, exp: tokenExpiry(tok) };
    return tok;
  }

  /** One authenticated request with the bounded refresh: 401 → one forced new token → one retry → IdentityRejectedError. */
  private async authed<T>(reason: TokenRequest['reason'], timeoutMs: number, signal: AbortSignal,
                          call: (token: string, signal: AbortSignal) => Promise<Response>, read: (r: Response) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.token(reason, attempt > 0, signal);
      const t = withTimeout(signal, timeoutMs);
      let r: Response;
      try {
        r = await call(token, t.signal);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new AssistantUnavailableError(isAbort(e) ? 'the assistant did not answer in time' : 'the assistant could not be reached');
      } finally {
        t.done();
      }
      if (r.status === 401) {
        this.cached = null;
        if (attempt === 0) continue;
        throw new IdentityRejectedError('your session could not be verified');
      }
      if (!r.ok) throw new AssistantUnavailableError(`assistant HTTP ${r.status}`);
      return read(r);
    }
    throw new IdentityRejectedError('your session could not be verified');
  }

  chat(body: ChatRequestBody, signal: AbortSignal): Promise<ChatReply> {
    return this.authed('chat', CHAT_TIMEOUT_MS, signal,
      (token, s) => this.fetchImpl(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-assistant-identity': token },
        body: JSON.stringify(body),
        signal: s,
      }),
      async (r) => {
        const j = await r.json().catch(() => null);
        if (!j || typeof j.response !== 'string') throw new AssistantUnavailableError('the assistant returned no answer');
        return j as ChatReply;
      });
  }

  suggestions(module: string, signal: AbortSignal): Promise<string[]> {
    return this.authed('suggestions', SUGGESTIONS_TIMEOUT_MS, signal,
      (token, s) => this.fetchImpl(`${this.baseUrl}/suggestions?module=${encodeURIComponent(module)}`, {
        headers: { 'x-assistant-identity': token },
        signal: s,
      }),
      async (r) => {
        const j = await r.json().catch(() => null);
        if (!j || j.module !== module || !Array.isArray(j.questions)) return [];
        return j.questions.filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 6);
      });
  }
}
