import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { 
  insertMasterDataSchema, 
  insertFleetVesselMappingSchema,
  insertFleetComponentMappingSchema,
  insertFleetJobVesselMappingSchema,
  insertFleetSpareVesselMappingSchema,
  insertBulkImportHistorySchema,
  insertBulkImportErrorSchema,
  insertFleetComponentsSchema,
  fleetComponents,
  fleetJobs,
  fleetSpares,
  makerList,
  components,
  jobs,
  spares,
  spareComponentLinks,
  storesItems,
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
// FLEET COMPONENTS - Fleet Equipment Master Data
// 13 columns: Parent Fleet Equipment Code, Fleet Equipment Code, Fleet Equipment Name,
// Component Category, Maker Name, Maker Code, Model, Model Code, Location, Rating,
// Eqpt / System Department, Notes, IS Active
// ============================================================

// Get all fleet components with optional filtering
router.get('/fleet-components', async (req, res) => {
  try {
    const { fleetEquipmentCode, isActive, limit, offset } = req.query;
    
    let entries = await storage.getFleetComponents();
    
    // Apply filters
    if (fleetEquipmentCode) {
      entries = entries.filter((e: any) => e.fleetEquipmentCode === fleetEquipmentCode);
    }
    if (isActive !== undefined) {
      const active = isActive === 'true';
      entries = entries.filter((e: any) => e.isActive === active);
    }
    
    // Apply pagination
    if (offset) {
      entries = entries.slice(parseInt(offset as string));
    }
    if (limit) {
      entries = entries.slice(0, parseInt(limit as string));
    }
    
    res.json(entries);
  } catch (error) {
    console.error('Error fetching fleet components:', error);
    res.status(500).json({ error: 'Failed to fetch fleet components' });
  }
});

// Export fleet components to Excel (13-column format matching import template)
router.get('/fleet-components/export', async (req, res) => {
  try {
    const XLSX = await import('xlsx');
    const allComponents = await storage.getFleetComponents();

    const headers = [
      'Parent Fleet Equipment Code', 'Fleet Equipment Code', 'Fleet Equipment Name',
      'Component Category', 'Maker Name', 'Maker Code', 'Model', 'Model Code',
      'Location', 'Rating', 'Eqpt / System Department', 'Notes', 'IS Active'
    ];

    const rows = allComponents.map((c: any) => [
      c.parentFleetEquipmentCode || '',
      c.fleetEquipmentCode || '',
      c.fleetEquipmentName || '',
      c.componentCategory || '',
      c.makerName || '',
      c.makerCode || '',
      c.model || '',
      c.modelCode || '',
      c.location || '',
      c.rating || '',
      c.eqptSystemDept || '',
      c.notes || '',
      c.isActive === false ? 'No' : 'Yes',
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [25, 25, 40, 20, 25, 15, 20, 15, 20, 15, 25, 30, 10];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fleet Components');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=fleet-components-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting fleet components:', error);
    res.status(500).json({ error: 'Failed to export fleet components' });
  }
});

// Get single fleet component
router.get('/fleet-components/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getFleetComponent(id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Fleet component not found' });
    }
    
    res.json(entry);
  } catch (error) {
    console.error('Error fetching fleet component:', error);
    res.status(500).json({ error: 'Failed to fetch fleet component' });
  }
});

// Get fleet component by Fleet Equipment Code
router.get('/fleet-components/by-code/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const entry = await storage.getFleetComponentByCode(code);
    
    if (!entry) {
      return res.status(404).json({ error: 'Fleet component not found' });
    }
    
    res.json(entry);
  } catch (error) {
    console.error('Error fetching fleet component by code:', error);
    res.status(500).json({ error: 'Failed to fetch fleet component' });
  }
});

// Create new fleet component
router.post('/fleet-components', async (req, res) => {
  try {
    const validatedData = insertFleetComponentsSchema.parse(req.body);
    
    const existing = await storage.getFleetComponentByCode(validatedData.fleetEquipmentCode);
    if (existing) {
      return res.status(409).json({ error: 'Fleet component with this code already exists' });
    }
    
    const newComponent = await storage.createFleetComponent(validatedData);
    res.status(201).json(newComponent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating fleet component:', error);
    res.status(500).json({ error: 'Failed to create fleet component' });
  }
});

// Update existing fleet component
router.patch('/fleet-components/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getFleetComponent(id);
    
    if (!existing) {
      return res.status(404).json({ error: 'Fleet component not found' });
    }
    
    const updated = await storage.updateFleetComponent(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating fleet component:', error);
    res.status(500).json({ error: 'Failed to update fleet component' });
  }
});

// Delete fleet component (soft delete)
router.delete('/fleet-components/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getFleetComponent(id);
    
    if (!existing) {
      return res.status(404).json({ error: 'Fleet component not found' });
    }
    
    await storage.deleteFleetComponent(id);
    res.json({ success: true, message: 'Fleet component deleted' });
  } catch (error) {
    console.error('Error deleting fleet component:', error);
    res.status(500).json({ error: 'Failed to delete fleet component' });
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

// Create new component-vessel mapping
const createComponentVesselMappingSchema = z.object({
  fleetEquipmentCode: z.string(),
  vesselCode: z.string(),
  vesselName: z.string(),
  componentCode: z.string().optional(),
  componentName: z.string().optional(),
});

router.post('/component-vessel-mappings', async (req, res) => {
  try {
    const validatedData = createComponentVesselMappingSchema.parse(req.body);
    const newMapping = await storage.createComponentVesselMapping(validatedData);
    res.status(201).json(newMapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating component-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to create component-vessel mapping' });
  }
});

// Delete component-vessel mapping
router.delete('/component-vessel-mappings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteComponentVesselMapping(id);
    res.json({ success: true, message: 'Component-vessel mapping deleted' });
  } catch (error) {
    console.error('Error deleting component-vessel mapping:', error);
    res.status(500).json({ error: 'Failed to delete component-vessel mapping' });
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

router.get('/dashboard-stats', async (req, res) => {
  try {
    const db = await getDb();
    const allComponents = await db.select().from(fleetComponents).where(eq(fleetComponents.isDeleted, false));
    const allJobs = await db.select().from(fleetJobs).where(eq(fleetJobs.isDeleted, false));
    const allSpares = await db.select().from(fleetSpares).where(eq(fleetSpares.isDeleted, false));
    const allMakers = await db.select().from(makerList).where(eq(makerList.isDeleted, false));

    const leafComponents = allComponents.filter(c => c.fleetEquipmentCode?.length === 10);
    const componentsWithMaker = leafComponents.filter(c => c.makerName && c.makerName.trim() !== '');
    const componentsWithoutMaker = leafComponents.filter(c => !c.makerName || c.makerName.trim() === '');
    const activeComponents = leafComponents.filter(c => c.isActive);
    const inactiveComponents = leafComponents.filter(c => !c.isActive);

    const categoryBreakdown: Record<string, number> = {};
    const deptBreakdown: Record<string, number> = {};
    leafComponents.forEach(c => {
      const cat = c.componentCategory || 'Uncategorized';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      const dept = c.eqptSystemDept || 'Unassigned';
      deptBreakdown[dept] = (deptBreakdown[dept] || 0) + 1;
    });

    const jobsByTaskType: Record<string, number> = {};
    const jobsByPriority: Record<string, number> = {};
    const jobsByCriticality: Record<string, number> = {};
    const jobsByBasis: Record<string, number> = {};
    allJobs.forEach(j => {
      const tt = j.taskType || 'Unknown';
      jobsByTaskType[tt] = (jobsByTaskType[tt] || 0) + 1;
      const pr = j.jobPriority || 'Unknown';
      jobsByPriority[pr] = (jobsByPriority[pr] || 0) + 1;
      const cr = j.criticality || 'Unknown';
      jobsByCriticality[cr] = (jobsByCriticality[cr] || 0) + 1;
      const mb = j.maintenanceBasis || 'Unknown';
      jobsByBasis[mb] = (jobsByBasis[mb] || 0) + 1;
    });
    const activeJobs = allJobs.filter(j => j.isActive);

    const sparesWithMaker = allSpares.filter(s => s.maker && s.maker.trim() !== '');
    const sparesByCriticality: Record<string, number> = {};
    allSpares.forEach(s => {
      const cr = s.criticality || 'Not Set';
      sparesByCriticality[cr] = (sparesByCriticality[cr] || 0) + 1;
    });

    const usedMakerCodes = new Set([
      ...allComponents.filter(c => c.makerCode).map(c => c.makerCode),
      ...allSpares.filter(s => s.makerCode).map(s => s.makerCode),
    ]);
    const linkedMakers = allMakers.filter(m => usedMakerCodes.has(m.makerCode));
    const unlinkedMakers = allMakers.filter(m => !usedMakerCodes.has(m.makerCode));

    const componentEquipCodes = new Set(leafComponents.map(c => c.fleetEquipmentCode));
    const jobsWithValidComponent = allJobs.filter(j => componentEquipCodes.has(j.fleetEquipmentCode));
    const jobsWithInvalidComponent = allJobs.filter(j => !componentEquipCodes.has(j.fleetEquipmentCode));
    const sparesWithValidComponent = allSpares.filter(s => componentEquipCodes.has(s.fleetEquipmentCode));
    const sparesWithInvalidComponent = allSpares.filter(s => !componentEquipCodes.has(s.fleetEquipmentCode));

    const jobEquipCodes = new Set(allJobs.map(j => j.fleetEquipmentCode));
    const componentsWithJobs = leafComponents.filter(c => jobEquipCodes.has(c.fleetEquipmentCode)).length;
    const componentsWithoutJobs = leafComponents.length - componentsWithJobs;

    const spareEquipCodes = new Set(allSpares.map(s => s.fleetEquipmentCode));
    const componentsWithSpares = leafComponents.filter(c => spareEquipCodes.has(c.fleetEquipmentCode)).length;
    const componentsWithoutSpares = leafComponents.length - componentsWithSpares;

    const recentComponents = [...leafComponents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(c => ({ id: c.id, code: c.fleetEquipmentCode, name: c.fleetEquipmentName, date: c.createdAt, type: 'component' as const }));
    const recentJobs = [...allJobs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(j => ({ id: j.id, code: j.jobCode, name: j.woTitle, date: j.createdAt, type: 'job' as const }));
    const recentSpares = [...allSpares]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(s => ({ id: s.id, code: s.partCode, name: s.partName, date: s.createdAt, type: 'spare' as const }));

    res.json({
      components: {
        total: leafComponents.length,
        allHierarchy: allComponents.length,
        withMaker: componentsWithMaker.length,
        withoutMaker: componentsWithoutMaker.length,
        active: activeComponents.length,
        inactive: inactiveComponents.length,
        withJobs: componentsWithJobs,
        withoutJobs: componentsWithoutJobs,
        withSpares: componentsWithSpares,
        withoutSpares: componentsWithoutSpares,
        categoryBreakdown,
        deptBreakdown,
      },
      jobs: {
        total: allJobs.length,
        active: activeJobs.length,
        withValidComponent: jobsWithValidComponent.length,
        withInvalidComponent: jobsWithInvalidComponent.length,
        byTaskType: jobsByTaskType,
        byPriority: jobsByPriority,
        byCriticality: jobsByCriticality,
        byBasis: jobsByBasis,
      },
      spares: {
        total: allSpares.length,
        withMaker: sparesWithMaker.length,
        withoutMaker: allSpares.length - sparesWithMaker.length,
        withValidComponent: sparesWithValidComponent.length,
        withInvalidComponent: sparesWithInvalidComponent.length,
        byCriticality: sparesByCriticality,
      },
      makers: {
        total: allMakers.length,
        linked: linkedMakers.length,
        unlinked: unlinkedMakers.length,
      },
      dataQuality: {
        componentsWithoutMaker: componentsWithoutMaker.length,
        jobsWithInvalidComponent: jobsWithInvalidComponent.length,
        sparesWithInvalidComponent: sparesWithInvalidComponent.length,
        unlinkedMakers: unlinkedMakers.length,
        totalIssues: componentsWithoutMaker.length + jobsWithInvalidComponent.length + sparesWithInvalidComponent.length + unlinkedMakers.length,
      },
      recentActivity: [...recentComponents, ...recentJobs, ...recentSpares]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ============================================================
// COPY VESSEL - Replicate actual vessel data (components, jobs, spares) from one vessel to another
// ============================================================
router.post('/copy-vessel', async (req, res) => {
  try {
    const copySchema = z.object({
      sourceVesselCode: z.string().min(1, "Source vessel code is required"),
      targetVesselCode: z.string().min(1, "Target vessel code is required"),
      targetVesselName: z.string().optional(),
      copyComponents: z.boolean().default(true),
      copyJobs: z.boolean().default(true),
      copySpares: z.boolean().default(true),
      copyStores: z.boolean().default(true),
      mappedBy: z.string().default("system"),
    });

    const data = copySchema.parse(req.body);

    if (data.sourceVesselCode === data.targetVesselCode) {
      return res.status(400).json({ error: 'Source and target vessel cannot be the same' });
    }

    const db = await getDb();
    const copyResults = { components: 0, jobs: 0, spares: 0, spareComponentLinks: 0, stores: 0, errors: [] as string[] };
    const componentIdMap = new Map<string, string>();
    const spareIdMap = new Map<number, number>();

    const generateId = (prefix: string) => {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 13)}`;
    };

    if (data.copyComponents) {
      const sourceComps = await db.select().from(components)
        .where(eq(components.vesselId, data.sourceVesselCode));
      const targetComps = await db.select().from(components)
        .where(eq(components.vesselId, data.targetVesselCode));
      const existingCodeToId = new Map<string, string>();
      for (const c of targetComps) {
        if (c.componentCode) existingCodeToId.set(c.componentCode, c.id);
      }

      for (const comp of sourceComps) {
        const existingTargetId = comp.componentCode ? existingCodeToId.get(comp.componentCode) : undefined;
        if (existingTargetId) {
          componentIdMap.set(comp.id, existingTargetId);
          continue;
        }
        const newId = generateId('COMP');
        componentIdMap.set(comp.id, newId);

        try {
          await db.insert(components).values({
            id: newId,
            vesselId: data.targetVesselCode,
            componentCode: comp.componentCode,
            name: comp.name,
            parentId: comp.parentId,
            fleetEquipmentCode: comp.fleetEquipmentCode,
            fleetEquipmentName: comp.fleetEquipmentName,
            componentCategory: comp.componentCategory,
            maker: comp.maker,
            makerCode: comp.makerCode,
            model: comp.model,
            modelCode: comp.modelCode,
            serialNo: comp.serialNo,
            drawingNo: comp.drawingNo,
            location: comp.location,
            critical: comp.critical,
            conditionBased: comp.conditionBased,
            installationDate: comp.installationDate,
            commissionedDate: comp.commissionedDate,
            rating: comp.rating,
            eqptSystemDept: comp.eqptSystemDept,
            isActive: comp.isActive,
            vesselCode: comp.vesselCode,
            isParent: comp.isParent,
            notes: comp.notes,
            dataScope: comp.dataScope || 'vessel',
            parentFleetEquipmentCode: comp.parentFleetEquipmentCode,
            modelNumber: comp.modelNumber,
            department: comp.department,
            deptCategory: comp.deptCategory,
            category: comp.category,
            classItem: comp.classItem,
            noOfUnits: comp.noOfUnits,
            parentComponent: comp.parentComponent,
            dimensionsSize: comp.dimensionsSize,
            runningHours: comp.runningHours,
            currentCumulativeRH: comp.currentCumulativeRH,
            rhCounterType: comp.rhCounterType,
            rhCounterSource: comp.rhCounterSource,
          });
          copyResults.components++;
        } catch (e: any) {
          copyResults.errors.push(`Component ${comp.componentCode}: ${e.message}`);
        }
      }
    }

    if (data.copyJobs) {
      const sourceJobList = await db.select().from(jobs)
        .where(eq(jobs.vesselId, data.sourceVesselCode));
      const targetJobList = await db.select().from(jobs)
        .where(eq(jobs.vesselId, data.targetVesselCode));
      const existingJobNos = new Set(targetJobList.map(j => j.jobNo));

      for (const job of sourceJobList) {
        if (existingJobNos.has(job.jobNo)) continue;

        const newId = generateId('JOB');
        const newComponentId = componentIdMap.get(job.componentId || '') || job.componentId;

        try {
          await db.insert(jobs).values({
            id: newId,
            vesselId: data.targetVesselCode,
            componentId: newComponentId,
            componentCode: job.componentCode,
            componentName: job.componentName,
            jobNo: job.jobNo,
            jobTitle: job.jobTitle,
            assignedTo: job.assignedTo,
            maintenanceType: job.maintenanceType,
            maintenanceBasis: job.maintenanceBasis,
            frequencyType: job.frequencyType,
            frequencyValue: job.frequencyValue,
            frequencyUnit: job.frequencyUnit,
            intervalRunningHour: job.intervalRunningHour,
            leadTimeValue: job.leadTimeValue,
            leadTimeUnit: job.leadTimeUnit,
            initialNextDue: job.initialNextDue,
            lastDoneDate: job.lastDoneDate,
            nextDueDate: job.nextDueDate,
            lastDoneRH: job.lastDoneRH,
            nextDueRH: job.nextDueRH,
            jobPriority: job.jobPriority,
            classRelated: job.classRelated,
            briefWorkDescription: job.briefWorkDescription,
            jobDescription: job.jobDescription,
            approver: job.approver,
            department: job.department,
            requiredSpareParts: job.requiredSpareParts,
            requiredTools: job.requiredTools,
            safetyRequirements: job.safetyRequirements,
            dataScope: job.dataScope || 'vessel',
            fleetEquipmentCode: job.fleetEquipmentCode,
            fleetJobCode: job.fleetJobCode,
            sfiCode: job.sfiCode,
            criticality: job.criticality,
            isActive: job.isActive,
            estimatedManHours: job.estimatedManHours,
            createdBy: job.createdBy || 'system',
          });
          copyResults.jobs++;
        } catch (e: any) {
          copyResults.errors.push(`Job ${job.jobNo}: ${e.message}`);
        }
      }
    }

    if (data.copySpares) {
      const sourceSpareList = await db.select().from(spares)
        .where(and(
          eq(spares.vesselId, data.sourceVesselCode),
          eq(spares.deleted, false)
        ));
      const targetSpareList = await db.select().from(spares)
        .where(eq(spares.vesselId, data.targetVesselCode));
      const existingSpareKeyMap = new Map<string, number>();
      for (const s of targetSpareList) {
        existingSpareKeyMap.set(`${s.partCode}|${s.componentCode}`, s.id);
      }

      for (const spare of sourceSpareList) {
        const spareKey = `${spare.partCode}|${spare.componentCode}`;
        const existingId = existingSpareKeyMap.get(spareKey);
        if (existingId !== undefined) {
          spareIdMap.set(spare.id, existingId);
          continue;
        }

        const newComponentId = componentIdMap.get(spare.componentId || '') || spare.componentId;

        try {
          const [inserted] = await db.insert(spares).values({
            partCode: spare.partCode,
            partName: spare.partName,
            componentId: newComponentId,
            componentCode: spare.componentCode,
            componentName: spare.componentName,
            componentSpareCode: spare.componentSpareCode,
            critical: spare.critical,
            rob: 0,
            robLocationA: 0,
            robLocationB: 0,
            min: spare.min,
            max: spare.max,
            unitCost: spare.unitCost,
            stockingNumber: spare.stockingNumber,
            leadTime: spare.leadTime,
            supplier: spare.supplier,
            location: spare.location,
            vesselId: data.targetVesselCode,
            dataScope: spare.dataScope || 'vessel',
            fleetEquipmentCode: spare.fleetEquipmentCode,
            fleetPartCode: spare.fleetPartCode,
            partNumber: spare.partNumber,
            uom: spare.uom,
            drawingNumber: spare.drawingNumber,
            drawingNo: spare.drawingNo,
            location2: spare.location2,
            remarks: spare.remarks,
          }).returning({ id: spares.id });
          spareIdMap.set(spare.id, inserted.id);
          copyResults.spares++;
        } catch (e: any) {
          copyResults.errors.push(`Spare ${spare.partCode}: ${e.message}`);
        }
      }

      const sourceLinks = await db.select().from(spareComponentLinks)
        .where(eq(spareComponentLinks.vesselId, data.sourceVesselCode));
      const targetLinks = await db.select().from(spareComponentLinks)
        .where(eq(spareComponentLinks.vesselId, data.targetVesselCode));
      const existingLinkKeys = new Set(
        targetLinks.map(l => `${l.spareId}|${l.componentId}`)
      );

      for (const link of sourceLinks) {
        const newSpareId = spareIdMap.get(link.spareId);
        const newComponentId = componentIdMap.get(link.componentId) || link.componentId;

        if (newSpareId === undefined) continue;

        const linkKey = `${newSpareId}|${newComponentId}`;
        if (existingLinkKeys.has(linkKey)) continue;

        try {
          await db.insert(spareComponentLinks).values({
            vesselId: data.targetVesselCode,
            spareId: newSpareId,
            componentId: newComponentId,
            linkedBy: 'system-copy-vessel',
          });
          copyResults.spareComponentLinks++;
        } catch (e: any) {
          copyResults.errors.push(`SpareLink ${link.spareId}->${link.componentId}: ${e.message}`);
        }
      }
    }

    if (data.copyStores) {
      const sourceStoreList = await db.select().from(storesItems)
        .where(and(
          eq(storesItems.vesselId, data.sourceVesselCode),
          eq(storesItems.deleted, false)
        ));
      const targetStoreList = await db.select().from(storesItems)
        .where(eq(storesItems.vesselId, data.targetVesselCode));
      const existingStoreCodes = new Set(
        targetStoreList.map(s => `${s.itemCode}|${s.itemType}`)
      );

      for (const item of sourceStoreList) {
        const storeKey = `${item.itemCode}|${item.itemType}`;
        if (existingStoreCodes.has(storeKey)) continue;

        try {
          await db.insert(storesItems).values({
            vesselId: data.targetVesselCode,
            itemType: item.itemType,
            itemCode: item.itemCode,
            impaCode: item.impaCode,
            itemName: item.itemName,
            category: item.category,
            specification: item.specification,
            uom: item.uom,
            rob: "0",
            robLocationA: "0",
            robLocationB: "0",
            locationA: item.locationA,
            locationB: item.locationB,
            min: item.min,
            max: item.max,
            unitCost: item.unitCost,
            supplier: item.supplier,
            leadTime: item.leadTime,
            ihm: item.ihm,
            ihmDetails: item.ihmDetails,
            ihmPresence: item.ihmPresence,
            ihmEvidenceType: item.ihmEvidenceType,
            manufactureDate: item.manufactureDate,
            expiryDate: item.expiryDate,
            batchNumber: item.batchNumber,
            lotNumber: item.lotNumber,
            shelfLifeMonths: item.shelfLifeMonths,
            sdsReference: item.sdsReference,
            sdsDocumentUrl: item.sdsDocumentUrl,
            sdsLastUpdated: item.sdsLastUpdated,
            hazardClassification: item.hazardClassification,
            unNumber: item.unNumber,
            flashPoint: item.flashPoint,
            storageTempMin: item.storageTempMin,
            storageTempMax: item.storageTempMax,
            disposalInstructions: item.disposalInstructions,
            ppeRequirements: item.ppeRequirements,
            emergencyContact: item.emergencyContact,
            remarks: item.remarks,
          });
          copyResults.stores++;
        } catch (e: any) {
          copyResults.errors.push(`Store ${item.itemCode}: ${e.message}`);
        }
      }
    }

    const totalCopied = copyResults.components + copyResults.jobs + copyResults.spares + copyResults.spareComponentLinks + copyResults.stores;
    console.log(`[Copy Vessel] ${data.sourceVesselCode} → ${data.targetVesselCode}: ${copyResults.components} components, ${copyResults.jobs} jobs, ${copyResults.spares} spares, ${copyResults.stores} stores copied`);
    
    res.json({
      success: true,
      message: `Vessel data successfully replicated. ${totalCopied} record(s) copied.`,
      results: copyResults,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error copying vessel data:', error);
    res.status(500).json({ error: 'Failed to copy vessel data' });
  }
});

export default router;
