import * as repo from '../repositories/bunkerRepository';
import { adjustRobForBunker } from './calculationEngine';
import type { InsertNrBunkerRecord, NrBunkerRecord } from '@shared/schema';

// ── Total cost helper ─────────────────────────────────────────────────────────

function computeTotalCost(
  quantityMt: string | null | undefined,
  pricePmt: string | null | undefined,
): string | null {
  const qty = Number(quantityMt);
  const price = Number(pricePmt);
  if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
    return String(qty * price);
  }
  return null;
}

// ── Public CRUD ───────────────────────────────────────────────────────────────

export async function getBunkerRecords(vesselId: string, voyageNo?: string): Promise<NrBunkerRecord[]> {
  return repo.getBunkerRecords({ vesselId, voyageNo });
}

export async function getBunkerRecord(id: number): Promise<NrBunkerRecord | null> {
  return repo.getBunkerRecordById(id);
}

export async function createBunkerRecord(data: InsertNrBunkerRecord): Promise<NrBunkerRecord> {
  const totalCost = computeTotalCost(data.quantityMt, data.pricePmt);
  const record = await repo.createBunkerRecord({ ...data, totalCost: totalCost ?? undefined });

  // Increment ROB for the bunkered fuel type
  const qty = Number(data.quantityMt) || 0;
  if (qty > 0) {
    await adjustRobForBunker(data.vesselId, data.fuelType, qty);
  }

  return record;
}

export async function updateBunkerRecord(
  id: number,
  data: Partial<InsertNrBunkerRecord>,
): Promise<NrBunkerRecord> {
  const existing = await repo.getBunkerRecordById(id);
  if (!existing) throw new Error('Bunker record not found');

  const newQuantityMt = data.quantityMt ?? existing.quantityMt;
  const newPricePmt   = data.pricePmt   ?? existing.pricePmt;
  const newFuelType   = data.fuelType   ?? existing.fuelType;
  const newVesselId   = data.vesselId   ?? existing.vesselId;

  const totalCost = computeTotalCost(newQuantityMt, newPricePmt);

  const updated = await repo.updateBunkerRecord(id, {
    ...data,
    totalCost: totalCost ?? undefined,
  });
  if (!updated) throw new Error('Bunker record not found after update');

  // ROB adjustment — handle fuel-type or vessel changes atomically:
  // 1. Reverse the old quantity from the old fuel/vessel
  // 2. Apply the new quantity to the new fuel/vessel
  const oldQty      = Number(existing.quantityMt) || 0;
  const newQty      = Number(newQuantityMt) || 0;
  const sameContext = newFuelType === existing.fuelType && newVesselId === existing.vesselId;

  if (sameContext) {
    // Same fuel + vessel — apply delta only
    const delta = newQty - oldQty;
    if (delta !== 0) {
      await adjustRobForBunker(existing.vesselId, existing.fuelType, delta);
    }
  } else {
    // Fuel type or vessel changed — reverse old, apply new separately
    if (oldQty > 0) {
      await adjustRobForBunker(existing.vesselId, existing.fuelType, -oldQty);
    }
    if (newQty > 0) {
      await adjustRobForBunker(newVesselId, newFuelType, newQty);
    }
  }

  return updated;
}

export async function deleteBunkerRecord(id: number): Promise<void> {
  const existing = await repo.getBunkerRecordById(id);
  if (!existing) throw new Error('Bunker record not found');

  await repo.deleteBunkerRecord(id);

  // Decrement ROB by the deleted quantity
  const qty = Number(existing.quantityMt) || 0;
  if (qty > 0) {
    await adjustRobForBunker(existing.vesselId, existing.fuelType, -qty);
  }
}

export async function getBunkerCostSummary(vesselId: string, voyageNo?: string) {
  return repo.getBunkerCostSummary(vesselId, voyageNo);
}
