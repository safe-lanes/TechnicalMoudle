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
import { forwardedUserUuid } from '../services/identityGuard';

/** POST /shipskart/b2b/bootstrap { otp? } — the ~90-day manual step (OTP arrives by email). */
export async function bootstrapHandler(req: Request, res: Response) {
  const otp = typeof req.body?.otp === 'string' ? req.body.otp : undefined;
  const result = await tokenService.bootstrap(otp);
  res.json({ success: true, ...result });
}

/**
 * GET /shipskart/b2b/status — token expiries + link counts + the "needs a human" list.
 * Never returns tokens. This is the admin console's data source.
 */
export async function statusHandler(_req: Request, res: Response) {
  const [token, links, failing] = await Promise.all([
    tokenService.tokenStatus(),
    b2bRepo.linkStatusCounts(),
    b2bRepo.failingRows(100),
  ]);
  res.json({ token, links, failing });
}

/**
 * POST /shipskart/b2b/retry { kind: 'user'|'vessel', id } — clear one stuck row back to
 * pending for the next reconciler pass. Refuses rows that already carry a Shipskart id
 * (re-pushing would duplicate — Shipskart has no update endpoint).
 */
export async function retryHandler(req: Request, res: Response) {
  const kind = req.body?.kind;
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  if ((kind !== 'user' && kind !== 'vessel') || !id) {
    return res.status(400).json({ success: false, message: "body must be { kind: 'user'|'vessel', id: string }" });
  }
  const result = await b2bRepo.resetForRetry(kind, id);
  res.status(result.reset ? 200 : 409).json({ success: result.reset, ...result });
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
  // FORWARDED HEADER ONLY — never req.user.userUuid: mock auth substitutes a shared default
  // uuid when the header is absent, and writing assignments under it would merge every
  // un-identified user's vessels into one row set (identityGuard.ts).
  const userUuid = forwardedUserUuid(req, 'vessel-assignments');
  if (!userUuid) {
    return res.status(401).json({ success: false, errorCode: 'NO_FORWARDED_IDENTITY', message: 'No forwarded user identity (x-user-id) — cannot record vessel assignments.' });
  }
  // allowEmpty is opt-in and deliberate: an empty set otherwise no-ops, so a browser that
  // could not decrypt the userProfile can never revoke a user's vessels.
  const allowEmpty = req.body?.allowEmpty === true;
  const result = await vesselAssignments.captureAssignments(userUuid, req.body, { allowEmpty });
  res.json({ success: true, ...result });
}
