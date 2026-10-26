import { and, eq } from "drizzle-orm";
import { masterUserVessels } from "@shared/schema";
import type { SparePageQuery } from "@shared/sparesPagination";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getDb } from "../../../db";

export async function resolveSparesScope(req: Pick<AuthenticatedRequest, "user" | "rbac" | "params">, q: SparePageQuery): Promise<SparePageQuery> {
  const ship = req.rbac?.userType === "Ship";
  if (q.scope !== "my" && !ship) return q;
  const db = await getDb();
  const assignments = await db.select({ vesselId: masterUserVessels.vesselId }).from(masterUserVessels)
    .where(and(eq(masterUserVessels.userUuid, req.user?.userUuid ?? ""), eq(masterUserVessels.isActive, true)));
  const allowed = new Set(assignments.map(a => a.vesselId));
  if (ship && req.params.vesselId !== "all" && !allowed.has(req.params.vesselId))
    throw Object.assign(new Error("Vessel is not assigned to this user"), { statusCode: 403 });
  const requested = q.vesselIds === undefined ? Array.from(allowed) : q.vesselIds.split(",").filter(Boolean);
  return { ...q, scope: "my", vesselIds: requested.filter(id => allowed.has(id)).join(",") };
}
