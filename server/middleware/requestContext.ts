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

export interface RequestContext {
  /** users.id as string — the canonical user identifier for sync_field_log */
  userId: string;
  /** Display name for logging/diagnostics */
  fullName: string;
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
    const ctx: RequestContext = {
      userId: String(user.id),
      fullName: user.fullName || user.username || `User ${user.id}`,
    };
    asyncLocalStorage.run(ctx, () => next());
  } else {
    // No authenticated user (shouldn't happen behind auth middleware, but safe fallback)
    next();
  }
}

/**
 * Get the current request context (user info).
 * Returns undefined when called outside a request (cron jobs, startup, etc.)
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}
