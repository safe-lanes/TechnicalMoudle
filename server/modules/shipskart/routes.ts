import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as shipskartSsoController from './controllers/shipskartSsoController';

const router = Router();

// Backend-only Shipskart SSO endpoints (mounted under /api).
// The frontend calls these; it NEVER calls Shipskart directly.
router.post('/shipskart/sso/initiate', asyncHandler(shipskartSsoController.initiateHandler));
router.post('/shipskart/sso/logout', asyncHandler(shipskartSsoController.logoutHandler));

export default router;
