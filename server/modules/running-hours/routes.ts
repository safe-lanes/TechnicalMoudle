import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as rhCtrl from './controllers/runningHoursController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Running Hours Routes
// IMPORTANT: Specific paths MUST come before the /:componentId catch-all
// to prevent Express from matching "parents", "cascade", etc. as componentId
// ══════════════════════════════════════════════════════════

// ── Running Hours: Specific Paths First ──

// GET  /running-hours/parents — list MASTER components with inherited counts
router.get('/running-hours/parents', asyncHandler(rhCtrl.listParents));

// GET  /running-hours/children/:parentCode — list INHERITED children for a parent
router.get('/running-hours/children/:parentCode', asyncHandler(rhCtrl.listChildren));

// PUT  /running-hours/child/:componentId — update child (INHERITED) component RH
router.put('/running-hours/child/:componentId', asyncHandler(rhCtrl.updateChildRH));

// POST /running-hours — create audit entry
router.post('/running-hours', asyncHandler(rhCtrl.createAudit));

// POST /running-hours/cascade — cascade update to parent and children
router.post('/running-hours/cascade', asyncHandler(rhCtrl.cascadeUpdate));

// POST /running-hours/reset-child/:componentId — reset child RH to 0
router.post('/running-hours/reset-child/:componentId', asyncHandler(rhCtrl.resetChildRH));

// POST /running-hours/propagate-all — one-time propagation of all MASTER -> INHERITED
router.post('/running-hours/propagate-all', asyncHandler(rhCtrl.propagateAll));

// GET  /running-hours/:componentId — get audits for component (CATCH-ALL — must be last)
router.get('/running-hours/:componentId', asyncHandler(rhCtrl.getAudits));

// ── RH Config Endpoints ──

// GET  /rh-config/master-components/:vesselId — list master components for dropdown
router.get('/rh-config/master-components/:vesselId', asyncHandler(rhCtrl.listMasterComponents));

// GET  /rh-config/inherited/:masterComponentId — list inherited components for a master
router.get('/rh-config/inherited/:masterComponentId', asyncHandler(rhCtrl.listInheritedComponents));

// PUT  /rh-config/master/:componentId — update master RH with cascade
router.put('/rh-config/master/:componentId', asyncHandler(rhCtrl.updateMasterRH));

// GET  /rh-config/:componentId — get RH configuration for a component
router.get('/rh-config/:componentId', asyncHandler(rhCtrl.getRHConfig));

// PUT  /rh-config/:componentId — update RH counter type configuration
router.put('/rh-config/:componentId', asyncHandler(rhCtrl.updateRHConfig));

export default router;
