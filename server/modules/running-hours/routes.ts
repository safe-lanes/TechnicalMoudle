import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requireAuth, requirePMSAdmin } from '../../middleware/auth';
import * as rhCtrl from './controllers/runningHoursController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Running Hours Routes
// IMPORTANT: Specific paths MUST come before the /:componentId catch-all
// to prevent Express from matching "parents", "cascade", etc. as componentId
// ══════════════════════════════════════════════════════════

// ── Running Hours History ──
router.get('/running-hours/history', requireAuth, asyncHandler(rhCtrl.getHistory));
router.get('/running-hours/history/export', requireAuth, asyncHandler(rhCtrl.exportHistory));

// ── Layer 7: RH Timeline Validation Endpoints ──

// GET  /running-hours/valid-range — calculate valid RH range for a completion date
router.get('/running-hours/valid-range', requireAuth, asyncHandler(rhCtrl.getValidRange));

// POST /running-hours/validate — validate a proposed RH entry (non-mutating check, used by WO flow)
router.post('/running-hours/validate', requireAuth, asyncHandler(rhCtrl.validateRHEntry));

// GET  /running-hours/timeline — get complete RH timeline for a machinery
router.get('/running-hours/timeline', requireAuth, asyncHandler(rhCtrl.getRHTimeline));

// GET  /running-hours/current — get current RH from module
router.get('/running-hours/current', requireAuth, asyncHandler(rhCtrl.getCurrentRH));

// ── Running Hours: Specific Paths First ──

// GET  /running-hours/parents — list MASTER components with inherited counts
router.get('/running-hours/parents', requireAuth, asyncHandler(rhCtrl.listParents));

// GET  /running-hours/children/:parentCode — list INHERITED children for a parent
router.get('/running-hours/children/:parentCode', requireAuth, asyncHandler(rhCtrl.listChildren));

// PUT  /running-hours/child/:componentId — update child (INHERITED) component RH
router.put('/running-hours/child/:componentId', requirePMSAdmin, asyncHandler(rhCtrl.updateChildRH));

// POST /running-hours — create audit entry
router.post('/running-hours', requirePMSAdmin, asyncHandler(rhCtrl.createAudit));

// POST /running-hours/cascade — cascade update to parent and children
router.post('/running-hours/cascade', requirePMSAdmin, asyncHandler(rhCtrl.cascadeUpdate));

// POST /running-hours/reset-child/:componentId — reset child RH to 0
router.post('/running-hours/reset-child/:componentId', requirePMSAdmin, asyncHandler(rhCtrl.resetChildRH));

// POST /running-hours/propagate-all — one-time propagation of all MASTER -> INHERITED
router.post('/running-hours/propagate-all', requirePMSAdmin, asyncHandler(rhCtrl.propagateAll));

// GET  /running-hours/:componentId — get audits for component (CATCH-ALL — must be last)
router.get('/running-hours/:componentId', requireAuth, asyncHandler(rhCtrl.getAudits));

// ── RH Config Endpoints ──

// GET  /rh-config/master-components/:vesselId — list master components for dropdown
router.get('/rh-config/master-components/:vesselId', requireAuth, asyncHandler(rhCtrl.listMasterComponents));

// GET  /rh-config/inherited/:masterComponentId — list inherited components for a master
router.get('/rh-config/inherited/:masterComponentId', requireAuth, asyncHandler(rhCtrl.listInheritedComponents));

// PUT  /rh-config/master/:componentId — update master RH with cascade
router.put('/rh-config/master/:componentId', requirePMSAdmin, asyncHandler(rhCtrl.updateMasterRH));

// GET  /rh-config/:componentId — get RH configuration for a component
router.get('/rh-config/:componentId', requireAuth, asyncHandler(rhCtrl.getRHConfig));

// PUT  /rh-config/:componentId — update RH counter type configuration
router.put('/rh-config/:componentId', requirePMSAdmin, asyncHandler(rhCtrl.updateRHConfig));

export default router;
