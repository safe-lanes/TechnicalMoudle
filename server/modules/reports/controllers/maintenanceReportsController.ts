import type { Request, Response } from 'express';
import * as maintenanceReportService from '../services/maintenanceReportService';
import * as monthlySnapshotService from '../services/monthlySnapshotService';

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
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const result = await maintenanceReportService.getOverdueJobsData(vesselId, dateFrom, dateTo);
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
    const { vesselId, dateFrom, dateTo } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportOverdueJobs(vesselId, dateFrom, dateTo);

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
// MONTHLY MAINTENANCE SUMMARY - PREVIEW (NEW SNAPSHOT-BASED)
// ═══════════════════════════════════════════════════════════════

export async function getMonthlySummaryPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "Please provide valid year and month" });
    }

    const data = await monthlySnapshotService.getMonthlySummaryData(vesselId, year, month);
    res.json(data);
  } catch (error: unknown) {
    console.error("Error fetching Monthly Summary preview:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to fetch report data: " + message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - SNAPSHOT DETAIL
// ═══════════════════════════════════════════════════════════════

export async function getMonthlySummarySnapshotDetail(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);
    const type = req.query.type as string;
    const category = req.query.category as string;

    if (!vesselId || !type || !category) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: "Invalid year or month" });
    }

    if (type === 'movement') {
      const data = await monthlySnapshotService.getMovementDetail(vesselId, year, month, category);
      return res.json(data);
    }

    const data = await monthlySnapshotService.getSnapshotDetail(vesselId, year, month, type, category);
    res.json(data);
  } catch (error: unknown) {
    console.error("Error fetching snapshot detail:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to fetch snapshot detail: " + message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - REGENERATE SNAPSHOTS
// ═══════════════════════════════════════════════════════════════

export async function regenerateMonthlySummarySnapshots(req: Request, res: Response) {
  try {
    const { vesselId, year, month } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    if (!year || !month) {
      return res.status(400).json({ error: "Please provide year and month" });
    }

    await monthlySnapshotService.regenerateSnapshots(vesselId, year, month);
    const data = await monthlySnapshotService.getMonthlySummaryData(vesselId, year, month);
    res.json(data);
  } catch (error: unknown) {
    console.error("Error regenerating snapshots:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to regenerate snapshots: " + message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportMonthlySummary(req: Request, res: Response) {
  try {
    const { vesselId, startDate } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    let year: number;
    let month: number;

    if (startDate) {
      const d = new Date(startDate);
      year = d.getFullYear();
      month = d.getMonth() + 1;
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const { buffer, filename } = await maintenanceReportService.exportMonthlySummary(vesselId, year, month);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: unknown) {
    console.error("Error generating Monthly Maintenance Summary report:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to generate report: " + message });
  }
}
