import { Router } from 'express';
import * as ctrl from './controllers/sparesController';

export function createSparesRouter(): Router {
  const router = Router();

  router.get('/', ctrl.listAll);
  router.post('/bulk-update', ctrl.bulkUpdateHandler);
  router.get('/history/:vesselId', ctrl.historyByVessel);

  router.post('/:id/consume', ctrl.consume);
  router.post('/:id/receive', ctrl.receive);
  router.post('/:id/consume-from-location', ctrl.consumeFromLocation);
  router.post('/:id/receive-to-location', ctrl.receiveToLocation);

  router.get('/:vesselId', ctrl.listByVessel);
  router.post('/:vesselId', ctrl.create);
  router.get('/:vesselId/history', ctrl.historyByVesselLegacy);
  router.get('/:vesselId/low-stock', ctrl.lowStock);
  router.post('/:vesselId/batch-consume', ctrl.batchConsumeHandler);
  router.post('/:vesselId/batch-receive', ctrl.batchReceiveHandler);

  router.get('/:vesselId/:id', ctrl.getById);
  router.patch('/:vesselId/:id', ctrl.update);
  router.delete('/:vesselId/:id', ctrl.remove);
  router.post('/:vesselId/:id/adjustment', ctrl.adjustment);
  router.post('/:vesselId/:id/adjust', ctrl.adjust);

  return router;
}
