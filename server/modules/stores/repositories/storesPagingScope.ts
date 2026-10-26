import { and, eq } from "drizzle-orm";
import { masterUserVessels } from "@shared/schema";
import type { StorePageQuery } from "@shared/storesPagination";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getDb } from "../../../db";

/** SAILERP login capture is the existing server-side user/vessel assignment source.
 * Client allow-lists narrow it; they are never an authorization grant.
 * Office fleet-wide access retains the existing Stores contract.
 */
export async function resolveStoresScope(req: AuthenticatedRequest, query: StorePageQuery) {
  const ship = req.rbac?.userType === "Ship";
  if (query.scope !== "my" && !ship) return query;
  const db = await getDb();
  const rows = await db.select({ vesselId: masterUserVessels.vesselId }).from(masterUserVessels)
    .where(and(eq(masterUserVessels.userUuid, req.user?.userUuid ?? ""), eq(masterUserVessels.isActive, true)));
  const allowed = new Set(rows.map(row => row.vesselId));
  if (ship && req.params.vesselId !== "all" && !allowed.has(req.params.vesselId))
    throw Object.assign(new Error("Vessel is not assigned to this user"), { statusCode: 403 });
  const requested = query.vesselIds === undefined ? Array.from(allowed) : query.vesselIds.split(",").filter(Boolean);
  return { ...query, vesselIds: requested.filter(id => allowed.has(id)).join(","), scope: "my" as const };
}
