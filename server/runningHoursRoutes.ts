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
          childCount: childrenWithRHJobs.length,
          latestUpdate: undefined
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
}
