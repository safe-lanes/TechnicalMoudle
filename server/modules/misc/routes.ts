import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../shared/middleware';
import { requirePMSAdmin } from '../../middleware/auth';
import * as docsCtrl from './controllers/documentsController';
import * as adminCtrl from './controllers/adminController';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ══════════════════════════════════════════════════════════
// Document Management Routes
// ══════════════════════════════════════════════════════════

router.post('/upload-document', upload.single('file'), asyncHandler(docsCtrl.uploadDocument));
router.get('/documents/:fileKey(*)', asyncHandler(docsCtrl.getDocument));
router.delete('/documents/:fileKey(*)', asyncHandler(docsCtrl.deleteDocument));

// ══════════════════════════════════════════════════════════
// Admin Routes
// ══════════════════════════════════════════════════════════

router.get('/admin/job-due-scan', asyncHandler(adminCtrl.jobDueScan));
router.post('/admin/job-due-scan', asyncHandler(adminCtrl.jobDueScan));
router.post('/admin/purge-jobs', asyncHandler(adminCtrl.purgeJobs));
router.post('/admin/migrate-inventory', asyncHandler(adminCtrl.migrateInventory));
router.post('/admin/sync-work-order-status', asyncHandler(adminCtrl.syncWorkOrderStatus));
router.post('/admin/sync-masters', requirePMSAdmin, asyncHandler(adminCtrl.syncMasters));
router.post('/admin/populate-postponement-history', asyncHandler(adminCtrl.populatePostponementHistory));
router.get('/admin/rh-diagnostic', asyncHandler(adminCtrl.rhDiagnostic));
router.post('/admin/repair-rh-tracking', asyncHandler(adminCtrl.repairRhTracking));

export default router;
