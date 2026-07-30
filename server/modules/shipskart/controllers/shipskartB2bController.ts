/**
 * Shipskart b2b admin endpoints — bootstrap (manual, OTP), status, manual reconcile.
 * Shore-side admin surface; ships never mount anything that talks to Shipskart.
 */
import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import * as tokenService from '../services/shipskartTokenService';
import * as reconciler from '../services/shipskartReconcilerService';
import * as b2bRepo from '../repositories/shipskartB2bRepository';
import * as vesselAssignments from '../services/vesselAssignmentService';

/** POST /shipskart/b2b/bootstrap { otp? } — the ~90-day manual step (OTP arrives by email). */
export async function bootstrapHandler(req: Request, res: Response) {
  const otp = typeof req.body?.otp === 'string' ? req.body.otp : undefined;
  const result = await tokenService.bootstrap(otp);
  res.json({ success: true, ...result });
}

/** GET /shipskart/b2b/status — token expiries + link counts. Never returns tokens. */
export async function statusHandler(_req: Request, res: Response) {
  const [token, links] = await Promise.all([tokenService.tokenStatus(), b2bRepo.linkStatusCounts()]);
  res.json({ token, links });
}

/** POST /shipskart/b2b/reconcile { limit? } — one bounded manual pass. */
export async function reconcileHandler(req: Request, res: Response) {
  const limit = Number.isInteger(req.body?.limit) ? req.body.limit : undefined;
  const summary = await reconciler.runReconciliation({ limit });
  res.status(summary.ran ? 200 : 409).json(summary);
}

/**
 * POST /shipskart/vessel-assignments — CAPTURE-AT-LOGIN.
 * Body: the decrypted `myVessels` array (or `{ myVessels: [...] }`).
 * The user uuid comes from the FORWARDED IDENTITY (x-user-id → req.user.userUuid), never
 * from the body, so a caller cannot write another user's assignments.
 */
export async function vesselAssignmentsHandler(req: AuthenticatedRequest, res: Response) {
  const userUuid = req.user?.userUuid;
  if (!userUuid) {
    return res.status(401).json({ success: false, message: 'No forwarded user identity (x-user-id) — cannot record vessel assignments.' });
  }
  // allowEmpty is opt-in and deliberate: an empty set otherwise no-ops, so a browser that
  // could not decrypt the userProfile can never revoke a user's vessels.
  const allowEmpty = req.body?.allowEmpty === true;
  const result = await vesselAssignments.captureAssignments(userUuid, req.body, { allowEmpty });
  res.json({ success: true, ...result });
}
