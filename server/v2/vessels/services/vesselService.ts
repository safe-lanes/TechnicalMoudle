import { VesselRepository } from '../repositories/vesselRepository';
import type { Vessel, InsertVessel } from '@shared/v2/vessels/schema';

const repo = new VesselRepository();

export async function getAllVessels(): Promise<Vessel[]> {
  return repo.getAll();
}

export async function getVessel(vuuid: string): Promise<Vessel | undefined> {
  return repo.getByVuuid(vuuid);
}

export async function createVessel(data: InsertVessel): Promise<Vessel> {
  if (!data.vuuid || !data.name) {
    throw new Error('Vessel vuuid and name are required');
  }
  if (!data.code) {
    data.code = data.vuuid;
  }
  return repo.create(data);
}

export async function updateVessel(vuuid: string, data: Partial<InsertVessel>): Promise<Vessel> {
  return repo.update(vuuid, data);
}

export async function assignVesselToFleet(vuuid: string, fleetId: string | null): Promise<Vessel> {
  return repo.assignFleet(vuuid, fleetId);
}

export async function getVesselsWithFleets() {
  return repo.getWithFleets();
}

export async function getVesselsByFleet(fleetId: string): Promise<Vessel[]> {
  return repo.getByFleet(fleetId);
}

export async function getActiveVessels(): Promise<Vessel[]> {
  return repo.getActiveVessels();
}
