import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import type { VerifiedUser } from "../../../middleware/tenantMiddleware";
import { ForbiddenError } from "../../shared/errors";
import { and, eq } from "drizzle-orm";
import { masterUserVessels } from "@shared/schema";
import { getDb } from "../../../db";
import { storage } from "../../../storage";

export interface SectionHActor {
  userId: string;
  role: string;
  userType: "Office" | "Ship";
  canEdit: boolean;
}
export type SectionHRequest = AuthenticatedRequest & {
  verifiedUser?: VerifiedUser;
  sectionHActor?: SectionHActor;
};

/** Use the existing JWT-verified context, never turn x-user-* headers into authentication. */
export function verifiedSectionHActor(req: SectionHRequest): SectionHActor {
  const verified = req.verifiedUser;
  if (req.rbac?.source !== "forwarded" || !verified?.userId || !verified.role || !verified.userType ||
      verified.missing.length || verified.userId !== req.user?.userUuid ||
      verified.role !== req.rbac.role || verified.userType !== req.rbac.userType) {
    throw new ForbiddenError("A verified integrated user session is required for Classification & Regulatory Data.");
  }
  return { userId: verified.userId, role: verified.role, userType: verified.userType, canEdit: false };
}

export function requireSectionHIdentity(req: SectionHRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  try {
    req.sectionHActor = verifiedSectionHActor(req);
    next();
  } catch {
    return res.status(403).json({ error: "A verified integrated user session is required for Classification & Regulatory Data." });
  }
}

/** Same Component edit permission policy as the UI, after verified-source/type checks. */
export async function sectionHCanEdit(actor: SectionHActor): Promise<boolean> {
  if (actor.userType !== "Office") return false;
  if (actor.role === "Sail Admin" || actor.role === "PMS Admin") return true;
  const role = await storage.getRoleByName(actor.role);
  if (!role) return false;
  const permissions = await storage.getRoleMenuPermissions(role.ruid);
  const menus = await storage.getActiveMenuItems();
  const menu = menus.find(item => item.name === "pms-components");
  return !!menu && permissions.some(item => item.menuMuid === menu.muid && item.canEdit === true);
}

export async function assertSectionHScope(actor: SectionHActor, vesselId: string | null) {
  if (!vesselId) throw new ForbiddenError("This component has no valid vessel scope.");
  // User-confirmed policy: authorized Office identities work across all vessels.
  if (actor.userType === "Office") return;
  const db = await getDb();
  const assignments = await db.select({ id: masterUserVessels.id }).from(masterUserVessels)
    .where(and(eq(masterUserVessels.userUuid, actor.userId),
      eq(masterUserVessels.vesselId, vesselId), eq(masterUserVessels.isActive, true))).limit(1);
  if (!assignments.length) throw new ForbiddenError("You do not have an active assignment to this vessel.");
}
