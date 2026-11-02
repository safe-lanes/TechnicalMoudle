import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { eq, isNull, or } from 'drizzle-orm';
import type { Request } from 'express';
import { getDb, getPool } from '../../db';
import { vessels, syncSettings, syncFileQueue } from '@shared/schema';
import { getEffectiveInstanceId, isShipInstance } from './syncRole';
import * as repo from './repository';
import { tenantConnectionManager } from '../../utils/tenantConnectionManager';
import { getBuildInfo } from '../../utils/buildInfo';
import { recordAuthenticatedDefectPeerReport, DEFECT_PEER_REPORT_PREFIX, type DefectPeerReport } from '../defects/services/defectPeerReports';
import { defectFileStore } from '../defects/services/defectFileStorage';
import { fileError } from '../defects/services/defectFileAccess';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';

export const DEFECT_CAPABILITY = 'defect_files_v1';
export const REPORT_TTL = 15 * 60_000;
const storageChecks = new Map<string, { until: number; ok: boolean }>();
async function storageAvailable(instanceId: string) {
  const backend = defectFileStore.backend(), cacheKey = `${getCurrentTenantContext()?.tuid ?? 'single'}:${instanceId}:${backend}`;
  const old = storageChecks.get(cacheKey);
  if (old && old.until > Date.now()) return old.ok;
  const key = `${createHash('sha256').update(`probe:${cacheKey}`).digest('hex')}/${randomUUID()}.bin`;
  let ok = false;
  try {
    const probe = Buffer.from('defect-files-private-storage-probe');
    await defectFileStore.write(key, probe, backend, true);
    ok = (await defectFileStore.read(key, backend, true)).equals(probe);
  } catch { ok = false; }
  finally { try { await defectFileStore.remove(key, backend, true); } catch { ok = false; } }
  if (storageChecks.size > 1000) storageChecks.clear();
  storageChecks.set(cacheKey, { until: Date.now() + 60_000, ok });
  return ok;
}
export async function localDefectPrerequisites() {
  const result = await (await getPool()).query(`SELECT 1 FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='defects' AND column_name='part_c_attachments'`);
  const instanceId = await getEffectiveInstanceId();
  return { instanceId, softwareVersion: (getBuildInfo() as any).commit ?? 'unknown',
    migration191: result.rows.length === 1, capability: await storageAvailable(instanceId), backend: defectFileStore.backend() };
}
export async function defectReadiness(vesselUuid: string) {
  const local = await localDefectPrerequisites();
  const db = await getDb();
  const rows = await db.select().from(syncSettings);
  const report = rows.filter(r => r.settingKey.startsWith(DEFECT_PEER_REPORT_PREFIX) && !r.isDeleted)
    .map(r => { try { return JSON.parse(r.settingValue || '{}') as DefectPeerReport; } catch { return null; } })
    .find(r => r?.vesselUuid === vesselUuid && typeof r.instanceId === 'string' && typeof r.receivedAt === 'string' && r.instanceId !== local.instanceId);
  let state = 'unknown', reason = 'No authenticated peer report has been received.';
  if (report) {
    const age = Date.now() - Date.parse(report.receivedAt);
    state = age > 24 * 3600_000 ? 'offline' : Date.parse(report.expiresAt) <= Date.now() ? 'stale'
      : !report.migration191 || !report.capabilities.includes(DEFECT_CAPABILITY) ? 'lost' : 'ready';
    reason = state === 'ready' ? 'Both installations have authenticated compatible software and migration 191.'
      : state === 'stale' ? 'The last authenticated report expired.' : state === 'offline' ? 'No authenticated contact for over 24 hours.'
      : 'The peer does not currently report compatible software and migration 191.';
    if (report.trustLostAt) { state = 'lost'; reason = report.trustLossReason || 'Peer verification failed after its last report.'; }
  }
  if (!local.migration191) { state = 'lost'; reason = 'Migration 191 is missing on this installation.'; }
  if (!local.capability) { state = 'lost'; reason = 'Private file storage is not currently readable and writable on this installation.'; }
  const ready = state === 'ready' && local.capability && local.migration191;
  return { vesselUuid, local, report, state, ready, reason, externalStorage: ready, c1Upload: ready };
}
/** Observation of a failed verification revokes trust; it is not an operator gate. */
export async function revokeDefectPeerTrust(vesselUuid: string, reason: string) {
  const db = await getDb(), local = await getEffectiveInstanceId();
  await db.transaction(async tx => {
    const rows = await tx.select().from(syncSettings);
    for (const row of rows.filter(r => r.settingKey.startsWith(DEFECT_PEER_REPORT_PREFIX))) {
      let report: DefectPeerReport;
      try { report = JSON.parse(row.settingValue || '{}'); } catch { continue; }
      if (report.vesselUuid !== vesselUuid || !report.instanceId || report.instanceId === local || report.trustLostAt) continue;
      await tx.update(syncSettings).set({ settingValue: JSON.stringify({ ...report, trustLostAt: new Date().toISOString(), trustLossReason: reason }), updatedAt: new Date() })
        .where(eq(syncSettings.settingKey, row.settingKey));
      const { auditLog } = await import('@shared/schema');
      await tx.insert(auditLog).values({ userId: 'system-peer-verification', entityType: 'defect_peer_report',
        entityId: report.instanceId, actionType: 'peer-trust-lost', source: 'sync', payload: { vesselUuid, reason } });
    }
  });
}
/** Canonical vessel registration plus existing per-tenant key; no default/mock identity. */
export async function authenticateDefectPeer(req: Request, vesselUuid: string): Promise<{ instanceId: string; key: string }> {
  const instanceId = String(req.headers['x-sync-instance-id'] || '');
  if (!instanceId.startsWith('SHIP-') || !/^[0-9a-f-]{36}$/i.test(vesselUuid || '')) throw fileError('Registered vessel identity is required.', 403);
  let key: string;
  if (tenantConnectionManager.isMultiTenantEnabled) {
    key = (await tenantConnectionManager.resolveInstanceDomain(instanceId))?.syncApiKey || '';
  } else key = await repo.getSetting('sync_api_key') || process.env.SYNC_API_KEY || '';
  const provided = String(req.headers['x-sync-api-key'] || '');
  if (!key || Buffer.byteLength(key) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(key), Buffer.from(provided))) {
    throw fileError('Defect sync peer authentication failed.', 403);
  }
  const owner = await (await getPool()).query(`SELECT 1 FROM vessels WHERE vuuid=$1
    AND (upper(code)=upper($2) OR upper(id)=upper($2)) AND is_deleted IS NOT TRUE`, [vesselUuid, instanceId.slice(5)]);
  if (!owner.rows.length) throw fileError('The authenticated peer does not own this vessel.', 403);
  if (await isShipInstance()) throw fileError('This endpoint is served by shore only.', 403);
  return { instanceId, key };
}
export const signDefectReport = (key: string, body: unknown) => createHmac('sha256', key).update(JSON.stringify(body)).digest('hex');
export function verifyDefectReport(key: string, body: unknown, signature: string) {
  return /^[a-f0-9]{64}$/.test(signature || '') && timingSafeEqual(Buffer.from(signDefectReport(key, body), 'hex'), Buffer.from(signature, 'hex'));
}
export async function acceptDefectHandshake(req: Request) {
  const { vesselId, nonce, sequence, migration191, capabilities, softwareVersion } = req.body;
  const peer = await authenticateDefectPeer(req, vesselId);
  if (!/^[a-f0-9-]{36}$/i.test(nonce || '') || !Number.isSafeInteger(sequence) ||
      Math.abs(Date.now() - sequence) > 5 * 60_000 || typeof migration191 !== 'boolean' ||
      !Array.isArray(capabilities) || capabilities.some(c => typeof c !== 'string') ||
      typeof softwareVersion !== 'string' || softwareVersion.length > 200) throw fileError('Invalid or expired handshake.', 400);
  const expiresAt = new Date(Date.now() + REPORT_TTL).toISOString();
  await recordAuthenticatedDefectPeerReport({ ...peer, vesselUuid: vesselId, sessionIdentity: nonce }, {
    instanceId: peer.instanceId, vesselUuid: vesselId, sessionIdentity: nonce, sequence,
    migration191, softwareVersion, capabilities, receivedAt: new Date().toISOString(), expiresAt,
  });
  const local = await localDefectPrerequisites();
  const response = { ...local, vesselUuid: vesselId, nonce, sequence, expiresAt,
    capabilities: local.capability ? [DEFECT_CAPABILITY] : [] };
  return { report: response, signature: signDefectReport(peer.key, response) };
}
export async function defectStatusDashboard() {
  const db = await getDb();
  const expected = await db.select().from(vessels).where(or(eq(vessels.isDeleted, false), isNull(vessels.isDeleted)));
  const reports = [];
  for (const vessel of expected) {
    const status = await defectReadiness(vessel.vuuid);
    const queue = await db.select().from(syncFileQueue).where(eq(syncFileQueue.vesselId, vessel.vuuid));
    const files = queue.filter(q => q.tableName === 'defects');
    reports.push({ vesselUuid: vessel.vuuid, vesselName: vessel.name, instanceId: status.report?.instanceId ?? null,
      softwareVersion: status.report?.softwareVersion ?? null, capabilities: status.report?.capabilities ?? [],
      migration191: status.report?.migration191 ?? null, receivedAt: status.report?.receivedAt ?? null,
      expiresAt: status.report?.expiresAt ?? null, state: status.state, ready: status.ready, reason: status.reason,
      pending: files.filter(q => ['pending', 'in_progress'].includes(q.status)).length,
      held: files.filter(q => ['pending', 'in_progress'].includes(q.status) && (!status.ready || q.lastError === 'Awaiting parent metadata')).length,
      failed: files.filter(q => ['failed', 'dead_letter', 'unsendable'].includes(q.status)).length });
  }
  return { readOnly: true, protocolImplemented: true, local: await localDefectPrerequisites(), reports };
}
