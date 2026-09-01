import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import * as jobCtrl from './controllers/jobController';

const router = Router();

// ── Permission policy (requirePermission, resource 'pms-modify-pms') ──
// Job writes gated by method: POST=create, PATCH=edit, DELETE=delete, inactivate=edit.
// generate-wo is LEFT OPEN (work-order operational path, out of scope). GETs stay open.
// Sail/PMS Admin bypass; unconfigured roles fail-open (see middleware).

// ── Core Job CRUD ──

// GET  /jobs — list all (optional ?vesselId= &componentId= filters)
router.get('/jobs', asyncHandler(jobCtrl.listJobs));

// GET  /jobs/:id — get single job
router.get('/jobs/:id', asyncHandler(jobCtrl.getJob));

// GET  /jobs/:id/context — get job context (template data, component, parent, work history)
router.get('/jobs/:id/context', asyncHandler(jobCtrl.getJobContext));

// POST /jobs — create job
router.post('/jobs', requirePermission('pms-modify-pms', 'create'), asyncHandler(jobCtrl.createJob));

// PATCH /jobs/:id — update job
router.patch('/jobs/:id', requirePermission('pms-modify-pms', 'edit'), asyncHandler(jobCtrl.updateJob));

// DELETE /jobs/:id — delete job
router.delete('/jobs/:id', requirePermission('pms-modify-pms', 'delete'), asyncHandler(jobCtrl.deleteJob));

// POST /jobs/:id/inactivate — deactivate a Job while retaining it for Office users
router.post('/jobs/:id/inactivate', requirePermission('pms-modify-pms', 'edit'), asyncHandler(jobCtrl.inactivateJob));

// ── Generate Work Order ──

// POST /jobs/:id/generate-wo — generate work order on demand
router.post('/jobs/:id/generate-wo', asyncHandler(jobCtrl.generateWorkOrder));

// POST /jobs/:id/rebaseline-tracking — shore Sail Admin / Super Admin ONLY. Stamps
// tracking_rebaselined_at (migration 161) on the job + its component links so the next
// shore→ship sync is AUTHORIZED to overwrite the ship's tracking columns (escape hatch
// for the one-way applier's job-tracking guard).
router.post('/jobs/:id/rebaseline-tracking', requirePermission('pms-modify-pms', 'edit'), asyncHandler(jobCtrl.rebaselineJobTracking));

// ── Maintenance Planner ──

// GET /maintenance-planner — planner data with filters
router.get('/maintenance-planner', asyncHandler(jobCtrl.getMaintenancePlanner));

// GET /maintenance-planner/export — export planner as Excel/JSON
router.get('/maintenance-planner/export', asyncHandler(jobCtrl.exportMaintenancePlanner));

// ── Job Maintenance History ──

// GET /job-maintenance-history/:jobId — requires auth, vessel-scoped
router.get('/job-maintenance-history/:jobId', requireAuth, asyncHandler(jobCtrl.getJobMaintenanceHistory));

export default router;
