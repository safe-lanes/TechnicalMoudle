import type { Request, Response } from 'express';
import * as service from '../services/vesselService';

// ── Fleet controllers ──

export async function getFleets(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === 'true';
  const fleets = await service.getFleets(includeInactive);
  res.json(fleets);
}

export async function getFleetById(req: Request, res: Response) {
  const fleet = await service.getFleetById(req.params.id);
  res.json(fleet);
}

export async function createFleet(req: Request, res: Response) {
  const fleet = await service.createFleet(req.body);
  res.status(201).json(fleet);
}

export async function updateFleet(req: Request, res: Response) {
  const fleet = await service.updateFleet(req.params.id, req.body);
  res.json(fleet);
}

export async function deleteFleet(req: Request, res: Response) {
  await service.deleteFleet(req.params.id);
  res.json({ success: true });
}

export async function getVesselsByFleet(req: Request, res: Response) {
  const vessels = await service.getVesselsByFleet(req.params.id);
  res.json(vessels);
}

// ── Vessel controllers ──

export async function getVessels(_req: Request, res: Response) {
  const vessels = await service.getVessels();
  res.json(vessels);
}

export async function getVesselsWithFleets(_req: Request, res: Response) {
  const vessels = await service.getVesselsWithFleets();
  res.json(vessels);
}

export async function createVessel(req: Request, res: Response) {
  const vessel = await service.createVessel(req.body);
  res.status(201).json(vessel);
}

export async function assignVesselToFleet(req: Request, res: Response) {
  const vessel = await service.assignVesselToFleet(req.params.id, req.body.fleetId);
  res.json(vessel);
}

// ── PMS Vessel Settings controllers ──

export async function getAllPmsVesselSettings(_req: Request, res: Response) {
  const settings = await service.getAllPmsVesselSettings();
  res.json(settings);
}

export async function createPmsVesselSettings(req: Request, res: Response) {
  const username = (req as any).user?.username || 'test';
  const settings = await service.createPmsVesselSettings(req.body, username);
  res.status(201).json(settings);
}

export async function getPmsVesselSettings(req: Request, res: Response) {
  const settings = await service.getPmsVesselSettings(req.params.vesselId);
  res.json(settings);
}

export async function updatePmsVesselSettings(req: Request, res: Response) {
  const username = (req as any).user?.username || 'test';
  const { settings } = await service.updatePmsVesselSettings(req.params.vesselId, req.body, username);
  res.json(settings);
}

export async function deletePmsVesselSettings(req: Request, res: Response) {
  await service.deletePmsVesselSettings(req.params.vesselId);
  res.json({ success: true });
}

// ── Vessel Location Names controllers ──

export async function getVesselLocationNames(req: Request, res: Response) {
  const result = await service.getVesselLocationNames(req.params.vesselId);
  res.json(result);
}

export async function updateVesselLocationNames(req: Request, res: Response) {
  const username = (req as any).user?.username || 'test';
  const result = await service.updateVesselLocationNames(req.params.vesselId, req.body, username);
  res.json(result);
}
