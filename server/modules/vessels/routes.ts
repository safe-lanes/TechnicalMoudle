import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePermission } from '../../middleware/permissions';
import * as ctrl from './controllers/vesselController';

const router = Router();

// ── Permission policy (requirePermission, per-endpoint) ──
// Fleets / fleet-classes / vessels writes → 'admin-masters' by method
// (POST=create, PUT=edit, DELETE=delete). Vessel-location-names PUT is also an
// admin-masters edit. PMS vessel settings + company-standard-grace settings →
// 'pms-admin' (POST=[create,edit], PUT=edit, DELETE=delete). GETs stay open.
// Sail/PMS Admin bypass; unconfigured roles fail-open (see middleware).

// ── Fleet Registry CRUD ──

router.get('/fleets', asyncHandler(ctrl.getFleets));
router.get('/fleets/:id', asyncHandler(ctrl.getFleetById));
router.post('/fleets', requirePermission('admin-masters', 'create'), asyncHandler(ctrl.createFleet));
router.put('/fleets/:id', requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.updateFleet));
router.delete('/fleets/:id', requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.deleteFleet));
router.get('/fleets/:id/vessels', asyncHandler(ctrl.getVesselsByFleet));

// ── Fleet Class CRUD ──

router.get('/fleets/:fleetId/classes', asyncHandler(ctrl.getFleetClasses));
router.post('/fleets/:fleetId/classes', requirePermission('admin-masters', 'create'), asyncHandler(ctrl.createFleetClass));
router.put('/fleet-classes/:fcuuid', requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.updateFleetClass));
router.delete('/fleet-classes/:fcuuid', requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.deleteFleetClass));

// ── Vessel CRUD ──

router.get('/vessels', asyncHandler(ctrl.getVessels));
router.post('/vessels', requirePermission('admin-masters', 'create'), asyncHandler(ctrl.createVessel));
router.get('/vessels-with-fleets', asyncHandler(ctrl.getVesselsWithFleets));
router.put('/vessels/:id/fleet', requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.assignVesselToFleet));
router.put('/vessels/:id/class', requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.assignVesselToClass));

// ── PMS Vessel Settings ──

router.get('/pms-vessel-settings', asyncHandler(ctrl.getAllPmsVesselSettings));
router.post('/pms-vessel-settings', requirePermission('pms-admin', ['create', 'edit']), asyncHandler(ctrl.createPmsVesselSettings));
router.get('/pms-vessel-settings/:vesselId', asyncHandler(ctrl.getPmsVesselSettings));
router.put('/pms-vessel-settings/:vesselId', requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updatePmsVesselSettings));
router.delete('/pms-vessel-settings/:vesselId', requirePermission('pms-admin', 'delete'), asyncHandler(ctrl.deletePmsVesselSettings));

// ── Company Standard Grace Settings ──

router.get('/company-standard-grace-settings', asyncHandler(ctrl.getCompanyStandardGraceSettings));
router.put('/company-standard-grace-settings', requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updateCompanyStandardGraceSettings));

// ── Vessel Location Names ──

router.get('/vessel-location-names/:vesselId', asyncHandler(ctrl.getVesselLocationNames));
router.put('/vessel-location-names/:vesselId', requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.updateVesselLocationNames));

export default router;
