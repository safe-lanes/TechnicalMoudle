import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requireAuth } from '../../middleware/auth';
import * as jobCtrl from './controllers/jobController';

const router = Router();

// ── Core Job CRUD ──

// GET  /jobs — list all (optional ?vesselId= &componentId= filters)
router.get('/jobs', asyncHandler(jobCtrl.listJobs));

// GET  /jobs/:id — get single job
router.get('/jobs/:id', asyncHandler(jobCtrl.getJob));

// GET  /jobs/:id/context — get job context (template data, component, parent, work history)
router.get('/jobs/:id/context', asyncHandler(jobCtrl.getJobContext));

// POST /jobs — create job
router.post('/jobs', asyncHandler(jobCtrl.createJob));

// PATCH /jobs/:id — update job
router.patch('/jobs/:id', asyncHandler(jobCtrl.updateJob));

// DELETE /jobs/:id — delete job
router.delete('/jobs/:id', asyncHandler(jobCtrl.deleteJob));

// POST /jobs/:id/inactivate — soft delete (deactivate) job
router.post('/jobs/:id/inactivate', asyncHandler(jobCtrl.inactivateJob));

// ── Generate Work Order ──

// POST /jobs/:id/generate-wo — generate work order on demand
router.post('/jobs/:id/generate-wo', asyncHandler(jobCtrl.generateWorkOrder));

// ── Maintenance Planner ──

// GET /maintenance-planner — planner data with filters
router.get('/maintenance-planner', asyncHandler(jobCtrl.getMaintenancePlanner));

// GET /maintenance-planner/export — export planner as Excel/JSON
router.get('/maintenance-planner/export', asyncHandler(jobCtrl.exportMaintenancePlanner));

// ── Job Maintenance History ──

// GET /job-maintenance-history/:jobId — requires auth, vessel-scoped
router.get('/job-maintenance-history/:jobId', requireAuth, asyncHandler(jobCtrl.getJobMaintenanceHistory));

export default router;
