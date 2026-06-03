import * as repo from '../repositories/storesRepository';
import type { StoresItem, StoresLedger } from '@shared/schema';

// ── Get All Stores (all vessels) ──

export async function getAllStores(itemType?: string, vesselIds?: string[]): Promise<StoresItem[]> {
  const allVessels = await repo.getVessels();
  // 'my' scope: narrow the all-vessel aggregate to the caller's assigned mini-fleet.
  const scoped = vesselIds && vesselIds.length > 0
    ? allVessels.filter((v) => vesselIds.includes(v.id))
    : allVessels;
  const allStores: StoresItem[] = [];
  for (const vessel of scoped) {
    const vesselStores = await repo.getStoresItems(vessel.id, itemType);
    allStores.push(...vesselStores);
  }
  return allStores;
}

// ── Get Stores By Vessel (or all) ──

export async function getStoresByVessel(vesselId: string, itemType?: string, vesselIds?: string[]): Promise<StoresItem[]> {
  if (vesselId === 'all') {
    return getAllStores(itemType, vesselIds);
  }
  return repo.getStoresItems(vesselId, itemType);
}

// ── Transaction History ──

export async function getTransactionHistory(vesselId: string, itemType?: string, vesselIds?: string[]): Promise<StoresLedger[]> {
  if (vesselId === 'all') {
    const allVessels = await repo.getVessels();
    // 'my' scope: narrow the all-vessel aggregate to the caller's assigned mini-fleet.
    const scoped = vesselIds && vesselIds.length > 0
      ? allVessels.filter((v) => vesselIds.includes(v.id))
      : allVessels;
    const history: StoresLedger[] = [];
    for (const v of scoped) {
      const vHistory = await repo.getStoresTransactionHistory(v.id, itemType);
      history.push(...vHistory);
    }
    return history;
  }
  return repo.getStoresTransactionHistory(vesselId, itemType);
}

export async function getItemHistory(itemId: string): Promise<StoresLedger[]> {
  return repo.getStoresItemHistory(itemId);
}

// ── Create Store Item ──

export async function createStoresItem(vesselId: string, body: any, userId: string): Promise<StoresItem> {
  const itemData = { ...body, vesselId };

  if (itemData.manufactureDate && itemData.expiryDate) {
    const mfg = new Date(itemData.manufactureDate);
    const exp = new Date(itemData.expiryDate);
    if (!isNaN(mfg.getTime()) && !isNaN(exp.getTime()) && exp <= mfg) {
      throw Object.assign(new Error("Expiry date must be after manufacture date"), { statusCode: 400 });
    }
  }

  return repo.createStoresItem(itemData, userId);
}

// ── Update Store Item (PUT - strips ROB fields) ──

export async function updateStoresItem(itemId: string, body: any): Promise<StoresItem> {
  // Strip ROB fields - these must go through dedicated methods
  const { rob, robLocationA, robLocationB, ...safeData } = body;

  if (safeData.manufactureDate && safeData.expiryDate) {
    const mfg = new Date(safeData.manufactureDate);
    const exp = new Date(safeData.expiryDate);
    if (!isNaN(mfg.getTime()) && !isNaN(exp.getTime()) && exp <= mfg) {
      throw Object.assign(new Error("Expiry date must be after manufacture date"), { statusCode: 400 });
    }
  }

  return repo.updateStoresItem(itemId, safeData);
}

// ── Adjust Stock ──

export async function adjustStoresItem(
  itemId: string, newRob: number, location: 'A' | 'B', userId: string,
  remarks?: string, place?: string, dateLocal?: string, tz?: string
): Promise<StoresItem> {
  if (newRob === undefined || newRob < 0) {
    throw Object.assign(new Error("Valid newRob value (>= 0) is required"), { statusCode: 400 });
  }
  if (!location || !['A', 'B'].includes(location)) {
    throw Object.assign(new Error("Location must be 'A' or 'B'"), { statusCode: 400 });
  }

  return repo.adjustStoresItem(itemId, Number(newRob), location, userId, remarks, place, dateLocal, tz);
}

// ── Patch Store Item (location ROB transfer or regular update) ──

export async function patchStoresItem(
  itemId: string, body: any, userId: string
): Promise<StoresItem> {
  const { robLocationA, robLocationB, rob, remarks, place, dateLocal, tz } = body;

  // Check if location ROB values are being changed - route to transfer method
  if (robLocationA !== undefined || robLocationB !== undefined) {
    // Validate numeric inputs
    if (robLocationA !== undefined && (isNaN(Number(robLocationA)) || Number(robLocationA) < 0)) {
      throw Object.assign(new Error("robLocationA must be a valid non-negative number"), { statusCode: 400 });
    }
    if (robLocationB !== undefined && (isNaN(Number(robLocationB)) || Number(robLocationB) < 0)) {
      throw Object.assign(new Error("robLocationB must be a valid non-negative number"), { statusCode: 400 });
    }

    // Get current item to determine if this is a location transfer
    const currentItem = await repo.getStoresItem(itemId);
    if (!currentItem) {
      throw Object.assign(new Error("Stores item not found"), { statusCode: 404 });
    }

    const newLocA = robLocationA !== undefined ? String(Number(robLocationA)) : currentItem.robLocationA;
    const newLocB = robLocationB !== undefined ? String(Number(robLocationB)) : currentItem.robLocationB;

    // Use transfer method which creates ledger history for true transfers
    const result = await repo.transferStoresItemLocation(
      itemId, newLocA, newLocB, userId, remarks, place, dateLocal, tz
    );
    return result.item;
  }

  // Direct ROB updates without location specification are not allowed
  if (rob !== undefined) {
    throw Object.assign(
      new Error("Direct ROB updates are not allowed. Use location-specific updates (robLocationA/robLocationB) or consume/receive endpoints."),
      { statusCode: 400 }
    );
  }

  // Handle non-ROB updates (itemName, uom, etc.) through regular update
  // Keep remarks in otherUpdates since it's a valid field for stores items
  const { robLocationA: _a, robLocationB: _b, rob: _r, place: _p, dateLocal: _d, tz: _t, ...otherUpdates } = body;
  if (Object.keys(otherUpdates).length > 0) {
    if (otherUpdates.manufactureDate && otherUpdates.expiryDate) {
      const mfg = new Date(otherUpdates.manufactureDate);
      const exp = new Date(otherUpdates.expiryDate);
      if (!isNaN(mfg.getTime()) && !isNaN(exp.getTime()) && exp <= mfg) {
        throw Object.assign(new Error("Expiry date must be after manufacture date"), { statusCode: 400 });
      }
    }
    return repo.updateStoresItem(itemId, otherUpdates);
  }

  // No valid update fields provided
  throw Object.assign(new Error("No valid update fields provided"), { statusCode: 400 });
}

// ── Delete Store Item (soft delete) ──

export async function deleteStoresItem(itemId: string): Promise<void> {
  return repo.deleteStoresItem(itemId);
}

// ── Inactivate Store Item (soft delete via isActive=false) ──

export async function inactivateStoresItem(itemId: string, vesselId?: string): Promise<void> {
  return repo.inactivateStoresItem(itemId, vesselId);
}

// ── Batch Consume ──

export async function batchConsume(
  items: any[], userId: string
): Promise<StoresItem[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error("Items array is required"), { statusCode: 400 });
  }

  const results: StoresItem[] = [];
  for (const item of items) {
    if (!item.itemId || !item.quantity || item.quantity <= 0) {
      throw Object.assign(
        new Error("Each item must have a valid itemId and positive quantity"),
        { statusCode: 400 }
      );
    }
    const result = await repo.consumeStoresItem(
      item.itemId,
      item.quantity,
      item.location || 'A',
      userId,
      item.notes,
      item.place,
      item.dateLocal,
      item.tz
    );
    results.push(result);
  }
  return results;
}

// ── Batch Receive ──

export async function batchReceive(
  items: any[], purchaseOrderRef: string | undefined, userId: string
): Promise<StoresItem[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error("Items array is required"), { statusCode: 400 });
  }

  const results: StoresItem[] = [];
  for (const item of items) {
    if (!item.itemId || !item.quantity || item.quantity <= 0) {
      throw Object.assign(
        new Error("Each item must have a valid itemId and positive quantity"),
        { statusCode: 400 }
      );
    }
    const result = await repo.receiveStoresItem(
      item.itemId,
      item.quantity,
      item.location || 'A',
      userId,
      item.notes,
      purchaseOrderRef,
      item.place,
      item.dateLocal,
      item.tz
    );
    results.push(result);
  }
  return results;
}
