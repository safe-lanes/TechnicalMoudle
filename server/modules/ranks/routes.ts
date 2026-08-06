import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePermission } from '../../middleware/permissions';
import * as ctrl from './controller';

const router = Router();

// ── Permission policy (requirePermission, resource 'admin-ranks') ──
// Available-ranks and vessel-org-chart writes gated by method → create/edit/delete.
// GETs stay open. Sail/PMS Admin bypass; unconfigured roles fail-open (see middleware).

router.get('/admin/available-ranks', asyncHandler(ctrl.getRanks));
router.get('/admin/available-ranks/:rankId', asyncHandler(ctrl.getRankById));
router.post('/admin/available-ranks', requirePermission('admin-ranks', 'create'), asyncHandler(ctrl.saveRanks));
router.put('/admin/available-ranks/:rankId', requirePermission('admin-ranks', 'edit'), asyncHandler(ctrl.updateRank));
router.delete('/admin/available-ranks/:rankId', requirePermission('admin-ranks', 'delete'), asyncHandler(ctrl.deleteRank));

router.get('/admin/vessel-org-chart', asyncHandler(ctrl.getOrgChart));
router.get('/admin/vessel-org-chart/:id', asyncHandler(ctrl.getOrgChartById));
router.post('/admin/vessel-org-chart', requirePermission('admin-ranks', 'create'), asyncHandler(ctrl.saveOrgChart));
router.put('/admin/vessel-org-chart/:id', requirePermission('admin-ranks', 'edit'), asyncHandler(ctrl.updateOrgChartEntry));
router.delete('/admin/vessel-org-chart/:id', requirePermission('admin-ranks', 'delete'), asyncHandler(ctrl.deleteOrgChartEntry));

router.get('/admin/vessel-org-chart-nodes/:vesselId', asyncHandler(ctrl.getVesselOrgChartNodes));

router.get('/admin/vessel-department-config/:vesselId', asyncHandler(ctrl.getVesselDepartmentConfig));

router.get('/hierarchy-scope/:vesselId', asyncHandler(ctrl.getHierarchyScope));

router.get('/hod/:vesselId/:department', asyncHandler(ctrl.resolveHod));

export default router;
