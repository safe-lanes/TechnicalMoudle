import { it, expect } from "vitest";
import { chromium, expect as browserExpect, type Page } from "@playwright/test";

/** Interactive rendering with mocked fixtures only; never mutates tenant inventory. */
async function fixture() {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"], headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem("selectedVesselId", "selection-fixture"));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/technical/api/vessels", route => route.fulfill({ json: [
    { id: "selection-fixture", vuuid: "selection-fixture", name: "Selection Fixture", code: "FIX" },
  ] }));
  const records = Array.from({ length: 70 }, (_, i) => ({
    id: i + 1, vesselId: "selection-fixture", itemType: "chemicals",
    itemCode: `FIX-${String(i + 1).padStart(4, "0")}`, itemName: `Fixture item ${String(i + 1).padStart(4, "0")}`,
    category: "Engine", uom: "pcs", rob: 10, min: 1, robLocationA: 6, robLocationB: 4,
    locationA: "Bay A", locationB: "Bay B", isActive: true, batchNumber: "", expiryDate: "", sdsReference: "",
  }));
  const state = {
    captures: 0, memberships: 0, saves: [] as any[], deletes: [] as any[], pages: [] as number[],
    captureIds: records.map(r => r.id), hold: false, failCapture: false, failSave: false, partial: false,
    release: undefined as (() => void) | undefined,
  };
  await page.route(/\/technical\/api\/stores\//, async route => {
    const url = new URL(route.request().url());
    const action = url.pathname.split("/").at(-1);
    if (action === "membership") { state.memberships++; return route.fulfill({ status: 500, json: { error: "Membership endpoint must not be used" } }); }
    if (action === "targets") {
      state.captures++;
      expect(route.request().postDataJSON().version).toBe(2);
      const targets = state.captureIds.map(id => ({ id, vesselId: "selection-fixture" }));
      if (state.hold) await new Promise<void>(resolve => { state.release = resolve; });
      if (state.failCapture) return route.fulfill({ status: 503, json: { error: "Fixture capture failure" } });
      return route.fulfill({ json: { success: true, data: { version: 2, targets, total: targets.length } } });
    }
    if (action === "inactivate") {
      const body = route.request().postDataJSON(); state.deletes.push(body);
      return route.fulfill({ json: { success: true, data: { succeeded: body.targets.length - body.exclude.length, failedIds: [] } } });
    }
    if (action === "update") {
      const body = route.request().postDataJSON(); state.saves.push(body);
      if (state.failSave) return route.fulfill({ status: 503, json: { error: "Fixture save failure" } });
      return route.fulfill({ json: { success: !state.partial, data: {
        succeeded: state.partial ? 69 : 70, failedIds: state.partial ? [1] : [],
        succeededIds: [], failedPatches: state.partial ? [{ id: 1, data: { batchNumber: "individual" } }] : [],
      } } });
    }
    if (action === "values") return route.fulfill({ json: { success: true, data: [] } });
    const filtered = records.filter(row => `${row.itemName} ${row.itemCode}`.toLowerCase().includes((url.searchParams.get("search") || "").toLowerCase()));
    const size = Number(url.searchParams.get("pageSize") || 25), current = Number(url.searchParams.get("page") || 1);
    const items = filtered.slice((current - 1) * size, current * size);
    state.pages.push(items.length);
    return route.fulfill({ json: { success: true, data: {
      items, total: filtered.length, totalPages: Math.ceil(filtered.length / size), page: current, pageSize: size,
    } } });
  });
  return { browser, page, state, errors };
}
async function goto(page: Page, path: string) {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}${path}`);
}
async function openChemicals(page: Page) {
  await goto(page, "/stores/bulk-update?tab=chemicals");
  await page.getByTestId("select-transaction-mode").click();
  await page.getByRole("option", { name: "Receive", exact: true }).click();
}

it("retains complete cross-page membership locally, exclusions and bounded page requests", async () => {
  const f = await fixture();
  try {
    await goto(f.page, "/stores");
    const grid = f.page.getByTestId("stores-inventory-grid");
    await browserExpect(grid).toContainText("FIX-0001", { timeout: 45000 });
    await grid.getByRole("button", { name: "Delete Item", exact: true }).first().click();
    await f.page.getByTestId("checkbox-select-all").click();
    await browserExpect(f.page.getByTestId("text-selected-count")).toContainText("70 item(s)");
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await browserExpect(f.page.getByTestId("checkbox-store-26")).toBeChecked();
    await f.page.getByTestId("checkbox-store-26").uncheck();
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await browserExpect(f.page.getByTestId("checkbox-store-51")).toBeChecked();
    await f.page.getByTestId("checkbox-store-51").uncheck();
    await browserExpect(f.page.getByTestId("text-selected-count")).toContainText("68 item(s)");
    f.state.captureIds = Array.from({ length: 55 }, (_, i) => i + 1);
    await f.page.getByTestId("checkbox-select-all").click();
    await browserExpect(f.page.getByTestId("text-selected-count")).toContainText("55 item(s)");
    await f.page.getByTestId("checkbox-store-60").check();
    await browserExpect(f.page.getByTestId("text-selected-count")).toContainText("56 item(s)");
    await f.page.getByTestId("checkbox-select-all").click();
    await browserExpect(f.page.getByTestId("text-selected-count")).toContainText("0 item(s)");
    await f.page.getByTestId("checkbox-select-all").click();
    await browserExpect(f.page.getByTestId("text-selected-count")).toContainText("55 item(s)");
    expect(f.state.memberships).toBe(0); expect(f.state.captures).toBe(3);
    expect(f.state.pages.every(n => n <= 25)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.browser.close(); }
}, 90000);

it("preserves Apply/edit order during delayed capture and sends failure-only retry patches", async () => {
  const f = await fixture();
  try {
    await openChemicals(f.page);
    const individual = f.page.getByTestId("input-chem-batch-1");
    await browserExpect(individual).toBeVisible({ timeout: 45000 });
    await individual.fill("earlier");
    await f.page.getByTestId("input-bulk-batch-number").fill("common");
    f.state.hold = true;
    await f.page.getByTestId("button-apply-batch-all").click();
    await browserExpect.poll(() => !!f.state.release).toBe(true);
    await individual.fill("individual");
    f.state.release!(); f.state.hold = false;
    await browserExpect(individual).toHaveValue("individual");
    await browserExpect(f.page.getByTestId("input-chem-batch-2")).toHaveValue("common");
    await f.page.getByTestId("input-bulk-batch-number").fill("repeated");
    await f.page.getByTestId("button-apply-batch-all").click();
    await browserExpect(individual).toHaveValue("repeated");
    await individual.fill("individual");
    f.state.captureIds = [2];
    await f.page.getByTestId("input-bulk-sds-reference").fill("sds");
    await f.page.getByTestId("button-apply-sds-all").click();
    await browserExpect(f.page.getByTestId("input-chem-sds-2")).toHaveValue("sds");
    await browserExpect(f.page.getByTestId("input-chem-sds-1")).toHaveValue("");
    f.state.partial = true;
    await f.page.getByTestId("button-save-chem-updates").click();
    await browserExpect.poll(() => f.state.saves.length).toBe(1);
    await browserExpect(f.page.getByText("Some chemical updates failed", { exact: true }).first()).toBeVisible();
    expect(f.state.saves[0].applied[0].targets).toHaveLength(70);
    expect(f.state.saves[0].overrides).toContainEqual({ id: 1, data: { batchNumber: "individual" } });
    f.state.partial = false;
    await f.page.getByTestId("button-save-chem-updates").click();
    await browserExpect.poll(() => f.state.saves.length).toBe(2);
    expect(f.state.saves[1]).toEqual({ version: 2, applied: [], overrides: [{ id: 1, data: { batchNumber: "individual" } }] });
    expect(f.state.memberships).toBe(0); expect(f.errors).toEqual([]);
    // An explicitly failed empty draft is still retryable even though it equals
    // the original empty cell; it must not disappear through no-op detection.
    f.state.partial = true;
    f.state.failSave = false;
    f.state.captureIds = [1];
    await f.page.getByTestId("input-bulk-batch-number").fill("again");
    await f.page.getByTestId("button-apply-batch-all").click();
    await browserExpect(f.page.getByTestId("button-save-chem-updates")).toBeEnabled();
    await f.page.route("**/chemicals/update?*", route => route.fulfill({ json: { success: false, data: {
      succeeded: 0, failedIds: [1], succeededIds: [], failedPatches: [{ id: 1, data: { batchNumber: "" } }],
    } } }));
    await f.page.getByTestId("button-save-chem-updates").click();
    await browserExpect(individual).toHaveValue("");
    await browserExpect(f.page.getByTestId("button-save-chem-updates")).toBeEnabled();
    await f.page.unroute("**/chemicals/update?*");
    f.state.partial = false;
    await f.page.getByTestId("button-save-chem-updates").click();
    await browserExpect.poll(() => f.state.saves.length).toBe(3);
    expect(f.state.saves[2]).toEqual({ version: 2, applied: [], overrides: [{ id: 1, data: { batchNumber: "" } }] });
  } finally { f.state.release?.(); await f.browser.close(); }
}, 90000);

it("keeps pending edits after failed Save and does not publish failed Apply-to-All capture", async () => {
  const f = await fixture();
  try {
    await openChemicals(f.page);
    const individual = f.page.getByTestId("input-chem-batch-1");
    await browserExpect(individual).toBeVisible({ timeout: 45000 });
    await individual.fill("pending");
    f.state.failCapture = true;
    await f.page.getByTestId("input-bulk-batch-number").fill("failed-common");
    await f.page.getByTestId("button-apply-batch-all").click();
    await browserExpect(f.page.getByText("Apply to All failed", { exact: true }).first()).toBeVisible();
    await browserExpect(individual).toHaveValue("pending");
    await browserExpect(f.page.getByTestId("input-chem-batch-2")).toHaveValue("");
    f.state.failSave = true;
    await f.page.getByTestId("button-save-chem-updates").click();
    await browserExpect(f.page.getByText(/Fixture save failure.*may already have been applied/).first()).toBeVisible();
    await browserExpect(individual).toHaveValue("pending");
    expect(f.state.saves[0]).toEqual({ version: 2, applied: [], overrides: [{ id: 1, data: { batchNumber: "pending" } }] });
    expect(f.errors).toEqual([]);
  } finally { await f.browser.close(); }
}, 90000);
