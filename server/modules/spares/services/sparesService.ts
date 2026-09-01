import * as repo from '../repositories/sparesRepository';
import type { Spare, InsertSpare, SpareHistory } from '@shared/schema';
import {
  adjustmentPayloadSchema,
  adjustPayloadSchema,
  consumeFromLocationBodySchema,
  consumeFromLocationParamsSchema,
  receiveToLocationBodySchema,
  receiveToLocationParamsSchema,
} from '../schemas';

// ── Spares CRUD ──

export async function getAllSpares(): Promise<Spare[]> {
  return repo.getAllSpares();
}

export async function getSparesByVessel(vesselId: string): Promise<Spare[]> {
  if (vesselId === 'all') {
    const spares: Spare[] = [];
    const allVessels = await repo.getVessels();
    for (const v of allVessels) {
      const vSpares = await repo.getSpares(v.id);
      spares.push(...vSpares);
    }
    return spares;
  }
  return repo.getSpares(vesselId);
}

export async function getSpare(id: string): Promise<Spare | undefined> {
  const spare = await repo.getSpare(id);
  return spare && !spare.deleted && !spare.isDeleted ? spare : undefined;
}

export async function createSpare(vesselId: string, body: any): Promise<Spare> {
  return repo.createSpare({
    ...body,
    vesselId
  });
}

export async function updateSpare(
  spareId: string,
  body: any,
  userId: string
): Promise<Spare> {
  if (
    Object.prototype.hasOwnProperty.call(body, 'isDeleted') ||
    Object.prototype.hasOwnProperty.call(body, 'is_deleted') ||
    Object.prototype.hasOwnProperty.call(body, 'deleted')
  ) {
    throw Object.assign(new Error('Spare deletion status can only be changed through Delete Spare.'), { statusCode: 400 });
  }

  const existingSpare = await repo.getSpare(spareId);
  if (!existingSpare || existingSpare.deleted || existingSpare.isDeleted) {
    throw Object.assign(new Error('Spare not found'), { statusCode: 404 });
  }

  const { robLocationA, robLocationB, remarks, place, dateLocal, tz, ...otherUpdates } = body;

  // Check if location ROB values are being changed - route to transfer/adjustment method
  if (robLocationA !== undefined || robLocationB !== undefined) {
    // Validate numeric inputs
    if (robLocationA !== undefined && (isNaN(Number(robLocationA)) || Number(robLocationA) < 0)) {
      throw Object.assign(new Error("robLocationA must be a valid non-negative number"), { statusCode: 400 });
    }
    if (robLocationB !== undefined && (isNaN(Number(robLocationB)) || Number(robLocationB) < 0)) {
      throw Object.assign(new Error("robLocationB must be a valid non-negative number"), { statusCode: 400 });
    }

    // Get current spare to determine location values
    const currentSpare = existingSpare;

    const newLocA = robLocationA !== undefined ? Number(robLocationA) : (currentSpare.robLocationA ?? 0);
    const newLocB = robLocationB !== undefined ? Number(robLocationB) : (currentSpare.robLocationB ?? 0);

    // Use transfer method which creates ledger history
    const result = await repo.transferSpareLocation(
      spareId, newLocA, newLocB, userId, remarks, place, dateLocal, tz
    );

    // Also handle other updates if provided
    if (Object.keys(otherUpdates).length > 0) {
      return repo.updateSpare(spareId, otherUpdates);
    }

    return result.spare;
  }

  // Handle non-ROB updates through regular update
  return repo.updateSpare(spareId, otherUpdates);
}

export async function deleteSpare(
  id: string,
  vesselId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const spare = await repo.getSpare(id);
  if (!spare || spare.deleted || spare.isDeleted) {
    throw Object.assign(new Error(`Spare with ID ${id} not found`), { statusCode: 404 });
  }
  if (spare.vesselId !== vesselId) {
    throw Object.assign(new Error('Access denied: Spare does not belong to this vessel'), { statusCode: 403 });
  }

  await repo.deleteSpare(id, userId);
  return {
    success: true,
    message: `Spare "${spare.partName}" (${spare.partCode}) was deleted. Inventory and transaction history have been retained.`,
  };
}

export async function inactivateSpare(id: string, vesselId: string): Promise<{ success: boolean; message: string }> {
  const spare = await repo.getSpare(id);
  if (!spare || spare.deleted || spare.isDeleted) {
    throw Object.assign(new Error(`Spare with ID ${id} not found`), { statusCode: 404 });
  }
  if (spare.vesselId !== vesselId) {
    throw Object.assign(new Error("Access denied: Spare does not belong to this vessel"), { statusCode: 403 });
  }
  if (spare.isActive === false) {
    throw Object.assign(new Error("Spare is already inactive"), { statusCode: 400 });
  }
  await repo.updateSpare(id, { isActive: false });
  return {
    success: true,
    message: `Spare "${spare.partName}" (${spare.partCode}) has been deactivated successfully`
  };
}

// ── Location-specific Adjustment ──

export async function adjustSpareAtLocationEndpoint(
  spareId: string, vesselId: string, body: any, userId: string
): Promise<Spare> {
  const payload = adjustmentPayloadSchema.parse(body);

  // Security check: Verify spare belongs to the specified vessel
  const existingSpare = await repo.getSpare(spareId);
  if (!existingSpare) {
    throw Object.assign(new Error(`Spare with ID ${spareId} not found`), { statusCode: 404 });
  }
  if (existingSpare.vesselId !== vesselId) {
    throw Object.assign(new Error("Access denied: Spare does not belong to this vessel"), { statusCode: 403 });
  }

  return repo.adjustSpareAtLocation(
    spareId, payload.newRob, payload.location, userId,
    payload.remarks, payload.place, payload.dateLocal, payload.tz
  );
}

// ── Qty Adjust (+/- buttons) ──

export async function adjustSpareQuantityEndpoint(spareId: string, body: any): Promise<Spare> {
  const payload = adjustPayloadSchema.parse(body);
  return repo.adjustSpareQuantity(
    spareId, payload.qtyChange, payload.eventType, payload.reference, payload.notes
  );
}

// ── Bulk Update (Location-specific) ──

export interface BulkUpdateRow {
  componentSpareId: string;
  consumedA?: number;
  consumedB?: number;
  receivedA?: number;
  receivedB?: number;
  receivedDate?: string;
  receivedPlace?: string;
  dateLocal?: string;
  remarks?: string;
  userId?: string;
}

export interface BulkUpdateResult {
  componentSpareId: string;
  success: boolean;
  message?: string;
  robAfter?: number;
}

export async function bulkUpdate(vesselId: string, rows: BulkUpdateRow[]): Promise<BulkUpdateResult[]> {
  const results: BulkUpdateResult[] = [];

  for (const row of rows) {
    const {
      componentSpareId,
      consumedA = 0,
      consumedB = 0,
      receivedA = 0,
      receivedB = 0,
      receivedDate,
      receivedPlace,
      dateLocal,
      remarks,
      userId = 'user'
    } = row;

    // Normalize transaction date
    const transactionDate = (receivedDate && receivedDate.trim())
      ? receivedDate.trim()
      : ((dateLocal && dateLocal.trim()) ? dateLocal.trim() : undefined);

    try {
      let totalChange = 0;
      const errors: string[] = [];

      // Consume from Location A
      if (consumedA > 0) {
        try {
          await repo.consumeSpareFromLocation(
            componentSpareId, consumedA, 'A', userId, remarks,
            undefined, // workOrderRef
            transactionDate
          );
          totalChange -= consumedA;
        } catch (e: any) {
          errors.push(`Consume A: ${e.message}`);
        }
      }

      // Consume from Location B
      if (consumedB > 0) {
        try {
          await repo.consumeSpareFromLocation(
            componentSpareId, consumedB, 'B', userId, remarks,
            undefined, // workOrderRef
            transactionDate
          );
          totalChange -= consumedB;
        } catch (e: any) {
          errors.push(`Consume B: ${e.message}`);
        }
      }

      // Receive to Location A
      if (receivedA > 0) {
        try {
          await repo.receiveSpareToLocation(
            componentSpareId, receivedA, 'A', userId, remarks,
            receivedPlace, transactionDate
          );
          totalChange += receivedA;
        } catch (e: any) {
          errors.push(`Receive A: ${e.message}`);
        }
      }

      // Receive to Location B
      if (receivedB > 0) {
        try {
          await repo.receiveSpareToLocation(
            componentSpareId, receivedB, 'B', userId, remarks,
            receivedPlace, transactionDate
          );
          totalChange += receivedB;
        } catch (e: any) {
          errors.push(`Receive B: ${e.message}`);
        }
      }

      // Get the updated spare to get the new ROB
      const spare = await repo.getSpare(componentSpareId);

      if (errors.length > 0) {
        results.push({
          componentSpareId,
          success: false,
          message: errors.join('; '),
          robAfter: spare?.rob
        });
      } else {
        results.push({
          componentSpareId,
          success: true,
          robAfter: spare?.rob
        });
      }
    } catch (error: any) {
      results.push({
        componentSpareId,
        success: false,
        message: error.message || 'Unknown error'
      });
    }
  }

  return results;
}

// ── Batch Consume / Receive ──

export async function batchConsume(items: any[], workOrderId: string, consumedBy: string) {
  const results = [];
  for (const item of items) {
    const result = await repo.consumeSpare(
      item.spareId,
      item.quantity,
      workOrderId,
      consumedBy || 'System',
      item.notes
    );
    results.push(result);
  }
  return results;
}

export async function batchReceive(items: any[], purchaseOrderRef: string, receivedBy: string) {
  const results = [];
  for (const item of items) {
    const result = await repo.receiveSpare(
      item.spareId,
      item.quantity,
      receivedBy || 'System',
      item.notes,
      purchaseOrderRef
    );
    results.push(result);
  }
  return results;
}

// ── Simple Consume (legacy - Location A default) ──

export async function consumeSimple(spareId: string, body: any): Promise<any> {
  const { qty, dateLocal, place, remarks, userId, workOrder } = body;

  if (!qty || qty <= 0) {
    throw Object.assign(new Error("Quantity must be a positive number"), { statusCode: 400 });
  }

  const result = await repo.consumeSpareFromLocation(
    spareId, qty, 'A', userId || 'User',
    remarks || `Consumed at ${place || 'unknown location'} on ${dateLocal}`,
    workOrder
  );

  return {
    success: true,
    message: "Spare consumed successfully",
    data: result
  };
}

// ── Simple Receive (legacy - Location A default) ──

export async function receiveSimple(spareId: string, body: any): Promise<any> {
  const { qty, dateLocal, supplierPO, remarks, userId } = body;

  if (!qty || qty <= 0) {
    throw Object.assign(new Error("Quantity must be a positive number"), { statusCode: 400 });
  }

  const spare = await repo.getSpare(spareId);
  if (!spare) {
    throw Object.assign(new Error("Spare not found"), { statusCode: 404 });
  }

  // Route through the transactional receive path so legacy ROB, spare_location_stock
  // and spares_history are all updated atomically (was a raw robLocationA update).
  const result = await repo.receiveSpareToLocation(
    spareId, qty, 'A', userId || 'User', remarks, supplierPO, dateLocal
  );

  return {
    success: true,
    message: "Spare received successfully",
    data: result.spare
  };
}

// ── Location-aware Consume ──

export async function consumeFromLocation(paramsRaw: any, bodyRaw: any) {
  // Validate params
  const paramsResult = consumeFromLocationParamsSchema.safeParse(paramsRaw);
  if (!paramsResult.success) {
    return {
      validationError: true,
      statusCode: 400,
      response: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsResult.error.errors[0]?.message || 'Invalid spare ID',
          field: 'id'
        }
      }
    };
  }

  // Validate body
  const bodyResult = consumeFromLocationBodySchema.safeParse(bodyRaw);
  if (!bodyResult.success) {
    return {
      validationError: true,
      statusCode: 400,
      response: {
        success: false,
        errors: bodyResult.error.errors.map(err => ({
          code: 'VALIDATION_ERROR',
          message: err.message,
          field: err.path.join('.')
        }))
      }
    };
  }

  const { id: spareId } = paramsResult.data;
  const { quantity, location, userId, remarks, workOrderRef } = bodyResult.data;

  const result = await repo.consumeSpareFromLocation(
    spareId, quantity, location, userId || 'system', remarks, workOrderRef
  );

  // Rule #9: Warn if shortage occurred
  if (result.shortageQty > 0) {
    return {
      validationError: false,
      response: {
        success: true,
        data: result,
        warning: {
          code: 'PARTIAL_CONSUMPTION',
          message: `Requested ${result.requested} but only ${result.deducted} available at Location ${location}`,
          shortageQty: result.shortageQty
        }
      }
    };
  }

  return { validationError: false, response: { success: true, data: result } };
}

// ── Location-aware Receive ──

export async function receiveToLocation(paramsRaw: any, bodyRaw: any) {
  // Validate params
  const paramsResult = receiveToLocationParamsSchema.safeParse(paramsRaw);
  if (!paramsResult.success) {
    return {
      validationError: true,
      statusCode: 400,
      response: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsResult.error.errors[0]?.message || 'Invalid spare ID',
          field: 'id'
        }
      }
    };
  }

  // Validate body
  const bodyResult = receiveToLocationBodySchema.safeParse(bodyRaw);
  if (!bodyResult.success) {
    return {
      validationError: true,
      statusCode: 400,
      response: {
        success: false,
        errors: bodyResult.error.errors.map(err => ({
          code: 'VALIDATION_ERROR',
          message: err.message,
          field: err.path.join('.')
        }))
      }
    };
  }

  const { id: spareId } = paramsResult.data;
  const { quantity, location, userId, remarks, supplierPO, dateLocal } = bodyResult.data;

  const result = await repo.receiveSpareToLocation(
    spareId, quantity, location, userId || 'system', remarks, supplierPO, dateLocal
  );

  return { validationError: false, response: { success: true, data: result } };
}

// ── History ──

export async function getSpareHistory(vesselId: string, vesselIds?: string[]): Promise<SpareHistory[]> {
  return repo.getSpareHistory(vesselId, vesselIds);
}

// ── Low Stock ──

export async function getLowStockSpares(vesselId: string): Promise<Spare[]> {
  const spares = await repo.getSpares(vesselId);
  return spares.filter(spare => (spare.rob || 0) <= (spare.min || 0));
}
