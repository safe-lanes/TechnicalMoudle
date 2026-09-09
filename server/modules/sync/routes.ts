import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as syncController from './controller';
import * as conflictReviewCtrl from './conflictReviewController';
import { requireOfflineAdmin } from './middleware';
import { syncTenantGuard } from '../../middleware/syncTenantGuard';
import { requirePermission } from '../../middleware/permissions';

const router = Router();

// ── Permission policy (requirePermission — SESSION admin routes only) ──
// Machine-authenticated sync protocol routes (syncTenantGuard) are NEVER touched.
// Session admin writes layer requirePermission AFTER requireOfflineAdmin (where present):
//   • dashboard ops (prune, drift/scan, settings PUT/test, trigger, file retry/skip)
//     → 'admin-sync-dashboard' / 'edit'
//   • provisioning (import, verify, :vesselId) → 'admin-sync-provisioning' / 'edit'
//   • conflict resolution (resolve-conflict, review apply-incoming/dismiss)
//     → 'admin-sync-conflicts' / 'edit'
// Sail/PMS Admin bypass; unconfigured roles fail-open (see middleware).

// Sync protocol endpoints (server-to-server, ship->shore). syncTenantGuard routes
// these fail-closed by X-Sync-Instance-Id + per-tenant X-Sync-Api-Key (Phase 4b);
// it is inert when MASTER_DATABASE_URL is unset (dev/ship) — byte-identical to today.
// (resolve-conflict is a BROWSER route — it routes via tenantMiddleware, not the guard.)
router.post('/sync/initiate', syncTenantGuard, asyncHandler(syncController.initiateSyncHandler));
router.post('/sync/push', syncTenantGuard, asyncHandler(syncController.pushHandler));
router.post('/sync/pull', syncTenantGuard, asyncHandler(syncController.pullHandler));
router.post('/sync/resolve-conflict', requirePermission('admin-sync-conflicts', 'edit'), asyncHandler(syncController.resolveConflictHandler));
router.post('/sync/complete', syncTenantGuard, asyncHandler(syncController.completeSyncHandler));
// Self-heal fetch (pull direction): ship requests complete rows for fragments targeting
// rows absent on the ship. Server-to-server — same guard, and MUST be in exemptPaths.
router.post('/sync/fetch-rows', syncTenantGuard, asyncHandler(syncController.fetchRowsHandler));
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
router.post('/sync/conflicts/review/:id/apply-incoming', requirePermission('admin-sync-conflicts', 'edit'), asyncHandler(conflictReviewCtrl.applyIncomingHandler));
router.post('/sync/conflicts/review/:id/dismiss', requirePermission('admin-sync-conflicts', 'edit'), asyncHandler(conflictReviewCtrl.dismissHandler));

// Sync engine trigger (manual or scheduled)
router.post('/sync/trigger', requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.triggerSyncHandler));

// File sync endpoints
router.post('/sync/file/upload-chunk', syncTenantGuard, asyncHandler(syncController.uploadChunkHandler));
// Shore→ship pull (mirror of upload-chunk; same syncTenantGuard auth). Specific paths registered
// before the /:queueUuid/* action routes below.
router.post('/sync/file/pending', syncTenantGuard, asyncHandler(syncController.pendingFilesHandler));
router.post('/sync/file/download-chunk', syncTenantGuard, asyncHandler(syncController.downloadChunkHandler));
router.get('/sync/file/queue', asyncHandler(syncController.fileQueueHandler));
router.post('/sync/file/:queueUuid/retry', requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.retryFileHandler));
router.post('/sync/file/:queueUuid/skip', requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.skipFileHandler));
router.post('/sync/file/:queueUuid/complete', syncTenantGuard, asyncHandler(syncController.completeFileHandler));
router.post('/sync/file/:queueUuid/fail', syncTenantGuard, asyncHandler(syncController.failFileHandler));

// Pruning & Health endpoints
router.post('/sync/prune', requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.pruneHandler));
router.get('/sync/health', asyncHandler(syncController.healthCheckHandler));
// Drift findings — row value vs its OWN newest field log (migration 143). Read-only.
router.get('/sync/drift', requireOfflineAdmin, asyncHandler(syncController.driftListHandler));
router.post('/sync/drift/scan', requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.driftScanHandler));
router.get('/sync/table-stats', asyncHandler(syncController.tableStatsHandler));

// Settings endpoints (admin only)
router.get('/sync/settings', requireOfflineAdmin, asyncHandler(syncController.getSettingsHandler));
router.put('/sync/settings', requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.updateSettingsHandler));
router.post('/sync/settings/test-connection', requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.testConnectionHandler));

// Fleet overview (shore admin)
router.get('/sync/fleet-overview', requireOfflineAdmin, asyncHandler(syncController.fleetOverviewHandler));

// Instance info (public — used by frontend to determine ship vs shore)
router.get('/sync/instance-info', asyncHandler(syncController.instanceInfoHandler));

// Diagnostic log endpoints (for QA / debugging)
router.get('/sync/diag-log', asyncHandler(syncController.diagLogHandler));
router.get('/sync/diag-logs', asyncHandler(syncController.diagLogsListHandler));

// Provisioning endpoints (offline_admin / Sail Admin gated)
// Static routes MUST come before parameterized :vesselId to avoid Express matching "import"/"verify" as a vesselId
router.post('/sync/provision/import', requireOfflineAdmin, requirePermission('admin-sync-provisioning', 'edit'), asyncHandler(syncController.importProvisionHandler));
router.post('/sync/provision/verify', requireOfflineAdmin, requirePermission('admin-sync-provisioning', 'edit'), asyncHandler(syncController.verifyProvisionHandler));
router.post('/sync/provision/:vesselId', requireOfflineAdmin, requirePermission('admin-sync-provisioning', 'edit'), asyncHandler(syncController.generateProvisionHandler));
router.get('/sync/provision/manifest/:vesselId', requireOfflineAdmin, asyncHandler(syncController.getManifestHandler));
router.get('/sync/provision/download/:vesselId', requireOfflineAdmin, asyncHandler(syncController.downloadProvisionHandler));

export default router;
