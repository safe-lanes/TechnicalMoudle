import { Request, Response } from 'express';
import * as service from '../services/noonReportService';
import * as bunkerService from '../services/bunkerService';
import { insertNrNoonReportSchema, insertNrBunkerRecordSchema } from '@shared/schema';
import { z } from 'zod';

// ── GET /nr-reports ──────────────────────────────────────────────────────────
export async function getNoonReports(req: Request, res: Response) {
  try {
    const { vesselId, status } = req.query;
    const reports = await service.getNoonReports({
      vesselId: vesselId as string,
      status: status as string,
    });
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch noon reports', details: error.message });
  }
}

// ── GET /nr-reports/:id ──────────────────────────────────────────────────────
export async function getNoonReport(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });
    const report = await service.getNoonReport(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch noon report', details: error.message });
  }
}

// ── POST /nr-reports ─────────────────────────────────────────────────────────
export async function createNoonReport(req: Request, res: Response) {
  try {
    const parsed = insertNrNoonReportSchema.partial().parse(req.body);
    if (!parsed.vesselId || !parsed.reportDate) {
      return res.status(400).json({ error: 'vesselId and reportDate are required' });
    }
    const report = await service.createDraftReport(parsed as any);
    res.status(201).json(report);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    res.status(500).json({ error: 'Failed to create noon report', details: error.message });
  }
}

// ── PATCH /nr-reports/:id ────────────────────────────────────────────────────
export async function updateNoonReport(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });
    const report = await service.updateDraftReport(id, req.body);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error: any) {
    if (error.message === 'Cannot edit a submitted report') return res.status(409).json({ error: error.message });
    res.status(500).json({ error: 'Failed to update noon report', details: error.message });
  }
}

// ── PATCH /nr-reports/:id/draft ──────────────────────────────────────────────
export async function saveDraft(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });
    const report = await service.saveDraft(id, req.body);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save draft', details: error.message });
  }
}

// ── POST /nr-reports/:id/submit ──────────────────────────────────────────────
export async function submitNoonReport(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });
    const submittedBy = (req as any).user?.fullName || req.body.submittedBy || 'Unknown';
    const report = await service.submitReport(id, submittedBy);
    res.json(report);
  } catch (error: any) {
    if (error.message === 'Report already submitted') return res.status(409).json({ error: error.message });
    res.status(500).json({ error: 'Failed to submit report', details: error.message });
  }
}

// ── DELETE /nr-reports/:id ───────────────────────────────────────────────────
export async function deleteNoonReport(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid report ID' });
    await service.deleteReport(id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Cannot delete a submitted report') return res.status(409).json({ error: error.message });
    res.status(500).json({ error: 'Failed to delete noon report', details: error.message });
  }
}

// ── GET /nr-fuel-rob ─────────────────────────────────────────────────────────
export async function getFuelRob(req: Request, res: Response) {
  try {
    const { vesselId } = req.query;
    if (!vesselId) return res.status(400).json({ error: 'vesselId is required' });
    const rob = await service.getFuelRob(vesselId as string);
    res.json(rob);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch fuel ROB', details: error.message });
  }
}

// ── GET /nr-kpis ─────────────────────────────────────────────────────────────
export async function getVesselKPIs(req: Request, res: Response) {
  try {
    const { vesselId } = req.query;
    if (!vesselId) return res.status(400).json({ error: 'vesselId is required' });
    const kpis = await service.getVesselKPIs(vesselId as string);
    res.json(kpis);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch KPIs', details: error.message });
  }
}

// ── GET /nr-fuel-dashboard/:vesselId ──────────────────────────────────────────
export async function getFuelDashboard(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    if (!vesselId) return res.status(400).json({ error: 'vesselId is required' });
    const dashboard = await service.getFuelDashboard(vesselId);
    res.json(dashboard);
  } catch (error: any) {
    console.error('[getFuelDashboard] Error:', error?.stack ?? error);
    res.status(500).json({ error: 'Failed to fetch fuel dashboard', details: error.message });
  }
}

// ── GET /nr-alerts/:vesselId ──────────────────────────────────────────────────
// Returns all unacknowledged alerts for the vessel.
export async function getActiveAlerts(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const alerts = await service.getActiveAlerts(vesselId);
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
  }
}

// ── GET /nr-alerts/:vesselId/count ───────────────────────────────────────────
// Returns count of unacknowledged alerts (used by sidebar badge).
export async function getActiveAlertCount(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const count = await service.getActiveAlertCount(vesselId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch alert count', details: error.message });
  }
}

// ── GET /nr-alerts/:vesselId/all ─────────────────────────────────────────────
// Returns paginated alert history (including acknowledged).
export async function getAllAlerts(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const page = parseInt(String(req.query.page ?? '1')) || 1;
    const limit = parseInt(String(req.query.limit ?? '20')) || 20;
    const result = await service.getAllAlerts(vesselId, page, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch alert history', details: error.message });
  }
}

// ── PATCH /nr-alerts/:alertId/acknowledge ────────────────────────────────────
// Acknowledges an alert. Authorization is enforced at the route level via
// requireOfficeOrAdmin middleware; this controller only extracts the actor name.
export async function acknowledgeAlert(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const alertId = parseInt(req.params.alertId);
    if (isNaN(alertId)) return res.status(400).json({ error: 'Invalid alert ID' });
    const acknowledgedBy = user?.fullName || user?.username || 'Office';
    const updated = await service.acknowledgeAlert(alertId, acknowledgedBy);
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to acknowledge alert', details: error.message });
  }
}

// ── Bunker Records ────────────────────────────────────────────────────────────

// GET /nr-bunker — list bunker records for a vessel
export async function getBunkerRecords(req: Request, res: Response) {
  try {
    const { vesselId, voyageNo } = req.query;
    if (!vesselId) return res.status(400).json({ error: 'vesselId is required' });
    const records = await bunkerService.getBunkerRecords(
      vesselId as string,
      voyageNo as string | undefined,
    );
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bunker records', details: error.message });
  }
}

// GET /nr-bunker/:id — single bunker record
export async function getBunkerRecord(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const record = await bunkerService.getBunkerRecord(id);
    if (!record) return res.status(404).json({ error: 'Bunker record not found' });
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bunker record', details: error.message });
  }
}

// POST /nr-bunker — create bunker record
export async function createBunkerRecord(req: Request, res: Response) {
  try {
    const parsed = insertNrBunkerRecordSchema.parse(req.body);
    const record = await bunkerService.createBunkerRecord(parsed);
    res.status(201).json(record);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    res.status(500).json({ error: 'Failed to create bunker record', details: error.message });
  }
}

// PATCH /nr-bunker/:id — update bunker record
export async function updateBunkerRecord(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const parsed = insertNrBunkerRecordSchema.partial().parse(req.body);
    const record = await bunkerService.updateBunkerRecord(id, parsed);
    res.json(record);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message === 'Bunker record not found') return res.status(404).json({ error: error.message });
    res.status(500).json({ error: 'Failed to update bunker record', details: error.message });
  }
}

// DELETE /nr-bunker/:id — delete bunker record
export async function deleteBunkerRecord(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    await bunkerService.deleteBunkerRecord(id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Bunker record not found') return res.status(404).json({ error: error.message });
    res.status(500).json({ error: 'Failed to delete bunker record', details: error.message });
  }
}

// GET /nr-bunker-cost — cost summary per fuel type for a vessel/voyage
export async function getBunkerCostSummary(req: Request, res: Response) {
  try {
    const { vesselId, voyageNo } = req.query;
    if (!vesselId) return res.status(400).json({ error: 'vesselId is required' });
    const summary = await bunkerService.getBunkerCostSummary(
      vesselId as string,
      voyageNo as string | undefined,
    );
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bunker cost summary', details: error.message });
  }
}
