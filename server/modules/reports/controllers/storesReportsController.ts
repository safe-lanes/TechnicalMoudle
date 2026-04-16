import type { Request, Response } from 'express';
import * as storesReportService from '../services/storesReportService';

// ═══════════════════════════════════════════════════════════════
// STORES INVENTORY STATUS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportStoresInventoryStatusExcel(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { tab, categoryFilter, statusFilter, componentFilter } = req.body;

    const { buffer, filename } = await storesReportService.exportStoresInventoryStatusExcel(
      vesselId, tab, categoryFilter, statusFilter, componentFilter,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Stores Inventory Status Excel:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// STORES CONSUMPTION ANALYSIS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getStoresConsumptionAnalysis(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { startDate, endDate, itemType, category } = req.query;
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;

    const result = await storesReportService.getStoresConsumptionAnalysis(
      vesselId,
      startDate as string | undefined,
      endDate as string | undefined,
      itemType as string | undefined,
      category as string | undefined,
      vesselIds,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error generating Stores Consumption Pattern Analysis:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// STORES CONSUMPTION ANALYSIS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportStoresConsumptionExcel(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { startDate, endDate, itemType, category, componentFilter } = req.body;

    const { buffer, filename } = await storesReportService.exportStoresConsumptionExcel(
      vesselId, startDate, endDate, itemType, category, componentFilter,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Stores Consumption Analysis Excel:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// COMBINED CONSUMPTION ANALYSIS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCombinedConsumptionAnalysis(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const vesselIdsRaw = req.query.vesselIds as string | undefined;
    const vesselIds = vesselIdsRaw ? vesselIdsRaw.split(',').filter(Boolean) : undefined;
    const result = await storesReportService.getCombinedConsumptionAnalysis(vesselId, vesselIds);
    res.json(result);
  } catch (error: any) {
    console.error("Error generating Consumption Pattern Analysis:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// COMBINED CONSUMPTION ANALYSIS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCombinedConsumptionExcel(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { buffer, filename } = await storesReportService.exportCombinedConsumptionExcel(vesselId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Consumption Analysis Excel:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// CHEMICALS EXPIRY REPORT
// ═══════════════════════════════════════════════════════════════

export async function getChemicalsExpiry(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { expired, expiring_soon, hazard_class, stock_status } = req.query;

    const result = await storesReportService.getChemicalsExpiry(
      vesselId,
      expired as string | undefined,
      expiring_soon as string | undefined,
      hazard_class as string | undefined,
      stock_status as string | undefined,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error generating chemicals expiry report:", error);
    res.status(500).json({ error: error.message || "Failed to generate chemicals expiry report" });
  }
}

// ═══════════════════════════════════════════════════════════════
// STORES LOW STOCK ALERT - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getStoresLowStockAlert(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { category, priority, location } = req.query;
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;
    const filters = {
      category: category as string | undefined,
      priority: priority as string | undefined,
      location: location as string | undefined,
    };

    const result = await storesReportService.getStoresLowStockAlert(vesselId, filters, vesselIds);
    res.json(result);
  } catch (error: any) {
    console.error("Error generating low stock alert report:", error);
    res.status(500).json({ error: error.message || "Failed to generate low stock alert report" });
  }
}

// ═══════════════════════════════════════════════════════════════
// STORES LOW STOCK ALERT - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportStoresLowStockAlertExcel(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const componentFilter = req.body?.componentFilter;

    const { buffer, filename } = await storesReportService.exportStoresLowStockAlertExcel(vesselId, componentFilter);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const workbook = new (await import('exceljs')).default.Workbook();
    await workbook.xlsx.load(buffer);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error("Error generating low stock alert Excel:", error);
    res.status(500).json({ error: error.message || "Failed to generate Excel report" });
  }
}
