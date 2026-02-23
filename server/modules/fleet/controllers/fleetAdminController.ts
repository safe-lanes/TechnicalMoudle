import { Request, Response } from 'express';
import { z } from 'zod';
import * as adminService from '../services/fleetAdminService';

// ══════════════════════════════════════════════════════════
// Master Data CRUD
// ══════════════════════════════════════════════════════════

export async function getMasterDataList(req: Request, res: Response) {
  try {
    const result = await adminService.getMasterDataList(req.query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching master data:', error);
    res.status(500).json({ error: 'Failed to fetch master data' });
  }
}

export async function getMasterDataItem(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const entry = await adminService.getMasterDataItem(id);
    res.json(entry);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching master data entry:', error);
    res.status(500).json({ error: 'Failed to fetch master data entry' });
  }
}

export async function getMasterDataByCode(req: Request, res: Response) {
  try {
    const entry = await adminService.getMasterDataByCode(req.params.code);
    res.json(entry);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching master data by code:', error);
    res.status(500).json({ error: 'Failed to fetch master data entry' });
  }
}

export async function createMasterData(req: Request, res: Response) {
  try {
    const newEntry = await adminService.createMasterData(req.body);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating master data:', error);
    res.status(500).json({ error: 'Failed to create master data entry' });
  }
}

export async function updateMasterData(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const updated = await adminService.updateMasterData(id, req.body);
    res.json(updated);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating master data:', error);
    res.status(500).json({ error: 'Failed to update master data entry' });
  }
}

export async function deleteMasterData(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const result = await adminService.deleteMasterData(id);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error deleting master data:', error);
    res.status(500).json({ error: 'Failed to delete master data entry' });
  }
}

export async function generateFleetEquipmentCode(req: Request, res: Response) {
  try {
    const result = await adminService.generateFleetEquipmentCode(req.params.sfiCode);
    res.json(result);
  } catch (error) {
    console.error('Error generating fleet equipment code:', error);
    res.status(500).json({ error: 'Failed to generate fleet equipment code' });
  }
}

// ══════════════════════════════════════════════════════════
// Fleet Components Admin
// ══════════════════════════════════════════════════════════

export async function getFleetComponents(req: Request, res: Response) {
  try {
    const entries = await adminService.getFleetComponents(req.query);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching fleet components:', error);
    res.status(500).json({ error: 'Failed to fetch fleet components' });
  }
}

export async function exportFleetComponents(req: Request, res: Response) {
  try {
    const result = await adminService.exportFleetComponents();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error: any) {
    console.error('Error exporting fleet components:', error);
    res.status(500).json({ error: 'Failed to export fleet components' });
  }
}

export async function getFleetComponentById(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const entry = await adminService.getFleetComponentById(id);
    res.json(entry);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching fleet component:', error);
    res.status(500).json({ error: 'Failed to fetch fleet component' });
  }
}

export async function getFleetComponentByCode(req: Request, res: Response) {
  try {
    const entry = await adminService.getFleetComponentByCode(req.params.code);
    res.json(entry);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching fleet component by code:', error);
    res.status(500).json({ error: 'Failed to fetch fleet component' });
  }
}

export async function createFleetComponent(req: Request, res: Response) {
  try {
    const newComponent = await adminService.createFleetComponent(req.body);
    res.status(201).json(newComponent);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error creating fleet component:', error);
    res.status(500).json({ error: 'Failed to create fleet component' });
  }
}

export async function updateFleetComponent(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const updated = await adminService.updateFleetComponent(id, req.body);
    res.json(updated);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating fleet component:', error);
    res.status(500).json({ error: 'Failed to update fleet component' });
  }
}

export async function deleteFleetComponent(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const result = await adminService.deleteFleetComponent(id);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error deleting fleet component:', error);
    res.status(500).json({ error: 'Failed to delete fleet component' });
  }
}

// ══════════════════════════════════════════════════════════
// Fleet-Vessel Mapping (Admin)
// ══════════════════════════════════════════════════════════

export async function getFleetVesselMappings(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetVesselMappings(req.query);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-vessel mappings' });
  }
}

export async function getFleetVesselMappingsByEquipment(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetVesselMappingsByEquipment(req.params.code);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching mappings by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function getFleetVesselMappingsByVessel(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetVesselMappingsByVessel(req.params.vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function createFleetVesselMapping(req: Request, res: Response) {
  try {
    const newMapping = await adminService.createFleetVesselMapping(req.body);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}

export async function deleteFleetVesselMapping(req: Request, res: Response) {
  try {
    const result = await adminService.deleteFleetVesselMapping(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting fleet-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

// ══════════════════════════════════════════════════════════
// Component-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getComponentVesselMappings(req: Request, res: Response) {
  try {
    const mappings = await adminService.getComponentVesselMappings();
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching component-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch component-vessel mappings' });
  }
}

export async function createComponentVesselMapping(req: Request, res: Response) {
  try {
    const newMapping = await adminService.createComponentVesselMapping(req.body);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating component-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create component-vessel mapping' });
  }
}

export async function deleteComponentVesselMapping(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const result = await adminService.deleteComponentVesselMapping(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting component-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete component-vessel mapping' });
  }
}

// ══════════════════════════════════════════════════════════
// Fleet-Component Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetComponentMappings(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetComponentMappings(req.query);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-component mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-component mappings' });
  }
}

export async function getFleetComponentMappingsByEquipment(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetComponentMappingsByEquipment(req.params.code);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching component mappings by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function getFleetComponentMappingsByVessel(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetComponentMappingsByVessel(req.params.vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching component mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function createFleetComponentMapping(req: Request, res: Response) {
  try {
    const newMapping = await adminService.createFleetComponentMapping(req.body);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-component mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}

export async function deleteFleetComponentMapping(req: Request, res: Response) {
  try {
    const result = await adminService.deleteFleetComponentMapping(req.query);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error deleting fleet-component mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

// ══════════════════════════════════════════════════════════
// Fleet-Job-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetJobMappings(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetJobMappings(req.query);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-job-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-job-vessel mappings' });
  }
}

export async function getFleetJobMappingsByJob(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetJobMappingsByJob(req.params.jobCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching job mappings by job code:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function getFleetJobMappingsByVessel(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetJobMappingsByVessel(req.params.vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching job mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function createFleetJobMapping(req: Request, res: Response) {
  try {
    const newMapping = await adminService.createFleetJobMapping(req.body);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-job-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}

export async function deleteFleetJobMapping(req: Request, res: Response) {
  try {
    const result = await adminService.deleteFleetJobMapping(req.query);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error deleting fleet-job-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

// ══════════════════════════════════════════════════════════
// Fleet-Spare-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetSpareMappings(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetSpareMappings(req.query);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-spare-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-spare-vessel mappings' });
  }
}

export async function getFleetSpareMappingsBySpare(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetSpareMappingsBySpare(req.params.partCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching spare mappings by part code:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function getFleetSpareMappingsByVessel(req: Request, res: Response) {
  try {
    const mappings = await adminService.getFleetSpareMappingsByVessel(req.params.vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching spare mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
}

export async function createFleetSpareMapping(req: Request, res: Response) {
  try {
    const newMapping = await adminService.createFleetSpareMapping(req.body);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-spare-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}

export async function deleteFleetSpareMapping(req: Request, res: Response) {
  try {
    const result = await adminService.deleteFleetSpareMapping(req.query);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error deleting fleet-spare-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

// ══════════════════════════════════════════════════════════
// Bulk Import History & Errors
// ══════════════════════════════════════════════════════════

export async function getImportHistory(req: Request, res: Response) {
  try {
    const result = await adminService.getImportHistory(req.query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
}

export async function getImportHistoryItem(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const entry = await adminService.getImportHistoryItem(id);
    res.json(entry);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching import history entry:', error);
    res.status(500).json({ error: 'Failed to fetch import history entry' });
  }
}

export async function getImportErrors(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const errors = await adminService.getImportErrors(id);
    res.json(errors);
  } catch (error) {
    console.error('Error fetching import errors:', error);
    res.status(500).json({ error: 'Failed to fetch import errors' });
  }
}

export async function createImportHistory(req: Request, res: Response) {
  try {
    const newEntry = await adminService.createImportHistory(req.body);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating import history:', error);
    res.status(500).json({ error: 'Failed to create import history entry' });
  }
}

export async function updateImportHistory(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const updated = await adminService.updateImportHistory(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating import history:', error);
    res.status(500).json({ error: 'Failed to update import history entry' });
  }
}

export async function createImportErrors(req: Request, res: Response) {
  try {
    const result = await adminService.createImportErrors(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating import errors:', error);
    res.status(500).json({ error: 'Failed to create import errors' });
  }
}

// ══════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════

export async function getDashboardMetrics(req: Request, res: Response) {
  try {
    const metrics = await adminService.getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
}

// ══════════════════════════════════════════════════════════
// Copy Vessel
// ══════════════════════════════════════════════════════════

export async function copyVessel(req: Request, res: Response) {
  try {
    const result = await adminService.copyVessel(req.body);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error copying vessel data:', error);
    res.status(500).json({ error: 'Failed to copy vessel data' });
  }
}
