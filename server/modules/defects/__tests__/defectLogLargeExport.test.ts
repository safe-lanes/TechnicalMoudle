import { it, expect } from 'vitest';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';

it('exports more than 1000 matching records from page 2 and freezes scope/filter state during retrieval', async () => {
  const browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', args: ['--no-sandbox'], headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const all = Array.from({ length: 1238 }, (_, i) => ({
    id: `LARGE-${String(i+1).padStart(4,'0')}`, duuid: `large-${i+1}`,
    vesselId: 'fixture', vesselName: 'Fixture Vessel', issueDate: '2026-10-29',
    description: '<p>Pump &amp; valve</p>', category: 'Defect', componentHardwareLevel3: 'Main Pump',
    status: 'Open', priority: i%13===0 ? 'Medium' : 'High', actions: [], linkedDefects: [],
  }));
  const expected = all.filter(row => row.priority === 'High');
  expect(expected.length).toBeGreaterThan(1000);
  let releaseExport: (() => void) | undefined;
  let exportStarted: (() => void) | undefined;
  let holdExport = true;
  await page.route('**/technical/api/defects/log-page?**', async route => {
    const url = new URL(route.request().url());
    const match = JSON.parse(url.searchParams.get('match')!);
    const exporting = url.searchParams.get('export') === 'true';
    const items = match.search ? all.filter(row => row.id.includes(match.search)) : all;
    const totalPages = Math.max(1, Math.ceil(items.length/100));
    const current = Math.min(Number(url.searchParams.get('page')), totalPages);
    if (exporting && holdExport) {
      await new Promise<void>(resolve => { releaseExport = resolve; exportStarted?.(); });
    }
    await route.fulfill({ json: { items: exporting ? items : items.slice((current-1)*100,current*100),
      total: items.length, totalPages, page: current, pageSize: 100 } });
  });
  try {
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/defects/active`);
    const next = page.getByTestId('button-defects-next-page');
    await next.waitFor({ timeout: 45_000 });
    await page.getByText('LARGE-0001', { exact: true }).first().waitFor();
    await next.click();
    await page.getByText('LARGE-0101', { exact: true }).first().waitFor();
    const header = page.locator('.ag-header-cell[col-id="priority"]');
    await header.hover();
    await header.locator('.ag-header-cell-filter-button').click();
    await page.locator('.ag-popup').getByRole('checkbox', { name: 'Medium', exact: true }).uncheck();
    await page.keyboard.press('Escape');

    const started = new Promise<void>(resolve => { exportStarted = resolve; });
    const csvDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    await started;
    // A changed search must not change the already-requested export scope.
    await page.getByPlaceholder('Search Defect').fill('no-such-record');
    releaseExport!();
    holdExport = false;
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toBe('defects_log.csv');
    const csvBook = XLSX.readFile((await csv.path())!);
    const csvRows = XLSX.utils.sheet_to_json<Record<string,string>>(csvBook.Sheets[csvBook.SheetNames[0]]);
    expect(csvRows.map(row => row.ID)).toEqual(expected.map(row => row.id));
    expect(csvRows[0].Description).toBe('Pump & valve');

    await page.getByPlaceholder('Search Defect').fill('');
    await page.getByText('LARGE-0002', { exact: true }).first().waitFor();
    await next.click();
    await page.getByText('LARGE-0101', { exact: true }).first().waitFor();
    // Empty toolbar results can refresh AG Grid's available set values. Select
    // the desired export filter explicitly after restoring the toolbar scope.
    await header.hover();
    await header.locator('.ag-header-cell-filter-button').click();
    await page.locator('.ag-popup').getByRole('checkbox', { name: 'Medium', exact: true }).uncheck();
    await page.keyboard.press('Escape');
    const excelDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
    const excel = await excelDownload;
    expect(excel.suggestedFilename()).toBe('defects_log.xlsx');
    const workbook = XLSX.readFile((await excel.path())!);
    expect(workbook.SheetNames).toEqual(['Defects Log']);
    expect(XLSX.utils.sheet_to_json<Record<string,string>>(workbook.Sheets['Defects Log']).map(row => row.ID))
      .toEqual(expected.map(row => row.id));
    const pdfDownload = page.waitForEvent('download');
    await page.getByTestId('button-export-defects-log').click();
    const pdf = await pdfDownload;
    expect(pdf.suggestedFilename()).toMatch(/^Defects_Log_\d{8}_\d{4}\.pdf$/);
    const text = (await fs.readFile((await pdf.path())!)).toString('latin1');
    expect(text).toContain(`Total: ${expected.length} defects`);
    expect(text.match(/LARGE-\d{4}/g)).toEqual(expected.map(row => row.id));
  } finally {
    releaseExport?.();
    await browser.close();
  }
}, 120_000);
