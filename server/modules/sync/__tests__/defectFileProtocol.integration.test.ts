import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { defectFileKey, type ExternalDefectAttachment } from '@shared/defectAttachments';
const fixture = vi.hoisted(() => ({ db: null as any, client: null as any, ship: false,
  root: `/tmp/defect-protocol-${process.pid}` }));
vi.mock('../../../db', async original => ({ ...await original<any>(), getDb: async () => fixture.db, getPool: async () => fixture.client }));
vi.mock('../syncRole', () => ({ getEffectiveInstanceId: async () => fixture.ship ? 'SHIP-FIXTURE' : 'SHORE-FIXTURE', isShipInstance: async () => fixture.ship }));
vi.mock('../../defects/services/defectFileStorage', async original => {
  const actual = await original<any>(); const store = new actual.DefectFileStore(fixture.root);
  store.backend = () => 'local'; return { ...actual, defectFileStore: store };
});
import { defectFileStore, fileHash } from '../../defects/services/defectFileStorage';
import { DEFECT_CHUNK_BYTES, describeDefectQueue, receiveDefectChunk, readDefectTransferBytes, pendingDefectDescriptors, type DefectFileDescriptor } from '../defectFileProtocol';
import { acceptDefectHandshake, authenticateDefectPeer, defectReadiness, defectStatusDashboard, revokeDefectPeerTrust, verifyDefectReport } from '../defectFileReadiness';
import { recordAuthenticatedDefectPeerReport } from '../../defects/services/defectPeerReports';
import { exchangeDefectCapabilities, processDefectTransfers } from '../defectFileWorker';
import * as endpoints from '../defectFileController';

describe('strict authenticated defect file protocol', () => {
  let client: any, pool: any, testSchema: string;
  const vessel = randomUUID(), other = randomUUID();
  const fakeKey = 'test-fixture-only-not-a-real-key';
  beforeAll(async () => {
    const original = await vi.importActual<any>('../../../db');
    pool = await original.getPool(); client = await pool.connect(); fixture.client = client;
    fixture.db = drizzle(client, { schema });
  });
  beforeEach(async () => {
    fixture.ship = false;
    testSchema = `test_defect_protocol_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${testSchema}"`);
    await client.query(`SET search_path TO "${testSchema}", public`);
    for (const table of ['defects', 'vessels', 'sync_settings', 'sync_file_queue', 'audit_log', 'master_users']) {
      await client.query(`CREATE TABLE "${testSchema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    await fixture.db.insert(schema.vessels).values([{ id: 'FIXTURE', code: 'FIXTURE', vuuid: vessel, name: 'Fixture' },
      { id: 'OTHER', code: 'OTHER', vuuid: other, name: 'Other vessel' }]);
    await fixture.db.insert(schema.syncSettings).values({ settingKey: 'sync_api_key', settingValue: fakeKey });
    await fs.rm(fixture.root, { recursive: true, force: true });
  });
  afterEach(async () => { await client.query('SET search_path TO public'); await client.query(`DROP SCHEMA "${testSchema}" CASCADE`); });
  afterAll(async () => { client?.release(); await fs.rm(fixture.root, { recursive: true, force: true }); });
  function request(overrides = {}) {
    return { headers: { 'x-sync-instance-id': 'SHIP-FIXTURE', 'x-sync-api-key': fakeKey },
      body: { vesselId: vessel, nonce: randomUUID(), sequence: Date.now(), migration191: true, capabilities: ['defect_files_v1'], softwareVersion: 'fixture', ...overrides } } as any;
  }
  async function report(ready = true) {
    const instanceId = fixture.ship ? 'SHORE-FIXTURE' : 'SHIP-FIXTURE', sessionIdentity = randomUUID();
    await recordAuthenticatedDefectPeerReport({ instanceId, vesselUuid: vessel, sessionIdentity }, {
      instanceId, vesselUuid: vessel, sessionIdentity, sequence: Date.now(), softwareVersion: 'fixture', migration191: ready,
      capabilities: ready ? ['defect_files_v1'] : [], receivedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
  }
  async function attachment(section: 'part-a' | 'part-b' | 'part-c1' = 'part-c1', bytes = Buffer.alloc(DEFECT_CHUNK_BYTES * 2 + 17, 7), backend: 'local' | 'object' = 'local') {
    const duuid = randomUUID(), id = randomUUID();
    const file: ExternalDefectAttachment = { id, name: 'fixture.pdf', size: bytes.length, type: 'application/pdf',
      uploadedAt: new Date().toISOString(), storageVersion: 1, fileKey: defectFileKey(vessel, duuid, section, id, 'pdf'),
      sha256: fileHash(bytes), backend, uploadedByUuid: randomUUID() };
    const field = section === 'part-a' ? 'partAAttachments' : section === 'part-b' ? 'attachments' : 'partCAttachments';
    await fixture.db.insert(schema.defects).values({ id: `FIX-${randomUUID()}`, duuid, vesselId: vessel,
      vesselName: 'Fixture', issueDate: '2026-11-02', category: 'Defect', description: 'Fixture', reportedBy: 'Fixture', [field]: [file] });
    const d: DefectFileDescriptor = { queueUuid: randomUUID(), rowUuid: duuid, vesselId: vessel, attachmentId: id, section,
      fileKey: file.fileKey, fileSizeBytes: bytes.length, fileHash: file.sha256, totalChunks: Math.ceil(bytes.length / DEFECT_CHUNK_BYTES), retryToken: null };
    return { d, bytes, file };
  }
  const chunk = (bytes: Buffer, i: number) => bytes.subarray(i * DEFECT_CHUNK_BYTES, (i + 1) * DEFECT_CHUNK_BYTES).toString('base64');
  it('starts unknown and includes every expected vessel, not just reporting vessels', async () => {
    expect(await defectReadiness(vessel)).toMatchObject({ ready: false, state: 'unknown' });
    const dashboard = await defectStatusDashboard();
    expect(dashboard.reports).toHaveLength(2);
    expect(dashboard.reports.every(r => !r.ready)).toBe(true);
  });
  it('authenticates a canonical vessel, signs its response and rejects replay, spoofing and cross-vessel claims', async () => {
    const req = request(); const result = await acceptDefectHandshake(req);
    expect(verifyDefectReport(fakeKey, result.report, result.signature)).toBe(true);
    expect(verifyDefectReport(fakeKey, { ...result.report, migration191: false }, result.signature)).toBe(false);
    expect(await defectReadiness(vessel)).toMatchObject({ ready: true });
    expect(await defectReadiness(other)).toMatchObject({ ready: false });
    await expect(acceptDefectHandshake(req)).rejects.toThrow('replay');
    await expect(authenticateDefectPeer({ ...request(), headers: { 'x-sync-instance-id': 'SHIP-FIXTURE', 'x-sync-api-key': 'wrong' } }, vessel)).rejects.toMatchObject({ statusCode: 403 });
    await expect(acceptDefectHandshake(request({ vesselId: other }))).rejects.toMatchObject({ statusCode: 403 });
  });
  it('does not accept stale handshakes or falsely activate missing migration/capability peers', async () => {
    await expect(acceptDefectHandshake(request({ sequence: Date.now() - 600_000 }))).rejects.toMatchObject({ statusCode: 400 });
    await acceptDefectHandshake(request({ migration191: false, capabilities: [] }));
    expect(await defectReadiness(vessel)).toMatchObject({ ready: false, state: 'lost' });
  });
  it('revokes observed lost trust immediately, audits it, and requires a fresh authenticated report to recover', async () => {
    await report();
    await revokeDefectPeerTrust(vessel, 'Observed incompatible peer software');
    expect(await defectReadiness(vessel)).toMatchObject({ state: 'lost', ready: false });
    expect((await fixture.db.select().from(schema.auditLog)).some(r => r.actionType === 'peer-trust-lost')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 2));
    await acceptDefectHandshake(request());
    expect(await defectReadiness(vessel)).toMatchObject({ ready: true });
  });
  it('distinguishes stale/offline reports and checks the actual local column', async () => {
    await report();
    const [r] = await fixture.db.select().from(schema.syncSettings).where(eq(schema.syncSettings.settingKey, 'defects_peer_report:SHIP-FIXTURE'));
    let data = JSON.parse(r.settingValue);
    data.expiresAt = new Date(Date.now() - 1).toISOString();
    await fixture.db.update(schema.syncSettings).set({ settingValue: JSON.stringify(data) }).where(eq(schema.syncSettings.settingKey, r.settingKey));
    expect(await defectReadiness(vessel)).toMatchObject({ state: 'stale', ready: false });
    data.receivedAt = new Date(Date.now() - 25 * 3600_000).toISOString();
    await fixture.db.update(schema.syncSettings).set({ settingValue: JSON.stringify(data) }).where(eq(schema.syncSettings.settingKey, r.settingKey));
    expect(await defectReadiness(vessel)).toMatchObject({ state: 'offline', ready: false });
    await client.query('ALTER TABLE defects DROP COLUMN part_c_attachments');
    expect((await defectReadiness(vessel)).local.migration191).toBe(false);
  });
  it.each([false, true])('receives out-of-order/duplicate chunks immutably and verifies the final hash; ship=%s', async ship => {
    fixture.ship = ship;
    const { d, bytes, file } = await attachment('part-c1', undefined, 'object');
    expect(await receiveDefectChunk(d, 2, chunk(bytes, 2))).toMatchObject({ complete: false, nextChunk: 0 });
    expect(await receiveDefectChunk(d, 0, chunk(bytes, 0))).toMatchObject({ complete: false, nextChunk: 1 });
    expect(await receiveDefectChunk(d, 0, chunk(bytes, 0))).toMatchObject({ complete: false, nextChunk: 1 });
    expect(await receiveDefectChunk(d, 1, chunk(bytes, 1))).toMatchObject({ complete: true });
    expect(await readDefectTransferBytes(file)).toEqual(bytes); // explicit receipt resolves receiver-local backend
    const q = (await fixture.db.select().from(schema.syncFileQueue))[0];
    expect(q).toMatchObject({ status: 'completed', direction: ship ? 'shore_to_ship' : 'ship_to_shore',
      instanceId: ship ? 'SHIP-FIXTURE' : 'SHORE-FIXTURE' });
    expect(await receiveDefectChunk(d, 1, chunk(bytes, 1))).toMatchObject({ complete: true });
    expect((await fixture.db.select().from(schema.auditLog)).filter(r => r.actionType === 'file-received')).toHaveLength(1);
  });
  it('rejects bad queue/key/size/hash/chunk bounds before writing and defers absent parents without retry exhaustion', async () => {
    const { d, bytes } = await attachment();
    for (const changed of [{ queueUuid: 'bad' }, { fileKey: '../escape.pdf' }, { fileSizeBytes: 6 * 1024 * 1024 }, { fileHash: 'bad' }, { vesselId: other }]) {
      await expect(receiveDefectChunk({ ...d, ...changed }, 0, chunk(bytes, 0))).rejects.toThrow();
    }
    await expect(receiveDefectChunk(d, -1, '')).rejects.toMatchObject({ statusCode: 400 });
    await expect(receiveDefectChunk(d, 0, 'A'.repeat(100_000))).rejects.toMatchObject({ statusCode: 400 });
    await expect(receiveDefectChunk(d, 0, 'AA==')).rejects.toMatchObject({ statusCode: 400 });
    await fixture.db.delete(schema.defects);
    await expect(receiveDefectChunk(d, 0, chunk(bytes, 0))).rejects.toMatchObject({ statusCode: 425, code: 'DEFECT_PARENT_PENDING' });
    expect(await fixture.db.select().from(schema.syncFileQueue)).toHaveLength(0);
  });
  it('rejects changed chunks and will not overwrite a final key with different bytes', async () => {
    const { d, bytes } = await attachment();
    await receiveDefectChunk(d, 0, chunk(bytes, 0));
    await expect(receiveDefectChunk(d, 0, Buffer.alloc(DEFECT_CHUNK_BYTES, 9).toString('base64'))).rejects.toMatchObject({ statusCode: 409 });
    await defectFileStore.write(d.fileKey, Buffer.from('previous immutable bytes'), 'local');
    await receiveDefectChunk(d, 1, chunk(bytes, 1));
    await expect(receiveDefectChunk(d, 2, chunk(bytes, 2))).rejects.toMatchObject({ statusCode: 409 });
    expect((await defectFileStore.read(d.fileKey, 'local')).toString()).toBe('previous immutable bytes');
  });
  it.each(['shore_to_ship', 'ship_to_shore'])('does not let 60 earlier Section H rows starve later eligible defect files or inflate their drain count: %s', async direction => {
    fixture.ship = direction === 'ship_to_shore';
    await report();
    for (let i = 0; i < 60; i++) await fixture.db.insert(schema.syncFileQueue).values({ tableName: 'component_class_regulatory_attachments',
      rowUuid: randomUUID(), fileKey: `held-${i}`, vesselId: vessel, direction, instanceId: fixture.ship ? 'SHIP-FIXTURE' : 'SHORE-FIXTURE', status: 'pending' });
    const { d, bytes } = await attachment('part-b'); await defectFileStore.write(d.fileKey, bytes, 'local');
    await fixture.db.insert(schema.syncFileQueue).values({ ...d, tableName: 'defects', direction, instanceId: fixture.ship ? 'SHIP-FIXTURE' : 'SHORE-FIXTURE' });
    expect((await pendingDefectDescriptors(vessel, direction as any)).map(d => d.fileKey)).toEqual([d.fileKey]);
    expect(await pendingDefectDescriptors(other, direction as any)).toEqual([]);
  });
  it('rejects symlink traversal inside the canonical private root', async () => {
    const { d } = await attachment('part-a');
    await fs.mkdir(path.join(fixture.root, 'defect-docs'), { recursive: true });
    await fs.symlink('/tmp', path.join(fixture.root, 'defect-docs', vessel));
    await expect(defectFileStore.write(d.fileKey, Buffer.from('x'), 'local')).rejects.toThrow('Symbolic');
  });
  it('exchanges authenticated capabilities and transfers both directions across separate installation databases and private roots', async () => {
    const shipClient = await pool.connect(), shipSchema = `test_defect_ship_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${shipSchema}"`);
    await shipClient.query(`SET search_path TO "${shipSchema}", public`);
    for (const table of ['defects', 'vessels', 'sync_settings', 'sync_file_queue', 'audit_log']) {
      await client.query(`CREATE TABLE "${shipSchema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    await client.query(`INSERT INTO "${shipSchema}".vessels SELECT * FROM vessels`);
    await client.query(`INSERT INTO "${shipSchema}".sync_settings(setting_key,setting_value) VALUES ('sync_api_key',$1)`, [fakeKey]);
    const select = (ship: boolean) => {
      fixture.ship = ship; fixture.client = ship ? shipClient : client;
      fixture.db = drizzle(fixture.client, { schema });
      (defectFileStore as any).root = path.join(fixture.root, ship ? 'ship' : 'shore');
    };
    const enqueue = async (d: DefectFileDescriptor, direction: string) => fixture.db.insert(schema.syncFileQueue).values({
      queueUuid: d.queueUuid, tableName: 'defects', rowUuid: d.rowUuid, vesselId, fileKey: d.fileKey,
      fileHash: d.fileHash, fileSizeBytes: d.fileSizeBytes, direction, instanceId: fixture.ship ? 'SHIP-FIXTURE' : 'SHORE-FIXTURE',
    });
    const vesselId = vessel;
    try {
      select(false);
      const shore = await attachment('part-c1'); await defectFileStore.write(shore.d.fileKey, shore.bytes, 'local');
      await enqueue(shore.d, 'shore_to_ship');
      await client.query(`INSERT INTO "${shipSchema}".defects SELECT * FROM defects`);
      select(true);
      const ship = await attachment('part-b'); await defectFileStore.write(ship.d.fileKey, ship.bytes, 'local');
      await enqueue(ship.d, 'ship_to_shore');
      await client.query(`INSERT INTO "${testSchema}".defects SELECT * FROM "${shipSchema}".defects WHERE duuid=$1`, [ship.d.rowUuid]);
      await expect(defectFileStore.read(shore.d.fileKey, 'local')).rejects.toMatchObject({ code: 'ENOENT' });
      const transport = async (url: string, body: any) => {
        select(false);
        let status = 200, payload: any;
        const req = { headers: { 'x-sync-instance-id': 'SHIP-FIXTURE', 'x-sync-api-key': fakeKey }, body };
        const res = { status(value: number) { status = value; return this; }, json(value: any) { payload = value; return this; } };
        try {
          await (url.endsWith('handshake') ? endpoints.handshake : endpoints.transfer)(req as any, res as any);
          if (status >= 400) throw Object.assign(new Error(payload.error), { statusCode: status, code: payload.code });
          return payload;
        } finally { select(true); }
      };
      expect(await exchangeDefectCapabilities(vessel, fakeKey, transport)).toBe(true);
      const result = await processDefectTransfers(vessel, transport);
      expect(result).toMatchObject({ sent: 1, received: 1, remaining: 0 });
      expect(await readDefectTransferBytes(shore.file)).toEqual(shore.bytes);
      select(false);
      expect(await readDefectTransferBytes(ship.file)).toEqual(ship.bytes);
      const shoreQueue = await fixture.db.select().from(schema.syncFileQueue);
      expect(shoreQueue.every(q => q.status === 'completed')).toBe(true);
      expect(shoreQueue.find(q => q.queueUuid === ship.d.queueUuid).instanceId).toBe('SHORE-FIXTURE');
    } finally {
      fixture.ship = false; fixture.client = client; fixture.db = drizzle(client, { schema });
      (defectFileStore as any).root = fixture.root;
      await shipClient.query('SET search_path TO public'); shipClient.release();
      await client.query(`DROP SCHEMA "${shipSchema}" CASCADE`);
    }
  });
  it('rejects forged retry generations; only a verified shore administrator can reset failed chunks, with an audit entry', async () => {
    await report();
    const { d, bytes } = await attachment();
    await receiveDefectChunk(d, 0, chunk(bytes, 0));
    await fixture.db.update(schema.syncFileQueue).set({ status: 'failed', retryCount: 3 }).where(eq(schema.syncFileQueue.queueUuid, d.queueUuid));
    await expect(receiveDefectChunk({ ...d, retryToken: randomUUID() }, 1, chunk(bytes, 1))).rejects.toMatchObject({ code: 'DEFECT_RETRY_STALE' });
    const userId = randomUUID();
    await fixture.db.insert(schema.masterUsers).values({ id: userId, fullName: 'Fixture administrator', userType: 'Office', role: 'Sail Admin' });
    async function retry(role: string) {
      let status = 200, payload: any;
      const req = { params: { queueUuid: d.queueUuid }, headers: {}, verifiedUser: { userId, userType: 'Office', role } };
      await endpoints.retry(req as any, { status(n: number) { status = n; return this; }, json(v: any) { payload = v; return this; } } as any);
      return { status, payload };
    }
    expect((await retry('Offline Admin')).status).toBe(403);
    fixture.ship = true; expect((await retry('Sail Admin')).status).toBe(403); fixture.ship = false;
    expect((await retry('Sail Admin')).status).toBe(200);
    const [queue] = await fixture.db.select().from(schema.syncFileQueue);
    expect(queue).toMatchObject({ retryCount: 0, status: 'pending', chunkOffset: 0 });
    expect(queue.syncBatchId).toBeTruthy();
    await expect(receiveDefectChunk(d, 1, chunk(bytes, 1))).rejects.toMatchObject({ code: 'DEFECT_RETRY_STALE' });
    const authorized = { ...d, retryToken: queue.syncBatchId };
    for (let i = 0; i < d.totalChunks; i++) await receiveDefectChunk(authorized, i, chunk(bytes, i));
    expect((await fixture.db.select().from(schema.auditLog)).some(r => r.actionType === 'file-requeue')).toBe(true);
  });
  it('re-reports a durable outbound terminal failure without automatically retrying its binary content', async () => {
    fixture.ship = true; await report();
    const { d } = await attachment('part-a');
    await fixture.db.insert(schema.syncFileQueue).values({ ...d, tableName: 'defects', direction: 'ship_to_shore',
      instanceId: 'SHIP-FIXTURE', status: 'failed', retryCount: 3 });
    const failures: any[] = [];
    await processDefectTransfers(vessel, async (_url, body) => {
      if (body.op === 'failure') { failures.push(body.descriptor); return { ok: true }; }
      if (body.op === 'chunk') throw new Error('A terminal file must not be automatically retried');
      return { files: [], remaining: 0 };
    });
    expect(failures).toHaveLength(1); expect(failures[0].fileKey).toBe(d.fileKey);
    expect((await fixture.db.select().from(schema.syncFileQueue))[0]).toMatchObject({ status: 'failed', retryCount: 3 });
  });
});
