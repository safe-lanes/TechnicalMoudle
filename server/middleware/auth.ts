import { Request, Response, NextFunction } from "express";
import type { UserRole, PublicUser } from "@shared/schema";

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

const DEFAULT_MOCK_RANK_NAME = "Chief Engineer";

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized - Authentication required" });
  }
  next();
};

export const requireRole = (roles: UserRole | UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized - Authentication required" });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Forbidden - Insufficient permissions",
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

export const requirePMSAdmin = requireRole(["PMS Admin", "Sail Admin"]);

export const requireOfficeOrAdmin = requireRole(["Office", "PMS Admin", "Sail Admin"]);

export const requireShipUser = requireRole("Ship");

export const requireVesselAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized - Authentication required" });
  }

  if (req.user.role === "PMS Admin" || req.user.role === "Sail Admin" || req.user.role === "Office") {
    return next();
  }

  const vesselId = req.params.vesselId || req.query.vesselId || req.body.vesselId;
  
  if (!vesselId) {
    return res.status(400).json({ error: "Vessel ID required" });
  }

  if (req.user.role === "Ship" && req.user.vesselId !== vesselId) {
    return res.status(403).json({ 
      error: "Forbidden - Can only access data for assigned vessel",
      assignedVessel: req.user.vesselId,
      requestedVessel: vesselId
    });
  }

  next();
};

export async function initMockAuthRankId() {
  console.log(
    `✅ Mock auth resolves rank_name per-request (x-rank header → body.rank → "${DEFAULT_MOCK_RANK_NAME}")`,
  );
}

/**
 * Read a forwarded request header (SAILERP integration: see client/src/lib/activeRank.ts).
 * Values are URI-encoded on the client; decode defensively and treat blanks as absent.
 */
function readForwardedHeader(req: AuthenticatedRequest, name: string): string | undefined {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded || undefined;
  } catch {
    // Malformed percent-encoding — fall back to the raw trimmed value.
    return value.trim();
  }
}

export const mockAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const headerRankRaw = req.headers["x-rank"];
  const headerRank = Array.isArray(headerRankRaw) ? headerRankRaw[0] : headerRankRaw;

  const body: { rank?: unknown } | null =
    req.body && typeof req.body === "object" ? (req.body as { rank?: unknown }) : null;
  const bodyRank = body && typeof body.rank === "string" ? body.rank : undefined;

  const resolvedRank =
    (typeof headerRank === "string" && headerRank.trim()) ||
    (bodyRank && bodyRank.trim()) ||
    DEFAULT_MOCK_RANK_NAME;

  // Audit Phase 0 — identity threading. In integrated SAILERP the client forwards the
  // authenticated identity via x-user-* headers. Prefer those over the mock for IDENTITY
  // fields only. RBAC is unchanged: req.user.role STAYS on the mock; the real role is stashed
  // separately on `forwardedRole` for audit attribution only.
  const fwdId = readForwardedHeader(req, "x-user-id");
  const fwdName = readForwardedHeader(req, "x-user-name");
  const fwdEmail = readForwardedHeader(req, "x-user-email");
  const fwdType = readForwardedHeader(req, "x-user-type");
  const fwdRole = readForwardedHeader(req, "x-user-role");

  req.user = {
    id: 1,
    username: "sail_admin",
    fullName: fwdName || "Sail Administrator",
    firstname: "Sail",
    lastname: "Administrator",
    email: fwdEmail || "admin@seafarer.com",
    role: "Sail Admin", // RBAC mock — unchanged in Phase 0 (frontend reads the real role independently)
    vesselId: null,
    isActive: true,
    userUuid: fwdId || "00000000-0000-0000-0000-000000000001",
    crewDesignation: "Marine Manager",
    rank_name: resolvedRank,
    userType: fwdType || "Office",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  // Real role forwarded for audit attribution only (never consulted by requireRole/RBAC).
  if (fwdRole) (req.user as any).forwardedRole = fwdRole;
  next();
};
