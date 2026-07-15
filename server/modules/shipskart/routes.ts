import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as shipskartSsoController from './controllers/shipskartSsoController';
import * as shipskartRoleMappingController from './controllers/shipskartRoleMappingController';

const router = Router();

// Backend-only Shipskart SSO endpoints (mounted under /api).
// The frontend calls these; it NEVER calls Shipskart directly.
router.post('/shipskart/sso/initiate', asyncHandler(shipskartSsoController.initiateHandler));
router.post('/shipskart/sso/logout', asyncHandler(shipskartSsoController.logoutHandler));

// Role-mapping admin endpoints (browser routes; tenantMiddleware scopes per tenant).
router.get('/shipskart/role-mappings', asyncHandler(shipskartRoleMappingController.getRoleMappingsHandler));
router.put('/shipskart/role-mappings', asyncHandler(shipskartRoleMappingController.putRoleMappingsHandler));

export default router;
