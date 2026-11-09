// Sync Now, linked services: before a module's own sync starts, each linked service (My Files is the first) syncs
// and its result is shown. Driven only by configuration, so another service can be added without code changes:
//   { "name": "My Files", "url": "/m/api/v1", "enabled": true, "timeoutMs": 180000 }
// A linked service answers POST <url>/sync/trigger and GET <url>/sync/trigger/status with the user's token.
// Nothing here can stop the module's own sync: every failure, and any time-out, ends as a result. Plain TypeScript
// with no framework, so the same step and the same tests apply in every module that has a Sync Now.

export interface LinkedService {
  name: string;
  url: string;
  enabled?: boolean;
  /** How long the module's own sync may wait for this service. Default 3 minutes. */
  timeoutMs?: number;
  /** How often to ask whether it has finished. Default 2 seconds. */
  pollMs?: number;
}

export type LinkedState = 'running' | 'synced' | 'failed' | 'skipped';
export interface LinkedResult {
  name: string;
  state: LinkedState;
  /** A short reason, when failed. */
  reason?: string;
}

export interface LinkedDeps {
  getToken: () => string | undefined | null;
  fetch?: typeof fetch;
  /** Called once a service has accepted (not for one that has nothing to do), and when it ends. Can stop nothing. */
  onUpdate?: (result: LinkedResult) => void;
  log?: (message: string) => void;
  /** Set by runLinkedSync: onUpdate, made safe. */
  tell?: (result: LinkedResult) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 180_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_POLL_MS = 2_000;
const MAX_REASON = 120;

/** The services to run, from whatever the configuration holds. Anything malformed counts as not configured. */
export function parseLinkedServices(config: unknown): LinkedService[] {
  const list = Array.isArray(config) ? config : (config as { services?: unknown } | null)?.services;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (s): s is LinkedService =>
      !!s && s.enabled === true && typeof s.name === 'string' && !!s.name && typeof s.url === 'string' && !!s.url,
  );
}

/** The line to show for a result, or null when there is nothing to say. */
export function linkedLine(r: LinkedResult): string | null {
  if (r.state === 'running') return `${r.name}: syncing…`;
  if (r.state === 'synced') return `${r.name}: synced`;
  if (r.state === 'failed') return `${r.name}: failed – ${r.reason ?? 'unknown reason'}`;
  return null;
}

const short = (text: string) => (text.length > MAX_REASON ? `${text.slice(0, MAX_REASON - 1)}…` : text);
const seconds = (ms: number) => `${Math.round(ms / 1000)} seconds`;

async function runOne(service: LinkedService, deps: LinkedDeps): Promise<LinkedResult> {
  const { name } = service;
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Number(service.timeoutMs) || DEFAULT_TIMEOUT_MS));
  const pollMs = Math.max(1, Number(service.pollMs) || DEFAULT_POLL_MS);
  const base = service.url.replace(/\/+$/, '');
  const deadline = now() + timeoutMs;
  const timedOut: LinkedResult = {
    name,
    state: 'failed',
    reason: `no result after ${seconds(timeoutMs)}; it carries on by itself`,
  };

  // One request, never longer than the time left. Null means it timed out.
  const call = async (path: string, method: string): Promise<Response | null> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), Math.max(1, deadline - now()));
    try {
      const token = deps.getToken();
      return await Promise.race([
        doFetch(`${base}${path}`, {
          method,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: abort.signal,
        }),
        new Promise<null>((resolve) => abort.signal.addEventListener('abort', () => resolve(null))),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  let started: Response | null;
  try {
    started = await call('/sync/trigger', 'POST');
  } catch {
    return { name, state: 'failed', reason: 'could not be reached' };
  }
  if (!started) return timedOut;
  if (!started.ok)
    return {
      name,
      state: 'failed',
      reason: started.status === 401 || started.status === 403 ? 'not allowed' : `answered ${started.status}`,
    };
  const trigger = (await started.json().catch(() => ({}))) as { status?: string };
  // A shore, or sync switched off there: nothing to do, and nothing to show.
  if (trigger.status === 'not_applicable' || trigger.status === 'disabled') return { name, state: 'skipped' };
  // 'already_running' follows the same path: wait for that run, and never start another.
  if (trigger.status !== 'started' && trigger.status !== 'already_running')
    return { name, state: 'failed', reason: 'gave an answer it should not' };
  deps.tell?.({ name, state: 'running' });

  for (;;) {
    if (now() >= deadline) return timedOut;
    await sleep(Math.min(pollMs, Math.max(1, deadline - now())));
    if (now() >= deadline) return timedOut;
    let res: Response | null;
    try {
      res = await call('/sync/trigger/status', 'GET');
    } catch {
      continue; // a passing network problem: keep asking until the time is up
    }
    if (!res) return timedOut;
    if (!res.ok) continue;
    const status = (await res.json().catch(() => null)) as {
      running?: boolean;
      lastStatus?: string | null;
      lastError?: string | null;
    } | null;
    if (!status || status.running !== false) continue;
    if (status.lastStatus === 'not_applicable') return { name, state: 'skipped' };
    if (status.lastStatus === 'completed') return { name, state: 'synced' };
    return { name, state: 'failed', reason: short(status.lastError || 'some records were not synced') };
  }
}

/** Runs each service in turn. Never throws. */
export async function runLinkedSync(services: LinkedService[], deps: LinkedDeps): Promise<LinkedResult[]> {
  const results: LinkedResult[] = [];
  const tell = (r: LinkedResult) => {
    try {
      deps.onUpdate?.(r);
    } catch {
      /* showing a result can never stop a sync */
    }
  };
  for (const service of services) {
    let result: LinkedResult;
    try {
      result = await runOne(service, { ...deps, tell });
    } catch (err) {
      result = { name: service.name, state: 'failed', reason: short(String((err as Error)?.message ?? err)) };
    }
    if (result.state === 'failed') deps.log?.(`Linked sync ${service.name} failed: ${result.reason}`);
    tell(result);
    results.push(result);
  }
  return results;
}

/**
 * The whole step: load the configuration, run the services, then the module's own sync, whatever happened before it.
 * With nothing configured the module's own sync starts at once, exactly as if this step did not exist.
 */
export async function withLinkedSync<T>(
  loadConfig: () => Promise<unknown> | unknown,
  deps: LinkedDeps,
  ownSync: () => Promise<T> | T,
): Promise<T> {
  let services: LinkedService[] = [];
  try {
    services = parseLinkedServices(await loadConfig());
  } catch (err) {
    deps.log?.(`Linked sync configuration not read: ${String((err as Error)?.message ?? err)}`);
  }
  if (services.length) await runLinkedSync(services, deps);
  return ownSync();
}
