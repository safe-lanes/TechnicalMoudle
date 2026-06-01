import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../shared/middleware';
import { requireRole } from '../../middleware/auth';
import * as woCtrl from './controllers/workOrderController';
import * as woDocCtrl from './controllers/woDocumentController';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ── Dashboard Analytics ──

// GET /dashboard/compliance-anomalies — compliance anomaly detection metrics
router.get('/dashboard/compliance-anomalies', asyncHandler(woCtrl.getComplianceAnomalies));

// ── Anomaly Detection Dashboard (Layer 6) ──

// GET /anomalies/dashboard — list anomalies for dashboard tile
router.get('/anomalies/dashboard', asyncHandler(woCtrl.getAnomaliesDashboard));

// GET /anomalies/statistics — summary counts for dashboard header
router.get('/anomalies/statistics', asyncHandler(woCtrl.getAnomalyStatistics));

// PATCH /anomalies/:anomalyId/acknowledge — mark anomaly as acknowledged
router.patch('/anomalies/:anomalyId/acknowledge', asyncHandler(woCtrl.acknowledgeAnomaly));

// GET /anomalies/work-order/:workOrderId — anomalies for a specific WO
router.get('/anomalies/work-order/:workOrderId', asyncHandler(woCtrl.getAnomalyForWorkOrder));

// ── Work Order Planner ──

// GET  /work-orders/planner — planner data with filters
router.get('/work-orders/planner', asyncHandler(woCtrl.getPlannerData));

// PATCH /work-orders/planner/planned-date — save planned date
router.patch('/work-orders/planner/planned-date', asyncHandler(woCtrl.savePlannedDate));

// PATCH /work-orders/planner/bulk-planned-date — bulk save planned dates
router.patch('/work-orders/planner/bulk-planned-date', asyncHandler(woCtrl.bulkSavePlannedDate));

// GET  /work-orders/planner/export — export planner as Excel (server-filtered)
router.get('/work-orders/planner/export', asyncHandler(woCtrl.exportPlanner));

// POST /work-orders/planner/export — export planner as Excel from client-provided items
router.post('/work-orders/planner/export', asyncHandler(woCtrl.exportPlannerFromItems));

// ── Core Work Order CRUD ──

// GET  /work-orders — list all (optional ?vesselId= filter)
router.get('/work-orders', asyncHandler(woCtrl.listWorkOrders));

// GET  /work-orders/:id — get single work order
router.get('/work-orders/:id', asyncHandler(woCtrl.getWorkOrder));

// GET  /work-orders/:id/context — get work order context (template data, execution data, component, RH)
router.get('/work-orders/:id/context', asyncHandler(woCtrl.getWorkOrderContext));

// GET  /work-orders/:id/rejection-history — get prior rejection audit entries
router.get('/work-orders/:id/rejection-history', asyncHandler(woCtrl.getRejectionHistory));

// POST /work-orders — create work order
router.post('/work-orders', asyncHandler(woCtrl.createWorkOrder));

// PATCH /work-orders/:id — update work order (includes approval/completion flow)
router.patch('/work-orders/:id', asyncHandler(woCtrl.updateWorkOrder));

// DELETE /work-orders/:id — delete work order
router.delete('/work-orders/:id', asyncHandler(woCtrl.deleteWorkOrder));

// ── Superintendent Endpoints (Layer 5) ──

// POST /work-orders/:id/reject-completion — reject a Completed WO (Office/PMS Admin only)
router.post('/work-orders/:id/reject-completion',
  requireRole(['Office', 'PMS Admin', 'Sail Admin']),
  asyncHandler(woCtrl.rejectCompletion)
);

// POST /work-orders/:id/reopen-completion — reopen a Completed WO (Office/PMS Admin only)
router.post('/work-orders/:id/reopen-completion',
  requireRole(['Office', 'PMS Admin', 'Sail Admin']),
  asyncHandler(woCtrl.reopenCompletion)
);

// POST /work-orders/:id/superintendent-acknowledge
router.post('/work-orders/:id/superintendent-acknowledge', asyncHandler(woCtrl.superintendentAcknowledge));

// GET /superintendent/notifications — unacknowledged only
router.get('/superintendent/notifications', asyncHandler(woCtrl.getSuperintendentNotifications));

// GET /superintendent/notifications/all — all notifications
router.get('/superintendent/notifications/all', asyncHandler(woCtrl.getAllSuperintendentNotifications));

// GET /superintendent/notifications/summary — lightweight counts for dashboard tile
router.get('/superintendent/notifications/summary', asyncHandler(woCtrl.getSuperintendentNotificationsSummary));

// ── Work Order Completion ──

// POST /work-orders/:id/complete — complete a work order
router.post('/work-orders/:id/complete', asyncHandler(woCtrl.completeWorkOrder));

// ── Bulk Operations ──

// POST /work-orders/bulk-approve — bulk approve work orders
router.post('/work-orders/bulk-approve', asyncHandler(woCtrl.bulkApprove));

// POST /work-orders/bulk-reject — bulk reject work orders
router.post('/work-orders/bulk-reject', asyncHandler(woCtrl.bulkReject));

// ── Auto-Generate & Backfill ──

// POST /work-orders/auto-generate — auto-generate work orders for due jobs
router.post('/work-orders/auto-generate', asyncHandler(woCtrl.autoGenerate));

// POST /work-orders/backfill-job-ids — backfill missing jobId fields
router.post('/work-orders/backfill-job-ids', asyncHandler(woCtrl.backfillJobIds));

// ── Overdue Reason ──

// POST /work-orders/:id/overdue-reason — save overdue reason for a work order
router.post('/work-orders/:id/overdue-reason', asyncHandler(woCtrl.saveOverdueReason));

// ── Status Recalculation & Postponements ──

// POST /work-orders/recalculate-statuses — force status recalculation
router.post('/work-orders/recalculate-statuses', asyncHandler(woCtrl.recalculateStatuses));

// POST /work-orders/check-postponements — check and revert postponed work orders
router.post('/work-orders/check-postponements', asyncHandler(woCtrl.checkPostponements));

// ── Work Order Executions ──

// GET  /work-order-executions/:componentId — get executions for component
router.get('/work-order-executions/:componentId', asyncHandler(woCtrl.getExecutions));

// GET  /work-order-executions/details/:id — get single execution
router.get('/work-order-executions/details/:id', asyncHandler(woCtrl.getExecution));

// POST /work-order-executions — create execution
router.post('/work-order-executions', asyncHandler(woCtrl.createExecution));

// PATCH /work-order-executions/:id — update execution
router.patch('/work-order-executions/:id', asyncHandler(woCtrl.updateExecution));

// ── Work Order Documents ──

// GET  /work-orders/:workOrderId/documents — list documents for a work order
router.get('/work-orders/:workOrderId/documents', asyncHandler(woDocCtrl.listDocuments));

// POST /work-orders/:workOrderId/documents — upload a document
router.post('/work-orders/:workOrderId/documents', upload.single('file'), asyncHandler(woDocCtrl.uploadDocument));

// GET  /work-order-documents/:documentId/download — download/view a document
router.get('/work-order-documents/:documentId/download', asyncHandler(woDocCtrl.downloadDocument));

// DELETE /work-order-documents/:documentId — delete a document
router.delete('/work-order-documents/:documentId', asyncHandler(woDocCtrl.deleteDocument));

// GET /scoped-operation-data/:vesselId?mode=me|myTeam — server-side scoped operation dashboard data
router.get('/scoped-operation-data/:vesselId', asyncHandler(woCtrl.getScopedOperationData));

export default router;
