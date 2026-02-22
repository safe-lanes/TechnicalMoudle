import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as formsCtrl from './controllers/formsController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Forms Routes
// Admin: /admin/forms/*
// Runtime: /forms/runtime/*
// ══════════════════════════════════════════════════════════

// ── Admin: Seed ──
router.post('/admin/forms/seed-from-live', asyncHandler(formsCtrl.seedForms));

// ── Admin: List & Versions ──
router.get('/admin/forms', asyncHandler(formsCtrl.getFormDefinitions));
router.get('/admin/forms/:formId/versions', asyncHandler(formsCtrl.getFormVersions));
router.get('/admin/forms/:formId/versions/:versionId', asyncHandler(formsCtrl.getFormVersion));
router.post('/admin/forms/:formId/versions', asyncHandler(formsCtrl.createDraftVersion));

// ── Admin: Version Operations ──
router.put('/admin/forms/:formId/versions/:versionId/schema', asyncHandler(formsCtrl.updateDraftSchema));
router.post('/admin/forms/:formId/versions/:versionId/publish', asyncHandler(formsCtrl.publishVersion));
router.post('/admin/forms/:formId/versions/:versionId/discard', asyncHandler(formsCtrl.discardVersion));
router.post('/admin/forms/:formId/versions/:versionId/rollback', asyncHandler(formsCtrl.rollbackVersion));

// ── Runtime: Get Published Schema ──
router.get('/forms/runtime/:name', asyncHandler(formsCtrl.getRuntimeSchema));

export default router;
