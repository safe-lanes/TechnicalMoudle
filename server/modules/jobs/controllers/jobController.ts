import { Request, Response } from 'express';
import * as jobService from '../services/jobService';
import * as jobContextService from '../services/jobContextService';
import * as maintenancePlannerService from '../services/maintenancePlannerService';
import type { AuthenticatedRequest } from '../../../middleware/auth';

// ── Job CRUD ──

export async function listJobs(req: Request, res: Response) {
  const vesselId = req.query.vesselId as string | undefined;
  const componentId = req.query.componentId as string | undefined;
  const jobs = await jobService.listJobs(vesselId, componentId);
  res.json(jobs);
}

export async function getJob(req: Request, res: Response) {
  const job = await jobService.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
}

export async function getJobContext(req: Request, res: Response) {
  const context = await jobContextService.getJobContext(req.params.id);
  res.json(context);
}

export async function createJob(req: Request, res: Response) {
  const job = await jobService.createJob(req.body);
  res.status(201).json(job);
}

export async function updateJob(req: Request, res: Response) {
  const job = await jobService.updateJob(req.params.id, req.body);
  res.json(job);
}

export async function deleteJob(req: Request, res: Response) {
  await jobService.deleteJob(req.params.id);
  res.status(204).send();
}

export async function inactivateJob(req: Request, res: Response) {
  const { vesselId } = req.body;
  if (!vesselId) {
    return res.status(400).json({ error: 'vesselId is required' });
  }
  const result = await jobService.inactivateJob(req.params.id, vesselId);
  res.json(result);
}

// ── Maintenance Planner ──

export async function getMaintenancePlanner(req: Request, res: Response) {
  const result = await maintenancePlannerService.getMaintenancePlannerData({
    vesselId: req.query.vesselId as string,
    jobType: req.query.jobType as string | undefined,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
    remainingHoursMin: req.query.remainingHoursMin as string | undefined,
    remainingHoursMax: req.query.remainingHoursMax as string | undefined,
    includeOverdue: req.query.includeOverdue as string | undefined,
    includeGrace: req.query.includeGrace as string | undefined,
    ranks: req.query.ranks as string | undefined,
    department: req.query.department as string | undefined,
    criticalOnly: req.query.criticalOnly as string | undefined
  });
  res.json(result);
}

export async function exportMaintenancePlanner(req: Request, res: Response) {
  const format = req.query.format as string || 'excel';
  const result = await maintenancePlannerService.exportMaintenancePlanner(
    {
      vesselId: req.query.vesselId as string,
      jobType: req.query.jobType as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      remainingHoursMin: req.query.remainingHoursMin as string | undefined,
      remainingHoursMax: req.query.remainingHoursMax as string | undefined,
      includeOverdue: req.query.includeOverdue as string | undefined,
      includeGrace: req.query.includeGrace as string | undefined,
      ranks: req.query.ranks as string | undefined,
      department: req.query.department as string | undefined,
      criticalOnly: req.query.criticalOnly as string | undefined
    },
    format
  );

  if (result.type === 'excel') {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } else {
    res.json(result.data);
  }
}

// ── Job Maintenance History ──

export async function getJobMaintenanceHistory(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user!;
  const history = await jobService.getJobMaintenanceHistory(req.params.jobId, {
    username: user.username,
    role: user.role,
    vesselId: user.vesselId ?? undefined
  });
  res.json(history);
}

// ── Generate Work Order ──

export async function generateWorkOrder(req: Request, res: Response) {
  const { reason, activeComponentCode } = req.body;
  const result = await jobService.generateWorkOrder(req.params.id, reason, activeComponentCode);

  if (!result.success) {
    // Return HTTP 400 with blocking WO details for duplicate detection
    return res.status(400).json(result);
  }

  res.status(201).json(result.workOrder);
}
