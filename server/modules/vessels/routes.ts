import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controllers/vesselController';

const router = Router();

// ── Fleet Registry CRUD ──

router.get('/fleets', asyncHandler(ctrl.getFleets));
router.get('/fleets/:id', asyncHandler(ctrl.getFleetById));
router.post('/fleets', asyncHandler(ctrl.createFleet));
router.put('/fleets/:id', asyncHandler(ctrl.updateFleet));
router.delete('/fleets/:id', asyncHandler(ctrl.deleteFleet));
router.get('/fleets/:id/vessels', asyncHandler(ctrl.getVesselsByFleet));

// ── Vessel CRUD ──

router.get('/vessels', asyncHandler(ctrl.getVessels));
router.post('/vessels', asyncHandler(ctrl.createVessel));
router.get('/vessels-with-fleets', asyncHandler(ctrl.getVesselsWithFleets));
router.put('/vessels/:id/fleet', asyncHandler(ctrl.assignVesselToFleet));

// ── PMS Vessel Settings ──

router.get('/pms-vessel-settings', asyncHandler(ctrl.getAllPmsVesselSettings));
router.post('/pms-vessel-settings', asyncHandler(ctrl.createPmsVesselSettings));
router.get('/pms-vessel-settings/:vesselId', asyncHandler(ctrl.getPmsVesselSettings));
router.put('/pms-vessel-settings/:vesselId', asyncHandler(ctrl.updatePmsVesselSettings));
router.delete('/pms-vessel-settings/:vesselId', asyncHandler(ctrl.deletePmsVesselSettings));

// ── Vessel Location Names ──

router.get('/vessel-location-names/:vesselId', asyncHandler(ctrl.getVesselLocationNames));
router.put('/vessel-location-names/:vesselId', asyncHandler(ctrl.updateVesselLocationNames));

export default router;
