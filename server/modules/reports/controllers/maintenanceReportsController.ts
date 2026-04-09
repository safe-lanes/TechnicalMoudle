import type { Request, Response } from 'express';
import * as maintenanceReportService from '../services/maintenanceReportService';

// ═══════════════════════════════════════════════════════════════
// DUE JOBS (7 DAYS) - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getDueJobs7DaysPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const result = await maintenanceReportService.getDueJobs7DaysData(vesselId);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Due Jobs 7 Days preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// OVERDUE JOBS - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getOverdueJobsPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const result = await maintenanceReportService.getOverdueJobsData(vesselId);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Overdue Jobs preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED JOBS - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCompletedJobsPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const result = await maintenanceReportService.getCompletedJobsData(vesselId, dateFrom, dateTo);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Completed Jobs preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// POSTPONEMENT LOG - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getPostponementLogPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const status = req.query.status as string | undefined;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const result = await maintenanceReportService.getPostponementLogData(vesselId, dateFrom, dateTo, status);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Postponement Log preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

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
