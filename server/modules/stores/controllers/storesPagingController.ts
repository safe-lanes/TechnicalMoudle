import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import ExcelJS from "exceljs";
import { storePageQuery, storeStock, type StorePageQuery } from "@shared/storesPagination";
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

// Opaque server-side target snapshots: no full record arrays travel to the browser.
// Bound to authenticated identity in the tenant DB; survives process restarts
// and routing to a different application instance. IDs only, never full rows.
type Snapshot = {
  ids: Array<{id: number; vesselId: string}>;
  itemType: string;
};
const owner = (req: Request) => String((req as AuthenticatedRequest).user?.userUuid ?? (req as AuthenticatedRequest).user?.id ?? "");
async function snapshot(req: Request, token: string) {
  const db = await getDb();
  const result = await db.execute(sql`SELECT targets,item_type FROM stores_operation_targets WHERE token=${token} AND owner_uuid=${owner(req)}`);
  if (!result.rows.length) {
    throw Object.assign(new Error("Selection unavailable. Please select the records again."), { statusCode: 409 });
  }
  return { ids: result.rows[0].targets, itemType: result.rows[0].item_type } as Snapshot;
}
export const capture = badRequest(async (req, res) => {
  const q = await parse(req);
  const db = await getDb();
  // Session selections have no short TTL: drafts must not become invalid merely
  // because a user returned after a break. Prune abandoned state after 30 days.
  await db.execute(sql`DELETE FROM stores_operation_targets WHERE created_at < now()-interval '30 days'`);
  const count = await db.execute(sql`SELECT count(*)::int AS count FROM stores_operation_targets WHERE owner_uuid=${owner(req)}`);
  if (Number(count.rows[0].count) >= 1000) return res.status(429).json({ error: "Too many pending selections" });
  const ids = await paging.queryTargets(req.params.vesselId, q);
  const explicitIds = req.body.ids === undefined ? null : new Set(z.array(z.number().int().positive()).max(100000).parse(req.body.ids));
  const selected = explicitIds ? ids.filter(i => explicitIds.has(i.id)) : ids;
  const token = randomUUID();
  await db.execute(sql`INSERT INTO stores_operation_targets(token,owner_uuid,item_type,targets)
    VALUES(${token},${owner(req)},${q.itemType},${JSON.stringify(selected)}::jsonb)`);
  res.json({ success: true, data: { token, total: selected.length } });
});
const targetBody = z.object({
  token: z.string().uuid(),
  exclude: z.array(z.number().int().positive()).max(100000).default([]),
});
export const targetMembership = badRequest(async (req, res) => {
  const token = z.string().uuid().parse(req.body.token);
  const ids = z.array(z.number().int().positive()).max(200).parse(req.body.ids);
  const snap = await snapshot(req, token);
  const set = new Set(snap.ids.map(i => i.id));
  res.json({ success: true, data: ids.filter(id => set.has(id)) });
});
export const inactivateTargets = badRequest(async (req, res) => {
  const body = targetBody.parse(req.body);
  const snap = await snapshot(req, body.token);
  const q = await parse(req);
  // Existing delete applies only selected records still in the application-filtered list.
  const eligible = new Set((await paging.queryTargets(req.params.vesselId, q)).map(i => i.id));
  const excluded = new Set(body.exclude);
  const failures: number[] = [];
  const eligibleRows = await paging.queryTargets(req.params.vesselId, q);
  const additionalIds = new Set(z.array(z.number().int().positive()).max(100000).default([]).parse(req.body.additionalIds));
  const targets = new Map(snap.ids.map(i => [i.id, i]));
  for (const item of eligibleRows) if (additionalIds.has(item.id)) targets.set(item.id, item);
  let succeeded = 0;
  for (const target of Array.from(targets.values())) if (!excluded.has(target.id) && eligible.has(target.id)) {
    try { await service.inactivateStoresItem(String(target.id), target.vesselId); succeeded++; }
    catch { failures.push(target.id); }
  }
  res.json({ success: failures.length === 0, data: { succeeded, failedIds: failures } });
});
const chemicalPatch = z.object({
  expiryDate: z.string().max(100).optional(), batchNumber: z.string().max(500).optional(), sdsReference: z.string().max(2000).optional(),
}).strict();
export const updateChemicals = badRequest(async (req, res) => {
  const body = z.object({
    token: z.string().uuid().optional(), values: chemicalPatch.default({}),
    applied: z.array(z.object({ token: z.string().uuid(), values: chemicalPatch })).max(3).default([]),
    overrides: z.array(z.object({ id: z.number().int().positive(), data: chemicalPatch })).max(10000).default([]),
  }).parse(req.body);
  const q = await parse(req);
  if (q.itemType !== "chemicals") return res.status(400).json({ error: "Chemical updates require the Chemicals tab" });
  const eligible = await paging.queryTargets(req.params.vesselId, { ...q, search: "", category: "", stockStatus: "", location: undefined });
  const allowed = new Set(eligible.map(i => i.id));
  const targets = body.token ? (await snapshot(req, body.token)).ids : [];
  const patches = new Map<number, Record<string, string>>();
  for (const item of targets) if (allowed.has(item.id)) patches.set(item.id, body.values);
  for (const applied of body.applied) {
    for (const item of (await snapshot(req, applied.token)).ids) if (allowed.has(item.id)) patches.set(item.id, { ...patches.get(item.id), ...applied.values });
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
  res.json({ success: failedIds.length === 0, data: { succeeded, failedIds, succeededIds } });
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
