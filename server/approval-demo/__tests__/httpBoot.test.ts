/**
 * Phase 1 / B8 — both entry points BOOT and serve the API (§A5). Uses the in-memory provider
 * (startStandalone's provider seam); the real-DB standalone proof runs on the pilot
 * (standaloneDemo.ts) and is recorded in PHASE1-REPORT.md. Also covers B5 guards + zod +
 * the workflow validator over HTTP (advanced mode / unsupported node types refused).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { startEmbedded, startStandalone } from '../../modules/approval-engine';
import { makeDemoCard } from '../demoCard';
import { InMemoryProvider } from './inMemoryRepository';

const SCOPE = { moduleId: 'demo', screenId: 'demo-requests', actionId: '' };
const OFFICE = { 'x-user-id': 'admin-1', 'x-user-role': 'Admin', 'x-user-type': 'Office' };
const VESSEL = { 'x-user-id': 'crew-1', 'x-user-role': encodeURIComponent('Vessel User'), 'x-user-type': 'Ship' };
const linear = (roles: string[]) => ({
  scope: SCOPE, classification: 'normal', mode: 'simple', label: 'http test',
  nodes: [
    { key: 's1', type: 'approval-step', label: 'S1', ordinal: 0, quorum: { rule: 'any' }, slots: roles.map((r) => ({ roleId: r, roleLabel: r })) },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ],
  edges: [{ from: 's1', to: 'end' }],
});

async function call(base: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

describe('embedded boot (§A5)', () => {
  let server: Server; let base: string;
  beforeAll(async () => {
    const app = express();
    startEmbedded(app, { cards: [makeDemoCard().card], provider: new InMemoryProvider() });
    server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

  it('serves the registry tree', async () => {
    const r = await call(base, 'GET', '/approval-engine/registry');
    expect(r.status).toBe(200);
    expect(r.json.modules[0].moduleId).toBe('demo');
  });
  it('config write requires office (Phase-0 semantics): vessel 403, anonymous 403, office 201', async () => {
    expect((await call(base, 'POST', '/approval-engine/workflows', linear(['demo-role-reviewer']), VESSEL)).status).toBe(403);
    expect((await call(base, 'POST', '/approval-engine/workflows', linear(['demo-role-reviewer']))).status).toBe(403);
    const ok = await call(base, 'POST', '/approval-engine/workflows', linear(['demo-role-reviewer']), OFFICE);
    expect(ok.status).toBe(201);
    expect(ok.json.version).toBe(1);
  });
  it('zod rejects a malformed body (400 with details)', async () => {
    const r = await call(base, 'POST', '/approval-engine/workflows', { scope: SCOPE }, OFFICE);
    expect(r.status).toBe(400);
    expect(r.json.details?.length).toBeGreaterThan(0);
  });
  it("mode 'advanced' is refused by the API", async () => {
    const r = await call(base, 'POST', '/approval-engine/workflows', { ...linear(['demo-role-reviewer']), mode: 'advanced' }, OFFICE);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/not yet supported/);
  });
  it('unsupported node type (condition) is refused with a precise error', async () => {
    const body = linear(['demo-role-reviewer']);
    (body.nodes as any).splice(1, 0, { key: 'c1', type: 'condition', label: 'C', ordinal: 1 });
    body.edges = [{ from: 's1', to: 'c1' }, { from: 'c1', to: 'end' }] as any;
    const r = await call(base, 'POST', '/approval-engine/workflows', body, OFFICE);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/'condition' is not yet supported/);
  });
  it('full flow over HTTP: submit → pending → decide → status', async () => {
    const sub = await call(base, 'POST', '/approval-engine/requests', { scope: SCOPE, subjectRef: 'HTTP-1', subject: { critical: false } }, VESSEL);
    expect(sub.json.outcome).toBe('STARTED');
    const pend = await call(base, 'GET', '/approval-engine/pending', undefined, { 'x-user-id': 'user-rev-1' });
    expect(pend.json.map((p: any) => p.subjectRef)).toContain('HTTP-1');
    const dec = await call(base, 'POST', `/approval-engine/requests/${sub.json.requuid}/decide`, { decision: 'approve' }, { 'x-user-id': 'user-rev-1' });
    expect(dec.json.requestStatus).toBe('approved');
    const st = await call(base, 'GET', `/approval-engine/requests/status?moduleId=demo&screenId=demo-requests&actionId=&subjectRef=HTTP-1`);
    expect(st.json[0].status).toBe('approved');
    expect(st.json[0].slots.map((s: any) => s.status)).toContain('approved');
  });
  it('scope enable/disable via HTTP (office-guarded)', async () => {
    expect((await call(base, 'PUT', '/approval-engine/scopes/enabled', { scope: SCOPE, enabled: false }, VESSEL)).status).toBe(403);
    expect((await call(base, 'PUT', '/approval-engine/scopes/enabled', { scope: SCOPE, enabled: false }, OFFICE)).status).toBe(200);
    const sub = await call(base, 'POST', '/approval-engine/requests', { scope: SCOPE, subjectRef: 'HTTP-2', subject: {} }, VESSEL);
    expect(sub.json.outcome).toBe('DISABLED');
    await call(base, 'PUT', '/approval-engine/scopes/enabled', { scope: SCOPE, enabled: true }, OFFICE);
  });
});

describe('standalone boot (§A5) with the provider seam', () => {
  it('boots its own express, serves /health + registry, closes cleanly', async () => {
    const handle = await startStandalone({ cards: [makeDemoCard().card], provider: new InMemoryProvider(), port: 0 });
    try {
      const health = await call(`http://127.0.0.1:${handle.port}`, 'GET', '/health');
      expect(health.json).toMatchObject({ status: 'ok', service: 'approval-engine', mode: 'standalone' });
      const reg = await call(`http://127.0.0.1:${handle.port}`, 'GET', '/approval-engine/registry');
      expect(reg.json.modules).toHaveLength(1);
    } finally { await handle.close(); }
  });
  it('a broken card refuses the start (fail-loud)', async () => {
    const { card } = makeDemoCard({ classify: undefined as any });
    await expect(startStandalone({ cards: [card], provider: new InMemoryProvider(), port: 0 }))
      .rejects.toThrow(/required function classify\(\) missing/);
  });
});
