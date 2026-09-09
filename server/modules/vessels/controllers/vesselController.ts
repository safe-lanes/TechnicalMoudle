import type { Request, Response } from 'express';
import * as service from '../services/vesselService';
import { WorkOrderStatusRecalculatorService } from '../../../services/workOrderStatusRecalculator';

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

// ── Fleet Class controllers ──

export async function getFleetClasses(req: Request, res: Response) {
  const classes = await service.getFleetClasses(req.params.fleetId);
  res.json(classes);
}

export async function createFleetClass(req: Request, res: Response) {
  const fleetClass = await service.createFleetClass(req.params.fleetId, req.body);
  res.status(201).json(fleetClass);
}

export async function updateFleetClass(req: Request, res: Response) {
  const { name, description, updatedByUuid } = req.body;
  const fleetClass = await service.updateFleetClass(req.params.fcuuid, { name, description, updatedByUuid });
  res.json(fleetClass);
}

export async function deleteFleetClass(req: Request, res: Response) {
  await service.deleteFleetClass(req.params.fcuuid);
  res.json({ success: true });
}

export async function assignVesselToClass(req: Request, res: Response) {
  const { classId } = req.body;
  const vessel = await service.assignVesselToClass(req.params.id, classId ?? null);
  res.json(vessel);
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
  // RH validation may only change through the dedicated shore-admin endpoint.
  // Reject rather than silently accepting the field so callers cannot mistake
  // this generic settings endpoint for an authorization bypass.
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'rhValidationEnabled')) {
    return res.status(400).json({ error: 'Use the dedicated RH validation endpoint to change this setting.' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'superintendentLockEnabled')) {
    return res.status(400).json({ error: 'Use the dedicated Superintendent lock endpoint to change this setting.' });
  }
  const username = (req as any).user?.username || 'test';
  const settings = await service.createPmsVesselSettings(req.body, username);
  res.status(201).json(settings);
}

export async function getPmsVesselSettings(req: Request, res: Response) {
  const settings = await service.getPmsVesselSettings(req.params.vesselId);
  res.json(settings);
}

export async function updatePmsVesselSettings(req: Request, res: Response) {
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'rhValidationEnabled')) {
    return res.status(400).json({ error: 'Use the dedicated RH validation endpoint to change this setting.' });
  }
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'superintendentLockEnabled')) {
    return res.status(400).json({ error: 'Use the dedicated Superintendent lock endpoint to change this setting.' });
  }
  const username = (req as any).user?.username || 'test';
  const { settings } = await service.updatePmsVesselSettings(req.params.vesselId, req.body, username);
  res.json(settings);
}

export async function deletePmsVesselSettings(req: Request, res: Response) {
  // Deleting a settings row changes the effective RH policy back to the
  // missing-row default (ON), so it is a policy mutation as well.
  const { isShipInstance } = await import('../../sync/syncRole');
  if (await isShipInstance()) {
    return res.status(403).json({ error: 'shore_only', message: 'PMS vessel settings are configured on the shore server.' });
  }
  // Authorization must use the server-authenticated role. forwardedRole is
  // request metadata for audit attribution, not an RBAC source.
  const userRole = ((req as any).user?.role || '').trim();
  if (!OFFICE_WO_SWITCH_EDITOR_ROLES.has(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: 'Only Sail Admin / Super Admin may delete PMS vessel settings.' });
  }
  await service.deletePmsVesselSettings(req.params.vesselId);
  res.json({ success: true });
}

// PUT /pms-vessel-settings/:vesselId/office-wo-generation — per-vessel kill switch
// (migration 161) for office-side WO generation. Shore-only (403 on ship — the setting
// syncs ONE_WAY shore→ship), Sail Admin / Super Admin only. Mirrors the approval-policy
// endpoint's enforcement pattern: server-side refusal, not UI-only hiding.
const OFFICE_WO_SWITCH_EDITOR_ROLES = new Set(['Sail Admin', 'Super Admin']);

export async function updateOfficeWoGenerationSwitch(req: Request, res: Response) {
  const { isShipInstance } = await import('../../sync/syncRole');
  if (await isShipInstance()) {
    return res.status(403).json({ error: 'shore_only', message: 'Office work-order generation is configured on the shore server.' });
  }
  const userRole = ((req as any).user?.forwardedRole || (req as any).user?.role || '').trim();
  if (!OFFICE_WO_SWITCH_EDITOR_ROLES.has(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: 'Only Sail Admin / Super Admin may change office work-order generation.' });
  }
  const { enabled } = req.body ?? {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }
  const username = (req as any).user?.username || 'unknown';
  const settings = await service.setOfficeWoGenerationEnabled(req.params.vesselId, enabled, username);
  console.log(`[OfficeWoSwitch] vessel=${req.params.vesselId} office_wo_generation_enabled=${enabled} by ${username}`);
  res.json({ vesselId: req.params.vesselId, officeWoGenerationEnabled: settings.officeWoGenerationEnabled, updatedBy: settings.updatedBy });
}

// PUT /pms-vessel-settings/:vesselId/office-rh-entry — per-vessel kill switch
// (migration 162, Task #394) for office-side RH entry via WO completion. Same
// enforcement pattern as the office WO generation switch: shore-only, Sail Admin /
// Super Admin only, server-side refusal. Gates only office WRITES — the
// latest-reading-wins receive guards are always on regardless of this switch.
export async function updateOfficeRhEntrySwitch(req: Request, res: Response) {
  const { isShipInstance } = await import('../../sync/syncRole');
  if (await isShipInstance()) {
    return res.status(403).json({ error: 'shore_only', message: 'Office RH entry is configured on the shore server.' });
  }
  const userRole = ((req as any).user?.forwardedRole || (req as any).user?.role || '').trim();
  if (!OFFICE_WO_SWITCH_EDITOR_ROLES.has(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: 'Only Sail Admin / Super Admin may change office RH entry.' });
  }
  const { enabled } = req.body ?? {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }
  const username = (req as any).user?.username || 'unknown';
  const settings = await service.setOfficeRhEntryEnabled(req.params.vesselId, enabled, username);
  console.log(`[OfficeRhSwitch] vessel=${req.params.vesselId} office_rh_entry_enabled=${enabled} by ${username}`);
  res.json({ vesselId: req.params.vesselId, officeRhEntryEnabled: (settings as any).officeRhEntryEnabled, updatedBy: settings.updatedBy });
}

// PUT /pms-vessel-settings/:vesselId/rh-validation — per-vessel RH policy
// (migration 163). Shore-only, Sail Admin / Super Admin only. The setting is
// synced to the vessel and controls validation there after receipt.
export async function updateRhValidationSwitch(req: Request, res: Response) {
  const { isShipInstance } = await import('../../sync/syncRole');
  if (await isShipInstance()) {
    return res.status(403).json({ error: 'shore_only', message: 'RH validation is configured on the shore server.' });
  }
  const userRole = ((req as any).user?.forwardedRole || (req as any).user?.role || '').trim();
  if (!OFFICE_WO_SWITCH_EDITOR_ROLES.has(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: 'Only Sail Admin / Super Admin may change RH validation.' });
  }
  const { enabled } = req.body ?? {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }
  const username = (req as any).user?.username || 'unknown';
  const settings = await service.setRhValidationEnabled(req.params.vesselId, enabled, username);
  console.log(`[RhValidationSwitch] vessel=${req.params.vesselId} rh_validation_enabled=${enabled} by ${username}`);
  res.json({ vesselId: req.params.vesselId, rhValidationEnabled: settings.rhValidationEnabled, updatedBy: settings.updatedBy });
}

// PUT /pms-vessel-settings/:vesselId/superintendent-lock — vessel-specific
// approval lock. Shore-only and Sail Admin / Super Admin only; ships receive
// this setting through the existing one-way PMS settings synchronization.
export async function updateSuperintendentLockSwitch(req: Request, res: Response) {
  const { isShipInstance } = await import('../../sync/syncRole');
  if (await isShipInstance()) {
    return res.status(403).json({ error: 'shore_only', message: 'Superintendent approval lock is configured on the shore server.' });
  }
  // forwardedRole is request metadata used for audit attribution only; RBAC
  // must rely on the server-authenticated session role.
  const userRole = ((req as any).user?.role || '').trim();
  if (!OFFICE_WO_SWITCH_EDITOR_ROLES.has(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: 'Only Sail Admin / Super Admin may change the Superintendent approval lock.' });
  }
  const { enabled } = req.body ?? {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }
  const username = (req as any).user?.username || 'unknown';
  const settings = await service.setSuperintendentLockEnabled(req.params.vesselId, enabled, username);
  console.log(`[SuperintendentLock] vessel=${req.params.vesselId} superintendent_lock_enabled=${enabled} by ${username}`);
  res.json({ vesselId: req.params.vesselId, superintendentLockEnabled: settings.superintendentLockEnabled, updatedBy: settings.updatedBy });
}

// ── Company Standard Grace Settings controllers ──

export async function getCompanyStandardGraceSettings(_req: Request, res: Response) {
  const settings = await service.getCompanyStandardGraceSettings();
  res.json(settings);
}

export async function updateCompanyStandardGraceSettings(req: Request, res: Response) {
  const username = (req as any).user?.username || 'test';
  const settings = await service.upsertCompanyStandardGraceSettings(req.body, username);
  const recalculator = new WorkOrderStatusRecalculatorService();
  recalculator.forceRecalculation().catch(err => {
    console.error('[CompanyGrace] Status recalculation after update failed:', err);
  });
  res.json(settings);
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
