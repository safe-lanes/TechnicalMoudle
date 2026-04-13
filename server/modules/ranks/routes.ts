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
router.post('/admin/vessel-org-chart-nodes', asyncHandler(ctrl.createVesselOrgChartNode));
router.post('/admin/vessel-org-chart-nodes/:vesselId/bulk-save', asyncHandler(ctrl.bulkSaveVesselOrgChartNodes));
router.patch('/admin/vessel-org-chart-nodes/:nodeUuid/unassign', asyncHandler(ctrl.unassignVesselOrgChartNode));
router.delete('/admin/vessel-org-chart-nodes/:nodeUuid', asyncHandler(ctrl.deleteVesselOrgChartNode));

export default router;
