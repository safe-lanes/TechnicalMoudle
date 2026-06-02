/**
 * Shipskart SSO Controller — thin request handlers. Resolve the current user's
 * role (set by mockAuthMiddleware / real auth on req.user), call the service,
 * format the response. externalUserId is derived from the role inside the service.
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import * as shipskartSsoService from '../services/shipskartSsoService';
import { ShipskartRoleNotMappedError } from '../services/shipskartSsoService';

/**
 * POST /api/shipskart/sso/initiate
 * Returns the fully-formed iframeUrl (plus partnerName/expiresIn) for the
 * frontend to drop straight into the iframe. ssoCode is NOT echoed back to
 * the client beyond what the iframeUrl already embeds, and is never logged.
 *
 * If the user's role has no Shipskart mapping, returns 403 ROLE_NOT_MAPPED.
 */
export async function initiateHandler(req: AuthenticatedRequest, res: Response) {
  const userRole = req.user?.role ?? '';
  try {
    const result = await shipskartSsoService.initiateSso(userRole);
    res.json({
      success: true,
      iframeUrl: result.iframeUrl,
      partnerName: result.partnerName,
      expiresIn: result.expiresIn,
    });
  } catch (err: any) {
    if (err instanceof ShipskartRoleNotMappedError) {
      return res.status(403).json({
        success: false,
        errorCode: 'ROLE_NOT_MAPPED',
        message: 'Purchasing is not available for your role.',
      });
    }
    // Other Shipskart errors → re-throw so asyncHandler maps them to the
    // existing { error } envelope at their AppError status (500/502/503).
    throw err;
  }
}

/**
 * POST /api/shipskart/sso/logout
 * Best-effort: tells Shipskart to evict the session. Idempotent on their
 * side. We still return 200 to the caller even if Shipskart errors, so a
 * local logout is never blocked (errors are logged, not surfaced fatally).
 * Unmapped roles are a no-op inside the service.
 */
export async function logoutHandler(req: AuthenticatedRequest, res: Response) {
  const userRole = req.user?.role ?? '';
  try {
    const result = await shipskartSsoService.logoutSso(userRole);
    res.json({ success: true, message: result?.message });
  } catch (err: any) {
    console.error('[Shipskart] logout failed (non-blocking):', err?.message || err);
    res.json({ success: true, message: 'Shipskart logout skipped (remote error logged)' });
  }
}
