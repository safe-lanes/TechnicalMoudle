import { Request, Response } from 'express';
import * as formsService from '../services/formsService';

// ── POST /admin/forms/seed-from-live ──

export async function seedForms(req: Request, res: Response) {
  await formsService.seedForms();
  res.json({ ok: true, message: 'Forms seeded successfully' });
}

// ── GET /admin/forms ──

export async function getFormDefinitions(req: Request, res: Response) {
  const forms = await formsService.getFormDefinitions();
  res.json(forms);
}

// ── GET /admin/forms/:formId/versions ──

export async function getFormVersions(req: Request, res: Response) {
  const formId = req.params.formId;
  const versions = await formsService.getFormVersions(formId);
  res.json(versions);
}

// ── GET /admin/forms/:formId/versions/:versionId ──

export async function getFormVersion(req: Request, res: Response) {
  const versionId = req.params.versionId;
  const version = await formsService.getFormVersion(versionId);
  res.json(version);
}

// ── POST /admin/forms/:formId/versions ──

export async function createDraftVersion(req: Request, res: Response) {
  const formId = req.params.formId;
  const newVersion = await formsService.createDraftVersion(formId, req.body.userId);
  res.json(newVersion);
}

// ── PUT /admin/forms/:formId/versions/:versionId/schema ──

export async function updateDraftSchema(req: Request, res: Response) {
  const versionId = req.params.versionId;
  const updated = await formsService.updateDraftSchema(versionId, req.body.schemaJson);
  res.json(updated);
}

// ── POST /admin/forms/:formId/versions/:versionId/publish ──

export async function publishVersion(req: Request, res: Response) {
  const versionId = req.params.versionId;
  const published = await formsService.publishVersion(versionId, req.body.userId, req.body.changelog);
  res.json(published);
}

// ── POST /admin/forms/:formId/versions/:versionId/discard ──

export async function discardVersion(req: Request, res: Response) {
  const versionId = req.params.versionId;
  await formsService.discardVersion(versionId);
  res.json({ success: true });
}

// ── POST /admin/forms/:formId/versions/:versionId/rollback ──

export async function rollbackVersion(req: Request, res: Response) {
  const formId = req.params.formId;
  const versionId = req.params.versionId;
  const newDraft = await formsService.rollbackToVersion(formId, versionId, req.body.userId);
  res.json(newDraft);
}

// ── GET /forms/runtime/:name ──

export async function getRuntimeSchema(req: Request, res: Response) {
  const { name } = req.params;
  const module = req.headers['x-module'] as string;
  const result = await formsService.getRuntimeSchema(name, module);
  res.json(result);
}
