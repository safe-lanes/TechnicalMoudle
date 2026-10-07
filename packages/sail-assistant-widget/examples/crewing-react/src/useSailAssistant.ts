// Host-side glue for a React module (copy into the module; ~30 lines). The widget itself is the pinned <script> bundle —
// nothing from React is shared with it and nothing is installed.
import { useEffect, useRef } from 'react';

type Ctx = { vesselId?: string | null; vesselName?: string | null; userKey?: string | null; tenantKey?: string | null; currentPage?: string | null };
type Handle = { updateContext(c: Ctx & { module?: string }): void; open(): void; close(): void; destroy(): void };
declare global {
  interface Window {
    SailAssistant?: { init(config: Record<string, unknown>): Handle; VERSION: string };
  }
}

export function useSailAssistant(opts: {
  assistantUrl: string;
  module: string;
  getToken: (r: { forceRefresh: boolean; signal: AbortSignal }) => Promise<string>;
  context: Ctx;
  enabled: boolean;
  title?: string;
}) {
  const handle = useRef<Handle | null>(null);
  const latest = useRef(opts);
  latest.current = opts;

  // Mount once per enabled period; destroy on unmount (StrictMode's mount→unmount→mount is handled by the widget too).
  useEffect(() => {
    if (!opts.enabled || !window.SailAssistant) return;
    const h = window.SailAssistant.init({
      assistantUrl: opts.assistantUrl,
      module: opts.module,
      title: opts.title,
      getToken: (r: { forceRefresh: boolean; signal: AbortSignal }) => latest.current.getToken(r),
      context: latest.current.context,
      offset: 24,
    });
    handle.current = h;
    return () => {
      h.destroy();
      handle.current = null;
    };
  }, [opts.enabled, opts.assistantUrl]);

  // Context changes → the widget decides whether that starts a new conversation (module/vessel/user/tenant do).
  const { vesselId, vesselName, userKey, tenantKey, currentPage } = opts.context;
  useEffect(() => {
    handle.current?.updateContext({ module: opts.module, vesselId, vesselName, userKey, tenantKey, currentPage });
  }, [opts.module, vesselId, vesselName, userKey, tenantKey, currentPage]);
}
