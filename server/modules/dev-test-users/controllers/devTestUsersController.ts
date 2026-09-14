import type { Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../shared/errors';
import * as service from '../services/devTestUsersService';

export const devTestVesselBodySchema = z.object({
  vuuid: z.string().trim().min(1),
});

const devTestUserParamsSchema = z.object({
  userId: z.string().trim().min(1),
});

const devTestUserVesselParamsSchema = devTestUserParamsSchema.extend({
  vuuid: z.string().trim().min(1),
});

export async function listDevTestUsers(_req: Request, res: Response) {
  res.json(await service.getUsersSnapshot());
}

export async function getDevTestUserResolution(req: Request, res: Response) {
  const params = devTestUserParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError('A non-empty userId path parameter is required', params.error.flatten());
  }
  res.json(await service.getUserResolution(params.data.userId));
}

export async function assignDevTestUserVessel(req: Request, res: Response) {
  const params = devTestUserParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError('A non-empty userId path parameter is required', params.error.flatten());
  }
  const parsed = devTestVesselBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Body must be { vuuid: string }', parsed.error.flatten());
  }
  const snapshot = await service.assignUserToVessel(params.data.userId, parsed.data.vuuid);
  res.json(snapshot);
}

export async function removeDevTestUserVessel(req: Request, res: Response) {
  const params = devTestUserVesselParamsSchema.safeParse(req.params);
  if (!params.success) {
    throw new ValidationError(
      'Non-empty userId and vuuid path parameters are required',
      params.error.flatten(),
    );
  }
  const snapshot = await service.removeUserFromVessel(params.data.userId, params.data.vuuid);
  res.json(snapshot);
}