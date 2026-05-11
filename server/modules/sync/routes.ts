import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as syncController from './controller';
import * as conflictReviewCtrl from './conflictReviewController';
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

// Conflict Review endpoints (unified view over sync_conflict_log + sync_conflicts)
// Static paths MUST come before :id to avoid Express matching "count"/"tables" as an :id
router.get('/sync/conflicts/review/count', asyncHandler(conflictReviewCtrl.countConflictsHandler));
router.get('/sync/conflicts/review/tables', asyncHandler(conflictReviewCtrl.conflictTablesHandler));
router.get('/sync/conflicts/review', asyncHandler(conflictReviewCtrl.listConflictsHandler));
router.get('/sync/conflicts/review/:id', asyncHandler(conflictReviewCtrl.getConflictHandler));
router.post('/sync/conflicts/review/:id/apply-incoming', asyncHandler(conflictReviewCtrl.applyIncomingHandler));
router.post('/sync/conflicts/review/:id/dismiss', asyncHandler(conflictReviewCtrl.dismissHandler));

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

// Diagnostic log endpoints (for QA / debugging)
router.get('/sync/diag-log', asyncHandler(syncController.diagLogHandler));
router.get('/sync/diag-logs', asyncHandler(syncController.diagLogsListHandler));

// Provisioning endpoints (offline_admin / Sail Admin gated)
// Static routes MUST come before parameterized :vesselId to avoid Express matching "import"/"verify" as a vesselId
router.post('/sync/provision/import', requireOfflineAdmin, asyncHandler(syncController.importProvisionHandler));
router.post('/sync/provision/verify', requireOfflineAdmin, asyncHandler(syncController.verifyProvisionHandler));
router.post('/sync/provision/:vesselId', requireOfflineAdmin, asyncHandler(syncController.generateProvisionHandler));
router.get('/sync/provision/manifest/:vesselId', requireOfflineAdmin, asyncHandler(syncController.getManifestHandler));
router.get('/sync/provision/download/:vesselId', requireOfflineAdmin, asyncHandler(syncController.downloadProvisionHandler));

export default router;
