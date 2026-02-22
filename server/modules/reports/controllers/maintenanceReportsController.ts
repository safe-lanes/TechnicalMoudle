import type { Request, Response } from 'express';
import * as maintenanceReportService from '../services/maintenanceReportService';

// ═══════════════════════════════════════════════════════════════
// DUE JOBS (7 DAYS) - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportDueJobs7Days(req: Request, res: Response) {
  try {
    const { vesselId } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportDueJobs7Days(vesselId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Due Jobs report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// OVERDUE JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportOverdueJobs(req: Request, res: Response) {
  try {
    const { vesselId } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportOverdueJobs(vesselId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Overdue Jobs report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED JOBS REGISTER - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCompletedJobs(req: Request, res: Response) {
  try {
    const { vesselId, dateFrom, dateTo } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportCompletedJobs(vesselId, dateFrom, dateTo);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Completed Jobs Register report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// UNPLANNED/BREAKDOWN JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportUnplannedJobs(req: Request, res: Response) {
  try {
    const { vesselId, dateFrom, dateTo } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportUnplannedJobs(vesselId, dateFrom, dateTo);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Unplanned Jobs report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// POSTPONEMENT LOG - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportPostponementLog(req: Request, res: Response) {
  try {
    const { vesselId, dateFrom, dateTo, status } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportPostponementLog(vesselId, dateFrom, dateTo, status);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Postponement Log report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportMonthlySummary(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Please provide start and end dates for the report period" });
    }

    const { buffer, filename } = await maintenanceReportService.exportMonthlySummary(vesselId, startDate, endDate);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Monthly Maintenance Summary report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}
