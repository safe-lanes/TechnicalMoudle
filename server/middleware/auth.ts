import { Request, Response, NextFunction } from "express";
import type { UserRole, PublicUser } from "@shared/schema";

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
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

export const mockAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  (req as any).user = {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  next();
};
