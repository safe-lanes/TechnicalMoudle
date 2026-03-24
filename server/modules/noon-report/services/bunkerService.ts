import * as repo from '../repositories/bunkerRepository';
import { nrFuelRob } from '@shared/schema';
import type { InsertNrBunkerRecord, NrBunkerRecord } from '@shared/schema';
import { db } from '../../../db';
import { eq, and } from 'drizzle-orm';

// ── ROB adjustment helpers ────────────────────────────────────────────────────

async function adjustRob(vesselId: string, fuelType: string, deltaMt: number): Promise<void> {
  const rows = await db.select()
    .from(nrFuelRob)
    .where(and(eq(nrFuelRob.vesselId, vesselId), eq(nrFuelRob.fuelType, fuelType)))
    .limit(1);

  if (rows.length === 0) {
    // No ROB row yet — create one with the bunkered quantity (floored to 0)
    const newRob = Math.max(0, deltaMt);
    await db.insert(nrFuelRob).values({
      vesselId,
      fuelType,
      currentRob: String(newRob),
      lastUpdated: new Date(),
    });
  } else {
    const current = Number(rows[0].currentRob) || 0;
    const updated = Math.max(0, current + deltaMt);
    await db.update(nrFuelRob)
      .set({ currentRob: String(updated), lastUpdated: new Date() })
      .where(and(eq(nrFuelRob.vesselId, vesselId), eq(nrFuelRob.fuelType, fuelType)));
  }
}

// ── Total cost helper ─────────────────────────────────────────────────────────

function computeTotalCost(quantityMt: string | null | undefined, pricePmt: string | null | undefined): string | null {
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

  // Increment ROB by bunkered quantity
  const qty = Number(data.quantityMt) || 0;
  if (qty > 0) {
    await adjustRob(data.vesselId, data.fuelType, qty);
  }

  return record;
}

export async function updateBunkerRecord(
  id: number,
  data: Partial<InsertNrBunkerRecord>,
): Promise<NrBunkerRecord> {
  const existing = await repo.getBunkerRecordById(id);
  if (!existing) throw new Error('Bunker record not found');

  const totalCost = computeTotalCost(
    data.quantityMt ?? existing.quantityMt,
    data.pricePmt ?? existing.pricePmt,
  );

  const updated = await repo.updateBunkerRecord(id, { ...data, totalCost: totalCost ?? undefined });
  if (!updated) throw new Error('Bunker record not found after update');

  // Adjust ROB by the quantity difference
  const oldQty = Number(existing.quantityMt) || 0;
  const newQty = Number(data.quantityMt ?? existing.quantityMt) || 0;
  const delta = newQty - oldQty;
  if (delta !== 0) {
    await adjustRob(existing.vesselId, existing.fuelType, delta);
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
    await adjustRob(existing.vesselId, existing.fuelType, -qty);
  }
}

export async function getBunkerCostSummary(vesselId: string, voyageNo?: string) {
  return repo.getBunkerCostSummary(vesselId, voyageNo);
}
