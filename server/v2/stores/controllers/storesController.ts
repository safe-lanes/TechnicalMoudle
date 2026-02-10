import type { Request, Response } from "express";
import { StoresService } from "../services/storesService";

interface AuthenticatedRequest extends Request {
  user?: { id?: string | number; role?: string };
}

export class StoresController {
  constructor(private service: StoresService) {}

  async getStoresItems(req: Request, res: Response): Promise<void> {
    const { itemType } = req.query;
    const stores = await this.service.getStoresItems(
      req.params.vesselId,
      itemType as string | undefined
    );
    res.json(stores);
  }

  async getStoresTransactionHistory(req: Request, res: Response): Promise<void> {
    const { vesselId } = req.params;
    const { itemType } = req.query;
    const history = await this.service.getStoresTransactionHistory(
      vesselId,
      itemType as string | undefined
    );
    res.json(history);
  }

  async getStoresItemHistory(req: Request, res: Response): Promise<void> {
    const itemId = parseInt(req.params.id);
    const history = await this.service.getStoresItemHistory(itemId);
    res.json(history);
  }

  async createStoresItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { vesselId } = req.params;
    const userId = req.user?.id?.toString() || 'System';
    const itemData = { ...req.body, vesselId };
    const item = await this.service.createStoresItem(itemData, userId);
    res.json(item);
  }

  async updateStoresItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const itemId = parseInt(req.params.id);
    const { rob, robLocationA, robLocationB, ...safeData } = req.body;
    const item = await this.service.updateStoresItem(itemId, safeData);
    res.json(item);
  }

  async adjustStoresItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const itemId = parseInt(req.params.id);
    const { newRob, location, remarks, place, dateLocal, tz } = req.body;
    const userId = req.user?.id?.toString() || 'System';

    if (newRob === undefined || newRob < 0) {
      res.status(400).json({ error: "Valid newRob value (>= 0) is required" });
      return;
    }
    if (!location || !['A', 'B'].includes(location)) {
      res.status(400).json({ error: "Location must be 'A' or 'B'" });
      return;
    }

    const item = await this.service.adjustStoresItem(
      itemId,
      Number(newRob),
      location as 'A' | 'B',
      userId,
      remarks,
      place,
      dateLocal,
      tz
    );
    res.json(item);
  }

  async patchStoresItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const itemId = parseInt(req.params.id);
    const { robLocationA, robLocationB, rob, remarks, place, dateLocal, tz } = req.body;
    const userId = req.user?.id?.toString() || 'System';

    if (robLocationA !== undefined || robLocationB !== undefined) {
      if (robLocationA !== undefined && (isNaN(Number(robLocationA)) || Number(robLocationA) < 0)) {
        res.status(400).json({ error: "robLocationA must be a valid non-negative number" });
        return;
      }
      if (robLocationB !== undefined && (isNaN(Number(robLocationB)) || Number(robLocationB) < 0)) {
        res.status(400).json({ error: "robLocationB must be a valid non-negative number" });
        return;
      }

      const currentItem = await this.service.getStoresItem(itemId);
      if (!currentItem) {
        res.status(404).json({ error: "Stores item not found" });
        return;
      }

      const newLocA = robLocationA !== undefined ? String(Number(robLocationA)) : currentItem.robLocationA;
      const newLocB = robLocationB !== undefined ? String(Number(robLocationB)) : currentItem.robLocationB;

      const result = await this.service.transferStoresItemLocation(
        itemId,
        newLocA,
        newLocB,
        userId,
        remarks,
        place,
        dateLocal,
        tz
      );
      res.json(result.item);
      return;
    }

    if (rob !== undefined) {
      res.status(400).json({
        error: "Direct ROB updates are not allowed. Use location-specific updates (robLocationA/robLocationB) or consume/receive endpoints."
      });
      return;
    }

    const { robLocationA: _a, robLocationB: _b, rob: _r, place: _p, dateLocal: _d, tz: _t, ...otherUpdates } = req.body;
    if (Object.keys(otherUpdates).length > 0) {
      const item = await this.service.updateStoresItem(itemId, otherUpdates);
      res.json(item);
      return;
    }

    res.status(400).json({ error: "No valid update fields provided" });
  }

  async deleteStoresItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const itemId = parseInt(req.params.id);
    await this.service.deleteStoresItem(itemId);
    res.json({ success: true });
  }

  async batchConsumeStores(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { items, consumedBy } = req.body;
    const userId = req.user?.id?.toString() || consumedBy || 'System';

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Items array is required" });
      return;
    }

    const results = [];
    for (const item of items) {
      if (!item.itemId || !item.quantity || item.quantity <= 0) {
        res.status(400).json({ error: "Each item must have a valid itemId and positive quantity" });
        return;
      }
      const result = await this.service.consumeStoresItem(
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

    res.json({ success: true, results });
  }

  async batchReceiveStores(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { items, purchaseOrderRef, receivedBy } = req.body;
    const userId = req.user?.id?.toString() || receivedBy || 'System';

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Items array is required" });
      return;
    }

    const results = [];
    for (const item of items) {
      if (!item.itemId || !item.quantity || item.quantity <= 0) {
        res.status(400).json({ error: "Each item must have a valid itemId and positive quantity" });
        return;
      }
      const result = await this.service.receiveStoresItem(
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

    res.json({ success: true, results });
  }
}
