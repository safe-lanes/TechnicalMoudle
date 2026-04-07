import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controller';

const router = Router();

router.get('/admin/available-ranks', asyncHandler(ctrl.getRanks));
router.post('/admin/available-ranks', asyncHandler(ctrl.saveRanks));
router.delete('/admin/available-ranks/:rankId', asyncHandler(ctrl.deleteRank));

router.get('/admin/vessel-org-chart', asyncHandler(ctrl.getOrgChart));
router.post('/admin/vessel-org-chart', asyncHandler(ctrl.saveOrgChart));
router.delete('/admin/vessel-org-chart/:id', asyncHandler(ctrl.deleteOrgChartEntry));

export default router;
