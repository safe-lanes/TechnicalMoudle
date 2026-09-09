import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../shared/middleware';
import { requirePermission } from '../../middleware/permissions';
import * as ctrl from './controllers/bulkController';

const router = Router();

// ── Permission policy (requirePermission, resource 'admin-masters') ──
// All bulk write routes are create/update-shaped (import/upsert), so POST/PUT/PATCH
// writes use any-of ['create','edit']; DELETE routes use 'delete'. GETs (templates,
// history, exports) stay open. Sail/PMS Admin bypass; unconfigured roles fail-open.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// ══════════════════════════════════════════════════════════
// Bulk Upload Routes (/bulk/*)
// IMPORTANT: Specific paths MUST come before parameterized catch-alls
// ══════════════════════════════════════════════════════════

// ── Templates & Sheets ──
router.get('/bulk/template', asyncHandler(ctrl.getTemplate));
router.post('/bulk/sheets', requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.getSheets));

// ── Dry-Run & Import ──
router.post('/bulk/dry-run', requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.dryRun));
router.post('/bulk/import', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.doImport));
router.post('/bulk/import-stream', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.doImportStream));
router.post('/bulk/export-summary', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.exportSummary));

// ── History (specific routes before parameterized) ──
router.get('/bulk/history', asyncHandler(ctrl.getHistoryList));
router.get('/bulk/import-status/:id', asyncHandler(ctrl.getImportStatus));
router.get('/bulk/history/:id/download-original', asyncHandler(ctrl.downloadOriginal));
router.get('/bulk/history/:id/:fileType', asyncHandler(ctrl.getHistoryFileHandler));

// ── Undo ──
router.post('/bulk/undo/:historyId', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.undoImport));

// ── Makers CRUD ──
router.get('/bulk/makers/export', asyncHandler(ctrl.get_makers_export));
router.get('/bulk/makers', asyncHandler(ctrl.get_makers));
router.get('/bulk/makers/:id', asyncHandler(ctrl.get_makersByid));
router.post('/bulk/makers', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.post_makers));
router.patch('/bulk/makers/:id', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.patch_makersByid));
router.delete('/bulk/makers/:id', requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.delete_makersByid));
router.post('/bulk/makers/import', requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.post_makers_import));

// ── SFI Details CRUD ──
router.get('/bulk/sfi-details', asyncHandler(ctrl.get_sfi_details));
router.get('/bulk/sfi-details/:id', asyncHandler(ctrl.get_sfi_detailsByid));
router.post('/bulk/sfi-details', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.post_sfi_details));
router.patch('/bulk/sfi-details/:id', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.patch_sfi_detailsByid));
router.delete('/bulk/sfi-details/:id', requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.delete_sfi_detailsByid));
router.post('/bulk/sfi-details/import', requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.post_sfi_details_import));

// ── Locations ──
router.get('/bulk/locations/template', asyncHandler(ctrl.get_locations_template));
router.post('/bulk/locations/import', requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.post_locations_import));
router.post('/bulk/locations/import-stream', requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.doLocationsImportStream));
router.get('/bulk/locations', asyncHandler(ctrl.get_locations));

// Rotation Item Master bulk import (Task #366) — masters first, then component imports
router.get('/bulk/rotational-items/template', asyncHandler(ctrl.get_rotational_items_template));
router.post('/bulk/rotational-items/import-stream', requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.doRotationalItemsImportStream));
router.put('/bulk/locations/:id', requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.put_locationsByid));
router.delete('/bulk/locations/:id', requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.delete_locationsByid));

export default router;
