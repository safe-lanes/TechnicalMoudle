import { z } from 'zod';

// ── Route params ──

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const vesselIdParamSchema = z.object({
  vesselId: z.string().min(1),
});

export const componentIdParamSchema = z.object({
  componentId: z.string().min(1),
});

export const numericIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be numeric'),
});
