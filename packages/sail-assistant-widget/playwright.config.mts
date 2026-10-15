import { defineConfig, devices } from '@playwright/test';

// Browser tests of the BUILT bundle in three isolated hosts (plain HTML, Crewing-like React, Audit-like Angular) against
// the MOCK assistant + MOCK token endpoints in test/e2e/mockServer.mjs. Live tests against a pilot assistant are separate
// (test/e2e/live.spec.ts, only when WIDGET_LIVE_ASSISTANT is set).
// HOST_PORT overrides 4801 (e.g. when Windows reserves the 4754-4853 range after a Hyper-V/WSL restart).
const HOST = `http://localhost:${process.env.HOST_PORT || 4801}`;
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: HOST, ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
  webServer: { command: 'node test/e2e/mockServer.mjs', url: `${HOST}/plain/`, reuseExistingServer: true, timeout: 20_000 },
});
