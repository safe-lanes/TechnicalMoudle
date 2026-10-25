// Job Work Instructions (mig 183) — parse input, call the service, shape the response. Errors carrying a statusCode
// (the service's NotFound / Validation / Conflict / Forbidden) are turned into responses by asyncHandler.
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import * as svc from '../services/jobWorkInstructionService';
import * as woRepo from '../../work-orders/repositories/workOrderRepository';

function actor(req: Request): svc.Actor {
  const r = req as AuthenticatedRequest;
  return {
    userUuid: r.user?.userUuid ?? null,
    role: r.rbac?.role ?? r.user?.role ?? '',
    userType: r.rbac?.userType ?? r.user?.userType ?? null,
    vesselId: r.user?.vesselId ?? null,
  };
}

// GET /jobs/:id/work-instructions?includeRemoved=1
export async function list(req: Request, res: Response) {
  const includeRemoved = req.query.includeRemoved === '1' || req.query.includeRemoved === 'true';
  res.json(await svc.listForJob(req.params.id, actor(req), includeRemoved));
}

// GET /vessels/:vesselId/work-instruction-files — the "attach existing" picker
export async function listVesselFiles(req: Request, res: Response) {
  res.json(await svc.listVesselFiles(req.params.vesselId, actor(req)));
}

// POST /jobs/:id/work-instructions/upload (multipart: file, revisionRemarks?)
export async function upload(req: Request, res: Response) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: 'No file received. Choose a PDF to upload.' });
  const result = await svc.upload(req.params.id, file, actor(req), typeof req.body?.revisionRemarks === 'string' ? req.body.revisionRemarks : null);
  res.status(201).json(result);
}

// POST /jobs/:id/work-instructions/attach { fileUuid }
export async function attach(req: Request, res: Response) {
  const fileUuid = typeof req.body?.fileUuid === 'string' ? req.body.fileUuid : '';
  if (!fileUuid) return res.status(400).json({ error: 'fileUuid is required' });
  res.status(201).json(await svc.attach(req.params.id, fileUuid, actor(req)));
}

// DELETE /jobs/:id/work-instructions/:jwluuid — remove the link (soft)
export async function remove(req: Request, res: Response) {
  res.json(await svc.remove(req.params.id, req.params.jwluuid, actor(req)));
}

// POST /jobs/:id/work-instructions/:jwluuid/restore
export async function restore(req: Request, res: Response) {
  res.json(await svc.restore(req.params.id, req.params.jwluuid, actor(req)));
}

// GET /work-instruction-files/:jwfuuid/download
export async function download(req: Request, res: Response) {
  const { buffer, fileName, contentType } = await svc.download(req.params.jwfuuid, actor(req));
  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${fileName.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
}

// GET /work-orders/:workOrderId/work-instructions — the linked Job's CURRENT links (read-only view)
export async function listForWorkOrder(req: Request, res: Response) {
  const wo = await woRepo.findById(req.params.workOrderId);
  if (!wo) return res.status(404).json({ error: 'Work order not found' });
  res.json(await svc.listForWorkOrder(wo.jobId, actor(req)));
}
