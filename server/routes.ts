import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRunningHoursAuditSchema, insertWorkOrderSchema } from "@shared/schema";
import { z } from "zod";
import bulkRoutes from "./routes/bulk";
import alertRoutes from "./routes/alerts";
import formRoutes from "./routes/forms";
import createChangeRequestsRouter from "./routes/changeRequests";

export async function registerRoutes(app: Express): Promise<Server> {
  // Components API routes (for Target Picker)
  app.get("/api/components/:vesselId", async (req, res) => {
    try {
      const components = await storage.getComponents(req.params.vesselId);
      res.json(components);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch components" });
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
  
  // Running Hours API routes
  
  // Get components for a vessel
  app.get("/api/running-hours/components/:vesselId", async (req, res) => {
    try {
      const components = await storage.getComponents(req.params.vesselId);
      res.json(components);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });

  // Update component running hours
  app.post("/api/running-hours/update/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const updateData = req.body;
      
      // Create audit entry
      const audit = await storage.createRunningHoursAudit(updateData.audit);
      
      // Update component
      const component = await storage.updateComponent(componentId, {
        currentCumulativeRH: updateData.cumulativeRH.toString(),
        lastUpdated: updateData.dateUpdatedLocal
      });
      
      res.json({ component, audit });
    } catch (error) {
      res.status(500).json({ error: "Failed to update running hours" });
    }
  });

  // Bulk update running hours
  app.post("/api/running-hours/bulk-update", async (req, res) => {
    try {
      const updates = req.body.updates;
      const results = [];
      
      for (const update of updates) {
        const audit = await storage.createRunningHoursAudit(update.audit);
        const component = await storage.updateComponent(update.componentId, {
          currentCumulativeRH: update.cumulativeRH.toString(),
          lastUpdated: update.dateUpdatedLocal
        });
        results.push({ component, audit });
      }
      
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: "Failed to perform bulk update" });
    }
  });

  // Get running hours audits for a component
  app.get("/api/running-hours/audits/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const audits = await storage.getRunningHoursAudits(componentId, limit);
      res.json(audits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audits" });
    }
  });

  // Get utilization rate for components
  app.post("/api/running-hours/utilization-rates", async (req, res) => {
    try {
      const { componentIds } = req.body;
      const rates: Record<string, number | null> = {};
      
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      for (const componentId of componentIds) {
        const audits = await storage.getRunningHoursAuditsInDateRange(
          componentId,
          thirtyDaysAgo,
          today
        );
        
        // Get anchor point (most recent before window)
        const allAudits = await storage.getRunningHoursAudits(componentId);
        const anchorAudit = allAudits.find(a => new Date(a.dateUpdatedLocal) < thirtyDaysAgo);
        
        const windowAudits = anchorAudit ? [anchorAudit, ...audits] : audits;
        
        if (windowAudits.length < 2) {
          rates[componentId] = null;
        } else {
          const start = windowAudits[0];
          const end = windowAudits[windowAudits.length - 1];
          
          const deltaHours = parseFloat(end.cumulativeRH) - parseFloat(start.cumulativeRH);
          const startDate = new Date(start.dateUpdatedLocal);
          const endDate = new Date(end.dateUpdatedLocal);
          const deltaDays = Math.max((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24), 1);
          
          const utilization = Math.max(deltaHours / deltaDays, 0);
          rates[componentId] = Math.round(utilization * 10) / 10;
        }
      }
      
      res.json(rates);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate utilization rates" });
    }
  });

  // Spares API routes
  
  // Get all spares for a vessel
  app.get("/api/spares/:vesselId", async (req, res) => {
    try {
      const spares = await storage.getSpares(req.params.vesselId);
      // Calculate stock status server-side
      const sparesWithStatus = spares.map(spare => ({
        ...spare,
        stockStatus: spare.rob < spare.min ? 'Low' : spare.rob === spare.min ? 'Minimum' : 'OK'
      }));
      res.json(sparesWithStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spares" });
    }
  });

  // Get single spare
  app.get("/api/spares/item/:id", async (req, res) => {
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

  // Create new spare
  app.post("/api/spares", async (req, res) => {
    try {
      const spare = await storage.createSpare(req.body);
      res.json(spare);
    } catch (error) {
      res.status(500).json({ error: "Failed to create spare" });
    }
  });

  // Update spare
  app.put("/api/spares/:id", async (req, res) => {
    try {
      const spare = await storage.updateSpare(parseInt(req.params.id), req.body);
      res.json(spare);
    } catch (error) {
      res.status(500).json({ error: "Failed to update spare" });
    }
  });

  // Delete spare
  app.delete("/api/spares/:id", async (req, res) => {
    try {
      await storage.deleteSpare(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete spare" });
    }
  });

  // Consume spare
  app.post("/api/spares/:id/consume", async (req, res) => {
    try {
      const { vesselId, qty, dateLocal, tz, place, remarks, userId } = req.body;
      
      // Validation
      if (!qty || qty < 1) {
        return res.status(400).json({ error: "Quantity must be at least 1" });
      }
      
      // Check if date is not in future
      const today = new Date();
      const inputDate = new Date(dateLocal);
      if (inputDate > today) {
        return res.status(400).json({ error: "Date cannot be in the future" });
      }
      
      const spare = await storage.consumeSpare(
        parseInt(req.params.id),
        qty,
        userId || 'user',
        remarks,
        place,
        dateLocal,
        tz || 'UTC'
      );
      
      // Calculate stock status for response
      const spareWithStatus = {
        ...spare,
        stockStatus: spare.rob < spare.min ? 'Low' : spare.rob === spare.min ? 'Minimum' : 'OK'
      };
      
      res.json(spareWithStatus);
    } catch (error: any) {
      if (error.message === 'Insufficient stock') {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to consume spare" });
      }
    }
  });

  // Receive spare
  app.post("/api/spares/:id/receive", async (req, res) => {
    try {
      const { vesselId, qty, dateLocal, tz, place, supplierPO, remarks, userId } = req.body;
      
      // Validation
      if (!qty || qty < 1) {
        return res.status(400).json({ error: "Quantity must be at least 1" });
      }
      
      // Check if date is not in future
      const today = new Date();
      const inputDate = new Date(dateLocal);
      if (inputDate > today) {
        return res.status(400).json({ error: "Date cannot be in the future" });
      }
      
      const spare = await storage.receiveSpare(
        parseInt(req.params.id),
        qty,
        userId || 'user',
        remarks,
        supplierPO,
        place,
        dateLocal,
        tz || 'UTC'
      );
      
      // Calculate stock status for response
      const spareWithStatus = {
        ...spare,
        stockStatus: spare.rob < spare.min ? 'Low' : spare.rob === spare.min ? 'Minimum' : 'OK'
      };
      
      res.json(spareWithStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to receive spare" });
    }
  });

  // Bulk update spares
  app.post("/api/spares/bulk-update", async (req, res) => {
    try {
      const { vesselId, tz, rows } = req.body;
      
      // Process each row and collect results
      const results = [];
      
      for (const row of rows) {
        // Skip rows where both consumed and received are 0
        if (row.consumed === 0 && row.received === 0) {
          results.push({
            componentSpareId: row.componentSpareId,
            success: false,
            message: null // Skipped
          });
          continue;
        }
        
        try {
          const spare = await storage.getSpare(row.componentSpareId);
          if (!spare) {
            results.push({
              componentSpareId: row.componentSpareId,
              success: false,
              message: "Spare not found"
            });
            continue;
          }
          
          // Validate insufficient stock
          if (row.consumed > 0 && spare.rob < row.consumed) {
            results.push({
              componentSpareId: row.componentSpareId,
              success: false,
              message: "Insufficient stock"
            });
            continue;
          }
          
          // Process consume
          if (row.consumed > 0) {
            await storage.consumeSpare(
              row.componentSpareId,
              row.consumed,
              row.userId || 'user',
              row.remarks,
              undefined,
              row.dateLocal || new Date().toISOString().split('T')[0],
              tz || 'UTC'
            );
          }
          
          // Process receive
          if (row.received > 0) {
            await storage.receiveSpare(
              row.componentSpareId,
              row.received,
              row.userId || 'user',
              row.remarks,
              undefined,
              row.receivedPlace,
              row.receivedDate,
              tz || 'UTC'
            );
          }
          
          // Get updated spare
          const updatedSpare = await storage.getSpare(row.componentSpareId);
          results.push({
            componentSpareId: row.componentSpareId,
            success: true,
            robAfter: updatedSpare?.rob || 0
          });
          
        } catch (error: any) {
          results.push({
            componentSpareId: row.componentSpareId,
            success: false,
            message: error.message || "Failed to update"
          });
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to perform bulk update" });
    }
  });

  // Get spares history
  app.get("/api/spares/history/:vesselId", async (req, res) => {
    try {
      const history = await storage.getSpareHistory(req.params.vesselId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // Get history for specific spare
  app.get("/api/spares/history/spare/:spareId", async (req, res) => {
    try {
      const history = await storage.getSpareHistoryBySpareId(parseInt(req.params.spareId));
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spare history" });
    }
  });

  // Change Request API routes
  
  // Get change requests with filters
  app.get("/api/modify-pms/requests", async (req, res) => {
    try {
      const filters = {
        category: req.query.category as string,
        status: req.query.status as string,
        q: req.query.q as string,
        vesselId: req.query.vesselId as string
      };
      
      const requests = await storage.getChangeRequests(filters);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch change requests" });
    }
  });
  
  // Get single change request
  app.get("/api/modify-pms/requests/:id", async (req, res) => {
    try {
      const request = await storage.getChangeRequest(parseInt(req.params.id));
      if (!request) {
        return res.status(404).json({ error: "Change request not found" });
      }
      
      // Get attachments and comments
      const attachments = await storage.getChangeRequestAttachments(request.id);
      const comments = await storage.getChangeRequestComments(request.id);
      
      res.json({ ...request, attachments, comments });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch change request" });
    }
  });
  
  // Create change request (draft)
  app.post("/api/modify-pms/requests", async (req, res) => {
    try {
      const { vesselId, category, title, reason } = req.body;
      
      // Validation for draft - only title required
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      const request = await storage.createChangeRequest({
        vesselId: vesselId || '',
        category: category || 'components',
        title: title.substring(0, 120), // Enforce max length
        reason: reason || '',
        status: 'draft',
        requestedByUserId: req.body.userId || 'current_user'
      });
      
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to create change request" });
    }
  });
  
  // Update change request (draft/returned only)
  app.put("/api/modify-pms/requests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getChangeRequest(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Change request not found" });
      }
      
      if (existing.status !== 'draft' && existing.status !== 'returned') {
        return res.status(400).json({ error: "Can only edit draft or returned requests" });
      }
      
      const { vesselId, category, title, reason } = req.body;
      
      const updated = await storage.updateChangeRequest(id, {
        vesselId,
        category,
        title: title?.substring(0, 120),
        reason
      });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update change request" });
    }
  });
  
  // Update change request target (draft/returned only)
  app.put("/api/modify-pms/requests/:id/target", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { targetType, targetId, snapshotBeforeJson } = req.body;
      
      const updated = await storage.updateChangeRequestTarget(id, targetType, targetId, snapshotBeforeJson);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update target" });
    }
  });
  
  // Update proposed changes (draft/returned only)
  app.put("/api/modify-pms/requests/:id/proposed", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { proposedChangesJson, movePreviewJson } = req.body;
      
      const updated = await storage.updateChangeRequestProposed(id, proposedChangesJson, movePreviewJson);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update proposed changes" });
    }
  });
  
  // Submit change request
  app.put("/api/modify-pms/requests/:id/submit", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getChangeRequest(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Change request not found" });
      }
      
      if (existing.status !== 'draft' && existing.status !== 'returned') {
        return res.status(400).json({ error: "Can only submit draft or returned requests" });
      }
      
      // Validate required fields for submission - now including target and proposed changes
      if (!existing.title || !existing.category || !existing.vesselId || !existing.reason || 
          !existing.targetType || !existing.targetId || !existing.snapshotBeforeJson) {
        return res.status(400).json({ 
          error: "Title, Category, Vessel, Reason, and Target selection are required for submission" 
        });
      }
      
      // Check if proposed changes exist and are non-empty
      if (!existing.proposedChangesJson || 
          (Array.isArray(existing.proposedChangesJson) && existing.proposedChangesJson.length === 0)) {
        return res.status(400).json({ 
          error: "Please propose at least one change before submitting" 
        });
      }
      
      const updated = await storage.submitChangeRequest(id, req.body.userId || 'current_user');
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit change request" });
    }
  });
  
  // Approve change request (office only)
  app.put("/api/modify-pms/requests/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { comment, reviewerId } = req.body;
      
      if (!comment) {
        return res.status(400).json({ error: "Comment is required for approval" });
      }
      
      const updated = await storage.approveChangeRequest(
        id, 
        reviewerId || 'reviewer', 
        comment
      );
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to approve change request" });
    }
  });
  
  // Reject change request (office only)
  app.put("/api/modify-pms/requests/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { comment, reviewerId } = req.body;
      
      if (!comment) {
        return res.status(400).json({ error: "Comment is required for rejection" });
      }
      
      const updated = await storage.rejectChangeRequest(
        id, 
        reviewerId || 'reviewer', 
        comment
      );
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to reject change request" });
    }
  });
  
  // Return change request for clarification (office only)
  app.put("/api/modify-pms/requests/:id/return", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { comment, reviewerId } = req.body;
      
      if (!comment) {
        return res.status(400).json({ error: "Comment is required for return" });
      }
      
      const updated = await storage.returnChangeRequest(
        id, 
        reviewerId || 'reviewer', 
        comment
      );
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to return change request" });
    }
  });
  
  // Delete change request (draft only)
  app.delete("/api/modify-pms/requests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteChangeRequest(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete change request" });
    }
  });
  
  // Create attachment
  app.post("/api/modify-pms/requests/:id/attachments", async (req, res) => {
    try {
      const changeRequestId = parseInt(req.params.id);
      const { filename, url, uploadedByUserId } = req.body;
      
      if (!filename || !url) {
        return res.status(400).json({ error: "Filename and URL are required" });
      }
      
      const attachment = await storage.createChangeRequestAttachment({
        changeRequestId,
        filename,
        url,
        uploadedByUserId: uploadedByUserId || 'current_user'
      });
      
      res.json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create attachment" });
    }
  });
  
  // Create comment
  app.post("/api/modify-pms/requests/:id/comments", async (req, res) => {
    try {
      const changeRequestId = parseInt(req.params.id);
      const { message, userId } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const comment = await storage.createChangeRequestComment({
        changeRequestId,
        userId: userId || 'current_user',
        message
      });
      
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Register bulk import routes
  app.use("/api/bulk", bulkRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api", formRoutes);
  app.use("/api/change-requests", createChangeRequestsRouter(storage));

  // IHM (Inventory of Hazardous Materials) Routes
  // Only active when FEATURE_IHM is enabled
  
  // Get IHM item for a component
  app.get("/api/ihm/component/:componentId", async (req, res) => {
    try {
      const item = await storage.getIhmItem(req.params.componentId, 'component');
      res.json(item || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IHM item" });
    }
  });

  // Get IHM item for a spare
  app.get("/api/ihm/spare/:spareId", async (req, res) => {
    try {
      const item = await storage.getIhmItem(req.params.spareId, 'spare');
      res.json(item || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IHM item" });
    }
  });

  // Create or update IHM item
  app.post("/api/ihm", async (req, res) => {
    try {
      const item = await storage.upsertIhmItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to save IHM item" });
    }
  });

  // Get IHM maintenance log
  app.get("/api/ihm/maintenance-log", async (req, res) => {
    try {
      const { vesselId = 'V001', from, to, action, component, spare } = req.query;
      const log = await storage.getIhmMaintenanceLog({
        vesselId: vesselId as string,
        from: from as string,
        to: to as string,
        action: action as string,
        component: component as string,
        spare: spare as string,
      });
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IHM maintenance log" });
    }
  });

  // Create IHM maintenance log entry
  app.post("/api/ihm/maintenance-log", async (req, res) => {
    try {
      const entry = await storage.createIhmMaintenanceLogEntry(req.body);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to create IHM log entry" });
    }
  });

  // Get IHM status report by component
  app.get("/api/ihm/status-report", async (req, res) => {
    try {
      const { vesselId = 'V001' } = req.query;
      const report = await storage.getIhmStatusReport(vesselId as string);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IHM status report" });
    }
  });

  // Report generation endpoints
  app.post('/api/reports/generate', async (req, res) => {
    try {
      const { reportId, format, data, template } = req.body;
      
      // Validate input
      if (!reportId || !format || !data) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!['PDF', 'Excel', 'CSV'].includes(format)) {
        return res.status(400).json({ error: 'Invalid format' });
      }

      // For now, we'll generate mock reports
      // In a real implementation, this would use a proper report generation library
      const mockReportContent = generateMockReport(reportId, format, data, template);
      
      // Set appropriate headers for file download
      const formatMetadata = getFormatMetadata(format);
      const filename = `${reportId}_${new Date().toISOString().split('T')[0]}.${formatMetadata.extension}`;
      
      res.setHeader('Content-Type', formatMetadata.mimeType);
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(mockReportContent);
      
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Format metadata mapping function
function getFormatMetadata(format: string): { extension: string; mimeType: string } {
  const formatMap: Record<string, { extension: string; mimeType: string }> = {
    'PDF': { extension: 'pdf', mimeType: 'application/pdf' },
    'Excel': { extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    'CSV': { extension: 'csv', mimeType: 'text/csv' }
  };
  return formatMap[format] || { extension: format.toLowerCase(), mimeType: 'application/octet-stream' };
}

// Mock report generation function
function generateMockReport(reportId: string, format: string, data: any, template?: any): Buffer {
  const reportContent = `
MARITIME PMS REPORT
==================

Report ID: ${reportId}
Format: ${format}
Generated: ${new Date().toLocaleString()}
Vessel: ${data.vessel || 'Unknown'}
Category: ${data.category || 'Unknown'}

${data.title || 'Report Title'}
${'-'.repeat((data.title || 'Report Title').length)}

Total Records: ${data.metadata?.totalRecords || 0}

Sample Data:
${JSON.stringify(data.data?.slice(0, 5) || [], null, 2)}

--- END OF REPORT ---
`;

  // For PDF and Excel, we'd normally use proper libraries
  // For this demo, we'll return the content as a buffer
  return Buffer.from(reportContent, 'utf-8');
}
