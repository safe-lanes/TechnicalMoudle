import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import * as crCtrl from './controllers/changeRequestsController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Change Requests Routes (/change-requests/*)
// IMPORTANT: Specific paths MUST come before /:id catch-all
// ══════════════════════════════════════════════════════════

// ── Field Definitions & Target Entity (specific paths first) ──
router.get('/change-requests/field-definitions/:targetType', asyncHandler(crCtrl.getFieldDefinitions));
router.get('/change-requests/target-entity/:targetType/:targetId', asyncHandler(crCtrl.getTargetEntity));

// ── List & Create ──
router.get('/change-requests', asyncHandler(crCtrl.getChangeRequests));
router.post('/change-requests', asyncHandler(crCtrl.createChangeRequest));

// ── Status, Comments, Attachments, Approve, Reject (sub-resource routes before /:id) ──
router.patch('/change-requests/:id/status', asyncHandler(crCtrl.updateStatus));
router.get('/change-requests/:id/comments', asyncHandler(crCtrl.getComments));
router.post('/change-requests/:id/comments', asyncHandler(crCtrl.createComment));
router.get('/change-requests/:id/attachments', asyncHandler(crCtrl.getAttachments));
router.post('/change-requests/:id/attachments', asyncHandler(crCtrl.createAttachment));
router.put('/change-requests/:id/approve', asyncHandler(crCtrl.approveChangeRequest));
router.put('/change-requests/:id/reject', asyncHandler(crCtrl.rejectChangeRequest));

// ── Get by ID (MUST be last — catch-all) ──
router.get('/change-requests/:id', asyncHandler(crCtrl.getChangeRequest));

export default router;
