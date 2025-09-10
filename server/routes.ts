import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRunningHoursAuditSchema } from "@shared/schema";
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
  
  // Work Orders API routes (for Target Picker and Dashboard)
  app.get("/api/work-orders", async (req, res) => {
    try {
      // Sample work order data for dashboard
      const today = new Date();
      const workOrders = [
        {
          id: 1,
          workOrderNo: "WO-2025-001",
          title: "Main Engine Overhaul",
          componentName: "Main Engine",
          dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: "In Progress",
          assignedTo: "current-user",
          department: "Engine",
          maintenanceType: "Calendar",
          category: "Engine Room"
        },
        {
          id: 2,
          workOrderNo: "WO-2025-002",
          title: "Generator #1 Inspection",
          componentName: "Generator #1",
          dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: "Pending",
          assignedTo: "current-user",
          department: "Electrical",
          maintenanceType: "Running Hours",
          currentRunningHours: 9800,
          runningHoursThreshold: 10000,
          category: "Electrical"
        },
        {
          id: 3,
          workOrderNo: "WO-2025-003",
          title: "Lifeboat Davit Maintenance",
          componentName: "Lifeboat Davit",
          dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: "Pending",
          department: "Deck",
          maintenanceType: "Calendar",
          category: "Deck Equipment"
        },
        {
          id: 4,
          workOrderNo: "WO-2025-004",
          title: "Fire Pump Test",
          componentName: "Fire Pump",
          dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "Pending",
          department: "Engine",
          maintenanceType: "Calendar",
          category: "Safety Equipment"
        },
        {
          id: 5,
          workOrderNo: "WO-2025-005",
          title: "Navigation Lights Check",
          componentName: "Navigation Lights",
          dueDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          status: "Pending",
          department: "Electrical",
          maintenanceType: "Calendar",
          category: "Navigation Equipment"
        }
      ];
      res.json(workOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work orders" });
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

  // Dashboard API Routes (Read-only aggregations)
  
  // Get dashboard KPIs
  app.get("/api/dashboard/kpis", async (req, res) => {
    try {
      const { vesselId = 'V001', from, to } = req.query;
      
      // Since we don't have all modules fully implemented, return sample data
      // In production, these would aggregate from actual tables
      const kpis = {
        overdueWorkOrders: 5,
        dueNext7Days: 12,
        runningHoursDueSoon: 3,
        criticalSparesBelowMin: 2,
        certificatesExpiring30Days: 4,
        pendingChangeRequests: 7,
        ihmUnknownItems: 15
      };
      
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard KPIs" });
    }
  });
  
  // Get certificates (placeholder for dashboard)
  app.get("/api/certificates", async (req, res) => {
    try {
      // Sample certificate data for dashboard
      const certificates = [
        {
          id: 1,
          name: "Safety Management Certificate",
          type: "Class",
          expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 2,
          name: "International Load Line Certificate",
          type: "Statutory",
          expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 3,
          name: "MARPOL Certificate",
          type: "Statutory",
          expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 4,
          name: "Cargo Ship Safety Equipment Certificate",
          type: "Class",
          expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }
      ];
      
      res.json(certificates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
