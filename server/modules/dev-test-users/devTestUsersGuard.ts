import type { RequestHandler } from 'express';

/**
 * This is intentionally a two-key fail-closed guard. REPL_ID is intrinsic to
 * the Replit process, while the explicit switch is required even in that
 * environment so these identity-changing routes cannot be enabled by accident.
 */
export const devTestUsersGuard: RequestHandler = (_req, res, next) => {
  if (!process.env.REPL_ID || process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
};