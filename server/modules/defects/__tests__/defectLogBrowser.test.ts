import { it, expect } from 'vitest';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';

// Real browser, mocked list responses only. Never writes application records.
it('retains page/grid/export state and handles reset, races and errors in the running screen', async () => {
  const browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', args: ['--no-sandbox'], headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const requests: { page: number; search: string; exporting: boolean }[] = [];
  const all = Array.from({ length: 237 }, (_, i) => ({
    id: `TEST-${String(i + 1).padStart(4, '0')}`, duuid: `uuid-${i}`,
    vesselId: 'fixture', vesselName: 'Fixture Vessel', issueDate: '2026-10-29',
    category: 'Defect', description: '<p>Pump &amp; valve</p>', componentHardwareLevel3: 'Pump',
    targetCloseDate: '2026-12-01', status: 'Open', verified: false,
    priority: i % 2 ? 'High' : 'Medium', linkedDefects: [], actions: [],
  }));
  let fail = false;
  let truncateOnDelete = false;
  let legacyListReads = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/technical/api/defects') legacyListReads++;
  });
  await page.route('**/technical/api/defects/log-page?**', async route => {
    const url = new URL(route.request().url());
    const match = JSON.parse(url.searchParams.get('match')!);
    const requestedPage = Number(url.searchParams.get('page'));
    const exporting = url.searchParams.get('export') === 'true';
    requests.push({ page: requestedPage, search: match.search || '', exporting });
    if (match.search === 'slow') await new Promise(resolve => setTimeout(resolve, 350));
    if (fail) return route.fulfill({ status: 500, json: { error: 'Fixture error' } });
    const items = match.search ? all.filter(row => row.id.toLowerCase().includes(match.search.toLowerCase())) : all;
    const totalPages = Math.max(1, Math.ceil(items.length / 100));
    const pageNumber = Math.min(requestedPage, totalPages);
    await route.fulfill({ json: {
      items: exporting ? items : items.slice((pageNumber - 1) * 100, pageNumber * 100),
      total: items.length, page: pageNumber, pageSize: 100, totalPages,
    } });
  });
  await page.route('**/technical/api/defects/TEST-*', async route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    const row = all.find(row => row.id === id);
    if (route.request().method() === 'PATCH') Object.assign(row!, route.request().postDataJSON());
    if (route.request().method() === 'DELETE') {
      if (truncateOnDelete) all.splice(200);
      else all.splice(all.findIndex(row => row.id === id), 1);
    }
    await route.fulfill({ json: row || { success: true } });
  });
  try {
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/defects/active`);
    const next = page.getByTestId('button-defects-next-page');
    const info = page.getByTestId('text-defects-page-info');
    await next.waitFor({ timeout: 45_000 });
    await page.getByText('TEST-0001', { exact: true }).first().waitFor();
    await next.click();
    await page.getByText('TEST-0101', { exact: true }).first().waitFor();
    expect(await info.textContent()).toContain('Page 2 of 3');
    await page.waitForTimeout(300);
    expect(await info.textContent()).toContain('Page 2 of 3');
    const page2Requests = requests.filter(r => !r.exporting && r.page === 2);
    expect(page2Requests).toHaveLength(1);

    // A column's set-filter remains page-local and survives replacing rowData.
    const header = page.locator('.ag-header-cell[col-id="priority"]');
    await header.hover();
    await header.locator('.ag-header-cell-filter-button').click();
    const high = page.locator('.ag-popup').getByRole('checkbox', { name: 'High', exact: true });
    await high.uncheck();
    await page.keyboard.press('Escape');
    const activeFilter = page.locator('.ag-header-cell[col-id="priority"].ag-header-cell-filtered');
    expect(await activeFilter.count()).toBe(1);
    await next.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="text-defects-page-info"]')?.textContent?.includes('Page 3 of 3'));
    expect(await activeFilter.count()).toBe(1);
    await page.getByTestId('button-defects-prev-page').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="text-defects-page-info"]')?.textContent?.includes('Page 2 of 3'));
    expect(await activeFilter.count()).toBe(1);

    const csvPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const csv = await csvPromise;
    expect(csv.suggestedFilename()).toBe('defects_log.csv');
    const book = XLSX.readFile((await csv.path())!);
    const exported = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
    expect(exported).toHaveLength(119); // All Medium records, across all three pages.
    expect(requests.at(-1)?.exporting).toBe(true);

    const excelPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
    const excel = await excelPromise;
    expect(excel.suggestedFilename()).toBe('defects_log.xlsx');
    const workbook = XLSX.readFile((await excel.path())!);
    expect(workbook.SheetNames).toEqual(['Defects Log']);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets['Defects Log'])).toHaveLength(119);

    const pdfPromise = page.waitForEvent('download');
    await page.getByTestId('button-export-defects-log').click();
    const pdf = await pdfPromise;
    expect(pdf.suggestedFilename()).toMatch(/^Defects_Log_\d{8}_\d{4}\.pdf$/);
    const pdfBytes = await fs.readFile((await pdf.path())!);
    const pdfText = pdfBytes.toString('latin1');
    expect(pdfText.startsWith('%PDF-')).toBe(true);
    expect(pdfText).toContain('Total: 119 defects');
    expect(pdfText.match(/TEST-\d{4}/g)).toHaveLength(119);
    expect(pdfText).toContain('TEST-0237');

    fail = true;
    const downloads: string[] = [];
    page.on('download', download => downloads.push(download.suggestedFilename()));
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    await page.getByText('Could not create the Defect Log CSV file.', { exact: true }).waitFor();
    expect(downloads).toEqual([]);
    fail = false;

    await page.getByRole('button', { name: 'Clear Filters', exact: true }).click();
    const search = page.getByPlaceholder('Search Defect');
    await search.fill('TEST-0237');
    await page.getByText('TEST-0237', { exact: true }).first().waitFor();
    expect(requests.filter(r => r.search === 'TEST-0237').every(r => r.page === 1)).toBe(true);
    await search.fill('');
    await page.getByText('TEST-0001', { exact: true }).first().waitFor();
    expect(await info.textContent()).toContain('Page 1 of 3');
    await search.fill('slow');
    await search.fill('TEST-0237');
    await page.getByText('TEST-0237', { exact: true }).first().waitFor();
    await page.waitForTimeout(450);
    expect(await page.getByTestId('text-defects-pagination-info').textContent()).toContain('of 1');
    fail = true;
    await search.fill('fail');
    await page.getByRole('alert').filter({ hasText: 'Failed to fetch defects' }).waitFor();
    expect(await page.locator('.ag-row .ag-cell[col-id="id"]').count()).toBe(0);
    fail = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Failed to fetch defects' }).waitFor({ state: 'hidden' });
    expect(legacyListReads).toBe(0);

    // Mocked writes prove invalidation and last-page correction without live writes.
    await search.fill('');
    await page.getByText('TEST-0001', { exact: true }).first().waitFor();
    await next.click();
    const verify = page.getByTestId('button-verified-TEST-0101');
    await verify.click();
    const status = page.locator('.ag-row').filter({ has: verify }).locator('.ag-cell[col-id="status"]');
    await status.getByText('Verified', { exact: true }).waitFor();
    expect(await info.textContent()).toContain('Page 2 of 3');
    await verify.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes', exact: true }).click();
    await status.getByText('Verified', { exact: true }).waitFor({ state: 'hidden' });
    await page.getByTestId('button-view-TEST-0101').click();
    const viewDialog = page.getByRole('dialog', { name: 'View Defect Report', exact: true });
    await viewDialog.waitFor();
    await page.keyboard.press('Escape');
    await viewDialog.waitFor({ state: 'hidden' });
    await next.click();
    await page.getByTestId('button-delete-TEST-0201').waitFor();
    truncateOnDelete = true;
    // The legacy narrow action column's final icon sits beneath the grid's
    // scrollbar. Exercise its keyboard activation without changing that layout.
    await page.getByTestId('button-delete-TEST-0201').focus();
    await page.getByTestId('button-delete-TEST-0201').press('Enter');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="text-defects-page-info"]')?.textContent?.includes('Page 2 of 2'));
    expect(await page.getByTestId('text-defects-pagination-info').textContent()).toContain('101-200 of 200');
    expect(await next.isDisabled()).toBe(true);
  } finally { await browser.close(); }
}, 120_000);
