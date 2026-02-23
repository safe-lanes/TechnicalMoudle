import { storage } from '../../../storage';
import { getDb } from '../../../db';
import { eq, and } from 'drizzle-orm';
import {
  fleetComponents,
  fleetJobs,
  fleetSpares,
  makerList,
  components,
  jobs,
  spares,
  spareComponentLinks,
  storesItems,
} from '@shared/schema';

// ══════════════════════════════════════════════════════════
// Master Data
// ══════════════════════════════════════════════════════════

export async function getMasterDataList() {
  return storage.getMasterDataList();
}

export async function getMasterDataItem(id: number) {
  return storage.getMasterDataItem(id);
}

export async function getMasterDataByFleetCode(code: string) {
  return storage.getMasterDataByFleetCode(code);
}

export async function getMasterDataByMakerModel(makerCode: string, model: string) {
  return storage.getMasterDataByMakerModel(makerCode, model);
}

export async function generateFleetEquipmentCode(sfiCode: string) {
  return storage.generateFleetEquipmentCode(sfiCode);
}

export async function createMasterData(data: any) {
  return storage.createMasterData(data);
}

export async function updateMasterData(id: number, data: any) {
  return storage.updateMasterData(id, data);
}

export async function deleteMasterData(id: number) {
  return storage.deleteMasterData(id);
}

// ══════════════════════════════════════════════════════════
// Fleet Components Admin
// ══════════════════════════════════════════════════════════

export async function getFleetComponents() {
  return storage.getFleetComponents();
}

export async function getFleetComponent(id: number) {
  return storage.getFleetComponent(id);
}

export async function getFleetComponentByCode(code: string) {
  return storage.getFleetComponentByCode(code);
}

export async function createFleetComponent(data: any) {
  return storage.createFleetComponent(data);
}

export async function updateFleetComponent(id: number, data: any) {
  return storage.updateFleetComponent(id, data);
}

export async function deleteFleetComponent(id: number) {
  return storage.deleteFleetComponent(id);
}

// ══════════════════════════════════════════════════════════
// Fleet-Vessel Mapping (Admin)
// ══════════════════════════════════════════════════════════

export async function getAdminFleetVesselMappings(fleetEquipmentCode?: string) {
  return storage.getFleetVesselMappings(fleetEquipmentCode);
}

export async function getFleetVesselMappingsByVessel(vesselCode: string) {
  return storage.getFleetVesselMappingsByVessel(vesselCode);
}

export async function createFleetVesselMappingRecord(data: any) {
  return storage.createFleetVesselMappingRecord(data);
}

export async function deleteAdminFleetVesselMapping(id: string) {
  return storage.deleteFleetVesselMapping(id);
}

// ══════════════════════════════════════════════════════════
// Component-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getComponentVesselMappings() {
  return storage.getComponentVesselMappings();
}

export async function createComponentVesselMapping(data: any) {
  return storage.createComponentVesselMapping(data);
}

export async function deleteComponentVesselMapping(id: number) {
  return storage.deleteComponentVesselMapping(id);
}

// ══════════════════════════════════════════════════════════
// Fleet-Component Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetComponentMappings(fleetEquipmentCode?: string) {
  return storage.getFleetComponentMappings(fleetEquipmentCode);
}

export async function getFleetComponentMappingsByVessel(vesselCode: string) {
  return storage.getFleetComponentMappingsByVessel(vesselCode);
}

export async function createFleetComponentMappingRecord(data: any) {
  return storage.createFleetComponentMappingRecord(data);
}

export async function removeFleetComponentMappingRecord(fleetEquipmentCode: string, vesselCode: string, componentCode: string) {
  return storage.removeFleetComponentMappingRecord(fleetEquipmentCode, vesselCode, componentCode);
}

// ══════════════════════════════════════════════════════════
// Fleet-Job-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetJobVesselMappings(fleetEquipmentCode?: string, jobCode?: string) {
  return storage.getFleetJobVesselMappings(fleetEquipmentCode, jobCode);
}

export async function createFleetJobVesselMappingRecord(data: any) {
  return storage.createFleetJobVesselMappingRecord(data);
}

export async function removeFleetJobVesselMappingRecord(jobCode: string, vesselCode: string) {
  return storage.removeFleetJobVesselMappingRecord(jobCode, vesselCode);
}

// ══════════════════════════════════════════════════════════
// Fleet-Spare-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetSpareVesselMappings(fleetEquipmentCode?: string, partCode?: string) {
  return storage.getFleetSpareVesselMappings(fleetEquipmentCode, partCode);
}

export async function createFleetSpareVesselMappingRecord(data: any) {
  return storage.createFleetSpareVesselMappingRecord(data);
}

export async function removeFleetSpareVesselMappingRecord(partCode: string, vesselCode: string) {
  return storage.removeFleetSpareVesselMappingRecord(partCode, vesselCode);
}

// ══════════════════════════════════════════════════════════
// Bulk Import History & Errors
// ══════════════════════════════════════════════════════════

export async function getBulkImportHistory(vesselCode?: string, moduleType?: string) {
  return storage.getBulkImportHistory(vesselCode, moduleType);
}

export async function getBulkImportHistoryItem(id: string) {
  return storage.getBulkImportHistoryItem(id);
}

export async function getBulkImportErrors(importId: string) {
  return storage.getBulkImportErrors(importId);
}

export async function createBulkImportHistory(data: any) {
  return storage.createBulkImportHistory(data);
}

export async function updateBulkImportHistory(id: string, data: any) {
  return storage.updateBulkImportHistory(id, data);
}

export async function createBulkImportErrors(errors: any[]) {
  return storage.createBulkImportErrors(errors);
}

// ══════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════

export async function getFleetAdminMetrics() {
  return storage.getFleetAdminMetrics();
}

export async function getDashboardStatsData() {
  const db = await getDb();
  const allComponents = await db.select().from(fleetComponents).where(eq(fleetComponents.isDeleted, false));
  const allJobs = await db.select().from(fleetJobs).where(eq(fleetJobs.isDeleted, false));
  const allSpares = await db.select().from(fleetSpares).where(eq(fleetSpares.isDeleted, false));
  const allMakers = await db.select().from(makerList).where(eq(makerList.isDeleted, false));
  return { allComponents, allJobs, allSpares, allMakers };
}

// ══════════════════════════════════════════════════════════
// Copy Vessel — returns db instance for complex multi-table operations
// ══════════════════════════════════════════════════════════

export async function getCopyVesselDb() {
  return getDb();
}

// Re-export table references needed by copy-vessel service
export { components, jobs, spares, spareComponentLinks, storesItems };
