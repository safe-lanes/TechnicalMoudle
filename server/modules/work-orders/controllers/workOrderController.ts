import { Request, Response } from 'express';
import * as woService from '../services/workOrderService';
import * as woContextService from '../services/workOrderContextService';
import * as woCompletionService from '../services/workOrderCompletionService';
import * as woBulkService from '../services/workOrderBulkService';
import * as woAutoService from '../services/workOrderAutoService';
import * as executionService from '../services/executionService';

// ── Core Work Order CRUD ──

export async function listWorkOrders(req: Request, res: Response) {
  const vesselId = req.query.vesselId as string;
  const result = await woService.listWorkOrders(vesselId);
  res.json(result);
}

export async function getWorkOrder(req: Request, res: Response) {
  const result = await woService.getWorkOrder(req.params.id);
  res.json(result);
}

export async function getWorkOrderContext(req: Request, res: Response) {
  const result = await woContextService.getWorkOrderContext(req.params.id);
  res.json(result);
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
    const workOrder = await woService.updateWorkOrder(req.params.id, req.body);
    res.json(workOrder);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      console.error('❌ Zod validation errors:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ error: "Invalid work order data", details: error.errors });
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

// ── Work Order Completion ──

export async function completeWorkOrder(req: Request, res: Response) {
  try {
    const result = await woCompletionService.completeWorkOrder(req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid completion data", details: error.errors });
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

// ── Bulk Operations ──

export async function bulkApprove(req: Request, res: Response) {
  const { workOrderIds, approver, approverRemarks } = req.body;
  const result = await woBulkService.bulkApprove(workOrderIds, approver, approverRemarks);
  res.json(result);
}

export async function bulkReject(req: Request, res: Response) {
  const { workOrderIds, approver, rejectionComments } = req.body;
  const result = await woBulkService.bulkReject(workOrderIds, approver, rejectionComments);
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
