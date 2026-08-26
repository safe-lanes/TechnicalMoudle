/**
 * Phase 2 / W1 — mounts the approval engine into the host app (SHORE ONLY; design v3 §2a —
 * ships never run the engine, D-4). Called once from server/routes.ts after the auth chain.
 * Injects the host's tenant resolution, Phase-0 RBAC guard, and the notifier.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import { startEmbedded } from '../approval-engine';
import { requireRole, getRbacIdentity, type AuthenticatedRequest } from '../../middleware/auth';
import { technicalApprovalCard } from './approvalCard';
import { approvalEventNotifier } from './approvalNotifier';
import { AlsTenantRepositoryProvider, currentEngineTenantId } from './tenantProvider';
import { setTechnicalEngine } from './engineGateway';

/** Host admin roles that get a blanket decide override on the engine (parity with legacy). */
const APPROVAL_ADMIN_ROLES: ReadonlySet<string> = new Set(['Sail Admin', 'Super Admin', 'PMS Admin']);

export async function mountTechnicalApprovals(app: Express): Promise<void> {
  const { isShipInstance } = await import('../sync/syncRole');
  if (await isShipInstance()) {
    console.log('🔏 Approval engine NOT mounted (ship instance — engine is shore-only, D-4)');
    return;
  }
  const configGuard = requireRole(['Office', 'PMS Admin', 'Sail Admin']);
  const engine = startEmbedded(app, {
    cards: [technicalApprovalCard],                       // broken card = refuse to start (fail-loud)
    provider: new AlsTenantRepositoryProvider(),
    basePath: '/technical/api/approval-engine',
    resolveTenantId: () => currentEngineTenantId(),       // same ALS source as the provider
    resolveActor: (req: Request) => {
      const r = req as AuthenticatedRequest;
      const id = getRbacIdentity(r);
      // F3b: mark admin actors so the engine grants them a decide override (parity with the
      // host's legacy Sail-Admin bypass). Host owns the role names; the engine stays agnostic.
      const isAdmin = !!id.role && APPROVAL_ADMIN_ROLES.has(id.role);
      return { userId: r.user?.userUuid ?? 'anonymous', role: id.role, userType: id.userType, isAdmin };
    },
    requireConfigWrite: (req: Request, res: Response, next: NextFunction) => configGuard(req as AuthenticatedRequest, res, next),
    onEvent: approvalEventNotifier,
  });
  setTechnicalEngine(engine);
  console.log('🔏 Approval engine mounted at /technical/api/approval-engine (Technical card registered)');
}
