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

/** Host admin roles for the Approval Engine: builder access (F6) + the engine decide override
 *  on zero-approver steps (F3b). Single source of truth for both. */
const APPROVAL_ADMIN_ROLES = ['Sail Admin', 'Super Admin', 'PMS Admin'] as const;
const APPROVAL_ADMIN_ROLE_SET: ReadonlySet<string> = new Set(APPROVAL_ADMIN_ROLES);

export async function mountTechnicalApprovals(app: Express): Promise<void> {
  const { isShipInstance } = await import('../sync/syncRole');
  if (await isShipInstance()) {
    console.log('🔏 Approval engine NOT mounted (ship instance — engine is shore-only, D-4)');
    return;
  }
  // F6 (Q2): the Approval Engine builder is ADMIN-ONLY — config writes require an admin role
  // (not any Office-typed user). Same role set as the menu + page guard (no three-way divergence).
  const configGuard = requireRole([...APPROVAL_ADMIN_ROLES]);
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
      const isAdmin = !!id.role && APPROVAL_ADMIN_ROLE_SET.has(id.role);
      return { userId: r.user?.userUuid ?? 'anonymous', role: id.role, userType: id.userType, isAdmin };
    },
    requireConfigWrite: (req: Request, res: Response, next: NextFunction) => configGuard(req as AuthenticatedRequest, res, next),
    onEvent: approvalEventNotifier,
  });
  setTechnicalEngine(engine);
  console.log('🔏 Approval engine mounted at /technical/api/approval-engine (Technical card registered)');
}
