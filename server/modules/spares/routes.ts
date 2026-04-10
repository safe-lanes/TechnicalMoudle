import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as sparesCtrl from './controllers/sparesController';
import * as invCtrl from './controllers/inventoryController';
import { requireAuth, requirePMSAdmin } from '../../middleware/auth';

const router = Router();

// ══════════════════════════════════════════════════════════
// Spares Routes
// IMPORTANT: Specific paths MUST come before /:vesselId catch-all
// to prevent Express from matching "history", "bulk-update", etc. as vesselId
// ══════════════════════════════════════════════════════════

// ── Spares: No-param / specific-first routes ──

// GET  /spares — get all spares (no vesselId)
router.get('/spares', requireAuth, asyncHandler(sparesCtrl.getAllSpares));

// GET  /spares/history/:vesselId — spare history (MUST be before /:vesselId)
router.get('/spares/history/:vesselId', requireAuth, asyncHandler(sparesCtrl.getSpareHistoryByVessel));

// POST /spares/bulk-update — location-specific bulk update (MUST be before /:vesselId)
router.post('/spares/bulk-update', requirePMSAdmin, asyncHandler(sparesCtrl.bulkUpdate));

// ── Spares: suuid-only routes (no vesselId prefix) ──

// POST /spares/:id/consume — legacy consume (Location A default)
router.post('/spares/:id/consume', requirePMSAdmin, asyncHandler(sparesCtrl.consumeSimple));

// POST /spares/:id/receive — legacy receive (Location A default)
router.post('/spares/:id/receive', requirePMSAdmin, asyncHandler(sparesCtrl.receiveSimple));

// POST /spares/:id/consume-from-location — location-aware consume
router.post('/spares/:id/consume-from-location', requirePMSAdmin, asyncHandler(sparesCtrl.consumeFromLocation));

// POST /spares/:id/receive-to-location — location-aware receive
router.post('/spares/:id/receive-to-location', requirePMSAdmin, asyncHandler(sparesCtrl.receiveToLocation));

// ── Spares: vessel-scoped specific paths (BEFORE /:vesselId catch-all) ──

// POST /spares/:vesselId/batch-consume
router.post('/spares/:vesselId/batch-consume', requirePMSAdmin, asyncHandler(sparesCtrl.batchConsume));

// POST /spares/:vesselId/batch-receive
router.post('/spares/:vesselId/batch-receive', requirePMSAdmin, asyncHandler(sparesCtrl.batchReceive));

// ── Spares: vessel-scoped with sub-resource ID ──

// GET  /spares/:vesselId/history — legacy history route
router.get('/spares/:vesselId/history', requireAuth, asyncHandler(sparesCtrl.getSpareHistoryLegacy));

// GET  /spares/:vesselId/low-stock — low stock spares
router.get('/spares/:vesselId/low-stock', requireAuth, asyncHandler(sparesCtrl.getLowStockSpares));

// POST /spares/:vesselId/:id/inactivate — soft delete (deactivate) spare
router.post('/spares/:vesselId/:id/inactivate', requirePMSAdmin, asyncHandler(sparesCtrl.inactivateSpare));

// POST /spares/:vesselId/:id/adjustment — adjust spare ROB at location
router.post('/spares/:vesselId/:id/adjustment', requirePMSAdmin, asyncHandler(sparesCtrl.adjustSpareAtLocation));

// POST /spares/:vesselId/:id/adjust — adjust spare quantity (+/- buttons)
router.post('/spares/:vesselId/:id/adjust', requirePMSAdmin, asyncHandler(sparesCtrl.adjustSpareQuantity));

// ── Spares: vessel-scoped CRUD ──

// GET  /spares/:vesselId/:id — get spare by ID
router.get('/spares/:vesselId/:id', requireAuth, asyncHandler(sparesCtrl.getSpareById));

// POST /spares/:vesselId — create spare
router.post('/spares/:vesselId', requirePMSAdmin, asyncHandler(sparesCtrl.createSpare));

// PATCH /spares/:vesselId/:id — update spare
router.patch('/spares/:vesselId/:id', requirePMSAdmin, asyncHandler(sparesCtrl.updateSpare));

// DELETE /spares/:vesselId/:id — delete spare
router.delete('/spares/:vesselId/:id', requirePMSAdmin, asyncHandler(sparesCtrl.deleteSpare));

// GET  /spares/:vesselId — get spares for vessel (CATCH-ALL — must be last in /spares/:vesselId group)
router.get('/spares/:vesselId', requireAuth, asyncHandler(sparesCtrl.getSparesByVessel));

// ══════════════════════════════════════════════════════════
// Inventory Routes
// ══════════════════════════════════════════════════════════

// ── Inventory: Locations ──

router.get('/inventory/locations/:vesselId', requireAuth, asyncHandler(invCtrl.getLocations));
router.get('/inventory/locations/:vesselId/:id', requireAuth, asyncHandler(invCtrl.getLocationById));
router.post('/inventory/locations/:vesselId', requirePMSAdmin, asyncHandler(invCtrl.createLocation));

// ── Inventory: Reconciliation ──

router.post('/inventory/reconcile/:vesselId', requirePMSAdmin, asyncHandler(invCtrl.reconcile as any));

// ── Inventory: Spare-Component Links (specific paths before catch-all) ──

router.get('/inventory/spare-links/by-spare/:spareId', requireAuth, asyncHandler(invCtrl.getSpareLinksBySpare));
router.get('/inventory/spare-links/by-component/:componentId', requireAuth, asyncHandler(invCtrl.getSpareLinksByComponent));
router.get('/inventory/spare-links/:vesselId', requireAuth, asyncHandler(invCtrl.getSpareLinks));
router.post('/inventory/spare-links', requirePMSAdmin, asyncHandler(invCtrl.createSpareLink));
router.delete('/inventory/spare-links/:spareId/:componentId', requirePMSAdmin, asyncHandler(invCtrl.deleteSpareLink));

// ── Inventory: Stock (specific paths before catch-all) ──

router.get('/inventory/stock/by-location/:locationId', requireAuth, asyncHandler(invCtrl.getSparesAtLocation));
router.get('/inventory/stock/locations-with-stock/:vesselId', requireAuth, asyncHandler(invCtrl.getLocationsWithStock));
router.get('/inventory/stock/full-by-location/:vesselId/:locationId', requireAuth, asyncHandler(invCtrl.getFullSparesAtLocation));
router.get('/inventory/stock/:spareId', requireAuth, asyncHandler(invCtrl.getSpareStock));
router.post('/inventory/stock/:spareId/:locationId', requirePMSAdmin, asyncHandler(invCtrl.upsertStock));

// ── Inventory: Transactions ──

router.post('/inventory/transactions', requirePMSAdmin, asyncHandler(invCtrl.createTransaction));
router.get('/inventory/transactions/:vesselId', requireAuth, asyncHandler(invCtrl.getTransactions));

// ── Inventory: Sibling Backfill ──

router.post('/inventory/backfill-sibling-links/:vesselId', requirePMSAdmin, asyncHandler(invCtrl.backfillSiblingLinks));

// ── Inventory: Enhanced Spare Data (specific paths before catch-all) ──

router.get('/inventory/spares-with-inventory/:vesselId', requireAuth, asyncHandler(invCtrl.getSparesWithInventory));
router.get('/inventory/spare-with-inventory/:spareId', requireAuth, asyncHandler(invCtrl.getSpareWithInventory));
router.get('/inventory/spares-by-component/:componentId', requireAuth, asyncHandler(invCtrl.getSparesByComponent));
router.get('/inventory/spares-by-component-code/:vesselId/:componentCode', requireAuth, asyncHandler(invCtrl.getSparesByComponentCode));

export default router;
