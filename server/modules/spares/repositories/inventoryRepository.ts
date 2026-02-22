import { storage } from '../../../storage';
import type {
  Location, InsertLocation,
  SpareComponentLink, InsertSpareComponentLink,
  SpareLocationStock, InsertSpareLocationStock,
  InventoryTransaction, InventoryEventType,
  SpareWithInventory, Spare
} from '@shared/schema';

// ── Location Methods ──

export async function getLocations(vesselId: string): Promise<Location[]> {
  return storage.getLocations(vesselId);
}

export async function getLocationById(id: number): Promise<Location | undefined> {
  return storage.getLocationById(id);
}

export async function getLocationByName(vesselId: string, locationName: string): Promise<Location | undefined> {
  return storage.getLocationByName(vesselId, locationName);
}

export async function createLocation(location: InsertLocation): Promise<Location> {
  return storage.createLocation(location);
}

// ── Reconciliation ──

export async function reconcileSpareLocationStock(vesselId: string, userId?: string): Promise<{ synced: number; errors: number }> {
  return storage.reconcileSpareLocationStock(vesselId, userId);
}

// ── Spare-Component Links ──

export async function getSpareComponentLinks(vesselId: string): Promise<SpareComponentLink[]> {
  return storage.getSpareComponentLinks(vesselId);
}

export async function getSpareComponentLinksBySpare(spareId: number): Promise<SpareComponentLink[]> {
  return storage.getSpareComponentLinksBySpare(spareId);
}

export async function getSpareComponentLinksByComponent(componentId: string): Promise<SpareComponentLink[]> {
  return storage.getSpareComponentLinksByComponent(componentId);
}

export async function getLinkedComponentsForSpare(spareId: number): Promise<Array<{ componentId: string; componentCode: string; componentName: string }>> {
  return storage.getLinkedComponentsForSpare(spareId);
}

export async function createSpareComponentLink(link: InsertSpareComponentLink): Promise<SpareComponentLink> {
  return storage.createSpareComponentLink(link);
}

export async function deleteSpareComponentLink(spareId: number, componentId: string): Promise<void> {
  return storage.deleteSpareComponentLink(spareId, componentId);
}

// ── Spare Location Stock ──

export async function getSpareLocationStock(spareId: number): Promise<SpareLocationStock[]> {
  return storage.getSpareLocationStock(spareId);
}

export async function getSpareLocationsWithQty(spareId: number): Promise<Array<{ locationId: number; locationName: string; qty: number }>> {
  return storage.getSpareLocationsWithQty(spareId);
}

export async function getSpareRobTotal(spareId: number): Promise<number> {
  return storage.getSpareRobTotal(spareId);
}

export async function getSparesAtLocation(locationId: number): Promise<Array<{ spareId: number; partCode: string; partName: string; qty: number }>> {
  return storage.getSparesAtLocation(locationId);
}

export async function getFullSparesAtLocation(locationId: number, vesselId: string): Promise<any[]> {
  return storage.getFullSparesAtLocation(locationId, vesselId);
}

export async function getLocationsWithStock(vesselId: string): Promise<Array<{ id: number; locationName: string; sparesCount: number }>> {
  return storage.getLocationsWithStock(vesselId);
}

export async function upsertSpareLocationStock(data: InsertSpareLocationStock): Promise<SpareLocationStock> {
  return storage.upsertSpareLocationStock(data);
}

// ── Inventory Transactions ──

export async function performInventoryTransaction(input: {
  vesselId: string; spareId: number; locationId: number;
  eventType: InventoryEventType; qtyChange: number;
  referenceType: 'WORK_ORDER' | 'MANUAL' | 'EXCEL_IMPORT';
  referenceId?: string; referenceNote?: string; userId: string;
}): Promise<{ transaction: InventoryTransaction; newLocationQty: number; newTotalRob: number }> {
  return storage.performInventoryTransaction(input);
}

export async function getInventoryTransactions(vesselId: string, options?: {
  spareId?: number; locationId?: number; eventType?: InventoryEventType; limit?: number;
}): Promise<InventoryTransaction[]> {
  return storage.getInventoryTransactions(vesselId, options);
}

// ── Enhanced Spare Data ──

export async function getSparesWithInventoryByVessel(vesselId: string): Promise<SpareWithInventory[]> {
  return storage.getSparesWithInventoryByVessel(vesselId);
}

export async function getSpareWithInventory(spareId: string): Promise<SpareWithInventory | null> {
  return storage.getSpareWithInventory(spareId);
}

export async function getSparesWithInventoryByComponent(componentId: string): Promise<SpareWithInventory[]> {
  return storage.getSparesWithInventoryByComponent(componentId);
}

export async function getSparesWithInventoryByComponentCode(vesselId: string, componentCode: string): Promise<SpareWithInventory[]> {
  return storage.getSparesWithInventoryByComponentCode(vesselId, componentCode);
}

// ── Helper: getSpare (needed for transaction hydration) ──

export async function getSpare(id: string): Promise<Spare | undefined> {
  return storage.getSpare(id);
}
