import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as storesCtrl from './controllers/storesController';
import { requireAuth, requirePMSAdmin } from '../../middleware/auth';

const router = Router();

// ══════════════════════════════════════════════════════════
// Stores Routes
// IMPORTANT: Specific paths MUST come before /:vesselId catch-all
// to prevent Express from matching "item" as vesselId
// ══════════════════════════════════════════════════════════

// ── Stores: No-param route ──

// GET  /stores — get all stores (all vessels)
router.get('/stores', requireAuth, asyncHandler(storesCtrl.getAllStores));

// ── Stores: item-specific routes (MUST be before /:vesselId) ──

// GET  /stores/item/:id/history — single item history
router.get('/stores/item/:id/history', requireAuth, asyncHandler(storesCtrl.getItemHistory));

// PUT  /stores/item/:id — update store item
router.put('/stores/item/:id', requirePMSAdmin, asyncHandler(storesCtrl.updateStoresItem as any));

// POST /stores/item/:id/adjust — adjust stock
router.post('/stores/item/:id/adjust', requirePMSAdmin, asyncHandler(storesCtrl.adjustStoresItem as any));

// DELETE /stores/item/:id — soft delete
router.delete('/stores/item/:id', requirePMSAdmin, asyncHandler(storesCtrl.deleteStoresItem as any));

// ── Stores: vessel-scoped specific paths (BEFORE /:vesselId catch-all) ──

// GET  /stores/:vesselId/history — transaction history
router.get('/stores/:vesselId/history', requireAuth, asyncHandler(storesCtrl.getTransactionHistory));

// POST /stores/:vesselId/create — create store item
router.post('/stores/:vesselId/create', requirePMSAdmin, asyncHandler(storesCtrl.createStoresItem as any));

// POST /stores/:vesselId/:id/inactivate — soft delete via isActive=false
router.post('/stores/:vesselId/:id/inactivate', requirePMSAdmin, asyncHandler(storesCtrl.inactivateStoresItem as any));

// POST /stores/:vesselId/batch-consume — batch consume
router.post('/stores/:vesselId/batch-consume', requirePMSAdmin, asyncHandler(storesCtrl.batchConsume as any));

// POST /stores/:vesselId/batch-receive — batch receive
router.post('/stores/:vesselId/batch-receive', requirePMSAdmin, asyncHandler(storesCtrl.batchReceive as any));

// PATCH /stores/:vesselId/:id — patch store item with transfer detection
router.patch('/stores/:vesselId/:id', requirePMSAdmin, asyncHandler(storesCtrl.patchStoresItem as any));

// ── Stores: vessel-scoped CRUD (CATCH-ALL — must be last) ──

// GET  /stores/:vesselId — get stores for vessel
router.get('/stores/:vesselId', requireAuth, asyncHandler(storesCtrl.getStoresByVessel));

export default router;
