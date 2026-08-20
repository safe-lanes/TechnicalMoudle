/**
 * Approval Engine — the two entry points (design v3 §A5).
 *
 *   startEmbedded(app, deps)  — mounts the engine's routes on a host Express app; the host
 *                               injects tenant resolution / guards / event transport.
 *   startStandalone(opts)     — own Express + DB bootstrap; serves /health + the full API.
 *
 * Phase 1 wires NOTHING into Technical — the demo card (server/approval-demo/) is the only
 * consumer, and it lives OUTSIDE this folder on purpose (import-boundary proof).
 */
import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { ApprovalEngine, type EngineDeps } from './core/engine';
import { CardRegistry } from './core/registry';
import type { TenantRepositoryProvider } from './core/repository';
import type { ApprovalCard, EngineEvent } from './core/types';
import { DrizzlePoolProvider } from './db/drizzleRepository';
import { createEngineRouter, type RouterDeps } from './http/router';

export * from './core/types';
export { CardRegistry, CardRegistrationError } from './core/registry';
export { ApprovalEngine, EngineError } from './core/engine';
export { validateWorkflowV1, WorkflowValidationError, MAX_APPROVAL_STEPS } from './core/validateWorkflow';
export type { ApprovalRepository, TenantRepositoryProvider } from './core/repository';
export { DrizzleApprovalRepository, DrizzlePoolProvider } from './db/drizzleRepository';
export { createEngineRouter } from './http/router';

export interface StartEmbeddedDeps extends Omit<RouterDeps, 'engine'> {
  cards: ApprovalCard[];
  provider: TenantRepositoryProvider;
  onEvent?: (evt: EngineEvent) => void;
  /** Mount path. Default '/approval-engine'. */
  basePath?: string;
}

/** Registers the cards (fail-loud), builds the engine, mounts the router. Returns the engine. */
export function startEmbedded(app: Express, deps: StartEmbeddedDeps): ApprovalEngine {
  const registry = new CardRegistry();
  for (const card of deps.cards) registry.register(card); // throws CardRegistrationError → refuse to start
  const engine = new ApprovalEngine({ registry, provider: deps.provider, onEvent: deps.onEvent } satisfies EngineDeps);
  app.use(deps.basePath ?? '/approval-engine', express.json({ limit: '1mb' }), createEngineRouter({
    engine,
    resolveTenantId: deps.resolveTenantId,
    resolveActor: deps.resolveActor,
    requireConfigWrite: deps.requireConfigWrite,
  }));
  return engine;
}

export interface StartStandaloneOpts {
  cards: ApprovalCard[];
  /** Default: env AE_DATABASE_URL || DATABASE_URL (tenant 'default'). */
  databaseUrl?: string;
  /** Extra tenants: tenantId → connection string. */
  tenants?: Record<string, string>;
  /** Test seam: overrides the DB bootstrap entirely. */
  provider?: TenantRepositoryProvider;
  port?: number;                  // default env AE_PORT || 5055
  onEvent?: (evt: EngineEvent) => void;
}
export interface StandaloneHandle {
  app: Express;
  server: Server;
  engine: ApprovalEngine;
  port: number;
  close(): Promise<void>;
}

/** Own Express + DB bootstrap. Serves /health, and the engine API under /approval-engine. */
export async function startStandalone(opts: StartStandaloneOpts): Promise<StandaloneHandle> {
  let provider = opts.provider;
  let ownedProvider: DrizzlePoolProvider | undefined;
  if (!provider) {
    const url = opts.databaseUrl ?? process.env.AE_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error('[approval-engine] standalone needs databaseUrl (or AE_DATABASE_URL / DATABASE_URL)');
    const pools = new Map<string, Pool>([['default', new Pool({ connectionString: url })]]);
    for (const [tenant, cs] of Object.entries(opts.tenants ?? {})) pools.set(tenant, new Pool({ connectionString: cs }));
    ownedProvider = new DrizzlePoolProvider(pools);
    provider = ownedProvider;
  }
  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'approval-engine', mode: 'standalone' }));
  const engine = startEmbedded(app, { cards: opts.cards, provider, onEvent: opts.onEvent });
  const port = opts.port ?? Number(process.env.AE_PORT ?? 5055);
  const server: Server = await new Promise((resolve) => { const s = app.listen(port, () => resolve(s)); });
  const actualPort = (server.address() as { port: number }).port;
  console.log(`[approval-engine] standalone listening on :${actualPort}`);
  return {
    app, server, engine, port: actualPort,
    close: async () => { await new Promise<void>((r) => server.close(() => r())); await ownedProvider?.end(); },
  };
}
