import * as repo from '../repositories/vesselRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import type { Fleet, Vessel, PmsVesselSettings, FleetClass } from '@shared/schema';
import { randomUUID } from 'crypto';

// ── Fleet operations ──

export async function getFleets(includeInactive: boolean): Promise<Fleet[]> {
  return includeInactive ? repo.getAllFleets() : repo.getFleets();
}

export async function getFleetById(id: string): Promise<Fleet> {
  const fleet = await repo.getFleetById(id);
  if (!fleet) throw new NotFoundError('Fleet not found');
  return fleet;
}

export async function createFleet(data: {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}): Promise<Fleet> {
  try {
    return await repo.createFleet({
      id: data.id || data.code,
      fuuid: randomUUID(),
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      isActive: data.isActive ?? true,
    });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      throw new ConflictError(error.message);
    }
    throw error;
  }
}

export async function updateFleet(id: string, data: {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}): Promise<Fleet> {
  try {
    return await repo.updateFleet(id, data);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    if (error.message?.includes('already exists')) {
      throw new ConflictError(error.message);
    }
    throw error;
  }
}

export async function deleteFleet(id: string): Promise<void> {
  try {
    await repo.deleteFleet(id);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    if (error.message?.includes('Cannot delete')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}

export async function getVesselsByFleet(fleetId: string): Promise<Vessel[]> {
  return repo.getVesselsByFleet(fleetId);
}

// ── Vessel operations ──

export async function getVessels(): Promise<Array<{ id: string; vuuid: string; name: string; code: string }>> {
  return repo.getVessels();
}

export async function getVesselsWithFleets(): Promise<Array<Vessel & { fleetName?: string; fleetCode?: string }>> {
  return repo.getVesselsWithFleets();
}

export async function createVessel(data: {
  id: string;
  name: string;
  code?: string;
  fleetId?: string | null;
  imoNumber?: string | null;
  vesselType?: string | null;
  flag?: string | null;
  isActive?: boolean;
}): Promise<Vessel> {
  try {
    return await repo.createVessel({
      id: data.id,
      vuuid: data.id, // vuuid = id (canonical UUID identity)
      name: data.name,
      code: data.code || data.id,
      fleetId: data.fleetId ?? null,
      imoNumber: data.imoNumber ?? null,
      vesselType: data.vesselType ?? null,
      flag: data.flag ?? null,
      isActive: data.isActive ?? true,
    });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      throw new ConflictError(error.message);
    }
    throw error;
  }
}

export async function assignVesselToFleet(vesselId: string, fleetId: string | null): Promise<Vessel> {
  try {
    return await repo.assignVesselToFleet(vesselId, fleetId);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
}

// ── Fleet Class operations ──

export async function getFleetClasses(fleetId: string): Promise<FleetClass[]> {
  return repo.getFleetClasses(fleetId);
}

export async function createFleetClass(fleetId: string, data: {
  name: string;
  description?: string | null;
  createdByUuid?: string | null;
}): Promise<FleetClass> {
  try {
    return await repo.createFleetClass({
      fcuuid: randomUUID(),
      fleetId,
      name: data.name,
      description: data.description ?? null,
      createdByUuid: data.createdByUuid ?? null,
      updatedByUuid: data.createdByUuid ?? null,
      isDeleted: false,
      isSync: false,
    });
  } catch (error: any) {
    if (error.message?.includes('duplicate') || error.message?.includes('unique') || error.code === '23505') {
      throw new ConflictError(`A class named "${data.name}" already exists in this fleet`);
    }
    throw error;
  }
}

export async function updateFleetClass(fcuuid: string, data: {
  name?: string;
  description?: string | null;
  updatedByUuid?: string | null;
}): Promise<FleetClass> {
  try {
    return await repo.updateFleetClass(fcuuid, data);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    if (error.message?.includes('duplicate') || error.message?.includes('unique') || error.code === '23505') {
      throw new ConflictError(`A class with that name already exists in this fleet`);
    }
    throw error;
  }
}

export async function deleteFleetClass(fcuuid: string): Promise<void> {
  try {
    await repo.deleteFleetClass(fcuuid);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
}

export async function assignVesselToClass(vesselId: string, classId: string | null): Promise<Vessel> {
  try {
    return await repo.assignVesselToClass(vesselId, classId);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    if (error.message?.includes('does not belong')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}

// ── PMS Vessel Settings operations ──

export async function getAllPmsVesselSettings(): Promise<PmsVesselSettings[]> {
  return repo.getAllPmsVesselSettings();
}

export async function getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings> {
  const settings = await repo.getPmsVesselSettings(vesselId);
  if (!settings) throw new NotFoundError('PMS vessel settings not found');
  return settings;
}

export async function createPmsVesselSettings(data: {
  vesselId: string;
  updatedBy?: string;
  [key: string]: any;
}, username: string): Promise<PmsVesselSettings> {
  // Check if settings already exist
  const existing = await repo.getPmsVesselSettings(data.vesselId);
  if (existing) {
    throw new ConflictError('PMS vessel settings already exist for this vessel. Use PUT to update.');
  }

  const updatedBy = data.updatedBy || username || 'test';
  return repo.createOrUpdatePmsVesselSettings({
    ...data,
    updatedBy,
  });
}

export async function updatePmsVesselSettings(vesselId: string, data: Record<string, any>, username: string): Promise<{ settings: PmsVesselSettings; recalcResult?: { statusesUpdated: number } }> {
  const updatedBy = data.updatedBy || username || 'test';

  const settingsMode = data.settingsMode || 'COMPANY_STANDARD';
  if (settingsMode !== 'COMPANY_STANDARD' && settingsMode !== 'CUSTOM') {
    throw new ValidationError(`Invalid settingsMode: ${settingsMode}. Must be COMPANY_STANDARD or CUSTOM`);
  }

  const persistData: Record<string, any> = {
    vesselId,
    settingsMode,
    calendarLeadDaysCritical: Math.max(1, Math.round(data.calendarLeadDaysCritical ?? 7)),
    calendarLeadDaysNonCritical: Math.max(1, Math.round(data.calendarLeadDaysNonCritical ?? 14)),
    rhLeadHoursCritical: Math.max(1, Math.round(data.rhLeadHoursCritical ?? 50)),
    rhLeadHoursNonCritical: Math.max(1, Math.round(data.rhLeadHoursNonCritical ?? 100)),
    updatedBy,
  };

  if (settingsMode === 'CUSTOM') {
    const validCalMethods = ['FIXED_DAYS', 'MONTH_END', 'SPECIFIC_DATE_NEXT_MONTH'];
    const validScopes = ['ALL_WORK_ORDERS', 'LAST_WEEK_OF_MONTH'];
    const validRhMethods = ['FIXED_HOURS', 'MONTH_END', 'SPECIFIC_DATE_NEXT_MONTH'];

    const calMethod = data.calendarGraceMethod || 'FIXED_DAYS';
    if (!validCalMethods.includes(calMethod)) {
      throw new ValidationError(`Invalid calendar grace method: ${calMethod}`);
    }
    const calScope = data.calendarGraceScope || 'ALL_WORK_ORDERS';
    if (!validScopes.includes(calScope)) {
      throw new ValidationError(`Invalid calendar grace scope: ${calScope}`);
    }
    const calValue = data.calendarGraceValue ?? 7;
    if (calMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (calValue < 1 || calValue > 28)) {
      throw new ValidationError('Specific Date of Next Month requires a day value between 1 and 28');
    }

    persistData.calendarGraceMethod = calMethod;
    persistData.calendarGraceValue = calMethod === 'MONTH_END' ? 0 : calValue;
    persistData.calendarGraceScope = calScope;
    persistData.calendarGraceMode = 'CUSTOM_DAYS';
    persistData.calendarGraceDays = calMethod === 'FIXED_DAYS' ? calValue : 7;

    if (calScope === 'LAST_WEEK_OF_MONTH') {
      const validCalFallbacks = ['MONTH_END', 'FIXED_DAYS'];
      const calFb = data.calendarFallbackMethod || 'MONTH_END';
      if (!validCalFallbacks.includes(calFb)) {
        throw new ValidationError(`Invalid calendar fallback method: ${calFb}`);
      }
      persistData.calendarFallbackMethod = calFb;
      persistData.calendarFallbackGraceDays = calFb === 'FIXED_DAYS' ? (data.calendarFallbackGraceDays ?? 0) : null;
    } else {
      persistData.calendarFallbackMethod = null;
      persistData.calendarFallbackGraceDays = null;
    }

    const rhMethod = data.rhGraceMethod || 'FIXED_HOURS';
    if (!validRhMethods.includes(rhMethod)) {
      throw new ValidationError(`Invalid RH grace method: ${rhMethod}`);
    }
    const rhScope = data.rhGraceScope || 'ALL_WORK_ORDERS';
    if (!validScopes.includes(rhScope)) {
      throw new ValidationError(`Invalid RH grace scope: ${rhScope}`);
    }
    const rhValue = data.rhGraceValue ?? 168;
    if (rhMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (rhValue < 1 || rhValue > 28)) {
      throw new ValidationError('Specific Date of Next Month requires a day value between 1 and 28');
    }

    persistData.rhGraceMethod = rhMethod;
    persistData.rhGraceValue = rhMethod === 'MONTH_END' ? 0 : rhValue;
    persistData.rhGraceScope = rhScope;
    persistData.rhGraceHours = rhMethod === 'FIXED_HOURS' ? rhValue : 168;

    if (rhScope === 'LAST_WEEK_OF_MONTH') {
      const validRhFallbacks = ['MONTH_END', 'FIXED_HOURS'];
      const rhFb = data.rhFallbackMethod || 'MONTH_END';
      if (!validRhFallbacks.includes(rhFb)) {
        throw new ValidationError(`Invalid RH fallback method: ${rhFb}`);
      }
      persistData.rhFallbackMethod = rhFb;
      persistData.rhFallbackGraceHours = rhFb === 'FIXED_HOURS' ? (data.rhFallbackGraceHours ?? 0) : null;
    } else {
      persistData.rhFallbackMethod = null;
      persistData.rhFallbackGraceHours = null;
    }
  } else {
    persistData.calendarGraceMode = 'COMPANY_STANDARD';
    persistData.calendarGraceDays = data.calendarGraceDays ?? 7;
    persistData.calendarGraceMethod = data.calendarGraceMethod || 'FIXED_DAYS';
    persistData.calendarGraceValue = data.calendarGraceValue ?? 7;
    persistData.calendarGraceScope = data.calendarGraceScope || 'ALL_WORK_ORDERS';
    persistData.calendarFallbackMethod = null;
    persistData.calendarFallbackGraceDays = null;
    persistData.rhGraceHours = data.rhGraceHours ?? 168;
    persistData.rhGraceMethod = data.rhGraceMethod || 'FIXED_HOURS';
    persistData.rhGraceValue = data.rhGraceValue ?? 168;
    persistData.rhGraceScope = data.rhGraceScope || 'ALL_WORK_ORDERS';
    persistData.rhFallbackMethod = null;
    persistData.rhFallbackGraceHours = null;
  }

  const settings = await repo.createOrUpdatePmsVesselSettings(persistData as any);

  // Trigger immediate status recalculation when grace period settings change
  let recalcResult: { statusesUpdated: number } | undefined;
  try {
    const { workOrderStatusRecalculator } = await import('../../../services/workOrderStatusRecalculator');
    recalcResult = await workOrderStatusRecalculator.forceRecalculation();
    console.log(`[PMS Settings] Grace period settings updated for ${vesselId}, recalculated ${recalcResult.statusesUpdated} work order statuses`);
  } catch (recalcError) {
    console.error('[PMS Settings] Failed to trigger status recalculation:', recalcError);
  }

  return { settings, recalcResult };
}

export async function deletePmsVesselSettings(vesselId: string): Promise<void> {
  return repo.deletePmsVesselSettings(vesselId);
}

// ── Company Standard Grace Settings operations ──

const COMPANY_GRACE_DEFAULTS = {
  graceMethod: 'FIXED_DAYS' as const,
  graceValue: 7 as number | null,
  scope: 'LAST_WEEK_OF_MONTH' as const,
  fallbackGraceDays: null as number | null,
  fallbackMethod: 'MONTH_END' as string | null,
  calendarLeadDaysCritical: 7,
  calendarLeadDaysNonCritical: 14,
  rhLeadHoursCritical: 720,
  rhLeadHoursNonCritical: 720,
  rhGraceHours: 168,
  rhGraceMethod: 'FIXED_HOURS' as string,
  rhGraceValue: 168 as number,
  rhGraceScope: 'ALL_WORK_ORDERS' as string,
  rhFallbackMethod: null as string | null,
  rhFallbackGraceHours: null as number | null,
};

export async function getCompanyStandardGraceSettings() {
  const settings = await repo.getCompanyStandardGraceSettings();
  if (!settings) {
    return {
      ...COMPANY_GRACE_DEFAULTS,
      configured: false,
    };
  }
  return {
    ...settings,
    configured: true,
  };
}

export async function upsertCompanyStandardGraceSettings(data: any, username: string) {
  const validMethods = ['FIXED_DAYS', 'MONTH_END', 'SPECIFIC_DATE_NEXT_MONTH'];
  const validScopes = ['ALL_WORK_ORDERS', 'LAST_WEEK_OF_MONTH'];

  if (!validMethods.includes(data.graceMethod)) {
    throw new ValidationError(`Invalid grace method: ${data.graceMethod}`);
  }
  if (!validScopes.includes(data.scope)) {
    throw new ValidationError(`Invalid scope: ${data.scope}`);
  }

  if (data.graceMethod === 'FIXED_DAYS' && (!data.graceValue || data.graceValue < 1)) {
    throw new ValidationError('Fixed Days requires a positive grace value');
  }
  if (data.graceMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (!data.graceValue || data.graceValue < 1 || data.graceValue > 28)) {
    throw new ValidationError('Specific Date of Next Month requires a day value between 1 and 28');
  }

  const fallbackMethod = data.fallbackMethod || 'MONTH_END';
  if (data.scope === 'LAST_WEEK_OF_MONTH') {
    if (!validMethods.includes(fallbackMethod)) {
      throw new ValidationError(`Invalid fallback method: ${fallbackMethod}`);
    }
    if (fallbackMethod === 'FIXED_DAYS' && (data.fallbackGraceDays === undefined || data.fallbackGraceDays === null || data.fallbackGraceDays < 0)) {
      throw new ValidationError('Fallback grace days is required when fallback method is Fixed Days');
    }
  }

  const calendarLeadCrit = data.calendarLeadDaysCritical != null ? Math.max(1, Math.round(data.calendarLeadDaysCritical)) : 7;
  const calendarLeadNonCrit = data.calendarLeadDaysNonCritical != null ? Math.max(1, Math.round(data.calendarLeadDaysNonCritical)) : 14;
  const rhLeadCrit = data.rhLeadHoursCritical != null ? Math.max(1, Math.round(data.rhLeadHoursCritical)) : 720;
  const rhLeadNonCrit = data.rhLeadHoursNonCritical != null ? Math.max(1, Math.round(data.rhLeadHoursNonCritical)) : 720;

  const validRhMethods = ['FIXED_HOURS', 'MONTH_END', 'SPECIFIC_DATE_NEXT_MONTH'];
  const rhGraceMethod = data.rhGraceMethod || 'FIXED_HOURS';
  const rhGraceScope = data.rhGraceScope || 'ALL_WORK_ORDERS';

  if (!validRhMethods.includes(rhGraceMethod)) {
    throw new ValidationError(`Invalid RH grace method: ${rhGraceMethod}`);
  }
  if (!validScopes.includes(rhGraceScope)) {
    throw new ValidationError(`Invalid RH grace scope: ${rhGraceScope}`);
  }
  const rhGraceValue = data.rhGraceValue != null ? Math.max(0, Math.round(data.rhGraceValue)) : 168;
  if (rhGraceMethod === 'FIXED_HOURS' && rhGraceValue < 1) {
    throw new ValidationError('Fixed Hours requires a positive RH grace value');
  }
  if (rhGraceMethod === 'SPECIFIC_DATE_NEXT_MONTH' && (rhGraceValue < 1 || rhGraceValue > 28)) {
    throw new ValidationError('Specific Date of Next Month requires a day value between 1 and 28');
  }

  const validRhFallbackMethods = ['MONTH_END', 'FIXED_HOURS'];
  const rhFallbackMethod = data.rhFallbackMethod || 'MONTH_END';
  if (rhGraceScope === 'LAST_WEEK_OF_MONTH') {
    if (!validRhFallbackMethods.includes(rhFallbackMethod)) {
      throw new ValidationError(`Invalid RH fallback method: ${rhFallbackMethod}. Must be MONTH_END or FIXED_HOURS`);
    }
    if (rhFallbackMethod === 'FIXED_HOURS' && (data.rhFallbackGraceHours === undefined || data.rhFallbackGraceHours === null || data.rhFallbackGraceHours < 0)) {
      throw new ValidationError('RH fallback grace hours is required when fallback method is Fixed Hours');
    }
  }

  const rhGraceHoursComputed = rhGraceMethod === 'FIXED_HOURS' ? rhGraceValue : 168;

  return repo.upsertCompanyStandardGraceSettings({
    graceMethod: data.graceMethod,
    graceValue: data.graceMethod === 'MONTH_END' ? null : data.graceValue,
    scope: data.scope,
    fallbackGraceDays: data.scope === 'LAST_WEEK_OF_MONTH' && fallbackMethod === 'FIXED_DAYS' ? data.fallbackGraceDays : null,
    fallbackMethod: data.scope === 'LAST_WEEK_OF_MONTH' ? fallbackMethod : null,
    calendarLeadDaysCritical: calendarLeadCrit,
    calendarLeadDaysNonCritical: calendarLeadNonCrit,
    rhLeadHoursCritical: rhLeadCrit,
    rhLeadHoursNonCritical: rhLeadNonCrit,
    rhGraceHours: rhGraceHoursComputed,
    rhGraceMethod: rhGraceMethod,
    rhGraceValue: rhGraceMethod === 'MONTH_END' ? 0 : rhGraceValue,
    rhGraceScope: rhGraceScope,
    rhFallbackMethod: rhGraceScope === 'LAST_WEEK_OF_MONTH' ? rhFallbackMethod : null,
    rhFallbackGraceHours: rhGraceScope === 'LAST_WEEK_OF_MONTH' && rhFallbackMethod === 'FIXED_HOURS' ? (data.rhFallbackGraceHours ?? 0) : null,
    updatedBy: username,
  });
}

// ── Vessel Location Names operations ──

export async function getVesselLocationNames(vesselId: string): Promise<{
  vesselId: string;
  locationAName: string;
  locationBName: string;
}> {
  const settings = await repo.getPmsVesselSettings(vesselId);
  return {
    vesselId,
    locationAName: settings?.locationAName ?? 'Location A',
    locationBName: settings?.locationBName ?? 'Location B',
  };
}

export async function updateVesselLocationNames(vesselId: string, data: {
  locationAName?: string;
  locationBName?: string;
  updatedBy?: string;
}, username: string): Promise<{
  vesselId: string;
  locationAName: string;
  locationBName: string;
}> {
  const { locationAName, locationBName } = data;

  // Validate input
  if (locationAName !== undefined && typeof locationAName !== 'string') {
    throw new ValidationError('locationAName must be a string');
  }
  if (locationBName !== undefined && typeof locationBName !== 'string') {
    throw new ValidationError('locationBName must be a string');
  }

  // Get existing settings - preserve ALL existing values
  const existingSettings = await repo.getPmsVesselSettings(vesselId);
  const updatedBy = data.updatedBy || username || 'test';

  const settingsToSave = existingSettings
    ? {
        ...existingSettings,
        vesselId,
        locationAName: locationAName ?? existingSettings.locationAName ?? 'Location A',
        locationBName: locationBName ?? existingSettings.locationBName ?? 'Location B',
        updatedBy,
      }
    : {
        vesselId,
        locationAName: locationAName ?? 'Location A',
        locationBName: locationBName ?? 'Location B',
        calendarLeadDaysCritical: 7,
        calendarLeadDaysNonCritical: 14,
        calendarGraceMode: 'COMPANY_STANDARD',
        calendarGraceDays: 7,
        rhLeadHoursCritical: 50,
        rhLeadHoursNonCritical: 100,
        rhGraceHours: 168,
        updatedBy,
      };

  const updatedSettings = await repo.createOrUpdatePmsVesselSettings(settingsToSave);

  return {
    vesselId,
    locationAName: updatedSettings.locationAName,
    locationBName: updatedSettings.locationBName,
  };
}
