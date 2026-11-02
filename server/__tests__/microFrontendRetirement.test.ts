import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const mocks = vi.hoisted(() => ({
  App: () => null,
  MicroFrontendWrapper: () => null,
  useMicroFrontendConfig: () => ({}),
}));

vi.mock('../../client/src/App', () => ({ default: mocks.App }));
vi.mock('../../client/src/micro-frontend/MicroFrontendWrapper', () => ({
  MicroFrontendWrapper: mocks.MicroFrontendWrapper,
  useMicroFrontendConfig: mocks.useMicroFrontendConfig,
}));
vi.mock('../../client/src/micro-frontend/micro-frontend.css', () => ({}));

// Bootstrap uses CommonJS require, which vi.mock does not intercept.
const require = createRequire(import.meta.url);
const ReactDOM = require('react-dom/client');
const retiredNames = ['ElementCrewAppraisals', 'AppraisalForm', 'AdminModule', 'FormEditor'];
const repositoryFile = (name: string) => fileURLToPath(new URL(`../../${name}`, import.meta.url));

describe('minimal legacy micro-frontend retirement contract', () => {
  const render = vi.fn();
  const unmount = vi.fn();
  let createRoot: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    render.mockReset();
    unmount.mockReset();
    createRoot = vi.spyOn(ReactDOM, 'createRoot').mockReturnValue({ render, unmount });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('retains exactly the supported exports and imports without window', async () => {
    expect(typeof window).toBe('undefined');
    const entry = await import('../../client/src/micro-frontend/index');
    expect(Object.keys(entry).sort()).toEqual([
      'App', 'MicroFrontendWrapper', 'bootstrap', 'useMicroFrontendConfig',
    ].sort());
    expect(entry.App).toBe(mocks.App);
    expect(entry.MicroFrontendWrapper).toBe(mocks.MicroFrontendWrapper);
    expect(entry.useMicroFrontendConfig).toBe(mocks.useMicroFrontendConfig);
    expect(typeof entry.bootstrap).toBe('function');
    expect(createRoot).not.toHaveBeenCalled();
  });

  it('registers the unchanged global shape with only App inside components', async () => {
    vi.stubGlobal('window', {});
    const entry = await import('../../client/src/micro-frontend/index');
    expect((window as any).ElementCrewAppraisals).toEqual({
      bootstrap: entry.bootstrap,
      MicroFrontendWrapper: mocks.MicroFrontendWrapper,
      components: { App: mocks.App },
    });
    expect(createRoot).not.toHaveBeenCalled();
  });

  it('preserves App mount, configuration merging, rendering and unmount', async () => {
    const entry = await import('../../client/src/micro-frontend/index');
    const element = {} as HTMLElement;
    const cleanup = entry.bootstrap({
      theme: 'dark', vesselId: 'base', standalone: true,
    }).mount(element, { vesselId: 'override', standalone: true });

    expect(createRoot).toHaveBeenCalledExactlyOnceWith(element);
    expect(render).toHaveBeenCalledTimes(1);
    const rendered = render.mock.calls[0][0];
    expect(rendered.type).toBe(mocks.MicroFrontendWrapper);
    expect(rendered.props.config).toEqual({
      theme: 'dark', vesselId: 'override', standalone: false,
    });
    expect(rendered.props.children.type).toBe(mocks.App);
    expect(unmount).not.toHaveBeenCalled();
    cleanup();
    expect(unmount).toHaveBeenCalledExactlyOnceWith();
  });

  it('preserves mount defaults when configuration is omitted', async () => {
    const entry = await import('../../client/src/micro-frontend/index');
    entry.bootstrap().mount({} as HTMLElement);
    expect(render.mock.calls[0][0].props.config).toEqual({ standalone: false });
  });

  it.each([...retiredNames, 'ArbitraryUnknown'])(
    'preserves the existing unknown-component error for %s',
    async (name) => {
      const entry = await import('../../client/src/micro-frontend/index');
      expect(() => entry.bootstrap().mountComponent(name, {} as HTMLElement))
        .toThrowError(new Error(`Component ${name} not found`));
      expect(createRoot).not.toHaveBeenCalled();
      expect(render).not.toHaveBeenCalled();
    },
  );

  it('retains only the App expose without executing the federation configuration', () => {
    const config = readFileSync(repositoryFile('micro-frontend.config.js'), 'utf8');
    const exposes = config.match(/exposes:\s*\{([\s\S]*?)\}/)?.[1];
    expect(exposes?.trim()).toBe('"./App": "./client/src/App.tsx"');
    for (const name of retiredNames) {
      expect(config).not.toContain(`"./${name}"`);
    }
  });

  it('completely removes the disconnected root-level appraisal page', () => {
    expect(existsSync(repositoryFile('ElementCrewAppraisals.tsx'))).toBe(false);
  });
});
