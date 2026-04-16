import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controller';

const router = Router();

router.get('/admin/available-ranks', asyncHandler(ctrl.getRanks));
router.get('/admin/available-ranks/:rankId', asyncHandler(ctrl.getRankById));
router.post('/admin/available-ranks', asyncHandler(ctrl.saveRanks));
router.put('/admin/available-ranks/:rankId', asyncHandler(ctrl.updateRank));
router.delete('/admin/available-ranks/:rankId', asyncHandler(ctrl.deleteRank));

router.get('/admin/vessel-org-chart', asyncHandler(ctrl.getOrgChart));
router.get('/admin/vessel-org-chart/:id', asyncHandler(ctrl.getOrgChartById));
router.post('/admin/vessel-org-chart', asyncHandler(ctrl.saveOrgChart));
router.put('/admin/vessel-org-chart/:id', asyncHandler(ctrl.updateOrgChartEntry));
router.delete('/admin/vessel-org-chart/:id', asyncHandler(ctrl.deleteOrgChartEntry));

router.get('/admin/vessel-org-chart-nodes/:vesselId', asyncHandler(ctrl.getVesselOrgChartNodes));

router.get('/admin/vessel-department-config/:vesselId', asyncHandler(ctrl.getVesselDepartmentConfig));

router.get('/hierarchy-scope/:vesselId', asyncHandler(ctrl.getHierarchyScope));

router.get('/hod/:vesselId/:department', asyncHandler(ctrl.resolveHod));

export default router;
