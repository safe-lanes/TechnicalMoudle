import { Router } from 'express';
import * as ctrl from './controllers/sparesController';

export function createSparesRouter(): Router {
  const router = Router();

  router.get('/', ctrl.listAll);
  router.post('/bulk-update', ctrl.bulkUpdateHandler);
  router.get('/history/:vesselId', ctrl.historyByVessel);

  router.post('/:suuid/consume', ctrl.consume);
  router.post('/:suuid/receive', ctrl.receive);
  router.post('/:suuid/consume-from-location', ctrl.consumeFromLocation);
  router.post('/:suuid/receive-to-location', ctrl.receiveToLocation);

  router.get('/:vesselId', ctrl.listByVessel);
  router.post('/:vesselId', ctrl.create);
  router.get('/:vesselId/history', ctrl.historyByVesselLegacy);
  router.get('/:vesselId/low-stock', ctrl.lowStock);
  router.post('/:vesselId/batch-consume', ctrl.batchConsumeHandler);
  router.post('/:vesselId/batch-receive', ctrl.batchReceiveHandler);

  router.get('/:vesselId/:suuid', ctrl.getById);
  router.patch('/:vesselId/:suuid', ctrl.update);
  router.delete('/:vesselId/:suuid', ctrl.remove);
  router.post('/:vesselId/:suuid/adjustment', ctrl.adjustment);
  router.post('/:vesselId/:suuid/adjust', ctrl.adjust);

  return router;
}
