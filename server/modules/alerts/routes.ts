import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as alertsCtrl from './controllers/alertsController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Alerts Routes (/alerts/*)
// ══════════════════════════════════════════════════════════

// ── Policies ──
router.get('/alerts/policies', asyncHandler(alertsCtrl.getPolicies));
router.get('/alerts/policies/:id', asyncHandler(alertsCtrl.getPolicy));
router.patch('/alerts/policies/:id', asyncHandler(alertsCtrl.updatePolicy));
router.post('/alerts/policies/batch-update', asyncHandler(alertsCtrl.batchUpdatePolicies));

// ── Events ──
router.get('/alerts/events', asyncHandler(alertsCtrl.getEvents));
router.get('/alerts/events/:id', asyncHandler(alertsCtrl.getEvent));
router.post('/alerts/events/:id/acknowledge', asyncHandler(alertsCtrl.acknowledgeEvent));

// ── Test & Config ──
router.post('/alerts/test', asyncHandler(alertsCtrl.sendTestAlert));
router.get('/alerts/config/:vesselId', asyncHandler(alertsCtrl.getConfig));
router.post('/alerts/config', asyncHandler(alertsCtrl.updateConfig));

export default router;
