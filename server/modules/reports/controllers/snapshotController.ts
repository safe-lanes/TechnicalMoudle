import type { Request, Response, NextFunction } from 'express';
import * as snapshotService from '../services/snapshotService';

// ═══════════════════════════════════════════════════════════════
// REPORT SNAPSHOTS - LIST
// ═══════════════════════════════════════════════════════════════

export async function getSnapshots(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { reportType, startDate, endDate, limit: limitParam } = req.query;
    const snapshots = await snapshotService.getSnapshots(
      vesselId,
      reportType as string | undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
      limitParam ? parseInt(limitParam as string) : 50
    );
    res.json(snapshots);
  } catch (error: any) {
    console.error("Error fetching report snapshots:", error);
    res.status(500).json({ error: error.message || "Failed to fetch report snapshots" });
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORT SNAPSHOTS - DETAIL
// ═══════════════════════════════════════════════════════════════

export async function getSnapshotDetail(req: Request, res: Response) {
  try {
    const snapshotId = parseInt(req.params.snapshotId);
    if (isNaN(snapshotId)) {
      return res.status(400).json({ error: "Invalid snapshot ID" });
    }
    const snapshot = await snapshotService.getSnapshotDetail(snapshotId);
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    res.json(snapshot);
  } catch (error: any) {
    console.error("Error fetching snapshot detail:", error);
    res.status(500).json({ error: error.message || "Failed to fetch snapshot detail" });
  }
}

// ═══════════════════════════════════════════════════════════════
// GENERIC REPORT ROUTER
// ═══════════════════════════════════════════════════════════════

export async function getGenericReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { reportType } = req.params;
    const { vesselId, dateFrom, dateTo, format } = req.query;

    const result = await snapshotService.getGenericReport(
      reportType,
      vesselId as string | undefined,
      dateFrom as string | undefined,
      dateTo as string | undefined,
      format as string | undefined,
    );

    if ('skipToNext' in result && result.skipToNext) {
      return next('route');
    }

    if ('csv' in result) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.csv);
    }

    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate report" });
  }
}
