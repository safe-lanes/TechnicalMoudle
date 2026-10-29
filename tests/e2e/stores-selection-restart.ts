/**
 * Restart handshake: run this script, restart the managed application after
 * STORES_RESTART_READY, then send SIGUSR1 to the printed PID. Isolated fixture
 * only; the action excludes every captured target, so it writes no inventory.
 */
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getPool } from "../../server/db";

const pool = await getPool();
const vessel = randomUUID();
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  await pool.query(`INSERT INTO vessels(id,vuuid,name,code) VALUES($1,$1,$2,$2)`, [vessel, `Restart-${vessel.slice(0, 8)}`]);
  await pool.query(`INSERT INTO stores_items(stuuid,vessel_id,item_type,item_code,item_name,category,uom,rob,rob_location_a,rob_location_b,min)
    SELECT gen_random_uuid()::text,$1,'stores','RESTART-'||g,'Restart fixture '||g,'Engine','pcs',10,5,5,1 FROM generate_series(1,4) g`, [vessel]);
  const context = await browser.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`, ignoreHTTPSErrors: true });
  await context.addInitScript(id => localStorage.setItem("selectedVesselId", id), vessel);
  const page = await context.newPage();
  await page.goto("/stores");
  const grid = page.getByTestId("stores-inventory-grid");
  await expect(grid).toContainText("RESTART-1", { timeout: 45000 });
  await grid.getByRole("button", { name: "Delete Item", exact: true }).first().click();
  const response = page.waitForResponse(r => r.url().includes("/targets?"));
  await page.getByTestId("checkbox-select-all").click();
  const captured = (await (await response).json()).data;
  await expect(page.getByTestId("text-selected-count")).toContainText("4 item(s)");
  const continueAfterRestart = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Restart handshake timed out")), 150000);
    process.once("SIGUSR1", () => { clearTimeout(timeout); resolve(); });
  });
  console.log(`STORES_RESTART_READY pid=${process.pid}`);
  await continueAfterRestart;
  // The managed server may be ready before the external preview proxy reconnects.
  // Poll reads only; submit the bulk request exactly once after browser transport
  // recovers, never automatically retry a possibly completed write.
  await expect.poll(async () => {
    try {
      return (await context.request.get(`/technical/api/stores/${vessel}/paged?itemType=stores&pageSize=1`, { timeout: 3000 })).ok();
    } catch { return false; }
  }, { timeout: 60000, intervals: [1000, 2000] }).toBe(true);
  // Use the same browser context's cookie jar. Development HMR may reload or
  // disconnect the page document on restart; this test verifies captured-ID
  // transport across processes, not Vite's hot-reload lifecycle.
  const result = await context.request.post(`/technical/api/stores/${vessel}/targets/inactivate?itemType=stores`, {
    data: { version: 2, targets: captured.targets, exclude: captured.targets.map((t: { id: number }) => t.id) },
  });
  expect(result.status()).toBe(200);
  expect((await result.json()).data).toEqual({ succeeded: 0, failedIds: [] });
  console.log("PASS open-browser captured IDs accepted after application restart without recapture");
} finally {
  await browser.close();
  await pool.query(`DELETE FROM stores_items WHERE vessel_id=$1`, [vessel]);
  await pool.query(`DELETE FROM vessels WHERE id=$1`, [vessel]);
  await pool.end();
}
