import { Router } from 'express';
import * as ctrl from './controllers/vesselController';

export function createVesselRouter(): Router {
  const router = Router();

  router.get('/', ctrl.listAll);
  router.get('/active', ctrl.listActive);
  router.get('/with-fleets', ctrl.listWithFleets);
  router.get('/fleet/:fleetId', ctrl.listByFleet);

  router.post('/', ctrl.create);

  router.get('/:vuuid', ctrl.getByVuuid);
  router.patch('/:vuuid', ctrl.update);
  router.put('/:vuuid/fleet', ctrl.assignFleet);

  return router;
}
