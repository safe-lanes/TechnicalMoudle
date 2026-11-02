import { and, eq } from 'drizzle-orm';
import { syncFileQueue } from '@shared/schema';
import { DEFECT_SECTION_FIELDS, isExternalDefectAttachment, validateDefectFileKey, type DefectFileSection } from '@shared/defectAttachments';
import { getDb } from '../../../db';
import { assertDefectFileAccess, fileError, type DefectFileActor } from './defectFileAccess';
import { defectFileStore, fileHash } from './defectFileStorage';
import * as repo from '../repositories/defectsRepository';

export async function defectFileContent(actor: DefectFileActor, defectId: string, section: DefectFileSection, attachmentId: string, statusOnly = false) {
  const current = await repo.getDefect(defectId);
  if (!current) throw fileError('Defect not found.', 404);
  await assertDefectFileAccess(actor, current.vesselId);
  const field = DEFECT_SECTION_FIELDS[section];
  if (!field) throw fileError('Invalid attachment section.');
  const matches = (current[field] ?? []).filter(file => file.id === attachmentId);
  if (matches.length !== 1) throw fileError('Attachment not found or identity is ambiguous.', 404);
  const file = matches[0];
  if (!isExternalDefectAttachment(file)) {
    const match = /^data:(application\/pdf|image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(file.data);
    if (!match) throw fileError('Legacy file content is unavailable.', 404);
    return { name: file.name, type: match[1], bytes: Buffer.from(match[2], 'base64') };
  }
  let bytes: Buffer;
  const key = validateDefectFileKey(file.fileKey);
  if (key.defect !== current.duuid || key.vessel !== current.vesselId || key.section !== section || key.id !== file.id) {
    throw fileError('The file identity does not belong to this defect and section.', 403);
  }
  if (statusOnly) {
    const rows = await (await getDb()).select({ status: syncFileQueue.status }).from(syncFileQueue).where(and(
      eq(syncFileQueue.tableName, 'defects'), eq(syncFileQueue.rowUuid, current.duuid), eq(syncFileQueue.fileKey, file.fileKey)));
    if (rows.some(q => ['failed', 'dead_letter', 'unsendable'].includes(q.status))) throw fileError('Transfer failed – contact support', 409, 'DEFECT_FILE_TRANSFER_FAILED');
  }
  try { bytes = await (await import('../../sync/defectFileProtocol')).readDefectTransferBytes(file); }
  catch (error: any) {
    if (error.code !== 'ENOENT' && error.code !== 404) throw error;
    const db = await getDb();
    const queues = await db.select({ status: syncFileQueue.status }).from(syncFileQueue).where(and(
      eq(syncFileQueue.tableName, 'defects'), eq(syncFileQueue.rowUuid, current.duuid), eq(syncFileQueue.fileKey, file.fileKey),
    ));
    const failed = queues.some(row => ['failed', 'dead_letter', 'unsendable'].includes(row.status));
    throw fileError(failed ? 'Transfer failed – contact support' : 'Awaiting synchronization', 409,
      failed ? 'DEFECT_FILE_TRANSFER_FAILED' : 'DEFECT_FILE_PENDING');
  }
  if (bytes.length !== file.size || fileHash(bytes) !== file.sha256) throw fileError('Transfer failed – contact support', 409, 'DEFECT_FILE_TRANSFER_FAILED');
  return { name: file.name, type: file.type, bytes };
}
