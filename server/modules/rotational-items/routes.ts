import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controllers/rotationalItemController';

const router = Router();

// Rotational Items master registry (vessel-scoped).
// GET is open (mirrors other module GETs); writes will gain permission gating
// alongside the component-form work that exposes them in the UI.
router.get('/rotational-items', asyncHandler(ctrl.listRotationalItems));
router.post('/rotational-items', asyncHandler(ctrl.createRotationalItem));
router.put('/rotational-items/:riuuid', asyncHandler(ctrl.updateRotationalItem));
router.delete('/rotational-items/:riuuid', asyncHandler(ctrl.deleteRotationalItem));

export default router;
