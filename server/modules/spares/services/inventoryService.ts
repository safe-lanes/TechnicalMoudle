import * as repo from '../repositories/inventoryRepository';
import { inventoryTransactionSchema } from '../schemas';
import type {
  Location, InsertLocation,
  SpareComponentLink, InsertSpareComponentLink,
  SpareLocationStock, InsertSpareLocationStock,
  InventoryTransaction,
  SpareWithInventory
} from '@shared/schema';

// ── Locations ──

export async function getLocations(vesselId: string): Promise<Location[]> {
  return repo.getLocations(vesselId);
}

export async function getLocationById(id: number): Promise<Location | undefined> {
  return repo.getLocationById(id);
}

export async function createLocation(vesselId: string, body: any): Promise<Location> {
  const { locationName, locationType, createdBy } = body;
  if (!locationName) {
    throw Object.assign(new Error("locationName is required"), { statusCode: 400 });
  }

  const existing = await repo.getLocationByName(vesselId, locationName);
  if (existing) {
    return existing;
  }

  return repo.createLocation({
    vesselId,
    locationName: locationName.trim(),
    locationType: locationType || null,
    createdBy: createdBy || 'system',
  });
}

// ── Reconciliation ──

export async function reconcile(vesselId: string, userId: string): Promise<{ synced: number; errors: number }> {
  return repo.reconcileSpareLocationStock(vesselId, userId);
}

// ── Spare-Component Links ──

export async function getSpareComponentLinks(vesselId: string): Promise<SpareComponentLink[]> {
  return repo.getSpareComponentLinks(vesselId);
}

export async function getSpareComponentLinksBySpare(spareId: number) {
  const links = await repo.getSpareComponentLinksBySpare(spareId);
  const linkedComponents = await repo.getLinkedComponentsForSpare(spareId);
  return { links, linkedComponents };
}

export async function getSpareComponentLinksByComponent(componentId: string): Promise<SpareComponentLink[]> {
  return repo.getSpareComponentLinksByComponent(componentId);
}

export async function createSpareComponentLink(body: any): Promise<SpareComponentLink> {
  const { vesselId, spareId, componentId, createdBy } = body;
  if (!vesselId || !spareId || !componentId) {
    throw Object.assign(
      new Error("vesselId, spareId, and componentId are required"),
      { statusCode: 400 }
    );
  }

  return repo.createSpareComponentLink({
    vesselId,
    spareId: parseInt(spareId),
    componentId,
    linkedBy: createdBy || 'system',
  });
}

export async function deleteSpareComponentLink(spareId: number, componentId: string): Promise<void> {
  return repo.deleteSpareComponentLink(spareId, componentId);
}

// ── Spare Location Stock ──

export async function getSpareStock(spareId: number) {
  const stockRecords = await repo.getSpareLocationStock(spareId);
  const locationsWithQty = await repo.getSpareLocationsWithQty(spareId);
  const robTotal = await repo.getSpareRobTotal(spareId);

  return {
    spareId,
    robTotal,
    locations: locationsWithQty,
    stockRecords
  };
}

export async function getSparesAtLocation(locationId: number) {
  return repo.getSparesAtLocation(locationId);
}

export async function getLocationsWithStock(vesselId: string) {
  return repo.getLocationsWithStock(vesselId);
}

export async function getFullSparesAtLocation(locationId: number, vesselId: string) {
  return repo.getFullSparesAtLocation(locationId, vesselId);
}

export async function upsertStock(spareId: number, locationId: number, body: any): Promise<SpareLocationStock> {
  const { qty, vesselId } = body;

  if (qty === undefined || qty < 0) {
    throw Object.assign(new Error("qty must be >= 0"), { statusCode: 400 });
  }
  if (!vesselId) {
    throw Object.assign(new Error("vesselId is required"), { statusCode: 400 });
  }

  return repo.upsertSpareLocationStock({
    vesselId,
    spareId,
    locationId,
    qty,
  });
}

// ── Inventory Transactions ──

export async function createTransaction(body: any) {
  const parsed = inventoryTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return {
      validationError: true,
      response: {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        errors: parsed.error.errors
      }
    };
  }

  const result = await repo.performInventoryTransaction(parsed.data);
  return { validationError: false, response: { success: true, data: result } };
}

export async function getTransactions(vesselId: string, query: any) {
  const { spareId, locationId, eventType, limit } = query;

  const transactions = await repo.getInventoryTransactions(vesselId, {
    spareId: spareId ? parseInt(spareId as string) : undefined,
    locationId: locationId ? parseInt(locationId as string) : undefined,
    eventType: eventType as any,
    limit: limit ? parseInt(limit as string) : undefined,
  });

  // Hydrate transactions with spare data including linkedComponents
  const hydratedTransactions = await Promise.all(transactions.map(async (txn) => {
    const spare = await repo.getSpare(txn.spareUuid);
    const linkedComponents = spare ? await repo.getLinkedComponentsForSpare(spare.id) : [];
    const location = txn.locationId ? await repo.getLocationById(txn.locationId) : null;
    return {
      ...txn,
      spare: spare ? {
        ...spare,
        linkedComponents,
      } : null,
      locationName: location?.locationName || null,
    };
  }));

  return hydratedTransactions;
}

// ── Enhanced Spare Data ──

export async function getSparesWithInventoryByVessel(vesselId: string): Promise<SpareWithInventory[]> {
  return repo.getSparesWithInventoryByVessel(vesselId);
}

export async function getSpareWithInventory(spareId: string): Promise<SpareWithInventory | null> {
  return repo.getSpareWithInventory(spareId);
}

export async function getSparesWithInventoryByComponent(componentId: string): Promise<SpareWithInventory[]> {
  return repo.getSparesWithInventoryByComponent(componentId);
}

export async function getSparesWithInventoryByComponentCode(vesselId: string, componentCode: string): Promise<SpareWithInventory[]> {
  return repo.getSparesWithInventoryByComponentCode(vesselId, componentCode);
}
