import { describe, expect, it } from 'vitest';
import {
  linkedLine,
  parseLinkedServices,
  runLinkedSync,
  withLinkedSync,
  type LinkedDeps,
  type LinkedResult,
  type LinkedService,
} from '../../../../client/src/lib/linkedSync';

const MY_FILES: LinkedService = { name: 'My Files', url: '/m/api/v1', enabled: true, timeoutMs: 10_000, pollMs: 1000 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const finished = (lastStatus: string, lastError: string | null = null) => ({ running: false, lastStatus, lastError });

/** A clock that only moves when the step sleeps, so time-outs need no waiting. */
function harness(answers: { trigger?: () => Promise<Response> | Response; status?: () => Promise<Response> | Response }) {
  let time = 0;
  const calls: { url: string; method: string; auth?: string }[] = [];
  const updates: LinkedResult[] = [];
  const logs: string[] = [];
  const deps: LinkedDeps = {
    getToken: () => 'tok',
    now: () => time,
    sleep: async (ms) => {
      time += ms;
    },
    onUpdate: (r) => updates.push(r),
    log: (m) => logs.push(m),
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({
        url,
        method: init.method ?? 'GET',
        auth: (init.headers as Record<string, string>).Authorization,
      });
      return url.endsWith('/sync/trigger')
        ? (answers.trigger ?? (() => json({ status: 'started' })))()
        : (answers.status ?? (() => json(finished('completed'))))();
    }) as unknown as typeof fetch,
  };
  return { deps, calls, updates, logs };
}

describe('linked sync', () => {
  it('ok: starts, follows to the end with the user token, says synced', async () => {
    const { deps, calls, updates } = harness({});
    const results = await runLinkedSync([MY_FILES], deps);
    expect(results).toEqual([{ name: 'My Files', state: 'synced' }]);
    expect(calls[0]).toEqual({ url: '/m/api/v1/sync/trigger', method: 'POST', auth: 'Bearer tok' });
    expect(calls[1]).toEqual({ url: '/m/api/v1/sync/trigger/status', method: 'GET', auth: 'Bearer tok' });
    expect(updates.map((u) => u.state)).toEqual(['running', 'synced']);
    expect(linkedLine(results[0])).toBe('My Files: synced');
  });

  it('keeps asking while it runs', async () => {
    let n = 0;
    const { deps, calls } = harness({ status: () => json(++n < 3 ? { running: true } : finished('completed')) });
    expect((await runLinkedSync([MY_FILES], deps))[0].state).toBe('synced');
    expect(calls.length).toBe(4);
  });

  it('failed: shows the short reason, and logs it', async () => {
    const { deps, logs } = harness({ status: () => json(finished('failed', `/initiate: ${'x'.repeat(300)}`)) });
    const [r] = await runLinkedSync([MY_FILES], deps);
    expect(r.state).toBe('failed');
    expect(r.reason!.startsWith('/initiate: x')).toBe(true);
    expect(r.reason!.length).toBeLessThanOrEqual(120);
    expect(linkedLine(r)!.startsWith('My Files: failed – /initiate')).toBe(true);
    expect(logs.length).toBe(1);
  });

  it('partial, with no error text, counts as failed in plain words', async () => {
    const { deps } = harness({ status: () => json(finished('partial')) });
    expect((await runLinkedSync([MY_FILES], deps))[0]).toEqual({
      name: 'My Files',
      state: 'failed',
      reason: 'some records were not synced',
    });
  });

  it('timeout: a run that never ends is given up on at the limit', async () => {
    const { deps, calls } = harness({ status: () => json({ running: true }) });
    const [r] = await runLinkedSync([MY_FILES], deps);
    expect(r.state).toBe('failed');
    expect(r.reason).toContain('no result after 10 seconds');
    expect(calls.length).toBeLessThan(12);
  });

  it('timeout: a trigger request that hangs is cut off', async () => {
    const { deps } = harness({ trigger: () => new Promise<Response>(() => undefined) });
    const [r] = await runLinkedSync([{ ...MY_FILES, timeoutMs: 1000 }], { ...deps, now: Date.now });
    expect(r.state).toBe('failed');
    expect(r.reason).toContain('no result after 1 seconds');
  });

  it('unreachable: says so at once', async () => {
    const { deps, calls } = harness({ trigger: () => Promise.reject(new TypeError('failed to fetch')) });
    expect((await runLinkedSync([MY_FILES], deps))[0]).toEqual({
      name: 'My Files',
      state: 'failed',
      reason: 'could not be reached',
    });
    expect(calls.length).toBe(1);
  });

  it('a refused token or a server error is a plain failure', async () => {
    expect((await runLinkedSync([MY_FILES], harness({ trigger: () => json({}, 401) }).deps))[0].reason).toBe(
      'not allowed',
    );
    expect((await runLinkedSync([MY_FILES], harness({ trigger: () => json({}, 500) }).deps))[0].reason).toBe(
      'answered 500',
    );
    expect((await runLinkedSync([MY_FILES], harness({ trigger: () => json({}, 502) }).deps))[0].reason).toBe(
      'could not be reached',
    );
    expect((await runLinkedSync([MY_FILES], harness({ trigger: () => json({ status: 'odd' }) }).deps))[0].state).toBe(
      'failed',
    );
  });

  it('not installed on this ship: 404, 405 or a web page is skipped, and the screen says so', async () => {
    for (const answer of [() => json({}, 404), () => json({}, 405), () => new Response('<html>app</html>')]) {
      const { deps, calls, logs } = harness({ trigger: answer });
      const [r] = await runLinkedSync([MY_FILES], deps);
      expect(r).toEqual({ name: 'My Files', state: 'absent' });
      expect(linkedLine(r)).toBe('My Files: not installed on this ship – skipped');
      expect(calls.length).toBe(1);
      expect(logs.length).toBe(0);
    }
  });

  it('a passing network problem while following does not end it', async () => {
    let n = 0;
    const { deps } = harness({
      status: () => (++n === 1 ? Promise.reject(new TypeError('blip')) : n === 2 ? json({}, 500) : json(finished('completed'))),
    });
    expect((await runLinkedSync([MY_FILES], deps))[0].state).toBe('synced');
  });

  it('already running: waits for that run and starts no other', async () => {
    let n = 0;
    const { deps, calls } = harness({
      trigger: () => json({ status: 'already_running' }),
      status: () => json(++n < 2 ? { running: true } : finished('completed')),
    });
    expect((await runLinkedSync([MY_FILES], deps))[0].state).toBe('synced');
    expect(calls.filter((c) => c.method === 'POST').length).toBe(1);
  });

  it('shore: not_applicable is skipped quietly, with nothing to show', async () => {
    const { deps, calls, updates } = harness({ trigger: () => json({ status: 'not_applicable' }) });
    const [r] = await runLinkedSync([MY_FILES], deps);
    expect(r.state).toBe('skipped');
    expect(linkedLine(r)).toBeNull();
    expect(calls.length).toBe(1);
    expect(updates.map((u) => u.state)).toEqual(['skipped']);
  });

  it('sync switched off on that server is skipped too', async () => {
    const { deps } = harness({ trigger: () => json({ status: 'disabled' }) });
    expect((await runLinkedSync([MY_FILES], deps))[0].state).toBe('skipped');
  });

  it('two services run in order: another service needs configuration only', async () => {
    const { deps, calls } = harness({});
    const results = await runLinkedSync([MY_FILES, { name: 'Other', url: '/other/api/', enabled: true }], deps);
    expect(results.map((r) => r.name)).toEqual(['My Files', 'Other']);
    expect(calls.map((c) => c.url)).toContain('/other/api/sync/trigger');
  });

  it('configuration: empty, disabled or malformed means nothing to run', () => {
    expect(parseLinkedServices(undefined)).toEqual([]);
    expect(parseLinkedServices(null)).toEqual([]);
    expect(parseLinkedServices('nope')).toEqual([]);
    expect(parseLinkedServices({ services: 'nope' })).toEqual([]);
    expect(parseLinkedServices({ services: [] })).toEqual([]);
    expect(parseLinkedServices([{ ...MY_FILES, enabled: false }])).toEqual([]);
    expect(parseLinkedServices([{ name: 'No flag', url: '/x' }])).toEqual([]);
    expect(parseLinkedServices([{ enabled: true, url: '/x' }, null, 3])).toEqual([]);
    expect(parseLinkedServices({ services: [MY_FILES] })).toEqual([MY_FILES]);
  });

  describe('the module’s own sync always runs', () => {
    const own = async (deps: LinkedDeps, config: () => unknown) => {
      const order: string[] = [];
      const outcome = await withLinkedSync(
        config,
        { ...deps, onUpdate: (r) => order.push(`${r.name}:${r.state}`) },
        () => {
          order.push('own sync');
          return 'done';
        },
      );
      expect(outcome).toBe('done');
      return order;
    };
    const config = () => ({ services: [MY_FILES] });

    it('after My Files succeeded, and only then', async () => {
      expect(await own(harness({}).deps, config)).toEqual(['My Files:running', 'My Files:synced', 'own sync']);
    });
    it('after My Files failed', async () => {
      const { deps } = harness({ status: () => json(finished('failed', 'boom')) });
      expect(await own(deps, config)).toEqual(['My Files:running', 'My Files:failed', 'own sync']);
    });
    it('after a time-out', async () => {
      const { deps } = harness({ status: () => json({ running: true }) });
      expect(await own(deps, config)).toEqual(['My Files:running', 'My Files:failed', 'own sync']);
    });
    it('when My Files cannot be reached', async () => {
      const { deps } = harness({ trigger: () => Promise.reject(new Error('down')) });
      expect(await own(deps, config)).toEqual(['My Files:failed', 'own sync']);
    });
    it('when My Files is not installed', async () => {
      const { deps } = harness({ trigger: () => json({}, 404) });
      expect(await own(deps, config)).toEqual(['My Files:absent', 'own sync']);
    });
    it('when already running', async () => {
      const { deps } = harness({ trigger: () => json({ status: 'already_running' }) });
      expect(await own(deps, config)).toEqual(['My Files:running', 'My Files:synced', 'own sync']);
    });
    it('with the configuration disabled or empty: at once, and calling nobody', async () => {
      const a = harness({});
      expect(await own(a.deps, () => ({ services: [{ ...MY_FILES, enabled: false }] }))).toEqual(['own sync']);
      expect(await own(a.deps, () => ({ services: [] }))).toEqual(['own sync']);
      expect(a.calls.length).toBe(0);
    });
    it('when the configuration cannot be read', async () => {
      const { deps, logs } = harness({});
      expect(
        await own(deps, () => {
          throw new Error('404');
        }),
      ).toEqual(['own sync']);
      expect(logs.length).toBe(1);
    });
    it('when the token cannot be read', async () => {
      const { deps } = harness({});
      deps.getToken = () => {
        throw new Error('no storage');
      };
      expect((await own(deps, config)).at(-1)).toBe('own sync');
    });
    it('when showing a result fails', async () => {
      const { deps } = harness({});
      let ran = false;
      await withLinkedSync(
        config,
        {
          ...deps,
          onUpdate: () => {
            throw new Error('screen gone');
          },
        },
        () => {
          ran = true;
        },
      );
      expect(ran).toBe(true);
    });
    it('a failure of the own sync still reaches its caller', async () => {
      await expect(
        withLinkedSync(config, harness({}).deps, () => Promise.reject(new Error('own failed'))),
      ).rejects.toThrow('own failed');
    });
  });
});

describe('Technical: which services, per server', () => {
  it('My Files by default; LINKED_SYNC_SERVICES replaces it; [] switches it off; bad JSON keeps the default', async () => {
    const { linkedSyncServices, DEFAULT_LINKED_SYNC_SERVICES } = await import('../linkedServices');
    expect(linkedSyncServices(undefined)).toEqual(DEFAULT_LINKED_SYNC_SERVICES);
    expect(parseLinkedServices({ services: linkedSyncServices(undefined) })[0].name).toBe('My Files');
    expect(linkedSyncServices('[]')).toEqual([]);
    expect(linkedSyncServices('[{"name":"X","url":"/x","enabled":true}]')).toEqual([{ name: 'X', url: '/x', enabled: true }]);
    expect(linkedSyncServices('{oops')).toEqual(DEFAULT_LINKED_SYNC_SERVICES);
  });
});
