import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './components',
  testMatch: 'approval-workflow.browser.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: '/tmp/approval-workflow-playwright-results',
  use: {
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    browserName: 'chromium',
    launchOptions: { executablePath: '/repl/tools/bin/chromium', args: ['--no-sandbox'] },
  },
});
