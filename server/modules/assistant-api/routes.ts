/**
 * Assistant Data API routes (Stage 3) — additive; the embedded /chat is untouched.
 * manifest/execute are service-to-service (secret + signed identity, no session);
 * token mint rides the user's authenticated session (requireAuth) and reads req.rbac.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controller';

const router = Router();

router.get('/assistant/manifest', asyncHandler(ctrl.handleManifest));
router.post('/assistant/execute', asyncHandler(ctrl.handleExecute));
router.get('/assistant/token', requireAuth, asyncHandler(ctrl.handleMintToken));

export default router;
