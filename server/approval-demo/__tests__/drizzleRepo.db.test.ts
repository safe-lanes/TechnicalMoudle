/**
 * Phase 1 / B8 — the PRODUCTION repository (Drizzle/Postgres) + real tenant isolation on two
 * databases. Opt-in like the RH DB suite: runs only with AE_DB_TESTS=1 (needs local Postgres).
 *   AE_DB_TESTS=1 npx vitest run server/approval-demo/__tests__/drizzleRepo.db.test.ts
 * Creates scratch DBs apprv_p1_t1 / apprv_p1_t2, applies migrations/170_approval_engine_tables.sql
 * (twice — idempotency assertion), drops them afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pool } from 'pg';
import { ApprovalEngine, CardRegistry, DrizzlePoolProvider } from '../../modules/approval-engine';
import type { EngineCtx, Scope, WorkflowDefInput } from '../../modules/approval-engine';
import { makeDemoCard } from '../demoCard';

const RUN = process.env.AE_DB_TESTS === '1';
const d = RUN ? describe : describe.skip;
const ADMIN_URL = process.env.AE_PG_ADMIN_URL ?? 'postgres://postgres:admin123@localhost:5432/postgres';
const DBS = ['apprv_p1_t1', 'apprv_p1_t2'];
const url = (db: string) => ADMIN_URL.replace(/\/[^/]*$/, `/${db}`);

const SCOPE: Scope = { moduleId: 'demo', screenId: 'demo-requests', actionId: '' };
const ctx = (tenantId: string, userId = 'admin'): EngineCtx => ({ tenantId, actor: { userId, role: 'Admin', userType: 'Office' } });
const linear = (roles: string[], rule: 'all' | 'any' = 'any'): WorkflowDefInput => ({
  scope: SCOPE, classification: 'normal', mode: 'simple', label: 'db test',
  nodes: [
    { key: 's1', type: 'approval-step', label: 'S1', ordinal: 0, quorum: { rule }, slots: roles.map((r) => ({ roleId: r, roleLabel: r })) },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ],
  edges: [{ from: 's1', to: 'end' }],
});

d('drizzle repository on real Postgres (B8 pilot leg)', () => {
  let provider: DrizzlePoolProvider;
  let engine: ApprovalEngine;
  let recorder: ReturnType<typeof makeDemoCard>['recorder'];

  beforeAll(async () => {
    const admin = new Pool({ connectionString: ADMIN_URL });
    const ddl = fs.readFileSync(path.resolve(__dirname, '../../../migrations/170_approval_engine_tables.sql'), 'utf8');
    for (const db of DBS) {
      await admin.query(`DROP DATABASE IF EXISTS ${db}`);
      await admin.query(`CREATE DATABASE ${db}`);
      const p = new Pool({ connectionString: url(db) });
      await p.query(ddl);
      await p.query(ddl); // idempotency: second run must be a clean no-op
      await p.end();
    }
    await admin.end();
    provider = DrizzlePoolProvider.fromConnectionStrings({ default: url(DBS[0]), t1: url(DBS[0]), t2: url(DBS[1]) });
    const demo = makeDemoCard();
    recorder = demo.recorder;
    const registry = new CardRegistry();
    registry.register(demo.card);
    engine = new ApprovalEngine({ registry, provider });
  }, 60_000);

  afterAll(async () => {
    await provider?.end();
    const admin = new Pool({ connectionString: ADMIN_URL });
    for (const db of DBS) await admin.query(`DROP DATABASE IF EXISTS ${db}`);
    await admin.end();
  });

  it('versioned save: v1 active → v2 active, v1 superseded (partial unique holds)', async () => {
    const v1 = await engine.saveWorkflow(ctx('t1'), linear(['demo-role-reviewer']));
    const v2 = await engine.saveWorkflow(ctx('t1'), linear(['demo-role-manager'], 'all'));
    expect(v1.version).toBe(1); expect(v2.version).toBe(2); expect(v2.status).toBe('active');
    const list = await engine.listWorkflows(ctx('t1'), SCOPE);
    expect(list.find((w) => w.version === 1)!.status).toBe('superseded');
    const hydrated = await engine.getWorkflow(ctx('t1'), v2.wfuuid);
    expect(hydrated.nodes.find((n) => n.key === 's1')!.slots![0].roleId).toBe('demo-role-manager');
    expect(hydrated.edges).toEqual([{ from: 's1', to: 'end' }]);
  });

  it('full flow on Postgres: submit → decide → approved; onDecision exactly once; 409 on replay', async () => {
    recorder.reset();
    const r = await engine.submit(ctx('t1', 'crew'), { scope: SCOPE, subjectRef: 'DB-1', subject: {} });
    expect(r.outcome).toBe('STARTED');
    const requuid = (r as any).requuid;
    const d1 = await engine.decide(ctx('t1', 'user-mgr-1'), requuid, { decision: 'approve', remarks: 'ok' });
    expect(d1.requestStatus).toBe('approved');
    await expect(engine.decide(ctx('t1', 'user-mgr-1'), requuid, { decision: 'approve' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(recorder.decisions).toHaveLength(1);
    const status = await engine.status(ctx('t1'), SCOPE, 'DB-1');
    expect(status[0].status).toBe('approved');
    expect(status[0].slots.map((s) => s.status)).toEqual(['approved']);
  });

  it('pending unique index: second submit for the same subject → ALREADY_PENDING', async () => {
    await engine.submit(ctx('t1', 'crew'), { scope: SCOPE, subjectRef: 'DB-2', subject: {} });
    const again = await engine.submit(ctx('t1', 'crew'), { scope: SCOPE, subjectRef: 'DB-2', subject: {} });
    expect(again.outcome).toBe('ALREADY_PENDING');
  });

  it('TENANT ISOLATION on two real databases: same scope, different workflows, no leakage (B8.7)', async () => {
    await engine.saveWorkflow(ctx('t2'), linear(['demo-role-director'], 'all'));
    const wfT1 = await engine.listWorkflows(ctx('t1'), SCOPE);
    const wfT2 = await engine.listWorkflows(ctx('t2'), SCOPE);
    expect(wfT2).toHaveLength(1);
    expect(wfT2[0].version).toBe(1); // t2 numbering independent of t1's v2
    expect(wfT1.length).toBeGreaterThan(1);
    const r2 = await engine.submit(ctx('t2', 'crew'), { scope: SCOPE, subjectRef: 'DB-1', subject: {} }); // same subjectRef as t1's — no clash
    expect(r2.outcome).toBe('STARTED');
    const pendT2 = await engine.pendingForUser(ctx('t2'), 'user-dir-1');
    expect(pendT2.map((p) => p.subjectRef)).toEqual(['DB-1']);
    const pendT1 = await engine.pendingForUser(ctx('t1'), 'user-dir-1');
    expect(pendT1.find((p) => p.subjectRef === 'DB-1')).toBeUndefined();
  });

  it('scope disable persists per tenant', async () => {
    await engine.setScopeEnabled(ctx('t2'), SCOPE, false);
    expect((await engine.submit(ctx('t2', 'crew'), { scope: SCOPE, subjectRef: 'DB-3', subject: {} })).outcome).toBe('DISABLED');
    expect(await engine.getScopeEnabled(ctx('t1'), SCOPE)).toBe(true); // t1 untouched
    await engine.setScopeEnabled(ctx('t2'), SCOPE, true);
  });
});
