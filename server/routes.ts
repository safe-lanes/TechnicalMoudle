import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getPool, getDb } from "./db";
import * as fs from "fs";
import * as path from "path";
import {
  insertRunningHoursAuditSchema,
  cascadeRunningHoursSchema,
  insertWorkOrderSchema,
  insertWorkOrderExecutionSchema,
  insertDefectSchema,
  insertDefectActionSchema,
  insertDefectAttachmentSchema,
  insertComponentSchema,
  insertSpareSchema,
  insertMakerSchema,
  insertMasterListSchema,
  insertFleetSparesSchema,            // ✅ from incoming
  insertFleetJobsSchema,
  defectCategories,
  defectTypes,
  shipCertificatesMaster,
  insertShipCertificateMasterSchema,
  shipCertificatesLabelsConfig,
  vesselCertificateApplicability,
  insertVesselCertificateApplicabilitySchema,
  vesselCertificateData,
  vessels,
  shipSurveysMaster,
  shipSurveysLabelsConfig,
  vesselSurveyApplicability,
  vesselSurveyData,
  componentRunningHoursLog,
  runningHoursAudit,
  storesLedger,                         // ✅ from HEAD
  reportSnapshots,                      // ✅ from HEAD
  fleetComponents
} from "@shared/schema";

import { lowStockReportService } from "./services/lowStockReportService";

import { getPostgresClient } from "./postgresClient";
import { eq, and, asc, sql, inArray, gte } from "drizzle-orm";
import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import { shouldGenerateWorkOrder } from "@shared/dateUtils";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { COLORS, STATUS_COLORS, STANDARD_WORK_ORDER_COLUMNS, applyStandardHeader, applyStandardTableHeader, applyStandardDataRows, applyWorkOrderDataRows, applyStandardSummary, applyStandardPageSetup, generateFilename, getLastColumnLetter, getStatusRowColors, type ColumnDef, type ConditionalStyle, type SummaryItem, type WorkOrderStatus, type WorkOrderRowData } from "./lib/excelReportStyles";
import bulkRouter from "./routes/bulk";
import alertRouter from "./routes/alerts";
import formRouter from "./routes/forms";
import fleetAdminRouter from "./routes/fleetAdmin";
import createChangeRequestsRouter from "./routes/changeRequests";
import { ObjectStorageService, objectStorageClient, parseObjectPath, ObjectNotFoundError } from "./objectStorage";
import { registerRunningHoursRoutes } from "./runningHoursRoutes";
import moduleRouter from "./modules";
import chatbotRouter from "./routes/chatbot";
import { requireAuth, requireRole, requirePMSAdmin, requireOfficeOrAdmin, requireVesselAccess, mockAuthMiddleware, type AuthenticatedRequest } from "./middleware/auth";
import { ensureMaintenanceHistoryImmutability } from "./initDb";
import { validateRunningHoursIncrease, canAdminOverride } from "./utils/rhValidation";

export async function registerRoutes(app: Express): Promise<Server> {
  // CRITICAL: Ensure immutability trigger exists BEFORE registering routes
  // In PostgreSQL mode, this will fail fast if trigger creation fails
  // In file-storage mode, this will skip trigger setup
  try {
    await ensureMaintenanceHistoryImmutability();
  } catch (error: any) {
    console.error('❌ FATAL: Failed to ensure maintenance history immutability');
    console.error(error);
    console.error('Server cannot start without immutability enforcement for component_maintenance_history table');
    process.exit(1); // Fail fast - do not serve traffic without immutability
  }
  
  // Apply mock authentication middleware for all API routes during development
  // This populates req.user with an admin user for testing purposes
  app.use('/technical/api', mockAuthMiddleware);
  console.log('🔒 Mock authentication enabled for /technical/api/* routes');

  // Mount modular architecture router (modules extracted from routes.ts go here)
  app.use('/technical/api', moduleRouter);

  // Documentation download endpoint
  app.get("/download/docs/:filename", (req, res) => {
    const filename = req.params.filename;
    const allowedFiles = ['STORAGE_ANALYSIS.md', 'LOCAL_DEVELOPMENT_SETUP.md'];
    if (!allowedFiles.includes(filename)) {
      return res.status(404).json({ error: "File not found" });
    }
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/markdown');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });
  
  // Start Job Due Scanner - scans jobs and auto-generates work orders when due
  const { jobDueScanner } = await import("./services/jobDueScanner");
  jobDueScanner.start(1 * 60 * 1000); // Run every 1 minute
  console.log('[JobDueScanner] Scheduler started - will auto-generate work orders for due jobs');
  
  // Start Work Order Status Recalculator - recalculates and persists work order statuses
  // Runs every minute so grace period setting changes are reflected automatically
  const { workOrderStatusRecalculator } = await import("./services/workOrderStatusRecalculator");
  workOrderStatusRecalculator.start(1 * 60 * 1000); // Run every 1 minute
  console.log('[StatusRecalculator] Scheduler started - will recalculate work order statuses based on current settings');
  
  // Register Running Hours routes from dedicated file
  registerRunningHoursRoutes(app);
  // Set up multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Jobs API routes → Extracted to modules/jobs
  // Work Orders API routes → Extracted to modules/work-orders

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.4: CRITICAL SPARES REPORT - PREVIEW API
  // Returns JSON preview of critical and essential spare parts inventory
  // ═══════════════════════════════════════════════════════════════
  app.get("/technical/api/reports/critical-spares/preview", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      const stockStatusFilter = req.query.stockStatus
        ? (Array.isArray(req.query.stockStatus) ? req.query.stockStatus as string[] : [req.query.stockStatus as string])
        : null;
      const departmentFilter = req.query.department as string | undefined;

      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

      let sparesData: any[];
      let jobsData: any[];
      let componentsData: any[];
      let jobComponentLinks: any[];
      if (vesselId === 'all') {
        sparesData = []; jobsData = []; componentsData = []; jobComponentLinks = [];
        for (const v of allVessels) {
          sparesData = sparesData.concat(await storage.getSpares(v.id));
          jobsData = jobsData.concat(await storage.getJobs(v.id));
          componentsData = componentsData.concat(await storage.getComponents(v.id));
          jobComponentLinks = jobComponentLinks.concat(await storage.getJobComponentLinks(v.id));
        }
      } else {
        sparesData = await storage.getSpares(vesselId);
        jobsData = await storage.getJobs(vesselId);
        componentsData = await storage.getComponents(vesselId);
        jobComponentLinks = await storage.getJobComponentLinks(vesselId);
      }

      const componentMap = new Map(componentsData.map(c => [c.id, c]));

      const getStockStatus = (rob: number | null | undefined, min: number | null | undefined): string => {
        const robVal = rob ?? 0;
        if (robVal === 0) return 'ZERO';
        if (min === null || min === undefined || min === 0) return 'NOT_SET';
        if (robVal < min) return 'LOW';
        return 'OK';
      };

      const getShortage = (rob: number | null | undefined, min: number | null | undefined): number => {
        const robVal = rob ?? 0;
        if (min === null || min === undefined || min === 0) return 0;
        return Math.max(0, min - robVal);
      };

      const findRelatedJobs = (spare: any) => {
        const related: any[] = [];
        for (const job of jobsData) {
          let reqParts = job.requiredSpareParts;
          if (typeof reqParts === 'string') {
            try { reqParts = JSON.parse(reqParts); } catch { reqParts = []; }
          }
          if (!Array.isArray(reqParts)) continue;
          const match = reqParts.some((rp: any) =>
            (rp.partCode && spare.partCode && rp.partCode === spare.partCode) ||
            (rp.partName && spare.partName && rp.partName === spare.partName)
          );
          if (match) related.push(job);
        }
        return related;
      };

      const findCriticalComponents = (relatedJobs: any[]) => {
        const critComps: string[] = [];
        for (const job of relatedJobs) {
          const links = jobComponentLinks.filter(l => l.jobId === job.id);
          for (const link of links) {
            const comp = componentMap.get(link.componentId);
            if (comp && comp.critical === true) {
              const label = comp.name || comp.componentCode || comp.id;
              if (!critComps.includes(label)) critComps.push(label);
            }
          }
        }
        return critComps;
      };

      const getCriticality = (spare: any, relatedJobs: any[], criticalComponents: string[]): string => {
        if (criticalComponents.length > 0) return 'CRITICAL';
        const robVal = spare.rob ?? 0;
        const minVal = spare.min ?? 0;
        if (robVal === 0 || (minVal > 0 && robVal < minVal)) return 'ESSENTIAL';
        return 'NORMAL';
      };

      const getRemarks = (stockStatus: string, criticalityLevel: string): string => {
        if (criticalityLevel === 'CRITICAL' && stockStatus === 'ZERO') {
          return 'CRITICAL - OUT OF STOCK - Immediate procurement required for critical equipment';
        }
        if (criticalityLevel === 'CRITICAL' && stockStatus === 'LOW') {
          return 'CRITICAL - LOW STOCK - Urgent replenishment needed for critical equipment';
        }
        if (criticalityLevel === 'CRITICAL') {
          return 'CRITICAL - Linked to critical equipment - monitor closely';
        }
        if (stockStatus === 'ZERO') {
          return 'OUT OF STOCK - Procurement required';
        }
        if (stockStatus === 'LOW') {
          return 'LOW STOCK - Replenishment recommended';
        }
        if (stockStatus === 'NOT_SET') {
          return 'Minimum stock level not configured';
        }
        return 'Stock level adequate';
      };

      const allRows = sparesData.map(spare => {
        const robVal = spare.rob ?? 0;
        const minVal = spare.min ?? null;
        const stockStatus = getStockStatus(robVal, minVal);
        const shortageQty = getShortage(robVal, minVal);
        const relatedJobs = findRelatedJobs(spare);
        const critComps = findCriticalComponents(relatedJobs);
        const criticalityLevel = getCriticality(spare, relatedJobs, critComps);
        const linkedToCritical = critComps.length > 0;

        const departments = new Set<string>();
        for (const job of relatedJobs) {
          if (job.department) departments.add(job.department);
        }
        for (const compName of critComps) {
          const comp = componentsData.find(c => (c.name || c.componentCode || c.id) === compName);
          if (comp?.department) departments.add(comp.department);
        }

        return {
          sNo: 0,
          vesselName,
          partCode: spare.partCode || '-',
          partName: spare.partName || '-',
          rob: robVal,
          minStock: spare.min != null ? minVal : null,
          stockStatus,
          shortageQty,
          criticalityLevel,
          linkedToCriticalEquipment: linkedToCritical,
          criticalComponents: critComps.join(', ') || '-',
          relatedJobs: relatedJobs.map(j => j.jobNo || j.jobTitle || j.id).join(', ') || '-',
          department: Array.from(departments).join(', ') || '-',
          remarks: getRemarks(stockStatus, criticalityLevel),
        };
      });

      let reportRows = allRows.filter(r =>
        r.criticalityLevel === 'CRITICAL' || r.criticalityLevel === 'ESSENTIAL'
      );

      if (stockStatusFilter && stockStatusFilter.length > 0) {
        reportRows = reportRows.filter(r => stockStatusFilter.includes(r.stockStatus));
      }
      if (departmentFilter) {
        reportRows = reportRows.filter(r => r.department.toLowerCase().includes(departmentFilter.toLowerCase()));
      }

      const statusOrder: Record<string, number> = { 'ZERO': 0, 'LOW': 1, 'OK': 2, 'NOT_SET': 3 };
      const critOrder: Record<string, number> = { 'CRITICAL': 0, 'ESSENTIAL': 1, 'NORMAL': 2 };
      reportRows.sort((a, b) => {
        const sA = statusOrder[a.stockStatus] ?? 99;
        const sB = statusOrder[b.stockStatus] ?? 99;
        if (sA !== sB) return sA - sB;
        const cA = critOrder[a.criticalityLevel] ?? 99;
        const cB = critOrder[b.criticalityLevel] ?? 99;
        if (cA !== cB) return cA - cB;
        if (b.shortageQty !== a.shortageQty) return b.shortageQty - a.shortageQty;
        return (a.partCode || '').localeCompare(b.partCode || '');
      });

      reportRows.forEach((r, i) => { r.sNo = i + 1; });

      const totalCritical = reportRows.filter(r => r.criticalityLevel === 'CRITICAL').length;
      const totalEssential = reportRows.filter(r => r.criticalityLevel === 'ESSENTIAL').length;
      const totalLinkedCriticalEquip = reportRows.filter(r => r.linkedToCriticalEquipment === true).length;
      const totalZeroStock = reportRows.filter(r => r.stockStatus === 'ZERO').length;
      const totalLowStock = reportRows.filter(r => r.stockStatus === 'LOW').length;
      const totalShortage = reportRows.reduce((sum, r) => sum + r.shortageQty, 0);

      const byStatus: Record<string, number> = {};
      const byCriticality: Record<string, number> = {};
      reportRows.forEach(r => {
        byStatus[r.stockStatus] = (byStatus[r.stockStatus] || 0) + 1;
        byCriticality[r.criticalityLevel] = (byCriticality[r.criticalityLevel] || 0) + 1;
      });

      res.json({
        success: true,
        reportMeta: {
          reportType: 'CRITICAL_SPARES',
          vesselId,
          vesselName,
          generatedAt: new Date().toISOString(),
          totalSpares: reportRows.length,
          totalCritical,
          totalEssential,
          totalLinkedCriticalEquip,
          totalZeroStock,
          totalLowStock,
        },
        data: reportRows,
        summary: {
          byStatus,
          byCriticality,
          totalShortage,
        },
      });
    } catch (error: any) {
      console.error('Error generating critical spares preview:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate critical spares report'
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.4: CRITICAL SPARES REPORT - EXCEL EXPORT
  // Generates Excel file with critical and essential spare parts inventory
  // ═══════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/critical-spares", async (req, res) => {
    try {
      const { vesselId, filters } = req.body;

      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }

      const stockStatusFilter: string[] | null = filters?.stockStatus && Array.isArray(filters.stockStatus) && filters.stockStatus.length > 0 ? filters.stockStatus : null;
      const departmentFilter: string | undefined = filters?.department || undefined;

      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

      let sparesData: any[];
      let jobsData: any[];
      let componentsData: any[];
      let jobComponentLinks: any[];
      if (vesselId === 'all') {
        sparesData = []; jobsData = []; componentsData = []; jobComponentLinks = [];
        for (const v of allVessels) {
          sparesData = sparesData.concat(await storage.getSpares(v.id));
          jobsData = jobsData.concat(await storage.getJobs(v.id));
          componentsData = componentsData.concat(await storage.getComponents(v.id));
          jobComponentLinks = jobComponentLinks.concat(await storage.getJobComponentLinks(v.id));
        }
      } else {
        sparesData = await storage.getSpares(vesselId);
        jobsData = await storage.getJobs(vesselId);
        componentsData = await storage.getComponents(vesselId);
        jobComponentLinks = await storage.getJobComponentLinks(vesselId);
      }

      const componentMap = new Map(componentsData.map(c => [c.id, c]));

      const getStockStatus = (rob: number | null | undefined, min: number | null | undefined): string => {
        const robVal = rob ?? 0;
        if (robVal === 0) return 'ZERO';
        if (min === null || min === undefined || min === 0) return 'NOT_SET';
        if (robVal < min) return 'LOW';
        return 'OK';
      };

      const getShortage = (rob: number | null | undefined, min: number | null | undefined): number => {
        const robVal = rob ?? 0;
        if (min === null || min === undefined || min === 0) return 0;
        return Math.max(0, min - robVal);
      };

      const findRelatedJobs = (spare: any) => {
        const related: any[] = [];
        for (const job of jobsData) {
          let reqParts = job.requiredSpareParts;
          if (typeof reqParts === 'string') {
            try { reqParts = JSON.parse(reqParts); } catch { reqParts = []; }
          }
          if (!Array.isArray(reqParts)) continue;
          const match = reqParts.some((rp: any) =>
            (rp.partCode && spare.partCode && rp.partCode === spare.partCode) ||
            (rp.partName && spare.partName && rp.partName === spare.partName)
          );
          if (match) related.push(job);
        }
        return related;
      };

      const findCriticalComponents = (relatedJobs: any[]) => {
        const critComps: string[] = [];
        for (const job of relatedJobs) {
          const links = jobComponentLinks.filter(l => l.jobId === job.id);
          for (const link of links) {
            const comp = componentMap.get(link.componentId);
            if (comp && comp.critical === true) {
              const label = comp.name || comp.componentCode || comp.id;
              if (!critComps.includes(label)) critComps.push(label);
            }
          }
        }
        return critComps;
      };

      const getCriticality = (spare: any, relatedJobs: any[], criticalComponents: string[]): string => {
        if (criticalComponents.length > 0) return 'CRITICAL';
        const robVal = spare.rob ?? 0;
        const minVal = spare.min ?? 0;
        if (robVal === 0 || (minVal > 0 && robVal < minVal)) return 'ESSENTIAL';
        return 'NORMAL';
      };

      const getRemarks = (stockStatus: string, criticalityLevel: string): string => {
        if (criticalityLevel === 'CRITICAL' && stockStatus === 'ZERO') {
          return 'CRITICAL - OUT OF STOCK - Immediate procurement required for critical equipment';
        }
        if (criticalityLevel === 'CRITICAL' && stockStatus === 'LOW') {
          return 'CRITICAL - LOW STOCK - Urgent replenishment needed for critical equipment';
        }
        if (criticalityLevel === 'CRITICAL') {
          return 'CRITICAL - Linked to critical equipment - monitor closely';
        }
        if (stockStatus === 'ZERO') {
          return 'OUT OF STOCK - Procurement required';
        }
        if (stockStatus === 'LOW') {
          return 'LOW STOCK - Replenishment recommended';
        }
        if (stockStatus === 'NOT_SET') {
          return 'Minimum stock level not configured';
        }
        return 'Stock level adequate';
      };

      const allExcelRows = sparesData.map(spare => {
        const robVal = spare.rob ?? 0;
        const minVal = spare.min ?? null;
        const stockStatus = getStockStatus(robVal, minVal);
        const shortageQty = getShortage(robVal, minVal);
        const relatedJobs = findRelatedJobs(spare);
        const critComps = findCriticalComponents(relatedJobs);
        const criticalityLevel = getCriticality(spare, relatedJobs, critComps);
        const linkedToCritical = critComps.length > 0;

        const departments = new Set<string>();
        for (const job of relatedJobs) {
          if (job.department) departments.add(job.department);
        }
        for (const compName of critComps) {
          const comp = componentsData.find(c => (c.name || c.componentCode || c.id) === compName);
          if (comp?.department) departments.add(comp.department);
        }

        return {
          sNo: 0,
          vesselName,
          partCode: spare.partCode || '-',
          partName: spare.partName || '-',
          rob: robVal,
          minStock: spare.min != null ? minVal : null,
          stockStatus,
          shortageQty,
          criticalityLevel,
          criticalEquipment: linkedToCritical ? 'YES' : 'NO',
          criticalComponents: critComps.join(', ') || '-',
          relatedJobs: relatedJobs.map(j => j.jobNo || j.jobTitle || j.id).join(', ') || '-',
          department: Array.from(departments).join(', ') || '-',
          remarks: getRemarks(stockStatus, criticalityLevel),
        };
      });

      let reportRows = allExcelRows.filter(r =>
        r.criticalityLevel === 'CRITICAL' || r.criticalityLevel === 'ESSENTIAL'
      );

      if (stockStatusFilter && stockStatusFilter.length > 0) {
        reportRows = reportRows.filter(r => stockStatusFilter.includes(r.stockStatus));
      }
      if (departmentFilter) {
        reportRows = reportRows.filter(r => r.department.toLowerCase().includes(departmentFilter.toLowerCase()));
      }

      const statusOrder: Record<string, number> = { 'ZERO': 0, 'LOW': 1, 'OK': 2, 'NOT_SET': 3 };
      const critOrder: Record<string, number> = { 'CRITICAL': 0, 'ESSENTIAL': 1, 'NORMAL': 2 };
      reportRows.sort((a, b) => {
        const sA = statusOrder[a.stockStatus] ?? 99;
        const sB = statusOrder[b.stockStatus] ?? 99;
        if (sA !== sB) return sA - sB;
        const cA = critOrder[a.criticalityLevel] ?? 99;
        const cB = critOrder[b.criticalityLevel] ?? 99;
        if (cA !== cB) return cA - cB;
        if (b.shortageQty !== a.shortageQty) return b.shortageQty - a.shortageQty;
        return (a.partCode || '').localeCompare(b.partCode || '');
      });

      reportRows.forEach((r, i) => { r.sNo = i + 1; });

      const columns: ColumnDef[] = [
        { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
        { key: 'vesselName', header: 'Vessel Name', width: 18, type: 'text' },
        { key: 'partCode', header: 'Part Code', width: 18, type: 'text' },
        { key: 'partName', header: 'Part Name', width: 35, type: 'text' },
        { key: 'rob', header: 'ROB', width: 8, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min Stock', width: 10, type: 'number', align: 'center' },
        { key: 'stockStatus', header: 'Stock Status', width: 14, type: 'text', align: 'center' },
        { key: 'shortageQty', header: 'Shortage Qty', width: 12, type: 'number', align: 'center' },
        { key: 'criticalityLevel', header: 'Criticality', width: 14, type: 'text', align: 'center' },
        { key: 'criticalEquipment', header: 'Critical Equip', width: 14, type: 'text', align: 'center' },
        { key: 'criticalComponents', header: 'Critical Components', width: 30, type: 'text' },
        { key: 'relatedJobs', header: 'Related Jobs', width: 30, type: 'text' },
        { key: 'department', header: 'Department', width: 12, type: 'text', align: 'center' },
        { key: 'remarks', header: 'Remarks', width: 40, type: 'text' },
      ];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Critical Spares Report');

      const lastCol = getLastColumnLetter(columns.length);

      applyStandardHeader(
        worksheet,
        'CRITICAL SPARES REPORT',
        'Status of Critical and Essential Spare Parts Inventory',
        vesselName,
        reportRows.length,
        lastCol
      );

      applyStandardTableHeader(worksheet, columns, 7);

      const conditionalStyles: ConditionalStyle[] = [
        {
          condition: (row: any) => row.stockStatus === 'ZERO',
          style: 'danger',
        },
        {
          condition: (row: any) => row.stockStatus === 'LOW' && row.criticalityLevel === 'CRITICAL',
          style: 'warning',
        },
        {
          condition: (row: any) => row.stockStatus === 'LOW',
          style: 'warning',
          textOnly: true,
        },
      ];

      applyStandardDataRows(worksheet, reportRows, columns, 8, conditionalStyles);

      const totalZeroStock = reportRows.filter(r => r.stockStatus === 'ZERO').length;
      const totalLowStock = reportRows.filter(r => r.stockStatus === 'LOW').length;
      const totalOkStock = reportRows.filter(r => r.stockStatus === 'OK').length;
      const totalNotSet = reportRows.filter(r => r.stockStatus === 'NOT_SET').length;
      const totalCritical = reportRows.filter(r => r.criticalityLevel === 'CRITICAL').length;
      const totalEssential = reportRows.filter(r => r.criticalityLevel === 'ESSENTIAL').length;
      const totalNormal = reportRows.filter(r => r.criticalityLevel === 'NORMAL').length;
      const totalShortage = reportRows.reduce((sum, r) => sum + r.shortageQty, 0);

      const summaryItems: SummaryItem[] = [
        { label: 'Total Spare Parts', value: reportRows.length },
        { label: 'Zero Stock (Out of Stock)', value: totalZeroStock, highlight: totalZeroStock > 0 },
        { label: 'Low Stock', value: totalLowStock, highlight: totalLowStock > 0 },
        { label: 'OK Stock', value: totalOkStock },
        { label: 'Min Not Set', value: totalNotSet },
        { label: 'Critical (Linked to Critical Equipment)', value: totalCritical, highlight: totalCritical > 0 },
        { label: 'Essential (Low/Zero but not Critical)', value: totalEssential },
        { label: 'Normal', value: totalNormal },
        { label: 'Total Shortage Quantity', value: totalShortage, highlight: totalShortage > 0 },
      ];

      const summaryStartRow = 8 + reportRows.length + 2;
      applyStandardSummary(worksheet, summaryItems, summaryStartRow, columns.length);

      worksheet.views = [{ state: 'frozen', ySplit: 7, xSplit: 0 }];

      worksheet.autoFilter = {
        from: { row: 7, column: 1 },
        to: { row: 7 + reportRows.length, column: columns.length }
      };

      applyStandardPageSetup(worksheet);

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('Critical_Spares_Report', vesselName);

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
  });

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.5: CRITICAL EQUIPMENT STATUS API
  // Returns critical/class equipment with aggregated work order data
  // ═══════════════════════════════════════════════════════════════
  app.get("/technical/api/reports/critical-equipment-status", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      // Get all components for the vessel where critical=true OR classItem=true
      const allComponents = await storage.getComponents(vesselId);
      const criticalComponents = allComponents.filter(c => 
        c.isActive !== false && (c.critical === true || c.classItem === true)
      );

      // Get all work orders for the vessel
      const allWorkOrders = await storage.getWorkOrders(vesselId);

      // Parse date helper
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Build report data by aggregating work orders per component
      const reportData = criticalComponents.map((component, index) => {
        // Find work orders for this component
        const componentWOs = allWorkOrders.filter(wo => 
          wo.componentCode === component.componentCode ||
          wo.componentCode === component.id ||
          wo.component === component.name
        );

        // Filter active work orders (not completed)
        const activeWOs = componentWOs.filter(wo => 
          wo.status !== 'Completed' && wo.isActive !== false
        );

        // Count by status
        const overdueCount = activeWOs.filter(wo => wo.status === 'Overdue').length;
        const dueSoonCount = activeWOs.filter(wo => {
          const dueDate = parseDate(wo.dueDate || wo.nextDueDate);
          if (!dueDate) return false;
          return dueDate >= today && dueDate <= sevenDaysFromNow;
        }).length;
        const totalActiveWOs = activeWOs.length;

        // Find next due date and last done date
        const dueDates = activeWOs
          .map(wo => parseDate(wo.dueDate || wo.nextDueDate))
          .filter((d): d is Date => d !== null)
          .sort((a, b) => a.getTime() - b.getTime());
        const nextDueDate = dueDates.length > 0 ? dueDates[0] : null;

        const completedWOs = componentWOs.filter(wo => wo.status === 'Completed');
        const completionDates = completedWOs
          .map(wo => parseDate(wo.dateCompleted))
          .filter((d): d is Date => d !== null)
          .sort((a, b) => b.getTime() - a.getTime());
        const lastDoneDate = completionDates.length > 0 ? completionDates[0] : null;

        // Calculate days until due
        const daysUntilDue = nextDueDate 
          ? Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          sNo: index + 1,
          componentCode: component.componentCode || component.id,
          componentName: component.name || 'Unnamed Component',
          isCritical: component.critical ? 'Yes' : 'No',
          isClassItem: component.classItem ? 'Yes' : 'No',
          department: component.department || component.eqptSystemDept || '-',
          location: component.location || '-',
          totalWorkOrders: totalActiveWOs,
          overdueJobs: overdueCount,
          dueSoonJobs: dueSoonCount,
          nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
          daysUntilDue
        };
      });

      // Sort by overdue count DESC, then next_due_date ASC (nulls last)
      reportData.sort((a, b) => {
        // First by overdue count (descending)
        if (a.overdueJobs !== b.overdueJobs) {
          return b.overdueJobs - a.overdueJobs;
        }
        
        // Then by next due date (ascending, nulls last)
        if (a.daysUntilDue === null && b.daysUntilDue === null) return 0;
        if (a.daysUntilDue === null) return 1;
        if (b.daysUntilDue === null) return -1;
        return a.daysUntilDue - b.daysUntilDue;
      });

      // Re-number after sorting
      reportData.forEach((item, idx) => { item.sNo = idx + 1; });

      // Calculate metadata matching specification
      const metadata = {
        totalCriticalEquipment: reportData.length,
        criticalOnly: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'No').length,
        classItemOnly: reportData.filter(r => r.isClassItem === 'Yes' && r.isCritical === 'No').length,
        bothCriticalAndClass: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'Yes').length,
        equipmentWithOverdue: reportData.filter(r => r.overdueJobs > 0).length,
        equipmentDueSoon: reportData.filter(r => r.dueSoonJobs > 0 && r.overdueJobs === 0).length,
        totalOverdueJobs: reportData.reduce((sum, r) => sum + r.overdueJobs, 0),
        totalTrackedWorkOrders: reportData.reduce((sum, r) => sum + r.totalWorkOrders, 0),
        reportDate: new Date().toISOString()
      };

      res.json({
        success: true,
        data: reportData,
        metadata
      });

    } catch (error: any) {
      console.error('Error generating critical equipment report:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to generate critical equipment report'
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.5: CRITICAL EQUIPMENT STATUS EXCEL EXPORT
  // Generates Excel file with critical/class equipment status
  // ═══════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/critical-equipment-status/excel", async (req, res) => {
    try {
      const { vesselId } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }

      // Reuse the JSON endpoint logic - fetch critical equipment data
      const allComponents = await storage.getComponents(vesselId);
      const criticalComponents = allComponents.filter(c => 
        c.isActive !== false && (c.critical === true || c.classItem === true)
      );

      const allWorkOrders = await storage.getWorkOrders(vesselId);
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;

      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Build report data
      const reportData = criticalComponents.map((component, index) => {
        const componentWOs = allWorkOrders.filter(wo => 
          wo.componentCode === component.componentCode ||
          wo.componentCode === component.id ||
          wo.component === component.name
        );

        const activeWOs = componentWOs.filter(wo => 
          wo.status !== 'Completed' && wo.isActive !== false
        );

        const overdueCount = activeWOs.filter(wo => wo.status === 'Overdue').length;
        const dueSoonCount = activeWOs.filter(wo => {
          const dueDate = parseDate(wo.dueDate || wo.nextDueDate);
          if (!dueDate) return false;
          return dueDate >= today && dueDate <= sevenDaysFromNow;
        }).length;
        const totalActiveWOs = activeWOs.length;

        const dueDates = activeWOs
          .map(wo => parseDate(wo.dueDate || wo.nextDueDate))
          .filter((d): d is Date => d !== null)
          .sort((a, b) => a.getTime() - b.getTime());
        const nextDueDate = dueDates.length > 0 ? dueDates[0] : null;

        const daysUntilDue = nextDueDate 
          ? Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          sNo: index + 1,
          componentCode: component.componentCode || component.id,
          componentName: component.name || 'Unnamed Component',
          isCritical: component.critical ? 'Yes' : 'No',
          isClassItem: component.classItem ? 'Yes' : 'No',
          department: component.department || component.eqptSystemDept || '-',
          location: component.location || '-',
          totalWorkOrders: totalActiveWOs,
          overdueJobs: overdueCount,
          dueSoonJobs: dueSoonCount,
          nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : '-',
          daysUntilDue: daysUntilDue !== null ? daysUntilDue : '-'
        };
      });

      // Sort by overdue count DESC, then next_due_date ASC (nulls last)
      reportData.sort((a, b) => {
        if (a.overdueJobs !== b.overdueJobs) {
          return b.overdueJobs - a.overdueJobs;
        }
        const daysA = a.daysUntilDue === '-' ? 9999 : (a.daysUntilDue as number);
        const daysB = b.daysUntilDue === '-' ? 9999 : (b.daysUntilDue as number);
        return daysA - daysB;
      });

      reportData.forEach((item, idx) => { item.sNo = idx + 1; });

      // Calculate summary matching specification
      const metadata = {
        totalCriticalEquipment: reportData.length,
        criticalOnly: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'No').length,
        classItemOnly: reportData.filter(r => r.isClassItem === 'Yes' && r.isCritical === 'No').length,
        bothCriticalAndClass: reportData.filter(r => r.isCritical === 'Yes' && r.isClassItem === 'Yes').length,
        equipmentWithOverdue: reportData.filter(r => r.overdueJobs > 0).length,
        equipmentDueSoon: reportData.filter(r => r.dueSoonJobs > 0 && r.overdueJobs === 0).length,
        totalOverdueJobs: reportData.reduce((sum, r) => sum + r.overdueJobs, 0),
        totalTrackedWorkOrders: reportData.reduce((sum, r) => sum + r.totalWorkOrders, 0)
      };

      // Generate Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Critical Equipment Status');

      // Define columns matching specification (12 columns)
      const columns: ColumnDef[] = [
        { header: 'S.No', key: 'sNo', width: 6 },
        { header: 'Comp. Code', key: 'componentCode', width: 15 },
        { header: 'Component Name', key: 'componentName', width: 30 },
        { header: 'Critical', key: 'isCritical', width: 10 },
        { header: 'Class Item', key: 'isClassItem', width: 10 },
        { header: 'Dept', key: 'department', width: 12 },
        { header: 'Location', key: 'location', width: 15 },
        { header: 'Total WOs', key: 'totalWorkOrders', width: 10 },
        { header: 'Overdue', key: 'overdueJobs', width: 10 },
        { header: 'Due Soon', key: 'dueSoonJobs', width: 10 },
        { header: 'Next Due', key: 'nextDueDate', width: 12 },
        { header: 'Days', key: 'daysUntilDue', width: 8 }
      ];

      const lastCol = getLastColumnLetter(columns.length);

      // Apply standard header (rows 1-6)
      applyStandardHeader(
        worksheet,
        'CRITICAL EQUIPMENT STATUS REPORT',
        'SOLAS-critical and class-critical equipment',
        vesselName,
        reportData.length,
        lastCol
      );

      // Apply table headers at row 7
      applyStandardTableHeader(worksheet, columns, 7);

      // Data rows with conditional formatting based on overdue/due soon status
      reportData.forEach((row, index) => {
        const dataRow = worksheet.getRow(8 + index);
        const rowData = [
          row.sNo,
          row.componentCode,
          row.componentName,
          row.isCritical,
          row.isClassItem,
          row.department,
          row.location,
          row.totalWorkOrders,
          row.overdueJobs,
          row.dueSoonJobs,
          row.nextDueDate,
          row.daysUntilDue
        ];

        rowData.forEach((value, colIdx) => {
          dataRow.getCell(colIdx + 1).value = value;
        });

        // Determine row background color based on status
        let fillColor: string;
        if (row.overdueJobs > 0) {
          fillColor = COLORS.bgDanger; // RED for overdue
        } else if (row.dueSoonJobs > 0) {
          fillColor = COLORS.bgWarning; // YELLOW/ORANGE for due soon
        } else {
          fillColor = index % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight;
        }

        dataRow.eachCell((cell, colNumber) => {
          if (colNumber <= columns.length) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            cell.border = {
              top: { style: 'thin', color: { argb: COLORS.border } },
              left: { style: 'thin', color: { argb: COLORS.border } },
              bottom: { style: 'thin', color: { argb: COLORS.border } },
              right: { style: 'thin', color: { argb: COLORS.border } }
            };
          }
        });

        // Apply conditional formatting to Overdue column (column 9)
        if (row.overdueJobs > 0) {
          dataRow.getCell(9).font = { color: { argb: COLORS.danger }, bold: true };
        }

        // Apply conditional formatting to Days column (column 12)
        const daysValue = row.daysUntilDue;
        if (typeof daysValue === 'number') {
          if (daysValue < 0) {
            dataRow.getCell(12).font = { color: { argb: COLORS.danger }, bold: true };
          } else if (daysValue <= 7) {
            dataRow.getCell(12).font = { color: { argb: COLORS.warning }, bold: true };
          }
        }
      });

      // Apply auto-filter
      worksheet.autoFilter = {
        from: { row: 7, column: 1 },
        to: { row: 7 + reportData.length, column: columns.length }
      };

      // Apply standard page setup
      applyStandardPageSetup(worksheet);

      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `Critical_Equipment_Status_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

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
  });

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.6: UNPLANNED/BREAKDOWN JOBS API
  // Returns completed unplanned/breakdown work orders with manhours data
  // ═══════════════════════════════════════════════════════════════
  app.get("/technical/api/reports/unplanned-breakdown-jobs", async (req, res) => {
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

      // Get all work orders for the vessel
      const allWorkOrders = await storage.getWorkOrders(vesselId);

      // Parse date helper
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };

      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      // Filter for unplanned/breakdown jobs that are completed
      const unplannedBreakdownJobs = allWorkOrders.filter(wo => {
        // Check if it's an unplanned or breakdown job
        const isUnplanned = 
          wo.workOrderType === 'Unplanned' ||
          (wo.taskType && (
            wo.taskType.toLowerCase().includes('unplanned') ||
            wo.taskType.toLowerCase().includes('breakdown')
          )) ||
          (wo.workOrderNo && wo.workOrderNo.startsWith('UWO'));

        if (!isUnplanned) return false;

        // Check if completed
        if (wo.status !== 'Completed') return false;

        // Filter by dateCompleted for completed jobs report
        const completedDateStr = wo.dateCompleted ? (wo.dateCompleted instanceof Date ? wo.dateCompleted.toISOString() : String(wo.dateCompleted)) : null;
        const completedDate = parseDate(completedDateStr);
        if (!completedDate) return true; // Include jobs without completion date

        return completedDate >= startDateObj && completedDate <= endDateObj;
      });

      // Format date for display
      const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
        if (!dateVal) return '-';
        try {
          const dateStr = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '-';
          return d.toISOString().split('T')[0];
        } catch {
          return '-';
        }
      };

      // Build report data
      const reportData = unplannedBreakdownJobs.map((wo, index) => ({
        sNo: index + 1,
        workOrderNo: wo.workOrderNo || wo.id || '-',
        componentCode: wo.componentCode || '-',
        componentName: wo.component || '-',
        jobTitle: wo.jobTitle || '-',
        briefDescription: wo.briefWorkDescription || '-',
        createdDate: formatDateDisplay(wo.createdAt),
        completedDate: formatDateDisplay(wo.dateCompleted),
        performedBy: wo.performedBy || wo.assignedTo || '-',
        totalHours: wo.totalTimeHours ? parseFloat(wo.totalTimeHours).toFixed(1) : '0',
        manhours: wo.manhours ? parseFloat(wo.manhours).toFixed(1) : '0',
        department: wo.department || '-'
      }));

      // Calculate metadata
      const totalManhours = unplannedBreakdownJobs.reduce((sum, wo) => {
        return sum + (parseFloat(wo.manhours || '0') || 0);
      }, 0);

      const totalHours = unplannedBreakdownJobs.reduce((sum, wo) => {
        return sum + (parseFloat(wo.totalTimeHours || '0') || 0);
      }, 0);

      const avgTimeTaken = unplannedBreakdownJobs.length > 0
        ? (totalHours / unplannedBreakdownJobs.length).toFixed(2)
        : '0';

      // Group by department
      const byDepartment: Record<string, number> = {};
      unplannedBreakdownJobs.forEach(wo => {
        const dept = wo.department || 'Not Specified';
        byDepartment[dept] = (byDepartment[dept] || 0) + 1;
      });

      // Group by priority
      const byPriority: Record<string, number> = {};
      unplannedBreakdownJobs.forEach(wo => {
        const priority = wo.jobPriority || 'Not Specified';
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      });

      const metadata = {
        totalUnplannedJobs: reportData.length,
        totalManhours: totalManhours.toFixed(1),
        avgTimeTaken,
        byDepartment,
        byPriority,
        reportDate: new Date().toISOString(),
        dateRange: { start: startDate, end: endDate }
      };

      res.json({
        success: true,
        data: reportData,
        metadata
      });

    } catch (error: any) {
      console.error('Error generating unplanned/breakdown jobs report:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to generate unplanned/breakdown jobs report'
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // REPORT 1.6: UNPLANNED/BREAKDOWN JOBS EXCEL EXPORT
  // Generates Excel file with unplanned/breakdown jobs data
  // ═══════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/unplanned-breakdown-jobs/excel", async (req, res) => {
    try {
      const { vesselId, startDate, endDate } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Please select a date range" });
      }

      // Get all work orders for the vessel
      const allWorkOrders = await storage.getWorkOrders(vesselId);
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;

      // Parse date helper
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };

      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      // Filter for unplanned/breakdown jobs that are completed
      const unplannedBreakdownJobs = allWorkOrders.filter(wo => {
        const isUnplanned = 
          wo.workOrderType === 'Unplanned' ||
          (wo.taskType && (
            wo.taskType.toLowerCase().includes('unplanned') ||
            wo.taskType.toLowerCase().includes('breakdown')
          )) ||
          (wo.workOrderNo && wo.workOrderNo.startsWith('UWO'));

        if (!isUnplanned) return false;
        if (wo.status !== 'Completed') return false;

        // Filter by dateCompleted for completed jobs report
        const completedDateStr = wo.dateCompleted ? (wo.dateCompleted instanceof Date ? wo.dateCompleted.toISOString() : String(wo.dateCompleted)) : null;
        const completedDate = parseDate(completedDateStr);
        if (!completedDate) return true; // Include jobs without completion date

        return completedDate >= startDateObj && completedDate <= endDateObj;
      });

      // Format date for display
      const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
        if (!dateVal) return '-';
        try {
          const dateStr = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '-';
          return d.toISOString().split('T')[0];
        } catch {
          return '-';
        }
      };

      // Build report data
      const reportData = unplannedBreakdownJobs.map((wo, index) => ({
        sNo: index + 1,
        workOrderNo: wo.workOrderNo || wo.id || '-',
        componentCode: wo.componentCode || '-',
        componentName: wo.component || '-',
        jobTitle: wo.jobTitle || '-',
        briefDescription: wo.briefWorkDescription || '-',
        createdDate: formatDateDisplay(wo.createdAt),
        completedDate: formatDateDisplay(wo.dateCompleted),
        performedBy: wo.performedBy || wo.assignedTo || '-',
        totalHours: wo.totalTimeHours ? parseFloat(wo.totalTimeHours).toFixed(1) : '0',
        manhours: wo.manhours ? parseFloat(wo.manhours).toFixed(1) : '0',
        department: wo.department || '-'
      }));

      // Calculate metadata
      const totalManhours = unplannedBreakdownJobs.reduce((sum, wo) => {
        return sum + (parseFloat(wo.manhours || '0') || 0);
      }, 0);

      const totalHours = unplannedBreakdownJobs.reduce((sum, wo) => {
        return sum + (parseFloat(wo.totalTimeHours || '0') || 0);
      }, 0);

      const avgTimeTaken = unplannedBreakdownJobs.length > 0
        ? (totalHours / unplannedBreakdownJobs.length).toFixed(2)
        : '0';

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Unplanned Breakdown Jobs');

      // Define columns (11 columns as specified)
      const columns = [
        { header: 'S.No', key: 'sNo', width: 8 },
        { header: 'WO Number', key: 'workOrderNo', width: 18 },
        { header: 'Comp. Code', key: 'componentCode', width: 15 },
        { header: 'Component Name', key: 'componentName', width: 30 },
        { header: 'Job Title', key: 'jobTitle', width: 25 },
        { header: 'Description', key: 'briefDescription', width: 35 },
        { header: 'Created Date', key: 'createdDate', width: 14 },
        { header: 'Completed Date', key: 'completedDate', width: 14 },
        { header: 'Performed By', key: 'performedBy', width: 18 },
        { header: 'Hours', key: 'totalHours', width: 10 },
        { header: 'Manhours', key: 'manhours', width: 12 }
      ];

      worksheet.columns = columns;
      const lastColLetter = getLastColumnLetter(columns.length);

      // Apply standard header using helper from excelReportStyles
      applyStandardHeader(
        worksheet,
        'UNPLANNED/BREAKDOWN JOBS REPORT',
        `Analysis of breakdown maintenance and unplanned work (${startDate} to ${endDate})`,
        vesselName,
        reportData.length,
        lastColLetter,
        `${startDate} to ${endDate}`
      );

      // Apply table headers at row 7
      applyStandardTableHeader(worksheet, columns, 7);

      // Data rows
      reportData.forEach((row, index) => {
        const dataRow = worksheet.getRow(8 + index);
        const rowData = [
          row.sNo,
          row.workOrderNo,
          row.componentCode,
          row.componentName,
          row.jobTitle,
          row.briefDescription,
          row.createdDate,
          row.completedDate,
          row.performedBy,
          row.totalHours,
          row.manhours
        ];

        rowData.forEach((value, colIdx) => {
          dataRow.getCell(colIdx + 1).value = value;
        });

        // Alternating row colors
        const fillColor = index % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight;

        dataRow.eachCell((cell: any, colNumber: number) => {
          if (colNumber <= columns.length) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            cell.border = {
              top: { style: 'thin', color: { argb: COLORS.border } },
              left: { style: 'thin', color: { argb: COLORS.border } },
              bottom: { style: 'thin', color: { argb: COLORS.border } },
              right: { style: 'thin', color: { argb: COLORS.border } }
            };
          }
        });
      });

      // Apply auto-filter
      worksheet.autoFilter = {
        from: { row: 7, column: 1 },
        to: { row: 7 + reportData.length, column: columns.length }
      };

      // Apply standard page setup
      applyStandardPageSetup(worksheet);

      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `Unplanned_Breakdown_Jobs_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

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
  });

  
  // Defects API routes
  
  // Get all defects with optional filters
  app.get("/technical/api/defects", async (req, res) => {
    try {
      const filters = {
        vesselId: req.query.vesselId as string,
        status: req.query.status as string,
        statusView: req.query.statusScope as 'active' | 'resolved' | undefined || 
                   req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
        priority: req.query.priority as string,
        critical: req.query.critical === 'true' ? true : req.query.critical === 'false' ? false : undefined,
        isCoC: req.query.is_coc === 'true' || req.query.isCoC === 'true' ? true : 
               req.query.is_coc === 'false' || req.query.isCoC === 'false' ? false : undefined, // Only apply filter when explicitly set
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        includeClosedDefects: req.query.includeClosedDefects === 'true',
        dueOverdue: req.query.dueOverdue as string,
      };
      
      const defects = await storage.getDefects(filters);
      res.json(defects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defects" });
    }
  });
  
  // CoC-specific defects endpoint
  app.get("/technical/api/defects/coc", async (req, res) => {
    try {
      const filters = {
        vesselId: req.query.vesselId as string,
        status: req.query.status as string,
        statusView: req.query.statusScope as 'active' | 'resolved' | undefined || 
                   req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
        priority: req.query.priority as string,
        isCoC: true, // Always filter for CoC
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
      };
      
      const defects = await storage.getDefects(filters);
      res.json(defects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CoC defects" });
    }
  });

  // Recurring defects endpoint
  app.get("/technical/api/defects/recurring", async (req, res) => {
    try {
      const filters = {
        windowMonths: req.query.windowMonths ? parseInt(req.query.windowMonths as string) : undefined,
        minOccurrences: req.query.minOccurrences ? parseInt(req.query.minOccurrences as string) : undefined,
        hasCoc: req.query.hasCoc ? req.query.hasCoc === 'true' : undefined,
        equipmentKey: req.query.equipmentKey as string,
      };
      
      const recurringDefects = await storage.getRecurringDefects(filters);
      res.json(recurringDefects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recurring defects" });
    }
  });
  
  // Get defects count
  app.get("/technical/api/defects/count", async (req, res) => {
    try {
      const filters: any = {
        statusView: req.query.statusScope as 'active' | 'resolved' | undefined || 
                   req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
        vesselId: req.query.vesselId as string,
        isCoC: req.query.isCoC !== undefined ? req.query.isCoC === 'true' : undefined,
        // Include all filter parameters to match list query filters
        category: req.query.category as string,
        search: req.query.search as string,
        period: req.query.period as string,
        fleet: req.query.fleet as string,
        group: req.query.group as string,
        dueOverdue: req.query.dueOverdue as string,
      };
      
      const count = await storage.getDefectsCount(filters);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to get defects count" });
    }
  });

  // Get recurring defects count
  app.get("/technical/api/defects/count/recurring", async (req, res) => {
    try {
      const recurringDefects = await storage.getRecurringDefects({});
      res.json({ count: recurringDefects.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get recurring defects count" });
    }
  });
  
  // Get single defect
  app.get("/technical/api/defects/:id", async (req, res) => {
    try {
      const defect = await storage.getDefect(req.params.id);
      if (!defect) {
        return res.status(404).json({ error: "Defect not found" });
      }
      res.json(defect);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect" });
    }
  });
  
  // Create new defect
  app.post("/technical/api/defects", async (req, res) => {
    try {
      const validatedData = insertDefectSchema.parse(req.body);
      
      // Generate proper defect ID using naming convention
      const { generateDefectNumber } = await import("./utils/defectNumbering");
      const vesselId = validatedData.vesselId || 'UNKNOWN';
      const generatedId = await generateDefectNumber(storage, vesselId);
      
      // Create defect with generated ID
      const defectWithId = {
        ...validatedData,
        id: generatedId
      };
      
      console.log(`[DefectRoutes] Creating defect with generated ID: ${generatedId} for vessel: ${vesselId}`);
      
      const defect = await storage.createDefect(defectWithId);
      res.status(201).json(defect);
    } catch (error: any) {
      console.error('[DefectRoutes] Error creating defect:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid defect data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create defect" });
    }
  });
  
  // Update defect
  app.patch("/technical/api/defects/:id", async (req, res) => {
    try {
      const partialDefectSchema = insertDefectSchema.partial();
      const validatedData = partialDefectSchema.parse(req.body);
      const defect = await storage.updateDefect(req.params.id, validatedData);
      res.json(defect);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid defect data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update defect" });
    }
  });
  
  // Delete defect
  app.delete("/technical/api/defects/:id", async (req, res) => {
    try {
      await storage.deleteDefect(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete defect" });
    }
  });

  // Clear all defects data endpoint
  app.delete("/technical/api/defects-clear-all", async (req, res) => {
    res.status(501).json({ 
      error: "Not Implemented",
      message: "The clearAllDefectsData method is not implemented in storage. This endpoint is reserved for future admin/testing functionality." 
    });
  });

  // Seed E2E test data endpoint
  app.post("/technical/api/defects-seed-e2e-test", async (req, res) => {
    res.status(501).json({ 
      error: "Not Implemented",
      message: "The seedE2ETestData method is not implemented in storage. This endpoint is reserved for future testing functionality." 
    });
  });

  // Get defects count endpoint (returns active and resolved counts)
  app.get("/technical/api/defects-count", async (req, res) => {
    try {
      const activeCount = await storage.getDefectsCount({ statusView: 'active' });
      const resolvedCount = await storage.getDefectsCount({ statusView: 'resolved' });
      res.json({ 
        active: activeCount, 
        resolved: resolvedCount 
      });
    } catch (error: any) {
      console.error("Error getting defects count:", error);
      res.status(500).json({ error: "Failed to get defects count" });
    }
  });
  
  // Get defect actions for a specific defect
  app.get("/technical/api/defects/:defectId/actions", async (req, res) => {
    try {
      const actions = await storage.getDefectActions(req.params.defectId);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect actions" });
    }
  });
  
  // Create defect action
  app.post("/technical/api/defects/:defectId/actions", async (req, res) => {
    try {
      const actionData = {
        ...req.body,
        defectId: req.params.defectId
      };
      const validatedData = insertDefectActionSchema.parse(actionData);
      const action = await storage.createDefectAction(validatedData);
      res.status(201).json(action);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid action data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create defect action" });
    }
  });
  
  // Update defect action
  app.patch("/technical/api/defects/actions/:actionId", async (req, res) => {
    try {
      const partialActionSchema = insertDefectActionSchema.partial();
      const validatedData = partialActionSchema.parse(req.body);
      const action = await storage.updateDefectAction(parseInt(req.params.actionId), validatedData);
      res.json(action);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid action data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update defect action" });
    }
  });
  
  // Delete defect action
  app.delete("/technical/api/defects/actions/:actionId", async (req, res) => {
    try {
      await storage.deleteDefectAction(parseInt(req.params.actionId));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete defect action" });
    }
  });
  
  // Get defect attachments for a specific defect
  app.get("/technical/api/defects/:defectId/attachments", async (req, res) => {
    try {
      const attachments = await storage.getDefectAttachments(req.params.defectId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect attachments" });
    }
  });
  
  // Create defect attachment
  app.post("/technical/api/defects/:defectId/attachments", async (req, res) => {
    try {
      const attachmentData = {
        ...req.body,
        defectId: req.params.defectId
      };
      const validatedData = insertDefectAttachmentSchema.parse(attachmentData);
      const attachment = await storage.createDefectAttachment(validatedData);
      res.status(201).json(attachment);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid attachment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create defect attachment" });
    }
  });
  
  // Delete defect attachment
  app.delete("/technical/api/defects/attachments/:attachmentId", async (req, res) => {
    try {
      await storage.deleteDefectAttachment(parseInt(req.params.attachmentId));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete defect attachment" });
    }
  });
  
  // Add note to defect
  app.post("/technical/api/defects/:id/notes", async (req, res) => {
    try {
      const { noteText, attachments, createdBy } = req.body;
      
      if (!noteText || noteText.length < 10) {
        return res.status(400).json({ error: "Note text must be at least 10 characters" });
      }
      
      const note = {
        noteId: Date.now().toString(),
        noteText,
        attachments: attachments || [],
        createdBy: createdBy || 'Anonymous',
        createdOn: new Date().toISOString()
      };
      
      const updatedDefect = await storage.addDefectNote(req.params.id, note);
      res.json(updatedDefect);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to add note" });
    }
  });
  
  // Link related defects
  app.patch("/technical/api/defects/:id/link", async (req, res) => {
    try {
      const { linkedDefects } = req.body;
      
      if (!linkedDefects || !Array.isArray(linkedDefects) || linkedDefects.length === 0) {
        return res.status(400).json({ error: "linkedDefects must be a non-empty array" });
      }
      
      const updatedDefect = await storage.linkDefects(req.params.id, linkedDefects);
      res.json(updatedDefect);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to link defects" });
    }
  });
  
  // Close defect
  app.patch("/technical/api/defects/:id/close", async (req, res) => {
    try {
      const { closedBy, closureComment, closureFiles, actionTakenRequested, targetCloseDate, dateCompleted } = req.body;
      
      // Validate all required fields
      if (!closureComment || closureComment.trim().length === 0) {
        return res.status(400).json({ error: "Closure comment is required" });
      }
      
      if (!actionTakenRequested || actionTakenRequested.trim().length === 0) {
        return res.status(400).json({ error: "Action taken is required to close the defect" });
      }
      
      if (!targetCloseDate) {
        return res.status(400).json({ error: "Target date is required" });
      }
      
      if (!dateCompleted) {
        return res.status(400).json({ error: "Completion date is required" });
      }
      
      const defect = await storage.closeDefect(req.params.id, {
        closedBy: closedBy || 'System',
        closureComment,
        closureFiles: closureFiles || []
      });
      
      res.json(defect);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to close defect" });
    }
  });
  
  // Defects Reports API
  app.post("/technical/api/defects/reports/:reportKey", async (req, res) => {
    try {
      const { reportKey } = req.params;
      const filters = req.body;
      
      // Get defects based on filters
      const defects = await storage.getDefects(filters);
      
      // Generate report based on report key
      let reportData: any = {
        title: '',
        generatedAt: new Date().toISOString(),
        filters,
        data: []
      };
      
      switch(reportKey) {
        case 'status-summary':
          reportData.title = 'Defects Status Summary';
          // Group defects by status
          const statusGroups = defects.reduce((acc: any, defect) => {
            if (!acc[defect.status]) {
              acc[defect.status] = { count: 0, defects: [] };
            }
            acc[defect.status].count++;
            acc[defect.status].defects.push(defect);
            return acc;
          }, {});
          reportData.data = Object.entries(statusGroups).map(([status, data]: [string, any]) => ({
            status,
            count: data.count,
            percentage: ((data.count / defects.length) * 100).toFixed(1) + '%'
          }));
          break;
          
        case 'overdue':
          reportData.title = 'Overdue Defects';
          const today = new Date().toISOString().split('T')[0];
          reportData.data = defects.filter((d: any) => 
            d.status === 'Open' && 
            d.targetCloseDate && 
            new Date(d.targetCloseDate.split('-').reverse().join('-')) < new Date(today)
          );
          break;
          
        case 'critical':
          reportData.title = 'Critical Defects';
          reportData.data = defects.filter((d: any) => d.critical || d.is_coc);
          break;
          
        case 'by-vessel':
          reportData.title = 'Defects by Vessel';
          const vesselGroups = defects.reduce((acc: any, defect) => {
            if (!acc[defect.vesselName]) {
              acc[defect.vesselName] = { count: 0, open: 0, closed: 0 };
            }
            acc[defect.vesselName].count++;
            if (defect.status === 'Open') {
              acc[defect.vesselName].open++;
            } else if (defect.status === 'Closed') {
              acc[defect.vesselName].closed++;
            }
            return acc;
          }, {});
          reportData.data = Object.entries(vesselGroups).map(([vessel, stats]: [string, any]) => ({
            vessel,
            total: stats.count,
            open: stats.open,
            closed: stats.closed
          }));
          break;
          
        case 'by-equipment':
          reportData.title = 'Defects by Equipment';
          const equipmentGroups = defects.reduce((acc: any, defect) => {
            const equipment = defect.equipmentCategory || 'Not Specified';
            if (!acc[equipment]) {
              acc[equipment] = { count: 0, defects: [] };
            }
            acc[equipment].count++;
            acc[equipment].defects.push(defect);
            return acc;
          }, {});
          reportData.data = Object.entries(equipmentGroups).map(([equipment, data]: [string, any]) => ({
            equipment,
            count: data.count,
            percentage: ((data.count / defects.length) * 100).toFixed(1) + '%'
          }));
          break;
          
        case 'monthly-trend':
          reportData.title = 'Monthly Trend';
          // Group by month
          const monthGroups = defects.reduce((acc: any, defect) => {
            const dateStr = defect.issueDate; // DD-MM-YYYY
            if (!dateStr) return acc;
            const [day, month, year] = dateStr.split('-');
            const monthKey = `${year}-${month}`;
            if (!acc[monthKey]) {
              acc[monthKey] = { created: 0, closed: 0 };
            }
            acc[monthKey].created++;
            if (defect.status === 'Closed' && defect.dateCompleted) {
              const [cDay, cMonth, cYear] = defect.dateCompleted.split('-');
              const closedMonthKey = `${cYear}-${cMonth}`;
              if (!acc[closedMonthKey]) {
                acc[closedMonthKey] = { created: 0, closed: 0 };
              }
              acc[closedMonthKey].closed++;
            }
            return acc;
          }, {});
          reportData.data = Object.entries(monthGroups).map(([month, stats]: [string, any]) => ({
            month,
            created: stats.created,
            closed: stats.closed,
            net: stats.created - stats.closed
          })).sort((a, b) => a.month.localeCompare(b.month));
          break;
          
        default:
          reportData.title = 'Defects Report';
          reportData.data = defects;
      }
      
      res.json(reportData);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });
  
  // ===== DEFECT CATEGORIES API =====
  // Get all defect categories
  app.get("/technical/api/defect-categories", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const categories = await db.select().from(defectCategories).orderBy(defectCategories.sortOrder);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching defect categories:", error);
      res.status(500).json({ error: "Failed to fetch defect categories" });
    }
  });

  // Create defect category
  app.post("/technical/api/defect-categories", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const { name, sortOrder = 0, isActive = true } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }
      if (sortOrder !== undefined && typeof sortOrder !== 'number') {
        return res.status(400).json({ error: "Sort order must be a number" });
      }
      const [category] = await db.insert(defectCategories).values({
        name: name.trim(),
        sortOrder,
        isActive,
      }).returning();
      res.status(201).json(category);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Category with this name already exists" });
      }
      console.error("Error creating defect category:", error);
      res.status(500).json({ error: "Failed to create defect category" });
    }
  });

  // Update defect category
  app.patch("/technical/api/defect-categories/:id", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
      const { name, sortOrder, isActive } = req.body;
      if (name !== undefined && !name.trim()) {
        return res.status(400).json({ error: "Category name cannot be empty" });
      }
      if (sortOrder !== undefined && typeof sortOrder !== 'number') {
        return res.status(400).json({ error: "Sort order must be a number" });
      }
      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (isActive !== undefined) updates.isActive = isActive;
      
      const [category] = await db.update(defectCategories)
        .set(updates)
        .where(eq(defectCategories.id, id))
        .returning();
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Category with this name already exists" });
      }
      console.error("Error updating defect category:", error);
      res.status(500).json({ error: "Failed to update defect category" });
    }
  });

  // Delete defect category
  app.delete("/technical/api/defect-categories/:id", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(defectCategories)
        .where(eq(defectCategories.id, id))
        .returning();
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting defect category:", error);
      res.status(500).json({ error: "Failed to delete defect category" });
    }
  });

  // ===== DEFECT TYPES API =====
  // Get all defect types
  app.get("/technical/api/defect-types", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const types = await db.select().from(defectTypes).orderBy(defectTypes.sortOrder);
      res.json(types);
    } catch (error) {
      console.error("Error fetching defect types:", error);
      res.status(500).json({ error: "Failed to fetch defect types" });
    }
  });

  // Create defect type
  app.post("/technical/api/defect-types", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const { name, sortOrder = 0, isActive = true } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ error: "Defect type name is required" });
      }
      if (sortOrder !== undefined && typeof sortOrder !== 'number') {
        return res.status(400).json({ error: "Sort order must be a number" });
      }
      const [defectType] = await db.insert(defectTypes).values({
        name: name.trim(),
        sortOrder,
        isActive,
      }).returning();
      res.status(201).json(defectType);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Defect type with this name already exists" });
      }
      console.error("Error creating defect type:", error);
      res.status(500).json({ error: "Failed to create defect type" });
    }
  });

  // Update defect type
  app.patch("/technical/api/defect-types/:id", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid defect type ID" });
      }
      const { name, sortOrder, isActive } = req.body;
      if (name !== undefined && !name.trim()) {
        return res.status(400).json({ error: "Defect type name cannot be empty" });
      }
      if (sortOrder !== undefined && typeof sortOrder !== 'number') {
        return res.status(400).json({ error: "Sort order must be a number" });
      }
      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (isActive !== undefined) updates.isActive = isActive;
      
      const [defectType] = await db.update(defectTypes)
        .set(updates)
        .where(eq(defectTypes.id, id))
        .returning();
      if (!defectType) {
        return res.status(404).json({ error: "Defect type not found" });
      }
      res.json(defectType);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Defect type with this name already exists" });
      }
      console.error("Error updating defect type:", error);
      res.status(500).json({ error: "Failed to update defect type" });
    }
  });

  // Delete defect type
  app.delete("/technical/api/defect-types/:id", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(defectTypes)
        .where(eq(defectTypes.id, id))
        .returning();
      if (!deleted) {
        return res.status(404).json({ error: "Defect type not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting defect type:", error);
      res.status(500).json({ error: "Failed to delete defect type" });
    }
  });

  // Running hours routes...
  
  // Get running hours audits for a specific component
  app.get("/technical/api/running-hours/:componentId", async (req, res) => {
    try {
      const audits = await storage.getRunningHoursAudits(req.params.componentId);
      res.json(audits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch running hours audits" });
    }
  });
  
  // Create a new running hours audit
  app.post("/technical/api/running-hours", async (req, res) => {
    try {
      const validatedData = insertRunningHoursAuditSchema.parse(req.body);
      const audit = await storage.createRunningHoursAudit(validatedData);
      res.status(201).json(audit);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid audit data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create audit" });
    }
  });
  
  // TEST endpoint - does ANY new code load?
  app.get("/technical/api/test-new-endpoint", async (req, res) => {
    res.json({ message: "This is a brand new endpoint added just now!", timestamp: new Date().toISOString() });
  });
  
  // DEBUG endpoint to check jobs data
  app.get("/technical/api/debug/jobs", async (req, res) => {
    try {
      const allJobs = await storage.getJobs();
      const rhJobs = allJobs.filter(j => j.maintenanceBasis === "Running Hours" && j.vesselId === "V001");
      res.json({
        totalJobs: allJobs.length,
        rhJobsCount: rhJobs.length,
        sampleRHJobs: rhJobs.slice(0, 3).map(j => ({
          id: j.id,
          jobNo: j.jobNo,
          componentId: j.componentId,
          maintenanceBasis: j.maintenanceBasis,
          vesselId: j.vesselId
        }))
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // REMOVED: Running Hours parents endpoint now registered in runningHoursRoutes.ts
  
  // Cascade running hours update to parent and children
  app.post("/technical/api/running-hours/cascade", async (req, res) => {
    try {
      const validatedData = cascadeRunningHoursSchema.parse(req.body);
      
      // Get the parent component to determine current RH
      const parentComponent = await storage.getComponent(validatedData.parentComponentId);
      if (!parentComponent) {
        return res.status(404).json({ error: "Parent component not found" });
      }
      
      const currentRH = parseFloat(parentComponent.currentCumulativeRH || '0');
      let targetRH: number;
      
      if (validatedData.mode === 'setTotal') {
        targetRH = validatedData.value;
      } else {
        // addDelta mode
        targetRH = currentRH + validatedData.value;
      }
      
      // Validate running hours increase against daily limits
      // Use same fallback logic as the Running Hours display: lastUpdated || rhMasterUpdatedAt || updatedAt
      const componentLastUpdated = parentComponent.lastUpdated 
        || (parentComponent.rhMasterUpdatedAt ? new Date(parentComponent.rhMasterUpdatedAt).toISOString() : null)
        || (parentComponent.updatedAt ? new Date(parentComponent.updatedAt).toISOString() : null);
      
      console.log('[RH Validation Debug] componentLastUpdated:', componentLastUpdated);
      console.log('[RH Validation Debug] newUpdateDate:', validatedData.dateUpdated);
      console.log('[RH Validation Debug] currentRH:', currentRH, 'targetRH:', targetRH);
      
      const validation = validateRunningHoursIncrease({
        currentRH: currentRH,
        newRH: targetRH,
        componentLastUpdated: componentLastUpdated,
        newUpdateDate: validatedData.dateUpdated,
        userRole: validatedData.userRole || 'Ship',
        adminOverride: validatedData.adminOverride || false
      });
      
      console.log('[RH Validation Debug] result:', validation);
      
      if (!validation.allowed) {
        return res.status(400).json({
          error: validation.message,
          validation: {
            maxAllowedIncrease: validation.maxAllowedIncrease,
            requestedIncrease: validation.requestedIncrease,
            daysSinceLastUpdate: validation.daysSinceLastUpdate,
            lastUpdateDate: validation.lastUpdateDate,
            requiresAdminOverride: validation.requiresAdminOverride,
            canOverride: canAdminOverride(validatedData.userRole || 'Ship')
          }
        });
      }
      
      const result = await storage.cascadeRunningHoursUpdate(validatedData);
      res.json({
        ...result,
        validation: {
          maxAllowedIncrease: validation.maxAllowedIncrease,
          actualIncrease: validation.requestedIncrease
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid cascade data", details: error.errors });
      }
      console.error('Error cascading running hours update:', error);
      res.status(500).json({ error: error.message || "Failed to cascade running hours update" });
    }
  });
  
  // Update existing audit by ID - COMMENTED OUT: method not implemented in storage
  // app.patch("/technical/api/running-hours/:id", async (req, res) => {
  //   try {
  //     const partialAuditSchema = insertRunningHoursAuditSchema.partial();
  //     const validatedData = partialAuditSchema.parse(req.body);
  //     const audit = await storage.updateRunningHoursAudit(parseInt(req.params.id), validatedData);
  //     res.json(audit);
  //   } catch (error: any) {
  //     if (error.name === 'ZodError') {
  //       return res.status(400).json({ error: "Invalid audit data", details: error.errors });
  //     }
  //     if (error.message?.includes('not found')) {
  //       return res.status(404).json({ error: error.message });
  //     }
  //     res.status(500).json({ error: "Failed to update audit" });
  //   }
  // });
  
  // Delete audit by ID - COMMENTED OUT: method not implemented in storage
  // app.delete("/technical/api/running-hours/:id", async (req, res) => {
  //   try {
  //     await storage.deleteRunningHoursAudit(parseInt(req.params.id));
  //     res.json({ success: true });
  //   } catch (error: any) {
  //     if (error.message?.includes('not found')) {
  //       return res.status(404).json({ error: error.message });
  //     }
  //     res.status(500).json({ error: "Failed to delete audit" });
  //   }
  // });

  // Spares routes...
  
  // Get ALL spares (for components page to filter by component ID)
  app.get("/technical/api/spares", async (req, res) => {
    try {
      const allSpares = await storage.getAllSpares();
      res.json(allSpares);
    } catch (error: any) {
      console.error("Error fetching all spares:", error);
      res.status(500).json({ error: "Failed to fetch spares", details: error.message });
    }
  });
  
  // IMPORTANT: This route MUST come BEFORE /api/spares/:vesselId to avoid route conflict
  // Route format: /api/spares/history/:vesselId (client-expected format)
  app.get("/technical/api/spares/history/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log('[API] Fetching spare history for vessel:', vesselId);
      const history = await storage.getSpareHistory(vesselId);
      console.log('[API] Found', history.length, 'history entries');
      res.json(history);
    } catch (error) {
      console.error('[API] Spare history error:', error);
      res.status(500).json({ error: "Failed to fetch spare history" });
    }
  });
  
  // ============= SPARES BULK UPDATE (Location-specific) =============
  // IMPORTANT: This route MUST come BEFORE /api/spares/:vesselId to avoid route conflict
  app.post("/technical/api/spares/bulk-update", async (req, res) => {
    try {
      console.log('[BULK UPDATE] Request received:', JSON.stringify(req.body, null, 2).substring(0, 500));
      const { vesselId, tz, rows } = req.body;
      
      if (!vesselId || !rows || !Array.isArray(rows)) {
        return res.status(400).json({
          success: false,
          error: 'vesselId and rows are required'
        });
      }
      
      console.log('[BULK UPDATE] Processing', rows.length, 'rows for vessel', vesselId);
      
      const results: Array<{
        componentSpareId: number;
        success: boolean;
        message?: string;
        robAfter?: number;
      }> = [];
      
      for (const row of rows) {
        const { 
          componentSpareId, 
          consumedA = 0, 
          consumedB = 0, 
          receivedA = 0, 
          receivedB = 0,
          receivedDate,
          receivedPlace,
          dateLocal,
          remarks,
          userId = 'user'
        } = row;
        
        // Normalize transaction date - ensure empty strings are treated as undefined
        // and only valid ISO date strings are used
        const transactionDate = (receivedDate && receivedDate.trim()) 
          ? receivedDate.trim() 
          : ((dateLocal && dateLocal.trim()) ? dateLocal.trim() : undefined);
        
        try {
          let totalChange = 0;
          const errors: string[] = [];
          
          // Consume from Location A
          if (consumedA > 0) {
            try {
              await storage.consumeSpareFromLocation(
                componentSpareId,
                consumedA,
                'A',
                userId,
                remarks,
                undefined, // workOrderRef
                transactionDate // Use selected date for history
              );
              totalChange -= consumedA;
            } catch (e: any) {
              errors.push(`Consume A: ${e.message}`);
            }
          }
          
          // Consume from Location B
          if (consumedB > 0) {
            try {
              await storage.consumeSpareFromLocation(
                componentSpareId,
                consumedB,
                'B',
                userId,
                remarks,
                undefined, // workOrderRef
                transactionDate // Use selected date for history
              );
              totalChange -= consumedB;
            } catch (e: any) {
              errors.push(`Consume B: ${e.message}`);
            }
          }
          
          // Receive to Location A
          if (receivedA > 0) {
            try {
              await storage.receiveSpareToLocation(
                componentSpareId,
                receivedA,
                'A',
                userId,
                remarks,
                receivedPlace,
                transactionDate // Use selected date for history
              );
              totalChange += receivedA;
            } catch (e: any) {
              errors.push(`Receive A: ${e.message}`);
            }
          }
          
          // Receive to Location B
          if (receivedB > 0) {
            try {
              await storage.receiveSpareToLocation(
                componentSpareId,
                receivedB,
                'B',
                userId,
                remarks,
                receivedPlace,
                transactionDate // Use selected date for history
              );
              totalChange += receivedB;
            } catch (e: any) {
              errors.push(`Receive B: ${e.message}`);
            }
          }
          
          // Get the updated spare to get the new ROB
          const spare = await storage.getSpare(componentSpareId);
          
          if (errors.length > 0) {
            results.push({
              componentSpareId,
              success: false,
              message: errors.join('; '),
              robAfter: spare?.rob
            });
          } else {
            results.push({
              componentSpareId,
              success: true,
              robAfter: spare?.rob
            });
          }
        } catch (error: any) {
          results.push({
            componentSpareId,
            success: false,
            message: error.message || 'Unknown error'
          });
        }
      }
      
      console.log('[BULK UPDATE] Completed successfully:', results.length, 'items processed');
      res.json(results);
    } catch (error: any) {
      console.error("Error in bulk update:", error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to perform bulk update'
      });
    }
  });

  // Get spares for a vessel
  app.get("/technical/api/spares/:vesselId", async (req, res) => {
    try {
      let spares: any[];
      if (req.params.vesselId === 'all') {
        spares = [];
        const allVessels = await storage.getVessels();
        for (const v of allVessels) {
          const vSpares = await storage.getSpares(v.id);
          spares.push(...vSpares);
        }
      } else {
        spares = await storage.getSpares(req.params.vesselId);
      }
      res.json(spares);
    } catch (error: any) {
      console.error("Error fetching spares:", error);
      res.status(500).json({ error: "Failed to fetch spares", details: error.message });
    }
  });
  
  // Get spare by ID (optional - useful for detail views)
  app.get("/technical/api/spares/:vesselId/:id", async (req, res) => {
    try {
      const spare = await storage.getSpare(parseInt(req.params.id));
      if (!spare) {
        return res.status(404).json({ error: "Spare not found" });
      }
      res.json(spare);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spare" });
    }
  });
  
  // Create a new spare
  app.post("/technical/api/spares/:vesselId", async (req, res) => {
    try {
      const spare = await storage.createSpare({
        ...req.body,
        vesselId: req.params.vesselId
      });
      res.status(201).json(spare);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create spare" });
    }
  });
  
  // Update spare
  app.patch("/technical/api/spares/:vesselId/:id", async (req, res) => {
    try {
      console.log('[PATCH Spare] Updating spare', req.params.id, 'with data:', JSON.stringify(req.body));
      const spareId = parseInt(req.params.id);
      const { robLocationA, robLocationB, remarks, place, dateLocal, tz, ...otherUpdates } = req.body;
      const userId = (req as any).user?.id?.toString() || 'System';
      
      // Check if location ROB values are being changed - route to transfer/adjustment method
      if (robLocationA !== undefined || robLocationB !== undefined) {
        // Validate numeric inputs
        if (robLocationA !== undefined && (isNaN(Number(robLocationA)) || Number(robLocationA) < 0)) {
          return res.status(400).json({ error: "robLocationA must be a valid non-negative number" });
        }
        if (robLocationB !== undefined && (isNaN(Number(robLocationB)) || Number(robLocationB) < 0)) {
          return res.status(400).json({ error: "robLocationB must be a valid non-negative number" });
        }
        
        // Get current spare to determine location values
        const currentSpare = await storage.getSpare(spareId);
        if (!currentSpare) {
          return res.status(404).json({ error: "Spare not found" });
        }
        
        const newLocA = robLocationA !== undefined ? Number(robLocationA) : (currentSpare.robLocationA ?? 0);
        const newLocB = robLocationB !== undefined ? Number(robLocationB) : (currentSpare.robLocationB ?? 0);
        
        // Use transfer method which creates ledger history for true transfers or ADJUSTMENT for ROB changes
        const result = await storage.transferSpareLocation(
          spareId,
          newLocA,
          newLocB,
          userId,
          remarks,
          place,
          dateLocal,
          tz
        );
        
        // Also handle other updates if provided
        if (Object.keys(otherUpdates).length > 0) {
          const updatedSpare = await storage.updateSpare(spareId, otherUpdates);
          return res.json(updatedSpare);
        }
        
        return res.json(result.spare);
      }
      
      // Handle non-ROB updates (location names, etc.) through regular update
      const spare = await storage.updateSpare(spareId, otherUpdates);
      console.log('[PATCH Spare] Result - location:', spare.location, 'location2:', spare.location2);
      res.json(spare);
    } catch (error: any) {
      console.error('[PATCH Spare] Error:', error.message);
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update spare" });
    }
  });
  
  // Delete spare
  app.delete("/technical/api/spares/:vesselId/:id", async (req, res) => {
    try {
      await storage.deleteSpare(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete spare" });
    }
  });
  
  // Adjust spare ROB at specific location (for audit-compliant adjustments)
  app.post("/technical/api/spares/:vesselId/:id/adjustment", async (req, res) => {
    try {
      const adjustmentPayloadSchema = z.object({
        newRob: z.number().min(0),
        location: z.enum(['A', 'B']),
        remarks: z.string().optional(),
        place: z.string().optional(),
        dateLocal: z.string().optional(),
        tz: z.string().optional()
      });
      
      const payload = adjustmentPayloadSchema.parse(req.body);
      const userId = (req as any).user?.id?.toString() || 'System';
      const vesselId = req.params.vesselId;
      const spareId = parseInt(req.params.id);
      
      // Security check: Verify spare belongs to the specified vessel
      const existingSpare = await storage.getSpare(spareId);
      if (!existingSpare) {
        return res.status(404).json({ error: `Spare with ID ${spareId} not found` });
      }
      if (existingSpare.vesselId !== vesselId) {
        return res.status(403).json({ error: "Access denied: Spare does not belong to this vessel" });
      }
      
      const spare = await storage.adjustSpareAtLocation(
        spareId,
        payload.newRob,
        payload.location,
        userId,
        payload.remarks,
        payload.place,
        payload.dateLocal,
        payload.tz
      );
      
      res.json(spare);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request payload", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('non-negative')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to adjust spare ROB" });
    }
  });
  
  // Adjust spare quantity (for +/- buttons)
  app.post("/technical/api/spares/:vesselId/:id/adjust", async (req, res) => {
    try {
      const adjustPayloadSchema = z.object({
        qtyChange: z.number(),
        eventType: z.enum(['CONSUME', 'RECEIVE', 'ADJUST']),
        reference: z.string().optional(),
        notes: z.string().optional()
      });
      
      const payload = adjustPayloadSchema.parse(req.body);
      const spare = await storage.adjustSpareQuantity(
        parseInt(req.params.id),
        payload.qtyChange,
        payload.eventType,
        payload.reference,
        payload.notes
      );
      
      res.json(spare);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request payload", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('negative')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to adjust spare quantity" });
    }
  });
  
  // Inventory history endpoints
  // Route format: /api/spares/:vesselId/history (legacy)
  app.get("/technical/api/spares/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log('[API] Fetching spare history for vessel (legacy route):', vesselId);
      const history = await storage.getSpareHistory(vesselId);
      console.log('[API] Found', history.length, 'history entries');
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });
  
  // Get low stock spares (below minimum quantity)
  app.get("/technical/api/spares/:vesselId/low-stock", async (req, res) => {
    try {
      const spares = await storage.getSpares(req.params.vesselId);
      const lowStockSpares = spares.filter(spare => (spare.rob || 0) <= (spare.min || 0));
      res.json(lowStockSpares);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock spares" });
    }
  });
  
  // Low Stock Alert Report - enriched report with consumption rates, priority scoring, severity
  app.get("/technical/api/reports/low-stock-alert/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { criticality, componentCategory, sortBy } = req.query;

      let allSpares: any[];
      if (vesselId === 'all') {
        const allVessels = await storage.getVessels();
        allSpares = [];
        for (const vessel of allVessels) {
          const vesselSpares = await storage.getSpares(vessel.id);
          allSpares = allSpares.concat(vesselSpares);
        }
      } else {
        allSpares = await storage.getSpares(vesselId);
      }
      const activeSparesRaw = allSpares.filter((s: any) => !s.deleted && s.dataScope !== 'fleet');

      let lowStockItems = activeSparesRaw.filter((s: any) => {
        const rob = s.rob || 0;
        const min = s.min || 0;
        return rob <= min;
      });

      if (criticality && criticality !== 'all') {
        lowStockItems = lowStockItems.filter((s: any) => {
          const crit = (s.critical || s.criticality || '').toLowerCase();
          if (criticality === 'critical') return crit === 'critical' || crit === 'yes';
          return crit !== 'critical' && crit !== 'yes';
        });
      }

      if (componentCategory && componentCategory !== 'all') {
        lowStockItems = lowStockItems.filter((s: any) =>
          (s.componentCode || '').startsWith(String(componentCategory)) ||
          (s.componentName || '').toLowerCase().includes(String(componentCategory).toLowerCase())
        );
      }

      const items = lowStockItems.map((s: any) => {
        const rob = s.rob || 0;
        const min = s.min || 0;
        const shortage = Math.max(0, min - rob);
        const crit = (s.critical || s.criticality || '').toLowerCase();
        const isCritical = crit === 'critical' || crit === 'yes';

        let status = 'Low';
        if (rob < min && isCritical) status = 'Critical';
        else if (rob === min) status = 'At Minimum';

        return {
          id: s.id,
          partCode: s.partCode || '-',
          partName: s.partName || '-',
          componentName: s.componentName || '-',
          currentQty: rob,
          minQty: min,
          shortage,
          status,
        };
      });

      const sortField = (sortBy as string) || 'shortage';
      items.sort((a: any, b: any) => {
        switch (sortField) {
          case 'partName': return a.partName.localeCompare(b.partName);
          default: return b.shortage - a.shortage;
        }
      });

      const criticalCount = items.filter((i: any) => i.status === 'Critical').length;
      const atMinCount = items.filter((i: any) => i.status === 'At Minimum').length;

      res.json({
        summary: {
          totalLowStock: items.length,
          criticalCount,
          atMinCount,
        },
        items,
      });
    } catch (error: any) {
      console.error('Low stock alert report error:', error);
      res.status(500).json({ error: "Failed to generate low stock alert report" });
    }
  });

  // Mark spare as ordered (update lastOrderDate)
  app.patch("/technical/api/reports/low-stock-alert/:vesselId/mark-ordered/:spareId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const now = new Date();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dateStr = `${String(now.getDate()).padStart(2,'0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
      const updated = await storage.updateSpare(spareId, { lastOrderDate: dateStr });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to mark spare as ordered" });
    }
  });

  // Low Stock Alert Report - Excel Export
  app.post("/technical/api/reports/low-stock-alert/:vesselId/excel", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { criticality, sortBy } = req.body;

      const allVessels = await storage.getVessels();
      let allSpares: any[];
      if (vesselId === 'all') {
        allSpares = [];
        for (const vessel of allVessels) {
          const vesselSpares = await storage.getSpares(vessel.id);
          allSpares = allSpares.concat(vesselSpares);
        }
      } else {
        allSpares = await storage.getSpares(vesselId);
      }
      const vessel = allVessels.find((v: any) => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

      const activeSparesRaw = allSpares.filter((s: any) => !s.deleted && s.dataScope !== 'fleet');

      let lowStockItems = activeSparesRaw.filter((s: any) => {
        const rob = s.rob || 0;
        const min = s.min || 0;
        return rob <= min;
      });

      if (criticality && criticality !== 'all') {
        lowStockItems = lowStockItems.filter((s: any) => {
          const crit = (s.critical || s.criticality || '').toLowerCase();
          if (criticality === 'critical') return crit === 'critical' || crit === 'yes';
          return crit !== 'critical' && crit !== 'yes';
        });
      }

      const items = lowStockItems.map((s: any) => {
        const rob = s.rob || 0;
        const min = s.min || 0;
        const shortage = Math.max(0, min - rob);
        const crit = (s.critical || s.criticality || '').toLowerCase();
        const isCritical = crit === 'critical' || crit === 'yes';

        let status = 'Low';
        if (rob < min && isCritical) status = 'Critical';
        else if (rob === min) status = 'At Minimum';

        return {
          partCode: s.partCode || '-', partName: s.partName || '-',
          componentName: s.componentName || '-',
          currentQty: rob, minQty: min, shortage, status,
        };
      });

      const sortField = sortBy || 'shortage';
      items.sort((a: any, b: any) => {
        switch (sortField) {
          case 'partName': return a.partName.localeCompare(b.partName);
          default: return b.shortage - a.shortage;
        }
      });

      const criticalCount = items.filter(i => i.status === 'Critical').length;
      const atMinCount = items.filter(i => i.status === 'At Minimum').length;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Low Stock Alerts');

      const columns: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'partCode', header: 'Part Code', width: 18, type: 'string' },
        { key: 'partName', header: 'Part Name', width: 32, type: 'string' },
        { key: 'componentName', header: 'Component', width: 28, type: 'string' },
        { key: 'currentQty', header: 'Current Qty', width: 14, type: 'number', align: 'center' },
        { key: 'minQty', header: 'Min Qty', width: 12, type: 'number', align: 'center' },
        { key: 'shortage', header: 'Shortage', width: 12, type: 'number', align: 'center' },
        { key: 'status', header: 'Status', width: 16, type: 'string', align: 'center' },
      ];

      const totalColumns = columns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);

      const subtitle = `Total Low Stock: ${items.length} | Critical: ${criticalCount} | At Minimum: ${atMinCount}`;
      applyStandardHeader(worksheet, 'LOW STOCK ALERT REPORT', subtitle, vesselName, items.length, lastColLetter);

      const headerRowNum = 7;
      applyStandardTableHeader(worksheet, columns, headerRowNum);

      const statusBgColors: Record<string, string> = {
        'Critical': 'FFFFF1F0',
        'At Minimum': 'FFFFFBE6',
        'Low': 'FFFFFFFF',
      };
      const statusFontColors: Record<string, string> = {
        'Critical': 'FFF5222D',
        'At Minimum': 'FFFAAD14',
        'Low': 'FF5A6C7D',
      };

      items.forEach((item, idx) => {
        const rowData: (string | number)[] = [
          idx + 1,
          item.partCode, item.partName, item.componentName,
          item.currentQty, item.minQty, item.shortage, item.status,
        ];
        const row = worksheet.addRow(rowData);
        row.height = 20;

        const bgColor = statusBgColors[item.status] || 'FFFFFFFF';

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colDef = columns[colNumber - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? bgColor : COLORS.bgLight } };
          cell.border = {
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };

          if (colNumber === 8) {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: statusFontColors[item.status] || COLORS.textDark } };
          }
        });
      });

      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };

      applyStandardPageSetup(worksheet, headerRowNum, totalColumns, 6, vesselName);

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('LowStockAlerts', vesselName);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating Low Stock Alert Excel:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  app.post("/technical/api/reports/stores-inventory-status/:vesselId/excel", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { tab, categoryFilter, statusFilter } = req.body;

      const allVessels = await storage.getVessels();
      let allItems: any[];
      if (vesselId === 'all') {
        allItems = [];
        for (const vessel of allVessels) {
          allItems = allItems.concat(await storage.getStoresItems(vessel.id));
        }
      } else {
        allItems = await storage.getStoresItems(vesselId);
      }
      const vessel = allVessels.find((v: any) => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

      let items = allItems.filter((item: any) => item.deleted !== true && item.isActive !== false);

      if (categoryFilter && categoryFilter !== 'all') {
        if (categoryFilter === 'lubricants' || categoryFilter === 'lubes') {
          items = items.filter((i: any) => i.itemType === 'lubes' || i.itemType === 'lubricants');
        } else if (categoryFilter === 'others') {
          items = items.filter((i: any) => !['stores', 'lubes', 'lubricants', 'chemicals'].includes(i.itemType));
        } else {
          items = items.filter((i: any) => i.itemType === categoryFilter);
        }
      }

      if (statusFilter && statusFilter !== 'all') {
        items = items.filter((i: any) => {
          const rob = parseFloat(String(i.rob)) || 0;
          const min = parseFloat(String(i.min)) || 0;
          if (rob === 0) return statusFilter === 'Critical';
          if (rob <= min) return statusFilter === 'Low';
          return statusFilter === 'OK';
        });
      }

      const categoryDisplayMap: Record<string, string> = {
        stores: 'Stores', lubes: 'Lubricants', lubricants: 'Lubricants',
        chemicals: 'Chemicals', others: 'Others',
      };

      const getLocation = (item: any): string => {
        const a = item.locationA || '';
        const b = item.locationB || '';
        if (a && b) return `${a} / ${b}`;
        return a || b || '-';
      };

      let ledger: any[];
      if (vesselId === 'all') {
        ledger = [];
        for (const v of allVessels) {
          ledger = ledger.concat(await storage.getStoresTransactionHistory(v.id));
        }
      } else {
        ledger = await storage.getStoresTransactionHistory(vesselId);
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const consumptionMap: Record<number, { total30: number; first15: number; last15: number }> = {};
      (ledger || []).forEach((entry: any) => {
        if (entry.eventType !== 'CONSUME') return;
        const entryDate = entry.timestampUTC ? new Date(entry.timestampUTC) : (entry.dateLocal ? new Date(entry.dateLocal) : null);
        if (!entryDate || entryDate < thirtyDaysAgo) return;
        const itemId = entry.itemId;
        if (!consumptionMap[itemId]) consumptionMap[itemId] = { total30: 0, first15: 0, last15: 0 };
        const qty = Math.abs(parseFloat(String(entry.qtyChangeBase)) || 0);
        consumptionMap[itemId].total30 += qty;
        if (entryDate >= fifteenDaysAgo) {
          consumptionMap[itemId].last15 += qty;
        } else {
          consumptionMap[itemId].first15 += qty;
        }
      });

      const getTrend = (itemId: number): string => {
        const data = consumptionMap[itemId];
        if (!data || (data.first15 === 0 && data.last15 === 0)) return 'Stable';
        if (data.last15 > data.first15 * 1.1) return 'Increasing';
        if (data.first15 > data.last15 * 1.1) return 'Decreasing';
        return 'Stable';
      };

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();

      let columns: ColumnDef[];
      let rowsData: any[][];
      let sheetName: string;
      let reportTitle: string;
      let subtitle: string;
      let statusBgColors: Record<string, string> = {};
      let statusFontColors: Record<string, string> = {};
      let statusColIndex = -1;

      if (tab === 'consumption') {
        sheetName = 'Consumption Trends';
        reportTitle = 'STORES INVENTORY STATUS - CONSUMPTION TRENDS';
        columns = [
          { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
          { key: 'itemCode', header: 'Item Code', width: 18 },
          { key: 'itemName', header: 'Item Name', width: 35 },
          { key: 'category', header: 'Category', width: 18 },
          { key: 'rob', header: 'Current ROB', width: 14, type: 'number', align: 'right' },
          { key: 'consumption30', header: '30 Day Consumption', width: 18, type: 'number', align: 'right' },
          { key: 'avgMonthly', header: 'Avg Monthly', width: 16, type: 'number', align: 'right' },
          { key: 'trend', header: 'Trend', width: 14, align: 'center' },
        ];

        rowsData = items.map((item: any, idx: number) => {
          const rob = parseFloat(String(item.rob)) || 0;
          const consumption = consumptionMap[item.id]?.total30 || 0;
          const trend = getTrend(item.id);
          return [idx + 1, item.itemCode || '-', item.itemName || '-', categoryDisplayMap[item.itemType] || item.itemType || '-', rob, parseFloat(consumption.toFixed(2)), parseFloat(consumption.toFixed(2)), trend];
        });

        subtitle = `Total Items: ${items.length}`;
      } else if (tab === 'reorder') {
        sheetName = 'Reorder Requirements';
        reportTitle = 'STORES INVENTORY STATUS - REORDER REQUIREMENTS';
        columns = [
          { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
          { key: 'itemCode', header: 'Item Code', width: 18 },
          { key: 'itemName', header: 'Item Name', width: 35 },
          { key: 'category', header: 'Category', width: 18 },
          { key: 'rob', header: 'Current ROB', width: 14, type: 'number', align: 'right' },
          { key: 'avgMonthly', header: 'Avg Monthly', width: 16, type: 'number', align: 'right' },
          { key: 'daysToStockout', header: 'Days to Stockout', width: 18, type: 'number', align: 'right' },
          { key: 'priority', header: 'Priority', width: 14, align: 'center' },
          { key: 'suggestedQty', header: 'Suggested Qty', width: 16, type: 'number', align: 'right' },
        ];

        const reorderItems = items
          .map((item: any) => {
            const rob = parseFloat(String(item.rob)) || 0;
            const min = parseFloat(String(item.min)) || 0;
            const monthlyConsumption = consumptionMap[item.id]?.total30 || 0;
            const dailyConsumption = monthlyConsumption / 30;
            const daysUntilStockout = dailyConsumption > 0 ? rob / dailyConsumption : Infinity;
            const suggestedQty = Math.max(0, (min * 2) - rob);
            let priority: string;
            if (daysUntilStockout < 7) priority = 'Critical';
            else if (daysUntilStockout < 14) priority = 'High';
            else if (daysUntilStockout < 30) priority = 'Medium';
            else priority = 'Low';
            return { ...item, rob, min, monthlyConsumption, daysUntilStockout, priority, suggestedQty };
          })
          .filter((item: any) => (item.rob - item.monthlyConsumption) <= item.min);

        rowsData = reorderItems.map((item: any, idx: number) => {
          const daysStr = !isFinite(item.daysUntilStockout) || item.daysUntilStockout > 365 ? '>365' : Math.round(item.daysUntilStockout);
          return [idx + 1, item.itemCode || '-', item.itemName || '-', categoryDisplayMap[item.itemType] || item.itemType || '-', item.rob, parseFloat(item.monthlyConsumption.toFixed(2)), daysStr, item.priority, parseFloat(item.suggestedQty.toFixed(1))];
        });

        statusColIndex = 8;
        statusBgColors = { 'Critical': 'FFFFF1F0', 'High': 'FFFFFBE6', 'Medium': 'FFFFFFFF', 'Low': 'FFFFFFFF' };
        statusFontColors = { 'Critical': 'FFF5222D', 'High': 'FFFAAD14', 'Medium': 'FF5A6C7D', 'Low': 'FF5A6C7D' };

        subtitle = `Reorder Items: ${reorderItems.length}`;
      } else {
        sheetName = 'Stock Status';
        reportTitle = 'STORES INVENTORY STATUS - STOCK STATUS';
        columns = [
          { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
          { key: 'itemCode', header: 'Item Code', width: 18 },
          { key: 'itemName', header: 'Item Name', width: 35 },
          { key: 'category', header: 'Category', width: 18 },
          { key: 'rob', header: 'Current ROB', width: 14, type: 'number', align: 'right' },
          { key: 'min', header: 'Min Stock', width: 14, type: 'number', align: 'right' },
          { key: 'status', header: 'Status', width: 14, align: 'center' },
          { key: 'locationA', header: 'Location A', width: 18 },
          { key: 'locationB', header: 'Location B', width: 18 },
          { key: 'uom', header: 'UOM', width: 12 },
        ];

        statusColIndex = 7;
        statusBgColors = { 'Critical': 'FFFFF1F0', 'Low': 'FFFFFBE6', 'OK': 'FFFFFFFF' };
        statusFontColors = { 'Critical': 'FFF5222D', 'Low': 'FFFAAD14', 'OK': 'FF5A6C7D' };

        rowsData = items.map((item: any, idx: number) => {
          const rob = parseFloat(String(item.rob)) || 0;
          const min = parseFloat(String(item.min)) || 0;
          let status: string;
          if (rob === 0) status = 'Critical';
          else if (rob <= min) status = 'Low';
          else status = 'OK';
          return [idx + 1, item.itemCode || '-', item.itemName || '-', categoryDisplayMap[item.itemType] || item.itemType || '-', rob, min, status, item.locationA || '-', item.locationB || '-', item.uom || '-'];
        });

        const critCount = rowsData.filter(r => r[6] === 'Critical').length;
        const lowCount = rowsData.filter(r => r[6] === 'Low').length;
        subtitle = `Total Items: ${rowsData.length} | Critical: ${critCount} | Low: ${lowCount}`;
      }

      const worksheet = workbook.addWorksheet(sheetName);
      const totalColumns = columns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);

      applyStandardHeader(worksheet, reportTitle, subtitle, vesselName, rowsData.length, lastColLetter);

      const headerRowNum = 7;
      applyStandardTableHeader(worksheet, columns, headerRowNum);

      rowsData.forEach((rowData, idx) => {
        const row = worksheet.addRow(rowData);
        row.height = 20;

        const statusVal = statusColIndex > 0 ? String(rowData[statusColIndex - 1]) : '';
        const bgColor = statusBgColors[statusVal] || 'FFFFFFFF';

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colDef = columns[colNumber - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? bgColor : COLORS.bgLight } };
          cell.border = {
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };

          if (colNumber === statusColIndex) {
            const fontColor = statusFontColors[statusVal];
            if (fontColor) {
              cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: fontColor } };
            }
          }
        });
      });

      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };

      applyStandardPageSetup(worksheet, headerRowNum, totalColumns, 6, vesselName);

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('StoresInventoryStatus', vesselName);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating Stores Inventory Status Excel:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ========== STORES CONSUMPTION PATTERN ANALYSIS REPORT (stores_ledger based) ==========
  app.get("/technical/api/reports/stores-consumption-analysis/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate, itemType, category } = req.query;

      const allVessels = await storage.getVessels();
      let allHistory: any[];
      let allItems: any[];
      if (vesselId === 'all') {
        allHistory = []; allItems = [];
        for (const vessel of allVessels) {
          allHistory = allHistory.concat(await storage.getStoresTransactionHistory(vessel.id));
          allItems = allItems.concat(await storage.getStoresItems(vessel.id));
        }
      } else {
        allHistory = await storage.getStoresTransactionHistory(vesselId);
        allItems = await storage.getStoresItems(vesselId);
      }
      const vessel = allVessels.find((v: any) => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
      const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

      let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
      let allLedgerEvents = allHistory;

      if (startDate) {
        const sd = new Date(startDate as string);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
        allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
      }
      if (endDate) {
        const ed = new Date(endDate as string);
        ed.setHours(23, 59, 59, 999);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
        allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
      }
      if (itemType && itemType !== 'all') {
        consumeEvents = consumeEvents.filter((h: any) => h.section === itemType);
        allLedgerEvents = allLedgerEvents.filter((h: any) => h.section === itemType);
      }
      if (category && category !== 'all') {
        const catItemIds = new Set(allItems.filter((i: any) => i.category === category).map((i: any) => i.id));
        consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.itemId));
        allLedgerEvents = allLedgerEvents.filter((h: any) => catItemIds.has(h.itemId));
      }

      const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
      const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
      const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
      const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

      let confidenceLevel: 'low' | 'medium' | 'high' = 'low';
      if (daysOfData > 90) confidenceLevel = 'high';
      else if (daysOfData >= 30) confidenceLevel = 'medium';

      const monthlyMap: Record<string, { totalQty: number; eventCount: number; itemIds: Set<number>; byType: Record<string, number> }> = {};
      for (const h of consumeEvents) {
        const d = new Date(h.timestampUTC);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { totalQty: 0, eventCount: 0, itemIds: new Set(), byType: {} };
        }
        const qty = Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
        monthlyMap[monthKey].totalQty += qty;
        monthlyMap[monthKey].eventCount += 1;
        monthlyMap[monthKey].itemIds.add(h.itemId);
        const section = h.section || 'stores';
        monthlyMap[monthKey].byType[section] = (monthlyMap[monthKey].byType[section] || 0) + qty;
      }

      const consumptionTrends = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          totalQty: Math.round(data.totalQty * 100) / 100,
          eventCount: data.eventCount,
          itemCount: data.itemIds.size,
          byType: {
            stores: Math.round((data.byType['stores'] || 0) * 100) / 100,
            lubricants: Math.round((data.byType['lubricants'] || data.byType['lubes'] || 0) * 100) / 100,
            chemicals: Math.round((data.byType['chemicals'] || 0) * 100) / 100,
            others: Math.round((data.byType['others'] || 0) * 100) / 100,
          }
        }));

      const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date; robSnapshots: number[] }> = {};
      for (const h of consumeEvents) {
        const key = h.itemId;
        if (!itemGrouped[key]) {
          itemGrouped[key] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC), robSnapshots: [] };
        }
        const qty = Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
        itemGrouped[key].totalConsumed += qty;
        itemGrouped[key].events += 1;
        const robAfter = parseFloat(String(h.robAfterBase)) || 0;
        itemGrouped[key].robSnapshots.push(robAfter);
        const ts = new Date(h.timestampUTC);
        if (ts > itemGrouped[key].lastConsumed) {
          itemGrouped[key].lastConsumed = ts;
        }
      }

      const topConsumedItems = Object.entries(itemGrouped)
        .map(([itemIdStr, g]) => {
          const itemId = Number(itemIdStr);
          const item = itemsMap.get(itemId);
          const currentRob = parseFloat(String(item?.rob)) || 0;
          const minStock = parseFloat(String(item?.min)) || 0;
          const rawMonthlyRate = daysOfData > 0 ? (g.totalConsumed / daysOfData) * 30 : 0;
          let confidenceMultiplier = 1.0;
          if (daysOfData < 7) confidenceMultiplier = 0.5;
          else if (daysOfData < 30) confidenceMultiplier = 0.75;
          const avgMonthlyConsumption = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
          return {
            itemId,
            itemCode: item?.itemCode || '',
            itemName: item?.itemName || '',
            itemType: item?.itemType || '',
            category: item?.category || '',
            uom: item?.uom || '',
            totalConsumed: Math.round(g.totalConsumed * 100) / 100,
            eventCount: g.events,
            avgMonthlyConsumption,
            rawAvgMonthlyConsumption: Math.round(rawMonthlyRate * 100) / 100,
            confidenceMultiplier,
            adjustmentNote: daysOfData < 7 
              ? `Adjusted estimate (×${confidenceMultiplier}) based on limited ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
              : daysOfData < 30
                ? `Adjusted estimate (×${confidenceMultiplier}) based on ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
                : null,
            currentRob,
            minStock,
            lastConsumedDate: g.lastConsumed.toISOString(),
            hasSingleEvent: g.events === 1,
          };
        })
        .sort((a, b) => b.totalConsumed - a.totalConsumed);

      const categoryMap: Record<string, { totalQty: number; itemCount: Set<number>; itemType: string }> = {};
      for (const h of consumeEvents) {
        const item = itemsMap.get(h.itemId);
        const cat = item?.category || item?.itemType || 'Uncategorized';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { totalQty: 0, itemCount: new Set(), itemType: item?.itemType || '' };
        }
        categoryMap[cat].totalQty += Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
        categoryMap[cat].itemCount.add(h.itemId);
      }

      const totalConsumptionQty = Object.values(categoryMap).reduce((sum, c) => sum + c.totalQty, 0);
      const categoryBreakdown = Object.entries(categoryMap)
        .map(([cat, data]) => ({
          category: cat,
          itemType: data.itemType,
          totalQty: Math.round(data.totalQty * 100) / 100,
          itemCount: data.itemCount.size,
          percentage: totalConsumptionQty > 0 ? Math.round((data.totalQty / totalConsumptionQty) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.totalQty - a.totalQty);

      const stockEfficiency = allItems
        .filter((item: any) => !item.deleted && item.isActive !== false)
        .map((item: any) => {
          const itemId = item.id;
          const consumed = itemGrouped[itemId];
          const totalConsumed = consumed?.totalConsumed || 0;
          const currentRob = parseFloat(String(item.rob)) || 0;
          const minStock = parseFloat(String(item.min)) || 0;
          const robSnapshots = consumed?.robSnapshots || [];
          const avgRob = robSnapshots.length > 0
            ? robSnapshots.reduce((s: number, v: number) => s + v, 0) / robSnapshots.length
            : currentRob;
          const stockTurnoverRatio = avgRob > 0 ? Math.round((totalConsumed / avgRob) * 100) / 100 : 0;

          const eventCount = consumed?.events || 0;
          const consumptionFrequency = daysOfData > 0 ? eventCount / daysOfData : 0;
          const stockHealthRatio = minStock > 0 ? currentRob / minStock : null;

          let movementSpeed: 'fast' | 'slow' | 'very-slow' | 'non-moving' = 'non-moving';
          let movementNote = '';
          if (totalConsumed === 0) {
            movementSpeed = 'non-moving';
            movementNote = currentRob > 0 ? 'No consumption recorded - consider stock reduction' : '';
          } else {
            const fastThreshold = daysOfData < 30 ? 0.5 : 2.0;
            const slowThreshold = daysOfData < 30 ? 0.05 : 0.5;
            if (stockTurnoverRatio >= fastThreshold || consumptionFrequency >= 0.5) {
              movementSpeed = 'fast';
              movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
            } else if (stockTurnoverRatio >= slowThreshold || consumptionFrequency >= 0.1) {
              movementSpeed = 'slow';
              movementNote = 'Monitor stock levels';
            } else {
              movementSpeed = 'very-slow';
              movementNote = 'Consider stock reduction';
            }
          }

          const avgDailyConsumption = daysOfData > 0 ? totalConsumed / daysOfData : 0;
          const baseStockoutDays = avgDailyConsumption > 0 ? currentRob / avgDailyConsumption : null;
          let daysUntilStockout = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
          let stockoutRange: { lower: number; upper: number } | null = null;
          let stockoutConfidence: 'low' | 'medium' | 'high' = 'high';
          if (baseStockoutDays !== null && baseStockoutDays > 0) {
            if (daysOfData < 7) {
              stockoutRange = { lower: Math.floor(baseStockoutDays * 0.5), upper: Math.ceil(baseStockoutDays * 2.0) };
              stockoutConfidence = 'low';
            } else if (daysOfData < 30) {
              stockoutRange = { lower: Math.floor(baseStockoutDays * 0.75), upper: Math.ceil(baseStockoutDays * 1.5) };
              stockoutConfidence = 'medium';
            }
          }
          const belowMinStock = currentRob < minStock;
          const negativeRob = currentRob < 0;

          return {
            itemId,
            itemCode: item.itemCode || '',
            itemName: item.itemName || '',
            itemType: item.itemType || '',
            uom: item.uom || '',
            currentRob,
            minStock,
            avgRob: Math.round(avgRob * 100) / 100,
            totalConsumed: Math.round(totalConsumed * 100) / 100,
            stockTurnoverRatio,
            movementSpeed,
            movementNote,
            consumptionFrequency: Math.round(consumptionFrequency * 1000) / 1000,
            stockHealthRatio: stockHealthRatio !== null ? Math.round(stockHealthRatio * 100) / 100 : null,
            daysUntilStockout,
            stockoutRange,
            stockoutConfidence,
            belowMinStock,
            negativeRob,
            eventCount,
          };
        })
        .sort((a: any, b: any) => b.stockTurnoverRatio - a.stockTurnoverRatio);

      const forecastData = topConsumedItems.map(item => {
        const avgDaily = daysOfData > 0 ? item.totalConsumed / daysOfData : 0;
        let forecastConfidenceMultiplier = 1.0;
        if (daysOfData < 7) forecastConfidenceMultiplier = 0.5;
        else if (daysOfData < 30) forecastConfidenceMultiplier = 0.75;
        const adjustedDaily = avgDaily * forecastConfidenceMultiplier;
        const projectedMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
        const monthsRemaining = adjustedDaily > 0 ? Math.round((item.currentRob / adjustedDaily / 30) * 10) / 10 : null;

        const leadTimeDays = 30;
        const safetyStock = projectedMonthly;
        const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
        const targetLevel = Math.max(item.minStock * 3, projectedMonthly * 6);
        const reorderNeeded = item.currentRob <= reorderPoint && projectedMonthly > 0;
        const suggestedReorderQty = reorderNeeded ? Math.max(0, Math.ceil(targetLevel - item.currentRob)) : 0;
        const reorderReasoning = reorderNeeded
          ? `Bring stock from ${item.currentRob} to ${Math.round(targetLevel)} (${projectedMonthly > 0 ? Math.round(targetLevel / projectedMonthly * 10) / 10 : '∞'} months supply at ${projectedMonthly}/month)`
          : item.currentRob > reorderPoint ? 'Stock adequate - above reorder point' : 'No consumption recorded';

        return {
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemType: item.itemType,
          uom: item.uom,
          avgMonthlyConsumption: item.avgMonthlyConsumption,
          rawAvgMonthlyConsumption: item.rawAvgMonthlyConsumption,
          projectedNextMonth: projectedMonthly,
          currentRob: item.currentRob,
          minStock: item.minStock,
          monthsOfStockRemaining: monthsRemaining,
          reorderNeeded,
          suggestedReorderQty,
          reorderPoint,
          targetLevel: Math.round(targetLevel),
          safetyStock: Math.round(safetyStock * 100) / 100,
          leadTimeDays,
          reorderReasoning,
          confidenceLevel,
        };
      });

      const nonMovingItems = stockEfficiency
        .filter((i: any) => i.movementSpeed === 'non-moving' && i.currentRob > 0)
        .slice(0, 50);

      const recentTransactions = [...consumeEvents]
        .sort((a: any, b: any) => {
          const dateA = new Date(a.timestampUTC || a.dateLocal || 0).getTime();
          const dateB = new Date(b.timestampUTC || b.dateLocal || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 100)
        .map((h: any) => ({
          id: h.id,
          date: h.timestampUTC || h.dateLocal,
          itemId: h.itemId,
          itemCode: h.partCode,
          itemName: h.itemName,
          section: h.section,
          qtyConsumed: Math.abs(parseFloat(String(h.qtyChangeBase)) || 0),
          robAfter: parseFloat(String(h.robAfterBase)) || 0,
          uom: h.uom || '',
          userId: h.userId || '',
          remarks: h.remarks || '',
        }));

      const uniqueItemsConsumed = new Set(consumeEvents.map((h: any) => h.itemId)).size;

      res.json({
        summary: {
          totalItemsConsumed: uniqueItemsConsumed,
          totalQuantityConsumed: Math.round(consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(parseFloat(String(h.qtyChangeBase)) || 0), 0) * 100) / 100,
          totalConsumptionEvents: consumeEvents.length,
          dateRange: { start: earliestDate.toISOString(), end: latestDate.toISOString() },
          dataQuality: {
            daysOfData,
            isLimitedData: daysOfData < 30,
            confidenceLevel,
            message: daysOfData < 30
              ? `Analysis based on ${daysOfData} days of consumption data. More accurate trends will develop over time.`
              : daysOfData < 90
                ? `Analysis based on ${daysOfData} days of data. Moderate confidence in trend projections.`
                : `Analysis based on ${daysOfData} days of data. High confidence in trend projections.`,
          },
          totalInventoryItems: allItems.filter((i: any) => !i.deleted && i.isActive !== false).length,
          dataMonths: Math.max(0.1, Math.round((daysOfData / 30) * 10) / 10),
          vesselName,
        },
        consumptionTrends,
        topConsumedItems,
        categoryBreakdown,
        stockEfficiency,
        forecastData,
        nonMovingItems,
        recentTransactions,
      });
    } catch (error: any) {
      console.error("Error generating Stores Consumption Pattern Analysis:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  app.post("/technical/api/reports/stores-consumption-analysis/:vesselId/excel", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate, itemType, category } = req.body;

      const allVessels = await storage.getVessels();
      let allHistory: any[];
      let allItems: any[];
      if (vesselId === 'all') {
        allHistory = []; allItems = [];
        for (const vessel of allVessels) {
          allHistory = allHistory.concat(await storage.getStoresTransactionHistory(vessel.id));
          allItems = allItems.concat(await storage.getStoresItems(vessel.id));
        }
      } else {
        allHistory = await storage.getStoresTransactionHistory(vesselId);
        allItems = await storage.getStoresItems(vesselId);
      }
      const vessel = allVessels.find((v: any) => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
      const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

      let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
      if (startDate) {
        const sd = new Date(startDate);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
      }
      if (endDate) {
        const ed = new Date(endDate);
        ed.setHours(23, 59, 59, 999);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
      }
      if (itemType && itemType !== 'all') {
        consumeEvents = consumeEvents.filter((h: any) => h.section === itemType);
      }
      if (category && category !== 'all') {
        const catItemIds = new Set(allItems.filter((i: any) => i.category === category).map((i: any) => i.id));
        consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.itemId));
      }

      const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
      const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
      const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
      const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();

      const datePeriod = `${earliestDate.toISOString().slice(0, 10)} to ${latestDate.toISOString().slice(0, 10)}`;

      // Sheet 1: Summary
      const summarySheet = workbook.addWorksheet('Summary');
      const uniqueItems = new Set(consumeEvents.map((h: any) => h.itemId)).size;
      const totalQty = consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(parseFloat(String(h.qtyChangeBase)) || 0), 0);
      const summaryLastCol = getLastColumnLetter(4);
      applyStandardHeader(summarySheet, 'STORES CONSUMPTION PATTERN ANALYSIS - SUMMARY', `Data Period: ${datePeriod} (${daysOfData} days)`, vesselName, uniqueItems, summaryLastCol, datePeriod);

      const summaryData = [
        ['Metric', 'Value'],
        ['Data Period', datePeriod],
        ['Days of Data', daysOfData],
        ['Unique Items Consumed', uniqueItems],
        ['Total Quantity Consumed', Math.round(totalQty * 100) / 100],
        ['Total Consumption Events', consumeEvents.length],
        ['Total Inventory Items', allItems.filter((i: any) => !i.deleted && i.isActive !== false).length],
        ['Confidence Level', daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low'],
      ];
      summaryData.forEach((row, idx) => {
        const r = summarySheet.addRow(row);
        r.height = 22;
        r.eachCell((cell) => {
          cell.font = { name: 'Calibri', size: idx === 0 ? 11 : 10, bold: idx === 0, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx === 0 ? COLORS.primary : idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          if (idx === 0) cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
        });
      });
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 30;

      // Sheet 2: Monthly Trends
      const trendsSheet = workbook.addWorksheet('Monthly Trends');
      const monthlyMap: Record<string, { totalQty: number; eventCount: number; stores: number; lubricants: number; chemicals: number; others: number }> = {};
      for (const h of consumeEvents) {
        const d = new Date(h.timestampUTC);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[mk]) monthlyMap[mk] = { totalQty: 0, eventCount: 0, stores: 0, lubricants: 0, chemicals: 0, others: 0 };
        const qty = Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
        monthlyMap[mk].totalQty += qty;
        monthlyMap[mk].eventCount += 1;
        const sec = h.section || 'stores';
        if (sec === 'stores') monthlyMap[mk].stores += qty;
        else if (sec === 'lubricants' || sec === 'lubes') monthlyMap[mk].lubricants += qty;
        else if (sec === 'chemicals') monthlyMap[mk].chemicals += qty;
        else monthlyMap[mk].others += qty;
      }
      const trendsCols: ColumnDef[] = [
        { key: 'month', header: 'Month', width: 14, type: 'string' },
        { key: 'totalQty', header: 'Total Qty', width: 14, type: 'number', align: 'center' },
        { key: 'events', header: 'Events', width: 12, type: 'number', align: 'center' },
        { key: 'stores', header: 'Stores', width: 14, type: 'number', align: 'center' },
        { key: 'lubricants', header: 'Lubricants', width: 14, type: 'number', align: 'center' },
        { key: 'chemicals', header: 'Chemicals', width: 14, type: 'number', align: 'center' },
        { key: 'others', header: 'Others', width: 14, type: 'number', align: 'center' },
      ];
      const trendsLastCol = getLastColumnLetter(trendsCols.length);
      applyStandardHeader(trendsSheet, 'MONTHLY CONSUMPTION TRENDS', `Data Period: ${datePeriod}`, vesselName, Object.keys(monthlyMap).length, trendsLastCol, datePeriod);
      applyStandardTableHeader(trendsSheet, trendsCols, 7);

      Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([month, data], idx) => {
        const row = trendsSheet.addRow([month, Math.round(data.totalQty * 100) / 100, data.eventCount, Math.round(data.stores * 100) / 100, Math.round(data.lubricants * 100) / 100, Math.round(data.chemicals * 100) / 100, Math.round(data.others * 100) / 100]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = trendsCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
        });
      });
      applyStandardPageSetup(trendsSheet, 7, trendsCols.length, 6, vesselName);

      // Sheet 3: Item Analysis
      const itemSheet = workbook.addWorksheet('Item Analysis');
      const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date }> = {};
      for (const h of consumeEvents) {
        if (!itemGrouped[h.itemId]) itemGrouped[h.itemId] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC) };
        itemGrouped[h.itemId].totalConsumed += Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
        itemGrouped[h.itemId].events += 1;
        const ts = new Date(h.timestampUTC);
        if (ts > itemGrouped[h.itemId].lastConsumed) itemGrouped[h.itemId].lastConsumed = ts;
      }
      const itemRows = Object.entries(itemGrouped).map(([id, g]) => {
        const item = itemsMap.get(Number(id));
        const rawMonthlyRate = Math.round((g.totalConsumed / daysOfData) * 30 * 100) / 100;
        let confidenceMultiplier = 1.0;
        if (daysOfData < 7) confidenceMultiplier = 0.5;
        else if (daysOfData < 30) confidenceMultiplier = 0.75;
        const adjustedMonthly = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
        return {
          itemCode: item?.itemCode || '', itemName: item?.itemName || '', itemType: item?.itemType || '',
          category: item?.category || '', uom: item?.uom || '',
          totalConsumed: Math.round(g.totalConsumed * 100) / 100, events: g.events,
          avgMonthly: adjustedMonthly,
          rawRate: rawMonthlyRate !== adjustedMonthly ? rawMonthlyRate : null,
          currentRob: parseFloat(String(item?.rob)) || 0, minStock: parseFloat(String(item?.min)) || 0,
          lastConsumed: g.lastConsumed.toISOString().slice(0, 10),
        };
      }).sort((a, b) => b.totalConsumed - a.totalConsumed);

      const itemCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'itemCode', header: 'Item Code', width: 16, type: 'string' },
        { key: 'itemName', header: 'Item Name', width: 32, type: 'string' },
        { key: 'itemType', header: 'Type', width: 14, type: 'string' },
        { key: 'category', header: 'Category', width: 18, type: 'string' },
        { key: 'uom', header: 'UOM', width: 10, type: 'string', align: 'center' },
        { key: 'totalConsumed', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
        { key: 'events', header: 'Events', width: 10, type: 'number', align: 'center' },
        { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
        { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'string', align: 'center' },
        { key: 'currentRob', header: 'Current ROB', width: 14, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min Stock', width: 12, type: 'number', align: 'center' },
        { key: 'lastConsumed', header: 'Last Consumed', width: 14, type: 'string', align: 'center' },
      ];
      const itemLastCol = getLastColumnLetter(itemCols.length);
      applyStandardHeader(itemSheet, 'ITEM-WISE CONSUMPTION ANALYSIS', `Data Period: ${datePeriod} | ${itemRows.length} items consumed`, vesselName, itemRows.length, itemLastCol, datePeriod);
      applyStandardTableHeader(itemSheet, itemCols, 7);

      itemRows.forEach((item, idx) => {
        const row = itemSheet.addRow([idx + 1, item.itemCode, item.itemName, item.itemType, item.category, item.uom, item.totalConsumed, item.events, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.currentRob, item.minStock, item.lastConsumed]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = itemCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
        });
      });
      applyStandardPageSetup(itemSheet, 7, itemCols.length, 6, vesselName);

      // Sheet 4: Category Breakdown
      const catSheet = workbook.addWorksheet('Category Breakdown');
      const catMap: Record<string, { totalQty: number; items: Set<number>; itemType: string }> = {};
      for (const h of consumeEvents) {
        const item = itemsMap.get(h.itemId);
        const cat = item?.category || item?.itemType || 'Uncategorized';
        if (!catMap[cat]) catMap[cat] = { totalQty: 0, items: new Set(), itemType: item?.itemType || '' };
        catMap[cat].totalQty += Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
        catMap[cat].items.add(h.itemId);
      }
      const catTotal = Object.values(catMap).reduce((s, c) => s + c.totalQty, 0);
      const catRows = Object.entries(catMap).map(([cat, data]) => ({
        category: cat, itemType: data.itemType, totalQty: Math.round(data.totalQty * 100) / 100,
        itemCount: data.items.size, percentage: catTotal > 0 ? Math.round((data.totalQty / catTotal) * 10000) / 100 : 0,
      })).sort((a, b) => b.totalQty - a.totalQty);

      const catCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'category', header: 'Category', width: 28, type: 'string' },
        { key: 'itemType', header: 'Item Type', width: 16, type: 'string' },
        { key: 'totalQty', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
        { key: 'itemCount', header: 'Items', width: 10, type: 'number', align: 'center' },
        { key: 'percentage', header: '% Share', width: 12, type: 'number', align: 'center' },
      ];
      const catLastCol = getLastColumnLetter(catCols.length);
      applyStandardHeader(catSheet, 'CATEGORY-WISE CONSUMPTION BREAKDOWN', `Data Period: ${datePeriod}`, vesselName, catRows.length, catLastCol, datePeriod);
      applyStandardTableHeader(catSheet, catCols, 7);

      catRows.forEach((item, idx) => {
        const row = catSheet.addRow([idx + 1, item.category, item.itemType, item.totalQty, item.itemCount, item.percentage]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = catCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
        });
      });
      applyStandardPageSetup(catSheet, 7, catCols.length, 6, vesselName);

      // Sheet 5: Stock Efficiency
      const effSheet = workbook.addWorksheet('Stock Efficiency');
      const effItems = allItems.filter((i: any) => !i.deleted && i.isActive !== false).map((item: any) => {
        const consumed = itemGrouped[item.id];
        const totalConsumed = consumed?.totalConsumed || 0;
        const currentRob = parseFloat(String(item.rob)) || 0;
        const minStock = parseFloat(String(item.min)) || 0;
        const avgDaily = daysOfData > 0 ? totalConsumed / daysOfData : 0;
        const events = consumed?.events || 0;
        const consumptionFrequency = daysOfData > 0 ? events / daysOfData : 0;
        const turnover = currentRob > 0 ? Math.round((totalConsumed / currentRob) * 100) / 100 : 0;
        let speed = 'Non-Moving';
        let movementNote = '';
        if (totalConsumed === 0) {
          speed = 'Non-Moving';
          movementNote = currentRob > 0 ? 'No consumption - consider reduction' : '';
        } else {
          const fastThreshold = daysOfData < 30 ? 0.5 : 2.0;
          const slowThreshold = daysOfData < 30 ? 0.05 : 0.5;
          if (turnover >= fastThreshold || consumptionFrequency >= 0.5) {
            speed = 'Fast';
            movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
          } else if (turnover >= slowThreshold || consumptionFrequency >= 0.1) {
            speed = 'Slow';
            movementNote = 'Monitor stock levels';
          } else {
            speed = 'Very Slow';
            movementNote = 'Consider stock reduction';
          }
        }
        const baseStockoutDays = avgDaily > 0 ? currentRob / avgDaily : null;
        const daysToStockoutVal = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
        let stockoutRange = '-';
        if (baseStockoutDays !== null && baseStockoutDays > 0) {
          if (daysOfData < 7) stockoutRange = `${Math.floor(baseStockoutDays * 0.5)}-${Math.ceil(baseStockoutDays * 2.0)}d`;
          else if (daysOfData < 30) stockoutRange = `${Math.floor(baseStockoutDays * 0.75)}-${Math.ceil(baseStockoutDays * 1.5)}d`;
        }
        return {
          itemCode: item.itemCode || '', itemName: item.itemName || '', itemType: item.itemType || '',
          uom: item.uom || '', currentRob, minStock, totalConsumed: Math.round(totalConsumed * 100) / 100,
          turnover, speed, movementNote,
          daysToStockout: daysToStockoutVal !== null ? daysToStockoutVal : '\u221E',
          stockoutRange,
          belowMin: currentRob < minStock ? 'Yes' : 'No',
        };
      }).sort((a: any, b: any) => (b.turnover || 0) - (a.turnover || 0));

      const effCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'itemCode', header: 'Item Code', width: 16, type: 'string' },
        { key: 'itemName', header: 'Item Name', width: 32, type: 'string' },
        { key: 'itemType', header: 'Type', width: 14, type: 'string' },
        { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
        { key: 'totalConsumed', header: 'Consumed', width: 14, type: 'number', align: 'center' },
        { key: 'turnover', header: 'Turnover', width: 12, type: 'number', align: 'center' },
        { key: 'speed', header: 'Movement', width: 14, type: 'string', align: 'center' },
        { key: 'daysToStockout', header: 'Days to Stockout', width: 16, type: 'string', align: 'center' },
        { key: 'stockoutRange', header: 'Stockout Range', width: 14, type: 'string', align: 'center' },
        { key: 'belowMin', header: 'Below Min', width: 12, type: 'string', align: 'center' },
        { key: 'movementNote', header: 'Note', width: 24, type: 'string' },
      ];
      const effLastCol = getLastColumnLetter(effCols.length);
      applyStandardHeader(effSheet, 'STOCK EFFICIENCY ANALYSIS', `Data Period: ${datePeriod} | Movement thresholds adjusted for ${daysOfData}-day sample`, vesselName, effItems.length, effLastCol, datePeriod);
      applyStandardTableHeader(effSheet, effCols, 7);

      effItems.forEach((item: any, idx: number) => {
        const row = effSheet.addRow([idx + 1, item.itemCode, item.itemName, item.itemType, item.currentRob, item.minStock, item.totalConsumed, item.turnover, item.speed, item.daysToStockout, item.stockoutRange, item.belowMin, item.movementNote]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = effCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
          if (colNum === 9 && item.speed === 'Fast') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.success } };
          }
          if (colNum === 9 && item.speed === 'Very Slow') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.warning } };
          }
          if (colNum === 12 && item.belowMin === 'Yes') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
          }
        });
      });
      applyStandardPageSetup(effSheet, 7, effCols.length, 6, vesselName);

      // Sheet 6: Forecast
      const forecastSheet = workbook.addWorksheet('Forecast');
      const forecastItems = Object.entries(itemGrouped).map(([id, g]) => {
        const item = itemsMap.get(Number(id));
        const avgDaily = daysOfData > 0 ? g.totalConsumed / daysOfData : 0;
        let fcMultiplier = 1.0;
        if (daysOfData < 7) fcMultiplier = 0.5;
        else if (daysOfData < 30) fcMultiplier = 0.75;
        const adjustedDaily = avgDaily * fcMultiplier;
        const projMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
        const rawMonthly = Math.round(avgDaily * 30 * 100) / 100;
        const currentRob = parseFloat(String(item?.rob)) || 0;
        const minStock = parseFloat(String(item?.min)) || 0;
        const monthsRem = adjustedDaily > 0 ? Math.round((currentRob / adjustedDaily / 30) * 10) / 10 : null;
        const leadTimeDays = 30;
        const safetyStock = projMonthly;
        const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
        const targetLevel = Math.max(minStock * 3, projMonthly * 6);
        const reorder = currentRob <= reorderPoint && projMonthly > 0;
        const suggestedQty = reorder ? Math.max(0, Math.ceil(targetLevel - currentRob)) : 0;
        const reasoning = reorder
          ? `Stock ${currentRob} \u2192 ${Math.round(targetLevel)} (${projMonthly > 0 ? Math.round(targetLevel / projMonthly * 10) / 10 : '\u221E'}mo supply)`
          : currentRob > reorderPoint ? 'Stock adequate' : 'No consumption';
        return {
          itemCode: item?.itemCode || '', itemName: item?.itemName || '', uom: item?.uom || '',
          avgMonthly: projMonthly, rawRate: rawMonthly !== projMonthly ? rawMonthly : null,
          projNextMonth: projMonthly, currentRob, minStock, reorderPoint: Math.round(reorderPoint),
          monthsRemaining: monthsRem !== null ? monthsRem : '-',
          reorderNeeded: reorder ? 'Yes' : 'No', suggestedQty, reasoning,
          confidence: daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low',
        };
      }).sort((a, b) => (typeof b.monthsRemaining === 'number' ? b.monthsRemaining : 999) - (typeof a.monthsRemaining === 'number' ? a.monthsRemaining : 999));

      const fcCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'itemCode', header: 'Item Code', width: 16, type: 'string' },
        { key: 'itemName', header: 'Item Name', width: 32, type: 'string' },
        { key: 'uom', header: 'UOM', width: 10, type: 'string', align: 'center' },
        { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
        { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'string', align: 'center' },
        { key: 'projNextMonth', header: 'Projected', width: 14, type: 'number', align: 'center' },
        { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
        { key: 'reorderPoint', header: 'Reorder Pt', width: 12, type: 'number', align: 'center' },
        { key: 'monthsRemaining', header: 'Months Left', width: 14, type: 'string', align: 'center' },
        { key: 'reorderNeeded', header: 'Reorder?', width: 12, type: 'string', align: 'center' },
        { key: 'suggestedQty', header: 'Suggested Qty', width: 14, type: 'number', align: 'center' },
        { key: 'reasoning', header: 'Reasoning', width: 36, type: 'string' },
        { key: 'confidence', header: 'Confidence', width: 14, type: 'string', align: 'center' },
      ];
      const fcLastCol = getLastColumnLetter(fcCols.length);
      applyStandardHeader(forecastSheet, 'CONSUMPTION FORECAST & REORDER PROJECTIONS', `Data Period: ${datePeriod} | Confidence: ${daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low'}`, vesselName, forecastItems.length, fcLastCol, datePeriod);
      applyStandardTableHeader(forecastSheet, fcCols, 7);

      forecastItems.forEach((item, idx) => {
        const row = forecastSheet.addRow([idx + 1, item.itemCode, item.itemName, item.uom, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.projNextMonth, item.currentRob, item.minStock, item.reorderPoint, item.monthsRemaining, item.reorderNeeded, item.suggestedQty, item.reasoning, item.confidence]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = fcCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
          if (colNum === 12 && item.reorderNeeded === 'Yes') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
          }
          if (colNum === 15 && item.confidence === 'Low') {
            cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.warning } };
          }
        });
      });
      applyStandardPageSetup(forecastSheet, 7, fcCols.length, 6, vesselName);

      const startStr = earliestDate.toISOString().slice(0, 10);
      const endStr = latestDate.toISOString().slice(0, 10);
      const shortVessel = vesselName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `Consumption_Pattern_Analysis_${shortVessel}_${startStr}_to_${endStr}_${timestamp}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating Stores Consumption Analysis Excel:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ========== SPARES CONSUMPTION PATTERN ANALYSIS REPORT ==========
  app.get("/technical/api/reports/spares-consumption-analysis/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate, category } = req.query;

      const allVessels = await storage.getVessels();
      let allHistory: any[];
      let allItems: any[];
      if (vesselId === 'all') {
        allHistory = []; allItems = [];
        for (const vessel of allVessels) {
          allHistory = allHistory.concat(await storage.getSpareHistory(vessel.id));
          allItems = allItems.concat(await storage.getSpares(vessel.id));
        }
      } else {
        allHistory = await storage.getSpareHistory(vesselId);
        allItems = await storage.getSpares(vesselId);
      }
      const vessel = allVessels.find((v: any) => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
      const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

      let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
      let allLedgerEvents = allHistory;

      if (startDate) {
        const sd = new Date(startDate as string);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
        allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
      }
      if (endDate) {
        const ed = new Date(endDate as string);
        ed.setHours(23, 59, 59, 999);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
        allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
      }
      if (category && category !== 'all') {
        const catItemIds = new Set(allItems.filter((i: any) => i.partCategory === category).map((i: any) => i.id));
        consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.spareId));
        allLedgerEvents = allLedgerEvents.filter((h: any) => catItemIds.has(h.spareId));
      }

      const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
      const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
      const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
      const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

      let confidenceLevel: 'low' | 'medium' | 'high' = 'low';
      if (daysOfData > 90) confidenceLevel = 'high';
      else if (daysOfData >= 30) confidenceLevel = 'medium';

      const monthlyMap: Record<string, { totalQty: number; eventCount: number; itemIds: Set<number>; byType: Record<string, number> }> = {};
      for (const h of consumeEvents) {
        const d = new Date(h.timestampUTC);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { totalQty: 0, eventCount: 0, itemIds: new Set(), byType: {} };
        }
        const qty = Math.abs(h.qtyChange || 0);
        monthlyMap[monthKey].totalQty += qty;
        monthlyMap[monthKey].eventCount += 1;
        monthlyMap[monthKey].itemIds.add(h.spareId);
        monthlyMap[monthKey].byType['spares'] = (monthlyMap[monthKey].byType['spares'] || 0) + qty;
      }

      const consumptionTrends = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          totalQty: Math.round(data.totalQty * 100) / 100,
          eventCount: data.eventCount,
          itemCount: data.itemIds.size,
          byType: {
            spares: Math.round((data.byType['spares'] || 0) * 100) / 100,
          }
        }));

      const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date; robSnapshots: number[] }> = {};
      for (const h of consumeEvents) {
        const key = h.spareId;
        if (!itemGrouped[key]) {
          itemGrouped[key] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC), robSnapshots: [] };
        }
        const qty = Math.abs(h.qtyChange || 0);
        itemGrouped[key].totalConsumed += qty;
        itemGrouped[key].events += 1;
        const robAfter = h.robAfter || 0;
        itemGrouped[key].robSnapshots.push(robAfter);
        const ts = new Date(h.timestampUTC);
        if (ts > itemGrouped[key].lastConsumed) {
          itemGrouped[key].lastConsumed = ts;
        }
      }

      const topConsumedItems = Object.entries(itemGrouped)
        .map(([itemIdStr, g]) => {
          const itemId = Number(itemIdStr);
          const item = itemsMap.get(itemId);
          const currentRob = item?.rob || 0;
          const minStock = item?.min || 0;
          const rawMonthlyRate = daysOfData > 0 ? (g.totalConsumed / daysOfData) * 30 : 0;
          let confidenceMultiplier = 1.0;
          if (daysOfData < 7) confidenceMultiplier = 0.5;
          else if (daysOfData < 30) confidenceMultiplier = 0.75;
          const avgMonthlyConsumption = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
          return {
            itemId,
            itemCode: item?.partCode || '',
            itemName: item?.partName || '',
            itemType: item?.critical || 'Spare Part',
            category: item?.partCategory || item?.componentName || '',
            uom: item?.uom || item?.unit || '',
            totalConsumed: Math.round(g.totalConsumed * 100) / 100,
            eventCount: g.events,
            avgMonthlyConsumption,
            rawAvgMonthlyConsumption: Math.round(rawMonthlyRate * 100) / 100,
            confidenceMultiplier,
            adjustmentNote: daysOfData < 7 
              ? `Adjusted estimate (×${confidenceMultiplier}) based on limited ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
              : daysOfData < 30
                ? `Adjusted estimate (×${confidenceMultiplier}) based on ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
                : null,
            currentRob,
            minStock,
            lastConsumedDate: g.lastConsumed.toISOString(),
            hasSingleEvent: g.events === 1,
          };
        })
        .sort((a, b) => b.totalConsumed - a.totalConsumed);

      const categoryMap: Record<string, { totalQty: number; itemCount: Set<number>; itemType: string }> = {};
      for (const h of consumeEvents) {
        const item = itemsMap.get(h.spareId);
        const cat = item?.partCategory || item?.componentName || 'Uncategorized';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { totalQty: 0, itemCount: new Set(), itemType: item?.critical || 'Spare Part' };
        }
        categoryMap[cat].totalQty += Math.abs(h.qtyChange || 0);
        categoryMap[cat].itemCount.add(h.spareId);
      }

      const totalConsumptionQty = Object.values(categoryMap).reduce((sum, c) => sum + c.totalQty, 0);
      const categoryBreakdown = Object.entries(categoryMap)
        .map(([cat, data]) => ({
          category: cat,
          itemType: data.itemType,
          totalQty: Math.round(data.totalQty * 100) / 100,
          itemCount: data.itemCount.size,
          percentage: totalConsumptionQty > 0 ? Math.round((data.totalQty / totalConsumptionQty) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.totalQty - a.totalQty);

      const stockEfficiency = allItems
        .filter((item: any) => !item.deleted && item.isActive !== false)
        .map((item: any) => {
          const itemId = item.id;
          const consumed = itemGrouped[itemId];
          const totalConsumed = consumed?.totalConsumed || 0;
          const currentRob = item.rob || 0;
          const minStock = item.min || 0;
          const robSnapshots = consumed?.robSnapshots || [];
          const avgRob = robSnapshots.length > 0
            ? robSnapshots.reduce((s: number, v: number) => s + v, 0) / robSnapshots.length
            : currentRob;
          const stockTurnoverRatio = avgRob > 0 ? Math.round((totalConsumed / avgRob) * 100) / 100 : 0;

          const eventCount = consumed?.events || 0;
          const consumptionFrequency = daysOfData > 0 ? eventCount / daysOfData : 0;
          const stockHealthRatio = minStock > 0 ? currentRob / minStock : null;

          let movementSpeed: 'fast' | 'slow' | 'very-slow' | 'non-moving' = 'non-moving';
          let movementNote = '';
          if (totalConsumed === 0) {
            movementSpeed = 'non-moving';
            movementNote = currentRob > 0 ? 'No consumption recorded - consider stock reduction' : '';
          } else {
            const fastThreshold = daysOfData < 30 ? 0.5 : 2.0;
            const slowThreshold = daysOfData < 30 ? 0.05 : 0.5;
            if (stockTurnoverRatio >= fastThreshold || consumptionFrequency >= 0.5) {
              movementSpeed = 'fast';
              movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
            } else if (stockTurnoverRatio >= slowThreshold || consumptionFrequency >= 0.1) {
              movementSpeed = 'slow';
              movementNote = 'Monitor stock levels';
            } else {
              movementSpeed = 'very-slow';
              movementNote = 'Consider stock reduction';
            }
          }

          const avgDailyConsumption = daysOfData > 0 ? totalConsumed / daysOfData : 0;
          const baseStockoutDays = avgDailyConsumption > 0 ? currentRob / avgDailyConsumption : null;
          let daysUntilStockout = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
          let stockoutRange: { lower: number; upper: number } | null = null;
          let stockoutConfidence: 'low' | 'medium' | 'high' = 'high';
          if (baseStockoutDays !== null && baseStockoutDays > 0) {
            if (daysOfData < 7) {
              stockoutRange = { lower: Math.floor(baseStockoutDays * 0.5), upper: Math.ceil(baseStockoutDays * 2.0) };
              stockoutConfidence = 'low';
            } else if (daysOfData < 30) {
              stockoutRange = { lower: Math.floor(baseStockoutDays * 0.75), upper: Math.ceil(baseStockoutDays * 1.5) };
              stockoutConfidence = 'medium';
            }
          }
          const belowMinStock = currentRob < minStock;
          const negativeRob = currentRob < 0;

          return {
            itemId,
            itemCode: item.partCode || '',
            itemName: item.partName || '',
            itemType: item.critical || 'Spare Part',
            uom: item.uom || item.unit || '',
            currentRob,
            minStock,
            avgRob: Math.round(avgRob * 100) / 100,
            totalConsumed: Math.round(totalConsumed * 100) / 100,
            stockTurnoverRatio,
            movementSpeed,
            movementNote,
            consumptionFrequency: Math.round(consumptionFrequency * 1000) / 1000,
            stockHealthRatio: stockHealthRatio !== null ? Math.round(stockHealthRatio * 100) / 100 : null,
            daysUntilStockout,
            stockoutRange,
            stockoutConfidence,
            belowMinStock,
            negativeRob,
            eventCount,
          };
        })
        .sort((a: any, b: any) => b.stockTurnoverRatio - a.stockTurnoverRatio);

      const forecastData = topConsumedItems.map(item => {
        const avgDaily = daysOfData > 0 ? item.totalConsumed / daysOfData : 0;
        let forecastConfidenceMultiplier = 1.0;
        if (daysOfData < 7) forecastConfidenceMultiplier = 0.5;
        else if (daysOfData < 30) forecastConfidenceMultiplier = 0.75;
        const adjustedDaily = avgDaily * forecastConfidenceMultiplier;
        const projectedMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
        const monthsRemaining = adjustedDaily > 0 ? Math.round((item.currentRob / adjustedDaily / 30) * 10) / 10 : null;

        const leadTimeDays = 30;
        const safetyStock = projectedMonthly;
        const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
        const targetLevel = Math.max(item.minStock * 3, projectedMonthly * 6);
        const reorderNeeded = item.currentRob <= reorderPoint && projectedMonthly > 0;
        const suggestedReorderQty = reorderNeeded ? Math.max(0, Math.ceil(targetLevel - item.currentRob)) : 0;
        const reorderReasoning = reorderNeeded
          ? `Bring stock from ${item.currentRob} to ${Math.round(targetLevel)} (${projectedMonthly > 0 ? Math.round(targetLevel / projectedMonthly * 10) / 10 : '∞'} months supply at ${projectedMonthly}/month)`
          : item.currentRob > reorderPoint ? 'Stock adequate - above reorder point' : 'No consumption recorded';

        return {
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemType: item.itemType,
          uom: item.uom,
          avgMonthlyConsumption: item.avgMonthlyConsumption,
          rawAvgMonthlyConsumption: item.rawAvgMonthlyConsumption,
          projectedNextMonth: projectedMonthly,
          currentRob: item.currentRob,
          minStock: item.minStock,
          monthsOfStockRemaining: monthsRemaining,
          reorderNeeded,
          suggestedReorderQty,
          reorderPoint,
          targetLevel: Math.round(targetLevel),
          safetyStock: Math.round(safetyStock * 100) / 100,
          leadTimeDays,
          reorderReasoning,
          confidenceLevel,
        };
      });

      const nonMovingItems = stockEfficiency
        .filter((i: any) => i.movementSpeed === 'non-moving' && i.currentRob > 0)
        .slice(0, 50);

      const recentTransactions = [...consumeEvents]
        .sort((a: any, b: any) => {
          const dateA = new Date(a.timestampUTC || a.dateLocal || 0).getTime();
          const dateB = new Date(b.timestampUTC || b.dateLocal || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 100)
        .map((h: any) => ({
          id: h.id,
          date: h.timestampUTC || h.dateLocal,
          itemId: h.spareId,
          itemCode: h.partCode,
          itemName: h.partName,
          section: 'spares',
          qtyConsumed: Math.abs(h.qtyChange || 0),
          robAfter: h.robAfter || 0,
          uom: itemsMap.get(h.spareId)?.uom || itemsMap.get(h.spareId)?.unit || '',
          userId: h.userId || '',
          remarks: h.remarks || '',
        }));

      const uniqueItemsConsumed = new Set(consumeEvents.map((h: any) => h.spareId)).size;

      res.json({
        summary: {
          totalItemsConsumed: uniqueItemsConsumed,
          totalQuantityConsumed: Math.round(consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(h.qtyChange || 0), 0) * 100) / 100,
          totalConsumptionEvents: consumeEvents.length,
          dateRange: { start: earliestDate.toISOString(), end: latestDate.toISOString() },
          dataQuality: {
            daysOfData,
            isLimitedData: daysOfData < 30,
            confidenceLevel,
            message: daysOfData < 30
              ? `Analysis based on ${daysOfData} days of consumption data. More accurate trends will develop over time.`
              : daysOfData < 90
                ? `Analysis based on ${daysOfData} days of data. Moderate confidence in trend projections.`
                : `Analysis based on ${daysOfData} days of data. High confidence in trend projections.`,
          },
          totalInventoryItems: allItems.filter((i: any) => !i.deleted && i.isActive !== false).length,
          dataMonths: Math.max(0.1, Math.round((daysOfData / 30) * 10) / 10),
          vesselName,
        },
        consumptionTrends,
        topConsumedItems,
        categoryBreakdown,
        stockEfficiency,
        forecastData,
        nonMovingItems,
        recentTransactions,
      });
    } catch (error: any) {
      console.error("Error generating Spares Consumption Pattern Analysis:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  app.post("/technical/api/reports/spares-consumption-analysis/:vesselId/excel", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate, category } = req.body;

      const allVessels = await storage.getVessels();
      let allHistory: any[];
      let allItems: any[];
      if (vesselId === 'all') {
        allHistory = []; allItems = [];
        for (const vessel of allVessels) {
          allHistory = allHistory.concat(await storage.getSpareHistory(vessel.id));
          allItems = allItems.concat(await storage.getSpares(vessel.id));
        }
      } else {
        allHistory = await storage.getSpareHistory(vesselId);
        allItems = await storage.getSpares(vesselId);
      }
      const vessel = allVessels.find((v: any) => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
      const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

      let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
      if (startDate) {
        const sd = new Date(startDate);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
      }
      if (endDate) {
        const ed = new Date(endDate);
        ed.setHours(23, 59, 59, 999);
        consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
      }
      if (category && category !== 'all') {
        const catItemIds = new Set(allItems.filter((i: any) => i.partCategory === category).map((i: any) => i.id));
        consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.spareId));
      }

      const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
      const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
      const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
      const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();

      const datePeriod = `${earliestDate.toISOString().slice(0, 10)} to ${latestDate.toISOString().slice(0, 10)}`;

      const summarySheet = workbook.addWorksheet('Summary');
      const uniqueItems = new Set(consumeEvents.map((h: any) => h.spareId)).size;
      const totalQty = consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(h.qtyChange || 0), 0);
      const summaryLastCol = getLastColumnLetter(4);
      applyStandardHeader(summarySheet, 'SPARES CONSUMPTION PATTERN ANALYSIS - SUMMARY', `Data Period: ${datePeriod} (${daysOfData} days)`, vesselName, uniqueItems, summaryLastCol, datePeriod);

      const summaryData = [
        ['Metric', 'Value'],
        ['Data Period', datePeriod],
        ['Days of Data', daysOfData],
        ['Unique Spares Consumed', uniqueItems],
        ['Total Quantity Consumed', Math.round(totalQty * 100) / 100],
        ['Total Consumption Events', consumeEvents.length],
        ['Total Inventory Spares', allItems.filter((i: any) => !i.deleted && i.isActive !== false).length],
        ['Confidence Level', daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low'],
      ];
      summaryData.forEach((row, idx) => {
        const r = summarySheet.addRow(row);
        r.height = 22;
        r.eachCell((cell) => {
          cell.font = { name: 'Calibri', size: idx === 0 ? 11 : 10, bold: idx === 0, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx === 0 ? COLORS.primary : idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          if (idx === 0) cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
        });
      });
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 30;

      const trendsSheet = workbook.addWorksheet('Monthly Trends');
      const monthlyMap: Record<string, { totalQty: number; eventCount: number }> = {};
      for (const h of consumeEvents) {
        const d = new Date(h.timestampUTC);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[mk]) monthlyMap[mk] = { totalQty: 0, eventCount: 0 };
        const qty = Math.abs(h.qtyChange || 0);
        monthlyMap[mk].totalQty += qty;
        monthlyMap[mk].eventCount += 1;
      }
      const trendsCols: ColumnDef[] = [
        { key: 'month', header: 'Month', width: 14, type: 'string' },
        { key: 'totalQty', header: 'Total Qty', width: 14, type: 'number', align: 'center' },
        { key: 'events', header: 'Events', width: 12, type: 'number', align: 'center' },
      ];
      const trendsLastCol = getLastColumnLetter(trendsCols.length);
      applyStandardHeader(trendsSheet, 'MONTHLY SPARES CONSUMPTION TRENDS', `Data Period: ${datePeriod}`, vesselName, Object.keys(monthlyMap).length, trendsLastCol, datePeriod);
      applyStandardTableHeader(trendsSheet, trendsCols, 7);

      Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([month, data], idx) => {
        const row = trendsSheet.addRow([month, Math.round(data.totalQty * 100) / 100, data.eventCount]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = trendsCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
        });
      });
      applyStandardPageSetup(trendsSheet, 7, trendsCols.length, 6, vesselName);

      const itemSheet = workbook.addWorksheet('Item Analysis');
      const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date }> = {};
      for (const h of consumeEvents) {
        if (!itemGrouped[h.spareId]) itemGrouped[h.spareId] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC) };
        itemGrouped[h.spareId].totalConsumed += Math.abs(h.qtyChange || 0);
        itemGrouped[h.spareId].events += 1;
        const ts = new Date(h.timestampUTC);
        if (ts > itemGrouped[h.spareId].lastConsumed) itemGrouped[h.spareId].lastConsumed = ts;
      }
      const itemRows = Object.entries(itemGrouped).map(([id, g]) => {
        const item = itemsMap.get(Number(id));
        const rawMonthlyRate = Math.round((g.totalConsumed / daysOfData) * 30 * 100) / 100;
        let confidenceMultiplier = 1.0;
        if (daysOfData < 7) confidenceMultiplier = 0.5;
        else if (daysOfData < 30) confidenceMultiplier = 0.75;
        const adjustedMonthly = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
        return {
          itemCode: item?.partCode || '', itemName: item?.partName || '', itemType: item?.critical || 'Spare Part',
          category: item?.partCategory || item?.componentName || '', component: item?.componentName || '',
          uom: item?.uom || item?.unit || '',
          totalConsumed: Math.round(g.totalConsumed * 100) / 100, events: g.events,
          avgMonthly: adjustedMonthly,
          rawRate: rawMonthlyRate !== adjustedMonthly ? rawMonthlyRate : null,
          currentRob: item?.rob || 0, minStock: item?.min || 0,
          lastConsumed: g.lastConsumed.toISOString().slice(0, 10),
        };
      }).sort((a, b) => b.totalConsumed - a.totalConsumed);

      const itemCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'itemCode', header: 'Part Code', width: 16, type: 'string' },
        { key: 'itemName', header: 'Part Name', width: 32, type: 'string' },
        { key: 'component', header: 'Component', width: 20, type: 'string' },
        { key: 'itemType', header: 'Criticality', width: 14, type: 'string' },
        { key: 'category', header: 'Category', width: 18, type: 'string' },
        { key: 'uom', header: 'UOM', width: 10, type: 'string', align: 'center' },
        { key: 'totalConsumed', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
        { key: 'events', header: 'Events', width: 10, type: 'number', align: 'center' },
        { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
        { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'string', align: 'center' },
        { key: 'currentRob', header: 'Current ROB', width: 14, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min Stock', width: 12, type: 'number', align: 'center' },
        { key: 'lastConsumed', header: 'Last Consumed', width: 14, type: 'string', align: 'center' },
      ];
      const itemLastCol = getLastColumnLetter(itemCols.length);
      applyStandardHeader(itemSheet, 'SPARE PART CONSUMPTION ANALYSIS', `Data Period: ${datePeriod} | ${itemRows.length} spares consumed`, vesselName, itemRows.length, itemLastCol, datePeriod);
      applyStandardTableHeader(itemSheet, itemCols, 7);

      itemRows.forEach((item, idx) => {
        const row = itemSheet.addRow([idx + 1, item.itemCode, item.itemName, item.component, item.itemType, item.category, item.uom, item.totalConsumed, item.events, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.currentRob, item.minStock, item.lastConsumed]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = itemCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
        });
      });
      applyStandardPageSetup(itemSheet, 7, itemCols.length, 6, vesselName);

      const catSheet = workbook.addWorksheet('Category Breakdown');
      const catMap: Record<string, { totalQty: number; items: Set<number>; itemType: string }> = {};
      for (const h of consumeEvents) {
        const item = itemsMap.get(h.spareId);
        const cat = item?.partCategory || item?.componentName || 'Uncategorized';
        if (!catMap[cat]) catMap[cat] = { totalQty: 0, items: new Set(), itemType: item?.critical || 'Spare Part' };
        catMap[cat].totalQty += Math.abs(h.qtyChange || 0);
        catMap[cat].items.add(h.spareId);
      }
      const catTotal = Object.values(catMap).reduce((s, c) => s + c.totalQty, 0);
      const catRows = Object.entries(catMap).map(([cat, data]) => ({
        category: cat, itemType: data.itemType, totalQty: Math.round(data.totalQty * 100) / 100,
        itemCount: data.items.size, percentage: catTotal > 0 ? Math.round((data.totalQty / catTotal) * 10000) / 100 : 0,
      })).sort((a, b) => b.totalQty - a.totalQty);

      const catCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'category', header: 'Category', width: 28, type: 'string' },
        { key: 'itemType', header: 'Criticality', width: 16, type: 'string' },
        { key: 'totalQty', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
        { key: 'itemCount', header: 'Spares', width: 10, type: 'number', align: 'center' },
        { key: 'percentage', header: '% Share', width: 12, type: 'number', align: 'center' },
      ];
      const catLastCol = getLastColumnLetter(catCols.length);
      applyStandardHeader(catSheet, 'CATEGORY-WISE SPARES CONSUMPTION BREAKDOWN', `Data Period: ${datePeriod}`, vesselName, catRows.length, catLastCol, datePeriod);
      applyStandardTableHeader(catSheet, catCols, 7);

      catRows.forEach((item, idx) => {
        const row = catSheet.addRow([idx + 1, item.category, item.itemType, item.totalQty, item.itemCount, item.percentage]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = catCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
        });
      });
      applyStandardPageSetup(catSheet, 7, catCols.length, 6, vesselName);

      const effSheet = workbook.addWorksheet('Stock Efficiency');
      const effItems = allItems.filter((i: any) => !i.deleted && i.isActive !== false).map((item: any) => {
        const consumed = itemGrouped[item.id];
        const totalConsumed = consumed?.totalConsumed || 0;
        const currentRob = item.rob || 0;
        const minStock = item.min || 0;
        const avgDaily = daysOfData > 0 ? totalConsumed / daysOfData : 0;
        const events = consumed?.events || 0;
        const consumptionFrequency = daysOfData > 0 ? events / daysOfData : 0;
        const turnover = currentRob > 0 ? Math.round((totalConsumed / currentRob) * 100) / 100 : 0;
        let speed = 'Non-Moving';
        let movementNote = '';
        if (totalConsumed === 0) {
          speed = 'Non-Moving';
          movementNote = currentRob > 0 ? 'No consumption - consider reduction' : '';
        } else {
          const fastThreshold = daysOfData < 30 ? 0.5 : 2.0;
          const slowThreshold = daysOfData < 30 ? 0.05 : 0.5;
          if (turnover >= fastThreshold || consumptionFrequency >= 0.5) {
            speed = 'Fast';
            movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
          } else if (turnover >= slowThreshold || consumptionFrequency >= 0.1) {
            speed = 'Slow';
            movementNote = 'Monitor stock levels';
          } else {
            speed = 'Very Slow';
            movementNote = 'Consider stock reduction';
          }
        }
        const baseStockoutDays = avgDaily > 0 ? currentRob / avgDaily : null;
        const daysToStockoutVal = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
        let stockoutRange = '-';
        if (baseStockoutDays !== null && baseStockoutDays > 0) {
          if (daysOfData < 7) stockoutRange = `${Math.floor(baseStockoutDays * 0.5)}-${Math.ceil(baseStockoutDays * 2.0)}d`;
          else if (daysOfData < 30) stockoutRange = `${Math.floor(baseStockoutDays * 0.75)}-${Math.ceil(baseStockoutDays * 1.5)}d`;
        }
        return {
          itemCode: item.partCode || '', itemName: item.partName || '', itemType: item.critical || 'Spare Part',
          component: item.componentName || '',
          uom: item.uom || item.unit || '', currentRob, minStock, totalConsumed: Math.round(totalConsumed * 100) / 100,
          turnover, speed, movementNote,
          daysToStockout: daysToStockoutVal !== null ? daysToStockoutVal : '\u221E',
          stockoutRange,
          belowMin: currentRob < minStock ? 'Yes' : 'No',
        };
      }).sort((a: any, b: any) => (b.turnover || 0) - (a.turnover || 0));

      const effCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'itemCode', header: 'Part Code', width: 16, type: 'string' },
        { key: 'itemName', header: 'Part Name', width: 32, type: 'string' },
        { key: 'component', header: 'Component', width: 20, type: 'string' },
        { key: 'itemType', header: 'Criticality', width: 14, type: 'string' },
        { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
        { key: 'totalConsumed', header: 'Consumed', width: 14, type: 'number', align: 'center' },
        { key: 'turnover', header: 'Turnover', width: 12, type: 'number', align: 'center' },
        { key: 'speed', header: 'Movement', width: 14, type: 'string', align: 'center' },
        { key: 'daysToStockout', header: 'Days to Stockout', width: 16, type: 'string', align: 'center' },
        { key: 'stockoutRange', header: 'Stockout Range', width: 14, type: 'string', align: 'center' },
        { key: 'belowMin', header: 'Below Min', width: 12, type: 'string', align: 'center' },
        { key: 'movementNote', header: 'Note', width: 24, type: 'string' },
      ];
      const effLastCol = getLastColumnLetter(effCols.length);
      applyStandardHeader(effSheet, 'SPARES STOCK EFFICIENCY ANALYSIS', `Data Period: ${datePeriod} | Movement thresholds adjusted for ${daysOfData}-day sample`, vesselName, effItems.length, effLastCol, datePeriod);
      applyStandardTableHeader(effSheet, effCols, 7);

      effItems.forEach((item: any, idx: number) => {
        const row = effSheet.addRow([idx + 1, item.itemCode, item.itemName, item.component, item.itemType, item.currentRob, item.minStock, item.totalConsumed, item.turnover, item.speed, item.daysToStockout, item.stockoutRange, item.belowMin, item.movementNote]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = effCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
          if (colNum === 10 && item.speed === 'Fast') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.success } };
          }
          if (colNum === 10 && item.speed === 'Very Slow') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.warning } };
          }
          if (colNum === 13 && item.belowMin === 'Yes') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
          }
        });
      });
      applyStandardPageSetup(effSheet, 7, effCols.length, 6, vesselName);

      const forecastSheet = workbook.addWorksheet('Forecasting');
      const forecastItems = Object.entries(itemGrouped).map(([id, g]) => {
        const item = itemsMap.get(Number(id));
        const avgDaily = daysOfData > 0 ? g.totalConsumed / daysOfData : 0;
        let fcMultiplier = 1.0;
        if (daysOfData < 7) fcMultiplier = 0.5;
        else if (daysOfData < 30) fcMultiplier = 0.75;
        const adjustedDaily = avgDaily * fcMultiplier;
        const projMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
        const rawMonthly = Math.round(avgDaily * 30 * 100) / 100;
        const currentRob = item?.rob || 0;
        const minStock = item?.min || 0;
        const monthsRem = adjustedDaily > 0 ? Math.round((currentRob / adjustedDaily / 30) * 10) / 10 : null;
        const leadTimeDays = 30;
        const safetyStock = projMonthly;
        const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
        const targetLevel = Math.max(minStock * 3, projMonthly * 6);
        const reorder = currentRob <= reorderPoint && projMonthly > 0;
        const suggestedQty = reorder ? Math.max(0, Math.ceil(targetLevel - currentRob)) : 0;
        const reasoning = reorder
          ? `Stock ${currentRob} \u2192 ${Math.round(targetLevel)} (${projMonthly > 0 ? Math.round(targetLevel / projMonthly * 10) / 10 : '\u221E'}mo supply)`
          : currentRob > reorderPoint ? 'Stock adequate' : 'No consumption';
        return {
          itemCode: item?.partCode || '', itemName: item?.partName || '', component: item?.componentName || '',
          uom: item?.uom || item?.unit || '',
          avgMonthly: projMonthly, rawRate: rawMonthly !== projMonthly ? rawMonthly : null,
          projNextMonth: projMonthly, currentRob, minStock, reorderPoint: Math.round(reorderPoint),
          monthsRemaining: monthsRem !== null ? monthsRem : '-',
          reorderNeeded: reorder ? 'Yes' : 'No', suggestedQty, reasoning,
          confidence: daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low',
        };
      }).sort((a, b) => (typeof b.monthsRemaining === 'number' ? b.monthsRemaining : 999) - (typeof a.monthsRemaining === 'number' ? a.monthsRemaining : 999));

      const fcCols: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'itemCode', header: 'Part Code', width: 16, type: 'string' },
        { key: 'itemName', header: 'Part Name', width: 32, type: 'string' },
        { key: 'component', header: 'Component', width: 20, type: 'string' },
        { key: 'uom', header: 'UOM', width: 10, type: 'string', align: 'center' },
        { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
        { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'string', align: 'center' },
        { key: 'projNextMonth', header: 'Projected', width: 14, type: 'number', align: 'center' },
        { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
        { key: 'reorderPoint', header: 'Reorder Pt', width: 12, type: 'number', align: 'center' },
        { key: 'monthsRemaining', header: 'Months Left', width: 14, type: 'string', align: 'center' },
        { key: 'reorderNeeded', header: 'Reorder?', width: 12, type: 'string', align: 'center' },
        { key: 'suggestedQty', header: 'Suggested Qty', width: 14, type: 'number', align: 'center' },
        { key: 'reasoning', header: 'Reasoning', width: 36, type: 'string' },
        { key: 'confidence', header: 'Confidence', width: 14, type: 'string', align: 'center' },
      ];
      const fcLastCol = getLastColumnLetter(fcCols.length);
      applyStandardHeader(forecastSheet, 'SPARES CONSUMPTION FORECAST & REORDER PROJECTIONS', `Data Period: ${datePeriod} | Confidence: ${daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low'}`, vesselName, forecastItems.length, fcLastCol, datePeriod);
      applyStandardTableHeader(forecastSheet, fcCols, 7);

      forecastItems.forEach((item, idx) => {
        const row = forecastSheet.addRow([idx + 1, item.itemCode, item.itemName, item.component, item.uom, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.projNextMonth, item.currentRob, item.minStock, item.reorderPoint, item.monthsRemaining, item.reorderNeeded, item.suggestedQty, item.reasoning, item.confidence]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          const colDef = fcCols[colNum - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
          if (colNum === 13 && item.reorderNeeded === 'Yes') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
          }
          if (colNum === 16 && item.confidence === 'Low') {
            cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.warning } };
          }
        });
      });
      applyStandardPageSetup(forecastSheet, 7, fcCols.length, 6, vesselName);

      const startStr = earliestDate.toISOString().slice(0, 10);
      const endStr = latestDate.toISOString().slice(0, 10);
      const shortVessel = vesselName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `Spares_Consumption_Analysis_${shortVessel}_${startStr}_to_${endStr}_${timestamp}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating Spares Consumption Analysis Excel:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ========== CONSUMPTION PATTERN ANALYSIS REPORT ==========
  app.get("/technical/api/reports/consumption-analysis/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      let history: any[];
      let allSpares: any[];
      if (vesselId === 'all') {
        const allVessels = await storage.getVessels();
        history = []; allSpares = [];
        for (const vessel of allVessels) {
          history = history.concat(await storage.getSpareHistory(vessel.id));
          allSpares = allSpares.concat(await storage.getSpares(vessel.id));
        }
      } else {
        history = await storage.getSpareHistory(vesselId);
        allSpares = await storage.getSpares(vesselId);
      }

      const consumeEvents = history.filter((h: any) => h.eventType === 'CONSUME');

      const grouped: Record<number, { partCode: string; partName: string; componentName: string; totalConsumed: number; events: number; lastConsumed: Date }> = {};

      for (const h of consumeEvents) {
        const key = h.spareId;
        if (!grouped[key]) {
          grouped[key] = {
            partCode: h.partCode || '',
            partName: h.partName || '',
            componentName: h.componentName || '',
            totalConsumed: 0,
            events: 0,
            lastConsumed: new Date(h.timestampUTC),
          };
        }
        grouped[key].totalConsumed += Math.abs(h.qtyChange || 0);
        grouped[key].events += 1;
        const ts = new Date(h.timestampUTC);
        if (ts > grouped[key].lastConsumed) {
          grouped[key].lastConsumed = ts;
        }
      }

      const sparesMap = new Map(allSpares.map((s: any) => [s.id, s]));

      const items = Object.entries(grouped).map(([spareId, g]) => {
        const spare = sparesMap.get(Number(spareId));
        const rob = spare?.rob ?? 0;
        const minStock = spare?.min ?? 0;
        const crit = ((spare?.critical || spare?.criticality || '') as string).toLowerCase();
        const isCritical = crit === 'critical' || crit === 'yes';
        return {
          spareId: Number(spareId),
          partCode: g.partCode,
          partName: g.partName,
          componentName: g.componentName,
          totalConsumed: g.totalConsumed,
          consumptionEvents: g.events,
          currentRob: rob,
          minStock: minStock,
          status: isCritical ? 'Critical' : 'Normal',
          lastConsumed: g.lastConsumed.toISOString(),
        };
      });

      items.sort((a, b) => {
        if (b.totalConsumed !== a.totalConsumed) return b.totalConsumed - a.totalConsumed;
        return a.partCode.localeCompare(b.partCode);
      });

      res.json({
        summary: {
          totalItems: items.length,
          totalConsumed: items.reduce((sum, i) => sum + i.totalConsumed, 0),
          totalEvents: items.reduce((sum, i) => sum + i.consumptionEvents, 0),
          criticalItems: items.filter(i => i.status === 'Critical').length,
        },
        items,
      });
    } catch (error: any) {
      console.error("Error generating Consumption Pattern Analysis:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  app.post("/technical/api/reports/consumption-analysis/:vesselId/excel", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const allVessels = await storage.getVessels();
      let history: any[];
      let allSpares: any[];
      if (vesselId === 'all') {
        history = []; allSpares = [];
        for (const vessel of allVessels) {
          history = history.concat(await storage.getSpareHistory(vessel.id));
          allSpares = allSpares.concat(await storage.getSpares(vessel.id));
        }
      } else {
        history = await storage.getSpareHistory(vesselId);
        allSpares = await storage.getSpares(vesselId);
      }
      const vessel = allVessels.find((v: any) => v.id === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

      const consumeEvents = history.filter((h: any) => h.eventType === 'CONSUME');

      const grouped: Record<number, { partCode: string; partName: string; componentName: string; totalConsumed: number; events: number; lastConsumed: Date }> = {};

      for (const h of consumeEvents) {
        const key = h.spareId;
        if (!grouped[key]) {
          grouped[key] = {
            partCode: h.partCode || '',
            partName: h.partName || '',
            componentName: h.componentName || '',
            totalConsumed: 0,
            events: 0,
            lastConsumed: new Date(h.timestampUTC),
          };
        }
        grouped[key].totalConsumed += Math.abs(h.qtyChange || 0);
        grouped[key].events += 1;
        const ts = new Date(h.timestampUTC);
        if (ts > grouped[key].lastConsumed) {
          grouped[key].lastConsumed = ts;
        }
      }

      const sparesMap = new Map(allSpares.map((s: any) => [s.id, s]));

      const items = Object.entries(grouped).map(([spareId, g]) => {
        const spare = sparesMap.get(Number(spareId));
        const rob = spare?.rob ?? 0;
        const minStock = spare?.min ?? 0;
        const crit = ((spare?.critical || spare?.criticality || '') as string).toLowerCase();
        const isCritical = crit === 'critical' || crit === 'yes';

        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const d = g.lastConsumed;
        const day = String(d.getUTCDate()).padStart(2, '0');
        const mon = months[d.getUTCMonth()];
        const yr = d.getUTCFullYear();
        const lastConsumedFormatted = `${day}-${mon}-${yr}`;

        return {
          partCode: g.partCode,
          partName: g.partName,
          componentName: g.componentName,
          totalConsumed: g.totalConsumed,
          consumptionEvents: g.events,
          currentRob: rob,
          minStock: minStock,
          status: isCritical ? 'Critical' : 'Normal',
          lastConsumed: lastConsumedFormatted,
        };
      });

      items.sort((a, b) => {
        if (b.totalConsumed !== a.totalConsumed) return b.totalConsumed - a.totalConsumed;
        return a.partCode.localeCompare(b.partCode);
      });

      const criticalCount = items.filter(i => i.status === 'Critical').length;
      const totalConsumed = items.reduce((sum, i) => sum + i.totalConsumed, 0);
      const totalEvents = items.reduce((sum, i) => sum + i.consumptionEvents, 0);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Consumption Analysis');

      const columns: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
        { key: 'partCode', header: 'Part Code', width: 20, type: 'string' },
        { key: 'partName', header: 'Part Name', width: 32, type: 'string' },
        { key: 'componentName', header: 'Component', width: 28, type: 'string' },
        { key: 'totalConsumed', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
        { key: 'consumptionEvents', header: 'Consumption Events', width: 18, type: 'number', align: 'center' },
        { key: 'currentRob', header: 'Current ROB', width: 14, type: 'number', align: 'center' },
        { key: 'minStock', header: 'Min Stock', width: 12, type: 'number', align: 'center' },
        { key: 'status', header: 'Status', width: 14, type: 'string', align: 'center' },
        { key: 'lastConsumed', header: 'Last Consumed', width: 16, type: 'string', align: 'center' },
      ];

      const totalColumns = columns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);

      const subtitle = `Total Items: ${items.length} | Total Consumed: ${totalConsumed} | Total Events: ${totalEvents} | Critical: ${criticalCount}`;
      applyStandardHeader(worksheet, 'CONSUMPTION PATTERN ANALYSIS', subtitle, vesselName, items.length, lastColLetter);

      const headerRowNum = 7;
      applyStandardTableHeader(worksheet, columns, headerRowNum);

      items.forEach((item, idx) => {
        const rowData: (string | number)[] = [
          idx + 1,
          item.partCode, item.partName, item.componentName,
          item.totalConsumed, item.consumptionEvents,
          item.currentRob, item.minStock, item.status, item.lastConsumed,
        ];
        const row = worksheet.addRow(rowData);
        row.height = 20;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colDef = columns[colNumber - 1];
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
          cell.border = {
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
          };
          cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };

          if (colNumber === 9 && item.status === 'Critical') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
          }
        });
      });

      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };

      applyStandardPageSetup(worksheet, headerRowNum, totalColumns, 6, vesselName);

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('ConsumptionAnalysis', vesselName);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating Consumption Analysis Excel:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // Batch consume spares (for work order consumption)
  app.post("/technical/api/spares/:vesselId/batch-consume", async (req, res) => {
    try {
      const { items, workOrderId, consumedBy } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      
      const results = [];
      for (const item of items) {
        const result = await storage.consumeSpare(
          item.spareId,
          item.quantity,
          workOrderId,
          consumedBy || 'System',
          item.notes
        );
        results.push(result);
      }
      
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to consume spares" });
    }
  });
  
  // Batch receive spares (for purchase order receiving)
  app.post("/technical/api/spares/:vesselId/batch-receive", async (req, res) => {
    try {
      const { items, purchaseOrderRef, receivedBy } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      
      const results = [];
      for (const item of items) {
        const result = await storage.receiveSpare(
          item.spareId,
          item.quantity,
          item.unitCost,
          purchaseOrderRef,
          receivedBy || 'System',
          item.notes
        );
        results.push(result);
      }
      
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to receive spares" });
    }
  });

  // Simple consume endpoint (legacy - consumes from Location A by default)
  app.post("/technical/api/spares/:id/consume", async (req, res) => {
    try {
      const spareId = parseInt(req.params.id);
      if (isNaN(spareId)) {
        return res.status(400).json({ error: "Invalid spare ID" });
      }
      
      const { qty, dateLocal, place, remarks, userId, workOrder } = req.body;
      
      if (!qty || qty <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }
      
      // Use consumeSpareFromLocation with Location A as default
      const result = await storage.consumeSpareFromLocation(
        spareId,
        qty,
        'A', // Default to Location A
        userId || 'User',
        remarks || `Consumed at ${place || 'unknown location'} on ${dateLocal}`,
        workOrder
      );
      
      res.json({ 
        success: true, 
        message: "Spare consumed successfully",
        data: result 
      });
    } catch (error: any) {
      console.error("Error consuming spare:", error);
      res.status(500).json({ error: error.message || "Failed to consume spare" });
    }
  });
  
  // Simple receive endpoint (legacy - receives to Location A by default)
  app.post("/technical/api/spares/:id/receive", async (req, res) => {
    try {
      const spareId = parseInt(req.params.id);
      if (isNaN(spareId)) {
        return res.status(400).json({ error: "Invalid spare ID" });
      }
      
      const { qty, dateLocal, supplierPO, remarks, userId } = req.body;
      
      if (!qty || qty <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }
      
      // Update robLocationA and recalculate total
      const spare = await storage.getSpare(spareId);
      if (!spare) {
        return res.status(404).json({ error: "Spare not found" });
      }
      
      const newRobLocationA = (spare.robLocationA || 0) + qty;
      const updatedSpare = await storage.updateSpare(spareId, {
        robLocationA: newRobLocationA
      });
      
      res.json({ 
        success: true, 
        message: "Spare received successfully",
        data: updatedSpare 
      });
    } catch (error: any) {
      console.error("Error receiving spare:", error);
      res.status(500).json({ error: error.message || "Failed to receive spare" });
    }
  });

  // Rule A3: Location-aware spare consumption with negative prevention
  // Deducts from specified location, never goes negative, returns shortage info
  const consumeFromLocationBodySchema = z.object({
    quantity: z.coerce.number().positive('Quantity must be a positive number'),
    location: z.enum(['A', 'B'], { errorMap: () => ({ message: 'Location must be "A" or "B"' }) }),
    userId: z.string().optional(),
    remarks: z.string().optional(),
    workOrderRef: z.string().optional()
  });
  
  const consumeFromLocationParamsSchema = z.object({
    id: z.coerce.number().int().positive('Spare ID must be a positive integer')
  });
  
  app.post("/technical/api/spares/:id/consume-from-location", async (req, res) => {
    try {
      // Validate params
      const paramsResult = consumeFromLocationParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: paramsResult.error.errors[0]?.message || 'Invalid spare ID',
            field: 'id'
          }
        });
      }
      
      // Validate body
      const bodyResult = consumeFromLocationBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          errors: bodyResult.error.errors.map(err => ({
            code: 'VALIDATION_ERROR',
            message: err.message,
            field: err.path.join('.')
          }))
        });
      }
      
      const { id: spareId } = paramsResult.data;
      const { quantity, location, userId, remarks, workOrderRef } = bodyResult.data;
      
      const result = await storage.consumeSpareFromLocation(
        spareId,
        quantity,
        location,
        userId || 'system',
        remarks,
        workOrderRef
      );
      
      // Rule #9: Warn if shortage occurred
      if (result.shortageQty > 0) {
        return res.json({
          success: true,
          data: result,
          warning: {
            code: 'PARTIAL_CONSUMPTION',
            message: `Requested ${result.requested} but only ${result.deducted} available at Location ${location}`,
            shortageQty: result.shortageQty
          }
        });
      }
      
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error consuming spare from location:", error);
      
      // Map specific error types to appropriate HTTP status codes
      if (error.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || "Failed to consume spare from location"
        }
      });
    }
  });

  // Rule A3: Location-aware spare receiving
  // Adds to specified location
  const receiveToLocationBodySchema = z.object({
    quantity: z.coerce.number().positive('Quantity must be a positive number'),
    location: z.enum(['A', 'B'], { errorMap: () => ({ message: 'Location must be "A" or "B"' }) }),
    userId: z.string().optional(),
    remarks: z.string().optional(),
    supplierPO: z.string().optional(),
    dateLocal: z.string().optional()
  });
  
  const receiveToLocationParamsSchema = z.object({
    id: z.coerce.number().int().positive('Spare ID must be a positive integer')
  });
  
  app.post("/technical/api/spares/:id/receive-to-location", async (req, res) => {
    try {
      // Validate params
      const paramsResult = receiveToLocationParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: paramsResult.error.errors[0]?.message || 'Invalid spare ID',
            field: 'id'
          }
        });
      }
      
      // Validate body
      const bodyResult = receiveToLocationBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          errors: bodyResult.error.errors.map(err => ({
            code: 'VALIDATION_ERROR',
            message: err.message,
            field: err.path.join('.')
          }))
        });
      }
      
      const { id: spareId } = paramsResult.data;
      const { quantity, location, userId, remarks, supplierPO, dateLocal } = bodyResult.data;
      
      const result = await storage.receiveSpareToLocation(
        spareId,
        quantity,
        location,
        userId || 'system',
        remarks,
        supplierPO,
        dateLocal
      );
      
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error receiving spare to location:", error);
      
      if (error.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || "Failed to receive spare to location"
        }
      });
    }
  });

  // ============= INVENTORY MANAGEMENT: LOCATIONS =============
  
  app.get("/technical/api/inventory/locations/:vesselId", async (req, res) => {
    try {
      const locations = await storage.getLocations(req.params.vesselId);
      res.json({ success: true, data: locations });
    } catch (error: any) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/locations/:vesselId/:id", async (req, res) => {
    try {
      const location = await storage.getLocationById(parseInt(req.params.id));
      if (!location) {
        return res.status(404).json({ success: false, error: "Location not found" });
      }
      res.json({ success: true, data: location });
    } catch (error: any) {
      console.error("Error fetching location:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/technical/api/inventory/locations/:vesselId", async (req, res) => {
    try {
      const { locationName, locationType, createdBy } = req.body;
      if (!locationName) {
        return res.status(400).json({ success: false, error: "locationName is required" });
      }
      
      const existing = await storage.getLocationByName(req.params.vesselId, locationName);
      if (existing) {
        return res.json({ success: true, data: existing });
      }
      
      const location = await storage.createLocation({
        vesselId: req.params.vesselId,
        locationName: locationName.trim(),
        locationType: locationType || null,
        createdBy: createdBy || 'system',
      });
      res.json({ success: true, data: location });
    } catch (error: any) {
      console.error("Error creating location:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============= INVENTORY MANAGEMENT: RECONCILIATION =============
  
  app.post("/technical/api/inventory/reconcile/:vesselId", requirePMSAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'System';
      const result = await storage.reconcileSpareLocationStock(req.params.vesselId, userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error reconciling spare location stock:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============= INVENTORY MANAGEMENT: SPARE-COMPONENT LINKS =============
  
  app.get("/technical/api/inventory/spare-links/:vesselId", async (req, res) => {
    try {
      const links = await storage.getSpareComponentLinks(req.params.vesselId);
      res.json({ success: true, data: links });
    } catch (error: any) {
      console.error("Error fetching spare-component links:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/spare-links/by-spare/:spareId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const links = await storage.getSpareComponentLinksBySpare(spareId);
      const linkedComponents = await storage.getLinkedComponentsForSpare(spareId);
      res.json({ success: true, data: { links, linkedComponents } });
    } catch (error: any) {
      console.error("Error fetching links for spare:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/spare-links/by-component/:componentId", async (req, res) => {
    try {
      const links = await storage.getSpareComponentLinksByComponent(req.params.componentId);
      res.json({ success: true, data: links });
    } catch (error: any) {
      console.error("Error fetching links for component:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/technical/api/inventory/spare-links", async (req, res) => {
    try {
      const { vesselId, spareId, componentId, createdBy } = req.body;
      if (!vesselId || !spareId || !componentId) {
        return res.status(400).json({ 
          success: false, 
          error: "vesselId, spareId, and componentId are required" 
        });
      }
      
      const link = await storage.createSpareComponentLink({
        vesselId,
        spareId: parseInt(spareId),
        componentId,
        linkedBy: createdBy || 'system',
      });
      res.json({ success: true, data: link });
    } catch (error: any) {
      console.error("Error creating spare-component link:", error);
      if (error.message?.includes('duplicate')) {
        return res.status(409).json({ success: false, error: "Link already exists" });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/technical/api/inventory/spare-links/:spareId/:componentId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      await storage.deleteSpareComponentLink(spareId, req.params.componentId);
      res.json({ success: true, message: "Link deleted" });
    } catch (error: any) {
      console.error("Error deleting spare-component link:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============= INVENTORY MANAGEMENT: SPARE LOCATION STOCK =============
  
  app.get("/technical/api/inventory/stock/:spareId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const stockRecords = await storage.getSpareLocationStock(spareId);
      const locationsWithQty = await storage.getSpareLocationsWithQty(spareId);
      const robTotal = await storage.getSpareRobTotal(spareId);
      
      res.json({ 
        success: true, 
        data: { 
          spareId,
          robTotal,
          locations: locationsWithQty,
          stockRecords 
        } 
      });
    } catch (error: any) {
      console.error("Error fetching spare stock:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/stock/by-location/:locationId", async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const spares = await storage.getSparesAtLocation(locationId);
      res.json({ success: true, data: spares });
    } catch (error: any) {
      console.error("Error fetching spares at location:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/stock/locations-with-stock/:vesselId", async (req, res) => {
    try {
      const locationsWithStock = await storage.getLocationsWithStock(req.params.vesselId);
      res.json({ success: true, data: locationsWithStock });
    } catch (error: any) {
      console.error("Error fetching locations with stock:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/stock/full-by-location/:vesselId/:locationId", async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const vesselId = req.params.vesselId;
      const spares = await storage.getFullSparesAtLocation(locationId, vesselId);
      res.json({ success: true, data: spares });
    } catch (error: any) {
      console.error("Error fetching full spares at location:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/technical/api/inventory/stock/:spareId/:locationId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const locationId = parseInt(req.params.locationId);
      const { qty, vesselId } = req.body;
      
      if (qty === undefined || qty < 0) {
        return res.status(400).json({ success: false, error: "qty must be >= 0" });
      }
      if (!vesselId) {
        return res.status(400).json({ success: false, error: "vesselId is required" });
      }
      
      const stock = await storage.upsertSpareLocationStock({
        vesselId,
        spareId,
        locationId,
        qty,
      });
      
      res.json({ success: true, data: stock });
    } catch (error: any) {
      console.error("Error setting spare stock:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============= INVENTORY MANAGEMENT: TRANSACTIONS =============
  
  const inventoryTransactionSchema = z.object({
    vesselId: z.string(),
    spareId: z.coerce.number().int().positive(),
    locationId: z.coerce.number().int().positive(),
    eventType: z.enum(['RECEIVE', 'CONSUME', 'ADJUST_OPENING_BALANCE', 'ADJUST_CORRECTION']),
    qtyChange: z.coerce.number().int(),
    referenceType: z.enum(['WORK_ORDER', 'MANUAL', 'EXCEL_IMPORT']),
    referenceId: z.string().optional(),
    referenceNote: z.string().optional(),
    userId: z.string(),
  });

  app.post("/technical/api/inventory/transactions", async (req, res) => {
    try {
      const parsed = inventoryTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
          errors: parsed.error.errors 
        });
      }
      
      const result = await storage.performInventoryTransaction(parsed.data);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Error performing inventory transaction:", error);
      
      // Map domain errors to appropriate HTTP status codes
      if (error.message?.includes('INSUFFICIENT_STOCK')) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'INSUFFICIENT_STOCK', 
            message: error.message.replace('INSUFFICIENT_STOCK: ', '')
          } 
        });
      }
      if (error.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'NEGATIVE_STOCK_PREVENTED', 
            message: error.message.replace('NEGATIVE_STOCK_PREVENTED: ', '')
          } 
        });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: error.message 
          } 
        });
      }
      if (error.message?.includes('requires')) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: error.message 
          } 
        });
      }
      
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  });

  app.get("/technical/api/inventory/transactions/:vesselId", async (req, res) => {
    try {
      const { spareId, locationId, eventType, limit } = req.query;
      
      const transactions = await storage.getInventoryTransactions(req.params.vesselId, {
        spareId: spareId ? parseInt(spareId as string) : undefined,
        locationId: locationId ? parseInt(locationId as string) : undefined,
        eventType: eventType as any,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      
      // Hydrate transactions with spare data including linkedComponents
      const hydratedTransactions = await Promise.all(transactions.map(async (txn) => {
        const spare = await storage.getSpare(txn.spareId);
        const linkedComponents = spare ? await storage.getLinkedComponentsForSpare(spare.id) : [];
        const location = txn.locationId ? await storage.getLocationById(txn.locationId) : null;
        return {
          ...txn,
          spare: spare ? {
            ...spare,
            linkedComponents,
          } : null,
          locationName: location?.locationName || null,
        };
      }));
      
      res.json({ success: true, data: hydratedTransactions });
    } catch (error: any) {
      console.error("Error fetching inventory transactions:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============= INVENTORY MANAGEMENT: ENHANCED SPARE DATA =============
  
  app.get("/technical/api/inventory/spares-with-inventory/:vesselId", async (req, res) => {
    try {
      const spares = await storage.getSparesWithInventoryByVessel(req.params.vesselId);
      res.json({ success: true, data: spares });
    } catch (error: any) {
      console.error("Error fetching spares with inventory:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/spare-with-inventory/:spareId", async (req, res) => {
    try {
      const spareId = parseInt(req.params.spareId);
      const spareWithInventory = await storage.getSpareWithInventory(spareId);
      
      if (!spareWithInventory) {
        return res.status(404).json({ success: false, error: "Spare not found" });
      }
      
      res.json({ success: true, data: spareWithInventory });
    } catch (error: any) {
      console.error("Error fetching spare with inventory:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/spares-by-component/:componentId", async (req, res) => {
    try {
      const spares = await storage.getSparesWithInventoryByComponent(req.params.componentId);
      res.json({ success: true, data: spares });
    } catch (error: any) {
      console.error("Error fetching spares by component:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/technical/api/inventory/spares-by-component-code/:vesselId/:componentCode", async (req, res) => {
    try {
      const { vesselId, componentCode } = req.params;
      const spares = await storage.getSparesWithInventoryByComponentCode(vesselId, componentCode);
      res.json({ success: true, data: spares });
    } catch (error: any) {
      console.error("Error fetching spares by component code:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Chemicals Expiry Report endpoint
  app.get("/technical/api/reports/chemicals-expiry/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { expired, expiring_soon, hazard_class, stock_status } = req.query;
      
      let chemicals: any[];
      if (vesselId === 'all') {
        chemicals = [];
        const allVessels = await storage.getVessels();
        for (const v of allVessels) {
          const vChemicals = await storage.getStoresItems(v.id, 'chemicals');
          chemicals.push(...vChemicals);
        }
      } else {
        chemicals = await storage.getStoresItems(vesselId, 'chemicals');
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
      };
      
      const enriched = chemicals.map((item: any) => {
        const expiryParsed = parseDate(item.expiryDate);
        let daysUntilExpiry: number | null = null;
        let expiryStatus = 'No Date';
        
        if (expiryParsed) {
          daysUntilExpiry = Math.floor((expiryParsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 0) expiryStatus = 'Expired';
          else if (daysUntilExpiry <= 30) expiryStatus = 'Critical';
          else if (daysUntilExpiry <= 60) expiryStatus = 'High';
          else if (daysUntilExpiry <= 90) expiryStatus = 'Medium';
          else expiryStatus = 'OK';
        }
        
        const rob = parseFloat(String(item.rob)) || 0;
        const min = parseFloat(String(item.min)) || 0;
        const stockStatus = rob === 0 ? 'Critical' : rob <= min ? 'Low' : 'OK';
        const hasSds = !!(item.sdsReference && item.sdsReference.trim());
        
        return {
          ...item,
          daysUntilExpiry,
          expiryStatus,
          stockStatus,
          hasSds,
        };
      });
      
      let filtered = enriched;
      
      if (expired === 'true') {
        filtered = filtered.filter((i: any) => i.expiryStatus === 'Expired');
      }
      
      if (expiring_soon) {
        const days = parseInt(expiring_soon as string);
        if (!isNaN(days)) {
          filtered = filtered.filter((i: any) => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= days);
        }
      }
      
      if (hazard_class && hazard_class !== 'all') {
        filtered = filtered.filter((i: any) => i.hazardClassification === hazard_class);
      }
      
      if (stock_status && stock_status !== 'all') {
        filtered = filtered.filter((i: any) => i.stockStatus === stock_status);
      }
      
      const totalChemicals = enriched.length;
      const expiredCount = enriched.filter((i: any) => i.expiryStatus === 'Expired').length;
      const expiringSoonCount = enriched.filter((i: any) => ['Critical', 'High', 'Medium'].includes(i.expiryStatus)).length;
      const withSds = enriched.filter((i: any) => i.hasSds).length;
      const sdsCompliancePercent = totalChemicals > 0 ? Math.round((withSds / totalChemicals) * 100) : 0;
      
      res.json({
        items: filtered,
        summary: {
          totalChemicals,
          expiredCount,
          expiringSoonCount,
          sdsCompliancePercent,
          withSds,
          withoutSds: totalChemicals - withSds,
          lowStockCount: enriched.filter((i: any) => i.stockStatus === 'Low' || i.stockStatus === 'Critical').length,
        }
      });
    } catch (error: any) {
      console.error("Error generating chemicals expiry report:", error);
      res.status(500).json({ error: error.message || "Failed to generate chemicals expiry report" });
    }
  });

  // Stores Low Stock Alert Report endpoint (stores/lubes/chemicals inventory)
  app.get("/technical/api/reports/stores-low-stock-alert/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { category, priority, location } = req.query;
      const filters = {
        category: category as string | undefined,
        priority: priority as string | undefined,
        location: location as string | undefined,
      };

      let result: any;
      if (vesselId === 'all') {
        const allVessels = await storage.getVessels();
        let mergedItems: any[] = [];
        let mergedSummary: any = { totalItems: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalDeficit: 0, estimatedCost: 0 };
        for (const vessel of allVessels) {
          const vesselResult = await lowStockReportService.computeReport(vessel.id, filters);
          mergedItems = mergedItems.concat(vesselResult.items);
          if (vesselResult.summary) {
            mergedSummary.totalItems += vesselResult.summary.totalItems || 0;
            mergedSummary.criticalCount += vesselResult.summary.criticalCount || 0;
            mergedSummary.highCount += vesselResult.summary.highCount || 0;
            mergedSummary.mediumCount += vesselResult.summary.mediumCount || 0;
            mergedSummary.lowCount += vesselResult.summary.lowCount || 0;
            mergedSummary.totalDeficit += vesselResult.summary.totalDeficit || 0;
            mergedSummary.estimatedCost += vesselResult.summary.estimatedCost || 0;
          }
        }
        result = { summary: mergedSummary, items: mergedItems };
      } else {
        result = await lowStockReportService.computeReport(vesselId, filters);
      }

      lowStockReportService.saveSnapshot(
        vesselId, 'low-stock-alert', 'json', result.summary, result.items, filters
      ).catch(err => console.error("Snapshot save error:", err));

      res.json({ summary: result.summary, items: result.items });
    } catch (error: any) {
      console.error("Error generating low stock alert report:", error);
      res.status(500).json({ error: error.message || "Failed to generate low stock alert report" });
    }
  });

  // Stores Low Stock Alert Report - Excel Export (uses same data as GET endpoint)
  app.post("/technical/api/reports/stores-low-stock-alert/:vesselId/excel", async (req, res) => {
    try {
      const { vesselId } = req.params;
      let result: any;
      if (vesselId === 'all') {
        const allVessels = await storage.getVessels();
        let mergedItems: any[] = [];
        let mergedSummary: any = { totalItems: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalDeficit: 0, estimatedCost: 0 };
        for (const vessel of allVessels) {
          const vesselResult = await lowStockReportService.computeReport(vessel.id);
          mergedItems = mergedItems.concat(vesselResult.items);
          if (vesselResult.summary) {
            mergedSummary.totalItems += vesselResult.summary.totalItems || 0;
            mergedSummary.criticalCount += vesselResult.summary.criticalCount || 0;
            mergedSummary.highCount += vesselResult.summary.highCount || 0;
            mergedSummary.mediumCount += vesselResult.summary.mediumCount || 0;
            mergedSummary.lowCount += vesselResult.summary.lowCount || 0;
            mergedSummary.totalDeficit += vesselResult.summary.totalDeficit || 0;
            mergedSummary.estimatedCost += vesselResult.summary.estimatedCost || 0;
          }
        }
        result = { summary: mergedSummary, items: mergedItems };
      } else {
        result = await lowStockReportService.computeReport(vesselId);
      }
      const lowStockItems = result.items;

      lowStockReportService.saveSnapshot(
        vesselId, 'low-stock-alert', 'excel', result.summary, lowStockItems
      ).catch(err => console.error("Snapshot save error:", err));

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Low Stock Alert');

      const headerRow = sheet.addRow([
        'S.No', 'Priority', 'Item Code', 'Item Name', 'Type', 'Category',
        'ROB', 'Min Stock', 'Deficit', 'UOM',
        'Avg Monthly', 'Days to Stockout', 'Est. Cost'
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.columns = [
        { width: 6 }, { width: 10 }, { width: 14 }, { width: 30 }, { width: 12 }, { width: 16 },
        { width: 8 }, { width: 10 }, { width: 8 }, { width: 8 },
        { width: 16 }, { width: 18 }, { width: 14 }
      ];

      const priorityColors: Record<string, string> = {
        Critical: 'FFFEE2E2',
        High: 'FFFFF7ED',
        Medium: 'FFFFFBEB',
      };

      lowStockItems.forEach((item: any, idx: number) => {
        const row = sheet.addRow([
          idx + 1, item.priority, item.itemCode, item.itemName, item.itemType, item.category,
          item.rob, item.minStock, item.deficit, item.uom || '-',
          item.avgMonthlyConsumption, item.daysUntilStockout ?? 'N/A', item.estimatedCost !== null ? `$${item.estimatedCost}` : 'N/A'
        ]);
        const bgColor = priorityColors[item.priority] || 'FFFFFFFF';
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.alignment = { vertical: 'middle' };
      });

      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Low Stock Alert Report Summary']);
      summarySheet.getRow(1).font = { bold: true, size: 14 };
      summarySheet.addRow([]);
      summarySheet.addRow(['Metric', 'Count']);
      summarySheet.getRow(3).font = { bold: true };
      summarySheet.addRow(['Total Low Stock Items', lowStockItems.length]);
      summarySheet.addRow(['Critical (Out of Stock)', lowStockItems.filter((i: any) => i.priority === 'Critical').length]);
      summarySheet.addRow(['High Priority', lowStockItems.filter((i: any) => i.priority === 'High').length]);
      summarySheet.addRow(['Medium Priority', lowStockItems.filter((i: any) => i.priority === 'Medium').length]);
      summarySheet.addRow([]);
      summarySheet.addRow(['By Type', 'Count']);
      summarySheet.getRow(9).font = { bold: true };
      summarySheet.addRow(['Stores', lowStockItems.filter((i: any) => i.itemType === 'stores').length]);
      summarySheet.addRow(['Lubricants', lowStockItems.filter((i: any) => i.itemType === 'lubes' || i.itemType === 'lubricants').length]);
      summarySheet.addRow(['Chemicals', lowStockItems.filter((i: any) => i.itemType === 'chemicals').length]);
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 12;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=low-stock-alert-report.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Error generating low stock alert Excel:", error);
      res.status(500).json({ error: error.message || "Failed to generate Excel report" });
    }
  });

  app.get("/technical/api/reports/snapshots/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { reportType, startDate, endDate, limit: limitParam } = req.query;
      const snapshots = await lowStockReportService.getSnapshots(
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
  });

  app.get("/technical/api/reports/snapshots/detail/:snapshotId", async (req, res) => {
    try {
      const snapshotId = parseInt(req.params.snapshotId);
      if (isNaN(snapshotId)) {
        return res.status(400).json({ error: "Invalid snapshot ID" });
      }
      const snapshot = await lowStockReportService.getSnapshotDetail(snapshotId);
      if (!snapshot) {
        return res.status(404).json({ error: "Snapshot not found" });
      }
      res.json(snapshot);
    } catch (error: any) {
      console.error("Error fetching snapshot detail:", error);
      res.status(500).json({ error: error.message || "Failed to fetch snapshot detail" });
    }
  });

  // Stores endpoints - ZERO PMS linkages (isolated from Components/Jobs/Work Orders per Global Business Rule Section 7.2)
  // Note: Auth removed to match spares endpoint pattern for development
  app.get("/technical/api/stores", async (req, res) => {
    try {
      const allVessels = await storage.getVessels();
      const allStores: any[] = [];
      for (const vessel of allVessels) {
        const vesselStores = await storage.getStoresItems(vessel.id, req.query.itemType as string | undefined);
        allStores.push(...vesselStores);
      }
      res.json(allStores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  app.get("/technical/api/stores/:vesselId", async (req, res) => {
    try {
      const { itemType } = req.query;
      let stores: any[];
      if (req.params.vesselId === 'all') {
        stores = [];
        const allVessels = await storage.getVessels();
        for (const v of allVessels) {
          const vStores = await storage.getStoresItems(v.id, itemType as string | undefined);
          stores.push(...vStores);
        }
      } else {
        stores = await storage.getStoresItems(
          req.params.vesselId,
          itemType as string | undefined
        );
      }
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });
  
  app.get("/technical/api/stores/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { itemType } = req.query;
      let history: any[];
      if (vesselId === 'all') {
        history = [];
        const allVessels = await storage.getVessels();
        for (const v of allVessels) {
          const vHistory = await storage.getStoresTransactionHistory(v.id, itemType as string | undefined);
          history.push(...vHistory);
        }
      } else {
        history = await storage.getStoresTransactionHistory(
          vesselId,
          itemType as string | undefined
        );
      }
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores history" });
    }
  });
  
  app.get("/technical/api/stores/item/:id/history", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const history = await storage.getStoresItemHistory(itemId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch item history" });
    }
  });
  
  app.post("/technical/api/stores/:vesselId/create", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { vesselId } = req.params;
      const userId = req.user?.id?.toString() || 'System';
      const itemData = { ...req.body, vesselId };

      if (itemData.manufactureDate && itemData.expiryDate) {
        const mfg = new Date(itemData.manufactureDate);
        const exp = new Date(itemData.expiryDate);
        if (!isNaN(mfg.getTime()) && !isNaN(exp.getTime()) && exp <= mfg) {
          return res.status(400).json({ error: "Expiry date must be after manufacture date" });
        }
      }

      const item = await storage.createStoresItem(itemData, userId);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create stores item" });
    }
  });
  
  app.put("/technical/api/stores/item/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const itemId = parseInt(req.params.id);
      // Strip ROB fields - these must go through dedicated methods
      const { rob, robLocationA, robLocationB, ...safeData } = req.body;

      if (safeData.manufactureDate && safeData.expiryDate) {
        const mfg = new Date(safeData.manufactureDate);
        const exp = new Date(safeData.expiryDate);
        if (!isNaN(mfg.getTime()) && !isNaN(exp.getTime()) && exp <= mfg) {
          return res.status(400).json({ error: "Expiry date must be after manufacture date" });
        }
      }

      const item = await storage.updateStoresItem(itemId, safeData);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update stores item" });
    }
  });
  
  // Adjustment endpoint for manual inventory corrections
  app.post("/technical/api/stores/item/:id/adjust", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const { newRob, location, remarks, place, dateLocal, tz } = req.body;
      const userId = req.user?.id?.toString() || 'System';
      
      if (newRob === undefined || newRob < 0) {
        return res.status(400).json({ error: "Valid newRob value (>= 0) is required" });
      }
      if (!location || !['A', 'B'].includes(location)) {
        return res.status(400).json({ error: "Location must be 'A' or 'B'" });
      }
      
      const item = await storage.adjustStoresItem(
        itemId,
        Number(newRob),
        location as 'A' | 'B',
        userId,
        remarks,
        place,
        dateLocal,
        tz
      );
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to adjust stores item" });
    }
  });
  
  // PATCH endpoint for partial updates (location ROB updates)
  // Now routes location changes through transfer method to create history
  app.patch("/technical/api/stores/:vesselId/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const { robLocationA, robLocationB, rob, remarks, place, dateLocal, tz } = req.body;
      const userId = req.user?.id?.toString() || 'System';
      
      // Check if location ROB values are being changed - route to transfer method
      if (robLocationA !== undefined || robLocationB !== undefined) {
        // Validate numeric inputs
        if (robLocationA !== undefined && (isNaN(Number(robLocationA)) || Number(robLocationA) < 0)) {
          return res.status(400).json({ error: "robLocationA must be a valid non-negative number" });
        }
        if (robLocationB !== undefined && (isNaN(Number(robLocationB)) || Number(robLocationB) < 0)) {
          return res.status(400).json({ error: "robLocationB must be a valid non-negative number" });
        }
        
        // Get current item to determine if this is a location transfer
        const currentItem = await storage.getStoresItem(itemId);
        if (!currentItem) {
          return res.status(404).json({ error: "Stores item not found" });
        }
        
        const newLocA = robLocationA !== undefined ? String(Number(robLocationA)) : currentItem.robLocationA;
        const newLocB = robLocationB !== undefined ? String(Number(robLocationB)) : currentItem.robLocationB;
        
        // Use transfer method which creates ledger history for true transfers
        const result = await storage.transferStoresItemLocation(
          itemId,
          newLocA,
          newLocB,
          userId,
          remarks,
          place,
          dateLocal,
          tz
        );
        return res.json(result.item);
      }
      
      // Direct ROB updates without location specification are not allowed
      // All stock changes must go through consume, receive, transfer, or adjust methods
      if (rob !== undefined) {
        return res.status(400).json({ 
          error: "Direct ROB updates are not allowed. Use location-specific updates (robLocationA/robLocationB) or consume/receive endpoints." 
        });
      }
      
      // Handle non-ROB updates (itemName, uom, etc.) through regular update
      // Keep remarks in otherUpdates since it's a valid field for stores items
      const { robLocationA: _a, robLocationB: _b, rob: _r, place: _p, dateLocal: _d, tz: _t, ...otherUpdates } = req.body;
      if (Object.keys(otherUpdates).length > 0) {
        if (otherUpdates.manufactureDate && otherUpdates.expiryDate) {
          const mfg = new Date(otherUpdates.manufactureDate);
          const exp = new Date(otherUpdates.expiryDate);
          if (!isNaN(mfg.getTime()) && !isNaN(exp.getTime()) && exp <= mfg) {
            return res.status(400).json({ error: "Expiry date must be after manufacture date" });
          }
        }
        const item = await storage.updateStoresItem(itemId, otherUpdates);
        return res.json(item);
      }
      
      // No valid update fields provided
      return res.status(400).json({ error: "No valid update fields provided" });
    } catch (error: any) {
      console.error("Error updating stores item:", error);
      res.status(500).json({ error: error.message || "Failed to update stores item" });
    }
  });
  
  app.delete("/technical/api/stores/item/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const itemId = parseInt(req.params.id);
      await storage.deleteStoresItem(itemId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete stores item" });
    }
  });
  
  // Batch consume stores
  app.post("/technical/api/stores/:vesselId/batch-consume", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { items, consumedBy } = req.body;
      const userId = req.user?.id?.toString() || consumedBy || 'System';
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      
      const results = [];
      for (const item of items) {
        if (!item.itemId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: "Each item must have a valid itemId and positive quantity" });
        }
        const result = await storage.consumeStoresItem(
          item.itemId,
          item.quantity,
          item.location || 'A',
          userId,
          item.notes,
          item.place,
          item.dateLocal,
          item.tz
        );
        results.push(result);
      }
      
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to consume stores" });
    }
  });
  
  // Batch receive stores
  app.post("/technical/api/stores/:vesselId/batch-receive", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { items, purchaseOrderRef, receivedBy } = req.body;
      const userId = req.user?.id?.toString() || receivedBy || 'System';
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      
      const results = [];
      for (const item of items) {
        if (!item.itemId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: "Each item must have a valid itemId and positive quantity" });
        }
        const result = await storage.receiveStoresItem(
          item.itemId,
          item.quantity,
          item.location || 'A',
          userId,
          item.notes,
          purchaseOrderRef,
          item.place,
          item.dateLocal,
          item.tz
        );
        results.push(result);
      }
      
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to receive stores" });
    }
  });
  
  // Reports endpoint
  app.get("/technical/api/reports/:reportType", async (req, res, next) => {
    try {
      const { reportType } = req.params;
      
      // Skip to next handler for report types that have dedicated routes defined later
      const dedicatedReportRoutes = [
        'equipment-utilization-summary',
        'running-hours-anomaly-detection',
        'critical-equipment-status',
        'unplanned-breakdown-jobs',
        'crew-workload-distribution',
        'ihm-inventory-status',
        'change-requests-status-tracking',
        'critical-components-list',
        'critical-equipment-schedule',
        'lsa-ffa-master-list',
        'lsa-ffa-maintenance-schedule'
      ];
      
      if (dedicatedReportRoutes.includes(reportType)) {
        return next('route');
      }
      
      const { vesselId, dateFrom, dateTo, format } = req.query;
      
      // Mock data for now - replace with actual report generation
      const reportData: {
        title: string;
        vessel: string;
        period: string;
        generatedAt: string;
        data: any[];
      } = {
        title: `${reportType.toUpperCase()} Report`,
        vessel: (vesselId as string) || 'All Vessels',
        period: `${(dateFrom as string) || 'Start'} to ${(dateTo as string) || 'End'}`,
        generatedAt: new Date().toISOString(),
        data: []
      };
      
      // Generate specific report data based on type
      switch(reportType) {
        case 'inventory':
          const spares = await storage.getSpares(vesselId as string);
          reportData.data = spares.map(spare => ({
            partCode: spare.partCode,
            partName: spare.partName,
            stockQuantity: spare.rob || 0,
            minimumQuantity: spare.min || 0,
            status: (spare.rob || 0) <= (spare.min || 0) ? 'Low Stock' : 'OK'
          }));
          break;
        case 'consumption':
          // getSpareHistory only takes vesselId as parameter
          const history = await storage.getSpareHistory(vesselId as string);
          reportData.data = history;
          break;
        // Add more report types as needed
      }
      
      // If format is CSV, convert and send as file
      if (format === 'csv') {
        const csv = convertToCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.csv"`);
        return res.send(csv);
      }
      
      res.json(reportData);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });
  
  // User routes
  app.get("/technical/api/me", async (req, res) => {
    res.json({ 
      user: { 
        id: 1, 
        name: "Admin User",
        role: "admin",
        email: "admin@pms.com"
      } 
    });
  });
  
  app.get("/technical/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Register chatbot routes
  app.use(chatbotRouter);

  // Register bulk routes
  app.use("/technical/api/bulk", bulkRouter);
  
  // Register alert routes
  app.use("/technical/api/alerts", alertRouter);
  
  // Register form routes
  app.use("/technical/api/forms", formRouter);
  
  // Register Fleet Admin routes
  app.use("/technical/api/fleet-admin", fleetAdminRouter);
  
  // Mount the Change Requests router  
  const changeRequestsRouter = createChangeRequestsRouter(storage);
  app.use("/technical/api/change-requests", changeRequestsRouter);

  // ============================================================================
  // CHANGE REQUESTS STATUS & TRACKING REPORT
  // ============================================================================

  app.get("/technical/api/reports/change-requests-status-tracking", async (req, res) => {
    try {
      const { vesselId, startDate, endDate, status, category } = req.query;

      const allVessels = await storage.getVessels();
      const vesselMap = new Map(allVessels.map(v => [v.id, v]));

      let allRequests: any[] = [];
      if (vesselId && vesselId !== 'all') {
        allRequests = await storage.getChangeRequests({ vesselId: vesselId as string });
      } else {
        for (const v of allVessels) {
          const vReqs = await storage.getChangeRequests({ vesselId: v.id });
          allRequests.push(...vReqs);
        }
      }

      if (status && status !== 'all') {
        allRequests = allRequests.filter(r => r.status === status);
      }
      if (category && category !== 'all') {
        allRequests = allRequests.filter(r => r.category === category);
      }
      if (startDate) {
        const start = new Date(startDate as string);
        allRequests = allRequests.filter(r => {
          const d = r.submittedAt ? new Date(r.submittedAt) : new Date(r.createdAt);
          return d >= start;
        });
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        allRequests = allRequests.filter(r => {
          const d = r.submittedAt ? new Date(r.submittedAt) : new Date(r.createdAt);
          return d <= end;
        });
      }

      allRequests.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      const byStatus: Record<string, number> = { draft: 0, submitted: 0, returned: 0, approved: 0, rejected: 0 };
      const byCategory: Record<string, number> = { components: 0, work_orders: 0, spares: 0, stores: 0 };
      let totalApprovalTime = 0;
      let approvalCount = 0;

      for (const r of allRequests) {
        if (byStatus[r.status] !== undefined) byStatus[r.status]++;
        if (byCategory[r.category] !== undefined) byCategory[r.category]++;
        if (r.status === 'approved' && r.submittedAt && r.reviewedAt) {
          const diff = new Date(r.reviewedAt).getTime() - new Date(r.submittedAt).getTime();
          if (diff > 0) {
            totalApprovalTime += diff / (1000 * 60 * 60);
            approvalCount++;
          }
        }
      }

      const enrichedRequests = await Promise.all(allRequests.map(async (r) => {
        const vessel = vesselMap.get(r.vesselId);
        let targetName = '';
        try {
          if (r.targetType && r.targetId) {
            switch (r.targetType) {
              case 'component': {
                const comp = await storage.getComponent(r.targetId);
                targetName = comp?.name || comp?.componentCode || r.targetId;
                break;
              }
              case 'job': {
                const job = await storage.getJob(r.targetId);
                targetName = job?.jobTitle || job?.jobCode || r.targetId;
                break;
              }
              case 'work_order': {
                const wo = await storage.getWorkOrder(r.targetId);
                targetName = wo?.jobTitle || wo?.workOrderNumber || r.targetId;
                break;
              }
              case 'spare': {
                const spare = await storage.getSpare(parseInt(r.targetId));
                targetName = spare?.partName || spare?.partCode || r.targetId;
                break;
              }
              case 'store': {
                const store = await storage.getStoresItem(parseInt(r.targetId));
                targetName = store?.itemName || store?.itemCode || r.targetId;
                break;
              }
            }
          }
        } catch { targetName = r.targetId || ''; }

        let fieldChanges: any[] = [];
        let changesCount = 0;
        if (r.proposedChangesJson) {
          const changes = Array.isArray(r.proposedChangesJson) ? r.proposedChangesJson : [];
          changesCount = changes.length;
          fieldChanges = changes.map((c: any) => ({
            fieldPath: c.fieldPath || c.columnName || c.field || '',
            oldValue: c.oldValue ?? c.currentValue ?? null,
            newValue: c.newValue ?? c.proposedValue ?? null,
            fieldLabel: c.displayName || c.fieldLabel || c.fieldPath || c.columnName || c.field || ''
          }));
        }

        let cycleTimeHours: number | null = null;
        if (r.submittedAt && r.reviewedAt) {
          const diff = new Date(r.reviewedAt).getTime() - new Date(r.submittedAt).getTime();
          if (diff > 0) cycleTimeHours = Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
        }

        return {
          id: r.id,
          title: r.title,
          category: r.category,
          status: r.status,
          requestedBy: {
            userId: r.requestedByUserId,
            name: r.requestedByUserId || 'Unknown',
            rank: ''
          },
          reviewedBy: r.reviewedByUserId ? {
            userId: r.reviewedByUserId,
            name: r.reviewedByUserId || 'Unknown',
            rank: ''
          } : null,
          vessel: {
            id: r.vesselId,
            name: vessel?.name || r.vesselId
          },
          submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
          reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
          createdAt: new Date(r.createdAt).toISOString(),
          reason: r.reason,
          targetInfo: {
            type: r.targetType || '',
            id: r.targetId || '',
            name: targetName
          },
          changesCount,
          fieldChanges,
          cycleTimeHours,
          revisionNumber: r.revisionNumber || 0
        };
      }));

      res.json({
        summary: {
          totalRequests: allRequests.length,
          byStatus,
          byCategory,
          avgApprovalTimeHours: approvalCount > 0 ? Math.round((totalApprovalTime / approvalCount) * 10) / 10 : 0,
          pendingRequests: byStatus.submitted + byStatus.returned
        },
        requests: enrichedRequests
      });
    } catch (error) {
      console.error("Error generating change requests status report:", error);
      res.status(500).json({ error: "Failed to generate change requests status report" });
    }
  });

  app.get("/technical/api/reports/change-requests-status-tracking/export", async (req, res) => {
    try {
      const { vesselId, startDate, endDate, status, category } = req.query;

      const params = new URLSearchParams();
      if (vesselId) params.set('vesselId', vesselId as string);
      if (startDate) params.set('startDate', startDate as string);
      if (endDate) params.set('endDate', endDate as string);
      if (status) params.set('status', status as string);
      if (category) params.set('category', category as string);

      const port = process.env.PORT || 5000;
      const response = await fetch(`http://localhost:${port}/technical/api/reports/change-requests-status-tracking?${params.toString()}`);
      const reportData = await response.json();

      const wb = new ExcelJS.Workbook();
      wb.creator = 'PMS Report Generator';
      wb.created = new Date();

      const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
      const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      const subHeaderFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };
      const summaryLabelFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF2' } };
      const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFD0D5DD' } },
        left: { style: 'thin', color: { argb: 'FFD0D5DD' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
        right: { style: 'thin', color: { argb: 'FFD0D5DD' } }
      };

      const catNames: Record<string, string> = { components: 'Components', work_orders: 'Work Orders', spares: 'Spares', stores: 'Stores' };
      const statusNames: Record<string, string> = { draft: 'Draft', submitted: 'Submitted', returned: 'Returned', approved: 'Approved', rejected: 'Rejected' };

      const resolvedVesselName = vesselId && vesselId !== 'all'
        ? (await storage.getVessels()).find(v => v.id === vesselId)?.name || vesselId
        : 'All Vessels';

      const ws = wb.addWorksheet('CR Status & Tracking');
      const totalColumns = 13;

      const s = reportData.summary;
      const totalReqs = s.totalRequests;
      const approvedPct = totalReqs > 0 ? Math.round((s.byStatus.approved / totalReqs) * 100) : 0;
      const rejectedPct = totalReqs > 0 ? Math.round((s.byStatus.rejected / totalReqs) * 100) : 0;

      const titleRow = ws.addRow(['Change Requests Status & Tracking']);
      ws.mergeCells(1, 1, 1, totalColumns);
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E5A8E' } };
      titleRow.getCell(1).alignment = { horizontal: 'center' };

      const subtitleRow = ws.addRow([`Vessel: ${resolvedVesselName} | Generated: ${new Date().toLocaleDateString()} | Total Requests: ${totalReqs}`]);
      ws.mergeCells(2, 1, 2, totalColumns);
      subtitleRow.getCell(1).font = { size: 10, italic: true };
      subtitleRow.getCell(1).alignment = { horizontal: 'center' };

      ws.addRow([]);

      const summaryItems = [
        { label: 'Total Requests', value: s.totalRequests },
        { label: `Approved (${approvedPct}%)`, value: s.byStatus.approved },
        { label: `Rejected (${rejectedPct}%)`, value: s.byStatus.rejected },
        { label: 'Pending Review', value: s.pendingRequests },
        { label: 'Avg Approval Time (hrs)', value: s.avgApprovalTimeHours },
        { label: 'Components', value: s.byCategory.components },
        { label: 'Work Orders', value: s.byCategory.work_orders },
        { label: 'Spares', value: s.byCategory.spares },
        { label: 'Stores', value: s.byCategory.stores }
      ];

      const summaryHeaderRow = ws.addRow(['Summary']);
      ws.mergeCells(ws.rowCount, 1, ws.rowCount, totalColumns);
      summaryHeaderRow.getCell(1).font = { bold: true, size: 11 };
      summaryHeaderRow.getCell(1).fill = headerFill;
      summaryHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };

      summaryItems.forEach((item) => {
        const r = ws.addRow([item.label, item.value]);
        r.getCell(1).font = { bold: true, size: 10 };
        r.getCell(1).fill = summaryLabelFill;
        r.getCell(1).border = borderStyle;
        r.getCell(2).border = borderStyle;
        r.getCell(2).alignment = { horizontal: 'center' };
      });

      ws.addRow([]);

      const colHeaders = ['ID', 'Title', 'Category', 'Status', 'Requested By', 'Vessel', 'Submitted', 'Reviewed By', 'Reviewed At', 'Cycle Time (hrs)', 'Target', 'Changes', 'Reason'];
      const colWidths = [10, 40, 18, 16, 20, 18, 18, 20, 18, 16, 28, 12, 30];
      colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      const tableHeaderRow = ws.addRow(colHeaders);
      tableHeaderRow.eachCell(cell => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.border = borderStyle;
        cell.alignment = { horizontal: 'center' };
      });

      const headerRowNum = ws.rowCount;
      ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };
      ws.views = [{ state: 'frozen', ySplit: headerRowNum, xSplit: 0 }];

      const fmtDate = (d: string | null) => {
        if (!d) return '-';
        const dt = new Date(d);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${dt.getDate().toString().padStart(2,'0')} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
      };
      (reportData.requests || []).forEach((req: any, i: number) => {
        const r = ws.addRow([
          req.id,
          req.title,
          catNames[req.category] || req.category,
          statusNames[req.status] || req.status,
          req.requestedBy?.name || '-',
          req.vessel?.name || '-',
          fmtDate(req.submittedAt || req.createdAt),
          req.reviewedBy?.name || '-',
          fmtDate(req.reviewedAt),
          req.cycleTimeHours ?? '-',
          req.targetInfo?.name ? `${catNames[req.targetInfo.type] || req.targetInfo.type} - ${req.targetInfo.name}` : '-',
          req.changesCount,
          req.reason || '-'
        ]);
        r.eachCell(cell => { cell.border = borderStyle; });
        if (i % 2 === 1) r.eachCell(cell => { cell.fill = subHeaderFill; });
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Change_Requests_Status_Tracking_${resolvedVesselName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await wb.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error exporting change requests report to Excel:", error);
      res.status(500).json({ error: "Failed to export change requests report" });
    }
  });

  // Template builder endpoints
  app.get("/technical/api/template-builder/:templateType", async (req, res) => {
    try {
      const { templateType } = req.params;
      
      // Mock response for template builder
      const template = {
        id: templateType,
        name: `${templateType} Template`,
        description: `Template for ${templateType}`,
        fields: [],
        lastModified: new Date().toISOString()
      };
      
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Critical Equipment Reports API routes
  // ═══════════════════════════════════════════════════════════════

  app.get("/technical/api/reports/critical-components-list", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const category = req.query.category as string | undefined;
      const classItemFilter = req.query.classItem as string | undefined;
      const format = (req.query.format as string) || 'json';

      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      const allVessels = await storage.getVessels();
      let allComponents: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          allComponents = allComponents.concat(await storage.getComponents(v.id));
        }
      } else {
        allComponents = await storage.getComponents(vesselId);
      }

      let filteredComponents = allComponents.filter((c: any) => c.critical === true);

      if (category) {
        filteredComponents = filteredComponents.filter((c: any) => c.category === category);
      }

      if (classItemFilter === 'class') {
        filteredComponents = filteredComponents.filter((c: any) => c.classItem === true);
      } else if (classItemFilter === 'non-class') {
        filteredComponents = filteredComponents.filter((c: any) => c.classItem === false);
      }

      const data = filteredComponents.map((c: any, i: number) => {
        const parent = allComponents.find((p: any) => p.id === c.parentId);
        return {
          sno: i + 1,
          componentCode: c.componentCode || '-',
          componentName: c.name || '-',
          parentCode: parent?.componentCode || '-',
          parentName: parent?.name || '-',
          category: c.category || '-',
          location: c.location || '-',
          maker: c.maker || '-',
          model: c.model || '-',
          serialNo: c.serialNo || '-',
          installationDate: c.installationDate || '-',
          classItem: c.classItem ? 'Yes' : 'No',
          conditionBased: c.conditionBased ? 'Yes' : 'No',
          isActive: c.isActive !== false ? 'Yes' : 'No'
        };
      });

      const classItemCount = filteredComponents.filter(c => c.classItem === true).length;
      const nonClassCount = filteredComponents.filter(c => c.classItem !== true).length;
      const activeCount = filteredComponents.filter(c => c.isActive !== false).length;
      const inactiveCount = filteredComponents.filter(c => c.isActive === false).length;

      const byCategory: Record<string, number> = {};
      filteredComponents.forEach(c => {
        const cat = c.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      });

      if (format === 'excel') {
        const columns: ColumnDef[] = [
          { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
          { key: 'componentCode', header: 'Component Code', width: 18, type: 'text' },
          { key: 'componentName', header: 'Component Name', width: 35, type: 'text' },
          { key: 'parentCode', header: 'Parent Code', width: 18, type: 'text' },
          { key: 'parentName', header: 'Parent Name', width: 30, type: 'text' },
          { key: 'category', header: 'Category', width: 25, type: 'text' },
          { key: 'location', header: 'Location', width: 20, type: 'text' },
          { key: 'maker', header: 'Maker', width: 20, type: 'text' },
          { key: 'model', header: 'Model', width: 20, type: 'text' },
          { key: 'serialNo', header: 'Serial No', width: 18, type: 'text' },
          { key: 'installationDate', header: 'Installation Date', width: 16, type: 'text' },
          { key: 'classItem', header: 'Class Item', width: 12, type: 'text', align: 'center' },
          { key: 'conditionBased', header: 'Condition Based', width: 14, type: 'text', align: 'center' },
          { key: 'isActive', header: 'Active', width: 10, type: 'text', align: 'center' }
        ];

        const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
        const lastCol = getLastColumnLetter(columns.length);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Critical Components');

        applyStandardHeader(ws, 'Critical Components Master List', `${data.length} critical components`, vesselName, data.length, lastCol);
        applyStandardTableHeader(ws, columns);
        applyStandardDataRows(ws, data, columns);

        const summaryItems: SummaryItem[] = [
          { label: 'Total Critical Components', value: data.length },
          { label: 'Class Items', value: classItemCount },
          { label: 'Non-Class Items', value: nonClassCount },
          { label: 'Active', value: activeCount },
          { label: 'Inactive', value: inactiveCount }
        ];

        const summaryStartRow = 8 + data.length + 1;
        const lastRow = applyStandardSummary(ws, summaryItems, summaryStartRow, columns.length);
        applyStandardPageSetup(ws, 7, columns.length, lastRow, vesselName);

        const buffer = await wb.xlsx.writeBuffer();
        const filename = generateFilename('Critical_Components_List', vesselName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer as ArrayBuffer));
        return;
      }

      res.json({
        components: data,
        summary: {
          total: filteredComponents.length,
          byCategory,
          classItems: classItemCount,
          nonClassItems: nonClassCount,
          activeCount,
          inactiveCount
        }
      });
    } catch (error: any) {
      console.error("Error generating critical components report:", error);
      res.status(500).json({ error: "Failed to generate report", details: error.message });
    }
  });

  app.get("/technical/api/reports/lsa-ffa-master-list", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const equipmentType = req.query.equipmentType as string | undefined;
      const format = (req.query.format as string) || 'json';

      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      const allVessels = await storage.getVessels();
      let allComponents: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          allComponents = allComponents.concat(await storage.getComponents(v.id));
        }
      } else {
        allComponents = await storage.getComponents(vesselId);
      }

      let filteredComponents = allComponents.filter((c: any) =>
        c.eqptSystemDept === 'LSA' || c.eqptSystemDept === 'FFA'
      );

      if (equipmentType && equipmentType !== 'all') {
        filteredComponents = filteredComponents.filter((c: any) => c.eqptSystemDept === equipmentType);
      }

      const data = filteredComponents.map((c: any, i: number) => ({
        sno: i + 1,
        componentCode: c.componentCode || '-',
        componentName: c.name || '-',
        equipmentType: c.eqptSystemDept || '-',
        location: c.location || '-',
        maker: c.maker || '-',
        model: c.model || '-',
        serialNo: c.serialNo || '-',
        installationDate: c.installationDate || '-',
        critical: c.critical ? 'Yes' : 'No',
        classItem: c.classItem ? 'Yes' : 'No',
        isActive: c.isActive !== false ? 'Yes' : 'No',
        vesselId: c.vesselId || '-'
      }));

      const lsaCount = filteredComponents.filter(c => c.eqptSystemDept === 'LSA').length;
      const ffaCount = filteredComponents.filter(c => c.eqptSystemDept === 'FFA').length;
      const activeCount = filteredComponents.filter(c => c.isActive !== false).length;
      const inactiveCount = filteredComponents.filter(c => c.isActive === false).length;

      if (format === 'excel') {
        const columns: ColumnDef[] = [
          { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
          { key: 'componentCode', header: 'Component Code', width: 20, type: 'text' },
          { key: 'componentName', header: 'Component Name', width: 40, type: 'text' },
          { key: 'equipmentType', header: 'Equipment Type', width: 16, type: 'text', align: 'center' },
          { key: 'location', header: 'Location', width: 20, type: 'text' },
          { key: 'maker', header: 'Maker', width: 20, type: 'text' },
          { key: 'model', header: 'Model', width: 20, type: 'text' },
          { key: 'serialNo', header: 'Serial No', width: 18, type: 'text' },
          { key: 'installationDate', header: 'Installation Date', width: 16, type: 'text' },
          { key: 'critical', header: 'Criticality', width: 12, type: 'text', align: 'center' },
          { key: 'classItem', header: 'Class Item', width: 12, type: 'text', align: 'center' },
          { key: 'isActive', header: 'Active', width: 10, type: 'text', align: 'center' }
        ];

        const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
        const lastCol = getLastColumnLetter(columns.length);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('LSA-FFA Equipment');

        applyStandardHeader(ws, 'LSA/FFA Equipment Master List', `${data.length} components (LSA: ${lsaCount}, FFA: ${ffaCount})`, vesselName, data.length, lastCol);
        applyStandardTableHeader(ws, columns);
        applyStandardDataRows(ws, data, columns);

        const summaryItems: SummaryItem[] = [
          { label: 'Total LSA Components', value: lsaCount },
          { label: 'Total FFA Components', value: ffaCount },
          { label: 'Total Combined', value: data.length },
          { label: 'Active', value: activeCount },
          { label: 'Inactive', value: inactiveCount }
        ];

        const summaryStartRow = 8 + data.length + 1;
        const lastRow = applyStandardSummary(ws, summaryItems, summaryStartRow, columns.length);
        applyStandardPageSetup(ws, 7, columns.length, lastRow, vesselName);

        const buffer = await wb.xlsx.writeBuffer();
        const filename = generateFilename('LSA_FFA_Equipment_Master_List', vesselName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer as ArrayBuffer));
        return;
      }

      res.json({
        components: data,
        summary: {
          total: filteredComponents.length,
          lsaCount,
          ffaCount,
          activeCount,
          inactiveCount
        }
      });
    } catch (error: any) {
      console.error("Error generating LSA/FFA master list report:", error);
      res.status(500).json({ error: "Failed to generate report", details: error.message });
    }
  });

  // LSA/FFA Maintenance Schedule & Status Report
  app.get("/technical/api/reports/lsa-ffa-maintenance-schedule", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const statusFilter = req.query.status as string | undefined;
      const equipmentType = req.query.equipmentType as string | undefined;
      const format = (req.query.format as string) || 'json';

      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      const allVessels = await storage.getVessels();
      let allComponents: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          allComponents = allComponents.concat(await storage.getComponents(v.id));
        }
      } else {
        allComponents = await storage.getComponents(vesselId);
      }

      let lsaFfaComponents = allComponents.filter((c: any) =>
        c.eqptSystemDept === 'LSA' || c.eqptSystemDept === 'FFA'
      );

      if (equipmentType && equipmentType !== 'all') {
        lsaFfaComponents = lsaFfaComponents.filter((c: any) => c.eqptSystemDept === equipmentType);
      }

      const lsaFfaComponentIds = new Set(lsaFfaComponents.map((c: any) => c.id));
      const lsaFfaComponentMap = new Map(lsaFfaComponents.map((c: any) => [c.id, c]));

      let allJobs: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          const vJobs = await storage.getJobs(v.id);
          allJobs = allJobs.concat(vJobs);
        }
      } else {
        allJobs = await storage.getJobs(vesselId);
      }
      const jobMap = new Map(allJobs.map((j: any) => [j.id, j]));

      let allLinks: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          const links = await storage.getJobComponentLinks(v.id);
          allLinks.push(...links);
        }
      } else {
        allLinks = await storage.getJobComponentLinks(vesselId);
      }

      let allWorkOrders: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          const wos = await storage.getWorkOrders(v.id);
          allWorkOrders = allWorkOrders.concat(wos);
        }
      } else {
        allWorkOrders = await storage.getWorkOrders(vesselId);
      }
      const woByJobId = new Map<string, any[]>();
      for (const wo of allWorkOrders) {
        const jobId = wo.jobId;
        if (jobId) {
          const existing = woByJobId.get(jobId) || [];
          existing.push(wo);
          woByJobId.set(jobId, existing);
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const formatDateStr = (d: string | null | undefined) => {
        if (!d) return '-';
        try {
          const date = new Date(d);
          if (isNaN(date.getTime())) return d;
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return `${date.getDate().toString().padStart(2,'0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
        } catch { return d; }
      };

      const scheduleItems: any[] = [];

      for (const link of allLinks) {
        if (!lsaFfaComponentIds.has(link.componentId)) continue;

        const comp = lsaFfaComponentMap.get(link.componentId);
        const job = jobMap.get(link.jobId);
        if (!comp || !job) continue;

        const nextDueDateStr = link.nextDueDate || job.nextDueDate;
        let daysUntilDue: number | null = null;
        let status = 'On Schedule';

        if (nextDueDateStr) {
          const nextDueDate = new Date(nextDueDateStr);
          if (!isNaN(nextDueDate.getTime())) {
            nextDueDate.setHours(0, 0, 0, 0);
            daysUntilDue = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilDue < 0) {
              status = 'Overdue';
            } else if (daysUntilDue <= 30) {
              status = 'Due Soon';
            } else {
              status = 'On Schedule';
            }
          }
        }

        const jobWorkOrders = woByJobId.get(job.id) || [];
        const sortedWOs = jobWorkOrders.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        const lastWO = sortedWOs[0];

        const lastDoneDateStr = link.lastDoneDate || job.lastDoneDate;
        const freq = job.frequencyValue ? `${job.frequencyValue} ${job.frequencyUnit || ''}`.trim() : '-';

        scheduleItems.push({
          componentId: comp.id,
          jobId: job.id,
          componentCode: comp.componentCode || '-',
          componentName: comp.name || '-',
          equipmentType: comp.eqptSystemDept || '-',
          location: comp.location || '-',
          jobCode: job.jobNo || '-',
          jobTitle: job.jobTitle || '-',
          taskType: job.maintenanceType || '-',
          maintenanceBasis: job.maintenanceBasis || '-',
          frequency: freq,
          nextDueDate: formatDateStr(nextDueDateStr),
          daysUntilDue: daysUntilDue !== null ? daysUntilDue : '-',
          status,
          lastDoneDate: formatDateStr(lastDoneDateStr),
          lastWONumber: lastWO?.workOrderNo || '-',
          assignedTo: job.assignedTo || '-'
        });
      }

      if (statusFilter && statusFilter !== 'all') {
        const statusMap: Record<string, string> = {
          'on-schedule': 'On Schedule',
          'due-soon': 'Due Soon',
          'overdue': 'Overdue'
        };
        const filterValue = statusMap[statusFilter];
        if (filterValue) {
          const filtered = scheduleItems.filter(item => item.status === filterValue);
          scheduleItems.length = 0;
          scheduleItems.push(...filtered);
        }
      }

      scheduleItems.sort((a, b) => {
        const dateA = a.nextDueDate !== '-' ? new Date(a.nextDueDate).getTime() : Infinity;
        const dateB = b.nextDueDate !== '-' ? new Date(b.nextDueDate).getTime() : Infinity;
        if (dateA !== dateB) return dateA - dateB;
        return (a.componentCode || '').localeCompare(b.componentCode || '');
      });

      scheduleItems.forEach((item, i) => { item.sno = i + 1; });

      const onScheduleCount = scheduleItems.filter(i => i.status === 'On Schedule').length;
      const dueSoonCount = scheduleItems.filter(i => i.status === 'Due Soon').length;
      const overdueCount = scheduleItems.filter(i => i.status === 'Overdue').length;

      if (format === 'excel') {
        const columns: ColumnDef[] = [
          { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
          { key: 'componentCode', header: 'Comp Code', width: 16, type: 'text' },
          { key: 'componentName', header: 'Component Name', width: 30, type: 'text' },
          { key: 'equipmentType', header: 'Equipment Type', width: 14, type: 'text', align: 'center' },
          { key: 'location', header: 'Location', width: 18, type: 'text' },
          { key: 'jobCode', header: 'Job Code', width: 16, type: 'text' },
          { key: 'jobTitle', header: 'Job Title', width: 35, type: 'text' },
          { key: 'taskType', header: 'Task Type', width: 16, type: 'text' },
          { key: 'maintenanceBasis', header: 'Basis', width: 14, type: 'text' },
          { key: 'frequency', header: 'Frequency', width: 14, type: 'text' },
          { key: 'nextDueDate', header: 'Next Due Date', width: 16, type: 'text' },
          { key: 'daysUntilDue', header: 'Days', width: 10, type: 'number', align: 'center' },
          { key: 'status', header: 'Status', width: 14, type: 'text', align: 'center' },
          { key: 'lastDoneDate', header: 'Last Done', width: 16, type: 'text' },
          { key: 'lastWONumber', header: 'Last WO', width: 18, type: 'text' },
          { key: 'assignedTo', header: 'Assigned To', width: 16, type: 'text' }
        ];

        const conditionalStyles: ConditionalStyle[] = [
          {
            condition: (row: any) => row.status === 'Overdue',
            style: 'danger'
          },
          {
            condition: (row: any) => row.status === 'Due Soon',
            style: 'warning'
          }
        ];

        const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
        const lastCol = getLastColumnLetter(columns.length);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('LSA-FFA Maintenance Schedule');

        applyStandardHeader(ws, 'LSA/FFA Maintenance Schedule & Status', `${scheduleItems.length} schedule items`, vesselName, scheduleItems.length, lastCol);
        applyStandardTableHeader(ws, columns);
        applyStandardDataRows(ws, scheduleItems, columns, 8, conditionalStyles);

        const summaryItems: SummaryItem[] = [
          { label: 'Total Items', value: scheduleItems.length },
          { label: 'On Schedule', value: onScheduleCount },
          { label: 'Due Soon', value: dueSoonCount, highlight: true },
          { label: 'Overdue', value: overdueCount, highlight: true }
        ];

        const summaryStartRow = 8 + scheduleItems.length + 1;
        const lastRow = applyStandardSummary(ws, summaryItems, summaryStartRow, columns.length);
        applyStandardPageSetup(ws, 7, columns.length, lastRow, vesselName);

        const buffer = await wb.xlsx.writeBuffer();
        const filename = generateFilename('LSA_FFA_Maintenance_Schedule', vesselName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer as ArrayBuffer));
        return;
      }

      res.json({
        scheduleItems,
        summary: {
          total: scheduleItems.length,
          onSchedule: onScheduleCount,
          dueSoon: dueSoonCount,
          overdue: overdueCount
        }
      });
    } catch (error: any) {
      console.error("Error generating LSA/FFA maintenance schedule report:", error);
      res.status(500).json({ error: "Failed to generate report", details: error.message });
    }
  });

  app.get("/technical/api/reports/critical-equipment-schedule", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const statusFilter = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;
      const format = (req.query.format as string) || 'json';

      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      const allVessels = await storage.getVessels();
      let allComponents: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          allComponents = allComponents.concat(await storage.getComponents(v.id));
        }
      } else {
        allComponents = await storage.getComponents(vesselId);
      }

      let criticalComponents = allComponents.filter((c: any) => c.critical === true);
      if (category) {
        criticalComponents = criticalComponents.filter((c: any) => c.category === category);
      }

      const criticalComponentIds = new Set(criticalComponents.map((c: any) => c.id));
      const criticalComponentMap = new Map(criticalComponents.map((c: any) => [c.id, c]));

      let allJobs: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          const vJobs = await storage.getJobs(v.id);
          allJobs = allJobs.concat(vJobs);
        }
      } else {
        allJobs = await storage.getJobs(vesselId);
      }
      const jobMap = new Map(allJobs.map((j: any) => [j.id, j]));

      let allLinks: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          const links = await storage.getJobComponentLinks(v.id);
          allLinks.push(...links);
        }
      } else {
        allLinks = await storage.getJobComponentLinks(vesselId);
      }

      let allWorkOrders: any[] = [];
      if (vesselId === 'all') {
        for (const v of allVessels) {
          const wos = await storage.getWorkOrders(v.id);
          allWorkOrders = allWorkOrders.concat(wos);
        }
      } else {
        allWorkOrders = await storage.getWorkOrders(vesselId);
      }
      const woByJobId = new Map<string, any[]>();
      for (const wo of allWorkOrders) {
        const jobId = wo.jobId;
        if (jobId) {
          const existing = woByJobId.get(jobId) || [];
          existing.push(wo);
          woByJobId.set(jobId, existing);
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const formatDateStr = (d: string | null | undefined) => {
        if (!d) return '-';
        try {
          const date = new Date(d);
          if (isNaN(date.getTime())) return d;
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return `${date.getDate().toString().padStart(2,'0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
        } catch { return d; }
      };

      const scheduleItems: any[] = [];

      for (const link of allLinks) {
        if (!criticalComponentIds.has(link.componentId)) continue;

        const comp = criticalComponentMap.get(link.componentId);
        const job = jobMap.get(link.jobId);
        if (!comp || !job) continue;

        const nextDueDateStr = link.nextDueDate || job.nextDueDate;
        let daysUntilDue: number | null = null;
        let status = 'On Schedule';

        if (nextDueDateStr) {
          const nextDueDate = new Date(nextDueDateStr);
          if (!isNaN(nextDueDate.getTime())) {
            nextDueDate.setHours(0, 0, 0, 0);
            daysUntilDue = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilDue < 0) {
              status = 'Overdue';
            } else if (daysUntilDue <= 7) {
              status = 'Due Soon';
            } else {
              status = 'On Schedule';
            }
          }
        }

        const jobWorkOrders = woByJobId.get(job.id) || [];
        const sortedWOs = jobWorkOrders.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        const lastWO = sortedWOs[0];

        const lastDoneDateStr = link.lastDoneDate || job.lastDoneDate;
        const freq = job.frequencyValue ? `${job.frequencyValue} ${job.frequencyUnit || ''}`.trim() : '-';

        scheduleItems.push({
          componentId: comp.id,
          jobId: job.id,
          componentCode: comp.componentCode || '-',
          componentName: comp.name || '-',
          location: comp.location || '-',
          jobCode: job.jobNo || '-',
          jobTitle: job.jobTitle || '-',
          taskType: job.maintenanceType || '-',
          maintenanceBasis: job.maintenanceBasis || '-',
          frequency: freq,
          nextDueDate: formatDateStr(nextDueDateStr),
          daysUntilDue: daysUntilDue !== null ? daysUntilDue : '-',
          status,
          lastDoneDate: formatDateStr(lastDoneDateStr),
          lastWONumber: lastWO?.workOrderNo || '-',
          lastWOStatus: lastWO?.status || '-',
          assignedTo: job.assignedTo || '-',
          estimatedManHours: '-',
          runningHours: comp.currentCumulativeRH || '-'
        });
      }

      if (statusFilter && statusFilter !== 'all') {
        const statusMap: Record<string, string> = {
          'on-schedule': 'On Schedule',
          'due-soon': 'Due Soon',
          'overdue': 'Overdue'
        };
        const filterValue = statusMap[statusFilter];
        if (filterValue) {
          const filtered = scheduleItems.filter(item => item.status === filterValue);
          scheduleItems.length = 0;
          scheduleItems.push(...filtered);
        }
      }

      scheduleItems.sort((a, b) => {
        const dateA = a.nextDueDate !== '-' ? new Date(a.nextDueDate).getTime() : Infinity;
        const dateB = b.nextDueDate !== '-' ? new Date(b.nextDueDate).getTime() : Infinity;
        if (dateA !== dateB) return dateA - dateB;
        return (a.componentCode || '').localeCompare(b.componentCode || '');
      });

      scheduleItems.forEach((item, i) => { item.sno = i + 1; });

      const onScheduleCount = scheduleItems.filter(i => i.status === 'On Schedule').length;
      const dueSoonCount = scheduleItems.filter(i => i.status === 'Due Soon').length;
      const overdueCount = scheduleItems.filter(i => i.status === 'Overdue').length;
      const numericDays = scheduleItems.filter(i => typeof i.daysUntilDue === 'number').map(i => i.daysUntilDue as number);
      const avgDaysUntilDue = numericDays.length > 0 ? Math.round(numericDays.reduce((a: number, b: number) => a + b, 0) / numericDays.length) : 0;

      if (format === 'excel') {
        const columns: ColumnDef[] = [
          { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
          { key: 'componentCode', header: 'Comp Code', width: 16, type: 'text' },
          { key: 'componentName', header: 'Component Name', width: 30, type: 'text' },
          { key: 'location', header: 'Location', width: 18, type: 'text' },
          { key: 'jobCode', header: 'Job Code', width: 16, type: 'text' },
          { key: 'jobTitle', header: 'Job Title', width: 35, type: 'text' },
          { key: 'taskType', header: 'Task Type', width: 16, type: 'text' },
          { key: 'maintenanceBasis', header: 'Maint. Basis', width: 14, type: 'text' },
          { key: 'frequency', header: 'Frequency', width: 14, type: 'text' },
          { key: 'nextDueDate', header: 'Next Due Date', width: 16, type: 'text' },
          { key: 'daysUntilDue', header: 'Days Until Due', width: 14, type: 'number', align: 'center' },
          { key: 'status', header: 'Status', width: 14, type: 'text', align: 'center' },
          { key: 'lastDoneDate', header: 'Last Done', width: 16, type: 'text' },
          { key: 'lastWONumber', header: 'Last WO No', width: 18, type: 'text' },
          { key: 'lastWOStatus', header: 'Last WO Status', width: 14, type: 'text' },
          { key: 'assignedTo', header: 'Assigned To', width: 16, type: 'text' },
          { key: 'estimatedManHours', header: 'Man-Hours', width: 12, type: 'number', align: 'center' },
          { key: 'runningHours', header: 'Running Hours', width: 14, type: 'text' }
        ];

        const conditionalStyles: ConditionalStyle[] = [
          {
            condition: (row: any) => row.status === 'Overdue',
            style: 'danger'
          },
          {
            condition: (row: any) => row.status === 'Due Soon',
            style: 'warning'
          }
        ];

        const vesselName = vesselId !== 'all' ? (allVessels.find(v => v.id === vesselId)?.name || vesselId) : 'All Vessels';
        const lastCol = getLastColumnLetter(columns.length);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Critical Equipment Schedule');

        applyStandardHeader(ws, 'Critical Equipment Maintenance Schedule', `${scheduleItems.length} schedule items`, vesselName, scheduleItems.length, lastCol);
        applyStandardTableHeader(ws, columns);
        applyStandardDataRows(ws, scheduleItems, columns, 8, conditionalStyles);

        const summaryItems: SummaryItem[] = [
          { label: 'Total Schedule Items', value: scheduleItems.length },
          { label: 'On Schedule', value: onScheduleCount },
          { label: 'Due Soon', value: dueSoonCount, highlight: true },
          { label: 'Overdue', value: overdueCount, highlight: true },
          { label: 'Avg Days Until Due', value: avgDaysUntilDue }
        ];

        const summaryStartRow = 8 + scheduleItems.length + 1;
        const lastRow = applyStandardSummary(ws, summaryItems, summaryStartRow, columns.length);
        applyStandardPageSetup(ws, 7, columns.length, lastRow, vesselName);

        const buffer = await wb.xlsx.writeBuffer();
        const filename = generateFilename('Critical_Equipment_Schedule', vesselName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer as ArrayBuffer));
        return;
      }

      res.json({
        scheduleItems,
        summary: {
          total: scheduleItems.length,
          onSchedule: onScheduleCount,
          dueSoon: dueSoonCount,
          overdue: overdueCount,
          avgDaysUntilDue
        }
      });
    } catch (error: any) {
      console.error("Error generating critical equipment schedule report:", error);
      res.status(500).json({ error: "Failed to generate report", details: error.message });
    }
  });

  // Recurring Defects API routes
  
  // Get all recurring defects with filters
  app.get("/technical/api/recurring-defects", async (req, res) => {
    try {
      const filters = {
        windowMonths: req.query.windowMonths ? parseInt(req.query.windowMonths as string) : 12,
        minOccurrences: req.query.minOccurrences ? parseInt(req.query.minOccurrences as string) : 2,
        hasCoc: req.query.hasCoc === 'true' ? true : req.query.hasCoc === 'false' ? false : undefined,
        equipmentKey: req.query.equipmentKey as string
      };
      
      // Check if ANY recurring defects exist at all (without filters)
      const allRecurringDefects = await storage.getRecurringDefects();
      
      // If no recurring defects have been calculated yet, calculate them for all time windows
      if (allRecurringDefects.length === 0) {
        // Get all unique equipment keys from defects
        const allDefects = await storage.getDefects({ includeClosedDefects: true });
        const equipmentKeys = new Set<string>();
        
        for (const defect of allDefects) {
          if (defect.equipment_key) {
            equipmentKeys.add(defect.equipment_key);
          }
        }
        
        // Calculate recurring defects for multiple time windows
        const timeWindows = [6, 12, 24, 36, 48, 60]; // 6 months to 5 years
        
        // Use Array.from() to iterate over Set
        for (const equipmentKey of Array.from(equipmentKeys)) {
          for (const windowMonths of timeWindows) {
            await storage.calculateAndUpdateRecurringDefects(equipmentKey, windowMonths);
          }
        }
      }
      
      // Now fetch the recurring defects with the requested filters
      const recurringDefects = await storage.getRecurringDefects(filters);
      res.json(recurringDefects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recurring defects" });
    }
  });
  
  // Get specific recurring defect
  app.get("/technical/api/recurring-defects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recurringDefect = await storage.getRecurringDefect(id);
      if (!recurringDefect) {
        return res.status(404).json({ error: "Recurring defect not found" });
      }
      res.json(recurringDefect);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recurring defect" });
    }
  });
  
  // Get defects linked to a recurring defect
  app.get("/technical/api/recurring-defects/:id/defects", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const defects = await storage.getDefectsForRecurring(id);
      res.json(defects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defects for recurring defect" });
    }
  });
  
  // Manually trigger recalculation for an equipment key
  app.post("/technical/api/recurring-defects/recalculate", async (req, res) => {
    try {
      const { equipmentKey, windowMonths } = req.body;
      if (!equipmentKey) {
        return res.status(400).json({ error: "equipmentKey is required" });
      }
      
      const recurringDefect = await storage.calculateAndUpdateRecurringDefects(
        equipmentKey,
        windowMonths || 12
      );
      res.json(recurringDefect);
    } catch (error) {
      res.status(500).json({ error: "Failed to recalculate recurring defects" });
    }
  });
  
  // Dev-only seed endpoint for recurring defects testing
  if (process.env.NODE_ENV === 'development') {
    // Seed recurring defects test data
    app.post("/dev/seed/recurring-defects", async (req, res) => {
      try {
        // Fetch real vessels from external API
        const EXTERNAL_API_URL = "https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata";
        const domain = req.query.domain || 'rsms';
        let externalVessels: Array<{ vuid: string; vessel: string; imo_number?: string; vessel_type_name?: string }> = [];
        
        try {
          const apiResponse = await fetch(`${EXTERNAL_API_URL}/vessels?domain=${domain}`, {
            method: 'GET',
            headers: { 'accept': '*/*' }
          });
          if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            externalVessels = apiData.vessels || [];
          }
        } catch (apiError) {
          console.log("Could not fetch external vessels, using fallback names");
        }
        
        // Get vessel names from external API, or use fallback if API unavailable
        const vesselNames = externalVessels.length > 0 
          ? externalVessels.slice(0, 5).map(v => v.vessel)
          : ['Vessel 1', 'Vessel 2', 'Vessel 3', 'Vessel 4', 'Vessel 5'];
        
        const seedData = getSeedDefectsData(vesselNames);
        let created = 0;
        let updated = 0;
        
        for (const seedDefect of seedData) {
          // For external vessels, use vuid as vesselId; don't create local vessels
          let vesselId = seedDefect.vesselId || seedDefect.vesselName.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
          
          // Convert dates from YYYY-MM-DD to DD-MM-YYYY for storage
          const convertDate = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-');
            return `${day}-${month}-${year}`;
          };
          
          // Map seed data to our defect schema
          const defectData: any = {
            vesselId,
            vesselName: seedDefect.vesselName,
            issueDate: convertDate(seedDefect.issuedDate),
            targetCloseDate: convertDate(seedDefect.targetDate),
            status: seedDefect.status === 'open' ? 'Open' : 'Closed',
            is_coc: seedDefect.isCoC,
            source: seedDefect.source || 'Ship',
            category: 'Defect',
            defectCategory: seedDefect.defectCategory,
            defectType: seedDefect.defectType,
            responsibleRole: seedDefect.responsibleRole,
            equipmentCategory: seedDefect.equipment.category,
            equipmentType: seedDefect.equipment.type,
            equipmentMake: seedDefect.equipment.make,
            equipmentModel: seedDefect.equipment.model,
            description: seedDefect.description,
            actionTakenRequested: seedDefect.actionRequested,
            seedId: seedDefect.seedId,
            // Defaults
            priority: 'Medium',
            severity: 2,
            critical: false,
            occurrenceType: 'Routine',
            operatingCondition: 'Sailing',
            reportedBy: 'System',
          };
          
          // Add dateCompleted for closed defects
          if (seedDefect.status === 'closed' && seedDefect.dateCompleted) {
            defectData.dateCompleted = convertDate(seedDefect.dateCompleted);
          }
          
          // Check if defect with this seedId exists
          const existing = await storage.getDefectBySeedId(seedDefect.seedId);
          if (existing) {
            await storage.updateDefect(existing.id, defectData);
            updated++;
          } else {
            await storage.createDefect(defectData);
            created++;
          }
        }
        
        res.json({ 
          message: "Seed data loaded successfully",
          created,
          updated,
          total: seedData.length
        });
      } catch (error: any) {
        console.error("Seed error:", error);
        res.status(500).json({ error: "Failed to seed data", details: error.message });
      }
    });
    
    // Delete seeded defects
    app.delete("/dev/seed/recurring-defects", async (req, res) => {
      try {
        const seedIds = [
          // Equipment Group A: Fuel Injection Pump (4)
          'RD-A-001', 'RD-A-002', 'RD-A-003', 'RD-A-004',
          // Equipment Group B: X-Band Radar (3)
          'RD-B-001', 'RD-B-002', 'RD-B-003',
          // Equipment Group C: Lifeboat Davit (2)
          'RD-C-001', 'RD-C-002',
          // Equipment Group D: Steering Gear (3)
          'RD-D-001', 'RD-D-002', 'RD-D-003',
          // Equipment Group E: Hold Ventilation Fan (2)
          'RD-E-001', 'RD-E-002',
          // Single defects
          'RD-F-001'
        ];
        
        let deleted = 0;
        for (const seedId of seedIds) {
          const defect = await storage.getDefectBySeedId(seedId);
          if (defect) {
            await storage.deleteDefect(defect.id);
            deleted++;
          }
        }
        
        res.json({ 
          message: "Seed data deleted successfully",
          deleted
        });
      } catch (error: any) {
        console.error("Delete seed error:", error);
        res.status(500).json({ error: "Failed to delete seed data", details: error.message });
      }
    });
  }
  
  // Fleet Admin - Components Routes
  
  // Get all fleet components
  app.get("/technical/api/fleet/components", async (req, res) => {
    try {
      const components = await storage.getFleetScopedComponents();
      res.json(components);
    } catch (error) {
      console.error("Error fetching fleet components:", error);
      res.status(500).json({ error: "Failed to fetch fleet components" });
    }
  });
  
  // Get fleet component by ID
  app.get("/technical/api/fleet/components/:id", async (req, res) => {
    try {
      const component = await storage.getFleetScopedComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Fleet component not found" });
      }
      res.json(component);
    } catch (error) {
      console.error("Error fetching fleet component:", error);
      res.status(500).json({ error: "Failed to fetch fleet component" });
    }
  });
  
  // Create new fleet component
  app.post("/technical/api/fleet/components", async (req, res) => {
    try {
      const validatedData = insertComponentSchema.parse(req.body);
      const component = await storage.createFleetScopedComponent(validatedData);
      res.status(201).json(component);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid component data", details: error.errors });
      }
      if (error.message?.includes('must have dataScope') || error.message?.includes('cannot have vesselId') || error.message?.includes('not found')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating fleet component:", error);
      res.status(500).json({ error: error.message || "Failed to create fleet component" });
    }
  });
  
  // Update fleet component
  app.patch("/technical/api/fleet/components/:id", async (req, res) => {
    try {
      const partialComponentSchema = insertComponentSchema.partial();
      const validatedData = partialComponentSchema.parse(req.body);
      const component = await storage.updateFleetScopedComponent(req.params.id, validatedData);
      res.json(component);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid component data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('not a fleet component') || error.message?.includes('Cannot change dataScope') || error.message?.includes('Cannot assign vesselId')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating fleet component:", error);
      res.status(500).json({ error: "Failed to update fleet component" });
    }
  });
  
  // Delete fleet component
  app.delete("/technical/api/fleet/components/:id", async (req, res) => {
    try {
      await storage.deleteFleetScopedComponent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('with child components')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error deleting fleet component:", error);
      res.status(500).json({ error: "Failed to delete fleet component" });
    }
  });
  
  // Update sort order for fleet components
  app.post("/technical/api/fleet/components/sort-order", async (req, res) => {
    try {
      const sortOrderSchema = z.object({
        updates: z.array(z.object({
          id: z.number(),
          sortOrder: z.number(),
        })),
      });
      const { updates } = sortOrderSchema.parse(req.body);
      const pool = await getPool();
      for (const update of updates) {
        await pool.query(
          `UPDATE fleet_components SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
          [update.sortOrder, update.id]
        );
      }
      res.json({ success: true, updated: updates.length });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating sort order:", error);
      res.status(500).json({ error: "Failed to update sort order" });
    }
  });

  // Fleet Admin - Jobs Routes
  
  // Export fleet jobs to Excel (21-column format matching import template)
  // Optional query param: fleetEquipmentCode - filters jobs for a specific fleet equipment
  app.get("/technical/api/fleet/jobs/export", async (req, res) => {
    try {
      const { fleetEquipmentCode } = req.query;
      let jobs = await storage.getFleetJobs();
      if (fleetEquipmentCode && typeof fleetEquipmentCode === 'string') {
        jobs = jobs.filter((j: any) => j.fleetEquipmentCode === fleetEquipmentCode);
      }

      const headers = [
        'Job Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'WO Title',
        'Task Type', 'Assigned To', 'Approver', 'Job Priority',
        'Class Related', 'Brief Work Description', 'Department', 'Criticality',
        'Is Active', 'Maintenance Basis', 'Interval Value', 'Unit',
        'Required Spare Parts', 'Required Tools', 'PPE Requirements',
        'Permit Requirements', 'Other Safety Requirements'
      ];

      const rows = jobs.map((j: any) => [
        j.jobCode || '',
        j.fleetEquipmentCode || '',
        j.fleetEquipmentName || '',
        j.woTitle || '',
        j.taskType || '',
        j.assignedTo || '',
        j.approver || '',
        j.jobPriority || '',
        j.classRelated || '',
        j.briefWorkDescription || '',
        j.department || '',
        j.criticality || '',
        j.isActive === false ? 'No' : 'Yes',
        j.maintenanceBasis || '',
        j.intervalValue || '',
        j.unit || '',
        Array.isArray(j.requiredSpareParts) ? j.requiredSpareParts.join(', ') : (j.requiredSpareParts || ''),
        Array.isArray(j.requiredTools) ? j.requiredTools.join(', ') : (j.requiredTools || ''),
        j.ppeRequirements || '',
        j.permitRequirements || '',
        j.otherSafetyRequirements || '',
      ]);

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const colWidths = [18, 22, 35, 30, 15, 18, 18, 12, 12, 40, 15, 12, 10, 18, 12, 12, 30, 25, 20, 20, 25];
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fleet Jobs');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=fleet-jobs-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      console.error('Error exporting fleet jobs:', error);
      res.status(500).json({ error: 'Failed to export fleet jobs' });
    }
  });

  // Get all fleet jobs
  app.get("/technical/api/fleet/jobs", async (req, res) => {
    try {
      const jobs = await storage.getFleetJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching fleet jobs:", error);
      res.status(500).json({ error: "Failed to fetch fleet jobs" });
    }
  });
  
  // Get fleet job by ID
  app.get("/technical/api/fleet/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getFleetJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Fleet job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching fleet job:", error);
      res.status(500).json({ error: "Failed to fetch fleet job" });
    }
  });
  
  // Create new fleet job
  app.post("/technical/api/fleet/jobs", async (req, res) => {
    try {
      const validatedData = insertFleetJobsSchema.parse(req.body);
      const job = await storage.createFleetJob(validatedData);
      res.status(201).json(job);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      if (error.message?.includes('must have dataScope') || error.message?.includes('cannot have vesselId') || error.message?.includes('not found')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating fleet job:", error);
      res.status(500).json({ error: error.message || "Failed to create fleet job" });
    }
  });
  
  // Update fleet job
  app.patch("/technical/api/fleet/jobs/:id", async (req, res) => {
    try {
      const STRING_FIELDS = [
        'woTitle', 'jobCode', 'maintenanceBasis', 'intervalValue', 'unit',
        'taskType', 'assignedTo', 'approver', 'jobPriority',
        'classRelated', 'briefWorkDescription', 'department',
        'criticality', 'ppeRequirements', 'permitRequirements',
        'otherSafetyRequirements',
      ];
      const NOTNULL_STRING_FIELDS = new Set([
        'woTitle', 'jobCode', 'taskType', 'assignedTo', 'approver',
        'jobPriority', 'classRelated', 'briefWorkDescription',
        'department', 'criticality',
      ]);
      const JSON_FIELDS = ['requiredSpareParts', 'requiredTools'];
      const BOOLEAN_FIELDS = ['isActive'];

      const sanitizedData: Record<string, any> = {};
      const errors: string[] = [];

      for (const field of STRING_FIELDS) {
        if (field in req.body && req.body[field] !== undefined) {
          const val = req.body[field];
          if (typeof val !== 'string') {
            errors.push(`${field} must be a string`);
            continue;
          }
          if (NOTNULL_STRING_FIELDS.has(field) && val.trim() === '') {
            continue;
          }
          sanitizedData[field] = val;
        }
      }

      for (const field of JSON_FIELDS) {
        if (field in req.body && req.body[field] !== undefined) {
          const val = req.body[field];
          if (val !== null && !Array.isArray(val) && typeof val !== 'object') {
            errors.push(`${field} must be an array or object`);
            continue;
          }
          sanitizedData[field] = val;
        }
      }

      for (const field of BOOLEAN_FIELDS) {
        if (field in req.body && req.body[field] !== undefined) {
          const val = req.body[field];
          if (typeof val !== 'boolean') {
            errors.push(`${field} must be a boolean`);
            continue;
          }
          sanitizedData[field] = val;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: "Invalid field types", details: errors });
      }
      if (Object.keys(sanitizedData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      console.log(`[Fleet Jobs PATCH] id=${req.params.id}, fields: ${Object.keys(sanitizedData).join(', ')}`);
      const { updatedJob, affectedCount } = await storage.updateFleetJob(Number(req.params.id), sanitizedData);
      res.json({ ...updatedJob, affectedCount });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('not a fleet') || error.message?.includes('Cannot change dataScope') || error.message?.includes('Cannot assign vesselId')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating fleet job:", error);
      res.status(500).json({ error: "Failed to update fleet job" });
    }
  });
  
  // Delete fleet job
  app.delete("/technical/api/fleet/jobs/:id", async (req, res) => {
    try {
      await storage.deleteFleetJob(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('not a fleet')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error deleting fleet job:", error);
      res.status(500).json({ error: "Failed to delete fleet job" });
    }
  });
  
  // Fleet Admin - Spares Routes (using dedicated fleet_spares table)
  
  // Export fleet spares to Excel (18-column format matching import template)
  // Optional query param: fleetEquipmentCode - filters spares for a specific fleet equipment
  app.get("/technical/api/fleet/spares/export", async (req, res) => {
    try {
      const { fleetEquipmentCode } = req.query;
      let spares = await storage.getFleetSparesFromTable();
      if (fleetEquipmentCode && typeof fleetEquipmentCode === 'string') {
        spares = spares.filter((s: any) => s.fleetEquipmentCode === fleetEquipmentCode);
      }

      const headers = [
        'Part Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'Part Name',
        'Part Number', 'Unit Of Measurement', 'Drawing Number', 'Position Number',
        'Note', 'Specification', 'Maker', 'Maker Code',
        'Manual Name', 'Page Number', 'Criticality', 'Is Active',
        'IHM (Inventory of Hazardous Materials)', 'Evidence Type'
      ];

      const rows = spares.map((s: any) => [
        s.partCode || '',
        s.fleetEquipmentCode || '',
        s.fleetEquipmentName || '',
        s.partName || '',
        s.partNumber || '',
        s.unitOfMeasurement || '',
        s.drawingNumber || '',
        s.positionNumber || '',
        s.note || '',
        s.specification || '',
        s.maker || '',
        s.makerCode || '',
        s.manualName || '',
        s.pageNumber || '',
        s.criticality || '',
        s.isActive === false ? 'No' : 'Yes',
        s.ihm || '',
        s.evidenceType || '',
      ]);

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const colWidths = [18, 22, 35, 30, 18, 18, 18, 15, 25, 25, 25, 15, 20, 12, 12, 10, 15, 15];
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fleet Spares');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=fleet-spares-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      console.error('Error exporting fleet spares:', error);
      res.status(500).json({ error: 'Failed to export fleet spares' });
    }
  });

  // Get all fleet spares
  app.get("/technical/api/fleet/spares", async (req, res) => {
    try {
      const spares = await storage.getFleetSparesFromTable();
      res.json(spares);
    } catch (error) {
      console.error("Error fetching fleet spares:", error);
      res.status(500).json({ error: "Failed to fetch fleet spares" });
    }
  });
  
  // Get fleet spare by ID
  app.get("/technical/api/fleet/spares/:id", async (req, res) => {
    try {
      const spare = await storage.getFleetSpareFromTable(parseInt(req.params.id));
      if (!spare) {
        return res.status(404).json({ error: "Fleet spare not found" });
      }
      res.json(spare);
    } catch (error) {
      console.error("Error fetching fleet spare:", error);
      res.status(500).json({ error: "Failed to fetch fleet spare" });
    }
  });
  
  // Create new fleet spare
  app.post("/technical/api/fleet/spares", async (req, res) => {
    try {
      const validatedData = insertFleetSparesSchema.parse(req.body);
      const spare = await storage.createFleetSpareInTable(validatedData);
      res.status(201).json(spare);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid spare data", details: error.errors });
      }
      console.error("Error creating fleet spare:", error);
      res.status(500).json({ error: error.message || "Failed to create fleet spare" });
    }
  });
  
  // Update fleet spare
  app.patch("/technical/api/fleet/spares/:id", async (req, res) => {
    try {
      const partialSchema = insertFleetSparesSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const spare = await storage.updateFleetSpareInTable(parseInt(req.params.id), validatedData);
      res.json(spare);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid spare data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating fleet spare:", error);
      res.status(500).json({ error: "Failed to update fleet spare" });
    }
  });
  
  // Delete fleet spare
  app.delete("/technical/api/fleet/spares/:id", async (req, res) => {
    try {
      await storage.deleteFleetSpareFromTable(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting fleet spare:", error);
      res.status(500).json({ error: "Failed to delete fleet spare" });
    }
  });
  
  // Fleet Admin - Makers Routes
  
  // Get all makers with optional search query param
  app.get("/technical/api/fleet/makers", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const makers = await storage.getMakers(search);
      res.json(makers);
    } catch (error) {
      console.error("Error fetching makers:", error);
      res.status(500).json({ error: "Failed to fetch makers" });
    }
  });
  
  // Get maker by ID
  app.get("/technical/api/fleet/makers/:id", async (req, res) => {
    try {
      const maker = await storage.getMakerById(parseInt(req.params.id));
      if (!maker) {
        return res.status(404).json({ error: "Maker not found" });
      }
      res.json(maker);
    } catch (error) {
      console.error("Error fetching maker:", error);
      res.status(500).json({ error: "Failed to fetch maker" });
    }
  });
  
  // Create new maker
  app.post("/technical/api/fleet/makers", async (req, res) => {
    try {
      const validatedData = insertMakerListSchema.parse(req.body);
      
      // Auto-generate makerCode if not provided or empty
      let makerCode = validatedData.makerCode;
      if (!makerCode || makerCode.trim() === '') {
        const existingMakers = await storage.getMakers();
        let maxNum = 0;
        for (const m of existingMakers) {
          const match = m.makerCode?.match(/MKR-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        makerCode = `MKR-${String(maxNum + 1).padStart(6, '0')}`;
      }
      
      const maker = await storage.createMaker({ ...validatedData, makerCode });
      res.status(201).json(maker);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid maker data", details: error.errors });
      }
      console.error("Error creating maker:", error);
      res.status(500).json({ error: "Failed to create maker" });
    }
  });
  
  // Update existing maker
  app.put("/technical/api/fleet/makers/:id", async (req, res) => {
    try {
      const partialMakerSchema = insertMakerListSchema.partial();
      const validatedData = partialMakerSchema.parse(req.body);
      
      // Prevent clearing makerCode - remove it from update if empty
      if (validatedData.makerCode !== undefined && validatedData.makerCode.trim() === '') {
        delete validatedData.makerCode;
      }
      
      const maker = await storage.updateMaker(parseInt(req.params.id), validatedData);
      res.json(maker);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid maker data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating maker:", error);
      res.status(500).json({ error: "Failed to update maker" });
    }
  });
  
  // Delete maker
  app.delete("/technical/api/fleet/makers/:id", async (req, res) => {
    try {
      await storage.deleteMaker(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting maker:", error);
      res.status(500).json({ error: "Failed to delete maker" });
    }
  });
  
  // Fleet Admin - Master Lists Routes
  
  // Get all master lists with optional listType query param
  app.get("/technical/api/fleet/master-lists", async (req, res) => {
    try {
      const listType = req.query.listType as string | undefined;
      const masterLists = await storage.getMasterLists(listType);
      res.json(masterLists);
    } catch (error) {
      console.error("Error fetching master lists:", error);
      res.status(500).json({ error: "Failed to fetch master lists" });
    }
  });
  
  // Get master list by ID
  app.get("/technical/api/fleet/master-lists/:id", async (req, res) => {
    try {
      const masterList = await storage.getMasterListById(parseInt(req.params.id));
      if (!masterList) {
        return res.status(404).json({ error: "Master list not found" });
      }
      res.json(masterList);
    } catch (error) {
      console.error("Error fetching master list:", error);
      res.status(500).json({ error: "Failed to fetch master list" });
    }
  });
  
  // Create new master list
  app.post("/technical/api/fleet/master-lists", async (req, res) => {
    try {
      const validatedData = insertMasterListSchema.parse(req.body);
      const masterList = await storage.createMasterList(validatedData);
      res.status(201).json(masterList);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid master list data", details: error.errors });
      }
      console.error("Error creating master list:", error);
      res.status(500).json({ error: "Failed to create master list" });
    }
  });
  
  // Update existing master list
  app.put("/technical/api/fleet/master-lists/:id", async (req, res) => {
    try {
      const partialMasterListSchema = insertMasterListSchema.partial();
      const validatedData = partialMasterListSchema.parse(req.body);
      const masterList = await storage.updateMasterList(parseInt(req.params.id), validatedData);
      res.json(masterList);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid master list data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating master list:", error);
      res.status(500).json({ error: "Failed to update master list" });
    }
  });
  
  // Delete master list
  app.delete("/technical/api/fleet/master-lists/:id", async (req, res) => {
    try {
      await storage.deleteMasterList(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting master list:", error);
      res.status(500).json({ error: "Failed to delete master list" });
    }
  });

  // =====================================================
  // Fleet Admin - Vessel Mapping Routes (Rule #16)
  // =====================================================

  // Get all vessel mappings
  app.get("/technical/api/fleet/vessel-mappings", async (req, res) => {
    try {
      const mappings = await storage.getFleetVesselMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching vessel mappings:", error);
      res.status(500).json({ error: "Failed to fetch vessel mappings" });
    }
  });

  // Create vessel mappings (batch)
  app.post("/technical/api/fleet/vessel-mappings", async (req, res) => {
    try {
      const { fleetEntityType, fleetEntityIds, vesselId, vesselEntityId, vesselEntityCode } = req.body;
      
      if (!fleetEntityType || !fleetEntityIds?.length || !vesselId) {
        return res.status(400).json({ error: "Missing required fields: fleetEntityType, fleetEntityIds, vesselId" });
      }

      const mappings = await storage.createFleetVesselMappings({
        fleetEntityType,
        fleetEntityIds,
        vesselId,
        vesselEntityId,
        vesselEntityCode,
        mappedBy: 'admin'
      });
      
      res.status(201).json(mappings);
    } catch (error: any) {
      console.error("Error creating vessel mappings:", error);
      res.status(500).json({ error: error.message || "Failed to create vessel mappings" });
    }
  });

  // Delete vessel mapping
  app.delete("/technical/api/fleet/vessel-mappings/:id", async (req, res) => {
    try {
      await storage.deleteFleetVesselMapping(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting vessel mapping:", error);
      res.status(500).json({ error: error.message || "Failed to delete vessel mapping" });
    }
  });

  // Fleet Registry CRUD + Vessel CRUD → Extracted to modules/vessels

  // PMS Vessel Settings → Extracted to modules/vessels

  // WO Status Recalculation & Postponement Checks → Extracted to modules/work-orders

  // Document Management API routes for Work Orders
  // Upload document to object storage using SDK
  app.post("/technical/api/upload-document", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { documentType } = req.body;
      const file = req.file;
      
      // Get private object directory from environment
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      
      // Create unique entity ID with timestamp and file extension
      const timestamp = Date.now();
      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
      const entityId = `uploads/${documentType}_${timestamp}${fileExtension}`;
      
      // Build full path for object storage
      const fullPath = `${privateDir}/${entityId}`;
      
      // Parse path to get bucket name and object name
      const { bucketName, objectName } = parseObjectPath(fullPath);
      
      // Get bucket and upload file using SDK
      const bucket = objectStorageClient.bucket(bucketName);
      await bucket.file(objectName).save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      // Return file metadata with entity-based path
      const fileKey = `/objects/${entityId}`;
      res.json({
        success: true,
        fileName: file.originalname,
        fileKey: fileKey,
        uploadedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Failed to upload document: " + error.message });
    }
  });

  // Get document using Object Storage SDK
  app.get("/technical/api/documents/:fileKey(*)", async (req, res) => {
    try {
      const fileKey = '/' + req.params.fileKey;
      const objectStorageService = new ObjectStorageService();
      
      // Get object file from entity path
      const objectFile = await objectStorageService.getObjectEntityFile(fileKey);
      
      // Get file metadata to extract content as base64 for data URL
      const [metadata] = await objectFile.getMetadata();
      const [fileContent] = await objectFile.download();
      const base64Content = fileContent.toString('base64');
      
      // Determine MIME type from metadata or file extension
      let mimeType = metadata.contentType || 'application/octet-stream';
      
      // Return data URL that can be opened in new tab
      res.json({
        success: true,
        dataUrl: `data:${mimeType};base64,${base64Content}`,
        fileName: objectFile.name.substring(objectFile.name.lastIndexOf('/') + 1)
      });
    } catch (error: any) {
      console.error("Document retrieval error:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(500).json({ error: "Failed to retrieve document: " + error.message });
    }
  });

  // Delete document from object storage using SDK
  app.delete("/technical/api/documents/:fileKey(*)", async (req, res) => {
    try {
      const fileKey = '/' + req.params.fileKey;
      const objectStorageService = new ObjectStorageService();
      
      // Get object file from entity path
      const objectFile = await objectStorageService.getObjectEntityFile(fileKey);
      
      // Delete file using SDK
      await objectFile.delete();
      
      res.json({ success: true, message: "Document deleted successfully" });
    } catch (error: any) {
      console.error("Document deletion error:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(500).json({ error: "Failed to delete document: " + error.message });
    }
  });
  
  // Admin endpoint: Trigger job due scan manually (for testing/debugging WO generation)
  // GET version for easy testing
  app.get("/technical/api/admin/job-due-scan", async (req, res) => {
    try {
      console.log('🔍 Manual job due scan triggered (GET) for ALL vessels');
      
      const { jobDueScanner } = await import("./services/jobDueScanner");
      const results = await jobDueScanner.runScan();
      
      console.log('✅ Manual job due scan completed:', results);
      
      res.json({
        success: true,
        scanCompleted: true,
        message: `Job due scan completed`,
        results: {
          calendarJobsChecked: results.calendarJobsChecked,
          calendarWOsGenerated: results.calendarWOsGenerated,
          rhJobsChecked: results.rhJobsChecked,
          rhWOsGenerated: results.rhWOsGenerated,
          totalGenerated: results.calendarWOsGenerated + results.rhWOsGenerated
        }
      });
    } catch (error: any) {
      console.error("❌ Job due scan failed:", error);
      res.status(500).json({ 
        success: false,
        scanCompleted: false,
        error: "Failed to run job due scan: " + error.message 
      });
    }
  });
  
  // POST version for programmatic triggering
  app.post("/technical/api/admin/job-due-scan", async (req, res) => {
    try {
      const { vesselId } = req.body;
      
      console.log(`🔍 Manual job due scan triggered${vesselId ? ` for vessel: ${vesselId}` : ' for ALL vessels'}`);
      
      // Import and run the scanner
      const { jobDueScanner } = await import("./services/jobDueScanner");
      const results = await jobDueScanner.runScan();
      
      console.log('✅ Manual job due scan completed:', results);
      
      res.json({
        success: true,
        message: `Job due scan completed`,
        results: {
          calendarJobsChecked: results.calendarJobsChecked,
          calendarWOsGenerated: results.calendarWOsGenerated,
          rhJobsChecked: results.rhJobsChecked,
          rhWOsGenerated: results.rhWOsGenerated,
          totalGenerated: results.calendarWOsGenerated + results.rhWOsGenerated
        }
      });
    } catch (error: any) {
      console.error("❌ Job due scan failed:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to run job due scan: " + error.message 
      });
    }
  });

  // Admin endpoint: Purge all jobs and linked data
  app.post("/technical/api/admin/purge-jobs", async (req, res) => {
    try {
      const { vesselId } = req.body;
      
      console.log(`🧹 Admin purge request received${vesselId ? ` for vessel: ${vesselId}` : ' for ALL vessels'}`);
      
      // Execute the purge
      const result = await storage.purgeJobsAndLinkedData(vesselId);
      
      // Log this operation in import history
      const importHistory = {
        id: Date.now().toString(),
        type: 'jobs' as const,
        fileName: 'PURGE_OPERATION',
        uploadedBy: 'admin',
        uploadedAt: new Date().toISOString(),
        status: 'success' as const,
        recordsProcessed: result.deletedJobs,
        recordsSuccess: result.deletedJobs,
        recordsFailed: 0,
        vesselId: vesselId || 'ALL_VESSELS',
        errors: []
      };
      
      // Note: We don't save this to importHistory since we just purged it
      // But we log it to console for audit trail
      console.log('✅ Purge operation completed:', {
        ...result,
        totalRecordsAffected: 
          result.deletedWorkOrderExecutions + 
          result.deletedWorkOrders + 
          result.deletedJobs + 
          result.deletedRunningHoursAudits
      });
      
      res.json({
        success: true,
        message: `Successfully purged jobs and linked data${vesselId ? ` for vessel ${vesselId}` : ' for all vessels'}`,
        statistics: result
      });
    } catch (error: any) {
      console.error("❌ Purge operation failed:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to purge jobs and linked data: " + error.message 
      });
    }
  });

  // ========================================
  // INVENTORY MIGRATION ENDPOINT
  // ========================================
  
  // Migrate existing spares data to new inventory structure
  // This converts legacy location text fields to normalized location entities
  app.post("/technical/api/admin/migrate-inventory", async (req, res) => {
    try {
      const { vesselId, dryRun = true } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ success: false, error: "vesselId is required" });
      }
      
      console.log(`🔄 Starting inventory migration for vessel: ${vesselId}${dryRun ? ' (DRY RUN)' : ''}`);
      
      // Get all spares for the vessel
      const sparesResult = await storage.getSpares(vesselId);
      
      const stats = {
        sparesProcessed: 0,
        locationsCreated: 0,
        stockRecordsCreated: 0,
        componentLinksCreated: 0,
        transactionsCreated: 0,
        errors: [] as string[]
      };
      
      for (const spare of sparesResult) {
        try {
          stats.sparesProcessed++;
          
          // Extract location text values
          const locationA = spare.location || 'Location A';
          const locationB = spare.location2 || 'Location B';
          
          // Only process if there's stock
          const robA = spare.robLocationA || 0;
          const robB = spare.robLocationB || 0;
          
          let runningRob = 0;
          
          // Process Location A
          if (robA > 0) {
            stats.locationsCreated++;
            stats.stockRecordsCreated++;
            stats.transactionsCreated++;
            
            if (!dryRun) {
              const locA = await storage.findOrCreateLocation(vesselId, locationA, 'System Migration');
              
              await storage.upsertSpareLocationStock({
                vesselId,
                spareId: spare.id,
                locationId: locA.id,
                qty: robA
              });
              
              await storage.createInventoryTransaction({
                vesselId,
                spareId: spare.id,
                locationId: locA.id,
                eventType: 'RECEIVE',
                qtyChange: robA,
                robTotalBefore: runningRob,
                robTotalAfter: runningRob + robA,
                robLocationBefore: 0,
                robLocationAfter: robA,
                referenceType: 'MANUAL',
                referenceId: `MIGRATE-${vesselId}-${Date.now()}`,
                referenceNote: `Opening balance migrated from legacy data`,
                userId: 'System Migration'
              });
            }
            runningRob += robA;
          }
          
          // Process Location B
          if (robB > 0) {
            stats.locationsCreated++;
            stats.stockRecordsCreated++;
            stats.transactionsCreated++;
            
            if (!dryRun) {
              const locB = await storage.findOrCreateLocation(vesselId, locationB, 'System Migration');
              
              await storage.upsertSpareLocationStock({
                vesselId,
                spareId: spare.id,
                locationId: locB.id,
                qty: robB
              });
              
              await storage.createInventoryTransaction({
                vesselId,
                spareId: spare.id,
                locationId: locB.id,
                eventType: 'RECEIVE',
                qtyChange: robB,
                robTotalBefore: runningRob,
                robTotalAfter: runningRob + robB,
                robLocationBefore: 0,
                robLocationAfter: robB,
                referenceType: 'MANUAL',
                referenceId: `MIGRATE-${vesselId}-${Date.now()}`,
                referenceNote: `Opening balance migrated from legacy data`,
                userId: 'System Migration'
              });
            }
          }
          
          // Create component link if componentId exists
          if (spare.componentId) {
            stats.componentLinksCreated++;
            
            if (!dryRun) {
              try {
                await storage.createSpareComponentLink({
                  vesselId,
                  spareId: spare.id,
                  componentId: spare.componentId,
                  linkedBy: 'System Migration'
                });
              } catch (linkError: any) {
                // Ignore duplicate link errors, but decrement count
                if (!linkError.message?.includes('duplicate')) {
                  stats.errors.push(`Link error for spare ${spare.id}: ${linkError.message}`);
                } else {
                  stats.componentLinksCreated--; // Already exists
                }
              }
            }
          }
        } catch (spareError: any) {
          stats.errors.push(`Error processing spare ${spare.id}: ${spareError.message}`);
        }
      }
      
      console.log(`✅ Migration ${dryRun ? 'preview' : 'completed'}:`, stats);
      
      res.json({
        success: true,
        dryRun,
        message: dryRun 
          ? `Migration preview complete. Set dryRun=false to execute.`
          : `Migration completed successfully`,
        statistics: stats
      });
    } catch (error: any) {
      console.error("❌ Migration failed:", error);
      res.status(500).json({ 
        success: false,
        error: "Migration failed: " + error.message 
      });
    }
  });

  // ========================================
  // WORK ORDER STATUS SYNC ENDPOINT
  // ========================================
  
  // Sync stale stored status values with computed status
  // This ensures the database status field matches the runtime computed status
  app.post("/technical/api/admin/sync-work-order-status", async (req, res) => {
    try {
      const { vesselId, dryRun = true } = req.body;
      
      console.log(`🔄 Starting work order status sync${vesselId ? ` for vessel ${vesselId}` : ' for all vessels'}${dryRun ? ' (DRY RUN)' : ''}`);
      
      // Get all work orders (filtered by vessel if specified)
      const workOrders = await storage.getWorkOrders(vesselId || undefined);
      
      // Get all vessels for grace settings
      const allVessels = await storage.getVessels();
      const vesselSettingsMap = new Map<string, any>();
      const graceSettingsMap = new Map<string, any>();
      
      for (const vessel of allVessels) {
        if (vessel.id) {
          const settings = await storage.getPmsVesselSettings(vessel.id);
          if (settings) {
            vesselSettingsMap.set(vessel.id, settings);
            graceSettingsMap.set(vessel.id, settings);
          }
        }
      }
      
      // Get all jobs and components for status calculation
      const allJobs = await storage.getJobs();
      const jobMap = new Map(allJobs.map(j => [j.id, j]));
      
      const allComponents = await storage.getComponents();
      // Create map by componentCode for matching with work order's componentCode field
      const componentByCodeMap = new Map(allComponents.map(c => [c.componentCode, c]));
      
      const stats = {
        totalProcessed: 0,
        statusUpdated: 0,
        alreadyCorrect: 0,
        errors: [] as string[],
        changes: [] as { id: string; workOrderNo: string; oldStatus: string; newStatus: string }[]
      };
      
      for (const wo of workOrders) {
        try {
          stats.totalProcessed++;
          
          const job = wo.jobId ? jobMap.get(wo.jobId) : undefined;
          const component = wo.componentCode ? componentByCodeMap.get(wo.componentCode) : undefined;
          const vesselSettings = wo.vesselId ? vesselSettingsMap.get(wo.vesselId) : undefined;
          const vesselGraceSettings = wo.vesselId ? graceSettingsMap.get(wo.vesselId) : undefined;
          
          // Parse RH values
          const parseRH = (val: string | number | null | undefined): number | undefined => {
            if (val === null || val === undefined || val === '') return undefined;
            const num = typeof val === 'number' ? val : parseFloat(String(val));
            return isNaN(num) ? undefined : num;
          };
          
          // Primary: job.nextDueRH, Fallback: workOrder.nextDueReading
          const dueRH = wo.maintenanceBasis === 'Running Hours' 
            ? (parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading)) 
            : undefined;
          // Primary: component.currentCumulativeRH, Fallback: workOrder.currentReading
          const currentRH = wo.maintenanceBasis === 'Running Hours' 
            ? (parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading)) 
            : undefined;
          
          // Determine RH lead time based on job criticality
          const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || job?.classRelated === true;
          const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours' 
            ? (isJobCritical 
                ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
                : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS))
            : undefined;
          
          // Compute status
          const computedStatus = computeWorkOrderStatus({
            dueDate: wo.dueDate,
            dueRH,
            currentRH,
            isExecution: wo.isExecution || false,
            status: wo.status,
            completionDateTime: wo.completionDateTime,
            maintenanceBasis: wo.maintenanceBasis,
            vesselGraceSettings: vesselGraceSettings ? {
              calendarGraceMode: vesselGraceSettings.calendarGraceMode || 'COMPANY_STANDARD',
              calendarGraceDays: vesselGraceSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
              rhGraceHours: vesselSettings?.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
              rhLeadTimeHours: vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
            } : undefined,
            rhLeadTimeHours
          });
          
          // Check if status needs updating
          if (wo.status !== computedStatus) {
            stats.changes.push({
              id: wo.id,
              workOrderNo: wo.workOrderNo,
              oldStatus: wo.status || 'null',
              newStatus: computedStatus
            });
            
            if (!dryRun) {
              await storage.updateWorkOrder(wo.id, { status: computedStatus });
              stats.statusUpdated++;
            } else {
              stats.statusUpdated++;
            }
          } else {
            stats.alreadyCorrect++;
          }
        } catch (woError: any) {
          stats.errors.push(`Error processing WO ${wo.workOrderNo}: ${woError.message}`);
        }
      }
      
      console.log(`✅ Status sync ${dryRun ? 'preview' : 'completed'}:`, {
        totalProcessed: stats.totalProcessed,
        statusUpdated: stats.statusUpdated,
        alreadyCorrect: stats.alreadyCorrect,
        errors: stats.errors.length
      });
      
      res.json({
        success: true,
        dryRun,
        message: dryRun 
          ? `Status sync preview complete. ${stats.statusUpdated} work orders would be updated. Set dryRun=false to execute.`
          : `Status sync completed. ${stats.statusUpdated} work orders updated.`,
        statistics: {
          totalProcessed: stats.totalProcessed,
          statusUpdated: stats.statusUpdated,
          alreadyCorrect: stats.alreadyCorrect,
          errorCount: stats.errors.length
        },
        changes: stats.changes.slice(0, 50), // Limit to first 50 for response size
        errors: stats.errors
      });
    } catch (error: any) {
      console.error("❌ Status sync failed:", error);
      res.status(500).json({ 
        success: false,
        error: "Status sync failed: " + error.message 
      });
    }
  });

  // ========================================
  // EXTERNAL MASTER DATA SYNC ENDPOINT
  // ========================================
  
  // Sync All - Fetches external master data and upserts to local tables
  // Used by Admin → Data Masters screen
  // Protected by PMS Admin role requirement
  app.post("/technical/api/admin/sync-masters", requirePMSAdmin, async (req, res) => {
    try {
      console.log("🔄 Starting master data sync...");
      
      const domain = req.body.domain || 'rsms';
      const BASE_URL = "https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata";
      
      const stats = {
        vessels: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
        vesselTypes: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
        additionalGroups: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
        ports: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
        users: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
        fleetGroups: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
      };
      
      // Helper to fetch from external API
      const fetchExternal = async (endpoint: string, key: string) => {
        const response = await fetch(`${BASE_URL}/${endpoint}?domain=${domain}`);
        if (!response.ok) throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
        const data = await response.json();
        return data[key] || [];
      };
      
      // Helper to get Entry ID from various field names
      const getEntryId = (entry: any, idFields: string[]): string | null => {
        for (const field of idFields) {
          if (entry[field] !== undefined && entry[field] !== null) {
            return String(entry[field]);
          }
        }
        return null;
      };
      
      // Helper to get field value from various field names
      const getFieldValue = (entry: any, fields: string[]): string | null => {
        for (const field of fields) {
          if (entry[field] !== undefined && entry[field] !== null) {
            return String(entry[field]);
          }
        }
        return null;
      };
      
      // Get database pool for raw queries
      const pool = await getPool();
      
      // 1. Sync Vessels
      console.log("📦 Syncing Vessel Master...");
      const vessels = await fetchExternal('vessels', 'vessels');
      for (const v of vessels) {
        try {
          const entryId = getEntryId(v, ['vuid', 'vesselId']);
          if (!entryId) {
            stats.vessels.skipped++;
            continue;
          }
          const name = getFieldValue(v, ['vessel', 'vesselName', 'name']) || 'Unknown';
          const imoNumber = getFieldValue(v, ['imo_number', 'imoNumber', 'imo_no', 'imo']);
          const vesselType = getFieldValue(v, ['vessel_type_name', 'vesselTypeName', 'vessel_type', 'vesselType', 'type']);
          
          // Upsert vessel using raw SQL
          await pool.query(`
            INSERT INTO vessels (id, name, code, imo_number, vessel_type, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              code = EXCLUDED.code,
              imo_number = EXCLUDED.imo_number,
              vessel_type = EXCLUDED.vessel_type,
              is_active = true,
              updated_at = NOW()
          `, [entryId, name, entryId, imoNumber, vesselType]);
          stats.vessels.updated++;
        } catch (e: any) {
          stats.vessels.errors.push(`Vessel ${v.vuid || v.vesselId}: ${e.message}`);
        }
      }
      
      // 2. Sync Vessel Types
      console.log("📦 Syncing Vessel Types...");
      const vesselTypes = await fetchExternal('vesseltypes', 'vesseltypes');
      for (const vt of vesselTypes) {
        try {
          const entryId = getEntryId(vt, ['vtuid', 'id', 'vesselTypeId']);
          if (!entryId) {
            stats.vesselTypes.skipped++;
            continue;
          }
          const name = getFieldValue(vt, ['vesselType', 'vesselTypeName', 'name', 'type_name']) || 'Unknown';
          
          // Build classification string from flags
          const classifications: string[] = [];
          if (vt.tanker === 1) classifications.push('Tanker');
          if (vt.oilTanker === 1) classifications.push('Oil');
          if (vt.gasTanker === 1) classifications.push('Gas');
          if (vt.chemicalTanker === 1) classifications.push('Chemical');
          if (vt.dry === 1) classifications.push('Dry');
          if (vt.container === 1) classifications.push('Container');
          const classification = classifications.length > 0 ? classifications.join(', ') : null;
          
          await pool.query(`
            INSERT INTO vessel_types (id, name, classification, synced_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              classification = EXCLUDED.classification,
              synced_at = NOW(),
              updated_at = NOW()
          `, [entryId, name, classification]);
          stats.vesselTypes.updated++;
        } catch (e: any) {
          stats.vesselTypes.errors.push(`VesselType ${vt.vtuid}: ${e.message}`);
        }
      }
      
      // 3. Sync Additional Groups
      console.log("📦 Syncing Additional Groups...");
      const additionalGroups = await fetchExternal('additionalgroups', 'additionalGroups');
      for (const ag of additionalGroups) {
        try {
          const entryId = getEntryId(ag, ['id', 'groupId', 'additional_group_id']);
          if (!entryId) {
            stats.additionalGroups.skipped++;
            continue;
          }
          const name = getFieldValue(ag, ['group_name', 'groupName', 'name', 'additional_group_name']) || 'Unknown';
          const description = getFieldValue(ag, ['vessels', 'group_description', 'desc']);
          
          await pool.query(`
            INSERT INTO additional_groups (id, name, description, synced_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              synced_at = NOW(),
              updated_at = NOW()
          `, [entryId, name, description]);
          stats.additionalGroups.updated++;
        } catch (e: any) {
          stats.additionalGroups.errors.push(`AdditionalGroup ${ag.id}: ${e.message}`);
        }
      }
      
      // 4. Sync Ports
      console.log("📦 Syncing Ports...");
      const ports = await fetchExternal('ports', 'ports');
      for (const p of ports) {
        try {
          const entryId = getEntryId(p, ['puid', 'id', 'portId']);
          if (!entryId) {
            stats.ports.skipped++;
            continue;
          }
          const name = getFieldValue(p, ['port_name', 'portName', 'name']) || 'Unknown';
          const country = getFieldValue(p, ['country_name', 'countryName', 'country']);
          
          await pool.query(`
            INSERT INTO ports (id, name, country, synced_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              country = EXCLUDED.country,
              synced_at = NOW(),
              updated_at = NOW()
          `, [entryId, name, country]);
          stats.ports.updated++;
        } catch (e: any) {
          stats.ports.errors.push(`Port ${p.puid}: ${e.message}`);
        }
      }
      
      // 5. Sync Users (to master_users table)
      console.log("📦 Syncing Users...");
      const users = await fetchExternal('users', 'users');
      for (const u of users) {
        try {
          const entryId = getEntryId(u, ['uuid', 'id', 'userId']);
          if (!entryId) {
            stats.users.skipped++;
            continue;
          }
          const fullName = getFieldValue(u, ['fullname', 'userName', 'name', 'username', 'full_name']) || 'Unknown';
          const role = getFieldValue(u, ['role', 'role_name', 'roleName', 'user_role']);
          const designation = getFieldValue(u, ['designation', 'position', 'title', 'job_title']);
          const userType = getFieldValue(u, ['user_type', 'userType', 'type']);
          const department = getFieldValue(u, ['department', 'department_name', 'dept']);
          const email = getFieldValue(u, ['email', 'email_address', 'user_email']);
          
          await pool.query(`
            INSERT INTO master_users (id, full_name, role, designation, user_type, department, email, synced_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              role = EXCLUDED.role,
              designation = EXCLUDED.designation,
              user_type = EXCLUDED.user_type,
              department = EXCLUDED.department,
              email = EXCLUDED.email,
              synced_at = NOW(),
              updated_at = NOW()
          `, [entryId, fullName, role, designation, userType, department, email]);
          stats.users.updated++;
        } catch (e: any) {
          stats.users.errors.push(`User ${u.uuid}: ${e.message}`);
        }
      }
      
      // 6. Sync Fleet Groups
      console.log("📦 Syncing Fleet Groups...");
      const fleetGroups = await fetchExternal('fleetgroups', 'fleetGroups');
      for (const fg of fleetGroups) {
        try {
          const entryId = getEntryId(fg, ['fleet_group_id', 'id', 'fleetGroupId']);
          if (!entryId) {
            stats.fleetGroups.skipped++;
            continue;
          }
          const name = getFieldValue(fg, ['fleet_group_name', 'fleetGroupName', 'name', 'group_name']) || 'Unknown';
          const description = getFieldValue(fg, ['vessels', 'fleet_group_description', 'desc']);
          
          await pool.query(`
            INSERT INTO fleet_groups (id, name, description, synced_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              synced_at = NOW(),
              updated_at = NOW()
          `, [entryId, name, description]);
          stats.fleetGroups.updated++;
        } catch (e: any) {
          stats.fleetGroups.errors.push(`FleetGroup ${fg.fleet_group_id}: ${e.message}`);
        }
      }
      
      console.log("✅ Master data sync completed:", stats);
      
      res.json({
        success: true,
        message: "Master data sync completed successfully",
        statistics: stats
      });
    } catch (error: any) {
      console.error("❌ Master data sync failed:", error);
      res.status(500).json({ 
        success: false,
        error: "Master data sync failed: " + error.message 
      });
    }
  });

  // ========================================
  // CERTIFICATES API ROUTES (Cert & Surveys Module)
  // ========================================
  // Certificates data is now sourced from:
  // - vesselCertificateApplicability: which certificates are applicable per vessel
  // - shipCertificatesMaster: certificate details (Company ID, Name, Company Group)
  // - vesselCertificateData: vessel-specific date fields and attachments
  
  // GET all certificates - joins the three tables to build certificate list
  // Query params: vesselId, vesselName, page (default 1), limit (default 100), sortBy, sortOrder
  app.get("/technical/api/certificates", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(500).json({ error: "Database not available" });
      }
      const { db } = postgres;
      
      const vesselIdFilter = req.query.vesselId as string | undefined;
      const vesselNameFilter = req.query.vesselName as string | undefined;
      const vesselNamesFilter = req.query.vesselNames as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';
      
      // Step 1: Get applicable certificates for vessels from vesselCertificateApplicability
      let applicabilityQuery = db.select().from(vesselCertificateApplicability)
        .where(eq(vesselCertificateApplicability.isApplicable, true));
      
      const applicabilityRecords = await applicabilityQuery;
      
      if (applicabilityRecords.length === 0) {
        return res.json({ certificates: [], total: 0, page, limit });
      }
      
      // Filter by vessel if specified
      let filteredApplicability = applicabilityRecords;
      if (vesselIdFilter) {
        filteredApplicability = applicabilityRecords.filter(r => r.vesselId === vesselIdFilter);
      } else if (vesselNameFilter) {
        // Use exact match for vessel name (case-insensitive)
        const normalizedFilter = vesselNameFilter.toLowerCase().trim();
        filteredApplicability = applicabilityRecords.filter(r => 
          r.vesselName.toLowerCase().trim() === normalizedFilter
        );
      } else if (vesselNamesFilter) {
        // Handle multiple vessel names (comma-separated)
        const vesselNamesList = vesselNamesFilter.split(',').map(n => n.toLowerCase().trim());
        filteredApplicability = applicabilityRecords.filter(r => 
          vesselNamesList.includes(r.vesselName.toLowerCase().trim())
        );
      }
      
      if (filteredApplicability.length === 0) {
        return res.json({ certificates: [], total: 0, page, limit });
      }
      
      // Step 2: Get all master certificates referenced by applicability records
      const masterIds = [...new Set(filteredApplicability.map(r => r.masterId))];
      const masterRecords = await db.select().from(shipCertificatesMaster)
        .where(
          and(
            eq(shipCertificatesMaster.applicableToCompany, true),
            inArray(shipCertificatesMaster.masterId, masterIds)
          )
        )
        .orderBy(asc(shipCertificatesMaster.companySequence));
      
      // Create a map for quick lookup
      const masterMap = new Map(masterRecords.map(m => [m.masterId, m]));
      
      // Step 3: Get vessel certificate data (dates, attachments) for these certificates
      const vesselCertDataRecords = await db.select().from(vesselCertificateData);
      
      // Create a map for vessel-certificate data lookup
      const certDataMap = new Map<string, typeof vesselCertDataRecords[0]>();
      for (const data of vesselCertDataRecords) {
        const key = `${data.vesselId}-${data.masterId}`;
        certDataMap.set(key, data);
      }
      
      // Step 4: Build the certificate list
      const certificates: any[] = [];
      
      // Group by vessel to maintain order
      const vesselGroups = new Map<string, typeof filteredApplicability>();
      for (const app of filteredApplicability) {
        if (!vesselGroups.has(app.vesselId)) {
          vesselGroups.set(app.vesselId, []);
        }
        vesselGroups.get(app.vesselId)!.push(app);
      }
      
      // Process each vessel's certificates in sequence order
      for (const [vesselId, apps] of vesselGroups) {
        // Sort by master certificate sequence (use companySequence if set, otherwise fall back to sequence)
        const sortedApps = apps.sort((a, b) => {
          const masterA = masterMap.get(a.masterId);
          const masterB = masterMap.get(b.masterId);
          // Use companySequence if available, otherwise fall back to sequence field
          const seqA = masterA?.companySequence ?? masterA?.sequence ?? 9999;
          const seqB = masterB?.companySequence ?? masterB?.sequence ?? 9999;
          return seqA - seqB;
        });
        
        for (const app of sortedApps) {
          const master = masterMap.get(app.masterId);
          if (!master) continue;
          
          const dataKey = `${app.vesselId}-${app.masterId}`;
          const certData = certDataMap.get(dataKey);
          
          // Use companySequence if available, otherwise use sequence field
          const effectiveSequence = master.companySequence ?? master.sequence ?? 9999;
          
          certificates.push({
            id: master.companyId || master.masterId,
            certificateName: master.certificateLabel || master.certificateName,
            type: master.companyGroup || '',
            vessel: app.vesselName,
            vesselId: app.vesselId,
            masterId: app.masterId,
            companySequence: effectiveSequence,
            issueDate: certData?.issueDate || '',
            expiryDate: certData?.expiryDate || '',
            lastAnnual: certData?.lastAnnual || '',
            lastInterm: certData?.lastInterm || '',
            endorsementDate: certData?.endorsementDate || '',
            lastEditUpload: certData?.lastEditUpload || '',
            attachments: certData?.attachments || [],
          });
        }
      }
      
      // Apply server-side sorting before pagination
      if (sortBy) {
        certificates.sort((a, b) => {
          let valA: any;
          let valB: any;
          
          switch (sortBy) {
            case 'id':
            case 'companyId':
              valA = a.id || '';
              valB = b.id || '';
              break;
            case 'certificateName':
            case 'name':
              valA = a.certificateName || '';
              valB = b.certificateName || '';
              break;
            case 'vessel':
              valA = a.vessel || '';
              valB = b.vessel || '';
              break;
            case 'type':
            case 'companyGroup':
              valA = a.type || '';
              valB = b.type || '';
              break;
            case 'issueDate':
              valA = a.issueDate || '';
              valB = b.issueDate || '';
              break;
            case 'expiryDate':
              valA = a.expiryDate || '';
              valB = b.expiryDate || '';
              break;
            case 'lastAnnual':
              valA = a.lastAnnual || '';
              valB = b.lastAnnual || '';
              break;
            case 'lastInterm':
              valA = a.lastInterm || '';
              valB = b.lastInterm || '';
              break;
            case 'endorsementDate':
              valA = a.endorsementDate || '';
              valB = b.endorsementDate || '';
              break;
            case 'companySequence':
              valA = a.companySequence ?? 9999;
              valB = b.companySequence ?? 9999;
              break;
            default:
              valA = a.companySequence ?? 9999;
              valB = b.companySequence ?? 9999;
          }
          
          // For string comparisons
          if (typeof valA === 'string' && typeof valB === 'string') {
            const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            return sortOrder === 'desc' ? -comparison : comparison;
          }
          
          // For numeric comparisons
          const diff = (valA as number) - (valB as number);
          return sortOrder === 'desc' ? -diff : diff;
        });
      }
      
      // Apply pagination
      const total = certificates.length;
      const paginatedCerts = certificates.slice(offset, offset + limit);
      
      res.json({ 
        certificates: paginatedCerts, 
        total, 
        page, 
        limit,
        totalPages: Math.ceil(total / limit),
        sortBy: sortBy || 'companySequence',
        sortOrder
      });
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });
  
  // GET single certificate by compound key (vesselId-masterId) or companyId
  app.get("/technical/api/certificates/:id", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(500).json({ error: "Database not available" });
      }
      const { db } = postgres;
      
      const certId = req.params.id;
      // Use :: as separator to avoid conflicts with UUID dashes in vesselId
      const [vesselId, masterId] = certId.includes('::') ? certId.split('::', 2) : [null, null];
      
      if (!vesselId || !masterId) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      // Get applicability record
      const appRecords = await db.select().from(vesselCertificateApplicability)
        .where(
          and(
            eq(vesselCertificateApplicability.vesselId, vesselId),
            eq(vesselCertificateApplicability.masterId, masterId),
            eq(vesselCertificateApplicability.isApplicable, true)
          )
        )
        .limit(1);
      
      if (appRecords.length === 0) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      const app = appRecords[0];
      
      // Get master certificate
      const masterRecords = await db.select().from(shipCertificatesMaster)
        .where(eq(shipCertificatesMaster.masterId, masterId))
        .limit(1);
      
      if (masterRecords.length === 0) {
        return res.status(404).json({ error: "Certificate master not found" });
      }
      const master = masterRecords[0];
      
      // Get certificate data
      const dataRecords = await db.select().from(vesselCertificateData)
        .where(
          and(
            eq(vesselCertificateData.vesselId, vesselId),
            eq(vesselCertificateData.masterId, masterId)
          )
        )
        .limit(1);
      const certData = dataRecords[0];
      
      res.json({
        id: master.companyId || master.masterId,
        certificateName: master.certificateLabel || master.certificateName,
        type: master.companyGroup || '',
        vessel: app.vesselName,
        vesselId: app.vesselId,
        masterId: app.masterId,
        issueDate: certData?.issueDate || '',
        expiryDate: certData?.expiryDate || '',
        lastAnnual: certData?.lastAnnual || '',
        lastInterm: certData?.lastInterm || '',
        endorsementDate: certData?.endorsementDate || '',
        lastEditUpload: certData?.lastEditUpload || '',
        attachments: certData?.attachments || [],
      });
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ error: "Failed to fetch certificate" });
    }
  });
  
  // PATCH update certificate data (dates, attachments)
  // ID format: vesselId-masterId
  app.patch("/technical/api/certificates/:id", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(500).json({ error: "Database not available" });
      }
      const { db } = postgres;
      
      const certId = req.params.id;
      const { vesselId: bodyVesselId, masterId: bodyMasterId, ...updateData } = req.body;
      
      // Try to parse ID as vesselId::masterId (using :: as separator to avoid conflicts with UUID dashes)
      let vesselId = bodyVesselId;
      let masterId = bodyMasterId;
      
      if (certId.includes('::')) {
        [vesselId, masterId] = certId.split('::', 2);
      }
      
      if (!vesselId || !masterId) {
        return res.status(400).json({ error: "vesselId and masterId are required" });
      }
      
      // Get vessel name from applicability record
      const appRecords = await db.select().from(vesselCertificateApplicability)
        .where(
          and(
            eq(vesselCertificateApplicability.vesselId, vesselId),
            eq(vesselCertificateApplicability.masterId, masterId)
          )
        )
        .limit(1);
      
      const vesselName = appRecords[0]?.vesselName || '';
      
      // Check if data record exists
      const existingData = await db.select().from(vesselCertificateData)
        .where(
          and(
            eq(vesselCertificateData.vesselId, vesselId),
            eq(vesselCertificateData.masterId, masterId)
          )
        )
        .limit(1);
      
      let result;
      if (existingData.length > 0) {
        // Update existing record
        result = await db.update(vesselCertificateData)
          .set({ ...updateData, updatedAt: new Date() })
          .where(
            and(
              eq(vesselCertificateData.vesselId, vesselId),
              eq(vesselCertificateData.masterId, masterId)
            )
          )
          .returning();
      } else {
        // Create new record
        result = await db.insert(vesselCertificateData)
          .values({
            vesselId,
            vesselName,
            masterId,
            ...updateData,
          })
          .returning();
      }
      
      // Get full certificate for response
      const masterRecords = await db.select().from(shipCertificatesMaster)
        .where(eq(shipCertificatesMaster.masterId, masterId))
        .limit(1);
      const master = masterRecords[0];
      
      res.json({
        id: master?.companyId || masterId,
        certificateName: master?.certificateLabel || master?.certificateName || '',
        type: master?.companyGroup || '',
        vessel: vesselName,
        vesselId,
        masterId,
        issueDate: result[0]?.issueDate || '',
        expiryDate: result[0]?.expiryDate || '',
        lastAnnual: result[0]?.lastAnnual || '',
        lastInterm: result[0]?.lastInterm || '',
        endorsementDate: result[0]?.endorsementDate || '',
        lastEditUpload: result[0]?.lastEditUpload || '',
        attachments: result[0]?.attachments || [],
      });
    } catch (error: any) {
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Failed to update certificate" });
    }
  });

  // ========================================
  // SURVEYS API ROUTES
  // ========================================
  
  // Initialize surveys with sample data if empty (uses storage layer)
  const initializeSurveys = async () => {
    const existingSurveys = await storage.getSurveys();
    if (existingSurveys.length === 0) {
      const sampleSurveys = [
        {
          id: 'S1',
          surveyName: 'Ballast Water Management annual Survey',
          type: 'Annual',
          vessel: 'MV Test',
          surveyDate: '01 Sep 2019',
          dueDate: '01 Sep 2024',
          firstRangeDate: '01 Sep 2024',
          secondRangeDate: '01 Sep 2024',
          postponed: '01 Sep 2024',
          lastEdit: '01 Sep 2024',
          applicable: true,
          attachments: [],
        },
        {
          id: 'S2',
          surveyName: 'Ballast Water Management annual Survey',
          type: 'Int',
          vessel: 'MV Test',
          surveyDate: '',
          dueDate: '',
          firstRangeDate: '',
          secondRangeDate: '',
          postponed: '',
          lastEdit: '',
          applicable: true,
          attachments: [],
        },
        {
          id: 'S3',
          surveyName: 'Safety Equipment Survey',
          type: 'Annual',
          vessel: 'MV TEST 2',
          surveyDate: '15 Mar 2020',
          dueDate: '15 Mar 2025',
          firstRangeDate: '15 Mar 2024',
          secondRangeDate: '15 Sep 2024',
          postponed: '',
          lastEdit: '20 Oct 2024',
          applicable: true,
          attachments: [],
        },
        {
          id: 'S4',
          surveyName: 'Hull and Machinery Survey',
          type: 'Int',
          vessel: 'MT Nordic Star',
          surveyDate: '01 Jan 2021',
          dueDate: '01 Jan 2026',
          firstRangeDate: '01 Jan 2024',
          secondRangeDate: '01 Jul 2024',
          postponed: '01 Mar 2024',
          lastEdit: '15 Nov 2024',
          applicable: false,
          attachments: [],
        },
        {
          id: 'S5',
          surveyName: 'Load Line Survey',
          type: 'Annual',
          vessel: 'MT Pacific Voyager',
          surveyDate: '10 Jun 2022',
          dueDate: '10 Jun 2027',
          firstRangeDate: '10 Jun 2024',
          secondRangeDate: '',
          postponed: '',
          lastEdit: '25 Sep 2024',
          applicable: true,
          attachments: [],
        },
      ];
      for (const survey of sampleSurveys) {
        await storage.createSurvey(survey);
      }
      console.log('📋 Initialized surveys data with sample data via storage layer');
    }
  };
  
  // Initialize on startup (async)
  initializeSurveys();
  
  // GET all surveys - uses three-table join (applicability + master + data)
  // Returns only applicable surveys, ordered by companySequence
  app.get("/technical/api/surveys", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(500).json({ error: "Database not available" });
      }
      const { db } = postgres;
      
      const vesselIdFilter = req.query.vesselId as string | undefined;
      const vesselNameFilter = req.query.vesselName as string | undefined;
      const vesselNamesFilter = req.query.vesselNames as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';
      
      // Step 1: Get applicable surveys for vessels from vesselSurveyApplicability
      let applicabilityQuery = db.select().from(vesselSurveyApplicability)
        .where(eq(vesselSurveyApplicability.isApplicable, true));
      
      const applicabilityRecords = await applicabilityQuery;
      
      if (applicabilityRecords.length === 0) {
        return res.json({ surveys: [], total: 0, page, limit, totalPages: 0 });
      }
      
      // Filter by vessel if specified
      let filteredApplicability = applicabilityRecords;
      if (vesselIdFilter) {
        filteredApplicability = applicabilityRecords.filter(r => r.vesselId === vesselIdFilter);
      } else if (vesselNameFilter) {
        const normalizedFilter = vesselNameFilter.toLowerCase().trim();
        filteredApplicability = applicabilityRecords.filter(r => 
          r.vesselName.toLowerCase().trim() === normalizedFilter
        );
      } else if (vesselNamesFilter) {
        // Handle multiple vessel names (comma-separated)
        const vesselNamesList = vesselNamesFilter.split(',').map(n => n.toLowerCase().trim());
        filteredApplicability = applicabilityRecords.filter(r => 
          vesselNamesList.includes(r.vesselName.toLowerCase().trim())
        );
      }
      
      if (filteredApplicability.length === 0) {
        return res.json({ surveys: [], total: 0, page, limit, totalPages: 0 });
      }
      
      // Step 2: Get all master surveys referenced by applicability records
      const masterIds = [...new Set(filteredApplicability.map(r => r.masterId))];
      const masterRecords = await db.select().from(shipSurveysMaster)
        .where(
          and(
            eq(shipSurveysMaster.applicableToCompany, true),
            inArray(shipSurveysMaster.masterId, masterIds)
          )
        )
        .orderBy(asc(shipSurveysMaster.companySequence));
      
      // Create a map for quick lookup
      const masterMap = new Map(masterRecords.map(m => [m.masterId, m]));
      
      // Step 3: Get vessel survey data (dates, attachments) for these surveys
      const surveyDataRecords = await db.select().from(vesselSurveyData);
      
      // Create a map for vessel-survey data lookup
      const surveyDataMap = new Map<string, typeof surveyDataRecords[0]>();
      for (const data of surveyDataRecords) {
        const key = `${data.vesselId}-${data.masterId}`;
        surveyDataMap.set(key, data);
      }
      
      // Step 4: Build the survey list
      const surveys: any[] = [];
      
      // Group by vessel to maintain order
      const vesselGroups = new Map<string, typeof filteredApplicability>();
      for (const app of filteredApplicability) {
        if (!vesselGroups.has(app.vesselId)) {
          vesselGroups.set(app.vesselId, []);
        }
        vesselGroups.get(app.vesselId)!.push(app);
      }
      
      // Process each vessel's surveys in sequence order
      for (const [vesselId, apps] of vesselGroups) {
        // Sort by master survey sequence (use companySequence if set)
        const sortedApps = apps.sort((a, b) => {
          const masterA = masterMap.get(a.masterId);
          const masterB = masterMap.get(b.masterId);
          const seqA = masterA?.companySequence ?? masterA?.sequence ?? 9999;
          const seqB = masterB?.companySequence ?? masterB?.sequence ?? 9999;
          return seqA - seqB;
        });
        
        for (const app of sortedApps) {
          const master = masterMap.get(app.masterId);
          if (!master) continue;
          
          const dataKey = `${app.vesselId}-${app.masterId}`;
          const surveyData = surveyDataMap.get(dataKey);
          
          const effectiveSequence = master.companySequence ?? master.sequence ?? 9999;
          
          surveys.push({
            id: `${app.vesselId}::${app.masterId}`,
            companyId: master.companyId || master.masterId,
            surveyName: master.surveyLabel || master.surveyName,
            type: master.companyGroup || '',
            vessel: app.vesselName,
            vesselId: app.vesselId,
            masterId: app.masterId,
            companySequence: effectiveSequence,
            surveyDate: surveyData?.surveyDate || '',
            dueDate: surveyData?.dueDate || '',
            firstRangeDate: surveyData?.firstRangeDate || '',
            secondRangeDate: surveyData?.secondRangeDate || '',
            postponed: surveyData?.postponed || '',
            lastEdit: surveyData?.lastEditUpload || '',
            attachments: surveyData?.attachments || [],
          });
        }
      }
      
      // Apply server-side sorting before pagination
      if (sortBy) {
        surveys.sort((a, b) => {
          let valA: any;
          let valB: any;
          
          switch (sortBy) {
            case 'id':
            case 'companyId':
              valA = a.id || '';
              valB = b.id || '';
              break;
            case 'surveyName':
            case 'name':
              valA = a.surveyName || '';
              valB = b.surveyName || '';
              break;
            case 'vessel':
              valA = a.vessel || '';
              valB = b.vessel || '';
              break;
            case 'type':
            case 'companyGroup':
              valA = a.type || '';
              valB = b.type || '';
              break;
            case 'surveyDate':
              valA = a.surveyDate || '';
              valB = b.surveyDate || '';
              break;
            case 'dueDate':
              valA = a.dueDate || '';
              valB = b.dueDate || '';
              break;
            default:
              valA = a.companySequence;
              valB = b.companySequence;
          }
          
          if (typeof valA === 'string' && typeof valB === 'string') {
            return sortOrder === 'asc' 
              ? valA.localeCompare(valB) 
              : valB.localeCompare(valA);
          }
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        });
      }
      
      // Apply pagination
      const total = surveys.length;
      const totalPages = Math.ceil(total / limit);
      const paginatedSurveys = surveys.slice(offset, offset + limit);
      
      res.json({ 
        surveys: paginatedSurveys, 
        total, 
        page, 
        limit,
        totalPages
      });
    } catch (error) {
      console.error("Error fetching surveys:", error);
      res.status(500).json({ error: "Failed to fetch surveys" });
    }
  });
  
  // GET single survey
  app.get("/technical/api/surveys/:id", async (req, res) => {
    try {
      const survey = await storage.getSurvey(req.params.id);
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }
      res.json(survey);
    } catch (error) {
      console.error("Error fetching survey:", error);
      res.status(500).json({ error: "Failed to fetch survey" });
    }
  });
  
  // PATCH update survey dates/attachments using vesselId-masterId compound key
  // ID format: "vesselId-masterId"
  app.patch("/technical/api/surveys/:id", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(500).json({ error: "Database not available" });
      }
      const { db } = postgres;
      
      const compoundId = req.params.id;
      // Use :: as separator to avoid conflicts with dashes in vesselId (UUID format) and masterId
      const parts = compoundId.split('::');
      
      if (parts.length !== 2) {
        return res.status(400).json({ error: "Invalid ID format. Expected vesselId::masterId" });
      }
      
      const vesselId = parts[0];
      const masterId = parts[1];
      
      const { surveyDate, dueDate, firstRangeDate, secondRangeDate, postponed, attachments } = req.body;
      
      // Get vessel name from applicability record
      const applicabilityRecord = await db.select().from(vesselSurveyApplicability)
        .where(
          and(
            eq(vesselSurveyApplicability.vesselId, vesselId),
            eq(vesselSurveyApplicability.masterId, masterId)
          )
        )
        .limit(1);
      
      if (applicabilityRecord.length === 0) {
        return res.status(404).json({ error: "Survey applicability record not found" });
      }
      
      const vesselName = applicabilityRecord[0].vesselName;
      
      // Get current date for lastEditUpload
      const now = new Date();
      const lastEditUpload = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${now.getFullYear()}`;
      
      // Check if data record exists
      const existingData = await db.select().from(vesselSurveyData)
        .where(
          and(
            eq(vesselSurveyData.vesselId, vesselId),
            eq(vesselSurveyData.masterId, masterId)
          )
        )
        .limit(1);
      
      let result;
      
      if (existingData.length > 0) {
        // Update existing record
        const updateData: any = { updatedAt: new Date(), lastEditUpload };
        if (surveyDate !== undefined) updateData.surveyDate = surveyDate;
        if (dueDate !== undefined) updateData.dueDate = dueDate;
        if (firstRangeDate !== undefined) updateData.firstRangeDate = firstRangeDate;
        if (secondRangeDate !== undefined) updateData.secondRangeDate = secondRangeDate;
        if (postponed !== undefined) updateData.postponed = postponed;
        if (attachments !== undefined) updateData.attachments = attachments;
        
        result = await db.update(vesselSurveyData)
          .set(updateData)
          .where(
            and(
              eq(vesselSurveyData.vesselId, vesselId),
              eq(vesselSurveyData.masterId, masterId)
            )
          )
          .returning();
      } else {
        // Insert new record
        result = await db.insert(vesselSurveyData)
          .values({
            vesselId,
            vesselName,
            masterId,
            surveyDate: surveyDate || null,
            dueDate: dueDate || null,
            firstRangeDate: firstRangeDate || null,
            secondRangeDate: secondRangeDate || null,
            postponed: postponed || null,
            lastEditUpload,
            attachments: attachments || [],
          })
          .returning();
      }
      
      res.json(result[0]);
    } catch (error: any) {
      console.error("Error updating survey:", error);
      res.status(500).json({ error: "Failed to update survey" });
    }
  });
  
  // POST create new survey
  app.post("/technical/api/surveys", async (req, res) => {
    try {
      const newSurvey = await storage.createSurvey(req.body);
      res.status(201).json(newSurvey);
    } catch (error) {
      console.error("Error creating survey:", error);
      res.status(500).json({ error: "Failed to create survey" });
    }
  });
  
  // ============================================================
  // Ship Certificates Admin - Master Certificate API Routes
  // ============================================================
  
  // GET all ship certificates master entries
  app.get("/technical/api/admin/ship-certificates-master", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const certificates = await db.select().from(shipCertificatesMaster).orderBy(shipCertificatesMaster.sequence);
      
      res.json(certificates);
    } catch (error: any) {
      console.error("Error fetching ship certificates master:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });
  
  // POST save all ship certificates master entries (bulk upsert)
  app.post("/technical/api/admin/ship-certificates-master", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const certificates = req.body.certificates;
      const deletedMasterIds: string[] = req.body.deletedMasterIds || [];
      // Optional: vessel-specific certificate master IDs and their target vessels
      const vesselSpecificCerts: string[] = req.body.vesselSpecificCerts || [];
      const targetVessels: Array<{ id: string; name: string }> = req.body.targetVessels || [];
      
      if (!Array.isArray(certificates)) {
        return res.status(400).json({ error: "certificates must be an array" });
      }
      
      console.log(`💾 Saving ${certificates.length} ship certificates master entries...`);
      
      let deletedCount = 0;
      if (deletedMasterIds.length > 0) {
        for (const masterId of deletedMasterIds) {
          const existing = await db.select({ id: shipCertificatesMaster.id, isSystemDefined: shipCertificatesMaster.isSystemDefined })
            .from(shipCertificatesMaster)
            .where(eq(shipCertificatesMaster.masterId, masterId))
            .limit(1);
          if (existing.length > 0 && existing[0].isSystemDefined) {
            console.log(`⛔ Skipped deletion of system-defined certificate: ${masterId}`);
            continue;
          }
          await db.delete(shipCertificatesMaster)
            .where(eq(shipCertificatesMaster.masterId, masterId));
          deletedCount++;
          console.log(`🗑️ Deleted certificate: ${masterId}`);
        }
      }
      
      // Validate: if vessel-specific certs are provided, targetVessels must not be empty
      if (vesselSpecificCerts.length > 0 && targetVessels.length === 0) {
        return res.status(400).json({ 
          error: "targetVessels is required when adding vessel-specific certificates",
          message: "Please select at least one vessel before adding vessel-specific certificates"
        });
      }
      
      if (vesselSpecificCerts.length > 0) {
        console.log(`📋 Vessel-specific certificates: ${vesselSpecificCerts.join(', ')} for vessels: ${targetVessels.map(v => v.name).join(', ')}`);
      }
      
      // Use a transaction to upsert all certificates
      const { sql } = await import('drizzle-orm');
      
      let insertedCount = 0;
      let updatedCount = 0;
      const newlyInsertedMasterIds: string[] = []; // Track new certificates for applicability creation
      const vesselSpecificSet = new Set(vesselSpecificCerts); // For quick lookup
      
      // Fetch distinct vessels from existing applicability records
      // (vessels come from external Vessel Master API, not the internal vessels table)
      const distinctVessels = await db.selectDistinct({
        vesselId: vesselCertificateApplicability.vesselId,
        vesselName: vesselCertificateApplicability.vesselName,
      }).from(vesselCertificateApplicability);
      
      // Map to the format expected by the logic below
      const allVessels = distinctVessels.map(v => ({ id: v.vesselId, name: v.vesselName }));
      
      for (const cert of certificates) {
        // Check if certificate already exists by masterId
        const existing = await db.select().from(shipCertificatesMaster)
          .where(eq(shipCertificatesMaster.masterId, cert.masterId))
          .limit(1);
        
        if (existing.length > 0) {
          // Update existing
          await db.update(shipCertificatesMaster)
            .set({
              sequence: cert.sequence,
              certificateName: cert.certificateName,
              category: cert.category,
              group: cert.group,
              requirementRef: cert.requirementRef || null,
              applicableToCompany: cert.applicableToCompany || false,
              certificateLabel: cert.certificateLabel || null,
              isActive: cert.isActive !== false,
              // Company-specific fields
              companyId: cert.companyId || null,
              companyGroup: cert.companyGroup || null,
              companySequence: cert.companySequence || null,
              updatedAt: new Date(),
            })
            .where(eq(shipCertificatesMaster.masterId, cert.masterId));
          updatedCount++;
        } else {
          // Insert new
          await db.insert(shipCertificatesMaster).values({
            sequence: cert.sequence,
            masterId: cert.masterId,
            certificateName: cert.certificateName,
            category: cert.category,
            group: cert.group,
            requirementRef: cert.requirementRef || null,
            applicableToCompany: cert.applicableToCompany || false,
            certificateLabel: cert.certificateLabel || null,
            isActive: cert.isActive !== false,
            // Company-specific fields
            companyId: cert.companyId || null,
            companyGroup: cert.companyGroup || null,
            companySequence: cert.companySequence || null,
          });
          insertedCount++;
          newlyInsertedMasterIds.push(cert.masterId);
        }
      }
      
      // Auto-create vessel_certificate_applicability records
      // - For VES- certificates: only for target vessels
      // - For CMP- and other certificates: for all vessels
      if (newlyInsertedMasterIds.length > 0) {
        // Separate vessel-specific and company-wide new certificates
        const companyWideMasterIds = newlyInsertedMasterIds.filter(id => !vesselSpecificSet.has(id));
        const vesselOnlyMasterIds = newlyInsertedMasterIds.filter(id => vesselSpecificSet.has(id));
        
        // Get existing applicability records to avoid duplicates
        const existingApplicability = await db.select({
          vesselId: vesselCertificateApplicability.vesselId,
          masterId: vesselCertificateApplicability.masterId,
        }).from(vesselCertificateApplicability)
          .where(inArray(vesselCertificateApplicability.masterId, newlyInsertedMasterIds));
        
        // Create a Set of existing vessel-master combinations for O(1) lookup
        const existingKeys = new Set(
          existingApplicability.map(app => `${app.vesselId}-${app.masterId}`)
        );
        
        const applicabilityToInsert = [];
        
        // Create applicability for company-wide certificates (CMP-, category-based) - for ALL vessels
        if (companyWideMasterIds.length > 0 && allVessels.length > 0) {
          console.log(`🔗 Auto-creating applicability records for ${allVessels.length} vessels for ${companyWideMasterIds.length} company-wide certificate(s)`);
          
          for (const masterId of companyWideMasterIds) {
            for (const vessel of allVessels) {
              const key = `${vessel.id}-${masterId}`;
              if (!existingKeys.has(key)) {
                applicabilityToInsert.push({
                  vesselId: vessel.id,
                  vesselName: vessel.name,
                  masterId: masterId,
                  isApplicable: true,
                });
              }
            }
          }
        }
        
        // Create applicability for vessel-specific certificates (VES-) - only for target vessels
        // Use targetVessels directly (passed from frontend with both id and name)
        if (vesselOnlyMasterIds.length > 0 && targetVessels.length > 0) {
          console.log(`🚢 Auto-creating applicability records for ${targetVessels.length} target vessel(s) for ${vesselOnlyMasterIds.length} vessel-specific certificate(s)`);
          
          for (const masterId of vesselOnlyMasterIds) {
            for (const vessel of targetVessels) {
              const key = `${vessel.id}-${masterId}`;
              if (!existingKeys.has(key)) {
                applicabilityToInsert.push({
                  vesselId: vessel.id,
                  vesselName: vessel.name,
                  masterId: masterId,
                  isApplicable: true,
                });
              }
            }
          }
        }
        
        // Bulk insert all applicability records at once
        if (applicabilityToInsert.length > 0) {
          await db.insert(vesselCertificateApplicability).values(applicabilityToInsert);
          console.log(`✅ Created ${applicabilityToInsert.length} applicability records for new certificates`);
        }
      }
      
      console.log(`✅ Ship certificates master saved: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`);
      
      res.json({ 
        success: true, 
        message: `Saved ${certificates.length} certificates`,
        inserted: insertedCount,
        updated: updatedCount,
        deleted: deletedCount
      });
    } catch (error: any) {
      console.error("Error saving ship certificates master:", error);
      res.status(500).json({ error: "Failed to save certificates", details: error.message });
    }
  });
  
  // DELETE a ship certificate master entry by masterId
  app.delete("/technical/api/admin/ship-certificates-master/:masterId", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { masterId } = req.params;
      
      const existing = await db.select({ isSystemDefined: shipCertificatesMaster.isSystemDefined })
        .from(shipCertificatesMaster)
        .where(eq(shipCertificatesMaster.masterId, masterId))
        .limit(1);
      
      if (existing.length > 0 && existing[0].isSystemDefined) {
        return res.status(403).json({ error: "System-defined certificates cannot be deleted" });
      }
      
      await db.delete(shipCertificatesMaster)
        .where(eq(shipCertificatesMaster.masterId, masterId));
      
      console.log(`🗑️ Deleted ship certificate master: ${masterId}`);
      
      res.json({ success: true, message: `Deleted certificate ${masterId}` });
    } catch (error: any) {
      console.error("Error deleting ship certificate master:", error);
      res.status(500).json({ error: "Failed to delete certificate" });
    }
  });
  
  // ============================================================
  // Ship Certificates Admin - Labels Configuration API Routes
  // ============================================================
  
  // GET all labels configuration
  app.get("/technical/api/admin/ship-certificates-labels", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const labels = await db.select().from(shipCertificatesLabelsConfig);
      
      // Transform to object grouped by configType
      const result: Record<string, Array<{key: string, label: string}>> = {};
      for (const item of labels) {
        if (!result[item.configType]) {
          result[item.configType] = [];
        }
        result[item.configType].push({ key: item.key, label: item.label });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching ship certificates labels config:", error);
      res.status(500).json({ error: "Failed to fetch labels configuration" });
    }
  });
  
  // POST save labels configuration (bulk upsert)
  app.post("/technical/api/admin/ship-certificates-labels", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { configType, labels } = req.body;
      
      if (!configType || !Array.isArray(labels)) {
        return res.status(400).json({ error: "Invalid request body: requires configType and labels array" });
      }
      
      console.log(`💾 Saving ${labels.length} labels for config type: ${configType}...`);
      
      // Delete existing labels for this configType and re-insert
      await db.delete(shipCertificatesLabelsConfig)
        .where(eq(shipCertificatesLabelsConfig.configType, configType));
      
      // Insert new labels
      if (labels.length > 0) {
        const insertData = labels.map((item: {key: string, label: string}) => ({
          configType,
          key: item.key,
          label: item.label || "",
        }));
        
        await db.insert(shipCertificatesLabelsConfig).values(insertData);
      }
      
      console.log(`✅ Labels saved for ${configType}: ${labels.length} entries`);
      
      res.json({ success: true, message: `Saved ${labels.length} labels for ${configType}` });
    } catch (error: any) {
      console.error("Error saving ship certificates labels config:", error);
      res.status(500).json({ error: "Failed to save labels configuration", details: error.message });
    }
  });

  // ========== VESSEL CERTIFICATE APPLICABILITY ROUTES ==========
  
  // Get vessel certificate applicability for selected vessels
  app.get("/technical/api/admin/vessel-certificate-applicability", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const vesselIds = req.query.vesselIds;
      
      if (!vesselIds) {
        return res.status(400).json({ error: "vesselIds query parameter required" });
      }
      
      // Parse vessel IDs (comma-separated)
      const vesselIdList = typeof vesselIds === 'string' ? vesselIds.split(',').filter(Boolean) : [];
      
      if (vesselIdList.length === 0) {
        return res.json([]);
      }
      
      // Get applicability records for selected vessels
      const { inArray } = await import('drizzle-orm');
      const applicability = await db.select()
        .from(vesselCertificateApplicability)
        .where(inArray(vesselCertificateApplicability.vesselId, vesselIdList));
      
      res.json(applicability);
    } catch (error: any) {
      console.error("Error fetching vessel certificate applicability:", error);
      res.status(500).json({ error: "Failed to fetch vessel certificate applicability", details: error.message });
    }
  });

  // Initialize or update vessel certificate applicability for a vessel
  // When a vessel has no records, create records for all company certificates with isApplicable = true
  app.post("/technical/api/admin/vessel-certificate-applicability/initialize", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { vesselId, vesselName } = req.body;
      
      if (!vesselId || !vesselName) {
        return res.status(400).json({ error: "vesselId and vesselName are required" });
      }
      
      // Check if vessel already has records
      const existingRecords = await db.select()
        .from(vesselCertificateApplicability)
        .where(eq(vesselCertificateApplicability.vesselId, vesselId));
      
      if (existingRecords.length > 0) {
        return res.json({ success: true, message: "Vessel already initialized", records: existingRecords });
      }
      
      // Get all company certificates (applicableToCompany = true)
      const companyCertificates = await db.select()
        .from(shipCertificatesMaster)
        .where(eq(shipCertificatesMaster.applicableToCompany, true));
      
      if (companyCertificates.length === 0) {
        return res.json({ success: true, message: "No company certificates to initialize", records: [] });
      }
      
      // Create applicability records for all company certificates (all checked by default)
      const insertData = companyCertificates.map(cert => ({
        vesselId,
        vesselName,
        masterId: cert.masterId,
        isApplicable: true,
      }));
      
      const insertedRecords = await db.insert(vesselCertificateApplicability)
        .values(insertData)
        .returning();
      
      console.log(`✅ Initialized ${insertedRecords.length} certificate applicability records for vessel ${vesselName}`);
      
      res.json({ success: true, message: `Initialized ${insertedRecords.length} certificates for vessel`, records: insertedRecords });
    } catch (error: any) {
      console.error("Error initializing vessel certificate applicability:", error);
      res.status(500).json({ error: "Failed to initialize vessel certificate applicability", details: error.message });
    }
  });

  // Update applicability for a specific vessel-certificate combination
  app.patch("/technical/api/admin/vessel-certificate-applicability", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { vesselId, vesselName, masterId, isApplicable } = req.body;
      
      if (!vesselId || !masterId || isApplicable === undefined) {
        return res.status(400).json({ error: "vesselId, masterId, and isApplicable are required" });
      }
      
      const { and } = await import('drizzle-orm');
      
      // Check if record exists
      const existingRecord = await db.select()
        .from(vesselCertificateApplicability)
        .where(and(
          eq(vesselCertificateApplicability.vesselId, vesselId),
          eq(vesselCertificateApplicability.masterId, masterId)
        ));
      
      if (existingRecord.length === 0) {
        // Create new record
        const newRecord = await db.insert(vesselCertificateApplicability)
          .values({ vesselId, vesselName: vesselName || vesselId, masterId, isApplicable })
          .returning();
        
        return res.json({ success: true, record: newRecord[0] });
      }
      
      // Update existing record
      const updatedRecord = await db.update(vesselCertificateApplicability)
        .set({ isApplicable, updatedAt: new Date() })
        .where(and(
          eq(vesselCertificateApplicability.vesselId, vesselId),
          eq(vesselCertificateApplicability.masterId, masterId)
        ))
        .returning();
      
      res.json({ success: true, record: updatedRecord[0] });
    } catch (error: any) {
      console.error("Error updating vessel certificate applicability:", error);
      res.status(500).json({ error: "Failed to update vessel certificate applicability", details: error.message });
    }
  });

  // Bulk update applicability for multiple vessels (for multi-select)
  app.post("/technical/api/admin/vessel-certificate-applicability/bulk-update", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { vessels, masterId, isApplicable } = req.body;
      
      if (!Array.isArray(vessels) || vessels.length === 0 || !masterId || isApplicable === undefined) {
        return res.status(400).json({ error: "vessels array, masterId, and isApplicable are required" });
      }
      
      const { and, inArray } = await import('drizzle-orm');
      const vesselIds = vessels.map(v => v.id);
      
      // Update all matching records
      const updatedRecords = await db.update(vesselCertificateApplicability)
        .set({ isApplicable, updatedAt: new Date() })
        .where(and(
          inArray(vesselCertificateApplicability.vesselId, vesselIds),
          eq(vesselCertificateApplicability.masterId, masterId)
        ))
        .returning();
      
      // For vessels without existing records, create them
      const updatedVesselIds = new Set(updatedRecords.map(r => r.vesselId));
      const missingVessels = vessels.filter(v => !updatedVesselIds.has(v.id));
      
      if (missingVessels.length > 0) {
        const newRecords = await db.insert(vesselCertificateApplicability)
          .values(missingVessels.map(v => ({
            vesselId: v.id,
            vesselName: v.name,
            masterId,
            isApplicable,
          })))
          .returning();
        
        updatedRecords.push(...newRecords);
      }
      
      res.json({ success: true, records: updatedRecords });
    } catch (error: any) {
      console.error("Error bulk updating vessel certificate applicability:", error);
      res.status(500).json({ error: "Failed to bulk update vessel certificate applicability", details: error.message });
    }
  });

  // ============================================================
  // Ship Surveys Admin - Master Survey API Routes
  // ============================================================
  
  // GET all ship surveys master entries
  app.get("/technical/api/admin/ship-surveys-master", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const surveys = await db.select().from(shipSurveysMaster).orderBy(shipSurveysMaster.sequence);
      
      res.json(surveys);
    } catch (error: any) {
      console.error("Error fetching ship surveys master:", error);
      res.status(500).json({ error: "Failed to fetch surveys" });
    }
  });
  
  // POST save all ship surveys master entries (bulk upsert)
  app.post("/technical/api/admin/ship-surveys-master", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const surveys = req.body.surveys;
      // Optional: vessel-specific survey master IDs and their target vessels
      const vesselSpecificSurveys: string[] = req.body.vesselSpecificSurveys || [];
      const targetVessels: Array<{ id: string; name: string }> = req.body.targetVessels || [];
      
      if (!Array.isArray(surveys)) {
        return res.status(400).json({ error: "surveys must be an array" });
      }
      
      console.log(`💾 Saving ${surveys.length} ship surveys master entries...`);
      
      // Validate: if vessel-specific surveys are provided, targetVessels must not be empty
      if (vesselSpecificSurveys.length > 0 && targetVessels.length === 0) {
        return res.status(400).json({ 
          error: "targetVessels is required when adding vessel-specific surveys",
          message: "Please select at least one vessel before adding vessel-specific surveys"
        });
      }
      
      if (vesselSpecificSurveys.length > 0) {
        console.log(`📋 Vessel-specific surveys: ${vesselSpecificSurveys.join(', ')} for vessels: ${targetVessels.map(v => v.name).join(', ')}`);
      }
      
      let insertedCount = 0;
      let updatedCount = 0;
      const newlyInsertedMasterIds: string[] = []; // Track new surveys for applicability creation
      const vesselSpecificSet = new Set(vesselSpecificSurveys); // For quick lookup
      
      // Fetch distinct vessels from existing applicability records
      const distinctVessels = await db.selectDistinct({
        vesselId: vesselSurveyApplicability.vesselId,
        vesselName: vesselSurveyApplicability.vesselName,
      }).from(vesselSurveyApplicability);
      
      // Map to the format expected by the logic below
      const allVessels = distinctVessels.map(v => ({ id: v.vesselId, name: v.vesselName }));
      
      for (const survey of surveys) {
        // Check if survey already exists by masterId
        const existing = await db.select().from(shipSurveysMaster)
          .where(eq(shipSurveysMaster.masterId, survey.masterId))
          .limit(1);
        
        if (existing.length > 0) {
          // Update existing
          await db.update(shipSurveysMaster)
            .set({
              sequence: survey.sequence,
              surveyName: survey.surveyName,
              category: survey.category,
              group: survey.group,
              requirementRef: survey.requirementRef || null,
              applicableToCompany: survey.applicableToCompany || false,
              surveyLabel: survey.surveyLabel || null,
              isActive: survey.isActive !== false,
              companyId: survey.companyId || null,
              companyGroup: survey.companyGroup || null,
              companySequence: survey.companySequence || null,
              updatedAt: new Date(),
            })
            .where(eq(shipSurveysMaster.masterId, survey.masterId));
          updatedCount++;
        } else {
          // Insert new
          await db.insert(shipSurveysMaster).values({
            sequence: survey.sequence,
            masterId: survey.masterId,
            surveyName: survey.surveyName,
            category: survey.category,
            group: survey.group,
            requirementRef: survey.requirementRef || null,
            applicableToCompany: survey.applicableToCompany || false,
            surveyLabel: survey.surveyLabel || null,
            isActive: survey.isActive !== false,
            companyId: survey.companyId || null,
            companyGroup: survey.companyGroup || null,
            companySequence: survey.companySequence || null,
          });
          insertedCount++;
          newlyInsertedMasterIds.push(survey.masterId);
        }
      }
      
      // Auto-create applicability records for newly inserted surveys
      if (newlyInsertedMasterIds.length > 0 && allVessels.length > 0) {
        console.log(`📋 Auto-creating applicability records for ${allVessels.length} vessel(s) for ${newlyInsertedMasterIds.length} new survey(s)`);
        
        // Fetch existing applicability records to avoid duplicates
        const existingApplicability = await db.select({
          vesselId: vesselSurveyApplicability.vesselId,
          masterId: vesselSurveyApplicability.masterId,
        }).from(vesselSurveyApplicability);
        
        const existingKeys = new Set(existingApplicability.map(a => `${a.vesselId}-${a.masterId}`));
        
        const applicabilityToInsert: Array<{
          vesselId: string;
          vesselName: string;
          masterId: string;
          isApplicable: boolean;
        }> = [];
        
        // Separate vessel-only (VES-) and non-vessel-only master IDs
        const vesselOnlyMasterIds = newlyInsertedMasterIds.filter(id => vesselSpecificSet.has(id) || id.startsWith('VES-'));
        const nonVesselMasterIds = newlyInsertedMasterIds.filter(id => !vesselSpecificSet.has(id) && !id.startsWith('VES-'));
        
        // Create applicability for non-vessel-specific surveys - for ALL vessels
        for (const masterId of nonVesselMasterIds) {
          for (const vessel of allVessels) {
            const key = `${vessel.id}-${masterId}`;
            if (!existingKeys.has(key)) {
              applicabilityToInsert.push({
                vesselId: vessel.id,
                vesselName: vessel.name,
                masterId: masterId,
                isApplicable: true, // Default to applicable
              });
            }
          }
        }
        
        // Create applicability for vessel-specific surveys (VES-) - only for target vessels
        if (vesselOnlyMasterIds.length > 0 && targetVessels.length > 0) {
          console.log(`🚢 Auto-creating applicability records for ${targetVessels.length} target vessel(s) for ${vesselOnlyMasterIds.length} vessel-specific survey(s)`);
          
          for (const masterId of vesselOnlyMasterIds) {
            for (const vessel of targetVessels) {
              const key = `${vessel.id}-${masterId}`;
              if (!existingKeys.has(key)) {
                applicabilityToInsert.push({
                  vesselId: vessel.id,
                  vesselName: vessel.name,
                  masterId: masterId,
                  isApplicable: true, // Default to applicable
                });
              }
            }
          }
        }
        
        if (applicabilityToInsert.length > 0) {
          await db.insert(vesselSurveyApplicability).values(applicabilityToInsert);
          console.log(`✅ Created ${applicabilityToInsert.length} survey applicability records`);
        }
      }
      
      console.log(`✅ Ship surveys master saved: ${insertedCount} inserted, ${updatedCount} updated`);
      
      res.json({ 
        success: true, 
        message: `Saved ${surveys.length} surveys`,
        inserted: insertedCount,
        updated: updatedCount
      });
    } catch (error: any) {
      console.error("Error saving ship surveys master:", error);
      res.status(500).json({ error: "Failed to save surveys", details: error.message });
    }
  });
  
  // DELETE a ship survey master entry by masterId
  app.delete("/technical/api/admin/ship-surveys-master/:masterId", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { masterId } = req.params;
      
      await db.delete(shipSurveysMaster)
        .where(eq(shipSurveysMaster.masterId, masterId));
      
      console.log(`🗑️ Deleted ship survey master: ${masterId}`);
      
      res.json({ success: true, message: `Deleted survey ${masterId}` });
    } catch (error: any) {
      console.error("Error deleting ship survey master:", error);
      res.status(500).json({ error: "Failed to delete survey" });
    }
  });
  
  // ============================================================
  // Ship Surveys Admin - Labels Configuration API Routes
  // ============================================================
  
  // GET all survey labels configuration
  app.get("/technical/api/admin/ship-surveys-labels", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const labels = await db.select().from(shipSurveysLabelsConfig);
      
      // Transform to object grouped by configType
      const result: Record<string, Array<{key: string, label: string}>> = {};
      for (const item of labels) {
        if (!result[item.configType]) {
          result[item.configType] = [];
        }
        result[item.configType].push({ key: item.key, label: item.label });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching ship surveys labels config:", error);
      res.status(500).json({ error: "Failed to fetch labels configuration" });
    }
  });
  
  // POST save survey labels configuration (bulk upsert)
  app.post("/technical/api/admin/ship-surveys-labels", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { configType, labels } = req.body;
      
      if (!configType || !Array.isArray(labels)) {
        return res.status(400).json({ error: "Invalid request body: requires configType and labels array" });
      }
      
      console.log(`💾 Saving ${labels.length} survey labels for config type: ${configType}...`);
      
      // Delete existing labels for this configType and re-insert
      await db.delete(shipSurveysLabelsConfig)
        .where(eq(shipSurveysLabelsConfig.configType, configType));
      
      // Insert new labels
      if (labels.length > 0) {
        const insertData = labels.map((item: {key: string, label: string}) => ({
          configType,
          key: item.key,
          label: item.label || "",
        }));
        
        await db.insert(shipSurveysLabelsConfig).values(insertData);
      }
      
      console.log(`✅ Survey labels saved for ${configType}: ${labels.length} entries`);
      
      res.json({ success: true, message: `Saved ${labels.length} labels for ${configType}` });
    } catch (error: any) {
      console.error("Error saving ship surveys labels config:", error);
      res.status(500).json({ error: "Failed to save labels configuration", details: error.message });
    }
  });

  // ============================================================
  // Ship Surveys Admin - Vessel Survey Applicability API Routes
  // ============================================================
  
  // GET vessel survey applicability for selected vessels
  app.get("/technical/api/admin/vessel-survey-applicability", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const vesselIds = req.query.vesselIds;
      
      if (!vesselIds) {
        return res.status(400).json({ error: "vesselIds query parameter required" });
      }
      
      // Parse vessel IDs (comma-separated)
      const vesselIdList = typeof vesselIds === 'string' ? vesselIds.split(',').filter(Boolean) : [];
      
      if (vesselIdList.length === 0) {
        return res.json([]);
      }
      
      // Get applicability records for selected vessels
      const applicability = await db.select()
        .from(vesselSurveyApplicability)
        .where(inArray(vesselSurveyApplicability.vesselId, vesselIdList));
      
      res.json(applicability);
    } catch (error: any) {
      console.error("Error fetching vessel survey applicability:", error);
      res.status(500).json({ error: "Failed to fetch vessel survey applicability", details: error.message });
    }
  });

  // Initialize vessel survey applicability for a vessel
  app.post("/technical/api/admin/vessel-survey-applicability/initialize", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { vesselId, vesselName } = req.body;
      
      if (!vesselId || !vesselName) {
        return res.status(400).json({ error: "vesselId and vesselName are required" });
      }
      
      // Check if vessel already has records
      const existingRecords = await db.select()
        .from(vesselSurveyApplicability)
        .where(eq(vesselSurveyApplicability.vesselId, vesselId));
      
      if (existingRecords.length > 0) {
        return res.json({ success: true, message: "Vessel already initialized", records: existingRecords });
      }
      
      // Get all company surveys (applicableToCompany = true)
      const companySurveys = await db.select()
        .from(shipSurveysMaster)
        .where(eq(shipSurveysMaster.applicableToCompany, true));
      
      if (companySurveys.length === 0) {
        return res.json({ success: true, message: "No company surveys to initialize", records: [] });
      }
      
      // Create applicability records for all company surveys (all checked by default)
      const insertData = companySurveys.map(survey => ({
        vesselId,
        vesselName,
        masterId: survey.masterId,
        isApplicable: true,
      }));
      
      const insertedRecords = await db.insert(vesselSurveyApplicability)
        .values(insertData)
        .returning();
      
      console.log(`✅ Initialized ${insertedRecords.length} survey applicability records for vessel ${vesselName}`);
      
      res.json({ success: true, message: `Initialized ${insertedRecords.length} surveys for vessel`, records: insertedRecords });
    } catch (error: any) {
      console.error("Error initializing vessel survey applicability:", error);
      res.status(500).json({ error: "Failed to initialize vessel survey applicability", details: error.message });
    }
  });

  // Bulk update vessel survey applicability
  app.post("/technical/api/admin/vessel-survey-applicability/bulk-update", async (req, res) => {
    try {
      const postgres = await getPostgresClient();
      if (!postgres) {
        return res.status(503).json({ error: "Database not available" });
      }
      
      const { db } = postgres;
      const { vessels, masterId, isApplicable } = req.body;
      
      if (!Array.isArray(vessels) || !masterId || typeof isApplicable !== 'boolean') {
        return res.status(400).json({ error: "vessels array, masterId, and isApplicable are required" });
      }
      
      const vesselIds = vessels.map((v: any) => v.id);
      
      // Update all matching records
      const updatedRecords = await db.update(vesselSurveyApplicability)
        .set({ isApplicable, updatedAt: new Date() })
        .where(and(
          inArray(vesselSurveyApplicability.vesselId, vesselIds),
          eq(vesselSurveyApplicability.masterId, masterId)
        ))
        .returning();
      
      // For vessels without existing records, create them
      const updatedVesselIds = new Set(updatedRecords.map((r: any) => r.vesselId));
      const missingVessels = vessels.filter((v: any) => !updatedVesselIds.has(v.id));
      
      if (missingVessels.length > 0) {
        const newRecords = await db.insert(vesselSurveyApplicability)
          .values(missingVessels.map((v: any) => ({
            vesselId: v.id,
            vesselName: v.name,
            masterId,
            isApplicable,
          })))
          .returning();
        
        updatedRecords.push(...newRecords);
      }
      
      res.json({ success: true, records: updatedRecords });
    } catch (error: any) {
      console.error("Error bulk updating vessel survey applicability:", error);
      res.status(500).json({ error: "Failed to bulk update vessel survey applicability", details: error.message });
    }
  });
  
  // =====================================================
  // REPORTS ENDPOINTS - Excel/PDF Export
  // =====================================================
  
  // Due Jobs (7 Days) - Excel Export
  // Returns an Excel file with all work orders due within the next 7 days (including overdue)
  app.post("/technical/api/reports/due-jobs-7-days", async (req, res) => {
    try {
      const { vesselId } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Fetch all required data
      const workOrders = await storage.getWorkOrders(vesselId);
      const jobs = await storage.getJobs(vesselId);
      const components = await storage.getComponents(vesselId);
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;
      
      // Create lookup maps
      const jobsMap = new Map(jobs.map(job => [job.id, job]));
      const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
      const componentsMap = new Map(components.map(comp => [comp.id, comp]));
      
      // Get today and 7 days from now
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // RH threshold: 168 hours (7 days equivalent)
      const RH_THRESHOLD_HOURS = 168;
      
      // DEBUG: Log report generation parameters
      console.log('📊 [DUE JOBS REPORT] ═══════════════════════════════════════════');
      console.log(`📊 [DUE JOBS REPORT] Vessel: ${vesselName} (${vesselId})`);
      console.log(`📊 [DUE JOBS REPORT] Today: ${now.toISOString().split('T')[0]}`);
      console.log(`📊 [DUE JOBS REPORT] 7 Days From Now: ${sevenDaysFromNow.toISOString().split('T')[0]}`);
      console.log(`📊 [DUE JOBS REPORT] Total Work Orders Fetched: ${workOrders.length}`);
      console.log(`📊 [DUE JOBS REPORT] Total Jobs Fetched: ${jobs.length}`);
      console.log(`📊 [DUE JOBS REPORT] Total Components Fetched: ${components.length}`);
      
      // Helper to parse dates - supports multiple formats
      // CRITICAL: Must handle ISO format (YYYY-MM-DD) before DD-MM-YYYY to avoid misinterpretation
      const MONTH_NAMES: { [key: string]: number } = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const parseDate = (dateInput: string | Date | null | undefined): Date | null => {
        if (!dateInput) return null;
        
        // Handle Date objects directly
        if (dateInput instanceof Date) {
          return isNaN(dateInput.getTime()) ? null : dateInput;
        }
        
        const dateStr = String(dateInput);
        
        // Check for ISO format FIRST: YYYY-MM-DD (e.g., "2026-01-10")
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          const year = parseInt(isoMatch[1], 10);
          const month = parseInt(isoMatch[2], 10) - 1;
          const day = parseInt(isoMatch[3], 10);
          return new Date(year, month, day);
        }
        
        // Try DD-MMM-YYYY format (e.g., "15-Feb-2026")
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = MONTH_NAMES[parts[1]];
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && month !== undefined && !isNaN(year) && year > 1900) {
            return new Date(year, month, day);
          }
        }
        
        // Fallback: try native Date parsing
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
      };
      
      // Helper to parse RH values
      const parseRH = (value: string | number | null | undefined): number | null => {
        if (value == null || value === '') return null;
        const num = Number(value);
        return isNaN(num) ? null : num;
      };
      
      // Filter work orders that are due within 7 days OR are overdue
      const dueJobs: any[] = [];
      let debugStats = {
        total: workOrders.length,
        skippedCompleted: 0,
        skippedPostponed: 0,
        calendarBased: 0,
        rhBased: 0,
        calendarOverdue: 0,
        rhOverdue: 0,
        calendarDueSoon: 0,
        rhDueSoon: 0,
        noDueDate: 0,
        noRhData: 0,
        futureDue: 0
      };
      
      for (const wo of workOrders) {
        // Skip completed jobs
        if (wo.status === 'Completed') {
          debugStats.skippedCompleted++;
          continue;
        }
        // Skip postponed jobs
        if (wo.status === 'Postponed') {
          debugStats.skippedPostponed++;
          continue;
        }
        
        const job = wo.jobId ? jobsMap.get(wo.jobId) : jobs.find(j => j.jobNo === wo.templateCode);
        const component = wo.componentCode 
          ? componentsByCodeMap.get(wo.componentCode) 
          : (wo.component ? componentsMap.get(wo.component) : null);
        
        const maintenanceBasis = wo.maintenanceBasis || job?.maintenanceBasis || 'Calendar';
        let isDue = false;
        let daysRemaining: number | null = null;
        let hoursRemaining: number | null = null;
        let urgencyScore: number = 999;
        let isOverdue = false;
        let statusIndicator = 'ACTIVE';
        
        // Check Calendar-based due (include overdue AND due within 7 days)
        // Use dueDateSnapshot per document requirements (with fallback to dueDate)
        if (maintenanceBasis === 'Calendar' || maintenanceBasis === 'Calendar+RH') {
          debugStats.calendarBased++;
          const dueDate = parseDate(wo.dueDateSnapshot || wo.dueDate);
          if (dueDate) {
            dueDate.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            // CRITICAL: Include OVERDUE jobs (daysRemaining < 0)
            if (daysRemaining < 0) {
              isDue = true;
              isOverdue = true;
              statusIndicator = 'OVERDUE';
              urgencyScore = daysRemaining; // Most negative = most urgent
              debugStats.calendarOverdue++;
            }
            // Include jobs due within 7 days
            else if (daysRemaining <= 7) {
              isDue = true;
              if (daysRemaining <= 2) {
                statusIndicator = 'URGENT';
              } else {
                statusIndicator = 'DUE';
              }
              urgencyScore = daysRemaining;
              debugStats.calendarDueSoon++;
            } else {
              debugStats.futureDue++;
            }
          } else {
            debugStats.noDueDate++;
          }
        }
        
        // Check Running Hours-based due (include overdue AND due within 168 hours)
        if (maintenanceBasis === 'Running Hours' || maintenanceBasis === 'Calendar+RH') {
          if (maintenanceBasis === 'Running Hours') debugStats.rhBased++;
          const dueRH = parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading);
          const currentRH = parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading);
          
          if (dueRH != null && currentRH != null) {
            hoursRemaining = dueRH - currentRH;
            
            // CRITICAL: Include OVERDUE jobs (hoursRemaining < 0 means currentRH exceeded nextDueRH)
            if (hoursRemaining < 0) {
              isDue = true;
              isOverdue = true;
              statusIndicator = 'OVERDUE';
              const rhUrgency = hoursRemaining / 24;
              urgencyScore = Math.min(urgencyScore, rhUrgency);
              debugStats.rhOverdue++;
            }
            // Include jobs due within 168 hours
            else if (hoursRemaining <= RH_THRESHOLD_HOURS) {
              isDue = true;
              if (hoursRemaining <= 48) {
                if (statusIndicator !== 'OVERDUE') statusIndicator = 'URGENT';
              } else {
                if (statusIndicator !== 'OVERDUE' && statusIndicator !== 'URGENT') statusIndicator = 'DUE';
              }
              const rhUrgency = hoursRemaining / 24;
              urgencyScore = Math.min(urgencyScore, rhUrgency);
              debugStats.rhDueSoon++;
            }
          } else {
            if (maintenanceBasis === 'Running Hours') debugStats.noRhData++;
          }
        }
        
        if (isDue) {
          dueJobs.push({
            workOrderNo: wo.workOrderNo || wo.id,
            jobTitle: wo.jobTitle || job?.jobTitle || '-',
            componentCode: wo.componentCode || '-',
            componentName: component?.name || wo.component || '-',
            dueDate: wo.dueDateSnapshot || wo.dueDate || '-',
            lastDoneDate: wo.lastDoneDateSnapshot || '-',
            daysRemaining: daysRemaining ?? '-',
            nextDueReading: job?.nextDueRH || wo.nextDueReading || '-',
            currentReading: component?.currentCumulativeRH || wo.currentReading || '-',
            hoursRemaining: hoursRemaining != null ? Math.round(hoursRemaining) : '-',
            maintenanceBasis: maintenanceBasis,
            frequency: job ? `${job.frequencyValue || ''} ${job.frequencyUnit || ''}`.trim() : '-',
            assignedTo: wo.assignedTo || job?.assignedTo || '-',
            priority: wo.jobPriority || job?.jobPriority || 'Medium',
            department: wo.department || job?.department || '-',
            critical: component?.critical ? 'Yes' : 'No',
            criticality: wo.criticality || job?.criticality || '-',
            woStatus: wo.status || '-',
            isOverdue,
            statusIndicator,
            urgencyScore
          });
        }
      }
      
      // DEBUG: Log filtering stats
      console.log(`📊 [DUE JOBS REPORT] ─────────────────────────────────────────────`);
      console.log(`📊 [DUE JOBS REPORT] FILTERING STATS:`);
      console.log(`📊 [DUE JOBS REPORT]   Skipped Completed: ${debugStats.skippedCompleted}`);
      console.log(`📊 [DUE JOBS REPORT]   Skipped Postponed: ${debugStats.skippedPostponed}`);
      console.log(`📊 [DUE JOBS REPORT]   Calendar-Based Jobs: ${debugStats.calendarBased}`);
      console.log(`📊 [DUE JOBS REPORT]   RH-Based Jobs: ${debugStats.rhBased}`);
      console.log(`📊 [DUE JOBS REPORT]   Calendar Overdue: ${debugStats.calendarOverdue}`);
      console.log(`📊 [DUE JOBS REPORT]   Calendar Due Soon (≤7d): ${debugStats.calendarDueSoon}`);
      console.log(`📊 [DUE JOBS REPORT]   RH Overdue: ${debugStats.rhOverdue}`);
      console.log(`📊 [DUE JOBS REPORT]   RH Due Soon (≤168h): ${debugStats.rhDueSoon}`);
      console.log(`📊 [DUE JOBS REPORT]   No Due Date: ${debugStats.noDueDate}`);
      console.log(`📊 [DUE JOBS REPORT]   No RH Data: ${debugStats.noRhData}`);
      console.log(`📊 [DUE JOBS REPORT]   Future Due (>7d): ${debugStats.futureDue}`);
      console.log(`📊 [DUE JOBS REPORT]   TOTAL JOBS INCLUDED: ${dueJobs.length}`);
      console.log(`📊 [DUE JOBS REPORT] ═══════════════════════════════════════════`);
      
      // Sort by urgencyScore ASC (most urgent/negative first), then by priority DESC
      const priorityOrder: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      dueJobs.sort((a, b) => {
        if (a.urgencyScore !== b.urgencyScore) {
          return a.urgencyScore - b.urgencyScore;
        }
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      });
      
      // Calculate summary counts
      const overdueCnt = dueJobs.filter(j => j.isOverdue).length;
      const criticalPriorityCnt = dueJobs.filter(j => j.priority === 'Critical').length;
      const criticalEquipmentCnt = dueJobs.filter(j => j.critical === 'Yes').length;
      const urgentCnt = dueJobs.filter(j => j.statusIndicator === 'URGENT').length;
      
      // ═══════════════════════════════════════════════════════════════
      // CREATE PROFESSIONAL EXCEL REPORT - STANDARDIZED 18-COLUMN FORMAT
      // Uses standard column definition and status-based row highlighting
      // ═══════════════════════════════════════════════════════════════
      
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Due Jobs (7 Days)', {
        views: [{ state: 'frozen', ySplit: 7, xSplit: 3 }]
      });
      
      // Use STANDARD 18-column definition for all Maintenance Work Order reports
      const columns = STANDARD_WORK_ORDER_COLUMNS;
      
      const totalColumns = columns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);
      const headerRowNum = 7;
      const dataStartRow = 8;
      
      // Apply standardized header (Rows 1-6)
      applyStandardHeader(
        worksheet,
        'DUE JOBS REPORT (NEXT 7 DAYS)',
        'Upcoming planned maintenance',
        vesselName,
        dueJobs.length,
        lastColLetter
      );
      
      // Apply standardized table header (Row 7)
      applyStandardTableHeader(worksheet, columns, headerRowNum);
      
      // Prepare data in STANDARD 18-column format with status-based highlighting
      // Days Left vs Days Overdue are mutually exclusive (show "-" for the other)
      // Running Hours columns show "-" for Calendar-based jobs
      const preparedData: WorkOrderRowData[] = dueJobs.map((job, index) => {
        const isCritical = job.critical === 'Yes';
        const isCalendarBased = job.maintenanceBasis === 'Calendar';
        const woStatus = job.woStatus || 'Active';
        
        // Determine row status for color highlighting
        // "Due (Grace P)" should use same orange color as "Due" status
        const isGracePeriod = woStatus === 'Due (Grace P)' || woStatus.includes('Grace');
        const isDueStatus = woStatus === 'Due' || isGracePeriod;
        const isOverdue = job.isOverdue === true && !isDueStatus;
        const rowStatus: WorkOrderStatus = isOverdue ? 'overdue' : 'due';
        
        // Calculate daysOverdue safely - only when we have a valid number
        const daysRemainingValue = job.daysRemaining;
        const hasDaysRemaining = typeof daysRemainingValue === 'number' && !isNaN(daysRemainingValue);
        const daysOverdueValue = isOverdue && hasDaysRemaining ? Math.abs(daysRemainingValue) : '-';
        
        return {
          sno: index + 1,
          workOrderNo: job.workOrderNo,
          jobCode: job.templateCode || '-',
          jobTitle: job.jobTitle,
          componentCode: job.componentCode,
          componentName: job.componentName,
          department: job.department,
          priority: job.priority,
          status: woStatus,
          dueDate: job.dueDate,
          lastDoneDate: job.lastDoneDate,
          daysLeft: isOverdue ? '-' : (hasDaysRemaining ? daysRemainingValue : '-'),
          daysOverdue: daysOverdueValue,
          nextDueRH: isCalendarBased ? '-' : (job.nextDueReading ?? '-'),
          currentRH: isCalendarBased ? '-' : (job.currentReading ?? '-'),
          rhRemaining: isCalendarBased ? '-' : (job.hoursRemaining ?? '-'),
          assignedTo: job.assignedTo,
          criticalEquipment: isCritical ? 'YES' : 'No',
          _rowStatus: rowStatus,
          isCriticalEquipment: isCritical
        };
      });
      
      // Apply status-based row highlighting (Light/Dark Orange for due, Light/Dark Red for overdue)
      applyWorkOrderDataRows(worksheet, preparedData, columns, dataStartRow);
      
      // Calculate summary row position
      const lastDataRowNum = dataStartRow + Math.max(dueJobs.length - 1, 0);
      const summaryStartRow = lastDataRowNum + 3;
      
      // Apply standardized summary section
      const summary: SummaryItem[] = [
        { label: 'Total Jobs Due:', value: dueJobs.length },
        { label: 'Overdue Jobs:', value: overdueCnt, highlight: true },
        { label: 'Critical Priority Jobs:', value: criticalPriorityCnt },
        { label: 'Critical Equipment Jobs:', value: criticalEquipmentCnt },
        { label: 'Urgent Jobs (≤2 days/48 RH):', value: urgentCnt }
      ];
      
      const lastSummaryRow = applyStandardSummary(
        worksheet,
        summary,
        summaryStartRow,
        totalColumns,
        overdueCnt > 0 ? 'Overdue jobs require immediate attention - prioritize completion or obtain postponement approval' : undefined
      );
      
      // Auto-filter on header row
      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };
      
      // Apply standardized page setup
      applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastSummaryRow, vesselName);
      
      // Generate buffer and filename
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('DueJobs7Days', vesselName);
      
      console.log(`📊 [DUE JOBS REPORT] Generated: ${filename} (${dueJobs.length} jobs)`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Due Jobs report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT #2: OVERDUE JOBS - Excel Export
  // Returns an Excel file with all work orders that are PAST their due date AND grace period
  // This is the HIGHEST PRIORITY audit-critical report
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/overdue-jobs", async (req, res) => {
    try {
      const { vesselId } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Fetch all required data
      const workOrders = await storage.getWorkOrders(vesselId);
      const jobs = await storage.getJobs(vesselId);
      const components = await storage.getComponents(vesselId);
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;
      
      // Create lookup maps
      const jobsMap = new Map(jobs.map(job => [job.id, job]));
      const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
      const componentsMap = new Map(components.map(comp => [comp.id, comp]));
      
      // Get today's date
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      // DEBUG: Log report generation parameters
      console.log('[OVERDUE JOBS REPORT] =============================================');
      console.log(`[OVERDUE JOBS REPORT] Vessel: ${vesselName} (${vesselId})`);
      console.log(`[OVERDUE JOBS REPORT] Today: ${now.toISOString().split('T')[0]}`);
      console.log(`[OVERDUE JOBS REPORT] Total Work Orders Fetched: ${workOrders.length}`);
      console.log(`[OVERDUE JOBS REPORT] Using computeWorkOrderStatus() for consistent filtering`);
      
      // Helper to parse dates for calculating days past due
      // CRITICAL: Must handle multiple date formats:
      // 1. Date objects from database
      // 2. ISO format: "2026-01-10" (YYYY-MM-DD)
      // 3. DD-MMM-YYYY format: "10-Jan-2026"
      const MONTH_NAMES: { [key: string]: number } = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const parseDate = (dateInput: string | Date | null | undefined): Date | null => {
        if (!dateInput) return null;
        
        // Handle Date objects directly
        if (dateInput instanceof Date) {
          return isNaN(dateInput.getTime()) ? null : dateInput;
        }
        
        const dateStr = String(dateInput);
        
        // Check for ISO format FIRST: YYYY-MM-DD (e.g., "2026-01-10")
        // ISO format has 4-digit year at the start
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          const year = parseInt(isoMatch[1], 10);
          const month = parseInt(isoMatch[2], 10) - 1; // months are 0-indexed
          const day = parseInt(isoMatch[3], 10);
          return new Date(year, month, day);
        }
        
        // Try DD-MMM-YYYY format (e.g., "10-Jan-2026")
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = MONTH_NAMES[parts[1]];
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && month !== undefined && !isNaN(year) && year > 1900) {
            return new Date(year, month, day);
          }
        }
        
        // Fallback: try native Date parsing
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
      };
      
      // Helper to parse RH values
      const parseRH = (value: string | number | null | undefined): number | null => {
        if (value == null || value === '') return null;
        const num = Number(value);
        return isNaN(num) ? null : num;
      };
      
      // Filter work orders using the SAME computeWorkOrderStatus() function as the UI
      // This ensures the report count matches the Work Orders page badge count exactly
      const overdueJobs: any[] = [];
      let debugStats = {
        total: workOrders.length,
        skippedCompleted: 0,
        skippedPostponed: 0,
        skippedExecution: 0,
        calendarOverdue: 0,
        rhOverdue: 0,
        criticalEquipment: 0
      };
      
      for (const wo of workOrders) {
        // Skip execution records (same as UI filter: !wo.isExecution)
        if (wo.isExecution) {
          debugStats.skippedExecution++;
          continue;
        }
        
        // Skip completed jobs
        if (wo.status === 'Completed') {
          debugStats.skippedCompleted++;
          continue;
        }
        // Skip postponed jobs
        if (wo.status === 'Postponed') {
          debugStats.skippedPostponed++;
          continue;
        }
        
        const job = wo.jobId ? jobsMap.get(wo.jobId) : jobs.find(j => j.jobNo === wo.templateCode);
        const component = wo.componentCode 
          ? componentsByCodeMap.get(wo.componentCode) 
          : (wo.component ? componentsMap.get(wo.component) : null);
        
        const maintenanceBasis = wo.maintenanceBasis || job?.maintenanceBasis || 'Calendar';
        const dueDate = wo.dueDateSnapshot || wo.dueDate || null;
        const dueRH = parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading);
        const currentRH = parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading);
        
        // Use the SAME computeWorkOrderStatus function as the UI to determine overdue status
        // This ensures perfect alignment between report count and UI badge count
        const computedStatus = computeWorkOrderStatus({
          dueDate: dueDate,
          dueRH: dueRH,
          currentRH: currentRH,
          isExecution: wo.isExecution,
          status: wo.status,
          completionDateTime: wo.completionDateTime,
          maintenanceBasis: maintenanceBasis
        });
        
        // Only include work orders with 'Overdue' computed status
        if (computedStatus === 'Overdue') {
          const isCriticalEquipment = component?.critical === true || component?.critical === 'true';
          
          // Calculate days past due for display
          let daysPastDue = 0;
          let hoursPastDue = 0;
          let overdueType = '';
          
          if (maintenanceBasis === 'Calendar' || maintenanceBasis === 'Calendar+RH') {
            const dueDateParsed = parseDate(dueDate);
            if (dueDateParsed) {
              dueDateParsed.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((now.getTime() - dueDateParsed.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays > 0) {
                daysPastDue = diffDays;
                overdueType = 'Calendar';
                debugStats.calendarOverdue++;
              }
            }
          }
          
          if (maintenanceBasis === 'Running Hours' || maintenanceBasis === 'Calendar+RH') {
            if (dueRH != null && currentRH != null && currentRH > dueRH) {
              hoursPastDue = Math.round(currentRH - dueRH);
              if (overdueType === '') {
                overdueType = 'RH';
              } else {
                overdueType = 'Both';
              }
              debugStats.rhOverdue++;
            }
          }
          
          if (isCriticalEquipment) {
            debugStats.criticalEquipment++;
          }
          
          overdueJobs.push({
            workOrderNo: wo.workOrderNo || wo.id,
            jobTitle: wo.jobTitle || job?.jobTitle || '-',
            componentCode: wo.componentCode || '-',
            componentName: component?.name || wo.component || '-',
            department: wo.department || job?.department || '-',
            dueDate: dueDate || '-',
            daysPastDue: daysPastDue,
            nextDueReading: job?.nextDueRH || wo.nextDueReading || '-',
            currentReading: component?.currentCumulativeRH || wo.currentReading || '-',
            hoursPastDue: hoursPastDue,
            overdueType: overdueType,
            assignedTo: wo.assignedTo || job?.assignedTo || '-',
            lastDoneDate: wo.lastDoneDateSnapshot || '-',
            critical: isCriticalEquipment ? 'YES' : 'No'
          });
        }
      }
      
      // DEBUG: Log filtering stats
      console.log(`[OVERDUE JOBS REPORT] ---------------------------------------------`);
      console.log(`[OVERDUE JOBS REPORT] FILTERING STATS:`);
      console.log(`[OVERDUE JOBS REPORT]   Skipped Completed: ${debugStats.skippedCompleted}`);
      console.log(`[OVERDUE JOBS REPORT]   Skipped Postponed: ${debugStats.skippedPostponed}`);
      console.log(`[OVERDUE JOBS REPORT]   Skipped Execution Records: ${debugStats.skippedExecution}`);
      console.log(`[OVERDUE JOBS REPORT]   Calendar Overdue: ${debugStats.calendarOverdue}`);
      console.log(`[OVERDUE JOBS REPORT]   RH Overdue: ${debugStats.rhOverdue}`);
      console.log(`[OVERDUE JOBS REPORT]   Critical Equipment Overdue: ${debugStats.criticalEquipment}`);
      console.log(`[OVERDUE JOBS REPORT]   TOTAL OVERDUE JOBS: ${overdueJobs.length}`);
      console.log(`[OVERDUE JOBS REPORT] =============================================`);
      
      // Sort: Critical Equipment first, then Days Overdue DESC, then Component Name ASC
      overdueJobs.sort((a, b) => {
        // Critical equipment first
        if (a.critical !== b.critical) {
          return a.critical === 'YES' ? -1 : 1;
        }
        // Then by days overdue (most overdue first)
        if (a.daysPastDue !== b.daysPastDue) {
          return b.daysPastDue - a.daysPastDue;
        }
        // Then alphabetically by component name
        return (a.componentName || '').localeCompare(b.componentName || '');
      });
      
      // Calculate summary stats
      const avgDaysPastDue = overdueJobs.length > 0 
        ? (overdueJobs.reduce((sum, j) => sum + j.daysPastDue, 0) / overdueJobs.length).toFixed(1)
        : '0';
      const maxDaysPastDue = overdueJobs.length > 0 
        ? Math.max(...overdueJobs.map(j => j.daysPastDue))
        : 0;
      
      // ═══════════════════════════════════════════════════════════════
      // CREATE PROFESSIONAL EXCEL REPORT - STANDARDIZED 18-COLUMN FORMAT
      // Uses standard column definition and status-based row highlighting
      // Light Red for overdue, Dark Red for critical equipment overdue
      // ═══════════════════════════════════════════════════════════════
      
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Overdue Jobs', {
        views: [{ state: 'frozen', ySplit: 7, xSplit: 2 }]
      });
      
      // Use STANDARD 18-column definition for all Maintenance Work Order reports
      const columns = STANDARD_WORK_ORDER_COLUMNS;
      
      const totalColumns = columns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);
      const headerRowNum = 7;
      const dataStartRow = 8;
      
      // Apply standardized header (Rows 1-6) - same blue theme as all reports
      applyStandardHeader(
        worksheet,
        'OVERDUE JOBS REPORT',
        'Work orders past grace period - requires immediate action',
        vesselName,
        overdueJobs.length,
        lastColLetter
      );
      
      // Apply standardized table header (Row 7) - Light blue header
      applyStandardTableHeader(worksheet, columns, headerRowNum);
      
      // Prepare data in STANDARD 18-column format with status-based highlighting
      // Days Left shows "-" for overdue, Days Overdue shows actual value
      // Running Hours columns show "-" for Calendar-based jobs
      const preparedData: WorkOrderRowData[] = overdueJobs.map((job, index) => {
        const isCritical = job.critical === 'YES';
        const isCalendarBased = job.overdueType === 'Calendar';
        
        return {
          sno: index + 1,
          workOrderNo: job.workOrderNo,
          jobCode: '-',
          jobTitle: job.jobTitle,
          componentCode: job.componentCode,
          componentName: job.componentName,
          department: job.department,
          priority: '-',
          status: 'Overdue',
          dueDate: job.dueDate,
          lastDoneDate: job.lastDoneDate,
          daysLeft: '-',
          daysOverdue: job.daysPastDue || '-',
          nextDueRH: isCalendarBased ? '-' : (job.nextDueReading ?? '-'),
          currentRH: isCalendarBased ? '-' : (job.currentReading ?? '-'),
          rhRemaining: isCalendarBased ? '-' : (job.hoursPastDue ? `-${job.hoursPastDue}` : '-'),
          assignedTo: job.assignedTo,
          criticalEquipment: isCritical ? 'YES' : 'No',
          _rowStatus: 'overdue' as WorkOrderStatus,
          isCriticalEquipment: isCritical
        };
      });
      
      // Apply status-based row highlighting (Light Red / Dark Red for overdue)
      applyWorkOrderDataRows(worksheet, preparedData, columns, dataStartRow);
      
      // Calculate summary row position
      const lastDataRowNum = dataStartRow + Math.max(overdueJobs.length - 1, 0);
      const summaryStartRow = lastDataRowNum + 3;
      
      // Apply standardized summary section - REMOVED fake severity counts
      // Only show real database-backed metrics
      const summary: SummaryItem[] = [
        { label: 'Total Overdue Jobs:', value: overdueJobs.length, highlight: true },
        { label: 'Critical Equipment Overdue:', value: debugStats.criticalEquipment, highlight: true },
        { label: 'Average Days Overdue:', value: avgDaysPastDue },
        { label: 'Longest Overdue:', value: `${maxDaysPastDue} days`, highlight: true },
        { label: 'Calendar Overdue:', value: debugStats.calendarOverdue },
        { label: 'RH Overdue:', value: debugStats.rhOverdue }
      ];
      
      const lastSummaryRow = applyStandardSummary(
        worksheet,
        summary,
        summaryStartRow,
        totalColumns,
        "ACTION REQUIRED: All overdue jobs must be completed or officially postponed with Master's approval"
      );
      
      // Auto-filter on header row
      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };
      
      // Apply standardized page setup
      applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastSummaryRow, vesselName);
      
      // Generate buffer and filename
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('OverdueJobs', vesselName);
      
      console.log(`[OVERDUE JOBS REPORT] Generated: ${filename} (${overdueJobs.length} jobs)`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Overdue Jobs report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETED JOBS REGISTER EXCEL REPORT - COMPREHENSIVE 25-COLUMN VERSION
  // All fields as per specification with summary statistics
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/completed-jobs", async (req, res) => {
    try {
      const { vesselId, dateFrom, dateTo } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Helper functions for date/time formatting
      const formatDateDDMMMYYYY = (dateStr: string | Date | null | undefined): string => {
        if (!dateStr) return '—';
        try {
          const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
          if (isNaN(d.getTime())) return '—';
          const day = d.getDate().toString().padStart(2, '0');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = months[d.getMonth()];
          const year = d.getFullYear();
          return `${day}-${month}-${year}`;
        } catch {
          return '—';
        }
      };

      const formatTimeHHMM = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '—';
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '—';
          const hours = d.getHours().toString().padStart(2, '0');
          const minutes = d.getMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        } catch {
          return '—';
        }
      };

      const calculateDuration = (startStr: string | null | undefined, endStr: string | null | undefined): number => {
        if (!startStr || !endStr) return 0;
        try {
          const start = new Date(startStr);
          const end = new Date(endStr);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
          return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
        } catch {
          return 0;
        }
      };
      
      // Fetch all required data
      const workOrders = await storage.getWorkOrders(vesselId);
      const jobs = await storage.getJobs(vesselId);
      const components = await storage.getComponents(vesselId);
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;
      
      // Create lookup maps
      const jobsMap = new Map(jobs.map(job => [job.id, job]));
      const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
      
      // Filter for completed jobs using dateCompleted field
      const completedWorkOrders = workOrders.filter(wo => wo.status === 'Completed');
      
      // Date range filtering using dateCompleted field
      let filteredJobs = completedWorkOrders;
      if (dateFrom || dateTo) {
        filteredJobs = completedWorkOrders.filter(wo => {
          const completedDate = wo.dateCompleted || (wo as any).completionDateTime;
          if (!completedDate) return true;
          const date = new Date(completedDate);
          if (isNaN(date.getTime())) return true;
          if (dateFrom && date < new Date(dateFrom)) return false;
          if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            if (date > endDate) return false;
          }
          return true;
        });
      }
      
      // Sort by dateCompleted DESC, then workOrderNo ASC
      filteredJobs.sort((a, b) => {
        const dateA = new Date(a.dateCompleted || (a as any).completionDateTime || 0).getTime();
        const dateB = new Date(b.dateCompleted || (b as any).completionDateTime || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        const woA = a.workOrderNo || a.id || '';
        const woB = b.workOrderNo || b.id || '';
        return woA.localeCompare(woB);
      });
      
      // Transform to comprehensive 25-field format
      let totalManHours = 0;
      const deptStats: Record<string, { count: number; manHours: number }> = {};
      const priorityStats: Record<string, number> = {};
      const jobTypeStats: Record<string, number> = {};
      
      const completedJobs = filteredJobs.map((wo, index) => {
        const job = jobsMap.get(wo.jobId || '');
        const comp = componentsByCodeMap.get(wo.componentCode || '');
        const isCritical = comp?.criticalEquipment === true || (comp?.criticalEquipment as any) === 'Yes';
        
        const duration = parseFloat(wo.totalTimeHours || '0') || calculateDuration(wo.startDateTime, (wo as any).completionDateTime);
        const persons = parseInt(wo.noOfPersons || '1') || 1;
        const manHours = parseFloat(wo.manhours || '0') || (duration * persons);
        totalManHours += manHours;
        
        const dept = wo.department || 'Unassigned';
        const priority = wo.jobPriority || 'Normal';
        const jobType = wo.taskType || wo.maintenanceType || 'Other';
        
        // Aggregate stats
        if (!deptStats[dept]) deptStats[dept] = { count: 0, manHours: 0 };
        deptStats[dept].count++;
        deptStats[dept].manHours += manHours;
        priorityStats[priority] = (priorityStats[priority] || 0) + 1;
        jobTypeStats[jobType] = (jobTypeStats[jobType] || 0) + 1;
        
        return {
          sNo: index + 1,
          workOrderNo: wo.workOrderNo || wo.id || '—',
          componentName: wo.component || comp?.name || '—',
          componentCode: wo.componentCode || '—',
          jobTitle: wo.jobTitle || '—',
          jobType: wo.taskType || wo.maintenanceType || '—',
          maintenanceBasis: wo.maintenanceBasis || job?.maintenanceBasis || '—',
          department: dept,
          priority: priority,
          criticality: isCritical ? 'Yes' : 'No',
          classRelated: wo.classRelated || 'No',
          assignedTo: wo.performedBy || wo.assignedTo || '—',
          approver: wo.approver || '—',
          submittedDate: formatDateDDMMMYYYY(wo.submittedDate || wo.createdAt),
          startDate: formatDateDDMMMYYYY(wo.startDateTime),
          startTime: formatTimeHHMM(wo.startDateTime),
          completionDate: formatDateDDMMMYYYY(wo.dateCompleted || (wo as any).completionDateTime),
          completionTime: formatTimeHHMM((wo as any).completionDateTime),
          workDuration: duration > 0 ? duration.toFixed(1) : '—',
          noOfPersons: wo.noOfPersons || '1',
          manHours: manHours > 0 ? manHours.toFixed(1) : '—',
          riskAssessment: wo.riskAssessmentStatus || 'N/A',
          safetyChecklists: wo.safetyChecklistsStatus || 'N/A',
          operationalForms: wo.operationalFormsStatus || 'N/A'
        };
      });
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Completed Jobs Register', {
        views: [{ state: 'frozen', ySplit: 8, xSplit: 2 }]
      });
      
      // Define all 25 columns
      const columns: ColumnDef[] = [
        { header: 'S.No', key: 'sNo', width: 6 },
        { header: 'Work Order No', key: 'workOrderNo', width: 22 },
        { header: 'Component', key: 'componentName', width: 20 },
        { header: 'Comp Code', key: 'componentCode', width: 14 },
        { header: 'Job Title', key: 'jobTitle', width: 25 },
        { header: 'Job Type', key: 'jobType', width: 12 },
        { header: 'Basis', key: 'maintenanceBasis', width: 10 },
        { header: 'Dept', key: 'department', width: 10 },
        { header: 'Priority', key: 'priority', width: 10 },
        { header: 'Critical', key: 'criticality', width: 8 },
        { header: 'Class', key: 'classRelated', width: 7 },
        { header: 'Assigned To', key: 'assignedTo', width: 14 },
        { header: 'Approver', key: 'approver', width: 14 },
        { header: 'Submitted', key: 'submittedDate', width: 14 },
        { header: 'Start Date', key: 'startDate', width: 14 },
        { header: 'Start Time', key: 'startTime', width: 10 },
        { header: 'Completed', key: 'completionDate', width: 14 },
        { header: 'End Time', key: 'completionTime', width: 10 },
        { header: 'Duration (Hrs)', key: 'workDuration', width: 12 },
        { header: 'Persons', key: 'noOfPersons', width: 8 },
        { header: 'Man-Hours', key: 'manHours', width: 10 },
        { header: 'Risk Assmt', key: 'riskAssessment', width: 10 },
        { header: 'Safety Chk', key: 'safetyChecklists', width: 10 },
        { header: 'Ops Forms', key: 'operationalForms', width: 10 }
      ];
      
      const totalColumns = columns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);
      const headerRowNum = 8;
      const dataStartRow = 9;
      
      // Header section (rows 1-7)
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'COMPLETED JOBS REGISTER';
      titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 28;
      
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'Comprehensive register of all completed maintenance work orders';
      subtitleCell.font = { size: 11, color: { argb: 'FFFFFFFF' } };
      subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Info rows
      worksheet.getCell('A3').value = `Vessel: ${vesselName}`;
      worksheet.getCell('A3').font = { bold: true };
      worksheet.mergeCells(`A3:E3`);
      
      const periodText = dateFrom && dateTo 
        ? `Report Period: ${formatDateDDMMMYYYY(dateFrom)} to ${formatDateDDMMMYYYY(dateTo)}`
        : 'Report Period: All Time';
      worksheet.getCell('F3').value = periodText;
      worksheet.mergeCells(`F3:L3`);
      
      worksheet.getCell('M3').value = `Generated: ${formatDateDDMMMYYYY(new Date())}`;
      worksheet.mergeCells(`M3:Q3`);
      
      worksheet.getCell('A4').value = `Total Jobs Completed: ${completedJobs.length}`;
      worksheet.getCell('A4').font = { bold: true };
      worksheet.mergeCells(`A4:E4`);
      
      worksheet.getCell('F4').value = `Total Man-Hours: ${totalManHours.toFixed(1)}`;
      worksheet.getCell('F4').font = { bold: true };
      worksheet.mergeCells(`F4:L4`);
      
      // Empty rows before header
      worksheet.getRow(5).height = 5;
      worksheet.getRow(6).height = 5;
      worksheet.getRow(7).height = 5;
      
      // Column headers
      const headerRow = worksheet.getRow(headerRowNum);
      columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5DADE2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
        };
        worksheet.getColumn(idx + 1).width = col.width;
      });
      headerRow.height = 22;
      
      // Data rows
      completedJobs.forEach((job, rowIdx) => {
        const row = worksheet.getRow(dataStartRow + rowIdx);
        columns.forEach((col, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = (job as any)[col.key] || '—';
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
          };
          // Alternating row colors
          if (rowIdx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
          }
          // Highlight critical equipment
          if (job.criticality === 'Yes') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6FFED' } };
          }
        });
        row.height = 18;
      });
      
      // Summary section
      const summaryStartRow = dataStartRow + completedJobs.length + 2;
      
      worksheet.mergeCells(`A${summaryStartRow}:${lastColLetter}${summaryStartRow}`);
      const summaryTitle = worksheet.getCell(`A${summaryStartRow}`);
      summaryTitle.value = 'SUMMARY STATISTICS';
      summaryTitle.font = { bold: true, size: 12, color: { argb: 'FF1E5A8E' } };
      
      // Department summary
      let currentRow = summaryStartRow + 2;
      worksheet.getCell(`A${currentRow}`).value = 'Jobs by Department:';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      Object.entries(deptStats).forEach(([dept, stats]) => {
        worksheet.getCell(`A${currentRow}`).value = `  ${dept}:`;
        worksheet.getCell(`B${currentRow}`).value = stats.count;
        worksheet.getCell(`C${currentRow}`).value = `(${stats.manHours.toFixed(1)} man-hrs)`;
        currentRow++;
      });
      
      // Priority summary
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = 'Jobs by Priority:';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      Object.entries(priorityStats).forEach(([priority, count]) => {
        worksheet.getCell(`A${currentRow}`).value = `  ${priority}:`;
        worksheet.getCell(`B${currentRow}`).value = count;
        currentRow++;
      });
      
      // Job type summary
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = 'Jobs by Type:';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      Object.entries(jobTypeStats).forEach(([jobType, count]) => {
        worksheet.getCell(`A${currentRow}`).value = `  ${jobType}:`;
        worksheet.getCell(`B${currentRow}`).value = count;
        currentRow++;
      });
      
      // Totals
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = 'Total Man-Hours:';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      worksheet.getCell(`B${currentRow}`).value = totalManHours.toFixed(1);
      worksheet.getCell(`B${currentRow}`).font = { bold: true };
      
      // Auto filter
      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };
      
      // Page setup
      worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 8, // A3
        fitToPage: true,
        fitToWidth: 1,
        printTitlesRow: `${headerRowNum}:${headerRowNum}`
      };
      
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('CompletedJobsRegister', vesselName);
      
      console.log(`[COMPLETED JOBS REGISTER] Generated: ${filename} (${completedJobs.length} jobs, ${totalManHours.toFixed(1)} man-hours)`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Completed Jobs Register report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UNPLANNED/BREAKDOWN JOBS EXCEL REPORT
  // Uses STANDARD 18-column format with Yellow highlighting
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/unplanned-jobs", async (req, res) => {
    try {
      const { vesselId, dateFrom, dateTo } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Fetch all required data
      const workOrders = await storage.getWorkOrders(vesselId);
      const jobs = await storage.getJobs(vesselId);
      const components = await storage.getComponents(vesselId);
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;
      
      // Create lookup maps
      const jobsMap = new Map(jobs.map(job => [job.id, job]));
      const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
      
      // Filter for unplanned/breakdown jobs (workOrderType = 'Unplanned' or starts with 'UWO')
      const unplannedWorkOrders = workOrders.filter(wo => 
        wo.workOrderType === 'Unplanned' || 
        wo.type === 'Unplanned' ||
        (wo.workOrderNumber && wo.workOrderNumber.startsWith('UWO'))
      );
      
      // Optional date range filtering
      let filteredJobs = unplannedWorkOrders;
      if (dateFrom || dateTo) {
        filteredJobs = unplannedWorkOrders.filter(wo => {
          const createdDate = wo.createdAt || wo.dueDate;
          if (!createdDate) return true;
          const date = new Date(createdDate);
          if (dateFrom && date < new Date(dateFrom)) return false;
          if (dateTo && date > new Date(dateTo)) return false;
          return true;
        });
      }
      
      // Transform to standard format
      const unplannedJobs = filteredJobs.map(wo => {
        const job = jobsMap.get(wo.jobId || '');
        const comp = componentsByCodeMap.get(wo.componentCode || '');
        const isCritical = comp?.criticalEquipment === true || comp?.criticalEquipment === 'Yes';
        
        return {
          workOrderNo: wo.workOrderNumber || wo.id,
          templateCode: job?.templateCode || '-',
          jobTitle: wo.title || wo.jobTitle || '-',
          componentCode: wo.componentCode || '-',
          componentName: wo.component || wo.componentName || comp?.componentName || '-',
          department: wo.department || wo.assignedDepartment || '-',
          priority: wo.priority || 'High',
          woStatus: wo.status || 'Active',
          dueDate: wo.dueDate ? formatDateForExcel(wo.dueDate) : '-',
          createdDate: wo.createdAt,
          lastDoneDate: wo.completedDate ? formatDateForExcel(wo.completedDate) : '-',
          assignedTo: wo.assignedTo || '-',
          maintenanceBasis: 'Unplanned',
          critical: isCritical ? 'Yes' : 'No'
        };
      });
      
      // Sort by created date (most recent first)
      unplannedJobs.sort((a, b) => {
        const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return dateB - dateA;
      });
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Unplanned Jobs', {
        views: [{ state: 'frozen', ySplit: 7, xSplit: 2 }]
      });
      
      // Use STANDARD 18-column definition
      const columns = STANDARD_WORK_ORDER_COLUMNS;
      const totalColumns = columns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);
      const headerRowNum = 7;
      const dataStartRow = 8;
      
      // Apply standardized header
      applyStandardHeader(
        worksheet,
        'UNPLANNED/BREAKDOWN JOBS REPORT',
        'Breakdown maintenance and unplanned work',
        vesselName,
        unplannedJobs.length,
        lastColLetter
      );
      
      applyStandardTableHeader(worksheet, columns, headerRowNum);
      
      // Prepare data in standard format with YELLOW highlighting
      const preparedData: WorkOrderRowData[] = unplannedJobs.map((job, index) => {
        const isCritical = job.critical === 'Yes';
        
        return {
          sno: index + 1,
          workOrderNo: job.workOrderNo,
          jobCode: 'UNPLANNED',
          jobTitle: job.jobTitle,
          componentCode: job.componentCode,
          componentName: job.componentName,
          department: job.department,
          priority: job.priority,
          status: job.woStatus,
          dueDate: job.dueDate,
          lastDoneDate: job.lastDoneDate,
          daysLeft: '-',
          daysOverdue: '-',
          nextDueRH: '-',
          currentRH: '-',
          rhRemaining: '-',
          assignedTo: job.assignedTo,
          criticalEquipment: isCritical ? 'YES' : 'No',
          _rowStatus: 'unplanned' as WorkOrderStatus,
          isCriticalEquipment: isCritical
        };
      });
      
      // Apply status-based row highlighting (Yellow)
      applyWorkOrderDataRows(worksheet, preparedData, columns, dataStartRow);
      
      // Summary section
      const lastDataRowNum = dataStartRow + Math.max(unplannedJobs.length - 1, 0);
      const summaryStartRow = lastDataRowNum + 3;
      
      const criticalEquipmentCount = unplannedJobs.filter(j => j.critical === 'Yes').length;
      const completedCount = unplannedJobs.filter(j => j.woStatus === 'Completed').length;
      const activeCount = unplannedJobs.filter(j => j.woStatus !== 'Completed').length;
      
      const summary: SummaryItem[] = [
        { label: 'Total Unplanned Jobs:', value: unplannedJobs.length },
        { label: 'Active:', value: activeCount },
        { label: 'Completed:', value: completedCount },
        { label: 'Critical Equipment:', value: criticalEquipmentCount }
      ];
      
      const lastSummaryRow = applyStandardSummary(
        worksheet, 
        summary, 
        summaryStartRow, 
        totalColumns,
        "NOTE: Breakdown jobs require root cause analysis and corrective actions"
      );
      
      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };
      
      applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastSummaryRow, vesselName);
      
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('UnplannedJobs', vesselName);
      
      console.log(`[UNPLANNED JOBS REPORT] Generated: ${filename} (${unplannedJobs.length} jobs)`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Unplanned Jobs report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 1.7: JOB POSTPONEMENT LOG EXCEL REPORT
  // Uses work_order_postponements HISTORY/AUDIT table
  // Custom 19-column format with Sky Blue highlighting for postponed jobs
  // Tracks all postponements as audit trail with original/new dates, reasons, approvals
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/postponement-log", async (req, res) => {
    try {
      const { vesselId, dateFrom, dateTo, status } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Date formatting helper for Excel display
      const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
        if (!dateVal) return '-';
        try {
          const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
          if (isNaN(date.getTime())) return '-';
          return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
          return '-';
        }
      };
      
      // Fetch related data for lookups
      const workOrders = await storage.getWorkOrders(vesselId);
      const components = await storage.getComponents(vesselId);
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;
      
      // Create lookup maps
      const workOrdersMap = new Map(workOrders.map(wo => [wo.id, wo]));
      const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
      
      // Try fetching from history table first
      let postponements = await storage.getWorkOrderPostponements(vesselId, {
        status: status || 'All',
        dateFrom: dateFrom,
        dateTo: dateTo
      });
      
      // Fallback: if no history records, generate from postponed work orders directly
      if (postponements.length === 0) {
        const postponedWOs = workOrders.filter(wo => 
          wo.status === 'Postponed' && 
          (wo.postponementEndDate || wo.postponementReason)
        );
        
        // Convert work orders to postponement format for consistent processing
        postponements = postponedWOs.map(wo => ({
          id: `temp-${wo.id}`,
          workOrderId: wo.id,
          vesselId: vesselId,
          postponementNumber: 1,
          originalDueDate: wo.dueDate,
          newDueDate: wo.postponementEndDate,
          postponementReason: wo.postponementReason,
          authorizedBy: wo.postponementAuthorizedBy,
          approvalRemarks: null,
          durationDays: null,
          submittedDate: wo.submittedDate,
          approvedDate: null,
          approvedBy: null,
          status: 'Approved',
          informOffice: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        
        console.log(`[POSTPONEMENT LOG REPORT] Fallback: generated ${postponements.length} records from work orders`);
      }
      
      // Transform postponement records to report format
      const postponedJobs = postponements.map((p: any) => {
        const wo = workOrdersMap.get(p.workOrderId);
        const comp = wo?.componentCode ? componentsByCodeMap.get(wo.componentCode) : undefined;
        const isCritical = (comp as any)?.critical === true;
        
        // Calculate duration in days between original and new due date
        let durationDays = p.durationDays || 0;
        if (!durationDays && p.originalDueDate && p.newDueDate) {
          const origDate = new Date(p.originalDueDate);
          const newDate = new Date(p.newDueDate);
          if (!isNaN(origDate.getTime()) && !isNaN(newDate.getTime())) {
            durationDays = Math.ceil((newDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
        
        return {
          postponementNumber: p.postponementNumber || 1,
          workOrderNo: wo?.workOrderNo || p.workOrderId,
          jobTitle: wo?.jobTitle || '-',
          componentCode: wo?.componentCode || '-',
          componentName: wo?.component || (comp as any)?.componentName || '-',
          department: wo?.department || '-',
          originalDueDate: formatDateDisplay(p.originalDueDate),
          newDueDate: formatDateDisplay(p.newDueDate),
          durationDays: durationDays,
          postponementReason: p.postponementReason || '-',
          authorizedBy: p.authorizedBy || '-',
          submittedDate: formatDateDisplay(p.submittedDate),
          status: p.status || 'Pending',
          approvedDate: formatDateDisplay(p.approvedDate),
          approvedBy: p.approvedBy || '-',
          approvalRemarks: p.approvalRemarks || '-',
          informOffice: p.informOffice ? 'Yes' : 'No',
          critical: isCritical ? 'Yes' : 'No'
        };
      });
      
      // Sort by submitted date (most recent first), then by postponement number
      postponedJobs.sort((a: any, b: any) => {
        // First sort by work order, then by postponement number (descending)
        if (a.workOrderNo !== b.workOrderNo) {
          return a.workOrderNo.localeCompare(b.workOrderNo);
        }
        return b.postponementNumber - a.postponementNumber;
      });
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Postponement Log', {
        views: [{ state: 'frozen', ySplit: 7, xSplit: 3 }]
      });
      
      // Custom 19-column definition for Postponement Log Report
      const postponementColumns: ColumnDef[] = [
        { key: 'sno', header: 'S.No', width: 6, type: 'number', align: 'center' },
        { key: 'postponementNo', header: 'Post. #', width: 8, type: 'number', align: 'center' },
        { key: 'workOrderNo', header: 'WO Number', width: 16, type: 'text', align: 'left' },
        { key: 'jobTitle', header: 'Job Title', width: 35, type: 'text', align: 'left' },
        { key: 'componentCode', header: 'Comp. Code', width: 14, type: 'text', align: 'center' },
        { key: 'componentName', header: 'Component Name', width: 30, type: 'text', align: 'left' },
        { key: 'department', header: 'Dept', width: 12, type: 'text', align: 'center' },
        { key: 'originalDueDate', header: 'Original Due', width: 14, type: 'date', align: 'center' },
        { key: 'newDueDate', header: 'New Due Date', width: 14, type: 'date', align: 'center' },
        { key: 'durationDays', header: 'Days Extended', width: 12, type: 'number', align: 'center' },
        { key: 'postponementReason', header: 'Postponement Reason', width: 40, type: 'text', align: 'left' },
        { key: 'authorizedBy', header: 'Authorized By', width: 18, type: 'text', align: 'left' },
        { key: 'submittedDate', header: 'Submitted', width: 14, type: 'date', align: 'center' },
        { key: 'status', header: 'Status', width: 12, type: 'text', align: 'center' },
        { key: 'approvedDate', header: 'Approved On', width: 14, type: 'date', align: 'center' },
        { key: 'approvedBy', header: 'Approved By', width: 18, type: 'text', align: 'left' },
        { key: 'approvalRemarks', header: 'Approval Remarks', width: 30, type: 'text', align: 'left' },
        { key: 'informOffice', header: 'Office Notified', width: 12, type: 'text', align: 'center' },
        { key: 'critical', header: 'Critical Equip.', width: 12, type: 'text', align: 'center' }
      ];
      
      const totalColumns = postponementColumns.length;
      const lastColLetter = getLastColumnLetter(totalColumns);
      const headerRowNum = 7;
      const dataStartRow = 8;
      
      // Apply standardized header
      applyStandardHeader(
        worksheet,
        'JOB POSTPONEMENT LOG REPORT',
        'Audit trail of all postponed jobs with approvals and justifications',
        vesselName,
        postponedJobs.length,
        lastColLetter
      );
      
      applyStandardTableHeader(worksheet, postponementColumns, headerRowNum);
      
      // Prepare data rows
      const preparedData = postponedJobs.map((job: any, index: number) => ({
        sno: index + 1,
        postponementNo: job.postponementNumber,
        workOrderNo: job.workOrderNo,
        jobTitle: job.jobTitle,
        componentCode: job.componentCode,
        componentName: job.componentName,
        department: job.department,
        originalDueDate: job.originalDueDate,
        newDueDate: job.newDueDate,
        durationDays: job.durationDays > 0 ? job.durationDays : '-',
        postponementReason: job.postponementReason,
        authorizedBy: job.authorizedBy,
        submittedDate: job.submittedDate,
        status: job.status,
        approvedDate: job.approvedDate,
        approvedBy: job.approvedBy,
        approvalRemarks: job.approvalRemarks,
        informOffice: job.informOffice,
        critical: job.critical
      }));
      
      // Apply data rows with Sky Blue highlighting for postponed jobs
      if (preparedData.length === 0) {
        const emptyRow = worksheet.getRow(dataStartRow);
        emptyRow.getCell(1).value = 'No postponement records found';
        worksheet.mergeCells(dataStartRow, 1, dataStartRow, totalColumns);
        emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        emptyRow.getCell(1).font = { italic: true, color: { argb: COLORS.textLight }, size: 11, name: 'Arial' };
        emptyRow.height = 30;
      } else {
        preparedData.forEach((record: any, index: number) => {
          const rowNum = dataStartRow + index;
          const row = worksheet.getRow(rowNum);
          
          // Set cell values
          postponementColumns.forEach((col: ColumnDef, colIdx: number) => {
            const cellValue = record[col.key];
            row.getCell(colIdx + 1).value = cellValue !== undefined && cellValue !== null ? cellValue : '-';
          });
          
          row.height = 20;
          
          // Apply Sky Blue highlighting for postponed jobs
          const isEvenRow = index % 2 === 1;
          const isCritical = record.critical === 'Yes';
          const bgColor = isCritical ? STATUS_COLORS.postponedDark : (isEvenRow ? STATUS_COLORS.postponedLight : 'FFE0F2F7');
          const textColor = isCritical ? STATUS_COLORS.textOnDark : STATUS_COLORS.textOnLight;
          
          row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
            if (colNumber <= totalColumns) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: bgColor }
              };
              cell.font = { 
                color: { argb: textColor }, 
                size: 10, 
                name: 'Arial',
                bold: isCritical 
              };
              cell.alignment = { 
                vertical: 'middle', 
                horizontal: postponementColumns[colNumber - 1]?.align || 'left',
                wrapText: true 
              };
              cell.border = {
                top: { style: 'thin', color: { argb: COLORS.border } },
                left: { style: 'thin', color: { argb: COLORS.border } },
                bottom: { style: 'thin', color: { argb: COLORS.border } },
                right: { style: 'thin', color: { argb: COLORS.border } }
              };
            }
          });
        });
      }
      
      // Summary section
      const lastDataRowNum = dataStartRow + Math.max(postponedJobs.length - 1, 0);
      const summaryStartRow = lastDataRowNum + 3;
      
      const criticalCount = postponedJobs.filter((j: any) => j.critical === 'Yes').length;
      const pendingCount = postponedJobs.filter((j: any) => j.status === 'Pending' || j.status === 'Submitted').length;
      const approvedCount = postponedJobs.filter((j: any) => j.status === 'Approved').length;
      const rejectedCount = postponedJobs.filter((j: any) => j.status === 'Rejected').length;
      
      const summary: SummaryItem[] = [
        { label: 'Total Postponement Records:', value: postponedJobs.length },
        { label: 'Pending Approval:', value: pendingCount },
        { label: 'Approved:', value: approvedCount },
        { label: 'Rejected:', value: rejectedCount },
        { label: 'Critical Equipment Postponed:', value: criticalCount, highlight: true }
      ];
      
      const lastSummaryRow = applyStandardSummary(
        worksheet, 
        summary, 
        summaryStartRow, 
        totalColumns,
        "NOTE: All postponements require Master's approval and documented justification. Multiple postponements of the same work order are tracked separately."
      );
      
      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: totalColumns }
      };
      
      applyStandardPageSetup(worksheet, headerRowNum, totalColumns, lastSummaryRow, vesselName);
      
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateFilename('PostponementLog', vesselName);
      
      console.log(`[POSTPONEMENT LOG REPORT] Generated: ${filename} (${postponedJobs.length} records)`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Postponement Log report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POPULATE POSTPONEMENT HISTORY FROM EXISTING WORK ORDERS (Admin Migration)
  // One-time endpoint to seed the work_order_postponements table from existing data
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/admin/populate-postponement-history", async (req, res) => {
    try {
      const { vesselId } = req.body;
      
      const allVessels = await storage.getVessels();
      const targetVessels = vesselId && vesselId !== 'all' 
        ? allVessels.filter(v => v.id === vesselId) 
        : allVessels;
      
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];
      
      for (const vessel of targetVessels) {
        const workOrders = await storage.getWorkOrders(vessel.id);
        const postponedWOs = workOrders.filter(wo => 
          wo.status === 'Postponed' && 
          (wo.postponementEndDate || wo.postponementReason)
        );
        
        for (const wo of postponedWOs) {
          try {
            const existingPostponements = await storage.getWorkOrderPostponements({
              workOrderId: wo.id,
              vesselId: vessel.id
            });
            
            if (existingPostponements.length > 0) {
              skipped++;
              continue;
            }
            
            const postponementId = `pp-${wo.id}-${Date.now()}`;
            const postponementData = {
              id: postponementId,
              workOrderId: wo.id,
              vesselId: vessel.id,
              postponementNumber: 1,
              originalDueDate: wo.dueDate || null,
              newDueDate: wo.postponementEndDate || null,
              postponementReason: wo.postponementReason || 'Migrated from existing work order',
              authorizedBy: wo.postponementAuthorizedBy || null,
              approvalRemarks: null,
              durationDays: null,
              submittedDate: wo.submittedDate || null,
              approvedDate: null,
              approvedBy: null,
              status: 'Approved',
              informOffice: false
            };
            
            if (postponementData.originalDueDate && postponementData.newDueDate) {
              const origDate = new Date(postponementData.originalDueDate);
              const newDate = new Date(postponementData.newDueDate);
              if (!isNaN(origDate.getTime()) && !isNaN(newDate.getTime())) {
                postponementData.durationDays = Math.ceil((newDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24));
              }
            }
            
            await storage.createWorkOrderPostponement(postponementData);
            created++;
          } catch (err: any) {
            errors.push(`WO ${wo.workOrderNo || wo.id}: ${err.message}`);
          }
        }
      }
      
      console.log(`[POSTPONEMENT MIGRATION] Populated: ${created} created, ${skipped} skipped, ${errors.length} errors`);
      
      res.json({
        success: true,
        created,
        skipped,
        errors: errors.slice(0, 10),
        message: `Created ${created} postponement history records (${skipped} skipped, ${errors.length} errors)`
      });
      
    } catch (error: any) {
      console.error("Error populating postponement history:", error);
      res.status(500).json({ error: "Failed to populate postponement history: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTHLY MAINTENANCE SUMMARY EXCEL REPORT
  // KPI/Dashboard report with aggregated statistics - NOT a job list report
  // Multi-section layout: Executive Summary, Statistics, Department, Frequency, Man-Hours, Critical
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/maintenance/monthly-summary/excel", async (req, res) => {
    try {
      const { vesselId, startDate, endDate } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Please provide start and end dates for the report period" });
      }
      
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      periodEnd.setHours(23, 59, 59, 999);
      const now = new Date();
      
      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;
      
      const workOrders = await storage.getWorkOrders(vesselId);
      const jobs = await storage.getJobs(vesselId);
      const components = await storage.getComponents(vesselId);
      
      const jobsMap = new Map(jobs.map(job => [job.id, job]));
      const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
      
      // Helper to parse DD-MMM-YYYY or ISO date strings
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        // Try DD-MMM-YYYY format (e.g., "16-Dec-2025")
        const ddMmmYyyy = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (ddMmmYyyy) {
          const months: Record<string, number> = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const day = parseInt(ddMmmYyyy[1], 10);
          const month = months[ddMmmYyyy[2]];
          const year = parseInt(ddMmmYyyy[3], 10);
          if (month !== undefined) return new Date(year, month, day);
        }
        // Fallback to standard Date parsing (ISO format)
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
      };
      
      // DEBUG: Log completed work orders for verification
      const completedInPeriod = workOrders.filter((wo: any) => wo.status === 'Completed');
      console.log(`[MONTHLY SUMMARY DEBUG] Total Completed WOs in vessel: ${completedInPeriod.length}`);
      completedInPeriod.slice(0, 5).forEach((wo: any) => {
        const completionDate = parseDate(wo.completionDateTime);
        const inRange = completionDate && completionDate >= periodStart && completionDate <= periodEnd;
        console.log(`  WO: ${wo.workOrderNo || wo.id}, Status: ${wo.status}, completionDateTime: ${wo.completionDateTime}, Parsed: ${completionDate?.toISOString() || 'null'}, InRange: ${inRange}`);
      });
      
      // Monthly WOs = jobs due in period OR completed in period
      const monthlyWOs = workOrders.filter((wo: any) => {
        const dueDate = parseDate(wo.dueDate);
        const completionDate = parseDate(wo.completionDateTime);
        
        // Include if due date falls in selected month
        const isDueInMonth = dueDate && dueDate >= periodStart && dueDate <= periodEnd;
        
        // OR completed in selected month
        const isCompletedInMonth = wo.status === 'Completed' 
          && completionDate 
          && completionDate >= periodStart 
          && completionDate <= periodEnd;
        
        return isDueInMonth || isCompletedInMonth;
      });
      
      console.log(`[MONTHLY SUMMARY DEBUG] Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
      console.log(`[MONTHLY SUMMARY DEBUG] monthlyWOs: ${monthlyWOs.length}, CompletedInScope: ${monthlyWOs.filter((wo: any) => wo.status === 'Completed').length}`);
      
      // Completed jobs from monthlyWOs scope
      const completedWOs = monthlyWOs.filter((wo: any) => wo.status === 'Completed');
      
      // CUMULATIVE overdue: ALL work orders with dueDate < periodEnd AND status != Completed
      const cumulativeOverdueWOs = workOrders.filter((wo: any) => {
        if (!wo.dueDate || wo.status === 'Completed') return false;
        const dueDate = parseDate(wo.dueDate);
        return dueDate && dueDate < periodEnd;
      });
      
      // On-time completions from completed WOs in scope
      const onTimeCompletions = completedWOs.filter((wo: any) => {
        const dueDate = parseDate(wo.dueDate);
        const completionDate = parseDate(wo.completionDateTime);
        if (!dueDate || !completionDate) return true;
        return completionDate <= dueDate;
      });
      
      const totalInScope = monthlyWOs.length;
      const totalCompleted = completedWOs.length;
      const totalOverdue = cumulativeOverdueWOs.length;
      const completionRate = totalInScope > 0 ? Math.round((totalCompleted / totalInScope) * 100) : 0;
      const onTimeRate = totalCompleted > 0 ? Math.round((onTimeCompletions.length / totalCompleted) * 100) : 0;
      
      const criticalWOs = monthlyWOs.filter((wo: any) => {
        const comp = componentsByCodeMap.get(wo.componentCode || '');
        return comp?.classRelated === 'Yes' || comp?.classRelated === true || 
               wo.classRelated === 'Yes' || wo.criticality === 'Yes' || wo.jobPriority === 'High';
      });
      
      let totalManHours = 0;
      completedWOs.forEach((wo: any) => {
        totalManHours += Number(wo.manhours || wo.totalTimeHours || wo.actualHours || 0);
      });
      
      const activeJobs = monthlyWOs.filter((wo: any) => 
        wo.status !== 'Completed' && wo.status !== 'Postponed'
      ).length;
      
      // Priority stats from monthlyWOs scope (due OR completed in month)
      const priorityStats: Record<string, { total: number; completed: number; overdue: number }> = {
        'High': { total: 0, completed: 0, overdue: 0 },
        'Medium': { total: 0, completed: 0, overdue: 0 },
        'Low': { total: 0, completed: 0, overdue: 0 },
        'Normal': { total: 0, completed: 0, overdue: 0 }
      };
      
      monthlyWOs.forEach((wo: any) => {
        const priority = wo.jobPriority || 'Normal';
        if (!priorityStats[priority]) priorityStats[priority] = { total: 0, completed: 0, overdue: 0 };
        priorityStats[priority].total++;
        if (wo.status === 'Completed') priorityStats[priority].completed++;
      });
      
      // Add cumulative overdue by priority (from ALL work orders)
      cumulativeOverdueWOs.forEach((wo: any) => {
        const priority = wo.jobPriority || 'Normal';
        if (!priorityStats[priority]) priorityStats[priority] = { total: 0, completed: 0, overdue: 0 };
        priorityStats[priority].overdue++;
      });
      
      // Department stats from monthlyWOs scope
      const deptStats: Record<string, { planned: number; completed: number; overdue: number }> = {};
      monthlyWOs.forEach((wo: any) => {
        const dept = wo.department || wo.assignedDepartment || 'Unassigned';
        if (!deptStats[dept]) deptStats[dept] = { planned: 0, completed: 0, overdue: 0 };
        deptStats[dept].planned++;
        if (wo.status === 'Completed') deptStats[dept].completed++;
      });
      
      // Add cumulative overdue by department (from ALL work orders)
      cumulativeOverdueWOs.forEach((wo: any) => {
        const dept = wo.department || wo.assignedDepartment || 'Unassigned';
        if (!deptStats[dept]) deptStats[dept] = { planned: 0, completed: 0, overdue: 0 };
        deptStats[dept].overdue++;
      });
      
      const freqStats: Record<string, { count: number; completed: number }> = {
        'Daily': { count: 0, completed: 0 },
        'Weekly': { count: 0, completed: 0 },
        'Monthly': { count: 0, completed: 0 },
        'Quarterly': { count: 0, completed: 0 },
        'Yearly': { count: 0, completed: 0 },
        'Other': { count: 0, completed: 0 }
      };
      
      monthlyWOs.forEach((wo: any) => {
        const job = jobsMap.get(wo.jobId || '');
        // Use WO's frequencyUnit, fallback to job's frequencyUnit
        let freqUnit = wo.frequencyUnit || job?.frequencyUnit || 'Other';
        const freqValue = Number(wo.frequencyValue || job?.frequencyValue || 0);
        if (freqUnit === 'Months' && freqValue === 3) freqUnit = 'Quarterly';
        else if (freqUnit === 'Months' && freqValue === 12) freqUnit = 'Yearly';
        else if (freqUnit === 'Months') freqUnit = 'Monthly';
        else if (freqUnit === 'Weeks') freqUnit = 'Weekly';
        else if (freqUnit === 'Days') freqUnit = 'Daily';
        else if (freqUnit === 'Years') freqUnit = 'Yearly';
        else if (freqUnit === 'Hours') freqUnit = 'Hours-Based';
        
        if (!freqStats[freqUnit]) freqStats[freqUnit] = { count: 0, completed: 0 };
        freqStats[freqUnit].count++;
        if (wo.status === 'Completed') freqStats[freqUnit].completed++;
      });
      
      const manHoursByDept: Record<string, number> = {};
      completedWOs.forEach((wo: any) => {
        const dept = wo.department || wo.assignedDepartment || 'Unassigned';
        const hours = Number(wo.manhours || wo.totalTimeHours || wo.actualHours || 0);
        manHoursByDept[dept] = (manHoursByDept[dept] || 0) + hours;
      });
      
      // Critical equipment stats from monthlyWOs scope (in-scope jobs)
      const criticalEquipStats = {
        solas: { total: 0, completed: 0, overdue: 0 },
        classCritical: { total: 0, completed: 0, overdue: 0 },
        highPriority: { total: 0, completed: 0, overdue: 0 }
      };
      
      // Count total and completed from monthlyWOs
      monthlyWOs.forEach((wo: any) => {
        const comp = componentsByCodeMap.get(wo.componentCode || '');
        const isClassRelated = comp?.classRelated === 'Yes' || comp?.classRelated === true;
        const isSolas = comp?.solasCritical === 'Yes' || comp?.solasCritical === true;
        const isHighPriority = wo.criticality === 'Yes' || wo.jobPriority === 'High';
        const isCompleted = wo.status === 'Completed';
        
        if (isSolas) {
          criticalEquipStats.solas.total++;
          if (isCompleted) criticalEquipStats.solas.completed++;
        }
        if (isClassRelated) {
          criticalEquipStats.classCritical.total++;
          if (isCompleted) criticalEquipStats.classCritical.completed++;
        }
        if (isHighPriority) {
          criticalEquipStats.highPriority.total++;
          if (isCompleted) criticalEquipStats.highPriority.completed++;
        }
      });
      
      // Add cumulative overdue from ALL work orders for critical equipment
      cumulativeOverdueWOs.forEach((wo: any) => {
        const comp = componentsByCodeMap.get(wo.componentCode || '');
        const isClassRelated = comp?.classRelated === 'Yes' || comp?.classRelated === true;
        const isSolas = comp?.solasCritical === 'Yes' || comp?.solasCritical === true;
        const isHighPriority = wo.criticality === 'Yes' || wo.jobPriority === 'High';
        
        if (isSolas) criticalEquipStats.solas.overdue++;
        if (isClassRelated) criticalEquipStats.classCritical.overdue++;
        if (isHighPriority) criticalEquipStats.highPriority.overdue++;
      });
      
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Monthly Summary', {
        views: [{ state: 'frozen', ySplit: 6, xSplit: 0 }]
      });
      
      const totalColumns = 8;
      const lastColLetter = 'H';
      
      for (let i = 1; i <= totalColumns; i++) {
        worksheet.getColumn(i).width = 18;
      }
      
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'SEAFARER TECHNICAL MANAGEMENT SYSTEM';
      titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 30;
      
      worksheet.mergeCells('A2:H2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'MONTHLY MAINTENANCE SUMMARY';
      subtitleCell.font = { size: 12, bold: true, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
      subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 25;
      
      worksheet.getRow(3).height = 8;
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const reportPeriod = `${monthNames[periodStart.getMonth()]} ${periodStart.getFullYear()}`;
      
      worksheet.getCell('A4').value = `Vessel: ${vesselName}`;
      worksheet.getCell('A4').font = { bold: true, size: 10, name: 'Arial' };
      worksheet.mergeCells('E4:H4');
      worksheet.getCell('E4').value = `Report Period: ${reportPeriod}`;
      worksheet.getCell('E4').font = { size: 10, name: 'Arial' };
      worksheet.getCell('E4').alignment = { horizontal: 'right' };
      
      const genDate = new Date();
      const genDateStr = `${genDate.getDate().toString().padStart(2, '0')}-${monthNames[genDate.getMonth()].slice(0,3)}-${genDate.getFullYear()} ${genDate.getHours().toString().padStart(2,'0')}:${genDate.getMinutes().toString().padStart(2,'0')}`;
      worksheet.getCell('A5').value = `Generated: ${genDateStr}`;
      worksheet.getCell('A5').font = { size: 9, color: { argb: 'FF666666' }, name: 'Arial' };
      worksheet.mergeCells('E5:H5');
      worksheet.getCell('E5').value = 'Generated By: PMS System';
      worksheet.getCell('E5').font = { size: 9, color: { argb: 'FF666666' }, name: 'Arial' };
      worksheet.getCell('E5').alignment = { horizontal: 'right' };
      
      worksheet.getRow(6).height = 10;
      
      let currentRow = 8;
      
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const execHeader = worksheet.getCell(`A${currentRow}`);
      execHeader.value = 'EXECUTIVE SUMMARY';
      execHeader.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
      execHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      execHeader.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      const kpiRow1 = currentRow;
      const kpis1 = [
        { label: 'Jobs In Scope', value: totalInScope, color: 'FFE0F2FE' },
        { label: 'Total Completed', value: totalCompleted, color: 'FFD1FAE5' },
        { label: 'Total Overdue', value: totalOverdue, color: 'FFFEE2E2' },
        { label: 'Completion Rate', value: `${completionRate}%`, color: 'FFEDE9FE' }
      ];
      
      kpis1.forEach((kpi, idx) => {
        const col = (idx * 2) + 1;
        worksheet.mergeCells(kpiRow1, col, kpiRow1, col + 1);
        const cell = worksheet.getCell(kpiRow1, col);
        cell.value = kpi.label;
        cell.font = { size: 9, color: { argb: 'FF666666' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
        };
      });
      currentRow++;
      
      const kpiRow2 = currentRow;
      kpis1.forEach((kpi, idx) => {
        const col = (idx * 2) + 1;
        worksheet.mergeCells(kpiRow2, col, kpiRow2, col + 1);
        const cell = worksheet.getCell(kpiRow2, col);
        cell.value = kpi.value;
        cell.font = { bold: true, size: 16, color: { argb: kpi.label === 'Total Overdue' && totalOverdue > 0 ? 'FFDC2626' : 'FF1E3A8A' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
        };
      });
      worksheet.getRow(kpiRow2).height = 35;
      currentRow++;
      
      currentRow++;
      
      const kpiRow3 = currentRow;
      const kpis2 = [
        { label: 'On-Time %', value: `${onTimeRate}%`, color: 'FFE0F2FE' },
        { label: 'Critical Jobs', value: criticalWOs.length, color: 'FFFEE2E2' },
        { label: 'Total Man-Hours', value: totalManHours.toFixed(1), color: 'FFFFFBEB' },
        { label: 'Active Jobs', value: activeJobs, color: 'FFEDE9FE' }
      ];
      
      kpis2.forEach((kpi, idx) => {
        const col = (idx * 2) + 1;
        worksheet.mergeCells(kpiRow3, col, kpiRow3, col + 1);
        const cell = worksheet.getCell(kpiRow3, col);
        cell.value = kpi.label;
        cell.font = { size: 9, color: { argb: 'FF666666' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
        };
      });
      currentRow++;
      
      const kpiRow4 = currentRow;
      kpis2.forEach((kpi, idx) => {
        const col = (idx * 2) + 1;
        worksheet.mergeCells(kpiRow4, col, kpiRow4, col + 1);
        const cell = worksheet.getCell(kpiRow4, col);
        cell.value = kpi.value;
        cell.font = { bold: true, size: 16, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
          right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
        };
      });
      worksheet.getRow(kpiRow4).height = 35;
      currentRow += 3;
      
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const woStatsHeader = worksheet.getCell(`A${currentRow}`);
      woStatsHeader.value = 'WORK ORDER STATISTICS';
      woStatsHeader.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
      woStatsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      woStatsHeader.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      const woTableHeaders = ['Category', 'Total', 'Completed', 'Overdue', 'Rate %'];
      woTableHeaders.forEach((header, idx) => {
        const cell = worksheet.getCell(currentRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF93C5FD' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      const allWOStats = { total: totalInScope, completed: totalCompleted, overdue: totalOverdue };
      const woStatsData = [
        { category: 'All Work Orders', ...allWOStats },
        { category: 'High Priority', ...priorityStats['High'] },
        { category: 'Medium Priority', ...priorityStats['Medium'] },
        { category: 'Low Priority', ...priorityStats['Low'] }
      ];
      
      woStatsData.forEach((row, idx) => {
        const rate = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        const rateColor = rate >= 90 ? 'FF16A34A' : rate >= 70 ? 'FF9A3412' : rate >= 50 ? 'FFDC2626' : 'FFDC2626';
        const rateBgColor = rate >= 90 ? 'FFD1FAE5' : rate >= 70 ? 'FFFEF9C3' : rate >= 50 ? 'FFFED7AA' : 'FFFEE2E2';
        
        [row.category, row.total, row.completed, row.overdue, `${rate}%`].forEach((val, colIdx) => {
          const cell = worksheet.getCell(currentRow, colIdx + 1);
          cell.value = val;
          cell.font = { size: 10, name: 'Arial', color: { argb: colIdx === 4 ? rateColor : (colIdx === 3 && row.overdue > 10 ? 'FFDC2626' : 'FF2C3E50') }, bold: colIdx === 3 && row.overdue > 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colIdx === 4 ? rateBgColor : bgColor } };
          cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'center', vertical: 'middle' };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
          };
        });
        currentRow++;
      });
      currentRow += 2;
      
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const deptHeader = worksheet.getCell(`A${currentRow}`);
      deptHeader.value = 'DEPARTMENT-WISE BREAKDOWN';
      deptHeader.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
      deptHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      deptHeader.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      const deptTableHeaders = ['Department', 'Planned', 'Completed', 'Overdue', 'Rate %'];
      deptTableHeaders.forEach((header, idx) => {
        const cell = worksheet.getCell(currentRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF93C5FD' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      Object.entries(deptStats).sort((a, b) => b[1].planned - a[1].planned).forEach(([dept, stats], idx) => {
        const rate = stats.planned > 0 ? Math.round((stats.completed / stats.planned) * 100) : 0;
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        const rateColor = rate >= 90 ? 'FF16A34A' : rate >= 70 ? 'FF9A3412' : rate >= 50 ? 'FFDC2626' : 'FFDC2626';
        const rateBgColor = rate >= 90 ? 'FFD1FAE5' : rate >= 70 ? 'FFFEF9C3' : rate >= 50 ? 'FFFED7AA' : 'FFFEE2E2';
        
        [dept, stats.planned, stats.completed, stats.overdue, `${rate}%`].forEach((val, colIdx) => {
          const cell = worksheet.getCell(currentRow, colIdx + 1);
          cell.value = val;
          cell.font = { size: 10, name: 'Arial', color: { argb: colIdx === 4 ? rateColor : (colIdx === 3 && stats.overdue > 10 ? 'FFDC2626' : 'FF2C3E50') }, bold: colIdx === 3 && stats.overdue > 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colIdx === 4 ? rateBgColor : bgColor } };
          cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'center', vertical: 'middle' };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
          };
        });
        currentRow++;
      });
      currentRow += 2;
      
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      const freqHeader = worksheet.getCell(`A${currentRow}`);
      freqHeader.value = 'FREQUENCY ANALYSIS';
      freqHeader.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
      freqHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      freqHeader.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      const freqTableHeaders = ['Frequency', 'Count', 'Completed', 'Completion %'];
      freqTableHeaders.forEach((header, idx) => {
        const cell = worksheet.getCell(currentRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF93C5FD' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      Object.entries(freqStats).filter(([_, stats]) => stats.count > 0).forEach(([freq, stats], idx) => {
        const rate = stats.count > 0 ? Math.round((stats.completed / stats.count) * 100) : 0;
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        const rateColor = rate >= 90 ? 'FF16A34A' : rate >= 70 ? 'FF9A3412' : rate >= 50 ? 'FFDC2626' : 'FFDC2626';
        const rateBgColor = rate >= 90 ? 'FFD1FAE5' : rate >= 70 ? 'FFFEF9C3' : rate >= 50 ? 'FFFED7AA' : 'FFFEE2E2';
        
        [freq, stats.count, stats.completed, `${rate}%`].forEach((val, colIdx) => {
          const cell = worksheet.getCell(currentRow, colIdx + 1);
          cell.value = val;
          cell.font = { size: 10, name: 'Arial', color: { argb: colIdx === 3 ? rateColor : 'FF2C3E50' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colIdx === 3 ? rateBgColor : bgColor } };
          cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'center', vertical: 'middle' };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
          };
        });
        currentRow++;
      });
      currentRow += 2;
      
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const mhHeader = worksheet.getCell(`A${currentRow}`);
      mhHeader.value = 'MAN-HOURS SUMMARY';
      mhHeader.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
      mhHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      mhHeader.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      ['Metric', 'Value'].forEach((header, idx) => {
        const cell = worksheet.getCell(currentRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF93C5FD' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      const avgHoursPerJob = totalCompleted > 0 ? (totalManHours / totalCompleted).toFixed(1) : '0';
      const mhData = [
        { metric: 'Total Man-Hours Used', value: totalManHours.toFixed(1) },
        { metric: 'Average per Job', value: avgHoursPerJob },
        ...Object.entries(manHoursByDept).map(([dept, hours]) => ({ metric: `By ${dept}`, value: hours.toFixed(1) }))
      ];
      
      mhData.forEach((row, idx) => {
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        [row.metric, row.value].forEach((val, colIdx) => {
          const cell = worksheet.getCell(currentRow, colIdx + 1);
          cell.value = val;
          cell.font = { size: 10, name: 'Arial', color: { argb: 'FF2C3E50' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'center', vertical: 'middle' };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
          };
        });
        currentRow++;
      });
      currentRow += 2;
      
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      const critHeader = worksheet.getCell(`A${currentRow}`);
      critHeader.value = 'CRITICAL EQUIPMENT STATUS';
      critHeader.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
      critHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      critHeader.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      ['Type', 'Total', 'Completed', 'Overdue'].forEach((header, idx) => {
        const cell = worksheet.getCell(currentRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF93C5FD' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { 
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      const critData = [
        { type: 'SOLAS Critical', ...criticalEquipStats.solas },
        { type: 'Class Critical', ...criticalEquipStats.classCritical },
        { type: 'High Priority', ...criticalEquipStats.highPriority }
      ];
      
      critData.forEach((row, idx) => {
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        [row.type, row.total, row.completed, row.overdue].forEach((val, colIdx) => {
          const cell = worksheet.getCell(currentRow, colIdx + 1);
          cell.value = val;
          cell.font = { size: 10, name: 'Arial', color: { argb: colIdx === 3 && row.overdue > 0 ? 'FFDC2626' : 'FF2C3E50' }, bold: colIdx === 3 && row.overdue > 0 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'center', vertical: 'middle' };
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
            right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
          };
        });
        currentRow++;
      });
      
      worksheet.pageSetup = {
        orientation: 'portrait',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
      };
      
      worksheet.headerFooter = {
        oddFooter: `&L&8&"Arial"Confidential - ${vesselName}&C&8&"Arial"Page &P of &N&R&8&"Arial"Generated: &D &T`
      };
      
      const buffer = await workbook.xlsx.writeBuffer();
      const safeVesselName = vesselName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `PMS_MonthlySummary_${safeVesselName}_${periodStart.getFullYear()}${(periodStart.getMonth()+1).toString().padStart(2,'0')}.xlsx`;
      
      console.log(`[MONTHLY SUMMARY REPORT] Generated: ${filename} (Period: ${reportPeriod})`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Monthly Maintenance Summary report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 1.8: CREW WORKLOAD DISTRIBUTION
  // Analysis of task distribution across crew ranks and assignments
  // Two view modes: summary (aggregated by rank) and detailed (job-level)
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/technical/api/reports/crew-workload-distribution", async (req, res) => {
    try {
      const { vesselId, startDate, endDate, rank, department, viewType } = req.query;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }

      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || String(vesselId);
      
      const workOrders = await storage.getWorkOrders(String(vesselId));
      const components = await storage.getComponents(String(vesselId));
      const componentsMap = new Map(components.map(c => [c.id, c]));
      
      // Parse date helper
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };
      
      const startDateObj = startDate ? new Date(String(startDate)) : null;
      const endDateObj = endDate ? new Date(String(endDate)) : null;
      if (startDateObj) startDateObj.setHours(0, 0, 0, 0);
      if (endDateObj) endDateObj.setHours(23, 59, 59, 999);
      
      // Filter work orders
      let filteredWOs = workOrders.filter((wo: any) => {
        // Date range filter using createdAt
        if (startDateObj || endDateObj) {
          const createdDate = parseDate(wo.createdAt);
          if (createdDate) {
            if (startDateObj && createdDate < startDateObj) return false;
            if (endDateObj && createdDate > endDateObj) return false;
          }
        }
        
        // Rank filter
        if (rank && rank !== 'All Ranks' && rank !== 'all') {
          if (wo.assignedTo !== rank && wo.performedBy !== rank) return false;
        }
        
        // Department filter
        if (department && department !== 'All' && department !== 'all') {
          if (wo.department !== department) return false;
        }
        
        return true;
      });
      
      if (viewType === 'detailed') {
        // Detailed view - job-level details
        const detailedData = filteredWOs.map((wo: any) => {
          const comp = componentsMap.get(wo.componentId);
          const isCritical = wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true;
          const isClassRelated = wo.classRelated === 'Yes' || comp?.classRelated === 'Yes';
          
          return {
            id: wo.id,
            workOrderNo: wo.workOrderNo || wo.id,
            jobTitle: wo.jobTitle || '-',
            componentName: wo.component || comp?.name || '-',
            componentCode: wo.componentCode || comp?.componentCode || '-',
            assignedTo: wo.assignedTo || 'Unassigned',
            performedBy: wo.performedBy || '-',
            department: wo.department || '-',
            jobPriority: wo.jobPriority || 'Normal',
            status: wo.status || '-',
            taskType: wo.taskType || wo.workOrderType || '-',
            dueDate: wo.dueDate || null,
            completionDate: wo.dateCompleted || wo.completionDateTime || null,
            teamSize: wo.noOfPersonsInTeam ? Number(wo.noOfPersonsInTeam) : null,
            timeTakenHours: wo.totalTimeHours ? Number(wo.totalTimeHours) : null,
            manhours: wo.manhours ? Number(wo.manhours) : null,
            critical: isCritical,
            classRelated: isClassRelated
          };
        });
        
        res.json({
          success: true,
          data: detailedData,
          view: 'detailed',
          vesselName,
          totalRecords: detailedData.length
        });
        
      } else {
        // Summary view - aggregated by rank (assignedTo only)
        const rankStats: Record<string, {
          rank: string;
          departments: Set<string>;
          totalJobsAssigned: number;
          jobsCompleted: number;
          jobsPending: number;
          jobsOverdue: number;
          criticalJobs: number;
          highPriorityJobs: number;
          totalManhours: number;
          totalTimeTaken: number;
          jobsWithTime: number;
        }> = {};
        
        const now = new Date();
        
        filteredWOs.forEach((wo: any) => {
          const assignee = wo.assignedTo || 'Unassigned';
          const dept = wo.department || 'N/A';
          
          if (!rankStats[assignee]) {
            rankStats[assignee] = {
              rank: assignee,
              departments: new Set(),
              totalJobsAssigned: 0,
              jobsCompleted: 0,
              jobsPending: 0,
              jobsOverdue: 0,
              criticalJobs: 0,
              highPriorityJobs: 0,
              totalManhours: 0,
              totalTimeTaken: 0,
              jobsWithTime: 0
            };
          }
          
          rankStats[assignee].departments.add(dept);
          const stats = rankStats[assignee];
          stats.totalJobsAssigned++;
          
          if (wo.status === 'Completed') {
            stats.jobsCompleted++;
          } else if (wo.status === 'Overdue' || (wo.dueDate && parseDate(wo.dueDate)! < now && wo.status !== 'Completed')) {
            stats.jobsOverdue++;
          } else if (['Planned', 'Active', 'In Progress'].includes(wo.status)) {
            stats.jobsPending++;
          }
          
          if (wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true) {
            stats.criticalJobs++;
          }
          
          if (wo.jobPriority === 'High') {
            stats.highPriorityJobs++;
          }
          
          if (wo.manhours) {
            stats.totalManhours += Number(wo.manhours) || 0;
          }
          
          if (wo.totalTimeHours) {
            stats.totalTimeTaken += Number(wo.totalTimeHours) || 0;
            stats.jobsWithTime++;
          }
        });
        
        // Calculate totals for workload percentage
        const totalManhours = Object.values(rankStats).reduce((sum, s) => sum + s.totalManhours, 0);
        
        const summaryData = Object.values(rankStats).map(stats => ({
          rank: stats.rank,
          department: Array.from(stats.departments).join(', '),
          totalJobsAssigned: stats.totalJobsAssigned,
          jobsCompleted: stats.jobsCompleted,
          jobsPending: stats.jobsPending,
          jobsOverdue: stats.jobsOverdue,
          criticalJobs: stats.criticalJobs,
          highPriorityJobs: stats.highPriorityJobs,
          totalManhours: Math.round(stats.totalManhours * 100) / 100,
          avgTimePerJob: stats.jobsWithTime > 0 
            ? Math.round((stats.totalTimeTaken / stats.jobsWithTime) * 100) / 100 
            : 0,
          completionRate: stats.totalJobsAssigned > 0 
            ? Math.round((stats.jobsCompleted / stats.totalJobsAssigned) * 100 * 100) / 100 
            : 0,
          workloadPercentage: totalManhours > 0 
            ? Math.round((stats.totalManhours / totalManhours) * 100 * 100) / 100 
            : 0
        }));
        
        // Sort by total manhours descending
        summaryData.sort((a, b) => b.totalManhours - a.totalManhours);
        
        res.json({
          success: true,
          data: summaryData,
          view: 'summary',
          vesselName,
          totalRecords: summaryData.length,
          totalManhours: Math.round(totalManhours * 100) / 100
        });
      }
      
    } catch (error: any) {
      console.error("Error fetching crew workload distribution:", error);
      res.status(500).json({ error: "Failed to fetch crew workload distribution: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 1.8: CREW WORKLOAD DISTRIBUTION - EXCEL EXPORT
  // Professional Excel export with both summary and detailed views
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/crew-workload-distribution/excel", async (req, res) => {
    try {
      const { vesselId, startDate, endDate, rank, department, viewType = 'summary' } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }

      const allVessels = await storage.getVessels();
      const vessel = allVessels.find(v => v.id === vesselId);
      const vesselName = vessel?.name || vesselId;
      
      const workOrders = await storage.getWorkOrders(vesselId);
      const components = await storage.getComponents(vesselId);
      const componentsMap = new Map(components.map(c => [c.id, c]));
      
      // Parse date helper
      const parseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };
      
      const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
        if (!dateVal) return '-';
        try {
          const dateStr = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '-';
          const day = d.getDate().toString().padStart(2, '0');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
        } catch {
          return '-';
        }
      };
      
      const startDateObj = startDate ? new Date(startDate) : null;
      const endDateObj = endDate ? new Date(endDate) : null;
      if (startDateObj) startDateObj.setHours(0, 0, 0, 0);
      if (endDateObj) endDateObj.setHours(23, 59, 59, 999);
      
      // Filter work orders
      let filteredWOs = workOrders.filter((wo: any) => {
        if (startDateObj || endDateObj) {
          const createdDate = parseDate(wo.createdAt);
          if (createdDate) {
            if (startDateObj && createdDate < startDateObj) return false;
            if (endDateObj && createdDate > endDateObj) return false;
          }
        }
        
        if (rank && rank !== 'All Ranks' && rank !== 'all') {
          if (wo.assignedTo !== rank && wo.performedBy !== rank) return false;
        }
        
        if (department && department !== 'All' && department !== 'all') {
          if (wo.department !== department) return false;
        }
        
        return true;
      });
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const isDetailedView = viewType === 'detailed';
      const sheetName = isDetailedView ? 'Crew Workload Detailed' : 'Crew Workload Summary';
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 7, xSplit: 0 }]
      });
      
      const periodStr = startDate && endDate 
        ? `${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}`
        : 'All Time';
      
      if (isDetailedView) {
        // Detailed view columns (18 columns - landscape)
        const columns: ColumnDef[] = [
          { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
          { key: 'workOrderNo', header: 'Work Order No', width: 16, type: 'text' },
          { key: 'componentCode', header: 'Comp Code', width: 12, type: 'text' },
          { key: 'componentName', header: 'Component Name', width: 25, type: 'text' },
          { key: 'jobTitle', header: 'Job Title', width: 30, type: 'text' },
          { key: 'assignedTo', header: 'Assigned To', width: 15, type: 'text' },
          { key: 'performedBy', header: 'Performed By', width: 15, type: 'text' },
          { key: 'department', header: 'Dept', width: 10, type: 'text', align: 'center' },
          { key: 'taskType', header: 'Task Type', width: 12, type: 'text' },
          { key: 'teamSize', header: 'Team Size', width: 10, type: 'number', align: 'center' },
          { key: 'timeTakenHours', header: 'Time (hrs)', width: 10, type: 'number', align: 'right' },
          { key: 'manhours', header: 'Manhours', width: 10, type: 'number', align: 'right' },
          { key: 'status', header: 'Status', width: 12, type: 'text', align: 'center' },
          { key: 'jobPriority', header: 'Priority', width: 10, type: 'text', align: 'center' },
          { key: 'dueDate', header: 'Due Date', width: 12, type: 'date', align: 'center' },
          { key: 'completionDate', header: 'Completion Date', width: 12, type: 'date', align: 'center' },
          { key: 'critical', header: 'Critical', width: 8, type: 'text', align: 'center' },
          { key: 'classRelated', header: 'Class Related', width: 10, type: 'text', align: 'center' }
        ];
        
        const lastColLetter = getLastColumnLetter(columns.length);
        
        // Apply header
        applyStandardHeader(
          worksheet,
          'CREW WORKLOAD DISTRIBUTION REPORT - DETAILED VIEW',
          `Analysis of task distribution across crew ranks (${periodStr})`,
          vesselName,
          filteredWOs.length,
          lastColLetter,
          periodStr
        );
        
        // Apply table header at row 7
        applyStandardTableHeader(worksheet, columns, 7);
        
        // Build data rows
        const reportData = filteredWOs.map((wo: any, index: number) => {
          const comp = componentsMap.get(wo.componentId);
          const isCritical = wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true;
          const isClassRelated = wo.classRelated === 'Yes' || comp?.classRelated === 'Yes';
          
          return {
            sNo: index + 1,
            workOrderNo: wo.workOrderNo || wo.id || '-',
            componentCode: wo.componentCode || comp?.componentCode || '-',
            componentName: wo.component || comp?.name || '-',
            jobTitle: wo.jobTitle || '-',
            assignedTo: wo.assignedTo || 'Unassigned',
            performedBy: wo.performedBy || '-',
            department: wo.department || '-',
            taskType: wo.taskType || wo.workOrderType || '-',
            teamSize: wo.noOfPersonsInTeam ? Number(wo.noOfPersonsInTeam) : '-',
            timeTakenHours: wo.totalTimeHours ? Number(wo.totalTimeHours).toFixed(1) : '-',
            manhours: wo.manhours ? Number(wo.manhours).toFixed(1) : '-',
            status: wo.status || '-',
            jobPriority: wo.jobPriority || 'Normal',
            dueDate: formatDateDisplay(wo.dueDate),
            completionDate: formatDateDisplay(wo.dateCompleted || wo.completionDateTime),
            critical: isCritical ? 'Yes' : 'No',
            classRelated: isClassRelated ? 'Yes' : 'No'
          };
        });
        
        // Apply data rows
        applyStandardDataRows(worksheet, reportData, columns, 8);
        
        // Apply page setup
        applyStandardPageSetup(worksheet, 7, columns.length, 8 + reportData.length, vesselName);
        
        // Set landscape for detailed view
        worksheet.pageSetup.orientation = 'landscape';
        
      } else {
        // Summary view columns (13 columns - portrait)
        const columns: ColumnDef[] = [
          { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
          { key: 'rank', header: 'Rank', width: 18, type: 'text' },
          { key: 'department', header: 'Dept', width: 10, type: 'text', align: 'center' },
          { key: 'totalJobsAssigned', header: 'Total Jobs', width: 10, type: 'number', align: 'center' },
          { key: 'jobsCompleted', header: 'Completed', width: 10, type: 'number', align: 'center' },
          { key: 'jobsPending', header: 'Pending', width: 10, type: 'number', align: 'center' },
          { key: 'jobsOverdue', header: 'Overdue', width: 10, type: 'number', align: 'center' },
          { key: 'criticalJobs', header: 'Critical', width: 10, type: 'number', align: 'center' },
          { key: 'highPriorityJobs', header: 'High Priority', width: 10, type: 'number', align: 'center' },
          { key: 'totalManhours', header: 'Manhours', width: 12, type: 'number', align: 'right' },
          { key: 'avgTimePerJob', header: 'Avg Time', width: 10, type: 'number', align: 'right' },
          { key: 'completionRate', header: 'Completion %', width: 12, type: 'number', align: 'right' },
          { key: 'workloadPercentage', header: 'Workload %', width: 12, type: 'number', align: 'right' }
        ];
        
        const lastColLetter = getLastColumnLetter(columns.length);
        
        // Build summary data - aggregated by rank (assignedTo only)
        const now = new Date();
        const rankStats: Record<string, {
          rank: string;
          departments: Set<string>;
          totalJobsAssigned: number;
          jobsCompleted: number;
          jobsPending: number;
          jobsOverdue: number;
          criticalJobs: number;
          highPriorityJobs: number;
          totalManhours: number;
          totalTimeTaken: number;
          jobsWithTime: number;
        }> = {};
        
        filteredWOs.forEach((wo: any) => {
          const assignee = wo.assignedTo || 'Unassigned';
          const dept = wo.department || 'N/A';
          
          if (!rankStats[assignee]) {
            rankStats[assignee] = {
              rank: assignee,
              departments: new Set(),
              totalJobsAssigned: 0,
              jobsCompleted: 0,
              jobsPending: 0,
              jobsOverdue: 0,
              criticalJobs: 0,
              highPriorityJobs: 0,
              totalManhours: 0,
              totalTimeTaken: 0,
              jobsWithTime: 0
            };
          }
          
          rankStats[assignee].departments.add(dept);
          const stats = rankStats[assignee];
          stats.totalJobsAssigned++;
          
          if (wo.status === 'Completed') {
            stats.jobsCompleted++;
          } else if (wo.status === 'Overdue' || (wo.dueDate && parseDate(wo.dueDate)! < now && wo.status !== 'Completed')) {
            stats.jobsOverdue++;
          } else if (['Planned', 'Active', 'In Progress'].includes(wo.status)) {
            stats.jobsPending++;
          }
          
          if (wo.criticality === 'Yes' || wo.criticality === 'Critical' || wo.critical === true) {
            stats.criticalJobs++;
          }
          
          if (wo.jobPriority === 'High') {
            stats.highPriorityJobs++;
          }
          
          if (wo.manhours) {
            stats.totalManhours += Number(wo.manhours) || 0;
          }
          
          if (wo.totalTimeHours) {
            stats.totalTimeTaken += Number(wo.totalTimeHours) || 0;
            stats.jobsWithTime++;
          }
        });
        
        const totalManhours = Object.values(rankStats).reduce((sum, s) => sum + s.totalManhours, 0);
        
        const summaryData = Object.values(rankStats).map((stats, index) => ({
          sNo: index + 1,
          rank: stats.rank,
          department: Array.from(stats.departments).join(', '),
          totalJobsAssigned: stats.totalJobsAssigned,
          jobsCompleted: stats.jobsCompleted,
          jobsPending: stats.jobsPending,
          jobsOverdue: stats.jobsOverdue,
          criticalJobs: stats.criticalJobs,
          highPriorityJobs: stats.highPriorityJobs,
          totalManhours: stats.totalManhours.toFixed(1),
          avgTimePerJob: stats.jobsWithTime > 0 
            ? (stats.totalTimeTaken / stats.jobsWithTime).toFixed(1) 
            : '0.0',
          completionRate: stats.totalJobsAssigned > 0 
            ? ((stats.jobsCompleted / stats.totalJobsAssigned) * 100).toFixed(1) + '%'
            : '0.0%',
          workloadPercentage: totalManhours > 0 
            ? ((stats.totalManhours / totalManhours) * 100).toFixed(1) + '%'
            : '0.0%'
        }));
        
        // Sort by manhours descending
        summaryData.sort((a, b) => parseFloat(b.totalManhours) - parseFloat(a.totalManhours));
        
        // Re-number after sorting
        summaryData.forEach((row, idx) => { row.sNo = idx + 1; });
        
        // Apply header
        applyStandardHeader(
          worksheet,
          'CREW WORKLOAD DISTRIBUTION REPORT - SUMMARY VIEW',
          `Analysis of task distribution by rank (${periodStr})`,
          vesselName,
          summaryData.length,
          lastColLetter,
          periodStr
        );
        
        // Apply table header at row 7
        applyStandardTableHeader(worksheet, columns, 7);
        
        // Apply data rows
        applyStandardDataRows(worksheet, summaryData, columns, 8);
        
        // Add totals row
        const totalsRow = 8 + summaryData.length;
        const totalJobs = Object.values(rankStats).reduce((sum, s) => sum + s.totalJobsAssigned, 0);
        const totalCompleted = Object.values(rankStats).reduce((sum, s) => sum + s.jobsCompleted, 0);
        const totalOverdue = Object.values(rankStats).reduce((sum, s) => sum + s.jobsOverdue, 0);
        
        worksheet.getCell(`A${totalsRow}`).value = '';
        worksheet.getCell(`B${totalsRow}`).value = 'TOTALS:';
        worksheet.getCell(`B${totalsRow}`).font = { bold: true, size: 10 };
        worksheet.getCell(`D${totalsRow}`).value = totalJobs;
        worksheet.getCell(`D${totalsRow}`).font = { bold: true };
        worksheet.getCell(`E${totalsRow}`).value = totalCompleted;
        worksheet.getCell(`E${totalsRow}`).font = { bold: true };
        worksheet.getCell(`G${totalsRow}`).value = totalOverdue;
        worksheet.getCell(`G${totalsRow}`).font = { bold: true, color: { argb: 'FFDC2626' } };
        worksheet.getCell(`J${totalsRow}`).value = totalManhours.toFixed(1);
        worksheet.getCell(`J${totalsRow}`).font = { bold: true };
        
        // Apply page setup
        applyStandardPageSetup(worksheet, 7, columns.length, totalsRow, vesselName);
        
        // Portrait for summary view
        worksheet.pageSetup.orientation = 'portrait';
      }
      
      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const viewSuffix = isDetailedView ? 'Detailed' : 'Summary';
      const filename = `Crew_Workload_Distribution_${viewSuffix}_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;
      
      console.log(`[CREW WORKLOAD REPORT] Generated: ${filename} (View: ${viewType})`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Crew Workload Distribution Excel report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 1.9: EQUIPMENT UTILIZATION SUMMARY
  // Analyzes running hours to calculate equipment utilization metrics
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/technical/api/reports/equipment-utilization-summary", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const category = req.query.category as string;
      const department = req.query.department as string;
      
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      
      // Get vessel name
      const vessels = await storage.getVessels();
      const vessel = vessels.find(v => v.id === vesselId || v.vesselCode === vesselId);
      const vesselName = vessel?.name || vessel?.vesselName || vesselId;
      
      // Get all components for the vessel that have running hours tracking
      const allComponents = await storage.getComponents(vesselId);
      // Filter components that have RH tracking (allow zero hours, just check RH type)
      let rhComponents = allComponents.filter(c => 
        c.isActive !== false && 
        c.rhCounterType && 
        c.rhCounterType !== 'Not RH Driven' &&
        c.rhCounterType !== 'NOT_RH_DRIVEN'
      );
      
      // Apply category filter
      if (category && category !== 'All' && category !== 'all') {
        rhComponents = rhComponents.filter(c => 
          c.componentCategory === category || c.category === category
        );
      }
      
      // Apply department filter
      if (department && department !== 'All' && department !== 'all') {
        rhComponents = rhComponents.filter(c => 
          c.department === department || c.eqptSystemDept === department
        );
      }
      
      // Get vessel code for querying logs (may be different from vesselId)
      const vesselCode = vessel?.vesselCode || vesselId;
      
      // Get database instance
      const db = await getDb();
      
      // Get running hours log for the period - query by both vesselId and vesselCode
      const rhLogs = await db.select().from(componentRunningHoursLog)
        .where(sql`${componentRunningHoursLog.vesselCode} = ${vesselCode} OR ${componentRunningHoursLog.vesselCode} = ${vesselId}`);
      
      console.log(`[UTILIZATION] Vessel: ${vesselId}, VesselCode: ${vesselCode}, Components: ${rhComponents.length}, RH Logs found: ${rhLogs.length}`);
      
      // Parse dates
      const parseDate = (dateVal: string | Date | null | undefined): Date | null => {
        if (!dateVal) return null;
        try {
          const d = new Date(dateVal instanceof Date ? dateVal : dateVal);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };
      
      const now = new Date();
      const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const periodStart = startDate ? parseDate(startDate) : defaultStartDate;
      const periodEnd = endDate ? parseDate(endDate) : now;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const daysInPeriod = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Build utilization data for each component
      const utilizationData = rhComponents.map((component, index) => {
        // Get RH logs for this component in the period
        const componentLogs = rhLogs.filter(log => 
          (log.componentCode === component.componentCode || log.componentId === component.id) &&
          log.updatedAt && 
          new Date(log.updatedAt) >= periodStart &&
          new Date(log.updatedAt) <= periodEnd
        ).sort((a, b) => new Date(a.updatedAt!).getTime() - new Date(b.updatedAt!).getTime());
        
        // Get current and baseline running hours separately
        // running_hours is the baseline (initial reading)
        // current_cumulative_rh is the true current meter reading
        const currentCumulativeReading = component.currentCumulativeRH !== null && component.currentCumulativeRH !== undefined
          ? Number(component.currentCumulativeRH)
          : null;
        const baselineHours = component.runningHours !== null && component.runningHours !== undefined 
          ? Number(component.runningHours) 
          : null;
        
        // For display purposes, show the best available current reading
        const displayCurrentHours = currentCumulativeReading ?? baselineHours ?? 0;
        
        // Calculate period hours from delta accumulation or from component data
        // Priority: 1) Log data 2) Baseline delta 3) Estimate from current cumulative (capped)
        let periodHours = 0;
        let dataSource: 'Actual' | 'Estimated' | 'Estimated (capped)' | 'No Data' = 'No Data';
        
        // Maximum possible hours in the period (physical limit: 24 hrs/day)
        const maxPossibleHours = daysInPeriod * 24;
        // Reasonable cap for estimation: 80% utilization (typical for continuously running equipment)
        const cappedEstimateHours = Math.floor(maxPossibleHours * 0.80);
        
        if (componentLogs.length > 0) {
          // Use log data if available - sum up all delta changes in the period
          periodHours = componentLogs.reduce((sum, log) => {
            const delta = Number(log.deltaRh) || 0;
            return sum + Math.max(0, delta); // Only positive deltas (ignore corrections)
          }, 0);
          dataSource = 'Actual';
        } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading > baselineHours) {
          // We have BOTH baseline AND current reading - calculate actual delta
          periodHours = currentCumulativeReading - baselineHours;
          dataSource = 'Actual';
        } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading === baselineHours) {
          // Baseline equals current - no usage in this period
          periodHours = 0;
          dataSource = 'Actual';
        } else if (baselineHours === null && currentCumulativeReading !== null && currentCumulativeReading > 0) {
          // No baseline but have a current reading - use as estimate with cap
          // Current hours is total cumulative since installation, NOT period hours
          // If it exceeds max possible for the period, cap at 80% utilization
          if (currentCumulativeReading <= maxPossibleHours) {
            // Current hours fits within period - use as-is (reasonable estimate)
            periodHours = currentCumulativeReading;
            dataSource = 'Estimated';
          } else {
            // Current hours exceeds period max - cap at 80% utilization
            periodHours = cappedEstimateHours;
            dataSource = 'Estimated (capped)';
          }
        } else if (baselineHours !== null && currentCumulativeReading === null) {
          // Have baseline but no current reading - cannot calculate period hours
          periodHours = 0;
          dataSource = 'No Data';
        }
        // else: No data at all, periodHours stays 0 and dataSource stays 'No Data'
        
        const avgDailyHours = periodHours / daysInPeriod;
        
        // Determine utilization band - spec: >20 High, 10-20 Normal, <10 Low
        let utilizationBand: 'High' | 'Normal' | 'Low';
        if (avgDailyHours > 20) {
          utilizationBand = 'High';
        } else if (avgDailyHours >= 10) {
          utilizationBand = 'Normal';
        } else {
          utilizationBand = 'Low';
        }
        
        // Calculate utilization percentage (assuming 24 hrs/day max)
        // DO NOT cap at 100% - show actual values to expose data anomalies
        const ratedHoursPerDay = 24;
        const utilizationPercent = (avgDailyHours / ratedHoursPerDay) * 100;
        
        return {
          sNo: index + 1,
          componentCode: component.componentCode || component.id,
          componentName: component.name || component.fleetEquipmentName || 'Unnamed',
          category: component.componentCategory || component.category || '-',
          location: component.location || '-',
          department: component.department || component.eqptSystemDept || '-',
          currentHours: Math.round(displayCurrentHours * 100) / 100,
          periodHours: Math.round(periodHours * 100) / 100,
          avgDailyHours: Math.round(avgDailyHours * 100) / 100,
          utilizationBand,
          utilizationPercent: Math.round(utilizationPercent * 10) / 10,
          lastUpdated: component.lastUpdated || null,
          readingsCount: componentLogs.length,
          dataSource
        };
      });
      
      // Sort by utilization (High first, then by avgDailyHours descending)
      utilizationData.sort((a, b) => {
        const bandOrder = { 'High': 0, 'Normal': 1, 'Low': 2 };
        if (bandOrder[a.utilizationBand] !== bandOrder[b.utilizationBand]) {
          return bandOrder[a.utilizationBand] - bandOrder[b.utilizationBand];
        }
        return b.avgDailyHours - a.avgDailyHours;
      });
      
      // Re-number after sorting
      utilizationData.forEach((item, idx) => { item.sNo = idx + 1; });
      
      // Calculate summary with data source counts
      const summary = {
        totalEquipment: utilizationData.length,
        highUtilization: utilizationData.filter(d => d.utilizationBand === 'High').length,
        normalUtilization: utilizationData.filter(d => d.utilizationBand === 'Normal').length,
        lowUtilization: utilizationData.filter(d => d.utilizationBand === 'Low').length,
        avgUtilization: utilizationData.length > 0 
          ? Math.round((utilizationData.reduce((sum, d) => sum + d.utilizationPercent, 0) / utilizationData.length) * 10) / 10
          : 0,
        totalPeriodHours: Math.round(utilizationData.reduce((sum, d) => sum + d.periodHours, 0) * 100) / 100,
        periodDays: daysInPeriod,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        // Data source breakdown
        actualData: utilizationData.filter(d => d.dataSource === 'Actual').length,
        estimatedData: utilizationData.filter(d => d.dataSource === 'Estimated').length,
        estimatedCapped: utilizationData.filter(d => d.dataSource === 'Estimated (capped)').length,
        noData: utilizationData.filter(d => d.dataSource === 'No Data').length
      };
      
      res.json({
        success: true,
        data: utilizationData,
        summary,
        vesselName,
        totalRecords: utilizationData.length
      });
      
    } catch (error: any) {
      console.error("Error fetching equipment utilization summary:", error);
      res.status(500).json({ error: "Failed to fetch equipment utilization summary: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 1.9: EQUIPMENT UTILIZATION SUMMARY - EXCEL EXPORT
  // Professional Excel export with utilization metrics
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/equipment-utilization-summary/excel", async (req, res) => {
    try {
      const { vesselId, startDate, endDate, category, department } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Get vessel name
      const vessels = await storage.getVessels();
      const vessel = vessels.find(v => v.id === vesselId || v.vesselCode === vesselId);
      const vesselName = vessel?.name || vessel?.vesselName || vesselId;
      
      // Get all components for the vessel that have running hours tracking
      const allComponents = await storage.getComponents(vesselId);
      // Filter components that have RH tracking (allow zero hours, just check RH type)
      let rhComponents = allComponents.filter(c => 
        c.isActive !== false && 
        c.rhCounterType && 
        c.rhCounterType !== 'Not RH Driven' &&
        c.rhCounterType !== 'NOT_RH_DRIVEN'
      );
      
      // Apply category filter
      if (category && category !== 'All' && category !== 'all') {
        rhComponents = rhComponents.filter(c => 
          c.componentCategory === category || c.category === category
        );
      }
      
      // Apply department filter
      if (department && department !== 'All' && department !== 'all') {
        rhComponents = rhComponents.filter(c => 
          c.department === department || c.eqptSystemDept === department
        );
      }
      
      // Get vessel code for querying logs (may be different from vesselId)
      const vesselCode = vessel?.vesselCode || vesselId;
      
      // Get database instance
      const db = await getDb();
      
      // Get running hours log for the period - query by both vesselId and vesselCode
      const rhLogs = await db.select().from(componentRunningHoursLog)
        .where(sql`${componentRunningHoursLog.vesselCode} = ${vesselCode} OR ${componentRunningHoursLog.vesselCode} = ${vesselId}`);
      
      console.log(`[UTILIZATION EXCEL] Vessel: ${vesselId}, VesselCode: ${vesselCode}, Components: ${rhComponents.length}, RH Logs found: ${rhLogs.length}`);
      
      // Parse dates
      const parseDate = (dateVal: string | Date | null | undefined): Date | null => {
        if (!dateVal) return null;
        try {
          const d = new Date(dateVal instanceof Date ? dateVal : dateVal);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };
      
      const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
        if (!dateVal) return '-';
        try {
          const dateStr = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '-';
          const day = d.getDate().toString().padStart(2, '0');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
        } catch {
          return '-';
        }
      };
      
      const now = new Date();
      const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const periodStart = startDate ? parseDate(startDate) : defaultStartDate;
      const periodEnd = endDate ? parseDate(endDate) : now;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const daysInPeriod = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Build utilization data
      const utilizationData = rhComponents.map((component, index) => {
        const componentLogs = rhLogs.filter(log => 
          (log.componentCode === component.componentCode || log.componentId === component.id) &&
          log.updatedAt && 
          new Date(log.updatedAt) >= periodStart &&
          new Date(log.updatedAt) <= periodEnd
        ).sort((a, b) => new Date(a.updatedAt!).getTime() - new Date(b.updatedAt!).getTime());
        
        // Get current and baseline running hours separately
        // running_hours is the baseline (initial reading)
        // current_cumulative_rh is the true current meter reading
        const currentCumulativeReading = component.currentCumulativeRH !== null && component.currentCumulativeRH !== undefined
          ? Number(component.currentCumulativeRH)
          : null;
        const baselineHours = component.runningHours !== null && component.runningHours !== undefined 
          ? Number(component.runningHours) 
          : null;
        
        // For display purposes, show the best available current reading
        const displayCurrentHours = currentCumulativeReading ?? baselineHours ?? 0;
        
        // Calculate period hours from delta accumulation or from component data
        // Priority: 1) Log data 2) Baseline delta 3) Estimate from current cumulative (capped)
        let periodHours = 0;
        let dataSource: 'Actual' | 'Estimated' | 'Estimated (capped)' | 'No Data' = 'No Data';
        
        // Maximum possible hours in the period (physical limit: 24 hrs/day)
        const maxPossibleHours = daysInPeriod * 24;
        // Reasonable cap for estimation: 80% utilization (typical for continuously running equipment)
        const cappedEstimateHours = Math.floor(maxPossibleHours * 0.80);
        
        if (componentLogs.length > 0) {
          periodHours = componentLogs.reduce((sum, log) => {
            const delta = Number(log.deltaRh) || 0;
            return sum + Math.max(0, delta);
          }, 0);
          dataSource = 'Actual';
        } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading > baselineHours) {
          // We have BOTH baseline AND current reading - calculate actual delta
          periodHours = currentCumulativeReading - baselineHours;
          dataSource = 'Actual';
        } else if (baselineHours !== null && currentCumulativeReading !== null && currentCumulativeReading === baselineHours) {
          // Baseline equals current - no usage in this period
          periodHours = 0;
          dataSource = 'Actual';
        } else if (baselineHours === null && currentCumulativeReading !== null && currentCumulativeReading > 0) {
          // No baseline but have a current reading - use as estimate with cap
          // Current hours is total cumulative since installation, NOT period hours
          // If it exceeds max possible for the period, cap at 80% utilization
          if (currentCumulativeReading <= maxPossibleHours) {
            // Current hours fits within period - use as-is (reasonable estimate)
            periodHours = currentCumulativeReading;
            dataSource = 'Estimated';
          } else {
            // Current hours exceeds period max - cap at 80% utilization
            periodHours = cappedEstimateHours;
            dataSource = 'Estimated (capped)';
          }
        } else if (baselineHours !== null && currentCumulativeReading === null) {
          // Have baseline but no current reading - cannot calculate period hours
          periodHours = 0;
          dataSource = 'No Data';
        }
        // else: No data at all, periodHours stays 0 and dataSource stays 'No Data'
        
        const avgDailyHours = periodHours / daysInPeriod;
        
        // Determine utilization band - spec: >20 High, 10-20 Normal, <10 Low
        let utilizationBand: 'High' | 'Normal' | 'Low';
        if (avgDailyHours > 20) {
          utilizationBand = 'High';
        } else if (avgDailyHours >= 10) {
          utilizationBand = 'Normal';
        } else {
          utilizationBand = 'Low';
        }
        
        // DO NOT cap at 100% - show actual values to expose data anomalies
        const utilizationPercent = (avgDailyHours / 24) * 100;
        
        return {
          componentCode: component.componentCode || component.id,
          componentName: component.name || component.fleetEquipmentName || 'Unnamed',
          category: component.componentCategory || component.category || '-',
          location: component.location || '-',
          department: component.department || component.eqptSystemDept || '-',
          currentHours: Math.round(displayCurrentHours * 100) / 100,
          periodHours: Math.round(periodHours * 100) / 100,
          avgDailyHours: Math.round(avgDailyHours * 100) / 100,
          utilizationBand,
          utilizationPercent: Math.round(utilizationPercent * 10) / 10,
          lastUpdated: formatDateDisplay(component.lastUpdated),
          readingsCount: componentLogs.length,
          dataSource
        };
      });
      
      // Sort by utilization band and avgDailyHours
      utilizationData.sort((a, b) => {
        const bandOrder = { 'High': 0, 'Normal': 1, 'Low': 2 };
        if (bandOrder[a.utilizationBand] !== bandOrder[b.utilizationBand]) {
          return bandOrder[a.utilizationBand] - bandOrder[b.utilizationBand];
        }
        return b.avgDailyHours - a.avgDailyHours;
      });
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PMS System';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Equipment Utilization', {
        views: [{ state: 'frozen', ySplit: 7, xSplit: 0 }]
      });
      
      // Define columns - includes Data Source to show calculation method
      const columns: ColumnDef[] = [
        { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
        { key: 'componentCode', header: 'Comp Code', width: 14, type: 'text' },
        { key: 'componentName', header: 'Component Name', width: 30, type: 'text' },
        { key: 'category', header: 'Category', width: 18, type: 'text' },
        { key: 'location', header: 'Location', width: 15, type: 'text' },
        { key: 'department', header: 'Dept', width: 12, type: 'text', align: 'center' },
        { key: 'currentHours', header: 'Current Hrs', width: 12, type: 'number', align: 'right' },
        { key: 'periodHours', header: 'Period Hrs', width: 12, type: 'number', align: 'right' },
        { key: 'avgDailyHours', header: 'Avg Daily Hrs', width: 12, type: 'number', align: 'right' },
        { key: 'utilizationBand', header: 'Utilization', width: 12, type: 'text', align: 'center' },
        { key: 'utilizationPercent', header: 'Util %', width: 10, type: 'number', align: 'right' },
        { key: 'dataSource', header: 'Data Source', width: 12, type: 'text', align: 'center' },
        { key: 'lastUpdated', header: 'Last Updated', width: 14, type: 'date', align: 'center' }
      ];
      
      const lastColLetter = getLastColumnLetter(columns.length);
      
      const periodStr = `${formatDateDisplay(periodStart)} to ${formatDateDisplay(periodEnd)}`;
      
      // Apply standard header
      applyStandardHeader(
        worksheet,
        'EQUIPMENT UTILIZATION SUMMARY REPORT',
        `Running hours analysis for ${daysInPeriod} days (${periodStr})`,
        vesselName,
        utilizationData.length,
        lastColLetter,
        periodStr
      );
      
      // Apply table header at row 7
      applyStandardTableHeader(worksheet, columns, 7);
      
      // Build report data with sNo
      const reportData = utilizationData.map((item, index) => ({
        sNo: index + 1,
        ...item
      }));
      
      // Apply data rows
      applyStandardDataRows(worksheet, reportData, columns, 8);
      
      // Apply color coding for utilization bands
      for (let i = 0; i < reportData.length; i++) {
        const rowNum = 8 + i;
        const row = reportData[i];
        const bandCell = worksheet.getCell(`J${rowNum}`);
        
        if (row.utilizationBand === 'High') {
          bandCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEE2E2' } // Light red
          };
          bandCell.font = { color: { argb: 'FFDC2626' }, bold: true };
        } else if (row.utilizationBand === 'Normal') {
          bandCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDCFCE7' } // Light green
          };
          bandCell.font = { color: { argb: 'FF16A34A' }, bold: true };
        } else {
          bandCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF3C7' } // Light yellow
          };
          bandCell.font = { color: { argb: 'FFD97706' }, bold: true };
        }
      }
      
      // Add summary row
      const summaryRow = 8 + reportData.length + 1;
      const highCount = reportData.filter(r => r.utilizationBand === 'High').length;
      const normalCount = reportData.filter(r => r.utilizationBand === 'Normal').length;
      const lowCount = reportData.filter(r => r.utilizationBand === 'Low').length;
      const avgUtil = reportData.length > 0 
        ? (reportData.reduce((sum, r) => sum + r.utilizationPercent, 0) / reportData.length).toFixed(1)
        : '0';
      
      // Count data sources
      const actualCount = reportData.filter(r => r.dataSource === 'Actual').length;
      const estimatedCount = reportData.filter(r => r.dataSource === 'Estimated').length;
      const estimatedCappedCount = reportData.filter(r => r.dataSource === 'Estimated (capped)').length;
      const noDataCount = reportData.filter(r => r.dataSource === 'No Data').length;
      
      worksheet.mergeCells(`A${summaryRow}:${lastColLetter}${summaryRow}`);
      worksheet.getCell(`A${summaryRow}`).value = 
        `Summary: Total ${reportData.length} equipment | High: ${highCount} | Normal: ${normalCount} | Low: ${lowCount} | Avg Utilization: ${avgUtil}% | Data: ${actualCount} Actual, ${estimatedCount} Estimated, ${estimatedCappedCount} Capped, ${noDataCount} No Data`;
      worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 10 };
      worksheet.getCell(`A${summaryRow}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      };
      
      // Apply page setup
      applyStandardPageSetup(worksheet, 7, columns.length, summaryRow, vesselName);
      worksheet.pageSetup.orientation = 'landscape';
      
      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `Equipment_Utilization_Summary_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;
      
      console.log(`[EQUIPMENT UTILIZATION REPORT] Generated: ${filename}`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating Equipment Utilization Excel report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 1.10: RUNNING HOURS ANOMALY DETECTION
  // Identifies equipment with unusual running patterns or potential meter issues
  // Uses running_hours_audit table (1,146 records across 5 vessels)
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/technical/api/reports/running-hours-anomaly-detection", async (req: Request, res: Response) => {
    try {
      const { vesselId, startDate, endDate, anomalyType, severity: severityFilter } = req.query;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Get vessel name
      const vessels = await storage.getVessels();
      const vessel = vessels.find(v => v.id === vesselId || v.vesselCode === vesselId);
      const vesselName = vessel?.name || vessel?.vesselName || String(vesselId);
      
      // Get database instance
      const db = await getDb();
      
      // Query running_hours_audit table (this has the actual data - 1,146 records)
      const allAuditLogs = await db.select().from(runningHoursAudit)
        .where(sql`${runningHoursAudit.vesselId} = ${vesselId}`);
      
      console.log(`[ANOMALY] Vessel: ${vesselId}, Audit logs found: ${allAuditLogs.length}`);
      
      // Debug: Check first log entry to understand date format
      if (allAuditLogs.length > 0) {
        const firstLog = allAuditLogs[0];
        console.log(`[ANOMALY DEBUG] First log enteredAtUtc: ${firstLog.enteredAtUTC}, type: ${typeof firstLog.enteredAtUTC}`);
      }
      
      // Parse dates
      const parseDate = (dateVal: string | Date | null | undefined): Date | null => {
        if (!dateVal) return null;
        try {
          const d = new Date(dateVal instanceof Date ? dateVal : dateVal);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };
      
      const now = new Date();
      const defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days for better analysis
      const periodStart = startDate ? parseDate(startDate as string) : defaultStartDate;
      const periodEnd = endDate ? parseDate(endDate as string) : now;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      // Filter logs within the date range - handle both Date objects and strings from Drizzle
      const logsInPeriod = allAuditLogs.filter(log => {
        if (!log.enteredAtUTC) return false;
        const logDate = log.enteredAtUTC instanceof Date ? log.enteredAtUTC : new Date(log.enteredAtUTC);
        return logDate >= periodStart && logDate <= periodEnd;
      });
      
      console.log(`[ANOMALY] Logs in period: ${logsInPeriod.length}, Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
      
      // Group logs by component to analyze patterns
      const componentLogs = new Map<string, typeof logsInPeriod>();
      for (const log of logsInPeriod) {
        const key = log.componentId || log.componentCode || 'unknown';
        if (!componentLogs.has(key)) {
          componentLogs.set(key, []);
        }
        componentLogs.get(key)!.push(log);
      }
      
      // Get components for reference
      const allComponents = await storage.getComponents(vesselId as string);
      const componentMap = new Map(allComponents.map(c => [c.id, c]));
      const componentCodeMap = new Map(allComponents.map(c => [c.componentCode, c]));
      
      // Detect anomalies
      const anomalies: any[] = [];
      let sNo = 0;
      
      for (const [componentKey, logs] of componentLogs.entries()) {
        // Sort logs by timestamp to analyze consecutive readings
        const sortedLogs = logs.sort((a, b) => 
          new Date(a.enteredAtUtc!).getTime() - new Date(b.enteredAtUtc!).getTime()
        );
        
        // Calculate average delta for this component (for irregular pattern detection)
        const deltas = sortedLogs.map(log => {
          const prev = Number(log.previousRH) || 0;
          const curr = Number(log.newRH) || 0;
          return curr - prev;
        }).filter(d => d > 0);
        const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
        
        for (let i = 0; i < sortedLogs.length; i++) {
          const log = sortedLogs[i];
          const prevLog = i > 0 ? sortedLogs[i - 1] : null;
          
          const previousRh = Number(log.previousRH) || 0;
          const newRh = Number(log.newRH) || 0;
          const delta = newRh - previousRh;
          const meterReplaced = log.meterReplaced === true;
          
          // Calculate days between readings (for avg daily hours)
          let daysBetween = 1;
          let avgDailyHours = 0;
          if (prevLog?.enteredAtUtc && log.enteredAtUTC) {
            const prevTime = new Date(prevLog.enteredAtUtc).getTime();
            const currTime = new Date(log.enteredAtUTC).getTime();
            daysBetween = Math.max(1, (currTime - prevTime) / (1000 * 60 * 60 * 24));
            avgDailyHours = delta / daysBetween;
          } else if (log.enteredAtUTC) {
            // First reading - estimate from delta
            avgDailyHours = delta > 0 ? Math.min(delta, 24) : 0;
          }
          
          // Get component info
          const component = componentMap.get(log.componentId || '') || componentCodeMap.get(log.componentCode || '');
          const componentName = log.componentName || component?.name || component?.fleetEquipmentName || log.componentCode || 'Unknown';
          
          let anomalyDetected = false;
          let anomalyTypeValue = '';
          let severity: 'Critical' | 'Warning' | 'Info' = 'Info';
          let description = '';
          
          // RULE 1: HIGH INCREMENT - avgDailyHours > 24 (physically impossible)
          if (avgDailyHours > 24 && !meterReplaced) {
            anomalyDetected = true;
            anomalyTypeValue = 'High Increment';
            severity = 'Critical';
            description = `Impossible: ${avgDailyHours.toFixed(1)} hrs/day (max 24). Delta: ${delta.toFixed(0)} hrs over ${daysBetween.toFixed(1)} days.`;
          }
          // RULE 2: NEGATIVE - delta < 0 without meter replacement
          else if (delta < 0 && !meterReplaced) {
            anomalyDetected = true;
            anomalyTypeValue = 'Negative Delta';
            severity = 'Critical';
            description = `RH decreased by ${Math.abs(delta).toFixed(1)} hrs without meter replacement. Possible data entry error or stuck meter.`;
          }
          // RULE 3: ZERO - delta = 0 AND daysBetween > 7 (stuck meter)
          else if (delta === 0 && daysBetween > 7 && previousRh > 0) {
            anomalyDetected = true;
            anomalyTypeValue = 'Zero Change';
            severity = 'Warning';
            description = `No RH change for ${daysBetween.toFixed(0)} days on equipment with ${previousRh.toFixed(0)} hrs. Possible stuck meter.`;
          }
          // RULE 4: IRREGULAR - Sudden spike compared to component's historical average
          else if (avgDelta > 0 && delta > avgDelta * 3 && delta > 50) {
            anomalyDetected = true;
            anomalyTypeValue = 'Irregular Pattern';
            severity = 'Warning';
            description = `Spike: ${delta.toFixed(0)} hrs is 3x above avg (${avgDelta.toFixed(1)} hrs). May indicate catch-up entry or data issue.`;
          }
          // RULE 5: Meter replacement flagged - Info only
          else if (meterReplaced) {
            anomalyDetected = true;
            anomalyTypeValue = 'Meter Replaced';
            severity = 'Info';
            const oldMeter = log.oldMeterFinal ? Number(log.oldMeterFinal).toFixed(0) : 'N/A';
            const newMeter = log.newMeterStart ? Number(log.newMeterStart).toFixed(0) : '0';
            description = `Meter replaced. Old final: ${oldMeter} hrs, New start: ${newMeter} hrs.`;
          }
          
          // Apply filters
          if (anomalyDetected) {
            const passesTypeFilter = !anomalyType || anomalyType === 'All' || anomalyType === anomalyTypeValue;
            const passesSeverityFilter = !severityFilter || severityFilter === 'All' || severityFilter === severity;
            
            if (passesTypeFilter && passesSeverityFilter) {
              sNo++;
              anomalies.push({
                sNo,
                componentCode: log.componentCode || component?.componentCode || '-',
                componentName,
                category: component?.componentCategory || component?.category || '-',
                department: component?.department || component?.eqptSystemDept || '-',
                previousRh: Math.round(previousRh * 100) / 100,
                newRh: Math.round(newRh * 100) / 100,
                delta: Math.round(delta * 100) / 100,
                daysBetween: Math.round(daysBetween * 10) / 10,
                avgDailyHours: Math.round(avgDailyHours * 100) / 100,
                anomalyType: anomalyTypeValue,
                severity,
                description,
                meterReplaced,
                updatedBy: log.userId || '-',
                updatedAt: log.enteredAtUTC,
                source: log.source || '-',
                notes: log.notes || '-'
              });
            }
          }
        }
      }
      
      // Sort by severity (Critical first), then by avgDailyHours descending
      anomalies.sort((a, b) => {
        const severityOrder = { 'Critical': 0, 'Warning': 1, 'Info': 2 };
        if (severityOrder[a.severity as keyof typeof severityOrder] !== severityOrder[b.severity as keyof typeof severityOrder]) {
          return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
        }
        return Math.abs(b.avgDailyHours) - Math.abs(a.avgDailyHours);
      });
      
      // Re-number after sorting
      anomalies.forEach((item, idx) => { item.sNo = idx + 1; });
      
      // Calculate summary
      const summary = {
        totalAnomalies: anomalies.length,
        criticalCount: anomalies.filter(a => a.severity === 'Critical').length,
        warningCount: anomalies.filter(a => a.severity === 'Warning').length,
        infoCount: anomalies.filter(a => a.severity === 'Info').length,
        byType: {
          highIncrement: anomalies.filter(a => a.anomalyType === 'High Increment').length,
          negativeDelta: anomalies.filter(a => a.anomalyType === 'Negative Delta').length,
          zeroChange: anomalies.filter(a => a.anomalyType === 'Zero Change').length,
          irregularPattern: anomalies.filter(a => a.anomalyType === 'Irregular Pattern').length,
          meterReplaced: anomalies.filter(a => a.anomalyType === 'Meter Replaced').length
        },
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        totalLogsAnalyzed: logsInPeriod.length,
        componentsAnalyzed: componentLogs.size
      };
      
      res.json({
        success: true,
        vesselId,
        vesselName,
        reportDate: new Date().toISOString(),
        period: {
          startDate: periodStart.toISOString().split('T')[0],
          endDate: periodEnd.toISOString().split('T')[0]
        },
        summary,
        data: anomalies,
        totalRecords: anomalies.length
      });
      
    } catch (error: any) {
      console.error("Error generating Running Hours Anomaly Detection report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 1.10: RUNNING HOURS ANOMALY DETECTION - EXCEL EXPORT
  // Professional Excel export with severity-based row coloring
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/running-hours-anomaly-detection/excel", async (req: Request, res: Response) => {
    try {
      const { vesselId, startDate, endDate, anomalyType, severity: severityFilter } = req.body;
      
      if (!vesselId) {
        return res.status(400).json({ error: "Please select a vessel" });
      }
      
      // Get vessel name
      const vessels = await storage.getVessels();
      const vessel = vessels.find(v => v.id === vesselId || v.vesselCode === vesselId);
      const vesselName = vessel?.name || vessel?.vesselName || String(vesselId);
      
      // Get database instance
      const db = await getDb();
      
      // Query running_hours_audit table (has actual data)
      const allAuditLogs = await db.select().from(runningHoursAudit)
        .where(sql`${runningHoursAudit.vesselId} = ${vesselId}`);
      
      // Parse dates
      const parseDate = (dateVal: string | Date | null | undefined): Date | null => {
        if (!dateVal) return null;
        try {
          const d = new Date(dateVal instanceof Date ? dateVal : dateVal);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };
      
      const formatDateDisplay = (dateVal: string | Date | null | undefined): string => {
        if (!dateVal) return '-';
        try {
          const dateStr = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '-';
          const day = d.getDate().toString().padStart(2, '0');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
        } catch {
          return '-';
        }
      };
      
      const now = new Date();
      const defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const periodStart = startDate ? parseDate(startDate) : defaultStartDate;
      const periodEnd = endDate ? parseDate(endDate) : now;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      // Filter logs within the date range - handle both Date objects and strings from Drizzle
      const logsInPeriod = allAuditLogs.filter(log => {
        if (!log.enteredAtUTC) return false;
        const logDate = log.enteredAtUTC instanceof Date ? log.enteredAtUTC : new Date(log.enteredAtUTC);
        return logDate >= periodStart && logDate <= periodEnd;
      });
      
      // Group logs by component
      const componentLogs = new Map<string, typeof logsInPeriod>();
      for (const log of logsInPeriod) {
        const key = log.componentId || log.componentCode || 'unknown';
        if (!componentLogs.has(key)) {
          componentLogs.set(key, []);
        }
        componentLogs.get(key)!.push(log);
      }
      
      // Get components for reference
      const allComponents = await storage.getComponents(vesselId);
      const componentMap = new Map(allComponents.map(c => [c.id, c]));
      const componentCodeMap = new Map(allComponents.map(c => [c.componentCode, c]));
      
      // Detect anomalies (same logic as GET endpoint)
      const anomalies: any[] = [];
      
      for (const [componentKey, logs] of componentLogs.entries()) {
        const sortedLogs = logs.sort((a, b) => 
          new Date(a.enteredAtUtc!).getTime() - new Date(b.enteredAtUtc!).getTime()
        );
        
        const deltas = sortedLogs.map(log => {
          const prev = Number(log.previousRH) || 0;
          const curr = Number(log.newRH) || 0;
          return curr - prev;
        }).filter(d => d > 0);
        const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
        
        for (let i = 0; i < sortedLogs.length; i++) {
          const log = sortedLogs[i];
          const prevLog = i > 0 ? sortedLogs[i - 1] : null;
          
          const previousRh = Number(log.previousRH) || 0;
          const newRh = Number(log.newRH) || 0;
          const delta = newRh - previousRh;
          const meterReplaced = log.meterReplaced === true;
          
          let daysBetween = 1;
          let avgDailyHours = 0;
          if (prevLog?.enteredAtUtc && log.enteredAtUTC) {
            const prevTime = new Date(prevLog.enteredAtUtc).getTime();
            const currTime = new Date(log.enteredAtUTC).getTime();
            daysBetween = Math.max(1, (currTime - prevTime) / (1000 * 60 * 60 * 24));
            avgDailyHours = delta / daysBetween;
          } else if (log.enteredAtUTC) {
            avgDailyHours = delta > 0 ? Math.min(delta, 24) : 0;
          }
          
          const component = componentMap.get(log.componentId || '') || componentCodeMap.get(log.componentCode || '');
          const componentName = log.componentName || component?.name || component?.fleetEquipmentName || log.componentCode || 'Unknown';
          
          let anomalyDetected = false;
          let anomalyTypeValue = '';
          let severity: 'Critical' | 'Warning' | 'Info' = 'Info';
          let description = '';
          
          if (avgDailyHours > 24 && !meterReplaced) {
            anomalyDetected = true;
            anomalyTypeValue = 'High Increment';
            severity = 'Critical';
            description = `Impossible: ${avgDailyHours.toFixed(1)} hrs/day. Delta: ${delta.toFixed(0)} hrs over ${daysBetween.toFixed(1)} days.`;
          } else if (delta < 0 && !meterReplaced) {
            anomalyDetected = true;
            anomalyTypeValue = 'Negative Delta';
            severity = 'Critical';
            description = `RH decreased by ${Math.abs(delta).toFixed(1)} hrs without meter replacement.`;
          } else if (delta === 0 && daysBetween > 7 && previousRh > 0) {
            anomalyDetected = true;
            anomalyTypeValue = 'Zero Change';
            severity = 'Warning';
            description = `No RH change for ${daysBetween.toFixed(0)} days. Possible stuck meter.`;
          } else if (avgDelta > 0 && delta > avgDelta * 3 && delta > 50) {
            anomalyDetected = true;
            anomalyTypeValue = 'Irregular Pattern';
            severity = 'Warning';
            description = `Spike: ${delta.toFixed(0)} hrs is 3x above avg (${avgDelta.toFixed(1)} hrs).`;
          } else if (meterReplaced) {
            anomalyDetected = true;
            anomalyTypeValue = 'Meter Replaced';
            severity = 'Info';
            description = `Meter replaced. Old: ${log.oldMeterFinal || 'N/A'}, New: ${log.newMeterStart || '0'}`;
          }
          
          if (anomalyDetected) {
            const passesTypeFilter = !anomalyType || anomalyType === 'All' || anomalyType === anomalyTypeValue;
            const passesSeverityFilter = !severityFilter || severityFilter === 'All' || severityFilter === severity;
            
            if (passesTypeFilter && passesSeverityFilter) {
              anomalies.push({
                componentCode: log.componentCode || component?.componentCode || '-',
                componentName,
                category: component?.componentCategory || component?.category || '-',
                department: component?.department || component?.eqptSystemDept || '-',
                previousRh: Math.round(previousRh * 100) / 100,
                newRh: Math.round(newRh * 100) / 100,
                delta: Math.round(delta * 100) / 100,
                daysBetween: Math.round(daysBetween * 10) / 10,
                avgDailyHours: Math.round(avgDailyHours * 100) / 100,
                anomalyType: anomalyTypeValue,
                severity,
                description,
                meterReplaced,
                updatedBy: log.userId || '-',
                updatedAt: log.enteredAtUTC,
                source: log.source || '-'
              });
            }
          }
        }
      }
      
      // Sort by severity
      anomalies.sort((a, b) => {
        const severityOrder = { 'Critical': 0, 'Warning': 1, 'Info': 2 };
        if (severityOrder[a.severity as keyof typeof severityOrder] !== severityOrder[b.severity as keyof typeof severityOrder]) {
          return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
        }
        return Math.abs(b.avgDailyHours) - Math.abs(a.avgDailyHours);
      });
      
      // Create workbook - use static import at top of file
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('RH Anomaly Detection');
      
      // Define columns with enhanced data
      const columns = [
        { header: 'S.No', key: 'sNo', width: 6 },
        { header: 'Component Code', key: 'componentCode', width: 15 },
        { header: 'Component Name', key: 'componentName', width: 30 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Department', key: 'department', width: 12 },
        { header: 'Previous RH', key: 'previousRh', width: 12 },
        { header: 'New RH', key: 'newRh', width: 12 },
        { header: 'Delta', key: 'delta', width: 10 },
        { header: 'Days Between', key: 'daysBetween', width: 12 },
        { header: 'Avg Daily Hrs', key: 'avgDailyHours', width: 12 },
        { header: 'Anomaly Type', key: 'anomalyType', width: 15 },
        { header: 'Severity', key: 'severity', width: 10 },
        { header: 'Description', key: 'description', width: 45 },
        { header: 'Updated By', key: 'updatedBy', width: 15 },
        { header: 'Date', key: 'updatedAt', width: 12 },
        { header: 'Source', key: 'source', width: 12 }
      ];
      
      worksheet.columns = columns;
      const lastColLetter = getLastColumnLetter(columns.length);
      
      // Apply header
      const reportTitle = 'Running Hours Anomaly Detection Report';
      const criticalCount = anomalies.filter(a => a.severity === 'Critical').length;
      const warningCount = anomalies.filter(a => a.severity === 'Warning').length;
      const infoCount = anomalies.filter(a => a.severity === 'Info').length;
      const subtitle = `Critical: ${criticalCount} | Warning: ${warningCount} | Info: ${infoCount} | Period: ${formatDateDisplay(periodStart)} to ${formatDateDisplay(periodEnd)}`;
      const periodDisplay = `${formatDateDisplay(periodStart)} to ${formatDateDisplay(periodEnd)}`;
      applyStandardHeader(worksheet, reportTitle, subtitle, vesselName, anomalies.length, lastColLetter, periodDisplay);
      
      // Apply table header
      applyStandardTableHeader(worksheet, columns, 7);
      
      // Prepare report data
      const reportData = anomalies.map((a, idx) => ({
        sNo: idx + 1,
        componentCode: a.componentCode,
        componentName: a.componentName,
        category: a.category,
        department: a.department,
        previousRh: a.previousRh.toFixed(1),
        newRh: a.newRh.toFixed(1),
        delta: a.delta.toFixed(1),
        daysBetween: a.daysBetween.toFixed(1),
        avgDailyHours: a.avgDailyHours.toFixed(2),
        anomalyType: a.anomalyType,
        severity: a.severity,
        description: a.description,
        updatedBy: a.updatedBy,
        updatedAt: formatDateDisplay(a.updatedAt),
        source: a.source
      }));
      
      // Apply data rows
      applyStandardDataRows(worksheet, reportData, columns, 8);
      
      // Apply severity-based coloring
      for (let i = 0; i < reportData.length; i++) {
        const rowNum = 8 + i;
        const severity = anomalies[i].severity;
        const severityCell = worksheet.getCell(rowNum, 12); // Column L = Severity
        
        if (severity === 'Critical') {
          for (let col = 1; col <= columns.length; col++) {
            worksheet.getCell(rowNum, col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFECACA' }
            };
          }
          severityCell.font = { color: { argb: 'FFDC2626' }, bold: true };
        } else if (severity === 'Warning') {
          for (let col = 1; col <= columns.length; col++) {
            worksheet.getCell(rowNum, col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFEF3C7' }
            };
          }
          severityCell.font = { color: { argb: 'FFD97706' }, bold: true };
        } else {
          for (let col = 1; col <= columns.length; col++) {
            worksheet.getCell(rowNum, col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFDBEAFE' }
            };
          }
          severityCell.font = { color: { argb: 'FF2563EB' }, bold: true };
        }
      }
      
      // Add summary row
      const summaryRow = 8 + reportData.length + 1;
      worksheet.mergeCells(`A${summaryRow}:${lastColLetter}${summaryRow}`);
      worksheet.getCell(`A${summaryRow}`).value = 
        `Summary: ${anomalies.length} anomalies detected | Critical: ${criticalCount} | Warning: ${warningCount} | Info: ${infoCount} | Components analyzed: ${componentLogs.size} | Logs analyzed: ${logsInPeriod.length}`;
      worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 10 };
      worksheet.getCell(`A${summaryRow}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      };
      
      // Apply page setup
      applyStandardPageSetup(worksheet, 7, columns.length, summaryRow, vesselName);
      worksheet.pageSetup.orientation = 'landscape';
      
      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `RH_Anomaly_Detection_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;
      
      console.log(`[RH ANOMALY EXCEL] Generated: ${filename}, Anomalies: ${anomalies.length}`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Error generating RH Anomaly Detection Excel report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 2.1: IHM INVENTORY STATUS REPORT
  // Combined spares + stores IHM (Inventory of Hazardous Materials) data
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/technical/api/reports/ihm-inventory-status", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string | undefined;

      const ihmStatusFilter = (req.query.ihmStatus as string) || 'all';
      const itemTypeFilter = (req.query.itemType as string) || 'all';
      const searchQuery = (req.query.search as string) || '';
      const sortBy = (req.query.sortBy as string) || 'itemCode';
      const sortOrder = (req.query.sortOrder as string) || 'asc';
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const normalizeSpareIhm = (ihm: string | null | undefined, ihmPresence: string | null | undefined): string => {
        if (ihmPresence) {
          const p = ihmPresence.toUpperCase();
          if (p === 'YES') return 'present';
          if (p === 'NO') return 'not_present';
          if (p === 'UNKNOWN') return 'unknown';
        }
        if (ihm) {
          const v = ihm.toLowerCase().trim();
          if (v === 'yes' || v === 'present' || v === 'true') return 'present';
          if (v === 'no' || v === 'not present' || v === 'false') return 'not_present';
        }
        return 'unknown';
      };

      const normalizeStoreIhm = (ihmPresence: string | null | undefined, ihm: boolean | null | undefined): string => {
        if (ihmPresence) {
          const p = ihmPresence.toLowerCase().trim();
          if (p === 'present') return 'present';
          if (p === 'not present') return 'not_present';
          if (p === 'unknown') return 'unknown';
        }
        if (ihm === true) return 'present';
        if (ihm === false) return 'not_present';
        return 'unknown';
      };

      let sparesData: any[] = [];
      let storesData: any[] = [];
      if (vesselId && vesselId !== 'all') {
        sparesData = await storage.getSpares(vesselId);
        storesData = await storage.getStoresItems(vesselId);
      } else {
        const allVessels = await storage.getVessels();
        for (const vessel of allVessels) {
          const vSpares = await storage.getSpares(vessel.id);
          sparesData.push(...vSpares);
          const vStores = await storage.getStoresItems(vessel.id);
          storesData.push(...vStores);
        }
      }

      interface IhmItem {
        id: number;
        itemCode: string;
        itemName: string;
        itemType: 'spare' | 'store';
        storeCategory: string;
        componentOrCategory: string;
        ihmStatus: string;
        evidenceType: string;
        hazardClassification: string;
        sdsReference: string;
        currentROB: number;
        uom: string;
        location: string;
        partNumber: string;
        lastUpdated: string;
      }

      let combinedItems: IhmItem[] = [];

      for (const s of sparesData) {
        if (s.deleted || s.dataScope === 'fleet') continue;
        const ihmStatus = normalizeSpareIhm(s.ihm, s.ihmPresence);
        if (ihmStatus !== 'present') continue;
        combinedItems.push({
          id: s.id,
          itemCode: s.partCode || s.componentSpareCode || '',
          itemName: s.partName || '',
          itemType: 'spare',
          storeCategory: '',
          componentOrCategory: s.componentName || '',
          ihmStatus,
          evidenceType: s.evidenceType || 'None',
          hazardClassification: '',
          sdsReference: '',
          currentROB: s.rob ?? 0,
          uom: s.uom || s.unit || 'PCS',
          location: [s.location, s.location2].filter(Boolean).join(' / ') || '-',
          partNumber: s.partNumber || '',
          lastUpdated: s.updatedAt ? new Date(s.updatedAt).toISOString() : '',
        });
      }

      for (const st of storesData) {
        if (st.deleted || st.isActive === false) continue;
        const ihmStatus = normalizeStoreIhm(st.ihmPresence, st.ihm);
        if (ihmStatus !== 'present') continue;
        combinedItems.push({
          id: st.id + 1000000,
          itemCode: st.itemCode || '',
          itemName: st.itemName || '',
          itemType: 'store',
          storeCategory: st.itemType || 'stores',
          componentOrCategory: st.category || st.itemType || '',
          ihmStatus,
          evidenceType: st.ihmEvidenceType || 'None',
          hazardClassification: st.hazardClassification || '',
          sdsReference: st.sdsReference || '',
          currentROB: parseFloat(String(st.rob)) || 0,
          uom: st.uom || 'PCS',
          location: [st.locationA, st.locationB].filter(Boolean).join(' / ') || '-',
          partNumber: '',
          lastUpdated: st.updatedAt ? new Date(st.updatedAt).toISOString() : '',
        });
      }

      const totalAll = combinedItems.length;
      const totalSpares = combinedItems.filter(i => i.itemType === 'spare').length;
      const totalStores = combinedItems.filter(i => i.itemType === 'store').length;

      const summaryPresent = combinedItems.length;
      const summaryNotPresent = 0;
      const summaryUnknown = 0;

      if (itemTypeFilter && itemTypeFilter !== 'all') {
        if (itemTypeFilter === 'spare') {
          combinedItems = combinedItems.filter(i => i.itemType === 'spare');
        } else if (itemTypeFilter === 'store') {
          combinedItems = combinedItems.filter(i => i.itemType === 'store');
        } else if (['stores', 'lubricants', 'lubes', 'chemicals', 'others'].includes(itemTypeFilter)) {
          combinedItems = combinedItems.filter(i => {
            if (i.itemType !== 'store') return false;
            if (itemTypeFilter === 'lubes' || itemTypeFilter === 'lubricants') {
              return i.storeCategory === 'lubes' || i.storeCategory === 'lubricants';
            }
            return i.storeCategory === itemTypeFilter;
          });
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        combinedItems = combinedItems.filter(i =>
          i.itemCode.toLowerCase().includes(q) ||
          i.itemName.toLowerCase().includes(q) ||
          i.componentOrCategory.toLowerCase().includes(q) ||
          i.partNumber.toLowerCase().includes(q) ||
          i.location.toLowerCase().includes(q)
        );
      }

      const statusOrder: Record<string, number> = { present: 0, unknown: 1, not_present: 2 };

      combinedItems.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'itemCode': cmp = a.itemCode.localeCompare(b.itemCode); break;
          case 'itemName': cmp = a.itemName.localeCompare(b.itemName); break;
          case 'itemType': cmp = a.itemType.localeCompare(b.itemType); break;
          case 'componentOrCategory': cmp = a.componentOrCategory.localeCompare(b.componentOrCategory); break;
          case 'ihmStatus': cmp = (statusOrder[a.ihmStatus] ?? 3) - (statusOrder[b.ihmStatus] ?? 3); break;
          case 'evidenceType': cmp = a.evidenceType.localeCompare(b.evidenceType); break;
          case 'currentROB': cmp = a.currentROB - b.currentROB; break;
          case 'location': cmp = a.location.localeCompare(b.location); break;
          default: cmp = a.itemCode.localeCompare(b.itemCode);
        }
        return sortOrder === 'desc' ? -cmp : cmp;
      });

      const totalFiltered = combinedItems.length;
      const totalPages = Math.ceil(totalFiltered / pageSize);
      const startIdx = (page - 1) * pageSize;
      const paginatedItems = combinedItems.slice(startIdx, startIdx + pageSize);

      res.json({
        summary: {
          totalItems: totalAll,
          ihmPresent: summaryPresent,
          noIhm: summaryNotPresent,
          unknown: summaryUnknown,
        },
        items: paginatedItems,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalFiltered,
          pageSize,
        },
        categoryCounts: {
          all: totalAll,
          spares: totalSpares,
          stores: totalStores,
        },
      });
    } catch (error: any) {
      console.error("Error fetching IHM inventory status:", error);
      res.status(500).json({ error: "Failed to fetch IHM inventory data", details: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT 2.1: IHM INVENTORY STATUS - EXCEL EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/technical/api/reports/ihm-inventory-status/excel", async (req, res) => {
    try {
      const { vesselId, ihmStatus, itemType, search } = req.body;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      const vessels = await storage.getVessels();
      const vessel = vessels.find(v => v.id === vesselId || v.vesselCode === vesselId);
      const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vessel?.vesselName || String(vesselId));

      let sparesData: any[] = [];
      let storesData: any[] = [];
      if (vesselId === 'all') {
        for (const v of vessels) {
          const vSpares = await storage.getSpares(v.id);
          sparesData.push(...vSpares);
          const vStores = await storage.getStoresItems(v.id);
          storesData.push(...vStores);
        }
      } else {
        sparesData = await storage.getSpares(vesselId);
        storesData = await storage.getStoresItems(vesselId);
      }

      const normalizeSpareIhm = (ihm: string | null | undefined, ihmPresence: string | null | undefined): string => {
        if (ihmPresence) {
          const p = ihmPresence.toUpperCase();
          if (p === 'YES') return 'Present';
          if (p === 'NO') return 'Not Present';
        }
        if (ihm) {
          const v = ihm.toLowerCase().trim();
          if (v === 'yes' || v === 'present' || v === 'true') return 'Present';
          if (v === 'no' || v === 'not present' || v === 'false') return 'Not Present';
        }
        return 'Unknown';
      };

      const normalizeStoreIhm = (ihmPresence: string | null | undefined, ihm: boolean | null | undefined): string => {
        if (ihmPresence) {
          const p = ihmPresence.toLowerCase().trim();
          if (p === 'present') return 'Present';
          if (p === 'not present') return 'Not Present';
        }
        if (ihm === true) return 'Present';
        if (ihm === false) return 'Not Present';
        return 'Unknown';
      };

      let allItems: any[] = [];

      for (const s of sparesData) {
        if (s.deleted || s.dataScope === 'fleet') continue;
        const status = normalizeSpareIhm(s.ihm, s.ihmPresence);
        if (status !== 'Present') continue;
        allItems.push({
          itemCode: s.partCode || s.componentSpareCode || '-',
          itemName: s.partName || '-',
          itemType: 'Spare',
          componentOrCategory: s.componentName || '-',
          ihmStatus: status,
          evidenceType: s.evidenceType || 'None',
          hazardClassification: '-',
          sdsReference: '-',
          currentROB: s.rob ?? 0,
          uom: s.uom || s.unit || 'PCS',
          location: [s.location, s.location2].filter(Boolean).join(' / ') || '-',
          partNumber: s.partNumber || '-',
        });
      }

      for (const st of storesData) {
        if (st.deleted || st.isActive === false) continue;
        const status = normalizeStoreIhm(st.ihmPresence, st.ihm);
        if (status !== 'Present') continue;
        allItems.push({
          itemCode: st.itemCode || '-',
          itemName: st.itemName || '-',
          itemType: st.itemType ? st.itemType.charAt(0).toUpperCase() + st.itemType.slice(1) : 'Store',
          componentOrCategory: st.category || st.itemType || '-',
          ihmStatus: status,
          evidenceType: st.ihmEvidenceType || 'None',
          hazardClassification: st.hazardClassification || '-',
          sdsReference: st.sdsReference || '-',
          currentROB: parseFloat(String(st.rob)) || 0,
          uom: st.uom || 'PCS',
          location: [st.locationA, st.locationB].filter(Boolean).join(' / ') || '-',
          partNumber: '-',
        });
      }

      if (ihmStatus && ihmStatus !== 'all') {
        const statusMap: Record<string, string> = { present: 'Present', not_present: 'Not Present', unknown: 'Unknown' };
        const target = statusMap[ihmStatus] || ihmStatus;
        allItems = allItems.filter(i => i.ihmStatus === target);
      }

      if (itemType && itemType !== 'all') {
        if (itemType === 'spare') {
          allItems = allItems.filter(i => i.itemType === 'Spare');
        } else if (itemType === 'store') {
          allItems = allItems.filter(i => i.itemType !== 'Spare');
        }
      }

      if (search && search.trim()) {
        const q = search.toLowerCase();
        allItems = allItems.filter(i =>
          i.itemCode.toLowerCase().includes(q) ||
          i.itemName.toLowerCase().includes(q) ||
          i.componentOrCategory.toLowerCase().includes(q)
        );
      }

      const statusOrder: Record<string, number> = { 'Present': 0, 'Unknown': 1, 'Not Present': 2 };
      allItems.sort((a, b) => (statusOrder[a.ihmStatus] ?? 3) - (statusOrder[b.ihmStatus] ?? 3));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('IHM Inventory Status');

      const columns: ColumnDef[] = [
        { header: 'S.No', key: 'sNo', width: 8 },
        { header: 'Item Code', key: 'itemCode', width: 18 },
        { header: 'Item Name', key: 'itemName', width: 35 },
        { header: 'Item Type', key: 'itemType', width: 14 },
        { header: 'Component / Category', key: 'componentOrCategory', width: 28 },
        { header: 'IHM Status', key: 'ihmStatus', width: 16 },
        { header: 'Evidence Type', key: 'evidenceType', width: 16 },
        { header: 'Hazard Classification', key: 'hazardClassification', width: 20 },
        { header: 'SDS Reference', key: 'sdsReference', width: 18 },
        { header: 'Current ROB', key: 'currentROB', width: 14 },
        { header: 'UOM', key: 'uom', width: 10 },
        { header: 'Location', key: 'location', width: 22 },
        { header: 'Part Number', key: 'partNumber', width: 18 },
      ];

      const totalPresent = allItems.filter(i => i.ihmStatus === 'Present').length;
      const totalNotPresent = allItems.filter(i => i.ihmStatus === 'Not Present').length;
      const totalUnknown = allItems.filter(i => i.ihmStatus === 'Unknown').length;
      const compliancePct = allItems.length > 0 ? Math.round(((totalPresent + totalNotPresent) / allItems.length) * 100) : 100;

      const lastCol = String.fromCharCode(64 + columns.length);
      applyStandardHeader(
        worksheet,
        'IHM Inventory Status Report',
        `IHM Present: ${totalPresent} | No IHM: ${totalNotPresent} | Unknown: ${totalUnknown} | Compliance: ${compliancePct}%`,
        vesselName,
        allItems.length,
        lastCol
      );

      applyStandardTableHeader(worksheet, columns, 7);

      const reportData = allItems.map((item, idx) => ({
        sNo: idx + 1,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemType: item.itemType,
        componentOrCategory: item.componentOrCategory,
        ihmStatus: item.ihmStatus,
        evidenceType: item.evidenceType,
        hazardClassification: item.hazardClassification,
        sdsReference: item.sdsReference,
        currentROB: item.currentROB,
        uom: item.uom,
        location: item.location,
        partNumber: item.partNumber,
      }));

      const conditionalStyles: ConditionalStyle[] = [
        { condition: (row: any) => row.ihmStatus === 'Present', style: 'danger' as const },
        { condition: (row: any) => row.ihmStatus === 'Unknown', style: 'warning' as const },
        { condition: (row: any) => row.ihmStatus === 'Not Present', style: 'success' as const },
      ];

      applyStandardDataRows(worksheet, reportData, columns, 8, conditionalStyles);

      const lastColLetter = getLastColumnLetter(columns.length);
      const summaryRow = 8 + reportData.length + 1;
      worksheet.mergeCells(`A${summaryRow}:${lastColLetter}${summaryRow}`);
      worksheet.getCell(`A${summaryRow}`).value =
        `Summary: ${allItems.length} items | IHM Present: ${totalPresent} | No IHM: ${totalNotPresent} | Unknown: ${totalUnknown} | Documentation Compliance: ${compliancePct}%`;
      worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 10 };
      worksheet.getCell(`A${summaryRow}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      };

      applyStandardPageSetup(worksheet, 7, columns.length, summaryRow, vesselName);
      worksheet.pageSetup.orientation = 'landscape';

      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `IHM_Inventory_Status_${vesselName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);

    } catch (error: any) {
      console.error("Error generating IHM Inventory Status Excel report:", error);
      res.status(500).json({ error: "Failed to generate report: " + error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Recalculate recurring defects on startup (don't await - let it run in background)
  storage.recalculateAllRecurringDefects().then(() => {
    console.log('✅ Recurring defects recalculated successfully');
  }).catch(err => {
    console.error('⚠️ Error recalculating recurring defects:', err);
  });
  
  // STARTUP BACKFILL: Recalculate nextDueDate/nextDueRH for jobs missing these values
  // Per documentation: Calendar jobs need nextDueDate = lastDoneDate + frequencyValue + frequencyUnit
  //                   RH jobs need nextDueRH = lastDoneRH + intervalRunningHour
  // NOTE: Only use intervalRunningHour for RH jobs, never fall back to frequencyValue (per schema)
  (async () => {
    try {
      const { calculateNextDueDate, normalizeDateToDDMMMYYYY } = await import("@shared/dateUtils");
      const allJobs = await storage.getJobs();
      let updatedCalendar = 0;
      let updatedRH = 0;
      
      for (const job of allJobs) {
        let updates: any = {};
        let needsUpdate = false;
        
        // Calendar-based jobs: Calculate nextDueDate if missing
        if (job.maintenanceBasis === 'Calendar' && !job.nextDueDate) {
          const rawLastDone = job.lastDoneDate;
          if (rawLastDone && job.frequencyValue && job.frequencyUnit) {
            // Normalize date before calculation
            const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
            if (lastDone) {
              const calculatedNextDue = calculateNextDueDate(lastDone, job.frequencyValue, job.frequencyUnit);
              if (calculatedNextDue) {
                updates.nextDueDate = calculatedNextDue;
                needsUpdate = true;
                updatedCalendar++;
              }
            }
          }
        }
        
        // Running Hours-based jobs: Calculate nextDueRH if missing
        // Only use intervalRunningHour, not frequencyValue
        // VALIDATION: interval must be a valid number > 0
        if (job.maintenanceBasis === 'Running Hours' && !job.nextDueRH) {
          const lastDoneRH = job.lastDoneRH;
          const intervalRH = Number(job.intervalRunningHour);
          if (lastDoneRH && !isNaN(intervalRH) && intervalRH > 0) {
            const lastRH = Number(lastDoneRH);
            if (!isNaN(lastRH)) {
              updates.nextDueRH = String(lastRH + intervalRH);
              needsUpdate = true;
              updatedRH++;
            }
          }
        }
        
        // Apply updates if needed
        if (needsUpdate) {
          await storage.updateJob(job.id, updates);
        }
      }
      
      if (updatedCalendar > 0 || updatedRH > 0) {
        console.log(`✅ Job backfill complete: ${updatedCalendar} Calendar jobs (nextDueDate), ${updatedRH} RH jobs (nextDueRH)`);
      } else {
        console.log('✅ Job backfill check complete - all jobs already have due dates/RH calculated');
      }
    } catch (err) {
      console.error('⚠️ Error during job nextDueDate/nextDueRH backfill:', err);
    }
  })();
  
  // STARTUP REMEDIATION: Derive component-specific tracking from ACTUAL maintenance history
  // This uses maintenance history as the source of truth for each component's completion dates
  (async () => {
    try {
      const { calculateNextDueDate, normalizeDateToDDMMMYYYY } = await import("@shared/dateUtils");
      
      // Get all job-component links
      const allLinks = await storage.getAllJobComponentLinks();
      let updatedCount = 0;
      
      for (const link of allLinks) {
        // Get the LATEST maintenance history record for this job+component pair
        const maintenanceHistory = await storage.getMaintenanceHistoryByJobAndComponent(
          link.jobId, 
          link.componentCode
        );
        
        if (!maintenanceHistory || maintenanceHistory.length === 0) {
          continue; // No maintenance history for this job-component pair
        }
        
        // Get the most recent record (sorted by date_completed DESC)
        const latestRecord = maintenanceHistory[0];
        
        // Check if the link's tracking data matches the latest maintenance history
        const historyDate = latestRecord.dateCompleted;
        const historyRH = latestRecord.runningHoursAtCompletion;
        
        // Get the job to determine frequency for next due calculation
        const job = await storage.getJob(link.jobId);
        if (!job) continue;
        
        // Build update if different from current link data
        const updates: any = {};
        let needsUpdate = false;
        
        if (historyDate && link.lastDoneDate !== historyDate) {
          updates.lastDoneDate = historyDate;
          needsUpdate = true;
          
          // Calculate nextDueDate if calendar-based
          if (job.maintenanceBasis === 'Calendar' && job.frequencyValue && job.frequencyUnit) {
            const normalizedDate = normalizeDateToDDMMMYYYY(historyDate);
            if (normalizedDate) {
              const nextDue = calculateNextDueDate(normalizedDate, job.frequencyValue, job.frequencyUnit);
              if (nextDue) {
                updates.nextDueDate = nextDue;
              }
            }
          }
        }
        
        if (historyRH && link.lastDoneRH !== historyRH) {
          updates.lastDoneRH = historyRH;
          needsUpdate = true;
          
          // Calculate nextDueRH if RH-based
          if (job.maintenanceBasis === 'Running Hours' && job.intervalRunningHour) {
            const lastRH = parseFloat(historyRH);
            const intervalRH = parseFloat(job.intervalRunningHour);
            if (!isNaN(lastRH) && !isNaN(intervalRH) && intervalRH > 0) {
              updates.nextDueRH = String(lastRH + intervalRH);
            }
          }
        }
        
        if (needsUpdate && link.vesselId) {
          updates.updatedAt = new Date();
          // VESSEL ISOLATION: Pass vesselId to ensure updates are vessel-scoped
          await storage.updateJobComponentLinkTracking(link.vesselId, link.jobId, link.componentId, updates);
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) {
        console.log(`✅ Remediated ${updatedCount} job-component links with component-specific tracking from maintenance history`);
      } else {
        console.log('✅ Component-specific tracking check complete - all data matches maintenance history');
      }
    } catch (err) {
      console.error('⚠️ Error during component-specific tracking remediation:', err);
    }
  })();
  
  // STARTUP BACKFILL: Create missing maintenance history records for completed work orders
  // This handles work orders that were completed before the auto-population feature was added
  (async () => {
    try {
      // Get all completed work orders
      const allVessels = await storage.getVessels();
      let backfilledCount = 0;
      let skippedCount = 0;
      
      for (const vessel of allVessels) {
        const workOrders = await storage.getWorkOrders(vessel.id);
        const completedWOs = workOrders.filter((wo: any) => wo.status === 'Completed');
        
        for (const wo of completedWOs) {
          const woAny = wo as any;
          // Check if maintenance history already exists for this work order
          const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(woAny.id);
          if (existingHistory) {
            skippedCount++;
            continue;
          }
          
          // Find the component for this work order
          if (!woAny.dateCompleted) continue;
          if (!woAny.componentCode) continue;
          const component = await storage.getComponentByCode(woAny.componentCode, woAny.vesselId);
          if (!component) continue;
          
          // Find the parent job
          let parentJob = null;
          let parentJobNo: string | null = null;
          
          if (woAny.jobId) {
            parentJob = await storage.getJob(woAny.jobId);
            if (parentJob) parentJobNo = parentJob.jobNo;
          }
          
          if (!parentJobNo && woAny.workOrderNo) {
            const woNumber = woAny.workOrderNo;
            const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
            if (newFormatMatch) parentJobNo = newFormatMatch[1];
            if (!parentJobNo) {
              const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
              if (oldFormatMatch) parentJobNo = oldFormatMatch[1];
            }
            if (parentJobNo && !parentJob) {
              const allJobs = await storage.getJobsByVessel(woAny.vesselId);
              parentJob = allJobs.find((j: any) => j.jobNo === parentJobNo) || null;
            }
          }
          
          // Normalize date
          const normalizeToISO = (isoDate: string | undefined): string => {
            if (!isoDate) return new Date().toISOString().split('T')[0];
            const date = new Date(isoDate);
            return date.toISOString().split('T')[0];
          };
          
          const historyPayload = {
            componentId: component.id,
            componentCode: woAny.componentCode || component.componentCode,
            vesselCode: woAny.vesselId,
            jobId: parentJob?.id || woAny.jobId || null,
            jobCode: parentJobNo || null,
            workOrderId: woAny.id,
            workOrderNo: woAny.templateCode || woAny.workOrderNo || `WO-${woAny.id}`,
            jobTitle: woAny.jobTitle,
            maintenanceType: woAny.taskType || 'Servicing',
            dateCompleted: normalizeToISO(woAny.dateCompleted),
            runningHoursAtCompletion: woAny.runningHoursAtCompletion?.toString() || null,
            performedBy: woAny.performedBy || 'Unknown',
            approvedBy: woAny.approvedBy || null,
            approvalDate: woAny.approvalDate ? normalizeToISO(woAny.approvalDate) : null,
            status: 'Approved' as const,
            workDescription: woAny.briefWorkDescription || null,
            sparesUsed: null,
            remarks: woAny.remarks || null,
            isComponentReplaced: false
          };
          
          await storage.createComponentMaintenanceHistory(historyPayload);
          backfilledCount++;
        }
      }
      
      if (backfilledCount > 0) {
        console.log(`✅ Maintenance history backfill complete: ${backfilledCount} records created, ${skippedCount} already existed`);
      } else {
        console.log(`✅ Maintenance history backfill check complete - all ${skippedCount} completed work orders already have history records`);
      }
    } catch (err) {
      console.error('⚠️ Error during maintenance history backfill:', err);
    }
  })();
  
  // Check and revert expired postponed work orders on startup
  (async () => {
    try {
      const result = await storage.checkAndRevertPostponedWorkOrders();
      if (result.revertedCount > 0) {
        console.log(`✅ Reverted ${result.revertedCount} expired postponed work orders to Due status`);
        result.revertedWorkOrders.forEach(wo => {
          console.log(`   - WO ${wo.workOrderNo} (${wo.jobTitle})`);
        });
      } else {
        console.log('✅ No expired postponed work orders to revert');
      }
    } catch (err) {
      console.error('⚠️ Error checking postponed work orders on startup:', err);
    }
  })();
  
  // Set up hourly check for expired postponed work orders
  const POSTPONEMENT_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  const postponementCheckInterval = setInterval(async () => {
    try {
      const result = await storage.checkAndRevertPostponedWorkOrders();
      if (result.revertedCount > 0) {
        console.log(`[Scheduled] Reverted ${result.revertedCount} expired postponed work orders`);
      }
    } catch (err) {
      console.error('[Scheduled] Error checking postponed work orders:', err);
    }
  }, POSTPONEMENT_CHECK_INTERVAL_MS);
  console.log(`📅 Scheduled hourly check for expired postponed work orders`);
  
  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    console.log('Cleaning up scheduled tasks...');
    clearInterval(postponementCheckInterval);
  });
  process.on('SIGINT', () => {
    console.log('Cleaning up scheduled tasks...');
    clearInterval(postponementCheckInterval);
  });
  
  return httpServer;
}

// Helper function to convert report data to CSV
function convertToCSV(reportData: any): string {
  if (!reportData.data || reportData.data.length === 0) {
    return 'No data available';
  }
  
  // Get headers from first row
  const headers = Object.keys(reportData.data[0]);
  let csv = headers.join(',') + '\n';
  
  // Add data rows
  reportData.data.forEach((row: any) => {
    const values = headers.map(header => {
      const val = row[header];
      // Escape values that contain commas or quotes
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csv += values.join(',') + '\n';
  });
  
  return csv;
}

// Function to generate CSV for spares export
function generateSparesCSV(spares: any[]): Buffer {
  if (!spares.length) {
    return Buffer.from('No data available');
  }
  
  // Define headers
  const headers = [
    'Part Code', 'Part Name', 'Category', 'Stock Quantity', 
    'Minimum Quantity', 'Unit', 'Unit Cost', 'Location',
    'Equipment', 'System', 'Status', 'Notes'
  ];
  
  let csvContent = '# MARITIME PMS - INVENTORY EXPORT\n';
  csvContent += `# Generated: ${new Date().toLocaleDateString()}\n`;
  csvContent += `# Total Records: ${spares.length}\n\n`;
  csvContent += headers.join(',') + '\n';
  
  // Add data rows
  spares.forEach(spare => {
    const status = spare.stockQuantity <= 0 ? 'Out of Stock' : 
                  spare.stockQuantity <= spare.minimumQuantity ? 'Low Stock' : 'OK';
    
    const rowData = [
      spare.partCode,
      spare.partName,
      spare.category || '',
      spare.stockQuantity,
      spare.minimumQuantity,
      spare.unit || '',
      spare.unitCost || '',
      spare.location || '',
      spare.equipment || '',
      spare.system || '',
      status,
      spare.notes || ''
    ];
    
    // Escape values that contain commas or quotes
    const escapedRow = rowData.map(value => {
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvContent += escapedRow.join(',') + '\n';
  });
  
  // Add summary at the end
  const totalValue = spares.reduce((sum, s) => sum + (s.stockQuantity * (s.unitCost || 0)), 0);
  const lowStockCount = spares.filter(s => s.stockQuantity <= s.minimumQuantity).length;
  
  csvContent += '\n\n# SUMMARY\n';
  csvContent += `# Total Items: ${spares.length}\n`;
  csvContent += `# Total Value: $${totalValue.toFixed(2)}\n`;
  csvContent += `# Low Stock Items: ${lowStockCount}\n`;
  
  return Buffer.from(csvContent, 'utf-8');
}

// Function to generate CSV for history export
function generateHistoryCSV(history: any[]): Buffer {
  if (!history.length) {
    return Buffer.from('No transaction history available');
  }
  
  // Define headers
  const headers = [
    'Date', 'Type', 'Part Code', 'Part Name', 
    'Quantity', 'Unit Cost', 'Total Cost', 
    'Balance After', 'User', 'Reference', 'Notes'
  ];
  
  let csvContent = '# MARITIME PMS - TRANSACTION HISTORY\n';
  csvContent += `# Generated: ${new Date().toLocaleDateString()}\n`;
  csvContent += `# Total Transactions: ${history.length}\n\n`;
  csvContent += headers.join(',') + '\n';
  
  // Add data rows
  history.forEach(transaction => {
    const rowData = [
      new Date(transaction.date).toLocaleDateString(),
      transaction.transactionType,
      transaction.partCode || '',
      transaction.partName || '',
      transaction.quantity,
      transaction.unitCost || '',
      transaction.totalCost || '',
      transaction.balanceAfter,
      transaction.user || '',
      transaction.reference || '',
      transaction.notes || ''
    ];
    
    // Escape values that contain commas or quotes
    const escapedRow = rowData.map(value => {
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvContent += escapedRow.join(',') + '\n';
  });
  
  return Buffer.from(csvContent, 'utf-8');
}

// Generate CSV content
function generateCSVContent(reportId: string, data: any, template?: any): Buffer {
  let csvContent = `# MARITIME PMS REPORT\n`;
  csvContent += `# Report: ${data.title || reportId}\n`;
  csvContent += `# Generated: ${new Date().toLocaleDateString()}\n`;
  csvContent += `# Vessel: ${data.vessel || 'MV Atlantic Star'}\n`;
  csvContent += `# Total Records: ${data.metadata?.totalRecords || 0}\n\n`;
  
  // Add data
  if (data.data && data.data.length > 0 && template?.columns) {
    csvContent += template.columns.map((col: any) => col.header).join(',') + '\n';
    
    data.data.forEach((row: any) => {
      const rowData = template.columns.map((col: any) => {
        const value = row[col.field] || '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += rowData.join(',') + '\n';
    });
  } else if (data.data && data.data.length > 0) {
    const headers = Object.keys(data.data[0]);
    csvContent += headers.join(',') + '\n';
    
    data.data.forEach((row: any) => {
      const rowData = headers.map(header => {
        const value = row[header] || '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += rowData.join(',') + '\n';
    });
  }
  
  return Buffer.from(csvContent, 'utf-8');
}

// Helper function to get seed defects data using real vessel names from external API
interface SeedDefect {
  seedId: string;
  vesselName: string;
  vesselId?: string;
  issuedDate: string;
  targetDate: string;
  status: string;
  isCoC: boolean;
  source?: string;
  defectCategory: string;
  defectType: string;
  responsibleRole: string;
  equipment: {
    category: string;
    type: string;
    make: string;
    model: string;
  };
  description: string;
  actionRequested: string;
  dateCompleted?: string;
}

function getSeedDefectsData(vesselNames: string[]): SeedDefect[] {
  // Use provided vessel names from external API (or fallback)
  const vessel1 = vesselNames[0] || 'Vessel 1';
  const vessel2 = vesselNames[1] || 'Vessel 2';
  const vessel3 = vesselNames[2] || 'Vessel 3';
  const vessel4 = vesselNames[3] || 'Vessel 4';
  const vessel5 = vesselNames[4] || 'Vessel 5';
  
  return [
    // Equipment Group A: Main Engine Fuel Pump - 4 occurrences across 2 vessels (recurring)
    {
      seedId: 'RD-A-001',
      vesselName: vessel1,
      issuedDate: '2025-03-15',
      targetDate: '2025-04-15',
      status: 'closed',
      dateCompleted: '2025-04-10',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel injection pump Unit #3 showing reduced pressure output. Fuel delivery fluctuating during high load operations.',
      actionRequested: 'Inspect and overhaul fuel injection pump. Replace worn plungers and delivery valves.'
    },
    {
      seedId: 'RD-A-002',
      vesselName: vessel1,
      issuedDate: '2025-06-20',
      targetDate: '2025-07-20',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel injection pump Unit #5 exhibiting similar symptoms to previous Unit #3 failure. Suspect systemic fuel quality issue.',
      actionRequested: 'Overhaul pump unit. Conduct fuel quality analysis. Review bunkering procedures.'
    },
    {
      seedId: 'RD-A-003',
      vesselName: vessel2,
      issuedDate: '2025-04-01',
      targetDate: '2025-05-01',
      status: 'closed',
      dateCompleted: '2025-04-28',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel pump delivery valve stuck. Engine performance degraded at full ahead.',
      actionRequested: 'Replace delivery valve and inspect related components.'
    },
    {
      seedId: 'RD-A-004',
      vesselName: vessel2,
      issuedDate: '2025-09-10',
      targetDate: '2025-10-10',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Multiple fuel pump units showing wear. Class surveyor raised CoC for engine reliability concerns.',
      actionRequested: 'Complete overhaul of all fuel injection pump units. Submit repair plan to Class.'
    },

    // Equipment Group B: Navigation Radar - 3 occurrences across 3 vessels (recurring)
    {
      seedId: 'RD-B-001',
      vesselName: vessel1,
      issuedDate: '2025-02-10',
      targetDate: '2025-03-10',
      status: 'closed',
      dateCompleted: '2025-03-05',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'Radar display flickering intermittently. Target tracking unreliable in heavy weather.',
      actionRequested: 'Service technician to inspect display unit and antenna motor assembly.'
    },
    {
      seedId: 'RD-B-002',
      vesselName: vessel3,
      issuedDate: '2025-05-15',
      targetDate: '2025-06-15',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'Radar bearing accuracy degraded. ARPA tracking showing errors in target courses.',
      actionRequested: 'Calibrate radar. Replace gyro interface if necessary.'
    },
    {
      seedId: 'RD-B-003',
      vesselName: vessel2,
      issuedDate: '2025-08-20',
      targetDate: '2025-09-20',
      status: 'open',
      isCoC: true,
      source: 'PSC',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'PSC detention due to radar malfunction. Complete failure of X-Band radar during port state inspection.',
      actionRequested: 'Urgent repair required. Replace main processing unit and conduct sea trials.'
    },

    // Equipment Group C: Lifeboat Davit - 2 occurrences (minimum recurring)
    {
      seedId: 'RD-C-001',
      vesselName: vessel1,
      issuedDate: '2025-01-20',
      targetDate: '2025-02-20',
      status: 'closed',
      dateCompleted: '2025-02-15',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Deck',
      defectType: 'Safety Equipment',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Deck',
        type: 'Lifeboat Davit',
        make: 'Norsafe',
        model: 'LBD-500'
      },
      description: 'Lifeboat davit wire showing corrosion. Brake test failed during annual survey.',
      actionRequested: 'Replace davit wire and overhaul brake mechanism. Re-survey by Class.'
    },
    {
      seedId: 'RD-C-002',
      vesselName: vessel2,
      issuedDate: '2025-07-05',
      targetDate: '2025-08-05',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Deck',
      defectType: 'Safety Equipment',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Deck',
        type: 'Lifeboat Davit',
        make: 'Norsafe',
        model: 'LBD-500'
      },
      description: 'Similar davit wire corrosion identified during routine inspection. Potential fleet-wide issue.',
      actionRequested: 'Full inspection of davit system. Coordinate with fleet for common maintenance schedule.'
    },

    // Equipment Group D: Steering Gear - 3 occurrences (recurring with CoC)
    {
      seedId: 'RD-D-001',
      vesselName: vessel3,
      issuedDate: '2025-03-01',
      targetDate: '2025-04-01',
      status: 'closed',
      dateCompleted: '2025-03-28',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Steering gear hydraulic leak detected. Emergency steering tested satisfactory.',
      actionRequested: 'Repair hydraulic seals. Conduct steering trials before departure.'
    },
    {
      seedId: 'RD-D-002',
      vesselName: vessel1,
      issuedDate: '2025-06-15',
      targetDate: '2025-07-15',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Steering gear slow response. Hydraulic pump showing signs of wear.',
      actionRequested: 'Overhaul hydraulic pump. Replace worn seals and bearings.'
    },
    {
      seedId: 'RD-D-003',
      vesselName: vessel2,
      issuedDate: '2025-10-01',
      targetDate: '2025-11-01',
      status: 'open',
      isCoC: true,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Fleet-wide steering gear issue. Third vessel reporting similar hydraulic problems.',
      actionRequested: 'Urgent fleet-wide inspection. Manufacturer to review design tolerances.'
    },

    // Equipment Group E: Cargo Hold Ventilation - 2 occurrences
    {
      seedId: 'RD-E-001',
      vesselName: vessel3,
      issuedDate: '2025-04-10',
      targetDate: '2025-05-10',
      status: 'closed',
      dateCompleted: '2025-05-08',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Cargo',
      defectType: 'Ventilation',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Cargo',
        type: 'Hold Ventilation Fan',
        make: 'Kongsberg',
        model: 'KV-3000'
      },
      description: 'Cargo hold #2 ventilation fan motor overheating. Reduced airflow affecting cargo condition.',
      actionRequested: 'Replace fan motor bearings. Check electrical supply and motor windings.'
    },
    {
      seedId: 'RD-E-002',
      vesselName: vessel1,
      issuedDate: '2025-08-25',
      targetDate: '2025-09-25',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Cargo',
      defectType: 'Ventilation',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Cargo',
        type: 'Hold Ventilation Fan',
        make: 'Kongsberg',
        model: 'KV-3000'
      },
      description: 'Same ventilation fan model failing on another vessel. Suspect manufacturing defect.',
      actionRequested: 'Full inspection of all hold ventilation fans fleet-wide.'
    },

    // Single defects (not recurring - for variety)
    {
      seedId: 'RD-F-001',
      vesselName: vessel3,
      issuedDate: '2025-09-01',
      targetDate: '2025-10-01',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Electrical',
      defectType: 'Lighting',
      responsibleRole: '2nd Engineer',
      equipment: {
        category: 'Electrical',
        type: 'Navigation Light',
        make: 'Glamox',
        model: 'NL-200'
      },
      description: 'Port side navigation light flickering. LED driver unit suspected faulty.',
      actionRequested: 'Replace LED driver unit. Test light operation during night watches.'
    }
  ];
}