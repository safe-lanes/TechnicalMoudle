import { storage } from '../../../storage';
import { getPool } from '../../../db';

// ══════════════════════════════════════════════════════════
// Fleet-Scoped Components
// ══════════════════════════════════════════════════════════

export async function getFleetScopedComponents() {
  return storage.getFleetScopedComponents();
}

export async function getFleetScopedComponent(id: string) {
  return storage.getFleetScopedComponent(id);
}

export async function createFleetScopedComponent(data: any) {
  return storage.createFleetScopedComponent(data);
}

export async function updateFleetScopedComponent(id: string, data: any) {
  return storage.updateFleetScopedComponent(id, data);
}

export async function deleteFleetScopedComponent(id: string) {
  return storage.deleteFleetScopedComponent(id);
}

export async function updateComponentSortOrder(updates: { id: number; sortOrder: number }[]) {
  const pool = await getPool();
  for (const update of updates) {
    await pool.query(
      `UPDATE fleet_components SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
      [update.sortOrder, update.id]
    );
  }
  return { success: true, updated: updates.length };
}

// ══════════════════════════════════════════════════════════
// Fleet Jobs
// ══════════════════════════════════════════════════════════

export async function getFleetJobs() {
  return storage.getFleetJobs();
}

export async function getFleetJob(id: string) {
  return storage.getFleetJob(Number(id));
}

export async function createFleetJob(data: any) {
  return storage.createFleetJob(data);
}

export async function updateFleetJob(id: number, data: any) {
  return storage.updateFleetJob(id, data);
}

export async function deleteFleetJob(id: string) {
  return storage.deleteFleetJob(Number(id));
}

// ══════════════════════════════════════════════════════════
// Fleet Spares
// ══════════════════════════════════════════════════════════

export async function getFleetSpares() {
  return storage.getFleetSparesFromTable();
}

export async function getFleetSpare(id: number) {
  return storage.getFleetSpareFromTable(id);
}

export async function createFleetSpare(data: any) {
  return storage.createFleetSpareInTable(data);
}

export async function updateFleetSpare(id: number, data: any) {
  return storage.updateFleetSpareInTable(id, data);
}

export async function deleteFleetSpare(id: number) {
  return storage.deleteFleetSpareFromTable(id);
}

// ══════════════════════════════════════════════════════════
// Makers
// ══════════════════════════════════════════════════════════

export async function getMakers(search?: string) {
  return storage.getMakers(search);
}

export async function getMakerById(id: number) {
  return storage.getMakerById(id);
}

export async function createMaker(data: any) {
  return storage.createMaker(data);
}

export async function updateMaker(id: number, data: any) {
  return storage.updateMaker(id, data);
}

export async function deleteMaker(id: number) {
  return storage.deleteMaker(id);
}

// ══════════════════════════════════════════════════════════
// Master Lists
// ══════════════════════════════════════════════════════════

export async function getMasterLists(listType?: string) {
  return storage.getMasterLists(listType);
}

export async function getMasterListById(id: number) {
  return storage.getMasterListById(id);
}

export async function createMasterList(data: any) {
  return storage.createMasterList(data);
}

export async function updateMasterList(id: number, data: any) {
  return storage.updateMasterList(id, data);
}

export async function deleteMasterList(id: number) {
  return storage.deleteMasterList(id);
}

// ══════════════════════════════════════════════════════════
// Master List Types (DB-backed registry + Section mapping)
// ══════════════════════════════════════════════════════════

export async function getMasterListTypes(section?: string) {
  return storage.getMasterListTypes(section);
}

export async function getAllMasterListTypesIncludingInactive(section?: string) {
  return storage.getAllMasterListTypesIncludingInactive(section);
}

export async function getMasterListTypeById(id: number) {
  return storage.getMasterListTypeById(id);
}

export async function getMasterListTypeByKey(key: string) {
  return storage.getMasterListTypeByKey(key);
}

export async function createMasterListType(data: any) {
  return storage.createMasterListType(data);
}

export async function updateMasterListType(id: number, data: any) {
  return storage.updateMasterListType(id, data);
}

export async function softDeleteMasterListType(id: number, userUuid?: string | null) {
  return storage.softDeleteMasterListType(id, userUuid);
}

export async function countMasterListItemsByType(listTypeKey: string) {
  return storage.countMasterListItemsByType(listTypeKey);
}

// ══════════════════════════════════════════════════════════
// Fleet Vessel Mappings (from routes.ts — distinct from admin mappings)
// ══════════════════════════════════════════════════════════

export async function getFleetVesselMappings() {
  return storage.getFleetVesselMappings();
}

export async function createFleetVesselMappings(data: any) {
  return storage.createFleetVesselMappings(data);
}

export async function deleteFleetVesselMapping(id: string) {
  return storage.deleteFleetVesselMapping(id);
}
