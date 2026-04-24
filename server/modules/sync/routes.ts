import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as syncController from './controller';
import { requireOfflineAdmin } from './middleware';

const router = Router();

// Sync protocol endpoints
router.post('/sync/initiate', asyncHandler(syncController.initiateSyncHandler));
router.post('/sync/push', asyncHandler(syncController.pushHandler));
router.post('/sync/pull', asyncHandler(syncController.pullHandler));
router.post('/sync/resolve-conflict', asyncHandler(syncController.resolveConflictHandler));
router.post('/sync/complete', asyncHandler(syncController.completeSyncHandler));
router.get('/sync/status', asyncHandler(syncController.statusHandler));

// Sync admin endpoints (for shore-side management)
router.get('/sync/batches', asyncHandler(syncController.recentBatchesHandler));
router.get('/sync/conflicts', asyncHandler(syncController.unresolvedConflictsHandler));

// Sync engine trigger (manual or scheduled)
router.post('/sync/trigger', asyncHandler(syncController.triggerSyncHandler));

// File sync endpoints
router.post('/sync/file/upload-chunk', asyncHandler(syncController.uploadChunkHandler));
router.get('/sync/file/queue', asyncHandler(syncController.fileQueueHandler));

// Provisioning endpoints (offline_admin / Sail Admin gated)
// Static routes MUST come before parameterized :vesselId to avoid Express matching "import"/"verify" as a vesselId
router.post('/sync/provision/import', requireOfflineAdmin, asyncHandler(syncController.importProvisionHandler));
router.post('/sync/provision/verify', requireOfflineAdmin, asyncHandler(syncController.verifyProvisionHandler));
router.post('/sync/provision/:vesselId', requireOfflineAdmin, asyncHandler(syncController.generateProvisionHandler));
router.get('/sync/provision/manifest/:vesselId', requireOfflineAdmin, asyncHandler(syncController.getManifestHandler));
router.get('/sync/provision/download/:vesselId', requireOfflineAdmin, asyncHandler(syncController.downloadProvisionHandler));

export default router;
