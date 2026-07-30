/**
 * Shipskart b2b admin endpoints — bootstrap (manual, OTP), status, manual reconcile.
 * Shore-side admin surface; ships never mount anything that talks to Shipskart.
 */
import { Request, Response } from 'express';
import * as tokenService from '../services/shipskartTokenService';
import * as reconciler from '../services/shipskartReconcilerService';
import * as b2bRepo from '../repositories/shipskartB2bRepository';

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
