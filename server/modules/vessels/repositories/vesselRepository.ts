import { storage } from '../../../storage';
import type { Fleet, InsertFleet, Vessel, InsertVessel, PmsVesselSettings, InsertPmsVesselSettings, FleetClass, InsertFleetClass, CompanyStandardGraceSettings, InsertCompanyStandardGraceSettings } from '@shared/schema';

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

// ── Fleet Class methods ──

export async function getFleetClasses(fleetId: string): Promise<FleetClass[]> {
  return storage.getFleetClasses(fleetId);
}

export async function createFleetClass(data: InsertFleetClass): Promise<FleetClass> {
  return storage.createFleetClass(data);
}

export async function updateFleetClass(fcuuid: string, data: Partial<FleetClass>): Promise<FleetClass> {
  return storage.updateFleetClass(fcuuid, data);
}

export async function deleteFleetClass(fcuuid: string): Promise<void> {
  return storage.deleteFleetClass(fcuuid);
}

export async function assignVesselToClass(vesselId: string, classId: string | null): Promise<Vessel> {
  return storage.assignVesselToClass(vesselId, classId);
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

// ── Company Standard Grace Settings methods ──

export async function getCompanyStandardGraceSettings(): Promise<CompanyStandardGraceSettings | undefined> {
  return storage.getCompanyStandardGraceSettings();
}

export async function upsertCompanyStandardGraceSettings(settings: InsertCompanyStandardGraceSettings): Promise<CompanyStandardGraceSettings> {
  return storage.upsertCompanyStandardGraceSettings(settings);
}
