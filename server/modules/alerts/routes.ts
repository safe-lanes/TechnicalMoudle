import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePermission } from '../../middleware/permissions';
import * as alertsCtrl from './controllers/alertsController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Alerts Routes (/alerts/*)
// ── Permission policy (requirePermission, resource 'admin-alerts') ──
// 'admin-alerts' INTENTIONALLY has NO menu row yet, so under configured roles the
// resource resolves to no-permission and these writes are DENIED — matching the
// frontend, which hides the Alerts screen from configured roles. Unconfigured roles
// (fail-open) and Sail/PMS Admin (bypass) are unaffected. Config/policy/scan/test
// writes → 'edit'. Event acknowledge is LEFT OPEN (operational daily-op).
// ══════════════════════════════════════════════════════════

// ── Policies ──
router.get('/alerts/policies', asyncHandler(alertsCtrl.getPolicies));
router.get('/alerts/policies/:id', asyncHandler(alertsCtrl.getPolicy));
router.patch('/alerts/policies/:id', requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.updatePolicy));
router.post('/alerts/policies/batch-update', requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.batchUpdatePolicies));

// ── Events ──
router.get('/alerts/events', asyncHandler(alertsCtrl.getEvents));
router.get('/alerts/events/for-current-user', asyncHandler(alertsCtrl.getEventsForCurrentUser));
router.get('/alerts/events/:id', asyncHandler(alertsCtrl.getEvent));
router.get('/alerts/events/:id/acknowledgements', asyncHandler(alertsCtrl.getAcknowledgements));
router.post('/alerts/events/:id/acknowledge', asyncHandler(alertsCtrl.acknowledgeEvent));

// ── Engine & Test ──
router.post('/alerts/scan', requirePermission('admin-alerts', 'edit'), asyncHandler(async (req, res) => {
  const { pmsAlertEngine } = await import('./services/pmsAlertEngine');
  const results = await pmsAlertEngine.runScan();
  res.json({ success: true, ...results });
}));
router.post('/alerts/test', requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.sendTestAlert));
router.get('/alerts/config/:vesselId', asyncHandler(alertsCtrl.getConfig));
router.post('/alerts/config', requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.updateConfig));

export default router;
