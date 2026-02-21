import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as defectsCtrl from './controllers/defectsController';
import * as adminCtrl from './controllers/defectAdminController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Defects Routes
// IMPORTANT: Specific paths MUST come before /:id catch-all
// to prevent Express from matching "coc", "recurring", etc. as :id
// ══════════════════════════════════════════════════════════

// ── Defects: Specific paths (MUST be before /:id) ──

// GET  /defects — get all defects with optional filters
router.get('/defects', asyncHandler(defectsCtrl.getDefects));

// GET  /defects/coc — CoC-specific defects
router.get('/defects/coc', asyncHandler(defectsCtrl.getCocDefects));

// GET  /defects/recurring — recurring defects shortcut
router.get('/defects/recurring', asyncHandler(defectsCtrl.getRecurringDefectsShortcut));

// GET  /defects/count — defects count with filters
router.get('/defects/count', asyncHandler(defectsCtrl.getDefectsCount));

// GET  /defects/count/recurring — recurring defects count
router.get('/defects/count/recurring', asyncHandler(defectsCtrl.getRecurringDefectsCount));

// POST /defects — create new defect
router.post('/defects', asyncHandler(defectsCtrl.createDefect));

// POST /defects/reports/:reportKey — generate defect report
router.post('/defects/reports/:reportKey', asyncHandler(defectsCtrl.generateReport));

// ── Defects: Action-specific paths (BEFORE /:id catch-all) ──

// PATCH /defects/actions/:actionId — update defect action
router.patch('/defects/actions/:actionId', asyncHandler(defectsCtrl.updateDefectAction));

// DELETE /defects/actions/:actionId — delete defect action
router.delete('/defects/actions/:actionId', asyncHandler(defectsCtrl.deleteDefectAction));

// ── Defects: Attachment-specific paths (BEFORE /:id catch-all) ──

// DELETE /defects/attachments/:attachmentId — delete defect attachment
router.delete('/defects/attachments/:attachmentId', asyncHandler(defectsCtrl.deleteDefectAttachment));

// ── Defects: Parameterized routes (CATCH-ALL — must be last) ──

// GET    /defects/:id — get single defect
router.get('/defects/:id', asyncHandler(defectsCtrl.getDefect));

// PATCH  /defects/:id — update defect
router.patch('/defects/:id', asyncHandler(defectsCtrl.updateDefect));

// DELETE /defects/:id — delete defect
router.delete('/defects/:id', asyncHandler(defectsCtrl.deleteDefect));

// ── Defects: Sub-resource routes (using :defectId / :id) ──

// GET  /defects/:defectId/actions — get defect actions
router.get('/defects/:defectId/actions', asyncHandler(defectsCtrl.getDefectActions));

// POST /defects/:defectId/actions — create defect action
router.post('/defects/:defectId/actions', asyncHandler(defectsCtrl.createDefectAction));

// GET  /defects/:defectId/attachments — get defect attachments
router.get('/defects/:defectId/attachments', asyncHandler(defectsCtrl.getDefectAttachments));

// POST /defects/:defectId/attachments — create defect attachment
router.post('/defects/:defectId/attachments', asyncHandler(defectsCtrl.createDefectAttachment));

// POST /defects/:id/notes — add note to defect
router.post('/defects/:id/notes', asyncHandler(defectsCtrl.addDefectNote));

// PATCH /defects/:id/link — link related defects
router.patch('/defects/:id/link', asyncHandler(defectsCtrl.linkDefects));

// PATCH /defects/:id/close — close defect
router.patch('/defects/:id/close', asyncHandler(defectsCtrl.closeDefect));

// ══════════════════════════════════════════════════════════
// Standalone Defect Routes (different URL prefixes)
// ══════════════════════════════════════════════════════════

// DELETE /defects-clear-all — reserved for admin/testing
router.delete('/defects-clear-all', asyncHandler(defectsCtrl.clearAllDefects));

// POST /defects-seed-e2e-test — reserved for testing
router.post('/defects-seed-e2e-test', asyncHandler(defectsCtrl.seedE2eTest));

// GET /defects-count — get active/resolved counts
router.get('/defects-count', asyncHandler(defectsCtrl.getDefectsCountSummary));

// ══════════════════════════════════════════════════════════
// Defect Categories Routes
// ══════════════════════════════════════════════════════════

router.get('/defect-categories', asyncHandler(adminCtrl.getCategories));
router.post('/defect-categories', asyncHandler(adminCtrl.createCategory));
router.patch('/defect-categories/:id', asyncHandler(adminCtrl.updateCategory));
router.delete('/defect-categories/:id', asyncHandler(adminCtrl.deleteCategory));

// ══════════════════════════════════════════════════════════
// Defect Types Routes
// ══════════════════════════════════════════════════════════

router.get('/defect-types', asyncHandler(adminCtrl.getTypes));
router.post('/defect-types', asyncHandler(adminCtrl.createType));
router.patch('/defect-types/:id', asyncHandler(adminCtrl.updateType));
router.delete('/defect-types/:id', asyncHandler(adminCtrl.deleteType));

// ══════════════════════════════════════════════════════════
// Recurring Defects Routes
// IMPORTANT: /recurring-defects/recalculate MUST be before /:id
// ══════════════════════════════════════════════════════════

// POST /recurring-defects/recalculate — trigger recalculation
router.post('/recurring-defects/recalculate', asyncHandler(defectsCtrl.recalculateRecurringDefects));

// GET  /recurring-defects — get all recurring defects (with auto-calculation)
router.get('/recurring-defects', asyncHandler(defectsCtrl.getRecurringDefects));

// GET  /recurring-defects/:id — get specific recurring defect
router.get('/recurring-defects/:id', asyncHandler(defectsCtrl.getRecurringDefect));

// GET  /recurring-defects/:id/defects — get defects linked to recurring defect
router.get('/recurring-defects/:id/defects', asyncHandler(defectsCtrl.getDefectsForRecurring));

export default router;
