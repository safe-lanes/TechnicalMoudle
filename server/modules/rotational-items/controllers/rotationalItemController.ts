import type { Request, Response } from 'express';
import * as service from '../services/rotationalItemService';

export async function listRotationalItems(req: Request, res: Response) {
  const vesselId = String(req.query.vesselId || '');
  const status = req.query.status ? String(req.query.status) : undefined;
  if (!vesselId) {
    return res.status(400).json({ error: 'vesselId query parameter is required' });
  }
  const items = await service.listByVessel(vesselId, status);
  res.json(items);
}

export async function createRotationalItem(req: Request, res: Response) {
  const item = await service.createRotationalItem(req.body);
  res.status(201).json(item);
}

export async function updateRotationalItem(req: Request, res: Response) {
  const item = await service.updateRotationalItem(req.params.riuuid, req.body);
  res.json(item);
}

export async function deleteRotationalItem(req: Request, res: Response) {
  await service.deleteRotationalItem(req.params.riuuid);
  res.json({ success: true });
}
