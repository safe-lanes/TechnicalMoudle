import { z } from "zod";

export const createComponentSchema = z.object({}).passthrough();

export const updateComponentSchema = z.object({}).passthrough();

export const inactivateComponentSchema = z.object({
  cascadeInactivate: z.boolean().optional(),
  userId: z.string().optional(),
}).passthrough();

export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;
export type InactivateComponentInput = z.infer<typeof inactivateComponentSchema>;
