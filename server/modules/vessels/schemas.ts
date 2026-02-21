import { z } from 'zod';

// ── Route params ──

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const vesselIdParamSchema = z.object({
  vesselId: z.string().min(1),
});

// ── Query params ──

export const fleetsQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
});

// ── Fleet body schemas ──

export const createFleetBodySchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'Fleet code is required'),
  name: z.string().min(1, 'Fleet name is required'),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateFleetBodySchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── Vessel body schemas ──

export const createVesselBodySchema = z.object({
  id: z.string().min(1, 'Vessel ID is required'),
  name: z.string().min(1, 'Vessel name is required'),
  code: z.string().optional(),
  fleetId: z.string().nullable().optional(),
  imoNumber: z.string().nullable().optional(),
  vesselType: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const assignVesselToFleetBodySchema = z.object({
  fleetId: z.string().nullable(),
});

// ── PMS Vessel Settings body schemas ──

export const createPmsSettingsBodySchema = z.object({
  vesselId: z.string().min(1, 'vesselId is required'),
  calendarLeadDaysCritical: z.number().optional(),
  calendarLeadDaysNonCritical: z.number().optional(),
  calendarGraceMode: z.string().optional(),
  calendarGraceDays: z.number().optional(),
  rhLeadHoursCritical: z.number().optional(),
  rhLeadHoursNonCritical: z.number().optional(),
  rhGraceHours: z.number().optional(),
  locationAName: z.string().optional(),
  locationBName: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const updatePmsSettingsBodySchema = z.object({
  calendarLeadDaysCritical: z.number().optional(),
  calendarLeadDaysNonCritical: z.number().optional(),
  calendarGraceMode: z.string().optional(),
  calendarGraceDays: z.number().optional(),
  rhLeadHoursCritical: z.number().optional(),
  rhLeadHoursNonCritical: z.number().optional(),
  rhGraceHours: z.number().optional(),
  locationAName: z.string().optional(),
  locationBName: z.string().optional(),
  updatedBy: z.string().optional(),
});

// ── Vessel Location Names body schemas ──

export const updateLocationNamesBodySchema = z.object({
  locationAName: z.string().optional(),
  locationBName: z.string().optional(),
  updatedBy: z.string().optional(),
});
