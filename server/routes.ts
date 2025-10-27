import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRunningHoursAuditSchema, insertWorkOrderSchema, insertDefectSchema, insertDefectActionSchema, insertDefectAttachmentSchema, insertComponentSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import bulkRouter from "./routes/bulk";
import alertRouter from "./routes/alerts";
import formRouter from "./routes/forms";
import createChangeRequestsRouter from "./routes/changeRequests";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Component Upload Route
  app.post("/api/components/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
      
      let parsedData: any[] = [];
      
      // Parse based on file type
      if (fileExtension === '.csv') {
        const csvContent = file.buffer.toString('utf-8');
        const parseResult = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        });
        parsedData = parseResult.data;
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
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
        'Category': 'category',
        'Vessel ID': 'vesselId',
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
        'Class Item': 'classItem'
      };

      // Process and validate data
      const errors: any[] = [];
      const processedComponents: any[] = [];
      
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const rowNum = i + 2; // Account for header row
        
        // Map fields
        const component: any = {};
        for (const [fileHeader, dbField] of Object.entries(fieldMapping)) {
          if (row[fileHeader] !== undefined && row[fileHeader] !== null && row[fileHeader] !== '') {
            let value = row[fileHeader];
            
            // Convert boolean fields
            if (dbField === 'critical' || dbField === 'classItem') {
              if (typeof value === 'string') {
                value = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === '1';
              }
            }
            
            // Convert decimal fields
            if (dbField === 'currentCumulativeRH' && value !== '') {
              value = parseFloat(value).toString();
            }
            
            component[dbField] = value;
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
        if (!component.category) {
          errors.push({
            row: rowNum,
            field: 'Category',
            message: 'Category is required',
            data: row
          });
          continue;
        }
        if (!component.vesselId) {
          errors.push({
            row: rowNum,
            field: 'Vessel ID',
            message: 'Vessel ID is required',
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
          errors: errors
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
        preview: processedComponents.slice(0, 5) // Show first 5 records as preview
      });

    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process upload: " + error.message });
    }
  });
  
  // Work Orders API routes
  
  // Get all work orders with optional vessel filter
  app.get("/api/work-orders", async (req, res) => {
    try {
      const vesselId = req.query.vesselId as string;
      const workOrders = await storage.getWorkOrders(vesselId);
      res.json(workOrders);
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
      res.json(workOrder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work order" });
    }
  });
  
  // Create new work order
  app.post("/api/work-orders", async (req, res) => {
    try {
      const validatedData = insertWorkOrderSchema.parse(req.body);
      const workOrder = await storage.createWorkOrder(validatedData);
      res.status(201).json(workOrder);
    } catch (error: any) {
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
  
  // Get defects count
  app.get("/api/defects/count", async (req, res) => {
    try {
      const filters = {
        statusView: req.query.statusScope as 'active' | 'resolved' | undefined || 
                   req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
        vesselId: req.query.vesselId as string,
      };
      
      const count = await storage.getDefectsCount(filters);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to get defects count" });
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

  // Clear all defects data endpoint - preserves schema and storage logic
  app.delete("/api/defects-clear-all", async (req, res) => {
    try {
      await storage.clearAllDefectsData();
      res.json({ 
        success: true, 
        message: "All defects data has been cleared successfully. IDs will start from 1 for new entries." 
      });
    } catch (error: any) {
      console.error("Error clearing defects data:", error);
      res.status(500).json({ error: "Failed to clear defects data" });
    }
  });

  // Seed E2E test data endpoint
  app.post("/api/defects-seed-e2e-test", async (req, res) => {
    try {
      const testReport = await storage.seedE2ETestData();
      res.json({ 
        success: true, 
        message: "E2E test data seeded successfully", 
        testReport 
      });
    } catch (error: any) {
      console.error("Error seeding E2E test data:", error);
      res.status(500).json({ error: "Failed to seed E2E test data" });
    }
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
        closedOn: new Date().toISOString().replace('T', ' ').substring(0, 16),
        closureComment,
        closureFiles: closureFiles || [],
        status: 'Closed',
        actionTakenRequested,
        targetCloseDate,
        dateCompleted
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
  
  // Get all running hours audits
  app.get("/api/running-hours", async (req, res) => {
    try {
      const audits = await storage.getRunningHoursAudits();
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
  
  // Update existing audit by ID
  app.patch("/api/running-hours/:id", async (req, res) => {
    try {
      const partialAuditSchema = insertRunningHoursAuditSchema.partial();
      const validatedData = partialAuditSchema.parse(req.body);
      const audit = await storage.updateRunningHoursAudit(parseInt(req.params.id), validatedData);
      res.json(audit);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid audit data", details: error.errors });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update audit" });
    }
  });
  
  // Delete audit by ID
  app.delete("/api/running-hours/:id", async (req, res) => {
    try {
      await storage.deleteRunningHoursAudit(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete audit" });
    }
  });

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
      const vesselId = req.query.vesselId as string;
      const components = await storage.getComponents(vesselId);
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
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spares" });
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
  
  // Inventory history endpoints
  app.get("/api/spares/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { spareId, transactionType, dateFrom, dateTo, search } = req.query;
      
      const filters = {
        vesselId,
        spareId: spareId ? parseInt(spareId as string) : undefined,
        transactionType: transactionType as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        search: search as string
      };
      
      const history = await storage.getSpareHistory(filters);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });
  
  // Get low stock spares (below minimum quantity)
  app.get("/api/spares/:vesselId/low-stock", async (req, res) => {
    try {
      const spares = await storage.getSpares(req.params.vesselId);
      const lowStockSpares = spares.filter(spare => spare.stockQuantity <= spare.minimumQuantity);
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
      const stores = await storage.getSpares(req.params.vesselId, 'Store');
      res.json(stores);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });
  
  app.get("/api/stores/:vesselId/history", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { spareId, transactionType, dateFrom, dateTo, search } = req.query;
      
      const filters = {
        vesselId,
        spareId: spareId ? parseInt(spareId as string) : undefined,
        transactionType: transactionType as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        search: search as string,
        itemType: 'Store'
      };
      
      const history = await storage.getSpareHistory(filters);
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
        const result = await storage.consumeSpare(
          item.spareId,
          item.quantity,
          undefined, // No work order for stores
          consumedBy || 'System',
          item.notes
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
      const reportData = {
        title: `${reportType.toUpperCase()} Report`,
        vessel: vesselId || 'All Vessels',
        period: `${dateFrom || 'Start'} to ${dateTo || 'End'}`,
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
            stockQuantity: spare.stockQuantity,
            minimumQuantity: spare.minimumQuantity,
            status: spare.stockQuantity <= spare.minimumQuantity ? 'Low Stock' : 'OK'
          }));
          break;
        case 'consumption':
          const history = await storage.getSpareHistory({
            vesselId: vesselId as string,
            transactionType: 'CONSUME',
            dateFrom: dateFrom as string,
            dateTo: dateTo as string
          });
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
        
        for (const equipmentKey of equipmentKeys) {
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
  
  const httpServer = createServer(app);
  
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