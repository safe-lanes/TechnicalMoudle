import type { Request, Response } from "express";
import { z } from "zod";
import { sparePageQuery, type SparePageQuery } from "@shared/sparesPagination";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { resolveSparesScope } from "../repositories/sparesPagingScope";
import * as paging from "../repositories/sparesPagingRepository";
import { sql } from "drizzle-orm";
import { getDb } from "../../../db";

export async function parse(req: Request, kind?: SparePageQuery["kind"]) {
  const q = sparePageQuery.parse({ ...req.query, ...(kind ? { kind } : {}) });
  const resolved = await resolveSparesScope(req as AuthenticatedRequest, q);
  if ((req as AuthenticatedRequest).rbac?.userType === "Ship" && ["inventory"].includes(q.kind)) resolved.activeOnly = "true";
  paging.criteria(req.params.vesselId, resolved); paging.ordering(resolved);
  return resolved;
}
export const validate = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
  try { return await fn(req, res); }
  catch (error: any) {
    if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ error: error.message });
    if (error instanceof z.ZodError || error instanceof SyntaxError || /Invalid|Unsupported|explicit My/.test(error.message))
      return res.status(400).json({ error: error.message });
    throw error;
  }
};
export const page = validate(async (req, res) => res.json({ success: true, data: await paging.queryPage(req.params.vesselId, await parse(req)) }));
export const values = validate(async (req, res) => res.json({ success: true, data: await paging.queryValues(req.params.vesselId, await parse(req), String(req.query.column ?? "")) }));
export const locations = validate(async (req, res) => res.json({ success: true, data: await paging.queryLocations(req.params.vesselId, await parse(req)) }));

/** New paged client keeps the existing bulk operation and payload. Validate all
 * edited IDs against the trusted vessel scope before any stock service runs. */
export async function validatePagedBulk(req: Request) {
  if (req.query.paged !== "true") return;
  const rows = z.array(z.object({ componentSpareId: z.union([z.string().min(1), z.number().int().positive()]) })).max(10000).parse(req.body.rows);
  const vesselId = z.string().min(1).parse(req.body.vesselId);
  const q = await resolveSparesScope({ params: { vesselId }, user: (req as AuthenticatedRequest).user, rbac: (req as AuthenticatedRequest).rbac },
    sparePageQuery.parse({ ...req.query, kind: "bulk" }));
  const ids = rows.map(r => String(r.componentSpareId));
  if (new Set(ids).size !== ids.length) throw Object.assign(new Error("Duplicate spare IDs"), { statusCode: 400 });
  if (!ids.length) return;
  const db = await getDb();
  const eligible = await db.execute(sql`SELECT s.id::text AS id,s.suuid FROM spares s WHERE ${paging.criteria(vesselId, q)}
    AND (s.id::text IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)}) OR s.suuid IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)}))`);
  const found = new Set(eligible.rows.flatMap(r => [String(r.id), String(r.suuid)]));
  if (ids.some(id => !found.has(id))) throw Object.assign(new Error("One or more edited spares are outside the selected scope or unavailable"), { statusCode: 403 });
  if (eligible.rows.length !== ids.length) throw Object.assign(new Error("Duplicate spare identities"), { statusCode: 400 });
}
