/**
 * HTTP layer (design v3 §B5) — a plain express Router factory used by BOTH entry points.
 * zod on every body; office-side guard on config writes with Phase-0 semantics, implemented
 * self-contained here (the import boundary forbids reaching into server/middleware) and
 * overridable via deps for embedded hosts that want to inject their own requireRole.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { ApprovalEngine, EngineError } from '../core/engine';
import { WorkflowValidationError } from '../core/validateWorkflow';
import type { EngineCtx, Scope } from '../core/types';

export interface RouterDeps {
  engine: ApprovalEngine;
  /** Tenant resolution — reuse the host's (v3 §A7). Default: x-tenant-id header or 'default'. */
  resolveTenantId?: (req: Request) => string;
  /** Actor resolution. Default: the SAILERP-forwarded x-user-* headers (Phase 0 contract). */
  resolveActor?: (req: Request) => EngineCtx['actor'];
  /** Config-write guard. Default: office semantics identical to requireRole(['Office','PMS Admin','Sail Admin']). */
  requireConfigWrite?: (req: Request, res: Response, next: NextFunction) => void;
}

const header = (req: Request, name: string): string | null => {
  const raw = req.headers[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string' || !v.trim()) return null;
  try { return decodeURIComponent(v).trim() || null; } catch { return v.trim(); }
};
const defaultActor = (req: Request): EngineCtx['actor'] => {
  const t = header(req, 'x-user-type');
  return {
    userId: header(req, 'x-user-id') ?? 'anonymous',
    role: header(req, 'x-user-role'),
    userType: t === 'Office' || t === 'Ship' ? t : null,
  };
};
const OFFICE_ROLES = new Set(['Office', 'PMS Admin', 'Sail Admin']);

const scopeSchema = z.object({ moduleId: z.string().min(1), screenId: z.string().min(1), actionId: z.string().default('') });
const scopeFromQuery = (req: Request): Scope => ({
  moduleId: String(req.query.moduleId ?? ''), screenId: String(req.query.screenId ?? ''), actionId: String(req.query.actionId ?? ''),
});
const workflowBody = z.object({
  scope: scopeSchema,
  classification: z.string().min(1),
  mode: z.enum(['simple', 'advanced']),
  label: z.string().min(1),
  nodes: z.array(z.object({
    key: z.string().min(1),
    type: z.enum(['approval-step', 'condition', 'parallel-fork', 'parallel-join', 'end']),
    label: z.string().default(''),
    ordinal: z.number().int(),
    quorum: z.object({ rule: z.enum(['all', 'any', 'nOfM']), n: z.number().int().optional() }).optional(),
    slots: z.array(z.object({ roleId: z.string().min(1), roleLabel: z.string().min(1) })).optional(),
  })).min(1),
  edges: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })),
});
const scopeEnabledBody = z.object({ scope: scopeSchema, enabled: z.boolean() });
const submitBody = z.object({
  scope: scopeSchema, subjectRef: z.string().min(1), subject: z.unknown(), vesselId: z.string().nullish(),
});
const decideBody = z.object({ decision: z.enum(['approve', 'reject']), remarks: z.string().optional() });

export function createEngineRouter(deps: RouterDeps): Router {
  const { engine } = deps;
  const resolveTenantId = deps.resolveTenantId ?? ((req) => header(req, 'x-tenant-id') ?? 'default');
  const resolveActor = deps.resolveActor ?? defaultActor;
  const ctx = (req: Request): EngineCtx => ({ tenantId: resolveTenantId(req), actor: resolveActor(req) });
  const requireConfigWrite = deps.requireConfigWrite ?? ((req: Request, res: Response, next: NextFunction) => {
    const a = resolveActor(req);
    if (a.userType === 'Office' || (a.role && OFFICE_ROLES.has(a.role))) return next();
    res.status(403).json({ error: 'Forbidden - Insufficient permissions', required: ['Office', 'PMS Admin', 'Sail Admin'], current: a.role ?? 'anonymous' });
  });

  const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try { await fn(req, res); } catch (e: any) {
        if (e instanceof EngineError) return void res.status(e.statusCode).json({ error: e.message, code: e.code });
        if (e instanceof WorkflowValidationError) return void res.status(400).json({ error: e.message, code: 'INVALID_WORKFLOW' });
        if (e instanceof z.ZodError) return void res.status(400).json({ error: 'Invalid payload', details: e.errors });
        console.error('[approval-engine] http error:', e);
        res.status(500).json({ error: 'Internal approval-engine error' });
      }
    };

  const r = Router();

  r.get('/registry', wrap(async (_req, res) => { res.json(engine.registryTree()); }));

  r.get('/roles', wrap(async (req, res) => {
    res.json(await engine.listRoles(ctx(req), scopeFromQuery(req)));
  }));

  r.get('/workflows', wrap(async (req, res) => {
    const scope = req.query.moduleId ? scopeFromQuery(req) : undefined;
    res.json(await engine.listWorkflows(ctx(req), scope));
  }));
  r.get('/workflows/:wfuuid', wrap(async (req, res) => {
    res.json(await engine.getWorkflow(ctx(req), req.params.wfuuid));
  }));
  r.post('/workflows', requireConfigWrite, wrap(async (req, res) => {
    const body = workflowBody.parse(req.body);
    res.status(201).json(await engine.saveWorkflow(ctx(req), body as any));
  }));

  r.get('/scopes/enabled', wrap(async (req, res) => {
    res.json({ enabled: await engine.getScopeEnabled(ctx(req), scopeFromQuery(req)) });
  }));
  r.put('/scopes/enabled', requireConfigWrite, wrap(async (req, res) => {
    const body = scopeEnabledBody.parse(req.body);
    await engine.setScopeEnabled(ctx(req), body.scope as Scope, body.enabled);
    res.json({ success: true, enabled: body.enabled });
  }));

  r.post('/requests', wrap(async (req, res) => {
    const body = submitBody.parse(req.body);
    res.json(await engine.submit(ctx(req), { scope: body.scope as Scope, subjectRef: body.subjectRef, subject: body.subject, vesselId: body.vesselId ?? null }));
  }));
  r.post('/requests/:requuid/decide', wrap(async (req, res) => {
    const body = decideBody.parse(req.body);
    res.json(await engine.decide(ctx(req), req.params.requuid, body));
  }));
  r.get('/requests/status', wrap(async (req, res) => {
    const subjectRef = String(req.query.subjectRef ?? '');
    res.json(await engine.status(ctx(req), scopeFromQuery(req), subjectRef));
  }));
  r.get('/pending', wrap(async (req, res) => {
    res.json(await engine.pendingForUser(ctx(req), ctx(req).actor.userId));
  }));

  return r;
}
