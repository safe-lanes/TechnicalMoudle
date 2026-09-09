import type { Request, Response } from 'express';
import * as service from '../services/rotationalItemService';
import { NotFoundError, ValidationError } from '../../shared/errors';

export async function listRotationalItems(req: Request, res: Response) {
  const vesselId = String(req.query.vesselId || '');
  const status = req.query.status ? String(req.query.status) : undefined;
  if (!vesselId) {
    return res.status(400).json({ error: 'vesselId query parameter is required' });
  }
  // withHolder=true → Master List screen shape (adds installedOn* via derived join)
  if (String(req.query.withHolder || '') === 'true') {
    const items = await service.listByVesselWithHolder(vesselId, status);
    return res.json(items);
  }
  const items = await service.listByVessel(vesselId, status);
  res.json(items);
}

export async function createRotationalItem(req: Request, res: Response) {
  // Master List "Add" — new stamps enter as Spare / In Store only; Installed status
  // is reachable exclusively through component fitting / swaps.
  const status = req.body.status ?? 'Spare';
  if (!['Spare', 'In Store'].includes(status)) {
    throw new ValidationError('New rotation items must be created as Spare or In Store');
  }
  const item = await service.createRotationalItem({ ...req.body, status });
  res.status(201).json(item);
}

/**
 * Master List "Edit" guards (Task #366): while a stamp is Installed on a component,
 * the screen cannot rename it, change its status, or edit its RH — those flows run
 * through component save / swap so the derived current_stamp link never breaks.
 * Only stamp_name stays editable while Installed.
 */
export async function updateRotationalItem(req: Request, res: Response) {
  const existing = await service.getByRiuuid(req.params.riuuid);
  if (!existing) throw new NotFoundError('Rotational item not found');
  const body = req.body ?? {};
  if (existing.status === 'Installed') {
    if (body.stamp !== undefined && String(body.stamp).trim() !== existing.stamp) {
      throw new ValidationError('Cannot rename a stamp while it is installed on a component. Detach or swap it first.');
    }
    if (body.status !== undefined && body.status !== 'Installed') {
      throw new ValidationError('Cannot change the status of an installed stamp from here. Detach or swap it on the component first.');
    }
    if (body.currentRh !== undefined || body.rhLastUpdated !== undefined) {
      throw new ValidationError('Running hours of an installed stamp follow its component and cannot be edited here.');
    }
  } else if (body.status !== undefined && body.status === 'Installed') {
    throw new ValidationError('Status "Installed" is set by fitting the stamp to a component, not from the master list.');
  }
  const item = await service.updateRotationalItem(req.params.riuuid, body);
  res.json(item);
}

export async function replaceRotationalItem(req: Request, res: Response) {
  const result = await service.replaceRotationalItem({
    componentCuuid: String(req.body.componentCuuid || ''),
    incomingRiuuid: req.body.incomingRiuuid ?? null,
    newStamp: req.body.newStamp ?? null,
    newStampName: req.body.newStampName ?? null,
    newStampInitialRh: req.body.newStampInitialRh ?? null,
    notes: req.body.notes ?? null,
    // Actor identity comes from the authenticated request context inside the service
    // (currentUserUuid/getAuditActor) — never from the request body.
  });
  res.status(201).json(result);
}

export async function deleteRotationalItem(req: Request, res: Response) {
  const existing = await service.getByRiuuid(req.params.riuuid);
  if (!existing) throw new NotFoundError('Rotational item not found');
  if (existing.status === 'Installed') {
    throw new ValidationError('Cannot delete a stamp while it is installed on a component. Detach or swap it first.');
  }
  await service.deleteRotationalItem(req.params.riuuid);
  res.json({ success: true });
}
