import { SparesRepository } from '../repositories/sparesRepository';
import type { InsertSpare, Spare, SpareHistory, InsertSpareHistory } from '@shared/v2/spares/schema';

const repo = new SparesRepository();

export async function getAllSpares(): Promise<Spare[]> {
  return repo.getAllSpares();
}

export async function getSpares(vesselId: string): Promise<Spare[]> {
  return repo.getSpares(vesselId);
}

export async function getSparesWithInventory(vesselId: string) {
  return repo.getSparesWithInventory(vesselId);
}

export async function getSpare(suuid: string): Promise<Spare | undefined> {
  return repo.getSpare(suuid);
}

export async function createSpare(data: InsertSpare): Promise<Spare> {
  return repo.createSpare(data);
}

export async function updateSpare(suuid: string, data: Partial<Spare>): Promise<Spare> {
  return repo.updateSpare(suuid, data);
}

export async function deleteSpare(suuid: string): Promise<void> {
  return repo.deleteSpare(suuid);
}

export async function consumeSpare(
  suuid: string,
  quantity: number,
  userId: string,
  remarks?: string,
  place?: string,
  dateLocal?: string,
  tz?: string
): Promise<Spare> {
  return repo.consumeSpare(suuid, quantity, userId, remarks, place, dateLocal, tz);
}

export async function consumeSpareFromLocation(
  suuid: string,
  quantity: number,
  location: 'A' | 'B',
  userId: string,
  remarks?: string,
  workOrderRef?: string,
  dateLocal?: string
) {
  return repo.consumeSpareFromLocation(suuid, quantity, location, userId, remarks, workOrderRef, dateLocal);
}

export async function receiveSpareToLocation(
  suuid: string,
  quantity: number,
  location: 'A' | 'B',
  userId: string,
  remarks?: string,
  supplierPO?: string,
  dateLocal?: string
) {
  return repo.receiveSpareToLocation(suuid, quantity, location, userId, remarks, supplierPO, dateLocal);
}

export async function receiveSpare(
  suuid: string,
  quantity: number,
  userId: string,
  remarks?: string,
  supplierPO?: string,
  place?: string,
  dateLocal?: string,
  tz?: string
): Promise<Spare> {
  return repo.receiveSpare(suuid, quantity, userId, remarks, supplierPO, place, dateLocal, tz);
}

export async function adjustSpareAtLocation(
  suuid: string,
  newRob: number,
  location: 'A' | 'B',
  userId: string,
  remarks?: string,
  place?: string,
  dateLocal?: string,
  tz?: string
): Promise<Spare> {
  return repo.adjustSpareAtLocation(suuid, newRob, location, userId, remarks, place, dateLocal, tz);
}

export async function adjustSpareQuantity(
  suuid: string,
  qtyChange: number,
  eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST',
  reference?: string,
  notes?: string
): Promise<Spare> {
  return repo.adjustSpareQuantity(suuid, qtyChange, eventType, reference, notes);
}

export async function transferSpareLocation(
  suuid: string,
  newRobA: number,
  newRobB: number,
  userId: string,
  remarks?: string,
  place?: string,
  dateLocal?: string,
  tz?: string
) {
  return repo.transferSpareLocation(suuid, newRobA, newRobB, userId, remarks, place, dateLocal, tz);
}

export async function bulkUpdate(
  vesselId: string,
  rows: Array<{
    componentSpareId: number;
    consumedA?: number;
    consumedB?: number;
    receivedA?: number;
    receivedB?: number;
    receivedDate?: string;
    receivedPlace?: string;
    dateLocal?: string;
    remarks?: string;
    userId?: string;
  }>
): Promise<Array<{
  componentSpareId: number;
  success: boolean;
  message?: string;
  robAfter?: number;
}>> {
  return repo.bulkUpdate(vesselId, rows);
}

export async function getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
  return repo.getSpareHistory(vesselId);
}

export async function getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]> {
  return repo.getSpareHistoryBySpareId(spareId);
}

export async function createSpareHistory(data: InsertSpareHistory): Promise<SpareHistory> {
  return repo.createSpareHistory(data);
}

export async function getLowStockSpares(vesselId: string): Promise<Spare[]> {
  return repo.getLowStockSpares(vesselId);
}

export async function batchConsume(
  vesselId: string,
  items: Array<{ spareUuid: string; quantity: number; location?: 'A' | 'B' }>,
  workOrderId?: string,
  consumedBy?: string
): Promise<Spare[]> {
  return repo.batchConsume(vesselId, items, workOrderId, consumedBy);
}

export async function batchReceive(
  vesselId: string,
  items: Array<{ spareUuid: string; quantity: number; location?: 'A' | 'B' }>,
  purchaseOrderRef?: string,
  receivedBy?: string
): Promise<Spare[]> {
  return repo.batchReceive(vesselId, items, purchaseOrderRef, receivedBy);
}
