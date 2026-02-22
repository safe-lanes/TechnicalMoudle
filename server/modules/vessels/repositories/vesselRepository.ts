import { storage } from '../../../storage';
import type { Fleet, InsertFleet, Vessel, InsertVessel, PmsVesselSettings, InsertPmsVesselSettings } from '@shared/schema';

// ── Fleet methods ──

export async function getFleets(): Promise<Fleet[]> {
  return storage.getFleets();
}

export async function getAllFleets(): Promise<Fleet[]> {
  return storage.getAllFleets();
}

export async function getFleetById(id: string): Promise<Fleet | undefined> {
  return storage.getFleetById(id);
}

export async function createFleet(data: InsertFleet): Promise<Fleet> {
  return storage.createFleet(data);
}

export async function updateFleet(id: string, data: Partial<Fleet>): Promise<Fleet> {
  return storage.updateFleet(id, data);
}

export async function deleteFleet(id: string): Promise<void> {
  return storage.deleteFleet(id);
}

export async function getVesselsByFleet(fleetId: string): Promise<Vessel[]> {
  return storage.getVesselsByFleet(fleetId);
}

// ── Vessel methods ──

export async function getVessels(): Promise<Array<{ id: string; vuuid: string; name: string; code: string }>> {
  return storage.getVessels();
}

export async function getVesselsWithFleets(): Promise<Array<Vessel & { fleetName?: string; fleetCode?: string }>> {
  return storage.getVesselsWithFleets();
}

export async function createVessel(data: InsertVessel): Promise<Vessel> {
  return storage.createVessel(data);
}

export async function assignVesselToFleet(vesselId: string, fleetId: string | null): Promise<Vessel> {
  return storage.assignVesselToFleet(vesselId, fleetId);
}

// ── PMS Vessel Settings methods ──

export async function getAllPmsVesselSettings(): Promise<PmsVesselSettings[]> {
  return storage.getAllPmsVesselSettings();
}

export async function getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined> {
  return storage.getPmsVesselSettings(vesselId);
}

export async function createOrUpdatePmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
  return storage.createOrUpdatePmsVesselSettings(settings);
}

export async function deletePmsVesselSettings(vesselId: string): Promise<void> {
  return storage.deletePmsVesselSettings(vesselId);
}
