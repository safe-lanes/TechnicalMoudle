import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { 
  insertMasterDataSchema, 
  insertFleetVesselMappingSchema,
  insertFleetComponentMappingSchema,
  insertFleetJobVesselMappingSchema,
  insertFleetSpareVesselMappingSchema,
  insertBulkImportHistorySchema,
  insertBulkImportErrorSchema
} from '@shared/schema';
import { requireOfficeOrAdmin } from '../middleware/auth';

const router = Router();

// Apply Office/PMS Admin access control to all Fleet Admin routes
// Fleet data is visible only on the office side per PMS Process Flow requirements
router.use(requireOfficeOrAdmin);

// ============================================================
// MASTER DATA CRUD - Fleet Equipment Code Management
// ============================================================

// Get all master data entries with optional filtering
router.get('/master-data', async (req, res) => {
  try {
    const { sfiCode, vesselName, modelCode, limit, offset } = req.query;
    
    let entries = await storage.getMasterDataList();
    
    // Apply filters
    if (sfiCode) {
      entries = entries.filter((e: any) => e.sfiCode === sfiCode);
    }
    if (vesselName) {
      entries = entries.filter((e: any) => e.vesselName === vesselName);
    }
    if (modelCode) {
      entries = entries.filter((e: any) => e.modelCode === modelCode);
    }
    
    // Apply pagination
    const total = entries.length;
    const limitNum = limit ? parseInt(limit as string) : 100;
    const offsetNum = offset ? parseInt(offset as string) : 0;
    entries = entries.slice(offsetNum, offsetNum + limitNum);
    
    res.json({ items: entries, total, limit: limitNum, offset: offsetNum });
  } catch (error) {
    console.error('Error fetching master data:', error);
    res.status(500).json({ error: 'Failed to fetch master data' });
  }
});

// Get single master data entry
router.get('/master-data/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getMasterDataItem(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Master data entry not found' });
    }
    
    res.json(entry);
  } catch (error) {
    console.error('Error fetching master data entry:', error);
    res.status(500).json({ error: 'Failed to fetch master data entry' });
  }
});

// Get master data by Fleet Equipment Code
router.get('/master-data/by-code/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const entry = await storage.getMasterDataByFleetCode(code);
    
    if (!entry) {
      return res.status(404).json({ error: 'Master data entry not found' });
    }
    
    res.json(entry);
  } catch (error) {
    console.error('Error fetching master data by code:', error);
    res.status(500).json({ error: 'Failed to fetch master data entry' });
  }
});

// Schema for creating master data - fleetEquipmentCode is auto-generated
const createMasterDataSchema = insertMasterDataSchema.extend({
  fleetEquipmentCode: z.string().optional()
});

// Create new master data entry with auto-generated Fleet Equipment Code
// Follows the rule: Same Maker + Model = Same Fleet Equipment Code
router.post('/master-data', async (req, res) => {
  try {
    const validatedData = createMasterDataSchema.parse(req.body);
    
    // Check if same Maker+Model combination already exists
    // If so, reuse the existing Fleet Equipment Code
    let fleetEquipmentCode = validatedData.fleetEquipmentCode;
    
    if (!fleetEquipmentCode && validatedData.makerCode && validatedData.model) {
      const existingEntry = await storage.getMasterDataByMakerModel(
        validatedData.makerCode,
        validatedData.model
      );
      
      if (existingEntry) {
        // Reuse existing Fleet Equipment Code for same Maker+Model
        fleetEquipmentCode = existingEntry.fleetEquipmentCode;
        console.log(`Reusing Fleet Equipment Code ${fleetEquipmentCode} for existing Maker+Model: ${validatedData.makerCode}/${validatedData.model}`);
      }
    }
    
    // Generate new Fleet Equipment Code only if not provided and no existing match
    if (!fleetEquipmentCode && validatedData.sfiCode) {
      fleetEquipmentCode = await storage.generateFleetEquipmentCode(validatedData.sfiCode);
      console.log(`Generated new Fleet Equipment Code ${fleetEquipmentCode} for new Maker+Model: ${validatedData.makerCode}/${validatedData.model}`);
    }
    
    const newEntry = await storage.createMasterData({
      ...validatedData,
      fleetEquipmentCode: fleetEquipmentCode || ''
    });
    
    res.status(201).json(newEntry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating master data:', error);
    res.status(500).json({ error: 'Failed to create master data entry' });
  }
});

// Update master data entry
router.patch('/master-data/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getMasterDataItem(id);
    
    if (!existing) {
      return res.status(404).json({ error: 'Master data entry not found' });
    }
    
    const updated = await storage.updateMasterData(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating master data:', error);
    res.status(500).json({ error: 'Failed to update master data entry' });
  }
});

// Delete master data entry
router.delete('/master-data/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getMasterDataItem(id);
    
    if (!existing) {
      return res.status(404).json({ error: 'Master data entry not found' });
    }
    
    await storage.deleteMasterData(id);
    res.json({ success: true, message: 'Master data entry deleted' });
  } catch (error) {
    console.error('Error deleting master data:', error);
    res.status(500).json({ error: 'Failed to delete master data entry' });
  }
});

// Generate next Fleet Equipment Code for a given SFI code
router.get('/generate-fleet-equipment-code/:sfiCode', async (req, res) => {
  try {
    const sfiCode = req.params.sfiCode;
    const nextCode = await storage.generateFleetEquipmentCode(sfiCode);
    res.json({ fleetEquipmentCode: nextCode, sfiCode });
  } catch (error) {
    console.error('Error generating fleet equipment code:', error);
    res.status(500).json({ error: 'Failed to generate fleet equipment code' });
  }
});

// ============================================================
// FLEET-VESSEL MAPPING
// ============================================================

// Get all fleet-vessel mappings with optional filtering
router.get('/fleet-vessel-mappings', async (req, res) => {
  try {
    const { fleetEquipmentCode, vesselCode } = req.query;
    
    let mappings: any[] = [];
    
    if (fleetEquipmentCode) {
      mappings = await storage.getFleetVesselMappings(fleetEquipmentCode as string);
    } else {
      mappings = await storage.getFleetVesselMappings();
    }
    
    if (vesselCode) {
      mappings = mappings.filter((m: any) => m.vesselCode === vesselCode);
    }
    
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-vessel mappings' });
  }
});

// Get mappings for a specific fleet equipment code
router.get('/fleet-vessel-mappings/by-equipment/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const mappings = await storage.getFleetVesselMappings(code);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching mappings by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Get mappings for a specific vessel
router.get('/fleet-vessel-mappings/by-vessel/:vesselCode', async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const mappings = await storage.getFleetVesselMappingsByVessel(vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Create new fleet-vessel mapping
router.post('/fleet-vessel-mappings', async (req, res) => {
  try {
    const validatedData = insertFleetVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetVesselMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Delete fleet-vessel mapping
router.delete('/fleet-vessel-mappings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await storage.deleteFleetVesselMapping(id);
    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('Error deleting fleet-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// ============================================================
// COMPONENT-VESSEL MAPPINGS (for Fleet Data View)
// ============================================================

// Get all component-vessel mappings
router.get('/component-vessel-mappings', async (req, res) => {
  try {
    const mappings = await storage.getComponentVesselMappings();
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching component-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch component-vessel mappings' });
  }
});

// ============================================================
// FLEET-COMPONENT MAPPING
// ============================================================

// Get all fleet-component mappings with optional filtering
router.get('/fleet-component-mappings', async (req, res) => {
  try {
    const { fleetEquipmentCode, vesselCode, componentCode } = req.query;
    
    let mappings: any[] = [];
    
    if (vesselCode) {
      mappings = await storage.getFleetComponentMappingsByVessel(vesselCode as string);
      if (fleetEquipmentCode) {
        mappings = mappings.filter((m: any) => m.fleetEquipmentCode === fleetEquipmentCode);
      }
    } else if (fleetEquipmentCode) {
      mappings = await storage.getFleetComponentMappings(fleetEquipmentCode as string);
    } else {
      // Get all mappings (no filter)
      mappings = await storage.getFleetComponentMappings();
    }
    
    if (componentCode) {
      mappings = mappings.filter((m: any) => m.componentCode === componentCode);
    }
    
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-component mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-component mappings' });
  }
});

// Get mappings for a specific fleet equipment code
router.get('/fleet-component-mappings/by-equipment/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const mappings = await storage.getFleetComponentMappings(code);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching component mappings by equipment:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Get mappings for a specific vessel
router.get('/fleet-component-mappings/by-vessel/:vesselCode', async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const mappings = await storage.getFleetComponentMappingsByVessel(vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching component mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Create new fleet-component mapping
router.post('/fleet-component-mappings', async (req, res) => {
  try {
    const validatedData = insertFleetComponentMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetComponentMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-component mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Delete fleet-component mapping
router.delete('/fleet-component-mappings', async (req, res) => {
  try {
    const { fleetEquipmentCode, vesselCode, componentCode } = req.query;
    
    if (!fleetEquipmentCode || !vesselCode || !componentCode) {
      return res.status(400).json({ 
        error: 'Missing required parameters: fleetEquipmentCode, vesselCode, componentCode' 
      });
    }
    
    await storage.removeFleetComponentMappingRecord(
      fleetEquipmentCode as string, 
      vesselCode as string, 
      componentCode as string
    );
    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('Error deleting fleet-component mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// ============================================================
// FLEET-JOB-VESSEL MAPPING
// ============================================================

// Get all fleet-job-vessel mappings
router.get('/fleet-job-mappings', async (req, res) => {
  try {
    const { fleetEquipmentCode, jobCode, vesselCode } = req.query;
    
    let mappings = await storage.getFleetJobVesselMappings(
      fleetEquipmentCode as string | undefined,
      jobCode as string | undefined
    );
    
    if (vesselCode) {
      mappings = mappings.filter((m: any) => m.vesselCode === vesselCode);
    }
    
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-job-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-job-vessel mappings' });
  }
});

// Get mappings by job code
router.get('/fleet-job-mappings/by-job/:jobCode', async (req, res) => {
  try {
    const jobCode = req.params.jobCode;
    const mappings = await storage.getFleetJobVesselMappings(undefined, jobCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching job mappings by job code:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Get mappings by vessel
router.get('/fleet-job-mappings/by-vessel/:vesselCode', async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const allMappings = await storage.getFleetJobVesselMappings();
    const mappings = allMappings.filter((m: any) => m.vesselCode === vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching job mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Create fleet-job-vessel mapping
router.post('/fleet-job-mappings', async (req, res) => {
  try {
    const validatedData = insertFleetJobVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetJobVesselMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-job-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Delete fleet-job-vessel mapping
router.delete('/fleet-job-mappings', async (req, res) => {
  try {
    const { jobCode, vesselCode } = req.query;
    
    if (!jobCode || !vesselCode) {
      return res.status(400).json({ 
        error: 'Missing required parameters: jobCode, vesselCode' 
      });
    }
    
    await storage.removeFleetJobVesselMappingRecord(
      jobCode as string, 
      vesselCode as string
    );
    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('Error deleting fleet-job-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// ============================================================
// FLEET-SPARE-VESSEL MAPPING
// ============================================================

// Get all fleet-spare-vessel mappings
router.get('/fleet-spare-mappings', async (req, res) => {
  try {
    const { fleetEquipmentCode, partCode, vesselCode } = req.query;
    
    let mappings = await storage.getFleetSpareVesselMappings(
      fleetEquipmentCode as string | undefined,
      partCode as string | undefined
    );
    
    if (vesselCode) {
      mappings = mappings.filter((m: any) => m.vesselCode === vesselCode);
    }
    
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching fleet-spare-vessel mappings:', error);
    res.status(500).json({ error: 'Failed to fetch fleet-spare-vessel mappings' });
  }
});

// Get mappings by spare part code
router.get('/fleet-spare-mappings/by-spare/:partCode', async (req, res) => {
  try {
    const partCode = req.params.partCode;
    const mappings = await storage.getFleetSpareVesselMappings(undefined, partCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching spare mappings by part code:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Get mappings by vessel
router.get('/fleet-spare-mappings/by-vessel/:vesselCode', async (req, res) => {
  try {
    const vesselCode = req.params.vesselCode;
    const allMappings = await storage.getFleetSpareVesselMappings();
    const mappings = allMappings.filter((m: any) => m.vesselCode === vesselCode);
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching spare mappings by vessel:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Create fleet-spare-vessel mapping
router.post('/fleet-spare-mappings', async (req, res) => {
  try {
    const validatedData = insertFleetSpareVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createFleetSpareVesselMappingRecord(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet-spare-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Delete fleet-spare-vessel mapping
router.delete('/fleet-spare-mappings', async (req, res) => {
  try {
    const { partCode, vesselCode } = req.query;
    
    if (!partCode || !vesselCode) {
      return res.status(400).json({ 
        error: 'Missing required parameters: partCode, vesselCode' 
      });
    }
    
    await storage.removeFleetSpareVesselMappingRecord(
      partCode as string, 
      vesselCode as string
    );
    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('Error deleting fleet-spare-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// ============================================================
// BULK IMPORT HISTORY & ERRORS
// ============================================================

// Get bulk import history with pagination and filtering
router.get('/import-history', async (req, res) => {
  try {
    const { vesselCode, moduleType, status, limit, offset } = req.query;
    
    let history = await storage.getBulkImportHistory(
      vesselCode as string | undefined,
      moduleType as string | undefined
    );
    
    // Apply additional status filter
    if (status) {
      history = history.filter((h: any) => h.status === status);
    }
    
    // Sort by most recent first
    history.sort((a: any, b: any) => {
      const aTime = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : new Date(a.uploadedAt as string).getTime();
      const bTime = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : new Date(b.uploadedAt as string).getTime();
      return bTime - aTime;
    });
    
    // Apply pagination
    const total = history.length;
    const limitNum = limit ? parseInt(limit as string) : 50;
    const offsetNum = offset ? parseInt(offset as string) : 0;
    history = history.slice(offsetNum, offsetNum + limitNum);
    
    res.json({ items: history, total, limit: limitNum, offset: offsetNum });
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

// Get single import history entry
router.get('/import-history/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getBulkImportHistoryItem(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Import history entry not found' });
    }
    
    res.json(entry);
  } catch (error) {
    console.error('Error fetching import history entry:', error);
    res.status(500).json({ error: 'Failed to fetch import history entry' });
  }
});

// Get errors for a specific import
router.get('/import-history/:id/errors', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const errors = await storage.getBulkImportErrors(id);
    res.json(errors);
  } catch (error) {
    console.error('Error fetching import errors:', error);
    res.status(500).json({ error: 'Failed to fetch import errors' });
  }
});

// Create import history entry (used internally by bulk import handlers)
router.post('/import-history', async (req, res) => {
  try {
    const validatedData = insertBulkImportHistorySchema.parse(req.body);
    const newEntry = await storage.createBulkImportHistory(validatedData);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating import history:', error);
    res.status(500).json({ error: 'Failed to create import history entry' });
  }
});

// Update import history entry (used internally by bulk import handlers)
router.patch('/import-history/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateBulkImportHistory(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating import history:', error);
    res.status(500).json({ error: 'Failed to update import history entry' });
  }
});

// Create import error entries (used internally by bulk import handlers)
router.post('/import-errors', async (req, res) => {
  try {
    const { errors } = req.body;
    
    if (!Array.isArray(errors)) {
      return res.status(400).json({ error: 'Errors must be an array' });
    }
    
    const validatedErrors = errors.map((e: any) => insertBulkImportErrorSchema.parse(e));
    await storage.createBulkImportErrors(validatedErrors);
    
    res.status(201).json({ success: true, count: validatedErrors.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating import errors:', error);
    res.status(500).json({ error: 'Failed to create import errors' });
  }
});

// ============================================================
// FLEET ADMIN DASHBOARD METRICS
// ============================================================

// Get aggregated metrics for the Fleet Admin Dashboard
router.get('/dashboard-metrics', async (req, res) => {
  try {
    const metrics = await storage.getFleetAdminMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

export default router;
