import { Request, Response } from 'express';
import * as sparesService from '../services/sparesService';

// ── GET /spares ──

export async function getAllSpares(req: Request, res: Response) {
  try {
    const allSpares = await sparesService.getAllSpares();
    res.json(allSpares);
  } catch (error: any) {
    console.error("Error fetching all spares:", error);
    res.status(500).json({ error: "Failed to fetch spares", details: error.message });
  }
}

// ── GET /spares/history/:vesselId ──

export async function getSpareHistoryByVessel(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    console.log('[API] Fetching spare history for vessel:', vesselId);
    const history = await sparesService.getSpareHistory(vesselId);
    console.log('[API] Found', history.length, 'history entries');
    res.json(history);
  } catch (error) {
    console.error('[API] Spare history error:', error);
    res.status(500).json({ error: "Failed to fetch spare history" });
  }
}

// ── POST /spares/bulk-update ──

export async function bulkUpdate(req: Request, res: Response) {
  try {
    console.log('[BULK UPDATE] Request received:', JSON.stringify(req.body, null, 2).substring(0, 500));
    const { vesselId, tz, rows } = req.body;

    if (!vesselId || !rows || !Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        error: 'vesselId and rows are required'
      });
    }

    console.log('[BULK UPDATE] Processing', rows.length, 'rows for vessel', vesselId);
    const results = await sparesService.bulkUpdate(vesselId, rows);
    console.log('[BULK UPDATE] Completed successfully:', results.length, 'items processed');
    res.json(results);
  } catch (error: any) {
    console.error("Error in bulk update:", error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to perform bulk update'
    });
  }
}

// ── GET /spares/:vesselId ──

export async function getSparesByVessel(req: Request, res: Response) {
  try {
    const spares = await sparesService.getSparesByVessel(req.params.vesselId);
    res.json(spares);
  } catch (error: any) {
    console.error("Error fetching spares:", error);
    res.status(500).json({ error: "Failed to fetch spares", details: error.message });
  }
}

// ── GET /spares/:vesselId/:id ──

export async function getSpareById(req: Request, res: Response) {
  try {
    const spare = await sparesService.getSpare(parseInt(req.params.id));
    if (!spare) {
      return res.status(404).json({ error: "Spare not found" });
    }
    res.json(spare);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch spare" });
  }
}

// ── POST /spares/:vesselId ──

export async function createSpare(req: Request, res: Response) {
  try {
    const spare = await sparesService.createSpare(req.params.vesselId, req.body);
    res.status(201).json(spare);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create spare" });
  }
}

// ── PATCH /spares/:vesselId/:id ──

export async function updateSpare(req: Request, res: Response) {
  try {
    console.log('[PATCH Spare] Updating spare', req.params.id, 'with data:', JSON.stringify(req.body));
    const spareId = parseInt(req.params.id);
    const userId = (req as any).user?.id?.toString() || 'System';
    const spare = await sparesService.updateSpare(spareId, req.body, userId);
    console.log('[PATCH Spare] Result - location:', spare.location, 'location2:', spare.location2);
    res.json(spare);
  } catch (error: any) {
    console.error('[PATCH Spare] Error:', error.message);
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404 || error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update spare" });
  }
}

// ── DELETE /spares/:vesselId/:id ──

export async function deleteSpare(req: Request, res: Response) {
  try {
    await sparesService.deleteSpare(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete spare" });
  }
}

// ── POST /spares/:vesselId/:id/adjustment ──

export async function adjustSpareAtLocation(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.id);
    const vesselId = req.params.vesselId;
    const userId = (req as any).user?.id?.toString() || 'System';
    const spare = await sparesService.adjustSpareAtLocationEndpoint(spareId, vesselId, req.body, userId);
    res.json(spare);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request payload", details: error.errors });
    }
    if (error.statusCode === 404 || error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.statusCode === 403) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message?.includes('non-negative')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to adjust spare ROB" });
  }
}

// ── POST /spares/:vesselId/:id/adjust ──

export async function adjustSpareQuantity(req: Request, res: Response) {
  try {
    const spare = await sparesService.adjustSpareQuantityEndpoint(parseInt(req.params.id), req.body);
    res.json(spare);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request payload", details: error.errors });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('negative')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to adjust spare quantity" });
  }
}

// ── GET /spares/:vesselId/history (legacy route) ──

export async function getSpareHistoryLegacy(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    console.log('[API] Fetching spare history for vessel (legacy route):', vesselId);
    const history = await sparesService.getSpareHistory(vesselId);
    console.log('[API] Found', history.length, 'history entries');
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

// ── GET /spares/:vesselId/low-stock ──

export async function getLowStockSpares(req: Request, res: Response) {
  try {
    const lowStockSpares = await sparesService.getLowStockSpares(req.params.vesselId);
    res.json(lowStockSpares);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch low stock spares" });
  }
}

// ── POST /spares/:vesselId/batch-consume ──

export async function batchConsume(req: Request, res: Response) {
  try {
    const { items, workOrderId, consumedBy } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items array is required" });
    }

    const results = await sparesService.batchConsume(items, workOrderId, consumedBy);
    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to consume spares" });
  }
}

// ── POST /spares/:vesselId/batch-receive ──

export async function batchReceive(req: Request, res: Response) {
  try {
    const { items, purchaseOrderRef, receivedBy } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items array is required" });
    }

    const results = await sparesService.batchReceive(items, purchaseOrderRef, receivedBy);
    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to receive spares" });
  }
}

// ── POST /spares/:id/consume (legacy - Location A default) ──

export async function consumeSimple(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.id);
    if (isNaN(spareId)) {
      return res.status(400).json({ error: "Invalid spare ID" });
    }
    const result = await sparesService.consumeSimple(spareId, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error consuming spare:", error);
    res.status(500).json({ error: error.message || "Failed to consume spare" });
  }
}

// ── POST /spares/:id/receive (legacy - Location A default) ──

export async function receiveSimple(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.id);
    if (isNaN(spareId)) {
      return res.status(400).json({ error: "Invalid spare ID" });
    }
    const result = await sparesService.receiveSimple(spareId, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error receiving spare:", error);
    res.status(500).json({ error: error.message || "Failed to receive spare" });
  }
}

// ── POST /spares/:id/consume-from-location ──

export async function consumeFromLocation(req: Request, res: Response) {
  try {
    const result = await sparesService.consumeFromLocation(req.params, req.body);
    if (result.validationError) {
      return res.status(result.statusCode!).json(result.response);
    }
    res.json(result.response);
  } catch (error: any) {
    console.error("Error consuming spare from location:", error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || "Failed to consume spare from location"
      }
    });
  }
}

// ── POST /spares/:id/receive-to-location ──

export async function receiveToLocation(req: Request, res: Response) {
  try {
    const result = await sparesService.receiveToLocation(req.params, req.body);
    if (result.validationError) {
      return res.status(result.statusCode!).json(result.response);
    }
    res.json(result.response);
  } catch (error: any) {
    console.error("Error receiving spare to location:", error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || "Failed to receive spare to location"
      }
    });
  }
}
