import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import * as jobCtrl from './controllers/jobController';
import * as jwiCtrl from './controllers/jobWorkInstructionController';
import multer from 'multer';
import { MAX_PDF_BYTES } from './services/jobWorkInstructionService';

const router = Router();

// ── Permission policy (requirePermission, resource 'pms-modify-pms') ──
// Job writes gated by method: POST=create, PATCH=edit, DELETE=delete, inactivate=edit.
// generate-wo is LEFT OPEN (work-order operational path, out of scope). GETs stay open.
// Sail/PMS Admin bypass; unconfigured roles fail-open (see middleware).

// ── Core Job CRUD ──

// GET  /jobs — list all (optional ?vesselId= &componentId= filters)
router.get('/jobs', asyncHandler(jobCtrl.listJobs));

// ── Work Instructions (mig 183, 25-Oct-2026) — PDF attachments on Vessel Jobs ──
// Writes = office only (the service refuses on a ship) + the Job-edit permission (D4). Reads open (vessel access
// checked in the service). Registered BEFORE GET /jobs/:id; the sub-paths cannot collide with it.
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PDF_BYTES } });
const jwiWrite = requirePermission('pms-modify-pms', 'edit');
router.get('/jobs/:id/work-instructions', asyncHandler(jwiCtrl.list));
router.post('/jobs/:id/work-instructions/upload', jwiWrite, pdfUpload.single('file'), asyncHandler(jwiCtrl.upload));
router.post('/jobs/:id/work-instructions/attach', jwiWrite, asyncHandler(jwiCtrl.attach));
router.post('/jobs/:id/work-instructions/:jwluuid/restore', jwiWrite, asyncHandler(jwiCtrl.restore));
router.delete('/jobs/:id/work-instructions/:jwluuid', jwiWrite, asyncHandler(jwiCtrl.remove));
router.get('/vessels/:vesselId/work-instruction-files', asyncHandler(jwiCtrl.listVesselFiles));
// Many PDFs for a vessel in one go (Bulk Upload screen). multer rejects the whole request on an oversize file, so
// say which limit was hit instead of a bare 500.
const pdfMultiUpload = (req: any, res: any, next: any) => pdfUpload.array('files', 100)(req, res, (err: any) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `One of the files is larger than ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB. Remove it and upload again.` });
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Too many files in one upload (maximum 100). Upload in batches.' });
  return next(err);
});
router.post('/vessels/:vesselId/work-instruction-files/upload', jwiWrite, pdfMultiUpload, asyncHandler(jwiCtrl.uploadVesselFiles));
router.get('/work-instruction-files/:jwfuuid/download', asyncHandler(jwiCtrl.download));

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
