import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'officeReviewer.browser.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: '/tmp/office-reviewer-playwright-results',
  use: {
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    browserName: 'chromium',
    launchOptions: { executablePath: '/repl/tools/bin/chromium', args: ['--no-sandbox'] },
  },
});
