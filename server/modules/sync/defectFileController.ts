import type { Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { syncFileQueue, auditLog } from '@shared/schema';
import { getDb } from '../../db';
import { acceptDefectHandshake, authenticateDefectPeer, defectReadiness } from './defectFileReadiness';
import { DEFECT_CHUNK_BYTES, describeDefectQueue, defectTransferOwner, pendingDefectDescriptors,
  readDefectTransferBytes, receiveDefectChunk, validateDefectDescriptor, discardDefectTransferStaging } from './defectFileProtocol';
import { fileError, defectFileActor } from '../defects/services/defectFileAccess';
import { isShipInstance } from './syncRole';
import { randomUUID } from 'node:crypto';
import { and } from 'drizzle-orm';

const handler = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
  try { await fn(req, res); } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Defect transfer failed.', code: error.code });
  }
};
export const handshake = handler(async (req, res) => { res.json(await acceptDefectHandshake(req)); });
export const transfer = handler(async (req, res) => {
  const { vesselId, op } = req.body;
  await authenticateDefectPeer(req, vesselId);
  const ready = await defectReadiness(vesselId);
  if (!ready.ready) throw fileError('Defect file compatibility is not currently verified.', 409, 'DEFECT_FILES_UNAVAILABLE');
  if (op === 'list') {
    const files = await pendingDefectDescriptors(vesselId, 'shore_to_ship');
    res.json({ files: files.slice(0, 50), remaining: files.length }); return;
  }
  if (op === 'chunk') {
    validateDefectDescriptor(req.body.descriptor, vesselId);
    res.json(await receiveDefectChunk(req.body.descriptor, req.body.index, req.body.data)); return;
  }
  const db = await getDb();
  if (op === 'retries') {
    const rows = await db.select().from(syncFileQueue).where(and(eq(syncFileQueue.tableName, 'defects'),
      eq(syncFileQueue.vesselId, vesselId), eq(syncFileQueue.direction, 'ship_to_shore'), eq(syncFileQueue.status, 'pending')));
    res.json({ files: await Promise.all(rows.filter(r => r.syncBatchId).map(describeDefectQueue)) }); return;
  }
  if (op === 'failure') {
    const d = req.body.descriptor;
    validateDefectDescriptor(d, vesselId); await defectTransferOwner(d);
    const [existing] = await db.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, d.queueUuid));
    if (existing && (existing.tableName !== 'defects' || existing.direction !== 'ship_to_shore' || existing.fileKey !== d.fileKey || existing.vesselId !== vesselId)) throw fileError('Queue ownership mismatch.', 403);
    if (existing && existing.syncBatchId !== (d.retryToken ?? null)) throw fileError('Stale transfer attempt.', 409, 'DEFECT_RETRY_STALE');
    await db.insert(syncFileQueue).values({ queueUuid: d.queueUuid, tableName: 'defects', rowUuid: d.rowUuid, vesselId,
      fileKey: d.fileKey, fileHash: d.fileHash, fileSizeBytes: d.fileSizeBytes, direction: 'ship_to_shore',
      instanceId: ready.local.instanceId, status: 'failed', retryCount: 3, lastError: 'Transfer failed – contact support' })
      .onConflictDoUpdate({ target: syncFileQueue.queueUuid, set: { status: 'failed', lastError: 'Transfer failed – contact support', updatedAt: new Date() } });
    res.json({ recorded: true }); return;
  }
  const [queue] = await db.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, String(req.body.queueUuid)));
  if (!queue || queue.tableName !== 'defects' || queue.vesselId !== vesselId || queue.direction !== 'shore_to_ship') throw fileError('Transfer does not belong to this peer.', 403);
  if ((req.body.retryToken ?? null) !== queue.syncBatchId) throw fileError('Stale transfer attempt.', 409, 'DEFECT_RETRY_STALE');
  const descriptor = await describeDefectQueue(queue);
  if (op === 'read') {
    const index = req.body.index;
    if (!Number.isInteger(index) || index < 0 || index >= descriptor.totalChunks) throw fileError('Invalid chunk index.', 400);
    const { file } = await defectTransferOwner(descriptor);
    const bytes = await readDefectTransferBytes(file);
    await db.update(syncFileQueue).set({ chunkOffset: index, updatedAt: new Date() }).where(eq(syncFileQueue.queueUuid, queue.queueUuid));
    res.json({ descriptor, data: bytes.subarray(index * DEFECT_CHUNK_BYTES, (index + 1) * DEFECT_CHUNK_BYTES).toString('base64') }); return;
  }
  if (op === 'complete') {
    if (req.body.fileHash !== descriptor.fileHash) throw fileError('Completion hash does not match this transfer.', 409);
    await db.update(syncFileQueue).set({ status: 'completed', completedAt: new Date(), chunkOffset: descriptor.totalChunks, lastError: null, updatedAt: new Date() })
      .where(eq(syncFileQueue.queueUuid, queue.queueUuid));
    res.json({ complete: true }); return;
  }
  if (op === 'fail') {
    await db.update(syncFileQueue).set({ status: 'failed', lastError: 'Transfer failed – contact support', updatedAt: new Date() })
      .where(eq(syncFileQueue.queueUuid, queue.queueUuid));
    res.json({ failed: true }); return;
  }
  throw fileError('Unknown defect file operation.', 400);
});
/** Authenticated Office administrators only; no legacy Offline Admin bypass. */
export const retry = handler(async (req, res) => {
  const actor = await defectFileActor(req);
  if (await isShipInstance() || actor.userType !== 'Office' || !['sail admin', 'pms admin'].includes(actor.role.replaceAll('_', ' ').toLowerCase())) throw fileError('Only shore Sail Admin/PMS Admin can retry defect transfers.', 403);
  const db = await getDb();
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`defect-transfer:${req.params.queueUuid}`}))`);
    const [queue] = await tx.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, req.params.queueUuid)).for('update');
    if (!queue || queue.tableName !== 'defects' || !['failed', 'dead_letter', 'unsendable'].includes(queue.status)) throw fileError('A failed defect transfer is required.', 409);
    const descriptor = await describeDefectQueue(queue);
    if (!(await defectReadiness(descriptor.vesselId)).ready) throw fileError('The owning vessel is not currently compatible.', 409);
    const { file } = await defectTransferOwner(descriptor);
    if (queue.direction === 'shore_to_ship') await readDefectTransferBytes(file);
    else await discardDefectTransferStaging(descriptor);
    // Inbound failures need the vessel's source bytes; ownership still revalidated.
    await tx.update(syncFileQueue).set({ status: 'pending', retryCount: 0, chunkOffset: 0, lastError: null, syncBatchId: randomUUID(), updatedAt: new Date() })
      .where(eq(syncFileQueue.queueUuid, queue.queueUuid));
    await tx.insert(auditLog).values({ userId: actor.userUuid, entityType: 'defects', entityId: queue.rowUuid,
      actionType: 'file-requeue', source: 'api', payload: { queueUuid: queue.queueUuid, fileKey: queue.fileKey } });
  });
  res.json({ success: true });
});
