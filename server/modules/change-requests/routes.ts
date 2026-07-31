import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePermission } from '../../middleware/permissions';
import * as crCtrl from './controllers/changeRequestsController';

const router = Router();

// ── Permission policy (requirePermission, resource 'change-requests') ──
// POST /change-requests → create; status PATCH, comments/attachments POST, and
// approve/reject PUT → edit. GETs stay open. Sail/PMS Admin bypass; unconfigured
// roles fail-open (see middleware).

// ══════════════════════════════════════════════════════════
// Change Requests Routes (/change-requests/*)
// IMPORTANT: Specific paths MUST come before /:id catch-all
// ══════════════════════════════════════════════════════════

// ── Field Definitions & Target Entity (specific paths first) ──
router.get('/change-requests/field-definitions/:targetType', asyncHandler(crCtrl.getFieldDefinitions));
router.get('/change-requests/target-entity/:targetType/:targetId', asyncHandler(crCtrl.getTargetEntity));

// ── List & Create ──
router.get('/change-requests', asyncHandler(crCtrl.getChangeRequests));
router.post('/change-requests', requirePermission('change-requests', 'create'), asyncHandler(crCtrl.createChangeRequest));

// ── Status, Comments, Attachments, Approve, Reject (sub-resource routes before /:id) ──
router.patch('/change-requests/:id/status', requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.updateStatus));
router.get('/change-requests/:id/approval-steps', asyncHandler(crCtrl.getApprovalSteps));
router.get('/change-requests/:id/comments', asyncHandler(crCtrl.getComments));
router.post('/change-requests/:id/comments', requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.createComment));
router.get('/change-requests/:id/attachments', asyncHandler(crCtrl.getAttachments));
router.post('/change-requests/:id/attachments', requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.createAttachment));
router.put('/change-requests/:id/approve', requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.approveChangeRequest));
router.put('/change-requests/:id/reject', requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.rejectChangeRequest));
router.get('/change-requests/:id/rejection-history', asyncHandler(crCtrl.getRejectionHistory));

// ── Get by ID (MUST be last — catch-all) ──
router.get('/change-requests/:id', asyncHandler(crCtrl.getChangeRequest));

export default router;
