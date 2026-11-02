/**
 * Public API of the SAIL assistant widget — framework-neutral: Angular, React and plain HTML hosts all use the same
 * built bundle and call `SailAssistant.init(config)`. React is used internally and bundled privately; hosts never
 * install React or copy .tsx files.
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WidgetApp, type WidgetLabels } from './WidgetApp';
import { DEFAULT_SESSION_OPTIONS, WidgetSession, type WidgetContext } from './widgetSession';
import { AssistantTransport, type TokenProvider } from './widgetTransport';
import styles from './widgetStyles.css?inline';

export const VERSION: string = typeof __WIDGET_VERSION__ === 'string' ? __WIDGET_VERSION__ : '0.0.0-dev';

/**
 * 'floating' (default): a launcher button at a screen corner opens a pop-up panel.
 * 'inline' (1.0.2): the panel is always open and fills `container` — for a host page, tab or side pane that embeds the
 * assistant. No launcher, no close button; `open()`/`close()` do nothing. Everything else (context, new chat,
 * suggestions, token refresh, history, sign-out hiding it) behaves exactly as in floating mode.
 */
export type WidgetMode = 'floating' | 'inline';

export interface WidgetConfig {
  /** Central assistant base URL, e.g. https://assistant.sl-sail.com (https required except localhost). */
  assistantUrl: string;
  /** The assistant module id this host belongs to: 'crewing', 'audit', 'safety', 'incident', 'technical', … */
  module: string;
  /**
   * Returns a short-lived signed identity from the HOST module's own authenticated backend (e.g. GET /api/assistant/token).
   * Called before requests; with forceRefresh=true after the assistant rejected the previous token. Throw to refuse.
   */
  getToken: TokenProvider;
  /** Initial context. Vessel fields are optional; userKey/tenantKey identify the session (userKey null = signed out). */
  context?: Omit<WidgetContext, 'module'>;
  /** Starter questions from the assistant (only ones answered by this module's published manuals). Default true. */
  suggestions?: boolean;
  title?: string;
  subtitle?: string;
  launcherLabel?: string;
  placeholder?: string;
  intro?: string;
  position?: 'bottom-right' | 'bottom-left';
  /** Distance from the screen edges in px (default 20) — e.g. to clear a host's own floating button. */
  offset?: number;
  zIndex?: number;
  accentColor?: string;
  theme?: 'auto' | 'light' | 'dark';
  /** Default 'floating'. See WidgetMode. */
  mode?: WidgetMode;
  /**
   * Element to mount into (default document.body). Floating: the widget renders fixed-position inside its own shadow
   * root, wherever it is mounted. Inline: REQUIRED — the widget fills this element (give it a height); `position`,
   * `offset` and `zIndex` do not apply.
   */
  container?: HTMLElement;
}

export interface WidgetHandle {
  readonly version: string;
  /** Change module / vessel / user / tenant / page. Any change of module, vessel, user or tenant starts a new conversation. */
  updateContext(patch: Partial<WidgetContext>): void;
  /** Show the floating panel. No-op in inline mode (always open). */
  open(): void;
  /** Hide the floating panel. No-op in inline mode. */
  close(): void;
  /** Unmount, abort pending requests, remove every element; the handle is dead afterwards. Safe to call twice. */
  destroy(): void;
}

const MODULE_RE = /^[a-z][a-z0-9_-]{1,39}$/;
let live: { handle: WidgetHandle; host: HTMLElement } | null = null;
let uidSeq = 0;

function checkUrl(u: unknown): string {
  if (typeof u !== 'string' || !u) throw new Error('SailAssistant: assistantUrl is required');
  let parsed: URL;
  try {
    parsed = new URL(u, typeof location !== 'undefined' ? location.href : undefined);
  } catch {
    throw new Error('SailAssistant: assistantUrl is not a valid URL');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  const sameOrigin = typeof location !== 'undefined' && parsed.origin === location.origin;
  if (parsed.protocol !== 'https:' && !local && !sameOrigin) throw new Error('SailAssistant: assistantUrl must use https');
  return parsed.href.replace(/\/+$/, '');
}

function checkModule(m: unknown): string {
  const v = typeof m === 'string' ? m.trim().toLowerCase() : '';
  if (!MODULE_RE.test(v)) throw new Error('SailAssistant: module must be the assistant module id (e.g. "crewing")');
  return v;
}

function checkMode(m: unknown): WidgetMode {
  if (m === undefined || m === 'floating') return 'floating';
  if (m === 'inline') return 'inline';
  throw new Error('SailAssistant: mode must be "floating" (default) or "inline"');
}

/** An element (nodeType 1) — duck-typed, so a container from another realm (an iframe) is accepted too. */
const isElement = (el: unknown): el is HTMLElement => !!el && typeof el === 'object' && (el as Node).nodeType === 1;

export function init(config: WidgetConfig): WidgetHandle {
  if (!config || typeof config !== 'object') throw new Error('SailAssistant: config is required');
  const baseUrl = checkUrl(config.assistantUrl);
  const module = checkModule(config.module);
  if (typeof config.getToken !== 'function') throw new Error('SailAssistant: getToken(…) is required');
  const mode = checkMode(config.mode);
  const inline = mode === 'inline';
  if (inline && !isElement(config.container)) {
    throw new Error('SailAssistant: mode "inline" requires container — the element the assistant fills (give it a height)');
  }
  if (typeof document === 'undefined') throw new Error('SailAssistant: needs a browser document');

  // One widget per page: a second init (React StrictMode, an Angular component re-created without destroy) replaces the
  // first instead of stacking two launchers.
  if (live) {
    console.warn('[SailAssistant] init() called while a widget is mounted — replacing it.');
    live.handle.destroy();
  }

  const host = document.createElement('div');
  host.setAttribute('data-sail-assistant', VERSION);
  host.setAttribute('data-mode', mode); // the stylesheet scopes every inline rule by this; floating rules are untouched
  host.setAttribute('data-position', config.position === 'bottom-left' ? 'bottom-left' : 'bottom-right');
  if (config.theme === 'light' || config.theme === 'dark') host.setAttribute('data-theme', config.theme);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  const vars: string[] = [];
  if (typeof config.zIndex === 'number' && Number.isFinite(config.zIndex)) vars.push(`--sa-z:${Math.trunc(config.zIndex)}`);
  if (typeof config.offset === 'number' && Number.isFinite(config.offset)) vars.push(`--sa-offset:${Math.max(0, Math.trunc(config.offset))}px`);
  if (typeof config.accentColor === 'string' && /^#[0-9a-f]{3,8}$|^rgb/i.test(config.accentColor)) vars.push(`--sa-accent:${config.accentColor}`);
  style.textContent = styles + (vars.length ? `\n:host{${vars.join(';')}}` : '');
  const mount = document.createElement('div');
  shadow.append(style, mount);
  (config.container ?? document.body).appendChild(host);

  const transport = new AssistantTransport(baseUrl, config.getToken);
  const ctx = config.context ?? {};
  const session = new WidgetSession(transport, { ...ctx, module },
    { ...DEFAULT_SESSION_OPTIONS, suggestions: config.suggestions !== false, alwaysOpen: inline });
  const labels: WidgetLabels = {
    title: config.title ?? 'SAIL Assistant',
    subtitle: config.subtitle,
    launcher: config.launcherLabel ?? 'Open assistant',
    placeholder: config.placeholder ?? 'Ask a question…',
    intro: config.intro ?? 'Ask how to do something in this module. Answers come from the user manuals and show their sources.',
  };
  let root: Root | null = createRoot(mount);
  root.render(createElement(WidgetApp, { session, labels, uid: `sa${++uidSeq}`, inline }));

  const handle: WidgetHandle = {
    version: VERSION,
    updateContext(patch) {
      if (!root) return;
      const p: Partial<WidgetContext> = { ...patch };
      if (p.module !== undefined) p.module = checkModule(p.module);
      session.updateContext(p);
    },
    open() {
      if (root && !inline) session.setOpen(true);
    },
    close() {
      if (root && !inline) session.setOpen(false);
    },
    destroy() {
      if (!root) return;
      session.destroy();
      root.unmount();
      root = null;
      host.remove();
      if (live?.handle === handle) live = null;
    },
  };
  live = { handle, host };
  return handle;
}
