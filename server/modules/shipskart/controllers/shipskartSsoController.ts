/**
 * Shipskart SSO Controller — thin request handlers. Parse input (none needed
 * for these calls — externalUserId/tenantId are server-side fixed for dev),
 * call the service, format the response.
 */

import type { Request, Response } from 'express';
import * as shipskartSsoService from '../services/shipskartSsoService';

/**
 * POST /api/shipskart/sso/initiate
 * Returns the fully-formed iframeUrl (plus partnerName/expiresIn) for the
 * frontend to drop straight into the iframe. ssoCode is NOT echoed back to
 * the client beyond what the iframeUrl already embeds, and is never logged.
 */
export async function initiateHandler(_req: Request, res: Response) {
  const result = await shipskartSsoService.initiateSso();
  res.json({
    success: true,
    iframeUrl: result.iframeUrl,
    partnerName: result.partnerName,
    expiresIn: result.expiresIn,
  });
}

/**
 * POST /api/shipskart/sso/logout
 * Best-effort: tells Shipskart to evict the session. Idempotent on their
 * side. We still return 200 to the caller even if Shipskart errors, so a
 * local logout is never blocked (errors are logged, not surfaced fatally).
 */
export async function logoutHandler(_req: Request, res: Response) {
  try {
    const result = await shipskartSsoService.logoutSso();
    res.json({ success: true, message: result?.message });
  } catch (err: any) {
    console.error('[Shipskart] logout failed (non-blocking):', err?.message || err);
    res.json({ success: true, message: 'Shipskart logout skipped (remote error logged)' });
  }
}
