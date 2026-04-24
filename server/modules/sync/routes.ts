import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as syncController from './controller';

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

export default router;
