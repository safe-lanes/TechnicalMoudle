/**
 * Shipskart SSO Controller — thin request handlers. Resolve the current user's
 * role (set by mockAuthMiddleware / real auth on req.user), call the service,
 * format the response. externalUserId is derived from the role inside the service.
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import { forwardedUserUuid } from '../services/identityGuard';
import * as shipskartSsoService from '../services/shipskartSsoService';
import { ShipskartRoleNotMappedError, ShipskartUserNotProvisionedError } from '../services/shipskartSsoService';

/**
 * WHY A USER IS BLOCKED, IN PLAIN ENGLISH (Ghazi, 2026-08-10).
 *
 * Purchasing used to answer "not available yet, contact your administrator" for every
 * refusal. Correct, and useless: support could not tell a missing email from an unmapped
 * role without opening the database, and the person actually blocked learned nothing.
 *
 * These messages are written to be read by the CLIENT, not by us. No table names, no status
 * codes, no jargon — what is missing, who fixes it, and what happens afterwards. The
 * machine-readable code and the raw diagnostic still travel in the same payload for support,
 * and every screen ends by pointing at support.
 *
 * `retry` tells the reader what to do once it is fixed:
 *   'click'    — just open Purchasing again, nothing else needed
 *   'sync'     — a data refresh has to run first (sync masters), then open Purchasing
 *   'support'  — cannot be self-served; it needs us or the supplier
 */
interface BlockExplanation { title: string; detail: string; whatHappensNext: string; retry: 'click' | 'sync' | 'support' }

/** Test seam — the copy is the deliverable here, so it is asserted directly. */
export const __testExplainBlock = (code: string, role: string | null, raw: string, facts: any = {}) => explainBlock(code, role, raw, facts);

function explainBlock(
  reasonCode: string,
  sailRole: string | null,
  rawReason: string,
  facts: { fullName?: string | null; sailRole?: string | null; shipskartRole?: string | null } = {},
): BlockExplanation {
  // NAME THE ACTUAL VALUES (Ghazi, 2026-08-10). "linked to a purchasing role that no longer
  // exists" sends support to the database to find out WHICH one; saying
  // “WAH-KWONG-PUCHASER” lets them fix it from the screen. Every value here already sits in
  // our own tables, so there is no reason to describe a category instead of naming the thing.
  const role = sailRole ? `“${sailRole}”` : 'your role';
  const who = facts.fullName ? ` (${facts.fullName})` : '';
  const skRole = facts.shipskartRole ? `“${facts.shipskartRole}”` : null;

  switch (reasonCode) {
    case 'unmapped_role':
      // Two shapes behind one status: no mapping row at all, or the mapped name no longer
      // exists on the supplier's side. The raw reason distinguishes them; the remedy differs.
      return /has no live roleId/i.test(rawReason)
        ? {
            title: 'Purchasing access is being set up for your role',
            detail:
              `Your role ${role} is linked to the purchasing role ${skRole ?? '(not recorded)'}, which no ` +
              `longer exists on the supplier's system — so we cannot open Purchasing for you yet. This ` +
              `usually happens after the supplier renames a role.`,
            whatHappensNext:
              `An administrator needs to open Access Control and re-select the purchasing role for ${role}, ` +
              `then save. Once that is done, simply open Purchasing again — there is no need to log out.`,
            retry: 'click',
          }
        : {
            title: 'Purchasing access is not set up for your role yet',
            detail:
              `Your role ${role} has not yet been linked to a purchasing role. This is a one-time setup ` +
              `step and it has not been done for this role.`,
            whatHappensNext:
              `An administrator can link ${role} to a purchasing role in Access Control. Once linked, ` +
              `simply open Purchasing again — there is no need to log out.`,
            retry: 'click',
          };

    case 'missing_email':
      return {
        title: 'An email address is needed for your account',
        detail:
          `The purchasing system requires an email address to create your account, and there is no email ` +
          `recorded against your user profile${who}.`,
        whatHappensNext:
          'Once your email address is added to your user profile and the user details are refreshed, ' +
          'open Purchasing again and your account will be created automatically.',
        retry: 'sync',
      };

    case 'no_master_row':
      return {
        title: 'Your user profile has not reached this system yet',
        detail:
          'Your account exists, but its details have not yet been received by this system, so a purchasing ' +
          'account cannot be created for you.',
        whatHappensNext:
          'An administrator needs to refresh the user details. After that, open Purchasing again.',
        retry: 'sync',
      };

    case 'blocked_duplicate':
      return {
        title: 'An account already exists with your email address',
        detail:
          'The purchasing system already has an account registered against your email address, so a second ' +
          'one cannot be created. This has to be resolved with the supplier.',
        whatHappensNext:
          'This one cannot be fixed from within the application — please contact support and they will ' +
          'raise it with the supplier.',
        retry: 'support',
      };

    case 'identity_not_configured':
      return {
        title: 'Purchasing is not fully configured on this installation',
        detail:
          'Purchasing needs to know which user is signed in, and this installation is not providing that ' +
          'information. This is a configuration matter, not a problem with your account.',
        whatHappensNext: 'Please contact support — this needs to be enabled by the technical team.',
        retry: 'support',
      };

    case 'lookup_failed':
      return {
        title: 'We could not reach the purchasing system just now',
        detail:
          'Your account looks fine — we simply could not contact the supplier’s system to check it. This is ' +
          'usually temporary.',
        whatHappensNext: 'Please wait a few minutes and open Purchasing again.',
        retry: 'click',
      };

    default: // jit_failed / error / unknown
      return {
        title: 'Your purchasing account could not be created',
        detail:
          'We tried to create your account on the purchasing system and it did not complete. The technical ' +
          'detail is shown below for support.',
        whatHappensNext:
          'Please try again in a few minutes. If it keeps happening, contact support and quote the details below.',
        retry: 'click',
      };
  }
}

/**
 * POST /api/shipskart/sso/initiate
 * Returns the fully-formed iframeUrl (plus partnerName/expiresIn) for the
 * frontend to drop straight into the iframe. ssoCode is NOT echoed back to
 * the client beyond what the iframeUrl already embeds, and is never logged.
 *
 * If the user's role has no Shipskart mapping, returns 403 ROLE_NOT_MAPPED.
 */
export async function initiateHandler(req: AuthenticatedRequest, res: Response) {
  // The backend has no real auth yet — mockAuthMiddleware hardcodes
  // req.user.role to 'Sail Admin', which is unmapped. The frontend therefore
  // sends the real logged-in role in the body (same pattern as the alerts
  // ?role= calls). Prefer a valid non-empty body.role; otherwise fall back to
  // req.user.role so existing behavior is preserved.
  const bodyRole = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
  const userRole = bodyRole || req.user?.role || '';
  // Per-user SSO (b2b): read the FORWARDED HEADER, never req.user.userUuid — mock auth
  // substitutes a shared default uuid when the header is absent, and keying on that would
  // silently put every un-identified user on ONE Shipskart account (identityGuard.ts).
  const userUuid = forwardedUserUuid(req, 'sso/initiate');
  try {
    const result = await shipskartSsoService.initiateSso(userRole, userUuid);
    res.json({
      success: true,
      iframeUrl: result.iframeUrl,
      partnerName: result.partnerName,
      expiresIn: result.expiresIn,
    });
  } catch (err: any) {
    if (err instanceof ShipskartRoleNotMappedError) {
      const x = explainBlock('unmapped_role', err.userRole || userRole || null, 'no shipskart_role_mappings row', { sailRole: err.userRole || userRole || null });
      return res.status(403).json({
        success: false,
        errorCode: 'ROLE_NOT_MAPPED',
        message: 'Purchasing is not available for your role.',
        // Plain-English explanation + the support reference (see explainBlock).
        title: x.title,
        detail: x.detail,
        whatHappensNext: x.whatHappensNext,
        retry: x.retry,
        reasonCode: 'unmapped_role',
        reason: `SAIL role '${err.userRole || userRole || '(none)'}' has no shipskart_role_mappings row`,
        userRole: err.userRole || userRole || null,
        userUuid: forwardedUserUuid(req, 'sso/initiate') ?? null,
        occurredAt: new Date().toISOString(),
      });
    }
    // Role IS mapped but this user's own Shipskart account is not provisioned. Blocked on
    // purpose — no shared-account fallback (see ShipskartUserNotProvisionedError). The
    // reason is already WARN-logged with the uuid and stored on the link row for the
    // reconciler; the user gets a plain message, never a raw error or a blank frame.
    if (err instanceof ShipskartUserNotProvisionedError) {
      // Two shapes of the same refusal, distinguished for the person reading the screen:
      // identity not wired on this deployment vs this user's account not created yet.
      const identityMissing = err.reason === 'identity_not_configured';
      const code = identityMissing ? 'identity_not_configured' : (err.reasonCode || 'unknown');
      const x = explainBlock(code, err.sailRole ?? userRole ?? null, err.reason, err.facts ?? {});
      return res.status(409).json({
        success: false,
        errorCode: 'USER_NOT_PROVISIONED',
        message: identityMissing
          ? 'Purchasing is unavailable: user identity is not configured for this deployment. Please contact your administrator.'
          : 'Purchasing is not available yet. Please contact your administrator.',
        // Plain-English explanation + the support reference (see explainBlock).
        title: x.title,
        detail: x.detail,
        whatHappensNext: x.whatHappensNext,
        retry: x.retry,
        reasonCode: code,
        reason: err.reason,          // the raw diagnostic, also on shipskart_user_links.last_error
        userRole: err.sailRole ?? userRole ?? null,
        userUuid: identityMissing ? null : err.userUuid,
        occurredAt: new Date().toISOString(),
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
  // Mirror initiate: prefer the real role the client sends so the correct
  // Shipskart session is evicted; fall back to req.user.role.
  const bodyRole = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
  const userRole = bodyRole || req.user?.role || '';
  try {
    const result = await shipskartSsoService.logoutSso(userRole, forwardedUserUuid(req, 'sso/logout'));
    res.json({ success: true, message: result?.message });
  } catch (err: any) {
    console.error('[Shipskart] logout failed (non-blocking):', err?.message || err);
    res.json({ success: true, message: 'Shipskart logout skipped (remote error logged)' });
  }
}
