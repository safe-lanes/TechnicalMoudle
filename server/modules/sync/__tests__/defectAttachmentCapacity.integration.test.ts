import { afterAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
const fixture = vi.hoisted(() => ({ db: null as any, client: null as any, ship: false,
  root: `/tmp/defect-capacity-${process.pid}` }));
vi.mock('../../../db', async original => ({ ...await original<any>(), getDb: async () => fixture.db, getPool: async () => fixture.client }));
// Supply the same Postgres implementation the application initializes at
// startup, without running startup migrations/schedulers against public data.
vi.mock('../../../storage', () => ({ storage: {
  getDefect: async (id: string) => {
    const { PostgresStorage } = await import('../../../postgresStorage');
    return new PostgresStorage().getDefect(id);
  },
} }));
vi.mock('../syncRole', async original => ({ ...await original<any>(),
  getEffectiveInstanceId: async () => fixture.ship ? 'SHIP-CAPACITY' : 'SHORE-CAPACITY',
  getInstanceRole: async () => fixture.ship ? 'ship' : 'shore', isShipInstance: async () => fixture.ship }));
vi.mock('../../defects/services/defectFileStorage', async original => {
  const actual = await original<any>(), store = new actual.DefectFileStore(fixture.root);
  store.backend = () => 'local'; return { ...actual, defectFileStore: store };
});
import * as uploads from '../../defects/controllers/defectFileController';
import * as protocol from '../defectFileController';
import { defectFileActor } from '../../defects/services/defectFileAccess';
import { withDefectFileSave } from '../../defects/services/defectFileCommit';
import { defectFileStore, fileHash } from '../../defects/services/defectFileStorage';
import { exchangeDefectCapabilities, processDefectTransfers } from '../defectFileWorker';
import { readDefectTransferBytes } from '../defectFileProtocol';
import { PostgresStorage } from '../../../postgresStorage';
import { SyncEngine } from '../syncEngine';
import { applyFieldLogInserts } from '../oneWayApplier';

/** Valid one-page PDF, padded by a legal PDF comment to exactly the byte limit. */
function capacityPdf(index: number) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    (() => { const text = `BT /F1 12 Tf 40 750 Td (Capacity file ${index}) Tj ET\n`; return `<< /Length ${text.length} >>\nstream\n${text}endstream`; })(),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let prefix = '%PDF-1.4\n', offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(prefix)); prefix += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n`;
  const size = 5 * 1024 * 1024;
  // The xref position has seven digits at this size.
  const xrefPosition = size - Buffer.byteLength(`${xref}0000000\n%%EOF\n`);
  const tail = `${xref}${xrefPosition}\n%%EOF\n`;
  const padding = Buffer.alloc(xrefPosition - Buffer.byteLength(prefix), 65 + index);
  padding[0] = 37; padding[padding.length - 1] = 10;
  const result = Buffer.concat([Buffer.from(prefix), padding, Buffer.from(tail)]);
  if (result.length !== size || result.subarray(xrefPosition, xrefPosition + 4).toString() !== 'xref') throw new Error('Invalid capacity PDF');
  return result;
}

describe('M4 five by five MiB real HTTP capacity', () => {
  const servers: any[] = [], clients: any[] = [], schemas: string[] = [];
  afterAll(async () => {
    await Promise.all(servers.map(s => new Promise<void>(resolve => s.close(() => resolve()))));
    for (const c of clients) { await c.query('SET search_path TO public'); c.release(); }
    const original = await vi.importActual<any>('../../../db'), pool = await original.getPool();
    for (const name of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await fs.rm(fixture.root, { recursive: true, force: true });
  });
  it('uploads, commits, transfers five exact-limit files both ways, removes them and preserves legacy data', async () => {
    const original = await vi.importActual<any>('../../../db'), pool = await original.getPool();
    const vessel = randomUUID(), actorId = randomUUID(), key = 'capacity-fixture-key-not-a-real-secret';
    const storage = new PostgresStorage(), metrics: any[] = [], events: any[] = [];
    const installations: any[] = [];
    for (const ship of [false, true]) {
      const client = await pool.connect(), name = `test_defect_capacity_${randomUUID().replaceAll('-', '')}`;
      clients.push(client); schemas.push(name);
      await client.query(`CREATE SCHEMA "${name}"`); await client.query(`SET search_path TO "${name}", public`);
      for (const table of ['defects', 'vessels', 'master_users', 'sync_settings', 'sync_file_queue', 'audit_log', 'sync_field_log',
        'defect_sequences', 'defect_closure_history', 'defect_attachments', 'defect_actions', 'apprv_requests', 'defect_approval_settings',
        'approval_workflow_config', 'sync_conflicts']) await client.query(`CREATE TABLE "${name}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
      const db = drizzle(client, { schema });
      await db.insert(schema.vessels).values({ id: 'CAPACITY', code: 'CAPACITY', vuuid: vessel, name: 'Isolated capacity fixture', vesselSequence: 901 });
      await db.insert(schema.masterUsers).values({ id: actorId, fullName: 'Capacity fixture Master', role: 'Sail Admin', userType: 'Office', designation: 'Master' });
      await db.insert(schema.syncSettings).values({ settingKey: 'sync_api_key', settingValue: key });
      const install: any = { ship, client, db, name, root: path.join(fixture.root, ship ? 'ship' : 'shore') };
      installations.push(install);
      const app = express();
      app.use((req, res, next) => {
        choose(install);
        // The normal application auth middleware establishes req.user before RBAC.
        // Deliberately conflicting mock values must not grant C1's Master access.
        (req as any).user = { id: 1, role: 'Vessel User', userType: 'Ship', rank_name: 'Chief Engineer' };
        (req as any).verifiedUser = { userId: actorId, userType: 'Office', role: 'Sail Admin' };
        // Do not attach a data listener before async authorization: doing so
        // consumes multipart bytes before Multer is ready. Record the actual
        // HTTP Content-Length and verify the complete body was received.
        res.on('finish', () => metrics.push({ installation: ship ? 'ship' : 'shore', path: req.path,
          op: req.body?.op, requestBytes: Number(req.headers['content-length'] || 0), bodyComplete: req.complete,
          responseBytes: Number(res.getHeader('content-length') || 0), status: res.statusCode }));
        next();
      });
      app.use(express.json({ limit: '100mb' }));
      app.post('/technical/api/defects/:defectId/file-staging/:section', uploads.authorizeMutation, uploads.uploadBody, uploads.stage);
      app.post('/technical/api/sync/defects/handshake', protocol.handshake);
      app.post('/technical/api/sync/defects/files', protocol.transfer);
      app.post('/capacity/save', uploads.authorizeCommit, async (req, res) => {
        try {
          const current = await storage.getDefect(req.body.id), actor = await defectFileActor(req);
          const saved = await withDefectFileSave(req.body, current, actor, body => storage.updateDefect(req.body.id, body), async () => {});
          res.json(saved);
        } catch (error: any) { res.status(error.statusCode || 500).json({ error: error.message, code: error.code }); }
      });
      app.post('/capacity/metadata', async (req, res) => {
        try {
          const inserted = await applyFieldLogInserts(req.body.fieldLogs, client);
          if (inserted.errors.length) throw new Error(inserted.errors.join('; '));
          const receiver = Object.create(SyncEngine.prototype) as any;
          receiver.instanceId = ship ? 'SHIP-CAPACITY' : 'SHORE-CAPACITY';
          for (const log of inserted.updateLogs) await receiver.applyFieldLog(log, client);
          res.json({ applied: req.body.fieldLogs.length });
        } catch (error: any) { res.status(500).json({ error: error.message }); }
      });
      const server: any = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
      servers.push(server); install.url = `http://127.0.0.1:${server.address().port}`;
    }
    function choose(install: any) {
      fixture.ship = install.ship; fixture.db = install.db; fixture.client = install.client;
      (defectFileStore as any).root = install.root;
    }
    const [shore, ship] = installations;
    async function json(install: any, url: string, body: any) {
      const response = await fetch(install.url + url, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'x-sync-instance-id': 'SHIP-CAPACITY', 'x-sync-api-key': key,
      }, body: JSON.stringify(body) });
      const value = await response.json() as any;
      if (!response.ok) throw Object.assign(new Error(value.error), { statusCode: response.status, code: value.code });
      return value;
    }
    const transport = async (url: string, body: any) => {
      try { return await json(shore, '/technical/api' + url, body); } finally { choose(ship); }
    };
    const files = Array.from({ length: 5 }, (_, i) => capacityPdf(i));
    await fs.mkdir('generated-artifacts/defect-attachments', { recursive: true });
    await fs.writeFile('generated-artifacts/defect-attachments/capacity-proxy.pdf', files[0]);
    const hashes = files.map(fileHash), legacy = { id: randomUUID(), name: 'retained-legacy.pdf', type: 'application/pdf',
      size: files[0].length, data: `data:application/pdf;base64,${files[0].toString('base64')}`, uploadedAt: new Date().toISOString() };
    choose(shore);
    const initial = await storage.createDefect({ id: 'fixture', vesselId: vessel, vesselName: 'Capacity fixture',
      issueDate: '2026-11-02', category: 'Defect', description: 'Isolated M4 capacity', reportedBy: 'Capacity fixture',
      partAAttachments: [legacy], attachments: [{ ...legacy, id: randomUUID() }], partCAttachments: [] });
    await ship.client.query(`INSERT INTO "${ship.name}".defects SELECT * FROM "${shore.name}".defects`);
    choose(ship); expect(await exchangeDefectCapabilities(vessel, key, transport)).toBe(true);
    async function uploadFive(install: any, row: any) {
      const sessionId = randomUUID(), staged = [];
      for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.set('vesselUuid', vessel); form.set('sessionId', sessionId);
        form.set('file', new Blob([files[i]], { type: 'application/pdf' }), `capacity-${i + 1}.pdf`);
        const response = await fetch(`${install.url}/technical/api/defects/${row.id}/file-staging/part-c1`, { method: 'POST', body: form });
        const value = await response.json() as any;
        expect(response.status, JSON.stringify(value)).toBe(201); staged.push(value);
      }
      const saved = await json(install, '/capacity/save', { id: row.id, partCAttachments: staged,
        attachmentCommit: { sessionId, expectedUpdatedAt: row.updatedAt } });
      expect(saved.partCAttachments).toHaveLength(5);
      expect(saved.partCAttachments.every((f: any) => !f.data && !f.stagedRef && f.size === 5242880)).toBe(true);
      return saved;
    }
    async function metadata(from: any, to: any) {
      choose(from);
      const logs = await from.db.select().from(schema.syncFieldLog).where(eq(schema.syncFieldLog.isSynced, false));
      const current = await storage.getDefect(initial.id);
      const value = await json(to, '/capacity/metadata', { fieldLogs: logs, fullRows: [{ tableName: 'defects', rows: [current] }] });
      expect(value.applied).toBe(logs.length);
      await from.db.update(schema.syncFieldLog).set({ isSynced: true }).where(eq(schema.syncFieldLog.isSynced, false));
      choose(from);
    }
    async function transfer(label: string) {
      choose(ship);
      let result: any;
      for (let i = 0; i < 12; i++) {
        result = await processDefectTransfers(vessel, transport, 60_000); events.push({ label, ...result });
        console.info('M4_PHASE', JSON.stringify({ label, cycle: i + 1, ...result, requests: metrics.length }));
        if (!result.remaining) break;
      }
      expect(result.remaining).toBe(0);
    }
    const addedShore = await uploadFive(shore, initial);
    await metadata(shore, ship); await transfer('shore-to-ship five files');
    choose(ship);
    const onShip = await storage.getDefect(initial.id);
    for (let i = 0; i < 5; i++) expect(fileHash(await readDefectTransferBytes(onShip!.partCAttachments![i] as any))).toBe(hashes[i]);
    // Five actual user uploads on the other origin exercise ship multipart and outbound bytes too.
    const addedShip = await uploadFive(ship, onShip);
    await metadata(ship, shore); await transfer('ship-to-shore five files');
    choose(shore);
    const onShore = await storage.getDefect(initial.id);
    for (let i = 0; i < 5; i++) expect(fileHash(await readDefectTransferBytes(onShore!.partCAttachments![i] as any))).toBe(hashes[i]);
    const sessionId = randomUUID();
    const four = await json(shore, '/capacity/save', { id: initial.id, partCAttachments: onShore!.partCAttachments!.slice(1),
      attachmentCommit: { sessionId, expectedUpdatedAt: onShore!.updatedAt } });
    await expect(json(shore, '/capacity/save', { id: initial.id, partCAttachments: onShore!.partCAttachments!.slice(2),
      attachmentCommit: { sessionId, expectedUpdatedAt: onShore!.updatedAt } })).rejects.toMatchObject({ statusCode: 409, code: 'DEFECT_STALE' });
    await metadata(shore, ship);
    const empty = await json(shore, '/capacity/save', { id: initial.id, partCAttachments: [],
      attachmentCommit: { sessionId, expectedUpdatedAt: four.updatedAt } });
    await metadata(shore, ship);
    choose(ship); expect((await storage.getDefect(initial.id))!.partCAttachments).toEqual([]);
    expect(empty.partAAttachments).toEqual(initial.partAAttachments);
    expect(empty.attachments).toEqual(initial.attachments);
    for (const file of addedShip.partCAttachments) expect(fileHash(await readDefectTransferBytes(file))).toBe(file.sha256);
    choose(shore);
    for (const file of addedShore.partCAttachments) expect(fileHash(await readDefectTransferBytes(file))).toBe(file.sha256);
    const requests = metrics.filter(m => m.path.endsWith('/sync/defects/files') && m.op === 'chunk');
    expect(requests).toHaveLength(400);
    expect(Math.max(...requests.map(m => m.requestBytes))).toBeLessThan(90_000);
    expect(metrics.filter(m => m.path.includes('/file-staging/'))).toHaveLength(10);
    expect(metrics.every(m => m.status < 400 || m.status === 409)).toBe(true);
    const report = { environment: 'isolated localhost HTTP servers, production handlers/storage/receiver, local private backends',
      fileBytes: files[0].length, filesPerOrigin: 5, totalUploadedBytes: files[0].length * 10, hashes,
      requestCount: metrics.length, largestRequestBytes: Math.max(...metrics.map(m => m.requestBytes)),
      largestResponseBytes: Math.max(...metrics.map(m => m.responseBytes)), events,
      multipartRequests: metrics.filter(m => m.path.includes('/file-staging/')),
      metadataRequests: metrics.filter(m => m.path === '/capacity/metadata'),
      binaryRequestCount: requests.length, largestBinaryRequestBytes: Math.max(...requests.map(m => m.requestBytes)),
      statusCounts: metrics.reduce((a: any, m) => ({ ...a, [m.status]: (a[m.status] || 0) + 1 }), {}),
      sameListStaleSave: '409 DEFECT_STALE; current list preserved', finalC1Count: 0, legacyPreserved: true,
      limitations: ['Loopback fixture, not a production shore/vessel/proxy test', 'Real peer readiness was not modified'] };
    await fs.mkdir('generated-artifacts/defect-attachments', { recursive: true });
    await fs.writeFile('generated-artifacts/defect-attachments/m4-capacity.json', JSON.stringify(report, null, 2));
    console.info('M4_CAPACITY', JSON.stringify(report));
  }, 600_000);
});
