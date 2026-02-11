import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getPool } from "./db";
import * as fs from "fs";
import * as path from "path";
import { insertRunningHoursAuditSchema, cascadeRunningHoursSchema, insertWorkOrderSchema, insertWorkOrderExecutionSchema, insertDefectSchema, insertDefectActionSchema, insertDefectAttachmentSchema, insertComponentSchema, insertSpareSchema, insertMakerSchema, insertMasterListSchema, insertComponentDocumentSchema, insertComponentClassRegulatorySchema, insertComponentRequisitionSchema, equipmentCategories, defectCategories, defectTypes, shipCertificatesMaster, insertShipCertificateMasterSchema, shipCertificatesLabelsConfig, vesselCertificateApplicability, insertVesselCertificateApplicabilitySchema, vesselCertificateData, vessels, shipSurveysMaster, shipSurveysLabelsConfig, vesselSurveyApplicability, vesselSurveyData } from "@shared/schema";
import { getPostgresClient } from "./postgresClient";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import { shouldGenerateWorkOrder } from "@shared/dateUtils";
import { z } from "zod";
import multer from "multer";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import bulkRouter from "./routes/bulk";
import alertRouter from "./routes/alerts";
import formRouter from "./routes/forms";
import fleetAdminRouter from "./routes/fleetAdmin";
import createChangeRequestsRouter from "./routes/changeRequests";
import { ObjectStorageService, objectStorageClient, parseObjectPath, ObjectNotFoundError } from "./objectStorage";
import { registerRunningHoursRoutes } from "./runningHoursRoutes";
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
  
  // Register V2 Component Module routes (additive — legacy routes remain unchanged)
  const { createV2ComponentModule } = await import("./v2/components/index");
  const v2Components = createV2ComponentModule();
  app.use('/technical/api/v2/components', v2Components.router);
  console.log('V2 Component module registered at /technical/api/v2/components/*');

  // Register V2 Bulk Upload Module routes (additive — legacy /technical/api/bulk routes remain unchanged)
  const { createBulkRouter } = await import("./v2/bulk/routes");
  const v2BulkRouter = createBulkRouter();
  app.use('/technical/api/v2/bulk', v2BulkRouter);
  console.log('V2 Bulk module registered at /technical/api/v2/bulk/*');

  // Register V2 Jobs Module routes (additive — legacy /technical/api/jobs routes remain unchanged)
  const { createV2JobModule } = await import("./v2/jobs/index");
  const v2Jobs = createV2JobModule();
  app.use('/technical/api/v2/jobs', v2Jobs.router);
  app.use('/technical/api/v2/job-maintenance-history', v2Jobs.historyRouter);
  console.log('V2 Jobs module registered at /technical/api/v2/jobs/*');

  const { createWorkOrderRouter } = await import("./v2/work-orders");
  app.use('/technical/api/v2/work-orders', createWorkOrderRouter());
  console.log('V2 Work Orders module registered at /technical/api/v2/work-orders/*');

  const { createSparesRouter } = await import("./v2/spares");
  app.use('/technical/api/v2/spares', createSparesRouter());
  console.log('V2 Spares module registered at /technical/api/v2/spares/*');

  const { registerV2RunningHoursModule } = await import("./v2/running-hours/index");
  registerV2RunningHoursModule(app);

  const { createStoresRouter } = await import("./v2/stores/index");
  app.use('/technical/api/v2/stores', createStoresRouter());
  console.log('V2 Stores module registered at /technical/api/v2/stores/*');

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

  // Components API routes (for Target Picker)
  app.get("/technical/api/components/:vesselId", async (req, res) => {
    try {
      const components = await storage.getComponents(req.params.vesselId);
      // Debug logging for component tree building
      console.log(`📋 GET /technical/api/components/${req.params.vesselId} returning ${components.length} components`);
      components.slice(0, 5).forEach(c => {
        console.log(`  - code: ${c.componentCode}, name: ${c.name?.substring(0, 30)}, parentId: ${c.parentId || 'none'}`);
      });
      res.json(components);
    } catch (error) {
      console.error("Error fetching components:", error);
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });

  // Get single component by ID (for component details)
  app.get("/technical/api/components/details/:id", async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(component);
    } catch (error) {
      console.error("Error fetching component:", error);
      res.status(500).json({ error: "Failed to fetch component" });
    }
  });

  // Component Upload Route
  app.post("/technical/api/components/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
      
      let parsedData: any[] = [];
      let detectedHeaders: string[] = [];
      
      // Parse based on file type
      if (fileExtension === '.csv') {
        const csvContent = file.buffer.toString('utf-8');
        const parseResult = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        });
        parsedData = parseResult.data;
        detectedHeaders = parseResult.meta.fields || [];
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get headers from first row (A1:Z1 range)
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            detectedHeaders.push(String(cell.v));
          }
        }
        
        parsedData = XLSX.utils.sheet_to_json(worksheet);
      } else {
        return res.status(400).json({ error: "Unsupported file format. Please upload CSV, XLS, or XLSX file." });
      }

      // Field mapping from file headers to database fields
      // Supports multiple variations of each column name for flexible Excel import
      const fieldMapping: { [key: string]: string } = {
        // Core identifiers
        'Component ID': 'id',
        'Component Name': 'name',
        'Component Code': 'componentCode',
        'Parent ID': 'parentId',
        'Parent Component Code': 'parentId',
        'Parent Component': 'parentId',
        
        // Category and classification
        'Category': 'category',
        'Component Category': 'componentCategory',
        'Department Category': 'deptCategory',
        'Dept Category': 'deptCategory',
        
        // Vessel identification
        'Vessel ID': 'vesselId',
        'Vessel Code': 'vesselCode',
        
        // Fleet equipment fields
        'Fleet Equipment Code': 'fleetEquipmentCode',
        'Fleet Eqpt Code': 'fleetEquipmentCode',
        'Fleet Equipment Name': 'fleetEquipmentName',
        'Fleet Eqpt Name': 'fleetEquipmentName',
        'Parent Fleet Equipment Code': 'parentFleetEquipmentCode',
        'Parent Fleet Eqpt Code': 'parentFleetEquipmentCode',
        
        // Maker and model information
        'Maker': 'maker',
        'Maker Code': 'makerCode',
        'MakerCode': 'makerCode',
        'Maker No': 'makerCode',
        'Model': 'model',
        'Model Code': 'modelCode',
        'ModelCode': 'modelCode',
        'Model Number': 'modelNumber',
        'Model No': 'modelNumber',
        'Serial No': 'serialNo',
        'SerialNo': 'serialNo',
        'Serial Number': 'serialNo',
        'Drawing No': 'drawingNo',
        'DrawingNo': 'drawingNo',
        'Drawing Number': 'drawingNo',
        
        // Location and department
        'Location': 'location',
        'Department': 'department',
        'Dept': 'department',
        'Eqpt System Dept': 'eqptSystemDept',
        'Equip System Dept': 'eqptSystemDept',
        'Equipment System Department': 'eqptSystemDept',
        
        // Running hours and dates
        'Current Cumulative RH': 'currentCumulativeRH',
        'Running Hours': 'runningHours',
        'RH': 'runningHours',
        'Last Updated': 'lastUpdated',
        'Commissioned Date': 'commissionedDate',
        'Commissioning Date': 'commissionedDate',
        'Installation Date': 'installationDate',
        
        // Boolean flags
        'Critical': 'critical',
        'Critical (Yes/No)': 'critical',
        'Is Critical': 'critical',
        'Class Item': 'classItem',
        'ClassItem': 'classItem',
        'Is Class Item': 'classItem',
        'Condition Based': 'conditionBased',
        'Condition Based (Yes/No)': 'conditionBased',
        'ConditionBased': 'conditionBased',
        'Is Condition Based': 'conditionBased',
        'Is Parent': 'isParent',
        'IsParent': 'isParent',
        'Is Active': 'isActive',
        'IsActive': 'isActive',
        'Active': 'isActive',
        
        // Additional fields
        'Rating': 'rating',
        'Notes': 'notes',
        'Remarks': 'notes',
        'No of Units': 'noOfUnits',
        'Number of Units': 'noOfUnits',
        'Dimensions Size': 'dimensionsSize',
        'Dimensions': 'dimensionsSize',
        'Size': 'dimensionsSize',
        'Scope Notes': 'scopeNotes'
      };

      // Create normalized mapping (case-insensitive, flexible separator matching)
      // Handles: "Vessel Code", "vessel code", "VesselCode", "vessel_code", etc.
      const normalizeKey = (key: string) => key.toLowerCase().trim().replace(/[\s_-]+/g, '');
      const normalizedMapping: { [key: string]: string } = {};
      for (const [fileHeader, dbField] of Object.entries(fieldMapping)) {
        normalizedMapping[normalizeKey(fileHeader)] = dbField;
      }

      // Column detection for user feedback (use actual headers, not first row data)
      let columnInfo: any = null;
      if (detectedHeaders.length > 0) {
        const mappedColumns = detectedHeaders
          .map(col => ({ original: col, mapped: normalizedMapping[normalizeKey(col)] }))
          .filter(c => c.mapped);
        
        const unmappedColumns = detectedHeaders.filter(col => !normalizedMapping[normalizeKey(col)]);
        
        columnInfo = {
          detected: detectedHeaders,
          mapped: mappedColumns, // Return as objects, not strings
          unmapped: unmappedColumns
        };
        
        console.log('📊 Excel Import - Column Detection:');
        console.log('  Detected headers:', detectedHeaders.join(', '));
        console.log('  Successfully mapped columns:', mappedColumns.map(c => `${c.original} → ${c.mapped}`).join(', '));
        if (unmappedColumns.length > 0) {
          console.log('  ⚠️  Unmapped columns (will be ignored):', unmappedColumns.join(', '));
        }
      }

      // Process and validate data
      const errors: any[] = [];
      const processedComponents: any[] = [];
      
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const rowNum = i + 2; // Account for header row
        
        // Map fields with flexible column matching
        const component: any = {};
        for (const [originalHeader, value] of Object.entries(row)) {
          const normalizedHeader = normalizeKey(originalHeader);
          const dbField = normalizedMapping[normalizedHeader];
          
          if (dbField && value !== undefined && value !== null && value !== '') {
            let processedValue = value;
            
            // Convert boolean fields
            const booleanFields = ['critical', 'classItem', 'conditionBased', 'isParent', 'isActive'];
            if (booleanFields.includes(dbField)) {
              if (typeof processedValue === 'string') {
                processedValue = processedValue.toLowerCase() === 'true' || 
                                 processedValue.toLowerCase() === 'yes' || 
                                 processedValue === '1';
              } else if (typeof processedValue === 'boolean') {
                // Already boolean, keep as-is
              } else {
                processedValue = Boolean(processedValue);
              }
            }
            
            // Convert decimal fields
            if ((dbField === 'currentCumulativeRH' || dbField === 'runningHours') && processedValue !== '') {
              const numValue = typeof processedValue === 'number' ? processedValue : parseFloat(String(processedValue));
              if (!isNaN(numValue)) {
                processedValue = numValue.toString();
              }
            }
            
            component[dbField] = processedValue;
          }
        }

        // Validate required fields
        if (!component.id) {
          errors.push({
            row: rowNum,
            field: 'Component ID',
            message: 'Component ID is required',
            data: row
          });
          continue;
        }
        if (!component.name) {
          errors.push({
            row: rowNum,
            field: 'Component Name',
            message: 'Component Name is required',
            data: row
          });
          continue;
        }
        if (!component.componentCategory) {
          errors.push({
            row: rowNum,
            field: 'Component Category',
            message: 'Component Category is required',
            data: row
          });
          continue;
        }
        if (!component.vesselCode) {
          errors.push({
            row: rowNum,
            field: 'Vessel Code',
            message: 'Vessel Code is required - critical for tracking which vessel components belong to',
            data: row
          });
          continue;
        }

        // Set defaults for optional fields
        component.currentCumulativeRH = component.currentCumulativeRH || '0';
        component.critical = component.critical ?? false;
        component.classItem = component.classItem ?? false;

        processedComponents.push(component);
      }

      // If there are no valid components, return error
      if (processedComponents.length === 0 && errors.length > 0) {
        return res.json({
          success: false,
          created: 0,
          updated: 0,
          failed: errors.length,
          errors: errors,
          columnInfo: columnInfo
        });
      }

      // Perform bulk upsert
      const result = await storage.bulkUpsertComponents(processedComponents);
      
      res.json({
        success: errors.length === 0,
        created: result.created,
        updated: result.updated,
        failed: errors.length,
        errors: errors,
        preview: processedComponents.slice(0, 5), // Show first 5 records as preview
        columnInfo: columnInfo
      });

    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process upload: " + error.message });
    }
  });
  
  // Jobs API routes (Job templates linked to components)
  
  // Get all jobs with optional filters
  app.get("/technical/api/jobs", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string | undefined;
      const componentId = req.query.componentId as string | undefined;
      const jobs = await storage.getJobs(vesselId, componentId);
      
      // PERFORMANCE OPTIMIZATION: Batch fetch all job-component links
      // This avoids N+1 queries when hydrating each job
      let jobLinksMap = new Map<string, string[]>();
      // NEW: Also track component-specific tracking data for date overrides
      let jobLinkTrackingMap = new Map<string, any>(); // key: "jobId:componentId" -> link with tracking fields
      
      if (vesselId) {
        const allLinks = await storage.getJobComponentLinks(vesselId);
        for (const link of allLinks) {
          const existing = jobLinksMap.get(link.jobId) || [];
          existing.push(link.componentCode);
          jobLinksMap.set(link.jobId, existing);
          // Store component-specific tracking data
          jobLinkTrackingMap.set(`${link.jobId}:${link.componentId}`, link);
        }
      } else if (jobs.length > 0) {
        // Fallback: fetch links for each unique vesselId found in jobs
        const vesselIds = [...new Set(jobs.map(j => j.vesselId).filter(Boolean))];
        for (const vid of vesselIds) {
          const links = await storage.getJobComponentLinks(vid as string);
          for (const link of links) {
            const existing = jobLinksMap.get(link.jobId) || [];
            existing.push(link.componentCode);
            jobLinksMap.set(link.jobId, existing);
            // Store component-specific tracking data
            jobLinkTrackingMap.set(`${link.jobId}:${link.componentId}`, link);
          }
        }
      }
      
      // PERFORMANCE OPTIMIZATION: Cache component lookups by ID and by code
      const componentCacheById = new Map<string, any>();
      const componentCacheByCode = new Map<string, any>();
      
      const getComponentCached = async (compId: string) => {
        if (!componentCacheById.has(compId)) {
          componentCacheById.set(compId, await storage.getComponent(compId));
        }
        return componentCacheById.get(compId);
      };
      
      const getComponentByCodeCached = async (code: string, vesselId: string) => {
        const key = `${vesselId}:${code}`;
        if (!componentCacheByCode.has(key)) {
          componentCacheByCode.set(key, await storage.getComponentByCode(code, vesselId));
        }
        return componentCacheByCode.get(key);
      };
      
      // Hydrate jobs with:
      // 1. linkedComponentCodes from junction table (for M:N display)
      // 2. Running Hours jobs with component's current RH for remaining RH calculation
      // 3. Component-specific tracking dates (lastDoneDate, nextDueDate, etc.) for ALL linked components
      const hydratedJobs = await Promise.all(jobs.map(async (job) => {
        // MANY-TO-MANY: Get all linked component codes from batched map
        const linkedComponentCodes = jobLinksMap.get(job.id) || [];
        
        // Include the deprecated componentCode if not already in linked list (backwards compatibility)
        if (job.componentCode && !linkedComponentCodes.includes(job.componentCode)) {
          linkedComponentCodes.push(job.componentCode);
        }
        
        // Build component-specific tracking map for ALL linked components
        // Key: componentCode, Value: { lastDoneDate, nextDueDate, lastDoneRH, nextDueRH }
        const componentTracking: Record<string, any> = {};
        for (const [linkKey, link] of jobLinkTrackingMap.entries()) {
          if (linkKey.startsWith(`${job.id}:`)) {
            const compCode = (link as any).componentCode;
            if (compCode) {
              componentTracking[compCode] = {
                lastDoneDate: (link as any).lastDoneDate || null,
                nextDueDate: (link as any).nextDueDate || null,
                lastDoneRH: (link as any).lastDoneRH || null,
                nextDueRH: (link as any).nextDueRH || null,
              };
            }
          }
        }
        
        let hydratedJob: any = {
          ...job,
          linkedComponentCodes, // Array of all linked component codes
          componentTracking, // Map of componentCode -> tracking data
        };
        
        // COMPONENT-SPECIFIC TRACKING: When job has multiple linked components,
        // NULL OUT legacy job-level tracking to force frontend to use componentTracking.
        // This prevents data mixing between components sharing the same job.
        const hasMultipleComponents = Object.keys(componentTracking).length > 1;
        if (hasMultipleComponents) {
          // Force frontend to use componentTracking - don't fall back to global job dates
          hydratedJob.lastDoneDate = null;
          hydratedJob.nextDueDate = null;
          hydratedJob.lastDoneRH = null;
          hydratedJob.nextDueRH = null;
        } else if (componentId) {
          // Single component filter: override with component-specific dates if they exist
          const linkKey = `${job.id}:${componentId}`;
          const componentLink = jobLinkTrackingMap.get(linkKey);
          if (componentLink) {
            if (componentLink.lastDoneDate) {
              hydratedJob.lastDoneDate = componentLink.lastDoneDate;
            }
            if (componentLink.nextDueDate) {
              hydratedJob.nextDueDate = componentLink.nextDueDate;
            }
            if (componentLink.lastDoneRH) {
              hydratedJob.lastDoneRH = componentLink.lastDoneRH;
            }
            if (componentLink.nextDueRH) {
              hydratedJob.nextDueRH = componentLink.nextDueRH;
            }
          }
        }
        
        if (job.maintenanceBasis === 'Running Hours' && job.componentId) {
          const component = await getComponentCached(job.componentId);
          if (component) {
            // Get parent component's running hours if component has a parent
            let currentRH = parseFloat(component.currentCumulativeRH || component.runningHours || '0');
            if (component.parentId && job.vesselId) {
              const parentComponent = await getComponentByCodeCached(component.parentId, job.vesselId);
              if (parentComponent) {
                currentRH = parseFloat(parentComponent.currentCumulativeRH || parentComponent.runningHours || '0');
              }
            }
            hydratedJob.componentCurrentRH = currentRH.toFixed(2);
          }
        }
        return hydratedJob;
      }));
      
      res.json(hydratedJobs);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  
  // Get single job by ID
  app.get("/technical/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Failed to fetch job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });
  
  // Get job context (for job template viewing - Part A hydration)
  app.get("/technical/api/jobs/:id/context", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get component data
      const component = await storage.getComponent(job.componentId);
      
      // Get parent component data if exists
      let parentComponent = null;
      if (component?.parentId) {
        parentComponent = await storage.getComponent(component.parentId);
      }
      
      // Helper function to convert DD-MMM-YYYY to ISO YYYY-MM-DD format for HTML date inputs
      const convertToIsoDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const monthMap: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
          'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        // Handle DD-MMM-YYYY format (e.g., "04-Dec-2025")
        const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          const monthNum = monthMap[month];
          if (monthNum) {
            return `${year}-${monthNum}-${day.padStart(2, '0')}`;
          }
        }
        // If already in ISO format or other format, return as-is
        return dateStr;
      };
      
      // Fetch completed work orders for this job (Work History - Section A5)
      const allWorkOrdersForJob = await storage.getWorkOrdersByJobId(req.params.id);
      const completedWorkOrders = allWorkOrdersForJob.filter(wo => wo.status === 'Completed');
      
      // Map to workHistory format expected by frontend
      // Fields come from actual persisted work order data structure
      // Check both top-level fields and formData for backwards compatibility
      const workHistory = completedWorkOrders.map(wo => {
        const formDataRemarks = (wo.formData as any)?.sectionB2?.remarks || 
                                (wo.formData as any)?.remarks || '';
        return {
          woNo: wo.workOrderNo || wo.woExecutionId || wo.id || '-',
          assignedTo: wo.assignedTo || '-',
          performedBy: wo.performedBy || wo.assignedTo || '-',
          workDate: wo.startDateTime || wo.dueDate || '',
          runDate: wo.runningHours?.toString() || '',
          completionDate: wo.completionDateTime || wo.dateCompleted || '',
          status: wo.status || 'Completed',
          description: wo.workCarriedOut || wo.jobTitle || 'Maintenance completed',
          remarks: wo.completionRemarks || wo.remarks || wo.jobExperienceNotes || formDataRemarks || ''
        };
      });
      
      // Get spare parts, tools, safety requirements from actual job data
      const rawSpareParts = job.requiredSpareParts || [];
      const tools = job.requiredTools || [];
      const safetyReqs = job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] };
      
      // Enrich spare parts with ROB (Remaining On Board) inventory data
      // Primary: Use Part Code (correct design)
      // Fallback: Use Part Number for backward compatibility with legacy data
      const partCodes = rawSpareParts.map((sp: any) => sp.partCode).filter(Boolean);
      const partNumbers = rawSpareParts.map((sp: any) => sp.partNo).filter(Boolean);
      
      const inventoryByPartCode = await storage.getSpareInventoryByPartCodes(job.vesselId, partCodes);
      const inventoryByPartNumber = partNumbers.length > 0 
        ? await storage.getSpareInventoryByPartNumbers(job.vesselId, partNumbers)
        : new Map();
      
      const spareParts = rawSpareParts.map((sp: any) => {
        // Primary lookup: by Part Code (correct design)
        let inventory = sp.partCode ? inventoryByPartCode.get(sp.partCode) : null;
        // Fallback: by Part Number for legacy data compatibility
        if (!inventory && sp.partNo) {
          inventory = inventoryByPartNumber.get(sp.partNo);
        }
        return {
          ...sp,
          rob: inventory ? inventory.rob : null,
          robLocationA: inventory ? inventory.robLocationA : null,
          robLocationB: inventory ? inventory.robLocationB : null
        };
      });
      
      // Build template data from job fields (matching work order form structure)
      const templateData = {
        woTitle: job.jobTitle,
        jobTitle: job.jobTitle,
        jobNo: job.jobNo,
        component: job.componentId,
        componentCode: job.componentCode,
        componentName: job.componentName,
        sfiCode: job.sfiCode || job.componentCode,
        maintenanceBasis: job.maintenanceBasis,
        maintenanceType: job.maintenanceType,
        frequencyValue: job.frequencyValue?.toString() || '',
        frequencyUnit: job.frequencyUnit || 'Months',
        intervalRunningHour: job.intervalRunningHour?.toString() || '',
        assignedTo: job.assignedTo,
        approver: job.approver,
        department: job.department,
        jobPriority: job.jobPriority,
        classRelated: job.classRelated,
        criticality: job.criticality,
        lastDoneDate: convertToIsoDate(job.lastDoneDate),
        nextDueDate: convertToIsoDate(job.nextDueDate),
        lastDoneRH: job.lastDoneRH?.toString() || '',
        nextDueRH: job.nextDueRH?.toString() || '',
        briefWorkDescription: job.briefWorkDescription || job.jobDescription,
        jobDescription: job.jobDescription,
        requiredSpareParts: spareParts,
        requiredTools: tools,
        safetyRequirements: safetyReqs,
        vesselId: job.vesselId,
        workHistory: workHistory
      };
      
      res.json({
        job,
        templateData,
        component: component ? {
          id: component.id,
          componentCode: component.componentCode,
          name: component.name,
          parentId: component.parentId,
          currentCumulativeRH: component.currentCumulativeRH,
          lastUpdated: component.lastUpdated
        } : null,
        parentComponent: parentComponent ? {
          id: parentComponent.id,
          componentCode: parentComponent.componentCode,
          name: parentComponent.name,
          currentCumulativeRH: parentComponent.currentCumulativeRH
        } : null,
        maintenanceBasis: job.maintenanceBasis
      });
    } catch (error) {
      console.error("Failed to fetch job context:", error);
      res.status(500).json({ error: "Failed to fetch job context" });
    }
  });
  
  // Create new job
  app.post("/technical/api/jobs", async (req, res) => {
    try {
      const { insertJobSchema } = await import("@shared/schema");
      const { calculateNextDueDate } = await import("@shared/dateUtils");
      let jobData = insertJobSchema.parse(req.body);
      
      // GLOBAL BUSINESS RULES COMPLIANCE (Section 3.3):
      // Jobs belong to sub-components, not parent components
      // Validate that the component is a sub-component (has a parent)
      let component: any = null;
      if (jobData.componentId) {
        // First try to look up by ID
        component = await storage.getComponent(jobData.componentId);
        
        // If not found by ID, try looking up by component code (for Add Job flow)
        if (!component && jobData.componentCode && jobData.vesselId) {
          component = await storage.getComponentByCode(jobData.componentCode, jobData.vesselId);
          // Update componentId to the actual component ID if found
          if (component) {
            jobData = { ...jobData, componentId: component.id };
          }
        }
        
        if (!component) {
          return res.status(400).json({ 
            error: "Component not found" 
          });
        }
        if (!component.parentId) {
          return res.status(400).json({ 
            error: "Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component." 
          });
        }
        
        // AUTO-CORRECT: Use component's actual code from database, not passed-in value
        if (component.componentCode) {
          if (jobData.componentCode && jobData.componentCode !== component.componentCode) {
            console.warn(`⚠️ AUTO-CORRECTING job componentCode mismatch: passed "${jobData.componentCode}" but component "${component.name}" has code "${component.componentCode}"`);
          }
          jobData = { ...jobData, componentCode: component.componentCode };
          console.log(`✅ Auto-resolved job componentCode: ${component.componentCode} for component "${component.name}"`);
        }
      }
      
      // Auto-generate job number if not provided (format: MKR-XX-NNNNN)
      if (!jobData.jobNo) {
        const { generateJobNumber } = await import('./utils/workOrderNumbering');
        const taskType = (jobData as any).taskType;
        const generatedJobNo = await generateJobNumber(storage, taskType);
        jobData = {
          ...jobData,
          jobNo: generatedJobNo
        };
      }
      
      // AUTO-CALCULATE nextDueDate for Calendar-based jobs
      // Per documentation: nextDueDate = lastDoneDate + frequencyValue + frequencyUnit
      if (jobData.maintenanceBasis === 'Calendar' && !jobData.nextDueDate) {
        const { normalizeDateToDDMMMYYYY } = await import("@shared/dateUtils");
        const rawLastDone = jobData.lastDoneDate || (component?.installationDate);
        if (rawLastDone && jobData.frequencyValue && jobData.frequencyUnit) {
          // Normalize date before calculation to handle various formats
          const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
          if (lastDone) {
            const calculatedNextDue = calculateNextDueDate(lastDone, jobData.frequencyValue, jobData.frequencyUnit);
            if (calculatedNextDue) {
              jobData = { ...jobData, nextDueDate: calculatedNextDue };
            }
          }
        }
      }
      
      // AUTO-CALCULATE nextDueRH for Running Hours-based jobs
      // Per documentation: nextDueRH = lastDoneRH + intervalRunningHour
      // NOTE: Only use intervalRunningHour, never fall back to frequencyValue (per schema)
      // VALIDATION: intervalRunningHour is required for RH jobs and must be a valid number > 0
      // VALIDATION: lastDoneRH (or component runningHours) is required to calculate nextDueRH
      if (jobData.maintenanceBasis === 'Running Hours') {
        const intervalRH = Number(jobData.intervalRunningHour);
        if (isNaN(intervalRH) || intervalRH <= 0) {
          return res.status(400).json({ 
            error: "Running Hours jobs require a valid numeric intervalRunningHour greater than 0" 
          });
        }
        
        // Determine lastDoneRH from job data or component
        const rawLastDoneRH = jobData.lastDoneRH || (component?.runningHours ? String(component.runningHours) : null);
        
        if (!rawLastDoneRH) {
          return res.status(400).json({ 
            error: "Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH" 
          });
        }
        
        const lastRH = Number(rawLastDoneRH);
        if (isNaN(lastRH)) {
          return res.status(400).json({ 
            error: "lastDoneRH must be a valid number" 
          });
        }
        
        // Always calculate nextDueRH for RH jobs
        const calculatedNextDueRH = String(lastRH + intervalRH);
        jobData = { 
          ...jobData, 
          nextDueRH: calculatedNextDueRH,
          lastDoneRH: String(lastRH)
        };
      }
      
      const job = await storage.createJob(jobData);
      res.status(201).json(job);
    } catch (error: any) {
      console.error("Failed to create job:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create job" });
    }
  });
  
  // Update job
  app.patch("/technical/api/jobs/:id", async (req, res) => {
    try {
      const { calculateNextDueDate } = await import("@shared/dateUtils");
      let updateData = { ...req.body };
      
      // GLOBAL BUSINESS RULES COMPLIANCE (Section 3.3):
      // Jobs belong to sub-components, not parent components
      // Validate component change if componentId is being updated
      let component: any = null;
      if (req.body.componentId) {
        component = await storage.getComponent(req.body.componentId);
        if (!component) {
          return res.status(400).json({ 
            error: "Component not found" 
          });
        }
        if (!component.parentId) {
          return res.status(400).json({ 
            error: "Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component." 
          });
        }
      }
      
      // Get existing job to merge data for calculations
      const existingJob = await storage.getJob(req.params.id);
      if (!existingJob) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Merge existing job data with updates for calculation purposes
      const mergedData = { ...existingJob, ...updateData };
      
      // RECALCULATE nextDueDate if relevant fields changed for Calendar-based jobs
      // Per documentation: nextDueDate = lastDoneDate + frequencyValue + frequencyUnit
      const calendarFieldsChanged = 
        updateData.lastDoneDate !== undefined || 
        updateData.frequencyValue !== undefined || 
        updateData.frequencyUnit !== undefined ||
        updateData.maintenanceBasis !== undefined;
      
      if (mergedData.maintenanceBasis === 'Calendar' && calendarFieldsChanged) {
        const { normalizeDateToDDMMMYYYY } = await import("@shared/dateUtils");
        // Get component for installation date fallback
        if (!component && mergedData.componentId) {
          component = await storage.getComponent(mergedData.componentId);
        }
        const rawLastDone = mergedData.lastDoneDate || (component?.installationDate);
        if (rawLastDone && mergedData.frequencyValue && mergedData.frequencyUnit) {
          // Normalize date before calculation to handle various formats
          const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
          if (lastDone) {
            const calculatedNextDue = calculateNextDueDate(lastDone, mergedData.frequencyValue, mergedData.frequencyUnit);
            if (calculatedNextDue) {
              updateData.nextDueDate = calculatedNextDue;
            }
          }
        }
      } else if (updateData.maintenanceBasis === 'Running Hours' && existingJob.maintenanceBasis === 'Calendar') {
        // Switching from Calendar to RH: clear calendar-specific fields
        updateData.nextDueDate = null;
      }
      
      // RECALCULATE nextDueRH if relevant fields changed for Running Hours-based jobs
      // Per documentation: nextDueRH = lastDoneRH + intervalRunningHour
      // NOTE: Only use intervalRunningHour, never fall back to frequencyValue (per schema)
      // VALIDATION: When maintenanceBasis is Running Hours, intervalRunningHour must be valid
      const rhFieldsChanged = 
        updateData.lastDoneRH !== undefined || 
        updateData.intervalRunningHour !== undefined || 
        updateData.maintenanceBasis !== undefined;
      
      if (mergedData.maintenanceBasis === 'Running Hours') {
        const intervalRH = Number(mergedData.intervalRunningHour);
        
        // Validate interval is present and a valid number > 0 for RH jobs
        if (isNaN(intervalRH) || intervalRH <= 0) {
          return res.status(400).json({ 
            error: "Running Hours jobs require a valid numeric intervalRunningHour greater than 0" 
          });
        }
        
        // Get component for running hours fallback
        if (!component && mergedData.componentId) {
          component = await storage.getComponent(mergedData.componentId);
        }
        
        // Determine lastDoneRH from job data or component
        const rawLastDoneRH = mergedData.lastDoneRH || (component?.runningHours ? String(component.runningHours) : null);
        
        if (!rawLastDoneRH) {
          return res.status(400).json({ 
            error: "Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH" 
          });
        }
        
        const lastRH = Number(rawLastDoneRH);
        if (isNaN(lastRH)) {
          return res.status(400).json({ 
            error: "lastDoneRH must be a valid number" 
          });
        }
        
        // Always recalculate nextDueRH when RH fields change
        if (rhFieldsChanged) {
          updateData.nextDueRH = String(lastRH + intervalRH);
          if (!mergedData.lastDoneRH) {
            updateData.lastDoneRH = String(lastRH);
          }
        }
      } else if (updateData.maintenanceBasis === 'Calendar' && existingJob.maintenanceBasis === 'Running Hours') {
        // Switching from RH to Calendar: clear RH-specific fields
        updateData.nextDueRH = null;
      }
      
      const job = await storage.updateJob(req.params.id, updateData);
      res.json(job);
    } catch (error) {
      console.error("Failed to update job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });
  
  // Delete job
  app.delete("/technical/api/jobs/:id", async (req, res) => {
    try {
      await storage.deleteJob(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete job:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // ============================================================================
  // MAINTENANCE PLANNER API - Read-only aggregation view for planning
  // ============================================================================
  
  app.get("/technical/api/maintenance-planner", async (req, res) => {
    try {
      const {
        vesselId,
        jobType, // 'CALENDAR' | 'RH' | 'BOTH'
        fromDate, // ISO date string for calendar jobs
        toDate,
        remainingHoursMin, // For RH jobs
        remainingHoursMax,
        includeOverdue, // boolean string
        includeGrace, // boolean string - whether to include DUE_GRACE items
        ranks, // comma-separated ranks
        department,
        criticalOnly // boolean string
      } = req.query;

      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      // Fetch vessel PMS settings for grace period configuration
      // This aligns with work order table status logic
      const vesselSettings = await storage.getPmsVesselSettings(vesselId as string);
      const vesselGraceSettings = vesselSettings ? {
        calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
        calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
        rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
        rhLeadTimeHours: vesselSettings.rhLeadTimeHours ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
      } : {
        calendarGraceMode: 'COMPANY_STANDARD' as const,
        calendarGraceDays: WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
        rhGraceHours: WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
        rhLeadTimeHours: WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
      };

      // Fetch all active jobs for the vessel
      const allJobs = await storage.getJobs(vesselId as string);
      const activeJobs = allJobs.filter(j => j.isActive !== false && j.dataScope === 'vessel');

      // Fetch all components for RH lookup
      const components = await storage.getComponents(vesselId as string);
      const componentMap = new Map(components.map(c => [c.id, c]));
      const componentCodeMap = new Map(components.map(c => [c.componentCode, c]));

      // Fetch job-component links (many-to-many relationships)
      // This is the PRIMARY source of truth for which components each job is linked to
      const jobComponentLinks = await storage.getJobComponentLinks(vesselId as string);
      
      // Build a map of jobId -> array of linked componentIds
      const jobToComponentsMap = new Map<string, Set<string>>();
      for (const link of jobComponentLinks) {
        if (!jobToComponentsMap.has(link.jobId)) {
          jobToComponentsMap.set(link.jobId, new Set());
        }
        jobToComponentsMap.get(link.jobId)!.add(link.componentId);
      }

      // Fetch all work orders to check for open WOs
      const allWorkOrders = await storage.getWorkOrders(vesselId as string);
      
      // Fetch spares for spare status calculation
      const allSpares = await storage.getSpares(vesselId as string);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Process each job and compute planning data
      // IMPORTANT: A job can be linked to MULTIPLE components via jobComponentLinks
      // Each job-component pair is a separate planner row
      const plannerItems: any[] = [];

      // Build list of job-component pairs to process
      // Each pair represents one planner row
      interface JobComponentPair {
        job: typeof activeJobs[0];
        componentId: string;
        component: typeof components[0] | undefined;
      }
      
      const jobComponentPairs: JobComponentPair[] = [];
      
      for (const job of activeJobs) {
        const linkedComponentIds = jobToComponentsMap.get(job.id);
        
        if (linkedComponentIds && linkedComponentIds.size > 0) {
          // Job has entries in jobComponentLinks - use those (many-to-many)
          for (const componentId of linkedComponentIds) {
            const component = componentMap.get(componentId);
            jobComponentPairs.push({ job, componentId, component });
          }
        } else {
          // Fallback: Use deprecated componentId/componentCode fields (backward compatibility)
          const component = componentMap.get(job.componentId) || componentCodeMap.get(job.componentCode);
          if (component) {
            jobComponentPairs.push({ job, componentId: component.id, component });
          } else if (job.componentId || job.componentCode) {
            // Job references a component that doesn't exist - still include for visibility
            jobComponentPairs.push({ job, componentId: job.componentId || '', component: undefined });
          }
        }
      }

      // Now process each job-component pair
      for (const { job, componentId, component } of jobComponentPairs) {
        
        // Determine job type (Calendar vs Running Hours)
        const isCalendarJob = job.maintenanceBasis === 'Calendar' || job.frequencyType === 'Calendar';
        const isRHJob = job.maintenanceBasis === 'Running Hours' || job.frequencyType === 'Running Hours';
        
        // Apply job type filter
        const jobTypeFilter = (jobType as string)?.toUpperCase();
        if (jobTypeFilter === 'CALENDAR' && !isCalendarJob) continue;
        if (jobTypeFilter === 'RH' && !isRHJob) continue;

        // Apply department filter - check both job.department and component.department
        if (department && department !== 'all') {
          const jobDept = job.department || component?.department || '';
          if (jobDept !== department) continue;
        }

        // Apply rank filter - use exact match (case-insensitive) instead of substring includes
        if (ranks) {
          const rankList = (ranks as string).split(',').map(r => r.trim().toLowerCase());
          const assignedRank = (job.assignedTo || '').trim().toLowerCase();
          // FIXED: Use exact match instead of substring includes to prevent "AB" matching "Cable"
          if (rankList.length > 0 && !rankList.some(r => r === assignedRank)) continue;
        }

        // Apply criticality filter
        if (criticalOnly === 'true') {
          const isCritical = job.criticality === 'Yes' || job.jobPriority === 'Critical' || component?.critical;
          if (!isCritical) continue;
        }

        // Calculate status and dates - ALIGNED WITH WORK ORDER TABLE LOGIC
        // Uses grace period configuration from vessel settings
        let nextDueDate: Date | null = null;
        let remainingHours: number | null = null;
        let status: 'OVERDUE' | 'DUE_GRACE' | 'DUE_SOON' | 'FUTURE' = 'FUTURE';
        let parentRH: number | null = null;

        if (isCalendarJob) {
          // Parse next due date
          if (job.nextDueDate) {
            nextDueDate = new Date(job.nextDueDate);
          } else if (job.lastDoneDate && job.frequencyValue && job.frequencyUnit) {
            // Calculate from last done
            const lastDone = new Date(job.lastDoneDate);
            const freqVal = parseInt(job.frequencyValue) || 0;
            nextDueDate = new Date(lastDone);
            switch (job.frequencyUnit) {
              case 'Days': nextDueDate.setDate(nextDueDate.getDate() + freqVal); break;
              case 'Weeks': nextDueDate.setDate(nextDueDate.getDate() + freqVal * 7); break;
              case 'Months': nextDueDate.setMonth(nextDueDate.getMonth() + freqVal); break;
              case 'Years': nextDueDate.setFullYear(nextDueDate.getFullYear() + freqVal); break;
            }
          }

          if (nextDueDate) {
            const dueDateTime = new Date(nextDueDate);
            dueDateTime.setHours(0, 0, 0, 0);
            
            const daysUntilDue = Math.floor((dueDateTime.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            // Calculate grace end date based on vessel settings (same as work order logic)
            let graceEndDate: Date;
            if (vesselGraceSettings.calendarGraceMode === 'CUSTOM_DAYS') {
              // Use custom fixed grace period
              graceEndDate = new Date(dueDateTime);
              graceEndDate.setDate(graceEndDate.getDate() + vesselGraceSettings.calendarGraceDays);
              graceEndDate.setHours(0, 0, 0, 0);
            } else {
              // COMPANY_STANDARD: If due date is in last 7 days of month → grace = 7 days
              // Otherwise → grace extends to end of the due month
              const endOfMonth = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth() + 1, 0);
              endOfMonth.setHours(0, 0, 0, 0);
              const daysUntilEndOfMonth = endOfMonth.getDate() - dueDateTime.getDate();
              
              if (daysUntilEndOfMonth <= 7) {
                // Due date is in last 7 days of month - use fixed 7-day grace
                graceEndDate = new Date(dueDateTime);
                graceEndDate.setDate(graceEndDate.getDate() + WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS);
                graceEndDate.setHours(0, 0, 0, 0);
              } else {
                // Grace extends to end of month
                graceEndDate = endOfMonth;
              }
            }
            
            // Status logic aligned with work order table:
            // - OVERDUE: today is past grace end date
            // - DUE_GRACE: past due date but within grace (today <= grace end date)
            // - DUE_SOON: approaching but not yet due (positive days within lead time)
            // - FUTURE: more than lead time away
            if (daysUntilDue < 0) {
              // Past due date - check if we're still in grace period
              if (today > graceEndDate) {
                status = 'OVERDUE';
              } else {
                status = 'DUE_GRACE';
              }
            } else if (daysUntilDue <= WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS) {
              status = 'DUE_SOON';
            } else {
              status = 'FUTURE';
            }

            // Apply date range filter
            if (fromDate || toDate) {
              const from = fromDate ? new Date(fromDate as string) : new Date(0);
              const to = toDate ? new Date(toDate as string) : new Date('2099-12-31');
              
              // Skip overdue/grace items based on filter settings
              if (status === 'OVERDUE' && includeOverdue !== 'true') continue;
              if (status === 'DUE_GRACE' && includeOverdue !== 'true' && includeGrace !== 'true') continue;
              if (status !== 'OVERDUE' && status !== 'DUE_GRACE' && (nextDueDate < from || nextDueDate > to)) continue;
            }
          }
        } else if (isRHJob) {
          // Find parent component for RH
          // FIXED: Use componentMap (by ID) instead of componentCodeMap (by code)
          // since parentId contains an ID, not a component code
          let parentComponent = component;
          if (component?.parentId) {
            parentComponent = componentMap.get(component.parentId) || component;
          }
          
          parentRH = parseFloat(parentComponent?.currentCumulativeRH || '0') || 0;
          const lastDoneRH = parseFloat(job.lastDoneRH || '0') || 0;
          const frequencyRH = parseInt(job.frequencyValue || '0') || job.intervalRunningHour || 0;
          
          // Calculate RH due and remaining using work order logic
          const rhDue = lastDoneRH + frequencyRH;
          const rhRemaining = rhDue - parentRH;
          remainingHours = Math.max(0, rhRemaining);

          // Get lead time from vessel settings or job-level settings
          const leadTimeHours = vesselGraceSettings.rhLeadTimeHours;
          const graceHours = vesselGraceSettings.rhGraceHours;

          // Status logic aligned with work order table (spec-compliant):
          // - OVERDUE: Past due RH AND past grace period (rhRemaining < -graceHours)
          // - DUE_GRACE: Past due RH but within grace period (-graceHours <= rhRemaining < 0)
          // - DUE_SOON: Within lead time (0 <= rhRemaining <= leadTimeHours)
          // - FUTURE: Beyond lead time (rhRemaining > leadTimeHours)
          if (rhRemaining < -graceHours) {
            status = 'OVERDUE';
          } else if (rhRemaining < 0) {
            status = 'DUE_GRACE';
          } else if (rhRemaining <= leadTimeHours) {
            status = 'DUE_SOON';
          } else {
            status = 'FUTURE';
          }

          // Apply RH range filter
          if (remainingHoursMin || remainingHoursMax) {
            const minRH = parseFloat(remainingHoursMin as string) || 0;
            const maxRH = parseFloat(remainingHoursMax as string) || Infinity;
            
            // Skip overdue/grace items based on filter settings
            if (status === 'OVERDUE' && includeOverdue !== 'true') continue;
            if (status === 'DUE_GRACE' && includeOverdue !== 'true' && includeGrace !== 'true') continue;
            if (status !== 'OVERDUE' && status !== 'DUE_GRACE' && (remainingHours < minRH || remainingHours > maxRH)) continue;
          }
        }

        // Skip overdue/grace items when filters exclude them
        if (status === 'OVERDUE' && includeOverdue !== 'true') {
          continue;
        }
        if (status === 'DUE_GRACE' && includeOverdue !== 'true' && includeGrace !== 'true') {
          continue;
        }

        // Find work orders for this job - include both open AND completed WOs
        // Priority: open WO > most recent completed WO
        const jobWOs = allWorkOrders.filter(wo => wo.jobId === job.id);
        const openWO = jobWOs.find(wo => 
          wo.status !== 'Completed' && 
          wo.status !== 'Rejected'
        );
        // If no open WO, find the most recent completed or rejected one
        const completedWO = !openWO ? jobWOs.find(wo => 
          wo.status === 'Completed' || wo.status === 'Rejected'
        ) : null;
        const relevantWO = openWO || completedWO;

        // Calculate spare status
        let spareStatus: 'OK' | 'LOW' | 'ZERO' | 'NOT_SET' = 'NOT_SET';
        const requiredSpares = job.requiredSpareParts as any[] || [];
        
        if (requiredSpares.length > 0) {
          let hasZero = false;
          let hasLow = false;
          
          for (const reqSpare of requiredSpares) {
            // Primary match: by Part Code (correct design)
            // Fallback: by Part Number or description for legacy compatibility
            const spare = allSpares.find(s => 
              (reqSpare.partCode && s.partCode === reqSpare.partCode) ||
              (reqSpare.partNo && s.partCode === reqSpare.partNo) ||
              s.partName === reqSpare.description
            );
            if (spare) {
              if (spare.rob === 0) hasZero = true;
              else if (spare.rob < spare.min) hasLow = true;
            }
          }
          
          if (hasZero) spareStatus = 'ZERO';
          else if (hasLow) spareStatus = 'LOW';
          else spareStatus = 'OK';
        }

        // Build planner item using the component from the job-component pair
        // This ensures multi-component jobs appear as separate rows
        plannerItems.push({
          jobId: job.id,
          jobCode: job.jobNo,
          jobTitle: job.jobTitle,
          jobType: isCalendarJob ? 'CALENDAR' : 'RH',
          componentId: componentId,
          componentCode: component?.componentCode || job.componentCode || '',
          componentName: component?.name || job.componentName || '',
          department: job.department || component?.department || 'N/A',
          assignedRank: job.assignedTo || 'Unassigned',
          criticalFlag: job.criticality === 'Yes' || job.jobPriority === 'Critical' || component?.critical || false,
          classRelatedFlag: job.classRelated === 'Yes',
          estimatedManHours: parseFloat(job.estimatedManHours || '0') || 0,
          nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
          remainingHours: remainingHours,
          parentRH: parentRH,
          status: status,
          woId: relevantWO?.id || null,
          woNo: relevantWO?.workOrderNo || null,
          woStatus: relevantWO?.status || null,
          spareStatus: spareStatus,
          frequencyValue: job.frequencyValue,
          frequencyUnit: job.frequencyUnit,
          lastDoneDate: job.lastDoneDate,
          lastDoneRH: job.lastDoneRH
        });
      }

      // Sort by status priority and due date/remaining hours
      // Priority order aligned with work order table: OVERDUE > DUE_GRACE > DUE_SOON > FUTURE
      const statusPriority: Record<string, number> = {
        'OVERDUE': 0,
        'DUE_GRACE': 1,
        'DUE_SOON': 2,
        'FUTURE': 3
      };

      plannerItems.sort((a, b) => {
        // First by status
        const statusDiff = statusPriority[a.status] - statusPriority[b.status];
        if (statusDiff !== 0) return statusDiff;
        
        // Then by due date (nearest first) for calendar jobs
        if (a.jobType === 'CALENDAR' && b.jobType === 'CALENDAR') {
          if (a.nextDueDate && b.nextDueDate) {
            return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
          }
        }
        
        // By remaining hours (lowest first) for RH jobs
        if (a.jobType === 'RH' && b.jobType === 'RH') {
          return (a.remainingHours || 0) - (b.remainingHours || 0);
        }
        
        return 0;
      });

      // Calculate summary metrics
      // Sum actual manhours from completed/approved work orders for the vessel
      const completedStatuses = ['Completed', 'completed', 'Approved', 'approved'];
      const totalManHours = allWorkOrders
        .filter(wo => completedStatuses.includes(wo.status || ''))
        .reduce((sum, wo) => {
          const manhours = parseFloat(wo.manhours || '0');
          return sum + (isNaN(manhours) ? 0 : manhours);
        }, 0);
      
      const byRank: Record<string, { jobs: number; manHours: number }> = {};
      for (const item of plannerItems) {
        const rank = item.assignedRank || 'Unassigned';
        if (!byRank[rank]) byRank[rank] = { jobs: 0, manHours: 0 };
        byRank[rank].jobs++;
        byRank[rank].manHours += item.estimatedManHours;
      }

      const byDepartment: Record<string, { jobs: number; manHours: number }> = {};
      for (const item of plannerItems) {
        const dept = item.department || 'N/A';
        if (!byDepartment[dept]) byDepartment[dept] = { jobs: 0, manHours: 0 };
        byDepartment[dept].jobs++;
        byDepartment[dept].manHours += item.estimatedManHours;
      }

      // byStatus now includes DUE_GRACE to align with work order table logic
      const byStatus: Record<string, number> = { OVERDUE: 0, DUE_GRACE: 0, DUE_SOON: 0, FUTURE: 0 };
      for (const item of plannerItems) {
        byStatus[item.status]++;
      }

      res.json({
        summary: {
          totalJobs: plannerItems.length,
          totalManHours: Math.round(totalManHours * 10) / 10,
          byRank: Object.entries(byRank).map(([rank, data]) => ({
            rank,
            jobs: data.jobs,
            manHours: Math.round(data.manHours * 10) / 10
          })),
          byDepartment: Object.entries(byDepartment).map(([dept, data]) => ({
            department: dept,
            jobs: data.jobs,
            manHours: Math.round(data.manHours * 10) / 10
          })),
          byStatus
        },
        jobs: plannerItems
      });
    } catch (error: any) {
      console.error("Maintenance planner error:", error);
      res.status(500).json({ error: "Failed to fetch maintenance planner data: " + error.message });
    }
  });

  // Maintenance Planner Export endpoint
  app.get("/technical/api/maintenance-planner/export", async (req, res) => {
    try {
      const format = req.query.format as string || 'excel';
      const vesselId = req.query.vesselId as string;

      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      // Reuse the same logic - call the planner endpoint internally
      const plannerResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/technical/api/maintenance-planner?${new URLSearchParams(req.query as Record<string, string>).toString()}`);
      const plannerData = await plannerResponse.json();

      if (format === 'excel') {
        // Generate Excel file
        const wb = XLSX.utils.book_new();
        
        // Jobs sheet
        const jobsData = plannerData.jobs.map((job: any) => ({
          'Job Code': job.jobCode,
          'Job Title': job.jobTitle,
          'Component Code': job.componentCode,
          'Component Name': job.componentName,
          'Department': job.department,
          'Assigned Rank': job.assignedRank,
          'Job Type': job.jobType,
          'Next Due Date': job.nextDueDate || '-',
          'Remaining Hours': job.remainingHours !== null ? job.remainingHours : '-',
          'Status': job.status,
          'Est. Man-Hours': job.estimatedManHours,
          'Spare Status': job.spareStatus,
          'WO No.': job.woNo || '-',
          'WO Status': job.woStatus || '-',
          'Critical': job.criticalFlag ? 'Yes' : 'No',
          'Class Related': job.classRelatedFlag ? 'Yes' : 'No'
        }));
        
        const ws = XLSX.utils.json_to_sheet(jobsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Maintenance Planner');

        // Summary sheet
        const summaryData = [
          { 'Metric': 'Total Jobs', 'Value': plannerData.summary.totalJobs },
          { 'Metric': 'Total Man-Hours', 'Value': plannerData.summary.totalManHours },
          { 'Metric': 'Overdue Jobs', 'Value': plannerData.summary.byStatus.OVERDUE },
          { 'Metric': 'Due Soon Jobs', 'Value': plannerData.summary.byStatus.DUE_SOON },
          { 'Metric': 'Future Jobs', 'Value': plannerData.summary.byStatus.FUTURE }
        ];
        const summaryWs = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        // Workload by Rank sheet
        const rankData = plannerData.summary.byRank.map((r: any) => ({
          'Rank': r.rank,
          'Jobs': r.jobs,
          'Man-Hours': r.manHours
        }));
        const rankWs = XLSX.utils.json_to_sheet(rankData);
        XLSX.utils.book_append_sheet(wb, rankWs, 'Workload by Rank');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=maintenance-planner-${new Date().toISOString().split('T')[0]}.xlsx`);
        res.send(buffer);
      } else {
        // Return JSON for PDF generation (frontend will handle PDF rendering)
        res.json(plannerData);
      }
    } catch (error: any) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export maintenance planner: " + error.message });
    }
  });
  
  // Component Documents API routes
  // Component Documents API routes (with file upload support)
  app.get("/technical/api/component-documents/:componentId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // First, verify the component exists and check vessel access
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (component.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot access documents for components from other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      
      const documents = await storage.getComponentDocuments(req.params.componentId);
      
      // Filter documents based on user role and permissions
      const filteredDocuments = documents.filter(doc => {
        if (!req.user) return false;
        
        // PMS Admin and Office can see all documents
        if (req.user.role === "PMS Admin" || req.user.role === "Office") {
          return true;
        }
        
        // Ship users can only see documents with canShipView=true (already vessel-scoped above)
        if (req.user.role === "Ship") {
          return doc.canShipView;
        }
        
        return false;
      });
      
      res.json(filteredDocuments);
    } catch (error) {
      console.error("Failed to get component documents:", error);
      res.status(500).json({ error: "Failed to get component documents" });
    }
  });
  
  // Upload component document with file (PMS Admin only)
  app.post("/technical/api/component-documents", requirePMSAdmin, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      // Enforce file presence - document uploads must include a file
      if (!req.file) {
        return res.status(400).json({ error: "File upload required - cannot create document without a file" });
      }
      
      // Validate componentId exists and componentCode matches before processing upload
      const component = await storage.getComponent(req.body.componentId);
      if (!component) {
        return res.status(400).json({ error: "Invalid componentId - component not found" });
      }
      
      // Verify componentCode matches the component
      if (component.componentCode !== req.body.componentCode) {
        return res.status(400).json({ 
          error: "componentCode mismatch - does not match component's code",
          componentCode: component.componentCode,
          providedCode: req.body.componentCode
        });
      }
      
      // Verify vesselCode matches component
      if (component.vesselCode !== req.body.vesselCode) {
        return res.status(400).json({ 
          error: "vesselCode mismatch - does not match component's vessel",
          componentVessel: component.vesselCode,
          providedVessel: req.body.vesselCode
        });
      }
      
      // Upload file to object storage (PostgreSQL-only mode - no local file fallback)
      const timestamp = Date.now();
      const safeFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `${component.componentCode}/${timestamp}_${safeFileName}`;
      const fileSize = req.file.size;
      
      const storageBackend: 'object' = 'object';
      
      // Object storage is required - no fallback to local storage
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        console.error("❌ Object storage not configured - DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
        return res.status(500).json({ 
          error: "Object storage not configured. Please set up object storage in the Replit Object Storage panel."
        });
      }
      
      try {
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(`.private/documents/${fileKey}`);
        await file.save(req.file.buffer, {
          metadata: {
            contentType: req.file.mimetype
          }
        });
        console.log(`📤 Uploaded file to object storage: ${fileKey}`);
      } catch (storageError) {
        console.error("❌ Object storage upload failed:", storageError);
        return res.status(500).json({ error: "Failed to upload file to object storage" });
      }
      
      // Multer leaves all form fields as strings, so coerce types explicitly
      // Use validated component data to ensure consistency
      const coercedBody = {
        componentId: component.id, // Use validated component data
        componentCode: component.componentCode, // Use validated component data
        vesselCode: component.vesselCode, // Use validated component data
        fleetEquipmentCode: req.body.fleetEquipmentCode || null,
        fileName: req.body.fileName,
        fileType: req.body.fileType,
        version: req.body.version || "1.0",
        canShipView: req.body.canShipView === 'true' || req.body.canShipView === true,
        canShipDownload: req.body.canShipDownload === 'true' || req.body.canShipDownload === true,
        isActive: req.body.isActive === 'true' || req.body.isActive === true || req.body.isActive === undefined,
        notes: req.body.notes || null,
        uploadedBy: req.user!.username,
        fileKey, // Already set from upload
        fileSize, // Already a number from multer
        storageBackend // Track where file is stored (now part of schema)
      };
      
      // Now validate with complete, properly-typed data
      const documentData = insertComponentDocumentSchema.parse(coercedBody);
      
      // Create document in storage atomically
      try {
        const document = await storage.createComponentDocument(documentData);
        res.json(document);
      } catch (dbError) {
        // Rollback: delete uploaded file if DB insert fails
        console.error("Failed to create document in database, rolling back file upload:", dbError);
        try {
          const bucket = objectStorageClient.bucket(bucketId);
          const file = bucket.file(`.private/documents/${fileKey}`);
          await file.delete();
        } catch (deleteError) {
          console.error("Failed to cleanup uploaded file after DB error:", deleteError);
        }
        return res.status(500).json({ error: "Failed to create document record" });
      }
    } catch (error: any) {
      console.error("Failed to create component document:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create component document" });
    }
  });
  
  // Update component document metadata (PMS Admin only)
  // Note: File replacement not supported - create new document version instead
  app.put("/technical/api/component-documents/:id", requirePMSAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Create update schema that excludes immutable fields
      const updateSchema = insertComponentDocumentSchema.pick({
        version: true,
        canShipView: true,
        canShipDownload: true,
        isActive: true,
        notes: true
      }).partial();
      
      // Helper to parse boolean from string/boolean, preserving undefined
      const parseBoolean = (value: any): boolean | undefined => {
        if (value === undefined || value === null) return undefined;
        if (value === true || value === 'true') return true;
        if (value === false || value === 'false') return false;
        return undefined; // Invalid value
      };
      
      // Build update object with only provided fields to preserve existing values
      const updateData: any = {};
      
      if (req.body.version !== undefined) {
        updateData.version = req.body.version;
      }
      const parsedCanShipView = parseBoolean(req.body.canShipView);
      if (parsedCanShipView !== undefined) {
        updateData.canShipView = parsedCanShipView;
      }
      const parsedCanShipDownload = parseBoolean(req.body.canShipDownload);
      if (parsedCanShipDownload !== undefined) {
        updateData.canShipDownload = parsedCanShipDownload;
      }
      const parsedIsActive = parseBoolean(req.body.isActive);
      if (parsedIsActive !== undefined) {
        updateData.isActive = parsedIsActive;
      }
      if (req.body.notes !== undefined) {
        updateData.notes = req.body.notes;
      }
      
      // Validate only the provided fields
      const validatedData = updateSchema.parse(updateData);
      
      const document = await storage.updateComponentDocument(parseInt(req.params.id), validatedData);
      res.json(document);
    } catch (error: any) {
      console.error("Failed to update component document:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update component document" });
    }
  });
  
  // Soft delete component document (PMS Admin only)
  app.delete("/technical/api/component-documents/:id", requirePMSAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteComponentDocument(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete component document:", error);
      res.status(500).json({ error: "Failed to delete component document" });
    }
  });
  
  // Download component document file
  app.get("/technical/api/component-documents/:id/download", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Get document by ID using proper storage method
      const document = await storage.getComponentDocument(parseInt(req.params.id));
      
      // Guard: Return 404 immediately if document not found
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Now safely access document properties after existence verified
      // Verify vessel access for Ship users
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (req.user!.vesselId !== document.vesselCode) {
          return res.status(403).json({ error: "Cannot access documents from other vessels" });
        }
      }
      
      // Check download permissions for Ship users
      if (req.user!.role === "Ship" && !document.canShipDownload) {
        return res.status(403).json({ error: "Insufficient permissions to download this document" });
      }
      
      // Download from object storage (PostgreSQL-only mode - no local file fallback)
      let fileBuffer: Buffer;
      let contentType = 'application/octet-stream';
      
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        console.error("❌ Object storage not configured - DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
        return res.status(500).json({ 
          error: "Object storage not configured. Please set up object storage in the Replit Object Storage panel."
        });
      }
      
      try {
        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(`.private/documents/${document.fileKey}`);
        [fileBuffer] = await file.download();
        console.log(`📤 Serving file from object storage: ${document.fileKey}`);
      } catch (objectError) {
        console.error("Failed to download from object storage:", objectError);
        return res.status(404).json({ error: "Document file not found in object storage" });
      }
      
      // Set headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.setHeader('Content-Type', contentType);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Failed to download document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document file not found in storage" });
      }
      res.status(500).json({ error: "Failed to download document" });
    }
  });
  
  // Component Class Regulatory API routes (Read: all authenticated users, Write: Admin only)
  app.get("/technical/api/component-class-regulatory/:componentId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // First, verify the component exists and check vessel access
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      // For Ship users, enforce vessel scoping (read-only access)
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (component.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot access classification data for components from other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      
      const items = await storage.getComponentClassRegulatory(req.params.componentId);
      res.json(items);
    } catch (error) {
      console.error("Failed to get component class regulatory data:", error);
      res.status(500).json({ error: "Failed to get component class regulatory data" });
    }
  });
  
  app.post("/technical/api/component-class-regulatory", requirePMSAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // insertComponentClassRegulatorySchema already omits id, createdAt, updatedAt
      const validatedData = insertComponentClassRegulatorySchema.parse({
        ...req.body,
        createdBy: req.user!.username,
        updatedBy: req.user!.username
      });
      
      const item = await storage.createComponentClassRegulatory(validatedData);
      res.json(item);
    } catch (error: any) {
      console.error("Failed to create component class regulatory:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid class regulatory data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create component class regulatory" });
    }
  });
  
  app.put("/technical/api/component-class-regulatory/:id", requirePMSAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Use partial validation for updates - only validate provided fields
      const validatedData = insertComponentClassRegulatorySchema.partial().parse({
        ...req.body,
        updatedBy: req.user!.username
      });
      
      const item = await storage.updateComponentClassRegulatory(parseInt(req.params.id), validatedData);
      res.json(item);
    } catch (error: any) {
      console.error("Failed to update component class regulatory:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid class regulatory data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update component class regulatory" });
    }
  });
  
  app.delete("/technical/api/component-class-regulatory/:id", requirePMSAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteComponentClassRegulatory(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete component class regulatory:", error);
      res.status(500).json({ error: "Failed to delete component class regulatory" });
    }
  });
  
  // Component Requisitions API routes (Section H)
  
  // Get requisitions for a specific component (with vessel scoping for Ship users)
  app.get("/technical/api/component-requisitions/:componentId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // First, verify the component exists and check vessel access
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (component.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot access requisitions for components from other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      
      let requisitions = await storage.getComponentRequisitions(req.params.componentId);
      
      // Add dummy data for demo component 401.005 (check component code, not ID)
      if (component.componentCode === "401.005" && requisitions.length === 0) {
        requisitions = [
          {
            id: 1001,
            requisitionNo: "REQ-401.005-001",
            componentId: req.params.componentId,
            itemOrService: "Rudder Shaft Bearing (SP-00001)",
            quantity: 2,
            uom: "PC",
            raisedOn: "2025-12-01",
            priority: "Normal",
            status: "PO Raised",
            requestedBy: "Chief Engineer",
            vesselCode: component.vesselCode
          },
          {
            id: 1002,
            requisitionNo: "REQ-401.005-002",
            componentId: req.params.componentId,
            itemOrService: "Rudder Actuator Service",
            quantity: 1,
            uom: "SRV",
            raisedOn: "2025-12-02",
            priority: "Urgent",
            status: "Delivered On Board",
            requestedBy: "2nd Engineer",
            vesselCode: component.vesselCode
          }
        ];
      }
      
      res.json(requisitions);
    } catch (error) {
      console.error("Failed to get component requisitions:", error);
      res.status(500).json({ error: "Failed to get component requisitions" });
    }
  });
  
  // Get all requisitions (optionally filtered by vessel, with vessel scoping for Ship users)
  app.get("/technical/api/component-requisitions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      let vesselCode = req.query.vesselCode as string | undefined;
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        vesselCode = req.user!.vesselId;
      }
      
      const requisitions = await storage.getAllComponentRequisitions(vesselCode);
      res.json(requisitions);
    } catch (error) {
      console.error("Failed to get all component requisitions:", error);
      res.status(500).json({ error: "Failed to get component requisitions" });
    }
  });
  
  // Get a single requisition by id (with vessel scoping for Ship users)
  app.get("/technical/api/component-requisitions/item/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const item = await storage.getComponentRequisitionItem(parseInt(req.params.id));
      if (!item) {
        return res.status(404).json({ error: "Requisition not found" });
      }
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (item.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot access requisitions from other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: item.vesselCode
          });
        }
      }
      
      res.json(item);
    } catch (error) {
      console.error("Failed to get component requisition:", error);
      res.status(500).json({ error: "Failed to get component requisition" });
    }
  });
  
  // Create a new requisition (Office/PMS Admin only can create)
  app.post("/technical/api/component-requisitions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Ship users can only create requisitions for their assigned vessel
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (req.body.vesselCode && req.body.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot create requisitions for other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: req.body.vesselCode
          });
        }
        req.body.vesselCode = req.user!.vesselId;
      }
      
      // Validate request body with Zod schema
      const validatedData = insertComponentRequisitionSchema.parse({
        ...req.body,
        requestedBy: req.body.requestedBy || req.user!.username
      });
      
      const result = await storage.createComponentRequisition(validatedData);
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Failed to create component requisition:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid requisition data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create component requisition" });
    }
  });
  
  // Update a requisition (with vessel scoping and Zod validation)
  app.put("/technical/api/component-requisitions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // First check if requisition exists and verify vessel access
      const existing = await storage.getComponentRequisitionItem(parseInt(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Requisition not found" });
      }
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (existing.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot update requisitions from other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: existing.vesselCode
          });
        }
      }
      
      // Validate with partial schema for updates
      const validatedData = insertComponentRequisitionSchema.partial().parse(req.body);
      
      // SECURITY: Prevent vesselCode modification - only PMS Admin can reassign vessels
      // This prevents Ship users from transferring requisitions to other vessels
      if (req.user!.role !== "PMS Admin") {
        delete (validatedData as any).vesselCode;
        delete (validatedData as any).componentId;  // Also prevent component reassignment
      }
      
      const result = await storage.updateComponentRequisition(parseInt(req.params.id), validatedData);
      res.json(result);
    } catch (error: any) {
      console.error("Failed to update component requisition:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid requisition data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update component requisition" });
    }
  });
  
  // Delete a requisition (PMS Admin only)
  app.delete("/technical/api/component-requisitions/:id", requirePMSAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteComponentRequisition(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete component requisition:", error);
      res.status(500).json({ error: "Failed to delete component requisition" });
    }
  });
  
  // Component Maintenance History API routes (read-only, immutable records)
  
  // Get ALL maintenance history records (for global display)
  app.get("/technical/api/component-maintenance-history", async (req, res) => {
    try {
      const allHistory = await storage.getAllComponentMaintenanceHistory();
      res.json(allHistory);
    } catch (error) {
      console.error("Failed to get all component maintenance history:", error);
      res.status(500).json({ error: "Failed to get component maintenance history" });
    }
  });
  
  app.get("/technical/api/component-maintenance-history/:componentId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // First, verify the component exists and check vessel access
      const component = await storage.getComponent(req.params.componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (component.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot access maintenance history for components from other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: component.vesselCode
          });
        }
      }
      
      // First try to get history by componentId
      let history = await storage.getComponentMaintenanceHistory(req.params.componentId);
      
      // If no history found by ID, try fallback by componentCode + vesselCode
      // This handles cases where legacy records used different componentId format
      if (history.length === 0 && component.componentCode && component.vesselCode) {
        history = await storage.getComponentMaintenanceHistoryByCode(
          component.componentCode,
          component.vesselCode
        );
      }
      
      res.json(history);
    } catch (error) {
      console.error("Failed to get component maintenance history:", error);
      res.status(500).json({ error: "Failed to get component maintenance history" });
    }
  });
  
  // Get maintenance history by job ID (for Jobs Form A5)
  app.get("/technical/api/job-maintenance-history/:jobId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (job.vesselId !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot access maintenance history for jobs from other vessels"
          });
        }
      }
      
      // First try to get history by jobId
      let history = await storage.getMaintenanceHistoryByJobId(req.params.jobId);
      
      // If no history found by jobId, try by jobCode (jobNo)
      if (history.length === 0 && job.jobNo) {
        history = await storage.getMaintenanceHistoryByJobCode(job.jobNo);
      }
      
      res.json(history);
    } catch (error) {
      console.error("Failed to get job maintenance history:", error);
      res.status(500).json({ error: "Failed to get job maintenance history" });
    }
  });
  
  app.get("/technical/api/component-maintenance-history/item/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const item = await storage.getComponentMaintenanceHistoryItem(parseInt(req.params.id));
      if (!item) {
        return res.status(404).json({ error: "Maintenance history item not found" });
      }
      
      // For Ship users, enforce vessel scoping
      if (req.user!.role === "Ship" && req.user!.vesselId) {
        if (item.vesselCode !== req.user!.vesselId) {
          return res.status(403).json({ 
            error: "Cannot access maintenance history from other vessels",
            assignedVessel: req.user!.vesselId,
            requestedVessel: item.vesselCode
          });
        }
      }
      
      res.json(item);
    } catch (error) {
      console.error("Failed to get maintenance history item:", error);
      res.status(500).json({ error: "Failed to get maintenance history item" });
    }
  });
  
  // Work Orders API routes
  
  // Get all work orders with optional vessel filter
  app.get("/technical/api/work-orders", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const workOrders = await storage.getWorkOrders(vesselId);
      
      // Fetch jobs to hydrate lead time data
      const jobs = await storage.getJobs(vesselId);
      const jobsMap = new Map(jobs.map(job => [job.id, job]));
      
      // Fetch all components to hydrate currentRH for RH-based status computation
      const components = await storage.getComponents(vesselId);
      // Create map by component_code for matching with work order's componentCode field
      const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
      // Also keep map by id for fallback
      const componentsMap = new Map(components.map(comp => [comp.id, comp]));
      
      // Fetch vessel-specific grace settings for status calculation
      const vesselSettings = vesselId ? await storage.getPmsVesselSettings(vesselId) : null;
      const vesselGraceSettings = vesselSettings ? {
        calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
        calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
        rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
        rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
      } : undefined;
      
      // Augment each work order with computed status and lead time data
      const enrichedWorkOrders = workOrders.map(wo => {
        // Try to match by jobId first (more reliable), then fall back to templateCode === jobNo
        const job = wo.jobId 
          ? jobsMap.get(wo.jobId)
          : wo.templateCode 
            ? jobs.find(j => j.jobNo === wo.templateCode)
            : null;
        
        // Get component to fetch currentCumulativeRH - match by componentCode first, then by id
        const component = wo.componentCode 
          ? componentsByCodeMap.get(wo.componentCode) 
          : (wo.component ? componentsMap.get(wo.component) : null);
        
        // For RH-based jobs, use job's nextDueRH as dueRH and component's currentCumulativeRH as currentRH
        // FALLBACK: If job/component data is missing, use work order's own nextDueReading/currentReading
        // This ensures UI display and status calculation use consistent data sources
        // Robust numeric parsing: handle strings, decimals, empty values
        const parseRH = (value: string | number | null | undefined): number | undefined => {
          if (value == null || value === '') return undefined;
          const num = Number(value);
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
        
        // Determine RH lead time based on job criticality (Critical vs Non-Critical)
        // NOTE: Using ?? (nullish coalescing) ensures explicit 0 values are preserved
        // Fallback uses centralized WORK_ORDER_THRESHOLDS (720 hours per spec)
        const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || job?.classRelated === true;
        const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours' 
          ? (isJobCritical 
              ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
              : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
          : undefined;
        
        return {
          ...wo,
          // Hydrate assignedTo from job if work order has 'Unassigned' or empty value
          assignedTo: (wo.assignedTo && wo.assignedTo !== 'Unassigned') 
            ? wo.assignedTo 
            : (job?.assignedTo || 'Unassigned'),
          // Hydrate criticality from job if work order has empty value
          criticality: wo.criticality || job?.criticality || null,
          computedStatus: computeWorkOrderStatus({
            dueDate: wo.dueDate,
            dueRH,
            currentRH,
            isExecution: wo.isExecution,
            status: wo.status,
            completionDateTime: wo.dateCompleted,
            maintenanceBasis: wo.maintenanceBasis || job?.maintenanceBasis || undefined,
            vesselGraceSettings,
            rhLeadTimeHours
          }),
          leadTimeValue: job?.leadTimeValue ?? null,
          leadTimeUnit: job?.leadTimeUnit ?? null,
          dueRH: dueRH ?? null,
          currentRH: currentRH ?? null
        };
      });
      
      // Sort by spec-compliant priority: Overdue → Grace P → Due → Due Soon → Planned → Postponed → Pending Approval → Completed
      // Then by nearest due date within each status group
      const statusPriority: Record<string, number> = {
        'Overdue': 1,
        'Due (Grace P)': 2,
        'Due': 3,
        'Due Soon': 4,
        'Planned': 5,
        'Postponed': 6,
        'Pending Approval': 7,
        'Active': 8,
        'Completed': 9,
        'Rejected': 10
      };
      
      const sortedWorkOrders = enrichedWorkOrders.sort((a, b) => {
        // First, sort by status priority
        const aPriority = statusPriority[a.computedStatus] ?? 99;
        const bPriority = statusPriority[b.computedStatus] ?? 99;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Within same status, sort by due date (nearest first) only if both have dates
        // If one or both lack dates, maintain status priority order (don't demote)
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        
        // Both have no due date OR one has date and other doesn't - maintain original order
        // This preserves status priority for RH-based overdue jobs without calendar dates
        return 0;
      });
      
      res.json(sortedWorkOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });
  
  // Get single work order
  app.get("/technical/api/work-orders/:id", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      // Fetch job to hydrate lead time data and RH fields
      let leadTimeValue = null;
      let leadTimeUnit = null;
      let job = null;
      if (workOrder.vesselId) {
        const jobs = await storage.getJobs(workOrder.vesselId);
        // Try to match by jobId first (more reliable), then fall back to templateCode === jobNo
        job = workOrder.jobId
          ? jobs.find(j => j.id === workOrder.jobId)
          : workOrder.templateCode
            ? jobs.find(j => j.jobNo === workOrder.templateCode)
            : null;
        leadTimeValue = job?.leadTimeValue ?? null;
        leadTimeUnit = job?.leadTimeUnit ?? null;
      }
      
      // Fetch component to hydrate currentRH for RH-based status computation
      // Match by componentCode first (more reliable), then fall back to component name lookup
      let component = null;
      if (workOrder.componentCode && workOrder.vesselId) {
        component = await storage.getComponentByCode(workOrder.componentCode, workOrder.vesselId);
      }
      if (!component && workOrder.component) {
        component = await storage.getComponent(workOrder.component);
      }
      
      // For RH-based jobs, use job's nextDueRH as dueRH and component's currentCumulativeRH as currentRH
      // FALLBACK: If job/component data is missing, use work order's own nextDueReading/currentReading
      // This ensures UI display and status calculation use consistent data sources
      // Robust numeric parsing: handle strings, decimals, empty values
      const parseRH = (value: string | number | null | undefined): number | undefined => {
        if (value == null || value === '') return undefined;
        const num = Number(value);
        return isNaN(num) ? undefined : num;
      };
      
      // Primary: job.nextDueRH, Fallback: workOrder.nextDueReading
      const dueRH = workOrder.maintenanceBasis === 'Running Hours' 
        ? (parseRH(job?.nextDueRH) ?? parseRH(workOrder.nextDueReading)) 
        : undefined;
      // Primary: component.currentCumulativeRH, Fallback: workOrder.currentReading
      const currentRH = workOrder.maintenanceBasis === 'Running Hours' 
        ? (parseRH(component?.currentCumulativeRH) ?? parseRH(workOrder.currentReading)) 
        : undefined;
      
      // Fetch vessel-specific grace settings for status calculation
      const vesselSettings = workOrder.vesselId ? await storage.getPmsVesselSettings(workOrder.vesselId) : null;
      const vesselGraceSettings = vesselSettings ? {
        calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
        calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
        rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
        rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
      } : undefined;
      
      // Determine RH lead time based on job criticality (Critical vs Non-Critical)
      // NOTE: Using ?? (nullish coalescing) ensures explicit 0 values are preserved
      // Fallback uses centralized WORK_ORDER_THRESHOLDS (720 hours per spec)
      const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || job?.classRelated === true;
      const rhLeadTimeHours = workOrder.maintenanceBasis === 'Running Hours' 
        ? (isJobCritical 
            ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
            : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
        : undefined;
      
      // Augment with computed status and lead time data
      const enrichedWorkOrder = {
        ...workOrder,
        computedStatus: computeWorkOrderStatus({
          dueDate: workOrder.dueDate,
          dueRH,
          currentRH,
          isExecution: workOrder.isExecution,
          status: workOrder.status,
          completionDateTime: workOrder.dateCompleted,
          maintenanceBasis: workOrder.maintenanceBasis || job?.maintenanceBasis || undefined,
          vesselGraceSettings,
          rhLeadTimeHours
        }),
        leadTimeValue,
        leadTimeUnit
      };
      
      res.json(enrichedWorkOrder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work order" });
    }
  });
  
  // Get work order context (for running hours validation and Part A hydration)
  app.get("/technical/api/work-orders/:id/context", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      // Get component data - work orders may store component ID, componentCode, or component name
      // Try multiple lookup methods to ensure compatibility
      let component = await storage.getComponent(workOrder.component);
      
      // Fallback: Try by componentCode if ID lookup fails
      if (!component && workOrder.componentCode && workOrder.vesselId) {
        component = await storage.getComponentByCode(workOrder.componentCode, workOrder.vesselId);
      }
      
      // Fallback: Search by component name if still not found
      if (!component) {
        const allComponents = await storage.getComponents(workOrder.vesselId ?? undefined);
        component = allComponents.find(c => 
          c.name === workOrder.component || 
          c.componentCode === workOrder.component ||
          c.componentCode === workOrder.componentCode
        );
      }
      
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      // Get parent component data if exists
      let parentComponent = null;
      if (component.parentId) {
        parentComponent = await storage.getComponent(component.parentId);
      }
      
      // Get RH master component for INHERITED components (different from hierarchical parent)
      // This is used for running hours validation - inherited components cannot exceed master RH
      let rhMasterComponent = null;
      const counterType = (component.rhCounterType || '').toUpperCase();
      if (counterType === 'INHERITED') {
        // Try by rhMasterComponentId first, then fall back to rhCounterSource
        if (component.rhMasterComponentId) {
          rhMasterComponent = await storage.getComponent(component.rhMasterComponentId);
        }
        if (!rhMasterComponent && component.rhCounterSource && workOrder.vesselId) {
          rhMasterComponent = await storage.getComponentByCode(component.rhCounterSource, workOrder.vesselId);
        }
      }
      
      // Get latest running hours audit for this component
      const audits = await storage.getRunningHoursAudits(workOrder.component);
      const latestAudit = audits.length > 0 ? audits[0] : null;
      
      // Get linked job data for Part A hydration
      let job = null;
      if (workOrder.jobId) {
        job = await storage.getJob(workOrder.jobId);
      }
      
      // Helper function to convert DD-MMM-YYYY to ISO YYYY-MM-DD format for HTML date inputs
      const convertToIsoDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const monthMap: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
          'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        // Handle DD-MMM-YYYY format (e.g., "04-Dec-2025")
        const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          const monthNum = monthMap[month];
          if (monthNum) {
            return `${year}-${monthNum}-${day.padStart(2, '0')}`;
          }
        }
        // If already in ISO format or other format, return as-is
        return dateStr;
      };
      
      // Enrich spare parts with ROB (Remaining On Board) inventory data
      // Primary: Use Part Code (correct design)
      // Fallback: Use Part Number for backward compatibility with legacy data
      const enrichSparePartsWithROB = async (spareParts: any[], vesselId: string) => {
        if (!spareParts || spareParts.length === 0) return spareParts;
        
        const partCodes = spareParts.map((sp: any) => sp.partCode).filter(Boolean);
        const partNumbers = spareParts.map((sp: any) => sp.partNo).filter(Boolean);
        
        const inventoryByPartCode = await storage.getSpareInventoryByPartCodes(vesselId, partCodes);
        const inventoryByPartNumber = partNumbers.length > 0 
          ? await storage.getSpareInventoryByPartNumbers(vesselId, partNumbers)
          : new Map();
        
        return spareParts.map((sp: any) => {
          // Primary lookup: by Part Code (correct design)
          let inventory = sp.partCode ? inventoryByPartCode.get(sp.partCode) : null;
          // Fallback: by Part Number for legacy data compatibility
          if (!inventory && sp.partNo) {
            inventory = inventoryByPartNumber.get(sp.partNo);
          }
          return {
            ...sp,
            rob: inventory ? inventory.rob : null,
            robLocationA: inventory ? inventory.robLocationA : null,
            robLocationB: inventory ? inventory.robLocationB : null
          };
        });
      };
      
      // Build templateData from job data (Part A - immutable from job definition)
      // This ensures Section A is populated from the job template
      const rawSpareParts = job?.requiredSpareParts || [];
      const enrichedSpareParts = await enrichSparePartsWithROB(rawSpareParts, workOrder.vesselId);
      
      const templateData = job ? {
        woTitle: job.jobTitle,
        jobTitle: job.jobTitle,
        jobNo: job.jobNo,
        component: workOrder.component,
        componentCode: workOrder.componentCode || component.componentCode,
        componentName: component.name,
        sfiCode: job.sfiCode || job.componentCode || component.componentCode,
        maintenanceBasis: job.maintenanceBasis,
        maintenanceType: job.maintenanceType,
        frequencyValue: job.frequencyValue?.toString() || '',
        frequencyUnit: job.frequencyUnit || 'Months',
        intervalRunningHour: job.intervalRunningHour?.toString() || '',
        assignedTo: job.assignedTo,
        approver: job.approver,
        department: job.department,
        jobPriority: job.jobPriority,
        classRelated: job.classRelated,
        criticality: job.criticality,
        lastDoneDate: convertToIsoDate(job.lastDoneDate),
        nextDueDate: convertToIsoDate(job.nextDueDate),
        lastDoneRH: job.lastDoneRH?.toString() || '',
        nextDueRH: job.nextDueRH?.toString() || '',
        briefWorkDescription: job.briefWorkDescription || job.jobDescription,
        jobDescription: job.jobDescription,
        requiredSpareParts: enrichedSpareParts,
        requiredTools: job.requiredTools || [],
        safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
        vesselId: workOrder.vesselId
      } : {
        // Fallback: use work order fields if job not found (for unplanned WOs)
        woTitle: workOrder.jobTitle,
        jobTitle: workOrder.jobTitle,
        jobNo: workOrder.templateCode,
        component: workOrder.component,
        componentCode: component.componentCode,
        componentName: component.name,
        sfiCode: component.componentCode,
        maintenanceBasis: workOrder.maintenanceBasis || 'Calendar',
        maintenanceType: workOrder.maintenanceType,
        frequencyValue: workOrder.frequencyValue?.toString() || '',
        frequencyUnit: workOrder.frequencyUnit || 'Months',
        intervalRunningHour: '',
        assignedTo: workOrder.assignedTo,
        approver: workOrder.approver,
        department: workOrder.department,
        jobPriority: workOrder.jobPriority,
        classRelated: workOrder.classRelated,
        criticality: workOrder.criticality,
        lastDoneDate: '',
        nextDueDate: convertToIsoDate(workOrder.dueDate),
        lastDoneRH: '',
        nextDueRH: '',
        briefWorkDescription: workOrder.briefWorkDescription,
        jobDescription: workOrder.briefWorkDescription,
        requiredSpareParts: [],
        requiredTools: [],
        safetyRequirements: { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
        vesselId: workOrder.vesselId
      };
      
      // Build executionData from work order (Part B - editable execution record)
      let executionData = {
        // B1 - Risk Assessment, Checklists & Records
        riskAssessmentStatus: workOrder.riskAssessmentStatus || '',
        safetyChecklistsStatus: workOrder.safetyChecklistsStatus || '',
        operationalFormsStatus: workOrder.operationalFormsStatus || '',
        uploadedDocuments: workOrder.uploadedDocuments || [],
        // B2 - Work Duration
        startDateTime: workOrder.startDateTime || '',
        completionDateTime: workOrder.completionDateTime || '',
        executionAssignedTo: workOrder.executionAssignedTo || '',
        performedBy: workOrder.performedBy || '',
        noOfPersons: workOrder.noOfPersons || '',
        totalTimeHours: workOrder.totalTimeHours || '',
        manhours: workOrder.manhours || '',
        workCarriedOut: workOrder.workCarriedOut || '',
        jobExperienceNotes: workOrder.jobExperienceNotes || '',
        // B3 - Running Hours
        previousReading: workOrder.previousReading?.toString() || '',
        currentReading: workOrder.currentReading?.toString() || '',
        runningHoursDifference: workOrder.runningHoursDifference?.toString() || '',
        readingDate: workOrder.readingDate || '',
        runningHours: workOrder.runningHours || '',
        // B4 - Spare Parts Consumed
        consumedSpareParts: workOrder.consumedSpareParts || [],
        // Metadata
        woExecutionId: workOrder.woExecutionId || '',
        remarks: workOrder.remarks || '',
        dateCompleted: workOrder.dateCompleted || '',
        completionRemarks: workOrder.completionRemarks || ''
      };
      
      // Use actual database data - no dummy data overrides
      const finalTemplateData: any = { ...templateData };
      
      res.json({
        workOrder,
        templateData: finalTemplateData,
        executionData,
        job,
        component: {
          id: component.id,
          componentCode: component.componentCode,
          name: component.name,
          parentId: component.parentId,
          currentCumulativeRH: component.currentCumulativeRH,
          lastUpdated: latestAudit?.dateUpdatedLocal || component.lastUpdated,
          rhCounterType: component.rhCounterType,
          rhCounterSource: component.rhCounterSource
        },
        parentComponent: parentComponent ? {
          id: parentComponent.id,
          componentCode: parentComponent.componentCode,
          name: parentComponent.name,
          currentCumulativeRH: parentComponent.currentCumulativeRH
        } : null,
        // RH Master component for INHERITED components (used for validation)
        // Inherited components cannot have RH greater than their master component
        rhMasterComponent: rhMasterComponent ? {
          id: rhMasterComponent.id,
          componentCode: rhMasterComponent.componentCode,
          name: rhMasterComponent.name,
          currentCumulativeRH: rhMasterComponent.currentCumulativeRH || rhMasterComponent.rhCurrentMaster
        } : null,
        maintenanceBasis: workOrder.maintenanceBasis || job?.maintenanceBasis
      });
    } catch (error) {
      console.error("Failed to fetch work order context:", error);
      res.status(500).json({ error: "Failed to fetch work order context" });
    }
  });
  
  // Create new work order
  app.post("/technical/api/work-orders", async (req, res) => {
    try {
      let workOrderData = insertWorkOrderSchema.parse(req.body);
      
      // AUTO-CORRECT: Fetch correct componentCode from database
      // This prevents data corruption from incorrect componentCode being passed in
      // workOrderData.component could be either a component ID or a component name
      if (workOrderData.vesselId && (workOrderData.component || workOrderData.componentCode)) {
        let resolvedComponent = null;
        
        // Try 1: Look up by ID (if component field contains an ID)
        if (workOrderData.component) {
          resolvedComponent = await storage.getComponent(workOrderData.component);
        }
        
        // Try 2: Look up by componentCode
        if (!resolvedComponent && workOrderData.componentCode) {
          resolvedComponent = await storage.getComponentByCode(workOrderData.componentCode, workOrderData.vesselId);
        }
        
        // Try 3: Look up by name (if component field contains a name, not ID)
        if (!resolvedComponent && workOrderData.component) {
          const vesselComponents = await storage.getComponents(workOrderData.vesselId);
          resolvedComponent = vesselComponents.find(c => c.name === workOrderData.component);
        }
        
        if (resolvedComponent) {
          if (workOrderData.componentCode && workOrderData.componentCode !== resolvedComponent.componentCode) {
            console.warn(`⚠️ AUTO-CORRECTING componentCode mismatch: passed "${workOrderData.componentCode}" but component "${resolvedComponent.name}" has code "${resolvedComponent.componentCode}"`);
          }
          // Only update componentCode - preserve the original component field (could be ID or name)
          workOrderData = {
            ...workOrderData,
            componentCode: resolvedComponent.componentCode
          };
          console.log(`✅ Auto-resolved componentCode: ${resolvedComponent.componentCode} for component "${resolvedComponent.name}"`);
        }
      }
      
      // Convert ISO date (YYYY-MM-DD) to DD-MM-YYYY if provided by frontend
      if (workOrderData.dueDate && workOrderData.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = workOrderData.dueDate.split('-');
        workOrderData.dueDate = `${day}-${month}-${year}`;
        console.log(`Converted dueDate from ISO to DD-MM-YYYY: ${workOrderData.dueDate}`);
      }
      
      // Auto-resolve jobId if not provided but component and jobTitle are available
      if (!workOrderData.jobId && workOrderData.component && workOrderData.jobTitle && workOrderData.vesselId) {
        try {
          const jobs = await storage.getJobs(workOrderData.vesselId);
          const matchingJob = jobs.find(j => 
            j.componentId === workOrderData.component && 
            j.jobTitle === workOrderData.jobTitle
          );
          if (matchingJob) {
            workOrderData = {
              ...workOrderData,
              jobId: matchingJob.id
            };
            console.log(`Auto-resolved jobId: ${matchingJob.id} for component ${workOrderData.component} and job "${workOrderData.jobTitle}"`);
          }
        } catch (error) {
          console.error('Failed to auto-resolve jobId:', error);
          // Continue without jobId if resolution fails
        }
      }
      
      // Generate spec-compliant work order number if not provided
      if (!workOrderData.workOrderNo) {
        const { 
          generatePlannedWorkOrderNumber, 
          generateUnplannedWorkOrderNumber, 
          determineWorkOrderType 
        } = await import('./utils/workOrderNumbering');
        
        // Determine work order type based on job linkage
        const woType = determineWorkOrderType(workOrderData.jobId, workOrderData.templateCode);
        workOrderData.workOrderType = woType;
        
        if (woType === 'Planned') {
          // Get job code and component code for planned WO numbering
          let jobCode = 'JOB-UNKNOWN';
          let componentCode = workOrderData.componentCode || '';
          if (workOrderData.jobId) {
            const job = await storage.getJob(workOrderData.jobId);
            if (job?.jobNo) {
              jobCode = job.jobNo;
            }
            if (job?.componentCode) {
              componentCode = job.componentCode;
            } else if (job?.componentId) {
              // Fallback: fetch component code from component record
              const component = await storage.getComponent(job.componentId);
              if (component?.componentCode) {
                componentCode = component.componentCode;
              }
            }
          }
          // If still no componentCode, try from workOrderData.componentCode directly
          // or fetch via componentCode lookup if we have a vesselId
          if (!componentCode && workOrderData.componentCode) {
            componentCode = workOrderData.componentCode;
          }
          // Last resort: try to find component by code if vesselId available
          if (!componentCode && workOrderData.vesselId) {
            // If we have component name but not code, we can't reliably get the code
            // This is a data integrity issue - componentCode should always be provided
            console.warn(`No componentCode available for planned WO creation`);
          }
          if (!componentCode) {
            throw new Error('Component code is required for planned work order numbering');
          }
          workOrderData.workOrderNo = await generatePlannedWorkOrderNumber(
            storage, 
            jobCode, 
            componentCode,
            workOrderData.vesselId || undefined
          );
        } else {
          // Unplanned WO requires vesselId and componentCode
          const vesselId = workOrderData.vesselId || 'V001';
          // For unplanned WOs, componentCode is required for the new format
          // Try to get componentCode from workOrderData or fetch from component record
          let unplannedComponentCode = workOrderData.componentCode || '';
          if (!unplannedComponentCode && workOrderData.component) {
            // Try to find component by name/id
            const components = await storage.getComponents(vesselId);
            const matchedComponent = components.find(c => 
              c.id === workOrderData.component || 
              c.name === workOrderData.component ||
              c.componentCode === workOrderData.component
            );
            if (matchedComponent?.componentCode) {
              unplannedComponentCode = matchedComponent.componentCode;
            }
          }
          if (!unplannedComponentCode) {
            throw new Error('Component code is required for unplanned work order numbering');
          }
          workOrderData.workOrderNo = await generateUnplannedWorkOrderNumber(
            storage, 
            vesselId,
            unplannedComponentCode
          );
        }
        
        console.log(`Generated ${woType} WO number: ${workOrderData.workOrderNo}`);
      }
      
      // Auto-generate template code if not provided (format: WO-{ComponentCode}-{Year}-{Sequence})
      if (!workOrderData.templateCode && workOrderData.componentCode) {
        const currentYear = new Date().getFullYear().toString();
        const vesselId = workOrderData.vesselId || 'V001';
        
        // Get existing WOs for this component in current year
        const existingWOs = await storage.getWorkOrders(vesselId);
        const componentYearWOs = existingWOs.filter(wo => 
          wo.templateCode?.startsWith(`WO-${workOrderData.componentCode}-${currentYear}-`)
        );
        
        // Calculate next sequence
        const maxSeq = componentYearWOs.length > 0 
          ? Math.max(...componentYearWOs.map(wo => {
              const match = wo.templateCode?.match(/-(\d+)$/);
              return match ? parseInt(match[1]) : 0;
            }))
          : 0;
        
        const nextSeq = maxSeq + 1;
        const generatedTemplateCode = `WO-${workOrderData.componentCode}-${currentYear}-${String(nextSeq).padStart(2, '0')}`;
        
        // Create new object with generated template code
        workOrderData = {
          ...workOrderData,
          templateCode: generatedTemplateCode
        };
      }
      
      // Auto-calculate due date if not provided and component has installation date
      if (!workOrderData.dueDate && workOrderData.componentCode) {
        try {
          const { calculateDueDate } = await import('@shared/utils/dateCalculations');
          const vesselId = workOrderData.vesselId || 'V001';
          
          // Get all components for the vessel to find the matching one
          const components = await storage.getComponents(vesselId);
          const component = components.find(c => c.componentCode === workOrderData.componentCode);
          
          if (component?.installationDate) {
            const calculatedDueDate = calculateDueDate(
              component.installationDate,
              workOrderData.frequencyValue,
              workOrderData.frequencyUnit
            );
            
            if (calculatedDueDate) {
              workOrderData = {
                ...workOrderData,
                dueDate: calculatedDueDate
              };
              console.log(`Auto-calculated due date: ${calculatedDueDate} based on installation date: ${component.installationDate}`);
            }
          }
        } catch (error) {
          console.error('Failed to auto-calculate due date:', error);
          // Continue without due date if calculation fails
        }
      }
      
      const workOrder = await storage.createWorkOrder(workOrderData);
      res.status(201).json(workOrder);
    } catch (error: any) {
      console.error('Work order creation error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid work order data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create work order" });
    }
  });
  
  // Update work order
  app.patch("/technical/api/work-orders/:id", async (req, res) => {
    try {
      // Log incoming data for debugging
      console.log('📝 PATCH work order request body keys:', Object.keys(req.body));
      
      // RULE: Completed WOs are immutable except for specific fields
      // Check if the WO is already completed before allowing updates
      const existingWO = await storage.getWorkOrder(req.params.id);
      if (!existingWO) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      // Check if WO is completed - if so, only allow limited updates
      // Use centralized isCompletedStatus for case-insensitive matching
      const { isCompletedStatus } = await import('./utils/workOrderStatus');
      const woIsCompleted = isCompletedStatus(existingWO.status);
      
      if (woIsCompleted) {
        // Only allow adding comments/remarks to completed WOs, not modifying core fields
        const allowedFieldsForCompletedWO = ['remarks', 'completionRemarks', 'jobExperienceNotes'];
        const requestedFields = Object.keys(req.body);
        const disallowedFields = requestedFields.filter(f => !allowedFieldsForCompletedWO.includes(f));
        
        if (disallowedFields.length > 0) {
          console.warn(`⚠️ Attempted to modify completed WO ${existingWO.workOrderNo}: ${disallowedFields.join(', ')}`);
          return res.status(400).json({ 
            error: "Cannot modify completed work order",
            message: `Work Order ${existingWO.workOrderNo} is completed and cannot be modified. Only remarks can be added.`,
            disallowedFields 
          });
        }
      }
      
      // Use a more permissive update approach - accept any partial data
      // The storage layer will handle what fields to actually update
      let updateData = { ...req.body };
      
      // Remove any undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      // AUTO-CORRECT: Fetch correct componentCode from database
      // This prevents data corruption from incorrect componentCode being passed in
      // component field could be either a component ID or a component name
      const componentRef = updateData.component || existingWO.component;
      const componentCodeRef = updateData.componentCode || existingWO.componentCode;
      const vesselId = updateData.vesselId || existingWO.vesselId;
      if (vesselId && (componentRef || componentCodeRef)) {
        let resolvedComponent = null;
        
        // Try 1: Look up by ID (if component field contains an ID)
        if (componentRef) {
          resolvedComponent = await storage.getComponent(componentRef);
        }
        
        // Try 2: Look up by componentCode
        if (!resolvedComponent && componentCodeRef) {
          resolvedComponent = await storage.getComponentByCode(componentCodeRef, vesselId);
        }
        
        // Try 3: Look up by name (if component field contains a name, not ID)
        if (!resolvedComponent && componentRef) {
          const vesselComponents = await storage.getComponents(vesselId);
          resolvedComponent = vesselComponents.find(c => c.name === componentRef);
        }
        
        if (resolvedComponent) {
          if (componentCodeRef && componentCodeRef !== resolvedComponent.componentCode) {
            console.warn(`⚠️ AUTO-CORRECTING WO PATCH componentCode mismatch: current "${componentCodeRef}" but component "${resolvedComponent.name}" has code "${resolvedComponent.componentCode}"`);
          }
          // Only update componentCode - preserve the original component field (could be ID or name)
          updateData.componentCode = resolvedComponent.componentCode;
          console.log(`✅ Auto-resolved componentCode in PATCH: ${resolvedComponent.componentCode} for component "${resolvedComponent.name}"`);
        }
      }
      
      // SAFEGUARD: If completion data is provided without explicit status,
      // automatically set status to 'Pending Approval' to enforce approval workflow
      const hasCompletionData = !!(updateData.completionDateTime || updateData.dateOfCompletion);
      const hasExplicitStatus = updateData.status !== undefined;
      
      // CRITICAL FIX: Map dateOfCompletion from frontend form to completionDateTime for database persistence
      // The form sends dateOfCompletion but the database schema uses completionDateTime (completion_date_time)
      // completionDateTime is the authoritative source for Next Due calculation during Pending to Completion
      
      // Helper: Normalize date formats (DD-MM-YYYY, DD/MM/YYYY) to ISO (YYYY-MM-DD)
      const normalizeDateToISO = (dateStr: string | undefined | null): string | null => {
        if (!dateStr) return null;
        
        // Already ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          return dateStr.split('T')[0]; // Strip time if present
        }
        
        // DD-MM-YYYY or DD/MM/YYYY format
        const ddmmyyyyMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
        if (ddmmyyyyMatch) {
          const [, day, month, year] = ddmmyyyyMatch;
          return `${year}-${month}-${day}`;
        }
        
        // Try parsing as Date object (fallback)
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
        
        console.warn(`⚠️ Could not normalize date format: ${dateStr}`);
        return null;
      };
      
      // Map dateOfCompletion to completionDateTime (primary) and dateCompleted (secondary)
      // ALWAYS overwrite completionDateTime when form provides dateOfCompletion to ensure Part B date is persisted
      if (updateData.dateOfCompletion) {
        const normalizedDate = normalizeDateToISO(updateData.dateOfCompletion);
        if (normalizedDate) {
          // Use full ISO timestamp format for database storage
          const isoTimestamp = `${normalizedDate}T00:00:00.000Z`;
          
          // IMPORTANT: Do NOT mutate dateOfCompletion - keep original format for UI stability
          // Only set completionDateTime and dateCompleted for database persistence
          
          // completionDateTime is the authoritative field for Pending to Completion stage
          updateData.completionDateTime = isoTimestamp;
          console.log(`📅 Mapped dateOfCompletion "${updateData.dateOfCompletion}" to completionDateTime: ${isoTimestamp}`);
          
          // Also set dateCompleted with ISO timestamp format for backward compatibility
          updateData.dateCompleted = isoTimestamp;
        }
      }
      
      if (hasCompletionData && !hasExplicitStatus) {
        // Get current work order to check current status
        const currentWorkOrder = await storage.getWorkOrder(req.params.id);
        if (currentWorkOrder && currentWorkOrder.status !== 'Approved' && currentWorkOrder.status !== 'Completed') {
          updateData.status = 'Pending Approval';
          // Capture submittedDate for audit trail when transitioning to Pending Approval
          if (!currentWorkOrder.submittedDate) {
            updateData.submittedDate = new Date().toISOString();
            console.log('📝 Auto-capturing submittedDate for audit trail');
          }
          console.log('📝 Auto-setting status to Pending Approval (completion data provided without explicit status)');
        }
      }
      
      // REJECTION WORKFLOW: When status is being set to 'Rejected', clear completion data
      // This allows the work order to be reworked (Part B can be re-entered)
      // Per business rule: Rejected WOs go back to 'Due' status with wasRejected=true for red font display
      const isBeingRejected = updateData.status?.toLowerCase() === 'rejected';
      if (isBeingRejected) {
        // Clear completion data so it doesn't appear in Date Completed column
        updateData.completionDateTime = null;
        updateData.dateCompleted = null;
        updateData.dateOfCompletion = null;
        // Store rejection date for audit trail
        updateData.rejectionDate = new Date().toISOString();
        // Mark as previously rejected for UI display (red font)
        updateData.wasRejected = true;
        // Set status to 'Due' instead of 'Rejected' so it appears in Due section for rework
        updateData.status = 'Due';
        console.log('📝 Work order rejected - setting status to Due, wasRejected=true for rework');
      }
      
      // REJECTED WO RESUBMISSION: When a previously rejected WO (now in Due status with wasRejected=true) 
      // is saved with completion updates, automatically transition to 'Pending Approval' for re-approval workflow
      const isRejectedWO = existingWO.wasRejected === true;
      if (isRejectedWO && hasCompletionData && !hasExplicitStatus) {
        updateData.status = 'Pending Approval';
        // Clear previous rejection data but keep wasRejected=true for audit
        updateData.rejectionComments = null;
        updateData.rejectionDate = null;
        updateData.approvalAction = null;
        // Update submittedDate for the new submission
        updateData.submittedDate = new Date().toISOString();
        console.log('📝 Previously rejected WO resubmitted - transitioning to Pending Approval');
      }
      
      // AUDIT TRAIL: Capture submittedDate whenever status changes to 'Pending Approval'
      // or when an approval action (submitted/approved) is taken
      const isSubmissionAction = updateData.approvalAction === 'submitted' || 
                                  updateData.approvalAction === 'submit' ||
                                  updateData.status === 'Pending Approval';
      if (isSubmissionAction && !existingWO.submittedDate) {
        updateData.submittedDate = new Date().toISOString();
        console.log('📝 Capturing submittedDate for audit trail on submission/Pending Approval');
      }
      
      console.log('📝 Cleaned update data keys:', Object.keys(updateData));
      
      // VALIDATION: For INHERITED components, check that RH doesn't exceed master component RH
      // This is a backend safety check - frontend also validates but this is the final gate
      if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
        const runningHours = existingWO.runningHours || updateData.runningHours;
        if (runningHours) {
          // Find the component
          let componentForValidation = await storage.getComponent(existingWO.component);
          if (!componentForValidation && existingWO.componentCode && existingWO.vesselId) {
            componentForValidation = await storage.getComponentByCode(existingWO.componentCode, existingWO.vesselId);
          }
          
          if (componentForValidation) {
            const counterType = (componentForValidation.rhCounterType || '').toUpperCase();
            if (counterType === 'INHERITED') {
              // Find master component
              let rhMasterComponent = null;
              if (componentForValidation.rhMasterComponentId) {
                rhMasterComponent = await storage.getComponent(componentForValidation.rhMasterComponentId);
              }
              if (!rhMasterComponent && componentForValidation.rhCounterSource && existingWO.vesselId) {
                rhMasterComponent = await storage.getComponentByCode(componentForValidation.rhCounterSource, existingWO.vesselId);
              }
              
              if (rhMasterComponent) {
                const enteredRH = parseFloat(runningHours);
                const masterRH = parseFloat(rhMasterComponent.currentCumulativeRH || rhMasterComponent.rhCurrentMaster || '0');
                
                if (!isNaN(enteredRH) && !isNaN(masterRH) && enteredRH > masterRH) {
                  console.error(`❌ RH validation failed: Entered RH (${enteredRH}) exceeds master component ${rhMasterComponent.componentCode} RH (${masterRH})`);
                  return res.status(400).json({
                    error: `Running hours (${enteredRH}) cannot exceed master component "${rhMasterComponent.name}" (${rhMasterComponent.componentCode}) running hours of ${masterRH}. Please update the master component's running hours first.`,
                    code: 'RH_EXCEEDS_MASTER'
                  });
                }
              }
            }
          }
        }
      }
      
      const workOrder = await storage.updateWorkOrder(req.params.id, updateData);
      
      // When work order is being approved/completed, create maintenance history and update job
      if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
        console.log('📋 Work order approved - creating maintenance history and updating job cycle dates');
        
        // Use the RETURNED workOrder from updateWorkOrder - this is guaranteed to have persisted data
        // This avoids race conditions from re-fetching in high-load scenarios
        const freshWorkOrder = workOrder;
        if (!freshWorkOrder) {
          console.error('Failed to get work order for completion processing');
        } else {
          // Find the component for maintenance history
          let component = await storage.getComponent(freshWorkOrder.component);
          
          if (!component && freshWorkOrder.componentCode && freshWorkOrder.vesselId) {
            const componentByCode = await storage.getComponentByCode(freshWorkOrder.componentCode, freshWorkOrder.vesselId);
            if (componentByCode) {
              // VALIDATION: Ensure component name matches to prevent wrong component linkage
              if (componentByCode.name === freshWorkOrder.component) {
                component = componentByCode;
              } else {
                console.warn(`⚠️ Component code ${freshWorkOrder.componentCode} found but name mismatch: "${componentByCode.name}" vs "${freshWorkOrder.component}". Will try name lookup.`);
              }
            }
          }
          
          if (!component && freshWorkOrder.vesselId) {
            const vesselComponents = await storage.getComponents(freshWorkOrder.vesselId);
            // Prioritize exact name match first
            component = vesselComponents.find(c => c.name === freshWorkOrder.component);
            // If no name match, try component code match
            if (!component) {
              component = vesselComponents.find(c => c.componentCode === freshWorkOrder.componentCode);
            }
          }
          
          if (component) {
            // Create maintenance history record using stored execution data
            try {
              // DUPLICATE CHECK: Only create if no record exists for this work order
              const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(freshWorkOrder.id);
              if (existingHistory) {
                console.log(`⚠️ Maintenance history already exists for work order ${freshWorkOrder.id}, skipping duplicate creation`);
              } else {
                // CRITICAL: For Pending to Completion stage, completionDateTime is the authoritative source
                // Priority: completionDateTime (DB column) > dateCompleted > fallback to today
                // Note: dateOfCompletion from form was already mapped to completionDateTime in PATCH handler
                
                // Helper to normalize any date format to ISO (YYYY-MM-DD)
                // Accepts: ISO (YYYY-MM-DD), DD-MM-YYYY, DD/MM/YYYY, and legacy formats (13 Jan 2026)
                // Returns null on failure instead of throwing to allow graceful handling
                const normalizeToISO = (dateStr: string): string | null => {
                  // Already ISO format (YYYY-MM-DD or full ISO timestamp)
                  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                    return dateStr.split('T')[0];
                  }
                  
                  // DD-MM-YYYY or DD/MM/YYYY format
                  const ddmmyyyyMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
                  if (ddmmyyyyMatch) {
                    const [, day, month, year] = ddmmyyyyMatch;
                    return `${year}-${month}-${day}`;
                  }
                  
                  // Try Date parsing for legacy formats (e.g., "13 Jan 2026", "January 13, 2026")
                  const parsed = new Date(dateStr);
                  if (!isNaN(parsed.getTime())) {
                    return parsed.toISOString().split('T')[0];
                  }
                  
                  // Return null on parse failure - caller should handle gracefully
                  console.error(`❌ Cannot parse date: ${dateStr}. Expected YYYY-MM-DD or DD-MM-YYYY format.`);
                  return null;
                };
                
                // completionDateTime is authoritative for Pending to Completion stage
                // Priority: 1. Persisted freshWorkOrder data (from returned updateWorkOrder result)
                //           2. updateData fallback (safe - we just set this from the form before storage call)
                const rawCompletionDate = freshWorkOrder.completionDateTime || freshWorkOrder.dateCompleted || updateData.completionDateTime;
                if (!rawCompletionDate) {
                  console.error(`❌ No completion date found for work order ${freshWorkOrder.id}. Maintenance history creation skipped.`);
                  // Don't throw - skip maintenance history but continue with approval
                } else {
                  const dateOfCompletion = normalizeToISO(rawCompletionDate);
                  if (!dateOfCompletion) {
                    console.error(`❌ Invalid completion date format for work order ${freshWorkOrder.id}: ${rawCompletionDate}. Maintenance history creation skipped.`);
                    // Don't throw - skip maintenance history but continue with approval
                  } else {
                    console.log(`📅 Using completion date for maintenance history: ${dateOfCompletion} (raw: ${rawCompletionDate})`);
                    
                    // Use stored execution data from work order (populated during Part B save)
                    const historyPayload = {
                      componentId: component.id,
                      componentCode: freshWorkOrder.componentCode || component.componentCode,
                      vesselCode: freshWorkOrder.vesselId,
                      workOrderId: freshWorkOrder.id,
                      workOrderNo: freshWorkOrder.workOrderNo || `WO-${freshWorkOrder.id}`,
                      jobTitle: freshWorkOrder.jobTitle,
                      maintenanceType: freshWorkOrder.maintenanceType || freshWorkOrder.taskType || 'Servicing',
                      dateCompleted: dateOfCompletion,
                      runningHoursAtCompletion: freshWorkOrder.runningHours || null,
                      performedBy: freshWorkOrder.performedBy || freshWorkOrder.executionAssignedTo || 'Unknown',
                      approvedBy: freshWorkOrder.approver || null,
                      approvalDate: dateOfCompletion,
                      status: 'Approved' as const,
                      workDescription: freshWorkOrder.workCarriedOut || freshWorkOrder.briefWorkDescription || null,
                      sparesUsed: freshWorkOrder.consumedSpareParts ? JSON.stringify(freshWorkOrder.consumedSpareParts) : null,
                      remarks: freshWorkOrder.remarks || freshWorkOrder.jobExperienceNotes || null,
                      isComponentReplaced: false
                    };
                    
                    await storage.createComponentMaintenanceHistory(historyPayload);
                    console.log(`✅ Created maintenance history for work order ${freshWorkOrder.id} (componentId: ${component.id})`);
                  }
                }
              }
            } catch (historyError) {
              console.error('Failed to create maintenance history record:', historyError);
            }
            
            // Update job cycle dates
            try {
              let job = null;
              
              if (freshWorkOrder.jobId) {
                job = await storage.getJob(freshWorkOrder.jobId);
              }
              
              // Fallback: Extract jobNo from work order number
              if (!job && freshWorkOrder.workOrderNo) {
                const woNumber = freshWorkOrder.workOrderNo;
                let extractedJobNo: string | null = null;
                
                const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
                if (newFormatMatch) {
                  extractedJobNo = newFormatMatch[1];
                }
                
                if (!extractedJobNo) {
                  const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
                  if (oldFormatMatch) {
                    extractedJobNo = oldFormatMatch[1];
                  }
                }
                
                if (extractedJobNo && freshWorkOrder.vesselId) {
                  const jobs = await storage.getJobs(freshWorkOrder.vesselId);
                  job = jobs.find(j => j.jobNo === extractedJobNo);
                }
              }
              
              if (job) {
                // CRITICAL: For Pending to Completion, completionDateTime is authoritative for Next Due calculation
                // Priority: 1. Persisted freshWorkOrder data (preferred)
                //           2. updateData fallback (safe - we just set this from the form before storage call)
                const rawJobCompletionDate = freshWorkOrder.completionDateTime || freshWorkOrder.dateCompleted || updateData.completionDateTime;
                const runningHours = freshWorkOrder.runningHours;
                
                // Normalize date to ISO format for job updates
                const normalizeJobDate = (dateStr: string | undefined | null): string | null => {
                  if (!dateStr) return null;
                  // Already ISO
                  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
                  // DD-MM-YYYY
                  const match = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
                  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
                  const parsed = new Date(dateStr);
                  return !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : null;
                };
                
                const dateOfCompletion = normalizeJobDate(rawJobCompletionDate);
                console.log(`📅 Using completion date for job update: ${dateOfCompletion} (raw: ${rawJobCompletionDate})`);
                
                // Handle Calendar-based jobs
                if (freshWorkOrder.maintenanceBasis === 'Calendar' && dateOfCompletion) {
                  const { calculateNextDueDate } = await import('@shared/dateUtils');
                  const calendarUpdates: any = { lastDoneDate: dateOfCompletion };
                  const linkUpdates: any = { lastDoneDate: dateOfCompletion, updatedAt: new Date() };
                  
                  if (job.frequencyValue && job.frequencyUnit) {
                    const nextDue = calculateNextDueDate(dateOfCompletion, job.frequencyValue, job.frequencyUnit);
                    if (nextDue) {
                      calendarUpdates.nextDueDate = nextDue;
                      linkUpdates.nextDueDate = nextDue;
                      console.log(`✅ Updated job ${job.jobNo} nextDueDate: ${nextDue}`);
                    }
                  }
                  
                  // Update component-specific tracking in jobComponentLinks (PRIMARY source of truth)
                  // VESSEL ISOLATION: Pass vesselId to ensure updates are vessel-scoped
                  const updateVesselId = freshWorkOrder.vesselId || job.vesselId;
                  if (component.id && updateVesselId) {
                    await storage.updateJobComponentLinkTracking(updateVesselId, job.id, component.id, linkUpdates);
                    console.log(`✅ Updated component-specific tracking for vessel ${updateVesselId}, job ${job.jobNo} + component ${component.id} with lastDoneDate: ${dateOfCompletion}`);
                  }
                  
                  // Also update global job record for backward compatibility (SECONDARY)
                  await storage.updateJob(job.id, calendarUpdates);
                }
                
                // Handle Running Hours-based jobs (separate update to avoid key leakage)
                if (freshWorkOrder.maintenanceBasis === 'Running Hours' && runningHours) {
                  const currentRH = parseInt(runningHours);
                  if (!isNaN(currentRH)) {
                    const rhUpdates: any = { lastDoneRH: currentRH };
                    const rhLinkUpdates: any = { lastDoneRH: currentRH.toString(), updatedAt: new Date() };
                    const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
                    if (rhInterval && !isNaN(rhInterval)) {
                      rhUpdates.nextDueRH = currentRH + rhInterval;
                      rhLinkUpdates.nextDueRH = (currentRH + rhInterval).toString();
                      console.log(`✅ Updated job ${job.jobNo} nextDueRH: ${rhUpdates.nextDueRH}`);
                    }
                    
                    // Update component-specific tracking in jobComponentLinks (PRIMARY source of truth)
                    // VESSEL ISOLATION: Pass vesselId to ensure updates are vessel-scoped
                    const rhUpdateVesselId = freshWorkOrder.vesselId || job.vesselId;
                    if (component.id && rhUpdateVesselId) {
                      await storage.updateJobComponentLinkTracking(rhUpdateVesselId, job.id, component.id, rhLinkUpdates);
                      console.log(`✅ Updated component-specific RH tracking for vessel ${rhUpdateVesselId}, job ${job.jobNo} + component ${component.id} with lastDoneRH: ${currentRH}`);
                    }
                    
                    // Also update global job record for backward compatibility (SECONDARY)
                    await storage.updateJob(job.id, rhUpdates);
                    
                    // UPDATE COMPONENT RUNNING HOURS on work order approval
                    // IMPORTANT: For INHERITED components, we update the component's OWN record only
                    // We NEVER update the master component from a child - master RH is only updated 
                    // via the Running Hours sub-module which then cascades down to inherited components
                    try {
                      const counterType = (component.rhCounterType || '').toUpperCase();
                      const isInherited = counterType === 'INHERITED';
                      const isMaster = counterType === 'MASTER';
                      
                      if (isInherited) {
                        // For INHERITED components: Update only the component's own running hours record
                        // This reflects in Section B of the component view
                        // The master component RH should ONLY be updated via Running Hours module
                        await storage.setComponentRunningHours({
                          componentId: component.id,
                          newRHValue: currentRH,
                          updateSource: 'WO_COMPLETION',
                          userId: freshWorkOrder.performedBy || freshWorkOrder.approver || 'System',
                          lastUpdatedDate: dateOfCompletion || new Date().toISOString().split('T')[0]
                        });
                        console.log(`✅ Updated INHERITED component ${component.componentCode} RH to ${currentRH} (Section B update only, master unchanged)`);
                      } else if (isMaster || !counterType) {
                        // For MASTER or untyped components: Update the component directly
                        await storage.setComponentRunningHours({
                          componentId: component.id,
                          newRHValue: currentRH,
                          updateSource: 'WO_COMPLETION',
                          userId: freshWorkOrder.performedBy || freshWorkOrder.approver || 'System',
                          lastUpdatedDate: dateOfCompletion || new Date().toISOString().split('T')[0]
                        });
                        console.log(`✅ Updated component ${component.componentCode} RH to ${currentRH}`);
                      }
                    } catch (rhUpdateError) {
                      console.error(`Failed to update component running hours:`, rhUpdateError);
                    }
                  }
                }
              }
            } catch (jobError) {
              console.error('Failed to update job cycle dates:', jobError);
            }
          } else {
            console.warn(`⚠️ Could not find component for work order ${freshWorkOrder.id}`);
          }
        }
      }
      
      // ========== SPARE CONSUMPTION ON APPROVAL ==========
      // Auto-deduct consumed spares from inventory when work order is approved
      // This mirrors the logic in POST /complete route but triggers on PATCH approval
      if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
        if (workOrder && workOrder.consumedSpareParts && Array.isArray(workOrder.consumedSpareParts)) {
          const consumedSpares = workOrder.consumedSpareParts as Array<{
            partNo: string;
            partCode?: string;
            description?: string;
            quantityConsumed: number | string;
            locationId?: number | null;
            location?: string;
            comments?: string;
          }>;
          
          console.log(`🔧 [PATCH Approval] Processing ${consumedSpares.length} consumed spares for WO ${workOrder.workOrderNo}`);
          
          for (const consumedSpare of consumedSpares) {
            const qtyConsumed = typeof consumedSpare.quantityConsumed === 'string' 
              ? parseFloat(consumedSpare.quantityConsumed) 
              : consumedSpare.quantityConsumed;
              
            if (qtyConsumed && qtyConsumed > 0) {
              try {
                // Get spares from inventory for this vessel
                const vesselId = workOrder.vesselId || 'V001';
                const allSpares = await storage.getSpares(vesselId);
                
                // Multi-step lookup strategy (same as POST /complete):
                // 1. Try exact match on partCode field (most reliable)
                // 2. If partCode empty, try matching partNo against spares.partCode
                // 3. As last resort, try matching partNo against spares.partNumber
                let spare = null;
                
                // Step 1: Try partCode first if available
                if (consumedSpare.partCode) {
                  spare = allSpares.find(s => s.partCode === consumedSpare.partCode);
                }
                
                // Step 2: If not found and partNo available, try matching partNo against partCode
                if (!spare && consumedSpare.partNo) {
                  spare = allSpares.find(s => s.partCode === consumedSpare.partNo);
                }
                
                // Step 3: Last resort - try matching partNo against partNumber field
                if (!spare && consumedSpare.partNo) {
                  spare = allSpares.find(s => s.partNumber === consumedSpare.partNo);
                }
                
                if (spare) {
                  // Resolve locationId: try direct locationId first, then resolve from location name
                  let resolvedLocationId = consumedSpare.locationId ? parseInt(String(consumedSpare.locationId)) : null;
                  
                  // If no locationId but location name is provided, resolve it (auto-create if doesn't exist)
                  if ((!resolvedLocationId || isNaN(resolvedLocationId)) && consumedSpare.location) {
                    const locationObj = await storage.findOrCreateLocation(vesselId, consumedSpare.location, workOrder.approver || 'system');
                    if (locationObj) {
                      resolvedLocationId = locationObj.id;
                      console.log(`📍 [PATCH Approval] Resolved location name "${consumedSpare.location}" to ID ${resolvedLocationId}`);
                    }
                  }
                  
                  if (resolvedLocationId && !isNaN(resolvedLocationId)) {
                    // Use new inventory transaction system with location tracking
                    try {
                      await storage.performInventoryTransaction({
                        vesselId: vesselId,
                        spareId: spare.id,
                        locationId: resolvedLocationId,
                        eventType: 'CONSUME',
                        qtyChange: -Math.abs(qtyConsumed), // Negative for consumption
                        referenceType: 'WORK_ORDER',
                        referenceId: workOrder.id,
                        referenceNote: `WO Approval: ${workOrder.workOrderNo} - ${consumedSpare.comments || 'Consumed during work approval'}`,
                        userId: workOrder.approver || 'system'
                      });
                      console.log(`✅ [PATCH Approval] Consumed ${qtyConsumed} units of ${consumedSpare.partCode || consumedSpare.partNo} from location ${resolvedLocationId} (WO: ${workOrder.workOrderNo})`);
                    } catch (txnError: any) {
                      if (txnError.message?.includes('INSUFFICIENT_STOCK') || txnError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                        // Propagate stock errors to fail the approval
                        throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${qtyConsumed} units of ${consumedSpare.partCode || consumedSpare.partNo}. ${txnError.message}`);
                      } else {
                        console.error(`❌ [PATCH Approval] Transaction error for ${consumedSpare.partCode || consumedSpare.partNo}:`, txnError);
                        throw txnError;
                      }
                    }
                  } else {
                    // PHASE 3B: locationId is REQUIRED for inventory-tracked spares - REJECT approval
                    const errorMsg = `LOCATION_REQUIRED: Spare part ${consumedSpare.partCode || consumedSpare.partNo} requires a storage location for inventory tracking. Please select a location in the work order form.`;
                    console.error(`❌ [PATCH Approval] ${errorMsg}`);
                    throw new Error(errorMsg);
                  }
                } else {
                  // Spare not found in inventory - REJECT approval with clear error
                  const errorMsg = `SPARE_NOT_FOUND: Spare part ${consumedSpare.partCode || consumedSpare.partNo} was not found in inventory. Searched: partCode="${consumedSpare.partCode}", partNo="${consumedSpare.partNo}". Please verify the spare exists in the inventory.`;
                  console.error(`❌ [PATCH Approval] ${errorMsg}`);
                  throw new Error(errorMsg);
                }
              } catch (spareError: any) {
                // PHASE 3B: Propagate enforcement errors to fail the approval
                if (spareError.message?.includes('LOCATION_REQUIRED') || 
                    spareError.message?.includes('SPARE_NOT_FOUND') ||
                    spareError.message?.includes('INSUFFICIENT_STOCK') ||
                    spareError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                  console.error(`❌ [PATCH Approval] Enforcement error: ${spareError.message}`);
                  throw spareError; // Rethrow to fail the work order approval
                }
                console.error(`❌ [PATCH Approval] Failed to process spare ${consumedSpare.partCode || consumedSpare.partNo}:`, spareError);
                // Don't fail the approval for other types of spare processing errors - log and continue
              }
            }
          }
        }
      }
      // ========== END SPARE CONSUMPTION ON APPROVAL ==========
      
      res.json(workOrder);
    } catch (error: any) {
      console.error('❌ Work order update error:', error);
      if (error.name === 'ZodError') {
        console.error('❌ Zod validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid work order data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      // Return 400 for inventory enforcement errors (LOCATION_REQUIRED, SPARE_NOT_FOUND, INSUFFICIENT_STOCK)
      if (error.message?.includes('LOCATION_REQUIRED') || 
          error.message?.includes('SPARE_NOT_FOUND') ||
          error.message?.includes('INSUFFICIENT_STOCK') ||
          error.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update work order" });
    }
  });
  
  // Bulk approve work orders - for Head of Dept approval workflow
  app.post("/technical/api/work-orders/bulk-approve", async (req, res) => {
    try {
      const { workOrderIds, approver, approverRemarks } = req.body;
      
      if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
        return res.status(400).json({ error: "workOrderIds array is required" });
      }
      
      console.log(`📋 Bulk approving ${workOrderIds.length} work orders`);
      
      const results: { success: string[]; failed: { id: string; error: string }[] } = {
        success: [],
        failed: []
      };
      
      for (const workOrderId of workOrderIds) {
        try {
          const existingWO = await storage.getWorkOrder(workOrderId);
          if (!existingWO) {
            results.failed.push({ id: workOrderId, error: "Work order not found" });
            continue;
          }
          
          // Only approve work orders in 'Pending Approval' status
          if (existingWO.status !== 'Pending Approval' && 
              (existingWO as any).computedStatus !== 'Pending Approval') {
            results.failed.push({ id: workOrderId, error: `Work order is not pending approval (status: ${existingWO.status})` });
            continue;
          }
          
          // Calculate next due date/reading based on actual completion date
          const actualCompletionDate = existingWO.completionDateTime || existingWO.dateCompleted;
          let nextDueDate = undefined;
          let nextDueReading = undefined;
          
          if (existingWO.maintenanceBasis === "Calendar" && actualCompletionDate) {
            const completionDate = new Date(actualCompletionDate);
            if (!isNaN(completionDate.getTime())) {
              const freq = parseInt(existingWO.frequencyValue || "0");
              if (existingWO.frequencyUnit === "Days") {
                completionDate.setDate(completionDate.getDate() + freq);
              } else if (existingWO.frequencyUnit === "Weeks") {
                completionDate.setDate(completionDate.getDate() + (freq * 7));
              } else if (existingWO.frequencyUnit === "Months") {
                completionDate.setMonth(completionDate.getMonth() + freq);
              } else if (existingWO.frequencyUnit === "Years") {
                completionDate.setFullYear(completionDate.getFullYear() + freq);
              }
              nextDueDate = completionDate.toISOString().split('T')[0];
            }
          } else if (existingWO.maintenanceBasis === "Running Hours" && existingWO.currentReading) {
            nextDueReading = (parseInt(existingWO.currentReading) + parseInt(existingWO.frequencyValue || "0")).toString();
          }
          
          const updateData: Record<string, any> = {
            status: "Completed",
            approvalAction: "approved",
            approver: approver || "Head of Dept",
            approverRemarks: approverRemarks,
            approvalDate: new Date().toISOString(),
            nextDueDate,
            nextDueReading,
            // Clear wasRejected flag on successful approval
            wasRejected: false
          };
          
          if (actualCompletionDate) {
            updateData.dateCompleted = actualCompletionDate;
          }
          
          await storage.updateWorkOrder(workOrderId, updateData);
          results.success.push(workOrderId);
          console.log(`✅ Approved work order: ${workOrderId}`);
        } catch (err: any) {
          console.error(`❌ Failed to approve work order ${workOrderId}:`, err.message);
          results.failed.push({ id: workOrderId, error: err.message });
        }
      }
      
      res.json({
        message: `Bulk approval completed: ${results.success.length} approved, ${results.failed.length} failed`,
        results
      });
    } catch (error: any) {
      console.error("Bulk approve work orders error:", error);
      res.status(500).json({ error: "Failed to bulk approve work orders" });
    }
  });
  
  // Bulk reject work orders - for Head of Dept rejection workflow
  app.post("/technical/api/work-orders/bulk-reject", async (req, res) => {
    try {
      const { workOrderIds, approver, rejectionComments } = req.body;
      
      if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
        return res.status(400).json({ error: "workOrderIds array is required" });
      }
      
      console.log(`📋 Bulk rejecting ${workOrderIds.length} work orders`);
      
      const results: { success: string[]; failed: { id: string; error: string }[] } = {
        success: [],
        failed: []
      };
      
      for (const workOrderId of workOrderIds) {
        try {
          const existingWO = await storage.getWorkOrder(workOrderId);
          if (!existingWO) {
            results.failed.push({ id: workOrderId, error: "Work order not found" });
            continue;
          }
          
          // Only reject work orders in 'Pending Approval' status
          if (existingWO.status !== 'Pending Approval' && 
              (existingWO as any).computedStatus !== 'Pending Approval') {
            results.failed.push({ id: workOrderId, error: `Work order is not pending approval (status: ${existingWO.status})` });
            continue;
          }
          
          const updateData = {
            status: "Due", // Rejected WOs go back to Due
            approvalAction: "rejected",
            approver: approver || "Head of Dept",
            rejectionComments: rejectionComments,
            rejectionDate: new Date().toISOString(),
            wasRejected: true, // Mark for red font display
            // Clear completion data for rework
            completionDateTime: null,
            dateCompleted: null
          };
          
          await storage.updateWorkOrder(workOrderId, updateData);
          results.success.push(workOrderId);
          console.log(`❌ Rejected work order: ${workOrderId}`);
        } catch (err: any) {
          console.error(`❌ Failed to reject work order ${workOrderId}:`, err.message);
          results.failed.push({ id: workOrderId, error: err.message });
        }
      }
      
      res.json({
        message: `Bulk rejection completed: ${results.success.length} rejected, ${results.failed.length} failed`,
        results
      });
    } catch (error: any) {
      console.error("Bulk reject work orders error:", error);
      res.status(500).json({ error: "Failed to bulk reject work orders" });
    }
  });
  
  // Complete work order with running hours update (atomic operation)
  app.post("/technical/api/work-orders/:id/complete", async (req, res) => {
    try {
      const { runningHours, dateOfCompletion, ...executionData } = req.body;
      
      // Get work order and component context
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      // Try multiple methods to find the component:
      // 1. By ID (workOrder.component might be an ID for some work orders)
      // 2. By component code + vessel (most reliable for auto-generated WOs)
      // 3. By component name + vessel (fallback for legacy WOs)
      let component = await storage.getComponent(workOrder.component);
      
      if (!component && workOrder.componentCode && workOrder.vesselId) {
        // Try lookup by component code
        const componentByCode = await storage.getComponentByCode(workOrder.componentCode, workOrder.vesselId);
        if (componentByCode) {
          // VALIDATION: Ensure component name matches to prevent wrong component linkage
          // This handles cases where componentCode in work order may be incorrect
          if (componentByCode.name === workOrder.component) {
            component = componentByCode;
            console.log(`📋 Found component by code ${workOrder.componentCode} for vessel ${workOrder.vesselId}`);
          } else {
            console.warn(`⚠️ Component code ${workOrder.componentCode} found but name mismatch: "${componentByCode.name}" vs "${workOrder.component}". Will try name lookup.`);
          }
        }
      }
      
      if (!component && workOrder.vesselId) {
        // Fallback: Search by component name (more reliable than code when there's a mismatch)
        const vesselComponents = await storage.getComponents(workOrder.vesselId);
        // Prioritize exact name match first
        component = vesselComponents.find(c => c.name === workOrder.component);
        // If no name match, try component code match
        if (!component) {
          component = vesselComponents.find(c => c.componentCode === workOrder.componentCode);
        }
        if (component) {
          console.log(`📋 Found component by name/code match: ${component.name}`);
        }
      }
      
      if (!component) {
        return res.status(404).json({ error: `Component not found: ${workOrder.component} (code: ${workOrder.componentCode})` });
      }
      
      // Rule #19: Multi-Department Approver Validation
      // If an approverUserId is provided and the job has a department, validate the match
      const { approverUserId } = req.body;
      if (approverUserId && workOrder.jobId) {
        try {
          const job = await storage.getJob(workOrder.jobId);
          if (job && job.department) {
            const approver = await storage.getUser(approverUserId);
            if (approver && approver.department && approver.department !== job.department) {
              return res.status(400).json({
                error: `Approver department mismatch: Approver belongs to "${approver.department}" but job requires "${job.department}" department authorization.`,
                code: 'DEPARTMENT_MISMATCH'
              });
            }
            console.log(`[RULE #19] Department validation passed: Approver (${approver?.department || 'no dept'}) can approve job in ${job.department} department`);
          }
        } catch (deptError) {
          console.warn('[RULE #19] Department validation skipped due to error:', deptError);
          // Don't block completion if validation lookup fails - log and continue
        }
      }
      
      // This endpoint is ONLY for completing work orders
      // Enforce running hours requirement for RH-based maintenance
      if (workOrder.maintenanceBasis === 'Running Hours' && !runningHours) {
        return res.status(400).json({
          error: "Running hours is required for RH-based maintenance work orders"
        });
      }
      
      // Backend validation and update
      if (runningHours) {
        const newRH = parseInt(runningHours);
        
        // GLOBAL BUSINESS RULES COMPLIANCE (Section 5.5, 8.2):
        // Work Orders update ONLY sub-component RH
        // Work Orders NEVER update parent RH
        // Work Orders NEVER cascade to children
        // Only Running Hours module has authority over parent RH
        
        // CRITICAL: Validate this is a sub-component, not a parent
        if (!component.parentId) {
          return res.status(400).json({
            error: 'Work orders can only update sub-component running hours. Parent component RH must be updated through the Running Hours module.'
          });
        }
        
        // CRITICAL: Capture original RH BEFORE updating (parse from string)
        const previousRH = parseInt(component.currentCumulativeRH);
        
        // Ensure complete metadata for audit (get from work order which always has it)
        const componentVesselId = workOrder.vesselId || component.vesselId || 'V001';
        const componentCode = workOrder.componentCode || component.componentCode;
        
        // Validate against parent (sub-component RH must never exceed parent RH)
        const parentComponent = await storage.getComponent(component.parentId);
        if (parentComponent) {
          const parentRH = parseInt(parentComponent.currentCumulativeRH);
          if (newRH > parentRH) {
            return res.status(400).json({
              error: `Sub-component running hours (${newRH}) cannot exceed parent component's running hours (${parentRH})`
            });
          }
        }
        
        // Validate no decrease (sub-component RH cannot go backward)
        if (newRH < previousRH) {
          return res.status(400).json({
            error: `Running hours cannot decrease from ${previousRH} to ${newRH}`
          });
        }
        
        // Validate realistic delta (max 25 hrs/day)
        if (dateOfCompletion && component.lastUpdated) {
          const completionDate = new Date(dateOfCompletion);
          const lastUpdate = new Date(component.lastUpdated);
          const daysDiff = Math.max(1, (completionDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          const hoursDelta = newRH - previousRH;
          const maxAllowed = daysDiff * 25;
          
          if (hoursDelta > maxAllowed) {
            return res.status(400).json({
              error: `Running hours increase of ${hoursDelta} hrs over ${daysDiff.toFixed(1)} days exceeds realistic limit (max ${maxAllowed.toFixed(0)} hrs at 25 hrs/day)`
            });
          }
        }
        
        // Update running hours using the CENTRALIZED function to ensure field sync
        // This ensures rhCurrentMaster/rhCurrentInheritedCached and currentCumulativeRH stay in sync
        // and properly cascades to inherited components if this is a MASTER component
        await storage.setComponentRunningHours({
          componentId: component.id,
          newRHValue: newRH,
          updateSource: 'WO_COMPLETION',
          userId: executionData.performedBy || 'System',
          lastUpdatedDate: dateOfCompletion || new Date().toISOString().split('T')[0]
        });
        
        // Record running hours audit entry with complete metadata
        await storage.createRunningHoursAudit({
          componentId: component.id,
          vesselId: componentVesselId,
          previousRH: previousRH.toString(),
          newRH: newRH.toString(),
          cumulativeRH: newRH.toString(),
          dateUpdatedLocal: dateOfCompletion || new Date().toISOString().split('T')[0],
          dateUpdatedTZ: 'UTC',
          enteredAtUTC: new Date(),
          userId: executionData.performedBy || 'System',
          source: 'workorder',
          notes: `Updated via work order completion: ${workOrder.templateCode}`,
          meterReplaced: false
        });
      }
      
      // Update work order execution data
      const updatedWorkOrder = await storage.updateWorkOrder(req.params.id, {
        ...executionData,
        runningHoursAtCompletion: runningHours ? parseInt(runningHours) : undefined,
        dateCompleted: dateOfCompletion,
        status: 'Completed'
      });
      
      // Auto-populate component_maintenance_history when work order is completed
      try {
        // DUPLICATE CHECK: Only create if no record exists for this work order
        const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(workOrder.id);
        if (existingHistory) {
          console.log(`⚠️ Maintenance history already exists for work order ${workOrder.id}, skipping duplicate creation`);
        } else {
          // Normalize date to ISO format (YYYY-MM-DD) for proper chronological sorting
          const normalizeToISO = (isoDate: string | undefined): string => {
            if (!isoDate) {
              return new Date().toISOString().split('T')[0];
            }
            // Ensure ISO format
            const date = new Date(isoDate);
            return date.toISOString().split('T')[0];
          };

          // Get job information for proper job linkage in maintenance history
          let parentJob = null;
          let parentJobNo: string | null = null;
          
          // First try direct lookup by jobId
          if (workOrder.jobId) {
            parentJob = await storage.getJob(workOrder.jobId);
            if (parentJob) {
              parentJobNo = parentJob.jobNo;
            }
          }
          
          // Fallback: Extract jobNo from work order number
          if (!parentJobNo && workOrder.workOrderNo) {
            const woNumber = workOrder.workOrderNo;
            // Try NEW format first: <JOB_NO>-<COMPONENT_CODE>-<YYYY>-<RUNNING>
            const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
            if (newFormatMatch) {
              parentJobNo = newFormatMatch[1];
            }
            // Try OLD format: MKR-IN-00001-2025-001 (jobNo-year-running)
            if (!parentJobNo) {
              const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
              if (oldFormatMatch) {
                parentJobNo = oldFormatMatch[1];
              }
            }
            // If we extracted a job number but don't have job object, try to find it
            if (parentJobNo && !parentJob) {
              const allJobs = await storage.getJobsByVessel(workOrder.vesselId);
              parentJob = allJobs.find(j => j.jobNo === parentJobNo) || null;
            }
          }

          // Use schema validation for type safety and defaults
          // FIX: Use component.id (actual UUID) not workOrder.component (which is the component NAME)
          const historyPayload = {
            componentId: component.id,
            componentCode: workOrder.componentCode || component.componentCode,
            vesselCode: workOrder.vesselId,
            jobId: parentJob?.id || workOrder.jobId || null,
            jobCode: parentJobNo || null,
            workOrderId: workOrder.id,
            workOrderNo: workOrder.templateCode || `WO-${workOrder.id}`,
            jobTitle: workOrder.jobTitle,
            maintenanceType: workOrder.taskType || 'Servicing',
            dateCompleted: normalizeToISO(dateOfCompletion),
            runningHoursAtCompletion: runningHours || null,
            performedBy: executionData.performedBy || 'Unknown',
            approvedBy: executionData.approver || null,
            approvalDate: executionData.approvalDate ? normalizeToISO(executionData.approvalDate) : null,
            status: 'Approved' as const,
            workDescription: executionData.workDone || workOrder.briefWorkDescription || null,
            sparesUsed: executionData.sparesUsed || null,
            remarks: executionData.remarks || null,
            isComponentReplaced: false
          };

          await storage.createComponentMaintenanceHistory(historyPayload);
          console.log(`✅ Auto-populated maintenance history for work order ${workOrder.id} (componentId: ${component.id}, jobId: ${historyPayload.jobId}, jobCode: ${historyPayload.jobCode})`);
        }
      } catch (historyError) {
        console.error('Failed to create maintenance history record:', historyError);
        // Don't fail the work order completion if history creation fails
      }
      
      // Auto-update parent job's cycle fields (Calendar: lastDoneDate/nextDueDate, RH: lastDoneRH/nextDueRH)
      // Use work order's maintenanceBasis (not job's) since jobs don't have this field
      try {
        let job = null;
        
        // First try direct lookup by jobId
        if (workOrder.jobId) {
          job = await storage.getJob(workOrder.jobId);
        }
        
        // Fallback: Extract jobNo from work order number and find job by jobNo
        // Work order formats: MKR-SE-00010-702.010.01-2025-001 or MKR-SE-00010-2025-001
        if (!job && workOrder.workOrderNo) {
          const woNumber = workOrder.workOrderNo;
          // Try to extract jobNo from various WO number formats
          // NEW format: <JOB_NO>-<COMPONENT_CODE>-<YYYY>-<RUNNING>
          // OLD format: <JOB_NO>-<YYYY>-<RUNNING>
          let extractedJobNo: string | null = null;
          
          // Try NEW format first: has component code with dots before the year
          const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
          if (newFormatMatch) {
            extractedJobNo = newFormatMatch[1];
          }
          
          // Try OLD format: MKR-IN-00001-2025-001 (jobNo-year-running)
          if (!extractedJobNo) {
            const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
            if (oldFormatMatch) {
              extractedJobNo = oldFormatMatch[1];
            }
          }
          
          if (extractedJobNo) {
            // Search for job by jobNo in the vessel
            const vesselId = workOrder.vesselId || component.vesselId;
            if (vesselId) {
              const jobs = await storage.getJobs(vesselId);
              job = jobs.find(j => j.jobNo === extractedJobNo);
              if (job) {
                console.log(`📋 Found job ${job.jobNo} via work order number extraction (jobId was not linked)`);
              }
            }
          }
        }
        
        if (job) {
          const jobUpdates: any = {};
          const linkUpdates: any = { updatedAt: new Date() };
          
          // Get the specific work order component ID to update the correct link
          const woComponentId = workOrder.componentId || component.id;
          
          // Calendar-based job cycle update
          if (workOrder.maintenanceBasis === 'Calendar' && dateOfCompletion) {
            const { calculateNextDueDate } = await import('@shared/dateUtils');
            linkUpdates.lastDoneDate = dateOfCompletion;
            jobUpdates.lastDoneDate = dateOfCompletion; // Keep global job record for backward compatibility
            
            // Recalculate nextDueDate based on lastDoneDate + interval
            if (job.frequencyValue && job.frequencyUnit) {
              const nextDue = calculateNextDueDate(
                dateOfCompletion,
                job.frequencyValue,
                job.frequencyUnit
              );
              
              if (nextDue) {
                linkUpdates.nextDueDate = nextDue;
                jobUpdates.nextDueDate = nextDue;
                console.log(`✅ Auto-calculated next due date for job ${job.jobNo}: ${nextDue} (last done: ${dateOfCompletion}, interval: ${job.frequencyValue} ${job.frequencyUnit})`);
              }
            }
            
            // Update component-specific tracking in jobComponentLinks (PRIMARY source of truth)
            // VESSEL ISOLATION: Pass vesselId to ensure updates are vessel-scoped
            const updateVesselId = workOrder.vesselId || job.vesselId;
            if (woComponentId && updateVesselId) {
              await storage.updateJobComponentLinkTracking(updateVesselId, job.id, woComponentId, linkUpdates);
              console.log(`✅ Updated component-specific tracking for vessel ${updateVesselId}, job ${job.jobNo} + component ${woComponentId} with lastDoneDate: ${dateOfCompletion}`);
            }
            
            // Also update global job record for backward compatibility (SECONDARY)
            await storage.updateJob(job.id, jobUpdates);
            console.log(`✅ Updated calendar job ${job.jobNo} with lastDoneDate: ${dateOfCompletion}`);
          }
          
          // Running Hours-based job cycle update
          if (workOrder.maintenanceBasis === 'Running Hours' && runningHours) {
            const currentRH = parseInt(runningHours);
            if (!isNaN(currentRH)) {
              linkUpdates.lastDoneRH = currentRH.toString();
              jobUpdates.lastDoneRH = currentRH;
              
              // Recalculate nextDueRH based on lastDoneRH + interval
              // Use intervalRunningHour first (dedicated RH field), fallback to frequencyValue
              const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
              if (rhInterval && !isNaN(rhInterval)) {
                const nextDueRH = currentRH + rhInterval;
                linkUpdates.nextDueRH = nextDueRH.toString();
                jobUpdates.nextDueRH = nextDueRH;
                console.log(`✅ Auto-calculated next due RH for job ${job.jobNo}: ${nextDueRH} (last done: ${currentRH}, interval: ${rhInterval} hours)`);
              }
              
              // Update component-specific tracking in jobComponentLinks (PRIMARY source of truth)
              // VESSEL ISOLATION: Pass vesselId to ensure updates are vessel-scoped
              const rhUpdateVesselId = workOrder.vesselId || job.vesselId;
              if (woComponentId && rhUpdateVesselId) {
                await storage.updateJobComponentLinkTracking(rhUpdateVesselId, job.id, woComponentId, linkUpdates);
                console.log(`✅ Updated component-specific RH tracking for vessel ${rhUpdateVesselId}, job ${job.jobNo} + component ${woComponentId} with lastDoneRH: ${currentRH}`);
              }
              
              // Also update global job record for backward compatibility (SECONDARY)
              await storage.updateJob(job.id, jobUpdates);
              console.log(`✅ Updated RH job ${job.jobNo} with lastDoneRH: ${currentRH}`);
            }
          }
        } else {
          console.warn(`⚠️ Could not find job to update for work order ${workOrder.workOrderNo}`);
        }
      } catch (jobUpdateError) {
        console.error('Failed to update job cycle fields:', jobUpdateError);
        // Don't fail the work order completion if job update fails
      }
      
      // Auto-deduct consumed spares from inventory and create transaction records
      // PHASE 3B: Use new location-based inventory transaction system
      if (workOrder.consumedSpareParts && Array.isArray(workOrder.consumedSpareParts)) {
        const consumedSpares = workOrder.consumedSpareParts as Array<{
          partNo: string;
          partCode?: string;
          description?: string;
          quantityConsumed: number | string;
          locationId?: number | null;
          location?: string;
          comments?: string;
        }>;
        
        for (const consumedSpare of consumedSpares) {
          const qtyConsumed = typeof consumedSpare.quantityConsumed === 'string' 
            ? parseFloat(consumedSpare.quantityConsumed) 
            : consumedSpare.quantityConsumed;
            
          if (qtyConsumed && qtyConsumed > 0) {
            try {
              // Get spare from inventory
              // PRIORITY: Use partCode first (reliable unique identifier), then fallback to partNo/partNumber
              const spares = await storage.getSpares(workOrder.vesselId || 'V001');
              
              // Multi-step lookup strategy:
              // 1. Try exact match on partCode field (most reliable)
              // 2. If partCode empty, try matching partNo against spares.partCode
              // 3. As last resort, try matching partNo against spares.partNumber
              let spare = null;
              
              // Step 1: Try partCode first if available
              if (consumedSpare.partCode) {
                spare = spares.find(s => s.partCode === consumedSpare.partCode);
              }
              
              // Step 2: If not found and partNo available, try matching partNo against partCode
              if (!spare && consumedSpare.partNo) {
                spare = spares.find(s => s.partCode === consumedSpare.partNo);
              }
              
              // Step 3: Last resort - try matching partNo against partNumber field
              if (!spare && consumedSpare.partNo) {
                spare = spares.find(s => s.partNumber === consumedSpare.partNo);
              }
              
              if (spare) {
                const vesselId = workOrder.vesselId || 'V001';
                
                // Resolve locationId: try direct locationId first, then resolve from location name
                let resolvedLocationId = consumedSpare.locationId ? parseInt(String(consumedSpare.locationId)) : null;
                
                // If no locationId but location name is provided, resolve it (auto-create if doesn't exist)
                if ((!resolvedLocationId || isNaN(resolvedLocationId)) && consumedSpare.location) {
                  const locationObj = await storage.findOrCreateLocation(vesselId, consumedSpare.location, 'system');
                  if (locationObj) {
                    resolvedLocationId = locationObj.id;
                    console.log(`📍 [POST Complete] Resolved location name "${consumedSpare.location}" to ID ${resolvedLocationId}`);
                  }
                }
                
                if (resolvedLocationId && !isNaN(resolvedLocationId)) {
                  // Use new inventory transaction system with location tracking
                  try {
                    await storage.performInventoryTransaction({
                      vesselId: vesselId,
                      spareId: spare.id,
                      locationId: resolvedLocationId,
                      eventType: 'CONSUME',
                      qtyChange: -Math.abs(qtyConsumed), // Negative for consumption
                      referenceType: 'WORK_ORDER',
                      referenceId: workOrder.id,
                      referenceNote: `WO: ${workOrder.workOrderNo} - ${consumedSpare.comments || 'Consumed during work completion'}`
                    });
                    console.log(`✅ [Inventory Transaction] Consumed ${qtyConsumed} units of ${consumedSpare.partNo} from location ${resolvedLocationId} (WO: ${workOrder.workOrderNo})`);
                  } catch (txnError: any) {
                    if (txnError.message?.includes('INSUFFICIENT_STOCK') || txnError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                      console.warn(`⚠️ Insufficient stock for ${consumedSpare.partNo} at location ${resolvedLocationId}: ${txnError.message}`);
                      // PHASE 3B: Do NOT fall back to legacy ROB - reject the transaction
                      throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${qtyConsumed} units of ${consumedSpare.partNo} from location ${resolvedLocationId}. Insufficient stock.`);
                    } else {
                      throw txnError;
                    }
                  }
                } else {
                  // PHASE 3B: locationId is REQUIRED for inventory-tracked spares
                  // Reject work order completion without locationId - this enforces proper inventory tracking
                  console.error(`❌ [Inventory] Missing locationId for ${consumedSpare.partNo} - rejecting work order completion.`);
                  throw new Error(`LOCATION_REQUIRED: Spare part ${consumedSpare.partNo} requires a storage location for inventory tracking. Please select a location in the work order form.`);
                }
              } else {
                // PHASE 3B: Spare not found in inventory - REJECT completion with clear error
                const errorMsg = `SPARE_NOT_FOUND: Spare part ${consumedSpare.partCode || consumedSpare.partNo} was not found in inventory. Searched: partCode="${consumedSpare.partCode}", partNo="${consumedSpare.partNo}". Please verify the spare exists in the inventory.`;
                console.error(`❌ [POST Complete] ${errorMsg}`);
                throw new Error(errorMsg);
              }
            } catch (spareError: any) {
              // PHASE 3B: Propagate enforcement errors to fail the request
              if (spareError.message?.includes('LOCATION_REQUIRED') || 
                  spareError.message?.includes('SPARE_NOT_FOUND') ||
                  spareError.message?.includes('INSUFFICIENT_STOCK') ||
                  spareError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                console.error(`❌ [Inventory Enforcement] ${spareError.message}`);
                throw spareError; // Rethrow to fail the work order completion
              }
              console.error(`Failed to deduct spare ${consumedSpare.partNo}:`, spareError);
              // Don't fail the work order completion for other types of spare deduction errors
            }
          }
        }
      }
      
      res.json({
        success: true,
        workOrder: updatedWorkOrder,
        runningHoursUpdated: !!runningHours
      });
    } catch (error: any) {
      console.error('Work order completion error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid completion data", details: error.errors });
      }
      // PHASE 3B: Return 400 for inventory enforcement errors
      if (error.message?.includes('LOCATION_REQUIRED') || 
          error.message?.includes('SPARE_NOT_FOUND') ||
          error.message?.includes('INSUFFICIENT_STOCK') ||
          error.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to complete work order" });
    }
  });
  
  // Delete work order
  app.delete("/technical/api/work-orders/:id", async (req, res) => {
    try {
      await storage.deleteWorkOrder(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete work order" });
    }
  });
  
  // Auto-generate work orders for Calendar-based and RH-based jobs that have reached their lead time threshold
  app.post("/technical/api/work-orders/auto-generate", async (req, res) => {
    try {
      const vesselId = req.body.vesselId as string;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      
      // Fetch vessel-specific PMS settings (lead times & grace periods)
      const vesselSettings = await storage.getPmsVesselSettings(vesselId);
      
      // Default lead times if vessel settings not configured
      const calendarLeadDaysCritical = vesselSettings?.calendarLeadDaysCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_CRITICAL;
      const calendarLeadDaysNonCritical = vesselSettings?.calendarLeadDaysNonCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_NON_CRITICAL;
      const rhLeadHoursCritical = vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL;
      const rhLeadHoursNonCritical = vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL;
      
      console.log(`[AUTO-GEN] Using lead times for vessel ${vesselId}: Calendar (C: ${calendarLeadDaysCritical}d, NC: ${calendarLeadDaysNonCritical}d), RH (C: ${rhLeadHoursCritical}hrs, NC: ${rhLeadHoursNonCritical}hrs)`);
      
      // Get all active jobs for the vessel
      const allJobs = await storage.getJobs(vesselId);
      const calendarJobs = allJobs.filter(job => 
        job.maintenanceBasis === 'Calendar' && 
        job.nextDueDate && 
        job.isActive !== false
      );
      const rhJobs = allJobs.filter(job =>
        job.maintenanceBasis === 'Running Hours' &&
        job.nextDueRH &&
        job.isActive !== false
      );
      
      // Fetch all work orders ONCE to avoid O(n²) performance
      const allWorkOrders = await storage.getWorkOrders(vesselId);
      
      // Build a Set of active work order keys for fast lookup
      // Key format: "componentCode|jobNo" to uniquely identify a job's work order
      const activeWorkOrderKeys = new Set(
        allWorkOrders
          .filter(wo => ['Active', 'Due', 'Due (Grace P)', 'Overdue', 'Pending Approval'].includes(wo.status))
          .map(wo => `${wo.componentCode}|${wo.jobTitle}`)
      );
      
      const results = {
        checked: calendarJobs.length + rhJobs.length,
        generated: 0,
        workOrders: [] as any[],
        vesselSettingsUsed: vesselSettings ? true : false
      };
      
      // Fetch all components to get currentRH for RH-based jobs
      const allComponents = await storage.getComponents(vesselId);
      const componentsMap = new Map(allComponents.map(c => [c.id, c]));
      
      // Process Calendar-based jobs
      for (const job of calendarJobs) {
        // Determine lead time based on job criticality
        const isCritical = job.criticality === 'Yes' || job.jobPriority === 'Critical';
        const leadTimeDays = isCritical ? calendarLeadDaysCritical : calendarLeadDaysNonCritical;
        
        const shouldGenerate = shouldGenerateWorkOrder(job.nextDueDate, new Date(), leadTimeDays);
        
        if (shouldGenerate) {
          // O(1) duplicate check using Set
          const workOrderKey = `${job.componentCode}|${job.jobTitle}`;
          
          if (!activeWorkOrderKeys.has(workOrderKey)) {
            // Generate spec-compliant work order number
            const { generatePlannedWorkOrderNumber } = await import('./utils/workOrderNumbering');
            const jobCode = job.jobNo || 'JOB-UNKNOWN';
            // Get component code from job, fallback to component record
            let componentCode = job.componentCode;
            if (!componentCode && job.componentId) {
              const component = componentsMap.get(job.componentId);
              componentCode = component?.componentCode;
            }
            if (!componentCode) {
              console.warn(`⚠️ No component code for calendar job ${job.jobNo} - skipping WO generation`);
              continue;
            }
            const workOrderNo = await generatePlannedWorkOrderNumber(storage, jobCode, componentCode, vesselId);
            
            const workOrderData = {
              vesselId: job.vesselId,
              component: job.componentId,
              componentCode: componentCode,
              jobId: job.id, // Store job ID for reliable lead time hydration
              workOrderNo: workOrderNo,
              workOrderType: 'Planned' as const,
              templateCode: workOrderNo,
              jobTitle: job.jobTitle,
              assignedTo: job.assignedTo || 'Unassigned',
              dueDate: job.nextDueDate,
              status: 'Active',
              taskType: job.maintenanceType,
              maintenanceBasis: job.maintenanceBasis,
              frequencyValue: job.frequencyValue?.toString(),
              frequencyUnit: job.frequencyUnit,
              jobPriority: job.jobPriority,
              classRelated: job.classRelated,
              briefWorkDescription: job.briefWorkDescription,
              department: job.department,
              requiredSpareParts: job.requiredSpareParts || [],
              requiredTools: job.requiredTools || [],
              safetyRequirements: job.safetyRequirements || {ppeRequirements: [], permitRequirements: [], otherRequirements: []}
            };
            
            const createdWO = await storage.createWorkOrder(workOrderData);
            results.generated++;
            results.workOrders.push(createdWO);
            
            // Add to Set to prevent duplicate generation in same run
            activeWorkOrderKeys.add(workOrderKey);
            
            console.log(`✅ Auto-generated work order ${workOrderNo} for job ${job.jobNo} (${job.jobTitle})`);
          }
        }
      }
      
      // Process Running Hours-based jobs
      for (const job of rhJobs) {
        // Get component to check current RH
        const component = componentsMap.get(job.componentId);
        if (!component) {
          console.warn(`⚠️  Component ${job.componentId} not found for RH job ${job.jobNo} - skipping`);
          continue;
        }
        
        const currentRH = parseInt(component.currentCumulativeRH || '0');
        const dueRH = parseInt(job.nextDueRH || '0');
        
        // Determine lead time based on job criticality - use vessel settings
        const isCritical = job.criticality === 'Yes' || job.jobPriority === 'Critical';
        const leadTimeHours = isCritical ? rhLeadHoursCritical : rhLeadHoursNonCritical;
        
        // Check if we should generate (current RH >= due RH - lead time)
        const shouldGenerate = currentRH >= (dueRH - leadTimeHours);
        
        if (shouldGenerate) {
          // O(1) duplicate check using Set
          const workOrderKey = `${job.componentCode}|${job.jobTitle}`;
          
          if (!activeWorkOrderKeys.has(workOrderKey)) {
            // Generate spec-compliant work order number
            const { generatePlannedWorkOrderNumber } = await import('./utils/workOrderNumbering');
            const jobCode = job.jobNo || 'JOB-UNKNOWN';
            // Get component code from job, fallback to component record
            const componentCode = job.componentCode || component?.componentCode;
            if (!componentCode) {
              console.warn(`⚠️ No component code for RH job ${job.jobNo} - skipping WO generation`);
              continue;
            }
            const workOrderNo = await generatePlannedWorkOrderNumber(storage, jobCode, componentCode, vesselId);
            
            const workOrderData = {
              vesselId: job.vesselId,
              component: job.componentId,
              componentCode: componentCode, // Use resolved componentCode
              jobId: job.id, // Store job ID for reliable lead time hydration
              workOrderNo: workOrderNo,
              workOrderType: 'Planned' as const,
              templateCode: workOrderNo,
              jobTitle: job.jobTitle,
              assignedTo: job.assignedTo || 'Unassigned',
              dueDate: null, // RH-based jobs don't have calendar due dates
              status: 'Active',
              taskType: job.maintenanceType,
              maintenanceBasis: job.maintenanceBasis,
              frequencyValue: job.frequencyValue?.toString(),
              frequencyUnit: 'Hours', // RH-based jobs use hours
              jobPriority: job.jobPriority,
              classRelated: job.classRelated,
              briefWorkDescription: job.briefWorkDescription,
              department: job.department,
              requiredSpareParts: job.requiredSpareParts || [],
              requiredTools: job.requiredTools || [],
              safetyRequirements: job.safetyRequirements || {ppeRequirements: [], permitRequirements: [], otherRequirements: []}
            };
            
            const createdWO = await storage.createWorkOrder(workOrderData);
            results.generated++;
            results.workOrders.push(createdWO);
            
            // Add to Set to prevent duplicate generation in same run
            activeWorkOrderKeys.add(workOrderKey);
            
            console.log(`✅ Auto-generated RH-based work order ${workOrderNo} for job ${job.jobNo} (${job.jobTitle}) - Current RH: ${currentRH}, Due RH: ${dueRH}`);
          }
        }
      }
      
      res.json(results);
    } catch (error: any) {
      console.error('Auto-generation error:', error);
      res.status(500).json({ error: "Failed to auto-generate work orders" });
    }
  });
  
  // Backfill jobId for legacy work orders (Task 33)
  app.post("/technical/api/work-orders/backfill-job-ids", async (req, res) => {
    try {
      const vesselId = req.body.vesselId as string | undefined;
      
      // Get all work orders (optionally filtered by vessel)
      const allWorkOrders = await storage.getWorkOrders(vesselId);
      const workOrdersNeedingJobId = allWorkOrders.filter(wo => !wo.jobId && wo.component && wo.jobTitle);
      
      if (workOrdersNeedingJobId.length === 0) {
        return res.json({
          checked: allWorkOrders.length,
          updated: 0,
          message: "All work orders already have jobId or lack required fields (component, jobTitle)"
        });
      }
      
      // Get all jobs for efficient lookup
      const allJobs = await storage.getJobs(vesselId);
      
      let updated = 0;
      const updateResults: Array<{ workOrderId: string; jobId: string | null; reason: string }> = [];
      
      for (const wo of workOrdersNeedingJobId) {
        // Try to match job by component and jobTitle
        const matchingJob = allJobs.find(j => 
          j.componentId === wo.component && 
          j.jobTitle === wo.jobTitle &&
          (!vesselId || j.vesselId === wo.vesselId)
        );
        
        if (matchingJob) {
          await storage.updateWorkOrder(wo.id, { jobId: matchingJob.id });
          updated++;
          updateResults.push({
            workOrderId: wo.id,
            jobId: matchingJob.id,
            reason: `Matched by component (${wo.component}) + jobTitle ("${wo.jobTitle}")`
          });
          console.log(`✅ Backfilled jobId ${matchingJob.id} for work order ${wo.id}`);
        } else {
          updateResults.push({
            workOrderId: wo.id,
            jobId: null,
            reason: `No matching job found for component (${wo.component}) + jobTitle ("${wo.jobTitle}")`
          });
        }
      }
      
      res.json({
        checked: allWorkOrders.length,
        needingBackfill: workOrdersNeedingJobId.length,
        updated,
        skipped: workOrdersNeedingJobId.length - updated,
        details: updateResults.slice(0, 100) // Return first 100 for review
      });
    } catch (error: any) {
      console.error('Backfill jobId error:', error);
      res.status(500).json({ error: "Failed to backfill jobId" });
    }
  });

  // Work Order Execution API routes
  
  // Get all executions for a component
  app.get("/technical/api/work-order-executions/:componentId", async (req, res) => {
    try {
      const executions = await storage.getWorkOrderExecutions(req.params.componentId);
      res.json(executions);
    } catch (error) {
      console.error("Error fetching work order executions:", error);
      res.status(500).json({ error: "Failed to fetch work order executions" });
    }
  });
  
  // Get single execution by ID
  app.get("/technical/api/work-order-executions/details/:id", async (req, res) => {
    try {
      const execution = await storage.getWorkOrderExecutionById(req.params.id);
      if (!execution) {
        return res.status(404).json({ error: "Work order execution not found" });
      }
      res.json(execution);
    } catch (error) {
      console.error("Error fetching work order execution:", error);
      res.status(500).json({ error: "Failed to fetch work order execution" });
    }
  });
  
  // Create new execution
  app.post("/technical/api/work-order-executions", async (req, res) => {
    try {
      const executionData = insertWorkOrderExecutionSchema.parse(req.body);
      const execution = await storage.createWorkOrderExecution(executionData);
      res.json(execution);
    } catch (error: any) {
      console.error('Work order execution creation error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid execution data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create work order execution" });
    }
  });
  
  // Update execution
  app.patch("/technical/api/work-order-executions/:id", async (req, res) => {
    try {
      const partialExecutionSchema = insertWorkOrderExecutionSchema.partial();
      const validatedData = partialExecutionSchema.parse(req.body);
      const execution = await storage.updateWorkOrderExecution(req.params.id, validatedData);
      res.json(execution);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid execution data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update work order execution" });
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
  
  // ===== EQUIPMENT CATEGORIES API =====
  // Get all equipment categories
  app.get("/technical/api/equipment-categories", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const categories = await db.select().from(equipmentCategories).orderBy(equipmentCategories.sortOrder);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching equipment categories:", error);
      res.status(500).json({ error: "Failed to fetch equipment categories" });
    }
  });

  // Create equipment category
  app.post("/technical/api/equipment-categories", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const { name, sortOrder = 0, isActive = true } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }
      if (sortOrder !== undefined && typeof sortOrder !== 'number') {
        return res.status(400).json({ error: "Sort order must be a number" });
      }
      const [category] = await db.insert(equipmentCategories).values({
        name: name.trim(),
        sortOrder,
        isActive,
      }).returning();
      res.status(201).json(category);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Category with this name already exists" });
      }
      console.error("Error creating equipment category:", error);
      res.status(500).json({ error: "Failed to create equipment category" });
    }
  });

  // Update equipment category
  app.patch("/technical/api/equipment-categories/:id", async (req, res) => {
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
      
      const [category] = await db.update(equipmentCategories)
        .set(updates)
        .where(eq(equipmentCategories.id, id))
        .returning();
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Category with this name already exists" });
      }
      console.error("Error updating equipment category:", error);
      res.status(500).json({ error: "Failed to update equipment category" });
    }
  });

  // Delete equipment category
  app.delete("/technical/api/equipment-categories/:id", async (req, res) => {
    try {
      const { db } = getPostgresClient();
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(equipmentCategories)
        .where(eq(equipmentCategories.id, id))
        .returning();
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting equipment category:", error);
      res.status(500).json({ error: "Failed to delete equipment category" });
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

  // Components routes...
  app.post("/technical/api/components", async (req, res) => {
    try {
      const data = req.body;
      
      // RH field validation (B7.B rules)
      // Validate when rhCounterType OR rhMasterComponentId is provided
      const effectiveRhType = data.rhCounterType || 'NOT_RH_DRIVEN';
      
      if (data.rhCounterType || data.rhMasterComponentId) {
        if (effectiveRhType === 'MASTER') {
          // MASTER: rh_inherit_from must be NULL
          if (data.rhMasterComponentId) {
            return res.status(400).json({ 
              error: "MASTER counter type cannot have a master component reference" 
            });
          }
        } else if (effectiveRhType === 'INHERITED') {
          // INHERITED: rh_inherit_from must be set
          if (!data.rhMasterComponentId) {
            return res.status(400).json({ 
              error: "INHERITED counter type requires rhMasterComponentId" 
            });
          }
          // Validate master exists, same vessel, and is MASTER type
          const masterComponent = await storage.getComponent(data.rhMasterComponentId);
          if (!masterComponent) {
            return res.status(400).json({ error: "Master component not found" });
          }
          if (masterComponent.vesselId !== data.vesselId) {
            return res.status(400).json({ 
              error: "Master component must be from the same vessel" 
            });
          }
          if (masterComponent.rhCounterType !== 'MASTER') {
            return res.status(400).json({ 
              error: "Referenced component is not a MASTER counter type" 
            });
          }
        } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
          // NOT_RH_DRIVEN: rh_inherit_from must be NULL
          if (data.rhMasterComponentId) {
            return res.status(400).json({ 
              error: "NOT_RH_DRIVEN counter type cannot have a master component reference" 
            });
          }
        }
      }
      
      const component = await storage.createComponent(data);
      console.log('[API_CREATE] New component:', { 
        id: component.id, 
        code: component.componentCode, 
        parentId: component.parentId,
        vesselId: component.vesselId 
      });
      res.status(201).json(component);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create component" });
    }
  });
  
  app.get("/technical/api/components", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string | undefined;
      // getComponents requires vesselId - use default 'V001' if not provided
      const components = await storage.getComponents(vesselId || 'V001');
      res.json(components);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });

  app.get("/technical/api/components/:id", async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(component);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch component" });
    }
  });
  
  app.patch("/technical/api/components/:id", async (req, res) => {
    try {
      console.log(`🔧 PATCH /api/components/${req.params.id} with:`, JSON.stringify(req.body, null, 2).substring(0, 500));
      const data = req.body;
      
      // Get existing component for validation
      const existingComponent = await storage.getComponent(req.params.id);
      if (!existingComponent) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      // RH field validation (B7.B rules)
      // Use effective counter type from request or existing component
      const effectiveRhType = data.rhCounterType || existingComponent.rhCounterType || 'NOT_RH_DRIVEN';
      // Use effective master ID from request or existing component
      const effectiveMasterId = data.rhMasterComponentId !== undefined 
        ? data.rhMasterComponentId 
        : existingComponent.rhMasterComponentId;
      
      if (data.rhCounterType || data.rhMasterComponentId !== undefined) {
        if (effectiveRhType === 'MASTER') {
          // MASTER: rh_inherit_from must be NULL
          if (effectiveMasterId) {
            return res.status(400).json({ 
              error: "MASTER counter type cannot have a master component reference" 
            });
          }
        } else if (effectiveRhType === 'INHERITED') {
          // INHERITED: rh_inherit_from must be set
          if (!effectiveMasterId) {
            return res.status(400).json({ 
              error: "INHERITED counter type requires rhMasterComponentId" 
            });
          }
          // Prevent self-reference
          if (effectiveMasterId === req.params.id) {
            return res.status(400).json({ 
              error: "A component cannot inherit running hours from itself" 
            });
          }
          // Validate master exists, same vessel, and is MASTER type
          const masterComponent = await storage.getComponent(effectiveMasterId);
          if (!masterComponent) {
            return res.status(400).json({ error: "Master component not found" });
          }
          if (masterComponent.vesselId !== existingComponent.vesselId) {
            return res.status(400).json({ 
              error: "Master component must be from the same vessel" 
            });
          }
          if (masterComponent.rhCounterType !== 'MASTER') {
            return res.status(400).json({ 
              error: "Referenced component is not a MASTER counter type" 
            });
          }
        } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
          // NOT_RH_DRIVEN: rh_inherit_from must be NULL
          if (effectiveMasterId) {
            return res.status(400).json({ 
              error: "NOT_RH_DRIVEN counter type cannot have a master component reference" 
            });
          }
        }
        
        // Downgrade protection: Prevent MASTER → NONE/INHERITED if component has dependents
        if (existingComponent.rhCounterType === 'MASTER' && effectiveRhType !== 'MASTER') {
          const dependents = await storage.getInheritedComponents(req.params.id);
          if (dependents.length > 0) {
            const dependentNames = dependents.slice(0, 3).map((d: any) => d.name).join(', ');
            const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
            return res.status(400).json({ 
              error: `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
            });
          }
        }
      }
      
      // INTERCEPT RH UPDATES: If running hours are being updated, use the centralized function
      // to ensure all RH fields stay in sync and cascade properly to inherited components
      let component;
      if (data.currentCumulativeRH !== undefined || data.runningHours !== undefined) {
        const rhValue = parseFloat(data.currentCumulativeRH || data.runningHours || '0');
        if (!isNaN(rhValue)) {
          // Use centralized RH update for field sync and cascade
          // Forward any supplied lastUpdated to preserve caller's date intent
          const result = await storage.setComponentRunningHours({
            componentId: req.params.id,
            newRHValue: rhValue,
            updateSource: 'MANUAL',
            userId: (req as any).user?.username || 'unknown',
            lastUpdatedDate: data.lastUpdated // Forward caller's date if provided
          });
          console.log(`🔄 RH Update: synced ${result.inheritedUpdated} inherited components`);
          
          // Remove RH fields from data to avoid double-update, then update other fields
          // Also remove lastUpdated since we already handled it in setComponentRunningHours
          const { currentCumulativeRH, runningHours, lastUpdated, ...otherData } = data;
          if (Object.keys(otherData).length > 0) {
            component = await storage.updateComponent(req.params.id, otherData);
          } else {
            component = result.component;
          }
        } else {
          component = await storage.updateComponent(req.params.id, data);
        }
      } else {
        component = await storage.updateComponent(req.params.id, data);
      }
      
      console.log(`✅ Updated component:`, component.componentCode, '| vesselId:', component.vesselId, '| parentId:', component.parentId);
      res.json(component);
    } catch (error: any) {
      console.error(`❌ Error updating component ${req.params.id}:`, error.message);
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update component" });
    }
  });
  
  app.delete("/technical/api/components/:id", async (req, res) => {
    try {
      await storage.deleteComponent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete component" });
    }
  });
  
  // Rule #14: Component Inactivation (preferred over delete)
  // Option A (default): Block if any child is ACTIVE
  // Option B: Cascade inactivate with cascadeInactivate=true
  app.post("/technical/api/components/:id/inactivate", async (req, res) => {
    try {
      const { cascadeInactivate, userId } = req.body;
      const result = await storage.inactivateComponent(
        req.params.id,
        userId || 'system',
        { cascadeInactivate: cascadeInactivate === true }
      );
      
      if (!result.success) {
        // If blocking due to active children, return 400 with details
        if (result.activeChildrenCount && result.activeChildrenCount > 0) {
          return res.status(400).json({
            success: false,
            error: result.message,
            code: 'ACTIVE_CHILDREN',
            activeChildrenCount: result.activeChildrenCount
          });
        }
        return res.status(400).json({ success: false, error: result.message });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error inactivating component:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to inactivate component" 
      });
    }
  });
  
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
      const spares = await storage.getSpares(req.params.vesselId);
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
      const { locationName, createdBy } = req.body;
      if (!locationName) {
        return res.status(400).json({ success: false, error: "locationName is required" });
      }
      
      const location = await storage.findOrCreateLocation(
        req.params.vesselId,
        locationName,
        createdBy || 'system'
      );
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
  
  // Stores endpoints - ZERO PMS linkages (isolated from Components/Jobs/Work Orders per Global Business Rule Section 7.2)
  // Note: Auth removed to match spares endpoint pattern for development
  app.get("/technical/api/stores/:vesselId", async (req, res) => {
    try {
      const { itemType } = req.query;
      const stores = await storage.getStoresItems(
        req.params.vesselId,
        itemType as string | undefined
      );
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });
  
  app.get("/technical/api/stores/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { itemType } = req.query;
      const history = await storage.getStoresTransactionHistory(
        vesselId,
        itemType as string | undefined
      );
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
  app.get("/technical/api/reports/:reportType", async (req, res) => {
    try {
      const { reportType } = req.params;
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
      const components = await storage.getFleetComponents();
      res.json(components);
    } catch (error) {
      console.error("Error fetching fleet components:", error);
      res.status(500).json({ error: "Failed to fetch fleet components" });
    }
  });
  
  // Get fleet component by ID
  app.get("/technical/api/fleet/components/:id", async (req, res) => {
    try {
      const component = await storage.getFleetComponent(req.params.id);
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
      const component = await storage.createFleetComponent(validatedData);
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
      const component = await storage.updateFleetComponent(req.params.id, validatedData);
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
      await storage.deleteFleetComponent(req.params.id);
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
  
  // Fleet Admin - Jobs Routes
  
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
      const validatedData = insertJobSchema.parse(req.body);
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
      const partialJobSchema = insertJobSchema.partial();
      const validatedData = partialJobSchema.parse(req.body);
      const job = await storage.updateFleetJob(req.params.id, validatedData);
      res.json(job);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
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
  
  // Fleet Admin - Spares Routes
  
  // Get all fleet spares
  app.get("/technical/api/fleet/spares", async (req, res) => {
    try {
      const spares = await storage.getFleetSpares();
      res.json(spares);
    } catch (error) {
      console.error("Error fetching fleet spares:", error);
      res.status(500).json({ error: "Failed to fetch fleet spares" });
    }
  });
  
  // Get fleet spare by ID
  app.get("/technical/api/fleet/spares/:id", async (req, res) => {
    try {
      const spare = await storage.getFleetSpare(parseInt(req.params.id));
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
      const validatedData = insertSpareSchema.parse(req.body);
      const spare = await storage.createFleetSpare(validatedData);
      res.status(201).json(spare);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid spare data", details: error.errors });
      }
      if (error.message?.includes('must have dataScope') || error.message?.includes('cannot have vesselId') || error.message?.includes('not found')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating fleet spare:", error);
      res.status(500).json({ error: error.message || "Failed to create fleet spare" });
    }
  });
  
  // Update fleet spare
  app.patch("/technical/api/fleet/spares/:id", async (req, res) => {
    try {
      const partialSpareSchema = insertSpareSchema.partial();
      const validatedData = partialSpareSchema.parse(req.body);
      const spare = await storage.updateFleetSpare(parseInt(req.params.id), validatedData);
      res.json(spare);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid spare data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('not a fleet') || error.message?.includes('Cannot change dataScope') || error.message?.includes('Cannot assign vesselId')) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating fleet spare:", error);
      res.status(500).json({ error: "Failed to update fleet spare" });
    }
  });
  
  // Delete fleet spare
  app.delete("/technical/api/fleet/spares/:id", async (req, res) => {
    try {
      await storage.deleteFleetSpare(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('not a fleet')) {
        return res.status(400).json({ error: error.message });
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
      const validatedData = insertMakerSchema.parse(req.body);
      
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
      const partialMakerSchema = insertMakerSchema.partial();
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

  // =====================================================
  // Fleet Registry CRUD
  // =====================================================

  // Get all active fleets
  app.get("/technical/api/fleets", async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const fleets = includeInactive 
        ? await storage.getAllFleets()
        : await storage.getFleets();
      res.json(fleets);
    } catch (error: any) {
      console.error("Error fetching fleets:", error);
      res.status(500).json({ error: error.message || "Failed to fetch fleets" });
    }
  });

  // Get fleet by ID
  app.get("/technical/api/fleets/:id", async (req, res) => {
    try {
      const fleet = await storage.getFleetById(req.params.id);
      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }
      res.json(fleet);
    } catch (error: any) {
      console.error("Error fetching fleet:", error);
      res.status(500).json({ error: error.message || "Failed to fetch fleet" });
    }
  });

  // Create a new fleet
  app.post("/technical/api/fleets", async (req, res) => {
    try {
      const { id, code, name, description, isActive } = req.body;
      
      if (!code || !name) {
        return res.status(400).json({ error: "Fleet code and name are required" });
      }
      
      const fleet = await storage.createFleet({
        id: id || code, // Use code as id if not provided
        code,
        name,
        description: description || null,
        isActive: isActive ?? true,
      });
      
      res.status(201).json(fleet);
    } catch (error: any) {
      console.error("Error creating fleet:", error);
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to create fleet" });
    }
  });

  // Update a fleet
  app.put("/technical/api/fleets/:id", async (req, res) => {
    try {
      const { code, name, description, isActive } = req.body;
      
      const fleet = await storage.updateFleet(req.params.id, {
        code,
        name,
        description,
        isActive,
      });
      
      res.json(fleet);
    } catch (error: any) {
      console.error("Error updating fleet:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to update fleet" });
    }
  });

  // Delete a fleet
  app.delete("/technical/api/fleets/:id", async (req, res) => {
    try {
      await storage.deleteFleet(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting fleet:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Cannot delete")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to delete fleet" });
    }
  });

  // Get vessels by fleet
  app.get("/technical/api/fleets/:id/vessels", async (req, res) => {
    try {
      const vessels = await storage.getVesselsByFleet(req.params.id);
      res.json(vessels);
    } catch (error: any) {
      console.error("Error fetching fleet vessels:", error);
      res.status(500).json({ error: error.message || "Failed to fetch fleet vessels" });
    }
  });

  // Assign vessel to fleet
  app.put("/technical/api/vessels/:id/fleet", async (req, res) => {
    try {
      const { fleetId } = req.body;
      const vessel = await storage.assignVesselToFleet(req.params.id, fleetId);
      res.json(vessel);
    } catch (error: any) {
      console.error("Error assigning vessel to fleet:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to assign vessel to fleet" });
    }
  });

  // Get vessels with fleet info
  app.get("/technical/api/vessels-with-fleets", async (req, res) => {
    try {
      const vessels = await storage.getVesselsWithFleets();
      res.json(vessels);
    } catch (error: any) {
      console.error("Error fetching vessels with fleets:", error);
      res.status(500).json({ error: error.message || "Failed to fetch vessels with fleets" });
    }
  });

  // Get vessels list (for dropdown)
  app.get("/technical/api/vessels", async (req, res) => {
    try {
      const vessels = await storage.getVessels();
      res.json(vessels);
    } catch (error) {
      console.error("Error fetching vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  });

  // Create a new vessel
  app.post("/technical/api/vessels", async (req, res) => {
    try {
      const { id, name, code, fleetId, imoNumber, vesselType, flag, isActive } = req.body;
      
      if (!id || !name) {
        return res.status(400).json({ error: "Vessel ID and name are required" });
      }
      
      const vessel = await storage.createVessel({
        id,
        name,
        code: code || id,
        fleetId: fleetId || null,
        imoNumber: imoNumber || null,
        vesselType: vesselType || null,
        flag: flag || null,
        isActive: isActive ?? true,
      });
      
      res.status(201).json(vessel);
    } catch (error: any) {
      console.error("Error creating vessel:", error);
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to create vessel" });
    }
  });

  // =====================================================
  // PMS Vessel Settings - Lead Time & Grace Period (Task 9)
  // =====================================================

  // Get all PMS vessel settings 
  app.get("/technical/api/pms-vessel-settings", async (req, res) => {
    try {
      const settings = await storage.getAllPmsVesselSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching all PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to fetch PMS vessel settings" });
    }
  });

  // Create new PMS vessel settings
  app.post("/technical/api/pms-vessel-settings", async (req, res) => {
    try {
      const { vesselId, ...settingsData } = req.body;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      
      // Check if settings already exist
      const existing = await storage.getPmsVesselSettings(vesselId);
      if (existing) {
        return res.status(409).json({ error: "PMS vessel settings already exist for this vessel. Use PUT to update." });
      }
      
      const updatedBy = settingsData.updatedBy || (req as any).user?.username || 'test';
      const settings = await storage.createOrUpdatePmsVesselSettings({
        vesselId,
        ...settingsData,
        updatedBy
      });
      res.status(201).json(settings);
    } catch (error) {
      console.error("Error creating PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to create PMS vessel settings" });
    }
  });

  // Get PMS vessel settings by vessel ID
  app.get("/technical/api/pms-vessel-settings/:vesselId", async (req, res) => {
    try {
      const settings = await storage.getPmsVesselSettings(req.params.vesselId);
      if (!settings) {
        return res.status(404).json({ error: "PMS vessel settings not found" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to fetch PMS vessel settings" });
    }
  });

  // Create or update PMS vessel settings
  app.put("/technical/api/pms-vessel-settings/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const updatedBy = req.body.updatedBy || (req as any).user?.username || 'test';
      const settings = await storage.createOrUpdatePmsVesselSettings({
        vesselId,
        ...req.body,
        updatedBy
      });
      
      // Trigger immediate status recalculation when grace period settings change
      // This ensures work order statuses reflect the new settings right away
      try {
        const { workOrderStatusRecalculator } = await import("./services/workOrderStatusRecalculator");
        const recalcResult = await workOrderStatusRecalculator.forceRecalculation();
        console.log(`[PMS Settings] Grace period settings updated for ${vesselId}, recalculated ${recalcResult.statusesUpdated} work order statuses`);
      } catch (recalcError) {
        console.error("[PMS Settings] Failed to trigger status recalculation:", recalcError);
        // Don't fail the request if recalculation fails - settings were saved successfully
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error saving PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to save PMS vessel settings" });
    }
  });

  // Delete PMS vessel settings
  app.delete("/technical/api/pms-vessel-settings/:vesselId", async (req, res) => {
    try {
      await storage.deletePmsVesselSettings(req.params.vesselId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting PMS vessel settings:", error);
      res.status(500).json({ error: "Failed to delete PMS vessel settings" });
    }
  });

  // Manually trigger work order status recalculation
  // Useful for immediate updates after settings changes or for admin operations
  app.post("/technical/api/work-orders/recalculate-statuses", async (req, res) => {
    try {
      const { workOrderStatusRecalculator } = await import("./services/workOrderStatusRecalculator");
      const result = await workOrderStatusRecalculator.forceRecalculation();
      res.json({
        success: true,
        workOrdersChecked: result.workOrdersChecked,
        statusesUpdated: result.statusesUpdated,
        message: `Recalculated ${result.statusesUpdated} out of ${result.workOrdersChecked} work orders`
      });
    } catch (error) {
      console.error("Error recalculating work order statuses:", error);
      res.status(500).json({ error: "Failed to recalculate work order statuses" });
    }
  });
  
  // Get vessel location names (with defaults if settings don't exist)
  app.get("/technical/api/vessel-location-names/:vesselId", async (req, res) => {
    try {
      const settings = await storage.getPmsVesselSettings(req.params.vesselId);
      res.json({
        vesselId: req.params.vesselId,
        locationAName: settings?.locationAName ?? 'Location A',
        locationBName: settings?.locationBName ?? 'Location B'
      });
    } catch (error) {
      console.error("Error fetching vessel location names:", error);
      res.status(500).json({ error: "Failed to fetch vessel location names" });
    }
  });
  
  // Update vessel location names (PATCH semantics - only updates location fields)
  app.put("/technical/api/vessel-location-names/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { locationAName, locationBName } = req.body;
      
      // Validate input
      if (locationAName !== undefined && typeof locationAName !== 'string') {
        return res.status(400).json({ error: "locationAName must be a string" });
      }
      if (locationBName !== undefined && typeof locationBName !== 'string') {
        return res.status(400).json({ error: "locationBName must be a string" });
      }
      
      // Get existing settings - preserve ALL existing values
      const existingSettings = await storage.getPmsVesselSettings(vesselId);
      
      // Create update object with ONLY location fields changed, preserving all other settings
      const updatedBy = req.body.updatedBy || (req as any).user?.username || 'test';
      const settingsToSave = existingSettings 
        ? {
            ...existingSettings,
            vesselId,
            locationAName: locationAName ?? existingSettings.locationAName ?? 'Location A',
            locationBName: locationBName ?? existingSettings.locationBName ?? 'Location B',
            updatedBy
          }
        : {
            // New settings - use defaults for non-location fields
            vesselId,
            locationAName: locationAName ?? 'Location A',
            locationBName: locationBName ?? 'Location B',
            calendarLeadDaysCritical: 7,
            calendarLeadDaysNonCritical: 14,
            calendarGraceMode: 'COMPANY_STANDARD',
            calendarGraceDays: 7,
            rhLeadHoursCritical: 50,
            rhLeadHoursNonCritical: 100,
            rhGraceHours: 168,
            updatedBy
          };
      
      const updatedSettings = await storage.createOrUpdatePmsVesselSettings(settingsToSave);
      
      res.json({
        vesselId,
        locationAName: updatedSettings.locationAName,
        locationBName: updatedSettings.locationBName
      });
    } catch (error) {
      console.error("Error updating vessel location names:", error);
      res.status(500).json({ error: "Failed to update vessel location names" });
    }
  });

  // =====================================================
  // On-Demand Work Order Generation (Rule #4)
  // =====================================================

  // Generate work order on demand from job
  // Uses jobDueScanner.generateWorkOrderForJob for spec-compliant behavior:
  // - Proper duplicate protection (job + component + cycle)
  // - Correct status calculation using shared computeWorkOrderStatus
  // - Cycle snapshot alignment with auto-generation
  app.post("/technical/api/jobs/:id/generate-wo", async (req, res) => {
    try {
      const jobId = req.params.id;
      const { reason, activeComponentCode } = req.body; // 'Planning' | 'Breakdown' | 'Other', optional component override
      
      if (!reason || !['Planning', 'Breakdown', 'Other'].includes(reason)) {
        return res.status(400).json({ error: "Invalid reason. Must be 'Planning', 'Breakdown', or 'Other'" });
      }

      // Use jobDueScanner for spec-compliant manual WO generation (TRIGGER 3)
      const { jobDueScanner } = await import("./services/jobDueScanner");
      const result = await jobDueScanner.generateWorkOrderForJob(jobId, reason, activeComponentCode);
      
      if (!result.success) {
        // Return HTTP 400 with blocking WO details for duplicate detection
        // Response includes { success:false, message, blockingWorkOrder }
        return res.status(400).json(result);
      }
      
      res.status(201).json(result.workOrder);
    } catch (error: any) {
      console.error("Error generating on-demand work order:", error);
      res.status(500).json({ error: error.message || "Failed to generate work order" });
    }
  });

  // =====================================================
  // Postponed WO Reappearance Check (Rule #5)
  // =====================================================

  // Check and revert expired postponements
  app.post("/technical/api/work-orders/check-postponements", async (req, res) => {
    try {
      const { vesselId } = req.body;
      const result = await storage.checkAndRevertPostponedWorkOrders(vesselId);
      
      res.json({
        success: true,
        revertedCount: result.revertedCount,
        revertedWorkOrders: result.revertedWorkOrders
      });
    } catch (error: any) {
      console.error("Error checking postponements:", error);
      res.status(500).json({ error: error.message || "Failed to check postponements" });
    }
  });

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
          
          await pool.query(`
            INSERT INTO vessels (id, vuuid, name, code, imo_number, vessel_type, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              vuuid = EXCLUDED.vuuid,
              name = EXCLUDED.name,
              code = EXCLUDED.code,
              imo_number = EXCLUDED.imo_number,
              vessel_type = EXCLUDED.vessel_type,
              is_active = true,
              updated_at = NOW()
          `, [entryId, entryId, name, entryId, imoNumber, vesselType]);
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
      // Optional: vessel-specific certificate master IDs and their target vessels
      const vesselSpecificCerts: string[] = req.body.vesselSpecificCerts || [];
      const targetVessels: Array<{ id: string; name: string }> = req.body.targetVessels || [];
      
      if (!Array.isArray(certificates)) {
        return res.status(400).json({ error: "certificates must be an array" });
      }
      
      console.log(`💾 Saving ${certificates.length} ship certificates master entries...`);
      
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
      
      console.log(`✅ Ship certificates master saved: ${insertedCount} inserted, ${updatedCount} updated`);
      
      res.json({ 
        success: true, 
        message: `Saved ${certificates.length} certificates`,
        inserted: insertedCount,
        updated: updatedCount
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