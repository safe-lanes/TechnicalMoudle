import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import {
  insertMasterDataSchema,
  insertFleetVesselMappingSchema,
  insertFleetComponentMappingSchema,
  insertFleetJobVesselMappingSchema,
  insertFleetSpareVesselMappingSchema,
  insertBulkImportHistorySchema,
  insertBulkImportErrorSchema,
  insertFleetComponentsSchema,
} from '@shared/schema';
import * as repo from '../repositories/fleetAdminRepository';

// ══════════════════════════════════════════════════════════
// Master Data CRUD
// ══════════════════════════════════════════════════════════

export async function getMasterDataList(query: any) {
  const { sfiCode, vesselName, modelCode, limit, offset } = query;

  let entries = await repo.getMasterDataList();

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

  return { items: entries, total, limit: limitNum, offset: offsetNum };
}

export async function getMasterDataItem(id: number) {
  const entry = await repo.getMasterDataItem(id);
  if (!entry) {
    const err: any = new Error('Master data entry not found');
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

export async function getMasterDataByCode(code: string) {
  const entry = await repo.getMasterDataByFleetCode(code);
  if (!entry) {
    const err: any = new Error('Master data entry not found');
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

// Schema for creating master data - fleetEquipmentCode is auto-generated
const createMasterDataSchema = insertMasterDataSchema.extend({
  fleetEquipmentCode: z.string().optional()
});

export async function createMasterData(body: any) {
  const validatedData = createMasterDataSchema.parse(body);

  // Check if same Maker+Model combination already exists
  // If so, reuse the existing Fleet Equipment Code
  let fleetEquipmentCode = validatedData.fleetEquipmentCode;

  if (!fleetEquipmentCode && validatedData.makerCode && validatedData.model) {
    const existingEntry = await repo.getMasterDataByMakerModel(
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
    fleetEquipmentCode = await repo.generateFleetEquipmentCode(validatedData.sfiCode);
    console.log(`Generated new Fleet Equipment Code ${fleetEquipmentCode} for new Maker+Model: ${validatedData.makerCode}/${validatedData.model}`);
  }

  return repo.createMasterData({
    ...validatedData,
    fleetEquipmentCode: fleetEquipmentCode || ''
  });
}

export async function updateMasterData(id: number, body: any) {
  const existing = await repo.getMasterDataItem(id);
  if (!existing) {
    const err: any = new Error('Master data entry not found');
    err.statusCode = 404;
    throw err;
  }
  return repo.updateMasterData(id, body);
}

export async function deleteMasterData(id: number) {
  const existing = await repo.getMasterDataItem(id);
  if (!existing) {
    const err: any = new Error('Master data entry not found');
    err.statusCode = 404;
    throw err;
  }
  await repo.deleteMasterData(id);
  return { success: true, message: 'Master data entry deleted' };
}

export async function generateFleetEquipmentCode(sfiCode: string) {
  const nextCode = await repo.generateFleetEquipmentCode(sfiCode);
  return { fleetEquipmentCode: nextCode, sfiCode };
}

// ══════════════════════════════════════════════════════════
// Fleet Components Admin
// ══════════════════════════════════════════════════════════

export async function getFleetComponents(query: any) {
  const { fleetEquipmentCode, isActive, limit, offset } = query;

  let entries = await repo.getFleetComponents();

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

  return entries;
}

export async function exportFleetComponents() {
  const XLSXModule = await import('xlsx');
  const allComponents = await repo.getFleetComponents();

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
  const ws = XLSXModule.utils.aoa_to_sheet(wsData);

  const colWidths = [25, 25, 40, 20, 25, 15, 20, 15, 20, 15, 25, 30, 10];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSXModule.utils.book_new();
  XLSXModule.utils.book_append_sheet(wb, ws, 'Fleet Components');

  return {
    buffer: XLSXModule.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    filename: `fleet-components-${new Date().toISOString().split('T')[0]}.xlsx`,
  };
}

export async function getFleetComponentById(id: number) {
  const entry = await repo.getFleetComponent(id);
  if (!entry) {
    const err: any = new Error('Fleet component not found');
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

export async function getFleetComponentByCode(code: string) {
  const entry = await repo.getActiveFleetComponentByCode(code);
  if (!entry) {
    const err: any = new Error('Fleet component not found');
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

export async function createFleetComponent(body: any) {
  const validatedData = insertFleetComponentsSchema.parse(body);

  const existing = await repo.getActiveFleetComponentByCode(validatedData.fleetEquipmentCode);
  if (existing) {
    const err: any = new Error('Fleet component with this code already exists');
    err.statusCode = 409;
    throw err;
  }

  return repo.createFleetComponent(validatedData);
}

export async function updateFleetComponent(id: number, body: any) {
  const existing = await repo.getFleetComponent(id);
  if (!existing) {
    const err: any = new Error('Fleet component not found');
    err.statusCode = 404;
    throw err;
  }
  return repo.updateFleetComponent(id, body);
}

export async function deleteFleetComponent(id: number) {
  const existing = await repo.getFleetComponent(id);
  if (!existing) {
    const err: any = new Error('Fleet component not found');
    err.statusCode = 404;
    throw err;
  }
  await repo.deleteFleetComponent(id);
  return { success: true, message: 'Fleet component deleted' };
}

// ══════════════════════════════════════════════════════════
// Fleet-Vessel Mapping (Admin)
// ══════════════════════════════════════════════════════════

export async function getFleetVesselMappings(query: any) {
  const { fleetEquipmentCode, vesselCode } = query;

  let mappings: any[] = [];

  if (fleetEquipmentCode) {
    mappings = await repo.getAdminFleetVesselMappings(fleetEquipmentCode as string);
  } else {
    mappings = await repo.getAdminFleetVesselMappings();
  }

  if (vesselCode) {
    mappings = mappings.filter((m: any) => m.vesselCode === vesselCode);
  }

  return mappings;
}

export async function getFleetVesselMappingsByEquipment(code: string) {
  return repo.getAdminFleetVesselMappings(code);
}

export async function getFleetVesselMappingsByVessel(vesselCode: string) {
  return repo.getFleetVesselMappingsByVessel(vesselCode);
}

export async function createFleetVesselMapping(body: any) {
  const validatedData = insertFleetVesselMappingSchema.parse(body);
  return repo.createFleetVesselMappingRecord(validatedData);
}

export async function deleteFleetVesselMapping(id: string) {
  await repo.deleteAdminFleetVesselMapping(id);
  return { success: true, message: 'Mapping deleted' };
}

// ══════════════════════════════════════════════════════════
// Component-Vessel Mappings
// ══════════════════════════════════════════════════════════

const createComponentVesselMappingSchema = z.object({
  fleetEquipmentCode: z.string(),
  vesselCode: z.string(),
  vesselName: z.string(),
  componentCode: z.string().optional(),
  componentName: z.string().optional(),
  componentId: z.string().optional(),
});

export async function getComponentVesselMappings() {
  return repo.getComponentVesselMappings();
}

export async function createComponentVesselMapping(body: any) {
  const validatedData = createComponentVesselMappingSchema.parse(body);
  return repo.createComponentVesselMapping(validatedData);
}

export async function mapVesselWithAutoLinkage(body: any) {
  const schema = z.object({
    fleetEquipmentCode: z.string(),
    vesselCode: z.string(),
    vesselName: z.string(),
  });
  const { fleetEquipmentCode, vesselCode, vesselName } = schema.parse(body);

  const vesselComponents = await repo.getVesselComponentsByFleetEquipmentPrefix(vesselCode, fleetEquipmentCode);

  // Find the parent vessel component (exact match on fleetEquipmentCode)
  const parentVesselComp = vesselComponents.find(vc => vc.fleetEquipmentCode === fleetEquipmentCode);
  let parentMapping: any = null;
  try {
    parentMapping = await repo.createFleetComponentMappingRecord({
      fleetEquipmentCode,
      vesselCode,
      componentCode: parentVesselComp?.componentCode || fleetEquipmentCode,
      componentName: parentVesselComp?.name || undefined,
      componentId: parentVesselComp?.cuuid || undefined,
      mappedBy: 'admin',
      isActive: true,
    });
  } catch (err: any) {
    // Ignore duplicate key — mapping already exists
    if (!err.message?.includes('unique') && !err.message?.includes('duplicate')) throw err;
  }

  let linkedCount = 0;
  for (const vc of vesselComponents) {
    if (vc.componentCode && vc.componentCode !== fleetEquipmentCode) {
      try {
        await repo.createFleetComponentMappingRecord({
          fleetEquipmentCode: vc.fleetEquipmentCode || fleetEquipmentCode,
          vesselCode,
          componentCode: vc.componentCode,
          componentName: vc.name || vc.fleetEquipmentName || undefined,
          componentId: vc.cuuid || undefined,
          mappedBy: 'admin',
          isActive: true,
        });
        linkedCount++;
      } catch (err: any) {
        // Ignore duplicate key — mapping already exists
        if (!err.message?.includes('unique') && !err.message?.includes('duplicate')) throw err;
      }
    }
  }

  return {
    parentMapping,
    linkedComponents: linkedCount,
    totalVesselComponents: vesselComponents.length,
  };
}

export async function deleteComponentVesselMapping(id: number) {
  await repo.deleteComponentVesselMapping(id);
  return { success: true, message: 'Component-vessel mapping deleted' };
}

// ══════════════════════════════════════════════════════════
// Fleet-Component Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetComponentMappings(query: any) {
  const { fleetEquipmentCode, vesselCode, componentCode } = query;

  let mappings: any[] = [];

  if (vesselCode) {
    mappings = await repo.getFleetComponentMappingsByVessel(vesselCode as string);
    if (fleetEquipmentCode) {
      mappings = mappings.filter((m: any) => m.fleetEquipmentCode === fleetEquipmentCode);
    }
  } else if (fleetEquipmentCode) {
    mappings = await repo.getFleetComponentMappings(fleetEquipmentCode as string);
  } else {
    // Get all mappings (no filter)
    mappings = await repo.getFleetComponentMappings();
  }

  if (componentCode) {
    mappings = mappings.filter((m: any) => m.componentCode === componentCode);
  }

  return mappings;
}

export async function getFleetComponentMappingsByEquipment(code: string) {
  return repo.getFleetComponentMappings(code);
}

export async function getFleetComponentMappingsByVessel(vesselCode: string) {
  return repo.getFleetComponentMappingsByVessel(vesselCode);
}

export async function createFleetComponentMapping(body: any) {
  const validatedData = insertFleetComponentMappingSchema.parse(body);
  return repo.createFleetComponentMappingRecord(validatedData);
}

export async function deleteFleetComponentMapping(query: any) {
  const { fleetEquipmentCode, vesselCode, componentCode } = query;

  if (!fleetEquipmentCode || !vesselCode || !componentCode) {
    const err: any = new Error('Missing required parameters: fleetEquipmentCode, vesselCode, componentCode');
    err.statusCode = 400;
    throw err;
  }

  await repo.removeFleetComponentMappingRecord(
    fleetEquipmentCode as string,
    vesselCode as string,
    componentCode as string
  );
  return { success: true, message: 'Mapping deleted' };
}

// ══════════════════════════════════════════════════════════
// Fleet-Job-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetJobMappings(query: any) {
  const { fleetEquipmentCode, jobCode, vesselCode } = query;

  let mappings = await repo.getFleetJobVesselMappings(
    fleetEquipmentCode as string | undefined,
    jobCode as string | undefined
  );

  if (vesselCode) {
    mappings = mappings.filter((m: any) => m.vesselCode === vesselCode);
  }

  return mappings;
}

export async function getFleetJobMappingsByJob(jobCode: string) {
  return repo.getFleetJobVesselMappings(undefined, jobCode);
}

export async function getFleetJobMappingsByVessel(vesselCode: string) {
  const allMappings = await repo.getFleetJobVesselMappings();
  return allMappings.filter((m: any) => m.vesselCode === vesselCode);
}

export async function createFleetJobMapping(body: any) {
  const validatedData = insertFleetJobVesselMappingSchema.parse(body);
  return repo.createFleetJobVesselMappingRecord(validatedData);
}

export async function deleteFleetJobMapping(query: any) {
  const { jobCode, vesselCode, jobId } = query;

  if (!jobCode || !vesselCode) {
    const err: any = new Error('Missing required parameters: jobCode, vesselCode');
    err.statusCode = 400;
    throw err;
  }

  await repo.removeFleetJobVesselMappingRecord(
    jobCode as string,
    vesselCode as string,
    jobId as string | undefined
  );
  return { success: true, message: 'Mapping deleted' };
}

// ══════════════════════════════════════════════════════════
// Fleet-Spare-Vessel Mappings
// ══════════════════════════════════════════════════════════

export async function getFleetSpareMappings(query: any) {
  const { fleetEquipmentCode, partCode, vesselCode } = query;

  let mappings = await repo.getFleetSpareVesselMappings(
    fleetEquipmentCode as string | undefined,
    partCode as string | undefined
  );

  if (vesselCode) {
    mappings = mappings.filter((m: any) => m.vesselCode === vesselCode);
  }

  return mappings;
}

export async function getFleetSpareMappingsBySpare(partCode: string) {
  return repo.getFleetSpareVesselMappings(undefined, partCode);
}

export async function getFleetSpareMappingsByVessel(vesselCode: string) {
  const allMappings = await repo.getFleetSpareVesselMappings();
  return allMappings.filter((m: any) => m.vesselCode === vesselCode);
}

export async function createFleetSpareMapping(body: any) {
  const validatedData = insertFleetSpareVesselMappingSchema.parse(body);
  return repo.createFleetSpareVesselMappingRecord(validatedData);
}

export async function deleteFleetSpareMapping(query: any) {
  const { partCode, vesselCode, spareId } = query;

  if (!partCode || !vesselCode) {
    const err: any = new Error('Missing required parameters: partCode, vesselCode');
    err.statusCode = 400;
    throw err;
  }

  await repo.removeFleetSpareVesselMappingRecord(
    partCode as string,
    vesselCode as string,
    spareId as string | undefined
  );
  return { success: true, message: 'Mapping deleted' };
}

// ══════════════════════════════════════════════════════════
// Bulk Import History & Errors
// ══════════════════════════════════════════════════════════

export async function getImportHistory(query: any) {
  const { vesselCode, moduleType, status, limit, offset } = query;

  let history = await repo.getBulkImportHistory(
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

  return { items: history, total, limit: limitNum, offset: offsetNum };
}

export async function getImportHistoryItem(id: string) {
  const entry = await repo.getBulkImportHistoryItem(id);
  if (!entry) {
    const err: any = new Error('Import history entry not found');
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

export async function getImportErrors(importId: string) {
  return repo.getBulkImportErrors(importId);
}

export async function createImportHistory(body: any) {
  const validatedData = insertBulkImportHistorySchema.parse(body);
  return repo.createBulkImportHistory(validatedData);
}

export async function updateImportHistory(id: string, body: any) {
  return repo.updateBulkImportHistory(id, body);
}

export async function createImportErrors(body: any) {
  const { errors } = body;

  if (!Array.isArray(errors)) {
    const err: any = new Error('Errors must be an array');
    err.statusCode = 400;
    throw err;
  }

  const validatedErrors = errors.map((e: any) => insertBulkImportErrorSchema.parse(e));
  await repo.createBulkImportErrors(validatedErrors);
  return { success: true, count: validatedErrors.length };
}

// ══════════════════════════════════════════════════════════
// Dashboard
// ══════════════════════════════════════════════════════════

export async function getDashboardMetrics() {
  return repo.getFleetAdminMetrics();
}

export async function getDashboardStats() {
  const { allComponents, allJobs, allSpares, allMakers } = await repo.getDashboardStatsData();

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
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(c => ({ id: c.id, code: c.fleetEquipmentCode, name: c.fleetEquipmentName, date: c.createdAt, type: 'component' as const }));
  const recentJobs = [...allJobs]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(j => ({ id: j.id, code: j.jobCode, name: j.woTitle, date: j.createdAt, type: 'job' as const }));
  const recentSpares = [...allSpares]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(s => ({ id: s.id, code: s.partCode, name: s.partName, date: s.createdAt, type: 'spare' as const }));

  return {
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
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10),
  };
}

// ══════════════════════════════════════════════════════════
// Copy Vessel — complex multi-table replication
// ══════════════════════════════════════════════════════════

const copyVesselSchema = z.object({
  sourceVesselCode: z.string().min(1, "Source vessel code is required"),
  targetVesselCode: z.string().min(1, "Target vessel code is required"),
  targetVesselName: z.string().optional(),
  copyComponents: z.boolean().default(true),
  copyJobs: z.boolean().default(true),
  copySpares: z.boolean().default(true),
  copyStores: z.boolean().default(true),
  mappedBy: z.string().default("system"),
});

export async function copyVessel(body: any) {
  const data = copyVesselSchema.parse(body);

  if (data.sourceVesselCode === data.targetVesselCode) {
    const err: any = new Error('Source and target vessel cannot be the same');
    err.statusCode = 400;
    throw err;
  }

  const db = await repo.getCopyVesselDb();
  const { components, jobs, spares, spareComponentLinks, storesItems } = repo;

  const copyResults = { components: 0, jobs: 0, spares: 0, spareComponentLinks: 0, stores: 0, errors: [] as string[], warnings: [] as string[] };
  const componentIdMap = new Map<string, string>();
  const spareIdMap = new Map<number, number>();
  const spareUuidMap = new Map<number, string>(); // source spare.id → target spare.suuid

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
      if (c.componentCode) existingCodeToId.set(c.componentCode, c.cuuid);
    }

    for (const comp of sourceComps) {
      const existingTargetId = comp.componentCode ? existingCodeToId.get(comp.componentCode) : undefined;
      if (existingTargetId) {
        componentIdMap.set(comp.cuuid, existingTargetId);
        continue;
      }
      const newId = generateId('COMP');
      const newCuuid = randomUUID();
      componentIdMap.set(comp.cuuid, newCuuid);

      try {
        await db.insert(components).values({
          id: newId,
          cuuid: newCuuid,
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
          installationDate: null,
          commissionedDate: null,
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
          runningHours: null,
          currentCumulativeRH: 0,
          rhCounterType: comp.rhCounterType,
          rhCounterSource: null,
        } as any);
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

      // D3: For Dual Frequency jobs, validate the TARGET component's RH Counter Type
      // Normalize to uppercase — DB column is unconstrained text with inconsistent casing
      if (job.maintenanceBasis === 'Dual Frequency' && newComponentId) {
        const [targetComp] = await db.select().from(components)
          .where(eq(components.cuuid, newComponentId));
        const targetRhType = (targetComp?.rhCounterType || '').toUpperCase();
        if (!targetComp || (targetRhType !== 'MASTER' && targetRhType !== 'INHERITED')) {
          const compName = targetComp?.name || job.componentName || newComponentId;
          copyResults.warnings.push(
            `Job ${job.jobNo} (Dual Frequency) skipped: target component "${compName}" has RH Counter Type "${targetComp?.rhCounterType || 'not set'}" (requires Master or Inherited)`
          );
          continue;
        }
      }

      try {
        await db.insert(jobs).values({
          id: newId,
          juuid: randomUUID(),
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
          lastDoneDate: null,
          nextDueDate: null,
          lastDoneRH: null,
          nextDueRH: null,
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
    const existingSpareUuidMap = new Map<number, string>(); // target spare id → suuid
    for (const s of targetSpareList) {
      existingSpareKeyMap.set(`${s.partCode}|${s.componentCode}`, s.id);
      if (s.suuid) existingSpareUuidMap.set(s.id, s.suuid);
    }

    for (const spare of sourceSpareList) {
      const spareKey = `${spare.partCode}|${spare.componentCode}`;
      const existingId = existingSpareKeyMap.get(spareKey);
      if (existingId !== undefined) {
        spareIdMap.set(spare.id, existingId);
        const existingSuuid = existingSpareUuidMap.get(existingId);
        if (existingSuuid) spareUuidMap.set(spare.id, existingSuuid);
        continue;
      }

      const newComponentId = componentIdMap.get(spare.componentId || '') || spare.componentId;

      try {
        const [inserted] = await db.insert(spares).values({
          suuid: randomUUID(),
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
          location: null,
          vesselId: data.targetVesselCode,
          dataScope: spare.dataScope || 'vessel',
          fleetEquipmentCode: spare.fleetEquipmentCode,
          fleetPartCode: spare.fleetPartCode,
          partNumber: spare.partNumber,
          uom: spare.uom,
          drawingNumber: spare.drawingNumber,
          drawingNo: spare.drawingNo,
          location2: null,
          remarks: spare.remarks,
        }).returning({ id: spares.id, suuid: spares.suuid });
        spareIdMap.set(spare.id, inserted.id);
        spareUuidMap.set(spare.id, inserted.suuid);
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
      const newSpareUuid = spareUuidMap.get(link.spareId);
      if (!newSpareUuid) continue; // Can't link without the spare's suuid

      const linkKey = `${newSpareId}|${newComponentId}`;
      if (existingLinkKeys.has(linkKey)) continue;

      try {
        await db.insert(spareComponentLinks).values({
          vesselId: data.targetVesselCode,
          spareId: newSpareId,
          spareUuid: newSpareUuid,
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
          stuuid: randomUUID(),
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

  const hasErrors = copyResults.errors.length > 0;
  const hasWarnings = copyResults.warnings.length > 0;
  const success = hasErrors ? (totalCopied > 0 ? 'partial' : false) : true;
  const message = hasErrors
    ? `Vessel copy completed with ${copyResults.errors.length} error(s). ${totalCopied} record(s) copied.`
    : hasWarnings
      ? `Vessel data replicated with ${copyResults.warnings.length} warning(s). ${totalCopied} record(s) copied.`
      : `Vessel data successfully replicated. ${totalCopied} record(s) copied.`;

  return {
    success,
    message,
    results: copyResults,
  };
}

// ══════════════════════════════════════════════════════════
// Re-Sync: Copy fleet field values → mapped vessel records
// ══════════════════════════════════════════════════════════

interface ResyncDetail {
  code: string;
  fleetCode: string;
  status: 'synced' | 'skipped' | 'failed' | 'no_changes';
  changedFields: string[];
  error?: string;
}

interface ResyncResult {
  synced: number;
  skipped: number;
  failed: number;
  noChanges: number;
  details: ResyncDetail[];
}

// --- Helper: compare two values, treating null/undefined/empty-string as equivalent ---
function fieldChanged(fleetVal: any, vesselVal: any): boolean {
  const a = fleetVal ?? '';
  const b = vesselVal ?? '';
  return String(a) !== String(b);
}

// --- Components Re-Sync ---

const COMPONENT_FIELD_MAP: Array<{ fleetKey: string; vesselKey: string; label: string }> = [
  { fleetKey: 'fleetEquipmentName', vesselKey: 'fleetEquipmentName', label: 'fleet_equipment_name' },
  { fleetKey: 'componentCategory',  vesselKey: 'componentCategory',  label: 'component_category' },
  { fleetKey: 'makerName',          vesselKey: 'maker',              label: 'maker' },
  { fleetKey: 'model',              vesselKey: 'model',              label: 'model' },
  { fleetKey: 'modelCode',          vesselKey: 'modelCode',          label: 'model_code' },
  { fleetKey: 'location',           vesselKey: 'location',           label: 'location' },
  { fleetKey: 'rating',             vesselKey: 'rating',             label: 'rating' },
  { fleetKey: 'eqptSystemDept',     vesselKey: 'eqptSystemDept',     label: 'eqpt_system_dept' },
  { fleetKey: 'notes',              vesselKey: 'notes',              label: 'notes' },
];

export async function resyncComponents(vesselCode: string, fleetEquipmentCode?: string): Promise<ResyncResult> {
  const mappings = await repo.getActiveComponentMappingsForVessel(vesselCode, fleetEquipmentCode);
  const result: ResyncResult = { synced: 0, skipped: 0, failed: 0, noChanges: 0, details: [] };

  for (const m of mappings) {
    const fleetComp = await repo.getActiveFleetComponentByCode(m.fleetEquipmentCode);
    if (!fleetComp) {
      result.skipped++;
      result.details.push({ code: m.componentCode, fleetCode: m.fleetEquipmentCode, status: 'skipped', changedFields: [], error: 'Fleet component not found or inactive' });
      continue;
    }

    if (!m.componentId) {
      result.failed++;
      result.details.push({ code: m.componentCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields: [], error: 'No component_id in mapping' });
      continue;
    }

    const vesselComp = await repo.getComponentByCuuid(m.componentId);
    if (!vesselComp) {
      result.failed++;
      result.details.push({ code: m.componentCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields: [], error: 'Vessel component not found' });
      continue;
    }

    // Compare and build update payload
    const updates: Record<string, any> = {};
    const changedFields: string[] = [];
    for (const f of COMPONENT_FIELD_MAP) {
      if (fieldChanged((fleetComp as any)[f.fleetKey], (vesselComp as any)[f.vesselKey])) {
        updates[f.vesselKey] = (fleetComp as any)[f.fleetKey];
        changedFields.push(f.label);
      }
    }

    if (changedFields.length === 0) {
      result.noChanges++;
      result.details.push({ code: m.componentCode, fleetCode: m.fleetEquipmentCode, status: 'no_changes', changedFields: [] });
      continue;
    }

    try {
      await repo.updateComponentResyncFields(m.componentId, updates);
      result.synced++;
      result.details.push({ code: m.componentCode, fleetCode: m.fleetEquipmentCode, status: 'synced', changedFields });
    } catch (e: any) {
      result.failed++;
      result.details.push({ code: m.componentCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields, error: e.message });
    }
  }

  return result;
}

// --- Jobs Re-Sync ---

const JOB_FIELD_MAP: Array<{ fleetKey: string; vesselKey: string; label: string }> = [
  { fleetKey: 'woTitle',          vesselKey: 'jobTitle',         label: 'job_title' },
  { fleetKey: 'maintenanceBasis', vesselKey: 'maintenanceBasis', label: 'maintenance_basis' },
  { fleetKey: 'intervalValue',    vesselKey: 'frequencyValue',   label: 'frequency_value' },
  { fleetKey: 'unit',             vesselKey: 'frequencyUnit',    label: 'frequency_unit' },
  { fleetKey: 'taskType',         vesselKey: 'maintenanceType',  label: 'maintenance_type' },
  { fleetKey: 'assignedTo',       vesselKey: 'assignedTo',       label: 'assigned_to' },
  { fleetKey: 'approver',         vesselKey: 'approver',         label: 'approver' },
  { fleetKey: 'jobPriority',      vesselKey: 'jobPriority',      label: 'job_priority' },
  { fleetKey: 'classRelated',     vesselKey: 'classRelated',     label: 'class_related' },
  { fleetKey: 'department',       vesselKey: 'department',       label: 'department' },
];

export async function resyncJobs(vesselCode: string, fleetEquipmentCode?: string): Promise<ResyncResult> {
  const mappings = await repo.getActiveJobMappingsForVessel(vesselCode, fleetEquipmentCode);
  const result: ResyncResult = { synced: 0, skipped: 0, failed: 0, noChanges: 0, details: [] };

  for (const m of mappings) {
    const fleetJob = await repo.getFleetJobByCode(m.jobCode);
    if (!fleetJob) {
      result.skipped++;
      result.details.push({ code: m.jobCode, fleetCode: m.fleetEquipmentCode, status: 'skipped', changedFields: [], error: 'Fleet job not found or inactive' });
      continue;
    }

    if (!m.jobId) {
      result.failed++;
      result.details.push({ code: m.jobCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields: [], error: 'No job_id in mapping' });
      continue;
    }

    const vesselJob = await repo.getJobByJuuid(m.jobId);
    if (!vesselJob) {
      result.failed++;
      result.details.push({ code: m.jobCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields: [], error: 'Vessel job not found' });
      continue;
    }

    const updates: Record<string, any> = {};
    const changedFields: string[] = [];
    for (const f of JOB_FIELD_MAP) {
      if (fieldChanged((fleetJob as any)[f.fleetKey], (vesselJob as any)[f.vesselKey])) {
        updates[f.vesselKey] = (fleetJob as any)[f.fleetKey];
        changedFields.push(f.label);
      }
    }

    if (changedFields.length === 0) {
      result.noChanges++;
      result.details.push({ code: m.jobCode, fleetCode: m.fleetEquipmentCode, status: 'no_changes', changedFields: [] });
      continue;
    }

    try {
      await repo.updateJobResyncFields(m.jobId, updates);
      result.synced++;
      result.details.push({ code: m.jobCode, fleetCode: m.fleetEquipmentCode, status: 'synced', changedFields });
    } catch (e: any) {
      result.failed++;
      result.details.push({ code: m.jobCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields, error: e.message });
    }
  }

  return result;
}

// --- Spares Re-Sync ---

const SPARE_FIELD_MAP: Array<{ fleetKey: string; vesselKey: string; label: string }> = [
  { fleetKey: 'partName',           vesselKey: 'partName',       label: 'part_name' },
  { fleetKey: 'partNumber',         vesselKey: 'partNumber',     label: 'part_number' },
  { fleetKey: 'unitOfMeasurement',  vesselKey: 'uom',            label: 'uom' },
  { fleetKey: 'maker',              vesselKey: 'maker',          label: 'maker' },
  { fleetKey: 'drawingNumber',      vesselKey: 'drawingNumber',  label: 'drawing_number' },
  { fleetKey: 'positionNumber',     vesselKey: 'positionNumber', label: 'position_number' },
  { fleetKey: 'note',               vesselKey: 'note',           label: 'note' },
  { fleetKey: 'criticality',        vesselKey: 'criticality',    label: 'criticality' },
  { fleetKey: 'ihm',                vesselKey: 'ihm',            label: 'ihm' },
  { fleetKey: 'evidenceType',       vesselKey: 'evidenceType',   label: 'evidence_type' },
];

export async function resyncSpares(vesselCode: string, fleetEquipmentCode?: string): Promise<ResyncResult> {
  const mappings = await repo.getActiveSpareMappingsForVessel(vesselCode, fleetEquipmentCode);
  const result: ResyncResult = { synced: 0, skipped: 0, failed: 0, noChanges: 0, details: [] };

  for (const m of mappings) {
    const fleetSpare = await repo.getFleetSpareByPartCode(m.partCode);
    if (!fleetSpare) {
      result.skipped++;
      result.details.push({ code: m.partCode, fleetCode: m.fleetEquipmentCode, status: 'skipped', changedFields: [], error: 'Fleet spare not found or inactive' });
      continue;
    }

    if (!m.spareId) {
      result.failed++;
      result.details.push({ code: m.partCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields: [], error: 'No spare_id in mapping' });
      continue;
    }

    const vesselSpare = await repo.getSpareBySuuid(m.spareId);
    if (!vesselSpare) {
      result.failed++;
      result.details.push({ code: m.partCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields: [], error: 'Vessel spare not found' });
      continue;
    }

    const updates: Record<string, any> = {};
    const changedFields: string[] = [];
    for (const f of SPARE_FIELD_MAP) {
      if (fieldChanged((fleetSpare as any)[f.fleetKey], (vesselSpare as any)[f.vesselKey])) {
        updates[f.vesselKey] = (fleetSpare as any)[f.fleetKey];
        changedFields.push(f.label);
      }
    }

    if (changedFields.length === 0) {
      result.noChanges++;
      result.details.push({ code: m.partCode, fleetCode: m.fleetEquipmentCode, status: 'no_changes', changedFields: [] });
      continue;
    }

    try {
      await repo.updateSpareResyncFields(m.spareId, updates);
      result.synced++;
      result.details.push({ code: m.partCode, fleetCode: m.fleetEquipmentCode, status: 'synced', changedFields });
    } catch (e: any) {
      result.failed++;
      result.details.push({ code: m.partCode, fleetCode: m.fleetEquipmentCode, status: 'failed', changedFields, error: e.message });
    }
  }

  return result;
}
