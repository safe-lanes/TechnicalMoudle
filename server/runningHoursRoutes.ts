import type { Express } from "express";
import { storage } from "./storage";

export function registerRunningHoursRoutes(app: Express) {
  // Get parent components whose children have running-hour based jobs
  app.get("/api/running-hours/parents", async (req, res) => {
    try {
      const vesselId = (req.query.vesselId as string) || 'V001';
      
      // Get all jobs and filter to RH jobs for this vessel
      const allJobs = await storage.getJobs();
      const rhJobs = allJobs.filter(
        job => job.maintenanceBasis === "Running Hours" && job.vesselId === vesselId
      );
      
      // Get all components for the vessel
      const allComponents = await storage.getComponents(vesselId);
      
      // Extract componentIds from RH jobs (the children with RH jobs)
      const childComponentIds = new Set<string>();
      rhJobs.forEach(job => {
        if (job.componentId) {
          childComponentIds.add(job.componentId);
        }
      });

      // For each child, get its parentId
      const parentIds = new Set<string>();
      childComponentIds.forEach(childId => {
        const child = allComponents.find(c => c.id === childId);
        if (child && child.parentId) {
          parentIds.add(child.parentId);
        }
      });

      // For each parentId: get parent component and count children with RH jobs
      const parents: any[] = [];
      
      for (const parentId of Array.from(parentIds)) {
        // parentId contains componentCode, not database ID
        const parent = allComponents.find(c => c.componentCode === parentId);
        // Only include if parent exists (show immediate parents regardless of hierarchy)
        if (!parent) continue;

        // Count children with RH jobs
        const children = allComponents.filter(c => c.parentId === parentId);
        const childrenWithRHJobs = children.filter(child =>
          rhJobs.some(job => job.componentId === child.id)
        );

        parents.push({
          ...parent,
          sfiCode: parent.componentCode || '', // Use componentCode as SFI Code
          childCount: childrenWithRHJobs.length,
          latestUpdate: parent.lastUpdated || parent.updatedAt || new Date().toISOString()
        });
      }
      
      res.json(parents);
    } catch (error: any) {
      console.error("Error fetching running hour parents:", error);
      res.status(500).json({ 
        error: "Failed to fetch running hour parents"
      });
    }
  });
  
  // Get children RH values for a parent component (read-only popup)
  // Shows all children with their individual RH values - maintained independently via delta propagation
  app.get("/api/running-hours/children/:parentCode", async (req, res) => {
    try {
      const { parentCode } = req.params;
      const vesselId = (req.query.vesselId as string) || 'V001';
      
      // Get all components for the vessel
      const allComponents = await storage.getComponents(vesselId);
      
      // Find the parent component
      const parent = allComponents.find(c => c.componentCode === parentCode);
      if (!parent) {
        return res.status(404).json({ error: "Parent component not found" });
      }
      
      // Get all children of this parent (parentId contains component code)
      const children = allComponents.filter(c => c.parentId === parentCode);
      
      // Format response with RH data for each child
      const childrenWithRH = children.map(child => ({
        id: child.id,
        componentCode: child.componentCode || '',
        name: child.name || '',
        currentCumulativeRH: child.currentCumulativeRH || '0.00',
        lastUpdated: child.lastUpdated || child.updatedAt || '-'
      }));
      
      // Sort by component code
      childrenWithRH.sort((a, b) => a.componentCode.localeCompare(b.componentCode));
      
      res.json({
        parent: {
          componentCode: parent.componentCode,
          name: parent.name,
          currentCumulativeRH: parent.currentCumulativeRH || '0.00'
        },
        children: childrenWithRH
      });
    } catch (error: any) {
      console.error("Error fetching children RH:", error);
      res.status(500).json({ error: "Failed to fetch children running hours" });
    }
  });
  
  // Reset child RH to 0 (component replacement scenario)
  // After reset, child will continue receiving delta propagation from parent
  app.post("/api/running-hours/reset-child/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const { oldMeterFinal, userId, notes } = req.body;
      
      // Get the component
      const component = await storage.getComponent(componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      const previousRH = component.currentCumulativeRH || '0.00';
      
      // Update component RH to 0
      await storage.updateComponent(componentId, {
        currentCumulativeRH: '0.00',
        runningHours: '0.00',
        lastUpdated: new Date().toISOString()
      }, userId || 'system');
      
      // Create audit entry for the reset
      await storage.createRunningHoursAudit({
        vesselId: component.vesselId || '',
        componentId: componentId,
        previousRH: previousRH,
        newRH: '0.00',
        cumulativeRH: '0.00',
        dateUpdatedLocal: new Date().toISOString().split('T')[0],
        dateUpdatedTZ: 'UTC',
        enteredAtUTC: new Date(),
        userId: userId || 'system',
        source: 'reset',
        notes: notes || 'Component replaced - RH reset to 0',
        meterReplaced: true,
        oldMeterFinal: oldMeterFinal || previousRH,
        newMeterStart: '0.00',
        version: 1
      });
      
      res.json({
        success: true,
        message: `Running hours reset to 0 for ${component.name}. Future parent deltas will be applied.`,
        previousRH,
        newRH: '0.00'
      });
    } catch (error: any) {
      console.error("Error resetting child RH:", error);
      res.status(500).json({ error: "Failed to reset child running hours" });
    }
  });
}
