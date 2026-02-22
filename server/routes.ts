import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getPool } from "./db";
import * as fs from "fs";
import * as path from "path";
// Schema imports: most moved to modules (jobs, work-orders, spares, fleet, defects, cert-surveys, reports)
// insertWorkOrderSchema, insertWorkOrderExecutionSchema, vessels, componentRunningHoursLog, runningHoursAudit, storesLedger, reportSnapshots → Moved to modules/reports
// lowStockReportService, ExcelJS, excelReportStyles → Moved to modules/reports
// sql, shouldGenerateWorkOrder → No longer needed after reports extraction

import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import multer from "multer";
import bulkRouter from "./routes/bulk";
import alertRouter from "./routes/alerts";
import formRouter from "./routes/forms";
// fleetAdminRouter → Moved to modules/fleet
// createChangeRequestsRouter → Moved to modules/change-requests
import { ObjectStorageService, objectStorageClient, parseObjectPath, ObjectNotFoundError } from "./objectStorage";
// Running Hours routes → Extracted to modules/running-hours
import moduleRouter from "./modules";
import chatbotRouter from "./routes/chatbot";
import { requirePMSAdmin, mockAuthMiddleware } from "./middleware/auth";
import { ensureMaintenanceHistoryImmutability } from "./initDb";
// validateRunningHoursIncrease, canAdminOverride → Moved to modules/running-hours/utils/rhValidation

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
  
  // Running Hours routes → Extracted to modules/running-hours
  // Set up multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Jobs API routes → Extracted to modules/jobs
  // Work Orders API routes → Extracted to modules/work-orders

  // Reports (critical-spares, equipment-status, breakdown, low-stock, stores, consumption, chemicals, snapshots, change-requests, template-builder, LSA/FFA, critical-components, critical-equipment-schedule) → Extracted to modules/reports

  // Sub-routers (originally interspersed with report blocks)
  app.use(chatbotRouter);
  app.use("/technical/api/bulk", bulkRouter);
  app.use("/technical/api/alerts", alertRouter);
  app.use("/technical/api/forms", formRouter);
  // changeRequestsRouter → Moved to modules/change-requests

  // Recurring defects endpoints: extracted to server/modules/defects


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
  

  // ═══════════════════════════════════════════════════════════
  // FLEET OPERATIONS — Extracted to modules/fleet
  // (fleet/components, fleet/jobs, fleet/spares, fleet/makers,
  //  fleet/master-lists, fleet/vessel-mappings)
  // ═══════════════════════════════════════════════════════════

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


  // Reports (due-jobs, overdue, completed, unplanned, postponement-log) → Extracted to modules/reports

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

  // Reports (monthly maintenance summary) → Extracted to modules/reports

  // Reports (crew workload, equipment utilization, compliance, IHM) → Extracted to modules/reports

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