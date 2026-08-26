/**
 * Request Context — captures authenticated user info per-request
 * using Node.js AsyncLocalStorage.
 *
 * This allows deep code (field logger, repositories, etc.) to access
 * the current user without threading userId through every function
 * signature.
 *
 * Usage:
 *   // In middleware (already wired in routes.ts):
 *   app.use(requestContextMiddleware);
 *
 *   // Anywhere in the call stack during a request:
 *   const ctx = getRequestContext();
 *   ctx?.userId   // e.g. "5" (users.id as string)
 *   ctx?.fullName // e.g. "John Smith"
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import { resolveAuditActor, SYSTEM_ACTOR, type AuditActor } from './auditActor';

export interface RequestContext {
  /** Canonical actor id (userUuid for real users) — stamped on sync_field_log.changed_by_user_id */
  userId: string;
  /** Frozen human-readable actor label (Office: name, Ship: rank) — for logging + display columns */
  fullName: string;
  /** Full frozen actor for audit writers (field logger, RH audit, createAuditLog). */
  actor: AuditActor;
  /** REAL forwarded SAILERP role (req.rbac.role) — distinct from req.user.role (the mock). Used by
   *  the approval engine gateway to grant admins a decide override without threading role through
   *  every service. Null when nothing was forwarded. */
  rbacRole: string | null;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Express middleware: wraps the request in an AsyncLocalStorage context
 * populated from req.user (set by auth middleware).
 *
 * Must be registered AFTER the auth middleware so req.user is populated.
 */
export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (user && user.id != null) {
    const actor = resolveAuditActor(user);
    const ctx: RequestContext = {
      userId: actor.actorId,
      fullName: actor.actorLabel,
      actor,
      rbacRole: (req as any).rbac?.role ?? null,
    };
    asyncLocalStorage.run(ctx, () => next());
  } else {
    // No authenticated user (shouldn't happen behind auth middleware, but safe fallback)
    next();
  }
}

/**
 * Get the frozen audit actor for the current request.
 * Returns SYSTEM_ACTOR when called outside a request (cron jobs, startup, background writes).
 */
export function getAuditActor(): AuditActor {
  return asyncLocalStorage.getStore()?.actor ?? SYSTEM_ACTOR;
}

/**
 * Get the current request context (user info).
 * Returns undefined when called outside a request (cron jobs, startup, etc.)
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}
