import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRunningHoursAuditSchema, cascadeRunningHoursSchema, insertWorkOrderSchema, insertWorkOrderExecutionSchema, insertDefectSchema, insertDefectActionSchema, insertDefectAttachmentSchema, insertComponentSchema, insertSpareSchema, insertMakerSchema, insertMasterListSchema } from "@shared/schema";
import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { z } from "zod";
import multer from "multer";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import bulkRouter from "./routes/bulk";
import alertRouter from "./routes/alerts";
import formRouter from "./routes/forms";
import createChangeRequestsRouter from "./routes/changeRequests";
import { ObjectStorageService, objectStorageClient, parseObjectPath, ObjectNotFoundError } from "./objectStorage";
import { registerRunningHoursRoutes } from "./runningHoursRoutes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register Running Hours routes from dedicated file
  registerRunningHoursRoutes(app);
  // Set up multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Components API routes (for Target Picker)
  app.get("/api/components/:vesselId", async (req, res) => {
    try {
      const components = await storage.getComponents(req.params.vesselId);
      res.json(components);
    } catch (error) {
      console.error("Error fetching components:", error);
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });

  // Get single component by ID (for component details)
  app.get("/api/components/details/:id", async (req, res) => {
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
  app.post("/api/components/upload", upload.single('file'), async (req, res) => {
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
      const fieldMapping: { [key: string]: string } = {
        'Component ID': 'id',
        'Component Name': 'name',
        'Component Code': 'componentCode',
        'Parent ID': 'parentId',
        'Parent Component Code': 'parentId',
        'Category': 'category',
        'Vessel ID': 'vesselId',
        'Vessel Code': 'vesselCode',
        'Current Cumulative RH': 'currentCumulativeRH',
        'Last Updated': 'lastUpdated',
        'Maker': 'maker',
        'Model': 'model',
        'Serial No': 'serialNo',
        'Department Category': 'deptCategory',
        'Component Category': 'componentCategory',
        'Location': 'location',
        'Commissioned Date': 'commissionedDate',
        'Critical': 'critical',
        'Critical (Yes/No)': 'critical',
        'Class Item': 'classItem',
        'Condition Based': 'conditionBased',
        'Condition Based (Yes/No)': 'conditionBased',
        'Running Hours': 'runningHours'
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
            if (dbField === 'critical' || dbField === 'classItem' || dbField === 'conditionBased') {
              if (typeof processedValue === 'string') {
                processedValue = processedValue.toLowerCase() === 'true' || 
                                 processedValue.toLowerCase() === 'yes' || 
                                 processedValue === '1';
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
  app.get("/api/jobs", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string | undefined;
      const componentId = req.query.componentId as string | undefined;
      const jobs = await storage.getJobs(vesselId, componentId);
      res.json(jobs);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  
  // Get single job by ID
  app.get("/api/jobs/:id", async (req, res) => {
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
  
  // Create new job
  app.post("/api/jobs", async (req, res) => {
    try {
      const { insertJobSchema } = await import("@shared/schema");
      let jobData = insertJobSchema.parse(req.body);
      
      // Auto-generate job number if not provided (format: JOB-XXXXXXX)
      if (!jobData.jobNo) {
        const { nanoid } = await import('nanoid');
        const generatedJobNo = `JOB-${nanoid(7).toUpperCase()}`;
        jobData = {
          ...jobData,
          jobNo: generatedJobNo
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
  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      res.json(job);
    } catch (error) {
      console.error("Failed to update job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });
  
  // Delete job
  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      await storage.deleteJob(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete job:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });
  
  // Work Orders API routes
  
  // Get all work orders with optional vessel filter
  app.get("/api/work-orders", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const workOrders = await storage.getWorkOrders(vesselId);
      
      // Augment each work order with computed status
      const workOrdersWithComputedStatus = workOrders.map(wo => ({
        ...wo,
        computedStatus: computeWorkOrderStatus({
          dueDate: wo.dueDate,
          isExecution: wo.isExecution,
          status: wo.status,
          completionDateTime: wo.dateCompleted
        })
      }));
      
      res.json(workOrdersWithComputedStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });
  
  // Get single work order
  app.get("/api/work-orders/:id", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      // Augment with computed status
      const workOrderWithComputedStatus = {
        ...workOrder,
        computedStatus: computeWorkOrderStatus({
          dueDate: workOrder.dueDate,
          isExecution: workOrder.isExecution,
          status: workOrder.status,
          completionDateTime: workOrder.dateCompleted
        })
      };
      
      res.json(workOrderWithComputedStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work order" });
    }
  });
  
  // Get work order context (for running hours validation)
  app.get("/api/work-orders/:id/context", async (req, res) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      // Get component data (work orders store component ID in 'component' field)
      const component = await storage.getComponent(workOrder.component);
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
      
      res.json({
        workOrder,
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
        maintenanceBasis: workOrder.maintenanceBasis
      });
    } catch (error) {
      console.error("Failed to fetch work order context:", error);
      res.status(500).json({ error: "Failed to fetch work order context" });
    }
  });
  
  // Create new work order
  app.post("/api/work-orders", async (req, res) => {
    try {
      let workOrderData = insertWorkOrderSchema.parse(req.body);
      
      // Convert ISO date (YYYY-MM-DD) to DD-MM-YYYY if provided by frontend
      if (workOrderData.dueDate && workOrderData.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = workOrderData.dueDate.split('-');
        workOrderData.dueDate = `${day}-${month}-${year}`;
        console.log(`Converted dueDate from ISO to DD-MM-YYYY: ${workOrderData.dueDate}`);
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
  app.patch("/api/work-orders/:id", async (req, res) => {
    try {
      const partialWorkOrderSchema = insertWorkOrderSchema.partial();
      const validatedData = partialWorkOrderSchema.parse(req.body);
      const workOrder = await storage.updateWorkOrder(req.params.id, validatedData);
      res.json(workOrder);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid work order data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update work order" });
    }
  });
  
  // Complete work order with running hours update (atomic operation)
  app.post("/api/work-orders/:id/complete", async (req, res) => {
    try {
      const { runningHours, dateOfCompletion, ...executionData } = req.body;
      
      // Get work order and component context
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      const component = await storage.getComponent(workOrder.component);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
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
        
        // CRITICAL: Capture original RH BEFORE updating (parse from string)
        const previousRH = parseInt(component.currentCumulativeRH);
        
        // Ensure complete metadata for audit (get from work order which always has it)
        const componentVesselId = workOrder.vesselId || component.vesselId || 'V001';
        const componentCode = workOrder.componentCode || component.componentCode;
        
        // Validate against parent if exists
        if (component.parentId) {
          const parentComponent = await storage.getComponent(component.parentId);
          if (parentComponent) {
            const parentRH = parseInt(parentComponent.currentCumulativeRH);
            if (newRH > parentRH) {
              return res.status(400).json({
                error: `Running hours (${newRH}) cannot exceed parent component's running hours (${parentRH})`
              });
            }
          }
        }
        
        // Validate no decrease
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
        
        // Calculate delta for cascading
        const delta = newRH - previousRH;
        
        // Update component running hours (convert back to string for storage)
        await storage.updateComponent(component.id, {
          currentCumulativeRH: newRH.toString(),
          lastUpdated: dateOfCompletion || new Date().toISOString().split('T')[0]
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
          source: 'single',
          notes: `Updated via work order completion: ${workOrder.templateCode}`,
          meterReplaced: false
        });
        
        // Cascade delta to all children
        if (delta > 0) {
          const vesselId = componentVesselId;
          const allComponents = await storage.getComponents(vesselId);
          
          // Find all children recursively
          const getAllChildren = (parentId: string): typeof allComponents => {
            const directChildren = allComponents.filter(c => c.parentId === parentId);
            const allDescendants = [...directChildren];
            directChildren.forEach(child => {
              allDescendants.push(...getAllChildren(child.id));
            });
            return allDescendants;
          };
          
          const children = getAllChildren(component.id);
          
          // Update each child with the delta
          for (const child of children) {
            const childPreviousRH = child.currentCumulativeRH;
            const childNewRH = childPreviousRH + delta;
            const childVesselId = child.vesselId || componentVesselId;
            const childComponentCode = child.componentCode;
            
            await storage.updateComponent(child.id, {
              currentCumulativeRH: childNewRH,
              lastUpdated: dateOfCompletion || new Date().toISOString().split('T')[0]
            });
            
            // Record audit for each child with complete metadata
            await storage.createRunningHoursAudit({
              componentId: child.id,
              vesselId: childVesselId,
              previousRH: childPreviousRH.toString(),
              newRH: childNewRH.toString(),
              cumulativeRH: childNewRH.toString(),
              dateUpdatedLocal: dateOfCompletion || new Date().toISOString().split('T')[0],
              dateUpdatedTZ: 'UTC',
              enteredAtUTC: new Date(),
              userId: executionData.performedBy || 'System',
              source: 'single',
              notes: `Cascaded from parent ${componentCode} via work order: ${workOrder.templateCode}`,
              meterReplaced: false
            });
          }
        }
      }
      
      // Update work order execution data
      const updatedWorkOrder = await storage.updateWorkOrder(req.params.id, {
        ...executionData,
        runningHoursAtCompletion: runningHours ? parseInt(runningHours) : undefined,
        dateCompleted: dateOfCompletion,
        status: 'Completed'
      });
      
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
      res.status(500).json({ error: "Failed to complete work order" });
    }
  });
  
  // Delete work order
  app.delete("/api/work-orders/:id", async (req, res) => {
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

  // Work Order Execution API routes
  
  // Get all executions for a component
  app.get("/api/work-order-executions/:componentId", async (req, res) => {
    try {
      const executions = await storage.getWorkOrderExecutions(req.params.componentId);
      res.json(executions);
    } catch (error) {
      console.error("Error fetching work order executions:", error);
      res.status(500).json({ error: "Failed to fetch work order executions" });
    }
  });
  
  // Get single execution by ID
  app.get("/api/work-order-executions/details/:id", async (req, res) => {
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
  app.post("/api/work-order-executions", async (req, res) => {
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
  app.patch("/api/work-order-executions/:id", async (req, res) => {
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
  app.get("/api/defects", async (req, res) => {
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
  app.get("/api/defects/coc", async (req, res) => {
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
  app.get("/api/defects/recurring", async (req, res) => {
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
  app.get("/api/defects/count", async (req, res) => {
    try {
      const filters: any = {
        statusView: req.query.statusScope as 'active' | 'resolved' | undefined || 
                   req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
        vesselId: req.query.vesselId as string,
        isCoC: req.query.isCoC === 'true',
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
  app.get("/api/defects/count/recurring", async (req, res) => {
    try {
      const recurringDefects = await storage.getRecurringDefects({});
      res.json({ count: recurringDefects.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get recurring defects count" });
    }
  });
  
  // Get single defect
  app.get("/api/defects/:id", async (req, res) => {
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
  app.post("/api/defects", async (req, res) => {
    try {
      const validatedData = insertDefectSchema.parse(req.body);
      const defect = await storage.createDefect(validatedData);
      res.status(201).json(defect);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid defect data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create defect" });
    }
  });
  
  // Update defect
  app.patch("/api/defects/:id", async (req, res) => {
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
  app.delete("/api/defects/:id", async (req, res) => {
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
  app.delete("/api/defects-clear-all", async (req, res) => {
    res.status(501).json({ 
      error: "Not Implemented",
      message: "The clearAllDefectsData method is not implemented in storage. This endpoint is reserved for future admin/testing functionality." 
    });
  });

  // Seed E2E test data endpoint
  app.post("/api/defects-seed-e2e-test", async (req, res) => {
    res.status(501).json({ 
      error: "Not Implemented",
      message: "The seedE2ETestData method is not implemented in storage. This endpoint is reserved for future testing functionality." 
    });
  });

  // Get defects count endpoint (returns active and resolved counts)
  app.get("/api/defects-count", async (req, res) => {
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
  app.get("/api/defects/:defectId/actions", async (req, res) => {
    try {
      const actions = await storage.getDefectActions(req.params.defectId);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect actions" });
    }
  });
  
  // Create defect action
  app.post("/api/defects/:defectId/actions", async (req, res) => {
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
  app.patch("/api/defects/actions/:actionId", async (req, res) => {
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
  app.delete("/api/defects/actions/:actionId", async (req, res) => {
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
  app.get("/api/defects/:defectId/attachments", async (req, res) => {
    try {
      const attachments = await storage.getDefectAttachments(req.params.defectId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defect attachments" });
    }
  });
  
  // Create defect attachment
  app.post("/api/defects/:defectId/attachments", async (req, res) => {
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
  app.delete("/api/defects/attachments/:attachmentId", async (req, res) => {
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
  app.post("/api/defects/:id/notes", async (req, res) => {
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
  app.patch("/api/defects/:id/link", async (req, res) => {
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
  app.patch("/api/defects/:id/close", async (req, res) => {
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
  app.post("/api/defects/reports/:reportKey", async (req, res) => {
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
  app.get("/api/running-hours/:componentId", async (req, res) => {
    try {
      const audits = await storage.getRunningHoursAudits(req.params.componentId);
      res.json(audits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch running hours audits" });
    }
  });
  
  // Create a new running hours audit
  app.post("/api/running-hours", async (req, res) => {
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
  app.get("/api/test-new-endpoint", async (req, res) => {
    res.json({ message: "This is a brand new endpoint added just now!", timestamp: new Date().toISOString() });
  });
  
  // DEBUG endpoint to check jobs data
  app.get("/api/debug/jobs", async (req, res) => {
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
  app.post("/api/running-hours/cascade", async (req, res) => {
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
  // app.patch("/api/running-hours/:id", async (req, res) => {
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
  // app.delete("/api/running-hours/:id", async (req, res) => {
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
  app.post("/api/components", async (req, res) => {
    try {
      const component = await storage.createComponent(req.body);
      res.status(201).json(component);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create component" });
    }
  });
  
  app.get("/api/components", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string | undefined;
      // getComponents requires vesselId - use default 'V001' if not provided
      const components = await storage.getComponents(vesselId || 'V001');
      res.json(components);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });

  app.get("/api/components/:id", async (req, res) => {
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
  
  app.patch("/api/components/:id", async (req, res) => {
    try {
      const component = await storage.updateComponent(req.params.id, req.body);
      res.json(component);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update component" });
    }
  });
  
  app.delete("/api/components/:id", async (req, res) => {
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
  
  // Spares routes...
  
  // Get spares for a vessel
  app.get("/api/spares/:vesselId", async (req, res) => {
    try {
      const spares = await storage.getSpares(req.params.vesselId);
      res.json(spares);
    } catch (error: any) {
      console.error("Error fetching spares:", error);
      res.status(500).json({ error: "Failed to fetch spares", details: error.message });
    }
  });
  
  // Get spare by ID (optional - useful for detail views)
  app.get("/api/spares/:vesselId/:id", async (req, res) => {
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
  app.post("/api/spares/:vesselId", async (req, res) => {
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
  app.patch("/api/spares/:vesselId/:id", async (req, res) => {
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
  app.delete("/api/spares/:vesselId/:id", async (req, res) => {
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
  app.post("/api/spares/:vesselId/:id/adjust", async (req, res) => {
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
  app.get("/api/spares/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      // getSpareHistory only takes vesselId as parameter
      const history = await storage.getSpareHistory(vesselId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });
  
  // Get low stock spares (below minimum quantity)
  app.get("/api/spares/:vesselId/low-stock", async (req, res) => {
    try {
      const spares = await storage.getSpares(req.params.vesselId);
      const lowStockSpares = spares.filter(spare => (spare.rob || 0) <= (spare.min || 0));
      res.json(lowStockSpares);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock spares" });
    }
  });
  
  // Batch consume spares (for work order consumption)
  app.post("/api/spares/:vesselId/batch-consume", async (req, res) => {
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
  app.post("/api/spares/:vesselId/batch-receive", async (req, res) => {
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
  
  // Stores endpoints (mirroring spares structure)
  app.get("/api/stores/:vesselId", async (req, res) => {
    try {
      // Note: stores are stored in the same table as spares
      // For now, return all spares - filtering can be done on frontend if needed
      const stores = await storage.getSpares(req.params.vesselId);
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });
  
  app.get("/api/stores/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      // getSpareHistory only takes vesselId as parameter
      const history = await storage.getSpareHistory(vesselId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores history" });
    }
  });
  
  // Batch consume stores
  app.post("/api/stores/:vesselId/batch-consume", async (req, res) => {
    try {
      const { items, consumedBy } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }
      
      const results = [];
      for (const item of items) {
        // consumeSpare signature: (id, quantity, userId, remarks?, place?, dateLocal?, tz?)
        const result = await storage.consumeSpare(
          item.spareId,
          item.quantity,
          consumedBy || 'System', // userId parameter
          item.notes // remarks parameter
        );
        results.push(result);
      }
      
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to consume stores" });
    }
  });
  
  // Batch receive stores
  app.post("/api/stores/:vesselId/batch-receive", async (req, res) => {
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
      res.status(500).json({ error: error.message || "Failed to receive stores" });
    }
  });
  
  // Reports endpoint
  app.get("/api/reports/:reportType", async (req, res) => {
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
  app.get("/api/me", async (req, res) => {
    res.json({ 
      user: { 
        id: 1, 
        name: "Admin User",
        role: "admin",
        email: "admin@pms.com"
      } 
    });
  });
  
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Register bulk routes
  app.use("/api/bulk", bulkRouter);
  
  // Register alert routes
  app.use("/api/alerts", alertRouter);
  
  // Register form routes
  app.use("/api/forms", formRouter);
  
  // Mount the Change Requests router  
  const changeRequestsRouter = createChangeRequestsRouter(storage);
  app.use("/api/change-requests", changeRequestsRouter);
  
  // Template builder endpoints
  app.get("/api/template-builder/:templateType", async (req, res) => {
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
  app.get("/api/recurring-defects", async (req, res) => {
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
  app.get("/api/recurring-defects/:id", async (req, res) => {
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
  app.get("/api/recurring-defects/:id/defects", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const defects = await storage.getDefectsForRecurring(id);
      res.json(defects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch defects for recurring defect" });
    }
  });
  
  // Manually trigger recalculation for an equipment key
  app.post("/api/recurring-defects/recalculate", async (req, res) => {
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
  app.get("/api/fleet/components", async (req, res) => {
    try {
      const components = await storage.getFleetComponents();
      res.json(components);
    } catch (error) {
      console.error("Error fetching fleet components:", error);
      res.status(500).json({ error: "Failed to fetch fleet components" });
    }
  });
  
  // Get fleet component by ID
  app.get("/api/fleet/components/:id", async (req, res) => {
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
  app.post("/api/fleet/components", async (req, res) => {
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
  app.patch("/api/fleet/components/:id", async (req, res) => {
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
  app.delete("/api/fleet/components/:id", async (req, res) => {
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
  app.get("/api/fleet/jobs", async (req, res) => {
    try {
      const jobs = await storage.getFleetJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching fleet jobs:", error);
      res.status(500).json({ error: "Failed to fetch fleet jobs" });
    }
  });
  
  // Get fleet job by ID
  app.get("/api/fleet/jobs/:id", async (req, res) => {
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
  app.post("/api/fleet/jobs", async (req, res) => {
    try {
      const validatedData = insertWorkOrderSchema.parse(req.body);
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
  app.patch("/api/fleet/jobs/:id", async (req, res) => {
    try {
      const partialJobSchema = insertWorkOrderSchema.partial();
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
  app.delete("/api/fleet/jobs/:id", async (req, res) => {
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
  app.get("/api/fleet/spares", async (req, res) => {
    try {
      const spares = await storage.getFleetSpares();
      res.json(spares);
    } catch (error) {
      console.error("Error fetching fleet spares:", error);
      res.status(500).json({ error: "Failed to fetch fleet spares" });
    }
  });
  
  // Get fleet spare by ID
  app.get("/api/fleet/spares/:id", async (req, res) => {
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
  app.post("/api/fleet/spares", async (req, res) => {
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
  app.patch("/api/fleet/spares/:id", async (req, res) => {
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
  app.delete("/api/fleet/spares/:id", async (req, res) => {
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
  app.get("/api/fleet/makers", async (req, res) => {
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
  app.get("/api/fleet/makers/:id", async (req, res) => {
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
  app.post("/api/fleet/makers", async (req, res) => {
    try {
      const validatedData = insertMakerSchema.parse(req.body);
      const maker = await storage.createMaker(validatedData);
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
  app.put("/api/fleet/makers/:id", async (req, res) => {
    try {
      const partialMakerSchema = insertMakerSchema.partial();
      const validatedData = partialMakerSchema.parse(req.body);
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
  app.delete("/api/fleet/makers/:id", async (req, res) => {
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
  app.get("/api/fleet/master-lists", async (req, res) => {
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
  app.get("/api/fleet/master-lists/:id", async (req, res) => {
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
  app.post("/api/fleet/master-lists", async (req, res) => {
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
  app.put("/api/fleet/master-lists/:id", async (req, res) => {
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
  app.delete("/api/fleet/master-lists/:id", async (req, res) => {
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

  // Document Management API routes for Work Orders
  // Upload document to object storage using SDK
  app.post("/api/upload-document", upload.single('file'), async (req, res) => {
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
  app.get("/api/documents/:fileKey(*)", async (req, res) => {
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
  app.delete("/api/documents/:fileKey(*)", async (req, res) => {
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
  
  const httpServer = createServer(app);
  
  // Recalculate recurring defects on startup (don't await - let it run in background)
  storage.recalculateAllRecurringDefects().then(() => {
    console.log('✅ Recurring defects recalculated successfully');
  }).catch(err => {
    console.error('⚠️ Error recalculating recurring defects:', err);
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

// Helper function to get seed defects data
function getSeedDefectsData() {
  return [
    // Recurring group A (5 items) - KSB SWP-200 pump for testing recurring defects
    {
      seedId: "RD-A-001",
      vesselName: "MV SEAFARER",
      issuedDate: "2025-09-15",
      targetDate: "2025-10-15",
      status: "open",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Mechanical",
      responsibleRole: "2nd Engineer",
      equipment: { category: "Pumps & Valves", type: "Sea Water Pump", make: "KSB", model: "SWP-200" },
      description: "Sea water pump vibration observed on ME cooling line.",
      actionRequested: "Inspect bearings and check alignment"
    },
    {
      seedId: "RD-A-002",
      vesselName: "MV SEAFARER",
      issuedDate: "2025-09-28",
      targetDate: "2025-10-10",
      status: "closed",
      dateCompleted: "2025-10-01",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Mechanical",
      responsibleRole: "2nd Engineer",
      equipment: { category: "Pumps & Valves", type: "Sea Water Pump", make: "KSB", model: "SWP-200" },
      description: "SWP-200 mechanical seal leakage.",
      actionRequested: "Replace mechanical seal"
    },
    {
      seedId: "RD-A-003",
      vesselName: "MV VOYAGER",
      issuedDate: "2025-10-03",
      targetDate: "2025-10-20",
      status: "open",
      isCoC: true,
      source: "ClassNK",
      defectCategory: "Defect",
      defectType: "Mechanical",
      responsibleRole: "2nd Engineer",
      equipment: { category: "Pumps & Valves", type: "Sea Water Pump", make: "KSB", model: "SWP-200" },
      description: "High bearing temperature on SWP-200.",
      actionRequested: "Check bearing condition and lubrication"
    },
    {
      seedId: "RD-A-004",
      vesselName: "MV OCEANIC",
      issuedDate: "2025-10-05",
      targetDate: "2025-10-25",
      status: "open",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Mechanical",
      responsibleRole: "2nd Engineer",
      equipment: { category: "Pumps & Valves", type: "Sea Water Pump", make: "KSB", model: "SWP-200" },
      description: "Abnormal noise from SWP-200 casing.",
      actionRequested: "Investigate noise source and rectify"
    },
    {
      seedId: "RD-A-005",
      vesselName: "MV SEAFARER",
      issuedDate: "2025-10-06",
      targetDate: "2025-10-15",
      status: "closed",
      dateCompleted: "2025-10-07",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Mechanical",
      responsibleRole: "2nd Engineer",
      equipment: { category: "Pumps & Valves", type: "Sea Water Pump", make: "KSB", model: "SWP-200" },
      description: "SWP-200 coupling misalignment.",
      actionRequested: "Realign coupling"
    },
    // Non-recurring items (5 different equipment)
    {
      seedId: "RD-B-001",
      vesselName: "MV SEAFARER",
      issuedDate: "2025-09-20",
      targetDate: "2025-10-10",
      status: "open",
      isCoC: true,
      source: "PSC",
      defectCategory: "Defect",
      defectType: "Navigation",
      responsibleRole: "2nd Officer",
      equipment: { category: "Navigation", type: "Radar", make: "Furuno", model: "FR-2137S" },
      description: "X-band radar intermittent blanking.",
      actionRequested: "Check scanner connections and power supply"
    },
    {
      seedId: "RD-C-001",
      vesselName: "MV VOYAGER",
      issuedDate: "2025-09-22",
      targetDate: "2025-10-05",
      status: "closed",
      dateCompleted: "2025-09-25",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Electrical",
      responsibleRole: "ETO",
      equipment: { category: "Electrical", type: "Generator AVR", make: "Stamford", model: "SX460" },
      description: "DG AVR trip during load step.",
      actionRequested: "Adjust AVR settings"
    },
    {
      seedId: "RD-D-001",
      vesselName: "MV OCEANIC",
      issuedDate: "2025-10-01",
      targetDate: "2025-10-20",
      status: "open",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Mechanical",
      responsibleRole: "2nd Engineer",
      equipment: { category: "Machinery", type: "Air Compressor", make: "Atlas Copco", model: "GA-30" },
      description: "Compressor fails to reach cut-out pressure.",
      actionRequested: "Check valves and pressure switch"
    },
    {
      seedId: "RD-E-001",
      vesselName: "MV SEAFARER",
      issuedDate: "2025-10-02",
      targetDate: "2025-10-18",
      status: "open",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Mechanical",
      responsibleRole: "Chief Officer",
      equipment: { category: "Deck Equipment", type: "Windlass", make: "MacGregor", model: "WL-90" },
      description: "Port windlass brake slipping at test load.",
      actionRequested: "Adjust brake band tension"
    },
    {
      seedId: "RD-F-001",
      vesselName: "MV VOYAGER",
      issuedDate: "2025-10-03",
      targetDate: "2025-10-15",
      status: "closed",
      dateCompleted: "2025-10-04",
      isCoC: false,
      source: "Ship",
      defectCategory: "Defect",
      defectType: "Hydraulic",
      responsibleRole: "Chief Engineer",
      equipment: { category: "Steering", type: "Steering Gear", make: "Kawasaki", model: "KS-45" },
      description: "Hydraulic leak at return manifold.",
      actionRequested: "Replace seals and pressure test"
    }
  ];
}