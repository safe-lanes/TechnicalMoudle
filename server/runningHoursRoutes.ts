import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { jobDueScanner } from "./services/jobDueScanner";

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
  // Get all components with rhCounterType = 'MASTER' for the Running Hours module
  app.get("/api/running-hours/parents", async (req, res) => {
    try {
      const vesselId = (req.query.vesselId as string) || 'V001';
      
      // Get all components for the vessel
      const allComponents = await storage.getComponents(vesselId);
      
      // Filter to only show components with rhCounterType = 'MASTER'
      const masterComponents = allComponents.filter(
        component => component.rhCounterType === 'MASTER'
      );

      // Format response with RH data
      const parents = masterComponents.map(component => ({
        ...component,
        sfiCode: component.componentCode || '',
        latestUpdate: component.rhMasterUpdatedAt || component.lastUpdated || component.updatedAt || new Date().toISOString(),
        currentCumulativeRH: component.rhCurrentMaster || component.currentCumulativeRH || '0.00'
      }));
      
      // Sort by component code for consistent ordering
      parents.sort((a, b) => (a.componentCode || '').localeCompare(b.componentCode || ''));
      
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

      // Get master component details if INHERITED
      let rhMasterComponentName: string | null = null;
      let masterComponent: Awaited<ReturnType<typeof storage.getComponent>> = undefined;
      if (component.rhCounterType === 'INHERITED' && component.rhMasterComponentId) {
        masterComponent = await storage.getComponent(component.rhMasterComponentId);
        rhMasterComponentName = masterComponent?.name || null;
      }

      // Determine current RH value based on counter type
      let rhCurrentValue: string | null = null;
      let rhLastUpdated: Date | null = null;
      
      if (component.rhCounterType === 'MASTER') {
        // MASTER: Bind Running Hours from the component's own rhCurrentMaster
        rhCurrentValue = component.rhCurrentMaster;
        rhLastUpdated = component.rhMasterUpdatedAt;
      } else if (component.rhCounterType === 'INHERITED') {
        // INHERITED: Bind Running Hours LIVE from the master component referenced by rhMasterComponentId
        // This ensures inherited components always show the current value from their master source
        if (masterComponent) {
          rhCurrentValue = masterComponent.rhCurrentMaster;
          rhLastUpdated = masterComponent.rhMasterUpdatedAt;
        } else {
          // Fallback to cached value if master component not found (shouldn't happen in normal operation)
          rhCurrentValue = component.rhCurrentInheritedCached;
          rhLastUpdated = component.rhInheritedUpdatedAt;
        }
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

      // TRIGGER 1 HOOK: After MASTER RH is updated, scan for RH-based WO generation
      // This ensures WOs are generated in real-time when RH thresholds are reached
      let woGenerationResult = { rhJobsChecked: 0, rhWOsGenerated: 0 };
      try {
        // Get the component's vesselId to scope the scan
        if (component.vesselId) {
          // Run a scan for RH-based jobs (this will check all jobs for the vessel)
          const scanResult = await jobDueScanner.runScan();
          woGenerationResult = {
            rhJobsChecked: scanResult.rhJobsChecked,
            rhWOsGenerated: scanResult.rhWOsGenerated
          };
          
          if (scanResult.rhWOsGenerated > 0) {
            console.log(`✅ [RH Update Trigger] Generated ${scanResult.rhWOsGenerated} WO(s) after MASTER RH update on ${component.name}`);
          }
        }
      } catch (scanError) {
        // Don't fail the RH update if WO generation fails - just log the error
        console.error('[RH Update Trigger] WO generation scan failed:', scanError);
      }

      res.json({
        success: true,
        message: `Master RH updated to ${newRHValue}. Cascaded to ${result.inheritedUpdated} inherited components.`,
        masterUpdated: result.masterUpdated,
        inheritedUpdated: result.inheritedUpdated,
        woGeneration: woGenerationResult
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
