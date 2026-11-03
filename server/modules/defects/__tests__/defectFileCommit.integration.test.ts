import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { defectFileCommitContext } from '../services/defectFileContext';

const fixture = vi.hoisted(() => ({ db: null as any, ready: vi.fn(), local: vi.fn(), access: vi.fn(), root: `/tmp/defect-commit-${process.pid}` }));
vi.mock('../../../db', async original => ({ ...await original<any>(), getDb: async () => fixture.db }));
vi.mock('../services/defectFileReadiness', () => ({ getDefectFileReadiness: fixture.ready, assertLocalC1UploadAvailable: fixture.local }));
vi.mock('../services/defectFileAccess', async original => ({ ...await original<any>(), assertDefectFileAccess: fixture.access }));
vi.mock('../../sync/syncRole', () => ({ getEffectiveInstanceId: async () => 'SHORE-FIXTURE', isShipInstance: async () => false }));
vi.mock('../services/defectFileStorage', async original => {
  const actual = await original<any>();
  const store = new actual.DefectFileStore(fixture.root);
  store.backend = () => 'local';
  return { ...actual, defectFileStore: store };
});
import { stageDefectFile } from '../services/defectFileStaging';
import { withDefectFileSave } from '../services/defectFileCommit';
import { cleanupExpiredDefectStages } from '../services/defectFileCleanup';
import { defectFileStore } from '../services/defectFileStorage';
import { recordAuthenticatedDefectPeerReport, listDefectPeerReports } from '../services/defectPeerReports';
import { updateSettings, seedSettingIfEmpty } from '../../sync/repository';
import { filterDefectLogs } from '../../sync/defectMetadataCompatibility';

describe('external defect save transaction', () => {
  let client: any, cleanupClient: any, pool: any, testSchema: string;
  const actor = { userUuid: randomUUID(), name: 'Fixture', role: 'Sail Admin', userType: 'Office' as const, rank: 'Master', tenant: 'single-tenant' };
  const vessel = randomUUID(), sessionId = randomUUID();
  const input = { vesselUuid: vessel, sessionId, section: 'part-b' as const };
  const pdf = { originalname: 'fixture.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture') };
  beforeAll(async () => {
    const original = await vi.importActual<any>('../../../db');
    pool = await original.getPool();
    client = await pool.connect();
    cleanupClient = await pool.connect();
  });
  beforeEach(async () => {
    fixture.db = drizzle(client, { schema });
    testSchema = `test_defect_files_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${testSchema}"`);
    for (const conn of [client, cleanupClient]) await conn.query(`SET search_path TO "${testSchema}", public`);
    fixture.ready.mockResolvedValue({ externalStorage: true, c1Upload: true });
    fixture.local.mockReset().mockResolvedValue(undefined);
    for (const table of ['defects', 'audit_log', 'sync_file_queue', 'sync_field_log', 'defect_closure_history', 'defect_attachments', 'defect_actions', 'sync_settings']) {
      await client.query(`CREATE TABLE "${testSchema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    await fs.rm(fixture.root, { recursive: true, force: true });
  });
  afterEach(async () => {
    for (const conn of [client, cleanupClient]) await conn.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
  });
  afterAll(async () => { client?.release(); cleanupClient?.release(); await fs.rm(fixture.root, { recursive: true, force: true }); });
  async function work(body: any) {
    const { tx, duuid } = defectFileCommitContext.getStore()!;
    const [row] = await tx.insert(schema.defects).values({
      id: `FIX-${randomUUID()}`, duuid, vesselId: vessel, vesselName: 'Fixture', issueDate: '2026-11-02',
      category: 'Defect', description: 'Fixture', reportedBy: 'Fixture', attachments: body.attachments,
      partCAttachments: body.partCAttachments, partAAttachments: body.partAAttachments,
    }).returning();
    for (const field of ['attachments', 'partCAttachments', 'partAAttachments']) {
      if (body[field] !== undefined) await tx.insert(schema.syncFieldLog).values({
        tableName: 'defects', rowUuid: duuid, fieldName: field, oldValue: null,
        newValue: JSON.stringify(body[field]), vesselId: vessel, instanceId: 'SHORE-FIXTURE',
      });
    }
    return row;
  }
  it('creates canonical metadata, field-log, audit and queue intent together; expiry never deletes committed bytes', async () => {
    const file = await stageDefectFile(actor, input, pdf);
    const result = await withDefectFileSave({ vesselId: vessel, attachments: [file], attachmentCommit: { sessionId } },
      null, actor, work, async () => {});
    expect(result.duuid).toBe(file.fileKey.split('/')[1]);
    expect(result.attachments![0]).not.toHaveProperty('stagedRef');
    expect(result.attachments![0]).not.toHaveProperty('data');
    for (const table of ['defects', 'audit_log', 'sync_file_queue', 'sync_field_log']) expect((await client.query(`SELECT * FROM ${table}`)).rows).toHaveLength(1);
    await cleanupExpiredDefectStages(Date.now() + 8 * 24 * 3600_000);
    expect(await defectFileStore.read(file.fileKey, 'local')).toEqual(pdf.buffer);
    expect(await defectFileStore.manifests('local')).toEqual([]);
  });
  it('rolls back the DB write on failure and cleans only the expired promoted orphan', async () => {
    const file = await stageDefectFile(actor, input, pdf);
    await expect(withDefectFileSave({ vesselId: vessel, attachments: [file], attachmentCommit: { sessionId } }, null, actor,
      async body => { await work(body); throw new Error('simulated save failure'); }, async () => {})).rejects.toThrow('simulated save failure');
    expect((await client.query('SELECT * FROM defects')).rows).toHaveLength(0);
    expect((await client.query('SELECT * FROM sync_field_log')).rows).toHaveLength(0);
    expect((await client.query('SELECT * FROM sync_file_queue')).rows).toHaveLength(0);
    await cleanupExpiredDefectStages(Date.now() + 8 * 24 * 3600_000);
    await expect(defectFileStore.read(file.fileKey, 'local')).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it.each(['unknown', 'stale', 'lost', 'expired'])('saves C1 with an %s peer while keeping sync held and A/B inline unchanged', async state => {
    const { assertDefectEvidenceRules } = await import('../services/defectsService');
    fixture.ready.mockResolvedValue({ externalStorage: false, c1Upload: false, state, reason: 'Peer is not ready' });
    const file = await stageDefectFile(actor, { ...input, section: 'part-c1' }, pdf);
    const inline = { id: randomUUID(), name: 'existing.pdf', size: pdf.buffer.length,
      type: 'application/pdf', data: `data:application/pdf;base64,${pdf.buffer.toString('base64')}`, uploadedAt: new Date().toISOString() };
    const original = { vesselId: vessel, closureFiles: [], partCAttachments: [] };
    await assertDefectEvidenceRules(original, { partCAttachments: [file] });
    const row = await withDefectFileSave({ vesselId: vessel, partCAttachments: [file],
      attachments: [inline], partAAttachments: [{ ...inline, id: randomUUID() }], attachmentCommit: { sessionId } },
    null, actor, work, (_current, normalized) => assertDefectEvidenceRules(original, normalized));
    const reloaded = (await client.query('SELECT * FROM defects WHERE duuid=$1', [row.duuid])).rows[0];
    expect(reloaded.part_c_attachments[0]).not.toHaveProperty('stagedRef');
    expect(reloaded.part_c_attachments[0]).not.toHaveProperty('data');
    expect(reloaded.attachments).toEqual([inline]);
    expect(await defectFileStore.read(file.fileKey, 'local')).toEqual(pdf.buffer);
    expect((await client.query('SELECT * FROM sync_file_queue')).rows[0]).toMatchObject({ status: 'pending', row_uuid: row.duuid });
    const logs = await fixture.db.select().from(schema.syncFieldLog);
    expect(logs.find((log: any) => log.fieldName === 'partCAttachments').isSynced).toBe(false);
    expect(filterDefectLogs(logs, false).some(log => log.fieldName === 'partCAttachments')).toBe(false);
    expect((await client.query('SELECT * FROM audit_log')).rows).toHaveLength(1);
    await expect(stageDefectFile(actor, input, pdf)).rejects.toMatchObject({ code: 'DEFECT_FILES_UNAVAILABLE' });
    await expect(stageDefectFile(actor, { ...input, section: 'part-a' }, pdf)).rejects.toMatchObject({ code: 'DEFECT_FILES_UNAVAILABLE' });
  });
  it('saves C1 without peer readiness while retaining unchanged saved A/B metadata', async () => {
    const partB = await stageDefectFile(actor, input, pdf);
    const original = await withDefectFileSave({ vesselId: vessel, attachments: [partB], attachmentCommit: { sessionId } }, null, actor, work, async () => {});
    fixture.ready.mockResolvedValue({ externalStorage: false, c1Upload: false });
    const c1 = await stageDefectFile(actor, { ...input, section: 'part-c1' }, pdf, original);
    const result = await withDefectFileSave({ attachments: original.attachments, partCAttachments: [c1],
      attachmentCommit: { sessionId, expectedUpdatedAt: original.updatedAt.toISOString() } }, original, actor, async body => {
      const { tx } = defectFileCommitContext.getStore()!;
      return (await tx.update(schema.defects).set({ partCAttachments: body.partCAttachments }).returning())[0];
    }, async () => {});
    expect(result.duuid).toBe(original.duuid);
    expect(result.attachments).toEqual(original.attachments);
    expect(result.partCAttachments).toHaveLength(1);
  });
  it('does not let C1 bypass a mixed staged A/B readiness failure', async () => {
    const b = await stageDefectFile(actor, input, pdf);
    fixture.ready.mockResolvedValue({ externalStorage: false, c1Upload: false });
    const c1 = await stageDefectFile(actor, { ...input, section: 'part-c1' }, pdf);
    await expect(withDefectFileSave({ vesselId: vessel, attachments: [b], partCAttachments: [c1],
      attachmentCommit: { sessionId } }, null, actor, work, async () => {})).rejects.toMatchObject({ code: 'DEFECT_FILES_UNAVAILABLE' });
    expect((await client.query('SELECT * FROM defects')).rows).toHaveLength(0);
    expect((await client.query('SELECT * FROM sync_file_queue')).rows).toHaveLength(0);
  });
  it('retains staged files when local C1 storage fails during final commit', async () => {
    fixture.ready.mockResolvedValue({ externalStorage: false, c1Upload: false });
    const c1 = await stageDefectFile(actor, { ...input, section: 'part-c1' }, pdf);
    fixture.local.mockResolvedValueOnce(undefined).mockRejectedValueOnce(Object.assign(new Error('Local private storage unavailable'), { code: 'C1_LOCAL_UNAVAILABLE' }));
    await expect(withDefectFileSave({ vesselId: vessel, partCAttachments: [c1], attachmentCommit: { sessionId } },
      null, actor, work, async () => {})).rejects.toMatchObject({ code: 'C1_LOCAL_UNAVAILABLE' });
    expect((await client.query('SELECT * FROM defects')).rows).toHaveLength(0);
    expect((await client.query('SELECT * FROM sync_field_log')).rows).toHaveLength(0);
    expect((await client.query('SELECT * FROM sync_file_queue')).rows).toHaveLength(0);
    expect(await defectFileStore.manifests('local')).toHaveLength(1);
  });
  it('rejects new inline C1 bytes but preserves unchanged legacy C1 and unrelated saves', async () => {
    const { assertDefectEvidenceRules } = await import('../services/defectsService');
    fixture.ready.mockResolvedValue({ externalStorage: false, c1Upload: false });
    const legacy = { id: randomUUID(), data: 'data:application/pdf;base64,JVBERi0=', name: 'legacy.pdf' };
    await expect(withDefectFileSave({ partCAttachments: [legacy] }, null, actor, work, async () => {})).rejects.toMatchObject({ code: 'EXTERNAL_UPLOAD_REQUIRED' });
    fixture.local.mockRejectedValue(new Error('storage offline'));
    const unchanged = { partCAttachments: [legacy] };
    await expect(assertDefectEvidenceRules(unchanged, unchanged)).resolves.toBeUndefined();
    const callback = vi.fn(async body => body);
    expect(await withDefectFileSave(unchanged, unchanged, undefined, callback, async () => {})).toEqual(unchanged);
    expect(fixture.local).not.toHaveBeenCalled();
  });
  it('rejects another form session and readiness loss before commit without losing the staged file', async () => {
    const file = await stageDefectFile(actor, input, pdf);
    await expect(withDefectFileSave({ vesselId: vessel, attachments: [file], attachmentCommit: { sessionId: randomUUID() } },
      null, actor, work, async () => {})).rejects.toMatchObject({ statusCode: 403 });
    fixture.ready.mockResolvedValue({ externalStorage: false, c1Upload: false });
    await expect(withDefectFileSave({ vesselId: vessel, attachments: [file], attachmentCommit: { sessionId } },
      null, actor, work, async () => {})).rejects.toMatchObject({ code: 'DEFECT_FILES_UNAVAILABLE' });
    expect(await defectFileStore.manifests('local')).toHaveLength(1);
  });
  it('rejects tampered metadata and stale records; saved external metadata cannot change under the same ID', async () => {
    const file = await stageDefectFile(actor, input, pdf);
    await expect(withDefectFileSave({ vesselId: vessel, attachments: [{ ...file, name: 'changed.pdf' }], attachmentCommit: { sessionId } },
      null, actor, work, async () => {})).rejects.toThrow('metadata was changed');
    const row = await withDefectFileSave({ vesselId: vessel, attachments: [file], attachmentCommit: { sessionId } },
      null, actor, work, async () => {});
    const saved = row.attachments![0];
    await expect(withDefectFileSave({ attachments: [], attachmentCommit: { sessionId, expectedUpdatedAt: '2000-01-01T00:00:00.000Z' } },
      row, actor, async () => row, async () => {})).rejects.toMatchObject({ code: 'DEFECT_STALE' });
    await expect(withDefectFileSave({ attachments: [{ ...saved, name: 'replacement.pdf' }], attachmentCommit: { sessionId, expectedUpdatedAt: row.updatedAt.toISOString() } },
      row, actor, async () => row, async () => {})).rejects.toThrow('immutable');
  });
  it('serializes expiry cleanup against concurrent finalization and retains the committed file', async () => {
    const file = await stageDefectFile(actor, input, pdf);
    let entered!: () => void, release!: () => void;
    const atWork = new Promise<void>(resolve => { entered = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const saving = withDefectFileSave({ vesselId: vessel, attachments: [file], attachmentCommit: { sessionId } }, null, actor,
      async body => { entered(); await resume; return work(body); }, async () => {});
    await atWork;
    fixture.db = drizzle(cleanupClient, { schema });
    let finished = false;
    const cleaning = cleanupExpiredDefectStages(Date.now() + 8 * 24 * 3600_000).then(result => { finished = true; return result; });
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const state = await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [cleanupClient.processID]);
        if (state.rows[0]?.wait_event_type === 'Lock') { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      expect(finished).toBe(false);
    } finally { release(); await saving; await cleaning; }
    expect(await defectFileStore.read(file.fileKey, 'local')).toEqual(pdf.buffer);
    expect(await defectFileStore.manifests('local')).toEqual([]);
  });
  it('persists authenticated telemetry read-only without enabling the protocol or accepting settings edits', async () => {
    const peer = { instanceId: 'SHIP-FIXTURE', vesselUuid: vessel, sessionIdentity: 'authenticated-fixture-session' };
    const report = { ...peer, softwareVersion: 'fixture', capabilities: ['defect_files_v1'], migration191: true,
      receivedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString(), sequence: 1 };
    await recordAuthenticatedDefectPeerReport(peer, report);
    const rows = await listDefectPeerReports();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ instanceId: peer.instanceId, ready: false });
    expect(rows[0]).not.toHaveProperty('sessionIdentity');
    await expect(recordAuthenticatedDefectPeerReport(peer, report)).rejects.toThrow('replay');
    await expect(updateSettings({ 'defects_peer_report:SHIP-FIXTURE': '{}' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(seedSettingIfEmpty('defects_peer_report:SHIP-FIXTURE', '{}')).rejects.toMatchObject({ statusCode: 403 });
    const saved = await client.query('SELECT is_editable FROM sync_settings');
    expect(saved.rows[0].is_editable).toBe(false);
    expect((await client.query('SELECT * FROM audit_log')).rows).toHaveLength(1);
  });
});
