/**
 * Sender withdrawals — HTTP layer (28-Sep-2026, Sahil E6). Parses input, passes the verified
 * caller to the service (which checks the caller is the sender).
 */
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { getRequestContext } from '../../middleware/requestContext';
import { ForbiddenError } from '../shared/errors';
import * as service from './approvalWithdrawalService';

export async function createWithdrawal(req: Request, res: Response) {
  const userUuid = (req as AuthenticatedRequest).user?.userUuid;
  if (!userUuid) throw new ForbiddenError('Sign in to withdraw a request.');
  const body = (req.body ?? {}) as { subjectType?: unknown; subjectRef?: unknown; extensionId?: unknown; reason?: unknown };
  const row = await service.requestWithdrawal({
    subjectType: String(body.subjectType ?? ''),
    subjectRef: String(body.subjectRef ?? ''),
    extensionId: body.extensionId == null ? null : String(body.extensionId),
    reason: typeof body.reason === 'string' ? body.reason : null,
  }, { userUuid, name: getRequestContext()?.actor.actorName ?? getRequestContext()?.fullName ?? null });
  res.status(201).json(row);
}

export async function listWithdrawals(req: Request, res: Response) {
  res.json(await service.listWithdrawals(String(req.query.subjectRef ?? '')));
}

export async function getWithdrawalStatus(req: Request, res: Response) {
  const q = req.query;
  res.json(await service.withdrawalStatus({
    subjectType: String(q.subjectType ?? ''), subjectRef: String(q.subjectRef ?? ''),
    extensionId: q.extensionId == null ? null : String(q.extensionId),
  }, (req as AuthenticatedRequest).user?.userUuid ?? null));
}
