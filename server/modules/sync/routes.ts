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

// Pruning & Health endpoints
router.post('/sync/prune', requireOfflineAdmin, asyncHandler(syncController.pruneHandler));
router.get('/sync/health', asyncHandler(syncController.healthCheckHandler));
router.get('/sync/table-stats', asyncHandler(syncController.tableStatsHandler));

// Settings endpoints (admin only)
router.get('/sync/settings', requireOfflineAdmin, asyncHandler(syncController.getSettingsHandler));
router.put('/sync/settings', requireOfflineAdmin, asyncHandler(syncController.updateSettingsHandler));
router.post('/sync/settings/test-connection', requireOfflineAdmin, asyncHandler(syncController.testConnectionHandler));

// Fleet overview (shore admin)
router.get('/sync/fleet-overview', requireOfflineAdmin, asyncHandler(syncController.fleetOverviewHandler));

// Instance info (public — used by frontend to determine ship vs shore)
router.get('/sync/instance-info', asyncHandler(syncController.instanceInfoHandler));

// Provisioning endpoints (offline_admin / Sail Admin gated)
// Static routes MUST come before parameterized :vesselId to avoid Express matching "import"/"verify" as a vesselId
router.post('/sync/provision/import', requireOfflineAdmin, asyncHandler(syncController.importProvisionHandler));
router.post('/sync/provision/verify', requireOfflineAdmin, asyncHandler(syncController.verifyProvisionHandler));
router.post('/sync/provision/:vesselId', requireOfflineAdmin, asyncHandler(syncController.generateProvisionHandler));
router.get('/sync/provision/manifest/:vesselId', requireOfflineAdmin, asyncHandler(syncController.getManifestHandler));
router.get('/sync/provision/download/:vesselId', requireOfflineAdmin, asyncHandler(syncController.downloadProvisionHandler));

export default router;
