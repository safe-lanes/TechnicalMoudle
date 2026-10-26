/**
 * Real browser + disposable development fixture vessel, cleaned in finally.
 * node --import tsx tests/e2e/spares-pagination.browser.ts
 */
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getPool } from "../../server/db";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

const pool = await getPool(), vessel = randomUUID(), component = randomUUID();
const prefix = `SparePaging-${vessel.slice(0, 8)}`;
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
const errors: string[] = [], requests: string[] = [], payloadSizes: number[] = [];
const fixtureIds: number[] = [];
try {
  await pool.query("INSERT INTO vessels(id,vuuid,name,code) VALUES($1,$1,$2,$2)", [vessel, prefix]);
  await pool.query(`INSERT INTO components(id,cuuid,vessel_id,component_code,name) VALUES($1,$1,$2,'6.1',$3)`, [component, vessel, prefix]);
  const inserted = await pool.query(`INSERT INTO spares(suuid,vessel_id,part_code,part_name,part_number,component_id,component_code,component_name,
    rob,rob_location_a,rob_location_b,min,location,location_2,critical)
    SELECT gen_random_uuid()::text,$1,'PTEST-'||lpad(g::text,3,'0'),$2||' part '||lpad(g::text,3,'0'),'PN-'||g,$3,'6.1',$2,
      10,6,4,5,'Location 001','Location 002','No' FROM generate_series(1,41) g RETURNING id,suuid`, [vessel, prefix, component]);
  fixtureIds.push(...inserted.rows.map(r => r.id));
  await pool.query(`INSERT INTO locations(luuid,vessel_id,location_name,created_by) SELECT gen_random_uuid()::text,$1,'Location '||lpad(g::text,3,'0'),'test'
    FROM generate_series(1,31) g`, [vessel]);
  const locations = await pool.query("SELECT id FROM locations WHERE vessel_id=$1 ORDER BY location_name", [vessel]);
  await pool.query(`INSERT INTO spare_location_stock(slsuuid,vessel_id,spare_id,spare_uuid,location_id,location_uuid,qty)
    SELECT gen_random_uuid()::text,s.vessel_id,s.id,s.suuid,l.id,l.luuid,6 FROM spares s CROSS JOIN locations l WHERE s.vessel_id=$1 AND l.vessel_id=$1
      AND (l.id=$2 OR s.id=$3)`, [vessel, locations.rows[0].id, fixtureIds[0]]);
  await pool.query(`INSERT INTO spare_component_links(scluuid,vessel_id,spare_id,spare_uuid,component_id,linked_by)
    SELECT gen_random_uuid()::text,$1,id,suuid,$2,'test' FROM spares WHERE vessel_id=$1`, [vessel, component]);
  await pool.query(`INSERT INTO spares_history(timestamp_utc,vessel_id,spare_id,spare_uuid,part_code,part_name,component_id,component_name,event_type,qty_change,rob_after,date_local,user_id)
    SELECT '2026-10-26 12:00:00'::timestamp+id*interval '1 second',vessel_id,id,suuid,part_code,part_name,component_id,component_name,'RECEIVE',1,10,'2026-10-26','test'
    FROM spares WHERE vessel_id=$1`, [vessel]);
  const context = await browser.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`, ignoreHTTPSErrors: true, acceptDownloads: true });
  await context.addInitScript(id => localStorage.setItem("selectedVesselId", id), vessel);
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => d.accept());
  page.on("response", async response => {
    if (response.url().includes(`/api/spares/${vessel}/`)) {
      requests.push(new URL(response.url()).pathname);
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      if (new URL(response.url()).pathname.endsWith("/paged")) {
        // Navigating away legitimately cancels in-flight page responses.
        const body = await response.json().catch(() => undefined);
        if (body) {
          payloadSizes.push(JSON.stringify(body).length);
          if (body.data.items.length > 25) errors.push("Page response exceeded the requested bound");
        }
      }
    }
  });
  if (!process.argv.includes("--bulk-only")) {
  await page.goto("/spares", { waitUntil: "domcontentloaded", timeout: 60000 });
  const inventory = page.getByTestId("spares-inventory-grid");
  await expect(inventory).toContainText("PTEST-001", { timeout: 60000 });
  await page.getByTestId("pagination-next").click();
  await expect(inventory).toContainText("PTEST-011");
  await expect(inventory.locator(".ag-center-cols-container .ag-row")).toHaveCount(10);
  const codeFilter = inventory.locator('.ag-header-cell[col-id="partCode"] .ag-header-cell-filter-button');
  await codeFilter.click();
  const filter = page.locator(".ag-set-filter");
  await filter.getByText("(Select All)", { exact: true }).click();
  await filter.getByPlaceholder("Search...").fill("PTEST-041");
  await filter.getByText("PTEST-041", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(inventory).toContainText("PTEST-041");
  await expect(inventory.locator(".ag-center-cols-container .ag-row")).toHaveCount(1);
  console.log("PASS inventory page 2, full-scope off-page header options/filter");
  await page.reload();
  await expect(inventory).toContainText("PTEST-001");
  const nameHeader = inventory.locator('.ag-header-cell[col-id="partName"] .ag-header-cell-label');
  await nameHeader.click(); await nameHeader.click();
  await expect(inventory.locator('.ag-center-cols-container .ag-row[row-index="0"] [col-id="partCode"]')).toHaveText("PTEST-041");
  // Existing page-based selection remains page-based, with selections retained.
  await inventory.locator(".ag-body-horizontal-scroll-viewport").evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await page.getByTestId("E36").click();
  await page.getByTestId("checkbox-select-all-spares").check();
  await expect(page.getByTestId(`checkbox-spare-${fixtureIds[40]}`)).toBeChecked();
  await page.getByTestId("pagination-next").click();
  await expect(page.getByTestId(`checkbox-spare-${fixtureIds[30]}`)).not.toBeChecked();
  await page.getByTestId("pagination-prev").click();
  await expect(page.getByTestId(`checkbox-spare-${fixtureIds[40]}`)).toBeChecked();
  console.log("PASS full-scope sort and Select All Visible retains only the selected page");
  await page.getByTestId("tab-by-location").click();
  await page.getByTestId(`location-item-${locations.rows[0].id}`).click();
  await expect(page.getByTestId("spares-by-location-grid")).toContainText("PTEST-001");
  await page.getByTestId("spares-location-pagination").getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId(`location-item-${locations.rows[30].id}`)).toBeVisible();
  await page.getByTestId("input-location-search").fill("031");
  await expect(page.getByTestId("spares-location-pagination")).toContainText("1 / 1");
  await page.getByTestId(`location-item-${locations.rows[30].id}`).click();
  await expect(page.getByTestId("spares-by-location-grid").locator(".ag-center-cols-container .ag-row")).toHaveCount(1);
  console.log("PASS independent location navigation pages/search and item pages");
  await page.getByTestId("E3").click();
  await expect(page.getByTestId("spares-history-grid")).toContainText("PTEST-041");
  const historyDownload = page.waitForEvent("download");
  await page.getByTestId("E9").click();
  const historyBook = new ExcelJS.Workbook();
  await historyBook.xlsx.load(await readFile((await (await historyDownload).path())!) as any);
  expect(historyBook.getWorksheet("Spares History")!.rowCount).toBe(42);
  console.log("PASS timestamp-descending History and complete 41-row server export");
  }
  await page.goto("/spares/bulk-update", { waitUntil: "domcontentloaded" });
  await page.getByTestId("select-transaction-mode").click();
  await page.getByRole("option", { name: "Receive", exact: true }).click();
  const first = fixtureIds[0], last = fixtureIds[40];
  await page.getByTestId("input-bulk-transaction-date").fill("2026-10-26");
  await page.getByTestId(`input-receive-a-${first}`).fill("1");
  await page.getByTestId("button-next-page").click();
  await page.getByTestId(`input-receive-a-${last}`).fill("2");
  await page.getByTestId("button-prev-page").click();
  await expect(page.getByTestId(`input-receive-a-${first}`)).toHaveValue("1");
  await page.getByTestId("button-save-updates").click();
  const savedRequest = page.waitForRequest(r => r.method() === "POST" && r.url().includes("/spares/bulk-update"));
  const savedResponse = page.waitForResponse(r => r.request().method() === "POST" && r.url().includes("/spares/bulk-update"));
  await page.getByTestId("button-confirm-save").click();
  const payload = (await savedRequest).postDataJSON();
  expect(payload.rows.map((r: any) => r.componentSpareId).sort((a: number, b: number) => a - b)).toEqual([first, last]);
  const results = await (await savedResponse).json();
  if (!results.every((r: any) => r.success)) console.error("Bulk operation returned:", JSON.stringify(results));
  expect(results.every((r: any) => r.success), JSON.stringify(results)).toBe(true);
  await page.waitForURL("**/spares");
  const saved = await pool.query("SELECT id,rob_location_a FROM spares WHERE id=ANY($1)", [[first, last]]);
  expect(saved.rows.find(r => r.id === first).rob_location_a).toBe(7);
  expect(saved.rows.find(r => r.id === last).rob_location_a).toBe(8);
  console.log("PASS Bulk Update cross-page drafts, original receive payload and both stock updates");
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ maxPageBytes: Math.max(...payloadSizes), pageResponses: payloadSizes.length, errors, requestPaths: [...new Set(requests)] }, null, 2));
} finally {
  await browser.close();
  await pool.query("DELETE FROM sync_field_log WHERE vessel_id=$1 AND table_name IN ('spares','spares_history','spare_location_stock')", [vessel]);
  await pool.query("DELETE FROM inventory_transactions WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM spares_history WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM spare_component_links WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM spare_location_stock WHERE spare_id=ANY($1)", [fixtureIds]);
  await pool.query("DELETE FROM spares WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM locations WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM components WHERE vessel_id=$1", [vessel]);
  await pool.query("DELETE FROM vessels WHERE vuuid=$1", [vessel]); await pool.end();
}
