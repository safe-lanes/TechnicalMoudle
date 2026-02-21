import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as storesCtrl from './controllers/storesController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// ══════════════════════════════════════════════════════════
// Stores Routes
// IMPORTANT: Specific paths MUST come before /:vesselId catch-all
// to prevent Express from matching "item" as vesselId
// ══════════════════════════════════════════════════════════

// ── Stores: No-param route ──

// GET  /stores — get all stores (all vessels)
router.get('/stores', asyncHandler(storesCtrl.getAllStores));

// ── Stores: item-specific routes (MUST be before /:vesselId) ──

// GET  /stores/item/:id/history — single item history
router.get('/stores/item/:id/history', asyncHandler(storesCtrl.getItemHistory));

// PUT  /stores/item/:id — update store item (requireAuth)
router.put('/stores/item/:id', requireAuth, asyncHandler(storesCtrl.updateStoresItem as any));

// POST /stores/item/:id/adjust — adjust stock (requireAuth)
router.post('/stores/item/:id/adjust', requireAuth, asyncHandler(storesCtrl.adjustStoresItem as any));

// DELETE /stores/item/:id — soft delete (requireAuth)
router.delete('/stores/item/:id', requireAuth, asyncHandler(storesCtrl.deleteStoresItem as any));

// ── Stores: vessel-scoped specific paths (BEFORE /:vesselId catch-all) ──

// GET  /stores/:vesselId/history — transaction history
router.get('/stores/:vesselId/history', asyncHandler(storesCtrl.getTransactionHistory));

// POST /stores/:vesselId/create — create store item (requireAuth)
router.post('/stores/:vesselId/create', requireAuth, asyncHandler(storesCtrl.createStoresItem as any));

// POST /stores/:vesselId/batch-consume — batch consume (requireAuth)
router.post('/stores/:vesselId/batch-consume', requireAuth, asyncHandler(storesCtrl.batchConsume as any));

// POST /stores/:vesselId/batch-receive — batch receive (requireAuth)
router.post('/stores/:vesselId/batch-receive', requireAuth, asyncHandler(storesCtrl.batchReceive as any));

// PATCH /stores/:vesselId/:id — patch store item with transfer detection (requireAuth)
router.patch('/stores/:vesselId/:id', requireAuth, asyncHandler(storesCtrl.patchStoresItem as any));

// ── Stores: vessel-scoped CRUD (CATCH-ALL — must be last) ──

// GET  /stores/:vesselId — get stores for vessel
router.get('/stores/:vesselId', asyncHandler(storesCtrl.getStoresByVessel));

export default router;
