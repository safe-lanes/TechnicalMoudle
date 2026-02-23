import { storage } from '../../../storage';
import type { StoresItem, InsertStoresItem, StoresLedger } from '@shared/schema';

// ── Stores Items ──

export async function getStoresItems(vesselId: string, itemType?: string): Promise<StoresItem[]> {
  return storage.getStoresItems(vesselId, itemType);
}

export async function getStoresItem(id: string): Promise<StoresItem | undefined> {
  return storage.getStoresItem(id);
}

export async function createStoresItem(item: InsertStoresItem, userId?: string): Promise<StoresItem> {
  return storage.createStoresItem(item, userId);
}

export async function updateStoresItem(id: string, data: Partial<StoresItem>): Promise<StoresItem> {
  return storage.updateStoresItem(id, data);
}

export async function deleteStoresItem(id: string): Promise<void> {
  return storage.deleteStoresItem(id);
}

// ── Stock Operations ──

export async function consumeStoresItem(
  id: string, quantity: number, location: 'A' | 'B', userId: string,
  remarks?: string, place?: string, dateLocal?: string, tz?: string
): Promise<StoresItem> {
  return storage.consumeStoresItem(id, quantity, location, userId, remarks, place, dateLocal, tz);
}

export async function receiveStoresItem(
  id: string, quantity: number, location: 'A' | 'B', userId: string,
  remarks?: string, ref?: string, place?: string, dateLocal?: string, tz?: string
): Promise<StoresItem> {
  return storage.receiveStoresItem(id, quantity, location, userId, remarks, ref, place, dateLocal, tz);
}

export async function transferStoresItemLocation(
  id: string, newRobLocationA: string, newRobLocationB: string, userId: string,
  remarks?: string, place?: string, dateLocal?: string, tz?: string
): Promise<{ item: StoresItem; isTransfer: boolean }> {
  return storage.transferStoresItemLocation(id, newRobLocationA, newRobLocationB, userId, remarks, place, dateLocal, tz);
}

export async function adjustStoresItem(
  id: string, newRob: number, location: 'A' | 'B', userId: string,
  remarks?: string, place?: string, dateLocal?: string, tz?: string
): Promise<StoresItem> {
  return storage.adjustStoresItem(id, newRob, location, userId, remarks, place, dateLocal, tz);
}

// ── Transaction History ──

export async function getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<StoresLedger[]> {
  return storage.getStoresTransactionHistory(vesselId, itemType);
}

export async function getStoresItemHistory(itemId: string): Promise<StoresLedger[]> {
  return storage.getStoresItemHistory(itemId);
}

// ── Vessels (for all-vessel aggregation) ──

export async function getVessels() {
  return storage.getVessels();
}
