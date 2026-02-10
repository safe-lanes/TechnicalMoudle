import { Request, Response } from "express";
import { listWorkOrders, getEnrichedWorkOrder } from "../services/workOrderListService";
import { getWorkOrderContext } from "../services/workOrderContextService";
import { createWorkOrderHandler, updateWorkOrderHandler, deleteWorkOrderHandler } from "../services/workOrderMutationService";
import { completeWorkOrder } from "../services/workOrderCompletionService";
import { bulkApprove, bulkReject } from "../services/workOrderBulkService";
import { autoGenerate, recalculateStatuses, checkPostponements } from "../services/workOrderAutomationService";

export async function list(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string | undefined;
    const result = await listWorkOrders(vesselId);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to fetch work orders:', error);
    res.status(500).json({ error: "Failed to fetch work orders" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const result = await getEnrichedWorkOrder(req.params.id);
    if (!result) return res.status(404).json({ error: "Work order not found" });
    res.json(result);
  } catch (error: any) {
    console.error('Failed to fetch work order:', error);
    res.status(500).json({ error: "Failed to fetch work order" });
  }
}

export async function getContext(req: Request, res: Response) {
  try {
    const result = await getWorkOrderContext(req.params.id);
    if (!result) return res.status(404).json({ error: "Work order not found" });
    res.json(result);
  } catch (error: any) {
    console.error('Failed to fetch work order context:', error);
    res.status(500).json({ error: "Failed to fetch work order context" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const result = await createWorkOrderHandler(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Work order creation error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid work order data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create work order" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const result = await updateWorkOrderHandler(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: "Work order not found" });
    if ((result as any).error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error('Work order update error:', error);
    res.status(500).json({ error: "Failed to update work order" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await deleteWorkOrderHandler(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Work order not found" });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Work order deletion error:', error);
    res.status(500).json({ error: "Failed to delete work order" });
  }
}

export async function complete(req: Request, res: Response) {
  try {
    const result = await completeWorkOrder(req.params.id, req.body);
    if ((result as any).error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error('Work order completion error:', error);
    res.status(500).json({ error: "Failed to complete work order" });
  }
}

export async function bulkApproveHandler(req: Request, res: Response) {
  try {
    const result = await bulkApprove(req.body);
    if ((result as any).error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ error: "Failed to bulk approve work orders" });
  }
}

export async function bulkRejectHandler(req: Request, res: Response) {
  try {
    const result = await bulkReject(req.body);
    if ((result as any).error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error('Bulk reject error:', error);
    res.status(500).json({ error: "Failed to bulk reject work orders" });
  }
}

export async function autoGenerateHandler(req: Request, res: Response) {
  try {
    const result = await autoGenerate(req.body);
    if ((result as any).error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error('Auto-generate error:', error);
    res.status(500).json({ error: "Failed to auto-generate work orders" });
  }
}

export async function recalculateStatusesHandler(req: Request, res: Response) {
  try {
    const result = await recalculateStatuses(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Recalculate statuses error:', error);
    res.status(500).json({ error: "Failed to recalculate work order statuses" });
  }
}

export async function checkPostponementsHandler(req: Request, res: Response) {
  try {
    const result = await checkPostponements(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Check postponements error:', error);
    res.status(500).json({ error: "Failed to check postponements" });
  }
}
