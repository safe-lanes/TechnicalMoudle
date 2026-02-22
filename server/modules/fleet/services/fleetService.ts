import { z } from 'zod';
import * as XLSX from 'xlsx';
import {
  insertComponentSchema,
  insertFleetJobsSchema,
  insertFleetSparesSchema,
  insertMakerListSchema,
  insertMasterListSchema,
} from '@shared/schema';
import * as repo from '../repositories/fleetRepository';

// ══════════════════════════════════════════════════════════
// Fleet-Scoped Components
// ══════════════════════════════════════════════════════════

export async function getFleetScopedComponents() {
  return repo.getFleetScopedComponents();
}

export async function getFleetScopedComponent(id: string) {
  const component = await repo.getFleetScopedComponent(id);
  if (!component) {
    const err: any = new Error('Fleet component not found');
    err.statusCode = 404;
    throw err;
  }
  return component;
}

export async function createFleetScopedComponent(body: any) {
  const validatedData = insertComponentSchema.parse(body);
  return repo.createFleetScopedComponent(validatedData);
}

export async function updateFleetScopedComponent(id: string, body: any) {
  const partialComponentSchema = insertComponentSchema.partial();
  const validatedData = partialComponentSchema.parse(body);
  return repo.updateFleetScopedComponent(id, validatedData);
}

export async function deleteFleetScopedComponent(id: string) {
  await repo.deleteFleetScopedComponent(id);
  return { success: true };
}

export async function updateComponentSortOrder(body: any) {
  const sortOrderSchema = z.object({
    updates: z.array(z.object({
      id: z.number(),
      sortOrder: z.number(),
    })),
  });
  const { updates } = sortOrderSchema.parse(body);
  return repo.updateComponentSortOrder(updates);
}

// ══════════════════════════════════════════════════════════
// Fleet Jobs
// ══════════════════════════════════════════════════════════

export async function getFleetJobs() {
  return repo.getFleetJobs();
}

export async function getFleetJob(id: string) {
  const job = await repo.getFleetJob(id);
  if (!job) {
    const err: any = new Error('Fleet job not found');
    err.statusCode = 404;
    throw err;
  }
  return job;
}

export async function createFleetJob(body: any) {
  const validatedData = insertFleetJobsSchema.parse(body);
  return repo.createFleetJob(validatedData);
}

export async function updateFleetJob(id: string, body: any) {
  const STRING_FIELDS = [
    'woTitle', 'jobCode', 'maintenanceBasis', 'intervalValue', 'unit',
    'taskType', 'assignedTo', 'approver', 'jobPriority',
    'classRelated', 'briefWorkDescription', 'department',
    'criticality', 'ppeRequirements', 'permitRequirements',
    'otherSafetyRequirements',
  ];
  const NOTNULL_STRING_FIELDS = new Set([
    'woTitle', 'jobCode', 'taskType', 'assignedTo', 'approver',
    'jobPriority', 'classRelated', 'briefWorkDescription',
    'department', 'criticality',
  ]);
  const JSON_FIELDS = ['requiredSpareParts', 'requiredTools'];
  const BOOLEAN_FIELDS = ['isActive'];

  const sanitizedData: Record<string, any> = {};
  const errors: string[] = [];

  for (const field of STRING_FIELDS) {
    if (field in body && body[field] !== undefined) {
      const val = body[field];
      if (typeof val !== 'string') {
        errors.push(`${field} must be a string`);
        continue;
      }
      if (NOTNULL_STRING_FIELDS.has(field) && val.trim() === '') {
        continue;
      }
      sanitizedData[field] = val;
    }
  }

  for (const field of JSON_FIELDS) {
    if (field in body && body[field] !== undefined) {
      const val = body[field];
      if (val !== null && !Array.isArray(val) && typeof val !== 'object') {
        errors.push(`${field} must be an array or object`);
        continue;
      }
      sanitizedData[field] = val;
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (field in body && body[field] !== undefined) {
      const val = body[field];
      if (typeof val !== 'boolean') {
        errors.push(`${field} must be a boolean`);
        continue;
      }
      sanitizedData[field] = val;
    }
  }

  if (errors.length > 0) {
    const err: any = new Error('Invalid field types');
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }
  if (Object.keys(sanitizedData).length === 0) {
    const err: any = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  console.log(`[Fleet Jobs PATCH] id=${id}, fields: ${Object.keys(sanitizedData).join(', ')}`);
  const { updatedJob, affectedCount } = await repo.updateFleetJob(Number(id), sanitizedData);
  return { ...updatedJob, affectedCount };
}

export async function deleteFleetJob(id: string) {
  await repo.deleteFleetJob(id);
  return { success: true };
}

export async function exportFleetJobs(fleetEquipmentCode?: string) {
  let jobsList = await repo.getFleetJobs();
  if (fleetEquipmentCode && typeof fleetEquipmentCode === 'string') {
    jobsList = jobsList.filter((j: any) => j.fleetEquipmentCode === fleetEquipmentCode);
  }

  const headers = [
    'Job Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'WO Title',
    'Task Type', 'Assigned To', 'Approver', 'Job Priority',
    'Class Related', 'Brief Work Description', 'Department', 'Criticality',
    'Is Active', 'Maintenance Basis', 'Interval Value', 'Unit',
    'Required Spare Parts', 'Required Tools', 'PPE Requirements',
    'Permit Requirements', 'Other Safety Requirements'
  ];

  const rows = jobsList.map((j: any) => [
    j.jobCode || '',
    j.fleetEquipmentCode || '',
    j.fleetEquipmentName || '',
    j.woTitle || '',
    j.taskType || '',
    j.assignedTo || '',
    j.approver || '',
    j.jobPriority || '',
    j.classRelated || '',
    j.briefWorkDescription || '',
    j.department || '',
    j.criticality || '',
    j.isActive === false ? 'No' : 'Yes',
    j.maintenanceBasis || '',
    j.intervalValue || '',
    j.unit || '',
    Array.isArray(j.requiredSpareParts) ? j.requiredSpareParts.join(', ') : (j.requiredSpareParts || ''),
    Array.isArray(j.requiredTools) ? j.requiredTools.join(', ') : (j.requiredTools || ''),
    j.ppeRequirements || '',
    j.permitRequirements || '',
    j.otherSafetyRequirements || '',
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = [18, 22, 35, 30, 15, 18, 18, 12, 12, 40, 15, 12, 10, 18, 12, 12, 30, 25, 20, 20, 25];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fleet Jobs');

  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    filename: `fleet-jobs-${new Date().toISOString().split('T')[0]}.xlsx`,
  };
}

// ══════════════════════════════════════════════════════════
// Fleet Spares
// ══════════════════════════════════════════════════════════

export async function getFleetSpares() {
  return repo.getFleetSpares();
}

export async function getFleetSpare(id: number) {
  const spare = await repo.getFleetSpare(id);
  if (!spare) {
    const err: any = new Error('Fleet spare not found');
    err.statusCode = 404;
    throw err;
  }
  return spare;
}

export async function createFleetSpare(body: any) {
  const validatedData = insertFleetSparesSchema.parse(body);
  return repo.createFleetSpare(validatedData);
}

export async function updateFleetSpare(id: number, body: any) {
  const partialSchema = insertFleetSparesSchema.partial();
  const validatedData = partialSchema.parse(body);
  return repo.updateFleetSpare(id, validatedData);
}

export async function deleteFleetSpare(id: number) {
  await repo.deleteFleetSpare(id);
  return { success: true };
}

export async function exportFleetSpares(fleetEquipmentCode?: string) {
  let sparesList = await repo.getFleetSpares();
  if (fleetEquipmentCode && typeof fleetEquipmentCode === 'string') {
    sparesList = sparesList.filter((s: any) => s.fleetEquipmentCode === fleetEquipmentCode);
  }

  const headers = [
    'Part Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'Part Name',
    'Part Number', 'Unit Of Measurement', 'Drawing Number', 'Position Number',
    'Note', 'Specification', 'Maker', 'Maker Code',
    'Manual Name', 'Page Number', 'Criticality', 'Is Active',
    'IHM (Inventory of Hazardous Materials)', 'Evidence Type'
  ];

  const rows = sparesList.map((s: any) => [
    s.partCode || '',
    s.fleetEquipmentCode || '',
    s.fleetEquipmentName || '',
    s.partName || '',
    s.partNumber || '',
    s.unitOfMeasurement || '',
    s.drawingNumber || '',
    s.positionNumber || '',
    s.note || '',
    s.specification || '',
    s.maker || '',
    s.makerCode || '',
    s.manualName || '',
    s.pageNumber || '',
    s.criticality || '',
    s.isActive === false ? 'No' : 'Yes',
    s.ihm || '',
    s.evidenceType || '',
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = [18, 22, 35, 30, 18, 18, 18, 15, 25, 25, 25, 15, 20, 12, 12, 10, 15, 15];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fleet Spares');

  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    filename: `fleet-spares-${new Date().toISOString().split('T')[0]}.xlsx`,
  };
}

// ══════════════════════════════════════════════════════════
// Makers
// ══════════════════════════════════════════════════════════

export async function getMakers(search?: string) {
  return repo.getMakers(search);
}

export async function getMakerById(id: number) {
  const maker = await repo.getMakerById(id);
  if (!maker) {
    const err: any = new Error('Maker not found');
    err.statusCode = 404;
    throw err;
  }
  return maker;
}

export async function createMaker(body: any) {
  const validatedData = insertMakerListSchema.parse(body);

  // Auto-generate makerCode if not provided or empty
  let makerCode = validatedData.makerCode;
  if (!makerCode || makerCode.trim() === '') {
    const existingMakers = await repo.getMakers();
    let maxNum = 0;
    for (const m of existingMakers) {
      const match = m.makerCode?.match(/MKR-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    makerCode = `MKR-${String(maxNum + 1).padStart(6, '0')}`;
  }

  return repo.createMaker({ ...validatedData, makerCode });
}

export async function updateMaker(id: number, body: any) {
  const partialMakerSchema = insertMakerListSchema.partial();
  const validatedData = partialMakerSchema.parse(body);

  // Prevent clearing makerCode - remove it from update if empty
  if (validatedData.makerCode !== undefined && validatedData.makerCode.trim() === '') {
    delete validatedData.makerCode;
  }

  return repo.updateMaker(id, validatedData);
}

export async function deleteMaker(id: number) {
  await repo.deleteMaker(id);
  return { success: true };
}

// ══════════════════════════════════════════════════════════
// Master Lists
// ══════════════════════════════════════════════════════════

export async function getMasterLists(listType?: string) {
  return repo.getMasterLists(listType);
}

export async function getMasterListById(id: number) {
  const masterList = await repo.getMasterListById(id);
  if (!masterList) {
    const err: any = new Error('Master list not found');
    err.statusCode = 404;
    throw err;
  }
  return masterList;
}

export async function createMasterList(body: any) {
  const validatedData = insertMasterListSchema.parse(body);
  return repo.createMasterList(validatedData);
}

export async function updateMasterList(id: number, body: any) {
  const partialMasterListSchema = insertMasterListSchema.partial();
  const validatedData = partialMasterListSchema.parse(body);
  return repo.updateMasterList(id, validatedData);
}

export async function deleteMasterList(id: number) {
  await repo.deleteMasterList(id);
  return { success: true };
}

// ══════════════════════════════════════════════════════════
// Fleet Vessel Mappings (from routes.ts)
// ══════════════════════════════════════════════════════════

export async function getFleetVesselMappings() {
  return repo.getFleetVesselMappings();
}

export async function createFleetVesselMappings(body: any) {
  const { fleetEntityType, fleetEntityIds, vesselId, vesselEntityId, vesselEntityCode } = body;

  if (!fleetEntityType || !fleetEntityIds?.length || !vesselId) {
    const err: any = new Error('Missing required fields: fleetEntityType, fleetEntityIds, vesselId');
    err.statusCode = 400;
    throw err;
  }

  return repo.createFleetVesselMappings({
    fleetEntityType,
    fleetEntityIds,
    vesselId,
    vesselEntityId,
    vesselEntityCode,
    mappedBy: 'admin'
  });
}

export async function deleteFleetVesselMapping(id: string) {
  await repo.deleteFleetVesselMapping(id);
  return { success: true };
}
