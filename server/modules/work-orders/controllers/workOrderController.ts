import { Request, Response } from 'express';
import * as woService from '../services/workOrderService';
import * as woContextService from '../services/workOrderContextService';
import * as woCompletionService from '../services/workOrderCompletionService';
import * as woBulkService from '../services/workOrderBulkService';
import * as woAutoService from '../services/workOrderAutoService';
import * as executionService from '../services/executionService';
import * as complianceAnomalyService from '../services/complianceAnomalyService';
import * as plannerService from '../services/workOrderPlannerService';
import { ValidationError } from '../../shared/errors';
import { storage } from '../../../storage';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import type {
  WorkOrderPeriodFilter,
  WorkOrderSortField,
  WorkOrderSortDir,
} from '@shared/utils/workOrderFilters';

// Resolve a human-readable identity for the authenticated user so that audit
// logs (e.g. rejection history) can show a real approver instead of "system".
function resolveActorIdentity(req: Request): string | undefined {
  const { user } = req as AuthenticatedRequest;
  if (!user) return undefined;
  const firstLast = [user.firstname, user.lastname].filter(Boolean).join(' ').trim();
  const candidates: Array<string | undefined | null> = [
    user.rank_name,
    user.fullName,
    firstLast || undefined,
    user.username,
    user.email,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

// ── Core Work Order CRUD ──

export async function listWorkOrders(req: Request, res: Response) {
  const vesselId = req.query.vesselId as string;
  const vesselIdsRaw = req.query.vesselIds as string | undefined;
  const vesselIds = vesselIdsRaw ? vesselIdsRaw.split(',').filter(Boolean) : undefined;

  // Backward-compatible: only the paginated path is gated behind `?page=`.
  // Without it, return the raw enriched array exactly as before so the other
  // (non-Work-Orders-module) consumers stay untouched.
  if (req.query.page === undefined) {
    const result = await woService.listWorkOrders(vesselId, vesselIds);
    return res.json(result);
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSizeRaw = parseInt(req.query.pageSize as string, 10) || 10;
  const pageSize = Math.min(200, Math.max(1, pageSizeRaw));

  let period: WorkOrderPeriodFilter | null = null;
  if (typeof req.query.period === 'string' && req.query.period) {
    try {
      period = JSON.parse(req.query.period) as WorkOrderPeriodFilter;
    } catch {
      period = null;
    }
  }

  const criticality = typeof req.query.criticality === 'string' && req.query.criticality
    ? req.query.criticality.split(',').filter(Boolean)
    : [];

  const sortByRaw = typeof req.query.sortBy === 'string' ? req.query.sortBy : '';
  const sortDirRaw = req.query.sortDir === 'desc' ? 'desc' : 'asc';

  const result = await woService.listWorkOrdersPaged(vesselId, vesselIds, {
    page,
    pageSize,
    activeTab: typeof req.query.status === 'string' ? req.query.status : 'Planned',
    search: typeof req.query.search === 'string' ? req.query.search : '',
    period,
    rank: typeof req.query.rank === 'string' ? req.query.rank : '',
    criticality,
    postponementReason: typeof req.query.postponementReason === 'string' ? req.query.postponementReason : '',
    sortField: sortByRaw ? (sortByRaw as WorkOrderSortField) : null,
    sortDir: sortDirRaw as WorkOrderSortDir,
  });

  res.json({ success: true, data: result });
}

export async function getWorkOrder(req: Request, res: Response) {
  const result = await woService.getWorkOrder(req.params.id);
  res.json(result);
}

// POST /work-orders/generate-now — office on-demand generation sweep for ONE vessel.
// Reuses the exact generation logic of the (ship-side) daily scanner, but runs
// only when a user clicks it. This is the office's replacement for the removed
// every-minute shore auto-scan: manual, user-triggered, scoped to the selected
// vessel (for setup/QA). The single-WO manual-create path is unchanged.
export async function generateNow(req: Request, res: Response) {
  const vesselId = ((req.body && req.body.vesselId) ?? req.query.vesselId) as string | undefined;
  if (!vesselId || typeof vesselId !== 'string' || vesselId === 'all') {
    throw new ValidationError('A specific vesselId is required to generate work orders.');
  }

  // Dynamic import mirrors routes.ts and avoids a static cycle with the scanner.
  const { jobDueScanner } = await import('../../../services/jobDueScanner');
  const result = await jobDueScanner.runScan(vesselId);

  if (result.skipped) {
    return res.status(409).json({
      success: false,
      message: 'A work-order generation run is already in progress. Please try again in a moment.',
    });
  }

  const generated = result.calendarWOsGenerated + result.rhWOsGenerated + result.dualWOsGenerated;
  const checked = result.calendarJobsChecked + result.rhJobsChecked + result.dualJobsChecked;
  res.json({
    success: true,
    vesselId,
    generated,
    checked,
    breakdown: result,
    message: generated > 0
      ? `Generated ${generated} work order(s) from ${checked} due job(s).`
      : `No work orders were due. Checked ${checked} job(s).`,
  });
}

export async function getWorkOrderContext(req: Request, res: Response) {
  const result = await woContextService.getWorkOrderContext(req.params.id);
  res.json(result);
}

export async function getRejectionHistory(req: Request, res: Response) {
  try {
    const result = await woService.getRejectionHistory(req.params.id);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
}

export async function createWorkOrder(req: Request, res: Response) {
  try {
    const workOrder = await woService.createWorkOrder(req.body);
    res.status(201).json(workOrder);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid work order data", details: error.errors });
    }
    throw error;
  }
}

export async function updateWorkOrder(req: Request, res: Response) {
  try {
    const actor = resolveActorIdentity(req);
    const authReq = req as AuthenticatedRequest;
    const body = { ...req.body };
    if (actor) {
      // Prefer caller-supplied userId, but fall back to the authenticated user
      // so audit entries (e.g. rejections) capture a real identity.
      if (!body.userId || body.userId === 'system') body.userId = actor;
      if (!body.performedBy || body.performedBy === 'system') body.performedBy = actor;
    }
    // Authorize the running-hours cap override from the session role (Task #240). The role is taken
    // ONLY from the authenticated session and overwrites any client-supplied value — a caller must
    // not be able to spoof "Sail Admin" via the request body. adminOverride (the intent) still comes
    // from the body, but the server-side role is what decides whether the override is honored.
    body.userRole = authReq.user?.role;
    body.userUuid = authReq.user?.userUuid ?? body.userUuid;
    const workOrder = await woService.updateWorkOrder(req.params.id, body);
    res.json({ ...workOrder, rhBackdated: !!workOrder.rhBackdatedEntry });
  } catch (error: any) {
    console.error('❌ Work order update error:', error);
    if (error.name === 'ZodError') {
      console.error('❌ Zod validation errors:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ error: "Invalid work order data", details: error.errors });
    }
    // ValidationError with extra details (disallowedFields, code, etc.)
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, ...error.details });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    // Return 400 for inventory enforcement errors
    if (error.message?.includes('LOCATION_REQUIRED') ||
        error.message?.includes('SPARE_NOT_FOUND') ||
        error.message?.includes('INSUFFICIENT_STOCK') ||
        error.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
}

export async function deleteWorkOrder(req: Request, res: Response) {
  try {
    await woService.deleteWorkOrder(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
}

// ── Superintendent Completion Rejection ──

export async function rejectCompletion(req: Request, res: Response) {
  try {
    const actorName = resolveActorIdentity(req);
    const { remarks } = req.body;
    const actorUserUuid = (req as AuthenticatedRequest).user?.userUuid || (req as AuthenticatedRequest).user?.username || 'system';
    const result = await woService.rejectCompletedWorkOrder(
      req.params.id,
      remarks || '',
      actorUserUuid,
      actorName
    );
    res.json(result);
  } catch (error: any) {
    console.error('❌ Completion rejection error:', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
}

// ── Superintendent Completion Reopen ──

export async function reopenCompletion(req: Request, res: Response) {
  try {
    const actorName = resolveActorIdentity(req);
    const { remarks } = req.body;
    const actorUserUuid = (req as AuthenticatedRequest).user?.userUuid || (req as AuthenticatedRequest).user?.username || 'system';
    const result = await woService.reopenCompletedWorkOrder(
      req.params.id,
      remarks || '',
      actorUserUuid,
      actorName
    );
    res.json(result);
  } catch (error: any) {
    console.error('❌ Completion reopen error:', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
}

// ── Work Order Completion ──

export async function completeWorkOrder(req: Request, res: Response) {
  try {
    const authReq = req as AuthenticatedRequest;
    // Authorize the running-hours cap override server-side from the session role ONLY — never trust a
    // client-sent role (a caller must not be able to spoof "Sail Admin" via the body). adminOverride
    // (the intent) still comes from the body; the server-side role decides whether it is honored.
    const result = await woCompletionService.completeWorkOrder(req.params.id, {
      ...req.body,
      userRole: authReq.user?.role,
      userId: req.body.userId ?? authReq.user?.username,
      userUuid: req.body.userUuid ?? authReq.user?.userUuid,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Work order completion error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid completion data", details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message, ...error.details });
    }
    if (error.message?.includes('LOCATION_REQUIRED') ||
        error.message?.includes('SPARE_NOT_FOUND') ||
        error.message?.includes('INSUFFICIENT_STOCK') ||
        error.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    throw error;
  }
}

// ── Bulk Operations ──

export async function reviewerApprove(req: Request, res: Response) {
  const workOrderId = req.params.id;
  const { reviewerComments } = req.body;
  const reviewedByUuid = (req as AuthenticatedRequest).user?.userUuid || (req as AuthenticatedRequest).user?.username || 'system';
  const result = await woBulkService.reviewerApprove(workOrderId, reviewerComments, reviewedByUuid);
  res.json(result);
}

export async function reviewerReopen(req: Request, res: Response) {
  const workOrderId = req.params.id;
  const { reviewerComments } = req.body;
  const reviewedByUuid = (req as AuthenticatedRequest).user?.userUuid || (req as AuthenticatedRequest).user?.username || 'system';
  const result = await woBulkService.reviewerReopen(workOrderId, reviewerComments, reviewedByUuid);
  res.json(result);
}

export async function bulkApprove(req: Request, res: Response) {
  const { workOrderIds, approver, approverRemarks, skippedCyclesJustification } = req.body;
  const result = await woBulkService.bulkApprove(workOrderIds, approver, approverRemarks, skippedCyclesJustification);
  res.json(result);
}

export async function bulkReject(req: Request, res: Response) {
  const { workOrderIds, approver, rejectionComments } = req.body;
  const actor = resolveActorIdentity(req);
  const result = await woBulkService.bulkReject(workOrderIds, approver, rejectionComments, actor);
  res.json(result);
}

// ── Auto-Generate & Backfill ──

export async function autoGenerate(req: Request, res: Response) {
  const vesselId = req.body.vesselId || req.query.vesselId;
  const result = await woAutoService.autoGenerate(vesselId as string);
  res.json(result);
}

export async function backfillJobIds(req: Request, res: Response) {
  const vesselId = req.body.vesselId || req.query.vesselId;
  const result = await woAutoService.backfillJobIds(vesselId as string);
  res.json(result);
}

// ── Status Recalculation & Postponements ──

export async function recalculateStatuses(req: Request, res: Response) {
  const result = await woAutoService.recalculateStatuses();
  res.json(result);
}

export async function checkPostponements(req: Request, res: Response) {
  const vesselId = req.body.vesselId || req.query.vesselId;
  const result = await woAutoService.checkPostponements(vesselId as string);
  res.json(result);
}

// ── Postponement Approval Workflow (Plan B) ──

export async function submitPostponeRequest(req: Request, res: Response) {
  try {
    const result = await woService.submitPostponeRequest(req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) return res.status(404).json({ error: error.message });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }
}

export async function editPostponeRequest(req: Request, res: Response) {
  try {
    const result = await woService.editPostponeRequest(req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) return res.status(404).json({ error: error.message });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }
}

export async function approvePostponement(req: Request, res: Response) {
  try {
    const actor = resolveActorIdentity(req);
    const authReq = req as AuthenticatedRequest;
    const result = await woService.approvePostponement(req.params.id, {
      ...req.body,
      approvedBy: actor || req.body.approvedBy || 'Office',
      userUuid: authReq.user?.userUuid ?? req.body.userUuid,
      sessionRole: authReq.user?.role,
    });
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) return res.status(404).json({ error: error.message });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }
}

export async function rejectPostponement(req: Request, res: Response) {
  try {
    const actor = resolveActorIdentity(req);
    const authReq = req as AuthenticatedRequest;
    const result = await woService.rejectPostponement(req.params.id, {
      ...req.body,
      approvedBy: actor || req.body.approvedBy || 'Office',
      userUuid: authReq.user?.userUuid ?? req.body.userUuid,
      sessionRole: authReq.user?.role,
    });
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) return res.status(404).json({ error: error.message });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    throw error;
  }
}

export async function getPostponementApprovalSteps(req: Request, res: Response) {
  const woId = req.params.id;
  let wo = await storage.getWorkOrder(woId);
  if (!wo) wo = await storage.getWorkOrderByCode(woId);
  if (!wo) return res.status(404).json({ error: 'Work order not found' });
  const awaitingPostponement = await storage.getLatestAwaitingPostponement(wo.wouuid);
  if (!awaitingPostponement) return res.json([]);
  const steps = await storage.getWoPostponementApprovalSteps(awaitingPostponement.id);
  res.json(steps);
}

// ── Work Order Executions ──

export async function getExecutions(req: Request, res: Response) {
  const result = await executionService.getExecutions(req.params.componentId);
  res.json(result);
}

export async function getExecution(req: Request, res: Response) {
  const result = await executionService.getExecution(req.params.id);
  res.json(result);
}

export async function createExecution(req: Request, res: Response) {
  try {
    const execution = await executionService.createExecution(req.body);
    res.status(201).json(execution);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid execution data", details: error.errors });
    }
    throw error;
  }
}

export async function updateExecution(req: Request, res: Response) {
  try {
    const execution = await executionService.updateExecution(req.params.id, req.body);
    res.json(execution);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid execution data", details: error.errors });
    }
    throw error;
  }
}

// ── Superintendent Endpoints (Layer 5) ──

export async function superintendentAcknowledge(req: Request, res: Response) {
  try {
    const wo = await woService.getWorkOrder(req.params.id);
    if (!wo) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    if (wo.approvalTier !== 'superintendent_locked') {
      return res.status(400).json({ error: 'This WO does not require Superintendent acknowledgment' });
    }

    await woService.updateWorkOrder(req.params.id, {
      superintendentAcknowledged: true,
      superintendentAcknowledgedAt: new Date().toISOString(),
      approvalTier: 'ce_with_justification',
      approvalBlockReason: null,
    });

    const notifications = await storage.getAllSuperintendentNotifications();
    const matchingNotification = notifications.find(
      (n: any) => (n.workOrderId === wo.wouuid || n.workOrderId === wo.id) && !n.isAcknowledged
    );
    if (matchingNotification) {
      await storage.acknowledgeSuperintendentNotification(matchingNotification.id);
    }

    res.json({
      success: true,
      message: 'Superintendent has acknowledged. The Head of Department can now approve with mandatory remarks.',
    });
  } catch (error: any) {
    console.error('Superintendent acknowledge error:', error);
    throw error;
  }
}

export async function getSuperintendentNotifications(req: Request, res: Response) {
  const notifications = await storage.getSuperintendentNotifications();
  res.json(notifications);
}

export async function getAllSuperintendentNotifications(req: Request, res: Response) {
  const notifications = await storage.getAllSuperintendentNotifications();
  res.json(notifications);
}

export async function getComplianceAnomalies(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string | undefined;
    const result = await complianceAnomalyService.getComplianceAnomalies(vesselId);
    res.json(result);
  } catch (error: any) {
    console.error('Compliance anomaly calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate compliance anomalies' });
  }
}

export async function getAnomaliesDashboard(req: Request, res: Response) {
  try {
    const { status, severity, vesselId, limit, dateFrom, dateTo } = req.query;
    let parsedDateFrom: Date | undefined;
    let parsedDateTo: Date | undefined;
    if (dateFrom) {
      parsedDateFrom = new Date(dateFrom as string);
      if (isNaN(parsedDateFrom.getTime())) {
        return res.status(400).json({ error: 'Invalid dateFrom parameter' });
      }
    }
    if (dateTo) {
      parsedDateTo = new Date(dateTo as string);
      if (isNaN(parsedDateTo.getTime())) {
        return res.status(400).json({ error: 'Invalid dateTo parameter' });
      }
    }
    const anomalies = await storage.getWorkOrderAnomalies({
      status: status as string | undefined,
      severity: severity as string | undefined,
      vesselId: vesselId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 10,
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    });
    res.json(anomalies);
  } catch (error: any) {
    console.error('Failed to fetch anomalies dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
}

export async function getAnomalyStatistics(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string | undefined;
    const stats = await storage.getWorkOrderAnomalyStatistics(vesselId);
    res.json(stats);
  } catch (error: any) {
    console.error('Failed to fetch anomaly statistics:', error);
    res.status(500).json({ error: 'Failed to fetch anomaly statistics' });
  }
}

export async function acknowledgeAnomaly(req: Request, res: Response) {
  try {
    const anomalyId = parseInt(req.params.anomalyId, 10);
    if (isNaN(anomalyId)) {
      return res.status(400).json({ error: 'Invalid anomaly ID' });
    }
    const { acknowledgedBy, notes } = req.body;
    if (!acknowledgedBy) {
      return res.status(400).json({ error: 'acknowledgedBy is required' });
    }
    const result = await storage.acknowledgeWorkOrderAnomaly(anomalyId, acknowledgedBy, notes);
    if (!result) {
      return res.status(404).json({ error: 'Anomaly not found' });
    }
    res.json(result);
  } catch (error: any) {
    console.error('Failed to acknowledge anomaly:', error);
    res.status(500).json({ error: 'Failed to acknowledge anomaly' });
  }
}

export async function getAnomalyForWorkOrder(req: Request, res: Response) {
  try {
    const workOrderId = req.params.workOrderId;
    const anomalies = await storage.getWorkOrderAnomalyByWorkOrderId(workOrderId);
    res.json(anomalies);
  } catch (error: any) {
    console.error('Failed to fetch anomalies for work order:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies for work order' });
  }
}

export async function getSuperintendentNotificationsSummary(req: Request, res: Response) {
  const vesselId = req.query.vesselId as string | undefined;
  let vesselName: string | undefined;
  if (vesselId && vesselId !== 'all') {
    const vessels = await storage.getVessels();
    const vessel = vessels.find(v => v.id === vesselId || v.vuuid === vesselId);
    if (!vessel) {
      return res.json({ pendingCount: 0, acknowledgedThisMonthCount: 0 });
    }
    vesselName = vessel.name;
  }

  const [unacknowledged, all] = await Promise.all([
    storage.getSuperintendentNotifications(vesselName),
    storage.getAllSuperintendentNotifications(vesselName),
  ]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const pendingCount = unacknowledged.length;
  const acknowledgedThisMonthCount = all.filter((n: any) => {
    if (!n.isAcknowledged || !n.acknowledgedAt) return false;
    const ackDate = new Date(n.acknowledgedAt);
    return ackDate.getMonth() === currentMonth && ackDate.getFullYear() === currentYear;
  }).length;

  res.json({ pendingCount, acknowledgedThisMonthCount });
}

// ── Work Order Planner ──

export async function getPlannerData(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const days = parseInt(req.query.days as string) || 30;
    const rank = req.query.rank as string | undefined;
    const search = req.query.search as string | undefined;

    if (!vesselId || vesselId === 'all') {
      return res.status(400).json({ error: 'A specific vesselId is required (planner does not support "all" vessels)' });
    }

    const result = await plannerService.getWorkOrderPlannerData({ vesselId, days, rank, search });
    res.json(result);
  } catch (error: any) {
    console.error('Planner data error:', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch planner data' });
  }
}

export async function savePlannedDate(req: Request, res: Response) {
  try {
    const { vesselId, jobId, componentId, plannedDate } = req.body;

    if (!vesselId || vesselId === 'all' || !jobId || !componentId) {
      return res.status(400).json({ error: 'A specific vesselId, jobId, and componentId are required' });
    }

    const result = await plannerService.savePlannedDate(vesselId, jobId, componentId, plannedDate || null);
    res.json(result);
  } catch (error: any) {
    console.error('Save planned date error:', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to save planned date' });
  }
}

export async function bulkSavePlannedDate(req: Request, res: Response) {
  try {
    const { vesselId, items, plannedDate } = req.body;

    if (!vesselId || vesselId === 'all') {
      return res.status(400).json({ error: 'A specific vesselId is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    if (!plannedDate) {
      return res.status(400).json({ error: 'plannedDate is required' });
    }

    const result = await plannerService.bulkSavePlannedDate(vesselId, items, plannedDate);
    res.json(result);
  } catch (error: any) {
    console.error('Bulk save planned date error:', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to bulk save planned dates' });
  }
}

export async function exportPlanner(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const days = parseInt(req.query.days as string) || 30;
    const rank = req.query.rank as string | undefined;
    const search = req.query.search as string | undefined;

    if (!vesselId || vesselId === 'all') {
      return res.status(400).json({ error: 'A specific vesselId is required (planner does not support "all" vessels)' });
    }

    const buffer = await plannerService.exportPlannerExcel({ vesselId, days, rank, search });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="work-order-planner.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Planner export error:', error);
    res.status(500).json({ error: 'Failed to export planner data' });
  }
}

export async function exportPlannerFromItems(req: Request, res: Response) {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }
    if (items.length > 5000) {
      return res.status(400).json({ error: 'Maximum 5000 items per export' });
    }

    const buffer = await plannerService.exportPlannerExcelFromItems(items);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="work-order-planner.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Planner export from items error:', error);
    res.status(500).json({ error: 'Failed to export planner data' });
  }
}

// ── Overdue Reason ──

export async function saveOverdueReason(req: Request, res: Response) {
  const { id } = req.params;
  const { overdueReason, overdueReasonDetails } = req.body;

  if (!overdueReason || !overdueReason.trim()) {
    return res.status(400).json({ error: 'overdueReason is required' });
  }

  if (overdueReason === 'Other Reason' && (!overdueReasonDetails || !overdueReasonDetails.trim())) {
    return res.status(400).json({ error: 'overdueReasonDetails is required when overdueReason is "Other Reason"' });
  }

  const result = await woService.saveOverdueReason(id, overdueReason.trim(), overdueReasonDetails?.trim() ?? null);
  res.json(result);
}

export async function getScopedOperationData(req: Request, res: Response) {
  const { vesselId } = req.params;
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const userRankId = user.rankId as string | undefined;
  const userRole = user.role as string | undefined;
  const userVesselId = user.vesselId as string | undefined;
  const authRankName = (user.rank_name as string | undefined)?.trim() || undefined;
  const rawQueryRankName = req.query.rank_name ?? req.query.rankName;
  const queryRankName = typeof rawQueryRankName === 'string' ? rawQueryRankName.trim() : '';
  // Accept rank_name from query for cache-key consistency, but only honor it
  // when it matches the authenticated user's rank (case-insensitive). This
  // prevents privilege escalation via tampered query params while still
  // satisfying the "query param, fallback to req.user.rank_name" contract.
  const userRankName =
    queryRankName && authRankName && queryRankName.toLowerCase() === authRankName.toLowerCase()
      ? queryRankName
      : authRankName;
  const mode = (req.query.mode as string) === 'me' ? 'me' as const : 'myTeam' as const;
  if (!vesselId) return res.status(400).json({ error: 'vesselId required' });
  const result = await woService.getScopedOperationData(vesselId, userRankId, mode, userRole, userVesselId, userRankName);
  res.json(result);
}
