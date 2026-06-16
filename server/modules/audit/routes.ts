/**
 * Audit Trail Viewer routes (Phase 3) — READ-ONLY, admin-only.
 */
import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePMSAdmin } from '../../middleware/auth';
import * as ctrl from './controller';

const router = Router();

// GET /admin/audit-trail — paginated, filtered business audit trail
router.get('/admin/audit-trail', requirePMSAdmin, asyncHandler(ctrl.getAuditTrail));

// GET/POST /admin/audit-trail/excel — export current filter selection to Excel
router.post('/admin/audit-trail/excel', requirePMSAdmin, asyncHandler(ctrl.exportAuditTrailExcel));
router.get('/admin/audit-trail/excel', requirePMSAdmin, asyncHandler(ctrl.exportAuditTrailExcel));

export default router;
