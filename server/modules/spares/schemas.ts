import { z } from 'zod';

// ── Spares Adjustment Schemas ──

export const adjustmentPayloadSchema = z.object({
  newRob: z.number().min(0),
  location: z.enum(['A', 'B']),
  remarks: z.string().optional(),
  place: z.string().optional(),
  dateLocal: z.string().optional(),
  tz: z.string().optional()
});

export const adjustPayloadSchema = z.object({
  qtyChange: z.number(),
  eventType: z.enum(['CONSUME', 'RECEIVE', 'ADJUST']),
  reference: z.string().optional(),
  notes: z.string().optional()
});

// ── Location-aware Consume/Receive Schemas ──

export const consumeFromLocationBodySchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be a positive number'),
  location: z.enum(['A', 'B'], { errorMap: () => ({ message: 'Location must be "A" or "B"' }) }),
  userId: z.string().optional(),
  remarks: z.string().optional(),
  workOrderRef: z.string().optional()
});

export const consumeFromLocationParamsSchema = z.object({
  id: z.coerce.number().int().positive('Spare ID must be a positive integer')
});

export const receiveToLocationBodySchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be a positive number'),
  location: z.enum(['A', 'B'], { errorMap: () => ({ message: 'Location must be "A" or "B"' }) }),
  userId: z.string().optional(),
  remarks: z.string().optional(),
  supplierPO: z.string().optional(),
  dateLocal: z.string().optional()
});

export const receiveToLocationParamsSchema = z.object({
  id: z.coerce.number().int().positive('Spare ID must be a positive integer')
});

// ── Inventory Transaction Schema ──

export const inventoryTransactionSchema = z.object({
  vesselId: z.string(),
  spareId: z.coerce.number().int().positive(),
  locationId: z.coerce.number().int().positive(),
  eventType: z.enum(['RECEIVE', 'CONSUME', 'ADJUST_OPENING_BALANCE', 'ADJUST_CORRECTION']),
  qtyChange: z.coerce.number().int(),
  referenceType: z.enum(['WORK_ORDER', 'MANUAL', 'EXCEL_IMPORT']),
  referenceId: z.string().optional(),
  referenceNote: z.string().optional(),
  userId: z.string(),
});
