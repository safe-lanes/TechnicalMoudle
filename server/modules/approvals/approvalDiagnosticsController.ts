/**
 * Approval diagnostics — HTTP layer (28-Sep-2026, Sahil C3/C4/C5). Parses input, checks the
 * module-specific Access Control permission for "Apply again", calls the service.
 */
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import * as service from './approvalDiagnosticsService';

const MENU_FOR_MODULE: Record<string, string> = { technical: 'approval-workflow-pms', defects: 'approval-workflow-defects' };
const editGuards = new Map(Object.entries(MENU_FOR_MODULE).map(([mod, menu]) =>
  [mod, requirePermission(menu, 'edit', { enforce: true, unconfigured: 'deny' })]));

export async function getDiagnostics(_req: Request, res: Response) {
  res.json(await service.getApprovalDiagnostics());
}

/** Edit permission on the Approval Workflow menu of the request's own module. */
export async function guardReapply(req: Request, res: Response, next: NextFunction) {
  const requuid = String(req.params.requuid || '');
  const moduleId = await service.moduleOfRequest(requuid);
  if (!moduleId) return res.status(404).json({ error: 'Approval request not found.' });
  const guard = editGuards.get(moduleId);
  if (!guard) return res.status(400).json({ error: `Unknown approval module '${moduleId}'` });
  return guard(req as AuthenticatedRequest, res, next);
}

export async function reapply(req: Request, res: Response) {
  const actor = (req as AuthenticatedRequest).user?.userUuid ?? null;
  const result = await service.reapplyApprovalDecision(String(req.params.requuid), actor);
  res.json({ success: true, ...result });
}
