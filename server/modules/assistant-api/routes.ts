/**
 * Assistant Data API routes (Stage 3) — additive; the embedded /chat is untouched.
 * manifest/execute are service-to-service (secret + signed identity, no session);
 * token mint rides the user's authenticated session (requireAuth) and reads req.rbac.
 *
 * SHORE-ONLY (23-Sep-2026): the assistant is an office feature. On a ship instance
 * (deployment mode = SYNC_INSTANCE_ID / sync_settings.instance_id starting 'SHIP-',
 * the same predicate every other ship/shore guard uses — syncRole.isShipInstance,
 * DB value first) every assistant endpoint is refused BEFORE auth or secrets are
 * looked at, whatever the caller's role or userType. The widget hides itself on a
 * ship via /sync/instance-info; this is the server-side half of the same rule.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controller';

const router = Router();

async function shoreOnly(_req: Request, res: Response, next: NextFunction) {
  const { isShipInstance } = await import('../sync/syncRole');
  if (await isShipInstance()) {
    return res.status(403).json({ error: 'assistant is shore-only: not available on a ship instance' });
  }
  next();
}

router.use('/assistant', asyncHandler(shoreOnly));
router.get('/assistant/manifest', asyncHandler(ctrl.handleManifest));
router.post('/assistant/execute', asyncHandler(ctrl.handleExecute));
router.get('/assistant/token', requireAuth, asyncHandler(ctrl.handleMintToken));

export default router;
