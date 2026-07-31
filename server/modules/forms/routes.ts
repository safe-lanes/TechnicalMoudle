import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePermission } from '../../middleware/permissions';
import * as formsCtrl from './controllers/formsController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Forms Routes
// Admin: /admin/forms/*
// Runtime: /forms/runtime/*
// ── Permission policy (requirePermission, resource 'admin-forms') ──
// Seed and create-version use any-of ['create','edit']; schema PUT, publish,
// discard, rollback → 'edit'. Runtime GET stays open. Sail/PMS Admin bypass;
// unconfigured roles fail-open (see middleware).
// ══════════════════════════════════════════════════════════

// ── Admin: Seed ──
router.post('/admin/forms/seed-from-live', requirePermission('admin-forms', ['create', 'edit']), asyncHandler(formsCtrl.seedForms));

// ── Admin: List & Versions ──
router.get('/admin/forms', asyncHandler(formsCtrl.getFormDefinitions));
router.get('/admin/forms/:formId/versions', asyncHandler(formsCtrl.getFormVersions));
router.get('/admin/forms/:formId/versions/:versionId', asyncHandler(formsCtrl.getFormVersion));
router.post('/admin/forms/:formId/versions', requirePermission('admin-forms', ['create', 'edit']), asyncHandler(formsCtrl.createDraftVersion));

// ── Admin: Version Operations ──
router.put('/admin/forms/:formId/versions/:versionId/schema', requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.updateDraftSchema));
router.post('/admin/forms/:formId/versions/:versionId/publish', requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.publishVersion));
router.post('/admin/forms/:formId/versions/:versionId/discard', requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.discardVersion));
router.post('/admin/forms/:formId/versions/:versionId/rollback', requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.rollbackVersion));

// ── Runtime: Get Published Schema ──
router.get('/forms/runtime/:name', asyncHandler(formsCtrl.getRuntimeSchema));

export default router;
