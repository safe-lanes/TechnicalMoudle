import * as repo from '../repositories/vesselRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import type { Fleet, Vessel, PmsVesselSettings } from '@shared/schema';

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

export async function getVessels(): Promise<Array<{ id: string; name: string; code: string }>> {
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
  const settings = await repo.createOrUpdatePmsVesselSettings({
    vesselId,
    ...data,
    updatedBy,
  });

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
