import { Request, Response } from 'express';
import * as inventoryService from '../services/inventoryService';
import type { AuthenticatedRequest } from '../../../middleware/auth';

// ── GET /inventory/locations/:vesselId ──

export async function getLocations(req: Request, res: Response) {
  try {
    const locations = await inventoryService.getLocations(req.params.vesselId);
    res.json({ success: true, data: locations });
  } catch (error: any) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/locations/:vesselId/:id ──

export async function getLocationById(req: Request, res: Response) {
  try {
    const location = await inventoryService.getLocationById(parseInt(req.params.id));
    if (!location) {
      return res.status(404).json({ success: false, error: "Location not found" });
    }
    res.json({ success: true, data: location });
  } catch (error: any) {
    console.error("Error fetching location:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /inventory/locations/:vesselId ──

export async function createLocation(req: Request, res: Response) {
  try {
    const location = await inventoryService.createLocation(req.params.vesselId, req.body);
    res.json({ success: true, data: location });
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Error creating location:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /inventory/reconcile/:vesselId ──

export async function reconcile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = String(req.user?.id || 'System');
    const result = await inventoryService.reconcile(req.params.vesselId, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error reconciling spare location stock:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/spare-links/:vesselId ──

export async function getSpareLinks(req: Request, res: Response) {
  try {
    const links = await inventoryService.getSpareComponentLinks(req.params.vesselId);
    res.json({ success: true, data: links });
  } catch (error: any) {
    console.error("Error fetching spare-component links:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/spare-links/by-spare/:spareId ──

export async function getSpareLinksBySpare(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.spareId);
    const data = await inventoryService.getSpareComponentLinksBySpare(spareId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching links for spare:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/spare-links/by-component/:componentId ──

export async function getSpareLinksByComponent(req: Request, res: Response) {
  try {
    const links = await inventoryService.getSpareComponentLinksByComponent(req.params.componentId);
    res.json({ success: true, data: links });
  } catch (error: any) {
    console.error("Error fetching links for component:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /inventory/spare-links ──

export async function createSpareLink(req: Request, res: Response) {
  try {
    const link = await inventoryService.createSpareComponentLink(req.body);
    res.json({ success: true, data: link });
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Error creating spare-component link:", error);
    if (error.message?.includes('duplicate')) {
      return res.status(409).json({ success: false, error: "Link already exists" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── DELETE /inventory/spare-links/:spareId/:componentId ──

export async function deleteSpareLink(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.spareId);
    await inventoryService.deleteSpareComponentLink(spareId, req.params.componentId);
    res.json({ success: true, message: "Link deleted" });
  } catch (error: any) {
    console.error("Error deleting spare-component link:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/stock/:spareId ──

export async function getSpareStock(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.spareId);
    const data = await inventoryService.getSpareStock(spareId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching spare stock:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/stock/by-location/:locationId ──

export async function getSparesAtLocation(req: Request, res: Response) {
  try {
    const locationId = parseInt(req.params.locationId);
    const spares = await inventoryService.getSparesAtLocation(locationId);
    res.json({ success: true, data: spares });
  } catch (error: any) {
    console.error("Error fetching spares at location:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/stock/locations-with-stock/:vesselId ──

export async function getLocationsWithStock(req: Request, res: Response) {
  try {
    const locationsWithStock = await inventoryService.getLocationsWithStock(req.params.vesselId);
    res.json({ success: true, data: locationsWithStock });
  } catch (error: any) {
    console.error("Error fetching locations with stock:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/stock/full-by-location/:vesselId/:locationId ──

export async function getFullSparesAtLocation(req: Request, res: Response) {
  try {
    const locationId = parseInt(req.params.locationId);
    const vesselId = req.params.vesselId;
    const spares = await inventoryService.getFullSparesAtLocation(locationId, vesselId);
    res.json({ success: true, data: spares });
  } catch (error: any) {
    console.error("Error fetching full spares at location:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /inventory/stock/:spareId/:locationId ──

export async function upsertStock(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.spareId);
    const locationId = parseInt(req.params.locationId);
    const stock = await inventoryService.upsertStock(spareId, locationId, req.body);
    res.json({ success: true, data: stock });
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Error setting spare stock:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /inventory/transactions ──

export async function createTransaction(req: Request, res: Response) {
  try {
    const result = await inventoryService.createTransaction(req.body);
    if (result.validationError) {
      return res.status(400).json(result.response);
    }
    res.json(result.response);
  } catch (error: any) {
    console.error("Error performing inventory transaction:", error);

    // Map domain errors to appropriate HTTP status codes
    if (error.message?.includes('INSUFFICIENT_STOCK')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: error.message.replace('INSUFFICIENT_STOCK: ', '')
        }
      });
    }
    if (error.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NEGATIVE_STOCK_PREVENTED',
          message: error.message.replace('NEGATIVE_STOCK_PREVENTED: ', '')
        }
      });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    }
    if (error.message?.includes('requires')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
  }
}

// ── GET /inventory/transactions/:vesselId ──

export async function getTransactions(req: Request, res: Response) {
  try {
    const transactions = await inventoryService.getTransactions(req.params.vesselId, req.query);
    res.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error("Error fetching inventory transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/spares-with-inventory/:vesselId ──

export async function getSparesWithInventory(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const pageRaw = req.query.page;

    // Backward compat: no `page` param => return full array as before.
    if (pageRaw === undefined || pageRaw === null || pageRaw === '') {
      const spares = await inventoryService.getSparesWithInventoryByVessel(vesselId);
      return res.json({ success: true, data: spares });
    }

    const page = Math.max(1, parseInt(String(pageRaw), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const criticalityRaw = typeof req.query.criticality === 'string' ? req.query.criticality : undefined;
    const criticality = criticalityRaw === 'Critical' || criticalityRaw === 'Non-critical' ? criticalityRaw : undefined;

    const rotationRaw = typeof req.query.rotation === 'string' ? req.query.rotation : undefined;
    const rotation =
      rotationRaw === 'Rotation Items' || rotationRaw === 'Non-Rotation Items' ? rotationRaw : undefined;

    const stockRaw = typeof req.query.stockStatus === 'string' ? req.query.stockStatus : undefined;
    const stockStatus =
      stockRaw === 'OK' || stockRaw === 'Low' || stockRaw === 'At Min' ? stockRaw : undefined;

    const sortByRaw = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'partCode';
    const sortBy = sortByRaw === 'partCode' ? ('partCode' as const) : ('partCode' as const);

    const sortDirRaw = typeof req.query.sortDir === 'string' ? req.query.sortDir.toLowerCase() : 'asc';
    const sortDir = sortDirRaw === 'desc' ? ('desc' as const) : ('asc' as const);

    const activeOnly = String(req.query.activeOnly ?? '').toLowerCase() === 'true';

    const componentIdRaw = typeof req.query.componentId === 'string' ? req.query.componentId.trim() : '';
    const componentId = componentIdRaw ? componentIdRaw : undefined;

    // 'my' scope: vesselId='all' carries a vesselIds allow-list narrowing the aggregate.
    const vesselIdsRaw = typeof req.query.vesselIds === 'string' ? req.query.vesselIds : '';
    const vesselIds = vesselIdsRaw ? vesselIdsRaw.split(',').filter(Boolean) : undefined;

    const result = await inventoryService.getSparesWithInventoryByVesselPaged(vesselId, {
      page,
      pageSize,
      search,
      criticality,
      rotation,
      stockStatus,
      sortBy,
      sortDir,
      activeOnly,
      componentId,
      vesselIds,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error fetching spares with inventory:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/spare-with-inventory/:spareId ──

export async function getSpareWithInventory(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.spareId);
    const spareWithInventory = await inventoryService.getSpareWithInventory(spareId);

    if (!spareWithInventory) {
      return res.status(404).json({ success: false, error: "Spare not found" });
    }

    res.json({ success: true, data: spareWithInventory });
  } catch (error: any) {
    console.error("Error fetching spare with inventory:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/spares-by-component/:componentId ──

export async function getSparesByComponent(req: Request, res: Response) {
  try {
    const spares = await inventoryService.getSparesWithInventoryByComponent(req.params.componentId);
    res.json({ success: true, data: spares });
  } catch (error: any) {
    console.error("Error fetching spares by component:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /inventory/backfill-sibling-links/:vesselId ──

export async function backfillSiblingLinks(req: Request, res: Response) {
  try {
    const result = await inventoryService.backfillSiblingLinks(req.params.vesselId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error backfilling sibling links:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /inventory/spares-by-component-code/:vesselId/:componentCode ──

export async function getSparesByComponentCode(req: Request, res: Response) {
  try {
    const { vesselId, componentCode } = req.params;
    const spares = await inventoryService.getSparesWithInventoryByComponentCode(vesselId, componentCode);
    res.json({ success: true, data: spares });
  } catch (error: any) {
    console.error("Error fetching spares by component code:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
