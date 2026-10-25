/**
 * Job Form "Work Instructions" — PDF attachments on Vessel Jobs (mig 183, 25-Oct-2026).
 * Requirement: Jeevan "Job Form – Work Instructions" §1-§20; decisions D1-D5 (Ghazi):
 *   D1 25 MB max · D3 import by name of an uploaded file · D4 office Job-edit permission · D5 removed links kept.
 *
 * Rules enforced HERE (the only write path):
 *  - office only: ships refuse every write (Work Instructions are managed in the office; they reach the ship by sync)
 *  - PDF only: extension, MIME and the %PDF- signature; size cap
 *  - one ACTIVE file name per vessel; the same file may be linked to many Jobs of that vessel (§6, §18)
 *  - never cross-vessel: the Job, the file and the link all carry the same vessel (§17)
 *  - Vessel Jobs only (§20)
 *  - remove = soft-delete the LINK only; restore = clear it (refusing a duplicate active link) (§7, §8)
 * Storage mirrors components/services/documentService.ts: object storage on Replit, else .private/job-docs —
 * the directory server/modules/sync/fileSyncProcessor.ts uses for this table on both ends.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as repo from '../repositories/jobWorkInstructionRepository';
import { objectStorageClient, ObjectNotFoundError } from '../../../objectStorage';
import { insertJobWorkInstructionFileSchema, insertJobWorkInstructionLinkSchema } from '@shared/schema';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../shared/errors';
import { FileSyncProcessor } from '../../sync/fileSyncProcessor';
import { isShipInstance } from '../../sync/syncRole';

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // D1
const TABLE = 'job_work_instruction_files';
const LOCAL_DIR = path.resolve(process.cwd(), '.private', 'job-docs');

export interface Actor { userUuid: string | null; role: string; userType?: string | null; vesselId?: string | null }

function useObjectStorage(): boolean {
  return !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID && !!process.env.REPL_ID;
}
function localPath(fileKey: string): string { return path.join(LOCAL_DIR, fileKey); }
function saveLocal(buffer: Buffer, fileKey: string): void {
  const p = localPath(fileKey); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buffer);
}
function deleteLocal(fileKey: string): void { try { fs.unlinkSync(localPath(fileKey)); } catch { /* best effort */ } }

/** Work Instructions are written in the office only (requirement §10/§11). */
async function assertOffice(): Promise<void> {
  if (await isShipInstance()) {
    throw new ForbiddenError('Work Instructions are managed in the office. Changes reach this vessel by sync.', { code: 'WORK_INSTRUCTIONS_OFFICE_ONLY' });
  }
}

/** A ship user may only see their own vessel; office users any vessel (same rule as component documents). */
function assertVesselAccess(actor: Actor, vesselId: string): void {
  if ((actor.role === 'Ship' || actor.userType === 'Ship') && actor.vesselId && actor.vesselId !== vesselId) {
    throw new ForbiddenError('Cannot access Work Instructions of another vessel');
  }
}

async function loadVesselJob(jobId: string) {
  const job = await repo.findJob(jobId);
  if (!job) throw new NotFoundError('Job not found');
  if (!job.vesselId) throw new ValidationError('This Job has no vessel; Work Instructions apply to Vessel Jobs only.');
  if (job.dataScope && job.dataScope !== 'vessel') throw new ValidationError('Work Instructions apply to Vessel Jobs only (not Fleet Jobs).');
  return job as typeof job & { vesselId: string };
}

/** Requirement §5: extension, MIME and the file signature must all say PDF. */
export function validatePdf(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }): string {
  const name = sanitizeFileName(file.originalname);
  if (!name.toLowerCase().endsWith('.pdf')) throw new ValidationError('Only PDF documents can be attached as Work Instructions.');
  if (file.mimetype !== 'application/pdf' && file.mimetype !== 'application/x-pdf') throw new ValidationError('The selected file is not a PDF.');
  if (file.size > MAX_PDF_BYTES) throw new ValidationError(`The PDF is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
  if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new ValidationError('The selected file is not a valid PDF.');
  return name;
}

/** Display name: no paths, no control characters; keeps letters, digits, space, dot, dash, underscore, brackets. */
export function sanitizeFileName(original: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() || '';
  const clean = base.replace(/[^A-Za-z0-9 ._()\-]/g, '_').replace(/\s+/g, ' ').trim();
  if (!clean || clean === '.pdf' || clean.startsWith('.')) throw new ValidationError('The file name is not valid.');
  return clean;
}

// ── reads ──────────────────────────────────────────────────────────────────────────────────────

export async function listForJob(jobId: string, actor: Actor, includeRemoved = false) {
  const job = await loadVesselJob(jobId);
  assertVesselAccess(actor, job.vesselId);
  const links = await repo.listLinks(job.juuid, includeRemoved);
  return links.map((l) => ({
    jwluuid: l.jwluuid, jobId: l.jobId, vesselId: l.vesselId, isDeleted: l.isDeleted, attachedAt: l.attachedAt,
    file: l.file ? {
      jwfuuid: l.file.jwfuuid, fileName: l.file.fileName, fileSize: l.file.fileSize, revisionRemarks: l.file.revisionRemarks,
      uploadedAt: l.file.uploadedAt, isDeleted: l.file.isDeleted,
    } : null,
  }));
}

/** The picker for "Attach existing": this vessel's active files (§2, §17). */
export async function listVesselFiles(vesselId: string, actor: Actor) {
  assertVesselAccess(actor, vesselId);
  return repo.listVesselFiles(vesselId);
}

export async function download(jwfuuid: string, actor: Actor): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
  const file = await repo.findFile(jwfuuid);
  if (!file || file.isDeleted) throw new NotFoundError('Work Instruction not found');
  assertVesselAccess(actor, file.vesselId);
  let buffer: Buffer;
  if (file.storageBackend === 'local' || !useObjectStorage()) {
    const p = localPath(file.fileKey);
    if (!fs.existsSync(p)) throw new NotFoundError('The Work Instruction file is not available on this server yet (it arrives by sync).');
    buffer = fs.readFileSync(p);
  } else {
    try {
      const bucket = objectStorageClient.bucket(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!);
      [buffer] = await bucket.file(`.private/job-docs/${file.fileKey}`).download();
    } catch (e) {
      if (e instanceof ObjectNotFoundError) throw new NotFoundError('Work Instruction file not found in storage');
      throw e;
    }
  }
  return { buffer, fileName: file.fileName, contentType: 'application/pdf' };
}

// ── writes (office only) ───────────────────────────────────────────────────────────────────────

/** Upload a new PDF to the Job's vessel and link it to the Job (§5, §6). */
export async function upload(jobId: string, file: Express.Multer.File, actor: Actor, revisionRemarks?: string | null) {
  await assertOffice();
  const job = await loadVesselJob(jobId);
  const fileName = validatePdf(file);
  const existing = await repo.findFileByName(job.vesselId, fileName);
  if (existing) {
    throw new ConflictError(`"${fileName}" already exists for this vessel. Use "Attach existing" to link it, or upload it under a new name (e.g. a revision).`, { code: 'WORK_INSTRUCTION_NAME_EXISTS', fileUuid: existing.jwfuuid });
  }
  const fileKey = `${job.vesselId}/${Date.now()}_${fileName.replace(/[^A-Za-z0-9.\-]/g, '_')}`;
  const storageBackend: 'object' | 'local' = useObjectStorage() ? 'object' : 'local';
  if (storageBackend === 'object') {
    const bucket = objectStorageClient.bucket(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!);
    await bucket.file(`.private/job-docs/${fileKey}`).save(file.buffer, { metadata: { contentType: 'application/pdf' } });
  } else {
    saveLocal(file.buffer, fileKey);
  }
  let created;
  try {
    created = await repo.createFile(insertJobWorkInstructionFileSchema.parse({
      vesselId: job.vesselId, fileName, fileKey, storageBackend, contentType: 'application/pdf', fileSize: file.size,
      revisionRemarks: revisionRemarks?.trim() || null, uploadedByUuid: actor.userUuid, createdByUuid: actor.userUuid, updatedByUuid: actor.userUuid,
    }));
  } catch (e) {
    // never leave an invisible orphan file
    if (storageBackend === 'local') deleteLocal(fileKey);
    else { try { await objectStorageClient.bucket(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!).file(`.private/job-docs/${fileKey}`).delete(); } catch { /* best effort */ } }
    throw e;
  }
  // file bytes reach the ships through the existing file sync queue (best effort — never blocks the upload)
  try { await FileSyncProcessor.queueFileForSync(TABLE, created.jwfuuid, created.fileKey, created.fileName, created.fileSize ?? null, created.vesselId); }
  catch (e) { console.error('[JobWorkInstructions] file sync queue failed (non-fatal):', e); }
  const link = await attachFileToJob(job, created.jwfuuid, actor);
  return { file: created, link };
}

/** Link an existing file of the same vessel to the Job (§2 "attach existing", §17). */
export async function attach(jobId: string, fileUuid: string, actor: Actor) {
  await assertOffice();
  const job = await loadVesselJob(jobId);
  return attachFileToJob(job, fileUuid, actor);
}

async function attachFileToJob(job: { juuid: string; vesselId: string }, fileUuid: string, actor: Actor) {
  const file = await repo.findFile(fileUuid);
  if (!file || file.isDeleted) throw new NotFoundError('Work Instruction file not found');
  if (file.vesselId !== job.vesselId) throw new ForbiddenError('This Work Instruction belongs to another vessel.', { code: 'WORK_INSTRUCTION_OTHER_VESSEL' });
  const active = await repo.findActiveLink(job.juuid, fileUuid);
  if (active) throw new ConflictError(`"${file.fileName}" is already attached to this Job.`, { code: 'WORK_INSTRUCTION_ALREADY_ATTACHED' });
  return repo.createLink(insertJobWorkInstructionLinkSchema.parse({
    jobId: job.juuid, fileUuid, vesselId: job.vesselId, attachedByUuid: actor.userUuid, createdByUuid: actor.userUuid, updatedByUuid: actor.userUuid,
  }));
}

/** Remove = soft-delete the link only (§7). Other Jobs using the same file are untouched. */
export async function remove(jobId: string, jwluuid: string, actor: Actor) {
  await assertOffice();
  const job = await loadVesselJob(jobId);
  const link = await repo.findLink(jwluuid);
  if (!link || link.jobId !== job.juuid) throw new NotFoundError('Work Instruction link not found on this Job');
  if (link.isDeleted) return link;
  return repo.setLinkDeleted(jwluuid, true, actor.userUuid);
}

/** Restore a removed link (§8): the file must still be active, and no active duplicate may exist. */
export async function restore(jobId: string, jwluuid: string, actor: Actor) {
  await assertOffice();
  const job = await loadVesselJob(jobId);
  const link = await repo.findLink(jwluuid);
  if (!link || link.jobId !== job.juuid) throw new NotFoundError('Work Instruction link not found on this Job');
  if (!link.isDeleted) return link;
  const file = await repo.findFile(link.fileUuid);
  if (!file || file.isDeleted) throw new ConflictError('This Work Instruction file is no longer available and cannot be restored.', { code: 'WORK_INSTRUCTION_FILE_GONE' });
  if (await repo.findActiveLink(job.juuid, link.fileUuid)) throw new ConflictError(`"${file.fileName}" is already attached to this Job.`, { code: 'WORK_INSTRUCTION_ALREADY_ATTACHED' });
  return repo.setLinkDeleted(jwluuid, false, actor.userUuid);
}

/** Work Order view (§15/§16): the linked Job's CURRENT active links — never a copy on the WO. */
export async function listForWorkOrder(workOrderJobId: string | null | undefined, actor: Actor) {
  if (!workOrderJobId) return [];
  return listForJob(workOrderJobId, actor, false);
}
