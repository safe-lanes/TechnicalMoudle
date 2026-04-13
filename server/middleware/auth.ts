import { Request, Response, NextFunction } from "express";
import type { UserRole, PublicUser } from "@shared/schema";

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

let resolvedMockRankId: string | undefined;

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
  try {
    const { getAllRanks } = await import('../modules/ranks/service');
    const ranks = await getAllRanks();
    const designation = "Marine Manager";
    const match = ranks.find(
      (r: any) =>
        r.name?.toLowerCase().trim() === designation.toLowerCase() ||
        r.label?.toLowerCase().trim() === designation.toLowerCase()
    );
    resolvedMockRankId = match?.rankId;
    console.log(resolvedMockRankId
      ? `✅ Mock auth rankId resolved: ${resolvedMockRankId}`
      : `⚠️ Mock auth: no rank found for "${designation}"`);
  } catch {
    console.warn('⚠️ Mock auth: could not resolve rankId at startup');
  }
}

export const mockAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  req.user = {
    id: 1,
    username: "sail_admin",
    fullName: "Sail Administrator",
    firstname: "Sail",
    lastname: "Administrator",
    email: "admin@seafarer.com",
    role: "Sail Admin",
    vesselId: null,
    isActive: true,
    userUuid: "00000000-0000-0000-0000-000000000001",
    crewDesignation: "Marine Manager",
    rankId: resolvedMockRankId,
    userType: "Office",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  next();
};
