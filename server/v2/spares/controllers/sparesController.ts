import { Request, Response } from 'express';
import { z } from 'zod';
import * as sparesService from '../services/sparesService';

export async function listAll(req: Request, res: Response) {
  try {
    const spares = await sparesService.getAllSpares();
    res.json(spares);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch spares" });
  }
}

export async function listByVessel(req: Request, res: Response) {
  try {
    const spares = await sparesService.getSpares(req.params.vesselId);
    res.json(spares);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch spares" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const spare = await sparesService.getSpare(parseInt(req.params.id));
    if (!spare) {
      return res.status(404).json({ error: "Spare not found" });
    }
    res.json(spare);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch spare" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const spare = await sparesService.createSpare({
      ...req.body,
      vesselId: req.params.vesselId,
    });
    res.status(201).json(spare);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid spare data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create spare" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.id);
    const { robLocationA, robLocationB, remarks, place, dateLocal, tz, ...otherUpdates } = req.body;
    const userId = (req as any).user?.id?.toString() || 'System';

    if (robLocationA !== undefined || robLocationB !== undefined) {
      if (robLocationA !== undefined && (isNaN(Number(robLocationA)) || Number(robLocationA) < 0)) {
        return res.status(400).json({ error: "robLocationA must be a valid non-negative number" });
      }
      if (robLocationB !== undefined && (isNaN(Number(robLocationB)) || Number(robLocationB) < 0)) {
        return res.status(400).json({ error: "robLocationB must be a valid non-negative number" });
      }

      const currentSpare = await sparesService.getSpare(spareId);
      if (!currentSpare) {
        return res.status(404).json({ error: "Spare not found" });
      }

      const newLocA = robLocationA !== undefined ? Number(robLocationA) : (currentSpare.robLocationA ?? 0);
      const newLocB = robLocationB !== undefined ? Number(robLocationB) : (currentSpare.robLocationB ?? 0);

      const result = await sparesService.transferSpareLocation(
        spareId,
        newLocA,
        newLocB,
        userId,
        remarks,
        place,
        dateLocal,
        tz
      );

      if (Object.keys(otherUpdates).length > 0) {
        const updatedSpare = await sparesService.updateSpare(spareId, otherUpdates);
        return res.json(updatedSpare);
      }

      return res.json(result.spare);
    }

    const spare = await sparesService.updateSpare(spareId, otherUpdates);
    res.json(spare);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update spare" });
  }
}

export async function remove(req: Request, res: Response) {
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

export async function adjustment(req: Request, res: Response) {
  try {
    const adjustmentPayloadSchema = z.object({
      newRob: z.number().min(0),
      location: z.enum(['A', 'B']),
      remarks: z.string().optional(),
      place: z.string().optional(),
      dateLocal: z.string().optional(),
      tz: z.string().optional(),
    });

    const payload = adjustmentPayloadSchema.parse(req.body);
    const userId = (req as any).user?.id?.toString() || 'System';
    const vesselId = req.params.vesselId;
    const spareId = parseInt(req.params.id);

    const existingSpare = await sparesService.getSpare(spareId);
    if (!existingSpare) {
      return res.status(404).json({ error: `Spare with ID ${spareId} not found` });
    }
    if (existingSpare.vesselId !== vesselId) {
      return res.status(403).json({ error: "Access denied: Spare does not belong to this vessel" });
    }

    const spare = await sparesService.adjustSpareAtLocation(
      spareId,
      payload.newRob,
      payload.location,
      userId,
      payload.remarks,
      payload.place,
      payload.dateLocal,
      payload.tz
    );

    res.json(spare);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request payload", details: error.errors });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('non-negative')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to adjust spare ROB" });
  }
}

export async function adjust(req: Request, res: Response) {
  try {
    const adjustPayloadSchema = z.object({
      qtyChange: z.number(),
      eventType: z.enum(['CONSUME', 'RECEIVE', 'ADJUST']),
      reference: z.string().optional(),
      notes: z.string().optional(),
    });

    const payload = adjustPayloadSchema.parse(req.body);
    const spare = await sparesService.adjustSpareQuantity(
      parseInt(req.params.id),
      payload.qtyChange,
      payload.eventType,
      payload.reference,
      payload.notes
    );

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

export async function historyByVessel(req: Request, res: Response) {
  try {
    const history = await sparesService.getSpareHistory(req.params.vesselId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

export async function historyByVesselLegacy(req: Request, res: Response) {
  try {
    const history = await sparesService.getSpareHistory(req.params.vesselId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

export async function lowStock(req: Request, res: Response) {
  try {
    const spares = await sparesService.getLowStockSpares(req.params.vesselId);
    res.json(spares);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch low stock spares" });
  }
}

export async function batchConsumeHandler(req: Request, res: Response) {
  try {
    const { items, workOrderId, consumedBy } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items array is required" });
    }

    const results = await sparesService.batchConsume(
      req.params.vesselId,
      items,
      workOrderId,
      consumedBy
    );

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to consume spares" });
  }
}

export async function batchReceiveHandler(req: Request, res: Response) {
  try {
    const { items, purchaseOrderRef, receivedBy } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items array is required" });
    }

    const results = await sparesService.batchReceive(
      req.params.vesselId,
      items,
      purchaseOrderRef,
      receivedBy
    );

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to receive spares" });
  }
}

export async function consume(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.id);
    if (isNaN(spareId)) {
      return res.status(400).json({ error: "Invalid spare ID" });
    }

    const { qty, dateLocal, place, remarks, userId, workOrder } = req.body;

    if (!qty || qty <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive number" });
    }

    const result = await sparesService.consumeSpareFromLocation(
      spareId,
      qty,
      'A',
      userId || 'User',
      remarks || `Consumed at ${place || 'unknown location'} on ${dateLocal}`,
      workOrder
    );

    res.json({
      success: true,
      message: "Spare consumed successfully",
      data: result,
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to consume spare" });
  }
}

export async function receive(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.id);
    if (isNaN(spareId)) {
      return res.status(400).json({ error: "Invalid spare ID" });
    }

    const { qty, dateLocal, supplierPO, remarks, userId } = req.body;

    if (!qty || qty <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive number" });
    }

    const result = await sparesService.receiveSpareToLocation(
      spareId,
      qty,
      'A',
      userId || 'User',
      remarks,
      supplierPO,
      dateLocal
    );

    res.json({
      success: true,
      message: "Spare received successfully",
      data: result,
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to receive spare" });
  }
}

export async function consumeFromLocation(req: Request, res: Response) {
  try {
    const consumeFromLocationBodySchema = z.object({
      quantity: z.coerce.number().positive('Quantity must be a positive number'),
      location: z.enum(['A', 'B'], { errorMap: () => ({ message: 'Location must be "A" or "B"' }) }),
      userId: z.string().optional(),
      remarks: z.string().optional(),
      workOrderRef: z.string().optional(),
    });

    const paramsSchema = z.object({
      id: z.coerce.number().int().positive('Spare ID must be a positive integer'),
    });

    const paramsResult = paramsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsResult.error.errors[0]?.message || 'Invalid spare ID',
          field: 'id',
        },
      });
    }

    const bodyResult = consumeFromLocationBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        success: false,
        errors: bodyResult.error.errors.map(err => ({
          code: 'VALIDATION_ERROR',
          message: err.message,
          field: err.path.join('.'),
        })),
      });
    }

    const { id: spareId } = paramsResult.data;
    const { quantity, location, userId, remarks, workOrderRef } = bodyResult.data;

    const result = await sparesService.consumeSpareFromLocation(
      spareId,
      quantity,
      location,
      userId || 'system',
      remarks,
      workOrderRef
    );

    if (result.shortageQty > 0) {
      return res.json({
        success: true,
        data: result,
        warning: {
          code: 'PARTIAL_CONSUMPTION',
          message: `Requested ${result.requested} but only ${result.deducted} available at Location ${location}`,
          shortageQty: result.shortageQty,
        },
      });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || "Failed to consume spare from location" },
    });
  }
}

export async function receiveToLocation(req: Request, res: Response) {
  try {
    const receiveToLocationBodySchema = z.object({
      quantity: z.coerce.number().positive('Quantity must be a positive number'),
      location: z.enum(['A', 'B'], { errorMap: () => ({ message: 'Location must be "A" or "B"' }) }),
      userId: z.string().optional(),
      remarks: z.string().optional(),
      supplierPO: z.string().optional(),
      dateLocal: z.string().optional(),
    });

    const paramsSchema = z.object({
      id: z.coerce.number().int().positive('Spare ID must be a positive integer'),
    });

    const paramsResult = paramsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsResult.error.errors[0]?.message || 'Invalid spare ID',
          field: 'id',
        },
      });
    }

    const bodyResult = receiveToLocationBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        success: false,
        errors: bodyResult.error.errors.map(err => ({
          code: 'VALIDATION_ERROR',
          message: err.message,
          field: err.path.join('.'),
        })),
      });
    }

    const { id: spareId } = paramsResult.data;
    const { quantity, location, userId, remarks, supplierPO, dateLocal } = bodyResult.data;

    const result = await sparesService.receiveSpareToLocation(
      spareId,
      quantity,
      location,
      userId || 'system',
      remarks,
      supplierPO,
      dateLocal
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || "Failed to receive spare to location" },
    });
  }
}

export async function bulkUpdateHandler(req: Request, res: Response) {
  try {
    const bulkUpdateSchema = z.object({
      vesselId: z.string(),
      rows: z.array(z.object({
        componentSpareId: z.number(),
        consumedA: z.number().optional(),
        consumedB: z.number().optional(),
        receivedA: z.number().optional(),
        receivedB: z.number().optional(),
        receivedDate: z.string().optional(),
        receivedPlace: z.string().optional(),
        dateLocal: z.string().optional(),
        remarks: z.string().optional(),
        userId: z.string().optional(),
      })),
      tz: z.string().optional(),
    });

    const payload = bulkUpdateSchema.parse(req.body);
    const results = await sparesService.bulkUpdate(payload.vesselId, payload.rows);

    res.json({ success: true, results });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request payload", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to bulk update spares" });
  }
}
