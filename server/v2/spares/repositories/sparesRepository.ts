import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import {
  v2Spares, v2SparesHistory, v2Locations, v2SpareLocationStock, v2SpareComponentLinks,
  type Spare, type InsertSpare, type SpareHistory, type InsertSpareHistory,
  type Location, type SpareLocationStock,
} from '@shared/v2/spares/schema';
import { v2Components } from '@shared/v2/components/schema';

export class SparesRepository {

  async getAllSpares(): Promise<Spare[]> {
    const db = await getDb();
    return await db.select().from(v2Spares)
      .where(eq(v2Spares.deleted, false));
  }

  async getSpares(vesselId: string): Promise<Spare[]> {
    const db = await getDb();
    return await db.select().from(v2Spares)
      .where(and(
        eq(v2Spares.vesselId, vesselId),
        eq(v2Spares.dataScope, 'vessel'),
        eq(v2Spares.deleted, false)
      ));
  }

  async getSparesWithInventory(vesselId: string): Promise<Array<{
    spare: Spare;
    robTotal: number;
    stockStatus: 'OK' | 'At Min';
    locations: Array<{ locationId: number; locationName: string; qty: number }>;
    linkedComponents: Array<{ componentId: string; componentCode: string; componentName: string }>;
  }>> {
    const db = await getDb();
    const spares = await this.getSpares(vesselId);

    const allLinks = await db.select().from(v2SpareComponentLinks)
      .where(eq(v2SpareComponentLinks.vesselId, vesselId));

    const allStock = await db.select().from(v2SpareLocationStock)
      .where(eq(v2SpareLocationStock.vesselId, vesselId));

    const allLocations = await db.select().from(v2Locations)
      .where(eq(v2Locations.vesselId, vesselId));

    const componentIdsSet = new Set(allLinks.map(l => l.componentId));
    const componentIds = Array.from(componentIdsSet);
    const componentsMap = new Map<string, { id: string; componentCode: string | null; name: string | null }>();
    if (componentIds.length > 0) {
      const components = await db.select({
        id: v2Components.id,
        componentCode: v2Components.componentCode,
        name: v2Components.name,
      }).from(v2Components)
        .where(sql`${v2Components.id} IN ${componentIds}`);
      for (const c of components) {
        componentsMap.set(c.id, c);
      }
    }

    const locationsMap = new Map(allLocations.map(l => [l.id, l]));
    const linksBySpare = new Map<number, typeof allLinks>();
    for (const link of allLinks) {
      const existing = linksBySpare.get(link.spareId) || [];
      existing.push(link);
      linksBySpare.set(link.spareId, existing);
    }
    const stockBySpare = new Map<number, typeof allStock>();
    for (const stock of allStock) {
      const existing = stockBySpare.get(stock.spareId) || [];
      existing.push(stock);
      stockBySpare.set(stock.spareId, existing);
    }

    return spares.map(spare => {
      const robTotal = (spare.robLocationA ?? 0) + (spare.robLocationB ?? 0);
      const stockStatus: 'OK' | 'At Min' = (spare.rob ?? 0) <= (spare.min ?? 0) ? 'At Min' : 'OK';

      const spareStock = stockBySpare.get(spare.id) || [];
      const locations = spareStock.map(s => {
        const loc = locationsMap.get(s.locationId);
        return {
          locationId: s.locationId,
          locationName: loc?.locationName || `Location ${s.locationId}`,
          qty: s.qty,
        };
      });

      const spareLinks = linksBySpare.get(spare.id) || [];
      const linkedComponents = spareLinks.map(link => {
        const comp = componentsMap.get(link.componentId);
        return {
          componentId: link.componentId,
          componentCode: comp?.componentCode || '',
          componentName: comp?.name || '',
        };
      });

      return { spare, robTotal, stockStatus, locations, linkedComponents };
    });
  }

  async getSpare(id: number): Promise<Spare | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2Spares).where(eq(v2Spares.id, id));
    return result[0];
  }

  async createSpare(spare: InsertSpare): Promise<Spare> {
    const db = await getDb();
    const robA = spare.robLocationA ?? 0;
    const robB = spare.robLocationB ?? 0;
    const result = await db.insert(v2Spares).values({
      ...spare,
      dataScope: spare.dataScope || 'vessel',
      rob: spare.rob ?? 0,
      robLocationA: robA,
      robLocationB: robB,
      min: spare.min ?? 0,
    }).returning();

    const createdSpare = result[0];

    if (createdSpare.vesselId) {
      const vesselId = createdSpare.vesselId;
      const locationAName = createdSpare.location || 'Location A';
      const locationBName = createdSpare.location2 || 'Location B';
      const userId = spare.createdBy || 'System';

      try {
        const locationAObj = await this.findOrCreateLocation(vesselId, locationAName, userId);
        const locationBObj = await this.findOrCreateLocation(vesselId, locationBName, userId);
        await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, locationId: locationAObj.id, qty: robA });
        await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, locationId: locationBObj.id, qty: robB });
      } catch (syncError: any) {
        console.warn(`[createSpare] Failed to sync spare_location_stock for new spare ${createdSpare.id}: ${syncError.message}`);
      }
    }

    return createdSpare;
  }

  async updateSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    const db = await getDb();
    const { partCode, ...restData } = data;
    const updateData = partCode != null ? { ...restData, partCode, updatedAt: new Date() } : { ...restData, updatedAt: new Date() };

    const result = await db.update(v2Spares)
      .set(updateData)
      .where(eq(v2Spares.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Spare ${id} not found`);
    }

    const updatedSpare = result[0];

    const robChanged = data.robLocationA !== undefined || data.robLocationB !== undefined;
    const locationChanged = data.location !== undefined || data.location2 !== undefined;
    if ((robChanged || locationChanged) && updatedSpare.vesselId) {
      const vesselId = updatedSpare.vesselId;
      const locationAName = updatedSpare.location || 'Location A';
      const locationBName = updatedSpare.location2 || 'Location B';
      const robA = updatedSpare.robLocationA ?? 0;
      const robB = updatedSpare.robLocationB ?? 0;
      const userId = (data as any).updatedBy || 'System';

      try {
        const locationAObj = await this.findOrCreateLocation(vesselId, locationAName, userId);
        const locationBObj = await this.findOrCreateLocation(vesselId, locationBName, userId);
        await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationAObj.id, qty: robA });
        await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationBObj.id, qty: robB });
      } catch (syncError: any) {
        console.warn(`[updateSpare] Failed to sync spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }

    return updatedSpare;
  }

  async deleteSpare(id: number): Promise<void> {
    const db = await getDb();
    await db.update(v2Spares)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(v2Spares.id, id));
  }

  async consumeSpare(
    id: number,
    quantity: number,
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }

    const newRob = (spare.rob ?? 0) - quantity;
    const newRobA = (spare.robLocationA ?? 0) - quantity;

    const updated = await db.update(v2Spares)
      .set({
        rob: newRob,
        robLocationA: newRobA < 0 ? 0 : newRobA,
        updatedAt: new Date()
      })
      .where(eq(v2Spares.id, id))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'CONSUME',
      qtyChange: -quantity,
      robAfter: newRob,
      userId,
      remarks: remarks ?? null,
      reference: null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });

    const vesselId = spare.vesselId || 'V001';
    const locationAName = spare.location || 'Location A';
    try {
      const locationA = await this.findOrCreateLocation(vesselId, locationAName, userId);
      await this.upsertSpareLocationStock({
        vesselId,
        spareId: id,
        locationId: locationA.id,
        qty: newRobA < 0 ? 0 : newRobA,
      });
    } catch (syncError: any) {
      console.warn(`[consumeSpare] Failed to sync spare_location_stock for spare ${id}: ${syncError.message}`);
    }

    return updated[0];
  }

  async consumeSpareFromLocation(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    workOrderRef?: string,
    dateLocal?: string
  ): Promise<{ spare: Spare; deducted: number; requested: number; shortageQty: number }> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }

    const currentRobA = spare.robLocationA ?? 0;
    const currentRobB = spare.robLocationB ?? 0;
    const currentRob = spare.rob ?? 0;

    const availableInLocation = location === 'A' ? currentRobA : currentRobB;
    const deducted = Math.min(quantity, availableInLocation);
    const shortageQty = Math.max(0, quantity - availableInLocation);

    let newRobA = currentRobA;
    let newRobB = currentRobB;

    if (location === 'A') {
      newRobA = Math.max(0, currentRobA - deducted);
    } else {
      newRobB = Math.max(0, currentRobB - deducted);
    }

    const newRob = Math.max(0, currentRob - deducted);

    const updated = await db.update(v2Spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        robLocationB: newRobB,
        updatedAt: new Date()
      })
      .where(eq(v2Spares.id, id))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'CONSUME',
      qtyChange: -deducted,
      robAfter: newRob,
      userId,
      remarks: remarks ? `${remarks} (Location ${location})${workOrderRef ? ` WO: ${workOrderRef}` : ''}` : `Location ${location}`,
      reference: workOrderRef ?? null,
      dateLocal: dateLocal ?? null,
      tz: null,
      place: null,
    });

    const vesselId = spare.vesselId || 'V001';
    const locationAName = spare.location || 'Location A';
    const locationBName = spare.location2 || 'Location B';
    try {
      const locationAObj = await this.findOrCreateLocation(vesselId, locationAName, userId);
      const locationBObj = await this.findOrCreateLocation(vesselId, locationBName, userId);
      await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationAObj.id, qty: newRobA });
      await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationBObj.id, qty: newRobB });
    } catch (syncError: any) {
      console.warn(`[consumeSpareFromLocation] Failed to sync spare_location_stock for spare ${id}: ${syncError.message}`);
    }

    return {
      spare: updated[0],
      deducted,
      requested: quantity,
      shortageQty,
    };
  }

  async receiveSpareToLocation(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    supplierPO?: string,
    dateLocal?: string
  ): Promise<{ spare: Spare; received: number }> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }

    const currentRobA = spare.robLocationA ?? 0;
    const currentRobB = spare.robLocationB ?? 0;
    const currentRob = spare.rob ?? 0;

    let newRobA = currentRobA;
    let newRobB = currentRobB;

    if (location === 'A') {
      newRobA = currentRobA + quantity;
    } else {
      newRobB = currentRobB + quantity;
    }

    const newRob = currentRob + quantity;

    const updated = await db.update(v2Spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        robLocationB: newRobB,
        lastOrderDate: dateLocal ?? null,
        updatedAt: new Date()
      })
      .where(eq(v2Spares.id, id))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'RECEIVE',
      qtyChange: quantity,
      robAfter: newRob,
      userId,
      remarks: remarks ? `${remarks} (Location ${location})${supplierPO ? ` PO: ${supplierPO}` : ''}` : `Location ${location}`,
      reference: supplierPO ?? null,
      dateLocal: dateLocal ?? null,
      tz: null,
      place: null,
    });

    const vesselId = spare.vesselId || 'V001';
    const locationAName = spare.location || 'Location A';
    const locationBName = spare.location2 || 'Location B';
    try {
      const locationAObj = await this.findOrCreateLocation(vesselId, locationAName, userId);
      const locationBObj = await this.findOrCreateLocation(vesselId, locationBName, userId);
      await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationAObj.id, qty: newRobA });
      await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationBObj.id, qty: newRobB });
    } catch (syncError: any) {
      console.warn(`[receiveSpareToLocation] Failed to sync spare_location_stock for spare ${id}: ${syncError.message}`);
    }

    return {
      spare: updated[0],
      received: quantity,
    };
  }

  async adjustSpareAtLocation(
    id: number,
    newRob: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }

    if (isNaN(newRob) || newRob < 0) {
      throw new Error('newRob must be a valid non-negative number');
    }

    const oldLocA = spare.robLocationA ?? 0;
    const oldLocB = spare.robLocationB ?? 0;
    const oldTotal = oldLocA + oldLocB;

    let newLocA = oldLocA;
    let newLocB = oldLocB;

    if (location === 'A') {
      newLocA = newRob;
    } else {
      newLocB = newRob;
    }

    const newTotal = newLocA + newLocB;
    const netChange = newTotal - oldTotal;

    if (netChange === 0) {
      return spare;
    }

    const updated = await db.update(v2Spares)
      .set({
        rob: newTotal,
        robLocationA: newLocA,
        robLocationB: newLocB,
        updatedAt: new Date()
      })
      .where(eq(v2Spares.id, id))
      .returning();

    const adjustmentRemarks = remarks || `Adjustment at Location ${location}: ${location === 'A' ? oldLocA : oldLocB}→${newRob}`;

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'ADJUST',
      qtyChange: netChange,
      robAfter: newTotal,
      userId,
      remarks: adjustmentRemarks,
      reference: null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });

    const vesselId = spare.vesselId || 'V001';
    const locationAName = spare.location || 'Location A';
    const locationBName = spare.location2 || 'Location B';
    try {
      const locationAObj = await this.findOrCreateLocation(vesselId, locationAName, userId);
      const locationBObj = await this.findOrCreateLocation(vesselId, locationBName, userId);
      await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationAObj.id, qty: newLocA });
      await this.upsertSpareLocationStock({ vesselId, spareId: id, locationId: locationBObj.id, qty: newLocB });
    } catch (syncError: any) {
      console.warn(`[adjustSpareAtLocation] Failed to sync spare_location_stock for spare ${id}: ${syncError.message}`);
    }

    return updated[0];
  }

  async adjustSpareQuantity(
    spareId: number,
    qtyChange: number,
    eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST',
    reference?: string,
    notes?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(spareId);
    if (!spare) {
      throw new Error(`Spare ${spareId} not found`);
    }

    const currentRob = spare.rob ?? 0;
    const currentRobA = spare.robLocationA ?? 0;

    const newRob = Math.max(0, currentRob + qtyChange);
    const newRobA = Math.max(0, currentRobA + qtyChange);

    const updated = await db.update(v2Spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        updatedAt: new Date()
      })
      .where(eq(v2Spares.id, spareId))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType,
      qtyChange,
      robAfter: newRob,
      userId: 'system',
      remarks: notes ?? null,
      reference: reference ?? null,
      dateLocal: null,
      tz: null,
      place: null,
    });

    return updated[0];
  }

  async transferSpareLocation(
    id: number,
    newRobLocationA: number,
    newRobLocationB: number,
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<{ spare: Spare; isTransfer: boolean }> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }

    const oldLocA = spare.robLocationA ?? 0;
    const oldLocB = spare.robLocationB ?? 0;
    const newLocA = Number(newRobLocationA) || 0;
    const newLocB = Number(newRobLocationB) || 0;

    if (isNaN(newLocA) || newLocA < 0) {
      throw new Error('robLocationA must be a valid non-negative number');
    }
    if (isNaN(newLocB) || newLocB < 0) {
      throw new Error('robLocationB must be a valid non-negative number');
    }

    const deltaA = newLocA - oldLocA;
    const deltaB = newLocB - oldLocB;

    if (deltaA === 0 && deltaB === 0) {
      return { spare, isTransfer: false };
    }

    const newTotalRob = newLocA + newLocB;

    const updated = await db.update(v2Spares)
      .set({
        rob: newTotalRob,
        robLocationA: newLocA,
        robLocationB: newLocB,
        updatedAt: new Date()
      })
      .where(eq(v2Spares.id, id))
      .returning();

    const vesselId = spare.vesselId || 'V001';
    const locationAName = spare.location || 'Location A';
    const locationBName = spare.location2 || 'Location B';

    try {
      const locationA = await this.findOrCreateLocation(vesselId, locationAName, userId);
      const locationB = await this.findOrCreateLocation(vesselId, locationBName, userId);

      await this.upsertSpareLocationStock({
        vesselId,
        spareId: id,
        locationId: locationA.id,
        qty: newLocA,
      });

      await this.upsertSpareLocationStock({
        vesselId,
        spareId: id,
        locationId: locationB.id,
        qty: newLocB,
      });

      console.log(`[transferSpareLocation] Synced spare_location_stock for spare ${id}: ` +
        `${locationAName}=${newLocA}, ${locationBName}=${newLocB}`);
    } catch (syncError: any) {
      console.warn(`[transferSpareLocation] Failed to sync spare_location_stock for spare ${id}: ${syncError.message}`);
    }

    const oldTotalRob = oldLocA + oldLocB;
    const isTrueTransfer = deltaA !== 0 && deltaB !== 0 && newTotalRob === oldTotalRob;

    if (isTrueTransfer) {
      const transferQty = Math.abs(deltaA);
      const fromLocation = deltaA < 0 ? 'A' : 'B';
      const toLocation = deltaA < 0 ? 'B' : 'A';
      const transferRemarks = remarks || `Transfer ${transferQty} from Location ${fromLocation} to Location ${toLocation}`;

      await this.createSpareHistory({
        timestampUTC: new Date(),
        vesselId: spare.vesselId || 'V001',
        spareId: spare.id,
        partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
        partName: spare.partName,
        componentId: spare.componentId || '',
        componentCode: spare.componentCode ?? null,
        componentName: spare.componentName,
        componentSpareCode: spare.componentSpareCode ?? null,
        eventType: 'TRANSFER',
        qtyChange: 0,
        robAfter: newTotalRob,
        userId,
        remarks: transferRemarks,
        reference: null,
        dateLocal: dateLocal ?? null,
        tz: tz ?? null,
        place: place ?? null,
      });

      return { spare: updated[0], isTransfer: true };
    }

    const netChange = (newLocA + newLocB) - (oldLocA + oldLocB);
    const adjustmentRemarks = remarks || (netChange >= 0
      ? `Adjustment: +${netChange} (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`
      : `Adjustment: ${netChange} (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`);

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'ADJUSTMENT',
      qtyChange: netChange,
      robAfter: newTotalRob,
      userId,
      remarks: adjustmentRemarks,
      reference: null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });

    return { spare: updated[0], isTransfer: false };
  }

  async receiveSpare(
    id: number,
    quantity: number,
    userId: string,
    remarks?: string,
    supplierPO?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }

    const newRob = (spare.rob ?? 0) + quantity;
    const newRobA = (spare.robLocationA ?? 0) + quantity;

    const updated = await db.update(v2Spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        lastOrderDate: dateLocal ?? null,
        updatedAt: new Date()
      })
      .where(eq(v2Spares.id, id))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'RECEIVE',
      qtyChange: quantity,
      robAfter: newRob,
      userId,
      remarks: remarks ?? null,
      reference: supplierPO ?? null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });

    return updated[0];
  }

  async bulkUpdate(
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
    const results: Array<{
      componentSpareId: number;
      success: boolean;
      message?: string;
      robAfter?: number;
    }> = [];

    for (const row of rows) {
      const {
        componentSpareId,
        consumedA = 0,
        consumedB = 0,
        receivedA = 0,
        receivedB = 0,
        receivedDate,
        receivedPlace,
        dateLocal,
        remarks,
        userId: rowUserId = 'system'
      } = row;

      const transactionDate = (receivedDate && receivedDate.trim())
        ? receivedDate.trim()
        : ((dateLocal && dateLocal.trim()) ? dateLocal.trim() : undefined);

      try {
        const errors: string[] = [];

        if (consumedA > 0) {
          try {
            await this.consumeSpareFromLocation(
              componentSpareId, consumedA, 'A', rowUserId, remarks, undefined, transactionDate
            );
          } catch (e: any) {
            errors.push(`Consume A: ${e.message}`);
          }
        }

        if (consumedB > 0) {
          try {
            await this.consumeSpareFromLocation(
              componentSpareId, consumedB, 'B', rowUserId, remarks, undefined, transactionDate
            );
          } catch (e: any) {
            errors.push(`Consume B: ${e.message}`);
          }
        }

        if (receivedA > 0) {
          try {
            await this.receiveSpareToLocation(
              componentSpareId, receivedA, 'A', rowUserId, remarks, receivedPlace, transactionDate
            );
          } catch (e: any) {
            errors.push(`Receive A: ${e.message}`);
          }
        }

        if (receivedB > 0) {
          try {
            await this.receiveSpareToLocation(
              componentSpareId, receivedB, 'B', rowUserId, remarks, receivedPlace, transactionDate
            );
          } catch (e: any) {
            errors.push(`Receive B: ${e.message}`);
          }
        }

        const spare = await this.getSpare(componentSpareId);

        if (errors.length > 0) {
          results.push({
            componentSpareId,
            success: false,
            message: errors.join('; '),
            robAfter: spare?.rob ?? undefined,
          });
        } else {
          results.push({
            componentSpareId,
            success: true,
            robAfter: spare?.rob ?? undefined,
          });
        }
      } catch (error: any) {
        results.push({
          componentSpareId,
          success: false,
          message: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  async getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
    const db = await getDb();
    return await db.select().from(v2SparesHistory)
      .where(eq(v2SparesHistory.vesselId, vesselId))
      .orderBy(desc(v2SparesHistory.timestampUTC));
  }

  async getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]> {
    const db = await getDb();
    return await db.select().from(v2SparesHistory)
      .where(eq(v2SparesHistory.spareId, spareId))
      .orderBy(desc(v2SparesHistory.timestampUTC));
  }

  async createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory> {
    const db = await getDb();
    const result = await db.insert(v2SparesHistory).values(history).returning();
    return result[0];
  }

  async getLowStockSpares(vesselId: string): Promise<Spare[]> {
    const db = await getDb();
    return await db.select().from(v2Spares)
      .where(and(
        eq(v2Spares.vesselId, vesselId),
        eq(v2Spares.deleted, false),
        sql`COALESCE(${v2Spares.rob}, 0) <= COALESCE(${v2Spares.min}, 0)`
      ));
  }

  async batchConsume(
    vesselId: string,
    items: Array<{ spareId: number; quantity: number; location?: 'A' | 'B' }>,
    workOrderId?: string,
    consumedBy?: string
  ): Promise<Spare[]> {
    const results: Spare[] = [];
    const userId = consumedBy || 'system';

    for (const item of items) {
      const location = item.location || 'A';
      const result = await this.consumeSpareFromLocation(
        item.spareId, item.quantity, location, userId, undefined, workOrderId
      );
      results.push(result.spare);
    }

    return results;
  }

  async batchReceive(
    vesselId: string,
    items: Array<{ spareId: number; quantity: number; location?: 'A' | 'B' }>,
    purchaseOrderRef?: string,
    receivedBy?: string
  ): Promise<Spare[]> {
    const results: Spare[] = [];
    const userId = receivedBy || 'system';

    for (const item of items) {
      const location = item.location || 'A';
      const result = await this.receiveSpareToLocation(
        item.spareId, item.quantity, location, userId, undefined, purchaseOrderRef
      );
      results.push(result.spare);
    }

    return results;
  }

  private async findOrCreateLocation(vesselId: string, locationName: string, createdBy: string): Promise<Location> {
    const db = await getDb();
    const normalizedName = locationName.trim().toUpperCase();
    const result = await db.select().from(v2Locations)
      .where(and(
        eq(v2Locations.vesselId, vesselId),
        sql`UPPER(TRIM(${v2Locations.locationName})) = ${normalizedName}`
      ));

    if (result[0]) {
      return result[0];
    }

    const inserted = await db.insert(v2Locations).values({
      vesselId,
      locationName: locationName.trim(),
      createdBy,
    }).returning();
    return inserted[0];
  }

  private async upsertSpareLocationStock(data: {
    vesselId: string;
    spareId: number;
    locationId: number;
    qty: number;
  }): Promise<SpareLocationStock> {
    const db = await getDb();
    const existing = await db.select().from(v2SpareLocationStock)
      .where(and(
        eq(v2SpareLocationStock.spareId, data.spareId),
        eq(v2SpareLocationStock.locationId, data.locationId)
      ));

    if (existing[0]) {
      const result = await db.update(v2SpareLocationStock)
        .set({ qty: data.qty })
        .where(eq(v2SpareLocationStock.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(v2SpareLocationStock).values({
        vesselId: data.vesselId,
        spareId: data.spareId,
        locationId: data.locationId,
        qty: data.qty,
      }).returning();
      return result[0];
    }
  }
}
