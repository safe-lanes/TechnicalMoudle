import { Request, Response } from 'express';
import * as service from './service';

export async function getRanks(req: Request, res: Response) {
  try {
    const ranks = await service.getAllRanks();
    res.json(ranks);
  } catch (error: any) {
    if (error.statusCode === 503) return res.status(503).json({ error: "Database not available" });
    console.error("Error fetching ranks:", error);
    res.status(500).json({ error: "Failed to fetch ranks" });
  }
}

export async function getRankById(req: Request, res: Response) {
  try {
    const rank = await service.getRankByRankId(req.params.rankId);
    res.json(rank);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error fetching rank:", error);
    res.status(500).json({ error: "Failed to fetch rank" });
  }
}

export async function saveRanks(req: Request, res: Response) {
  try {
    const { ranks } = req.body;
    if (!Array.isArray(ranks)) return res.status(400).json({ error: "ranks array required" });
    const result = await service.saveRanks(ranks);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error saving ranks:", error);
    res.status(500).json({ error: "Failed to save ranks", details: error.message });
  }
}

export async function updateRank(req: Request, res: Response) {
  try {
    const result = await service.updateRank(req.params.rankId, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error updating rank:", error);
    res.status(500).json({ error: "Failed to update rank" });
  }
}

export async function deleteRank(req: Request, res: Response) {
  try {
    const result = await service.deleteRank(req.params.rankId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error deleting rank:", error);
    res.status(500).json({ error: "Failed to delete rank" });
  }
}

export async function getOrgChart(req: Request, res: Response) {
  try {
    const chart = await service.getAllOrgChart();
    res.json(chart);
  } catch (error: any) {
    if (error.statusCode === 503) return res.status(503).json({ error: "Database not available" });
    console.error("Error fetching org chart:", error);
    res.status(500).json({ error: "Failed to fetch org chart" });
  }
}

export async function getOrgChartById(req: Request, res: Response) {
  try {
    const entry = await service.getOrgChartById(parseInt(req.params.id, 10));
    res.json(entry);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error fetching org chart entry:", error);
    res.status(500).json({ error: "Failed to fetch org chart entry" });
  }
}

export async function saveOrgChart(req: Request, res: Response) {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: "entries array required" });
    const result = await service.saveOrgChart(entries);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error saving org chart:", error);
    res.status(500).json({ error: "Failed to save org chart", details: error.message });
  }
}

export async function updateOrgChartEntry(req: Request, res: Response) {
  try {
    const result = await service.updateOrgChartEntry(parseInt(req.params.id, 10), req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error updating org chart entry:", error);
    res.status(500).json({ error: "Failed to update org chart entry" });
  }
}

export async function deleteOrgChartEntry(req: Request, res: Response) {
  try {
    const result = await service.deleteOrgChartEntry(parseInt(req.params.id, 10));
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error deleting org chart entry:", error);
    res.status(500).json({ error: "Failed to delete org chart entry" });
  }
}

export async function getVesselOrgChartNodes(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    const nodes = await service.getVesselOrgChartNodes(vesselId);
    res.json(nodes);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error fetching vessel org chart nodes:", error);
    res.status(500).json({ error: "Failed to fetch vessel org chart nodes" });
  }
}

export async function createVesselOrgChartNode(req: Request, res: Response) {
  try {
    const { vesselId, rankId, nodeLabel } = req.body;
    if (!vesselId || !rankId) return res.status(400).json({ error: "vesselId and rankId required" });
    const node = await service.createVesselOrgChartNode(vesselId, rankId, nodeLabel);
    res.json(node);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error creating vessel org chart node:", error);
    res.status(500).json({ error: "Failed to create vessel org chart node" });
  }
}

export async function bulkSaveVesselOrgChartNodes(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { nodes } = req.body;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    if (!Array.isArray(nodes)) return res.status(400).json({ error: "nodes array required" });
    const result = await service.bulkSaveVesselOrgChartNodes(vesselId, nodes);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error saving vessel org chart nodes:", error);
    res.status(500).json({ error: "Failed to save vessel org chart nodes", details: error.message });
  }
}

export async function unassignVesselOrgChartNode(req: Request, res: Response) {
  try {
    const { vesselId, nodeUuid } = req.params;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    if (!nodeUuid) return res.status(400).json({ error: "nodeUuid required" });
    const result = await service.unassignVesselOrgChartNode(vesselId, nodeUuid);
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error & { statusCode?: number };
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("Error unassigning vessel org chart node:", error);
    res.status(500).json({ error: "Failed to unassign node" });
  }
}

export async function deleteVesselOrgChartNode(req: Request, res: Response) {
  try {
    const { vesselId, nodeUuid } = req.params;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    if (!nodeUuid) return res.status(400).json({ error: "nodeUuid required" });
    const result = await service.deleteVesselOrgChartNode(vesselId, nodeUuid);
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error & { statusCode?: number };
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("Error deleting vessel org chart node:", error);
    res.status(500).json({ error: "Failed to delete node" });
  }
}

export async function getVesselDepartmentConfig(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    const configs = await service.getVesselDepartmentConfig(vesselId);
    res.json(configs);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error fetching vessel department config:", error);
    res.status(500).json({ error: "Failed to fetch vessel department config" });
  }
}

export async function saveVesselDepartmentConfig(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { configs } = req.body;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    if (!Array.isArray(configs)) return res.status(400).json({ error: "configs array required" });
    const result = await service.saveVesselDepartmentConfig(vesselId, configs);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error saving vessel department config:", error);
    res.status(500).json({ error: "Failed to save vessel department config" });
  }
}

export async function getActiveRoles(req: Request, res: Response) {
  try {
    const roles = await service.getActiveRoles();
    res.json(roles);
  } catch (error: any) {
    if (error.statusCode === 503) return res.status(503).json({ error: "Database not available" });
    console.error("Error fetching active roles:", error);
    res.status(500).json({ error: "Failed to fetch active roles" });
  }
}

export async function getNodesByRoleRuid(req: Request, res: Response) {
  try {
    const { vesselId, roleRuid } = req.params;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    if (!roleRuid) return res.status(400).json({ error: "roleRuid required" });
    const nodes = await service.getNodesByRoleRuid(vesselId, roleRuid);
    res.json(nodes);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error fetching nodes by role ruid:", error);
    res.status(500).json({ error: "Failed to fetch nodes by role ruid" });
  }
}

export async function getHierarchyScope(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const userRankId = user.rankId as string | undefined;
    if (!vesselId) return res.status(400).json({ error: "vesselId required" });
    if (!userRankId) {
      return res.json({
        vesselId,
        hasMapping: false,
        hasDescendants: false,
        me: { nodeUuids: [], rankIds: [] },
        myTeam: { nodeUuids: [], rankIds: [] },
      });
    }
    const result = await service.resolveHierarchyScopeByRankId(vesselId, userRankId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error resolving hierarchy scope:", error);
    res.status(500).json({ error: "Failed to resolve hierarchy scope" });
  }
}

