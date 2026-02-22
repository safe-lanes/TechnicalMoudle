import type { Request, Response } from 'express';
import * as sparesReportService from '../services/sparesReportService';

// ═══════════════════════════════════════════════════════════════
// CRITICAL SPARES REPORT - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCriticalSparesPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const stockStatusFilter = req.query.stockStatus
      ? (Array.isArray(req.query.stockStatus) ? req.query.stockStatus as string[] : [req.query.stockStatus as string])
      : null;
    const departmentFilter = req.query.department as string | undefined;

    const result = await sparesReportService.getCriticalSparesPreview(vesselId, stockStatusFilter, departmentFilter);
    res.json(result);
  } catch (error: any) {
    console.error('Error generating critical spares preview:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate critical spares report'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL SPARES REPORT - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCriticalSparesExcel(req: Request, res: Response) {
  try {
    const { vesselId, filters } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const stockStatusFilter: string[] | null = filters?.stockStatus && Array.isArray(filters.stockStatus) && filters.stockStatus.length > 0 ? filters.stockStatus : null;
    const departmentFilter: string | undefined = filters?.department || undefined;

    const { buffer, filename } = await sparesReportService.exportCriticalSparesExcel(vesselId, stockStatusFilter, departmentFilter);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error generating critical spares Excel report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate critical spares Excel report'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// LOW STOCK ALERT - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getLowStockAlert(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { criticality, componentCategory, sortBy } = req.query;

    const result = await sparesReportService.getLowStockAlert(
      vesselId,
      criticality as string | undefined,
      componentCategory as string | undefined,
      sortBy as string | undefined,
    );
    res.json(result);
  } catch (error: any) {
    console.error('Low stock alert report error:', error);
    res.status(500).json({ error: "Failed to generate low stock alert report" });
  }
}

// ═══════════════════════════════════════════════════════════════
// LOW STOCK ALERT - MARK ORDERED
// ═══════════════════════════════════════════════════════════════

export async function markSpareAsOrdered(req: Request, res: Response) {
  try {
    const spareId = parseInt(req.params.spareId);
    const result = await sparesReportService.markSpareAsOrdered(spareId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to mark spare as ordered" });
  }
}

// ═══════════════════════════════════════════════════════════════
// LOW STOCK ALERT - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportLowStockAlertExcel(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { criticality, sortBy } = req.body;

    const { buffer, filename } = await sparesReportService.exportLowStockAlertExcel(vesselId, criticality, sortBy);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Low Stock Alert Excel:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// SPARES CONSUMPTION ANALYSIS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getSparesConsumptionAnalysis(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { startDate, endDate, category } = req.query;

    const result = await sparesReportService.getSparesConsumptionAnalysis(
      vesselId,
      startDate as string | undefined,
      endDate as string | undefined,
      category as string | undefined,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error generating Spares Consumption Pattern Analysis:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// SPARES CONSUMPTION ANALYSIS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportSparesConsumptionExcel(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { startDate, endDate, category } = req.body;

    const { buffer, filename } = await sparesReportService.exportSparesConsumptionExcel(vesselId, startDate, endDate, category);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Spares Consumption Analysis Excel:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}
