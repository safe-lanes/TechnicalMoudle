import type { Request, Response } from 'express';
import * as equipmentReportService from '../services/equipmentReportService';

// ═══════════════════════════════════════════════════════════════
// TEMPLATE BUILDER
// ═══════════════════════════════════════════════════════════════

export async function getTemplate(req: Request, res: Response) {
  try {
    const { templateType } = req.params;
    const template = await equipmentReportService.getTemplate(templateType);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch template" });
  }
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL EQUIPMENT STATUS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCriticalEquipmentStatus(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const result = await equipmentReportService.getCriticalEquipmentStatus(vesselId);
    res.json(result);
  } catch (error: any) {
    console.error('Error generating critical equipment report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate critical equipment report'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL EQUIPMENT STATUS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCriticalEquipmentStatusExcel(req: Request, res: Response) {
  try {
    const { vesselId } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await equipmentReportService.exportCriticalEquipmentStatusExcel(vesselId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error generating critical equipment Excel report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate critical equipment Excel report'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// UNPLANNED/BREAKDOWN JOBS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getUnplannedBreakdownJobs(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const result = await equipmentReportService.getUnplannedBreakdownJobs(vesselId, startDate, endDate);
    res.json(result);
  } catch (error: any) {
    console.error('Error generating unplanned/breakdown jobs report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate unplanned/breakdown jobs report'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// UNPLANNED/BREAKDOWN JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportUnplannedBreakdownJobsExcel(req: Request, res: Response) {
  try {
    const { vesselId, startDate, endDate } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Please select a date range" });
    }

    const { buffer, filename } = await equipmentReportService.exportUnplannedBreakdownJobsExcel(vesselId, startDate, endDate);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error generating unplanned/breakdown jobs Excel report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate unplanned/breakdown jobs Excel report'
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL COMPONENTS LIST
// ═══════════════════════════════════════════════════════════════

export async function getCriticalComponentsList(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const category = req.query.category as string | undefined;
    const classItemFilter = req.query.classItem as string | undefined;
    const format = (req.query.format as string) || 'json';

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const result = await equipmentReportService.getCriticalComponentsList(vesselId, category, classItemFilter, format);

    if (result.type === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
      return;
    }

    res.json({
      components: result.components,
      summary: result.summary
    });
  } catch (error: any) {
    console.error("Error generating critical components report:", error);
    res.status(500).json({ error: "Failed to generate report", details: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// LSA/FFA MASTER LIST
// ═══════════════════════════════════════════════════════════════

export async function getLsaFfaMasterList(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const equipmentType = req.query.equipmentType as string | undefined;
    const format = (req.query.format as string) || 'json';

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const result = await equipmentReportService.getLsaFfaMasterList(vesselId, equipmentType, format);

    if (result.type === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
      return;
    }

    res.json({
      components: result.components,
      summary: result.summary
    });
  } catch (error: any) {
    console.error("Error generating LSA/FFA master list report:", error);
    res.status(500).json({ error: "Failed to generate report", details: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// LSA/FFA MAINTENANCE SCHEDULE
// ═══════════════════════════════════════════════════════════════

export async function getLsaFfaMaintenanceSchedule(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const statusFilter = req.query.status as string | undefined;
    const equipmentType = req.query.equipmentType as string | undefined;
    const format = (req.query.format as string) || 'json';

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const result = await equipmentReportService.getLsaFfaMaintenanceSchedule(vesselId, statusFilter, equipmentType, format);

    if (result.type === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
      return;
    }

    res.json({
      scheduleItems: result.scheduleItems,
      summary: result.summary
    });
  } catch (error: any) {
    console.error("Error generating LSA/FFA maintenance schedule report:", error);
    res.status(500).json({ error: "Failed to generate report", details: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL EQUIPMENT SCHEDULE
// ═══════════════════════════════════════════════════════════════

export async function getCriticalEquipmentSchedule(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const statusFilter = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const format = (req.query.format as string) || 'json';

    if (!vesselId) {
      return res.status(400).json({ error: "vesselId is required" });
    }

    const result = await equipmentReportService.getCriticalEquipmentSchedule(vesselId, statusFilter, category, format);

    if (result.type === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
      return;
    }

    res.json({
      scheduleItems: result.scheduleItems,
      summary: result.summary
    });
  } catch (error: any) {
    console.error("Error generating critical equipment schedule report:", error);
    res.status(500).json({ error: "Failed to generate report", details: error.message });
  }
}
