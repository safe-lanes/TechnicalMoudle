import { Request, Response } from 'express';
import * as crService from '../services/changeRequestsService';

// ── GET /change-requests/field-definitions/:targetType ──

export async function getFieldDefinitions(req: Request, res: Response) {
  const { targetType } = req.params;
  const editableOnly = req.query.editableOnly === 'true';
  const fields = crService.getFieldDefs(targetType, editableOnly);
  res.json(fields);
}

// ── GET /change-requests/target-entity/:targetType/:targetId ──

export async function getTargetEntity(req: Request, res: Response) {
  const { targetType, targetId } = req.params;
  const result = await crService.getTargetEntity(targetType, targetId);
  res.json(result);
}

// ── GET /change-requests ──

export async function getChangeRequests(req: Request, res: Response) {
  const query = {
    vesselId: req.query.vesselId as string,
    status: req.query.status as string,
    category: req.query.category as string,
    requestedBy: req.query.requestedBy as string,
    periodFrom: req.query.periodFrom as string | undefined,
    periodTo: req.query.periodTo as string | undefined
  };
  const requests = await crService.getChangeRequests(query);
  res.json(requests);
}

// ── GET /change-requests/:id ──

export async function getChangeRequest(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const request = await crService.getChangeRequest(id);
  res.json(request);
}

// ── POST /change-requests ──

export async function createChangeRequest(req: Request, res: Response) {
  const newRequest = await crService.createChangeRequest(req.body);
  res.status(201).json(newRequest);
}

// ── PATCH /change-requests/:id/status ──

export async function updateStatus(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const updated = await crService.updateStatus(id, req.body);
  res.json(updated);
}

// ── GET /change-requests/:id/comments ──

export async function getComments(req: Request, res: Response) {
  const changeRequestId = parseInt(req.params.id);
  const comments = await crService.getComments(changeRequestId);
  res.json(comments);
}

// ── POST /change-requests/:id/comments ──

export async function createComment(req: Request, res: Response) {
  const changeRequestId = parseInt(req.params.id);
  const newComment = await crService.createComment(changeRequestId, req.body);
  res.status(201).json(newComment);
}

// ── GET /change-requests/:id/attachments ──

export async function getAttachments(req: Request, res: Response) {
  const changeRequestId = parseInt(req.params.id);
  const attachments = await crService.getAttachments(changeRequestId);
  res.json(attachments);
}

// ── POST /change-requests/:id/attachments ──

export async function createAttachment(req: Request, res: Response) {
  const changeRequestId = parseInt(req.params.id);
  const newAttachment = await crService.createAttachment(changeRequestId, req.body);
  res.status(201).json(newAttachment);
}

// ── PUT /change-requests/:id/approve ──

export async function approveChangeRequest(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const updated = await crService.approveChangeRequest(id, req.body);
  res.json(updated);
}

// ── PUT /change-requests/:id/reject ──

export async function rejectChangeRequest(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const updated = await crService.rejectChangeRequest(id, req.body);
  res.json(updated);
}

// ── GET /change-requests/:id/rejection-history ──

export async function getRejectionHistory(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const result = await crService.getRejectionHistory(id);
  res.json(result);
}
