import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePMSAdmin } from '../../middleware/auth';
import * as ctrl from './controllers/rotationalItemController';

const router = Router();

// Rotational Items master registry (vessel-scoped).
// GET is open (mirrors other module GETs); all writes are PMS/Sail Admin gated —
// the Master List screen is the only UI that creates/edits/deletes stamps (Task #366).
router.get('/rotational-items', asyncHandler(ctrl.listRotationalItems));
router.post('/rotational-items', requirePMSAdmin, asyncHandler(ctrl.createRotationalItem));
// Transactional replacement of the installed item on a component (rotation swap).
// Resets the component's RH baseline, so gated to PMS/Sail Admin like master RH edits.
router.post('/rotational-items/swap', requirePMSAdmin, asyncHandler(ctrl.replaceRotationalItem));
router.put('/rotational-items/:riuuid', requirePMSAdmin, asyncHandler(ctrl.updateRotationalItem));
router.delete('/rotational-items/:riuuid', requirePMSAdmin, asyncHandler(ctrl.deleteRotationalItem));

export default router;
