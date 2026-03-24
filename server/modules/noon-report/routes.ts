import { Router, Request, Response } from 'express';
import { NOON_MODULE_ENABLED } from './config';
import { asyncHandler } from '../shared/middleware';
import { requireOfficeOrAdmin } from '../../middleware/auth';
import * as ctrl from './controllers/noonReportController';

const router = Router();

// Feature flag — return 404 for all routes when module is disabled
if (!NOON_MODULE_ENABLED) {
  router.all('/nr-*', (_req: Request, res: Response) => res.status(404).json({ error: 'Noon Report module is disabled' }));
} else {

  // ── Noon Reports ──────────────────────────────────────────────────────────

  // GET  /nr-reports — list reports (filter by vesselId, status)
  router.get('/nr-reports', asyncHandler(ctrl.getNoonReports));

  // POST /nr-reports — create new draft report
  router.post('/nr-reports', asyncHandler(ctrl.createNoonReport));

  // GET  /nr-reports/:id — get single report
  router.get('/nr-reports/:id', asyncHandler(ctrl.getNoonReport));

  // PATCH /nr-reports/:id — update draft report
  router.patch('/nr-reports/:id', asyncHandler(ctrl.updateNoonReport));

  // PATCH /nr-reports/:id/draft — auto-save draft
  router.patch('/nr-reports/:id/draft', asyncHandler(ctrl.saveDraft));

  // POST /nr-reports/:id/submit — submit report (lock)
  router.post('/nr-reports/:id/submit', asyncHandler(ctrl.submitNoonReport));

  // DELETE /nr-reports/:id — delete draft report
  router.delete('/nr-reports/:id', asyncHandler(ctrl.deleteNoonReport));

  // ── Fuel ROB ──────────────────────────────────────────────────────────────

  // GET /nr-fuel-rob — get ROB per fuel type for a vessel
  router.get('/nr-fuel-rob', asyncHandler(ctrl.getFuelRob));

  // ── KPIs / Dashboard ─────────────────────────────────────────────────────

  // GET /nr-kpis — get rolling averages, endurance, CII for a vessel
  router.get('/nr-kpis', asyncHandler(ctrl.getVesselKPIs));

  // GET /nr-fuel-dashboard/:vesselId — full fuel dashboard payload
  router.get('/nr-fuel-dashboard/:vesselId', asyncHandler(ctrl.getFuelDashboard));

  // ── Alerts ───────────────────────────────────────────────────────────────

  // GET /nr-alerts/:vesselId/count — unacknowledged alert count (sidebar badge)
  router.get('/nr-alerts/:vesselId/count', asyncHandler(ctrl.getActiveAlertCount));

  // GET /nr-alerts/:vesselId/all — paginated full alert history
  router.get('/nr-alerts/:vesselId/all', asyncHandler(ctrl.getAllAlerts));

  // GET /nr-alerts/:vesselId — active (unacknowledged) alerts
  router.get('/nr-alerts/:vesselId', asyncHandler(ctrl.getActiveAlerts));

  // PATCH /nr-alerts/:alertId/acknowledge — acknowledge an alert (office/admin only)
  router.patch('/nr-alerts/:alertId/acknowledge', requireOfficeOrAdmin, asyncHandler(ctrl.acknowledgeAlert));

  // ── Bunker Records ────────────────────────────────────────────────────────

  // GET  /nr-bunker — list records (filter by vesselId, optional voyageNo)
  router.get('/nr-bunker', asyncHandler(ctrl.getBunkerRecords));

  // POST /nr-bunker — create new BDN record + increment ROB
  router.post('/nr-bunker', asyncHandler(ctrl.createBunkerRecord));

  // GET  /nr-bunker-cost — cost summary per fuel type
  router.get('/nr-bunker-cost', asyncHandler(ctrl.getBunkerCostSummary));

  // GET  /nr-bunker/:id — single record
  router.get('/nr-bunker/:id', asyncHandler(ctrl.getBunkerRecord));

  // PATCH /nr-bunker/:id — update record + adjust ROB delta
  router.patch('/nr-bunker/:id', asyncHandler(ctrl.updateBunkerRecord));

  // DELETE /nr-bunker/:id — delete record + decrement ROB
  router.delete('/nr-bunker/:id', asyncHandler(ctrl.deleteBunkerRecord));

}

export default router;
