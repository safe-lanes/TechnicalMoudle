/**
 * Retention & Disposition controller (Audit Phase 4).
 */
import { Request, Response } from 'express';
import * as service from './service';
import { getAuditActor } from '../../middleware/requestContext';

function actorUuid(): string | null {
  const a = getAuditActor();
  return a?.actorId && a.actorId !== 'system' ? a.actorId : null;
}

export async function getRetentionSettings(_req: Request, res: Response) {
  try {
    const [settings, eligibility] = await Promise.all([service.getAllSettings(), service.getEligibility()]);
    res.json({ settings, eligibility });
  } catch (e: any) {
    console.error('Error fetching retention settings:', e);
    res.status(500).json({ error: 'Failed to fetch retention settings', details: e.message });
  }
}

export async function updateRetentionSetting(req: Request, res: Response) {
  try {
    const updated = await service.updateSetting(req.params.category, {
      retentionValue: req.body.retentionValue,
      retentionUnit: req.body.retentionUnit,
      enabled: req.body.enabled,
    }, actorUuid());
    res.json({ success: true, setting: updated });
  } catch (e: any) {
    if (e instanceof service.RetentionError) return res.status(e.statusCode).json({ error: e.message });
    console.error('Error updating retention setting:', e);
    res.status(500).json({ error: 'Failed to update retention setting', details: e.message });
  }
}

export async function disposeCategory(req: Request, res: Response) {
  try {
    const result = await service.dispose(req.params.category, actorUuid());
    res.json({ success: true, ...result });
  } catch (e: any) {
    if (e instanceof service.RetentionError) return res.status(e.statusCode).json({ error: e.message });
    console.error('Error disposing category:', e);
    res.status(500).json({ error: 'Failed to dispose records', details: e.message });
  }
}

export async function retainCategory(req: Request, res: Response) {
  try {
    const result = await service.retain(req.params.category, actorUuid());
    res.json({ success: true, ...result });
  } catch (e: any) {
    if (e instanceof service.RetentionError) return res.status(e.statusCode).json({ error: e.message });
    console.error('Error retaining category:', e);
    res.status(500).json({ error: 'Failed to record retain decision', details: e.message });
  }
}

export async function revertCategory(req: Request, res: Response) {
  try {
    const result = await service.revert(req.params.category, actorUuid());
    res.json({ success: true, ...result });
  } catch (e: any) {
    if (e instanceof service.RetentionError) return res.status(e.statusCode).json({ error: e.message });
    console.error('Error reverting disposition:', e);
    res.status(500).json({ error: 'Failed to revert disposition', details: e.message });
  }
}
