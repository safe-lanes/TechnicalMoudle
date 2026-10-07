/**
 * Conversation state for one widget — framework-free, so it is unit-tested without a browser.
 *
 * Every change of who/where the user is (module, vessel, user, tenant, sign-out) starts a NEW session: history cleared,
 * in-flight requests aborted, cached token dropped, and the epoch bumped so a response that still arrives for the old
 * session is discarded instead of appearing in the new one.
 */
import {
  AssistantTransport, IdentityRejectedError, TokenUnavailableError, type ChatReply, type Citation,
} from './widgetTransport';

export interface WidgetContext {
  /** Assistant module id (e.g. 'crewing', 'audit', 'safety', 'incident', 'technical'). Set by the host, never guessed. */
  module: string;
  /** Optional — only for modules that have a selected vessel. */
  vesselId?: string | null;
  vesselName?: string | null;
  /** Opaque host values that identify the signed-in user and tenant. A change starts a new session; userKey null = signed out. */
  userKey?: string | null;
  tenantKey?: string | null;
  /** Optional page hint passed to the assistant as context. Never used to choose the module. */
  currentPage?: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  gate?: string;
  /** An error bubble (not sent back as history). */
  error?: 'unavailable' | 'session' | 'not-allowed';
}

export interface SessionState {
  open: boolean;
  signedIn: boolean;
  messages: Message[];
  pending: boolean;
  /** null = not loaded (or loading); [] = none available → the UI hides suggestions. */
  suggestions: string[] | null;
  suggestionsLoading: boolean;
  context: WidgetContext;
  /** Last question that failed — offered for "Try again". */
  retryable: string | null;
}

export interface SessionOptions {
  suggestions: boolean;
  /** Messages kept on screen (oldest dropped). */
  maxMessages: number;
  /** Messages sent back as history (the assistant uses the last 8). */
  historyMessages: number;
  maxMessageChars: number;
}

export const DEFAULT_SESSION_OPTIONS: SessionOptions = { suggestions: true, maxMessages: 40, historyMessages: 8, maxMessageChars: 2000 };

export const MSG_UNAVAILABLE = 'The assistant is temporarily unavailable. Please try again in a moment.';
export const MSG_SESSION = 'Your session could not be verified. Please sign in again, then reopen the assistant.';
export const MSG_NOT_ALLOWED = 'The assistant is not available for your account here.';

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;
function conversationId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sameIdentity(a: WidgetContext, b: WidgetContext): boolean {
  return a.module === b.module && (a.vesselId ?? null) === (b.vesselId ?? null)
    && (a.userKey ?? null) === (b.userKey ?? null) && (a.tenantKey ?? null) === (b.tenantKey ?? null);
}

export class WidgetSession {
  private state: SessionState;
  private readonly listeners = new Set<(s: SessionState) => void>();
  private epoch = 0;
  private convId = conversationId();
  private chatCtl: AbortController | null = null;
  private sugCtl: AbortController | null = null;
  private destroyed = false;

  constructor(private readonly transport: AssistantTransport, context: WidgetContext,
              private readonly opts: SessionOptions = DEFAULT_SESSION_OPTIONS) {
    this.state = {
      open: false, signedIn: context.userKey !== null, messages: [], pending: false,
      suggestions: opts.suggestions ? null : [], suggestionsLoading: false, context: { ...context }, retryable: null,
    };
  }

  getState(): SessionState {
    return this.state;
  }

  subscribe(fn: (s: SessionState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SessionState>): void {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    for (const fn of [...this.listeners]) fn(this.state);
  }

  /** Abort everything in flight and forget the conversation. Late responses of the old epoch are dropped. */
  private reset(context: WidgetContext): void {
    this.epoch++;
    this.chatCtl?.abort();
    this.sugCtl?.abort();
    this.chatCtl = this.sugCtl = null;
    this.transport.forgetToken();
    this.convId = conversationId();
    const signedIn = context.userKey !== null;
    this.set({
      messages: [], pending: false, retryable: null, context: { ...context }, signedIn,
      suggestions: this.opts.suggestions ? null : [], suggestionsLoading: false,
      open: signedIn ? this.state.open : false,
    });
    if (signedIn && this.state.open) this.loadSuggestions();
  }

  updateContext(patch: Partial<WidgetContext>): void {
    if (this.destroyed) return;
    const next: WidgetContext = { ...this.state.context, ...patch };
    if (!next.module) next.module = this.state.context.module;
    if (!sameIdentity(this.state.context, next)) this.reset(next);
    else this.set({ context: next }); // e.g. vesselName or currentPage only — same conversation
  }

  setOpen(open: boolean): void {
    if (this.destroyed || (open && !this.state.signedIn)) return;
    this.set({ open });
    if (open && this.state.suggestions === null) this.loadSuggestions();
  }

  /** Clear the conversation but keep who/where the user is (the "New chat" button). */
  newChat(): void {
    this.reset(this.state.context);
  }

  private loadSuggestions(): void {
    if (!this.opts.suggestions || this.state.suggestionsLoading || !this.state.signedIn) return;
    const epoch = this.epoch;
    const module = this.state.context.module;
    const ctl = new AbortController();
    this.sugCtl = ctl;
    this.set({ suggestionsLoading: true });
    this.transport.suggestions(module, ctl.signal).then(
      (qs) => {
        if (epoch !== this.epoch || module !== this.state.context.module) return;
        this.set({ suggestions: qs, suggestionsLoading: false });
      },
      () => {
        if (epoch !== this.epoch) return;
        this.set({ suggestions: [], suggestionsLoading: false }); // fail closed: hide, never invent
      },
    );
  }

  private history(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.state.messages
      .filter((m) => !m.error && m.content.trim())
      .slice(-this.opts.historyMessages)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  }

  private payloadContext(): Record<string, string> {
    const c = this.state.context;
    const out: Record<string, string> = { module: c.module };
    if (c.vesselId) out.vesselId = String(c.vesselId);
    if (c.vesselName) out.vesselName = String(c.vesselName);
    if (c.currentPage) out.currentPage = String(c.currentPage).slice(0, 200);
    return out;
  }

  /** Send a question. Ignored while another answer is pending, when signed out, or for empty text. */
  async send(text: string): Promise<void> {
    const message = text.trim().slice(0, this.opts.maxMessageChars);
    if (this.destroyed || !message || this.state.pending || !this.state.signedIn) return;
    const epoch = this.epoch;
    const history = this.history();
    const user: Message = { id: nextId(), role: 'user', content: message };
    const keep = this.opts.maxMessages - 1;
    this.set({ messages: [...this.state.messages, user].slice(-keep), pending: true, retryable: null });
    const ctl = new AbortController();
    this.chatCtl = ctl;
    let reply: Message;
    try {
      const r: ChatReply = await this.transport.chat(
        { message, conversationHistory: history, context: this.payloadContext(), conversationId: this.convId }, ctl.signal);
      reply = { id: nextId(), role: 'assistant', content: r.response, citations: Array.isArray(r.citations) ? r.citations : [], gate: r.gate };
    } catch (e) {
      if (epoch !== this.epoch || ctl.signal.aborted) return; // superseded: never show in the new session
      if (e instanceof IdentityRejectedError) reply = { id: nextId(), role: 'assistant', content: MSG_SESSION, error: 'session' };
      else if (e instanceof TokenUnavailableError) reply = { id: nextId(), role: 'assistant', content: MSG_NOT_ALLOWED, error: 'not-allowed' };
      else reply = { id: nextId(), role: 'assistant', content: MSG_UNAVAILABLE, error: 'unavailable' }; // incl. AssistantUnavailableError
      this.set({ messages: [...this.state.messages, reply].slice(-this.opts.maxMessages), pending: false,
                 retryable: reply.error === 'unavailable' ? message : null });
      return;
    } finally {
      if (this.chatCtl === ctl) this.chatCtl = null;
    }
    if (epoch !== this.epoch) return; // late answer for an old session: discard
    this.set({ messages: [...this.state.messages, reply].slice(-this.opts.maxMessages), pending: false });
  }

  /** Re-ask the last failed question (drops its error bubble and the failed question first). */
  retry(): void {
    const q = this.state.retryable;
    if (!q || this.state.pending) return;
    const msgs = [...this.state.messages];
    if (msgs.length && msgs[msgs.length - 1].error) msgs.pop();
    if (msgs.length && msgs[msgs.length - 1].role === 'user' && msgs[msgs.length - 1].content === q) msgs.pop();
    this.set({ messages: msgs, retryable: null });
    void this.send(q);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.epoch++;
    this.chatCtl?.abort();
    this.sugCtl?.abort();
    this.transport.forgetToken();
    this.listeners.clear();
    this.destroyed = true;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }
}
