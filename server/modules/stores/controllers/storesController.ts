import { Request, Response } from 'express';
import * as storesService from '../services/storesService';
import type { AuthenticatedRequest } from '../../../middleware/auth';

// ── GET /stores ──

export async function getAllStores(req: Request, res: Response) {
  try {
    const allStores = await storesService.getAllStores(req.query.itemType as string | undefined);
    res.json(allStores);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stores" });
  }
}

// ── GET /stores/:vesselId ──

export async function getStoresByVessel(req: Request, res: Response) {
  try {
    const { itemType } = req.query;
    const stores = await storesService.getStoresByVessel(
      req.params.vesselId,
      itemType as string | undefined
    );
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stores" });
  }
}

// ── GET /stores/:vesselId/history ──

export async function getTransactionHistory(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { itemType } = req.query;
    const history = await storesService.getTransactionHistory(
      vesselId,
      itemType as string | undefined
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stores history" });
  }
}

// ── GET /stores/item/:id/history ──

export async function getItemHistory(req: Request, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    const history = await storesService.getItemHistory(itemId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch item history" });
  }
}

// ── POST /stores/:vesselId/create ──

export async function createStoresItem(req: AuthenticatedRequest, res: Response) {
  try {
    const { vesselId } = req.params;
    const userId = req.user?.id?.toString() || 'System';
    const item = await storesService.createStoresItem(vesselId, req.body, userId);
    res.json(item);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to create stores item" });
  }
}

// ── PUT /stores/item/:id ──

export async function updateStoresItem(req: AuthenticatedRequest, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    const item = await storesService.updateStoresItem(itemId, req.body);
    res.json(item);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to update stores item" });
  }
}

// ── POST /stores/item/:id/adjust ──

export async function adjustStoresItem(req: AuthenticatedRequest, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    const { newRob, location, remarks, place, dateLocal, tz } = req.body;
    const userId = req.user?.id?.toString() || 'System';
    const item = await storesService.adjustStoresItem(
      itemId, newRob, location, userId, remarks, place, dateLocal, tz
    );
    res.json(item);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to adjust stores item" });
  }
}

// ── PATCH /stores/:vesselId/:id ──

export async function patchStoresItem(req: AuthenticatedRequest, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    const userId = req.user?.id?.toString() || 'System';
    const item = await storesService.patchStoresItem(itemId, req.body, userId);
    res.json(item);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error updating stores item:", error);
    res.status(500).json({ error: error.message || "Failed to update stores item" });
  }
}

// ── DELETE /stores/item/:id ──

export async function deleteStoresItem(req: AuthenticatedRequest, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    await storesService.deleteStoresItem(itemId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete stores item" });
  }
}

// ── POST /stores/:vesselId/batch-consume ──

export async function batchConsume(req: AuthenticatedRequest, res: Response) {
  try {
    const { items, consumedBy } = req.body;
    const userId = req.user?.id?.toString() || consumedBy || 'System';
    const results = await storesService.batchConsume(items, userId);
    res.json({ success: true, results });
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to consume stores" });
  }
}

// ── POST /stores/:vesselId/batch-receive ──

export async function batchReceive(req: AuthenticatedRequest, res: Response) {
  try {
    const { items, purchaseOrderRef, receivedBy } = req.body;
    const userId = req.user?.id?.toString() || receivedBy || 'System';
    const results = await storesService.batchReceive(items, purchaseOrderRef, userId);
    res.json({ success: true, results });
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to receive stores" });
  }
}
