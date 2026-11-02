import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { auditLog, defects, syncFileQueue, syncSettings } from '@shared/schema';
import { DEFECT_FILE_BYTES, DEFECT_SECTION_FIELDS, isExternalDefectAttachment, isUuid, validateDefectFileKey, type ExternalDefectAttachment } from '@shared/defectAttachments';
import { getDb } from '../../db';
import { getEffectiveInstanceId, isShipInstance } from './syncRole';
import { defectFileStore, fileHash } from '../defects/services/defectFileStorage';
import { fileError } from '../defects/services/defectFileAccess';
import { defectReadiness } from './defectFileReadiness';

export const DEFECT_CHUNK_BYTES = 64 * 1024;
export const RECEIPT_PREFIX = 'defects_file_receipt:';
export interface DefectFileDescriptor {
  queueUuid: string; rowUuid: string; vesselId: string; attachmentId: string;
  section: keyof typeof DEFECT_SECTION_FIELDS; fileKey: string; fileSizeBytes: number;
  fileHash: string; totalChunks: number;
  retryToken?: string | null;
}
export function validateDefectDescriptor(d: DefectFileDescriptor, vesselId: string) {
  if (!d || !isUuid(d.queueUuid) || !isUuid(d.rowUuid) || !isUuid(d.attachmentId) || d.vesselId !== vesselId ||
      !Number.isSafeInteger(d.fileSizeBytes) || d.fileSizeBytes < 1 || d.fileSizeBytes > DEFECT_FILE_BYTES ||
      !/^[a-f0-9]{64}$/.test(d.fileHash || '') || d.totalChunks !== Math.ceil(d.fileSizeBytes / DEFECT_CHUNK_BYTES)) {
    throw fileError('Invalid defect transfer descriptor.', 400);
  }
  const owner = validateDefectFileKey(d.fileKey);
  if (d.retryToken != null && !isUuid(d.retryToken)) throw fileError('Invalid retry identity.', 400);
  if (owner.defect !== d.rowUuid || owner.vessel !== vesselId || owner.section !== d.section || owner.id !== d.attachmentId) {
    throw fileError('Defect transfer identity does not match its canonical path.', 403);
  }
}
export async function defectTransferOwner(d: DefectFileDescriptor) {
  validateDefectDescriptor(d, d.vesselId);
  const db = await getDb();
  const [row] = await db.select().from(defects).where(and(eq(defects.duuid, d.rowUuid), eq(defects.vesselId, d.vesselId)));
  if (!row) throw fileError('Defect metadata has not arrived; retry after metadata synchronization.', 425, 'DEFECT_PARENT_PENDING');
  const matches = (row[DEFECT_SECTION_FIELDS[d.section]] ?? []).filter(f => f.id === d.attachmentId);
  if (matches.length !== 1 || !isExternalDefectAttachment(matches[0])) {
    throw fileError('Attachment metadata has not arrived; retry after metadata synchronization.', 425, 'DEFECT_PARENT_PENDING');
  }
  const file = matches[0];
  if (file.fileKey !== d.fileKey || file.sha256 !== d.fileHash || file.size !== d.fileSizeBytes) {
    throw fileError('Defect attachment content identity conflicts with saved metadata.', 409);
  }
  return { row, file };
}
const receiptKey = (key: string) => RECEIPT_PREFIX + createHash('sha256').update(key).digest('hex');
export async function readDefectTransferBytes(file: ExternalDefectAttachment) {
  const db = await getDb();
  const [receipt] = await db.select().from(syncSettings).where(eq(syncSettings.settingKey, receiptKey(file.fileKey)));
  let backend = file.backend;
  if (receipt) {
    const saved = JSON.parse(receipt.settingValue!);
    if (saved.fileKey !== file.fileKey || saved.sha256 !== file.sha256 || saved.size !== file.size) throw fileError('Invalid local delivery receipt.', 409);
    backend = saved.backend;
  }
  const bytes = await defectFileStore.read(file.fileKey, backend);
  if (bytes.length !== file.size || fileHash(bytes) !== file.sha256) throw fileError('Transfer failed – contact support', 409, 'DEFECT_FILE_FAILED');
  return bytes;
}
const transferNamespace = (queue: string) => createHash('sha256').update(`defect-transfer:${queue}`).digest('hex');
const chunkId = (queue: string, index: number) => {
  const h = createHash('sha256').update(`${queue}:${index}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
};
async function immutableStage(key: string, bytes: Buffer, backend: string) {
  try { await defectFileStore.write(key, bytes, backend, true); }
  catch (error: any) {
    if (!['EEXIST', 412].includes(error.code)) throw error;
    if (!(await defectFileStore.read(key, backend, true)).equals(bytes)) throw fileError('A resumed transfer changed immutable content.', 409);
  }
}
/** Only call while holding the transfer advisory lock after an authorized retry. */
export async function discardDefectTransferStaging(d: DefectFileDescriptor) {
  validateDefectDescriptor(d, d.vesselId);
  const namespace = transferNamespace(d.queueUuid), backend = defectFileStore.backend();
  await defectFileStore.remove(`${namespace}/${d.queueUuid}.json`, backend, true);
  for (let i = 0; i < d.totalChunks; i++) await defectFileStore.remove(`${namespace}/${chunkId(d.queueUuid, i)}.bin`, backend, true);
}
/** Every chunk is authorized against already-synced parent metadata before any write. */
export async function receiveDefectChunk(d: DefectFileDescriptor, index: number, data: string) {
  validateDefectDescriptor(d, d.vesselId);
  const expected = Math.min(DEFECT_CHUNK_BYTES, d.fileSizeBytes - index * DEFECT_CHUNK_BYTES);
  if (!Number.isInteger(index) || index < 0 || index >= d.totalChunks || typeof data !== 'string' ||
      data.length > Math.ceil(DEFECT_CHUNK_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw fileError('Invalid defect chunk bounds.', 400);
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length !== expected || bytes.toString('base64') !== data) throw fileError('Invalid defect chunk encoding or length.', 400);
  await defectTransferOwner(d);
  const db = await getDb();
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`defect-transfer:${d.queueUuid}`}))`);
    const [existing] = await tx.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, d.queueUuid));
    const direction = await isShipInstance() ? 'shore_to_ship' : 'ship_to_shore';
    if (existing && (existing.tableName !== 'defects' || existing.rowUuid !== d.rowUuid || existing.vesselId !== d.vesselId ||
        existing.direction !== direction || existing.fileKey !== d.fileKey || existing.fileHash !== d.fileHash || existing.fileSizeBytes !== d.fileSizeBytes)) throw fileError('Queue identity belongs to another transfer.', 403);
    if (existing && existing.syncBatchId !== (d.retryToken ?? null)) throw fileError('A stale transfer attempt cannot change the authorized retry.', 409, 'DEFECT_RETRY_STALE');
    if (existing?.status === 'failed') throw fileError('Transfer failed – contact support', 409, 'DEFECT_DEAD_LETTER');
    if (existing?.status === 'completed') {
      const committed = await readDefectTransferBytes((await defectTransferOwner(d)).file);
      if (!committed.subarray(index * DEFECT_CHUNK_BYTES, (index + 1) * DEFECT_CHUNK_BYTES).equals(bytes)) throw fileError('An immutable completed chunk cannot be changed.', 409);
      return { complete: true, nextChunk: d.totalChunks };
    }
    await tx.insert(syncFileQueue).values({ queueUuid: d.queueUuid, tableName: 'defects', rowUuid: d.rowUuid,
      vesselId: d.vesselId, fileKey: d.fileKey, fileHash: d.fileHash, fileSizeBytes: d.fileSizeBytes,
      totalChunks: d.totalChunks, direction, instanceId: await getEffectiveInstanceId(), status: 'pending', syncBatchId: d.retryToken })
      .onConflictDoNothing({ target: syncFileQueue.queueUuid });
    const backend = defectFileStore.backend(), namespace = transferNamespace(d.queueUuid);
    const descriptorKey = `${namespace}/${d.queueUuid}.json`;
    const stable = { ...d }; delete stable.retryToken; // admin retry does not change content identity
    await immutableStage(descriptorKey, Buffer.from(JSON.stringify({ transfer: true, descriptor: stable, backend })), backend);
    await immutableStage(`${namespace}/${chunkId(d.queueUuid, index)}.bin`, bytes, backend);
    const parts: Buffer[] = [];
    for (let i = 0; i < d.totalChunks; i++) {
      try { parts.push(await defectFileStore.read(`${namespace}/${chunkId(d.queueUuid, i)}.bin`, backend, true)); }
      catch (error: any) {
        if (error.code === 'ENOENT' || error.code === 404) {
          await tx.update(syncFileQueue).set({ chunkOffset: i, updatedAt: new Date() }).where(eq(syncFileQueue.queueUuid, d.queueUuid));
          return { complete: false, nextChunk: i };
        } throw error;
      }
    }
    const complete = Buffer.concat(parts);
    if (complete.length !== d.fileSizeBytes || fileHash(complete) !== d.fileHash) throw fileError('Final defect file hash verification failed.', 409);
    // Recheck ownership under the DB transaction immediately before promotion.
    const [locked] = await tx.select().from(defects).where(eq(defects.duuid, d.rowUuid)).for('update');
    if (!locked || locked.vesselId !== d.vesselId ||
        !(locked[DEFECT_SECTION_FIELDS[d.section]] ?? []).some(f => isExternalDefectAttachment(f) && f.id === d.attachmentId && f.fileKey === d.fileKey && f.sha256 === d.fileHash && f.size === d.fileSizeBytes)) {
      throw fileError('Attachment metadata changed during transfer; retry after synchronization.', 425, 'DEFECT_PARENT_PENDING');
    }
    try { await defectFileStore.write(d.fileKey, complete, backend); }
    catch (error: any) {
      if (!['EEXIST', 412].includes(error.code)) throw error;
      if (!(await defectFileStore.read(d.fileKey, backend)).equals(complete)) throw fileError('A committed defect key cannot be replaced with different bytes.', 409);
    }
    const receipt = JSON.stringify({ fileKey: d.fileKey, backend, sha256: d.fileHash, size: d.fileSizeBytes });
    await tx.insert(syncSettings).values({ settingKey: receiptKey(d.fileKey), settingValue: receipt, settingType: 'json', isEditable: false })
      .onConflictDoUpdate({ target: syncSettings.settingKey, set: { settingValue: receipt, updatedAt: new Date() } });
    await tx.insert(syncFileQueue).values({ queueUuid: d.queueUuid, tableName: 'defects', rowUuid: d.rowUuid,
      vesselId: d.vesselId, fileKey: d.fileKey, fileHash: d.fileHash, fileSizeBytes: d.fileSizeBytes,
      totalChunks: d.totalChunks, chunkOffset: d.totalChunks, direction, instanceId: await getEffectiveInstanceId(), status: 'completed', completedAt: new Date() })
      .onConflictDoUpdate({ target: syncFileQueue.queueUuid, set: { status: 'completed', chunkOffset: d.totalChunks, completedAt: new Date(), lastError: null } });
    if (existing?.status !== 'completed') await tx.insert(auditLog).values({ userId: 'authenticated-sync-peer',
      entityType: 'defects', entityId: d.rowUuid, actionType: 'file-received', source: 'sync',
      payload: { queueUuid: d.queueUuid, fileKey: d.fileKey, sha256: d.fileHash } });
    return { complete: true, nextChunk: d.totalChunks };
  });
  if (result.complete) await discardDefectTransferStaging(d).catch(() => console.warn('[DefectFiles] Transfer cache cleanup deferred.'));
  return result;
}
export async function describeDefectQueue(q: typeof syncFileQueue.$inferSelect): Promise<DefectFileDescriptor> {
  const owner = validateDefectFileKey(q.fileKey);
  const d: DefectFileDescriptor = { queueUuid: q.queueUuid, rowUuid: q.rowUuid, vesselId: q.vesselId!,
    attachmentId: owner.id, section: owner.section, fileKey: q.fileKey,
    fileSizeBytes: q.fileSizeBytes!, fileHash: q.fileHash!, totalChunks: Math.ceil(q.fileSizeBytes! / DEFECT_CHUNK_BYTES),
    retryToken: q.syncBatchId };
  validateDefectDescriptor(d, q.vesselId!);
  return d;
}
/** Query defects separately, before any window limit. Older Section H rows cannot starve them. */
export async function pendingDefectDescriptors(vesselId: string, direction: string) {
  if (!(await defectReadiness(vesselId)).ready) return [];
  const db = await getDb();
  const rows = await db.select().from(syncFileQueue).where(and(eq(syncFileQueue.tableName, 'defects'),
    eq(syncFileQueue.vesselId, vesselId), eq(syncFileQueue.direction, direction))).orderBy(syncFileQueue.updatedAt, syncFileQueue.id);
  const eligible: DefectFileDescriptor[] = [];
  for (const q of rows.filter(q => ['pending', 'in_progress'].includes(q.status))) {
    try {
      const d = await describeDefectQueue(q);
      const { file } = await defectTransferOwner(d);
      await readDefectTransferBytes(file);
      eligible.push(d);
    } catch (error: any) {
      if (error.code === 'DEFECT_PARENT_PENDING') {
        await db.update(syncFileQueue).set({ lastError: 'Awaiting parent metadata' }).where(eq(syncFileQueue.queueUuid, q.queueUuid));
        continue;
      }
      await db.update(syncFileQueue).set({ status: 'failed', lastError: error.message, updatedAt: new Date() }).where(eq(syncFileQueue.queueUuid, q.queueUuid));
    }
  }
  return eligible;
}
