import { existsSync, readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';

test.setTimeout(60_000);
test.use({
  baseURL: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://127.0.0.1:5000',
  viewport: { width: 1440, height: 900 },
  launchOptions: { executablePath: existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined },
});

const fixture = {
  id: 'RESIZE-001', duuid: 'resize-fixture', vesselId: 'resize-vessel', vesselName: 'Resize Vessel',
  category: 'Defect', description: 'Column resize regression fixture', componentHardwareLevel3: 'Test component',
  issueDate: '2026-11-01', targetCloseDate: '2099-11-30', status: 'Open', verified: false, is_coc: true,
  priority: 'Medium', actions: [], targetDateExtensions: [], attachments: [], partAAttachments: [],
  partCAttachments: [], closureFiles: [], linkedDefects: [],
};

async function drag(page: Page, header: Locator, delta: number) {
  if (await header.getAttribute('col-id') === 'actions') {
    // Growing the last column moves its right edge beyond the old scroll position.
    await page.locator('.defects-resizable-grid .ag-body-horizontal-scroll-viewport')
      .evaluate(el => { el.scrollLeft = el.scrollWidth; });
  }
  const handle = header.locator('.ag-header-cell-resize');
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  const width = (await header.boundingBox())!.width;
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + delta, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await header.boundingBox())!.width).toBeCloseTo(width + delta, 0);
  return (await header.boundingBox())!.width;
}

for (const screen of ['active', 'coc']) {
  test(`${screen}: resize both ways, retain widths, filter, export and view without mutations`, async ({ page }) => {
    // Isolate test data in browser responses, never create/update/delete real client records.
    await page.route('**/technical/api/defects**', async route => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET') return route.abort();
      if (url.pathname === '/technical/api/defects') return route.fulfill({ json: [fixture] });
      if (url.pathname === `/technical/api/defects/${fixture.id}`) return route.fulfill({ json: fixture });
      return route.continue();
    });
    await page.goto(`/defects/${screen}`);
    const grid = page.locator('.defects-resizable-grid');
    const header = grid.locator('.ag-header-cell[col-id="id"]');
    await expect(header).toBeVisible();
    const order = await grid.locator('.ag-header-cell').evaluateAll(cells => cells.map(c => c.getAttribute('col-id')));
    const initialWidth = (await header.boundingBox())!.width;
    await drag(page, header, 70);
    const chosenWidth = await drag(page, header, -30);
    expect(chosenWidth).toBeGreaterThan(initialWidth);
    expect(await grid.locator('.ag-header-cell').evaluateAll(cells => cells.map(c => c.getAttribute('col-id')))).toEqual(order);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(async () => (await header.boundingBox())!.width).toBeCloseTo(chosenWidth, 0);

    const horizontal = grid.locator('.ag-body-horizontal-scroll-viewport');
    await horizontal.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    const actions = grid.locator('.ag-header-cell[col-id="actions"]');
    await expect(actions).toBeVisible();
    await drag(page, actions, 35);
    await drag(page, actions, -20);

    await horizontal.evaluate(el => { el.scrollLeft = 0; });
    await header.locator('.ag-header-cell-text').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await header.locator('.ag-header-cell-filter-button').click();
    const filter = page.locator('.ag-filter input[type="text"]').first();
    await filter.fill('NO-MATCH');
    await expect(grid.locator('.ag-center-cols-container .ag-row')).toHaveCount(0);
    await filter.fill(fixture.id);
    await expect(grid.locator('.ag-center-cols-container .ag-row')).toHaveCount(1);
    await page.keyboard.press('Escape');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    expect(readFileSync((await file.path())!, 'utf8')).toContain(fixture.description);
    await page.getByPlaceholder(screen === 'coc' ? 'Search CoC Defect' : 'Search Defect').fill('Column resize');
    await expect.poll(async () => (await header.boundingBox())!.width).toBeCloseTo(chosenWidth, 0);

    await page.setViewportSize({ width: 700, height: 900 });
    await expect.poll(async () => (await header.boundingBox())!.width).toBeCloseTo(chosenWidth, 0);
    expect(await horizontal.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await horizontal.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.getByTestId(`button-view-${screen === 'coc' ? 'coc-' : ''}${fixture.id}`).click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
  });
}
