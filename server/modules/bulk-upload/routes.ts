import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controllers/bulkController';

const router = Router();

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
router.post('/bulk/sheets', upload.single('file'), asyncHandler(ctrl.getSheets));

// ── Dry-Run & Import ──
router.post('/bulk/dry-run', upload.single('file'), asyncHandler(ctrl.dryRun));
router.post('/bulk/import', asyncHandler(ctrl.doImport));

// ── History (specific routes before parameterized) ──
router.get('/bulk/history', asyncHandler(ctrl.getHistoryList));
router.get('/bulk/history/:id/download-original', asyncHandler(ctrl.downloadOriginal));
router.get('/bulk/history/:id/:fileType', asyncHandler(ctrl.getHistoryFileHandler));

// ── Undo ──
router.post('/bulk/undo/:historyId', asyncHandler(ctrl.undoImport));

// ── Makers CRUD ──
router.get('/bulk/makers/export', asyncHandler(ctrl.get_makers_export));
router.get('/bulk/makers', asyncHandler(ctrl.get_makers));
router.get('/bulk/makers/:id', asyncHandler(ctrl.get_makersByid));
router.post('/bulk/makers', asyncHandler(ctrl.post_makers));
router.patch('/bulk/makers/:id', asyncHandler(ctrl.patch_makersByid));
router.delete('/bulk/makers/:id', asyncHandler(ctrl.delete_makersByid));
router.post('/bulk/makers/import', upload.single('file'), asyncHandler(ctrl.post_makers_import));

// ── SFI Details CRUD ──
router.get('/bulk/sfi-details', asyncHandler(ctrl.get_sfi_details));
router.get('/bulk/sfi-details/:id', asyncHandler(ctrl.get_sfi_detailsByid));
router.post('/bulk/sfi-details', asyncHandler(ctrl.post_sfi_details));
router.patch('/bulk/sfi-details/:id', asyncHandler(ctrl.patch_sfi_detailsByid));
router.delete('/bulk/sfi-details/:id', asyncHandler(ctrl.delete_sfi_detailsByid));
router.post('/bulk/sfi-details/import', upload.single('file'), asyncHandler(ctrl.post_sfi_details_import));

// ── Locations ──
router.get('/bulk/locations/template', asyncHandler(ctrl.get_locations_template));
router.post('/bulk/locations/import', upload.single('file'), asyncHandler(ctrl.post_locations_import));
router.get('/bulk/locations', asyncHandler(ctrl.get_locations));
router.put('/bulk/locations/:id', asyncHandler(ctrl.put_locationsByid));
router.delete('/bulk/locations/:id', asyncHandler(ctrl.delete_locationsByid));

export default router;
