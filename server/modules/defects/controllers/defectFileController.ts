import multer from 'multer';
import type { RequestHandler, Request, Response } from 'express';
import { DEFECT_FILE_BYTES, DEFECT_SECTIONS, type DefectFileSection } from '@shared/defectAttachments';
import { tenantStorage, getCurrentTenantContext } from '../../../utils/asyncLocalStorage';
import { defectFileActor, assertDefectFileAccess, fileError } from '../services/defectFileAccess';
import { getDefectFileReadiness, assertLocalC1UploadAvailable } from '../services/defectFileReadiness';
import { stageDefectFile, readStagedDefectFile, stagingNamespace } from '../services/defectFileStaging';
import { defectFileStore, fileHash } from '../services/defectFileStorage';
import { defectFileContent } from '../services/defectFileDownload';
import * as repo from '../repositories/defectsRepository';
import { listDefectPeerReports } from '../services/defectPeerReports';
import { hasExternalDefectFiles } from '../services/defectFileCommit';
import { requirePermission } from '../../../middleware/permissions';

export const fileHandler = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => async (req, res) => {
  try { await fn(req, res); }
  catch (error: any) { res.status(error.statusCode ?? 500).json({ error: error.statusCode ? error.message : 'The file operation failed. Please retry.', code: error.code ?? 'DEFECT_FILE_ERROR' }); }
};
const multipart = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: DEFECT_FILE_BYTES + 1, files: 1, fields: 2, fieldSize: 100, parts: 4,
} }).single('file');
export const authorizeMutation: RequestHandler = async (req, res, next) => {
  try {
    const actor = await defectFileActor(req);
    (req as any).rbac = { role: actor.role, userType: actor.userType, source: 'forwarded' };
    requirePermission('defects-active', req.params.defectId ? 'edit' : 'create', { enforce: true })(req, res, next);
  } catch (error: any) { res.status(error.statusCode ?? 403).json({ error: error.message }); }
};
export const authorizeCommit: RequestHandler = (req, res, next) => {
  if (!hasExternalDefectFiles(req.body) && !req.body?.attachmentCommit) return next();
  // Do not change the permissions of the established inline write path.
  if (req.params.id) req.params.defectId = req.params.id;
  return authorizeMutation(req, res, next);
};
export const uploadBody: RequestHandler = (req, res, next) => {
  // Busboy callbacks may lose the tenant ALS; retain the original context.
  const tenant = getCurrentTenantContext();
  multipart(req, res, error => {
    const resume = () => {
      if (error || !req.file || req.file.size > DEFECT_FILE_BYTES) return res.status(400).json({ error: 'Choose one PDF, JPG or PNG file no larger than 5 MB.' });
      next();
    };
    if (tenant) tenantStorage.run(tenant, resume); else resume();
  });
};
export const stage = fileHandler(async (req, res) => {
  const actor = await defectFileActor(req);
  if (!DEFECT_SECTIONS.includes(req.params.section as DefectFileSection)) throw fileError('Invalid attachment section.');
  // Detect a missing C1 column before a full existing-defect SELECT can fail.
  if (req.params.section === 'part-c1') await assertLocalC1UploadAvailable();
  const current = req.params.defectId ? await repo.getDefect(req.params.defectId) : undefined;
  if (req.params.defectId && !current) throw fileError('Defect not found.', 404);
  res.status(201).json(await stageDefectFile(actor, {
    vesselUuid: req.body.vesselUuid, sessionId: req.body.sessionId, section: req.params.section as DefectFileSection,
  }, req.file!, current));
});
export const readiness = fileHandler(async (req, res) => {
  const actor = await defectFileActor(req);
  const vessel = String(req.query.vesselUuid ?? '');
  await assertDefectFileAccess(actor, vessel);
  res.json({ ...await getDefectFileReadiness(vessel), backend: defectFileStore.backend() });
});
export const peerReports = fileHandler(async (req, res) => {
  const actor = await defectFileActor(req);
  if (actor.userType !== 'Office' || !['sail admin', 'pms admin'].includes(actor.role.replaceAll('_', ' ').toLowerCase())) throw fileError('Office administrator access is required.', 403);
  res.json(await (await import('../../sync/defectFileReadiness')).defectStatusDashboard());
});
export const download = fileHandler(async (req, res) => {
  const actor = await defectFileActor(req);
  const file = await defectFileContent(actor, req.params.defectId, req.params.section as DefectFileSection, req.params.attachmentId);
  res.setHeader('Content-Type', file.type);
  res.setHeader('Content-Disposition', `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.bytes);
});
export const status = fileHandler(async (req, res) => {
  await defectFileContent(await defectFileActor(req), req.params.defectId, req.params.section as DefectFileSection, req.params.attachmentId, true);
  res.json({ state: 'available' });
});
export const stagedDownload = fileHandler(async (req, res) => {
  const actor = await defectFileActor(req);
  const manifest = await readStagedDefectFile(actor, req.params.token, String(req.query.backend));
  if (manifest.sessionId !== req.query.sessionId) throw fileError('This file belongs to another form session.', 403);
  await assertDefectFileAccess(actor, manifest.vesselUuid);
  const bytes = await defectFileStore.read(`${stagingNamespace(actor)}/${manifest.token}.bin`, manifest.attachment.backend, true);
  if (bytes.length !== manifest.attachment.size || fileHash(bytes) !== manifest.attachment.sha256) throw fileError('Staged file integrity check failed.', 409);
  res.setHeader('Content-Type', manifest.attachment.type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(bytes);
});
