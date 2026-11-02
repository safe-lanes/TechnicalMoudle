import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { syncFileQueue } from '@shared/schema';
import { getDb } from '../../db';
import { DEFECT_CAPABILITY, REPORT_TTL, localDefectPrerequisites, verifyDefectReport, defectReadiness } from './defectFileReadiness';
import { recordAuthenticatedDefectPeerReport } from '../defects/services/defectPeerReports';
import { DEFECT_CHUNK_BYTES, pendingDefectDescriptors, defectTransferOwner, readDefectTransferBytes, receiveDefectChunk, validateDefectDescriptor, discardDefectTransferStaging } from './defectFileProtocol';
import { getEffectiveInstanceId, isShipInstance } from './syncRole';
import { fileError } from '../defects/services/defectFileAccess';
type Transport = (path: string, body: any) => Promise<any>;

export async function exchangeDefectCapabilities(vesselId: string, key: string, call: Transport) {
  if (!key || !await isShipInstance()) return false;
  const local = await localDefectPrerequisites();
  const nonce = randomUUID(), sequence = Date.now();
  const reply = await call('/sync/defects/handshake', { vesselId, nonce, sequence,
    migration191: local.migration191, softwareVersion: local.softwareVersion, capabilities: local.capability ? [DEFECT_CAPABILITY] : [] });
  const r = reply.report;
  if (!r || !verifyDefectReport(key, r, reply.signature) || r.nonce !== nonce || r.sequence !== sequence || r.vesselUuid !== vesselId ||
      !r.instanceId.startsWith('SHORE') || Date.parse(r.expiresAt) <= Date.now() || Date.parse(r.expiresAt) > Date.now() + REPORT_TTL + 30_000) {
    throw fileError('The shore defect capability response could not be authenticated.', 403);
  }
  await recordAuthenticatedDefectPeerReport({ instanceId: r.instanceId, vesselUuid: vesselId, sessionIdentity: nonce }, {
    instanceId: r.instanceId, vesselUuid: vesselId, sessionIdentity: nonce, sequence, softwareVersion: r.softwareVersion,
    migration191: r.migration191, capabilities: r.capabilities, receivedAt: new Date().toISOString(), expiresAt: r.expiresAt,
  });
  return (await defectReadiness(vesselId)).ready;
}
export async function processDefectTransfers(vesselId: string, call: Transport, budgetMs = 30_000) {
  if (!await isShipInstance() || !String(await getEffectiveInstanceId()).startsWith('SHIP-')) return { sent: 0, received: 0, remaining: 0 };
  const start = Date.now(), db = await getDb();
  let sent = 0, received = 0, remaining = 0;
  const available = async () => Date.now() - start < budgetMs && (await defectReadiness(vesselId)).ready;
  if (!await available()) return { sent, received, remaining };
  const retries = await call('/sync/defects/files', { op: 'retries', vesselId });
  for (const d of retries.files) {
    validateDefectDescriptor(d, vesselId);
    const [q] = await db.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, d.queueUuid));
    if (q?.tableName === 'defects' && q.direction === 'ship_to_shore' && q.vesselId === vesselId &&
        q.fileKey === d.fileKey && q.fileHash === d.fileHash && q.syncBatchId !== d.retryToken) {
      await db.update(syncFileQueue).set({ status: 'pending', retryCount: 0, syncBatchId: d.retryToken, lastError: null, updatedAt: new Date() }).where(eq(syncFileQueue.queueUuid, q.queueUuid));
    }
  }
  const failed = await db.select().from(syncFileQueue).where(and(eq(syncFileQueue.tableName, 'defects'),
    eq(syncFileQueue.vesselId, vesselId), eq(syncFileQueue.direction, 'ship_to_shore'), eq(syncFileQueue.status, 'failed')));
  for (const queue of failed) {
    if (!await available()) break;
    try {
      const d = await (await import('./defectFileProtocol')).describeDefectQueue(queue);
      await defectTransferOwner(d);
      await call('/sync/defects/files', { op: 'failure', vesselId, descriptor: d });
    } catch { /* Keep and report this durable local failure on the next authenticated cycle. */ }
  }
  for (const d of await pendingDefectDescriptors(vesselId, 'ship_to_shore')) {
    if (!await available() || Date.now() - start >= budgetMs / 2) break;
    try {
      const { file } = await defectTransferOwner(d), bytes = await readDefectTransferBytes(file);
      const [row] = await db.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, d.queueUuid));
      let index = row.chunkOffset || 0;
      if (index >= d.totalChunks) index = 0; // retry final acknowledgement idempotently
      while (index < d.totalChunks && await available() && Date.now() - start < budgetMs / 2) {
        const result = await call('/sync/defects/files', { op: 'chunk', vesselId, descriptor: d, index,
          data: bytes.subarray(index * DEFECT_CHUNK_BYTES, (index + 1) * DEFECT_CHUNK_BYTES).toString('base64') });
        if (!Number.isInteger(result.nextChunk) || result.nextChunk < 0 || result.nextChunk > d.totalChunks ||
            Boolean(result.complete) !== (result.nextChunk === d.totalChunks)) throw fileError('Invalid defect transfer acknowledgement.', 409);
        index = result.nextChunk;
        await db.update(syncFileQueue).set({ chunkOffset: index, status: result.complete ? 'completed' : 'pending',
          ...(result.complete ? { completedAt: new Date(), lastError: null } : {}), updatedAt: new Date() }).where(eq(syncFileQueue.queueUuid, d.queueUuid));
        if (result.complete) { sent++; break; }
      }
    } catch (error: any) {
      if (await transferFailure(d.queueUuid, error)) await call('/sync/defects/files', { op: 'failure', vesselId, descriptor: d });
    }
  }
  if (await available()) {
    const list = await call('/sync/defects/files', { op: 'list', vesselId });
    remaining = list.remaining;
    for (const d of list.files) {
      if (!await available()) break;
      validateDefectDescriptor(d, vesselId);
      try {
        await defectTransferOwner(d); // missing metadata is a defer, never a failed attempt
        await db.insert(syncFileQueue).values({ queueUuid: d.queueUuid, tableName: 'defects', rowUuid: d.rowUuid,
          vesselId, fileKey: d.fileKey, fileHash: d.fileHash, fileSizeBytes: d.fileSizeBytes, direction: 'shore_to_ship',
          instanceId: await getEffectiveInstanceId(), status: 'pending', syncBatchId: d.retryToken }).onConflictDoNothing({ target: syncFileQueue.queueUuid });
        const [row] = await db.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, d.queueUuid));
        if (row.tableName !== 'defects' || row.direction !== 'shore_to_ship' || row.vesselId !== vesselId ||
            row.fileKey !== d.fileKey || row.fileHash !== d.fileHash) throw fileError('The inbound queue identity conflicts with a saved transfer.', 403);
        if (row.status === 'failed' && row.syncBatchId === (d.retryToken ?? null)) {
          await call('/sync/defects/files', { op: 'fail', vesselId, queueUuid: d.queueUuid, retryToken: d.retryToken }); continue;
        }
        if (row.syncBatchId !== (d.retryToken ?? null)) {
          await db.transaction(async tx => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`defect-transfer:${d.queueUuid}`}))`);
            await discardDefectTransferStaging(d);
            await tx.update(syncFileQueue).set({ retryCount: 0, chunkOffset: 0, status: 'pending', syncBatchId: d.retryToken, lastError: null }).where(eq(syncFileQueue.queueUuid, d.queueUuid));
          });
          row.chunkOffset = 0; row.status = 'pending';
        }
        let index = row?.chunkOffset || 0;
        if (row?.status === 'completed') index = d.totalChunks;
        while (index < d.totalChunks && await available()) {
          const chunk = await call('/sync/defects/files', { op: 'read', vesselId, queueUuid: d.queueUuid, retryToken: d.retryToken, index });
          if (JSON.stringify(chunk.descriptor) !== JSON.stringify(d)) throw fileError('The resumed descriptor changed.', 409);
          const result = await receiveDefectChunk(d, index, chunk.data);
          index = result.nextChunk;
        }
        if (index === d.totalChunks) {
          await call('/sync/defects/files', { op: 'complete', vesselId, queueUuid: d.queueUuid, fileHash: d.fileHash, retryToken: d.retryToken });
          received++; remaining--;
        }
      } catch (error: any) {
        const terminal = await transferFailure(d.queueUuid, error);
        if (terminal) await call('/sync/defects/files', { op: 'fail', vesselId, queueUuid: d.queueUuid, retryToken: d.retryToken });
      }
    }
  }
  // Deadline exhaustion pauses work; it is not proof that the queue is empty.
  // Keep eligible counts so Sync Now's drain starts another resumable cycle.
  const compatible = (await defectReadiness(vesselId)).ready;
  const outstanding = compatible ? await call('/sync/defects/files', { op: 'list', vesselId }) : { remaining: 0 };
  return { sent, received, remaining: Number(outstanding.remaining ?? 0) +
    (compatible ? (await pendingDefectDescriptors(vesselId, 'ship_to_shore')).length : 0) };
}
async function transferFailure(queueUuid: string, error: any) {
  if (['DEFECT_PARENT_PENDING', 'DEFECT_FILES_UNAVAILABLE', 'DEFECT_RETRY_STALE'].includes(error.code) || error.statusCode === 425) return false;
  const db = await getDb();
  const [row] = await db.select().from(syncFileQueue).where(eq(syncFileQueue.queueUuid, queueUuid));
  if (!row) return false;
  const attempts = (row.retryCount ?? 0) + 1, terminal = attempts >= 3;
  await db.update(syncFileQueue).set({ retryCount: attempts, status: terminal ? 'failed' : 'pending',
    lastError: terminal ? 'Transfer failed – contact support' : String(error.message).slice(0, 300), updatedAt: new Date() })
    .where(eq(syncFileQueue.queueUuid, queueUuid));
  return terminal;
}
