/**
 * Real-browser regression, isolated fixture vessel with cleanup.
 * node --import tsx tests/e2e/stores-pagination.browser.ts
 */
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getPool } from "../../server/db";
import XLSX from "xlsx";
import { readFile } from "node:fs/promises";

const pool = await getPool();
const vessel = randomUUID();
const prefix = `Paging-${vessel.slice(0, 8)}`;
const ids: number[] = [];
const failures: string[] = [];
const network: string[] = [];
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  await pool.query("INSERT INTO vessels(id,vuuid,name,code) VALUES($1,$1,$2,$2)", [vessel, prefix]);
  for (const tab of ["stores", "chemicals"]) {
    const rows = await pool.query(`INSERT INTO stores_items(stuuid,vessel_id,item_type,item_code,item_name,category,uom,rob,rob_location_a,rob_location_b,min,location_a,location_b)
      SELECT gen_random_uuid()::text,$1,$2,'TEST-'||lpad(g::text,3,'0'),$3||' item '||lpad(g::text,3,'0'),'Engine Stores','pcs',10,6,4,5,
      CASE WHEN g=31 THEN 'Hidden location' ELSE 'Bay A' END,'Bay B'
      FROM generate_series(1,31) g RETURNING id`, [vessel, tab, prefix]);
    ids.push(...rows.rows.map(r => r.id));
  }
  const context = await browser.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`, ignoreHTTPSErrors: true, acceptDownloads: true });
  await context.addInitScript(id => { localStorage.setItem("selectedVesselId", id); }, vessel);
  const page = await context.newPage();
  page.on("pageerror", e => failures.push(e.message));
  page.on("response", response => {
    if (response.url().includes("/api/stores")) {
      network.push(new URL(response.url()).pathname);
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("dialog", d => d.accept());
  await page.goto("/stores");
  await expect(page.getByTestId("stores-server-pagination")).toContainText("of 31", { timeout: 60000 });
  await expect(page.getByTestId("stores-inventory-grid")).toContainText("TEST-001");
  if (process.argv.includes("--controls-only")) {
    const grid = page.getByTestId("stores-inventory-grid");
    // Full-scope set options must include an item not in the first page.
    await grid.locator('.ag-header-cell[col-id="itemCode"] .ag-header-cell-filter-button').click();
    const filter = page.locator(".ag-set-filter");
    await filter.getByText("(Select All)", { exact: true }).click();
    await filter.getByPlaceholder("Search...").fill("TEST-031");
    await filter.getByText("TEST-031", { exact: true }).click();
    await expect(page.getByTestId("stores-server-pagination")).toContainText("of 1");
    await page.keyboard.press("Escape");
    await expect(grid).toContainText("TEST-031");
    // Reload resets grid-only criteria without changing application export scope.
    await page.reload();
    await expect(page.getByTestId("stores-server-pagination")).toContainText("of 31");
    const nameHeader = grid.locator('.ag-header-cell[col-id="itemName"] .ag-header-cell-label');
    await nameHeader.click(); await nameHeader.click();
    await expect(grid.locator('.ag-center-cols-container .ag-row[row-index="0"] [col-id="itemCode"]')).toHaveText("TEST-031");
    console.log("PASS grid set filter finds an off-page value, full-dataset sort");
    await page.reload();
    await expect(grid).toContainText("TEST-001");
    await grid.getByRole("button", { name: "Delete Item", exact: true }).first().click();
    await page.getByTestId("checkbox-select-all").click();
    await expect(page.getByTestId("text-selected-count")).toContainText("31 item(s)");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByTestId(`checkbox-store-${ids[30]}`)).toBeChecked();
    await page.getByTestId(`checkbox-store-${ids[30]}`).uncheck();
    await expect(page.getByTestId("text-selected-count")).toContainText("30 item(s)");
    const deleted = page.waitForResponse(response => response.url().includes("/targets/inactivate"));
    await page.getByTestId("button-delete-selected").click();
    const result = await (await deleted).json();
    expect(result.data.succeeded).toBe(30); expect(result.data.failedIds).toEqual([]);
    const active = await pool.query("SELECT count(*)::int AS n FROM stores_items WHERE vessel_id=$1 AND item_type='stores' AND is_active=true", [vessel]);
    expect(active.rows[0].n).toBe(1);
    console.log("PASS Select All spans 31 records with an off-page exclusion and correct action targets");
  } else {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("stores-server-pagination")).toContainText("26–31");
  await expect(page.getByTestId("stores-inventory-grid").locator(".ag-row")).toHaveCount(6);
  const search = page.getByPlaceholder("Search", { exact: true });
  await search.fill("item 031");
  await expect(page.getByTestId("stores-server-pagination")).toContainText("of 1");
  await expect(page.getByTestId("stores-inventory-grid").locator(".ag-row")).toHaveCount(1);
  await search.fill("");
  await expect(page.getByTestId("stores-server-pagination")).toContainText("of 31");
  // Off-page location and complete inventory export from Location.
  await page.getByTestId("tab-stores-by-location").click();
  await page.getByTestId("stores-location-item-Hidden location").click();
  await expect(page.getByTestId("stores-by-location-grid").locator(".ag-row")).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("stores-loc-export").click();
  const download = await downloadPromise;
  const workbook = XLSX.read(await readFile((await download.path())!));
  expect(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])).toHaveLength(31);
  console.log("PASS inventory paging, cross-page search, location aggregation, full-scope export");
  // Cross-page receive drafts.
  await page.goto("/stores/bulk-update?tab=stores");
  await page.getByTestId("select-transaction-mode").click();
  await page.getByRole("option", { name: "Receive", exact: true }).click();
  await page.getByTestId("input-bulk-received-date").fill("2026-10-26");
  await expect(page.getByTestId("bulk-update-stores-grid")).toContainText("TEST-001");
  const firstId = ids[0], lastId = ids[30];
  await page.getByTestId(`input-receive-a-${firstId}`).fill("1");
  await page.getByTestId("button-next-page").click();
  await page.getByTestId(`input-receive-a-${lastId}`).fill("2");
  await page.getByTestId("button-prev-page").click();
  await expect(page.getByTestId(`input-receive-a-${firstId}`)).toHaveValue("1");
  await page.getByTestId("button-save-updates").click();
  await page.getByTestId("button-confirm-save").click();
  await page.waitForURL("**/stores");
  const saved = await pool.query("SELECT id,rob_location_a FROM stores_items WHERE id=ANY($1)", [[firstId, lastId]]);
  expect(Number(saved.rows.find(r => r.id === firstId).rob_location_a)).toBe(7);
  expect(Number(saved.rows.find(r => r.id === lastId).rob_location_a)).toBe(8);
  console.log("PASS cross-page quantity draft preservation and both saves");
  // Chemicals Apply to All is independent of local search and deferred until Save.
  await page.goto("/stores/bulk-update?tab=chemicals");
  await page.getByTestId("select-transaction-mode").click();
  await page.getByRole("option", { name: "Receive", exact: true }).click();
  await page.getByPlaceholder(/search/i).fill("item 001");
  await page.getByTestId("input-bulk-batch-number").fill("ALL");
  await page.getByTestId("button-apply-batch-all").click();
  await expect(page.getByTestId("button-save-chem-updates")).toBeEnabled();
  const chemFirst = ids[31];
  await expect(page.getByTestId(`input-chem-batch-${chemFirst}`)).toHaveValue("ALL");
  await page.getByTestId(`input-chem-batch-${chemFirst}`).fill("OVERRIDE");
  expect((await pool.query("SELECT count(*)::int AS n FROM stores_items WHERE vessel_id=$1 AND batch_number='ALL'", [vessel])).rows[0].n).toBe(0);
  await page.getByPlaceholder(/search/i).fill("");
  await page.getByTestId("button-next-page").click();
  const chemicalResponse = page.waitForResponse(response => response.url().includes("/chemicals/update"));
  await page.getByTestId("button-save-chem-updates").click();
  const result = await (await chemicalResponse).json();
  expect(result.data.failedIds).toEqual([]);
  await expect(page.getByTestId("button-save-chem-updates")).toBeDisabled();
  const chemical = await pool.query("SELECT batch_number,count(*)::int AS n FROM stores_items WHERE vessel_id=$1 AND item_type='chemicals' GROUP BY batch_number", [vessel]);
  expect(chemical.rows.find(r => r.batch_number === "ALL")?.n).toBe(30);
  expect(chemical.rows.find(r => r.batch_number === "OVERRIDE")?.n).toBe(1);
  console.log("PASS deferred full-scope Chemicals Apply to All and off-page override");
  expect(network.filter(url => /\/stores\/[^/]+$/.test(url))).toEqual([]);
  }
  expect(failures).toEqual([]);
  console.log("PASS no full-list fallback requests or page errors", { storesRequests: network.length });
  await context.close();
} finally {
  await browser.close();
  // Only this fixture's data. Keep cleanup scoped to the unique UUID/ID set.
  await pool.query("DELETE FROM stores_ledger WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM sync_field_log WHERE vessel_id=$1 AND table_name='stores_items'", [vessel]);
  await pool.query("DELETE FROM stores_items WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM stores_operation_targets WHERE targets @> $1::jsonb", [JSON.stringify([{ vesselId: vessel }])]).catch(() => {});
  await pool.query("DELETE FROM vessels WHERE id=$1", [vessel]);
  await pool.end();
  if (failures.length) console.error(failures);
}
