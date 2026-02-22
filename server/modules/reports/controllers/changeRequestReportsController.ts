import type { Request, Response } from 'express';
import * as changeRequestReportService from '../services/changeRequestReportService';

// ═══════════════════════════════════════════════════════════════
// CHANGE REQUESTS STATUS TRACKING - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getChangeRequestsStatusTracking(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate, status, category } = req.query;

    const result = await changeRequestReportService.getChangeRequestsStatusTracking(
      vesselId as string | undefined,
      startDate as string | undefined,
      endDate as string | undefined,
      status as string | undefined,
      category as string | undefined,
    );
    res.json(result);
  } catch (error) {
    console.error("Error generating change requests status report:", error);
    res.status(500).json({ error: "Failed to generate change requests status report" });
  }
}

// ═══════════════════════════════════════════════════════════════
// CHANGE REQUESTS STATUS TRACKING - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportChangeRequestsExcel(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate, status, category } = req.query;

    const { buffer, filename } = await changeRequestReportService.exportChangeRequestsExcel(
      vesselId as string | undefined,
      startDate as string | undefined,
      endDate as string | undefined,
      status as string | undefined,
      category as string | undefined,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting change requests report to Excel:", error);
    res.status(500).json({ error: "Failed to export change requests report" });
  }
}
