import { storage } from '../../../storage';
import type { Spare, InsertSpare, SpareHistory } from '@shared/schema';

// ── Spares CRUD ──

export async function getAllSpares(): Promise<Spare[]> {
  return storage.getAllSpares();
}

export async function getSpares(vesselId: string): Promise<Spare[]> {
  return storage.getSpares(vesselId);
}

export async function getSpare(id: number): Promise<Spare | undefined> {
  return storage.getSpare(id);
}

export async function createSpare(spare: InsertSpare): Promise<Spare> {
  return storage.createSpare(spare);
}

export async function updateSpare(id: number, data: Partial<Spare>): Promise<Spare> {
  return storage.updateSpare(id, data);
}

export async function deleteSpare(id: number): Promise<void> {
  return storage.deleteSpare(id);
}

// ── Consume / Receive / Adjust ──

export async function consumeSpare(
  id: number, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string
): Promise<Spare> {
  return storage.consumeSpare(id, quantity, userId, remarks, place, dateLocal, tz);
}

export async function consumeSpareFromLocation(
  id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, workOrderRef?: string, dateLocal?: string
): Promise<{ spare: Spare; deducted: number; requested: number; shortageQty: number }> {
  return storage.consumeSpareFromLocation(id, quantity, location, userId, remarks, workOrderRef, dateLocal);
}

export async function receiveSpare(
  id: number, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string
): Promise<Spare> {
  return storage.receiveSpare(id, quantity, userId, remarks, supplierPO, place, dateLocal, tz);
}

export async function receiveSpareToLocation(
  id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, supplierPO?: string, dateLocal?: string
): Promise<{ spare: Spare; received: number }> {
  return storage.receiveSpareToLocation(id, quantity, location, userId, remarks, supplierPO, dateLocal);
}

export async function adjustSpareQuantity(
  spareId: number, qtyChange: number, eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST', reference?: string, notes?: string
): Promise<Spare> {
  return storage.adjustSpareQuantity(spareId, qtyChange, eventType, reference, notes);
}

export async function adjustSpareAtLocation(
  id: number, newRob: number, location: 'A' | 'B', userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string
): Promise<Spare> {
  return storage.adjustSpareAtLocation(id, newRob, location, userId, remarks, place, dateLocal, tz);
}

export async function transferSpareLocation(
  id: number, newRobLocationA: number, newRobLocationB: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string
): Promise<{ spare: Spare; isTransfer: boolean }> {
  return storage.transferSpareLocation(id, newRobLocationA, newRobLocationB, userId, remarks, place, dateLocal, tz);
}

// ── History ──

export async function getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
  return storage.getSpareHistory(vesselId);
}

// ── Vessels (needed for 'all' queries) ──

export async function getVessels() {
  return storage.getVessels();
}
