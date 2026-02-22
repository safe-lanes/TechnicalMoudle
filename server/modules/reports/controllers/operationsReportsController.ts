import type { Request, Response } from 'express';
import * as operationsReportService from '../services/operationsReportService';

// ═══════════════════════════════════════════════════════════════
// CREW WORKLOAD DISTRIBUTION - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getCrewWorkloadDistribution(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate, rank, department, viewType } = req.query;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const result = await operationsReportService.getCrewWorkloadDistribution(
      String(vesselId),
      startDate as string | undefined,
      endDate as string | undefined,
      rank as string | undefined,
      department as string | undefined,
      viewType as string | undefined,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching crew workload distribution:", error);
    res.status(500).json({ error: "Failed to fetch crew workload distribution: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// CREW WORKLOAD DISTRIBUTION - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportCrewWorkloadDistributionExcel(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate, rank, department, viewType = 'summary' } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await operationsReportService.exportCrewWorkloadDistributionExcel(
      vesselId,
      startDate,
      endDate,
      rank,
      department,
      viewType,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Crew Workload Distribution Excel report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT UTILIZATION SUMMARY - PREVIEW (GET)
// ═══════════════════════════════════════════════════════════════

export async function getEquipmentUtilizationSummary(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const category = req.query.category as string;
    const department = req.query.department as string;

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const result = await operationsReportService.getEquipmentUtilizationSummary(
      vesselId,
      startDate,
      endDate,
      category,
      department,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching equipment utilization summary:", error);
    res.status(500).json({ error: "Failed to fetch equipment utilization summary: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT UTILIZATION SUMMARY - EXCEL EXPORT (POST)
// ═══════════════════════════════════════════════════════════════

export async function exportEquipmentUtilizationSummaryExcel(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate, category, department } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await operationsReportService.exportEquipmentUtilizationSummaryExcel(
      vesselId,
      startDate,
      endDate,
      category,
      department,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Equipment Utilization Excel report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}
