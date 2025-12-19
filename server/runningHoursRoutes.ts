import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";

// Zod schemas for RH configuration API validation
const updateRHConfigSchema = z.object({
  rhCounterType: z.enum(['MASTER', 'INHERITED', 'NOT_RH_DRIVEN']),
  rhMasterComponentId: z.string().nullable().optional(),
  userId: z.string().optional()
});

const updateMasterRHSchema = z.object({
  newRHValue: z.number().nonnegative("Running hours must be non-negative"),
  updateSource: z.enum(['MANUAL', 'IMPORT', 'AUTOMATION']).optional().default('MANUAL'),
  userId: z.string().optional().default('system'),
  comments: z.string().optional()
});

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

  // ============= B7.B RH COUNTER TYPE CONFIGURATION ROUTES =============

  // Get all MASTER components for a vessel (for RH source selection dropdown)
  app.get("/api/rh-config/master-components/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const masterComponents = await storage.getMasterComponents(vesselId);
      
      res.json(masterComponents.map(c => ({
        id: c.id,
        componentCode: c.componentCode,
        name: c.name,
        rhCurrentMaster: c.rhCurrentMaster || '0',
        rhMasterUpdatedAt: c.rhMasterUpdatedAt
      })));
    } catch (error: any) {
      console.error("Error fetching master components:", error);
      res.status(500).json({ error: "Failed to fetch master components" });
    }
  });

  // Get RH configuration for a specific component
  app.get("/api/rh-config/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      const component = await storage.getComponent(componentId);
      
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }

      // Get master component name if INHERITED
      let rhMasterComponentName: string | null = null;
      if (component.rhCounterType === 'INHERITED' && component.rhMasterComponentId) {
        const masterComponent = await storage.getComponent(component.rhMasterComponentId);
        rhMasterComponentName = masterComponent?.name || null;
      }

      // Determine current RH value based on counter type
      let rhCurrentValue: string | null = null;
      let rhLastUpdated: Date | null = null;
      
      if (component.rhCounterType === 'MASTER') {
        rhCurrentValue = component.rhCurrentMaster;
        rhLastUpdated = component.rhMasterUpdatedAt;
      } else if (component.rhCounterType === 'INHERITED') {
        rhCurrentValue = component.rhCurrentInheritedCached;
        rhLastUpdated = component.rhInheritedUpdatedAt;
      }

      res.json({
        componentId: component.id,
        componentName: component.name,
        rhCounterType: component.rhCounterType,
        rhMasterComponentId: component.rhMasterComponentId,
        rhMasterComponentName,
        rhCurrentValue,
        rhLastUpdated,
        rhUpdateSource: component.rhMasterUpdateSource
      });
    } catch (error: any) {
      console.error("Error fetching RH config:", error);
      res.status(500).json({ error: "Failed to fetch RH configuration" });
    }
  });

  // Update RH counter type configuration for a component
  app.put("/api/rh-config/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      
      // Validate request body with Zod
      const parseResult = updateRHConfigSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body",
          details: parseResult.error.format()
        });
      }
      
      const { rhCounterType, rhMasterComponentId, userId } = parseResult.data;

      // Get the current component to validate
      const component = await storage.getComponent(componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }

      // Safety check: Prevent self-referential master link
      if (rhCounterType === 'INHERITED' && rhMasterComponentId === componentId) {
        return res.status(400).json({ 
          error: "A component cannot inherit running hours from itself" 
        });
      }

      // Validate rhMasterComponentId for INHERITED type
      if (rhCounterType === 'INHERITED') {
        if (!rhMasterComponentId) {
          return res.status(400).json({ 
            error: "rhMasterComponentId is required for INHERITED counter type" 
          });
        }
        
        // Safety check: Verify master component exists and is in same vessel
        const masterComponent = await storage.getComponent(rhMasterComponentId);
        if (!masterComponent) {
          return res.status(400).json({ 
            error: "Master component not found" 
          });
        }
        
        if (masterComponent.vesselId !== component.vesselId) {
          return res.status(400).json({ 
            error: "Master component must be from the same vessel" 
          });
        }
        
        if (masterComponent.rhCounterType !== 'MASTER') {
          return res.status(400).json({ 
            error: "Selected component is not configured as a MASTER counter type" 
          });
        }
      }

      // Downgrade protection: Prevent MASTER → NONE/INHERITED if component has dependents
      if (component.rhCounterType === 'MASTER' && rhCounterType !== 'MASTER') {
        const dependents = await storage.getInheritedComponents(componentId);
        if (dependents.length > 0) {
          const dependentNames = dependents.slice(0, 3).map(d => d.name).join(', ');
          const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
          return res.status(400).json({ 
            error: `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
          });
        }
      }

      const updatedComponent = await storage.updateRHConfig({
        componentId,
        rhCounterType,
        rhMasterComponentId: rhCounterType === 'INHERITED' ? rhMasterComponentId : null,
        userId
      });

      res.json({
        success: true,
        message: `RH counter type updated to ${rhCounterType}`,
        component: updatedComponent
      });
    } catch (error: any) {
      console.error("Error updating RH config:", error);
      res.status(500).json({ error: error.message || "Failed to update RH configuration" });
    }
  });

  // Update MASTER running hours with cascade to INHERITED components
  app.put("/api/rh-config/master/:componentId", async (req, res) => {
    try {
      const { componentId } = req.params;
      
      // Validate request body with Zod
      const parseResult = updateMasterRHSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body",
          details: parseResult.error.format()
        });
      }
      
      const { newRHValue, updateSource, userId, comments } = parseResult.data;

      // Verify component exists and is a MASTER type
      const component = await storage.getComponent(componentId);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      
      if (component.rhCounterType !== 'MASTER') {
        return res.status(400).json({ 
          error: "Running hours can only be updated for MASTER counter type components" 
        });
      }

      const result = await storage.updateMasterRunningHours({
        componentId,
        newRHValue,
        updateSource,
        userId,
        comments
      });

      res.json({
        success: true,
        message: `Master RH updated to ${newRHValue}. Cascaded to ${result.inheritedUpdated} inherited components.`,
        masterUpdated: result.masterUpdated,
        inheritedUpdated: result.inheritedUpdated
      });
    } catch (error: any) {
      console.error("Error updating master RH:", error);
      res.status(500).json({ error: error.message || "Failed to update master running hours" });
    }
  });

  // Get all INHERITED components linked to a MASTER
  app.get("/api/rh-config/inherited/:masterComponentId", async (req, res) => {
    try {
      const { masterComponentId } = req.params;
      const inheritedComponents = await storage.getInheritedComponents(masterComponentId);
      
      res.json(inheritedComponents.map(c => ({
        id: c.id,
        componentCode: c.componentCode,
        name: c.name,
        rhCurrentInheritedCached: c.rhCurrentInheritedCached || '0',
        rhInheritedUpdatedAt: c.rhInheritedUpdatedAt
      })));
    } catch (error: any) {
      console.error("Error fetching inherited components:", error);
      res.status(500).json({ error: "Failed to fetch inherited components" });
    }
  });
}
