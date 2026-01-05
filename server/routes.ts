import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import { insertRunningHoursAuditSchema, cascadeRunningHoursSchema, insertWorkOrderSchema, insertWorkOrderExecutionSchema, insertDefectSchema, insertDefectActionSchema, insertDefectAttachmentSchema, insertComponentSchema, insertSpareSchema, insertMakerSchema, insertMasterListSchema, insertComponentDocumentSchema, insertComponentClassRegulatorySchema, insertComponentRequisitionSchema } from "@shared/schema";
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
      
      // Hydrate Running Hours jobs with component's current RH for remaining RH calculation
      const hydratedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.maintenanceBasis === 'Running Hours' && job.componentId) {
          const component = await storage.getComponent(job.componentId);
          if (component) {
            // Get parent component's running hours if component has a parent
            let currentRH = parseFloat(component.currentCumulativeRH || component.runningHours || '0');
            if (component.parentId) {
              const parentComponent = await storage.getComponentByCode(component.parentId, job.vesselId || '');
              if (parentComponent) {
                currentRH = parseFloat(parentComponent.currentCumulativeRH || parentComponent.runningHours || '0');
              }
            }
            return {
              ...job,
              componentCurrentRH: currentRH.toFixed(2)
            };
          }
        }
        return job;
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
      
      // Add dummy data for demo job MKR-IN-00004 (component 401.005)
      let dummySpareParts = job.requiredSpareParts || [];
      let dummyTools = job.requiredTools || [];
      let dummySafetyReqs = job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] };
      let dummyWorkHistory = workHistory;
      
      if (job.jobNo === 'MKR-IN-00004') {
        // A2: Required Spare Parts (3 rows with codes matching Spares module)
        dummySpareParts = [
          { partNo: 'SP-00001', description: 'Rudder Shaft Bearing', quantityRequired: '2', remarks: 'For hydraulic pump replacement' },
          { partNo: 'SP-00002', description: 'Rudder Pintle Bush', quantityRequired: '1', remarks: 'Spare for inspection' },
          { partNo: 'SP-00003', description: 'Rudder Carrier Bearing', quantityRequired: '1', remarks: 'Preventive replacement' }
        ];
        
        // A3: Required Tools & Equipment (3 rows)
        dummyTools = [
          { toolName: 'Hydraulic Jack 50T', quantity: '1', remarks: 'For lifting rudder assembly' },
          { toolName: 'Torque Wrench 100-500 Nm', quantity: '2', remarks: 'For bolt tightening' },
          { toolName: 'Dial Indicator Set', quantity: '1', remarks: 'For alignment measurement' }
        ];
        
        // A4: Safety Requirements (3 items each)
        dummySafetyReqs = {
          ppeRequirements: ['Safety Helmet', 'Safety Shoes', 'Safety Gloves'],
          permitRequirements: ['Hot Work Permit', 'Confined Space Entry', 'Lock Out Tag Out (LOTO)'],
          otherRequirements: ['Vessel at anchor or alongside', 'Steering gear isolated', 'Bridge informed']
        };
        
        // A5: Work History (3 rows with proper work order numbers and completed status)
        dummyWorkHistory = [
          { woNo: 'MKR-IN-00004.WO-2025-001', assignedTo: '2nd Engineer', performedBy: '2nd Engineer', workDate: '2025-06-15', runDate: '', completionDate: '2025-06-15', status: 'Completed', description: 'Rudder inspection - hydraulic pump check', remarks: 'No wear detected, pump in good condition' },
          { woNo: 'MKR-IN-00004.WO-2024-003', assignedTo: 'Chief Engineer', performedBy: 'Chief Engineer', workDate: '2024-12-20', runDate: '', completionDate: '2024-12-20', status: 'Completed', description: 'Rudder bearing clearance check', remarks: 'Clearance within limits' },
          { woNo: 'MKR-IN-00004.WO-2024-001', assignedTo: '2nd Engineer', performedBy: '3rd Engineer', workDate: '2024-06-10', runDate: '', completionDate: '2024-06-12', status: 'Completed', description: 'Annual rudder system inspection', remarks: 'Bearing replaced, alignment verified' }
        ];
      }
      
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
        requiredSpareParts: dummySpareParts,
        requiredTools: dummyTools,
        safetyRequirements: dummySafetyReqs,
        vesselId: job.vesselId,
        workHistory: dummyWorkHistory
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
        ranks, // comma-separated ranks
        department,
        criticalOnly // boolean string
      } = req.query;

      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }

      // Fetch all active jobs for the vessel
      const allJobs = await storage.getJobs(vesselId as string);
      const activeJobs = allJobs.filter(j => j.isActive !== false && j.dataScope === 'vessel');

      // Fetch all components for RH lookup
      const components = await storage.getComponents(vesselId as string);
      const componentMap = new Map(components.map(c => [c.id, c]));
      const componentCodeMap = new Map(components.map(c => [c.componentCode, c]));

      // Fetch all work orders to check for open WOs
      const allWorkOrders = await storage.getWorkOrders(vesselId as string);
      
      // Fetch spares for spare status calculation
      const allSpares = await storage.getSpares(vesselId as string);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Process each job and compute planning data
      const plannerItems: any[] = [];

      for (const job of activeJobs) {
        // Get component data
        const component = componentMap.get(job.componentId) || componentCodeMap.get(job.componentCode);
        
        // Determine job type (Calendar vs Running Hours)
        const isCalendarJob = job.maintenanceBasis === 'Calendar' || job.frequencyType === 'Calendar';
        const isRHJob = job.maintenanceBasis === 'Running Hours' || job.frequencyType === 'Running Hours';
        
        // Apply job type filter
        const jobTypeFilter = (jobType as string)?.toUpperCase();
        if (jobTypeFilter === 'CALENDAR' && !isCalendarJob) continue;
        if (jobTypeFilter === 'RH' && !isRHJob) continue;

        // Apply department filter
        if (department && department !== 'all' && job.department !== department) continue;

        // Apply rank filter
        if (ranks) {
          const rankList = (ranks as string).split(',').map(r => r.trim().toLowerCase());
          const assignedRank = (job.assignedTo || '').toLowerCase();
          if (rankList.length > 0 && !rankList.some(r => assignedRank.includes(r))) continue;
        }

        // Apply criticality filter
        if (criticalOnly === 'true') {
          const isCritical = job.criticality === 'Yes' || job.jobPriority === 'Critical' || component?.critical;
          if (!isCritical) continue;
        }

        // Calculate status and dates
        let nextDueDate: Date | null = null;
        let remainingHours: number | null = null;
        let status: 'OVERDUE' | 'DUE_SOON' | 'FUTURE' = 'FUTURE';
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
            const daysUntilDue = Math.floor((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilDue < 0) {
              status = 'OVERDUE';
            } else if (daysUntilDue <= 30) {
              status = 'DUE_SOON';
            } else {
              status = 'FUTURE';
            }

            // Apply date range filter
            if (fromDate || toDate) {
              const from = fromDate ? new Date(fromDate as string) : new Date(0);
              const to = toDate ? new Date(toDate as string) : new Date('2099-12-31');
              
              // Skip overdue items only if includeOverdue is false
              if (status === 'OVERDUE' && includeOverdue !== 'true') continue;
              if (status !== 'OVERDUE' && (nextDueDate < from || nextDueDate > to)) continue;
            }
          }
        } else if (isRHJob) {
          // Find parent component for RH
          let parentComponent = component;
          if (component?.parentId) {
            parentComponent = componentCodeMap.get(component.parentId) || component;
          }
          
          parentRH = parseFloat(parentComponent?.currentCumulativeRH || '0') || 0;
          const lastDoneRH = parseFloat(job.lastDoneRH || '0') || 0;
          const frequencyRH = parseInt(job.frequencyValue || '0') || job.intervalRunningHour || 0;
          
          // Calculate remaining hours
          const usedSinceLastDone = parentRH - lastDoneRH;
          remainingHours = Math.max(0, frequencyRH - usedSinceLastDone);

          // Determine status
          if (remainingHours <= 0) {
            status = 'OVERDUE';
          } else if (remainingHours <= (job.leadTimeValue || 168)) {
            status = 'DUE_SOON';
          } else {
            status = 'FUTURE';
          }

          // Apply RH range filter
          if (remainingHoursMin || remainingHoursMax) {
            const minRH = parseFloat(remainingHoursMin as string) || 0;
            const maxRH = parseFloat(remainingHoursMax as string) || Infinity;
            
            // Skip overdue items only if includeOverdue is false
            if (status === 'OVERDUE' && includeOverdue !== 'true') continue;
            if (status !== 'OVERDUE' && (remainingHours < minRH || remainingHours > maxRH)) continue;
          }
        }

        // Skip if not overdue and includeOverdue is true but no date/RH filter applied
        if (includeOverdue !== 'true' && status === 'OVERDUE') {
          // Include overdue by default unless explicitly filtered out
        }

        // Find open work order for this job
        const openWO = allWorkOrders.find(wo => 
          wo.jobId === job.id && 
          wo.status !== 'Completed' && 
          wo.status !== 'Rejected'
        );

        // Calculate spare status
        let spareStatus: 'OK' | 'LOW' | 'ZERO' | 'NOT_SET' = 'NOT_SET';
        const requiredSpares = job.requiredSpareParts as any[] || [];
        
        if (requiredSpares.length > 0) {
          let hasZero = false;
          let hasLow = false;
          
          for (const reqSpare of requiredSpares) {
            const spare = allSpares.find(s => 
              s.partCode === reqSpare.partNo || 
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

        // Build planner item
        plannerItems.push({
          jobId: job.id,
          jobCode: job.jobNo,
          jobTitle: job.jobTitle,
          jobType: isCalendarJob ? 'CALENDAR' : 'RH',
          componentId: job.componentId,
          componentCode: job.componentCode,
          componentName: job.componentName,
          department: job.department || component?.department || 'N/A',
          assignedRank: job.assignedTo || 'Unassigned',
          criticalFlag: job.criticality === 'Yes' || job.jobPriority === 'Critical' || component?.critical || false,
          classRelatedFlag: job.classRelated === 'Yes',
          estimatedManHours: parseFloat(job.estimatedManHours || '0') || 0,
          nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
          remainingHours: remainingHours,
          parentRH: parentRH,
          status: status,
          woId: openWO?.id || null,
          woNo: openWO?.workOrderNo || null,
          woStatus: openWO?.status || null,
          spareStatus: spareStatus,
          frequencyValue: job.frequencyValue,
          frequencyUnit: job.frequencyUnit,
          lastDoneDate: job.lastDoneDate,
          lastDoneRH: job.lastDoneRH
        });
      }

      // Sort by status priority and due date/remaining hours
      const statusPriority: Record<string, number> = {
        'OVERDUE': 0,
        'DUE_SOON': 1,
        'FUTURE': 2
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
      const totalManHours = plannerItems.reduce((sum, item) => sum + item.estimatedManHours, 0);
      
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

      const byStatus: Record<string, number> = { OVERDUE: 0, DUE_SOON: 0, FUTURE: 0 };
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
      
      const history = await storage.getComponentMaintenanceHistory(req.params.componentId);
      res.json(history);
    } catch (error) {
      console.error("Failed to get component maintenance history:", error);
      res.status(500).json({ error: "Failed to get component maintenance history" });
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
        
        // Get component to fetch currentCumulativeRH
        const component = wo.component ? componentsMap.get(wo.component) : null;
        
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
      const component = workOrder.component ? await storage.getComponent(workOrder.component) : null;
      
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
      
      // Build templateData from job data (Part A - immutable from job definition)
      // This ensures Section A is populated from the job template
      const templateData = job ? {
        woTitle: job.jobTitle,
        jobTitle: job.jobTitle,
        jobNo: job.jobNo,
        component: workOrder.component,
        componentCode: job.componentCode || component.componentCode,
        componentName: job.componentName || component.name,
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
        requiredSpareParts: job.requiredSpareParts || [],
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
      
      // Add dummy data for demo work orders MKR-IN-00001.WO-2025-003 and MKR-SE-00001.WO-2025-001
      let finalTemplateData: any = { ...templateData };
      if (workOrder.workOrderNo === 'MKR-IN-00001.WO-2025-003' || workOrder.workOrderNo === 'MKR-SE-00001.WO-2025-001') {
        // A2: Required Spare Parts (2 rows)
        finalTemplateData.requiredSpareParts = [
          { partNo: 'SP-00004', description: 'Impressed Current Anode', quantityRequired: '2', remarks: 'Annual replacement' },
          { partNo: 'SP-00005', description: 'Reference Cell Electrode', quantityRequired: '1', remarks: 'Check and replace if corroded' }
        ];
        
        // A3: Required Tools & Equipment (2 rows)
        finalTemplateData.requiredTools = [
          { toolName: 'Digital Multimeter', quantity: '1', remarks: 'For voltage measurement' },
          { toolName: 'Insulation Tester (Megger)', quantity: '1', remarks: 'For insulation resistance check' }
        ];
        
        // A4: Safety Requirements (2 items each)
        finalTemplateData.safetyRequirements = {
          ppeRequirements: ['Safety Gloves (Electrical)', 'Safety Goggles'],
          permitRequirements: ['Electrical Work Permit', 'Diving Operations Permit'],
          otherRequirements: ['System isolated before work', 'Vessel grounded properly']
        };
        
        // A5: Work History (2 rows with completed status)
        finalTemplateData.workHistory = [
          { woNo: 'MKR-IN-00001.WO-2024-002', assignedTo: '2nd Engineer', performedBy: '2nd Engineer', workDate: '2024-11-15', runDate: '', completionDate: '2024-11-15', status: 'Completed', description: 'Impressed current system inspection', remarks: 'All anodes functional' },
          { woNo: 'MKR-IN-00001.WO-2024-001', assignedTo: '3rd Engineer', performedBy: '3rd Engineer', workDate: '2024-05-20', runDate: '', completionDate: '2024-05-22', status: 'Completed', description: 'Annual anode replacement', remarks: '2 anodes replaced' }
        ];
        
        // B3: Running Hours (dummy values)
        executionData.previousReading = '8500';
        executionData.currentReading = '8750';
        
        // B4: Spare Parts Consumed (2 rows - same as A2 but editable)
        executionData.consumedSpareParts = [
          { partNo: 'SP-00004', description: 'Impressed Current Anode', quantityConsumed: '2', comments: 'Replaced worn anodes' },
          { partNo: 'SP-00005', description: 'Reference Cell Electrode', quantityConsumed: '1', comments: 'Corroded electrode replaced' }
        ];
      }
      
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
          lastUpdated: latestAudit?.dateUpdatedLocal || component.lastUpdated
        },
        parentComponent: parentComponent ? {
          id: parentComponent.id,
          componentCode: parentComponent.componentCode,
          name: parentComponent.name,
          currentCumulativeRH: parentComponent.currentCumulativeRH
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
          // Unplanned WO requires vesselId
          const vesselId = workOrderData.vesselId || 'V001';
          workOrderData.workOrderNo = await generateUnplannedWorkOrderNumber(
            storage, 
            vesselId
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
      const updateData = { ...req.body };
      
      // Remove any undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      // SAFEGUARD: If completion data is provided without explicit status,
      // automatically set status to 'Pending Approval' to enforce approval workflow
      const hasCompletionData = !!(updateData.completionDateTime || updateData.dateOfCompletion);
      const hasExplicitStatus = updateData.status !== undefined;
      
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
      
      const workOrder = await storage.updateWorkOrder(req.params.id, updateData);
      
      // When work order is being approved/completed, create maintenance history and update job
      if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
        console.log('📋 Work order approved - creating maintenance history and updating job cycle dates');
        
        // Fetch fresh work order data to get all execution fields
        const freshWorkOrder = await storage.getWorkOrder(req.params.id);
        if (!freshWorkOrder) {
          console.error('Failed to refetch work order for completion processing');
        } else {
          // Find the component for maintenance history
          let component = await storage.getComponent(freshWorkOrder.component);
          
          if (!component && freshWorkOrder.componentCode && freshWorkOrder.vesselId) {
            component = await storage.getComponentByCode(freshWorkOrder.componentCode, freshWorkOrder.vesselId);
          }
          
          if (!component && freshWorkOrder.vesselId) {
            const vesselComponents = await storage.getComponents(freshWorkOrder.vesselId);
            component = vesselComponents.find(c => 
              c.name === freshWorkOrder.component || 
              c.componentCode === freshWorkOrder.componentCode
            );
          }
          
          if (component) {
            // Create maintenance history record using stored execution data
            try {
              // DUPLICATE CHECK: Only create if no record exists for this work order
              const existingHistory = await storage.getMaintenanceHistoryByWorkOrderId(freshWorkOrder.id);
              if (existingHistory) {
                console.log(`⚠️ Maintenance history already exists for work order ${freshWorkOrder.id}, skipping duplicate creation`);
              } else {
                const dateOfCompletion = freshWorkOrder.dateCompleted || freshWorkOrder.completionDateTime || updateData.dateCompleted || new Date().toISOString();
                const normalizeToISO = (isoDate: string | undefined): string => {
                  if (!isoDate) return new Date().toISOString().split('T')[0];
                  const date = new Date(isoDate);
                  return date.toISOString().split('T')[0];
                };
                
                // Use stored execution data from work order (populated during Part B save)
                const historyPayload = {
                  componentId: component.id,
                  componentCode: freshWorkOrder.componentCode || component.componentCode,
                  vesselCode: freshWorkOrder.vesselId,
                  workOrderId: freshWorkOrder.id,
                  workOrderNo: freshWorkOrder.workOrderNo || `WO-${freshWorkOrder.id}`,
                  jobTitle: freshWorkOrder.jobTitle,
                  maintenanceType: freshWorkOrder.maintenanceType || freshWorkOrder.taskType || 'Servicing',
                  dateCompleted: normalizeToISO(dateOfCompletion),
                  runningHoursAtCompletion: freshWorkOrder.runningHours || null,
                  performedBy: freshWorkOrder.performedBy || freshWorkOrder.executionAssignedTo || 'Unknown',
                  approvedBy: freshWorkOrder.approver || null,
                  approvalDate: normalizeToISO(dateOfCompletion),
                  status: 'Approved' as const,
                  workDescription: freshWorkOrder.workCarriedOut || freshWorkOrder.briefWorkDescription || null,
                  sparesUsed: freshWorkOrder.consumedSpareParts ? JSON.stringify(freshWorkOrder.consumedSpareParts) : null,
                  remarks: freshWorkOrder.remarks || freshWorkOrder.jobExperienceNotes || null,
                  isComponentReplaced: false
                };
                
                await storage.createComponentMaintenanceHistory(historyPayload);
                console.log(`✅ Created maintenance history for work order ${freshWorkOrder.id} (componentId: ${component.id})`);
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
                const dateOfCompletion = freshWorkOrder.dateCompleted || freshWorkOrder.completionDateTime || updateData.dateCompleted;
                const runningHours = freshWorkOrder.runningHours;
                
                // Handle Calendar-based jobs
                if (freshWorkOrder.maintenanceBasis === 'Calendar' && dateOfCompletion) {
                  const { calculateNextDueDate } = await import('@shared/dateUtils');
                  const calendarUpdates: any = { lastDoneDate: dateOfCompletion };
                  
                  if (job.frequencyValue && job.frequencyUnit) {
                    const nextDue = calculateNextDueDate(dateOfCompletion, job.frequencyValue, job.frequencyUnit);
                    if (nextDue) {
                      calendarUpdates.nextDueDate = nextDue;
                      console.log(`✅ Updated job ${job.jobNo} nextDueDate: ${nextDue}`);
                    }
                  }
                  
                  await storage.updateJob(job.id, calendarUpdates);
                }
                
                // Handle Running Hours-based jobs (separate update to avoid key leakage)
                if (freshWorkOrder.maintenanceBasis === 'Running Hours' && runningHours) {
                  const currentRH = parseInt(runningHours);
                  if (!isNaN(currentRH)) {
                    const rhUpdates: any = { lastDoneRH: currentRH };
                    const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
                    if (rhInterval && !isNaN(rhInterval)) {
                      rhUpdates.nextDueRH = currentRH + rhInterval;
                      console.log(`✅ Updated job ${job.jobNo} nextDueRH: ${rhUpdates.nextDueRH}`);
                    }
                    await storage.updateJob(job.id, rhUpdates);
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
      res.status(500).json({ error: "Failed to update work order" });
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
        component = await storage.getComponentByCode(workOrder.componentCode, workOrder.vesselId);
        if (component) {
          console.log(`📋 Found component by code ${workOrder.componentCode} for vessel ${workOrder.vesselId}`);
        }
      }
      
      if (!component && workOrder.vesselId) {
        // Fallback: Search by component name
        const vesselComponents = await storage.getComponents(workOrder.vesselId);
        component = vesselComponents.find(c => 
          c.name === workOrder.component || 
          c.componentCode === workOrder.componentCode
        );
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

          // Use schema validation for type safety and defaults
          // FIX: Use component.id (actual UUID) not workOrder.component (which is the component NAME)
          const historyPayload = {
            componentId: component.id,
            componentCode: workOrder.componentCode || component.componentCode,
            vesselCode: workOrder.vesselId,
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
          console.log(`✅ Auto-populated maintenance history for work order ${workOrder.id} (componentId: ${component.id})`);
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
          const updates: any = {};
          
          // Calendar-based job cycle update
          if (workOrder.maintenanceBasis === 'Calendar' && dateOfCompletion) {
            const { calculateNextDueDate } = await import('@shared/dateUtils');
            updates.lastDoneDate = dateOfCompletion;
            
            // Recalculate nextDueDate based on lastDoneDate + interval
            if (job.frequencyValue && job.frequencyUnit) {
              const nextDue = calculateNextDueDate(
                dateOfCompletion,
                job.frequencyValue,
                job.frequencyUnit
              );
              
              if (nextDue) {
                updates.nextDueDate = nextDue;
                console.log(`✅ Auto-calculated next due date for job ${job.jobNo}: ${nextDue} (last done: ${dateOfCompletion}, interval: ${job.frequencyValue} ${job.frequencyUnit})`);
              }
            }
            
            await storage.updateJob(job.id, updates);
            console.log(`✅ Updated calendar job ${job.jobNo} with lastDoneDate: ${dateOfCompletion}`);
          }
          
          // Running Hours-based job cycle update
          if (workOrder.maintenanceBasis === 'Running Hours' && runningHours) {
            const currentRH = parseInt(runningHours);
            if (!isNaN(currentRH)) {
              updates.lastDoneRH = currentRH;
              
              // Recalculate nextDueRH based on lastDoneRH + interval
              // Use intervalRunningHour first (dedicated RH field), fallback to frequencyValue
              const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
              if (rhInterval && !isNaN(rhInterval)) {
                const nextDueRH = currentRH + rhInterval;
                updates.nextDueRH = nextDueRH;
                console.log(`✅ Auto-calculated next due RH for job ${job.jobNo}: ${nextDueRH} (last done: ${currentRH}, interval: ${rhInterval} hours)`);
              }
              
              await storage.updateJob(job.id, updates);
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
              // Get spare from inventory (match by partNo which corresponds to partCode)
              const spares = await storage.getSpares(workOrder.vesselId || 'V001');
              const spare = spares.find(s => s.partCode === consumedSpare.partNo);
              
              if (spare) {
                // Check if locationId is provided for new location-based tracking
                // Coerce to number in case frontend sends string
                const locationId = consumedSpare.locationId ? parseInt(String(consumedSpare.locationId)) : null;
                if (locationId && !isNaN(locationId)) {
                  // Use new inventory transaction system with location tracking
                  try {
                    await storage.performInventoryTransaction({
                      vesselId: workOrder.vesselId || 'V001',
                      spareId: spare.id,
                      locationId: locationId,
                      eventType: 'CONSUME',
                      qtyChange: -Math.abs(qtyConsumed), // Negative for consumption
                      referenceType: 'WORK_ORDER',
                      referenceId: workOrder.id,
                      referenceNote: `WO: ${workOrder.workOrderNo} - ${consumedSpare.comments || 'Consumed during work completion'}`
                    });
                    console.log(`✅ [Inventory Transaction] Consumed ${qtyConsumed} units of ${consumedSpare.partNo} from location ${locationId} (WO: ${workOrder.workOrderNo})`);
                  } catch (txnError: any) {
                    if (txnError.message?.includes('INSUFFICIENT_STOCK') || txnError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                      console.warn(`⚠️ Insufficient stock for ${consumedSpare.partNo} at location ${locationId}: ${txnError.message}`);
                      // PHASE 3B: Do NOT fall back to legacy ROB - reject the transaction
                      throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${qtyConsumed} units of ${consumedSpare.partNo} from location ${locationId}. Insufficient stock.`);
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
                console.warn(`⚠️ Spare ${consumedSpare.partNo} not found in inventory - skipping deduction`);
              }
            } catch (spareError: any) {
              // PHASE 3B: Propagate LOCATION_REQUIRED and INSUFFICIENT_STOCK errors to fail the request
              if (spareError.message?.includes('LOCATION_REQUIRED') || 
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
        is_coc: req.query.is_coc === 'true' || req.query.isCoC === 'true' ? true : 
                req.query.is_coc === 'false' || req.query.isCoC === 'false' ? false : undefined, // Only apply filter when explicitly set
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        includeClosedDefects: req.query.includeClosedDefects === 'true',
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
      const result = await storage.cascadeRunningHoursUpdate(validatedData);
      res.json(result);
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
      const spare = await storage.updateSpare(parseInt(req.params.id), req.body);
      res.json(spare);
    } catch (error: any) {
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
      const itemData = { ...req.body, vesselId };
      const item = await storage.createStoresItem(itemData);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create stores item" });
    }
  });
  
  app.put("/technical/api/stores/item/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const item = await storage.updateStoresItem(itemId, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update stores item" });
    }
  });
  
  // PATCH endpoint for partial updates (location ROB updates)
  app.patch("/technical/api/stores/:vesselId/:id", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const { robLocationA, robLocationB, rob } = req.body;
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (robLocationA !== undefined) updateData.robLocationA = robLocationA;
      if (robLocationB !== undefined) updateData.robLocationB = robLocationB;
      if (rob !== undefined) updateData.rob = rob;
      
      const item = await storage.updateStoresItem(itemId, updateData);
      res.json(item);
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
        const seedData = getSeedDefectsData();
        let created = 0;
        let updated = 0;
        
        for (const seedDefect of seedData) {
          // Check if vessel exists, create if not
          let vesselId = await storage.getVesselIdByName(seedDefect.vesselName);
          if (!vesselId) {
            // Create vessel with a simple ID
            vesselId = seedDefect.vesselName.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
            await storage.createVessel({
              id: vesselId,
              name: seedDefect.vesselName,
              type: 'Container'
            });
          }
          
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
          // Old IDs for backward compatibility
          'RD-001', 'RD-002', 'RD-003', 'RD-004', 'RD-005',
          'RD-006', 'RD-007', 'RD-008', 'RD-009', 'RD-010',
          // New IDs from updated seed data
          'RD-A-001', 'RD-A-002', 'RD-A-003', 'RD-A-004', 'RD-A-005',
          'RD-B-001', 'RD-C-001', 'RD-D-001', 'RD-E-001', 'RD-F-001'
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
  app.post("/technical/api/jobs/:id/generate-wo", async (req, res) => {
    try {
      const jobId = req.params.id;
      const { reason } = req.body; // 'Planning' | 'Breakdown' | 'Other'
      
      if (!reason || !['Planning', 'Breakdown', 'Other'].includes(reason)) {
        return res.status(400).json({ error: "Invalid reason. Must be 'Planning', 'Breakdown', or 'Other'" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Generate work order from job with on-demand reason
      const workOrder = await storage.generateOnDemandWorkOrder(jobId, reason);
      
      res.status(201).json(workOrder);
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
      const componentMap = new Map(allComponents.map(c => [c.id, c]));
      
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
          const component = wo.componentId ? componentMap.get(wo.componentId) : undefined;
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
  // CERTIFICATES API ROUTES
  // ========================================
  
  // Initialize certificates with sample data if empty (uses storage layer)
  const initializeCertificates = async () => {
    const existingCerts = await storage.getCertificates();
    if (existingCerts.length === 0) {
      const sampleCertificates = [
        {
          id: 'C1',
          certificateName: 'International Ballast Water Management Certificate',
          type: 'Flag',
          vessel: 'MV Test',
          issueDate: '01 Sep 2019',
          expiryDate: '01 Sep 2024',
          lastAnnual: '01 Sep 2024',
          lastInterm: '01 Sep 2024',
          endorsementDate: '01 Sep 2024',
          lastEditUpload: '01 Sep 2024',
          applicable: true,
          attachments: [],
        },
        {
          id: 'C2',
          certificateName: 'International Ballast Water Management Certificate',
          type: 'Flag',
          vessel: 'MV Test',
          issueDate: '01 Sep 2019',
          expiryDate: '',
          lastAnnual: '',
          lastInterm: '',
          endorsementDate: '',
          lastEditUpload: '',
          applicable: true,
          attachments: [],
        },
        {
          id: 'C3',
          certificateName: 'Safety Management Certificate',
          type: 'Class',
          vessel: 'MV TEST 2',
          issueDate: '15 Mar 2020',
          expiryDate: '15 Mar 2025',
          lastAnnual: '15 Mar 2024',
          lastInterm: '15 Sep 2023',
          endorsementDate: '15 Mar 2024',
          lastEditUpload: '20 Oct 2024',
          applicable: true,
          attachments: [],
        },
        {
          id: 'C4',
          certificateName: 'International Oil Pollution Prevention Certificate',
          type: 'Flag',
          vessel: 'MT Nordic Star',
          issueDate: '01 Jan 2021',
          expiryDate: '01 Jan 2026',
          lastAnnual: '01 Jan 2024',
          lastInterm: '01 Jul 2023',
          endorsementDate: '01 Jan 2024',
          lastEditUpload: '15 Nov 2024',
          applicable: false,
          attachments: [],
        },
        {
          id: 'C5',
          certificateName: 'Cargo Ship Safety Equipment Certificate',
          type: 'Class',
          vessel: 'MT Pacific Voyager',
          issueDate: '10 Jun 2022',
          expiryDate: '10 Jun 2027',
          lastAnnual: '10 Jun 2024',
          lastInterm: '',
          endorsementDate: '10 Jun 2024',
          lastEditUpload: '25 Sep 2024',
          applicable: true,
          attachments: [],
        },
      ];
      for (const cert of sampleCertificates) {
        await storage.createCertificate(cert);
      }
      console.log('📋 Initialized certificates data with sample data via storage layer');
    }
  };
  
  // Initialize on startup (async)
  initializeCertificates();
  
  // GET all certificates
  app.get("/technical/api/certificates", async (req, res) => {
    try {
      const certificates = await storage.getCertificates();
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });
  
  // GET single certificate
  app.get("/technical/api/certificates/:id", async (req, res) => {
    try {
      const certificate = await storage.getCertificate(req.params.id);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ error: "Failed to fetch certificate" });
    }
  });
  
  // PATCH update certificate (for toggling applicable status)
  app.patch("/technical/api/certificates/:id", async (req, res) => {
    try {
      const updatedCertificate = await storage.updateCertificate(req.params.id, req.body);
      res.json(updatedCertificate);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Failed to update certificate" });
    }
  });
  
  // POST create new certificate
  app.post("/technical/api/certificates", async (req, res) => {
    try {
      const newCertificate = await storage.createCertificate(req.body);
      res.status(201).json(newCertificate);
    } catch (error) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ error: "Failed to create certificate" });
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
  
  // GET all surveys
  app.get("/technical/api/surveys", async (req, res) => {
    try {
      const surveys = await storage.getSurveys();
      res.json(surveys);
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
  
  // PATCH update survey (for toggling applicable status)
  app.patch("/technical/api/surveys/:id", async (req, res) => {
    try {
      const updatedSurvey = await storage.updateSurvey(req.params.id, req.body);
      res.json(updatedSurvey);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: "Survey not found" });
      }
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

// Helper function to get seed defects data (returns empty array - no test data)
interface SeedDefect {
  seedId: string;
  vesselName: string;
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

function getSeedDefectsData(): SeedDefect[] {
  return [];
}