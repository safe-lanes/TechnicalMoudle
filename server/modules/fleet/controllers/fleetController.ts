import { Request, Response } from 'express';
import * as fleetService from '../services/fleetService';

// ══════════════════════════════════════════════════════════
// Fleet-Scoped Components
// ══════════════════════════════════════════════════════════

export async function getFleetScopedComponents(req: Request, res: Response) {
  try {
    const components = await fleetService.getFleetScopedComponents();
    res.json(components);
  } catch (error) {
    console.error("Error fetching fleet components:", error);
    res.status(500).json({ error: "Failed to fetch fleet components" });
  }
}

export async function getFleetScopedComponent(req: Request, res: Response) {
  try {
    const component = await fleetService.getFleetScopedComponent(req.params.id);
    res.json(component);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error fetching fleet component:", error);
    res.status(500).json({ error: "Failed to fetch fleet component" });
  }
}

export async function createFleetScopedComponent(req: Request, res: Response) {
  try {
    const component = await fleetService.createFleetScopedComponent(req.body);
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
}

export async function updateFleetScopedComponent(req: Request, res: Response) {
  try {
    const component = await fleetService.updateFleetScopedComponent(req.params.id, req.body);
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
}

export async function deleteFleetScopedComponent(req: Request, res: Response) {
  try {
    const result = await fleetService.deleteFleetScopedComponent(req.params.id);
    res.json(result);
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
}

export async function updateComponentSortOrder(req: Request, res: Response) {
  try {
    const result = await fleetService.updateComponentSortOrder(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error updating sort order:", error);
    res.status(500).json({ error: "Failed to update sort order" });
  }
}

// ══════════════════════════════════════════════════════════
// Fleet Jobs
// ══════════════════════════════════════════════════════════

export async function exportFleetJobs(req: Request, res: Response) {
  try {
    const { fleetEquipmentCode } = req.query;
    const result = await fleetService.exportFleetJobs(fleetEquipmentCode as string | undefined);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error: any) {
    console.error('Error exporting fleet jobs:', error);
    res.status(500).json({ error: 'Failed to export fleet jobs' });
  }
}

export async function getFleetJobs(req: Request, res: Response) {
  try {
    const jobs = await fleetService.getFleetJobs();
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching fleet jobs:", error);
    res.status(500).json({ error: "Failed to fetch fleet jobs" });
  }
}

export async function getFleetJob(req: Request, res: Response) {
  try {
    const job = await fleetService.getFleetJob(req.params.id);
    res.json(job);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error fetching fleet job:", error);
    res.status(500).json({ error: "Failed to fetch fleet job" });
  }
}

export async function createFleetJob(req: Request, res: Response) {
  try {
    const job = await fleetService.createFleetJob(req.body);
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
}

export async function updateFleetJob(req: Request, res: Response) {
  try {
    const result = await fleetService.updateFleetJob(req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message, details: error.details });
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
}

export async function deleteFleetJob(req: Request, res: Response) {
  try {
    const result = await fleetService.deleteFleetJob(req.params.id);
    res.json(result);
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
}

// ══════════════════════════════════════════════════════════
// Fleet Spares
// ══════════════════════════════════════════════════════════

export async function exportFleetSpares(req: Request, res: Response) {
  try {
    const { fleetEquipmentCode } = req.query;
    const result = await fleetService.exportFleetSpares(fleetEquipmentCode as string | undefined);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error: any) {
    console.error('Error exporting fleet spares:', error);
    res.status(500).json({ error: 'Failed to export fleet spares' });
  }
}

export async function getFleetSpares(req: Request, res: Response) {
  try {
    const spares = await fleetService.getFleetSpares();
    res.json(spares);
  } catch (error) {
    console.error("Error fetching fleet spares:", error);
    res.status(500).json({ error: "Failed to fetch fleet spares" });
  }
}

export async function getFleetSpare(req: Request, res: Response) {
  try {
    const spare = await fleetService.getFleetSpare(parseInt(req.params.id));
    res.json(spare);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error fetching fleet spare:", error);
    res.status(500).json({ error: "Failed to fetch fleet spare" });
  }
}

export async function createFleetSpare(req: Request, res: Response) {
  try {
    const spare = await fleetService.createFleetSpare(req.body);
    res.status(201).json(spare);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid spare data", details: error.errors });
    }
    console.error("Error creating fleet spare:", error);
    res.status(500).json({ error: error.message || "Failed to create fleet spare" });
  }
}

export async function updateFleetSpare(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    console.log(`[FleetSpare] PATCH /fleet/spares/${id} — payload keys:`, Object.keys(req.body));
    const spare = await fleetService.updateFleetSpare(id, req.body);
    if (!spare) {
      console.warn(`[FleetSpare] Update returned no result for id=${id}`);
      return res.status(404).json({ error: `Fleet spare with id ${id} not found` });
    }
    console.log(`[FleetSpare] Successfully updated spare id=${id}, partCode=${spare.partCode}`);
    res.json(spare);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      console.error(`[FleetSpare] Zod validation failed:`, error.errors);
      return res.status(400).json({ error: "Invalid spare data", details: error.errors });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error("[FleetSpare] Error updating fleet spare:", error);
    res.status(500).json({ error: "Failed to update fleet spare" });
  }
}

export async function deleteFleetSpare(req: Request, res: Response) {
  try {
    const result = await fleetService.deleteFleetSpare(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error deleting fleet spare:", error);
    res.status(500).json({ error: "Failed to delete fleet spare" });
  }
}

// ══════════════════════════════════════════════════════════
// Makers
// ══════════════════════════════════════════════════════════

export async function getMakers(req: Request, res: Response) {
  try {
    const search = req.query.search as string | undefined;
    const makers = await fleetService.getMakers(search);
    res.json(makers);
  } catch (error) {
    console.error("Error fetching makers:", error);
    res.status(500).json({ error: "Failed to fetch makers" });
  }
}

export async function getMakerById(req: Request, res: Response) {
  try {
    const maker = await fleetService.getMakerById(parseInt(req.params.id));
    res.json(maker);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error fetching maker:", error);
    res.status(500).json({ error: "Failed to fetch maker" });
  }
}

export async function createMaker(req: Request, res: Response) {
  try {
    const maker = await fleetService.createMaker(req.body);
    res.status(201).json(maker);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid maker data", details: error.errors });
    }
    console.error("Error creating maker:", error);
    res.status(500).json({ error: "Failed to create maker" });
  }
}

export async function updateMaker(req: Request, res: Response) {
  try {
    const maker = await fleetService.updateMaker(parseInt(req.params.id), req.body);
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
}

export async function deleteMaker(req: Request, res: Response) {
  try {
    const result = await fleetService.deleteMaker(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error deleting maker:", error);
    res.status(500).json({ error: "Failed to delete maker" });
  }
}

// ══════════════════════════════════════════════════════════
// Master Lists
// ══════════════════════════════════════════════════════════

export async function getMasterLists(req: Request, res: Response) {
  try {
    const listType = req.query.listType as string | undefined;
    const masterLists = await fleetService.getMasterLists(listType);
    res.json(masterLists);
  } catch (error) {
    console.error("Error fetching master lists:", error);
    res.status(500).json({ error: "Failed to fetch master lists" });
  }
}

export async function getMasterListById(req: Request, res: Response) {
  try {
    const masterList = await fleetService.getMasterListById(parseInt(req.params.id));
    res.json(masterList);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error fetching master list:", error);
    res.status(500).json({ error: "Failed to fetch master list" });
  }
}

export async function createMasterList(req: Request, res: Response) {
  try {
    const masterList = await fleetService.createMasterList(req.body);
    res.status(201).json(masterList);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid master list data", details: error.errors });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error creating master list:", error);
    res.status(500).json({ error: "Failed to create master list" });
  }
}

export async function updateMasterList(req: Request, res: Response) {
  try {
    const masterList = await fleetService.updateMasterList(parseInt(req.params.id), req.body);
    res.json(masterList);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid master list data", details: error.errors });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error updating master list:", error);
    res.status(500).json({ error: "Failed to update master list" });
  }
}

export async function deleteMasterList(req: Request, res: Response) {
  try {
    const result = await fleetService.deleteMasterList(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error deleting master list:", error);
    res.status(500).json({ error: "Failed to delete master list" });
  }
}

// ══════════════════════════════════════════════════════════
// Master List Types (DB-backed registry + Section mapping)
// ══════════════════════════════════════════════════════════

export async function getMasterListTypes(req: Request, res: Response) {
  try {
    const section = req.query.section as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';
    const types = await fleetService.getMasterListTypes(section, includeInactive);
    res.json(types);
  } catch (error) {
    console.error("Error fetching master list types:", error);
    res.status(500).json({ error: "Failed to fetch master list types" });
  }
}

export async function getMasterListTypeById(req: Request, res: Response) {
  try {
    const type = await fleetService.getMasterListTypeById(parseInt(req.params.id));
    res.json(type);
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching master list type:", error);
    res.status(500).json({ error: "Failed to fetch master list type" });
  }
}

export async function createMasterListType(req: Request, res: Response) {
  try {
    const userUuid = (req as any).user?.userUuid ?? null;
    const type = await fleetService.createMasterListType(req.body, userUuid);
    res.status(201).json(type);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid master list type data", details: error.errors });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error creating master list type:", error);
    res.status(500).json({ error: "Failed to create master list type" });
  }
}

export async function updateMasterListType(req: Request, res: Response) {
  try {
    const userUuid = (req as any).user?.userUuid ?? null;
    const type = await fleetService.updateMasterListType(parseInt(req.params.id), req.body, userUuid);
    res.json(type);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid master list type data", details: error.errors });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating master list type:", error);
    res.status(500).json({ error: "Failed to update master list type" });
  }
}

export async function deleteMasterListType(req: Request, res: Response) {
  try {
    const userUuid = (req as any).user?.userUuid ?? null;
    const result = await fleetService.deleteMasterListType(parseInt(req.params.id), userUuid);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deleting master list type:", error);
    res.status(500).json({ error: "Failed to delete master list type" });
  }
}

// ══════════════════════════════════════════════════════════
// Fleet Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetVesselMappings(req: Request, res: Response) {
  try {
    const mappings = await fleetService.getFleetVesselMappings();
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching vessel mappings:", error);
    res.status(500).json({ error: "Failed to fetch vessel mappings" });
  }
}

export async function createFleetVesselMappings(req: Request, res: Response) {
  try {
    const mappings = await fleetService.createFleetVesselMappings(req.body);
    res.status(201).json(mappings);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating vessel mappings:", error);
    res.status(500).json({ error: error.message || "Failed to create vessel mappings" });
  }
}

export async function deleteFleetVesselMapping(req: Request, res: Response) {
  try {
    const result = await fleetService.deleteFleetVesselMapping(req.params.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error deleting vessel mapping:", error);
    res.status(500).json({ error: error.message || "Failed to delete vessel mapping" });
  }
}
