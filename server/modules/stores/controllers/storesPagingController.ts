import type { Request, Response } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { storePageQuery, storeStock, storeCaptureBody, storeInactivateBody, storeChemicalBody, type StoreTarget, type StorePageQuery } from "@shared/storesPagination";
import * as paging from "../repositories/storesPagingRepository";
import * as service from "../services/storesService";
import * as repo from "../repositories/storesRepository";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getDb } from "../../../db";
import { sql } from "drizzle-orm";
import { resolveStoresScope } from "../repositories/storesPagingScope";

async function parse(req: Request): Promise<StorePageQuery> {
  const q = storePageQuery.parse(req.query);
  // Validate JSON models on every route, including exports and snapshots.
  paging.criteria(req.params.vesselId, q, req.query.kind === "history");
  paging.ordering(q, req.query.kind === "history");
  if ((req as AuthenticatedRequest).rbac?.userType === "Ship" && q.bulk !== "true") q.activeOnly = "true";
  return resolveStoresScope(req, q);
}
const history = (req: Request) => req.query.kind === "history";
const badRequest = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
  try { return await fn(req, res); }
  catch (e: any) {
    if (e.statusCode >= 400 && e.statusCode < 500) return res.status(e.statusCode).json({ error: e.message });
    if (e instanceof z.ZodError || e instanceof SyntaxError || /Invalid|Unsupported|Unknown column|Use an explicit/.test(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }
};
export const page = badRequest(async (req, res) => {
  const q = await parse(req);
  // History field validation belongs to its own model, not inventory.
  res.json({ success: true, data: await paging.queryPage(req.params.vesselId, q, history(req)) });
});
export const locations = badRequest(async (req, res) => res.json({ success: true, data: await paging.queryLocations(req.params.vesselId, await parse(req)) }));
export const values = badRequest(async (req, res) => res.json({ success: true, data: await paging.queryValues(req.params.vesselId, await parse(req), String(req.query.column ?? ""), history(req)) }));
export const itemHistory = badRequest(async (req, res) => {
  const item = await repo.getStoresItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Stores item not found" });
  req.params.vesselId = item.vesselId;
  req.query.kind = "history";
  const q = await parse(req);
  res.json({ success: true, data: await paging.queryPage(item.vesselId, q, true, item.stuuid) });
});

const legacySelection = (req: Request) => {
  if (req.body?.token !== undefined || (Array.isArray(req.body?.applied) && req.body.applied.some((entry: any) => entry?.token !== undefined)))
    throw Object.assign(new Error("Stores selections have changed. Keep a copy of pending edits, refresh the page and select the records again."), { statusCode: 409 });
};
async function validateAssociations(targets: StoreTarget[], q: StorePageQuery, vesselId: string, additionalIds: number[] = []) {
  const current = new Map((await paging.queryTargetIdentities([...targets.map(t => t.id), ...additionalIds])).map(row => [row.id, row]));
  const allowedVessels = q.vesselIds === undefined ? null : new Set(q.vesselIds.split(",").filter(Boolean));
  const seen = new Map<number, string>();
  for (const target of targets) {
    if ((seen.has(target.id) && seen.get(target.id) !== target.vesselId) ||
      (current.has(target.id) && current.get(target.id)!.vesselId !== target.vesselId))
      throw Object.assign(new Error("Item vessel does not match the requested scope"), { statusCode: 403 });
    seen.set(target.id, target.vesselId);
  }
  for (const row of Array.from(current.values())) {
    if (!row.deleted && (row.itemType !== q.itemType ||
      (vesselId !== "all" && row.vesselId !== vesselId) ||
      (allowedVessels && !allowedVessels.has(row.vesselId))))
      throw Object.assign(new Error("Item is outside the requested scope"), { statusCode: 403 });
  }
}
export const capture = badRequest(async (req, res) => {
  legacySelection(req);
  if (req.body?.version !== 2) return res.status(409).json({ error: "Refresh Stores before selecting records; selection version 2 is required." });
  const body = storeCaptureBody.parse(req.body);
  const q = await parse(req);
  const ids = await paging.queryTargets(req.params.vesselId, q);
  const explicitIds = body.ids === undefined ? null : new Set(body.ids);
  const selected = explicitIds ? ids.filter(i => explicitIds.has(i.id)) : ids;
  if (!req.aborted && !res.destroyed) res.json({ success: true, data: { version: 2, targets: selected, total: selected.length } });
});
export const targetMembership = badRequest(async (req, res) => {
  res.status(409).json({ error: "Refresh Stores and reselect records. Membership is now maintained in the browser; pending edits are not automatically recovered." });
});
export const inactivateTargets = badRequest(async (req, res) => {
  legacySelection(req);
  const body = storeInactivateBody.parse(req.body);
  const q = await parse(req);
  // Existing delete applies only selected records still in the application-filtered list.
  const eligibleRows = await paging.queryTargets(req.params.vesselId, q);
  const eligible = new Map(eligibleRows.map(i => [i.id, i.vesselId]));
  await validateAssociations(body.targets, q, req.params.vesselId, body.additionalIds);
  const excluded = new Set(body.exclude);
  const failures: number[] = [];
  const additionalIds = new Set(body.additionalIds);
  const targets = new Map(body.targets.map(i => [i.id, i]));
  for (const item of eligibleRows) if (additionalIds.has(item.id)) targets.set(item.id, item);
  let succeeded = 0;
  for (const target of Array.from(targets.values())) if (!excluded.has(target.id) && eligible.has(target.id)) {
    try { await service.inactivateStoresItem(String(target.id), eligible.get(target.id)!); succeeded++; }
    catch { failures.push(target.id); }
  }
  res.json({ success: failures.length === 0, data: { succeeded, failedIds: failures } });
});
export const updateChemicals = badRequest(async (req, res) => {
  legacySelection(req);
  const body = storeChemicalBody.parse(req.body);
  const q = await parse(req);
  if (q.itemType !== "chemicals") return res.status(400).json({ error: "Chemical updates require the Chemicals tab" });
  const eligible = await paging.queryTargets(req.params.vesselId, { ...q, search: "", category: "", stockStatus: "", location: undefined });
  const allowed = new Map(eligible.map(i => [i.id, i.vesselId]));
  await validateAssociations(body.applied.flatMap(a => a.targets), q, req.params.vesselId);
  const patches = new Map<number, Record<string, string>>();
  for (const applied of body.applied) {
    for (const item of applied.targets) if (allowed.has(item.id)) patches.set(item.id, { ...patches.get(item.id), ...applied.values });
  }
  for (const item of body.overrides) {
    if (!allowed.has(item.id)) return res.status(403).json({ error: "Item is outside the requested scope" });
    patches.set(item.id, { ...patches.get(item.id), ...item.data });
  }
  let succeeded = 0;
  const succeededIds: number[] = [];
  const failedIds: number[] = [];
  for (const [id, patch] of Array.from(patches.entries())) {
    if (!Object.keys(patch).length) continue;
    try { await service.updateStoresItem(String(id), patch); succeeded++; succeededIds.push(id); }
    catch { failedIds.push(id); }
  }
  res.json({ success: failedIds.length === 0, data: { succeeded, failedIds, succeededIds,
    failedPatches: failedIds.map(id => ({ id, data: patches.get(id)! })) } });
});

export const bulkQuantities = badRequest(async (req, res) => {
  const entry = z.object({ itemId: z.number().int().positive(), quantity: z.number().positive().finite(),
    location: z.enum(["A", "B"]), notes: z.string().max(4000).optional(),
    place: z.string().max(500).optional(), dateLocal: z.string().max(100).optional() });
  const body = z.object({ mode: z.enum(["consume", "receive"]), items: z.array(entry).min(1).max(10000) }).parse(req.body);
  const q = await parse(req);
  const allowed = new Set((await paging.queryTargets(req.params.vesselId, { ...q, search: "", category: "", stockStatus: "", location: undefined })).map(i => i.id));
  if (body.items.some(i => !allowed.has(i.itemId))) return res.status(403).json({ error: "Item is outside the requested scope" });
  const succeeded: Array<{ itemId: number; location: string }> = [];
  const failures: Array<{ itemId: number; location: string; error: string }> = [];
  for (const item of body.items) {
    try {
      // Reuse the stock service: current ROB is checked at write time, not browser-page time.
      if (body.mode === "consume") await service.batchConsume([item], "user");
      else await service.batchReceive([item], undefined, "user");
      succeeded.push({ itemId: item.itemId, location: item.location });
    } catch (e: any) { failures.push({ itemId: item.itemId, location: item.location, error: e.message }); }
  }
  res.json({ success: !failures.length, data: { succeeded, failures } });
});

export const exportFile = badRequest(async (req, res) => {
  const q = { ...await parse(req), page: 1, pageSize: 200, filters: "{}", sort: "[]" };
  const isHistory = history(req);
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="stores_${q.itemType}_${isHistory ? "history" : "inventory"}.xlsx"`);
  const sheet = workbook.addWorksheet(isHistory ? "History" : "Inventory");
  const headers = isHistory ? ["Date", "Event", "Item Name", "Part Code", "UOM", "Qty Change", "ROB After", "Place", "User", "Remarks/Ref"]
    : ["Item Name", "Part Code", "UOM", "ROB", "Min", "Stock", "Location", "Category"];
  sheet.addRow(headers).commit();
  // One repeatable-read snapshot across the entire export, not separate mutable offsets.
  const db = await getDb();
  await db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const where = paging.criteria(req.params.vesselId, q, isHistory, false);
    const table = sql.raw(isHistory ? "stores_ledger" : "stores_items");
    let offset = 0;
    while (!res.destroyed) {
      const result = await tx.execute(sql`SELECT s.* ${isHistory ? sql`,to_char(${paging.historyDate(q.timeZone)},'DD-Mon-YYYY') AS display_date` : sql``}
        FROM ${table} s WHERE ${where} ORDER BY ${paging.ordering(q, isHistory)} LIMIT 200 OFFSET ${offset}`);
      for (const row of result.rows as any[]) {
        if (isHistory) {
          const qty = Number(row.qty_change_base) || 0;
          sheet.addRow([row.display_date || "-", row.event_type?.toUpperCase() || "UNKNOWN", row.item_name || `Item #${row.item_id}`, row.part_code || "", row.uom || "-",
            qty > 0 ? `+${qty}` : String(qty), Number(row.rob_after_base) || 0, row.place || "-", row.user_id || "System", row.remarks || row.ref || "-"]).commit();
        } else {
          const total = Number(row.rob) || Number(row.rob_location_a) + Number(row.rob_location_b);
          const min = Number(row.min) || 0;
          sheet.addRow([row.item_name || "", row.item_code || "", row.uom || "-", total, min, storeStock(total, min), row.location_a || "", row.category || ""]).commit();
        }
      }
      if (result.rows.length < 200) break;
      offset += 200;
    }
  });
  sheet.commit();
  await workbook.commit();
});
