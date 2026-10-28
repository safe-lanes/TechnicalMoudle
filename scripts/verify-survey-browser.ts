/** Read-only UI smoke test; requires the app's existing development login mode.
 * Run: node --import tsx scripts/verify-survey-browser.ts "https://$REPLIT_DEV_DOMAIN"
 * Does not sign in, edit Survey records or upload/delete files.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

const base = process.argv[2];
if (!base) throw new Error('Pass the development app URL');
const browser = await chromium.launch({
  executablePath: execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim(),
  headless: true, args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let listRequests = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/technical/api/surveys') {
      assert.equal(request.method(), 'GET', 'Smoke test must never write Surveys');
      listRequests++;
    }
  });
  await page.goto(`${base}/cert-surveys/surveys`);
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible({ timeout: 30000 });
  const nextResponse = page.waitForResponse(r => r.url().includes('/technical/api/surveys?')
    && new URL(r.url()).searchParams.get('page') === '2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const result = await (await nextResponse).json();
  assert.equal(result.page, 2);
  assert.equal(result.limit, 100);
  await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
  const requestsAfterPaging = listRequests;

  await page.locator('.ag-header-cell[col-id="companyId"] .ag-header-cell-filter-button').click();
  const search = page.locator('.ag-filter-body-wrapper input.ag-input-field-input').first();
  await search.fill('__NO_MATCH_SURVEY_SMOKE_TEST__');
  await expect(page.locator('.ag-center-cols-container .ag-row')).toHaveCount(0);
  assert.equal(listRequests, requestsAfterPaging, 'Column text search must stay local');
  await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
  await search.fill('');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ag-center-cols-container .ag-row').first()).toBeVisible();

  await page.getByRole('combobox').click();
  await page.getByTestId('option-due-overdue').click();
  await expect(page.getByRole('combobox')).toHaveText('Overdue');
  await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
  assert.equal(listRequests, requestsAfterPaging, 'Due In must stay local and preserve page totals');
  await page.getByRole('combobox').click();
  await page.getByTestId('option-due-all').click();
  await expect(page.locator('.ag-center-cols-container .ag-row').first()).toBeVisible();
  console.log(JSON.stringify({ nextPage: result.page, total: result.total, rows: result.surveys.length,
    localTextFilter: true, localDueIn: true, unchangedPageTotals: true, surveyWrites: 0 }));
} finally { await browser.close(); }
