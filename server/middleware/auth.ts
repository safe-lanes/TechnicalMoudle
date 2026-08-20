import { Request, Response, NextFunction } from "express";
import type { UserRole, PublicUser } from "@shared/schema";

/**
 * Phase 0 / P0.1 — server-side RBAC identity.
 *
 * The SAILERP shell forwards the authenticated identity as headers on every /technical/api call
 * (client/src/lib/activeRank.ts: x-user-id, x-user-name, x-user-email, x-user-type, x-user-role,
 * plus x-rank). `x-user-role` is the SAILERP role NAME as stored in admn_role_master.assigned_role
 * ('Sail Admin', 'Super Admin', 'Admin', 'Vessel Admin', 'Vessel User', …) and `x-user-type` is the
 * coarse side ('Office' | 'Ship'). `req.rbac` carries that resolved identity; requireRole and
 * requirePermission evaluate IT — not the legacy mock.
 *
 * `req.user.role` is deliberately left as it was (the 'Sail Admin' mock) because ~40 call sites
 * read it for business logic (admin shortcuts, RH override, document visibility, …) and switching
 * them all is a product decision outside Phase 0. Anything that wants the real role reads req.rbac
 * (or the existing `forwardedRole`).
 *
 * PMS_AUTH_MOCK_RBAC=1 restores the pre-Phase-0 behaviour (every request = Sail Admin / Office) for
 * standalone local/pilot UI sessions that carry no forwarded identity. Never set it in production.
 */
export type RbacUserType = "Office" | "Ship";
export interface RbacIdentity {
  /** SAILERP role name (admn_role_master.assigned_role) or null when nothing was forwarded. */
  role: string | null;
  userType: RbacUserType | null;
  source: "forwarded" | "mock" | "none";
}

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
  rbac?: RbacIdentity;
}

const DEFAULT_MOCK_RANK_NAME = "Chief Engineer";
/** Admin role names that always pass permission checks (parity with the frontend + viewModeService). */
export const RBAC_BYPASS_ROLES: ReadonlySet<string> = new Set(["Sail Admin", "PMS Admin"]);

export function isMockRbacEnabled(): boolean {
  const v = (process.env.PMS_AUTH_MOCK_RBAC ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** The identity guards evaluate. Falls back to an empty identity if the middleware did not run. */
export function getRbacIdentity(req: AuthenticatedRequest): RbacIdentity {
  return req.rbac ?? { role: null, userType: null, source: "none" };
}

/**
 * Does the forwarded identity satisfy an allowed-role list written in the legacy UserRole
 * vocabulary? 'Office' / 'Ship' match by user TYPE; every other entry matches the role NAME
 * exactly ('Sail Admin', 'PMS Admin', 'Super Admin', …). Nothing forwarded → never matches.
 */
export function rbacMatches(identity: RbacIdentity, allowed: readonly string[]): boolean {
  if (identity.role && allowed.includes(identity.role)) return true;
  if (identity.userType === "Office" && allowed.includes("Office")) return true;
  if (identity.userType === "Ship" && allowed.includes("Ship")) return true;
  return false;
}

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
    const identity = getRbacIdentity(req);

    if (!rbacMatches(identity, allowedRoles)) {
      return res.status(403).json({
        error: "Forbidden - Insufficient permissions",
        required: allowedRoles,
        current: identity.role ?? "anonymous",
      });
    }

    next();
  };
};

/**
 * LEGACY ALIASES — deliberately NON-ENFORCING in Phase 0.
 * They sit on ~65 routes (spares/stores consume+receive, running-hours config, components
 * sub-entities, rotational items, retention, audit, fleet-admin, noon-report) that were written
 * for the original standalone user model and have never enforced anything (the role was always
 * the mock). Turning them on with the real SAILERP roles would, for example, refuse spare
 * consumption to every Vessel User. Deciding which of those surfaces should be admin-only is a
 * product decision (tracked in PHASE0-REPORT.md) — until then they pass through, exactly as today.
 * New code must use requireRole([...]) / requirePermission(...) directly.
 */
const legacyPassThrough = (_req: AuthenticatedRequest, _res: Response, next: NextFunction) => next();
/** @deprecated non-enforcing (see above) — use requireRole(['PMS Admin','Sail Admin']) to enforce. */
export const requirePMSAdmin = legacyPassThrough;
/** @deprecated non-enforcing (see above) — use requireRole(['Office','PMS Admin','Sail Admin']) to enforce. */
export const requireOfficeOrAdmin = legacyPassThrough;

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
  // Real role forwarded — still stashed here for audit attribution (auditActor.ts reads it).
  if (fwdRole) (req.user as any).forwardedRole = fwdRole;

  // Phase 0 / P0.1 — the identity RBAC guards evaluate (see RbacIdentity above).
  if (isMockRbacEnabled()) {
    req.rbac = { role: "Sail Admin", userType: "Office", source: "mock" };
  } else if (fwdRole || fwdType) {
    const userType: RbacUserType | null = fwdType === "Office" || fwdType === "Ship" ? fwdType : null;
    req.rbac = { role: fwdRole ?? null, userType, source: "forwarded" };
  } else {
    req.rbac = { role: null, userType: null, source: "none" };
  }
  next();
};
