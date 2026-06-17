/**
 * Retention & Disposition routes (Audit Phase 4) — admin-only.
 */
import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePMSAdmin } from '../../middleware/auth';
import * as ctrl from './controller';

const router = Router();

router.get('/admin/retention-settings', requirePMSAdmin, asyncHandler(ctrl.getRetentionSettings));
router.put('/admin/retention-settings/:category', requirePMSAdmin, asyncHandler(ctrl.updateRetentionSetting));
router.post('/admin/retention-settings/:category/dispose', requirePMSAdmin, asyncHandler(ctrl.disposeCategory));
router.post('/admin/retention-settings/:category/retain', requirePMSAdmin, asyncHandler(ctrl.retainCategory));
router.post('/admin/retention-settings/:category/revert', requirePMSAdmin, asyncHandler(ctrl.revertCategory));

export default router;
