import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requirePermission } from '../../middleware/permissions';
import { requireRole, requireApproverOrRole } from '../../middleware/auth';
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
// Phase 0 / P0.4 (defect D4): deciding a CR is an office action — the forwarded identity must be
// Office-typed (or a named admin); vessel ranks and anonymous callers are refused (403). The
// existing requirePermission stays; its enforcement on the real role (incl. unconfigured → deny)
// is NOT switched on here — see PHASE0-REPORT.md (dev data has no 'change-requests' rows for any
// configured role; enforcing would 403 office approvers). Flip = { enforce: true, unconfigured: 'deny' }.
// F5: requireApproverOrRole restores the legacy contract — a configured active approver may
// decide even if their forwarded SAILERP type isn't Office (the P0.4 requireRole broke this).
router.put('/change-requests/:id/approve', requireApproverOrRole(['Office', 'PMS Admin', 'Sail Admin']), requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.approveChangeRequest));
router.put('/change-requests/:id/reject', requireApproverOrRole(['Office', 'PMS Admin', 'Sail Admin']), requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.rejectChangeRequest));
router.get('/change-requests/:id/rejection-history', asyncHandler(crCtrl.getRejectionHistory));

// ── Get by ID (MUST be last — catch-all) ──
router.get('/change-requests/:id', asyncHandler(crCtrl.getChangeRequest));

export default router;
