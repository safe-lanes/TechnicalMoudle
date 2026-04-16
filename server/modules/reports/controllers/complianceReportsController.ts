import type { Request, Response } from 'express';
import * as complianceReportService from '../services/complianceReportService';

// ═══════════════════════════════════════════════════════════════
// RUNNING HOURS ANOMALY DETECTION - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getRunningHoursAnomalyDetection(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate, anomalyType, severity: severityFilter } = req.query;
    // vesselIds decoded for API consistency; running-hours anomaly is per-vessel so vesselIds is informational only
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const result = await complianceReportService.getRunningHoursAnomalyDetection(
      String(vesselId),
      startDate as string | undefined,
      endDate as string | undefined,
      anomalyType as string | undefined,
      severityFilter as string | undefined,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error generating Running Hours Anomaly Detection report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// RUNNING HOURS ANOMALY DETECTION - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportRunningHoursAnomalyDetectionExcel(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate, anomalyType, severity: severityFilter } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await complianceReportService.exportRunningHoursAnomalyDetectionExcel(
      vesselId,
      startDate,
      endDate,
      anomalyType,
      severityFilter,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating RH Anomaly Detection Excel report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// IHM INVENTORY STATUS - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getIhmInventoryStatus(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string | undefined;
    const ihmStatusFilter = (req.query.ihmStatus as string) || 'all';
    const itemTypeFilter = (req.query.itemType as string) || 'all';
    const searchQuery = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'itemCode';
    const sortOrder = (req.query.sortOrder as string) || 'asc';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;

    const result = await complianceReportService.getIhmInventoryStatus(
      vesselId,
      ihmStatusFilter,
      itemTypeFilter,
      searchQuery,
      sortBy,
      sortOrder,
      page,
      pageSize,
      vesselIds,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching IHM inventory status:", error);
    res.status(500).json({ error: "Failed to fetch IHM inventory data", details: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// IHM INVENTORY STATUS - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportIhmInventoryStatusExcel(req: Request, res: Response) {
  try {
    const { vesselId, ihmStatus, itemType, search, componentFilter, vesselIds: bodyVesselIds } = req.body;
    const vesselIds = bodyVesselIds
      ? (Array.isArray(bodyVesselIds) ? bodyVesselIds : String(bodyVesselIds).split(',').filter(Boolean))
      : undefined;

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const { buffer, filename } = await complianceReportService.exportIhmInventoryStatusExcel(
      vesselId,
      ihmStatus,
      itemType,
      search,
      componentFilter,
      vesselIds,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating IHM Inventory Status Excel report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}
