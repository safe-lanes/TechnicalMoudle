import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as shipskartSsoController from './controllers/shipskartSsoController';
import * as shipskartRoleMappingController from './controllers/shipskartRoleMappingController';
import * as shipskartB2bController from './controllers/shipskartB2bController';

const router = Router();

// Backend-only Shipskart SSO endpoints (mounted under /api).
// The frontend calls these; it NEVER calls Shipskart directly.
router.post('/shipskart/sso/initiate', asyncHandler(shipskartSsoController.initiateHandler));
router.post('/shipskart/sso/logout', asyncHandler(shipskartSsoController.logoutHandler));

// Role-mapping admin endpoints (browser routes; tenantMiddleware scopes per tenant).
router.get('/shipskart/role-mappings', asyncHandler(shipskartRoleMappingController.getRoleMappingsHandler));
router.put('/shipskart/role-mappings', asyncHandler(shipskartRoleMappingController.putRoleMappingsHandler));

// b2b integration admin endpoints (Stage 2) — shore-side only surface.
// bootstrap = the ~90-day manual token step (OTP by email; UAT static OTP via env).
router.post('/shipskart/b2b/bootstrap', asyncHandler(shipskartB2bController.bootstrapHandler));
router.get('/shipskart/b2b/status', asyncHandler(shipskartB2bController.statusHandler));
router.post('/shipskart/b2b/reconcile', asyncHandler(shipskartB2bController.reconcileHandler));

export default router;
