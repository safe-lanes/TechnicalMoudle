/**
 * Sync-specific middleware — role gates for sensitive sync operations.
 *
 * `requireOfflineAdmin` gates provisioning endpoints:
 * - Sail Admin: always allowed (superadmin override)
 * - Offline Admin: allowed (dedicated provisioning role, seeded via migration 102)
 * - PMS Admin: allowed (office admin with full PMS access)
 * - All others: rejected with 403
 */

import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    role?: string;
    [key: string]: any;
  };
}

export function requireOfflineAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized — authentication required' });
  }

  const role = req.user.role || '';

  // Sail Admin = superadmin, always allowed
  // PMS Admin = office admin, allowed for provisioning
  // Offline Admin = dedicated provisioning role
  const allowedRoles = ['Sail Admin', 'PMS Admin', 'Offline Admin'];

  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      error: 'Access denied. Offline Admin, PMS Admin, or Sail Admin role required.',
      currentRole: role,
    });
  }

  next();
}
