import { eq, sql } from 'drizzle-orm';
import { auditLog, syncSettings } from '@shared/schema';
import { getDb } from '../../../db';
import { fileError } from './defectFileAccess';

export const DEFECT_PEER_REPORT_PREFIX = 'defects_peer_report:';
export interface DefectPeerReport {
  instanceId: string; vesselUuid: string | null; softwareVersion: string;
  capabilities: string[]; migration191: boolean; receivedAt: string; expiresAt: string;
  sessionIdentity: string; sequence: number;
  trustLostAt?: string; trustLossReason?: string;
}
/**
 * Internal-only persistence boundary for M3's authenticated handshake. There is
 * intentionally no browser mutation endpoint. The verified peer identity must
 * come from sync authentication, never from the reported JSON or settings UI.
 */
export async function recordAuthenticatedDefectPeerReport(
  verifiedPeer: { instanceId: string; vesselUuid: string | null; sessionIdentity: string },
  report: DefectPeerReport,
) {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(verifiedPeer.instanceId) ||
      report.instanceId !== verifiedPeer.instanceId || report.vesselUuid !== verifiedPeer.vesselUuid ||
      report.sessionIdentity !== verifiedPeer.sessionIdentity ||
      !Number.isSafeInteger(report.sequence) || report.sequence < 0 ||
      !report.sessionIdentity || !Array.isArray(report.capabilities) ||
      !Number.isFinite(Date.parse(report.expiresAt))) throw fileError('Invalid authenticated peer report.', 403);
  const db = await getDb();
  const key = DEFECT_PEER_REPORT_PREFIX + verifiedPeer.instanceId;
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    const [row] = await tx.select().from(syncSettings).where(eq(syncSettings.settingKey, key)).for('update');
    const old = row?.settingValue ? JSON.parse(row.settingValue) as DefectPeerReport : null;
    if (old && old.sequence >= report.sequence) throw fileError('Peer report replay rejected.', 409);
    const saved = { ...report, receivedAt: new Date().toISOString() };
    await tx.insert(syncSettings).values({
      settingKey: key, settingValue: JSON.stringify(saved), settingType: 'json', isEditable: false,
      description: 'Authenticated defect file peer telemetry; not an operator setting.',
    }).onConflictDoUpdate({ target: syncSettings.settingKey,
      set: { settingValue: JSON.stringify(saved), isEditable: false, updatedAt: new Date() } });
    await tx.insert(auditLog).values({
      userId: 'authenticated-sync-peer', entityType: 'defect_peer_report', entityId: verifiedPeer.instanceId,
      actionType: 'peer-report', source: 'sync',
      payload: { vesselUuid: saved.vesselUuid, migration191: saved.migration191,
        capabilities: saved.capabilities, receivedAt: saved.receivedAt },
    });
  });
}
export async function listDefectPeerReports() {
  const db = await getDb();
  const rows = await db.select().from(syncSettings);
  return rows.filter(row => row.settingKey.startsWith(DEFECT_PEER_REPORT_PREFIX) && !row.isDeleted).map(row => {
    const report = JSON.parse(row.settingValue || '{}') as DefectPeerReport;
    return { instanceId: report.instanceId, vesselUuid: report.vesselUuid, softwareVersion: report.softwareVersion,
      migration191: report.migration191, capabilities: report.capabilities, receivedAt: report.receivedAt,
      expiresAt: report.expiresAt, state: Date.parse(report.expiresAt) > Date.now() ? 'reported' : 'stale',
      ready: false, reason: 'The complete defect file protocol is not available in this milestone.' };
  });
}
