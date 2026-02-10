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

const vesselIdSchema = z.object({ vesselId: z.string().min(1, 'vesselId is required') });
const spareIdSchema = z.object({ id: z.coerce.number().int().positive('Spare ID must be a positive integer') });
const vesselAndSpareSchema = vesselIdSchema.merge(spareIdSchema);

export async function listByVessel(req: Request, res: Response) {
  try {
    const params = vesselIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });
    const spares = await sparesService.getSparesWithInventory(params.data.vesselId);
    res.json({ success: true, data: spares });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to fetch spares" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const params = spareIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });
    const spare = await sparesService.getSpare(params.data.id);
    if (!spare) {
      return res.status(404).json({ error: "Spare not found" });
    }
    res.json(spare);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch spare" });
  }
}

const createSpareSchema = z.object({
  partCode: z.string().min(1, 'partCode is required'),
  partName: z.string().min(1, 'partName is required'),
  componentId: z.string().min(1, 'componentId is required'),
  componentName: z.string().optional(),
  componentCode: z.string().optional(),
  componentSpareCode: z.string().optional(),
  critical: z.string().optional(),
  rob: z.coerce.number().min(0).optional(),
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
  location: z.string().optional(),
  location2: z.string().optional(),
  robLocationA: z.coerce.number().min(0).optional(),
  robLocationB: z.coerce.number().min(0).optional(),
  partNumber: z.string().optional(),
  uom: z.string().optional(),
  drawingNumber: z.string().optional(),
  positionNumber: z.string().optional(),
  note: z.string().optional(),
  specification: z.string().optional(),
  maker: z.string().optional(),
  makerCode: z.string().optional(),
  manualName: z.string().optional(),
  pageNumber: z.string().optional(),
  ihm: z.string().optional(),
  remarks: z.string().optional(),
  criticality: z.string().optional(),
});

export async function create(req: Request, res: Response) {
  try {
    const params = vesselIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const body = createSpareSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid spare data", details: body.error.errors });
    }

    const spare = await sparesService.createSpare({
      ...body.data,
      componentName: body.data.componentName || '',
      critical: body.data.critical || 'No',
      vesselId: params.data.vesselId,
    });
    res.status(201).json(spare);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create spare" });
  }
}

const updateSpareSchema = createSpareSchema.partial().extend({
  robLocationA: z.coerce.number().min(0, 'robLocationA must be non-negative').optional(),
  robLocationB: z.coerce.number().min(0, 'robLocationB must be non-negative').optional(),
  remarks: z.string().optional(),
  place: z.string().optional(),
  dateLocal: z.string().optional(),
  tz: z.string().optional(),
});

export async function update(req: Request, res: Response) {
  try {
    const params = spareIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });
    const spareId = params.data.id;

    const body = updateSpareSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid update data", details: body.error.errors });
    }

    const { robLocationA, robLocationB, remarks, place, dateLocal, tz, ...otherUpdates } = body.data;
    const userId = (req as any).user?.id?.toString() || 'System';

    if (robLocationA !== undefined || robLocationB !== undefined) {

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
    const params = spareIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });
    await sparesService.deleteSpare(params.data.id);
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

    const paramsResult = vesselAndSpareSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({ error: paramsResult.error.errors[0]?.message });
    }

    const payload = adjustmentPayloadSchema.parse(req.body);
    const userId = (req as any).user?.id?.toString() || 'System';
    const { vesselId, id: spareId } = paramsResult.data;

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
    const params = spareIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const adjustPayloadSchema = z.object({
      qtyChange: z.number(),
      eventType: z.enum(['CONSUME', 'RECEIVE', 'ADJUST']),
      reference: z.string().optional(),
      notes: z.string().optional(),
    });

    const payload = adjustPayloadSchema.parse(req.body);
    const spare = await sparesService.adjustSpareQuantity(
      params.data.id,
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
    const params = vesselIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });
    const history = await sparesService.getSpareHistory(params.data.vesselId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

export async function historyByVesselLegacy(req: Request, res: Response) {
  try {
    const params = vesselIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });
    const history = await sparesService.getSpareHistory(params.data.vesselId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

export async function lowStock(req: Request, res: Response) {
  try {
    const params = vesselIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });
    const spares = await sparesService.getLowStockSpares(params.data.vesselId);
    res.json(spares);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch low stock spares" });
  }
}

const batchConsumeSchema = z.object({
  items: z.array(z.object({
    spareId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive(),
    location: z.enum(['A', 'B']).optional(),
  })).min(1, 'Items array must have at least one item'),
  workOrderId: z.string().optional(),
  consumedBy: z.string().optional(),
});

export async function batchConsumeHandler(req: Request, res: Response) {
  try {
    const params = vesselIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const body = batchConsumeSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid batch consume data", details: body.error.errors });
    }

    const results = await sparesService.batchConsume(
      params.data.vesselId,
      body.data.items,
      body.data.workOrderId,
      body.data.consumedBy
    );

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to consume spares" });
  }
}

const batchReceiveSchema = z.object({
  items: z.array(z.object({
    spareId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive(),
    location: z.enum(['A', 'B']).optional(),
  })).min(1, 'Items array must have at least one item'),
  purchaseOrderRef: z.string().optional(),
  receivedBy: z.string().optional(),
});

export async function batchReceiveHandler(req: Request, res: Response) {
  try {
    const params = vesselIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const body = batchReceiveSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid batch receive data", details: body.error.errors });
    }

    const results = await sparesService.batchReceive(
      params.data.vesselId,
      body.data.items,
      body.data.purchaseOrderRef,
      body.data.receivedBy
    );

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to receive spares" });
  }
}

const simpleConsumeSchema = z.object({
  qty: z.coerce.number().positive('Quantity must be a positive number'),
  dateLocal: z.string().optional(),
  place: z.string().optional(),
  remarks: z.string().optional(),
  userId: z.string().optional(),
  workOrder: z.string().optional(),
});

export async function consume(req: Request, res: Response) {
  try {
    const params = spareIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const body = simpleConsumeSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: body.error.errors[0]?.message });
    }

    const { qty, dateLocal, place, remarks, userId, workOrder } = body.data;

    const result = await sparesService.consumeSpareFromLocation(
      params.data.id,
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

const simpleReceiveSchema = z.object({
  qty: z.coerce.number().positive('Quantity must be a positive number'),
  dateLocal: z.string().optional(),
  supplierPO: z.string().optional(),
  remarks: z.string().optional(),
  userId: z.string().optional(),
});

export async function receive(req: Request, res: Response) {
  try {
    const params = spareIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const body = simpleReceiveSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: body.error.errors[0]?.message });
    }

    const { qty, dateLocal, supplierPO, remarks, userId } = body.data;

    const result = await sparesService.receiveSpareToLocation(
      params.data.id,
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

    res.json(results);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request payload", details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to perform bulk update' });
  }
}
