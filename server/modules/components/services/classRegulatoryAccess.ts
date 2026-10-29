import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import type { VerifiedUser } from "../../../middleware/tenantMiddleware";
import { ForbiddenError } from "../../shared/errors";
import { and, eq } from "drizzle-orm";
import { masterUserVessels } from "@shared/schema";
import { getDb } from "../../../db";
import jwt from "jsonwebtoken";
import { readVerifiedUser } from "../../../middleware/tenantMiddleware";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { requirePermission } from "../../../middleware/permissions";
import { findMasterUserById } from "../../assistant-api/masterUserRepository";
import { createDefaultDevelopmentUser } from "@shared/developmentUser";

export interface SectionHActor {
  userId: string;
  role: string;
  userType: "Office" | "Ship";
  canEdit: boolean;
  identityMode?: "verified" | "development-readonly" | "replit-default";
}
export type SectionHRequest = AuthenticatedRequest & {
  verifiedUser?: VerifiedUser;
  sectionHActor?: SectionHActor;
};

/** Use the existing JWT-verified context, never turn x-user-* headers into authentication. */
export function verifiedSectionHActor(req: SectionHRequest): SectionHActor {
  const verified = req.verifiedUser;
  if (req.rbac?.source === "mock" || !verified?.userId || !verified.role || !verified.userType) {
    throw new ForbiddenError("A verified integrated user session is required for Classification & Regulatory Data.");
  }
  const header = (name: string) => {
    const raw = req.headers?.[name];
    if (typeof raw !== "string" || !raw.trim()) return null;
    try { return decodeURIComponent(raw).trim(); } catch { return raw.trim(); }
  };
  if ((header("x-user-id") && header("x-user-id") !== verified.userId) ||
      (header("x-user-role") && header("x-user-role") !== verified.role) ||
      (header("x-user-type") && header("x-user-type") !== verified.userType) ||
      (req.rbac?.source === "forwarded" &&
        ((req.rbac.role && req.rbac.role !== verified.role) || (req.rbac.userType && req.rbac.userType !== verified.userType)))) {
    throw new ForbiddenError("The forwarded identity does not match the verified session. Please sign in again.");
  }
  // The configured SAILERP id claim is the canonical master_users.id contract.
  // Never substitute req.user.userUuid (which can be the default mock or a browser header).
  return { userId: verified.userId, role: verified.role, userType: verified.userType, canEdit: false, identityMode: "verified" };
}

export const DEVELOPMENT_READONLY_REASON = "Development preview — read-only. No verified Office session was received. Sign in through the integrated application to edit; the default preview user cannot authorize changes.";
export function sectionHDevelopmentReadEnabled() {
  return process.env.NODE_ENV === "development" && process.env.PMS_SECTION_H_DEV_READONLY === "true" &&
    !tenantConnectionManager.isMultiTenantEnabled;
}

/** Server configuration, never a client header or the built frontend bundle. */
export function sectionHReplitEnabled() {
  return process.env.NODE_ENV === "development" && process.env.VITE_APP_ENV === "replit" &&
    !tenantConnectionManager.isMultiTenantEnabled;
}

/** Only Section H uses this adapter; global mock/tenant behavior is unchanged. */
const resolveIdentity = (allowDevelopment: boolean) =>
async (req: SectionHRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Please sign in to view Classification & Regulatory Data.", code: "AUTHENTICATION_REQUIRED" });
  try {
    if (!req.verifiedUser && sectionHReplitEnabled() &&
        req.headers["x-section-h-development"] === "default-user") {
      const user = createDefaultDevelopmentUser();
      if (!user.isActive || user.isDeleted || !user.userUuid ||
          (user.userType !== "Office" && user.userType !== "Ship")) {
        return res.status(403).json({ error: "The default workspace user is not active or has no valid identity.", code: "DEVELOPMENT_IDENTITY_INVALID" });
      }
      // The UUID must exist in the same canonical directory used by production.
      // Do not insert a fake user or attribute writes to a browser-supplied UUID.
      const mapped = await findMasterUserById(user.userUuid);
      if (!mapped || mapped.userType !== user.userType) {
        return res.status(403).json({
          error: "The default workspace user has no matching canonical user/type in this installation. Register the correct development user before editing.",
          code: "DEVELOPMENT_IDENTITY_UNMAPPED",
        });
      }
      for (const [name, expected] of [["x-user-id", user.userUuid], ["x-user-role", user.role], ["x-user-type", user.userType]]) {
        const value = req.headers[name];
        if (typeof value !== "string" || decodeURIComponent(value) !== expected) {
          return res.status(403).json({ error: "The Section H workspace identity does not match its configured default user.", code: "DEVELOPMENT_IDENTITY_MISMATCH" });
        }
      }
      req.sectionHActor = { userId: user.userUuid, role: user.role, userType: user.userType,
        identityMode: "replit-default", canEdit: false };
      req.rbac = { source: "forwarded", role: user.role, userType: user.userType };
      return next();
    }
    if (!req.verifiedUser) {
      const authorization = req.headers.authorization;
      if (authorization) {
        if (tenantConnectionManager.isMultiTenantEnabled) {
          return res.status(503).json({ error: "Verified tenant identity is unavailable. Contact your administrator.", code: "IDENTITY_UNAVAILABLE" });
        }
        if (!process.env.JWT_SECRET) return res.status(503).json({
          error: "Integrated session verification is not configured for this installation.", code: "IDENTITY_UNAVAILABLE",
        });
        const match = typeof authorization === "string" && authorization.match(/^Bearer\s+(.+)$/i);
        if (!match) return res.status(401).json({ error: "Invalid session. Please sign in again.", code: "INVALID_SESSION" });
        try {
          const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
          if (typeof payload !== "object") throw new Error("Invalid token claims");
          req.verifiedUser = readVerifiedUser(payload);
          // Resolve the signed id through the established local SAILERP mapping.
          // No sub/email/default-user fallback and no browser-supplied role fallback.
          if (!req.verifiedUser.userId) return res.status(403).json({ error: "The verified session has no mapped user identity.", code: "IDENTITY_UNMAPPED" });
          const mapped = await findMasterUserById(req.verifiedUser.userId);
          if (!mapped) return res.status(403).json({ error: "This verified user is not registered in this installation.", code: "IDENTITY_UNMAPPED" });
          req.verifiedUser.role ||= mapped.role;
          req.verifiedUser.userType ||= mapped.userType;
        } catch (error: any) {
          if (error?.name === "TokenExpiredError") return res.status(401).json({ error: "Your session has expired. Please sign in again.", code: "SESSION_EXPIRED" });
          if (error?.name === "JsonWebTokenError" || error?.name === "NotBeforeError" || error?.message === "Invalid token claims")
            return res.status(401).json({ error: "Invalid session. Please sign in again.", code: "INVALID_SESSION" });
          throw error;
        }
      } else if (allowDevelopment && sectionHDevelopmentReadEnabled()) {
        // Explicit server-owned development profile, never constructed from request headers.
        req.sectionHActor = { userId: "section-h-development-viewer", role: "Development viewer",
          userType: "Office", canEdit: false, identityMode: "development-readonly" };
        return next();
      } else return res.status(403).json({
        error: allowDevelopment
          ? "A verified integrated user session is required. This standalone preview has no approved read-only access enabled."
          : "A verified Office session is required to change Classification & Regulatory Data. Mock/development identities cannot make changes.",
        code: allowDevelopment ? "SESSION_UNVERIFIED" : "VERIFIED_WRITE_SESSION_REQUIRED",
      });
    }
    if (req.verifiedUser.userId && (!req.verifiedUser.role || !req.verifiedUser.userType)) {
      const mapped = await findMasterUserById(req.verifiedUser.userId);
      req.verifiedUser.role ||= mapped?.role ?? null;
      req.verifiedUser.userType ||= mapped?.userType ?? null;
    }
    req.sectionHActor = { ...verifiedSectionHActor(req), identityMode: "verified" };
    // Resource-local, verified-derived RBAC for the existing enforcing permission helpers.
    req.rbac = { source: "forwarded", role: req.sectionHActor.role, userType: req.sectionHActor.userType };
    next();
  } catch (error: any) {
    if (error?.statusCode === 403) return res.status(403).json({ error: error.message, code: "SESSION_UNVERIFIED" });
    console.error("[Section H] identity resolution unavailable");
    return res.status(503).json({ error: "Session verification is temporarily unavailable. Please try again.", code: "IDENTITY_UNAVAILABLE" });
  }
};
export const requireSectionHIdentity = resolveIdentity(false);
export const requireSectionHReadIdentity = resolveIdentity(true);
export function requireSectionHView(req: SectionHRequest, res: Response, next: NextFunction) {
  if (req.sectionHActor?.identityMode === "development-readonly" || sectionHOfficeCanManage(req.sectionHActor)) return next();
  return requirePermission("pms-components", "view", { enforce: true, unconfigured: "deny" })(req, res, next);
}

/** Section H only: verified Office, or the explicitly approved server-owned Replit actor. */
export function sectionHOfficeCanManage(actor?: SectionHActor): boolean {
  if (!actor?.userId || actor.userType !== "Office") return false;
  if (actor.identityMode === "verified") return true;
  const user = createDefaultDevelopmentUser();
  return actor.identityMode === "replit-default" && sectionHReplitEnabled() &&
    user.isActive && !user.isDeleted && user.userType === "Office" &&
    actor.userId === user.userUuid && actor.role === user.role;
}

export function requireSectionHOffice(req: SectionHRequest, res: Response, next: NextFunction) {
  if (!sectionHOfficeCanManage(req.sectionHActor)) return res.status(403).json({
    error: "A verified Office session is required to manage Classification & Regulatory Data.",
    code: "OFFICE_SESSION_REQUIRED",
  });
  next();
}

export async function sectionHCanEdit(actor: SectionHActor): Promise<boolean> {
  return sectionHOfficeCanManage(actor);
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
