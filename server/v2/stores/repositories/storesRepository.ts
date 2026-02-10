import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  v2StoresItems,
  v2StoresLedger,
  type V2StoresItem,
  type V2InsertStoresItem,
  type V2StoresLedger,
} from "@shared/v2/stores/schema";

export class StoresRepository {
  async getStoresItems(vesselId: string, itemType?: string): Promise<V2StoresItem[]> {
    const db = await getDb();
    if (itemType) {
      return await db.select().from(v2StoresItems)
        .where(and(
          eq(v2StoresItems.vesselId, vesselId),
          eq(v2StoresItems.itemType, itemType),
          eq(v2StoresItems.deleted, false)
        ));
    }
    return await db.select().from(v2StoresItems)
      .where(and(
        eq(v2StoresItems.vesselId, vesselId),
        eq(v2StoresItems.deleted, false)
      ));
  }

  async getStoresItem(id: number): Promise<V2StoresItem | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2StoresItems).where(eq(v2StoresItems.id, id));
    return result[0];
  }

  async createStoresItem(item: V2InsertStoresItem, userId?: string): Promise<V2StoresItem> {
    const db = await getDb();
    const robLocationA = Number(item.robLocationA || 0);
    const robLocationB = Number(item.robLocationB || 0);

    if (isNaN(robLocationA) || robLocationA < 0) {
      throw new Error('robLocationA must be a valid non-negative number');
    }
    if (isNaN(robLocationB) || robLocationB < 0) {
      throw new Error('robLocationB must be a valid non-negative number');
    }

    const totalRob = robLocationA + robLocationB;

    const result = await db.insert(v2StoresItems).values({
      ...item,
      rob: String(totalRob),
      robLocationA: String(robLocationA),
      robLocationB: String(robLocationB),
      min: item.min || '0',
    }).returning();

    const created = result[0];

    if (totalRob > 0) {
      await db.insert(v2StoresLedger).values({
        vesselId: created.vesselId,
        section: created.itemType,
        itemId: created.id,
        partCode: created.itemCode,
        itemName: created.itemName,
        uom: created.uom,
        eventType: 'INITIAL',
        qtyChangeBase: String(totalRob),
        qtyDisplay: String(totalRob),
        robAfterBase: String(totalRob),
        dateLocal: new Date().toISOString().split('T')[0],
        tz: 'UTC',
        timestampUTC: new Date(),
        place: `Location A: ${robLocationA}, Location B: ${robLocationB}`,
        userId: userId || 'System',
        remarks: 'Initial stock on item creation',
      });
    }

    return created;
  }

  async updateStoresItem(id: number, data: Partial<V2StoresItem>): Promise<V2StoresItem> {
    const db = await getDb();

    const blockedFields = ['rob', 'robLocationA', 'robLocationB'];
    const attemptedRobUpdate = blockedFields.some(field => field in data && data[field as keyof V2StoresItem] !== undefined);
    if (attemptedRobUpdate) {
      throw new Error('Direct ROB updates are not allowed. Use consume, receive, transfer, or adjust methods to modify stock quantities.');
    }

    const result = await db.update(v2StoresItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2StoresItems.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Stores item with id ${id} not found`);
    }
    return result[0];
  }

  async deleteStoresItem(id: number): Promise<void> {
    const db = await getDb();
    await db.update(v2StoresItems)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(v2StoresItems.id, id));
  }

  async consumeStoresItem(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<V2StoresItem> {
    const db = await getDb();
    const item = await this.getStoresItem(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }

    const qtyNum = Number(quantity);
    const locationRob = location === 'A' ? Number(item.robLocationA || 0) : Number(item.robLocationB || 0);
    const actualConsumed = Math.min(qtyNum, locationRob);
    const newLocationRob = Math.max(0, locationRob - qtyNum);
    const newTotalRob = Math.max(0, Number(item.rob || 0) - actualConsumed);

    const updated = await db.update(v2StoresItems)
      .set({
        rob: String(newTotalRob),
        ...(location === 'A' ? { robLocationA: String(newLocationRob) } : { robLocationB: String(newLocationRob) }),
        updatedAt: new Date()
      })
      .where(eq(v2StoresItems.id, id))
      .returning();

    await db.insert(v2StoresLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'CONSUME',
      qtyChangeBase: String(-actualConsumed),
      qtyDisplay: String(-actualConsumed),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      userId: userId,
      remarks: remarks,
    });

    return updated[0];
  }

  async receiveStoresItem(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    ref?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<V2StoresItem> {
    const db = await getDb();
    const item = await this.getStoresItem(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }

    const qtyNum = Number(quantity);
    const locationRob = location === 'A' ? Number(item.robLocationA || 0) : Number(item.robLocationB || 0);
    const newLocationRob = locationRob + qtyNum;
    const newTotalRob = Number(item.rob || 0) + qtyNum;

    const updated = await db.update(v2StoresItems)
      .set({
        rob: String(newTotalRob),
        ...(location === 'A' ? { robLocationA: String(newLocationRob) } : { robLocationB: String(newLocationRob) }),
        updatedAt: new Date()
      })
      .where(eq(v2StoresItems.id, id))
      .returning();

    await db.insert(v2StoresLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'RECEIVE',
      qtyChangeBase: String(qtyNum),
      qtyDisplay: String(qtyNum),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      ref: ref,
      userId: userId,
      remarks: remarks,
    });

    return updated[0];
  }

  async transferStoresItemLocation(
    id: number,
    newRobLocationA: string,
    newRobLocationB: string,
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<{ item: V2StoresItem; isTransfer: boolean }> {
    const db = await getDb();
    const item = await this.getStoresItem(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }

    const oldLocA = Number(item.robLocationA || 0);
    const oldLocB = Number(item.robLocationB || 0);
    const newLocA = Number(newRobLocationA || 0);
    const newLocB = Number(newRobLocationB || 0);

    if (isNaN(newLocA) || newLocA < 0) {
      throw new Error('robLocationA must be a valid non-negative number');
    }
    if (isNaN(newLocB) || newLocB < 0) {
      throw new Error('robLocationB must be a valid non-negative number');
    }

    const deltaA = newLocA - oldLocA;
    const deltaB = newLocB - oldLocB;

    if (deltaA === 0 && deltaB === 0) {
      return { item, isTransfer: false };
    }

    const newTotalRob = newLocA + newLocB;

    const updated = await db.update(v2StoresItems)
      .set({
        rob: String(newTotalRob),
        robLocationA: String(newLocA),
        robLocationB: String(newLocB),
        updatedAt: new Date()
      })
      .where(eq(v2StoresItems.id, id))
      .returning();

    const isTrueTransfer = deltaA !== 0 && deltaB !== 0 && deltaA === -deltaB;

    if (isTrueTransfer) {
      const transferQty = Math.abs(deltaA);
      const fromLocation = deltaA < 0 ? 'A' : 'B';
      const toLocation = deltaA < 0 ? 'B' : 'A';
      const transferRemarks = remarks || `Transfer ${transferQty} from Location ${fromLocation} to Location ${toLocation}`;

      await db.insert(v2StoresLedger).values({
        vesselId: item.vesselId,
        section: item.itemType,
        itemId: id,
        partCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        eventType: 'TRANSFER_OUT',
        qtyChangeBase: String(-transferQty),
        qtyDisplay: String(-transferQty),
        robAfterBase: String(newTotalRob),
        dateLocal: dateLocal || new Date().toISOString().split('T')[0],
        tz: tz || 'UTC',
        timestampUTC: new Date(),
        place: place || `Location ${fromLocation}`,
        userId: userId,
        remarks: transferRemarks,
      });

      await db.insert(v2StoresLedger).values({
        vesselId: item.vesselId,
        section: item.itemType,
        itemId: id,
        partCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        eventType: 'TRANSFER_IN',
        qtyChangeBase: String(transferQty),
        qtyDisplay: String(transferQty),
        robAfterBase: String(newTotalRob),
        dateLocal: dateLocal || new Date().toISOString().split('T')[0],
        tz: tz || 'UTC',
        timestampUTC: new Date(),
        place: place || `Location ${toLocation}`,
        userId: userId,
        remarks: transferRemarks,
      });

      return { item: updated[0], isTransfer: true };
    }

    const netChange = (newLocA + newLocB) - (oldLocA + oldLocB);
    const adjustmentRemarks = remarks || (netChange >= 0
      ? `Adjustment: +${netChange} (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`
      : `Adjustment: ${netChange} (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`);

    await db.insert(v2StoresLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'ADJUSTMENT',
      qtyChangeBase: String(netChange),
      qtyDisplay: String(netChange),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      userId: userId,
      remarks: adjustmentRemarks,
    });

    return { item: updated[0], isTransfer: false };
  }

  async adjustStoresItem(
    id: number,
    newRob: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<V2StoresItem> {
    const db = await getDb();
    const item = await this.getStoresItem(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }

    if (isNaN(newRob) || newRob < 0) {
      throw new Error('newRob must be a valid non-negative number');
    }

    const oldLocA = Number(item.robLocationA || 0);
    const oldLocB = Number(item.robLocationB || 0);
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
      return item;
    }

    const updated = await db.update(v2StoresItems)
      .set({
        rob: String(newTotal),
        robLocationA: String(newLocA),
        robLocationB: String(newLocB),
        updatedAt: new Date()
      })
      .where(eq(v2StoresItems.id, id))
      .returning();

    const adjustmentRemarks = remarks || `Adjustment at Location ${location}: ${location === 'A' ? oldLocA : oldLocB}→${newRob}`;

    await db.insert(v2StoresLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'ADJUSTMENT',
      qtyChangeBase: String(netChange),
      qtyDisplay: String(netChange),
      robAfterBase: String(newTotal),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place || `Location ${location}`,
      userId: userId,
      remarks: adjustmentRemarks,
    });

    return updated[0];
  }

  async getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<V2StoresLedger[]> {
    const db = await getDb();
    if (itemType) {
      return await db.select().from(v2StoresLedger)
        .where(and(
          eq(v2StoresLedger.vesselId, vesselId),
          eq(v2StoresLedger.section, itemType)
        ))
        .orderBy(desc(v2StoresLedger.timestampUTC));
    }
    return await db.select().from(v2StoresLedger)
      .where(eq(v2StoresLedger.vesselId, vesselId))
      .orderBy(desc(v2StoresLedger.timestampUTC));
  }

  async getStoresItemHistory(itemId: number): Promise<V2StoresLedger[]> {
    const db = await getDb();
    return await db.select().from(v2StoresLedger)
      .where(eq(v2StoresLedger.itemId, itemId))
      .orderBy(desc(v2StoresLedger.timestampUTC));
  }
}
