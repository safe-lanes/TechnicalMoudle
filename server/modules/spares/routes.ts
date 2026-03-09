import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as sparesCtrl from './controllers/sparesController';
import * as invCtrl from './controllers/inventoryController';
import { requirePMSAdmin } from '../../middleware/auth';

const router = Router();

// ══════════════════════════════════════════════════════════
// Spares Routes
// IMPORTANT: Specific paths MUST come before /:vesselId catch-all
// to prevent Express from matching "history", "bulk-update", etc. as vesselId
// ══════════════════════════════════════════════════════════

// ── Spares: No-param / specific-first routes ──

// GET  /spares — get all spares (no vesselId)
router.get('/spares', asyncHandler(sparesCtrl.getAllSpares));

// GET  /spares/history/:vesselId — spare history (MUST be before /:vesselId)
router.get('/spares/history/:vesselId', asyncHandler(sparesCtrl.getSpareHistoryByVessel));

// POST /spares/bulk-update — location-specific bulk update (MUST be before /:vesselId)
router.post('/spares/bulk-update', asyncHandler(sparesCtrl.bulkUpdate));

// ── Spares: suuid-only routes (no vesselId prefix) ──

// POST /spares/:id/consume — legacy consume (Location A default)
router.post('/spares/:id/consume', asyncHandler(sparesCtrl.consumeSimple));

// POST /spares/:id/receive — legacy receive (Location A default)
router.post('/spares/:id/receive', asyncHandler(sparesCtrl.receiveSimple));

// POST /spares/:id/consume-from-location — location-aware consume
router.post('/spares/:id/consume-from-location', asyncHandler(sparesCtrl.consumeFromLocation));

// POST /spares/:id/receive-to-location — location-aware receive
router.post('/spares/:id/receive-to-location', asyncHandler(sparesCtrl.receiveToLocation));

// ── Spares: vessel-scoped specific paths (BEFORE /:vesselId catch-all) ──

// POST /spares/:vesselId/batch-consume
router.post('/spares/:vesselId/batch-consume', asyncHandler(sparesCtrl.batchConsume));

// POST /spares/:vesselId/batch-receive
router.post('/spares/:vesselId/batch-receive', asyncHandler(sparesCtrl.batchReceive));

// ── Spares: vessel-scoped with sub-resource ID ──

// GET  /spares/:vesselId/history — legacy history route
router.get('/spares/:vesselId/history', asyncHandler(sparesCtrl.getSpareHistoryLegacy));

// GET  /spares/:vesselId/low-stock — low stock spares
router.get('/spares/:vesselId/low-stock', asyncHandler(sparesCtrl.getLowStockSpares));

// POST /spares/:vesselId/:id/inactivate — soft delete (deactivate) spare
router.post('/spares/:vesselId/:id/inactivate', asyncHandler(sparesCtrl.inactivateSpare));

// POST /spares/:vesselId/:id/adjustment — adjust spare ROB at location
router.post('/spares/:vesselId/:id/adjustment', asyncHandler(sparesCtrl.adjustSpareAtLocation));

// POST /spares/:vesselId/:id/adjust — adjust spare quantity (+/- buttons)
router.post('/spares/:vesselId/:id/adjust', asyncHandler(sparesCtrl.adjustSpareQuantity));

// ── Spares: vessel-scoped CRUD ──

// GET  /spares/:vesselId/:id — get spare by ID
router.get('/spares/:vesselId/:id', asyncHandler(sparesCtrl.getSpareById));

// POST /spares/:vesselId — create spare
router.post('/spares/:vesselId', asyncHandler(sparesCtrl.createSpare));

// PATCH /spares/:vesselId/:id — update spare
router.patch('/spares/:vesselId/:id', asyncHandler(sparesCtrl.updateSpare));

// DELETE /spares/:vesselId/:id — delete spare
router.delete('/spares/:vesselId/:id', asyncHandler(sparesCtrl.deleteSpare));

// GET  /spares/:vesselId — get spares for vessel (CATCH-ALL — must be last in /spares/:vesselId group)
router.get('/spares/:vesselId', asyncHandler(sparesCtrl.getSparesByVessel));

// ══════════════════════════════════════════════════════════
// Inventory Routes
// ══════════════════════════════════════════════════════════

// ── Inventory: Locations ──

router.get('/inventory/locations/:vesselId', asyncHandler(invCtrl.getLocations));
router.get('/inventory/locations/:vesselId/:id', asyncHandler(invCtrl.getLocationById));
router.post('/inventory/locations/:vesselId', asyncHandler(invCtrl.createLocation));

// ── Inventory: Reconciliation ──

router.post('/inventory/reconcile/:vesselId', requirePMSAdmin, asyncHandler(invCtrl.reconcile as any));

// ── Inventory: Spare-Component Links (specific paths before catch-all) ──

router.get('/inventory/spare-links/by-spare/:spareId', asyncHandler(invCtrl.getSpareLinksBySpare));
router.get('/inventory/spare-links/by-component/:componentId', asyncHandler(invCtrl.getSpareLinksByComponent));
router.get('/inventory/spare-links/:vesselId', asyncHandler(invCtrl.getSpareLinks));
router.post('/inventory/spare-links', asyncHandler(invCtrl.createSpareLink));
router.delete('/inventory/spare-links/:spareId/:componentId', asyncHandler(invCtrl.deleteSpareLink));

// ── Inventory: Stock (specific paths before catch-all) ──

router.get('/inventory/stock/by-location/:locationId', asyncHandler(invCtrl.getSparesAtLocation));
router.get('/inventory/stock/locations-with-stock/:vesselId', asyncHandler(invCtrl.getLocationsWithStock));
router.get('/inventory/stock/full-by-location/:vesselId/:locationId', asyncHandler(invCtrl.getFullSparesAtLocation));
router.get('/inventory/stock/:spareId', asyncHandler(invCtrl.getSpareStock));
router.post('/inventory/stock/:spareId/:locationId', asyncHandler(invCtrl.upsertStock));

// ── Inventory: Transactions ──

router.post('/inventory/transactions', asyncHandler(invCtrl.createTransaction));
router.get('/inventory/transactions/:vesselId', asyncHandler(invCtrl.getTransactions));

// ── Inventory: Sibling Backfill ──

router.post('/inventory/backfill-sibling-links/:vesselId', asyncHandler(invCtrl.backfillSiblingLinks));

// ── Inventory: Enhanced Spare Data (specific paths before catch-all) ──

router.get('/inventory/spares-with-inventory/:vesselId', asyncHandler(invCtrl.getSparesWithInventory));
router.get('/inventory/spare-with-inventory/:spareId', asyncHandler(invCtrl.getSpareWithInventory));
router.get('/inventory/spares-by-component/:componentId', asyncHandler(invCtrl.getSparesByComponent));
router.get('/inventory/spares-by-component-code/:vesselId/:componentCode', asyncHandler(invCtrl.getSparesByComponentCode));

export default router;
